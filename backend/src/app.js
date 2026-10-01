const cors = require('cors');
const express = require('express');
const { Prisma, PrismaClient } = require('@prisma/client');

const {
  customerInputSchema,
  explanationResponseSchema,
  historyLimitSchema,
  modelNameSchema,
  predictionResponseSchema,
} = require('./validation');
const { createMlClient, MlServiceError } = require('./ml-client');

const prisma = new PrismaClient();

const customerFieldMap = {
  gender: 'gender',
  SeniorCitizen: 'seniorCitizen',
  Partner: 'partner',
  Dependents: 'dependents',
  tenure: 'tenure',
  PhoneService: 'phoneService',
  MultipleLines: 'multipleLines',
  InternetService: 'internetService',
  OnlineSecurity: 'onlineSecurity',
  OnlineBackup: 'onlineBackup',
  DeviceProtection: 'deviceProtection',
  TechSupport: 'techSupport',
  StreamingTV: 'streamingTV',
  StreamingMovies: 'streamingMovies',
  Contract: 'contract',
  PaperlessBilling: 'paperlessBilling',
  PaymentMethod: 'paymentMethod',
  MonthlyCharges: 'monthlyCharges',
  TotalCharges: 'totalCharges',
};

function mapCustomerFields(payload) {
  return Object.fromEntries(
    Object.entries(customerFieldMap).map(([inputKey, databaseKey]) => [databaseKey, payload[inputKey]]),
  );
}

function validateCustomer(req, res, next) {
  const result = customerInputSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid customer data.',
      details: result.error.flatten(),
    });
  }
  req.customerInput = result.data;
  return next();
}

function getModelName(req) {
  const result = modelNameSchema.safeParse(req.query.model_name);
  if (!result.success) {
    const error = new Error('Invalid model_name query parameter.');
    error.statusCode = 400;
    throw error;
  }
  return result.data;
}

function createApp({ prismaClient = prisma, mlClient = createMlClient() } = {}) {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', async (req, res) => {
    await prismaClient.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'churnwise-backend', database: 'connected' });
  });

  app.post('/api/predictions', validateCustomer, async (req, res) => {
    const modelName = getModelName(req);
    let mlResult;
    try {
      mlResult = predictionResponseSchema.parse(await mlClient.predict(req.customerInput, modelName));
    } catch (error) {
      if (error instanceof MlServiceError) {
        throw error;
      }
      if (error.name === 'ZodError') {
        throw new MlServiceError('FastAPI ML service returned an invalid prediction response.', { cause: error });
      }
      throw error;
    }

    const { customerID } = req.customerInput;
    const customerData = mapCustomerFields(req.customerInput);
    const prediction = await prismaClient.$transaction(async (transaction) => {
      const customer = customerID
        ? await transaction.customer.upsert({
          where: { externalCustomerId: customerID },
          update: customerData,
          create: { ...customerData, externalCustomerId: customerID },
        })
        : await transaction.customer.create({ data: customerData });

      return transaction.prediction.create({
        data: {
          customerId: customer.id,
          prediction: mlResult.prediction,
          churnProbability: mlResult.churn_probability,
          riskLevel: mlResult.risk_level,
          modelUsed: mlResult.model_used,
        },
      });
    });

    res.status(201).json({
      id: prediction.id,
      customerId: prediction.customerId,
      prediction: prediction.prediction,
      churn_probability: prediction.churnProbability,
      risk_level: prediction.riskLevel,
      model_used: prediction.modelUsed,
      predicted_at: prediction.predictedAt,
    });
  });

  app.post('/api/explanations', validateCustomer, async (req, res) => {
    const modelName = getModelName(req);
    const result = explanationResponseSchema.parse(await mlClient.explain(req.customerInput, modelName));
    res.json(result);
  });

  app.get('/api/predictions', async (req, res) => {
    const parsedLimit = historyLimitSchema.safeParse(req.query.limit);
    if (!parsedLimit.success) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 500.' });
    }
    const predictions = await prismaClient.prediction.findMany({
      orderBy: { predictedAt: 'desc' },
      take: parsedLimit.data,
      include: { customer: true },
    });
    return res.json({ predictions });
  });

  app.get('/api/customers', async (req, res) => {
    const customers = await prismaClient.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { predictions: true } } },
    });
    res.json({ customers });
  });

  app.get('/api/dashboard/stats', async (req, res) => {
    const [totalPredictions, predictionGroups, riskGroups] = await Promise.all([
      prismaClient.prediction.count(),
      prismaClient.prediction.groupBy({ by: ['prediction'], _count: { _all: true } }),
      prismaClient.prediction.groupBy({ by: ['riskLevel'], _count: { _all: true } }),
    ]);
    const predictionCounts = Object.fromEntries(
      predictionGroups.map((group) => [group.prediction, group._count._all]),
    );
    const riskCounts = Object.fromEntries(
      riskGroups.map((group) => [group.riskLevel.toLowerCase(), group._count._all]),
    );

    res.json({
      totalPredictions,
      churnPredictions: predictionCounts.Churn || 0,
      noChurnPredictions: predictionCounts['No Churn'] || 0,
      riskCounts: {
        high: riskCounts.high || 0,
        medium: riskCounts.medium || 0,
        low: riskCounts.low || 0,
      },
    });
  });

  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    if (error instanceof MlServiceError) {
      return res.status(502).json({ error: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'A record with this unique value already exists.' });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof SyntaxError && Object.hasOwn(error, 'body')) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    console.error('Unhandled API error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp, mapCustomerFields, prisma };
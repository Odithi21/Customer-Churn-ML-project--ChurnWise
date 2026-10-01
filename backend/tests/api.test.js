const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { MlServiceError } = require('../src/ml-client');

const customerPayload = {
  customerID: 'TEST-001',
  gender: 'Male',
  SeniorCitizen: 0,
  Partner: 'No',
  Dependents: 'No',
  tenure: 12,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'Fiber optic',
  OnlineSecurity: 'No',
  OnlineBackup: 'No',
  DeviceProtection: 'No',
  TechSupport: 'No',
  StreamingTV: 'Yes',
  StreamingMovies: 'Yes',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: 95.5,
  TotalCharges: 1146,
};

const mlPrediction = {
  prediction: 'Churn',
  churn_probability: 0.72,
  risk_level: 'High',
  model_used: 'Gradient Boosting',
};

const mlExplanation = {
  ...mlPrediction,
  top_contributing_features: [{ feature: 'tenure', contribution: 0.2, direction: 'increase' }],
  shap_values: [{ feature: 'tenure', contribution: 0.2, direction: 'increase' }],
  explanation: 'Tenure contributes to churn risk.',
};

function createTestContext() {
  const savedCustomers = [];
  const savedPredictions = [];
  const prismaClient = {
    $queryRaw: async () => [{ 1: 1 }],
    customer: {
      upsert: async ({ where, update, create }) => {
        let customer = savedCustomers.find((item) => item.externalCustomerId === where.externalCustomerId);
        if (customer) {
          Object.assign(customer, update);
        } else {
          customer = { id: 'customer-1', ...create };
          savedCustomers.push(customer);
        }
        return customer;
      },
      create: async ({ data }) => {
        const customer = { id: `customer-${savedCustomers.length + 1}`, ...data };
        savedCustomers.push(customer);
        return customer;
      },
      findMany: async () => savedCustomers,
    },
    prediction: {
      create: async ({ data }) => {
        const prediction = {
          id: `prediction-${savedPredictions.length + 1}`,
          predictedAt: new Date('2026-10-01T12:00:00.000Z'),
          ...data,
        };
        savedPredictions.push(prediction);
        return prediction;
      },
      findMany: async () => savedPredictions,
      count: async () => savedPredictions.length,
      groupBy: async ({ by }) => {
        const field = by[0];
        const groups = new Map();
        for (const item of savedPredictions) {
          groups.set(item[field], (groups.get(item[field]) || 0) + 1);
        }
        return [...groups].map(([value, count]) => ({
          [field]: value,
          _count: { _all: count },
        }));
      },
    },
  };
  prismaClient.$transaction = (callback) => callback(prismaClient);

  const calls = { predict: [], explain: [] };
  const mlClient = {
    predict: async (payload, modelName) => {
      calls.predict.push({ payload, modelName });
      return mlPrediction;
    },
    explain: async (payload, modelName) => {
      calls.explain.push({ payload, modelName });
      return mlExplanation;
    },
  };

  return {
    app: createApp({ prismaClient, mlClient }),
    calls,
    prismaClient,
    savedCustomers,
    savedPredictions,
  };
}

test('GET /api/health reports API and database health', async () => {
  const { app } = createTestContext();
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
});

test('POST /api/predictions forwards customer data and persists customer plus result', async () => {
  const context = createTestContext();
  const response = await request(context.app).post('/api/predictions').send(customerPayload);

  assert.equal(response.status, 201);
  assert.equal(response.body.prediction, 'Churn');
  assert.equal(response.body.churn_probability, 0.72);
  assert.equal(response.body.model_used, 'Gradient Boosting');
  assert.equal(context.calls.predict.length, 1);
  assert.deepEqual(context.calls.predict[0].payload, customerPayload);
  assert.equal(context.savedCustomers.length, 1);
  assert.equal(context.savedCustomers[0].externalCustomerId, 'TEST-001');
  assert.equal(context.savedPredictions.length, 1);
  assert.equal(context.savedPredictions[0].customerId, 'customer-1');
});

test('POST /api/predictions rejects invalid input before calling FastAPI', async () => {
  const context = createTestContext();
  const response = await request(context.app)
    .post('/api/predictions')
    .send({ ...customerPayload, tenure: 99 });

  assert.equal(response.status, 400);
  assert.equal(context.calls.predict.length, 0);
  assert.equal(context.savedPredictions.length, 0);
});

test('POST /api/explanations forwards input and returns SHAP output', async () => {
  const context = createTestContext();
  const response = await request(context.app).post('/api/explanations').send(customerPayload);

  assert.equal(response.status, 200);
  assert.equal(response.body.model_used, 'Gradient Boosting');
  assert.equal(response.body.top_contributing_features[0].feature, 'tenure');
  assert.equal(context.calls.explain.length, 1);
  assert.deepEqual(context.calls.explain[0].payload, customerPayload);
});

test('GET /api/predictions returns history and GET /api/customers returns stored customers', async () => {
  const context = createTestContext();
  await request(context.app).post('/api/predictions').send(customerPayload);

  const history = await request(context.app).get('/api/predictions?limit=10');
  const customers = await request(context.app).get('/api/customers');
  assert.equal(history.status, 200);
  assert.equal(history.body.predictions.length, 1);
  assert.equal(customers.status, 200);
  assert.equal(customers.body.customers.length, 1);
});

test('GET /api/dashboard/stats aggregates predictions and risk levels', async () => {
  const context = createTestContext();
  await request(context.app).post('/api/predictions').send(customerPayload);

  const response = await request(context.app).get('/api/dashboard/stats');
  assert.equal(response.status, 200);
  assert.equal(response.body.totalPredictions, 1);
  assert.equal(response.body.churnPredictions, 1);
  assert.equal(response.body.noChurnPredictions, 0);
  assert.equal(response.body.riskCounts.high, 1);
});

test('FastAPI failures become 502 responses without saving predictions', async () => {
  const context = createTestContext();
  const failingApp = createApp({
    prismaClient: context.prismaClient,
    mlClient: {
      predict: async () => {
        throw new MlServiceError('Could not reach the FastAPI ML service.');
      },
      explain: async () => {
        throw new MlServiceError('Could not reach the FastAPI ML service.');
      },
    },
  });
  const response = await request(failingApp).post('/api/predictions').send(customerPayload);
  assert.equal(response.status, 502);
  assert.equal(context.savedPredictions.length, 0);
});
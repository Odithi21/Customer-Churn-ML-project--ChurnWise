const { z } = require('zod');

const customerInputSchema = z.object({
  customerID: z.string().trim().min(1).max(100).optional(),
  gender: z.enum(['Female', 'Male']),
  SeniorCitizen: z.number().int().min(0).max(1),
  Partner: z.enum(['Yes', 'No']),
  Dependents: z.enum(['Yes', 'No']),
  tenure: z.number().int().min(0).max(72),
  PhoneService: z.enum(['Yes', 'No']),
  MultipleLines: z.enum(['No phone service', 'No', 'Yes']),
  InternetService: z.enum(['DSL', 'Fiber optic', 'No']),
  OnlineSecurity: z.enum(['No internet service', 'No', 'Yes']),
  OnlineBackup: z.enum(['No internet service', 'No', 'Yes']),
  DeviceProtection: z.enum(['No internet service', 'No', 'Yes']),
  TechSupport: z.enum(['No internet service', 'No', 'Yes']),
  StreamingTV: z.enum(['No internet service', 'No', 'Yes']),
  StreamingMovies: z.enum(['No internet service', 'No', 'Yes']),
  Contract: z.enum(['Month-to-month', 'One year', 'Two year']),
  PaperlessBilling: z.enum(['Yes', 'No']),
  PaymentMethod: z.enum([
    'Electronic check',
    'Mailed check',
    'Bank transfer',
    'Credit card (automatic)',
  ]),
  MonthlyCharges: z.number().finite().nonnegative(),
  TotalCharges: z.number().finite().nonnegative(),
}).strict();

const predictionResponseSchema = z.object({
  prediction: z.enum(['Churn', 'No Churn']),
  churn_probability: z.number().finite().min(0).max(1),
  risk_level: z.enum(['Low', 'Medium', 'High']),
  model_used: z.string().min(1),
});

const explanationResponseSchema = z.object({
  prediction: z.enum(['Churn', 'No Churn']),
  churn_probability: z.number().finite().min(0).max(1),
  model_used: z.string().min(1),
  top_contributing_features: z.array(z.record(z.unknown())),
  shap_values: z.array(z.record(z.unknown())),
  explanation: z.string(),
});

const modelNameSchema = z.string().trim().min(1).max(100).optional();
const historyLimitSchema = z.coerce.number().int().min(1).max(500).default(100);

module.exports = {
  customerInputSchema,
  explanationResponseSchema,
  historyLimitSchema,
  modelNameSchema,
  predictionResponseSchema,
};
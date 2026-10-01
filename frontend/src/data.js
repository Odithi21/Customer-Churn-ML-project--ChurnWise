export const featureGroups = [
  {
    title: 'Customer profile',
    fields: [
      { key: 'gender', label: 'Gender', options: ['Female', 'Male'] },
      { key: 'SeniorCitizen', label: 'Senior citizen', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
      { key: 'Partner', label: 'Partner', options: ['Yes', 'No'] },
      { key: 'Dependents', label: 'Dependents', options: ['Yes', 'No'] },
      { key: 'tenure', label: 'Tenure (months)', type: 'number', min: 0, max: 72, step: 1 },
    ],
  },
  {
    title: 'Services',
    fields: [
      { key: 'PhoneService', label: 'Phone service', options: ['Yes', 'No'] },
      { key: 'MultipleLines', label: 'Multiple lines', options: ['No phone service', 'No', 'Yes'] },
      { key: 'InternetService', label: 'Internet service', options: ['DSL', 'Fiber optic', 'No'] },
      ...['OnlineSecurity', 'OnlineBackup', 'DeviceProtection', 'TechSupport', 'StreamingTV', 'StreamingMovies'].map((key) => ({
        key,
        label: key.replace(/([a-z])([A-Z])/g, '$1 $2').trim(),
        options: ['No internet service', 'No', 'Yes'],
      })),
    ],
  },
  {
    title: 'Billing',
    fields: [
      { key: 'Contract', label: 'Contract', options: ['Month-to-month', 'One year', 'Two year'] },
      { key: 'PaperlessBilling', label: 'Paperless billing', options: ['Yes', 'No'] },
      { key: 'PaymentMethod', label: 'Payment method', options: ['Electronic check', 'Mailed check', 'Bank transfer', 'Credit card (automatic)'] },
      { key: 'MonthlyCharges', label: 'Monthly charges ($)', type: 'number', min: 0, step: 0.01 },
      { key: 'TotalCharges', label: 'Total charges ($)', type: 'number', min: 0, step: 0.01 },
    ],
  },
];

export const initialForm = {
  customerID: '',
  gender: 'Female',
  SeniorCitizen: '0',
  Partner: 'Yes',
  Dependents: 'No',
  tenure: '',
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'Fiber optic',
  OnlineSecurity: 'No',
  OnlineBackup: 'No',
  DeviceProtection: 'No',
  TechSupport: 'No',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: '',
  TotalCharges: '',
};

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

export function payloadFromCustomer(customer) {
  const payload = {};
  if (customer.externalCustomerId) payload.customerID = customer.externalCustomerId;
  for (const [apiKey, customerKey] of Object.entries(customerFieldMap)) {
    payload[apiKey] = customer[customerKey];
  }
  return payload;
}

export function latestPredictionByCustomer(predictions) {
  const latest = new Map();
  for (const prediction of predictions) {
    const customer = prediction.customer;
    if (!customer) continue;
    const key = customer.externalCustomerId || customer.id;
    if (key && !latest.has(key)) latest.set(key, prediction);
  }
  return latest;
}

export function humanizeFeature(feature = '') {
  return feature
    .replace(/^(num|cat)__/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
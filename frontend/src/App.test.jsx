import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const savedCustomer = {
  id: 'customer-1',
  externalCustomerId: 'C-100',
  gender: 'Female',
  seniorCitizen: 0,
  partner: 'Yes',
  dependents: 'No',
  tenure: 12,
  phoneService: 'Yes',
  multipleLines: 'No',
  internetService: 'Fiber optic',
  onlineSecurity: 'No',
  onlineBackup: 'No',
  deviceProtection: 'No',
  techSupport: 'No',
  streamingTV: 'No',
  streamingMovies: 'No',
  contract: 'Month-to-month',
  paperlessBilling: 'Yes',
  paymentMethod: 'Electronic check',
  monthlyCharges: 72.5,
  totalCharges: 870,
};

const savedPrediction = {
  id: 'prediction-1',
  customerId: 'customer-1',
  prediction: 'Churn',
  churnProbability: 0.72,
  riskLevel: 'High',
  modelUsed: 'Gradient Boosting',
  predictedAt: '2026-10-01T12:00:00.000Z',
  customer: savedCustomer,
};

function mockApi({ failStats = false } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const parsed = new URL(url, 'http://localhost');
    calls.push({ path: parsed.pathname, options, url: parsed });
    if (parsed.pathname === '/api/health') return response({ status: 'ok', database: 'connected' });
    if (parsed.pathname === '/api/dashboard/stats') {
      if (failStats) return response({ error: 'Stats service unavailable.' }, false, 503);
      return response({ totalPredictions: 1, churnPredictions: 1, noChurnPredictions: 0, riskCounts: { high: 1, medium: 0, low: 0 } });
    }
    if (parsed.pathname === '/api/predictions' && options.method === 'POST') {
      return response({ id: 'prediction-2', customerId: 'customer-1', prediction: 'Churn', churn_probability: 0.72, risk_level: 'High', model_used: 'Gradient Boosting', predicted_at: '2026-10-02T10:00:00.000Z' });
    }
    if (parsed.pathname === '/api/predictions') return response({ predictions: [savedPrediction] });
    if (parsed.pathname === '/api/customers') return response({ customers: [{ ...savedCustomer, _count: { predictions: 1 } }] });
    if (parsed.pathname === '/api/explanations') return response({
      prediction: 'Churn', churn_probability: 0.72, model_used: 'Gradient Boosting',
      top_contributing_features: [{ feature: 'cat__Contract_Month-to-month', contribution: 0.23, direction: 'increase' }],
      shap_values: [], explanation: 'Contract contributed to the output.',
    });
    return response({ error: 'Unknown path' }, false, 404);
  }));
  return calls;
}

function response(body, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => body });
}

describe('ChurnWise workflows', () => {
  it('navigates to customer and history data and derives the latest result', async () => {
    mockApi();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Churn overview' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Customers' })[0]);
    expect(await screen.findByText('C-100')).toBeTruthy();
    expect(screen.getByText('Churn')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'History' })[0]);
    expect(await screen.findByRole('heading', { name: 'All predictions' })).toBeTruthy();
    expect(screen.getByText('Gradient Boosting')).toBeTruthy();
  });

  it('submits all feature fields and uses the same payload for the explanation', async () => {
    const calls = mockApi();
    render(<App />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'New prediction' }))[0]);
    fireEvent.change(document.querySelector('input[name="tenure"]'), { target: { value: '12' } });
    fireEvent.change(document.querySelector('input[name="MonthlyCharges"]'), { target: { value: '72.5' } });
    fireEvent.change(document.querySelector('input[name="TotalCharges"]'), { target: { value: '870' } });
    fireEvent.change(document.querySelector('input[name="customerID"]'), { target: { value: 'C-100' } });
    fireEvent.click(screen.getByRole('button', { name: /Run prediction/ }));

    expect(await screen.findByRole('heading', { name: 'Churn' })).toBeTruthy();
    const predictionCall = calls.find((call) => call.path === '/api/predictions' && call.options.method === 'POST');
    const submittedPayload = JSON.parse(predictionCall.options.body);
    expect(Object.keys(submittedPayload)).toHaveLength(20);
    expect(submittedPayload).toMatchObject({ customerID: 'C-100', tenure: 12, MonthlyCharges: 72.5, TotalCharges: 870 });

    fireEvent.click(screen.getByRole('button', { name: 'Why this prediction?' }));
    expect(await screen.findByRole('heading', { name: 'Top contributing features' })).toBeTruthy();
    const explanationCall = calls.find((call) => call.path === '/api/explanations');
    expect(JSON.parse(explanationCall.options.body)).toEqual(submittedPayload);
    expect(screen.getByText('Toward churn')).toBeTruthy();
    expect(screen.getByText(/not cause/i)).toBeTruthy();
  });

  it('shows API failures with a retry action', async () => {
    mockApi({ failStats: true });
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain('Stats service unavailable.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
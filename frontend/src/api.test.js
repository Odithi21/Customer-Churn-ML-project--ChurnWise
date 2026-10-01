import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.js';

afterEach(() => vi.unstubAllGlobals());

describe('central API client', () => {
  it('loads health and dashboard data from Express routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.health();
    await api.stats();

    expect(new URL(fetchMock.mock.calls[0][0], 'http://localhost').pathname).toBe('/api/health');
    expect(new URL(fetchMock.mock.calls[1][0], 'http://localhost').pathname).toBe('/api/dashboard/stats');
  });

  it('posts the same feature payload shape for predictions and explanations', async () => {
    const payload = { gender: 'Female', tenure: 18, MonthlyCharges: 72.5 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prediction: 'Churn' }) });
    vi.stubGlobal('fetch', fetchMock);

    await api.predict(payload);
    await api.explain(payload);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(payload);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(payload);
    expect(fetchMock.mock.calls.map(([url]) => new URL(url, 'http://localhost').pathname)).toEqual([
      '/api/predictions',
      '/api/explanations',
    ]);
  });

  it('surfaces Express error messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Could not reach the FastAPI ML service.' }),
    }));

    await expect(api.stats()).rejects.toThrow('Could not reach the FastAPI ML service.');
  });
});
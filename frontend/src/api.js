const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Cannot reach the ChurnWise API${API_BASE_URL ? ` at ${API_BASE_URL}` : ''}. Check that the Express service is running.`);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.detail || `Request failed (${response.status}).`);
  }
  return body;
}

export const api = {
  health: () => request('/api/health'),
  stats: () => request('/api/dashboard/stats'),
  predictions: (limit = 500) => request(`/api/predictions?limit=${encodeURIComponent(limit)}`),
  customers: () => request('/api/customers'),
  predict: (payload) => request('/api/predictions', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  explain: (payload) => request('/api/explanations', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

export { API_BASE_URL };
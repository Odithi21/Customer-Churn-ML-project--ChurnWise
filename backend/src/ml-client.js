class MlServiceError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'MlServiceError';
  }
}

function createMlClient({
  baseUrl = process.env.ML_SERVICE_URL,
  timeoutMs = Number(process.env.ML_REQUEST_TIMEOUT_MS || 120000),
  fetchImpl = globalThis.fetch,
} = {}) {
  async function post(endpoint, payload, modelName) {
    if (!baseUrl) {
      throw new MlServiceError('ML_SERVICE_URL is not configured.');
    }

    const url = new URL(endpoint, `${baseUrl.replace(/\/+$/, '')}/`);
    if (modelName) {
      url.searchParams.set('model_name', modelName);
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new MlServiceError('Could not reach the FastAPI ML service.', { cause: error });
    }

    if (!response.ok) {
      throw new MlServiceError(`FastAPI ML service returned HTTP ${response.status}.`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new MlServiceError('FastAPI ML service returned an invalid JSON response.', { cause: error });
    }
  }

  return {
    predict: (payload, modelName) => post('/predict', payload, modelName),
    explain: (payload, modelName) => post('/explain', payload, modelName),
  };
}

module.exports = { createMlClient, MlServiceError };
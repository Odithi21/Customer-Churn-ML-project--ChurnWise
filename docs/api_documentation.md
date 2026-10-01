# API Documentation

## Service URLs
- FastAPI ML service: `http://127.0.0.1:8000` by default.
- Express application API: `http://127.0.0.1:3001` by default.
- React calls Express only. In development Vite proxies the browser's same-origin `/api` requests to Express.

## Customer Request Shape
The following feature names and category values match FastAPI validation. `customerID` is optional; the other 19 fields are required.

```json
{
  "customerID": "CUST-EXAMPLE-001",
  "gender": "Male",
  "SeniorCitizen": 0,
  "Partner": "No",
  "Dependents": "No",
  "tenure": 2,
  "PhoneService": "Yes",
  "MultipleLines": "No",
  "InternetService": "Fiber optic",
  "OnlineSecurity": "No",
  "OnlineBackup": "No",
  "DeviceProtection": "No",
  "TechSupport": "No",
  "StreamingTV": "Yes",
  "StreamingMovies": "Yes",
  "Contract": "Month-to-month",
  "PaperlessBilling": "Yes",
  "PaymentMethod": "Electronic check",
  "MonthlyCharges": 95.5,
  "TotalCharges": 150.0
}
```

`SeniorCitizen` is an integer 0 or 1; `tenure` is an integer 0-72; charge values are non-negative numbers. Categorical values must use the dataset labels. Optional `model_name` is a query parameter on prediction/explanation routes.

## FastAPI Endpoints

### `GET /health`
Returns service status, default model, and available trained model names.

```json
{
  "status": "ok",
  "service": "ChurnWise ML Prediction API",
  "default_model": "Gradient Boosting",
  "trained_models": ["Gradient Boosting", "Logistic Regression"]
}
```
The model list above is abbreviated for illustration; the service returns all available artifacts.

### `GET /models`
Returns `{ "available_models": ["..."], "default_model": "Gradient Boosting" }`.

### `POST /predict`
Body: customer request shape above. Response:

```json
{
  "prediction": "Churn",
  "churn_probability": 0.7585990167148162,
  "risk_level": "High",
  "model_used": "Gradient Boosting"
}
```
This probability is the exact persisted result from the verified `PHASE8-HIGH-001` browser request above. Other inputs produce different values. Current default risk bands: `<0.33` Low, `0.33-<0.66` Medium, and `>=0.66` High.

### `POST /explain`
Body: same customer request shape. Returns prediction fields plus `top_contributing_features`, `shap_values`, and a readable `explanation`.

```json
{
  "prediction": "Churn",
  "churn_probability": 0.759,
  "model_used": "Gradient Boosting",
  "top_contributing_features": [
    {"feature": "<transformed-feature-name>", "contribution": "<signed-number>", "direction": "increase|decrease"}
  ],
  "shap_values": [
    {"feature": "<transformed-feature-name>", "contribution": "<signed-number>", "direction": "increase|decrease"}
  ],
  "explanation": "Customer churn likelihood is driven primarily by ..."
}
```
The feature/contribution/direction strings above are placeholders describing the response structure; local values depend on input. The generated global/local analysis artifacts are verified for Gradient Boosting and Logistic Regression.

## Express Endpoints

### `GET /api/health`
Checks the Express process and SQLite query connection. Response: `{ "status": "ok", "service": "churnwise-backend", "database": "connected" }`.

### `POST /api/predictions`
Body: customer request shape above. Express validates it, forwards it to FastAPI `/predict`, then transactionally upserts/creates a customer and appends a prediction. Response:

```json
{
  "id": "<prediction-id>",
  "customerId": "<customer-id>",
  "prediction": "Churn",
  "churn_probability": 0.759,
  "risk_level": "High",
  "model_used": "Gradient Boosting",
  "predicted_at": "<ISO-8601 timestamp>"
}
```
The IDs, timestamp, and probability depend on the request and current database. If `customerID` is supplied, later requests update that customer's features and add a new prediction. Without it, the API creates a new customer for each request.

### `POST /api/explanations`
Body: same customer request shape. Express forwards to FastAPI `/explain` and returns that explanation object unchanged after response validation.

### `GET /api/predictions`
Optional `limit` query integer 1-500 (default 100). Returns `{ "predictions": [...] }` newest first, with stored fields `id`, `customerId`, `prediction`, `churnProbability`, `riskLevel`, `modelUsed`, `predictedAt`, and related `customer` data.

### `GET /api/customers`
Returns `{ "customers": [...] }`, newest customer first. Each customer includes its stored feature fields and `_count.predictions`; latest prediction details are available in prediction history and combined by the UI.

### `GET /api/dashboard/stats`
Returns `{ "totalPredictions": 0, "churnPredictions": 0, "noChurnPredictions": 0, "riskCounts": {"high": 0, "medium": 0, "low": 0} }` with live aggregate values.

## Errors
Invalid customer input returns 400 with validation details. Invalid JSON returns 400. ML service connection/response failures return 502. Unique conflicts return 409. Unexpected server/database failures return 500. The React API client displays Express error messages and a retry action where available.
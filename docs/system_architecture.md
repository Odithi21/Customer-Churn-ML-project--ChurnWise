# System Architecture

## Components
- **React/Vite:** browser interface and centralized API client. It calls only Express routes. In local development Vite proxies same-origin `/api` requests to Express.
- **Express:** request validation, FastAPI HTTP client, history/customer/statistics routes, and Prisma transactions.
- **FastAPI:** loads existing joblib model artifacts, applies their embedded preprocessing, returns predictions, and runs SHAP for supported estimators.
- **Prisma/SQLite:** persists users (profile model only), customers, and prediction records.

## System Diagram
```mermaid
flowchart LR
  Browser[Analyst browser] --> React[React application]
  React -->|/api through Vite proxy| Express[Express API]
  Express -->|/predict or /explain JSON| FastAPI[FastAPI service]
  FastAPI --> Preprocess[Saved preprocessing pipeline]
  Preprocess --> Model[Saved classifier]
  Model --> Prediction[Prediction and probability]
  Prediction --> Explain[SHAP contributions when requested]
  Explain --> FastAPI
  FastAPI --> Express
  Express -->|transaction| Prisma[Prisma ORM]
  Prisma --> SQLite[(SQLite)]
  Express --> React
```

## Prediction Request Sequence
```mermaid
sequenceDiagram
  actor User
  participant UI as React
  participant Vite as Vite dev proxy
  participant API as Express
  participant ML as FastAPI
  participant DB as SQLite via Prisma
  User->>UI: Submit customer features
  UI->>Vite: POST /api/predictions
  Vite->>API: Forward /api/predictions
  API->>API: Validate fields
  API->>ML: POST /predict
  ML->>ML: Load saved pipeline and predict
  ML-->>API: Outcome, probability, risk, model
  API->>DB: Save/update customer and append prediction transactionally
  DB-->>API: Persisted prediction
  API-->>UI: Prediction response
  User->>UI: Request explanation
  UI->>Vite: POST /api/explanations
  Vite->>API: Forward /api/explanations
  API->>ML: POST /explain
  ML-->>API: SHAP local contributors
  API-->>UI: Explanation response
```

## Boundaries and Configuration
React does not connect directly to FastAPI or SQLite. Configure `VITE_API_PROXY_TARGET` in `frontend/.env`, `ML_SERVICE_URL` and `DATABASE_URL` in `backend/.env`, and FastAPI host/model/risk settings in the root `.env`. FastAPI loads saved estimators and does not retrain at startup.

## Failure Behavior
Express validates customer data before calling FastAPI. Invalid input returns HTTP 400; unavailable or invalid upstream ML responses return HTTP 502. Database and unexpected errors return an API error response. The UI presents request errors and retry actions where applicable.
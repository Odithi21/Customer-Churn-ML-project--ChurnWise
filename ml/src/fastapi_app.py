"""FastAPI service for churn prediction and SHAP-based explainability."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional

import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sklearn.model_selection import train_test_split

try:
    from .explainability import explain_model
    from .preprocessing import load_dataset, split_features_target
except ImportError:  # pragma: no cover - fallback for direct script execution
    from explainability import explain_model
    from preprocessing import load_dataset, split_features_target

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
DATASET_PATH = PROJECT_ROOT / "WA_Fn-UseC_-Telco-Customer-Churn.csv"

load_dotenv(PROJECT_ROOT / ".env")

DEFAULT_MODEL_NAME = os.getenv("DEFAULT_MODEL", "Gradient Boosting")
FASTAPI_HOST = os.getenv("FASTAPI_HOST", "127.0.0.1")
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8000"))
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()]
LOW_THRESHOLD = float(os.getenv("RISK_LOW_THRESHOLD", "0.33"))
MEDIUM_THRESHOLD = float(os.getenv("RISK_MEDIUM_THRESHOLD", "0.66"))

FEATURE_COLUMNS = [
    "gender",
    "SeniorCitizen",
    "Partner",
    "Dependents",
    "tenure",
    "PhoneService",
    "MultipleLines",
    "InternetService",
    "OnlineSecurity",
    "OnlineBackup",
    "DeviceProtection",
    "TechSupport",
    "StreamingTV",
    "StreamingMovies",
    "Contract",
    "PaperlessBilling",
    "PaymentMethod",
    "MonthlyCharges",
    "TotalCharges",
]


def _as_model_name(value: str) -> str:
    value = value.strip()
    available = get_available_models()
    if value in available:
        return value
    normalized = value.lower().replace("_", " ")
    for model in available:
        if model.lower() == normalized:
            return model
    raise HTTPException(status_code=404, detail=f"Model '{value}' is not available.")


def get_available_models() -> list[str]:
    files = sorted(MODELS_DIR.glob("*.joblib"))
    names: list[str] = []
    for file in files:
        name = file.stem.replace("_", " ").title()
        if name == "Xgboost":
            name = "XGBoost"
        names.append(name)
    return names


def get_default_model() -> str:
    available = get_available_models()
    if DEFAULT_MODEL_NAME in available:
        return DEFAULT_MODEL_NAME
    if not available:
        raise HTTPException(status_code=500, detail="No trained models found on disk.")
    return available[0]


class CustomerInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customerID: Optional[str] = Field(default=None, alias="customerID")
    gender: Literal["Female", "Male"]
    SeniorCitizen: int = Field(..., ge=0, le=1)
    Partner: Literal["Yes", "No"]
    Dependents: Literal["Yes", "No"]
    tenure: int = Field(..., ge=0, le=72)
    PhoneService: Literal["Yes", "No"]
    MultipleLines: Literal["No phone service", "No", "Yes"]
    InternetService: Literal["DSL", "Fiber optic", "No"]
    OnlineSecurity: Literal["No internet service", "No", "Yes"]
    OnlineBackup: Literal["No internet service", "No", "Yes"]
    DeviceProtection: Literal["No internet service", "No", "Yes"]
    TechSupport: Literal["No internet service", "No", "Yes"]
    StreamingTV: Literal["No internet service", "No", "Yes"]
    StreamingMovies: Literal["No internet service", "No", "Yes"]
    Contract: Literal["Month-to-month", "One year", "Two year"]
    PaperlessBilling: Literal["Yes", "No"]
    PaymentMethod: Literal["Electronic check", "Mailed check", "Bank transfer", "Credit card (automatic)"]
    MonthlyCharges: float = Field(..., ge=0)
    TotalCharges: float = Field(..., ge=0)

    @field_validator("gender", "Partner", "Dependents", "PhoneService", "PaperlessBilling", mode="before")
    @classmethod
    def normalize_yes_no(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"female", "male"}:
                return normalized.title()
            if normalized in {"yes", "no"}:
                return normalized.title()
        return value

    @field_validator("customerID", mode="before")
    @classmethod
    def normalize_customer_id(cls, value):
        if value is None:
            return None
        return str(value).strip() or None


class PredictionResponse(BaseModel):
    prediction: Literal["Churn", "No Churn"]
    churn_probability: float
    risk_level: Literal["Low", "Medium", "High"]
    model_used: str


class ExplainResponse(BaseModel):
    prediction: Literal["Churn", "No Churn"]
    churn_probability: float
    model_used: str
    top_contributing_features: list[dict]
    shap_values: list[dict]
    explanation: str


app = FastAPI(title="ChurnWise ML Prediction API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_model_by_name(model_name: str):
    normalized = _as_model_name(model_name)
    model_path = MODELS_DIR / f"{normalized.lower().replace(' ', '_')}.joblib"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model artifact not found for '{normalized}'.")
    return joblib.load(model_path), normalized


def determine_risk(probability: float) -> str:
    if probability < LOW_THRESHOLD:
        return "Low"
    if probability < MEDIUM_THRESHOLD:
        return "Medium"
    return "High"


def build_feature_dataframe(payload: CustomerInput) -> pd.DataFrame:
    item = payload.model_dump(by_alias=True, exclude_none=True)
    if "customerID" in item:
        item.pop("customerID")
    ordered = {column: item.get(column) for column in FEATURE_COLUMNS if column in item}
    return pd.DataFrame([ordered], columns=FEATURE_COLUMNS)


def get_background_data() -> pd.DataFrame:
    df = load_dataset(DATASET_PATH)
    X, y = split_features_target(df)
    X_train, _, _, _ = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    return X_train


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "ChurnWise ML Prediction API",
        "default_model": get_default_model(),
        "trained_models": get_available_models(),
    }


@app.get("/models")
def list_models() -> dict:
    models = get_available_models()
    default_model = get_default_model() if models else None
    return {
        "available_models": models,
        "default_model": default_model,
    }


@app.post("/predict", response_model=PredictionResponse)
def predict_customer(payload: CustomerInput, model_name: Optional[str] = None) -> PredictionResponse:
    try:
        selected_model = model_name or get_default_model()
        model, loaded_name = load_model_by_name(selected_model)
        feature_frame = build_feature_dataframe(payload)
        proba = float(model.predict_proba(feature_frame)[0, 1])
        prediction = "Churn" if proba >= 0.5 else "No Churn"
        risk_level = determine_risk(proba)
        return PredictionResponse(
            prediction=prediction,
            churn_probability=proba,
            risk_level=risk_level,
            model_used=loaded_name,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {exc}") from exc


@app.post("/explain", response_model=ExplainResponse)
def explain_customer(payload: CustomerInput, model_name: Optional[str] = None) -> ExplainResponse:
    try:
        selected_model = model_name or get_default_model()
        model, loaded_name = load_model_by_name(selected_model)
        feature_frame = build_feature_dataframe(payload)
        background_df = get_background_data()
        result = explain_model(loaded_name, feature_frame, background_df)
        top_contributors = result["top_contributors"].head(10).copy()
        shap_values = []
        for _, row in top_contributors.iterrows():
            shap_values.append({
                "feature": row["feature"],
                "contribution": float(row["contribution"]),
                "direction": "increase" if float(row["contribution"]) >= 0 else "decrease",
            })

        probability = float(result["sample_prediction"])
        prediction = "Churn" if probability >= 0.5 else "No Churn"
        explanation_text = "Customer churn likelihood is driven primarily by: " + ", ".join(
            f"{item['feature']} ({'increase' if item['contribution'] >= 0 else 'decrease'} {abs(item['contribution']):.3f})" for item in shap_values
        )
        return ExplainResponse(
            prediction=prediction,
            churn_probability=probability,
            model_used=loaded_name,
            top_contributing_features=shap_values,
            shap_values=shap_values,
            explanation=explanation_text,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Explanation failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("ml.src.fastapi_app:app", host=FASTAPI_HOST, port=FASTAPI_PORT, reload=False)

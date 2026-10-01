import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from ml.src.fastapi_app import app

client = TestClient(app)

customer_payload = {
    "customerID": "API-TEST-001",
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
    "MonthlyCharges": 75.9,
    "TotalCharges": 150.0,
}


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "default_model" in data


def test_models_endpoint():
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert "available_models" in data
    assert "default_model" in data


def test_predict_endpoint():
    response = client.post("/predict", json=customer_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] in {"Churn", "No Churn"}
    assert 0.0 <= data["churn_probability"] <= 1.0
    assert data["risk_level"] in {"Low", "Medium", "High"}
    assert data["model_used"]


def test_explain_endpoint():
    response = client.post("/explain", json=customer_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prediction"] in {"Churn", "No Churn"}
    assert 0.0 <= data["churn_probability"] <= 1.0
    assert isinstance(data["top_contributing_features"], list)
    assert len(data["top_contributing_features"]) > 0
    assert data["explanation"]


if __name__ == "__main__":
    test_health_endpoint()
    test_models_endpoint()
    test_predict_endpoint()
    test_explain_endpoint()
    print("All API tests passed.")

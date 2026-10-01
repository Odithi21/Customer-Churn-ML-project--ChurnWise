"""Explain churn predictions using SHAP while reusing the trained preprocessing pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap

try:
    from .preprocessing import load_dataset, split_features_target
except ImportError:  # pragma: no cover - fallback for direct script execution
    from preprocessing import load_dataset, split_features_target

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = PROJECT_ROOT / "WA_Fn-UseC_-Telco-Customer-Churn.csv"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
RESULTS_DIR = PROJECT_ROOT / "ml" / "results" / "shap"


def load_model(model_name: str):
    filename_map = {
        "Gradient Boosting": "gradient_boosting.joblib",
        "Logistic Regression": "logistic_regression.joblib",
        "XGBoost": "xgboost.joblib",
    }
    model_file = MODELS_DIR / filename_map[model_name]
    if not model_file.exists():
        raise FileNotFoundError(f"Model artifact not found: {model_file}")
    return joblib.load(model_file)


def get_explainer(model, X_train_processed: np.ndarray, feature_names: np.ndarray):
    classifier = model.named_steps["classifier"]

    if hasattr(classifier, "predict_proba") and hasattr(classifier, "feature_importances_"):
        masker = shap.maskers.Independent(X_train_processed, max_samples=X_train_processed.shape[0])
        return shap.Explainer(classifier, masker=masker, algorithm="tree", feature_names=feature_names)

    if hasattr(classifier, "coef_"):
        masker = shap.maskers.Independent(X_train_processed, max_samples=X_train_processed.shape[0])
        return shap.Explainer(classifier, masker=masker, algorithm="linear", feature_names=feature_names)

    raise TypeError(f"SHAP explanation is not supported for model type: {type(classifier).__name__}")


def prepare_feature_matrix(model, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    preprocessor = model.named_steps["preprocessor"]
    X_processed = preprocessor.transform(X)
    feature_names = preprocessor.get_feature_names_out()
    return X_processed, np.asarray(feature_names)


def save_figure(fig_name: str) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / fig_name, dpi=300, bbox_inches="tight")
    plt.close()


def plot_global_feature_importance(explanation: shap.Explanation, feature_names: np.ndarray, model_name: str) -> None:
    shap.plots.bar(explanation, max_display=15, show=False)
    plt.title(f"{model_name} - Global SHAP Feature Importance")
    save_figure(f"{model_name.lower().replace(' ', '_')}_global_feature_importance.png")


def plot_global_summary(explanation: shap.Explanation, feature_names: np.ndarray, model_name: str) -> None:
    shap.plots.beeswarm(explanation, max_display=15, show=False)
    plt.title(f"{model_name} - SHAP Summary")
    save_figure(f"{model_name.lower().replace(' ', '_')}_summary.png")


def plot_local_explanation(explanation: shap.Explanation, sample_idx: int, model_name: str) -> None:
    sample_explanation = explanation[sample_idx]
    shap.plots.waterfall(sample_explanation, show=False)
    plt.title(f"{model_name} - Local SHAP Explanation (Sample {sample_idx})")
    save_figure(f"{model_name.lower().replace(' ', '_')}_local_waterfall.png")


def summarize_top_contributors(sample_explanation: shap.Explanation) -> pd.DataFrame:
    values = np.asarray(sample_explanation.values)
    if values.ndim > 1:
        values = values.reshape(-1, values.shape[-1])

    feature_names = np.asarray(sample_explanation.feature_names)
    df = pd.DataFrame({
        "feature": feature_names,
        "contribution": values,
    })
    return df.sort_values("contribution", key=lambda s: s.abs(), ascending=False).reset_index(drop=True)


def explain_model(model_name: str, raw_df: pd.DataFrame, X_train: pd.DataFrame) -> dict[str, Any]:
    model = load_model(model_name)
    X_train_processed, train_feature_names = prepare_feature_matrix(model, X_train)
    X_processed, feature_names = prepare_feature_matrix(model, raw_df)

    explainer = get_explainer(model, X_train_processed, train_feature_names)
    explanation = explainer(X_processed, check_additivity=False)

    plot_global_feature_importance(explanation, feature_names, model_name)
    plot_global_summary(explanation, feature_names, model_name)

    score = model.predict_proba(raw_df)[:, 1]
    sample_idx = int(np.argmax(score))
    plot_local_explanation(explanation, sample_idx, model_name)

    sample_explanation = explanation[sample_idx]
    top_contributors = summarize_top_contributors(sample_explanation)
    sample_prediction = float(model.predict_proba(raw_df.iloc[[sample_idx]])[:, 1][0])

    return {
        "model_name": model_name,
        "sample_index": sample_idx,
        "sample_prediction": sample_prediction,
        "top_contributors": top_contributors,
        "explanation": explanation,
    }


def main() -> None:
    df = load_dataset(DATASET_PATH)
    X, y = split_features_target(df)
    X_train, X_test, _, _ = __import__("sklearn.model_selection").model_selection.train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    models_to_explain = ["Gradient Boosting", "Logistic Regression"]
    for model_name in models_to_explain:
        result = explain_model(model_name, X_test, X_train)
        print(f"Explained {model_name} on sample {result['sample_index']} with churn probability {result['sample_prediction']:.3f}")
        print(result["top_contributors"].head(10).to_string(index=False))


if __name__ == "__main__":
    main()

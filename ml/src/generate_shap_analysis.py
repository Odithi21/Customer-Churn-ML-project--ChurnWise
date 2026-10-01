"""Generate SHAP analyses for the strongest trained churn models."""

from __future__ import annotations

try:
    from .explainability import explain_model
    from .preprocessing import split_features_target, load_dataset
except ImportError:  # pragma: no cover - fallback for direct script execution
    from explainability import explain_model
    from preprocessing import split_features_target, load_dataset
from sklearn.model_selection import train_test_split


def main() -> None:
    df = load_dataset("WA_Fn-UseC_-Telco-Customer-Churn.csv")
    X, y = split_features_target(df)
    X_train, X_test, _, _ = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    for model_name in ["Gradient Boosting", "Logistic Regression"]:
        result = explain_model(model_name, X_test, X_train)
        print(f"{model_name} sample index: {result['sample_index']}")
        print(f"{model_name} churn probability: {result['sample_prediction']:.4f}")
        print(result["top_contributors"].head(10).to_string(index=False))


if __name__ == "__main__":
    main()

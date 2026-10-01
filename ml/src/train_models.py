"""Train and compare churn classification models using the reusable preprocessing pipeline."""

from __future__ import annotations

from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import AdaBoostClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB

try:
    from .preprocessing import build_preprocessor, load_dataset, split_features_target
except ImportError:  # pragma: no cover - fallback for direct script execution
    from preprocessing import build_preprocessor, load_dataset, split_features_target

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = PROJECT_ROOT / "WA_Fn-UseC_-Telco-Customer-Churn.csv"
MODELS_DIR = PROJECT_ROOT / "ml" / "models"
RESULTS_DIR = PROJECT_ROOT / "ml" / "results"
DOCS_DIR = PROJECT_ROOT / "docs"


def get_models() -> dict[str, object]:
    """Return the configured classifiers for the churn comparison."""
    models: dict[str, object] = {
        "Logistic Regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=42,
        ),
        "KNN": KNeighborsClassifier(n_neighbors=10),
        "Naive Bayes": GaussianNB(),
        "Decision Tree": DecisionTreeClassifier(
            random_state=42,
            class_weight="balanced",
            max_depth=None,
        ),
        "SVM": CalibratedClassifierCV(
            estimator=SVC(
                kernel="rbf",
                class_weight="balanced",
                random_state=42,
            ),
            method="sigmoid",
            cv=5,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=300,
            random_state=42,
            class_weight="balanced",
        ),
        "AdaBoost": AdaBoostClassifier(
            estimator=DecisionTreeClassifier(max_depth=2, class_weight="balanced"),
            n_estimators=200,
            learning_rate=0.5,
            random_state=42,
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            random_state=42,
        ),
        "MLP": MLPClassifier(
            hidden_layer_sizes=(64, 32),
            max_iter=500,
            random_state=42,
        ),
    }

    try:
        import xgboost as xgb

        models["XGBoost"] = xgb.XGBClassifier(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )
    except Exception:
        models["XGBoost"] = None

    return models


def safe_predict_proba(estimator: Pipeline, X_test: pd.DataFrame) -> pd.Series:
    """Return probability scores for the positive class."""
    if hasattr(estimator, "predict_proba"):
        try:
            return estimator.predict_proba(X_test)[:, 1]
        except Exception:
            pass

    if hasattr(estimator, "decision_function"):
        return estimator.decision_function(X_test)

    return estimator.predict(X_test).astype(float)


def evaluate_model(name: str, pipeline: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float | int | str | list[int]]:
    """Compute standard classification metrics and confusion matrix."""
    y_pred = pipeline.predict(X_test)
    y_prob = safe_predict_proba(pipeline, X_test)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc_auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])

    return {
        "model": name,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "roc_auc": roc_auc,
        "tn": int(cm[0, 0]),
        "fp": int(cm[0, 1]),
        "fn": int(cm[1, 0]),
        "tp": int(cm[1, 1]),
        "cm": cm.tolist(),
    }


def save_model(model: Pipeline, model_name: str) -> str:
    """Save a trained pipeline to the models directory."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = MODELS_DIR / f"{model_name.lower().replace(' ', '_')}.joblib"
    joblib.dump(model, file_path)
    return str(file_path)


def plot_metric_comparison(results_df: pd.DataFrame) -> None:
    """Plot a grouped comparison of key metrics across models."""
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    plot_df = results_df.set_index("model")[metrics].copy()

    fig, ax = plt.subplots(figsize=(12, 7))
    plot_df.plot(kind="bar", ax=ax)
    ax.set_title("Model Performance Comparison")
    ax.set_ylabel("Score")
    ax.set_xlabel("Model")
    ax.set_ylim(0, 1.1)
    plt.xticks(rotation=30, ha="right")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "model_metric_comparison.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def plot_roc_curves(results: list[dict[str, float | int | str | list[int]]], X_test: pd.DataFrame, y_test: pd.Series) -> None:
    """Plot ROC curves for the trained models."""
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Baseline")

    for result in results:
        model_name = result["model"]
        model_path = MODELS_DIR / f"{str(model_name).lower().replace(' ', '_')}.joblib"
        if not model_path.exists():
            continue
        model = joblib.load(model_path)
        y_prob = safe_predict_proba(model, X_test)
        from sklearn.metrics import roc_curve

        fpr, tpr, _ = roc_curve(y_test, y_prob)
        ax.plot(fpr, tpr, label=f"{model_name} (AUC={result['roc_auc']:.3f})")

    ax.set_title("ROC Curves by Model")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "roc_curves.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def plot_confusion_matrices(results: list[dict[str, float | int | str | list[int]]], rows: int = 2, cols: int = 5) -> None:
    """Plot confusion matrices for each model in a grid layout."""
    fig, axes = plt.subplots(rows, cols, figsize=(18, 8))
    axes = axes.flatten()

    for idx, result in enumerate(results):
        cm = result["cm"]
        ax = axes[idx]
        sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax, cbar=False)
        ax.set_title(str(result["model"]))
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")

    for idx in range(len(results), len(axes)):
        axes[idx].axis("off")

    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "confusion_matrices.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def save_model_comparison_csv(results_df: pd.DataFrame) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    results_df.to_csv(RESULTS_DIR / "model_comparison.csv", index=False)


def generate_training_report(results_df: pd.DataFrame) -> None:
    """Write a markdown summary of the training and comparison results."""
    ranked = results_df.sort_values(["roc_auc", "f1", "recall"], ascending=False).reset_index(drop=True)
    top_models = ranked.head(3)

    md_lines = [
        "# Model Training and Evaluation Report",
        "",
        "## Algorithms evaluated",
        "- Logistic Regression",
        "- K-Nearest Neighbors (KNN)",
        "- Naive Bayes",
        "- Decision Tree",
        "- Support Vector Machine (SVM)",
        "- Random Forest",
        "- AdaBoost",
        "- Gradient Boosting",
        "- XGBoost",
        "- Artificial Neural Network / MLP",
        "",
        "## Evaluation metrics used",
        "- Accuracy",
        "- Precision",
        "- Recall",
        "- F1-score",
        "- ROC-AUC",
        "- Confusion Matrix",
        "",
        "## Best-performing models",
    ]

    for _, row in top_models.iterrows():
        md_lines.append(f"- {row['model']}: ROC-AUC={row['roc_auc']:.3f}, F1={row['f1']:.3f}, Recall={row['recall']:.3f}")

    md_lines.extend([
        "",
        "## Comparison table",
        "",
        "| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |",
        "|---|---:|---:|---:|---:|---:|",
    ])

    for _, row in results_df.iterrows():
        md_lines.append(
            f"| {row['model']} | {row['accuracy']:.3f} | {row['precision']:.3f} | {row['recall']:.3f} | {row['f1']:.3f} | {row['roc_auc']:.3f} |"
        )

    md_lines.extend([
        "",
        "## Key observations",
        "- The churn target is imbalanced, so model ranking should prioritize F1, recall, and ROC-AUC over raw accuracy.",
        "- The strongest models are reported above based on ROC-AUC and F1 performance on the test set.",
        "- The full model library is retained for future API use and explainability phases.",
    ])

    report_path = DOCS_DIR / "model_training_report.md"
    report_path.write_text("\n".join(md_lines), encoding="utf-8")


def main() -> None:
    df = load_dataset(DATASET_PATH)
    X, y = split_features_target(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    models = get_models()
    results: list[dict[str, float | int | str | list[int]]] = []

    for model_name, estimator in models.items():
        if estimator is None:
            print(f"Skipping {model_name}: library not available in this environment.")
            continue

        preprocessor = build_preprocessor(X_train)
        pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("classifier", estimator),
        ])

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_roc_auc = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="roc_auc")
        cv_f1 = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1")

        pipeline.fit(X_train, y_train)
        metric_row = evaluate_model(model_name, pipeline, X_test, y_test)
        metric_row["cv_roc_auc_mean"] = float(cv_roc_auc.mean())
        metric_row["cv_f1_mean"] = float(cv_f1.mean())

        results.append(metric_row)
        save_model(pipeline, model_name)
        print(f"Trained {model_name}: ACC={metric_row['accuracy']:.3f}, F1={metric_row['f1']:.3f}, ROC-AUC={metric_row['roc_auc']:.3f}")

    results_df = pd.DataFrame(results)
    save_model_comparison_csv(results_df)
    plot_metric_comparison(results_df)
    plot_roc_curves(results, X_test, y_test)
    plot_confusion_matrices(results)
    generate_training_report(results_df)

    ranked = results_df.sort_values(["roc_auc", "f1", "recall"], ascending=False).reset_index(drop=True)
    print("\nTop models by ROC-AUC and F1:")
    print(ranked[["model", "accuracy", "precision", "recall", "f1", "roc_auc"]].head(5).to_string(index=False))
    print(f"\nSaved comparison results to: {RESULTS_DIR / 'model_comparison.csv'}")
    print(f"Saved model artifacts to: {MODELS_DIR}")


if __name__ == "__main__":
    main()

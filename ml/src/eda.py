"""Exploratory data analysis for the telecom churn dataset."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

try:
    from .preprocessing import clean_total_charges, load_dataset
except ImportError:  # pragma: no cover - fallback for direct script execution
    from preprocessing import clean_total_charges, load_dataset

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = PROJECT_ROOT / "WA_Fn-UseC_-Telco-Customer-Churn.csv"
RESULTS_DIR = PROJECT_ROOT / "ml" / "results" / "eda"


def save_figure(fig: plt.Figure, filename: str) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / filename, dpi=300, bbox_inches="tight")
    plt.close(fig)


def print_dataset_summary(df: pd.DataFrame) -> None:
    print(f"Dataset shape: {df.shape}")
    print("\nData types:")
    print(df.dtypes.to_string())
    print("\nMissing values:")
    print(df.isna().sum().to_string())
    print("\nDuplicate rows:")
    print(df.duplicated().sum())
    print("\nTarget distribution:")
    print(df["Churn"].value_counts(dropna=False).to_string())


def create_target_distribution_plot(df: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(7, 5))
    sns.countplot(data=df, x="Churn", color="steelblue", ax=ax)
    ax.set_title("Churn Target Distribution")
    ax.set_xlabel("Churn")
    ax.set_ylabel("Count")
    save_figure(fig, "target_distribution.png")


def create_numerical_distribution_plots(df: pd.DataFrame) -> None:
    numeric_columns = ["tenure", "MonthlyCharges", "TotalCharges"]
    for column in numeric_columns:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        sns.histplot(df[column], kde=True, bins=30, ax=axes[0], color="steelblue")
        axes[0].set_title(f"Distribution of {column}")
        axes[0].set_xlabel(column)

        sns.boxplot(data=df, x="Churn", y=column, color="lightsteelblue", ax=axes[1])
        axes[1].set_title(f"{column} by Churn Status")
        axes[1].set_xlabel("Churn")
        axes[1].set_ylabel(column)
        save_figure(fig, f"{column}_distribution.png")


def create_categorical_feature_plots(df: pd.DataFrame) -> None:
    categorical_columns = [
        "gender",
        "Contract",
        "InternetService",
        "PaymentMethod",
        "PaperlessBilling",
        "Partner",
        "Dependents",
    ]

    for column in categorical_columns:
        if column not in df.columns:
            continue
        fig, ax = plt.subplots(figsize=(9, 5))
        sns.countplot(data=df, x=column, hue="Churn", palette="Set2", ax=ax)
        ax.set_title(f"{column} by Churn Status")
        ax.set_xlabel(column)
        ax.set_ylabel("Count")
        plt.xticks(rotation=20)
        save_figure(fig, f"{column}_vs_churn.png")


def create_correlation_heatmap(df: pd.DataFrame) -> None:
    numeric_df = df.select_dtypes(include=["number"]).copy()
    if "Churn" in numeric_df.columns:
        numeric_df = numeric_df.drop(columns=["Churn"])

    fig, ax = plt.subplots(figsize=(8, 6))
    corr = numeric_df.corr()
    sns.heatmap(corr, annot=True, cmap="coolwarm", fmt=".2f", linewidths=0.5, ax=ax)
    ax.set_title("Feature Correlation Heatmap")
    save_figure(fig, "feature_correlation_heatmap.png")


def run_eda() -> pd.DataFrame:
    df = load_dataset(DATASET_PATH)
    print_dataset_summary(df)

    cleaned_df = clean_total_charges(df)
    invalid_total_charges = pd.to_numeric(df["TotalCharges"], errors="coerce").isna()
    print("\nInvalid/blank TotalCharges rows:")
    print(int(invalid_total_charges.sum()))

    create_target_distribution_plot(cleaned_df)
    create_numerical_distribution_plots(cleaned_df)
    create_categorical_feature_plots(cleaned_df)
    create_correlation_heatmap(cleaned_df)

    print("\nEDA plots saved to:")
    print(RESULTS_DIR)
    return cleaned_df


if __name__ == "__main__":
    run_eda()

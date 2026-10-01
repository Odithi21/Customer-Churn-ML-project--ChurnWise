"""Reusable preprocessing utilities for the telecom churn classification project."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

TARGET_COLUMN = "Churn"
LABEL_MAP = {"No": 0, "Yes": 1}


def load_dataset(csv_path: str | Path) -> pd.DataFrame:
    """Load the telecom churn CSV."""
    return pd.read_csv(csv_path)


def clean_total_charges(df: pd.DataFrame, column_name: str = "TotalCharges") -> pd.DataFrame:
    """Convert TotalCharges to numeric while preserving invalid values as missing."""
    cleaned_df = df.copy()
    cleaned_df[column_name] = cleaned_df[column_name].astype(str).str.strip()
    cleaned_df[column_name] = pd.to_numeric(cleaned_df[column_name], errors="coerce")
    return cleaned_df


def _convert_numeric_features(features: pd.DataFrame) -> pd.DataFrame:
    return features.apply(pd.to_numeric, errors="coerce")


def split_features_target(df: pd.DataFrame, target_column: str = TARGET_COLUMN) -> tuple[pd.DataFrame, pd.Series]:
    """Return raw features and target; feature conversion/imputation happens after splitting."""
    cleaned_df = df.copy()

    if "customerID" in cleaned_df.columns:
        cleaned_df = cleaned_df.drop(columns=["customerID"])

    if target_column not in cleaned_df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    X = cleaned_df.drop(columns=[target_column])
    y = cleaned_df[target_column].map(LABEL_MAP)

    if y.isna().any():
        invalid_labels = sorted(cleaned_df[target_column].dropna().unique().tolist())
        raise ValueError(f"Unexpected target labels: {invalid_labels}")

    return X, y


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    """Create a reusable preprocessing pipeline for categorical and numerical features."""
    numeric_features = X.select_dtypes(include=["number"]).columns.tolist()
    if "TotalCharges" in X.columns and "TotalCharges" not in numeric_features:
        numeric_features.append("TotalCharges")
    categorical_features = [
        column
        for column in X.select_dtypes(exclude=["number"]).columns
        if column not in numeric_features
    ]

    transformers = []

    if numeric_features:
        numeric_pipeline = Pipeline(
            steps=[
                ("to_numeric", FunctionTransformer(_convert_numeric_features, feature_names_out="one-to-one")),
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]
        )
        transformers.append(("num", numeric_pipeline, numeric_features))

    if categorical_features:
        categorical_pipeline = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]
        )
        transformers.append(("cat", categorical_pipeline, categorical_features))

    if not transformers:
        raise ValueError("No features available for preprocessing.")

    return ColumnTransformer(transformers=transformers, remainder="drop")


def create_preprocessing_bundle(
    df: pd.DataFrame,
    target_column: str = TARGET_COLUMN,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Prepare train/test sets and fit the preprocessing pipeline without data leakage."""
    X, y = split_features_target(df, target_column=target_column)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )

    preprocessor = build_preprocessor(X_train)
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)

    return {
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "preprocessor": preprocessor,
        "X_train_processed": X_train_processed,
        "X_test_processed": X_test_processed,
    }


def save_preprocessor(preprocessor: ColumnTransformer, output_path: str | Path) -> None:
    """Persist the fitted preprocessing pipeline for later model experiments."""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(preprocessor, output_file)

"""No-retrain smoke tests for the dataset, preprocessing, and saved estimators."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.src.preprocessing import build_preprocessor, clean_total_charges, load_dataset, split_features_target


class MLPipelineSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dataset = load_dataset(PROJECT_ROOT / "WA_Fn-UseC_-Telco-Customer-Churn.csv")
        cls.features, cls.target = split_features_target(cls.dataset)
        cls.X_train, cls.X_test, cls.y_train, cls.y_test = train_test_split(
            cls.features,
            cls.target,
            test_size=0.2,
            random_state=42,
            stratify=cls.target,
        )

    def test_source_dataset_and_total_charges_cleaning(self) -> None:
        self.assertEqual(self.dataset.shape, (7043, 21))
        self.assertEqual(self.dataset["Churn"].value_counts().to_dict(), {"No": 5174, "Yes": 1869})
        self.assertEqual(pd.to_numeric(self.dataset["TotalCharges"], errors="coerce").isna().sum(), 11)
        cleaned = clean_total_charges(self.dataset)
        self.assertTrue(pd.api.types.is_numeric_dtype(cleaned["TotalCharges"]))
        self.assertEqual(cleaned["TotalCharges"].isna().sum(), 11)
        self.assertEqual(pd.to_numeric(self.features["TotalCharges"], errors="coerce").isna().sum(), 11)
        self.assertNotIn("customerID", self.features.columns)

    def test_preprocessing_split_shape_is_stable(self) -> None:
        preprocessor = build_preprocessor(self.X_train)
        train_matrix = preprocessor.fit_transform(self.X_train)
        test_matrix = preprocessor.transform(self.X_test)
        numeric_features = self.X_train.select_dtypes(include=["number"]).columns.tolist()
        numeric_features.append("TotalCharges")
        total_charges_index = numeric_features.index("TotalCharges")
        fitted_median = preprocessor.named_transformers_["num"].named_steps["imputer"].statistics_[total_charges_index]
        full_data_median = pd.to_numeric(self.dataset["TotalCharges"], errors="coerce").median()
        train_charges = pd.to_numeric(self.X_train["TotalCharges"], errors="coerce")
        test_charges = pd.to_numeric(self.X_test["TotalCharges"], errors="coerce")

        self.assertEqual(train_charges.isna().sum(), 8)
        self.assertEqual(test_charges.isna().sum(), 3)
        self.assertAlmostEqual(fitted_median, train_charges.median())
        self.assertNotAlmostEqual(fitted_median, full_data_median)
        self.assertEqual(train_matrix.shape, (5634, 45))
        self.assertEqual(test_matrix.shape, (1409, 45))
        self.assertTrue(np.isfinite(train_matrix).all())
        self.assertTrue(np.isfinite(test_matrix).all())
        self.assertEqual(len(self.y_train), 5634)
        self.assertEqual(len(self.y_test), 1409)

    def test_all_saved_models_load_and_predict_without_refitting(self) -> None:
        model_paths = sorted((PROJECT_ROOT / "ml" / "models").glob("*.joblib"))
        comparison = pd.read_csv(PROJECT_ROOT / "ml" / "results" / "model_comparison.csv")
        required_metrics = {
            "accuracy", "precision", "recall", "f1", "roc_auc",
            "cv_roc_auc_mean", "cv_f1_mean",
        }

        self.assertEqual(len(model_paths), 10)
        self.assertTrue(required_metrics.issubset(comparison.columns))
        self.assertEqual(len(comparison), 10)
        sample = self.X_train.iloc[[0]]

        for model_path in model_paths:
            with self.subTest(model=model_path.stem):
                model = joblib.load(model_path)
                probability = float(model.predict_proba(sample)[0, 1])
                self.assertGreaterEqual(probability, 0.0)
                self.assertLessEqual(probability, 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)

# Project Overview

## Purpose
ChurnWise estimates whether a telecom customer is likely to leave, stores the prediction, and presents local SHAP contributions to help an operator understand the model output. It is decision support rather than a guarantee or causal diagnosis.

## Objectives
- Profile and preprocess the repository's telecom churn dataset.
- Train and compare ten classification algorithms with a stratified hold-out split and five-fold stratified cross-validation.
- Reuse saved model pipelines for API inference.
- Provide local SHAP explanations and global/local analysis artifacts.
- Persist customer inputs and predictions through Express, Prisma, and SQLite.
- Provide a responsive React console for predictions, explanations, history, customers, and aggregate statistics.

## Dataset Snapshot
The original `WA_Fn-UseC_-Telco-Customer-Churn.csv` contains 7,043 rows and 21 columns. The target counts are 5,174 `No` and 1,869 `Yes`; 11 `TotalCharges` values are blank or invalid. They are coerced and median-imputed inside the fitted pipeline; the median is learned on training rows only and applied to the test split. The project does not substitute a different dataset.

## Verified Model Results
From `ml/results/model_comparison.csv`, Gradient Boosting has the highest held-out ROC-AUC (0.843) and AdaBoost the highest held-out F1 (0.627). The complete table and five-fold means are in the main README and `model_training_report.md`. All ten saved pipelines passed an inference smoke check without retraining.

## Main Capabilities
- EDA plots and preprocessing utilities.
- FastAPI `/predict` and `/explain` routes.
- Express validation, upstream integration, and transactional storage.
- Prisma `User`, `Customer`, and `Prediction` models in SQLite.
- React dashboard, customer prediction form, SHAP explanation view, history, customer list, and project overview.

## Stack and Structure
- `ml/`: preprocessing, training/evaluation, explainability, saved estimators, and plots.
- `backend/`: Express API, Prisma schema/migration, and route tests.
- `frontend/`: Vite + React UI, centralized Express API client, tests, and build.
- `docs/`: EDA, training, explainability, architecture, API, database, and testing documentation.

## Limitations
The held-out evaluation uses one split of this dataset and target imbalance remains. The `TotalCharges` imputer is fitted on training rows only; a regression test compares its value to the full-data median. SHAP values describe model output and are not causal effects. Authentication and production deployment are outside the current scope.
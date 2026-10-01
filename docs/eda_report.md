# EDA and Preprocessing Report

## Dataset overview
The project uses the existing telecom churn dataset located at the project root: `WA_Fn-UseC_-Telco-Customer-Churn.csv`.

- Rows: 7,043
- Columns: 21
- Target column: `Churn`
- Duplicate rows: 0
- Missing values in raw CSV: none in standard null form

## Key data-quality issue
The `TotalCharges` column contains 11 blank or invalid entries that were not interpreted as valid numeric values. These values were converted to `NaN` and then imputed before modeling.

## Target distribution
The `Churn` target is imbalanced.

- `No`: 5,174
- `Yes`: 1,869

This imbalance means the project should evaluate models using F1, recall, precision, and ROC-AUC rather than relying on overall accuracy alone.

## Feature observations
- `customerID` is a unique identifier and should not be used as a model feature.
- Categorical variables include gender, contract type, internet service, payment method, and contract-related features.
- Numerical variables include `SeniorCitizen`, `tenure`, `MonthlyCharges`, and `TotalCharges` after cleaning.

## Preprocessing decisions
The preprocessing pipeline includes:
1. Removing `customerID` from model features.
2. Converting `TotalCharges` to numeric while retaining invalid or blank entries as missing.
3. Splitting the data into train and test sets with stratification.
4. Converting numeric feature columns inside the scikit-learn preprocessing pipeline.
5. Fitting the numeric median imputer on `X_train` only, then applying that fitted imputer to `X_test`.
6. Applying one-hot encoding to categorical variables.
7. Scaling numerical features using `StandardScaler`, fitted within each training pipeline.

With the existing `random_state=42` split, 8 invalid `TotalCharges` values are in training and 3 are in test. The training-only imputer median is `1398.125`; the former full-data median was `1397.475`. The 45-feature representation and stratified split sizes are unchanged.

## EDA artifacts
The generated charts are saved into `ml/results/eda/`.

Subsequent project phases trained and evaluated ten classification pipelines using this leakage-safe preprocessing. Results are documented in `model_training_report.md` and `ml/results/model_comparison.csv`.

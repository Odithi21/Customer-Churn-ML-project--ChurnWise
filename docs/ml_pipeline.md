# ML Pipeline

## Dataset and Target
The pipeline uses `WA_Fn-UseC_-Telco-Customer-Churn.csv`: 7,043 rows, 21 columns, target `Churn`. The observed target counts are 5,174 `No` and 1,869 `Yes`. Eleven `TotalCharges` cells are blank/non-numeric; no duplicate rows were found.

## Preprocessing
Implemented in `ml/src/preprocessing.py`:
1. Remove identifier `customerID` from features.
2. Split with `test_size=0.2`, `random_state=42`, and target stratification while leaving blank `TotalCharges` entries intact.
3. Inside the numeric `ColumnTransformer` branch, coerce columns to numeric values, converting invalid/blank `TotalCharges` to missing values.
4. Fit `SimpleImputer(strategy="median")` as a step inside each model pipeline on `X_train` only; fit scaling on the imputed training data.
5. Transform `X_test` using the same fitted coercion/imputer/scaler steps. The categorical branch uses most-frequent imputation and one-hot encoding.
6. Retain the fitted preprocessor with its classifier in each joblib artifact.

The reproducible split is 5,634 train and 1,409 test rows. Eight of the 11 invalid charge values fall in train and three in test. The fitted training median is `1398.125`; `X_test` receives that training-only value. The transformed matrix remains 45 features.

## Training and Validation
`ml/src/train_models.py` evaluates ten algorithms. It performs shuffled five-fold `StratifiedKFold` cross-validation on the training partition for ROC-AUC and F1, then fits each configured pipeline and computes held-out accuracy, precision, recall, F1, ROC-AUC, and confusion matrix. Metric comparison, ROC curves, and confusion matrices are written to `ml/results/`; the fitted pipelines are in `ml/models/`.

After moving charge imputation into the training-fitted pipeline, all ten classifiers were retrained with the existing split and evaluation methodology. The smoke checks load each refreshed artifact and run `predict_proba` on a real dataset row without fitting it again.

To regenerate artifacts from the repository root, use package mode so the serialized converter has the stable `ml.src.preprocessing` import path used by FastAPI:

```powershell
.\.venv\Scripts\python.exe -m ml.src.train_models
.\.venv\Scripts\python.exe -m ml.src.generate_shap_analysis
```

## Test-Set Comparison
Rounded values from `ml/results/model_comparison.csv`:

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Logistic Regression | 0.738 | 0.504 | 0.783 | 0.614 | 0.841 |
| KNN | 0.779 | 0.600 | 0.505 | 0.549 | 0.814 |
| Naive Bayes | 0.695 | 0.459 | 0.837 | 0.593 | 0.807 |
| Decision Tree | 0.732 | 0.495 | 0.487 | 0.491 | 0.654 |
| SVM | 0.789 | 0.601 | 0.615 | 0.608 | 0.826 |
| Random Forest | 0.766 | 0.552 | 0.623 | 0.585 | 0.822 |
| AdaBoost | 0.759 | 0.532 | 0.765 | 0.627 | 0.819 |
| Gradient Boosting | 0.806 | 0.674 | 0.524 | 0.589 | 0.843 |
| MLP | 0.751 | 0.529 | 0.564 | 0.546 | 0.775 |
| XGBoost | 0.796 | 0.644 | 0.513 | 0.571 | 0.839 |

Gradient Boosting led held-out ROC-AUC; AdaBoost led held-out F1. No one model leads every metric. Five-fold ROC-AUC and F1 means are preserved in the CSV and reproduced in the main README.

## Explainability
`ml/src/explainability.py` transforms raw features with the saved model's preprocessor and builds SHAP explainers for tree models exposing feature importances and linear models exposing coefficients. Generated artifacts include global feature-importance bars, global beeswarm summaries, and local waterfall plots for Gradient Boosting and Logistic Regression. FastAPI returns up to ten locally ranked contributors for `/explain`.

SHAP values indicate contribution to the model output for the explained sample, not causal effects or guaranteed probability changes. The live UI verification produced ten contributors through the API.

## Leakage Regression Check
`tests/test_ml_pipeline.py` asserts that the split contains 8 invalid charge values in train and 3 in test, that the fitted numeric imputer median equals the training-only median and differs from the full-data median, and that both transformed matrices are finite and remain `(5634, 45)` and `(1409, 45)`.
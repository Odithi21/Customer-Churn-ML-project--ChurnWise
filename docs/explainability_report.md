# Explainable AI (SHAP) Report

## What Explainable AI means for this project
Explainable AI helps make the churn prediction model understandable to both technical and non-technical stakeholders. Instead of only seeing a probability score, the model can show which features drove the result.

## Why SHAP is used
SHAP is used because it provides both global and local explanations:
- Global explanations show which features generally influence churn risk across the dataset.
- Local explanations show which features pushed one specific customer toward churn or away from it.

## Models explained with SHAP
Generated SHAP analyses are available for these models:
- Gradient Boosting
- Logistic Regression

The Gradient Boosting model is also the configured default for the prediction API. The implementation uses a tree explainer for supported tree estimators and a linear explainer for coefficient-based estimators.

## Global explanation
The generated global bar and beeswarm plots summarize feature contributions over the explained evaluation data. Interpret the checked-in plots for the corresponding model; feature rank and direction can vary by model and dataset sample.

## Local explanation
For an individual customer, SHAP assigns a contribution value to each feature. Positive values indicate a push toward churn, while negative values indicate a push away from churn. This makes the output actionable and understandable.

## How to interpret SHAP values
- Positive SHAP value: pushes the explained model output toward churn.
- Negative SHAP value: pushes the explained model output away from churn.
- Larger absolute values indicate stronger influence.
- SHAP values explain changes relative to the explainer's expected output; they are not causal effects.

## Verified local API analysis
The final browser/API integration returned ten ranked local contributions for a Gradient Boosting request. The interface labels the direction toward churn or no churn and cautions that contributions are not evidence of causation. Local contributions depend on the submitted customer.

## Artifacts generated
All six generated plots are saved in `ml/results/shap/`: global feature-importance bar, global summary, and local waterfall plots for each of Gradient Boosting and Logistic Regression.

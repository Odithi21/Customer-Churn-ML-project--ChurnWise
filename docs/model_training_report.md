# Model Training and Evaluation Report

## Algorithms evaluated
- Logistic Regression
- K-Nearest Neighbors (KNN)
- Naive Bayes
- Decision Tree
- Support Vector Machine (SVM)
- Random Forest
- AdaBoost
- Gradient Boosting
- XGBoost
- Artificial Neural Network / MLP

## Evaluation metrics used
- Accuracy
- Precision
- Recall
- F1-score
- ROC-AUC
- Confusion Matrix

## Best-performing models
- Gradient Boosting: ROC-AUC=0.843, F1=0.589, Recall=0.524
- Logistic Regression: ROC-AUC=0.841, F1=0.614, Recall=0.783
- XGBoost: ROC-AUC=0.839, F1=0.571, Recall=0.513

## Comparison table

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

## Key observations
- The churn target is imbalanced, so model ranking should prioritize F1, recall, and ROC-AUC over raw accuracy.
- The strongest models are reported above based on ROC-AUC and F1 performance on the test set.
- The full model library is retained for future API use and explainability phases.
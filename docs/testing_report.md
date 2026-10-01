# Final Integration Testing Report

**Verification date:** 2026-10-02. All ten classifiers were retrained after moving `TotalCharges` imputation into the training-fitted preprocessing pipeline. SHAP artifacts were regenerated for the refreshed model pipelines.

## Automated Checks
| Area | Command | Result |
|---|---|---|
| Python ML/leakage regression tests | `.venv\\Scripts\\python.exe tests\\test_ml_pipeline.py` | 3 passed |
| FastAPI tests | `.venv\\Scripts\\python.exe tests\\test_api.py` | All API tests passed |
| Express backend | `npm test` from `backend/` | 7 passed |
| React frontend | `npm test` from `frontend/` | 6 passed |
| Frontend production build | `npm run build` from `frontend/` | Passed; chart chunk lazy-loaded |
| Saved-model inference check | Included in ML smoke suite | All ten joblib models loaded and returned probabilities |

The Python suite confirmed dataset shape `(7043, 21)`, 11 invalid `TotalCharges`, split sizes 5,634/1,409, and transformed feature shape `(5634, 45)`. It asserts 8 invalid charge values in training and 3 in test, confirms the imputer's fitted statistic is the `X_train` median (`1398.125`) rather than the full-data median (`1397.475`), and confirms both transformed matrices contain finite values. It also loads and runs all ten retrained joblib artifacts and validates comparison/CV metric columns.

## FastAPI Test Coverage
The existing TestClient script checks `/health`, `/models`, `/predict`, and `/explain`. It passed. The current Starlette test client emitted a deprecation warning that `httpx` should be replaced with `httpx2`; this did not fail tests.

## Live Browser Integration
Browser testing used the React app at `http://127.0.0.1:5174/`, the Vite `/api` proxy, Express at `http://127.0.0.1:3001`, FastAPI at `http://127.0.0.1:8000`, and the existing SQLite database. FastAPI was restarted after retraining to load the new preprocessor module and artifacts.

- No-churn case: `PHASE8-FIX-NOCHURN` returned `No Churn`, 0.6% displayed churn probability, Low risk.
- Churn/high-risk case: `PHASE8-FIX-HIGH` returned `Churn`, 75.9% displayed churn probability, High risk.
- The high-risk case returned ten SHAP contributors from the refreshed model.
- Both customers appeared in history and customer records.
- Dashboard refreshed to 6 total predictions/customers, 4 churn, 2 no-churn, with High 3, Medium 1, Low 2. These totals include prior Phase 6/7/8 verification records.
- Invalid required numeric form fields did not send a request.
- Desktop and 390 px mobile views were checked. Mobile showed all six destinations, no document horizontal overflow, and the prediction form remained within viewport width.
- Browser resource entries showed React requests to same-origin `/api` routes; Vite forwarded them to Express. No browser request targeted FastAPI directly.

## Project Cleanup Findings
- Credential-pattern search found no likely secrets in checked documentation, config templates, application source, or ML source.
- The only `.env*` files found were the root/backend/frontend `.env.example` templates. No real `.env` file was found.
- `.venv`, `node_modules`, generated `frontend/dist`, Python caches, temp/log files, SQLite databases, and sidecars are covered by `.gitignore`; templates remain explicitly unignored.
- The generated `backend/prisma/dev.db` and verification records were kept. Empty `ml/results/training` and `ml/results/plots` directories were preserved rather than removed without clear ownership.
- Generated ROC, confusion-matrix, model-comparison, and SHAP outputs were regenerated after the ten model pipelines were retrained.

## Warnings and Limitations
- `npm audit --omit=dev` reports three high-severity advisories through a Prisma/config and `deepmerge-ts` transitive dependency path, including in the production-only audit. The suggested forced fix changes the Prisma version; no unverified override or forced downgrade was applied. Review before deployment.
- FastAPI TestClient emits the Starlette/httpx deprecation warning noted above.
- The model evaluation uses one stratified hold-out set and the target remains imbalanced. The `TotalCharges` leakage is resolved: median fitting occurs only in the training-fitted numeric preprocessing pipeline.
- Tests validate local behavior only; no deployment, authentication, production load, or external validation was performed.
# Classroom Insight — ML Inference Service

This directory contains the Python FastAPI microservice responsible for serving machine learning predictions, discovering compatible models, reporting genuine offline evaluation metrics, and verifying service health.

> **Architectural Boundary Invariant:** This service is strictly **internal**. Browser traffic from the React frontend must **never** call port 8000 directly. All client requests route through the Spring Boot application backend (`/api/*`), which communicates with FastAPI via `/internal/*`.
>
> **No Online Retraining:** This service loads pre-trained serialized pipelines from `ml-service/artifacts/` on startup. Inference requests never trigger model training or alter serialized model artifacts.

---

## 1. Local Setup & Startup

### Prerequisites
- Python 3.10+ (tested on Python 3.14.6)
- Virtual environment with dependencies installed from `ml-service/requirements.txt`

### Starting the Service Locally

From the repository root:

```bash
# Using uvicorn with app-dir pointing to ml-service
python -m uvicorn app.main:app --app-dir ml-service --host 0.0.0.0 --port 8000 --reload
```

Or from inside `ml-service/`:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI documentation is available locally at:
`http://localhost:8000/docs`

---

## 2. Configuration & Environment Variables

All settings are externalized and can be overridden via environment variables:

| Variable | Default Value | Description |
|---|---|---|
| `ARTIFACTS_DIR` | `ml-service/artifacts` | Path to directory containing serialized `.joblib` pipelines |
| `REGISTRY_PATH` | `ml-service/artifacts/model_registry.json` | Path to canonical model registry metadata |
| `EVALUATION_REPORT_PATH` | `ml-service/artifacts/evaluation_report.json` | Path to offline evaluation report metrics |
| `SCHEMA_PATH` | `docs/feature_schema.json` | Path to canonical feature schema |
| `HOST` | `0.0.0.0` | Bind host for FastAPI server |
| `PORT` | `8000` | Bind port for FastAPI server |

---

## 3. Internal Endpoints Specification

### 3.1 Service Health
- **Endpoint:** `GET /internal/health`
- **Success (HTTP 200 OK):**
```json
{
  "status": "UP",
  "models_loaded_count": 10,
  "service": "Classroom Insight ML Inference Service",
  "version": "1.0.0"
}
```
- **Degraded/Down (HTTP 503 Service Unavailable):** Returns status `DEGRADED` (if some models failed to load) or `DOWN` (if no models loaded or registry missing).

### 3.2 List Compatible Models
- **Endpoint:** `GET /internal/models?goal={regression|classification}`
- **Query Parameter:** `goal` (required, `regression` or `classification`)
- **Success (HTTP 200 OK):**
```json
{
  "goal": "regression",
  "models": [
    {
      "model_id": "linear_regression",
      "name": "Linear Regression",
      "family": "Linear Regression",
      "version": "1.0.0",
      "status": "available",
      "description": "Ordinary least squares linear regression baseline",
      "selected_primary_candidate": false
    },
    {
      "model_id": "random_forest_regressor",
      "name": "Random Forest Regressor",
      "family": "Random Forest",
      "version": "1.0.0",
      "status": "available",
      "description": "Ensemble of randomized decision trees",
      "selected_primary_candidate": true
    }
  ]
}
```

### 3.3 Model Performance Report
- **Endpoint:** `GET /internal/models/performance?goal={regression|classification}`
- **Query Parameter:** `goal` (required, `regression` or `classification`)
- **Success (HTTP 200 OK):** Returns genuine offline metrics evaluated on untouched held-out test data (e.g., test sample count 79, MAE, RMSE, R² for regression; accuracy, precision, recall, F1, and confusion matrix for classification).

### 3.4 Student Performance Prediction
- **Endpoint:** `POST /internal/predictions`
- **Request Body (Single Mode):**
```json
{
  "goal": "regression",
  "mode": "single",
  "model_id": "random_forest_regressor",
  "features": {
    "G1": 14,
    "G2": 15,
    "studytime": 3,
    "failures": 0,
    "absences": 4,
    "schoolsup": "no",
    "famsup": "yes",
    "paid": "no"
  }
}
```
- **Response (HTTP 200 OK):**
```json
{
  "goal": "regression",
  "mode": "single",
  "status": "success",
  "results": [
    {
      "model_id": "random_forest_regressor",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": 15.2,
      "predicted_class": null,
      "error_message": null
    }
  ]
}
```

- **Request Body (Comparison Mode):**
```json
{
  "goal": "classification",
  "mode": "compare",
  "model_ids": ["logistic_regression", "random_forest_classifier"],
  "features": {
    "G1": 14,
    "G2": 15,
    "studytime": 3,
    "failures": 0,
    "absences": 4,
    "schoolsup": "no",
    "famsup": "yes",
    "paid": "no"
  }
}
```
- **Response (HTTP 200 OK):**
```json
{
  "goal": "classification",
  "mode": "compare",
  "status": "success",
  "results": [
    {
      "model_id": "logistic_regression",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": null,
      "predicted_class": "pass",
      "error_message": null
    },
    {
      "model_id": "random_forest_classifier",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": null,
      "predicted_class": "pass",
      "error_message": null
    }
  ]
}
```

### 3.5 Partial Failure Handling
If multiple models are requested in `compare` mode and one model fails (e.g., incompatible task or corrupt artifact), the service:
- Preserves all successful predictions.
- Sets `status: "failed"` and a safe `error_message` for the failing model.
- Sets the overall response status to `"partial_success"` with HTTP 200 OK.
- If every requested model fails, returns HTTP 400 (for invalid model selections) or HTTP 502 (for runtime inference failures) with a standardized error envelope.

---

## 4. Running Tests

Run the full ML service test suite (both Phase 1 model verification and Phase 2 API tests):

```bash
pytest ml-service/tests -v
```

To run API integration tests specifically:

```bash
pytest ml-service/tests/test_api.py -v
```

---

## 5. Offline Model Training & Evaluation

> **Critical Distinction: Offline Training vs. Online Inference:**
> Model training and evaluation are conducted strictly **offline**. The live inference service (`app/main.py`) never trains, retrains, or alters model pipelines.

### Reproducing Training Artifacts
The training pipeline (`ml-service/training/train_models.py`) reproduces all 10 canonical model artifacts, the ablation experiments, and canonical evaluation reports:

```bash
# Execute offline training pipeline
python ml-service/training/train_models.py
```

### Generated Artifacts
1. **Serialized Models (`ml-service/artifacts/*.joblib`):**
   - Regression: `linear_regression.joblib`, `decision_tree_regressor.joblib`, `random_forest_regressor.joblib`, `svr.joblib`, `knn_regressor.joblib`.
   - Classification: `logistic_regression.joblib`, `decision_tree_classifier.joblib`, `random_forest_classifier.joblib`, `svc.joblib`, `knn_classifier.joblib`.
2. **Metadata & Reports:**
   - `model_registry.json`: Registry of available models, hyperparameter signatures, and candidate flags.
   - `evaluation_report.json`: Held-out 20% test set metrics and 5-fold cross-validation statistics.

---

## 6. Docker & Containerized Runtime

In the Docker Compose stack:
- **Image:** Built from `ml-service/Dockerfile` based on `python:3.14-slim`.
- **Internal Port:** Binds to `0.0.0.0:8000` on the private bridge network `classroom-network`.
- **Host Port:** Port 8000 is intentionally **not published** to the host machine to preserve the security boundary.
- **Volume Mount:** Mounts `./ml-service/artifacts:/app/artifacts:ro` in read-only mode to prevent any modification to model artifacts.


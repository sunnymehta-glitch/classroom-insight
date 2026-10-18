# Classroom Insight — API Contract & Data Specification

**Document:** `docs/API_CONTRACT.md`  
**Version:** 1.0.0  
**Status:** Approved & Canonical  
**Baseline Document:** `CLASSROOM_INSIGHT_FINAL_MASTER_PLAN.md`  
**Date:** 17 October 2026  

---

## 1. Architectural Boundaries & Communication Rules

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite (Browser)               │
│               Port 5173 (Dev) / Production             │
└───────────────────────────┬────────────────────────────┘
                            │
              Public REST / JSON via /api/*
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Spring Boot Backend                    │
│                     Port 8080                          │
│   • Request Validation & DTOs                          │
│   • Persistence & Business Logic (File-backed H2)      │
│   • Upstream Orchestration & Error Translation         │
└───────────────────────────┬────────────────────────────┘
                            │
            Internal REST / JSON via /internal/*
                            ▼
┌────────────────────────────────────────────────────────┐
│                 FastAPI ML Service                     │
│                     Port 8000                          │
│   • Pydantic Feature Validation                        │
│   • Model Inference (scikit-learn Pipelines)           │
│   • Registry & Evaluation Reports                      │
└────────────────────────────────────────────────────────┘
```

### Non-Negotiable Boundary Rules
1. **Direct Browser Access Prohibited:** React must never directly call the internal FastAPI service (`http://ml-service:8000` or `http://localhost:8000`). All client traffic routes through Spring Boot (`/api/*`).
2. **Database Ownership:** Spring Boot is the sole owner of application database writes (file-backed H2). FastAPI and offline training scripts must never write directly to the application database.
3. **No Online Retraining:** Live prediction requests (`POST /api/predictions`) or outcome recordings (`POST /api/predictions/{id}/outcome`) must **never** trigger model training or alter serialized model artifacts. Training is strictly offline and reproducible.
4. **No Metric or Data Fabrication:** Endpoints must return genuine model evaluation metrics, actual predictions, and live service health. Empty, unavailable, or failed states must be honestly reported.

---

## 2. Standard Data Types & Canonical Schema

All endpoints enforce the canonical feature schema defined in [`docs/feature_schema.json`](file:///docs/feature_schema.json):

### 2.1 The Eight Input Features

| Field | Type | Allowed Values / Range | Observed in Data | Description & Meanings |
|---|---|---|---|---|
| `G1` | `integer` | `0` to `20` | `3` to `19` | First-period mathematics grade (0–20 scale) |
| `G2` | `integer` | `0` to `20` | `0` to `19` | Second-period mathematics grade (0–20 scale) |
| `studytime` | `integer` | `[1, 2, 3, 4]` | `1, 2, 3, 4` | Weekly study time: `1` (<2 hrs), `2` (2–5 hrs), `3` (5–10 hrs), `4` (>10 hrs) |
| `failures` | `integer` | `[0, 1, 2, 3]` | `0, 1, 2, 3` | Past class failures: `0`, `1`, `2`, `3` exact. Value `4` is absent from data and rejected. |
| `absences` | `integer` | `0` to `93` | `0` to `75` | Total number of school absences (source domain 0–93, observed max 75 in Math course) |
| `schoolsup` | `string` | `["no", "yes"]` | `"no", "yes"` | Extra educational support provided by the school |
| `famsup` | `string` | `["no", "yes"]` | `"no", "yes"` | Family educational support |
| `paid` | `string` | `["no", "yes"]` | `"no", "yes"` | Extra paid classes within mathematics |

*Disallowed Input:* `G3` must never be accepted as an inference input feature.

### 2.2 Metadata Inputs
- `student_reference` (`string`, optional): Anonymous student reference ID matching regex `^[A-Za-z0-9_-]{1,32}$`. Never accept or store student names, dates of birth, or PII.

### 2.3 Tasks & Targets
- **Task A — Regression (`goal: "regression"`):**
  - Target: `G3` (numeric, integer 0–20).
  - Output property: `predicted_grade` (`number`, 0.0 to 20.0).
- **Task B — Binary Classification (`goal: "classification"`):**
  - Target: `pass_status` derived strictly as `G3 >= 10 ? "pass" : "fail"`.
  - Output property: `predicted_class` (`string`, `"pass"` or `"fail"`).

---

## 3. Public Endpoints (React ➔ Spring Boot)

Base URL: `http://localhost:8080/api`

### 3.1 Health Check
- **Endpoint:** `GET /api/health`
- **Purpose:** Verifies health of Spring Boot, local H2 database, and upstream FastAPI ML service.
- **Success Response (HTTP 200):**
```json
{
  "status": "UP",
  "version": "1.0.0",
  "timestamp": "2026-10-17T22:00:00Z",
  "components": {
    "database": {
      "status": "UP",
      "details": {
        "database": "H2",
        "file": "data/h2/classroom_insight"
      }
    },
    "ml_service": {
      "status": "UP",
      "details": {
        "url": "http://localhost:8000/internal/health",
        "models_loaded": 10
      }
    }
  }
}
```
- **Degraded Response (HTTP 200 or 503):** If ML service is down, Spring Boot returns overall status `"DEGRADED"` with `ml_service.status: "DOWN"`, while the database remains operational for browsing history.

---

### 3.2 List Available Models
- **Endpoint:** `GET /api/models?goal={regression|classification}`
- **Purpose:** Returns models compatible with the requested task that have verified, loaded artifacts.
- **Query Parameters:**
  - `goal` (required, string): `"regression"` or `"classification"`.
- **Success Response (HTTP 200):**
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
      "description": "Baseline ordinary least squares regression"
    },
    {
      "model_id": "random_forest_regressor",
      "name": "Random Forest Regressor",
      "family": "Random Forest",
      "version": "1.0.0",
      "status": "available",
      "description": "Ensemble of decision trees for grade prediction"
    }
  ]
}
```

---

### 3.3 Model Performance Reports
- **Endpoint:** `GET /api/models/performance?goal={regression|classification}`
- **Purpose:** Returns genuine evaluation metrics from the offline training pipeline.
- **Query Parameters:**
  - `goal` (required, string): `"regression"` or `"classification"`.
- **Success Response for Regression (HTTP 200):**
```json
{
  "goal": "regression",
  "dataset": "UCI Student Performance - Mathematics (student-mat.csv)",
  "evaluation_strategy": "Held-out test set (80/20 split), CV (5-fold) on train set",
  "test_sample_count": 79,
  "generated_at": "2026-10-17T21:00:00Z",
  "models": [
    {
      "model_id": "linear_regression",
      "name": "Linear Regression",
      "version": "1.0.0",
      "metrics": {
        "mae": 1.25,
        "rmse": 1.82,
        "r2": 0.81
      },
      "status": "evaluated"
    },
    {
      "model_id": "random_forest_regressor",
      "name": "Random Forest Regressor",
      "version": "1.0.0",
      "metrics": {
        "mae": 1.18,
        "rmse": 1.74,
        "r2": 0.83
      },
      "status": "evaluated"
    }
  ]
}
```

- **Success Response for Classification (HTTP 200):**
```json
{
  "goal": "classification",
  "dataset": "UCI Student Performance - Mathematics (student-mat.csv)",
  "evaluation_strategy": "Held-out test set (80/20 stratified split), CV (5-fold) on train set",
  "test_sample_count": 79,
  "generated_at": "2026-10-17T21:00:00Z",
  "models": [
    {
      "model_id": "logistic_regression",
      "name": "Logistic Regression",
      "version": "1.0.0",
      "metrics": {
        "accuracy": 0.9114,
        "precision_macro": 0.8920,
        "recall_macro": 0.8850,
        "f1_macro": 0.8884,
        "confusion_matrix": {
          "true_negative": 21,
          "false_positive": 5,
          "false_negative": 2,
          "true_positive": 51
        }
      },
      "status": "evaluated"
    }
  ]
}
```

---

### 3.4 Create Prediction
- **Endpoint:** `POST /api/predictions`
- **Purpose:** Submits input features for inference (single model or model comparison), calls internal FastAPI, persists prediction record to H2, and returns saved record.
- **Request Envelope (Single Mode):**
```json
{
  "goal": "regression",
  "mode": "single",
  "model_id": "random_forest_regressor",
  "student_reference": "STU-1042",
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

- **Request Envelope (Comparison Mode):**
```json
{
  "goal": "regression",
  "mode": "compare",
  "model_ids": [
    "linear_regression",
    "random_forest_regressor",
    "decision_tree_regressor"
  ],
  "student_reference": "STU-1042",
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

- **Success Response (HTTP 201 Created):**
```json
{
  "prediction_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "goal": "regression",
  "mode": "compare",
  "status": "success",
  "student_reference": "STU-1042",
  "features": {
    "G1": 14,
    "G2": 15,
    "studytime": 3,
    "failures": 0,
    "absences": 4,
    "schoolsup": "no",
    "famsup": "yes",
    "paid": "no"
  },
  "results": [
    {
      "model_id": "linear_regression",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": 14.82,
      "error_message": null
    },
    {
      "model_id": "random_forest_regressor",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": 15.20,
      "error_message": null
    },
    {
      "model_id": "decision_tree_regressor",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": 15.00,
      "error_message": null
    }
  ],
  "created_at": "2026-10-17T22:15:30Z",
  "schema_version": "1.0.0"
}
```

- **Partial Success Response (HTTP 201 or 200):** If one model in comparison mode fails (e.g., corrupted artifact), the overall status is `"partial_success"`, the successful predictions are preserved and persisted, and the failed model includes `"status": "failed"` and `"error_message"`.
- **Classification Result Format:** For classification, each item in `results` contains `"predicted_class": "pass"` or `"fail"` instead of `predicted_grade`.

---

### 3.5 Prediction History Search & Pagination
- **Endpoint:** `GET /api/predictions`
- **Query Parameters:**
  - `page` (optional integer, default `0`): Zero-based page index.
  - `size` (optional integer, default `20`, max `100`): Page size.
  - `goal` (optional string): `"regression"` or `"classification"`.
  - `q` (optional string): Search term matching `student_reference` or `prediction_id`.
  - `from` (optional string, ISO 8601): Start date/time filter.
  - `to` (optional string, ISO 8601): End date/time filter.
- **Success Response (HTTP 200):**
```json
{
  "items": [
    {
      "prediction_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "goal": "regression",
      "mode": "compare",
      "status": "success",
      "student_reference": "STU-1042",
      "models_used": ["linear_regression", "random_forest_regressor", "decision_tree_regressor"],
      "primary_result": "14.82 (Linear Regression)",
      "has_recorded_outcome": false,
      "created_at": "2026-10-17T22:15:30Z"
    }
  ],
  "page": 0,
  "size": 20,
  "total_elements": 1,
  "total_pages": 1
}
```

---

### 3.6 Fetch Saved Prediction Detail
- **Endpoint:** `GET /api/predictions/{id}`
- **Purpose:** Re-opens a persisted prediction record with complete inputs and per-model results **without rerunning ML inference**.
- **Path Parameters:**
  - `id` (required, UUID): The prediction ID.
- **Success Response (HTTP 200):** Matches the complete envelope returned during creation, plus any linked `verified_outcome` metadata if previously recorded.
- **Not Found Response (HTTP 404):** Returned if `id` does not exist in the database.

---

### 3.7 Record Actual Verified Outcome
- **Endpoint:** `POST /api/predictions/{id}/outcome`
- **Purpose:** Records actual final grade (`actual_g3`) separately. Backend automatically computes `actual_pass_status` (`pass` if `actual_g3 >= 10`, else `fail`).
- **Critical Constraint:** Recording an outcome **never** triggers model retraining.
- **Request Envelope:**
```json
{
  "actual_g3": 15,
  "source": "teacher_reported",
  "notes": "End of term final examination score verified by instructor"
}
```
- **Success Response (HTTP 200):**
```json
{
  "outcome_id": "9bb231f1-3444-42ea-9c02-e0186104bc12",
  "prediction_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "actual_g3": 15,
  "actual_pass_status": "pass",
  "source": "teacher_reported",
  "verification_status": "recorded",
  "notes": "End of term final examination score verified by instructor",
  "recorded_at": "2026-10-17T22:30:00Z"
}
```

---

## 4. Internal Endpoints (Spring Boot ➔ FastAPI)

Base URL: Configurable via environment variable `ML_SERVICE_URL` (default: `http://localhost:8000` or `http://ml-service:8000` in Docker).

### 4.1 Internal Health
- **Endpoint:** `GET /internal/health`
- **Response (HTTP 200):**
```json
{
  "status": "UP",
  "models_loaded_count": 10,
  "service": "Classroom Insight ML Inference Service",
  "version": "1.0.0"
}
```

### 4.2 Internal Model List
- **Endpoint:** `GET /internal/models?goal={regression|classification}`
- **Response (HTTP 200):** Returns array of loaded, compatible model metadata.

### 4.3 Internal Model Performance
- **Endpoint:** `GET /internal/models/performance?goal={regression|classification}`
- **Response (HTTP 200):** Returns evaluation report dictionary loaded from trusted training artifact directory.

### 4.4 Internal Inference
- **Endpoint:** `POST /internal/predictions`
- **Request Envelope:**
```json
{
  "goal": "regression",
  "mode": "compare",
  "model_ids": ["linear_regression", "random_forest_regressor"],
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
- **Response (HTTP 200):**
```json
{
  "goal": "regression",
  "mode": "compare",
  "status": "success",
  "results": [
    {
      "model_id": "linear_regression",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": 14.82,
      "error_message": null
    },
    {
      "model_id": "random_forest_regressor",
      "model_version": "1.0.0",
      "status": "success",
      "predicted_grade": 15.20,
      "error_message": null
    }
  ]
}
```

---

## 5. Standard Error Envelopes & HTTP Status Codes

All error responses from Spring Boot adhere to a unified error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed. Please check the supplied feature values.",
    "details": [
      {
        "field": "features.G1",
        "issue": "Value must be between 0 and 20."
      },
      {
        "field": "features.failures",
        "issue": "Value must be an integer between 0 and 3 (allowed: 0, 1, 2, 3)."
      }
    ],
    "request_id": "req-8f4b66ae-9524-4f51"
  },
  "timestamp": "2026-10-17T22:15:30Z"
}
```

### HTTP Status Code Usage:
- `200 OK`: Successful read or update.
- `201 Created`: Prediction created and persisted; outcome recorded.
- `400 Bad Request` / `422 Unprocessable Entity`: Input validation failure (missing fields, out-of-range features, invalid format).
- `404 Not Found`: Model ID, prediction ID, or endpoint does not exist.
- `409 Conflict`: Business logic conflict (e.g. attempting to record duplicate outcome).
- `500 Internal Server Error`: Unexpected runtime failure in Spring Boot.
- `502 Bad Gateway`: Upstream ML service returned an unparseable or erroneous response.
- `503 Service Unavailable`: Upstream ML service is down or unreachable.
- `504 Gateway Timeout`: Upstream ML service timed out (default threshold: 5000 ms).

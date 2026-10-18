# Classroom Insight

> **Academic Machine Learning Web Application for Student Trajectory Estimation**

Classroom Insight is an academic machine learning web platform designed to assist secondary school educators in estimating students' academic trajectory—specifically continuous final mathematics grade (`G3`, 0–20 scale) and binary academic risk / pass-fail status (`G3 >= 10`)—using eight key indicators captured after two grading periods (`G1` and `G2`).

The system is built on a decoupled, three-tier architecture emphasizing reproducible machine learning pipelines, file-backed transactional persistence, strict architectural boundaries, comprehensive containerization, and honest evaluation reporting without synthetic or fabricated metrics.

---

## Table of Contents

1. [Architecture & Architectural Invariants](#1-architecture--architectural-invariants)
2. [Technology Stack & Supported Runtime Versions](#2-technology-stack--supported-runtime-versions)
3. [The Eight Approved Features & Domain Schema](#3-the-eight-approved-features--domain-schema)
4. [Dataset & Academic Disclosures](#4-dataset--academic-disclosures)
5. [Docker Compose Deployment (Recommended)](#5-docker-compose-deployment-recommended)
6. [Local Non-Container Setup](#6-local-non-container-setup)
7. [Verification Suites & Automated Tests](#7-verification-suites--automated-tests)
8. [Safe H2 Database Persistence & Backup/Restore](#8-safe-h2-database-persistence--backuprestore)
9. [API Specification & Error Envelopes](#9-api-specification--error-envelopes)
10. [Offline Model Training vs. Online Inference](#10-offline-model-training-vs-online-inference)
11. [Demonstration Walkthrough Checklist](#11-demonstration-walkthrough-checklist)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Limitations & Academic Integrity](#13-limitations--academic-integrity)

---

## 1. Architecture & Architectural Invariants

```
┌─────────────────────────────────┐
│     React 18 Frontend (SPA)     │
│  (Port 5173 - Nginx in Docker)  │
└────────────────┬────────────────┘
                 │ HTTP (Reverse Proxy /api/*)
                 ▼
┌────────────────────────────────────────────────────────┐
│     Spring Boot 3.5.16 Application Backend             │
│            (Java 25 LTS - Port 8080)                   │
│                                                        │
│  • Public REST API & Bean Validation                   │
│  • Bounded HTTP Client (3s Connect / 5s Read SLA)      │
│  • Sole Database Authority                             │
└────────────┬─────────────────────────────┬─────────────┘
             │ JDBC                        │ HTTP (/internal/*)
             ▼                             ▼
┌───────────────────────────┐ ┌──────────────────────────────────────┐
│  File-Backed H2 Database  │ │  FastAPI Python ML Service           │
│   (./data/h2/storage)     │ │   (Internal Port 8000 - Unexposed)   │
│                           │ │                                      │
│ • Prediction History      │ │ • 10 Scikit-Learn Fitted Pipelines   │
│ • Audit Trails            │ │ • Read-Only Artifact Mount           │
│ • Verified Outcomes       │ │ • Zero Retraining on Live Calls      │
└───────────────────────────┘ └──────────────────────────────────────┘
```

### Core Invariants:
1. **Public API Gateway:** All browser traffic routes exclusively through Spring Boot (`/api/*`). The internal FastAPI inference service (`/internal/*`) is private to the container network and never exposed to the host.
2. **Sole Database Authority:** Spring Boot exclusively owns all database reads and writes. The Python ML service has zero database access.
3. **No Retraining on Live Operations:** Live predictions, history inquiries, and actual outcome submissions never trigger model retraining or alter serialized `.joblib` artifacts.
4. **Persistent History:** Saved predictions and verified outcomes persist in file-backed H2 storage across restarts and are retrievable without re-running inference.
5. **No Metric Fabrication:** Overview cards and performance visualizers dynamically read canonical offline evaluation reports evaluated on untouched test data.

---

## 2. Technology Stack & Supported Runtime Versions

| Tier | Technology | Supported Version | Notes |
|---|---|---|---|
| **Frontend** | React, TypeScript, Vite | React 18.3.1, TS 5.6.3, Vite 6.0.1 | Tailwind CSS 3.4.16, Recharts 2.15.0, Lucide React 0.468 |
| **Backend** | Java, Spring Boot | Java 25 LTS (OpenJDK 25.0.3), Spring Boot 3.5.16 | Spring Data JPA 3.5.13, Hibernate 6.6.53.Final, Bean Validation |
| **Database** | H2 Database Engine | 2.3.232 | File-backed mode (`./data/h2/classroom_insight.mv.db`) |
| **ML Inference** | Python, FastAPI | Python 3.14.6 (local) / 3.14-slim (Docker) | scikit-learn 1.9.1, pandas 3.0.6, numpy 2.5.4, joblib 1.6.0 |
| **Orchestration** | Docker, Docker Compose | Docker Compose v2.20+ / Docker Desktop (WSL 2) | Multi-stage Dockerfiles, healthchecks, bridge networking |

---

## 3. The Eight Approved Features & Domain Schema

The feature schema is strictly locked in [`docs/feature_schema.json`](file:///docs/feature_schema.json):

| Feature | Type | Valid Range / Allowed Values | Observed in Data | Description |
|---|---|---|---|---|
| `G1` | `integer` | `0` to `20` | `3` to `19` | First-period mathematics grade (0–20 scale) |
| `G2` | `integer` | `0` to `20` | `0` to `19` | Second-period mathematics grade (0–20 scale) |
| `studytime` | `integer` | `1, 2, 3, 4` | `1, 2, 3, 4` | Weekly study time: `1` (<2h), `2` (2–5h), `3` (5–10h), `4` (>10h) |
| `failures` | `integer` | `0, 1, 2, 3` | `0, 1, 2, 3` | Number of past class failures (`0` to `3`; category `4` is absent and rejected) |
| `absences` | `integer` | `0` to `93` | `0` to `75` | Total recorded school absences (source domain: 0–93; observed max: 75) |
| `schoolsup` | `string` | `"no", "yes"` | `"no", "yes"` | Extra educational support from the school |
| `famsup` | `string` | `"no", "yes"` | `"no", "yes"` | Family educational support |
| `paid` | `string` | `"no", "yes"` | `"no", "yes"` | Extra paid classes for mathematics |

> **Strict Exclusion:** The final grade `G3` is the target variable. It is strictly disallowed as an input feature. Any request containing `G3` in features is rejected with `HTTP 400 VALIDATION_ERROR`.

---

## 4. Dataset & Academic Disclosures

- **Dataset:** Official [UCI Student Performance Dataset](https://archive.ics.uci.edu/dataset/320/student-performance) — Mathematics Course (`student-mat.csv`).
- **Sample Count:** 395 student records, 33 attributes (semicolon-delimited, zero missing values).
- **Split Strategy:** 80/20 stratified split into 316 training samples and 79 held-out test samples.
- **Citation:** P. Cortez and A. Silva. *Using Data Mining to Predict Secondary School Student Performance*. FUBUTEC 2008, Porto, Portugal.

### Model Candidates & Canonical Performance:
- **Primary Regression Candidate:** **Random Forest Regressor** (8 features)
  - Held-out Test MAE: `1.1154`
  - Held-out Test RMSE: `1.7787`
  - Held-out Test $R^2$: `0.8425`
  - Training 5-Fold CV MAE: `0.9690 ± 0.1276`
  - *Benchmark Baseline Comparison ($G3 = G2$):* The required non-parametric heuristic baseline achieves Test MAE `1.1013` (CV MAE `0.9279`), slightly lower in mean absolute error than the Random Forest Regressor (Test MAE `1.1154`). However, Random Forest achieves substantially lower Test RMSE (`1.7787` vs `2.0531`, representing a 13.4% lower RMSE and 24.9% lower MSE) and higher variance explained (Test $R^2$ `0.8425` vs `0.7901`), providing superior quadratic error control against catastrophic grade mispredictions.
- **Primary Classification Candidate:** **Random Forest Classifier** (8 features)
  - Held-out Test Accuracy: `87.34%`
  - Held-out Test Macro F1: `0.8638`
  - Fail Class Recall: `92.31%`
  - Training 5-Fold CV Accuracy: `93.36% ± 1.16%`

---

## 5. Docker Compose Deployment (Recommended)

### Prerequisites
- Docker Desktop on Windows with WSL 2 enabled, or Docker Engine 24+ on Linux.

### Build and Start Stack
```bash
# Validate compose configuration
docker compose config

# Build and start all 3 services in background
docker compose up --build -d

# Verify all services report (healthy)
docker compose ps
```

### Exposed Endpoints:
- **Frontend Web UI:** `http://localhost:5173/`
- **Spring Boot Public API:** `http://localhost:8080/api/`
- **FastAPI Internal ML Service:** Internal only (Port 8000 on `classroom-network`).

### Service Logs & Monitoring
```bash
# View aggregated live logs
docker compose logs -f

# Inspect specific service logs
docker compose logs backend --tail 100
docker compose logs ml-service --tail 100
docker compose logs frontend --tail 100
```

### Safe Stack Shutdown
```bash
# Graceful stop and container removal (preserves database in ./data/h2/)
docker compose down

# CAUTION: NEVER RUN `docker compose down -v` as it erases named volumes!
```

---

## 6. Local Non-Container Setup

### Prerequisites
- **Python:** 3.10+ (tested on Python 3.14.6)
- **Java:** Java 25 LTS (OpenJDK 25.0.3)
- **Node.js:** Node.js 18+ or 20+ LTS

### 1. Internal ML Service (FastAPI)
```powershell
# In terminal 1:
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --app-dir ml-service --host 127.0.0.1 --port 8000
```

### 2. Application Backend (Spring Boot)
```powershell
# In terminal 2:
.\server\mvnw.cmd -f server/pom.xml test
.\server\mvnw.cmd -f server/pom.xml clean package -DskipTests
java -jar server/target/classroom-insight-server-1.0.0.jar
```

### 3. Frontend Web App (React + Vite)
```powershell
# In terminal 3:
cd client
npm install
npm test
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 7. Verification Suites & Automated Tests

All automated tests and verification suites can be executed from the repository root:

| Verification Suite | Command | Expected Outcome |
|---|---|---|
| **Phase 0 Integrity** | `python scripts/verify_phase0.py` | Validates dataset SHA-256, schema constraints, and contract consistency |
| **Phase 3 Live End-to-End** | `python scripts/verify_phase3_live.py` | 14/14 checks pass against live Spring Boot API (`/api/*`) |
| **Phase 5 Docker Integration** | `python scripts/verify_phase5_integration.py` | 10/10 checks pass: discovery, inference, comparison, history, outcomes, artifact immutability |
| **Phase 5 Container Resilience** | `python scripts/verify_phase5_resilience.py` | 2/2 tests pass: service outage (503) & 5000ms bounded timeout SLA (504 in ~5.01s) |
| **Frontend Unit & Component** | `cd client && npm test` | 7 test files, 20/20 Vitest tests pass |
| **Frontend Production Build** | `cd client && npm run build` | TypeScript typechecks and minified bundle generated in `client/dist/` |
| **Backend Maven Tests** | `.\server\mvnw.cmd -f server/pom.xml test` | 32/32 JUnit 5 tests pass (0 failures, 0 errors) |
| **ML Service Tests** | `pytest ml-service/tests` | 31/31 pytest tests pass |

---

## 8. Safe H2 Database Persistence & Backup/Restore

The database is stored on the host filesystem under `./data/h2/classroom_insight.mv.db`.

### Invariants:
- **Never delete `./data/h2/`:** Historical predictions and verified student records are stored here.
- **Never use `docker compose down -v`:** Always use `docker compose down` without the `-v` flag.

### Backup Procedure:
```powershell
# Create timestamped database backup while backend is stopped or idle
Copy-Item "./data/h2/classroom_insight.mv.db" "./data/h2/backup_classroom_insight_$(Get-Date -Format 'yyyyMMdd_HHmmss').mv.db"
```

### Restore Procedure:
```powershell
# 1. Stop backend container
docker compose stop backend

# 2. Restore database file from backup
Copy-Item "./data/h2/backup_classroom_insight_<timestamp>.mv.db" "./data/h2/classroom_insight.mv.db"

# 3. Start backend container
docker compose start backend
```

---

## 9. API Specification & Error Envelopes

### Key Public Endpoints:
- `GET /api/health`: System health status (Spring Boot, H2 database, and upstream ML service).
- `GET /api/models?goal={regression|classification}`: List registered, compatible ML models.
- `GET /api/models/performance?goal={regression|classification}`: Canonical offline evaluation reports.
- `POST /api/predictions`: Run inference (single or comparison mode) and persist record to H2.
- `GET /api/predictions`: Query paginated prediction history with search filtering.
- `GET /api/predictions/{id}`: Reopen saved prediction without re-running inference.
- `POST /api/predictions/{id}/outcome`: Record verified actual G3 score (derives pass/fail, enforces single-outcome policy).

### Standard Error Envelope:
All error responses adhere to a unified, sanitized JSON envelope:
```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "Upstream ML service timed out.",
    "details": [],
    "request_id": "req-bf4ff948"
  },
  "timestamp": "2026-10-18T07:22:22Z"
}
```

### Standard HTTP Status Codes:
- `200 OK`: Successful retrieval or update.
- `201 Created`: Prediction created and persisted in database.
- `400 Bad Request` (`VALIDATION_ERROR` / `INVALID_MODEL_SELECTION`): Invalid input values or unknown model requested.
- `404 Not Found` (`NOT_FOUND`): Prediction ID does not exist.
- `409 Conflict` (`CONFLICT`): Attempting to record duplicate outcome.
- `503 Service Unavailable` (`UPSTREAM_UNAVAILABLE`): ML service is stopped or unreachable.
- `504 Gateway Timeout` (`UPSTREAM_TIMEOUT`): Upstream ML request exceeded the 5000ms SLA.

---

## 10. Offline Model Training vs. Online Inference

> **Crucial Distinction:** Online prediction and outcome recording **never** train models. All models are trained strictly offline.

To retrain or reproduce canonical model artifacts:
```powershell
# Run the reproducible offline training pipeline
python ml-service/training/train_models.py
```
This script reproduces:
1. 10 scikit-learn model pipelines saved to `ml-service/artifacts/*.joblib`.
2. Metadata registry: `ml-service/artifacts/model_registry.json`.
3. Evaluation reports: `ml-service/artifacts/evaluation_report.json`.

---

## 11. Demonstration Walkthrough Checklist

Follow this reproducible 10-step flow using synthetic student data:

1. **Verify Services:** Open `http://localhost:5173/`. Verify the top badge reads `System Healthy (10 models ready)`.
2. **Review Overview:** Inspect the Primary Model highlights:
   - Random Forest Regressor: Test MAE `1.1154`, Test RMSE `1.7787`, Test $R^2$ `0.8425`.
   - Random Forest Classifier: Test Accuracy `87.34%`, Test Macro F1 `0.8638`.
3. **Trigger Validation Error:** Navigate to **New Prediction**, enter `G1 = 25`, and verify instant rejection: `G1 must be an integer between 0 and 20`.
4. **Create Single Regression Prediction:**
   - Reference: `DEMO-STU-001`
   - Goal: `Regression` | Model: `Random Forest Regressor`
   - Inputs: `G1=14, G2=15, studytime=3, failures=0, absences=4, schoolsup=no, famsup=yes, paid=no`
   - Click **Run Prediction** $\rightarrow$ Estimated Grade: `15.27 / 20` (bounded to [0.0, 20.0] grading scale).
5. **Run Comparison Mode:**
   - Goal: `Regression` | Mode: `Model Comparison`
   - Select `Linear Regression` and `Random Forest Regressor`.
   - Submit for `DEMO-COMPARE-001` $\rightarrow$ Compare multi-card view on Results screen.
6. **Open History:** Navigate to **Prediction History**.
   - Search `DEMO-STU-001` in search filter.
   - Click record to reopen without re-running inference.
7. **Record Verified Outcome:**
   - On the reopened result, click **Record Actual G3**.
   - Enter `Actual G3 = 16`, Notes: `Verified from end-of-term transcript`.
   - Click **Save Outcome** $\rightarrow$ Status updates to `pass` with green verification badge.
   - Attempting duplicate recording is blocked.
8. **Inspect Model Performance:** Navigate to **Model Performance**.
   - Verify regression error bar chart and test metrics table.
   - Toggle to **Classification** $\rightarrow$ View accuracy, macro F1, and $2\times2$ confusion matrices.
   - Read the **Benchmark Baseline Disclosure** explaining the $G3 = G2$ baseline MAE (`1.1013`) vs Random Forest error control (RMSE `1.7787` vs `2.0531`; $R^2$ `0.8425` vs `0.7901`).
9. **Simulate Upstream Outage (Resilience):**
   - In terminal: `docker compose stop ml-service`
   - In UI: Refresh page $\rightarrow$ System status reflects `Degraded (ML service offline)`.
   - Submitting prediction returns clean `HTTP 503 UPSTREAM_UNAVAILABLE` error envelope.
   - History remains 100% accessible and unaffected.
10. **Restore Service:**
   - In terminal: `docker compose start ml-service`
   - In UI: Status recovers to `System Healthy (10 models ready)`.

---

## 12. Troubleshooting Guide

| Issue | Symptom | Remediation Steps |
|---|---|---|
| **Container Fails to Start** | `docker compose ps` shows `Exited` | Inspect logs via `docker compose logs <service> --tail 50`. Check port conflicts on 8080 or 5173. |
| **ML Service Degraded / Offline** | Spring Boot `/api/health` reports `DEGRADED` | Verify `ml-service` container is running: `docker compose start ml-service`. Check container logs: `docker compose logs ml-service`. |
| **Gateway Timeout (504)** | Error code `UPSTREAM_TIMEOUT` | Upstream ML service took $>5000\text{ms}$. Verify Docker host CPU/memory resources are not exhausted. |
| **Database Locked / Access Denied** | Spring Boot fails to acquire H2 lock | Ensure no other local Java process or H2 Console is accessing `./data/h2/classroom_insight.mv.db` simultaneously. |
| **Model Artifact Mismatch** | Python reports missing `.joblib` | Run `python ml-service/training/train_models.py` to regenerate canonical artifacts. |

---

## 13. Limitations & Academic Integrity

Classroom Insight is an **academic research prototype**. To prevent misapplication in real-world educational governance, the following limitations are explicitly declared:

1. **Geographic & Curricular Boundaries:** The training dataset originates from two Portuguese secondary schools in the Alentejo region. The empirical patterns have **not** been calibrated or validated for Indian secondary school curricula (CBSE, ICSE, or State Boards) or other international educational systems.
2. **Pass/Fail Threshold Convention:** The threshold `G3 >= 10` is an institutional standard of the Portuguese 0–20 grading scale, not an established standard for Indian board examinations.
3. **Late-Stage Trajectory Estimation:** Because period grades `G1` and `G2` are required features, predictions represent late-stage estimations after two school terms, rather than early-admission screening or diagnostic assessments.
4. **Proxy Variables & Fairness:** Features such as extra paid classes (`paid`) and school support (`schoolsup`) reflect socioeconomic conditions and institutional practices. The models capture statistical associations, not causal effects, and must never be interpreted as establishing causation.
5. **Point Estimates & Absence of Calibrated Intervals:** Model predictions represent point trajectory estimates clipped to the domain bounds `[0.0, 20.0]`. The system does not calculate or claim calibrated individual confidence intervals or uncertainty bounds. Statistical estimates do not guarantee an individual student's future examination score.
6. **Pedagogical Support Only:** Predictions are intended solely to support educator reflection and prompt timely academic support, never for automated student placement, streaming, or disciplinary decisions.

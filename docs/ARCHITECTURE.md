# Classroom Insight — System Architecture & Technical Design

**Document:** `docs/ARCHITECTURE.md`  
**Version:** 1.0.0  
**Status:** Approved & Canonical  
**Baseline Document:** `CLASSROOM_INSIGHT_FINAL_MASTER_PLAN.md`  
**Date:** 17 October 2026  

---

## 1. System Overview & Core Principles

**Classroom Insight** is an academic machine-learning web application designed for educators to estimate student academic trajectory—specifically final mathematics grade (`G3`, 0–20 scale) and binary pass/fail status (`G3 >= 10`)—from eight indicators captured after two grading periods (`G1` and `G2`).

### Core Architectural Axioms
1. **Separation of Concerns:** 
   - **Frontend (React)** handles interactive user experience, state management, and accessible visualizations.
   - **Public Backend (Spring Boot)** owns public API exposure, authoritative request validation, business rules, and relational persistence.
   - **Inference Service (FastAPI)** owns model serialization, scikit-learn pipeline execution, and model performance metadata retrieval.
   - **Offline Training Pipeline** is completely disconnected from live request flows.
2. **Authority & Ownership:** 
   - Spring Boot is the **only service** permitted to write to the application database (file-backed H2).
   - Python inference services and offline scripts never connect or write to the H2 database.
   - React never calls the FastAPI ML service directly.
3. **No Online Retraining:** 
   - Saving a prediction, querying history, or recording a verified student outcome **must never** trigger model training or alter serialized model pipelines.
4. **Authenticity of Data:** 
   - All evaluation metrics, model variants, predictions, and health statuses represent genuine computational outputs. No mock scores, unlabelled fixtures, or simulated confidence ratings are allowed.

---

## 2. High-Level Component Architecture

```mermaid
flowchart TB
    subgraph Client["Presentation Tier (Browser)"]
        UI["React + TypeScript + Vite\n(Port 5173)\n• Overview\n• New Prediction\n• Results\n• History\n• Model Performance"]
    end

    subgraph Backend["Application & Persistence Tier"]
        SB["Spring Boot 3 REST API\n(Port 8080)\n• Bean Validation\n• Prediction Orchestration\n• History & Outcome Management\n• Upstream Error Mapping"]
        H2[("File-backed H2 Database\n(./data/h2/classroom_insight)\n• prediction_history\n• prediction_results\n• verified_outcomes\n• model_metadata")]
        SB <-->|JPA / Hibernate / JDBC| H2
    end

    subgraph MLService["Machine Learning Tier (Internal Only)"]
        FA["FastAPI ML Service\n(Port 8000 / internal)\n• Pydantic Feature Validation\n• Model Registry\n• Inference Dispatcher"]
        Artifacts[("Trusted Model Artifacts\n(./ml-service/artifacts/*.joblib)")]
        Reports[("Evaluation Reports\n(./docs/reports/*.json)")]
        FA -->|Loads| Artifacts
        FA -->|Reads| Reports
    end

    subgraph Offline["Offline Training Workflow"]
        Train["Training Pipeline (Python CLI)\n• Data Loading & 80/20 Stratified Split\n• Feature Preprocessing Pipelines\n• CV Evaluation & Ablation Analysis\n• Model Calibration Checks"]
        UCI[("Official UCI Dataset\n(student-mat.csv)")]
        UCI --> Train
        Train -->|Generates| Artifacts
        Train -->|Generates| Reports
    end

    UI -->|Public REST /api/*| SB
    SB -->|Internal REST /internal/*| FA
```

---

## 3. Technology Stack & Component Specifications

| Tier | Technology | Purpose & Responsibility |
|---|---|---|
| **Frontend** | React 18 / TypeScript / Vite | Single-page application, responsive layout, accessible navigation, form validation, data visualization (Recharts). |
| **Design System** | Vanilla CSS / CSS Variables | Approved purple/indigo/lavender palette (`#211B3B`, `#6855F5`, `#30265C`, `#F7F6FC`, `#FFFFFF`, `#292444`, `#625C78`). |
| **Public Backend** | Java 17/21 / Spring Boot 3 | Authoritative API gateway, Spring Web, Spring Data JPA, Bean Validation, RestClient/WebClient for upstream ML calls. |
| **Database** | File-backed H2 | Embedded, file-persistent local database (`data/h2/classroom_insight.mv.db`), surviving server restarts. |
| **Inference Service** | Python 3.10+ / FastAPI / Pydantic | High-performance inference engine, scikit-learn model loading, memory-resident pipeline execution. |
| **ML Engine** | scikit-learn, NumPy, pandas, joblib | Six algorithm families (Linear/Logistic Regression, Decision Trees, Random Forests, SVM/SVR/SVC, KNN), pipelines with scaling/one-hot encoding. |
| **Orchestration** | Docker Compose | Local containerized orchestration, internal DNS networking (`http://ml-service:8000`). |

---

## 4. End-to-End Execution Flows

### 4.1 Prediction Request & Persistence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Teacher / User
    participant React as React UI (Client)
    participant Spring as Spring Boot API (8080)
    participant DB as H2 Database (File)
    participant FastAPI as FastAPI ML Service (8000)

    Teacher->>React: Enters 8 features, selects goal & models
    React->>React: Validate inputs against schema constraints
    React->>Spring: POST /api/predictions (Single or Compare mode)
    Spring->>Spring: Strict Bean Validation (reject invalid/PII/G3)
    Spring->>FastAPI: POST /internal/predictions (timeout: 5000ms)
    FastAPI->>FastAPI: Validate features & dispatch to loaded pipelines
    FastAPI-->>Spring: Return model predictions / partial failure details
    Spring->>DB: Persist prediction header, inputs, and results
    DB-->>Spring: Confirm record committed
    Spring-->>React: HTTP 201 Created (Envelope with ID, status, results)
    React->>Teacher: Render Results screen (values, disclaimers, bar chart)
```

### 4.2 Reopening History Record (Zero-Inference Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Teacher / User
    participant React as React UI (Client)
    participant Spring as Spring Boot API (8080)
    participant DB as H2 Database (File)
    participant FastAPI as FastAPI ML Service (8000)

    Teacher->>React: Clicks history record STU-1042
    React->>Spring: GET /api/predictions/{id}
    Spring->>DB: Query prediction and linked outcome by ID
    DB-->>Spring: Return stored features and past inference results
    Note over Spring,FastAPI: FastAPI is NOT contacted. Zero inference rerun.
    Spring-->>React: HTTP 200 OK (Full saved prediction record)
    React->>Teacher: Displays saved inputs and historic predictions
```

### 4.3 Recording Actual Verified Outcome Flow

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Teacher / User
    participant React as React UI (Client)
    participant Spring as Spring Boot API (8080)
    participant DB as H2 Database (File)

    Teacher->>React: Submits actual final grade (e.g., G3 = 15)
    React->>Spring: POST /api/predictions/{id}/outcome
    Spring->>Spring: Validate actual_g3 (0 to 20), derive actual_pass_status
    Spring->>DB: Insert into verified_outcomes table
    DB-->>Spring: Outcome recorded
    Note over Spring: NO RETRAINING IS TRIGGERED
    Spring-->>React: HTTP 200 OK (Recorded outcome metadata)
    React->>Teacher: Confirms outcome saved
```

---

## 5. Relational Database Architecture (H2)

Spring Boot manages the H2 schema through JPA / Hibernate with persistent file storage at `./data/h2/classroom_insight`.

```mermaid
erDiagram
    PREDICTION_HISTORY ||--o{ PREDICTION_RESULT : contains
    PREDICTION_HISTORY ||--o| VERIFIED_OUTCOME : has

    PREDICTION_HISTORY {
        uuid id PK
        varchar student_reference
        varchar goal
        varchar mode
        varchar status
        int g1
        int g2
        int studytime
        int failures
        int absences
        varchar schoolsup
        varchar famsup
        varchar paid
        timestamp created_at
        varchar schema_version
    }

    PREDICTION_RESULT {
        bigint id PK
        uuid prediction_id FK
        varchar model_id
        varchar model_version
        varchar status
        double predicted_grade
        varchar predicted_class
        varchar error_message
    }

    VERIFIED_OUTCOME {
        uuid id PK
        uuid prediction_id FK
        int actual_g3
        varchar actual_pass_status
        varchar source
        varchar verification_status
        varchar notes
        timestamp recorded_at
    }

    MODEL_REGISTRY {
        varchar model_id PK
        varchar name
        varchar family
        varchar task
        varchar version
        varchar status
        text metrics_json
        timestamp trained_at
    }
```

---

## 6. Networking, Ports & Environment Configuration

| Service Name | Port | Local Dev URL | Docker Compose DNS URL |
|---|---|---|---|
| Frontend (React) | `5173` | `http://localhost:5173` | N/A (Client Browser) |
| Backend (Spring Boot) | `8080` | `http://localhost:8080` | `http://backend:8080` |
| ML Service (FastAPI) | `8000` | `http://localhost:8000` | `http://ml-service:8000` |
| H2 Database Console | `8080` | `http://localhost:8080/h2-console` | Embedded |

### Environment Variables
- `ML_SERVICE_URL`: Base URL for internal ML inference service (default: `http://localhost:8000`, in Docker: `http://ml-service:8000`).
- `SPRING_DATASOURCE_URL`: JDBC URL for file-backed H2 (`jdbc:h2:file:./data/h2/classroom_insight;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE`).
- `VITE_API_BASE_URL`: Base URL for Spring Boot public API (default: `http://localhost:8080/api`).

---

## 7. Machine Learning Lifecycle & Boundary Rules

1. **Dataset Integrity:**
   - Raw dataset: UCI Machine Learning Repository Mathematics course (`student-mat.csv`, 395 samples).
   - Provenance: P. Cortez & A. Silva (2008), CC BY 4.0 license.
   - Initial features: `G1`, `G2`, `studytime`, `failures`, `absences`, `schoolsup`, `famsup`, `paid`.
   - Feature domain invariants: `failures` allowed domain is strictly `[0, 1, 2, 3]` matching empirical data (`4` is absent from data and rejected); `absences` allowed domain is `0` to `93` (source definition) with observed range `0` to `75` in `student-mat.csv`.
   - Disallowed: `G3` is the target; it is never included in the input feature matrix.
2. **Algorithm Families & Variants:**
   - Linear Regression (Regression only)
   - Logistic Regression (Classification only)
   - Decision Trees (Regressor & Classifier)
   - Random Forests (Regressor & Classifier)
   - Support Vector Machines (SVR & SVC)
   - K-Nearest Neighbors (KNN Regressor & KNN Classifier)
3. **Evaluation Protocol:**
   - Fixed 80/20 train/test split.
   - Preprocessing (scaling, one-hot encoding) fit exclusively on training folds/sets.
   - Cross-validation (5-fold) executed solely on the training partition.
   - Regression baseline: $G3 = G2$ and mean predictor.
   - Classification baseline: Majority-class predictor.
   - Ablation analysis: Comparison with and without socioeconomic proxy features (`schoolsup`, `famsup`, `paid`).
   - Output clipping: Documented regressor clipping policy applied consistently across evaluation and live deployment.
4. **Safety & Execution:**
   - Model artifacts serialized via `joblib` into `./ml-service/artifacts/`.
   - FastAPI loads trusted artifacts only from this designated internal directory on startup.
   - No dynamic unverified pickle deserialization from external or network sources.

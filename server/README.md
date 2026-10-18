# Classroom Insight — Application Backend (Spring Boot)

## Overview

The Spring Boot backend serves as the single public API gateway and persistence layer for the Classroom Insight system. It exposes RESTful `/api/*` endpoints to the frontend, manages the local file-backed H2 database, orchestrates upstream inference via the FastAPI ML service, and tracks historical predictions and verified educational outcomes.

## Key Principles & Invariants

1. **Sole Database Authority:** Spring Boot exclusively owns all database read and write operations.
2. **Strict Forward Proxying:** Client applications (React) only communicate with Spring Boot (`http://localhost:8080/api/*`). Direct calls to FastAPI (`http://localhost:8000`) are blocked.
3. **No Online Retraining:** Live predictions and verified outcome submissions never trigger model retraining or touch ML pipeline artifacts.
4. **Persistent History:** Historical predictions and actual outcomes are saved to file-backed H2 storage (`./data/h2/classroom_insight`), surviving application restarts and retrievable without rerunning inference.
5. **Robust Upstream Fault Tolerance:** Spring Boot applies bounded HTTP timeouts (5000 ms), supports partial comparison success, and converts upstream failures into standardized error responses without leaking internal details.

---

## Tech Stack & Dependencies

- **Java Version:** Java 25 LTS (`release 25`, OpenJDK 25.0.3)
- **Framework:** Spring Boot 3.5.16 (Spring Framework 6.2.19 with native Java 25 LTS support)
- **Modules:**
  - `spring-boot-starter-web` (REST controllers, Jackson deserialization)
  - `spring-boot-starter-data-jpa` (Hibernate ORM 6.6.53.Final, Spring Data JPA 3.5.13)
  - `spring-boot-starter-validation` (Hibernate Validator 8.0.3.Final)
  - `spring-boot-starter-actuator` (Production health & metrics)
  - `com.h2database:h2:2.3.232` (File-backed relational database)
  - `spring-boot-starter-test` (JUnit 5, Mockito 5.17.0, Byte Buddy 1.17.8, AssertJ 3.27.7)
- **Build Tool:** Apache Maven 3.9+ (includes portable `server/mvnw.cmd` wrapper)

---

## Configuration & Environment Variables

| Property | Default Value | Environment Variable Override | Purpose |
|---|---|---|---|
| `server.port` | `8080` | `PORT` / `SERVER_PORT` | Public HTTP server port |
| `spring.datasource.url` | `jdbc:h2:file:./data/h2/classroom_insight;DB_CLOSE_DELAY=-1;AUTO_SERVER=TRUE` | `SPRING_DATASOURCE_URL` | File-backed H2 JDBC connection string |
| `spring.datasource.username` | `sa` | `SPRING_DATASOURCE_USERNAME` | Database username |
| `spring.datasource.password` | *(empty)* | `SPRING_DATASOURCE_PASSWORD` | Database password |
| `classroominsight.ml.service-url` | `http://localhost:8000` | `ML_SERVICE_URL` | Upstream FastAPI ML inference service base URL |
| `classroominsight.ml.connect-timeout-ms`| `3000` | `ML_SERVICE_CONNECT_TIMEOUT_MS` | Upstream TCP connection timeout (unreachable threshold) |
| `classroominsight.ml.read-timeout-ms` | `5000` | `ML_SERVICE_TIMEOUT_MS` | Upstream HTTP read timeout (5000ms SLA threshold) |

---

## Error Mapping & Status Codes

- **HTTP 400 Bad Request:** Field validation failure or invalid model selection (e.g. unknown model ID, out-of-range features).
- **HTTP 404 Not Found:** Prediction ID or entity not found in database.
- **HTTP 409 Conflict:** Business logic conflict (e.g. duplicate outcome recording).
- **HTTP 502 Bad Gateway:** Upstream ML service returned an unhandled error or malformed payload.
- **HTTP 503 Service Unavailable (`UPSTREAM_UNAVAILABLE`):** Upstream ML service container is stopped, down, or unreachable on the network.
- **HTTP 504 Gateway Timeout (`UPSTREAM_TIMEOUT`):** Upstream ML service connected, but inference execution exceeded the 5000ms SLA.

---

## Safe H2 Database Persistence & Backup/Restore

The database is stored on the host filesystem under `./data/h2/classroom_insight.mv.db`.

### Invariants:
- **Never use `docker compose down -v`:** The `-v` flag removes volumes and will erase data if volume definitions change.
- **Preserve files during audit:** Do not delete `./data/h2/` during tests or verification.

### Backup Procedure:
```powershell
# Create timestamped backup of the database file while backend is stopped or idle
Copy-Item "./data/h2/classroom_insight.mv.db" "./data/h2/backup_classroom_insight_$(Get-Date -Format 'yyyyMMdd_HHmmss').mv.db"
```

### Restore Procedure:
```powershell
# 1. Stop backend container
docker compose stop backend

# 2. Restore database from backup file
Copy-Item "./data/h2/backup_classroom_insight_<timestamp>.mv.db" "./data/h2/classroom_insight.mv.db"

# 3. Restart backend container
docker compose start backend
```

---

## Package Structure

```
server/src/main/java/com/classroominsight/
├── ClassroomInsightApplication.java     # Spring Boot application entrypoint
├── config/
│   └── AppConfig.java                   # RestTemplate & bean configuration
├── controller/
│   ├── HealthController.java            # GET /api/health
│   ├── ModelController.java             # GET /api/models, /api/models/performance
│   └── PredictionController.java        # POST /api/predictions, GET history/detail, POST outcome
├── dto/
│   ├── AppHealthResponseDto.java        # Health response envelope
│   ├── ErrorResponseDto.java            # Standardized RFC 7807-style error envelope
│   ├── FeaturesDto.java                 # 8 canonical input features with strict range validation
│   ├── HistoryItemDto.java              # Compact history record summary
│   ├── HistoryResponseDto.java          # Paginated history search envelope
│   ├── ModelInfoDto.java                # Registered model metadata
│   ├── ModelListResponseDto.java        # Compatible model list envelope
│   ├── ModelPredictionResultDto.java    # Per-model inference result
│   ├── OutcomeRequestDto.java           # Actual outcome recording payload (actual_g3 0-20)
│   ├── OutcomeResponseDto.java          # Outcome recording response with derived pass/fail
│   ├── PerformanceResponseDto.java      # Evaluation metrics envelope
│   ├── PredictionRequestDto.java        # Single/compare inference request envelope
│   └── PredictionResponseDto.java       # Full saved prediction envelope
├── entity/
│   ├── PredictionHistory.java           # Root JPA entity for prediction records & features
│   ├── PredictionResult.java            # Child entity for per-model results (OneToMany)
│   └── VerifiedOutcome.java             # Linked entity for verified actual outcomes (OneToOne)
├── exception/
│   ├── ApiException.java                # Base application exception
│   ├── ConflictException.java           # HTTP 409 conflict (duplicate outcomes)
│   ├── GlobalExceptionHandler.java      # ControllerAdvice formatting unified error JSON
│   ├── ResourceNotFoundException.java   # HTTP 404 resource not found
│   ├── UpstreamMlServiceException.java  # HTTP 502/503/504 upstream gateway errors
│   └── ValidationException.java         # HTTP 400 validation error
├── repository/
│   ├── PredictionHistoryRepository.java # Spring Data JPA repository with JpaSpecificationExecutor
│   └── VerifiedOutcomeRepository.java   # Outcome lookup repository
└── service/
    ├── HealthService.java               # Aggregated health probe (Spring, H2, FastAPI)
    ├── MlServiceClient.java             # Bounded HTTP client communicating with FastAPI /internal/*
    └── PredictionService.java           # Orchestration, validation, transactions, outcome recording
```

---

## Build & Test Instructions

The provided `server/mvnw.cmd` wrapper is fully portable:
- Automatically respects an existing `JAVA_HOME` environment variable if defined.
- Detects Java 25 LTS in `PATH` or standard installation directories (`%ProgramFiles%\Java\jdk-25*`, `%ProgramFiles%\Eclipse Adoptium\jdk-25*`, `%ProgramFiles%\Microsoft\jdk-25*`, etc.).
- Automatically discovers Apache Maven 3.9+ from `PATH`, `MAVEN_HOME`, or standard tooling installations.

### Environment Setup (When not installed in standard directories)
```powershell
# Set JAVA_HOME pointing to your Java 25 LTS installation
$env:JAVA_HOME = "C:\Path\To\Java25-LTS"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

### Running Tests
```powershell
# Run the complete test suite (32 tests)
.\server\mvnw.cmd -f server/pom.xml clean test
```

### Packaging JAR
```powershell
# Build executable fat JAR
.\server\mvnw.cmd -f server/pom.xml clean package
```

### Running the Server
```powershell
# Launch with default properties using Java 25 LTS (port 8080, file-backed H2 at ./data/h2/)
java -jar server/target/classroom-insight-server-1.0.0.jar
```

### Live End-to-End Verification
```powershell
# With FastAPI running on port 8000 and Spring Boot on port 8080:
.\.venv\Scripts\python scripts/verify_phase3_live.py
```

# Classroom Insight — Zero-Cost Production Deployment Guide
## Vercel Hobby + Render Free + Neon Serverless PostgreSQL

This guide provides end-to-end instructions for deploying Classroom Insight to a 100% zero-cost cloud architecture using **Vercel Hobby** (Frontend), **Render Free** (Combined Spring Boot & FastAPI Web Service), and **Neon Free** (Serverless PostgreSQL Database).

---

## 1. Architecture & Security Boundary Overview

```
                      INTERNET / USER BROWSER
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│        Vercel (Hobby)        │        │      Render Web Service      │
│  React 18 + Vite SPA Client  │        │   (Unified Docker Service)   │
│                              │        │                              │
│ • Edge CDN Static Hosting    │        │ ┌──────────────────────────┐ │
│ • VITE_API_BASE_URL points   │        │ │   Spring Boot Backend    │ │
│   to Render /api             │───────>│ │   (Java 25 - Public $PORT│ │
│ • SPA rewrites via           │  CORS  │ └─────────────┬────────────┘ │
│   client/vercel.json         │ (Lock) │               │ loopback     │
└──────────────────────────────┘        │               ▼ (127.0.0.1)  │
                                        │ ┌──────────────────────────┐ │
                                        │ │  FastAPI Python ML Svc   │ │
                                        │ │  (127.0.0.1:8000 UNEXP.) │ │
                                        │ └──────────────────────────┘ │
                                        └───────────────┬──────────────┘
                                                        │ JDBC (SSL)
                                                        ▼
                                        ┌──────────────────────────────┐
                                        │    Neon Serverless Postgres  │
                                        │  (Free Tier - 0.5 GB Storage)│
                                        │                              │
                                        │ • Persistent Predictions     │
                                        │ • Verified Outcome Audit     │
                                        └──────────────────────────────┘
```

### Mandatory Invariants:
1. **Zero Public FastAPI Exposure:** The FastAPI Python ML inference process binds **strictly** to loopback `127.0.0.1:8000` inside the Render container. Render exposes only the single dynamic `$PORT` assigned to Spring Boot. No external entity can reach the internal ML service directly.
2. **CORS Security:** Spring Boot's production profile validates `CORS_ALLOWED_ORIGINS` to allow only your production Vercel domain (e.g., `https://classroom-insight.vercel.app`), preventing unauthorized cross-origin requests.
3. **Sole Database Authority:** Spring Boot exclusively owns all database reads and writes. The Python ML inference service has no database credentials or connection.
4. **Persistent History without Local Disk:** Render Free containers use ephemeral file storage. Production prediction history and audit trails are persisted exclusively in external Neon PostgreSQL.
5. **Zero-Cost & Free-Tier Quota Compliance:** Fits completely within:
   - Vercel Hobby: 100 GB bandwidth / month, unlimited deployments.
   - Render Free: 750 free instance hours / month, 512 MB RAM.
   - Neon Free: 0.5 GB storage, serverless compute with auto-suspend.

---

## 2. Environment Variables Specification

### A. Render Web Service (Spring Boot + FastAPI)

| Variable | Required | Default / Value Format | Description |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | **Yes** | `prod` | Activates production PostgreSQL profile (`application-prod.properties`) |
| `SPRING_DATASOURCE_URL` | **Yes** | `jdbc:postgresql://<neon-hostname>/neondb?sslmode=require` | Neon PostgreSQL pooled JDBC connection URL |
| `SPRING_DATASOURCE_USERNAME` | **Yes** | `<neon-username>` | Neon database user |
| `SPRING_DATASOURCE_PASSWORD` | **Yes** | `<neon-password>` | Neon database password |
| `CORS_ALLOWED_ORIGINS` | **Yes** | `https://<your-vercel-app>.vercel.app` | Comma-delimited list of allowed frontend origins |
| `ML_SERVICE_URL` | No | `http://127.0.0.1:8000` | Loopback URL to internal FastAPI service (configured in startup script) |
| `ML_SERVICE_TIMEOUT_MS` | No | `5000` | Client timeout for ML inference calls |
| `JAVA_OPTS` | No | `-Xms64m -Xmx192m -XX:+UseSerialGC -XX:MaxMetaspaceSize=112m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+ExitOnOutOfMemoryError` | Low-overhead Serial GC and bounded heap tuning for Render 512MB RAM ceiling |

### B. Vercel Project (React Frontend)

| Variable | Required | Value Format | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | **Yes** | `https://<your-render-service>.onrender.com/api` | Full URL pointing to the deployed Spring Boot backend with the `/api` path |

---

## 3. Step-by-Step Deployment Instructions

### Phase 1: Database Setup on Neon (Free Tier)

1. Sign up or log in at [https://console.neon.tech](https://console.neon.tech).
2. Click **Create Project**:
   - **Project Name:** `classroom-insight-db`
   - **Postgres Version:** 16 or 17 (recommended default)
   - **Region:** Choose the region nearest to your Render deployment region (e.g., US East / Oregon / Frankfurt).
3. In the project dashboard, select the default database (`neondb`).
4. Locate the **Connection Details** panel:
   - Select **Pooled connection** checkbox (recommended for serverless environments).
   - Under dropdown, select **JDBC**.
   - The connection string will look like:
     ```
     jdbc:postgresql://ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - Note the **Host**, **Database Name** (`neondb`), **Username**, and **Password**.
5. No schema pre-creation is needed: Spring Boot Hibernate is configured with `spring.jpa.hibernate.ddl-auto=update`, which automatically initializes the required `predictions` and `prediction_results` tables on initial startup.

---

### Phase 2: Web Service Setup on Render (Free Tier)

1. Sign up or log in at [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository: `https://github.com/sunnymehta-glitch/classroom-insight`.
4. Configure the Web Service:
   - **Name:** `classroom-insight-api` (or preferred name)
   - **Region:** Same general geographic area as your Neon database.
   - **Branch:** `main`
   - **Root Directory:** Leave empty (uses workspace root).
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `./Dockerfile`
   - **Instance Type:** `Free` (0.1 CPU, 512 MB RAM)
5. Expand the **Advanced** section:
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** `Yes`
6. Add the following **Environment Variables**:
   ```env
   SPRING_PROFILES_ACTIVE=prod
   SPRING_DATASOURCE_URL=jdbc:postgresql://<neon-hostname>/neondb?sslmode=require
   SPRING_DATASOURCE_USERNAME=<neon-username>
   SPRING_DATASOURCE_PASSWORD=<neon-password>
   CORS_ALLOWED_ORIGINS=https://classroom-insight.vercel.app,http://localhost:5173
   JAVA_OPTS=-Xms64m -Xmx192m -XX:+UseSerialGC -XX:MaxMetaspaceSize=112m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+ExitOnOutOfMemoryError
   ```
   *(Note: Replace `<neon-hostname>`, `<neon-username>`, and `<neon-password>` with your actual Neon credentials. You will update `CORS_ALLOWED_ORIGINS` after Vercel assigns your frontend URL).*
7. Click **Create Web Service**.
8. Wait for Render to build the multi-stage Docker container. Once live, Render will assign a public URL such as `https://classroom-insight-api.onrender.com`.
9. Test the backend health endpoint directly in your browser or terminal:
   ```bash
   curl https://classroom-insight-api.onrender.com/api/health
   ```
   Expected response:
   ```json
   {
     "status": "UP",
     "version": "1.0.0",
     "components": {
       "database": {
         "status": "UP",
         "type": "PostgreSQL",
         "details": "Connection valid"
       },
       "ml_service": {
         "status": "UP",
         "endpoint": "http://127.0.0.1:8000/internal/health",
         "details": "10 models loaded"
       }
     }
   }
   ```

---

### Phase 3: Frontend Deployment on Vercel (Hobby Tier)

1. Sign up or log in at [https://vercel.com](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository: `sunnymehta-glitch/classroom-insight`.
4. Configure the project:
   - **Project Name:** `classroom-insight`
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `client` (click **Continue**).
5. Build and Output Settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. Environment Variables:
   - Add **`VITE_API_BASE_URL`**:
     ```
     https://<your-render-service>.onrender.com/api
     ```
     *(Example: `https://classroom-insight-api.onrender.com/api`)*
7. Click **Deploy**.
8. Vercel will install dependencies, build the TypeScript bundle, and publish the static assets with client-side SPA routing governed by `client/vercel.json`.
9. Once deployed, Vercel displays your production domain:
   `https://classroom-insight.vercel.app` (or similar).

---

### Phase 4: Final CORS Origin Reconciliation

1. Copy your assigned Vercel URL (e.g., `https://classroom-insight.vercel.app`).
2. Return to the [Render Dashboard](https://dashboard.render.com) $\rightarrow$ Your `classroom-insight-api` service $\rightarrow$ **Environment**.
3. Update `CORS_ALLOWED_ORIGINS`:
   ```env
   CORS_ALLOWED_ORIGINS=https://classroom-insight.vercel.app
   ```
4. Click **Save Changes**. Render will automatically redeploy with the updated CORS policy.

---

## 4. Free-Tier Operational Characteristics

### 1. Cold Starts & Inactivity Suspension
- **Render Free Web Service:** Automatically spins down after 15 minutes of inactivity. When a new user accesses the Vercel frontend and initiates an API request, Render wakes the container. The initial request experiences a **40–60 second cold start** while Docker starts up, FastAPI initializes scikit-learn models, and Spring Boot boots. Subsequent requests respond within normal milliseconds.
- **Neon Serverless PostgreSQL:** Neon auto-suspends compute when idle for 5 minutes. Neon's cold start is ultra-fast (~500ms) and resumes seamlessly upon Spring Boot's incoming JDBC query.

### 2. Memory Footprint Management (512 MB Budget)
Render Free provides 512 MB RAM. Memory is strictly conserved using:
- Single-threaded OpenBLAS/OMP/MKL native linear algebra and `MALLOC_ARENA_MAX=2`.
- Low-overhead Java Serial GC (`-XX:+UseSerialGC`) eliminating G1 concurrent thread stacks and card table memory.
- Bounded heap (`-Xms64m -Xmx192m`), stack (`-Xss512k`), and Tomcat worker threads (`max=10`).
- Total container footprint: ~330–370 MB, providing ample headroom (> 140 MB buffer) below the 512 MB cgroup threshold.

---

## 5. Verification Checklist

After deployment, perform these verification steps:
1. **Frontend Landing:** Open `https://<your-app>.vercel.app`. Verify that the dashboard loads and displays:
   - Model cards with canonical test metrics (`MAE: 1.1154`, `RMSE: 1.7787`, `R²: 0.8425`).
   - System Health badge showing `Healthy`.
2. **SPA Client Routing:** Refresh the browser while on `/predict`, `/history`, and `/performance`. Verify that Vercel serves the page without HTTP 404.
3. **Single Prediction Flow:** Navigate to `/predict`, submit a student record with `studytime=3`, `G1=14`, `G2=15`. Verify prediction result renders immediately and provides estimated `G3`.
4. **Persistence in Neon:** Navigate to `/history`. Verify that the submitted prediction record appears in the history table.
5. **Outcome Recording:** Open the prediction result, enter verified final grade `15`, and submit. Verify that status updates to `Pass (G3=15)` and duplicate submission is blocked.

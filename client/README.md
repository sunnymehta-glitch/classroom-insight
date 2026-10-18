# Classroom Insight — React Frontend

This directory contains the presentation tier for Classroom Insight, built with React 18, TypeScript, Vite, Tailwind CSS, React Router 6, and Recharts.

---

## 1. Overview & Architecture

The frontend provides an accessible, responsive single-page application (SPA) structured across five primary screens:
1. **Overview (`/`):** Dashboard displaying live system health, dynamic candidate model cards with canonical held-out test metrics, recent prediction feed, and dataset provenance/limitations disclosure.
2. **New Prediction (`/predict`):** Form interface for submitting student academic features (`G1`, `G2`, `studytime`, `failures`, `absences`, `schoolsup`, `famsup`, `paid`). Supports both **Single Model** and **Model Comparison** modes for regression or classification.
3. **Results (`/results/:id`):** Displays computed model predictions, score boundaries, model version metadata, submitted feature summary, and actual outcome recording.
4. **Prediction History (`/history`):** Searchable, paginated audit log of all persisted predictions and recorded outcomes stored in the H2 database. Allows reopening past predictions without re-triggering ML inference.
5. **Model Performance (`/performance`):** Offline evaluation report visualizer presenting genuine held-out test metrics (MAE, RMSE, R² for regression; accuracy, precision, recall, macro F1, and confusion matrices for classification) alongside 5-fold cross-validation statistics.

### Architectural Boundary Invariants
- **Public API Gateway:** The frontend communicates **exclusively** with the Spring Boot application backend (`/api/*`). It never connects directly to the internal Python FastAPI ML service.
- **Reverse Proxy:** In local development, the Vite dev server proxies `/api/*` requests to Spring Boot (`http://localhost:8080`). In Docker Compose, Nginx serves the production build on port 5173 and reverse-proxies `/api/*` to `http://backend:8080/api/`.

---

## 2. Tech Stack & Dependencies

- **Framework:** React 18.3.1
- **Language:** TypeScript 5.6.3 (Strict Type Checking)
- **Build Tool:** Vite 6.0.1
- **Styling:** Tailwind CSS 3.4.16 with curated purple/indigo/lavender palette (`#6855F5`, `#1D1754`, `#F6F5FD`, etc.)
- **Data Visualization:** Recharts 2.15.0 (Bar charts, responsive containers, accessible data labels)
- **Icons:** Lucide React 0.468.0
- **Routing:** React Router DOM 6.28.0
- **Testing:** Vitest 2.1.8 with `@testing-library/react` and `jsdom`

---

## 3. Local Development & Build Commands

### Prerequisites
- Node.js 18+ or 20+ LTS
- npm 9+ or 10+

### Setup & Installation
```bash
cd client
npm install
```

### Running Locally with Hot Reload
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173/`.

### Running Unit & Screen Component Tests
```bash
npm test
```
Executes all 7 Vitest test suites (20 tests) covering screen rendering, navigation, range validation, error states, and API client contracts.

### Production Build & Typecheck
```bash
npm run build
```
Runs `tsc` for TypeScript type verification followed by `vite build` to output the minified production assets into `client/dist/`.

---

## 4. Accessibility & Design System

- **Keyboard Navigation:** Full tab-order navigation across all navigation links, buttons, form controls, and modal dialogs.
- **Focus Indicators:** High-contrast focus rings (`focus:ring-2 focus:ring-primary focus:outline-none`) on all interactive elements.
- **Accessible Color Contrast:** Form labels (`#242132`), secondary text (`#625C78`), and action buttons meet WCAG 2.1 AA contrast requirements against background canvas (`#F6F5FD`) and card containers (`#FFFFFF`).
- **Semantic HTML & ARIA:** Proper `<h1>` through `<h3>` heading hierarchies, `role="radiogroup"` for task selectors, `aria-label` tags on tables and icons, and `aria-hidden="true"` on decorative icons.
- **Status Badges:** All state indicators combine descriptive text labels with distinct icons and colors, never relying on color alone.

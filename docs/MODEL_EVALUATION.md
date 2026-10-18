f# Classroom Insight — Model Training and Evaluation Report

**Document:** `docs/MODEL_EVALUATION.md`  
**Version:** 1.1.0 (Reconciled)  
**Status:** Canonical & Phase 1 Verified  
**Date Generated:** 17 October 2026  
**Source Dataset:** UCI Student Performance — Mathematics (`data/student-mat.csv`, SHA256: `e47f9ee225e1ee6e69b7564e6dac7123e80b8486677fe111f351964cef5dec80`)  
**Feature Schema Version:** `1.0.0` (from `docs/feature_schema.json`)  
**Random Seed:** 42  

---

## 1. Executive Summary & Model Selection Protocol

Phase 1 establishes a reproducible, offline machine-learning pipeline for Classroom Insight. Ten task-appropriate models across six algorithm families were trained and cross-validated on the training partition ($N=316$), then evaluated on an untouched held-out test partition ($N=79$).

### Methodological Rule: Pre-Specified Training CV Selection
In accordance with rigorous statistical practice and Section 2.5 of [`CLASSROOM_INSIGHT_FINAL_MASTER_PLAN.md`](file:///c:/Users/sunny%20kumar/OneDrive/Desktop/ML%20Project/CLASSROOM_INSIGHT_FINAL_MASTER_PLAN.md):
- **Model selection is decided exclusively by cross-validation on the training partition.**
- The held-out test set ($N=79$) was **never used for model selection, feature selection, or tuning**. Held-out test metrics serve strictly as an independent final performance evaluation.

### Selected Primary Candidates
1. **Primary Classification Candidate:** **`random_forest_classifier`**
   - **Selection Metric:** Mean 5-Fold Stratified CV Macro $F_1$ on training partition (**0.9258**).
   - **Secondary Comparison & Supporting Metrics:** Training CV Accuracy (**93.36%**), Training CV Fail-Class Recall (**92.29%**). Training CV Macro $F_1$ is the sole selection criterion; accuracy and fail-class recall serve as secondary comparison metrics and pedagogical diagnostics.
   - *Distinction from Test Performance:* On the held-out test set ($N=79$), `logistic_regression` achieved $88.61\%$ accuracy (70/79 correct) compared to $87.34\%$ (69/79 correct) for Random Forest. However, Logistic Regression had lower training CV Macro $F_1$ ($0.9032$ vs $0.9258$) and notably lower CV Fail Recall ($85.52\%$ vs $92.29\%$). Because model selection is governed strictly by training CV Macro $F_1$, Random Forest is the confirmed primary candidate.
2. **Primary Regression Candidate:** **`random_forest_regressor`**
   - **Selection Metric:** Lowest mean 5-Fold CV MAE on training partition among the five fitted ML regressors ($\text{CV MAE} = \mathbf{0.9690}$, $\text{CV RMSE} = \mathbf{1.5740}$, $\text{CV } R^2 = \mathbf{0.8734}$).
   - **Benchmark Baseline Scope & Trade-Off Disclosure:** The non-parametric heuristic rule $G3 = G2$ is a benchmark baseline, not one of the six fitted ML algorithm families. The heuristic baseline achieves a slightly lower training CV MAE ($0.9279$ vs $0.9690$) and a slightly lower test MAE ($1.1013$ vs $1.1154$). Random Forest does not beat the heuristic baseline on MAE. However, Random Forest achieves substantially lower RMSE ($1.5740$ vs $1.9902$ on CV; $1.7787$ vs $2.0531$ on test, approximately $13.4\%$ lower test RMSE, corresponding to a $24.9\%$ lower test MSE from $4.2152$ to $3.1638$) and higher variance explained ($R^2 = 0.8734$ vs $0.8011$ on CV; $0.8425$ vs $0.7901$ on test). Random Forest is designated the selected primary regression candidate because its CV MAE is the lowest among the five trained ML regressors, and it provides vital quadratic error control against catastrophic grade mispredictions.

---

## 2. Experimental Setup & Partitioning

### 2.1 Partition Strategy
- **Total Instances:** 395 student instances, 33 columns, 0 missing values.
- **Partition Ratio:** 80% train ($N=316$) / 20% held-out test ($N=79$), with `random_state=42`.
- **Stratification:** Stratified on `pass_status` (`G3 >= 10 ? "pass" : "fail"`), ensuring consistent class proportions:
  - **Full Dataset:** 265 Pass (67.09%), 130 Fail (32.91%)
  - **Train Partition (316):** 212 Pass (67.09%), 104 Fail (32.91%)
  - **Test Partition (79):** 53 Pass (67.09%), 26 Fail (32.91%)
- **Data Leakage Guarantee:** The targets `G3` and `pass_status` were removed from feature matrices prior to preprocessing. Zero target leakage exists.

### 2.2 Feature Preprocessing in Pipelines
Preprocessing steps were encapsulated entirely inside scikit-learn `Pipeline` objects to prevent data leakage across CV folds:
- **Numeric Features (`G1`, `G2`, `studytime`, `failures`, `absences`):** Scaled via `StandardScaler()` for linear, logistic, SVM, and KNN models; unscaled (`passthrough`) for tree-based models.
- **Categorical Features (`schoolsup`, `famsup`, `paid`):** Binary encoded via `OneHotEncoder(drop="first", categories=[["no", "yes"], ...])`.
- **Domain Invariant for `failures`:** Allowed values strictly locked to `[0, 1, 2, 3]`. Category `4` is absent from data and rejected.

---

## 3. Classification Models & Baseline Comparisons

**Target:** `pass_status` (`pass` if $G3 \ge 10$, else `fail`).  
**Primary Selection Criterion:** Mean 5-Fold Stratified Cross-Validation Macro $F_1$ on training partition (CV accuracy and fail-class recall serve as secondary comparison metrics and supporting diagnostics).

### 3.1 5-Fold Cross-Validation on Training Partition ($N = 316$)

| Model ID | Algorithm Family | CV Macro $F_1$ (Primary) | CV Accuracy | CV Fail Recall | CV Fail Precision | CV Pass Recall |
|---|---|---|---|---|---|---|
| **`random_forest_classifier`** | **Random Forest** | **$0.9258 \pm 0.012$** | **$93.36\% \pm 0.012$** | **$0.9229 \pm 0.024$** | $0.8828 \pm 0.032$ | $0.9385 \pm 0.019$ |
| `decision_tree_classifier` | Decision Tree | $0.9229 \pm 0.023$ | $93.04\% \pm 0.022$ | $0.9324 \pm 0.025$ | $0.8695 \pm 0.049$ | $0.9290 \pm 0.030$ |
| `logistic_regression` | Logistic Regression | $0.9032 \pm 0.041$ | $91.45\% \pm 0.038$ | $0.8552 \pm 0.033$ | $0.8913 \pm 0.093$ | $0.9431 \pm 0.054$ |
| `svc` | SVM (RBF Kernel) | $0.8787 \pm 0.068$ | $89.23\% \pm 0.065$ | $0.8171 \pm 0.047$ | $0.8714 \pm 0.140$ | $0.9287 \pm 0.084$ |
| `knn_classifier` | KNN ($k=5$, distance) | $0.8639 \pm 0.052$ | $87.97\% \pm 0.051$ | $0.7981 \pm 0.035$ | $0.8493 \pm 0.123$ | $0.9194 \pm 0.073$ |

### 3.2 Held-Out Test Evaluation ($N = 79$) & Baselines

| Model / Benchmark | Test Accuracy | Macro Precision | Macro Recall | Macro $F_1$ | Fail Recall | Pass Recall | Confusion Matrix [TN, FP, FN, TP] |
|---|---|---|---|---|---|---|---|
| **`random_forest_classifier` (Selected)** | **87.34%** | 0.8537 | 0.8861 | **0.8638** | **0.9231** | 0.8491 | $[24, 2, 8, 45]$ |
| `decision_tree_classifier` | 87.34% | 0.8565 | 0.8959 | 0.8656 | 0.9615 | 0.8302 | $[25, 1, 9, 44]$ |
| `logistic_regression` | 88.61% | 0.8666 | 0.8857 | 0.8745 | 0.8846 | 0.8868 | $[23, 3, 6, 47]$ |
| `knn_classifier` | 84.81% | 0.8354 | 0.8284 | 0.8244 | 0.7308 | 0.9057 | $[19, 7, 5, 48]$ |
| `svc` | 83.54% | 0.8121 | 0.8284 | 0.8187 | 0.8077 | 0.8491 | $[21, 5, 8, 45]$ |
| **Majority Baseline ("pass")** | 67.09% | 0.3354 | 0.5000 | 0.4015 | 0.0000 | 1.0000 | $[0, 26, 0, 53]$ |

### 3.3 Pedagogical Importance of Fail-Class Recall
In an educational setting, failing to identify a student who will fail (a False Pass / False Negative) carries a high pedagogical cost because it prevents timely intervention.  
- `random_forest_classifier` achieved a high CV Fail Recall of **$92.29\%$** and captured **$24$ of $26$ true fails ($92.31\%$)** on the test set, with only $2$ false positives.
- `logistic_regression` exhibited a lower CV Fail Recall ($85.52\%$), missing nearly $15\%$ of failing students during training validation.

---

## 4. Regression Models & Baseline Comparisons

**Target:** `G3` (Numeric Grade, 0–20 scale).  
**Deployed Output Policy:** Predicted grades clipped to $[0.0, 20.0]$.

### 4.1 5-Fold Cross-Validation on Training Partition ($N = 316$)

| Model ID | Algorithm Family | CV MAE (Primary) | CV RMSE | CV $R^2$ |
|---|---|---|---|---|
| **`random_forest_regressor`** | **Random Forest** | **$0.9690 \pm 0.128$** | **$1.5740 \pm 0.241$** | **$0.8734 \pm 0.047$** |
| `decision_tree_regressor` | Decision Tree | $1.0332 \pm 0.203$ | $1.9038 \pm 0.422$ | $0.8033 \pm 0.102$ |
| `linear_regression` | Linear Regression | $1.1912 \pm 0.066$ | $1.9122 \pm 0.168$ | $0.8175 \pm 0.053$ |
| `svr` | SVM (RBF Kernel) | $1.2548 \pm 0.082$ | $2.0520 \pm 0.178$ | $0.7936 \pm 0.041$ |
| `knn_regressor` | KNN ($k=5$, distance) | $1.4275 \pm 0.166$ | $2.1480 \pm 0.280$ | $0.7690 \pm 0.074$ |
| *Benchmark Baseline ($G3 = G2$)* | Direct $G2$ assignment (Non-ML Benchmark) | $0.9279 \pm 0.101$ | $1.9902 \pm 0.245$ | $0.8011 \pm 0.045$ |

> [!NOTE]
> **Candidate Pool and Scope:** Model selection is conducted across the five fitted ML regressors. The non-parametric rule $G3 = G2$ serves as a benchmark baseline, not a trained ML algorithm family. Random Forest achieves the lowest CV MAE (0.9690) among the five fitted ML regressors.

### 4.2 Held-Out Test Evaluation ($N = 79$) & Trade-Off Analysis

| Model / Benchmark | Test MAE (Clipped) | Test RMSE (Clipped) | Test $R^2$ (Clipped) | Test $R^2$ (Raw) |
|---|---|---|---|---|
| **`random_forest_regressor` (Selected)** | 1.1154 | **1.7787** | **0.8425** | **0.8425** |
| `decision_tree_regressor` | 1.1302 | 1.8757 | 0.8248 | 0.8248 |
| `svr` | 1.2420 | 2.0213 | 0.7966 | 0.7966 |
| `linear_regression` | 1.3129 | 2.0382 | 0.7931 | 0.7928 |
| `knn_regressor` | 1.4426 | 2.2165 | 0.7554 | 0.7554 |
| **Benchmark Baseline ($G3 = G2$)** | **1.1013** | 2.0531 | 0.7901 | 0.7901 |
| **$G2$-Only Linear Model** | 1.2513 | 2.0223 | 0.7964 | 0.7936 |

### Honest Baseline Trade-Off Analysis
- **Absolute Error (MAE):** The heuristic benchmark baseline $G3 = G2$ achieves a slightly lower MAE both in training CV ($0.9279$ vs $0.9690$) and on the held-out test partition ($1.1013$ vs $1.1154$). Random Forest does not beat the heuristic baseline on MAE.
- **Large Error Control (RMSE & $R^2$):** Random Forest achieves significantly lower CV RMSE ($1.5740$ vs $1.9902$), lower test RMSE ($1.7787$ vs $2.0531$, approximately $13.4\%$ lower test RMSE, corresponding to a $24.9\%$ lower test MSE from $4.2152$ to $3.1638$), higher CV $R^2$ ($0.8734$ vs $0.8011$), and higher test $R^2$ ($0.8425$ vs $0.7901$).
- **Selection Decision:** Random Forest is selected as the primary regression ML candidate because it achieves the lowest mean CV MAE among the five fitted ML algorithms and substantially curbs large disastrous errors, while the benchmark baseline's superior absolute error is explicitly acknowledged. The primary selection metric was pre-specified on training CV and was not altered after inspecting test results.

---

## 5. Support-Feature Ablation Analysis

The master plan mandates an ablation study evaluating the predictive contribution of the three external support features: `schoolsup` (school support), `famsup` (family educational support), and `paid` (extra paid classes).

### Configuration & Estimators
- **Estimator (Regressor):** `RandomForestRegressor(n_estimators=100, max_depth=5, min_samples_split=4, random_state=42, unscaled passthrough)`
- **Estimator (Classifier):** `RandomForestClassifier(n_estimators=100, max_depth=5, min_samples_split=4, random_state=42, unscaled passthrough)`
- **Full Feature Set (8):** `["G1", "G2", "studytime", "failures", "absences", "schoolsup", "famsup", "paid"]`
- **Ablated Feature Set (5):** `["G1", "G2", "studytime", "failures", "absences"]`

### Cross-Validation & Test Results Comparison

| Pipeline Variant | 5-Fold CV $R^2$ | 5-Fold CV MAE | Test MAE (Clipped) | Test RMSE | Test $R^2$ |
|---|---|---|---|---|---|
| **Full Features (8)** | $0.8734 \pm 0.047$ | $0.9690 \pm 0.128$ | 1.1154 | 1.7787 | 0.8425 |
| **Ablated Features (5)** | $0.8793 \pm 0.051$ | $0.9433 \pm 0.143$ | 1.0737 | 1.7073 | 0.8549 |

| Classification Variant | 5-Fold CV Macro $F_1$ | 5-Fold CV Accuracy | Test Accuracy | Test Macro $F_1$ | Test Fail Recall |
|---|---|---|---|---|---|
| **Full Features (8)** | **$0.9258 \pm 0.012$** | **$93.36\% \pm 0.012$** | 87.34% | 0.8638 | **0.9231** ($24/26$) |
| **Ablated Features (5)** | $0.9187 \pm 0.017$ | $92.72\% \pm 0.016$ | 88.61% | 0.8765 | 0.9231 ($24/26$) |

### Methodological Observations
1. **Regression Diagnostic Comparison:** For regression, cross-validation did **not** prefer the full-feature regression model based on $R^2$. The ablated 5-feature model achieved a numerically higher CV $R^2$ ($0.8793$ vs $0.8734$, a difference of $+0.0059$) and lower CV MAE ($0.9433$ vs $0.9690$). This ablation is conducted strictly as an offline diagnostic comparison, not a justification for modifying the input schema.
2. **Small Magnitude and Statistical Non-Significance:** The reported difference of $+0.0059$ in CV $R^2$ is very small and well within the cross-validation fold standard deviation ($\pm 0.047$ for full, $\pm 0.051$ for ablated). It is not sufficient on its own to establish meaningful superiority.
3. **Approved Schema Retention:** The approved 8-feature contract (`G1, G2, studytime, failures, absences, schoolsup, famsup, paid`) is retained for the MVP in strict compliance with `CLASSROOM_INSIGHT_FINAL_MASTER_PLAN.md`. This maintains pedagogical completeness, teacher interface symmetry across regression and classification tasks, and user expectations.
4. **Classification Decision via CV:** For classification, the full 8-feature Random Forest model outperformed the ablated model on the training partition cross-validation, achieving higher mean Macro $F_1$ ($0.9258$ vs $0.9187$) and higher Accuracy ($93.36\%$ vs $92.72\%$).
5. **Caveat on Equity and Systemic Bias:** The modest statistical contribution of the support features in this dataset ($N=395$) does not alone prove or disprove systemic bias or socioeconomic equity effects in educational attainment.
6. **No Test Peeking Guarantee:** Neither feature-set selection nor hyperparameter tuning was performed by repeatedly inspecting held-out test data. Model candidate evaluation remains strictly anchored on training-fold cross-validation.

---

## 6. Neutral Investigation & Sensitivity Analysis: $G3 = 0$ Records

In `student-mat.csv`, exactly **38 students (9.62%)** have a recorded final grade of $G3 = 0$.

### Contextual Understanding
In secondary school mathematics courses, a recorded final score of zero may arise from several distinct factors:
- Absence or non-attendance during the final examination.
- Administrative withdrawal or dropout prior to the end-of-term assessment.
- Disciplinary penalty or examination disqualification.
- Obtaining zero points on the examination itself.

The UCI dataset does **not supply individual ground-truth attendance or completion flags**. Therefore, it is scientifically unsound to label all 38 cases as dropouts without evidence. We treat them neutrally as recorded $G3 = 0$ outcomes and examine model behavior with and without them.

### Sensitivity Comparison

| Dataset Population | Total $N$ | Train $N$ | Test $N$ | Linear Regression Test $R^2$ | Random Forest Test $R^2$ | Random Forest Test RMSE |
|---|---|---|---|---|---|---|
| **Primary (Includes $G3=0$)** | 395 | 316 | 79 | 0.7931 | 0.8425 | 1.7787 |
| **Non-Zero Subset ($G3 > 0$)** | 357 | 285 | 72 | **0.9234** | **0.9292** | **0.8808** |

### Policy Decision & Disclosure
- **Primary Production Models:** Retain the full dataset ($N=395$, including $G3=0$). Teachers using Classroom Insight need risk alerts when students are on track for zero marks or exam non-completion.
- **Interpretation Disclosure:** When $G3 = 0$ records are excluded, model RMSE drops by more than $50\%$ (from $1.78$ to $0.88$) and $R^2$ rises to $0.93$. This indicates that model residual errors in the primary pipeline are heavily concentrated in sudden zero-grade events rather than gradual grading variance.

---

## 7. Artifact Manifest & Verification

All ten models are saved as self-contained `.joblib` pipelines in [`ml-service/artifacts/`](file:///c:/Users/sunny%20kumar/OneDrive/Desktop/ML%20Project/ml-service/artifacts):

| Model ID | File Name | Size | Architecture | Primary Candidate? |
|---|---|---|---|---|
| `random_forest_regressor` | `random_forest_regressor.joblib` | 428.6 KB | `Passthrough` + `OneHot` + `RandomForestRegressor` | **YES (Regression)** |
| `linear_regression` | `linear_regression.joblib` | 4.6 KB | `StandardScaler` + `OneHot` + `LinearRegression` | No |
| `decision_tree_regressor` | `decision_tree_regressor.joblib` | 7.0 KB | `Passthrough` + `OneHot` + `DecisionTreeRegressor` | No |
| `svr` | `svr.joblib` | 26.4 KB | `StandardScaler` + `OneHot` + `SVR(kernel='rbf')` | No |
| `knn_regressor` | `knn_regressor.joblib` | 53.1 KB | `StandardScaler` + `OneHot` + `KNeighborsRegressor` | No |
| `random_forest_classifier` | `random_forest_classifier.joblib` | 307.4 KB | `Passthrough` + `OneHot` + `RandomForestClassifier` | **YES (Classification)** |
| `decision_tree_classifier` | `decision_tree_classifier.joblib` | 6.4 KB | `Passthrough` + `OneHot` + `DecisionTreeClassifier` | No |
| `logistic_regression` | `logistic_regression.joblib` | 5.1 KB | `StandardScaler` + `OneHot` + `LogisticRegression` | No |
| `svc` | `svc.joblib` | 15.3 KB | `StandardScaler` + `OneHot` + `SVC(kernel='rbf')` | No |
| `knn_classifier` | `knn_classifier.joblib` | 53.5 KB | `StandardScaler` + `OneHot` + `KNeighborsClassifier` | No |

---

## 8. Academic Disclosures & Boundaries

1. **Regional Context:** The dataset reflects secondary school students from Portugal (2008). Models are academic demonstration prototypes and are **not validated for Indian educational institutions**.
2. **Pass Convention:** The pass threshold $G3 \ge 10$ is based on Portuguese secondary education conventions and does not reflect Indian grading systems (CBSE/ICSE).
3. **Late-Stage Estimation:** Because $G1$ and $G2$ are mandatory inputs, predictions represent late-stage trajectory estimates, not early-warning assessments.
4. **Advisory Use Only:** Predictions must never be treated as automated high-stakes assessment decisions.

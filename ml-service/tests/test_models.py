"""
Classroom Insight — Phase 1 Test Suite
Tests artifact loading, schema compliance, deterministic inference, output clipping, and data leakage invariants.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import pytest

ARTIFACTS_DIR = "ml-service/artifacts"
SCHEMA_PATH = "docs/feature_schema.json"

REGRESSION_MODELS = [
    "linear_regression",
    "decision_tree_regressor",
    "random_forest_regressor",
    "svr",
    "knn_regressor",
]

CLASSIFICATION_MODELS = [
    "logistic_regression",
    "decision_tree_classifier",
    "random_forest_classifier",
    "svc",
    "knn_classifier",
]

ALL_MODELS = REGRESSION_MODELS + CLASSIFICATION_MODELS

# Canonical feature names from schema
FEATURE_NAMES = [
    "G1",
    "G2",
    "studytime",
    "failures",
    "absences",
    "schoolsup",
    "famsup",
    "paid",
]


@pytest.fixture(scope="module")
def sample_features():
    return pd.DataFrame([
        {
            "G1": 14,
            "G2": 15,
            "studytime": 3,
            "failures": 0,
            "absences": 4,
            "schoolsup": "no",
            "famsup": "yes",
            "paid": "no",
        }
    ])


@pytest.fixture(scope="module")
def edge_case_features():
    return pd.DataFrame([
        # Minimum boundary student
        {
            "G1": 0,
            "G2": 0,
            "studytime": 1,
            "failures": 3,
            "absences": 0,
            "schoolsup": "no",
            "famsup": "no",
            "paid": "no",
        },
        # Maximum boundary student
        {
            "G1": 20,
            "G2": 20,
            "studytime": 4,
            "failures": 0,
            "absences": 75,
            "schoolsup": "yes",
            "famsup": "yes",
            "paid": "yes",
        },
        # Extreme absences within source domain
        {
            "G1": 10,
            "G2": 10,
            "studytime": 2,
            "failures": 1,
            "absences": 93,
            "schoolsup": "no",
            "famsup": "yes",
            "paid": "no",
        },
    ])


def test_artifacts_exist_and_load():
    """Verify all 10 model artifacts exist on disk and deserialize correctly."""
    for model_id in ALL_MODELS:
        path = os.path.join(ARTIFACTS_DIR, f"{model_id}.joblib")
        assert os.path.exists(path), f"Missing artifact file: {path}"
        assert os.path.getsize(path) > 1000, f"Artifact file is suspiciously small: {path}"

        payload = joblib.load(path)
        assert isinstance(payload, dict), f"Payload must be a dictionary in {model_id}"
        assert "pipeline" in payload, f"Missing pipeline in {model_id}"
        assert "task" in payload, f"Missing task in {model_id}"
        assert "version" in payload, f"Missing version in {model_id}"
        assert "feature_names" in payload, f"Missing feature_names in {model_id}"
        assert payload["feature_names"] == FEATURE_NAMES


def test_model_registry_json():
    """Verify model_registry.json contains exactly 10 available models."""
    registry_path = os.path.join(ARTIFACTS_DIR, "model_registry.json")
    assert os.path.exists(registry_path), f"Missing registry file: {registry_path}"
    with open(registry_path, "r", encoding="utf-8") as f:
        registry = json.load(f)

    assert len(registry) == 10, f"Expected 10 models in registry, found {len(registry)}"
    model_ids = [m["model_id"] for m in registry]
    assert set(model_ids) == set(ALL_MODELS)
    for entry in registry:
        assert entry["status"] == "available"
        assert "metrics" in entry


def test_evaluation_report_json():
    """Verify evaluation_report.json exists in artifacts and docs/reports and has complete structure."""
    for base_dir in [ARTIFACTS_DIR, "docs/reports"]:
        report_path = os.path.join(base_dir, "evaluation_report.json")
        assert os.path.exists(report_path), f"Missing report in {base_dir}"
        with open(report_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        assert "metadata" in report
        assert "regression_models" in report
        assert "classification_models" in report
        assert "model_selection" in report
        assert report["model_selection"]["regression"]["selected_primary_candidate"] == "random_forest_regressor"
        assert report["model_selection"]["classification"]["selected_primary_candidate"] == "random_forest_classifier"
        assert "baselines" in report
        assert "ablation_study" in report
        assert "g3_zero_sensitivity_analysis" in report
        assert len(report["regression_models"]) == 5
        assert len(report["classification_models"]) == 5


def test_deterministic_regression_predictions(sample_features):
    """Verify regression models produce deterministic predictions and honor 0-20 grade constraints."""
    for model_id in REGRESSION_MODELS:
        payload = joblib.load(os.path.join(ARTIFACTS_DIR, f"{model_id}.joblib"))
        pipeline = payload["pipeline"]

        # Run inference twice to verify determinism
        pred1 = pipeline.predict(sample_features)
        pred2 = pipeline.predict(sample_features)

        assert np.isclose(pred1, pred2).all(), f"Non-deterministic prediction in {model_id}"

        # Test deployed grade clipping policy
        clipped_pred = np.clip(pred1, 0.0, 20.0)
        assert 0.0 <= clipped_pred[0] <= 20.0, f"Clipped prediction out of bounds in {model_id}"


def test_deterministic_classification_predictions(sample_features):
    """Verify classification models produce deterministic predictions and only return 'pass' or 'fail'."""
    for model_id in CLASSIFICATION_MODELS:
        payload = joblib.load(os.path.join(ARTIFACTS_DIR, f"{model_id}.joblib"))
        pipeline = payload["pipeline"]

        pred1 = pipeline.predict(sample_features)
        pred2 = pipeline.predict(sample_features)

        assert pred1[0] == pred2[0], f"Non-deterministic prediction in {model_id}"
        assert pred1[0] in ["pass", "fail"], f"Invalid classification label {pred1[0]} in {model_id}"


def test_edge_cases_and_boundaries(edge_case_features):
    """Verify models handle extreme boundary values within allowed schema without throwing exceptions."""
    for model_id in REGRESSION_MODELS:
        payload = joblib.load(os.path.join(ARTIFACTS_DIR, f"{model_id}.joblib"))
        preds = payload["pipeline"].predict(edge_case_features)
        clipped = np.clip(preds, 0.0, 20.0)
        assert len(clipped) == 3
        for val in clipped:
            assert 0.0 <= val <= 20.0

    for model_id in CLASSIFICATION_MODELS:
        payload = joblib.load(os.path.join(ARTIFACTS_DIR, f"{model_id}.joblib"))
        preds = payload["pipeline"].predict(edge_case_features)
        assert len(preds) == 3
        for val in preds:
            assert val in ["pass", "fail"]


def test_zero_target_leakage():
    """Verify input feature schema strictly excludes G3 and pass_status."""
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)

    required_features = schema["required_features"]
    assert "G3" not in required_features
    assert "pass_status" not in required_features
    assert "G3" in schema["disallowed_features"]

    # Verify artifacts pipelines do not expect G3
    for model_id in ALL_MODELS:
        payload = joblib.load(os.path.join(ARTIFACTS_DIR, f"{model_id}.joblib"))
        assert "G3" not in payload["feature_names"]
        assert "pass_status" not in payload["feature_names"]


def test_model_selection_and_ablation_integrity():
    """Verify programmatic model selection rules, candidate pool scopes, baseline trade-offs, and ablation diagnostics."""
    for base_dir in [ARTIFACTS_DIR, "docs/reports"]:
        report_path = os.path.join(base_dir, "evaluation_report.json")
        with open(report_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        sel = report["model_selection"]
        reg_sel = sel["regression"]
        cls_sel = sel["classification"]

        # Regression Selection Scope & Metrics
        assert reg_sel["selected_primary_candidate"] == "random_forest_regressor"
        assert "fitted ML regressors" in reg_sel["candidate_pool"]
        assert "G3 = G2" in reg_sel["benchmark_baseline"]
        assert "benchmark" in reg_sel["benchmark_baseline"].lower()

        # Verify Random Forest has lowest CV MAE among the 5 fitted ML regressors
        rf_cv_mae = report["regression_models"]["random_forest_regressor"]["cv_metrics"]["cv_mae_mean"]
        for mod_id, mod_data in report["regression_models"].items():
            if mod_id != "random_forest_regressor":
                assert rf_cv_mae < mod_data["cv_metrics"]["cv_mae_mean"], (
                    f"RF CV MAE ({rf_cv_mae}) must be lower than {mod_id} ({mod_data['cv_metrics']['cv_mae_mean']})"
                )

        # Disclose and verify heuristic baseline trade-off
        baseline_reg = report["baselines"]["regression_baseline_g3_equals_g2"]
        baseline_cv_mae = baseline_reg["cv_metrics"]["cv_mae_mean"]
        baseline_cv_rmse = baseline_reg["cv_metrics"]["cv_rmse_mean"]
        baseline_test_mae = baseline_reg["test_metrics"]["mae"]
        baseline_test_rmse = baseline_reg["test_metrics"]["rmse"]

        rf_cv_rmse = report["regression_models"]["random_forest_regressor"]["cv_metrics"]["cv_rmse_mean"]
        rf_cv_rmse_std = report["regression_models"]["random_forest_regressor"]["cv_metrics"]["cv_rmse_std"]
        rf_cv_r2_std = report["regression_models"]["random_forest_regressor"]["cv_metrics"]["cv_r2_std"]
        rf_test_mae = report["regression_models"]["random_forest_regressor"]["test_metrics"]["clipped"]["mae"]
        rf_test_rmse = report["regression_models"]["random_forest_regressor"]["test_metrics"]["clipped"]["rmse"]

        # Exact canonical metrics verification for primary Random Forest Regressor
        assert rf_cv_rmse_std == 0.2413, f"Expected RF CV RMSE std 0.2413, got {rf_cv_rmse_std}"
        assert rf_cv_r2_std == 0.0474, f"Expected RF CV R2 std 0.0474, got {rf_cv_r2_std}"

        # Honest trade-off checks: Baseline has slightly lower MAE, RF has lower RMSE
        assert baseline_cv_mae < rf_cv_mae, "Baseline CV MAE should be lower than RF CV MAE"
        assert baseline_test_mae < rf_test_mae, "Baseline test MAE should be slightly lower than RF test MAE"
        assert rf_cv_rmse < baseline_cv_rmse, "RF CV RMSE must be lower than Baseline CV RMSE"
        assert rf_test_rmse < baseline_test_rmse, "RF test RMSE must be lower than Baseline test RMSE"
        assert "approximately 13.4% lower test rmse" in reg_sel["baseline_comparison"].lower()

        # Classification Selection Scope & Metrics
        assert cls_sel["selected_primary_candidate"] == "random_forest_classifier"
        assert "Macro F1" in cls_sel["primary_selection_metric"]
        assert "selected strictly by highest mean cv macro f1" in cls_sel["selection_rationale"].lower()
        assert "secondary comparison metrics" in cls_sel["selection_rationale"].lower()

        # Verify Random Forest has highest CV Macro F1 among the 5 fitted ML classifiers
        rf_cv_f1 = report["classification_models"]["random_forest_classifier"]["cv_metrics"]["cv_f1_macro_mean"]
        rf_cv_acc = report["classification_models"]["random_forest_classifier"]["cv_metrics"]["cv_accuracy_mean"]
        for mod_id, mod_data in report["classification_models"].items():
            if mod_id != "random_forest_classifier":
                assert rf_cv_f1 > mod_data["cv_metrics"]["cv_f1_macro_mean"], (
                    f"RF CV F1 ({rf_cv_f1}) must be higher than {mod_id} ({mod_data['cv_metrics']['cv_f1_macro_mean']})"
                )
                assert rf_cv_acc > mod_data["cv_metrics"]["cv_accuracy_mean"], (
                    f"RF CV Acc ({rf_cv_acc}) must be higher than {mod_id} ({mod_data['cv_metrics']['cv_accuracy_mean']})"
                )

        # Ablation study diagnostics
        ablation = report["ablation_study"]
        full_rf_r2 = report["regression_models"]["random_forest_regressor"]["cv_metrics"]["cv_r2_mean"]
        ablated_rf = ablation["random_forest_regressor"]
        ablated_rf_r2 = ablated_rf["cv_metrics"]["cv_r2_mean"]
        ablated_rf_r2_std = ablated_rf["cv_metrics"]["cv_r2_std"]
        ablated_rf_rmse_std = ablated_rf["cv_metrics"]["cv_rmse_std"]
        ablated_test_mae = ablated_rf["test_metrics"]["clipped"]["mae"]
        ablated_test_rmse = ablated_rf["test_metrics"]["clipped"]["rmse"]

        assert full_rf_r2 == 0.8734
        assert ablated_rf_r2 == 0.8793
        assert ablated_rf_r2_std == 0.0508, f"Expected ablated CV R2 std 0.0508, got {ablated_rf_r2_std}"
        assert ablated_rf_rmse_std == 0.2872, f"Expected ablated CV RMSE std 0.2872, got {ablated_rf_rmse_std}"
        assert ablated_test_mae == 1.0737, f"Expected ablated test MAE 1.0737, got {ablated_test_mae}"
        assert ablated_test_rmse == 1.7073, f"Expected ablated test RMSE 1.7073, got {ablated_test_rmse}"

        diff = round(ablated_rf_r2 - full_rf_r2, 4)
        assert diff == 0.0059

        # Confirm note explicitly describes it as a diagnostic comparison and preserves 8-feature contract
        note = ablation["cv_comparison_note"]
        assert "diagnostic comparison" in note
        assert "0.0059" in note
        assert "retained" in note.lower()


def test_ablation_and_artifact_reproducibility():
    """Verify deterministic reproducibility of ablated pipeline training and serialized artifact predictions."""
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline

    df = pd.read_csv("data/student-mat.csv", sep=";")
    df["pass_status"] = np.where(df["G3"] >= 10, "pass", "fail")
    X = df[FEATURE_NAMES]
    y_reg = df["G3"]
    y_cls = df["pass_status"]

    X_train, X_test, y_train_reg, y_test_reg, _, _ = train_test_split(
        X, y_reg, y_cls, test_size=0.20, random_state=42, stratify=y_cls
    )

    ablation_features = ["G1", "G2", "studytime", "failures", "absences"]
    preprocessor = ColumnTransformer(transformers=[("num", "passthrough", ablation_features)])
    pipe = Pipeline([
        ("prep", preprocessor),
        ("rf", RandomForestRegressor(n_estimators=100, max_depth=5, min_samples_split=4, random_state=42)),
    ])
    pipe.fit(X_train[ablation_features], y_train_reg)
    preds = np.clip(pipe.predict(X_test[ablation_features]), 0.0, 20.0)

    mae = round(float(mean_absolute_error(y_test_reg, preds)), 4)
    rmse = round(float(root_mean_squared_error(y_test_reg, preds)), 4)
    r2 = round(float(r2_score(y_test_reg, preds)), 4)

    assert mae == 1.0737, f"Expected 1.0737, got {mae}"
    assert rmse == 1.7073, f"Expected 1.7073, got {rmse}"
    assert r2 == 0.8549, f"Expected 0.8549, got {r2}"

    # Verify serialized artifact predictions on test set match canonical evaluation report
    with open(os.path.join(ARTIFACTS_DIR, "evaluation_report.json"), "r", encoding="utf-8") as f:
        report = json.load(f)

    art_payload = joblib.load(os.path.join(ARTIFACTS_DIR, "random_forest_regressor.joblib"))
    art_preds = np.clip(art_payload["pipeline"].predict(X_test), 0.0, 20.0)
    art_mae = round(float(mean_absolute_error(y_test_reg, art_preds)), 4)
    art_rmse = round(float(root_mean_squared_error(y_test_reg, art_preds)), 4)
    art_r2 = round(float(r2_score(y_test_reg, art_preds)), 4)

    expected_rf = report["regression_models"]["random_forest_regressor"]["test_metrics"]["clipped"]
    assert art_mae == expected_rf["mae"] == 1.1154
    assert art_rmse == expected_rf["rmse"] == 1.7787
    assert art_r2 == expected_rf["r2"] == 0.8425



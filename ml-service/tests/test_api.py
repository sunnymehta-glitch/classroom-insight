"""
Classroom Insight — Phase 2 FastAPI Service Test Suite
Comprehensive testing using FastAPI TestClient covering:
1. Health endpoint (UP, DEGRADED, DOWN).
2. Model discovery listing for regression and classification.
3. Canonical performance reports matching offline evaluations.
4. Single-model regression inference.
5. Single-model classification inference.
6. Multi-model comparison inference.
7. Feature schema validation: missing, extra, wrong type, out-of-range features.
8. Unknown model IDs and incompatible goal/model validation.
9. Missing/corrupted model artifact failure handling.
10. Partial comparison failure containment.
11. All-model comparison failure handling.
12. Predicted grade clipping bounds (0-20) and classification validity.
13. Deterministic inference and immutability of serialized model artifacts.
"""

import copy
import hashlib
import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure ml-service is in sys.path
ML_SERVICE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = ML_SERVICE_DIR.parent
if str(ML_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_SERVICE_DIR))

from app.main import app
from app.loader import loader, ModelLoader
from app.inference import InferenceEngine


@pytest.fixture(scope="module")
def client():
    """TestClient that runs lifespan events (loads artifacts into memory)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def valid_features():
    return {
        "G1": 14,
        "G2": 15,
        "studytime": 3,
        "failures": 0,
        "absences": 4,
        "schoolsup": "no",
        "famsup": "yes",
        "paid": "no",
    }


# =========================================================================
# 1. Health Endpoint Tests
# =========================================================================


def test_health_endpoint_up(client):
    """Verify GET /internal/health reports UP and all 10 models loaded."""
    response = client.get("/internal/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert data["models_loaded_count"] == 10
    assert "service" in data
    assert "version" in data


def test_health_endpoint_degraded_and_down(client, monkeypatch):
    """Verify health returns 503 and appropriate status when artifacts fail to load."""
    original_healthy = loader.is_healthy
    original_models = copy.copy(loader.models)

    try:
        # Simulate DEGRADED (some models loaded)
        loader.is_healthy = False
        loader.models = {"linear_regression": {}}
        response = client.get("/internal/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "DEGRADED"
        assert data["models_loaded_count"] == 1

        # Simulate DOWN (0 models loaded)
        loader.models = {}
        response = client.get("/internal/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "DOWN"
        assert data["models_loaded_count"] == 0
    finally:
        loader.is_healthy = original_healthy
        loader.models = original_models


# =========================================================================
# 2. Model Listing Tests
# =========================================================================


def test_list_models_regression(client):
    """Verify listing regression models returns exactly 5 verified models."""
    response = client.get("/internal/models?goal=regression")
    assert response.status_code == 200
    data = response.json()
    assert data["goal"] == "regression"
    model_ids = [m["model_id"] for m in data["models"]]
    assert len(model_ids) == 5
    expected_ids = [
        "linear_regression",
        "decision_tree_regressor",
        "random_forest_regressor",
        "svr",
        "knn_regressor",
    ]
    for mid in expected_ids:
        assert mid in model_ids

    # Verify primary candidate flag
    primary_models = [m for m in data["models"] if m.get("selected_primary_candidate")]
    assert len(primary_models) == 1
    assert primary_models[0]["model_id"] == "random_forest_regressor"


def test_list_models_classification(client):
    """Verify listing classification models returns exactly 5 verified models."""
    response = client.get("/internal/models?goal=classification")
    assert response.status_code == 200
    data = response.json()
    assert data["goal"] == "classification"
    model_ids = [m["model_id"] for m in data["models"]]
    assert len(model_ids) == 5
    expected_ids = [
        "logistic_regression",
        "decision_tree_classifier",
        "random_forest_classifier",
        "svc",
        "knn_classifier",
    ]
    for mid in expected_ids:
        assert mid in model_ids

    primary_models = [m for m in data["models"] if m.get("selected_primary_candidate")]
    assert len(primary_models) == 1
    assert primary_models[0]["model_id"] == "random_forest_classifier"


def test_list_models_invalid_goal(client):
    """Verify requesting an invalid goal returns validation error 422."""
    response = client.get("/internal/models?goal=clustering")
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


# =========================================================================
# 3. Model Performance Report Tests
# =========================================================================


def test_performance_regression(client):
    """Verify GET /internal/models/performance?goal=regression returns canonical metrics."""
    response = client.get("/internal/models/performance?goal=regression")
    assert response.status_code == 200
    data = response.json()
    assert data["goal"] == "regression"
    assert data["test_sample_count"] == 79
    assert "student-mat.csv" in data["dataset"]
    assert len(data["models"]) == 5

    models_by_id = {m["model_id"]: m for m in data["models"]}
    # Verify Random Forest Regressor metrics match canonical report
    rf = models_by_id["random_forest_regressor"]
    assert rf["metrics"]["mae"] == 1.1154
    assert rf["metrics"]["rmse"] == 1.7787
    assert rf["metrics"]["r2"] == 0.8425
    assert rf["status"] == "evaluated"


def test_performance_classification(client):
    """Verify GET /internal/models/performance?goal=classification returns canonical metrics."""
    response = client.get("/internal/models/performance?goal=classification")
    assert response.status_code == 200
    data = response.json()
    assert data["goal"] == "classification"
    assert data["test_sample_count"] == 79
    assert len(data["models"]) == 5

    models_by_id = {m["model_id"]: m for m in data["models"]}
    # Verify Random Forest Classifier metrics match canonical report
    rf = models_by_id["random_forest_classifier"]
    assert rf["metrics"]["accuracy"] == 0.8734
    assert "confusion_matrix" in rf["metrics"]
    assert rf["metrics"]["confusion_matrix"]["true_positive"] == 45
    assert rf["status"] == "evaluated"


# =========================================================================
# 4. Single-Model Inference Tests
# =========================================================================


def test_single_regression_prediction(client, valid_features):
    """Verify single-model regression prediction produces bounded grade."""
    payload = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["model_id"] == "random_forest_regressor"
    assert result["status"] == "success"
    assert isinstance(result["predicted_grade"], (int, float))
    assert 0.0 <= result["predicted_grade"] <= 20.0
    assert result["predicted_class"] is None
    assert result["error_message"] is None


def test_single_classification_prediction(client, valid_features):
    """Verify single-model classification prediction produces pass/fail class."""
    payload = {
        "goal": "classification",
        "mode": "single",
        "model_id": "random_forest_classifier",
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) == 1
    result = data["results"][0]
    assert result["model_id"] == "random_forest_classifier"
    assert result["status"] == "success"
    assert result["predicted_class"] in ("pass", "fail")
    assert result["predicted_grade"] is None
    assert result["error_message"] is None


# =========================================================================
# 5. Multi-Model Comparison Inference Tests
# =========================================================================


def test_compare_mode_regression(client, valid_features):
    """Verify comparison across multiple regression models."""
    payload = {
        "goal": "regression",
        "mode": "compare",
        "model_ids": [
            "linear_regression",
            "random_forest_regressor",
            "decision_tree_regressor",
        ],
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) == 3
    for r in data["results"]:
        assert r["status"] == "success"
        assert 0.0 <= r["predicted_grade"] <= 20.0
        assert r["error_message"] is None


def test_compare_mode_classification(client, valid_features):
    """Verify comparison across multiple classification models."""
    payload = {
        "goal": "classification",
        "mode": "compare",
        "model_ids": [
            "logistic_regression",
            "random_forest_classifier",
            "svc",
        ],
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) == 3
    for r in data["results"]:
        assert r["status"] == "success"
        assert r["predicted_class"] in ("pass", "fail")
        assert r["error_message"] is None


# =========================================================================
# 6. Feature Validation & Schema Enforcement Tests
# =========================================================================


def test_missing_feature(client, valid_features):
    """Verify omission of any required feature returns 422."""
    bad_features = copy.deepcopy(valid_features)
    del bad_features["G1"]
    payload = {
        "goal": "regression",
        "mode": "single",
        "model_id": "linear_regression",
        "features": bad_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert any("G1" in d["field"] for d in data["error"]["details"])


def test_extra_feature_forbidden(client, valid_features):
    """Verify extra features (e.g., target G3 leakage) are rejected with 422."""
    bad_features = copy.deepcopy(valid_features)
    bad_features["G3"] = 15  # Target leakage attempt
    payload = {
        "goal": "regression",
        "mode": "single",
        "model_id": "linear_regression",
        "features": bad_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_failures_category_4_rejected(client, valid_features):
    """Verify failures=4 is rejected (strictly [0, 1, 2, 3])."""
    bad_features = copy.deepcopy(valid_features)
    bad_features["failures"] = 4
    payload = {
        "goal": "regression",
        "mode": "single",
        "model_id": "linear_regression",
        "features": bad_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_out_of_range_values(client, valid_features):
    """Verify various out-of-range feature values are rejected."""
    # G1 > 20
    f1 = copy.deepcopy(valid_features)
    f1["G1"] = 21
    res = client.post("/internal/predictions", json={"goal": "regression", "mode": "single", "model_id": "linear_regression", "features": f1})
    assert res.status_code == 422

    # absences < 0 or > 93
    f2 = copy.deepcopy(valid_features)
    f2["absences"] = 94
    res = client.post("/internal/predictions", json={"goal": "regression", "mode": "single", "model_id": "linear_regression", "features": f2})
    assert res.status_code == 422

    # studytime not in [1, 2, 3, 4]
    f3 = copy.deepcopy(valid_features)
    f3["studytime"] = 5
    res = client.post("/internal/predictions", json={"goal": "regression", "mode": "single", "model_id": "linear_regression", "features": f3})
    assert res.status_code == 422

    # invalid categorical string
    f4 = copy.deepcopy(valid_features)
    f4["schoolsup"] = "uncertain"
    res = client.post("/internal/predictions", json={"goal": "regression", "mode": "single", "model_id": "linear_regression", "features": f4})
    assert res.status_code == 422


# =========================================================================
# 7. Model ID & Goal Compatibility Tests
# =========================================================================


def test_unknown_model_id_single_mode(client, valid_features):
    """Verify unknown model ID in single mode returns 400."""
    payload = {
        "goal": "regression",
        "mode": "single",
        "model_id": "non_existent_neural_net",
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_MODEL_SELECTION"


def test_incompatible_goal_and_model(client, valid_features):
    """Verify requesting a classifier for a regression goal returns 400."""
    payload = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_classifier",
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_MODEL_SELECTION"


# =========================================================================
# 8. Partial & Total Failure Handling in Comparison Mode
# =========================================================================


def test_partial_comparison_failure(client, valid_features):
    """
    Verify comparison mode preserves successful predictions and reports
    failed model status when some models succeed and others fail.
    """
    payload = {
        "goal": "regression",
        "mode": "compare",
        "model_ids": [
            "linear_regression",
            "random_forest_classifier",  # Incompatible goal: will fail
            "random_forest_regressor",
        ],
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "partial_success"
    assert len(data["results"]) == 3

    results_by_id = {r["model_id"]: r for r in data["results"]}

    # Successful models preserved
    assert results_by_id["linear_regression"]["status"] == "success"
    assert results_by_id["linear_regression"]["predicted_grade"] is not None
    assert results_by_id["random_forest_regressor"]["status"] == "success"
    assert results_by_id["random_forest_regressor"]["predicted_grade"] is not None

    # Failed model cleanly reported
    rf_cls = results_by_id["random_forest_classifier"]
    assert rf_cls["status"] == "failed"
    assert rf_cls["predicted_grade"] is None
    assert "incompatible" in rf_cls["error_message"].lower()


def test_all_models_invalid_failure(client, valid_features):
    """Verify that when all models fail due to bad IDs, 400 is returned."""
    payload = {
        "goal": "regression",
        "mode": "compare",
        "model_ids": ["unknown_model_1", "unknown_model_2"],
        "features": valid_features,
    }
    response = client.post("/internal/predictions", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_MODEL_SELECTION"


def test_all_models_inference_failure(client, valid_features, monkeypatch):
    """Verify that when all models fail during runtime inference, 502 is returned."""
    # Monkeypatch pipeline to raise an exception
    class BrokenPipeline:
        def predict(self, df):
            raise RuntimeError("Hardware failure during execution")

    saved_payload = loader.models["linear_regression"]
    try:
        loader.models["linear_regression"] = {
            "pipeline": BrokenPipeline(),
            "task": "regression",
            "version": "1.0.0",
        }
        payload = {
            "goal": "regression",
            "mode": "single",
            "model_id": "linear_regression",
            "features": valid_features,
        }
        response = client.post("/internal/predictions", json=payload)
        assert response.status_code == 502
        data = response.json()
        assert data["error"]["code"] == "ALL_MODELS_FAILED"
        # Verify no local filepath or traceback is leaked
        assert "Hardware failure during execution" not in str(data)
        assert "Inference execution failed" in str(data)
    finally:
        loader.models["linear_regression"] = saved_payload


# =========================================================================
# 9. Output Bounds & Classification Validity Tests
# =========================================================================


def test_predicted_grade_bounds_and_clipping(client):
    """Verify all regression models strictly bound predictions to [0.0, 20.0]."""
    edge_cases = [
        # Zero boundary
        {"G1": 0, "G2": 0, "studytime": 1, "failures": 3, "absences": 0, "schoolsup": "no", "famsup": "no", "paid": "no"},
        # Max boundary
        {"G1": 20, "G2": 20, "studytime": 4, "failures": 0, "absences": 75, "schoolsup": "yes", "famsup": "yes", "paid": "yes"},
        # Extreme absences
        {"G1": 10, "G2": 10, "studytime": 2, "failures": 1, "absences": 93, "schoolsup": "no", "famsup": "yes", "paid": "no"},
    ]
    reg_models = [
        "linear_regression",
        "decision_tree_regressor",
        "random_forest_regressor",
        "svr",
        "knn_regressor",
    ]
    for case in edge_cases:
        for mid in reg_models:
            payload = {"goal": "regression", "mode": "single", "model_id": mid, "features": case}
            res = client.post("/internal/predictions", json=payload)
            assert res.status_code == 200
            data = res.json()
            grade = data["results"][0]["predicted_grade"]
            assert 0.0 <= grade <= 20.0


# =========================================================================
# 10. Determinism & No Runtime Retraining Invariant
# =========================================================================


def test_deterministic_inference_and_immutability(client, valid_features):
    """
    Verify inference is strictly deterministic and that prediction requests
    never train or modify the serialized model artifacts on disk.
    """
    artifacts_dir = Path(loader.artifacts_dir)
    assert artifacts_dir.exists()

    # 1. Compute SHA256 of all 10 artifact files before inference
    checksums_before = {}
    mtimes_before = {}
    for f in artifacts_dir.glob("*.joblib"):
        with open(f, "rb") as fp:
            checksums_before[f.name] = hashlib.sha256(fp.read()).hexdigest()
        mtimes_before[f.name] = os.path.getmtime(f)

    assert len(checksums_before) == 10

    # 2. Run repeated prediction requests (regression and classification)
    first_res = client.post(
        "/internal/predictions",
        json={"goal": "regression", "mode": "single", "model_id": "random_forest_regressor", "features": valid_features},
    ).json()

    for _ in range(10):
        subsequent_res = client.post(
            "/internal/predictions",
            json={"goal": "regression", "mode": "single", "model_id": "random_forest_regressor", "features": valid_features},
        ).json()
        assert first_res["results"][0]["predicted_grade"] == subsequent_res["results"][0]["predicted_grade"]

    # Repeat for classification
    first_cls = client.post(
        "/internal/predictions",
        json={"goal": "classification", "mode": "single", "model_id": "random_forest_classifier", "features": valid_features},
    ).json()

    for _ in range(10):
        subsequent_cls = client.post(
            "/internal/predictions",
            json={"goal": "classification", "mode": "single", "model_id": "random_forest_classifier", "features": valid_features},
        ).json()
        assert first_cls["results"][0]["predicted_class"] == subsequent_cls["results"][0]["predicted_class"]

    # 3. Verify SHA256 and mtimes after inference are 100% identical
    for f in artifacts_dir.glob("*.joblib"):
        with open(f, "rb") as fp:
            current_hash = hashlib.sha256(fp.read()).hexdigest()
        assert current_hash == checksums_before[f.name], f"Artifact {f.name} was altered during inference!"
        assert os.path.getmtime(f) == mtimes_before[f.name], f"Artifact {f.name} timestamp modified!"

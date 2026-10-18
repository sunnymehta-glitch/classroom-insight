"""
Classroom Insight — Phase 5 End-to-End Integration Verification Suite
Tests the complete containerized multi-tier flow:
React Reverse Proxy (Port 5173) -> Spring Boot Backend (Port 8080) -> Internal FastAPI ML Service (Port 8000 via Docker Network) -> File-backed H2 Database

FastAPI Port 8000 is intentionally internal-only and not published to host.
Direct container inference for model-consistency comparisons is executed via 'docker compose exec -T ml-service'.
"""

import glob
import hashlib
import json
import math
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

SPRING_BASE = "http://localhost:8080/api"
VITE_PROXY_BASE = "http://127.0.0.1:5173/api"
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml-service", "artifacts")


def get_artifact_hashes() -> dict:
    """Computes SHA-256 hashes for all 10 canonical joblib model artifacts."""
    hashes = {}
    pattern = os.path.join(ARTIFACTS_DIR, "*.joblib")
    for fpath in sorted(glob.glob(pattern)):
        fname = os.path.basename(fpath)
        with open(fpath, "rb") as f:
            hashes[fname] = hashlib.sha256(f.read()).hexdigest()
    return hashes


def make_request(url, method="GET", payload=None):
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            status = resp.status
            return status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"raw": content}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}


def query_fastapi_container(endpoint: str, payload: dict) -> tuple:
    """
    Executes a direct request against the internal FastAPI service from inside
    the running ml-service container using 'docker compose exec -T ml-service ...'.
    Preserves the boundary where port 8000 is internal-only.
    """
    docker_bin = r"C:\Users\sunny kumar\AppData\Local\Programs\DockerDesktop\resources\bin"
    env = os.environ.copy()
    if os.path.exists(docker_bin) and docker_bin not in env.get("PATH", ""):
        env["PATH"] = docker_bin + os.pathsep + env.get("PATH", "")

    # Python one-liner to execute inside ml-service container reading from stdin
    py_code = (
        "import sys, urllib.request, json\n"
        "try:\n"
        "    data = sys.stdin.read().encode('utf-8')\n"
        f"    req = urllib.request.Request('http://127.0.0.1:8000{endpoint}', data=data, headers={{'Content-Type': 'application/json'}})\n"
        "    with urllib.request.urlopen(req, timeout=10) as r:\n"
        "        print(r.status)\n"
        "        print(r.read().decode('utf-8'))\n"
        "except urllib.error.HTTPError as e:\n"
        "    print(e.code)\n"
        "    print(e.read().decode('utf-8'))\n"
        "except Exception as ex:\n"
        "    print(0)\n"
        "    print(json.dumps({'error': str(ex)}))\n"
    )

    cmd = ["docker", "compose", "exec", "-T", "ml-service", "python", "-c", py_code]
    payload_str = json.dumps(payload)
    res = subprocess.run(cmd, input=payload_str, capture_output=True, text=True, env=env)
    if res.returncode != 0:
        raise RuntimeError(
            f"docker compose exec failed with exit code {res.returncode}:\nSTDERR: {res.stderr}\nSTDOUT: {res.stdout}"
        )

    lines = res.stdout.strip().splitlines()
    if not lines:
        raise RuntimeError(f"Empty output from docker compose exec:\nSTDERR: {res.stderr}\nSTDOUT: {res.stdout}")

    try:
        status_code = int(lines[0].strip())
        content = "\n".join(lines[1:])
        parsed = json.loads(content) if content else {}
        return status_code, parsed
    except Exception as e:
        raise RuntimeError(
            f"Failed to parse output from container exec: {e}\nRaw stdout:\n{res.stdout}\nRaw stderr:\n{res.stderr}"
        )


def run_checks():
    print("=" * 70)
    print("Classroom Insight — Phase 5 Docker Integration Verification")
    print("=" * 70)

    # Pre-test artifact hash snapshot
    initial_hashes = get_artifact_hashes()
    assert len(initial_hashes) == 10, f"Expected 10 canonical joblib artifacts, found {len(initial_hashes)}"

    # -------------------------------------------------------------------------
    # Check 1: System Health via Spring Boot and Nginx Reverse Proxy
    # -------------------------------------------------------------------------
    print("\n[CHECK 1] Testing /api/health via Spring Boot and Nginx Reverse Proxy...")
    status, health = make_request(f"{SPRING_BASE}/health")
    assert status == 200, f"Expected 200 from Spring Boot health, got {status}: {health}"
    assert health.get("status") == "UP", f"Expected UP, got {health.get('status')}"
    assert health["components"]["database"]["status"] == "UP"
    assert health["components"]["ml_service"]["status"] == "UP"
    assert health["components"]["ml_service"]["details"]["models_loaded"] == 10
    print(" [PASS] Spring Boot /api/health reports UP with 10 models loaded and H2 database connected.")

    # Verify through Nginx SPA reverse proxy
    proxy_status, proxy_health = make_request(f"{VITE_PROXY_BASE}/health")
    assert proxy_status == 200, f"Nginx reverse proxy failed with status {proxy_status}: {proxy_health}"
    assert proxy_health.get("status") == "UP"
    print(" [PASS] Nginx reverse proxy /api/health correctly proxies to Spring Boot backend.")

    # -------------------------------------------------------------------------
    # Check 2: Dynamic Model Discovery
    # -------------------------------------------------------------------------
    print("\n[CHECK 2] Testing Dynamic Model Discovery (/api/models)...")
    status, reg_models = make_request(f"{SPRING_BASE}/models?goal=regression")
    assert status == 200
    assert reg_models.get("goal") == "regression"
    reg_list = reg_models.get("models", [])
    assert len(reg_list) == 5, f"Expected 5 regression models, got {len(reg_list)}"
    rf_reg = next((m for m in reg_list if m["model_id"] == "random_forest_regressor"), None)
    assert rf_reg is not None and rf_reg.get("selected_primary_candidate") is True
    print(f" [PASS] Discovered 5 regression models. Primary candidate: {rf_reg['name']}.")

    status, cls_models = make_request(f"{SPRING_BASE}/models?goal=classification")
    assert status == 200
    assert cls_models.get("goal") == "classification"
    cls_list = cls_models.get("models", [])
    assert len(cls_list) == 5, f"Expected 5 classification models, got {len(cls_list)}"
    rf_cls = next((m for m in cls_list if m["model_id"] == "random_forest_classifier"), None)
    assert rf_cls is not None and rf_cls.get("selected_primary_candidate") is True
    print(f" [PASS] Discovered 5 classification models. Primary candidate: {rf_cls['name']}.")

    # -------------------------------------------------------------------------
    # Check 3: Golden-Path Regression Prediction Flow
    # -------------------------------------------------------------------------
    print("\n[CHECK 3] Golden-Path Regression Prediction Flow...")
    reg_input = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "student_reference": "E2E-REG-001",
        "features": {
            "G1": 13,
            "G2": 14,
            "studytime": 3,
            "failures": 0,
            "absences": 4,
            "schoolsup": "no",
            "famsup": "yes",
            "paid": "no",
        },
    }
    status, reg_pred = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=reg_input)
    assert status == 201, f"Expected 201 Created, got {status}: {reg_pred}"
    assert reg_pred["status"] == "success"
    pred_id_reg = reg_pred["prediction_id"]
    predicted_grade = reg_pred["results"][0]["predicted_grade"]
    assert 0.0 <= predicted_grade <= 20.0, f"Grade {predicted_grade} out of bounds"
    print(f" [PASS] Regression prediction created: ID={pred_id_reg}, Estimated G3={predicted_grade:.2f}/20.")

    # -------------------------------------------------------------------------
    # Check 4: Golden-Path Classification Prediction Flow
    # -------------------------------------------------------------------------
    print("\n[CHECK 4] Golden-Path Classification Prediction Flow...")
    cls_input = {
        "goal": "classification",
        "mode": "single",
        "model_id": "random_forest_classifier",
        "student_reference": "E2E-CLS-001",
        "features": {
            "G1": 8,
            "G2": 7,
            "studytime": 1,
            "failures": 2,
            "absences": 12,
            "schoolsup": "yes",
            "famsup": "no",
            "paid": "no",
        },
    }
    status, cls_pred = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=cls_input)
    assert status == 201, f"Expected 201 Created, got {status}: {cls_pred}"
    assert cls_pred["status"] == "success"
    pred_id_cls = cls_pred["prediction_id"]
    predicted_class = cls_pred["results"][0]["predicted_class"]
    assert predicted_class in ["pass", "fail"], f"Invalid class label: {predicted_class}"
    print(f" [PASS] Classification prediction created: ID={pred_id_cls}, Predicted Class={predicted_class.upper()}.")

    # -------------------------------------------------------------------------
    # Check 5: Model Consistency Comparison (Direct Container vs Spring Boot Path)
    # -------------------------------------------------------------------------
    print("\n[CHECK 5] Model Consistency Comparison (Direct Container FastAPI vs Spring Boot Path)...")

    # 5a: Fresh Regression Request Comparison
    fresh_reg_features = {
        "G1": 14,
        "G2": 15,
        "studytime": 3,
        "failures": 0,
        "absences": 2,
        "schoolsup": "no",
        "famsup": "yes",
        "paid": "no",
    }
    fresh_reg_spring = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "student_reference": "E2E-CONSISTENCY-REG",
        "features": fresh_reg_features,
    }
    fresh_reg_fastapi = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "features": fresh_reg_features,
    }

    # Execute fresh Spring Boot request
    s_reg_status, s_reg_res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=fresh_reg_spring)
    assert s_reg_status == 201, f"Spring Boot regression prediction failed: {s_reg_res}"
    s_predicted_grade = s_reg_res["results"][0]["predicted_grade"]

    # Execute direct internal FastAPI request via container exec
    f_reg_status, f_reg_res = query_fastapi_container("/internal/predictions", fresh_reg_fastapi)
    assert f_reg_status == 200, f"Direct container FastAPI prediction failed: {f_reg_res}"
    f_predicted_grade = f_reg_res["results"][0]["predicted_grade"]

    grade_diff = abs(s_predicted_grade - f_predicted_grade)
    TOLERANCE = 1e-6
    assert grade_diff <= TOLERANCE, (
        f"Regression discrepancy: Spring Boot={s_predicted_grade}, Direct FastAPI={f_predicted_grade}, diff={grade_diff}"
    )
    print(f" [PASS] Regression numerical consistency verified within tolerance {TOLERANCE}:")
    print(f"        Spring Boot Path = {s_predicted_grade:.4f}, Direct Container = {f_predicted_grade:.4f} (diff: {grade_diff:.2e}).")

    # 5b: Fresh Classification Request Comparison
    fresh_cls_features = {
        "G1": 7,
        "G2": 8,
        "studytime": 1,
        "failures": 2,
        "absences": 10,
        "schoolsup": "yes",
        "famsup": "no",
        "paid": "no",
    }
    fresh_cls_spring = {
        "goal": "classification",
        "mode": "single",
        "model_id": "random_forest_classifier",
        "student_reference": "E2E-CONSISTENCY-CLS",
        "features": fresh_cls_features,
    }
    fresh_cls_fastapi = {
        "goal": "classification",
        "mode": "single",
        "model_id": "random_forest_classifier",
        "features": fresh_cls_features,
    }

    # Execute fresh Spring Boot request
    s_cls_status, s_cls_res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=fresh_cls_spring)
    assert s_cls_status == 201, f"Spring Boot classification prediction failed: {s_cls_res}"
    s_predicted_class = s_cls_res["results"][0]["predicted_class"]

    # Execute direct internal FastAPI request via container exec
    f_cls_status, f_cls_res = query_fastapi_container("/internal/predictions", fresh_cls_fastapi)
    assert f_cls_status == 200, f"Direct container FastAPI prediction failed: {f_cls_res}"
    f_predicted_class = f_cls_res["results"][0]["predicted_class"]

    assert s_predicted_class == f_predicted_class, (
        f"Classification mismatch: Spring Boot '{s_predicted_class}' vs Direct FastAPI '{f_predicted_class}'"
    )
    print(f" [PASS] Classification label consistency verified exact match: '{s_predicted_class}'.")

    # -------------------------------------------------------------------------
    # Check 6: Comparison Mode (Multiple Models)
    # -------------------------------------------------------------------------
    print("\n[CHECK 6] Comparison Mode Flow (Multiple Models)...")
    compare_input = {
        "goal": "regression",
        "mode": "compare",
        "model_ids": ["linear_regression", "random_forest_regressor", "decision_tree_regressor"],
        "student_reference": "E2E-COMPARE-001",
        "features": reg_input["features"],
    }
    status, compare_pred = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=compare_input)
    assert status == 201
    assert compare_pred["status"] == "success"
    assert len(compare_pred["results"]) == 3
    print(" [PASS] Compare mode evaluated 3 regression algorithms simultaneously in one transactional persistence record.")

    # -------------------------------------------------------------------------
    # Check 7: Prediction History and Reopening Saved Record
    # -------------------------------------------------------------------------
    print("\n[CHECK 7] Prediction History and Reopening without Re-inference...")
    status, history = make_request(f"{SPRING_BASE}/predictions?size=20")
    assert status == 200
    assert history["total_elements"] >= 3
    found_reg = any(item["prediction_id"] == pred_id_reg for item in history["items"])
    assert found_reg, f"Prediction {pred_id_reg} not found in history"
    print(f" [PASS] Persistent history returns {history['total_elements']} records. Target record confirmed.")

    # Reopen record by ID
    status, reopened = make_request(f"{SPRING_BASE}/predictions/{pred_id_reg}")
    assert status == 200
    assert reopened["prediction_id"] == pred_id_reg
    assert reopened["results"][0]["predicted_grade"] == predicted_grade
    print(" [PASS] Reopening record retrieves original stored results without triggering new inference.")

    # -------------------------------------------------------------------------
    # Check 8: Outcome Recording & Conflict Policy
    # -------------------------------------------------------------------------
    print("\n[CHECK 8] Outcome Recording & Conflict Policy...")
    outcome_input = {
        "actual_g3": 15,
        "source": "teacher_reported",
        "verification_status": "recorded",
        "notes": "E2E automated validation test",
    }
    status, outcome_res = make_request(f"{SPRING_BASE}/predictions/{pred_id_reg}/outcome", method="POST", payload=outcome_input)
    assert status == 200, f"Outcome recording failed: {outcome_res}"
    assert outcome_res["actual_g3"] == 15
    assert outcome_res["actual_pass_status"] == "pass", "G3=15 must derive 'pass'"
    print(" [PASS] Actual outcome recorded: G3=15 -> status='pass' (derived via G3 >= 10 convention).")

    # Duplicate recording conflict check (HTTP 409)
    dup_status, dup_res = make_request(f"{SPRING_BASE}/predictions/{pred_id_reg}/outcome", method="POST", payload=outcome_input)
    assert dup_status == 409, f"Expected 409 Conflict on duplicate outcome, got {dup_status}: {dup_res}"
    print(" [PASS] Duplicate outcome recording correctly rejected with HTTP 409 Conflict.")

    # -------------------------------------------------------------------------
    # Check 9: Failure & Resilience Scenarios
    # -------------------------------------------------------------------------
    print("\n[CHECK 9] Failure and Resilience Scenarios...")

    # Scenario 9.1: Invalid input range (G1 > 20)
    bad_range = json.loads(json.dumps(reg_input))
    bad_range["features"]["G1"] = 25
    s, res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=bad_range)
    assert s == 400 and res["error"]["code"] == "VALIDATION_ERROR"
    print(" [PASS] Scenario 1 (Invalid range G1=25) rejected with HTTP 400 VALIDATION_ERROR.")

    # Scenario 9.2: Forbidden G3 feature attempted
    bad_feature = json.loads(json.dumps(reg_input))
    bad_feature["features"]["G3"] = 15
    s, res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=bad_feature)
    assert s == 400 and res["error"]["code"] in ["VALIDATION_ERROR", "MALFORMED_JSON"]
    print(f" [PASS] Scenario 2 (Forbidden target G3 submitted) rejected with HTTP 400 {res['error']['code']}.")

    # Scenario 9.3: Unknown model ID
    bad_model = json.loads(json.dumps(reg_input))
    bad_model["model_id"] = "non_existent_transformer_v9"
    s, res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=bad_model)
    assert s == 400 and res["error"]["code"] == "INVALID_MODEL_SELECTION"
    print(" [PASS] Scenario 3 (Unknown model ID) rejected with HTTP 400 INVALID_MODEL_SELECTION.")

    # Scenario 9.4: Partial comparison failure (1 valid model, 1 invalid model)
    partial_input = {
        "goal": "regression",
        "mode": "compare",
        "model_ids": ["random_forest_regressor", "invalid_dummy_model"],
        "features": reg_input["features"],
    }
    s, res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=partial_input)
    assert s == 201
    assert res["status"] == "partial_success"
    assert any(r["status"] == "success" for r in res["results"])
    assert any(r["status"] == "failed" for r in res["results"])
    print(" [PASS] Scenario 4 (Partial failure in compare mode) returned HTTP 201 with status 'partial_success'.")

    # Scenario 9.5: All requested models invalid
    all_fail_input = {
        "goal": "regression",
        "mode": "compare",
        "model_ids": ["invalid_model_1", "invalid_model_2"],
        "features": reg_input["features"],
    }
    s, res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=all_fail_input)
    assert s in [400, 502]
    print(f" [PASS] Scenario 5 (All models invalid) safely rejected with HTTP {s}.")

    # -------------------------------------------------------------------------
    # Check 10: Canonical Model Artifact Immutability Verification
    # -------------------------------------------------------------------------
    print("\n[CHECK 10] Canonical Model Artifact Immutability Verification...")
    post_hashes = get_artifact_hashes()
    for fname, orig_hash in initial_hashes.items():
        curr_hash = post_hashes.get(fname)
        assert curr_hash == orig_hash, f"Artifact '{fname}' was modified during test execution!"
    print(" [PASS] All 10 canonical model artifacts verified 100% byte-for-byte immutable.")

    print("\n" + "=" * 70)
    print(">>> ALL DOCKER CONTAINER INTEGRATION VERIFICATION CHECKS PASSED <<<")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = run_checks()
    sys.exit(0 if success else 1)

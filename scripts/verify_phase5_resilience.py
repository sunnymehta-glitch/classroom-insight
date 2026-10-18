"""
Classroom Insight — Phase 5 Final Containerized Resilience Verification
Tests:
1. Controlled ML Service Outage, Degraded Health Reporting, Safe Rejection, Persistent History Access, and Recovery.
2. Live Bounded Upstream Timeout (5s) via controlled container pause and unpause.
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

SPRING_BASE = "http://localhost:8080/api"
DOCKER_BIN_DIR = r"C:\Users\sunny kumar\AppData\Local\Programs\DockerDesktop\resources\bin"


def get_docker_env():
    env = os.environ.copy()
    if os.path.exists(DOCKER_BIN_DIR) and DOCKER_BIN_DIR not in env.get("PATH", ""):
        env["PATH"] = DOCKER_BIN_DIR + os.pathsep + env.get("PATH", "")
    return env


def run_docker_cmd(cmd_list):
    env = get_docker_env()
    res = subprocess.run(cmd_list, capture_output=True, text=True, env=env)
    if res.returncode != 0:
        raise RuntimeError(f"Docker command failed ({res.returncode}): {' '.join(cmd_list)}\nSTDERR: {res.stderr}\nSTDOUT: {res.stdout}")
    return res.stdout


def make_request(url, method="GET", payload=None, timeout=15):
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


def wait_for_ml_service_recovery(max_seconds=30):
    print(" Waiting for ML service and Spring Boot to report UP...")
    start = time.time()
    while time.time() - start < max_seconds:
        status, health = make_request(f"{SPRING_BASE}/health", timeout=3)
        if status == 200 and health.get("status") == "UP":
            ml_comp = health.get("components", {}).get("ml_service", {})
            if ml_comp.get("status") == "UP":
                print(f" [PASS] ML service recovered and healthy in {time.time() - start:.1f}s.")
                return True
        time.sleep(1)
    raise TimeoutError(f"ML service did not recover within {max_seconds} seconds.")


def test_ml_service_outage_and_recovery():
    print("\n" + "=" * 70)
    print("TEST 1: ML Service Outage and Recovery")
    print("=" * 70)

    # 1. Confirm initial health & save a known prediction ID
    status, health = make_request(f"{SPRING_BASE}/health")
    assert status == 200 and health.get("status") == "UP", f"Initial health not UP: {health}"

    status, history = make_request(f"{SPRING_BASE}/predictions?size=1")
    assert status == 200 and len(history.get("items", [])) > 0, "No existing predictions found in H2"
    target_id = history["items"][0]["prediction_id"]

    # Fetch full record to inspect initial results
    status, full_target = make_request(f"{SPRING_BASE}/predictions/{target_id}")
    assert status == 200, f"Failed to retrieve target prediction: {full_target}"
    target_grade = full_target["results"][0].get("predicted_grade")
    print(f" Initial State: Services healthy. Known target record saved: ID={target_id}, Grade={target_grade}")

    history_count_before = history["total_elements"]

    try:
        # 2. Stop only the ML service
        print("\n Stopping ml-service container (controlled docker compose stop)...")
        run_docker_cmd(["docker", "compose", "stop", "ml-service"])
        print(" [PASS] ml-service container stopped.")

        # 3. Confirm Spring Boot health reflects DEGRADED / ml_service DOWN
        status, degraded_health = make_request(f"{SPRING_BASE}/health")
        assert status == 200, f"Expected HTTP 200 for health endpoint, got {status}"
        assert degraded_health.get("status") == "DEGRADED", f"Expected DEGRADED, got {degraded_health.get('status')}"
        assert degraded_health["components"]["database"]["status"] == "UP", "Database must remain UP"
        assert degraded_health["components"]["ml_service"]["status"] == "DOWN", "ML service must be reported DOWN"
        print(f" [PASS] Spring Boot reports system status='DEGRADED' (DB='UP', ml_service='DOWN').")

        # 4. Submit prediction while FastAPI is stopped
        print("\n Submitting prediction request while FastAPI is offline...")
        pred_payload = {
            "goal": "regression",
            "mode": "single",
            "model_id": "random_forest_regressor",
            "student_reference": "OUTAGE-TEST-STUDENT",
            "features": {
                "G1": 12, "G2": 13, "studytime": 2, "failures": 0, "absences": 4,
                "schoolsup": "no", "famsup": "yes", "paid": "no"
            }
        }
        fail_status, fail_res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=pred_payload)
        assert fail_status == 503, f"Expected HTTP 503 UPSTREAM_UNAVAILABLE, got {fail_status}: {fail_res}"
        assert fail_res.get("error", {}).get("code") == "UPSTREAM_UNAVAILABLE"
        print(f" [PASS] Prediction safely rejected with HTTP 503 UPSTREAM_UNAVAILABLE: {fail_res['error']['message']}")

        # 5. Confirm failed request did NOT create an apparently successful record
        status, history_after_fail = make_request(f"{SPRING_BASE}/predictions?size=10")
        assert status == 200
        assert history_after_fail["total_elements"] == history_count_before, (
            f"History count changed! Before={history_count_before}, After={history_after_fail['total_elements']}"
        )
        assert not any(item.get("student_reference") == "OUTAGE-TEST-STUDENT" for item in history_after_fail.get("items", []))
        print(" [PASS] Verified no spurious or partial record was created in H2 during outage.")

        # 6. Retrieve saved prediction and query history while FastAPI is offline
        print("\n Verifying history and record reopening while ML service is offline...")
        status, reopened = make_request(f"{SPRING_BASE}/predictions/{target_id}")
        assert status == 200, f"Failed to retrieve saved prediction: {reopened}"
        assert reopened["prediction_id"] == target_id
        assert reopened["results"][0].get("predicted_grade") == target_grade
        print(f" [PASS] Successfully reopened target record {target_id} while ML service is offline (DB healthy).")

    finally:
        # 7. Restart ML service in finally block to ensure cleanup
        print("\n Restarting ml-service container (controlled docker compose start)...")
        run_docker_cmd(["docker", "compose", "start", "ml-service"])
        wait_for_ml_service_recovery(max_seconds=30)

    # 8. Submit fresh regression and classification predictions to verify recovery
    print("\n Submitting post-recovery predictions...")
    status, rec_reg = make_request(f"{SPRING_BASE}/predictions", method="POST", payload={
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "student_reference": "RECOVERY-REG-001",
        "features": {
            "G1": 15, "G2": 16, "studytime": 4, "failures": 0, "absences": 0,
            "schoolsup": "no", "famsup": "yes", "paid": "no"
        }
    })
    assert status == 201 and rec_reg.get("status") == "success", f"Regression failed after recovery: {rec_reg}"
    print(f" [PASS] Post-recovery regression succeeded: Grade={rec_reg['results'][0]['predicted_grade']}")

    status, rec_cls = make_request(f"{SPRING_BASE}/predictions", method="POST", payload={
        "goal": "classification",
        "mode": "single",
        "model_id": "random_forest_classifier",
        "student_reference": "RECOVERY-CLS-001",
        "features": {
            "G1": 15, "G2": 16, "studytime": 4, "failures": 0, "absences": 0,
            "schoolsup": "no", "famsup": "yes", "paid": "no"
        }
    })
    assert status == 201 and rec_cls.get("status") == "success", f"Classification failed after recovery: {rec_cls}"
    print(f" [PASS] Post-recovery classification succeeded: Class={rec_cls['results'][0]['predicted_class']}")

    # 10. Reopen saved record again to confirm data integrity
    status, final_reopen = make_request(f"{SPRING_BASE}/predictions/{target_id}")
    assert status == 200 and final_reopen["results"][0].get("predicted_grade") == target_grade
    print(f" [PASS] Target record {target_id} re-verified unchanged after complete outage/recovery cycle.")
    return True


def test_bounded_upstream_timeout():
    print("\n" + "=" * 70)
    print("TEST 2: Bounded Upstream Timeout Verification (5000ms SLA)")
    print("=" * 70)

    try:
        print(" Pausing ml-service container (controlled docker compose pause)...")
        run_docker_cmd(["docker", "compose", "pause", "ml-service"])
        print(" [PASS] ml-service paused (simulating frozen/unresponsive upstream).")

        payload = {
            "goal": "regression",
            "mode": "single",
            "model_id": "random_forest_regressor",
            "student_reference": "TIMEOUT-TEST",
            "features": {
                "G1": 10, "G2": 10, "studytime": 2, "failures": 0, "absences": 2,
                "schoolsup": "no", "famsup": "no", "paid": "no"
            }
        }

        print(" Sending prediction request to Spring Boot; timing response...")
        start_t = time.time()
        status, res = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=payload, timeout=12)
        elapsed = time.time() - start_t
        print(f" Request returned HTTP {status} in {elapsed:.2f} seconds.")

        assert status == 504, f"Expected 504 UPSTREAM_TIMEOUT on timeout, got {status}: {res}"
        assert res.get("error", {}).get("code") == "UPSTREAM_TIMEOUT"
        # Bounded upstream timeout SLA (configured ML_SERVICE_TIMEOUT_MS=5000)
        assert 4.5 <= elapsed <= 7.5, f"Timeout not properly bounded to 5000ms SLA! Expected ~5.0s, took {elapsed:.2f}s"
        print(f" [PASS] Bounded upstream timeout verified: Took {elapsed:.2f}s (~5000ms SLA) -> HTTP 504 UPSTREAM_TIMEOUT.")

    finally:
        print(" Unpausing ml-service container (docker compose unpause)...")
        run_docker_cmd(["docker", "compose", "unpause", "ml-service"])
        wait_for_ml_service_recovery(max_seconds=30)

    # Post-timeout recovery check
    status, rec = make_request(f"{SPRING_BASE}/predictions", method="POST", payload=payload)
    assert status == 201, f"Post-timeout recovery prediction failed: {rec}"
    print(" [PASS] ML service operational and handling predictions normally after unpause.")
    return True


if __name__ == "__main__":
    t1_pass = test_ml_service_outage_and_recovery()
    t2_pass = test_bounded_upstream_timeout()
    if t1_pass and t2_pass:
        print("\n" + "=" * 70)
        print(">>> ALL PHASE 5 CONTAINER RESILIENCE CHECKS PASSED SUCCESSFULLY <<<")
        print("=" * 70)
        sys.exit(0)
    else:
        sys.exit(1)

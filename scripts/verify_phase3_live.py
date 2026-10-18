"""
Classroom Insight — Phase 3 Live End-to-End Verification Script
Tests public endpoints exposed by Spring Boot on http://localhost:8080
against real file-backed H2 database and upstream FastAPI on http://localhost:8000.
"""

import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8080/api"

def make_request(method, endpoint, payload=None):
    url = f"{BASE_URL}{endpoint}"
    data = None
    headers = {"Content-Type": "application/json"} if payload else {}
    if payload:
        data = json.dumps(payload).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            body = response.read().decode("utf-8")
            return status_code, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}

def run_tests():
    passed = 0
    total = 0
    created_pred_id = None

    print("=================================================================")
    print("Classroom Insight — Phase 3 Live Verification")
    print("=================================================================\n")

    # 1. Health check
    total += 1
    status, body = make_request("GET", "/health")
    print(f"1. GET /api/health -> Status: {status}")
    if status == 200 and body.get("status") == "UP" and body.get("components", {}).get("database", {}).get("status") == "UP" and body.get("components", {}).get("ml_service", {}).get("status") == "UP":
        print("   [PASS] Spring Boot, DB, and ML service all UP & healthy.")
        passed += 1
    else:
        print(f"   [FAIL] Health check failed: {body}")

    # 2. Models (regression)
    total += 1
    status, body = make_request("GET", "/models?goal=regression")
    print(f"\n2. GET /api/models?goal=regression -> Status: {status}")
    if status == 200 and len(body.get("models", [])) >= 5:
        print(f"   [PASS] Received {len(body.get('models'))} regression models.")
        passed += 1
    else:
        print(f"   [FAIL] Models regression check failed: {body}")

    # 3. Models (classification)
    total += 1
    status, body = make_request("GET", "/models?goal=classification")
    print(f"\n3. GET /api/models?goal=classification -> Status: {status}")
    if status == 200 and len(body.get("models", [])) >= 5:
        print(f"   [PASS] Received {len(body.get('models'))} classification models.")
        passed += 1
    else:
        print(f"   [FAIL] Models classification check failed: {body}")

    # 4. Performance (regression)
    total += 1
    status, body = make_request("GET", "/models/performance?goal=regression")
    print(f"\n4. GET /api/models/performance?goal=regression -> Status: {status}")
    if status == 200 and body.get("goal") == "regression" and "models" in body:
        print(f"   [PASS] Genuine regression evaluation report retrieved ({len(body.get('models', {}))} model reports).")
        passed += 1
    else:
        print(f"   [FAIL] Regression performance check failed: {body}")

    # 5. Performance (classification)
    total += 1
    status, body = make_request("GET", "/models/performance?goal=classification")
    print(f"\n5. GET /api/models/performance?goal=classification -> Status: {status}")
    if status == 200 and body.get("goal") == "classification" and "models" in body:
        print(f"   [PASS] Genuine classification evaluation report retrieved ({len(body.get('models', {}))} model reports).")
        passed += 1
    else:
        print(f"   [FAIL] Classification performance check failed: {body}")

    # 6. Single Regression Prediction
    total += 1
    single_req = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "student_reference": "STUDENT_LIVE_001",
        "features": {
            "G1": 14,
            "G2": 15,
            "studytime": 3,
            "failures": 0,
            "absences": 4,
            "schoolsup": "no",
            "famsup": "yes",
            "paid": "no"
        }
    }
    status, body = make_request("POST", "/predictions", single_req)
    print(f"\n6. POST /api/predictions (Single Regression) -> Status: {status}")
    if status == 201 and "prediction_id" in body and len(body.get("results", [])) == 1:
        created_pred_id = body["prediction_id"]
        result = body["results"][0]
        print(f"   [PASS] Created prediction ID: {created_pred_id}, Model: {result.get('model_id')}, Grade: {result.get('predicted_grade')}")
        passed += 1
    else:
        print(f"   [FAIL] Single prediction failed: {body}")

    # 7. Comparison Prediction
    total += 1
    compare_req = {
        "goal": "classification",
        "mode": "compare",
        "model_ids": ["logistic_regression", "random_forest_classifier"],
        "student_reference": "STUDENT_LIVE_002",
        "features": {
            "G1": 11,
            "G2": 10,
            "studytime": 2,
            "failures": 1,
            "absences": 6,
            "schoolsup": "no",
            "famsup": "no",
            "paid": "yes"
        }
    }
    status, body = make_request("POST", "/predictions", compare_req)
    print(f"\n7. POST /api/predictions (Compare Classification) -> Status: {status}")
    if status == 201 and "prediction_id" in body and len(body.get("results", [])) == 2:
        print(f"   [PASS] Compare prediction created with {len(body['results'])} model results.")
        passed += 1
    else:
        print(f"   [FAIL] Compare prediction failed: {body}")

    # 8. Record Actual Outcome
    total += 1
    outcome_req = {
        "actual_g3": 16,
        "source": "official_records",
        "verification_status": "verified",
        "notes": "Verified from live school registry."
    }
    status, body = make_request("POST", f"/predictions/{created_pred_id}/outcome", outcome_req)
    print(f"\n8. POST /api/predictions/{created_pred_id}/outcome -> Status: {status}")
    if status == 200 and body.get("actual_g3") == 16 and body.get("actual_pass_status") == "pass":
        print(f"   [PASS] Outcome recorded. Actual G3: {body.get('actual_g3')}, Derived Pass: {body.get('actual_pass_status')}, Verification: {body.get('verification_status')}")
        passed += 1
    else:
        print(f"   [FAIL] Outcome recording failed: {body}")

    # 9. Duplicate Outcome (Conflict 409 check)
    total += 1
    status, body = make_request("POST", f"/predictions/{created_pred_id}/outcome", outcome_req)
    print(f"\n9. POST /api/predictions/{created_pred_id}/outcome (Duplicate) -> Status: {status}")
    err_code = body.get("error", {}).get("code")
    if status == 409 and err_code == "CONFLICT":
        print(f"   [PASS] Conflict 409 correctly returned for duplicate outcome: {body.get('error', {}).get('message')}")
        passed += 1
    else:
        print(f"   [FAIL] Expected 409 Conflict, got {status}: {body}")

    # 10. Get Prediction by ID (Verify outcome and persistence)
    total += 1
    status, body = make_request("GET", f"/predictions/{created_pred_id}")
    print(f"\n10. GET /api/predictions/{created_pred_id} -> Status: {status}")
    if status == 200 and body.get("prediction_id") == created_pred_id and body.get("verified_outcome") is not None:
        vo = body["verified_outcome"]
        print(f"   [PASS] Prediction retrieved with verified outcome attached (Actual G3: {vo.get('actual_g3')}, Status: {vo.get('actual_pass_status')}).")
        passed += 1
    else:
        print(f"   [FAIL] Retrieval failed: {body}")

    # 11. Pagination & History List
    total += 1
    status, body = make_request("GET", "/predictions?page=0&size=10&goal=regression")
    print(f"\n11. GET /api/predictions?page=0&size=10&goal=regression -> Status: {status}")
    if status == 200 and "items" in body and body.get("total_elements", 0) >= 1:
        print(f"   [PASS] Paginated history retrieved: {len(body.get('items', []))} records (Total: {body.get('total_elements')}).")
        passed += 1
    else:
        print(f"   [FAIL] History listing failed: {body}")

    # 12. History Search filter
    total += 1
    status, body = make_request("GET", "/predictions?search=STUDENT_LIVE_001")
    print(f"\n12. GET /api/predictions?search=STUDENT_LIVE_001 -> Status: {status}")
    if status == 200 and any(p.get("student_reference") == "STUDENT_LIVE_001" for p in body.get("items", [])):
        print(f"   [PASS] Search filter correctly found student reference STUDENT_LIVE_001.")
        passed += 1
    else:
        print(f"   [FAIL] Search filter failed: {body}")

    # 13. Rejection of Extra Fields (e.g. G3 in input)
    total += 1
    invalid_req = {
        "goal": "regression",
        "mode": "single",
        "model_id": "random_forest_regressor",
        "features": {
            "G1": 14,
            "G2": 15,
            "G3": 16, # FORBIDDEN
            "studytime": 3,
            "failures": 0,
            "absences": 4,
            "schoolsup": "no",
            "famsup": "yes",
            "paid": "no"
        }
    }
    status, body = make_request("POST", "/predictions", invalid_req)
    print(f"\n13. POST /api/predictions (With Forbidden G3 Field) -> Status: {status}")
    err_code = body.get("error", {}).get("code")
    if status == 400 and err_code == "VALIDATION_ERROR":
        print(f"   [PASS] Rejected with 400 VALIDATION_ERROR: {body.get('error', {}).get('message')}")
        passed += 1
    else:
        print(f"   [FAIL] Expected 400 VALIDATION_ERROR, got {status}: {body}")

    # 14. 404 for Unknown Prediction ID
    total += 1
    fake_id = "00000000-0000-0000-0000-000000000000"
    status, body = make_request("GET", f"/predictions/{fake_id}")
    print(f"\n14. GET /api/predictions/{fake_id} -> Status: {status}")
    err_code = body.get("error", {}).get("code")
    if status == 404 and err_code == "NOT_FOUND":
        print(f"   [PASS] Returned 404 NOT_FOUND for unknown prediction ID.")
        passed += 1
    else:
        print(f"   [FAIL] Expected 404 NOT_FOUND, got {status}: {body}")

    print("\n=================================================================")
    print(f"Live Verification Summary: {passed}/{total} Passed")
    print("=================================================================")

    if passed == total:
        print("ALL LIVE TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print(f"FAILED: {total - passed} test(s) failed.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())

"""
Classroom Insight — Phase 0 Verification Script
Validates dataset integrity, canonical feature schema, contracts, and repository scaffolding.
"""

import os
import sys
import json
import hashlib
import csv

def verify_file_exists(path, min_bytes=1):
    assert os.path.exists(path), f"Missing expected file: {path}"
    size = os.path.getsize(path)
    assert size >= min_bytes, f"File {path} is too small ({size} bytes)"
    print(f" [PASS] {path} exists ({size} bytes)")

def verify_sha256(path, expected_hash):
    with open(path, "rb") as f:
        actual = hashlib.sha256(f.read()).hexdigest()
    assert actual.lower() == expected_hash.lower(), f"Hash mismatch for {path}: expected {expected_hash}, got {actual}"
    print(f" [PASS] {path} SHA256 verified: {actual}")

def verify_feature_schema():
    schema_path = "docs/feature_schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # Check required top-level keys
    for key in ["title", "version", "dataset", "targets", "features", "required_features", "disallowed_features"]:
        assert key in schema, f"Missing key in schema: {key}"

    # Verify no placeholder strings remain
    schema_str = json.dumps(schema)
    for forbidden in ["TODO", "TBD", "placeholder", "guess", "unknown"]:
        assert forbidden not in schema_str.lower(), f"Forbidden placeholder found: '{forbidden}'"

    required_features = schema["required_features"]
    assert len(required_features) == 8, f"Expected 8 features, got {len(required_features)}"
    expected_feats = ["G1", "G2", "studytime", "failures", "absences", "schoolsup", "famsup", "paid"]
    assert set(required_features) == set(expected_feats), f"Features mismatch: {required_features}"
    assert "G3" in schema["disallowed_features"], "G3 must be disallowed as input feature"

    # Strict check: failures allowed_values must be strictly [0, 1, 2, 3] (reconciled with empirical source)
    failures_allowed = schema["features"]["failures"]["allowed_values"]
    assert failures_allowed == [0, 1, 2, 3], f"Failures allowed_values must be [0, 1, 2, 3], got {failures_allowed}"
    assert 4 not in failures_allowed, "Category 4 must not be in allowed_values because it is absent from dataset"

    # Strict check: absences distinguishes official allowed source domain [0, 93] from observed [0, 75]
    abs_allowed = schema["features"]["absences"]["allowed_range"]
    abs_observed = schema["features"]["absences"]["observed_range"]
    assert abs_allowed == {"min": 0, "max": 93}, f"Absences allowed_range must be 0-93, got {abs_allowed}"
    assert abs_observed == {"min": 0, "max": 75}, f"Absences observed_range must be 0-75, got {abs_observed}"

    print(" [PASS] docs/feature_schema.json validated: strict JSON, 8 approved features, zero placeholders.")
    print("        Failures domain strictly locked to [0, 1, 2, 3] (no unsupported category 4).")
    print("        Absences distinguishes official source domain (0-93) from empirical domain (0-75).")
    return schema

def verify_dataset_against_schema(schema):
    csv_path = "data/student-mat.csv"
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = list(reader)

    assert len(rows) == 395, f"Expected 395 rows, found {len(rows)}"

    g3_zeros = 0
    passes = 0
    fails = 0
    failures_counts = {0: 0, 1: 0, 2: 0, 3: 0}
    absences_list = []

    for idx, row in enumerate(rows):
        # Validate 8 features
        g1 = int(row["G1"])
        assert 0 <= g1 <= 20, f"Row {idx}: G1 {g1} out of bounds"

        g2 = int(row["G2"])
        assert 0 <= g2 <= 20, f"Row {idx}: G2 {g2} out of bounds"

        studytime = int(row["studytime"])
        assert studytime in [1, 2, 3, 4], f"Row {idx}: invalid studytime {studytime}"

        failures = int(row["failures"])
        assert failures in [0, 1, 2, 3], f"Row {idx}: invalid failures {failures} (must be in [0, 1, 2, 3])"
        failures_counts[failures] += 1

        absences = int(row["absences"])
        assert 0 <= absences <= 93, f"Row {idx}: invalid absences {absences} (source max 93)"
        absences_list.append(absences)

        assert row["schoolsup"] in ["no", "yes"], f"Row {idx}: invalid schoolsup {row['schoolsup']}"
        assert row["famsup"] in ["no", "yes"], f"Row {idx}: invalid famsup {row['famsup']}"
        assert row["paid"] in ["no", "yes"], f"Row {idx}: invalid paid {row['paid']}"

        # Target verification
        g3 = int(row["G3"])
        assert 0 <= g3 <= 20, f"Row {idx}: invalid G3 {g3}"
        if g3 == 0:
            g3_zeros += 1
        if g3 >= 10:
            passes += 1
        else:
            fails += 1

    # Verify distribution matches exactly
    assert failures_counts == {0: 312, 1: 50, 2: 17, 3: 16}, f"Unexpected failures counts: {failures_counts}"
    assert min(absences_list) == 0 and max(absences_list) == 75, f"Absences bounds mismatch: {min(absences_list)} - {max(absences_list)}"
    assert g3_zeros == 38, f"Expected 38 G3=0 records, found {g3_zeros}"
    assert passes == 265, f"Expected 265 passes, found {passes}"
    assert fails == 130, f"Expected 130 fails, found {fails}"

    print(f" [PASS] data/student-mat.csv conforms 100% to schema. 395 rows verified.")
    print(f"        Failures distribution: {failures_counts} (Category 4 count = 0, absent).")
    print(f"        Absences observed range: [{min(absences_list)}, {max(absences_list)}] (within source domain 0-93).")
    print(f"        G3=0 records: {g3_zeros} (9.62%)")
    print(f"        Class distribution: Pass={passes} ({passes/395*100:.2f}%), Fail={fails} ({fails/395*100:.2f}%)")

def verify_document_consistency():
    # Verify API_CONTRACT.md matches schema
    with open("docs/API_CONTRACT.md", "r", encoding="utf-8") as f:
        contract = f.read()
    assert "[0, 1, 2, 3]" in contract, "API_CONTRACT.md must specify [0, 1, 2, 3] for failures"
    assert "between 0 and 3" in contract, "API_CONTRACT.md error example must reference 0 to 3 for failures"

    # Verify README.md matches schema
    with open("README.md", "r", encoding="utf-8") as f:
        readme = f.read()
    assert "0, 1, 2, 3" in readme, "README.md must specify 0, 1, 2, 3 for failures"

    # Verify ARCHITECTURE.md matches schema
    with open("docs/ARCHITECTURE.md", "r", encoding="utf-8") as f:
        arch = f.read()
    assert "[0, 1, 2, 3]" in arch, "ARCHITECTURE.md must specify [0, 1, 2, 3] for failures"

    print(" [PASS] Documentation cross-consistency verified across feature_schema.json, API_CONTRACT.md, ARCHITECTURE.md, and README.md.")

def main():
    print("==================================================================")
    print("Classroom Insight — Phase 0 Verification Suite (Updated)")
    print("==================================================================")

    # 1. Master Plan & Contracts
    verify_file_exists("CLASSROOM_INSIGHT_FINAL_MASTER_PLAN.md", min_bytes=10000)
    verify_file_exists("docs/feature_schema.json", min_bytes=500)
    verify_file_exists("docs/API_CONTRACT.md", min_bytes=2000)
    verify_file_exists("docs/ARCHITECTURE.md", min_bytes=2000)
    verify_file_exists("README.md", min_bytes=1000)
    verify_file_exists(".gitignore", min_bytes=200)
    verify_file_exists(".env.example", min_bytes=200)
    verify_file_exists("docker-compose.yml", min_bytes=500)

    # 2. Dataset Provenance & Checksums
    verify_file_exists("data/student-mat.csv", min_bytes=50000)
    verify_file_exists("data/student.txt", min_bytes=1000)
    verify_sha256("data/student-mat.csv", "e47f9ee225e1ee6e69b7564e6dac7123e80b8486677fe111f351964cef5dec80")
    verify_sha256("data/student.txt", "f8d3e734e237071312790ca667330c66d75e706317f8d5e2125c479d70e962c1")

    # 3. Schema & Data Consistency
    schema = verify_feature_schema()
    verify_dataset_against_schema(schema)
    verify_document_consistency()

    print("==================================================================")
    print(">>> ALL UPDATED PHASE 0 VERIFICATION CHECKS PASSED SUCCESSFULLY. <<<")
    print("==================================================================")

if __name__ == "__main__":
    main()

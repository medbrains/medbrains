#!/usr/bin/env python3
"""
Parse cargo test stdout and output Kiwi-compatible results JSON.

Usage:
  cargo test --workspace 2>&1 | python3 qa/reporters/cargo-kiwi-report.py

Outputs qa/kiwi-results/cargo-run-{timestamp}.json with test results
mapped to YAML test case IDs where annotations match.
"""

import json
import os
import sys
import time
import yaml
from pathlib import Path

QA_DIR = Path(__file__).parent.parent / "test-cases"
OUT_DIR = Path(__file__).parent.parent / "kiwi-results"


def load_case_map():
    """Load YAML test cases and build test_file → case_id mapping."""
    mapping = {}  # "crate::module::test_name" → case_id
    for yml_file in sorted(QA_DIR.glob("*.yml")):
        with open(yml_file) as f:
            data = yaml.safe_load(f)
        module = data.get("module", yml_file.stem)
        for test in data.get("tests", []):
            if test.get("test_file"):
                # Extract the test name part after ::
                parts = test["test_file"].split("::")
                if len(parts) >= 2:
                    test_name = parts[-1]
                    mapping[test_name] = {
                        "case_id": test["id"],
                        "tcms_key": f"{module}::{test['summary']}",
                    }
    return mapping


def main():
    case_map = load_case_map()
    results = []

    for line in sys.stdin:
        line = line.strip()
        # Print through to stderr so user sees test output
        print(line, file=sys.stderr)

        if line.startswith("test ") and " ... " in line:
            parts = line.split(" ... ")
            name = parts[0].replace("test ", "").strip()
            result = parts[1].strip()

            status_map = {"ok": "PASSED", "FAILED": "FAILED", "ignored": "WAIVED"}
            status = status_map.get(result, "ERROR")

            # Try to match to a YAML case
            test_func = name.split("::")[-1] if "::" in name else name
            match = case_map.get(test_func)

            results.append({
                "test_name": name,
                "status": status,
                "case_id": match["case_id"] if match else None,
                "tcms_key": match["tcms_key"] if match else None,
            })

    # Output summary
    passed = sum(1 for r in results if r["status"] == "PASSED")
    failed = sum(1 for r in results if r["status"] == "FAILED")
    mapped = sum(1 for r in results if r["case_id"])

    summary = {
        "source": "cargo-test",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(results),
        "passed": passed,
        "failed": failed,
        "mapped_to_kiwi": mapped,
        "results": results,
    }

    # Write to file
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUT_DIR / f"cargo-run-{int(time.time())}.json"
    with open(out_file, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n[Kiwi] {passed} passed, {failed} failed, {mapped}/{len(results)} mapped to YAML cases", file=sys.stderr)
    print(f"[Kiwi] Results saved to {out_file}", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Convert `cargo test` JSON output to Allure result files.

Usage:
  cargo test --workspace -- -Z unstable-options --format json 2>/dev/null | python3 qa/cargo-to-allure.py

Or with stable Rust (parse stdout):
  cargo test --workspace 2>&1 | python3 qa/cargo-to-allure.py --parse-stdout
"""

import json
import os
import sys
import uuid
import time
from pathlib import Path

ALLURE_DIR = Path(__file__).parent / "allure-results"

def write_allure_result(name: str, status: str, suite: str, duration_ms: int = 0):
    """Write a single Allure result JSON file."""
    result = {
        "uuid": str(uuid.uuid4()),
        "historyId": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{suite}::{name}")),
        "name": name,
        "fullName": f"{suite}::{name}",
        "status": status,  # passed, failed, broken, skipped
        "stage": "finished",
        "start": int(time.time() * 1000) - duration_ms,
        "stop": int(time.time() * 1000),
        "labels": [
            {"name": "suite", "value": suite},
            {"name": "parentSuite", "value": "Rust"},
            {"name": "framework", "value": "cargo-test"},
            {"name": "language", "value": "rust"},
        ],
    }

    ALLURE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = ALLURE_DIR / f"{result['uuid']}-result.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

def parse_stdout():
    """Parse cargo test stdout (stable format)."""
    current_suite = "unknown"
    for line in sys.stdin:
        line = line.strip()

        # Detect suite from "Running" lines
        if line.startswith("Running ") or line.startswith("running "):
            continue

        if line.startswith("test ") and " ... " in line:
            parts = line.split(" ... ")
            name = parts[0].replace("test ", "").strip()
            result = parts[1].strip()

            # Extract suite from test name (module::tests::name)
            name_parts = name.split("::")
            if len(name_parts) >= 2:
                current_suite = name_parts[0]

            status_map = {
                "ok": "passed",
                "FAILED": "failed",
                "ignored": "skipped",
            }
            allure_status = status_map.get(result, "broken")
            write_allure_result(name, allure_status, current_suite)

        # Summary line
        if line.startswith("test result:"):
            pass  # Summary — skip

def parse_json():
    """Parse cargo test JSON output (unstable)."""
    for line in sys.stdin:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        if event.get("type") == "test" and event.get("event") in ("ok", "failed", "ignored"):
            name = event.get("name", "unknown")
            suite = name.split("::")[0] if "::" in name else "unknown"
            status_map = {"ok": "passed", "failed": "failed", "ignored": "skipped"}
            allure_status = status_map.get(event["event"], "broken")
            exec_time = int(event.get("exec_time", 0) * 1000)
            write_allure_result(name, allure_status, suite, exec_time)

if __name__ == "__main__":
    if "--parse-stdout" in sys.argv or "--stdout" in sys.argv:
        parse_stdout()
    else:
        parse_json()

    count = len(list(ALLURE_DIR.glob("*-result.json")))
    print(f"Wrote {count} Allure result(s) to {ALLURE_DIR}", file=sys.stderr)

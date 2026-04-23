#!/usr/bin/env python3
"""
Sync YAML test cases → Kiwi TCMS.

Usage:
  python3 qa/sync.py
  python3 qa/sync.py --dry-run
  python3 qa/sync.py --module auth

Requires: pip install tcms-api pyyaml

Config file: ~/.tcms.conf
  [tcms]
  url = https://localhost:9443/xml-rpc/
  username = admin
  password = admin
"""

import argparse
import os
import ssl
import sys
import yaml
from pathlib import Path

# Allow self-signed certs (Kiwi local dev)
ssl._create_default_https_context = ssl._create_unverified_context

QA_DIR = Path(__file__).parent / "test-cases"
PRODUCT_NAME = "MedBrains"
PRODUCT_VERSION = "0.1.0"

# Priority map: YAML priority → Kiwi priority ID
PRIORITY_MAP = {"P0": 1, "P1": 2, "P2": 3, "P3": 4}


def ensure_tcms_conf():
    """Create ~/.tcms.conf if not exists."""
    conf_path = os.path.expanduser("~/.tcms.conf")
    if not os.path.exists(conf_path):
        url = os.environ.get("TCMS_API_URL", "https://localhost:9443/xml-rpc/")
        user = os.environ.get("TCMS_USERNAME", "admin")
        pwd = os.environ.get("TCMS_PASSWORD", "admin")
        with open(conf_path, "w") as f:
            f.write(f"[tcms]\nurl = {url}\nusername = {user}\npassword = {pwd}\n")
        print(f"Created {conf_path}")


def load_test_cases(module_filter=None):
    modules = []
    for yml_file in sorted(QA_DIR.glob("*.yml")):
        with open(yml_file) as f:
            data = yaml.safe_load(f)
        mod = data.get("module", yml_file.stem)
        if module_filter and mod != module_filter:
            continue
        modules.append(data)
    return modules


def main():
    parser = argparse.ArgumentParser(description="Sync YAML test cases to Kiwi TCMS")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--module", help="Sync only this module")
    args = parser.parse_args()

    modules = load_test_cases(args.module)
    if not modules:
        print("No test case files found in qa/test-cases/")
        sys.exit(1)

    total_cases = sum(len(m.get("tests", [])) for m in modules)
    print(f"Found {len(modules)} module(s), {total_cases} test case(s)")

    if args.dry_run:
        print("\n[DRY RUN] Would sync:")
        for mod in modules:
            name = mod.get("module", "?")
            tests = mod.get("tests", [])
            print(f"  Plan: {name} ({len(tests)} cases)")
            for t in tests:
                auto = "auto" if t.get("automated") else "manual"
                print(f"    [{t['id']}] {t['summary']} ({t.get('priority','?')}, {auto})")
        return

    # Ensure config file exists
    ensure_tcms_conf()

    # Import tcms_api (uses ~/.tcms.conf for auth)
    try:
        from tcms_api import TCMS
    except ImportError:
        print("ERROR: tcms-api not installed. Run: pip install tcms-api")
        sys.exit(1)

    print("\nConnecting to Kiwi TCMS...")
    try:
        rpc = TCMS().exec
    except Exception as e:
        print(f"ERROR: {e}")
        print("Check ~/.tcms.conf or set TCMS_API_URL/USERNAME/PASSWORD env vars")
        sys.exit(1)

    print("Connected.")

    # Ensure classification exists
    classifications = rpc.Classification.filter({})
    if classifications:
        classification_id = classifications[0]["id"]
    else:
        classification_id = rpc.Classification.create({"name": "Software"})["id"]

    # Get or create product
    products = rpc.Product.filter({"name": PRODUCT_NAME})
    if products:
        product_id = products[0]["id"]
    else:
        product_id = rpc.Product.create({"name": PRODUCT_NAME, "classification": classification_id})["id"]

    # Get or create version
    versions = rpc.Version.filter({"product": product_id, "value": PRODUCT_VERSION})
    if versions:
        version_id = versions[0]["id"]
    else:
        version_id = rpc.Version.create({"product": product_id, "value": PRODUCT_VERSION})["id"]

    print(f"Product: {PRODUCT_NAME} (id={product_id}, version={version_id})")

    created = 0
    updated = 0

    for mod in modules:
        mod_name = mod.get("module", "unknown")
        tests = mod.get("tests", [])

        # Get or create plan
        plan_name = f"MedBrains — {mod_name}"
        plans = rpc.TestPlan.filter({"name": plan_name, "product": product_id})
        if plans:
            plan_id = plans[0]["id"]
        else:
            plan_id = rpc.TestPlan.create({
                "name": plan_name,
                "product": product_id,
                "product_version": version_id,
                "type": 1,
                "text": mod.get("description", f"Test plan for {mod_name}"),
            })["id"]

        print(f"\n  Plan: {plan_name} (id={plan_id})")

        # Get or create category
        cats = rpc.Category.filter({"product": product_id, "name": mod_name})
        cat_id = cats[0]["id"] if cats else rpc.Category.create({"product": product_id, "name": mod_name})["id"]

        for test in tests:
            summary = f"[{test['id']}] {test['summary']}"
            prio_id = PRIORITY_MAP.get(test.get("priority", "P1"), 2)
            is_auto = test.get("automated", False)

            # Build notes
            notes_parts = []
            if test.get("layer"):
                notes_parts.append(f"Layer: {test['layer']}")
            if test.get("test_file"):
                notes_parts.append(f"File: {test['test_file']}")
            if test.get("steps"):
                notes_parts.append("Steps:")
                for i, step in enumerate(test["steps"], 1):
                    notes_parts.append(f"  {i}. {step}")
            notes = "\n".join(notes_parts)

            # Check existing
            existing = rpc.TestCase.filter({"summary": summary, "plan": plan_id})
            if existing:
                rpc.TestCase.update(existing[0]["id"], {
                    "notes": notes,
                    "is_automated": is_auto,
                })
                updated += 1
                print(f"    Updated: {summary}")
            else:
                rpc.TestCase.create({
                    "summary": summary,
                    "category": cat_id,
                    "priority": prio_id,
                    "plan": plan_id,
                    "notes": notes,
                    "is_automated": is_auto,
                    "case_status": 2,
                })
                created += 1
                print(f"    Created: {summary}")

    print(f"\nDone. Created: {created}, Updated: {updated}")


if __name__ == "__main__":
    main()

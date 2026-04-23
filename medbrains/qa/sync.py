#!/usr/bin/env python3
"""
Sync YAML test cases → Kiwi TCMS.

Reads qa/test-cases/*.yml and creates/updates:
  - Products → MedBrains
  - Test Plans → one per module
  - Test Cases → one per test entry

Usage:
  python3 qa/sync.py
  python3 qa/sync.py --dry-run        # preview without writing
  python3 qa/sync.py --module auth    # sync only one module

Requires:
  pip install tcms-api pyyaml

Environment:
  TCMS_API_URL=https://localhost:8443/xml-rpc/  (default)
  TCMS_USERNAME=admin
  TCMS_PASSWORD=admin
"""

import argparse
import os
import ssl
import sys
import xmlrpc.client
import yaml
from pathlib import Path

QA_DIR = Path(__file__).parent / "test-cases"

# ── Config ──

TCMS_URL = os.environ.get("TCMS_API_URL", "https://localhost:8443/xml-rpc/")
TCMS_USER = os.environ.get("TCMS_USERNAME", "admin")
TCMS_PASS = os.environ.get("TCMS_PASSWORD", "admin")
PRODUCT_NAME = "MedBrains"
PRODUCT_VERSION = "0.1.0"

# ── Kiwi XML-RPC Client ──

class KiwiClient:
    def __init__(self, url, username, password):
        # Allow self-signed certs for local dev
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        self.server = xmlrpc.client.ServerProxy(
            url,
            context=ctx,
            allow_none=True,
        )
        self.session_id = self.server.Auth.login(username, password)

    def _call(self, method, *args):
        parts = method.split(".")
        obj = self.server
        for p in parts:
            obj = getattr(obj, p)
        return obj(*args)

    # ── Product ──

    def get_or_create_product(self, name):
        products = self._call("Product.filter", {"name": name})
        if products:
            return products[0]["id"]
        result = self._call("Product.create", {"name": name, "classification_id": 1})
        return result["id"]

    def get_or_create_version(self, product_id, version):
        versions = self._call("Version.filter", {"product": product_id, "value": version})
        if versions:
            return versions[0]["id"]
        result = self._call("Version.create", {"product": product_id, "value": version})
        return result["id"]

    # ── Test Plan ──

    def get_or_create_plan(self, name, product_id, version_id):
        plans = self._call("TestPlan.filter", {"name": name, "product": product_id})
        if plans:
            return plans[0]["id"]
        result = self._call("TestPlan.create", {
            "name": name,
            "product": product_id,
            "product_version": version_id,
            "type": 1,  # Unit
            "text": f"Test plan for {name}",
        })
        return result["id"]

    # ── Test Case ──

    def find_case(self, summary, plan_id):
        cases = self._call("TestCase.filter", {"summary": summary, "plan": plan_id})
        return cases[0] if cases else None

    def create_case(self, summary, plan_id, category_id, priority_id, notes="", is_automated=False):
        result = self._call("TestCase.create", {
            "summary": summary,
            "category": category_id,
            "priority": priority_id,
            "plan": plan_id,
            "notes": notes,
            "is_automated": is_automated,
            "case_status": 2,  # CONFIRMED
        })
        return result

    def update_case(self, case_id, notes="", is_automated=False):
        self._call("TestCase.update", case_id, {
            "notes": notes,
            "is_automated": is_automated,
        })

    # ── Lookups ──

    def get_categories(self, product_id):
        return self._call("Category.filter", {"product": product_id})

    def get_or_create_category(self, product_id, name):
        cats = self._call("Category.filter", {"product": product_id, "name": name})
        if cats:
            return cats[0]["id"]
        result = self._call("Category.create", {"product": product_id, "name": name})
        return result["id"]

    def get_priorities(self):
        return self._call("Priority.filter", {})


# ── YAML Loader ──

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


# ── Priority Mapping ──

PRIORITY_MAP = {
    "P0": 1,  # Highest
    "P1": 2,
    "P2": 3,
    "P3": 4,
}


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="Sync YAML test cases to Kiwi TCMS")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
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

    # Connect to Kiwi
    print(f"\nConnecting to Kiwi TCMS at {TCMS_URL}...")
    try:
        client = KiwiClient(TCMS_URL, TCMS_USER, TCMS_PASS)
    except Exception as e:
        print(f"ERROR: Cannot connect to Kiwi TCMS: {e}")
        print("Make sure Kiwi is running: docker compose up kiwi")
        print("Default creds: admin / admin (set in Kiwi UI on first run)")
        sys.exit(1)

    print("Connected.")

    # Setup product
    product_id = client.get_or_create_product(PRODUCT_NAME)
    version_id = client.get_or_create_version(product_id, PRODUCT_VERSION)
    print(f"Product: {PRODUCT_NAME} (id={product_id}, version={version_id})")

    # Get priorities
    priorities = client.get_priorities()
    prio_map = {p["value"]: p["id"] for p in priorities}

    created = 0
    updated = 0

    for mod in modules:
        mod_name = mod.get("module", "unknown")
        description = mod.get("description", "")
        tests = mod.get("tests", [])

        # Create plan for module
        plan_name = f"MedBrains — {mod_name}"
        plan_id = client.get_or_create_plan(plan_name, product_id, version_id)
        print(f"\n  Plan: {plan_name} (id={plan_id})")

        # Create category for module
        cat_id = client.get_or_create_category(product_id, mod_name)

        for test in tests:
            summary = f"[{test['id']}] {test['summary']}"
            priority_key = test.get("priority", "P1")
            prio_id = PRIORITY_MAP.get(priority_key, 2)
            is_auto = test.get("automated", False)

            # Build notes from steps + test_file
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

            # Check if exists
            existing = client.find_case(summary, plan_id)
            if existing:
                client.update_case(existing["id"], notes=notes, is_automated=is_auto)
                updated += 1
                print(f"    Updated: {summary}")
            else:
                client.create_case(summary, plan_id, cat_id, prio_id, notes=notes, is_automated=is_auto)
                created += 1
                print(f"    Created: {summary}")

    print(f"\nDone. Created: {created}, Updated: {updated}")


if __name__ == "__main__":
    main()

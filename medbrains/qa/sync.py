#!/usr/bin/env python3
"""
Sync YAML test-case definitions into Kiwi TCMS.

Usage:
    python sync.py                      # sync all YAML files
    python sync.py test-cases/fees.yml  # sync one file

Reads TCMS credentials from .env (TCMS_API_URL, TCMS_USERNAME, TCMS_PASSWORD).
"""

import os
import ssl
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from tcms_api import TCMS

load_dotenv(Path(__file__).parent / ".env")

PRODUCT_NAME = "MedBrains"
PRODUCT_VERSION = "0.1.0"

# Allow self-signed certs for local Kiwi
ssl._create_default_https_context = ssl._create_unverified_context

PRIORITY_MAP = {
    "high": "P1",
    "medium": "P3",
    "low": "P5",
    "critical": "P1",
}


def ensure_product(rpc):
    """Ensure product and version exist."""
    products = rpc.exec.Product.filter({"name": PRODUCT_NAME})
    if products:
        product = products[0]
    else:
        classifications = rpc.exec.Classification.filter({"name": "Software"})
        classification_id = classifications[0]["id"] if classifications else 1
        product = rpc.exec.Product.create(
            {"name": PRODUCT_NAME, "classification": classification_id}
        )

    versions = rpc.exec.Version.filter(
        {"product": product["id"], "value": PRODUCT_VERSION}
    )
    if not versions:
        rpc.exec.Version.create(
            {"product": product["id"], "value": PRODUCT_VERSION}
        )
    return product


def ensure_category(rpc, product_id, name):
    """Ensure test case category exists."""
    cats = rpc.exec.Category.filter({"product": product_id, "name": name})
    if cats:
        return cats[0]
    return rpc.exec.Category.create({"product": product_id, "name": name})


def ensure_plan(rpc, product_id, name, version_id):
    """Ensure test plan exists."""
    plans = rpc.exec.TestPlan.filter({"product": product_id, "name": name})
    if plans:
        return plans[0]
    plan_types = rpc.exec.PlanType.filter({})
    type_id = plan_types[0]["id"] if plan_types else 1
    return rpc.exec.TestPlan.create(
        {
            "product": product_id,
            "name": name,
            "product_version": version_id,
            "type": type_id,
            "text": f"Test plan for {name}",
        }
    )


def get_priority_id(rpc, name):
    """Map priority name (High/Medium/Low) to Kiwi P1-P5."""
    kiwi_name = PRIORITY_MAP.get(name.lower(), "P3")
    priorities = rpc.exec.Priority.filter({"value": kiwi_name})
    if priorities:
        return priorities[0]["id"]
    all_p = rpc.exec.Priority.filter({})
    return all_p[0]["id"] if all_p else 1


def format_steps_as_text(steps, preconditions=""):
    """Format steps into HTML text for Kiwi's `text` field (setup/actions)."""
    parts = []
    if preconditions:
        parts.append(f"<p><strong>Preconditions:</strong> {preconditions}</p>")
    parts.append("<table><tr><th>#</th><th>Action</th><th>Expected Result</th></tr>")
    for i, step_def in enumerate(steps, 1):
        if isinstance(step_def, str):
            action, expected = step_def, ""
        else:
            action = step_def.get("action", step_def.get("step", ""))
            expected = step_def.get("expected", "")
        parts.append(f"<tr><td>{i}</td><td>{action}</td><td>{expected}</td></tr>")
    parts.append("</table>")
    return "\n".join(parts)


def sync_file(rpc, product, version_id, filepath):
    """Sync a single YAML file into Kiwi TCMS."""
    with open(filepath) as f:
        data = yaml.safe_load(f)

    if not data:
        print(f"  Skipping empty file: {filepath}")
        return

    module_name = data.get("module", Path(filepath).stem)
    plan_name = data.get("plan", module_name)
    category_name = data.get("category", module_name)

    print(f"  Module: {module_name}")

    category = ensure_category(rpc, product["id"], category_name)
    plan = ensure_plan(rpc, product["id"], plan_name, version_id)

    cases = data.get("cases", [])
    created = 0
    updated = 0

    for case_def in cases:
        summary = case_def["summary"]
        priority = case_def.get("priority", "Medium")
        priority_id = get_priority_id(rpc, priority)
        steps = case_def.get("steps", [])
        preconditions = case_def.get("preconditions", "")
        text = format_steps_as_text(steps, preconditions)

        existing = rpc.exec.TestCase.filter(
            {"summary": summary, "plan": plan["id"]}
        )

        if existing:
            tc = existing[0]
            rpc.exec.TestCase.update(
                tc["id"],
                {
                    "priority": priority_id,
                    "notes": case_def.get("notes", ""),
                    "text": text,
                },
            )
            updated += 1
        else:
            tc = rpc.exec.TestCase.create(
                {
                    "summary": summary,
                    "product": product["id"],
                    "category": category["id"],
                    "priority": priority_id,
                    "case_status": 2,  # CONFIRMED
                    "notes": case_def.get("notes", ""),
                    "text": text,
                    "is_automated": case_def.get("automated", False),
                }
            )
            rpc.exec.TestPlan.add_case(plan["id"], tc["id"])
            created += 1

    print(f"    Created: {created}, Updated: {updated}, Total: {len(cases)}")


def main():
    rpc = TCMS(
        url=os.getenv("TCMS_API_URL", "https://localhost:9443/xml-rpc/"),
        username=os.getenv("TCMS_USERNAME", "admin"),
        password=os.getenv("TCMS_PASSWORD", "admin"),
    )

    product = ensure_product(rpc)
    versions = rpc.exec.Version.filter(
        {"product": product["id"], "value": PRODUCT_VERSION}
    )
    version_id = versions[0]["id"]

    qa_dir = Path(__file__).parent
    if len(sys.argv) > 1:
        files = [qa_dir / f for f in sys.argv[1:]]
    else:
        files = sorted(qa_dir.glob("test-cases/**/*.yml"))

    print(f"Syncing {len(files)} test-case file(s) to Kiwi TCMS...")
    print(f"Product: {PRODUCT_NAME} v{PRODUCT_VERSION}\n")

    errors = []
    for filepath in files:
        print(f"Processing: {filepath.name}")
        try:
            sync_file(rpc, product, version_id, filepath)
        except Exception as e:
            print(f"    ERROR: {e}")
            errors.append((filepath.name, str(e)))
        print()

    if errors:
        print(f"\n{len(errors)} file(s) had errors:")
        for name, err in errors:
            print(f"  - {name}: {err}")

    print("Done.")


if __name__ == "__main__":
    main()

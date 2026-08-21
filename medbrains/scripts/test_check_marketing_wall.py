#!/usr/bin/env python3
"""Prove the wall checker fails when the wall is breached.

A checker that has only ever seen compliant code is not evidence of anything.
This sweep has found three separate cases of a real guard reported as missing
because a tool could not see it; the mirror of that failure is a tool that
reports nothing because it cannot see a breach either.

Run: python3 scripts/test_check_marketing_wall.py
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_marketing_wall import check_reach, check_schema  # noqa: E402

CLEAN_MIGRATION = """
CREATE TABLE IF NOT EXISTS public.mkt_thing (
    id         uuid PRIMARY KEY,
    tenant_id  uuid NOT NULL,
    contact_id uuid NOT NULL,
    added_at   timestamptz NOT NULL DEFAULT now()
);
"""

BREACHED_MIGRATION = """
CREATE TABLE IF NOT EXISTS public.mkt_recall_list (
    id         uuid PRIMARY KEY,
    tenant_id  uuid NOT NULL,
    contact_id uuid NOT NULL,
    -- The whole point. A recall list with a diagnosis column IS the leak.
    icd_code   text,
    added_at   timestamptz NOT NULL DEFAULT now()
);
"""

CLEAN_RS = """
pub async fn list_things() {
    let _ = "SELECT id FROM mkt_contacts WHERE tenant_id = $1";
}
"""

BREACHED_RS = """
pub async fn sneaky_list() {
    let _ = "SELECT p.first_name FROM patients p WHERE p.tenant_id = $1";
}
"""


def in_temp(files: dict[str, str]):
    """Write files into a temp dir and return its path."""
    d = tempfile.mkdtemp(prefix="wall-test-")
    for name, body in files.items():
        with open(os.path.join(d, name), "w", encoding="utf-8") as fh:
            fh.write(body)
    return d


def main() -> int:
    failed = []

    clean = in_temp({"0001_clean.sql": CLEAN_MIGRATION})
    if check_schema(clean):
        failed.append("a clean migration was reported as a breach")

    breached = in_temp({"0002_breach.sql": BREACHED_MIGRATION})
    hits = check_schema(breached)
    if not hits:
        failed.append(
            "a mkt_ table declaring icd_code was NOT caught — the checker is "
            "decorative"
        )
    elif "icd_code" not in " ".join(hits):
        failed.append(f"caught something, but not the column: {hits}")

    clean_src = in_temp({"contacts.rs": CLEAN_RS})
    if check_reach(clean_src):
        failed.append("a marketing file reading only mkt_ tables was flagged")

    breached_src = in_temp({"reports.rs": BREACHED_RS})
    hits = check_reach(breached_src)
    if not hits:
        failed.append(
            "a marketing file selecting from `patients` was NOT caught — the "
            "reach rule is decorative"
        )

    # cohorts.rs is the one file allowed to reach across. If the exemption
    # stopped working the resolver would fail its own checker, which would
    # teach the next person to delete the rule rather than fix the code.
    allowed = in_temp({"cohorts.rs": BREACHED_RS})
    if check_reach(allowed):
        failed.append("cohorts.rs is the resolver and must stay exempt")

    if failed:
        print("=== WALL CHECKER SELF-TEST FAILED ===\n")
        for line in failed:
            print(f"  ✗ {line}")
        return 1

    print("wall checker self-test: OK (5 cases)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

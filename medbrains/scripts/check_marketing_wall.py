#!/usr/bin/env python3
"""Keep the marketing schema free of clinical data.

A recall campaign is a list of people with a condition. The design keeps the
criteria on the clinical side and lets only identities cross into `mkt_*`, and
that is a property of the code rather than of anybody's intention — so it is
checked.

Two rules:

1. **No `mkt_*` table may carry a clinical column.** Not a diagnosis, not an
   ICD code, not a procedure, not an encounter date. If a cohort needs one, the
   answer is a cohort, not a column.

2. **Only `cohorts.rs` may name a clinical table**, and only to resolve ids.
   The single INSERT ... SELECT there joins straight to `mkt_contacts` and
   selects `c.id` — nothing about why a patient qualified is ever read out.

Neither rule is clever. Both are the kind of thing that stays true for a year
and then quietly stops being true in a hurry.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS = os.path.join(ROOT, "crates", "medbrains-db", "src", "migrations")
MARKETING = os.path.join(ROOT, "crates", "medbrains-marketing", "src")

CLINICAL_COLUMNS = re.compile(
    r"\b(diagnosis|diagnoses|icd_code|icd10|snomed|procedure_code|cpt_code|"
    r"encounter_id|admission_id|allergy|medication|lab_result|condition_code)\b",
    re.I,
)
CLINICAL_TABLES = re.compile(
    r"\b(FROM|JOIN|INTO|UPDATE)\s+(patients|encounters|admissions|diagnoses|"
    r"prescriptions|lab_orders|lab_results|pharmacy_orders)\b",
    re.I,
)
# The one file allowed to reach across, and only under the clinical permission.
RESOLVER = "cohorts.rs"


def check_schema() -> list[str]:
    failures = []
    for name in sorted(os.listdir(MIGRATIONS)):
        if not name.endswith(".sql"):
            continue
        text = open(os.path.join(MIGRATIONS, name), encoding="utf-8").read()
        for block in re.finditer(
            r"CREATE TABLE[^;]*?public\.(mkt_\w+)\s*\((.*?)\n\);", text, re.S
        ):
            table, body = block.group(1), block.group(2)
            body = re.sub(r"--[^\n]*", "", body)
            hit = CLINICAL_COLUMNS.search(body)
            if hit:
                failures.append(
                    f"{name}: {table} declares a clinical column '{hit.group(0)}' — "
                    "the answer is a cohort, not a column"
                )
    return failures


def check_reach() -> list[str]:
    failures = []
    for dirpath, _, files in os.walk(MARKETING):
        for name in sorted(files):
            if not name.endswith(".rs") or name == RESOLVER:
                continue
            path = os.path.join(dirpath, name)
            text = re.sub(r"//[^\n]*", "", open(path, encoding="utf-8").read())
            hit = CLINICAL_TABLES.search(text)
            if hit:
                failures.append(
                    f"{name}: reads the clinical table '{hit.group(2)}'. Only "
                    f"{RESOLVER} may, and only to resolve contact ids under "
                    "marketing.cohorts.clinical_define"
                )
    return failures


def main() -> int:
    failures = check_schema() + check_reach()
    if failures:
        print("=== MARKETING WALL BREACHED ===\n")
        for line in failures:
            print(f"  ✗ {line}")
        print(
            "\nA marketing user reading every row in mkt_* must learn that some "
            "number of\npeople are worth calling, and nothing about why."
        )
        return 1
    print("marketing wall: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

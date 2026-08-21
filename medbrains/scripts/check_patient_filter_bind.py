#!/usr/bin/env python3
"""Ban a permitted-patient predicate that no permitted-patient set reaches.

The array form this sweep installs everywhere is

    WHERE ($n::uuid[] IS NULL OR patient_id = ANY($n))
    ...
    .bind(permitted_patients.as_deref())

`list_dialysis_sessions` and `list_chemo_protocols` had the predicate and
bound the raw `?patient_id` query parameter instead. Unparameterised the
predicate reads `NULL::uuid[] IS NULL` and returns every patient's rows;
parameterised it binds a `Uuid` where the statement declares `uuid[]`. Runtime
`query_as` is not compile-checked, so neither failure showed anywhere — not in
cargo, not in the gate, not in the ledger, which counted the handler as
filtered because the predicate was there.

A half-applied guard is worse than none: it reads as done.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from authz_ledger import split_handlers  # noqa: E402

PREDICATE = "::uuid[] IS NULL"
PERMITTED = re.compile(
    r"\.bind\(\s*&?(?:permitted_patients|permitted|visible|visible_patients|"
    r"allowed_patients|permitted_ids)\b"
)


def main() -> int:
    offenders: list[str] = []
    for dirpath, _, files in os.walk(os.path.join(ROOT, "crates")):
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            try:
                text = open(path, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            if PREDICATE not in text:
                continue
            for fn, raw in split_handlers(text):
                body = re.sub(r"//[^\n]*", "", raw)
                if PREDICATE not in body:
                    continue
                if PERMITTED.search(body) or ".as_deref()" in body:
                    continue
                offenders.append(f"{os.path.relpath(path, ROOT)}  {fn}")

    if offenders:
        print("A uuid[] patient predicate with no permitted-set bound to it:\n")
        for line in offenders:
            print(f"  {line}")
        print(
            "\nThe predicate is there and the set is not, so the query returns "
            "every patient's rows.\nBind patient_filter's result: "
            ".bind(permitted_patients.as_deref())"
        )
        return 1
    print("patient-filter binds: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

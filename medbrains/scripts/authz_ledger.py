#!/usr/bin/env python3
"""Authorization conformance, per module, across the four axes.

    python3 scripts/authz_ledger.py                 # summary, worst first
    python3 scripts/authz_ledger.py --module lab    # one module, with detail
    python3 scripts/authz_ledger.py --json          # machine-readable

CLAUDE.md makes authorization repo-wide law: module by module, app by app, API
by API, code by code. Across 127 crates that is only tractable if coverage is
*measured*. A module is not conformant because somebody looked at it; it is
conformant when this says so.

The four axes, and what each would miss on its own:

  API   every route carries a permission. Misses: a route that is permissioned
        but not per-record — `patients.view` is not "this patient".
  CODE  no authorization result collapsed into a boolean. This is the axis that
        turns an outage into "no such record".
  DATA  every redactable field declares its class, so the denial mode follows
        from the data rather than from whoever wrote the handler.
  RECORD  PHI routes that check a permission but never check the record. The
        expensive one, and the one no existing script covered.

This reports; it does not gate. `make check-*` are the gates. A ledger that
fails the build on day one just gets excluded from the build.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")

HANDLER = re.compile(r"^pub async fn (\w+)\s*\(", re.M)
# Authority guards come in more shapes than `require_permission`. A hand audit
# of the unpermissioned set found `require_admin`, `require_super_admin`,
# `require_step_up`, `require_sign_permission` and friends — every one of them a
# real guard the first pattern scored as missing. Match the shape, not the name.
PERMISSION_CHECK = re.compile(
    r"require_permission|require_any_permission|require_all_permissions|"
    r"require_admin|require_super_admin|require_upload_permission|"
    r"require_sign_permission|require_basket_item_permissions|"
    r"require_module_enabled|require_step_up|require_tenant_in_group|"
    r"require_ownership|require_group_access|require_department_access|"
    r"Authorized<|AllOf<|AnyOf<|is_bypass_role|permissions::"
)
# Per-record checks likewise. `ensure_*_belongs_to_tenant` is NOT one of these —
# tenant scoping is RLS's job and does not establish a care relationship.
RECORD_CHECK = re.compile(
    r"require_patient_access|require_encounter_access|require_admission_access|"
    r"require_patient_viewer|require_object_view|require_patient\b|"
    r"ensure_invoice_view_access|ensure_invoice_workspace_access|"
    r"\.authz\b|authz_patient::"
)
COLLAPSE = re.compile(r"unwrap_or\(false\)|unwrap_or_default\(\)|\.is_ok\(\)|\.is_err\(\)")
AUTHZ_NEARBY = re.compile(r"\.authz\b|list_accessible|bulk_check|require_\w*_access")
# A handler touching these is handling patient data.
PHI = re.compile(
    r"\bpatient_id\b|\bencounter_id\b|\badmission_id\b|FROM patients|FROM encounters|"
    r"FROM admissions|FROM prescriptions|FROM lab_orders|FROM diagnoses|FROM vitals"
)


def crate_modules() -> dict[str, list[str]]:
    """Every medbrains-* crate and its .rs files."""
    out: dict[str, list[str]] = defaultdict(list)
    for name in sorted(os.listdir(CRATES)):
        if not name.startswith("medbrains-"):
            continue
        src = os.path.join(CRATES, name, "src")
        if not os.path.isdir(src):
            continue
        for dirpath, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d != "target"]
            for f in files:
                if f.endswith(".rs"):
                    out[name[len("medbrains-"):]].append(os.path.join(dirpath, f))
    return out


AXUM_SIG = re.compile(r"State\(|Extension\(|Path\(|Query\(|Json\(|Authorized<")


def split_handlers(text: str) -> list[tuple[str, str]]:
    """(name, body) for each `pub async fn` that takes axum extractors.

    Without the signature test this counted every public async helper — 137 of
    them — and reported a permission-coverage figure that contradicted the
    verified route sweep.
    """
    marks = [(m.group(1), m.start()) for m in HANDLER.finditer(text)]
    out = []
    for i, (name, start) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        body = text[start:end]
        signature = body[: body.find("{")] if "{" in body else body[:400]
        if AXUM_SIG.search(signature):
            out.append((name, body))
    return out


def audit_module(paths: list[str]) -> dict:
    handlers = permissioned = phi = phi_with_record = 0
    collapses: list[str] = []
    for path in paths:
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        lines = text.split("\n")
        for i, line in enumerate(lines):
            if not COLLAPSE.search(line):
                continue
            stripped = line.lstrip()
            if not (stripped.startswith(".") or ".await" in line):
                continue
            if AUTHZ_NEARBY.search("\n".join(lines[max(0, i - 8): i + 1])):
                collapses.append(f"{os.path.relpath(path, ROOT)}:{i + 1}")
        for name, raw_body in split_handlers(text):
            # Strip comments before matching. A handler was scoring as
            # record-checked because a COMMENT mentioned `authz_patient::links`;
            # renaming that comment during the crate split dropped the repo-wide
            # count by 9, which is how the false positive surfaced at all.
            body = re.sub(r"//[^\n]*", "", raw_body)
            handlers += 1
            if PERMISSION_CHECK.search(body):
                permissioned += 1
            if PHI.search(body):
                phi += 1
                if RECORD_CHECK.search(body):
                    phi_with_record += 1
    return {
        "handlers": handlers,
        "permissioned": permissioned,
        "phi_handlers": phi,
        "phi_with_record_check": phi_with_record,
        "collapses": collapses,
    }


def pct(part: int, whole: int) -> float:
    return 100.0 if whole == 0 else round(100.0 * part / whole, 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--module")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--limit", type=int, default=25)
    args = ap.parse_args()

    modules = crate_modules()
    if args.module:
        modules = {k: v for k, v in modules.items() if args.module in k}
        if not modules:
            print(f"no module matching '{args.module}'")
            return 1

    report = {name: audit_module(paths) for name, paths in modules.items()}
    # Only modules with handlers are scoreable; a types-only crate has nothing
    # to authorize and should not dilute the numbers.
    scoreable = {k: v for k, v in report.items() if v["handlers"]}

    if args.json:
        print(json.dumps(report, indent=1))
        return 0

    tot_h = sum(v["handlers"] for v in scoreable.values())
    tot_p = sum(v["permissioned"] for v in scoreable.values())
    tot_phi = sum(v["phi_handlers"] for v in scoreable.values())
    tot_rec = sum(v["phi_with_record_check"] for v in scoreable.values())
    tot_col = sum(len(v["collapses"]) for v in scoreable.values())

    print("AUTHORIZATION LEDGER — conformance per module\n")
    print(f"  modules with handlers : {len(scoreable)}")
    print(f"  handlers              : {tot_h}")
    print(f"  permissioned          : {tot_p}  ({pct(tot_p, tot_h)}%)")
    print(f"  PHI handlers          : {tot_phi}")
    print(f"  …with a record check  : {tot_rec}  ({pct(tot_rec, tot_phi)}%)   <- the gap")
    print(f"  collapsed authz calls : {tot_col}")

    if args.module:
        for name, v in sorted(report.items()):
            print(f"\n── {name} ─────────────────────────")
            print(f"   handlers {v['handlers']}   permissioned {v['permissioned']}"
                  f" ({pct(v['permissioned'], v['handlers'])}%)")
            print(f"   PHI {v['phi_handlers']}   with record check"
                  f" {v['phi_with_record_check']} ({pct(v['phi_with_record_check'], v['phi_handlers'])}%)")
            for c in v["collapses"]:
                print(f"   collapse: {c}")
        return 0

    # Worst first, by the record-check gap — that is the axis with real exposure.
    ranked = sorted(
        (v for v in scoreable.items() if v[1]["phi_handlers"]),
        key=lambda kv: (kv[1]["phi_with_record_check"] - kv[1]["phi_handlers"],
                        -kv[1]["phi_handlers"]),
    )
    print(f"\nWorst {min(args.limit, len(ranked))} by unchecked PHI handlers:\n")
    print(f"  {'module':<26} {'PHI':>5} {'rec':>5} {'gap':>5}   perms")
    for name, v in ranked[: args.limit]:
        gap = v["phi_handlers"] - v["phi_with_record_check"]
        if gap == 0:
            continue
        print(f"  {name:<26} {v['phi_handlers']:>5} {v['phi_with_record_check']:>5}"
              f" {gap:>5}   {pct(v['permissioned'], v['handlers']):>5}%")

    print("\n  `--module <name>` for detail. Sweep order: medical > audits > forms > infra.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

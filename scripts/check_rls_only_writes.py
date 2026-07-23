#!/usr/bin/env python3
"""Writes isolated by nothing but row-level security.

`UPDATE cssd_instruments SET ... WHERE id = $1`, with the id taken from the
request path, reaches whatever row carries that id. The handler runs inside a
transaction with `set_tenant_context`, and the intent is plainly that the
table's policy supplies the missing tenant predicate.

It does not. PostgreSQL skips a policy for the table's owner unless the table
also declares `FORCE ROW LEVEL SECURITY`; 648 of the 733 policed tables do not,
and the application connects as the owner. Confirmed against a live server:
under one hospital's context, the owner both reads and updates another
hospital's `patients` row. See `docs/RLS-EFFECTIVENESS.md` for the
reproduction and the options — the recommended repair is a connection role that
does not own the tables, which fixes every entry below at once.

Until then this is a ratchet, in the same spirit as `check_tenant_leak.py`: the
71 writes already in this shape are recorded so the surface cannot grow, and a
new write keyed only on a caller-supplied id fails the build. Reaching another
tenant's row needs its UUID, so none of these is enumerable — but none is
isolated either.

Writes that name `tenant_id` themselves, and writes that take no id from the
request, are not counted; 61 of those exist and they are already safe.

Exit codes:
    0  Unscoped writes match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CRATES = REPO_ROOT / "medbrains" / "crates"

# (file, handler) writes keyed only on a caller-supplied id. This set may
# shrink and must not grow. Deleting an entry once the write carries a tenant
# predicate is the point.
RECORDED_UNSCOPED_WRITES = {
    ("medbrains-admin/src/blog.rs", "delete_blog"),
    ("medbrains-admin/src/multi_hospital.rs", "delete_doctor_rotation"),
    ("medbrains-admin/src/multi_hospital.rs", "delete_group"),
    ("medbrains-admin/src/multi_hospital.rs", "delete_region"),
    ("medbrains-analytics/src/care_view.rs", "update_primary_nurse"),
    ("medbrains-ancillary/src/front_office.rs", "resolve_enquiry"),
    ("medbrains-care-mgmt/src/chronic_care.rs", "delete_program"),
    ("medbrains-consent/src/lib.rs", "delete_signature"),
    ("medbrains-consent/src/lib.rs", "delete_template"),
    ("medbrains-cssd/src/lib.rs", "create_maintenance_log"),
    ("medbrains-cssd/src/lib.rs", "recall_issuance"),
    ("medbrains-cssd/src/lib.rs", "return_issuance"),
    ("medbrains-cssd/src/lib.rs", "update_instrument"),
    ("medbrains-cssd/src/lib.rs", "update_load_status"),
    ("medbrains-cssd/src/lib.rs", "update_sterilizer"),
    ("medbrains-dashboard/src/lib.rs", "admin_delete_dashboard"),
    ("medbrains-dashboard/src/lib.rs", "admin_set_role_widget_access"),
    ("medbrains-dashboard/src/lib.rs", "admin_set_user_widget_access"),
    ("medbrains-dashboard/src/lib.rs", "admin_update_dashboard"),
    ("medbrains-dashboard/src/lib.rs", "admin_update_layout"),
    ("medbrains-dashboard/src/lib.rs", "my_remove_widget"),
    ("medbrains-dashboard/src/lib.rs", "my_toggle_widget"),
    ("medbrains-devices/src/lib.rs", "decommission_device"),
    ("medbrains-devices/src/lib.rs", "delete_routing_rule"),
    ("medbrains-diet/src/lib.rs", "update_diet_order"),
    ("medbrains-diet/src/lib.rs", "update_inventory_item"),
    ("medbrains-diet/src/lib.rs", "update_meal_prep_status"),
    ("medbrains-diet/src/lib.rs", "update_template"),
    ("medbrains-identity/src/sso.rs", "delete_mapping"),
    ("medbrains-identity/src/sso.rs", "delete_provider"),
    ("medbrains-identity/src/sso.rs", "update_provider"),
    ("medbrains-it-security/src/lib.rs", "acknowledge_access_alert"),
    ("medbrains-it-security/src/lib.rs", "approve_disposal"),
    ("medbrains-it-security/src/lib.rs", "approve_incentive"),
    ("medbrains-it-security/src/lib.rs", "cancel_migration"),
    ("medbrains-it-security/src/lib.rs", "complete_tat_record"),
    ("medbrains-it-security/src/lib.rs", "delete_sensitive_patient"),
    ("medbrains-it-security/src/lib.rs", "execute_disposal"),
    ("medbrains-it-security/src/lib.rs", "mark_incentive_paid"),
    ("medbrains-it-security/src/lib.rs", "report_to_cert_in"),
    ("medbrains-it-security/src/lib.rs", "resolve_dq_issue"),
    ("medbrains-it-security/src/lib.rs", "update_compliance_requirement"),
    ("medbrains-it-security/src/lib.rs", "update_security_incident"),
    ("medbrains-it-security/src/lib.rs", "update_vulnerability"),
    ("medbrains-lab/src/lib.rs", "assign_phlebotomist"),
    ("medbrains-lab/src/lib.rs", "auto_validate_result"),
    ("medbrains-lms/src/lib.rs", "delete_course"),
    ("medbrains-lms/src/lib.rs", "my_course_detail"),
    ("medbrains-lms/src/lib.rs", "reorder_modules"),
    ("medbrains-lms/src/lib.rs", "submit_quiz_attempt"),
    ("medbrains-lms/src/lib.rs", "update_course"),
    ("medbrains-lms/src/lib.rs", "update_enrollment"),
    ("medbrains-lms/src/lib.rs", "update_path"),
    ("medbrains-lms/src/lib.rs", "update_progress"),
    ("medbrains-lms/src/lib.rs", "update_quiz"),
    ("medbrains-mrd/src/lib.rs", "attach_form_document"),
    ("medbrains-mrd/src/lib.rs", "complete_form_record"),
    ("medbrains-mrd/src/lib.rs", "issue_record"),
    ("medbrains-mrd/src/lib.rs", "verify_form_record"),
    ("medbrains-news/src/lib.rs", "delete_article"),
    ("medbrains-order-sets/src/lib.rs", "create_new_version"),
    ("medbrains-order-sets/src/lib.rs", "delete_template"),
    ("medbrains-server-core/src/notifications.rs", "mark_notification_read"),
    ("medbrains-server/src/routes/admin_simulator.rs", "delete_schedule"),
    ("medbrains-server/src/routes/appointments/schedules.rs", "delete_exception"),
    ("medbrains-server/src/routes/appointments/schedules.rs", "delete_schedule"),
    ("medbrains-setup/src/lib.rs", "delete_brand_entity"),
    ("medbrains-setup/src/lib.rs", "delete_insurance_provider"),
    ("medbrains-setup/src/lib.rs", "reset_user_password"),
    ("medbrains-specialty-interventional/src/lib.rs", "create_biopsy_specimen"),
    ("medbrains-specialty-interventional/src/lib.rs", "create_stemi_event"),
}

FUNCTION = re.compile(r"^(?:pub )?(?:async )?fn (\w+)\(", re.M)
# One `sqlx::query…` call through its bind chain to the awaiting execute.
# Spanned to `.await` rather than by balancing parens, because the SQL is often
# a `format!` and the parens nest.
STATEMENT = re.compile(r"sqlx::query\w*(?:::<[^>]*>)?\(.*?\.await", re.S)
WRITE = re.compile(r"\b(?:UPDATE|DELETE FROM)\b")
EXTRACTED = re.compile(r"(?:Path|Query)\((\w+)\)")


def main() -> int:
    if not CRATES.exists():
        print(f"ERROR: {CRATES} not found", file=sys.stderr)
        return 2

    scoped = 0
    seen: set[tuple[str, str]] = set()
    failures: list[str] = []

    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path) or "loadtest" in str(path) or "seed" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        functions = [(m.start(), m.group(1)) for m in FUNCTION.finditer(text)]

        for index, (start, name) in enumerate(functions):
            end = functions[index + 1][0] if index + 1 < len(functions) else len(text)
            body = text[start:end]
            if "Extension(claims)" not in body:
                continue
            extracted = set(EXTRACTED.findall(body))
            if not extracted:
                continue

            for statement in STATEMENT.finditer(body):
                sql = statement.group(0)
                literal = " ".join(re.findall(r'"((?:[^"\\]|\\.)*)"', sql))
                if not WRITE.search(literal.upper()):
                    continue
                if "tenant_id" in literal:
                    scoped += 1
                    continue
                bound = set(re.findall(r"\.bind\(&?(\w+)\)", sql))
                if not extracted & bound:
                    scoped += 1
                    continue

                where = (str(path.relative_to(CRATES)), name)
                seen.add(where)
                if where in RECORDED_UNSCOPED_WRITES:
                    continue
                line = text[:start].count("\n") + body[: statement.start()].count("\n") + 1
                failures.append(f"{name} — {where[0]}:{line}")

    fixed = RECORDED_UNSCOPED_WRITES - seen
    print(
        f"writes carrying a tenant predicate or no caller id: {scoped} | "
        f"isolated only by RLS: {len(seen)}"
    )
    if fixed:
        print(f"\n{len(fixed)} recorded write(s) now scoped — remove from the set:")
        for entry in sorted(fixed):
            print(f"  · {entry[1]} in {entry[0]}")

    if failures:
        print(f"\n=== {len(failures)} NEW WRITE ISOLATED ONLY BY RLS ===")
        for failure in sorted(failures):
            print(f"  ✗ {failure}")
        print(
            "\nRLS does not run for the role the app connects as, so nothing stops "
            "this reaching another tenant's row. Add a tenant_id predicate — see "
            "docs/RLS-EFFECTIVENESS.md."
        )
        return 1

    print("✓ Writes isolated only by RLS match what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

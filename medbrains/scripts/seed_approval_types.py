#!/usr/bin/env python3
"""Seed a config-only request type, to prove the platform end to end.

    python3 scripts/seed_approval_types.py --dry-run
    python3 scripts/seed_approval_types.py

A deliberately tier-0 type: no `effect_key`, so no Rust code exists or needs
to. Approving it *is* the outcome. That is the case the whole platform is
arranged around — an administrator adding "request a parking pass" without a
deployment — and it is the honest first thing to prove, because it exercises
the catalog, the form schema, chain resolution, approver resolution, the
guarded decision and the audit trail without any domain plugin involved.

This is a script rather than a migration on purpose. A demonstration request
type belongs in a developer's database, not in every hospital's schema.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TYPE_CODE = "facilities.parking_pass"

# The form, as data. This is the Frappe DocType idea and the reason tier 0
# needs no code: a new request type is rows, not a deployment.
FIELDS = [
    ("vehicle_registration", "Vehicle registration", "text", True, 1),
    ("vehicle_type", "Vehicle type", "select", True, 2),
    ("from_date", "Required from", "date", True, 3),
    ("months", "Months required", "number", True, 4),
]

OPTIONS = {"vehicle_type": {"choices": ["Two-wheeler", "Car", "Other"]}}


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def build_sql(tenant_id: str) -> str:
    """One transaction. A half-seeded type is worse than none: the catalog
    would offer a request whose chain does not exist, and the failure would
    surface to whoever tried to raise it rather than to whoever seeded it."""
    fields = ",\n        ".join(
        "(%s, %s, %s, %s, %s, %s, %s, %s)"
        % (
            sql_literal(tenant_id),
            "(SELECT id FROM t)",
            sql_literal(key),
            sql_literal(label),
            sql_literal(kind),
            sql_literal(required),
            sql_literal(json.dumps(OPTIONS.get(key, {}))) + "::jsonb",
            order,
        )
        for key, label, kind, required, order in FIELDS
    )
    return f"""
BEGIN;
SET LOCAL app.tenant_id = {sql_literal(tenant_id)};

WITH t AS (
    INSERT INTO request_types
        (tenant_id, code, name, module, description, icon,
         requires_justification, max_duration_hours, effect_key)
    VALUES ({sql_literal(tenant_id)}, {sql_literal(TYPE_CODE)}, 'Parking pass',
            'facilities',
            'A staff parking permit. Approved by the facilities team.',
            'car',
            true,
            -- Twelve months. The Microsoft PIM idea applied to something
            -- mundane: a permit that never expires is a permit nobody revisits.
            8760,
            -- No effect. Approving the request *is* the outcome, which is what
            -- makes this a tier-0 type and why it needs no Rust at all.
            NULL)
    ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING
    RETURNING id
)
INSERT INTO request_type_fields
    (tenant_id, request_type_id, key, label, field_type, is_required, options, sort_order)
VALUES
        {fields};

WITH w AS (
    INSERT INTO approval_workflows
        (tenant_id, request_type_id, code, name, version, conditions, sla_hours)
    SELECT {sql_literal(tenant_id)}, rt.id, 'facilities.parking_pass.default',
           'Parking pass — facilities approval', 1,
           -- No conditions, so this chain applies to every parking request.
           '{{}}'::jsonb, 72
    FROM request_types rt
    WHERE rt.tenant_id = {sql_literal(tenant_id)} AND rt.code = {sql_literal(TYPE_CODE)}
    RETURNING id, request_type_id
)
INSERT INTO approval_workflow_steps
    (tenant_id, workflow_id, seq, name, approver_rule, quorum, requires_witness, sla_hours)
SELECT {sql_literal(tenant_id)}, w.id, 1, 'Facilities',
       -- A permission rule rather than a role: what matters is who is allowed
       -- to manage facilities, not what their job is called.
       '{{"kind": "permission", "permission": "facilities.manage"}}'::jsonb,
       1, false, 72
FROM w;

UPDATE request_types rt
   SET default_workflow_id = w.id
  FROM approval_workflows w
 WHERE w.request_type_id = rt.id
   AND rt.tenant_id = {sql_literal(tenant_id)}
   AND rt.code = {sql_literal(TYPE_CODE)};

COMMIT;
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-id", default=None, help="defaults to the only tenant present")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tenant_id = args.tenant_id
    if not tenant_id:
        found = subprocess.run(
            ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "medbrains",
             "-d", "medbrains", "-At", "-c", "SELECT id FROM tenants LIMIT 2;"],
            cwd=ROOT, capture_output=True, text=True,
        ).stdout.split()
        if len(found) != 1:
            raise SystemExit(
                f"expected exactly one tenant, found {len(found)} — pass --tenant-id"
            )
        tenant_id = found[0]

    sql = build_sql(tenant_id)
    if args.dry_run:
        print(sql)
        return 0

    result = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "medbrains",
         "-d", "medbrains", "-v", "ON_ERROR_STOP=1", "-q"],
        cwd=ROOT, input=sql, capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"seed failed:\n{result.stderr[:1200]}")

    print(f"seeded '{TYPE_CODE}' for tenant {tenant_id}")
    print("  1 request type, 4 form fields, 1 workflow, 1 approval stage")
    print("\nRaise one once the backend has been restarted:")
    print("  POST /api/approvals/requests")
    print('  {"kind": "facilities.parking_pass", "reason": "…",')
    print('   "payload": {"vehicle_registration": "TN01AB1234", "months": 12}}')
    return 0


if __name__ == "__main__":
    sys.exit(main())

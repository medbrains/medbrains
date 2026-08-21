#!/usr/bin/env python3
"""Add permission guards to print-data handlers that have none.

    python3 scripts/guard_print_data.py hr        # one module
    python3 scripts/guard_print_data.py --check   # what is still unguarded

## Why a script rather than 44 hand edits

Four files in `medbrains-print-data` — academic, bme, admin, hr — were written
without any authorisation at all: 44 handlers that do not take `Claims`, so
they cannot check who is asking. Every one returns a printable document, which
means any authenticated user of any role could print any record by id.

The edit itself is identical in all 44 cases: one parameter, one or two
`require_permission` calls. Doing that by hand invites exactly the kind of
inconsistency that produced the gap — clinical.rs has 17 guarded handlers and
7 that were missed.

**The permission choice is not mechanical**, so it is not guessed. Each entry
below is a deliberate mapping, and the ones without an obvious owner carry the
reasoning. The script only applies them.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "crates/medbrains-print-data/src")

# handler -> (permissions, note explaining a non-obvious choice)
#
# `patients::VIEW` is added wherever the document names a patient: printing a
# form about a person is reading their record, whatever else it is.
GUARDS: dict[str, dict[str, tuple[list[str], str | None]]] = {
    "hr": {
        "get_employee_id_card_print_data": (["permissions::hr::employees::LIST"], None),
        "get_duty_roster_print_data": (["permissions::hr::roster::LIST"], None),
        "get_leave_application_print_data": (["permissions::hr::leave::LIST"], None),
        "get_staff_attendance_print_data": (["permissions::hr::attendance::LIST"], None),
        "get_training_certificate_print_data": (["permissions::hr::training::LIST"], None),
        "get_staff_credentials_print_data": (
            ["permissions::hr::credentials::LIST"],
            "Credentials are the registration and licence numbers a clinician\n    // practises under. Kept to the HR permission rather than a general staff\n    // one — a roster does not entitle you to somebody's medical council number.",
        ),
        "get_visitor_register_print_data": (
            ["permissions::front_office::visitors::LIST"],
            "The visitor register belongs to front office, not HR, despite living\n    // in this file — it records who came to see which patient.",
        ),
    },
    "bme": {
        "get_amc_contract_print_data": (["permissions::bme::contracts::LIST"], None),
        "get_calibration_certificate_print_data": (["permissions::bme::calibration::LIST"], None),
        "get_equipment_breakdown_print_data": (["permissions::bme::breakdowns::LIST"], None),
        "get_equipment_history_print_data": (["permissions::bme::equipment::LIST"], None),
        "get_mgps_log_print_data": (
            ["permissions::facilities::gas::LIST"],
            "Medical gas pipeline system — a facilities utility, not biomedical\n    // equipment, despite sitting in this file.",
        ),
        "get_water_quality_print_data": (["permissions::facilities::water::LIST"], None),
        "get_dg_ups_log_print_data": (
            ["permissions::facilities::energy::LIST"],
            "Diesel generator and UPS logs are the energy record.",
        ),
        "get_fire_inspection_print_data": (["permissions::facilities::fire::LIST"], None),
        "get_fire_mock_drill_print_data": (["permissions::facilities::fire::LIST"], None),
        "get_materiovigilance_print_data": (
            ["permissions::regulatory::materiovigilance::LIST"],
            "Device adverse-event reporting is a regulatory submission, so it is\n    // guarded as one rather than as equipment maintenance.",
        ),
    },
    "admin": {
        "get_indent_form_print_data": (["permissions::indent::LIST"], None),
        # The dotted code is "procurement.po.list" but the Rust module is
        # `purchase_orders`. The two do not have to match, and here they do not.
        "get_purchase_order_print_data": (
            ["permissions::procurement::purchase_orders::LIST"],
            None,
        ),
        "get_grn_print_data": (["permissions::procurement::grn::LIST"], None),
        "get_material_issue_voucher_print_data": (["permissions::indent::LIST"], None),
        "get_stock_transfer_note_print_data": (
            ["permissions::indent::STOCK_MANAGE"],
            "No read-only stock permission exists, so this requires the manage one.\n    // Stricter than ideal, and the right way to be wrong here.",
        ),
        "get_ndps_register_print_data": (
            ["permissions::pharmacy::ndps::LIST"],
            "The NDPS register is a statutory narcotics record under the NDPS Act\n    // 1985. Printing it is a controlled-substance disclosure.",
        ),
        "get_drug_expiry_alert_print_data": (["permissions::pharmacy::stock::MANAGE"], None),
        # A flat constant, not a nested module — again, the dotted code
        # "indent.condemnation.list" does not describe the Rust path.
        "get_equipment_condemnation_print_data": (["permissions::indent::CONDEMNATION_LIST"], None),
        "get_work_order_print_data": (["permissions::facilities::work_orders::LIST"], None),
        "get_pm_checklist_print_data": (["permissions::bme::pm::LIST"], None),
    },
}


def patch(module: str) -> int:
    path = os.path.join(SRC, f"{module}.rs")
    with open(path, encoding="utf-8") as handle:
        source = handle.read()

    guards = GUARDS[module]
    applied = 0

    for handler, (permissions, note) in guards.items():
        signature = re.search(
            r"pub async fn " + re.escape(handler) + r"\(\n(\s*)State\(state\): State<AppState>,\n",
            source,
        )
        if not signature:
            print(f"  skipped {handler}: signature not in the expected shape")
            continue
        # Idempotency is per handler, not per permission. Checking whether the
        # permission appears anywhere in the file silently skipped the second
        # handler that legitimately shares one with a sibling — fire inspection
        # and fire mock drill are both `facilities::fire::LIST`.
        existing = re.search(
            r"pub async fn " + re.escape(handler) + r"\(.*?\n\}", source, re.S
        )
        if existing and "require_permission" in existing.group(0):
            continue

        indent = signature.group(1)
        source = (
            source[: signature.end()]
            + f"{indent}Extension(claims): Extension<Claims>,\n"
            + source[signature.end() :]
        )

        body = re.search(
            r"pub async fn " + re.escape(handler) + r"\(.*?\) -> Result<[^\n]*\{\n",
            source,
            re.S,
        )
        if not body:
            print(f"  skipped {handler}: could not find the body")
            continue

        block = ""
        if note:
            block += f"    // {note}\n"
        for permission in permissions:
            block += f"    require_permission(&claims, {permission})?;\n"
        block += "\n"
        source = source[: body.end()] + block + source[body.end() :]
        applied += 1

    # Imports, only if something was added and they are not already there.
    if applied:
        if "Extension, Json," not in source:
            source = source.replace("use axum::{\n    Json,", "use axum::{\n    Extension, Json,", 1)
        if "middleware::auth::Claims" not in source:
            source = source.replace(
                "use medbrains_server_core::error::AppError;",
                "use medbrains_server_core::error::AppError;\n"
                "use medbrains_server_core::middleware::auth::Claims;\n"
                "use medbrains_server_core::middleware::authorization::require_permission;",
                1,
            )
        if "use medbrains_core::permissions;" not in source:
            source = source.replace(
                "use medbrains_core::print_data::{",
                "use medbrains_core::permissions;\nuse medbrains_core::print_data::{",
                1,
            )

    with open(path, "w", encoding="utf-8") as handle:
        handle.write(source)
    return applied


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    module = sys.argv[1]
    if module not in GUARDS:
        print(f"no mapping defined for {module!r}. Known: {', '.join(GUARDS)}")
        return 1
    count = patch(module)
    print(f"{module}.rs: guarded {count} handler(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

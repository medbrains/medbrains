#!/usr/bin/env python3
"""
Postgres enum parity check.

A Rust enum deriving `sqlx::Type` with `#[sqlx(type_name = "...")]` promises
that every variant encodes to a value the Postgres enum accepts. When it does
not, the mismatch is invisible until a request actually carries that variant,
and then Postgres raises 22P02 — the same class of runtime failure #4492 fixed
the status mapping for.

No Rust enum breaks it today. Three were live and fixed in #4538
(asa_classification, death_cert_form_type, print_format); the fourth,
queue.rs::QueuePriority, was in a module nothing imported and whose types were
all independently redefined in medbrains-tv, so the module was deleted in
#4540.

`rename_all = "snake_case"` runs heck's to_snake_case, which does not break
before a digit: `Asa1` becomes "asa1", not "asa_1". That is where all three
digit cases go wrong, and it is why the mapping looks right when read quickly.
Verified against heck 0.5 directly rather than inferred.

Exit codes:
    0  Mismatches match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "medbrains" / "crates" / "medbrains-db" / "src" / "migrations"
CRATES = REPO_ROOT / "medbrains" / "crates"
TS_TYPES = REPO_ROOT / "medbrains" / "packages" / "types" / "src"

# Rust enums whose variants do not all exist in the Postgres enum they name.
# Every one is currently unreachable; see the module docstring. Removing an
# entry — because it was fixed or deleted — is always welcome; a new one fails.
RECORDED_MISMATCHES: dict[str, set[str]] = {}

# TypeScript string-union aliases whose name maps to a Postgres enum but whose
# values differ. Each was triaged; all are narrow subsets scoped to one screen,
# or sit on a text column, and none can reach the enum.
#
# The one that did reach it was ServiceType: the onboarding step offered "diet"
# and "other", and shipped a "Room Charges" template using "other", while
# services.service_type is the enum and the insert casts to it. Any admin who
# accepted that template failed the whole onboarding submission. Fixed rather
# than recorded.
RECORDED_TS_DIVERGENCE = {
    # narrow subsets — the alias covers one screen, not the whole vocabulary
    ("QueueStatus", "queue_status"),
    ("DocumentTemplateCategory", "document_template_category"),
    ("ChargeSource", "charge_source"),
    ("AuditAction", "audit_action"),
    ("UserRole", "user_role"),
    # over-broad, but pharmacy_payment_transactions.payment_mode is text
    ("PharmacyPaymentMode", "pharmacy_payment_mode"),
    # the enum carries both 'deceased' and 'death'; nothing writes 'death'
    ("DischargeType", "discharge_type"),
}


def pascal_to_snake(name: str) -> str:
    out = re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", name)
    out = re.sub(r"(?<=[A-Z])([A-Z][a-z])", r"_\1", out)
    return out.lower()


def ts_unions() -> dict[str, set[str]]:
    """Exported string-union aliases, by type name."""
    found: dict[str, set[str]] = {}
    if not TS_TYPES.exists():
        return found
    for path in sorted(TS_TYPES.glob("*.ts")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in re.finditer(
            r'export type (\w+)\s*=\s*((?:\s*\|?\s*"[^"]+")+)\s*;', text
        ):
            found[match.group(1)] = set(re.findall(r'"([^"]+)"', match.group(2)))
    return found


def to_snake_case(name: str) -> str:
    """heck's to_snake_case, as used by sqlx's rename_all.

    Breaks before an uppercase letter that follows a lowercase letter or a
    digit, and before the last uppercase of a run that starts a new word
    (HTTPServer -> http_server). Never breaks before a digit, which is what
    makes Asa1 encode as "asa1".
    """
    out = re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", name)
    out = re.sub(r"(?<=[A-Z])([A-Z][a-z])", r"_\1", out)
    return out.lower()


def pg_enums() -> dict[str, set[str]]:
    enums: dict[str, set[str]] = {}
    for path in sorted(MIGRATIONS.glob("*.sql")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in re.finditer(
            r"CREATE TYPE (?:public\.)?([a-z_0-9]+) AS ENUM \(([^)]*)\)", text, re.S
        ):
            enums[match.group(1)] = set(re.findall(r"'([^']+)'", match.group(2)))
        for match in re.finditer(
            r"ALTER TYPE (?:public\.)?([a-z_0-9]+) ADD VALUE (?:IF NOT EXISTS )?'([^']+)'",
            text,
        ):
            enums.setdefault(match.group(1), set()).add(match.group(2))
    return enums


def rust_enums() -> dict[str, tuple[str, str, set[str]]]:
    """type_name -> (file, ident, encoded values)."""
    found: dict[str, tuple[str, str, set[str]]] = {}
    pattern = re.compile(
        r'#\[sqlx\(type_name = "([a-z_0-9]+)"(?:, rename_all = "([a-z_]+)")?\)\]'
        r"[\s\S]{0,400}?pub enum (\w+) \{([^}]*)\}"
    )
    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in pattern.finditer(text):
            type_name, rename_all, ident, body = match.groups()
            values: set[str] = set()
            # A variant may override the mapping entirely; those are correct by
            # construction and must not be run through rename_all.
            for chunk in re.split(r",\s*\n", body):
                explicit = re.search(r'#\[sqlx\(rename = "([^"]+)"\)\]', chunk)
                variant = re.search(r"^\s*([A-Z]\w*)", chunk, re.M)
                if explicit:
                    values.add(explicit.group(1))
                elif variant:
                    name = variant.group(1)
                    values.add(to_snake_case(name) if rename_all == "snake_case" else name)
            found[type_name] = (str(path.relative_to(CRATES)), ident, values)
    return found


def main() -> int:
    if not MIGRATIONS.exists():
        print(f"ERROR: {MIGRATIONS} not found", file=sys.stderr)
        return 2

    pg = pg_enums()
    rust = rust_enums()

    if not pg or not rust:
        print("ERROR: parsed no enums — the patterns broke", file=sys.stderr)
        return 2

    mismatches: dict[str, tuple[str, str, set[str]]] = {}
    for type_name, (file, ident, values) in rust.items():
        if type_name not in pg:
            # Not every type_name names a Postgres enum — "text" and types
            # declared outside the migrations are legitimate.
            continue
        missing = values - pg[type_name]
        if missing:
            mismatches[type_name] = (file, ident, missing)

    print(
        f"sqlx enums checked against a Postgres enum: "
        f"{len([t for t in rust if t in pg])} | mismatched: {len(mismatches)}"
    )

    failures: list[str] = []
    for type_name, (file, ident, missing) in sorted(mismatches.items()):
        recorded = RECORDED_MISMATCHES.get(type_name, set())
        new = missing - recorded
        if new:
            failures.append(
                f"{type_name} — {ident} in {file} encodes {sorted(new)}, "
                f"which the Postgres enum does not accept"
            )

    ts = ts_unions()
    ts_new: list[str] = []
    for name, values in sorted(ts.items()):
        snake = pascal_to_snake(name)
        if snake not in pg or values == pg[snake]:
            continue
        if (name, snake) in RECORDED_TS_DIVERGENCE:
            continue
        extra = sorted(values - pg[snake])
        ts_new.append(
            f"{name} differs from the {snake} enum"
            + (f"; not accepted: {extra}" if extra else " (missing values only)")
        )
    failures.extend(ts_new)

    if failures:
        print(f"\n=== {len(failures)} RUST ENUM THAT POSTGRES WILL REJECT ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nBinding this variant raises 22P02 at runtime. Add the value to the "
            "Postgres enum, give the variant an explicit #[sqlx(rename = \"...\")], "
            "or record it here with a reason."
        )
        return 1

    print("✓ Postgres enum mismatches match what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

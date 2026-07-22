#!/usr/bin/env python3
"""
Postgres enum parity check.

A Rust enum deriving `sqlx::Type` with `#[sqlx(type_name = "...")]` promises
that every variant encodes to a value the Postgres enum accepts. When it does
not, the mismatch is invisible until a request actually carries that variant,
and then Postgres raises 22P02 — the same class of runtime failure #4492 fixed
the status mapping for.

Four enums currently break that promise. None is reachable today: all four are
either never bound to a query, or shadowed by a correct sibling.

    asa_classification    Asa1 encodes "asa1", the enum has 'asa_1'
                          (AsaClassification is never used)
    death_cert_form_type  Form4 encodes "form4", the enum has 'form_4'
                          (DeathCertFormType is never used)
    print_format          Thermal80mm encodes "thermal80mm", the enum has
                          'thermal_80mm' (bound as a string via
                          documents.rs::print_format_label, which maps
                          correctly by hand — the derive is never used)
    queue_priority        queue.rs::QueuePriority has Pediatric and Emergency,
                          the enum has neither ('emergency_referral' is the
                          real value). Unused — front_office.rs::QueuePriority
                          is the one bound to queue_priority_rules, and it
                          matches.

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

# Rust enums whose variants do not all exist in the Postgres enum they name.
# Every one is currently unreachable; see the module docstring. Removing an
# entry — because it was fixed or deleted — is always welcome; a new one fails.
RECORDED_MISMATCHES = {
    "asa_classification": {"asa1", "asa2", "asa3", "asa4", "asa5", "asa6"},
    "death_cert_form_type": {"form4", "form4a"},
    "print_format": {"thermal80mm", "thermal58mm", "label50x25mm"},
    "queue_priority": {"pediatric", "emergency"},
}


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

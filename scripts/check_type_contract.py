#!/usr/bin/env python3
"""
Request/Response Type Contract Checker — compares TS interfaces vs Rust structs
to find field mismatches.

Statically parses:
  - packages/types/src/index.ts          → TypeScript interface definitions
  - crates/medbrains-server/src/routes/  → Rust struct definitions
  - crates/medbrains-core/src/           → Rust struct definitions

No running server required.

Usage:
    python3 scripts/check_type_contract.py
    # or from medbrains/ or root:
    make check-types

Exit codes:
    0  No field mismatches found
    1  Field mismatches found between matched types
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
TYPES_TS = REPO_ROOT / "medbrains" / "packages" / "types" / "src" / "index.ts"
ROUTES_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes"
CORE_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-core" / "src"
BASELINE_FILE = REPO_ROOT / "scripts" / ".type_contract_baseline.json"

# ── Type mapping: Rust → TypeScript ──────────────────────────────────

RUST_TO_TS_TYPE = {
    "String": "string",
    "str": "string",
    "i8": "number",
    "i16": "number",
    "i32": "number",
    "i64": "number",
    "u8": "number",
    "u16": "number",
    "u32": "number",
    "u64": "number",
    "f32": "number",
    "f64": "number",
    "bool": "boolean",
    "Uuid": "string",
    "NaiveDate": "string",
    "NaiveDateTime": "string",
    "NaiveTime": "string",
    "DateTime<Utc>": "string",
    "Decimal": "number",
    "BigDecimal": "number",
    "serde_json::Value": "Record<string, unknown>",
    "Value": "Record<string, unknown>",
    "JsonValue": "Record<string, unknown>",
}

# Internal-only types that should not be compared
SKIP_TYPES = {
    "AppState",
    "Claims",
    "Column",
    "ApiError",
    "ErrorResponse",
    "QueryParams",
    "Pagination",
    "PaginatedResponse",
}

# Fields that are deliberately server-internal even when the Rust domain
# model is serializable. They must never be required in frontend public
# contracts.
SKIP_FIELDS_BY_TYPE = {
    "User": {"password_hash"},
}


# ── TypeScript interface extraction ──────────────────────────────────

def extract_ts_interfaces() -> dict[str, dict[str, tuple[str, bool, int]]]:
    """
    Extract all interfaces from index.ts.
    Returns {InterfaceName: {field_name: (ts_type, is_optional, line_no)}}.
    """
    source = TYPES_TS.read_text()
    lines = source.split("\n")
    interfaces: dict[str, dict[str, tuple[str, bool, int]]] = {}

    i = 0
    while i < len(lines):
        line = lines[i]
        # Match: export interface TypeName {
        m = re.match(r"^export\s+interface\s+(\w+)\s*\{", line)
        if m:
            name = m.group(1)
            fields: dict[str, tuple[str, bool, int]] = {}
            i += 1

            # Parse fields until closing brace
            brace_depth = 1
            while i < len(lines) and brace_depth > 0:
                fline = lines[i]
                for ch in fline:
                    if ch == "{":
                        brace_depth += 1
                    elif ch == "}":
                        brace_depth -= 1

                if brace_depth == 0:
                    break

                # Only parse fields at depth 1
                if brace_depth == 1:
                    # Match: field_name?: type;  or  field_name: type;
                    fm = re.match(
                        r"^\s+(\w+)(\??):\s*(.+?)\s*;?\s*$", fline
                    )
                    if fm:
                        fname = fm.group(1)
                        is_optional = fm.group(2) == "?"
                        ftype = fm.group(3).rstrip(";").strip()
                        fields[fname] = (ftype, is_optional, i + 1)

                i += 1

            if fields:
                interfaces[name] = fields
        else:
            i += 1

    return interfaces


# ── Rust struct extraction ───────────────────────────────────────────

def extract_rust_structs_from_file(
    file_path: Path,
) -> dict[str, dict[str, tuple[str, bool, int]]]:
    """
    Extract pub struct definitions from a Rust file.
    Returns {StructName: {field_name: (rust_type, is_optional, line_no)}}.
    """
    try:
        source = file_path.read_text()
    except (OSError, UnicodeDecodeError):
        return {}

    lines = source.split("\n")
    structs: dict[str, dict[str, tuple[str, bool, int]]] = {}

    i = 0
    while i < len(lines):
        line = lines[i]
        # Match: pub struct StructName {
        # Also handles derive macros above
        m = re.match(r"^pub\s+struct\s+(\w+)\s*\{", line)
        if m:
            name = m.group(1)
            fields: dict[str, tuple[str, bool, int]] = {}
            i += 1

            brace_depth = 1
            while i < len(lines) and brace_depth > 0:
                fline = lines[i]
                for ch in fline:
                    if ch == "{":
                        brace_depth += 1
                    elif ch == "}":
                        brace_depth -= 1

                if brace_depth == 0:
                    break

                if brace_depth == 1:
                    # Match: pub field_name: Type,
                    fm = re.match(
                        r"^\s+pub\s+(\w+)\s*:\s*(.+?)\s*,?\s*$", fline
                    )
                    if fm:
                        fname = fm.group(1)
                        ftype_raw = fm.group(2).rstrip(",").strip()

                        # Check if Option<T>
                        is_optional = False
                        opt_match = re.match(r"Option<(.+)>", ftype_raw)
                        if opt_match:
                            is_optional = True
                            ftype_raw = opt_match.group(1)

                        fields[fname] = (ftype_raw, is_optional, i + 1)

                i += 1

            if fields:
                structs[name] = fields
        else:
            i += 1

    return structs


def extract_all_rust_structs() -> dict[str, dict[str, tuple[str, bool, int]]]:
    """Extract structs from all route and core Rust files."""
    all_structs: dict[str, dict[str, tuple[str, bool, int]]] = {}

    for directory in [ROUTES_DIR, CORE_DIR]:
        if not directory.exists():
            continue
        for rs_file in sorted(directory.rglob("*.rs")):
            file_structs = extract_rust_structs_from_file(rs_file)
            all_structs.update(file_structs)

    return all_structs


# ── Type comparison ──────────────────────────────────────────────────

def normalize_ts_type(ts_type: str) -> str:
    """Normalize a TS type for comparison."""
    t = ts_type.strip()
    # Remove trailing | null or | undefined
    t = re.sub(r"\s*\|\s*null\s*$", "", t)
    t = re.sub(r"\s*\|\s*undefined\s*$", "", t)
    # Array<T> → T[]
    arr_match = re.match(r"Array<(.+)>", t)
    if arr_match:
        t = arr_match.group(1) + "[]"
    return t


def normalize_rust_type(rust_type: str) -> str:
    """Normalize a Rust type for comparison."""
    t = rust_type.strip()
    return t


def types_compatible(rust_type: str, ts_type: str) -> bool:
    """
    Check if a Rust type and TS type are compatible.
    Uses the RUST_TO_TS_TYPE mapping for known primitives.
    """
    rt = normalize_rust_type(rust_type)
    tt = normalize_ts_type(ts_type)

    # Direct mapping
    if rt in RUST_TO_TS_TYPE and RUST_TO_TS_TYPE[rt] == tt:
        return True

    # Vec<T> ↔ T[]
    vec_match = re.match(r"Vec<(.+)>", rt)
    if vec_match:
        inner_rust = vec_match.group(1)
        if tt.endswith("[]"):
            inner_ts = tt[:-2]
            return types_compatible(inner_rust, inner_ts)

    # HashMap<K, V> ↔ Record<K, V>
    if rt.startswith("HashMap<") and tt.startswith("Record<"):
        return True

    # Both are custom types — check if names match (case-insensitive)
    # Rust uses PascalCase, TS uses PascalCase — should match
    if rt == tt:
        return True

    # Enum string types — Rust enum names don't directly match TS string union types
    # This is a known pattern, so treat custom types as compatible
    # if they share the same base name pattern
    return False


def compare_types(
    ts_interfaces: dict[str, dict[str, tuple[str, bool, int]]],
    rust_structs: dict[str, dict[str, tuple[str, bool, int]]],
) -> tuple[
    list[tuple[str, str, str, str]],  # errors: (type, field, detail, severity)
    list[tuple[str, str]],            # matched types
    list[str],                        # ts-only types
    list[str],                        # rust-only types
]:
    """
    Compare matched types between TS and Rust.
    Returns (issues, matched_types, ts_only, rust_only).
    """
    ts_names = set(ts_interfaces.keys())
    rust_names = set(rust_structs.keys())

    # Find types that exist in both sides
    # Also try matching with/without "Body" suffix
    matched: list[tuple[str, str]] = []  # (ts_name, rust_name)
    ts_matched: set[str] = set()
    rust_matched: set[str] = set()

    for ts_name in ts_names:
        if ts_name in SKIP_TYPES:
            ts_matched.add(ts_name)
            continue

        # Direct match
        if ts_name in rust_names:
            matched.append((ts_name, ts_name))
            ts_matched.add(ts_name)
            rust_matched.add(ts_name)
            continue

        # Try without "Body" suffix (TS has CreateXxxRequestBody, Rust has CreateXxxRequest)
        if ts_name.endswith("Body"):
            base = ts_name[:-4]
            if base in rust_names:
                matched.append((ts_name, base))
                ts_matched.add(ts_name)
                rust_matched.add(base)
                continue

        # Try with "Row" suffix mapping (TS has XxxRow, Rust might have Xxx)
        if ts_name.endswith("Row"):
            base = ts_name[:-3]
            if base in rust_names:
                matched.append((ts_name, base))
                ts_matched.add(ts_name)
                rust_matched.add(base)
                continue

    ts_only = sorted(ts_names - ts_matched - SKIP_TYPES)
    rust_only = sorted(rust_names - rust_matched - SKIP_TYPES)

    # Compare fields for matched types
    issues: list[tuple[str, str, str, str]] = []

    for ts_name, rust_name in matched:
        ts_fields = ts_interfaces[ts_name]
        rust_fields = rust_structs[rust_name]

        ts_field_names = set(ts_fields.keys())
        rust_field_names = set(rust_fields.keys())

        # Fields in Rust but not TS (ERROR — frontend won't send them)
        for fname in sorted(rust_field_names - ts_field_names):
            if fname in SKIP_FIELDS_BY_TYPE.get(ts_name, set()):
                continue
            rust_type, rust_opt, _ = rust_fields[fname]
            if rust_opt:
                # Optional fields are OK to be missing in TS (defaults to None)
                issues.append((
                    ts_name,
                    fname,
                    f"Optional in Rust ({rust_type}) but missing in TS",
                    "WARNING",
                ))
            else:
                issues.append((
                    ts_name,
                    fname,
                    f"Required in Rust ({rust_type}) but missing in TS",
                    "ERROR",
                ))

        # Fields in TS but not Rust (WARNING — TS is stale or extra field)
        for fname in sorted(ts_field_names - rust_field_names):
            ts_type, _, _ = ts_fields[fname]
            issues.append((
                ts_name,
                fname,
                f"In TS ({ts_type}) but missing in Rust",
                "WARNING",
            ))

        # Fields in both — check type compatibility
        for fname in sorted(ts_field_names & rust_field_names):
            ts_type, ts_opt, _ = ts_fields[fname]
            rust_type, rust_opt, _ = rust_fields[fname]

            # Check optionality mismatch
            if rust_opt and not ts_opt:
                # Rust is Option<T>, TS is required — might be OK if TS sends it always
                pass
            elif not rust_opt and ts_opt:
                issues.append((
                    ts_name,
                    fname,
                    f"Required in Rust but optional in TS ({ts_type}?)",
                    "WARNING",
                ))

            # Check type compatibility
            if not types_compatible(rust_type, ts_type):
                # Don't flag custom/enum types as they use string unions in TS
                if rust_type in RUST_TO_TS_TYPE or rust_type.startswith("Vec<"):
                    expected_ts = RUST_TO_TS_TYPE.get(rust_type, rust_type)
                    if expected_ts != normalize_ts_type(ts_type):
                        issues.append((
                            ts_name,
                            fname,
                            f"Type mismatch: Rust={rust_type}, TS={ts_type} (expected {expected_ts})",
                            "WARNING",
                        ))

    return issues, matched, ts_only, rust_only


# ── Main ─────────────────────────────────────────────────────────────


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--update-baseline",
        action="store_true",
        help="Record current required-field mismatches as the known baseline",
    )
    ap.add_argument(
        "--verbose",
        action="store_true",
        help="Print baseline errors and warning details instead of summary-only output",
    )
    args = ap.parse_args()

    if not TYPES_TS.exists():
        print(f"ERROR: TypeScript types file not found: {TYPES_TS}")
        sys.exit(2)
    if not ROUTES_DIR.exists():
        print(f"ERROR: Routes directory not found: {ROUTES_DIR}")
        sys.exit(2)

    # Extract
    ts_interfaces = extract_ts_interfaces()
    rust_structs = extract_all_rust_structs()

    # Compare
    issues, matched, ts_only, rust_only = compare_types(ts_interfaces, rust_structs)

    # ── Output ───────────────────────────────────────────────────

    print("=== Type Contract Check ===")
    print(f"TypeScript interfaces: {len(ts_interfaces):,}")
    print(f"Rust structs:          {len(rust_structs):,}")
    print(f"Matched types:         {len(matched):,}")
    print()

    # Separate by severity
    errors = [i for i in issues if i[3] == "ERROR"]
    warnings = [i for i in issues if i[3] == "WARNING"]
    error_ids = sorted(f"{type_name}.{field}" for type_name, field, _, _ in errors)

    if args.update_baseline:
        BASELINE_FILE.write_text(json.dumps(error_ids, indent=2, sort_keys=True) + "\n")
        print(
            f"updated type-contract baseline: {len(error_ids)} required-field mismatches "
            f"({BASELINE_FILE.relative_to(REPO_ROOT)})"
        )
        return

    baseline: set[str] = set()
    if BASELINE_FILE.exists():
        baseline = set(json.loads(BASELINE_FILE.read_text()))

    new_error_ids = sorted(set(error_ids) - baseline)
    resolved_error_ids = sorted(baseline - set(error_ids))

    if errors:
        if baseline:
            print(
                f"ERRORS ({len(errors)} required Rust fields missing in TS; "
                f"{len(new_error_ids)} new vs baseline):"
            )
        else:
            print(f"ERRORS ({len(errors)} — required Rust fields missing in TS):")
        for type_name, field, detail, _ in errors:
            error_id = f"{type_name}.{field}"
            if baseline and error_id not in new_error_ids and not args.verbose:
                continue
            marker = "NEW " if error_id in new_error_ids else ""
            print(f"  {marker}{error_id}: {detail}")
        if baseline and not new_error_ids and not args.verbose:
            print("  No new required-field mismatches. Existing mismatches are in baseline.")
            print("  Use --verbose to print all baseline mismatches.")
        print()

    if resolved_error_ids:
        print(f"INFO: {len(resolved_error_ids)} baseline errors have been resolved.")
        print("      Run with --update-baseline after the cleanup is reviewed.")
        print()

    if warnings:
        print(f"WARNINGS ({len(warnings)} — optionality or extra field mismatches):")
        if not args.verbose:
            print("  Warning details suppressed by default. Use --verbose to print them.")
            print()
        else:
        # Group by type for readability
            by_type: dict[str, list[tuple[str, str]]] = {}
            for type_name, field, detail, _ in warnings:
                by_type.setdefault(type_name, []).append((field, detail))

            for type_name in sorted(by_type.keys()):
                print(f"  {type_name}:")
                for field, detail in by_type[type_name]:
                    print(f"    .{field}: {detail}")
            print()

    # Info: types only on one side (truncated)
    if ts_only:
        print(f"INFO: {len(ts_only)} TS-only interfaces (no Rust match — expected for UI types)")
        if len(ts_only) <= 20:
            for name in ts_only:
                print(f"  {name}")
        else:
            for name in ts_only[:10]:
                print(f"  {name}")
            print(f"  ... and {len(ts_only) - 10} more")
        print()

    if rust_only:
        print(f"INFO: {len(rust_only)} Rust-only structs (no TS match — expected for internal types)")
        if len(rust_only) <= 20:
            for name in rust_only:
                print(f"  {name}")
        else:
            for name in rust_only[:10]:
                print(f"  {name}")
            print(f"  ... and {len(rust_only) - 10} more")
        print()

    # Summary
    print("─" * 60)
    print(
        f"Summary: {len(matched):,} matched types, "
        f"{len(errors)} errors, {len(warnings)} warnings"
    )

    if errors and (not baseline or new_error_ids):
        if baseline:
            print("\nFAILED — new required Rust fields are missing in TypeScript interfaces.")
        else:
            print("\nFAILED — required Rust fields are missing in TypeScript interfaces.")
        sys.exit(1)
    elif errors:
        print("\nPASSED WITH BASELINE — no new required field mismatches.")
        sys.exit(0)
    else:
        print("\nPASSED — no required field mismatches found.")
        sys.exit(0)


if __name__ == "__main__":
    main()

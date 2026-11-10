#!/usr/bin/env python3
"""
RLS Coverage Check — verifies every tenant_id-bearing table has matching RLS policy.

Statically parses every SQL migration under crates/medbrains-db-migrations/src/migrations/:
  - Detect CREATE TABLE statements with `tenant_id UUID` column
  - Detect ALTER TABLE ... ADD COLUMN tenant_id (later additions)
  - Detect ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  - Detect CREATE POLICY tenant_isolation_<name> ON <table>
  - Detect SELECT apply_tenant_rls('<name>') helper calls
  - Detect plpgsql `FOREACH t IN ARRAY ARRAY[...] LOOP` bodies that both enable
    RLS and create a policy on the loop variable
  - Parse migration header `RLS-Posture:` declarations

Also fails when ANY table (tenant_id or not) has RLS enabled and no policy.

A table is COVERED if any of:
  1. RLS enabled + at least one tenant-isolation policy referencing it
  2. apply_tenant_rls('<name>') was called
  3. Migration header declared the table as `bypass-only`, `catalog`, or `not-applicable`

Exit codes:
    0  All tenant-bearing tables have RLS coverage
    1  One or more gaps OR malformed migration headers
"""

import contextlib
import io
import re
import sys
import tempfile
from pathlib import Path

from migration_header_lint import IMMUTABLE_APPLIED, VALID_POSTURES, normalize_posture

REPO_ROOT = Path(__file__).resolve().parent.parent
# The migrations moved to their own crate. This pointed at the old path, so
# the check that proves every tenant table has an RLS policy exited 2 without
# reading a single migration — and with CI blocked on billing, nobody saw it
# fail.
MIGRATIONS_DIR = (
    REPO_ROOT / "medbrains" / "crates" / "medbrains-db-migrations" / "src" / "migrations"
)

# Tables that intentionally have tenant_id but skip RLS. Add with care.
ALLOWLIST = {
    # Add table names here only with explicit justification in header
}

# Tables with no row level security by design: identical for every hospital,
# or the tenant registry that login reads before a tenant is known. Every
# other table must enable RLS, tenant_id or not — a child table without its
# own tenant_id (a dashboard's widgets) holds a hospital's data all the same.
# Mirrors GLOBAL_TABLES in medbrains-server/tests/rls_gap_tables_test.rs,
# which checks the migrated database.
GLOBAL_TABLES = {
    "_sqlx_migrations_pre_baseline",
    "cds_diagnosis_reference", "cds_drug_ingredient", "cds_drug_reference",
    "cds_ingredient_incompatibility", "cds_lab_reference", "cds_state_formulary",
    "device_adapter_catalog", "event_registry", "event_schemas", "module_entity_schemas",
    "geo_countries", "geo_districts", "geo_states", "geo_subdistricts", "geo_towns",
    "regulatory_bodies", "news_feed_articles", "partition_config", "notifiable_lab_rules",
    "health_intel_terms", "health_intel_heartbeats",
    "snomed_codes", "snomed_concept", "snomed_description", "snomed_refset_member",
    "snomed_relationship", "snomed_release", "snomed_transitive_closure", "omop_concept_map",
    "tenants", "hospital_groups", "hospital_regions",
}

# The last migration applied before the header rule could be enforced. Raising
# this excuses a new migration from declaring its posture, which is the one
# thing it must not do.
HEADER_EXEMPT_THROUGH = 1016

CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)\s*(?:PARTITION|;)",
    re.IGNORECASE | re.DOTALL,
)
TENANT_COL_RE = re.compile(r"\btenant_id\s+UUID\b", re.IGNORECASE)
ALTER_ADD_TENANT_RE = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?tenant_id\s+UUID",
    re.IGNORECASE,
)
ENABLE_RLS_RE = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
    re.IGNORECASE,
)
POLICY_RE = re.compile(
    r"CREATE\s+POLICY\s+\w+\s+ON\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
APPLY_TENANT_RLS_RE = re.compile(
    r"SELECT\s+apply_tenant_rls(?:_with_global)?\(\s*'(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)'\s*\)",
    re.IGNORECASE,
)
# Declarative partitions inherit their parent's row-level security, so they are
# covered by whatever protects the parent. They are also frequently policied via
# dynamic SQL (see 0145's `PERFORM apply_tenant_rls(format(...))` loop over the
# 32 relation_tuples partitions), which no static scan can see.
ATTACH_PARTITION_RE = re.compile(
    r"ATTACH\s+PARTITION\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
PARTITION_OF_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+PARTITION\s+OF",
    re.IGNORECASE,
)

CREATE_ANY_TABLE_RE = re.compile(
    r"CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
    re.IGNORECASE,
)
DROP_TABLE_RE = re.compile(
    r"DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?((?:(?:public\.)?[a-zA-Z_][a-zA-Z0-9_]*\s*,\s*)*(?:public\.)?[a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
RENAME_TABLE_RE = re.compile(
    r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+RENAME\s+TO\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)

RLS_LOOP_RE = re.compile(
    r"FOREACH\s+(\w+)\s+IN\s+ARRAY\s+ARRAY\s*\[(.*?)\]\s*LOOP(.*?)END\s+LOOP",
    re.IGNORECASE | re.DOTALL,
)

HEADER_KEY_RE = re.compile(r"--\s*([A-Za-z][A-Za-z\-]+)\s*:\s*(.+?)\s*$", re.MULTILINE)


def strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", "", sql)
    return sql


def rls_loop_tables(sql: str) -> set[str]:
    """Tables a `FOREACH` loop both enables RLS on and creates a policy on.

    Both must be in one loop body and take the loop variable: a loop that only
    enables leaves every query returning zero rows, so it earns nothing here and
    its tables are still reported.
    """
    covered: set[str] = set()
    for var, names, body in RLS_LOOP_RE.findall(sql):
        enables = re.search(
            r"EXECUTE\s+format\(\s*'ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?%\d*\$?I"
            rf"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'\s*,\s*{var}\s*\)",
            body,
            re.IGNORECASE,
        )
        creates = re.search(
            r"EXECUTE\s+format\(\s*'CREATE\s+POLICY\s[^']*?\sON\s+(?:public\.)?%\d*\$?I\b"
            rf"[^;]*?,\s*{var}\b[^;]*;",
            body,
            re.IGNORECASE,
        )
        if enables and creates:
            covered.update(name.lower() for name in re.findall(r"'(\w+)'", names))
    return covered


def header_error(name: str, mig_no: int, header: dict[str, str]) -> str | None:
    """Why a migration's RLS-Posture header is unacceptable, if it is."""
    if mig_no <= HEADER_EXEMPT_THROUGH or name in IMMUTABLE_APPLIED:
        return None
    written = header.get("RLS-Posture")
    if not written:
        return f"{name}: missing 'RLS-Posture:' header"
    if normalize_posture(written) not in VALID_POSTURES:
        return (
            f"{name}: invalid RLS-Posture '{written}' "
            f"(allowed: {', '.join(sorted(VALID_POSTURES))})"
        )
    return None


def parse_header(sql: str) -> dict[str, str]:
    """Parse top-of-file `-- Key: Value` comment block."""
    head = []
    for line in sql.splitlines():
        s = line.strip()
        if not s:
            if head:
                break
            continue
        if not s.startswith("--"):
            break
        head.append(line)
    text = "\n".join(head)
    return {m.group(1): m.group(2) for m in HEADER_KEY_RE.finditer(text)}


def main(migrations_dir: Path = MIGRATIONS_DIR) -> int:
    if not migrations_dir.exists():
        print(f"ERROR: migrations dir not found: {migrations_dir}", file=sys.stderr)
        return 2

    files = sorted(migrations_dir.glob("*.sql"))
    if not files:
        print(f"ERROR: no migrations found in {migrations_dir}", file=sys.stderr)
        return 2

    tenant_tables: dict[str, str] = {}        # table -> first_seen_migration
    rls_enabled: set[str] = set()
    policies_on: set[str] = set()
    partitions: set[str] = set()             # children of a partitioned parent
    posture_overrides: dict[str, str] = {}    # table -> posture from migration header
    header_errors: list[str] = []
    live_tables: set[str] = set()             # every table created and not dropped since
    renames: list[tuple[str, str]] = []       # RLS stays on a renamed table

    for path in files:
        raw = path.read_text(encoding="utf-8")
        header = parse_header(raw)
        sql = strip_sql_comments(raw)

        # Applied migrations cannot gain a header: `sqlx` holds their checksum and
        # editing one stops the server. What matters for them is actual coverage,
        # verified below. The header is a rule for migrations written from here on.
        m = re.match(r"(\d+)_", path.name)
        error = header_error(path.name, int(m.group(1)) if m else 0, header)
        if error:
            header_errors.append(error)

        # CREATE TABLE detection
        for match in CREATE_TABLE_RE.finditer(sql):
            tname = match.group(1).lower()
            body = match.group(2)
            if TENANT_COL_RE.search(body):
                tenant_tables.setdefault(tname, path.name)
                # Capture per-table posture if header carries `Per-Table:` lines (future use)
                if "RLS-Posture" in header and posture_overrides.get(tname) is None:
                    posture_overrides[tname] = header["RLS-Posture"]

        # In file order: a table dropped and re-created stays live.
        events = [(m.start(), "create", m.group(1).lower()) for m in CREATE_ANY_TABLE_RE.finditer(sql)]
        events += [
            (m.start(), "drop", name.strip().lower().removeprefix("public."))
            for m in DROP_TABLE_RE.finditer(sql)
            for name in m.group(1).split(",")
        ]
        events += [(m.start(), "rename", (m.group(1).lower(), m.group(2).lower()))
                   for m in RENAME_TABLE_RE.finditer(sql)]
        for _, kind, name in sorted(events, key=lambda e: e[0]):
            if kind == "create":
                live_tables.add(name)
            elif kind == "drop":
                live_tables.discard(name)
            elif name[0] in live_tables:
                live_tables.discard(name[0])
                live_tables.add(name[1])
                renames.append(name)

        # ALTER TABLE ADD COLUMN tenant_id — table becomes tenant-scoped
        for match in ALTER_ADD_TENANT_RE.finditer(sql):
            tname = match.group(1).lower()
            tenant_tables.setdefault(tname, path.name)

        # ENABLE RLS
        for match in ATTACH_PARTITION_RE.finditer(sql):
            partitions.add(match.group(1).lower())
        for match in PARTITION_OF_RE.finditer(sql):
            partitions.add(match.group(1).lower())

        for match in ENABLE_RLS_RE.finditer(sql):
            rls_enabled.add(match.group(1).lower())

        # CREATE POLICY ... ON table
        for match in POLICY_RE.finditer(sql):
            policies_on.add(match.group(1).lower())

        # apply_tenant_rls('table') helper — counts as enabled + policy
        for match in APPLY_TENANT_RLS_RE.finditer(sql):
            tname = match.group(1).lower()
            rls_enabled.add(tname)
            policies_on.add(tname)

        looped = rls_loop_tables(sql)
        rls_enabled |= looped
        policies_on |= looped

    # Compute gaps
    bypass_postures = {"bypass-only", "catalog", "not-applicable"}
    gaps: list[tuple[str, str, str]] = []  # (table, first_seen_migration, reason)

    for table, first_mig in sorted(tenant_tables.items()):
        if table in ALLOWLIST or table in partitions:
            # A partition is protected by whatever protects its parent.
            continue
        posture = posture_overrides.get(table, "")
        if posture in bypass_postures:
            continue
        missing = []
        if table not in rls_enabled:
            missing.append("RLS not enabled")
        if table not in policies_on:
            missing.append("no policy")
        if missing:
            gaps.append((table, first_mig, "; ".join(missing)))

    # RLS on with no policy at all: under `medbrains_app` (NOBYPASSRLS, see
    # 0981) every query returns zero rows and every write fails. Holds for
    # tables with no tenant_id too, which the loop above never looks at.
    for table in sorted(rls_enabled - policies_on - partitions - set(ALLOWLIST)):
        if table not in tenant_tables:
            gaps.append((table, "-", "RLS enabled, no policy"))

    for old, new in renames:
        if old in rls_enabled:
            rls_enabled.add(new)

    # Any table at all with RLS off that is not declared global. Catches the
    # child tables a tenant_id scan cannot see.
    for table in sorted(live_tables - rls_enabled - partitions - GLOBAL_TABLES):
        if table not in tenant_tables:
            gaps.append((table, "-", "no RLS and not declared in GLOBAL_TABLES"))

    # Report
    print(f"Scanned {len(files)} migrations, {len(tenant_tables)} tenant_id-bearing tables.")
    print(f"  RLS enabled on:   {len(rls_enabled)} tables")
    print(f"  Policies on:      {len(policies_on)} tables")

    if header_errors:
        print(f"\n=== {len(header_errors)} HEADER ERRORS ===")
        for e in header_errors:
            print(f"  ✗ {e}")

    if gaps:
        print(f"\n=== {len(gaps)} TABLES MISSING RLS COVERAGE ===")
        print(f"{'TABLE':<48} {'FIRST SEEN':<40} REASON")
        print("-" * 120)
        for table, first_mig, reason in gaps:
            print(f"{table:<48} {first_mig:<40} {reason}")
        print()

    if header_errors or gaps:
        return 1

    print("\n✓ All tenant-scoped tables have RLS coverage. Headers OK.")
    return 0


def run_on_migration(name: str, sql: str) -> tuple[int, str]:
    """Run the whole check over one throwaway migration."""
    with tempfile.TemporaryDirectory() as folder:
        (Path(folder) / name).write_text(sql, encoding="utf-8")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(Path(folder))
    return code, out.getvalue()


def self_test() -> int:
    """Prove the loop rule and the header exceptions cannot let a gap through."""
    head = "-- RLS-Posture: tenant-scoped\n\n"
    table = "CREATE TABLE public.t_a (id UUID, tenant_id UUID NOT NULL);\n"
    enable = "EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);"
    policy = "EXECUTE format('CREATE POLICY p_%s ON public.%I USING (true)', t, t);"
    loop = "DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['t_a'] LOOP {} END LOOP; END $$;"

    code, _ = run_on_migration("9001_x.sql", head + table + loop.format(enable + policy))
    assert code == 0, "a loop that enables and creates a policy is coverage"
    for body in (enable, policy):
        code, out = run_on_migration("9001_x.sql", head + table + loop.format(body))
        assert code == 1 and "t_a" in out, f"half a loop must stay reported: {body}"
    code, out = run_on_migration("9001_x.sql", table + loop.format(enable + policy))
    assert code == 1 and "missing 'RLS-Posture:'" in out, "a new migration needs a header"

    assert header_error("1094_analyzer_orders.sql", 1094, {}) is None
    assert header_error("1094_other.sql", 1094, {}), "exceptions are by file name, not number"
    wording = {"RLS-Posture": "tenant-scoped (existing table; policies unchanged)"}
    assert header_error("9001_x.sql", 9001, wording) is None
    assert header_error("9001_x.sql", 9001, {"RLS-Posture": "public (x)"}), "still validated"
    print("check_rls self-test passed")
    return 0


if __name__ == "__main__":
    sys.exit(self_test() if "--self-test" in sys.argv else main())

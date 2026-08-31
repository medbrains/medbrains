#!/usr/bin/env python3
"""Refactor the migration history into clean, per-module schema files.

    python3 scripts/refactor_migrations.py --analyse
    python3 scripts/refactor_migrations.py --emit

## The problem

262 migrations created 860 tables, and **608 of those tables are altered by a
later migration**. `tenants` is touched by 24 files, `adr_reports` by 25. To
know what a table looks like you replay the whole history in your head, and
nothing in the tree states the answer.

A `pg_dump` squash fixes correctness and not readability: one 96,000-line file,
no comments, tables in dependency order rather than any order a person would
choose. This produces what a fresh application would have — each table declared
once, in its final shape, grouped by the domain it belongs to.

## How

The dump is the *oracle*: it is what the database actually became, so column
order, defaults, constraints and policies come from there rather than from
re-reading 262 files and hoping the fold is right.

The archive supplies what the dump throws away — which module introduced each
table, and the comments explaining why a column exists.

Correctness is then checked the same way the squash was: build a database from
the emitted files and diff it against one built from the archive.
"""

from __future__ import annotations

import argparse
import collections
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE = os.path.join(ROOT, "crates/medbrains-db-migrations/migrations-archive")
# The generated squash, kept outside the migrations directory so that emitting
# into that directory cannot overwrite the very file being read from.
ORACLE = os.path.join(ROOT, "crates/medbrains-db/oracle/0001_baseline.sql")
OUT_DIR = os.path.join(ROOT, "crates/medbrains-db-migrations/src/migrations")

# ── the canonical taxonomy ──────────────────────────────────────────────────
#
# The migration filenames give 162 "modules", but 109 of them own three tables
# or fewer: they are features added later, not domains. `structured_camp_planning`
# is camp; `print_data_schema_alignment` is not a domain at all, it is 50 tables
# that belong to whichever module they print for.
#
# This maps the accidental names onto the domains the product actually has. A
# module not listed keeps its own name, so a genuinely new domain does not need
# an entry here to be emitted correctly — it just lands in its own file.
MODULE_ALIASES: dict[str, str] = {
    # identity and platform
    "auth": "auth",
    "core": "core",
    "rbac": "auth",
    "sso": "auth",
    "session": "auth",
    "identity": "auth",
    "authz": "auth",
    # patient and clinical
    "patient": "patient",
    "opd": "opd",
    "ipd": "ipd",
    "emergency": "emergency",
    "doctor": "clinical",
    "nurse": "nursing",
    "clinical": "clinical",
    "specialty": "specialty",
    "psych": "psychiatry",
    "psychiatry": "psychiatry",
    # diagnostics
    "lab": "lab",
    "radiology": "radiology",
    "blood_bank": "blood_bank",
    "pathology": "lab",
    # medicines and supplies
    "pharmacy": "pharmacy",
    "indent": "supply_chain",
    "procurement": "supply_chain",
    "inventory": "supply_chain",
    "store": "supply_chain",
    "asset": "facilities",
    # money
    "billing": "billing",
    "insurance": "insurance",
    "payment": "billing",
    "payments": "billing",
    "tally": "billing",
    "finance": "billing",
    # operations
    "ot": "theatre",
    "facilities": "facilities",
    "hr": "hr",
    "quality": "quality",
    "regulatory": "regulatory",
    "mrd": "mrd",
    "cms": "cms",
    "camp": "camp",
    "structured_camp_planning": "camp",
    "multi_hospital": "multi_hospital",
    "integration": "integration",
    "workflow": "workflow",
    "notification": "notifications",
    "notifications": "notifications",
    "print_data_schema_alignment": "print_data",
    "printing": "print_data",
    "printing": "print_data",
    "print": "print_data",
    "print_data_final_smoke_alignment": "print_data",
    # identity, sessions, invitations — all one concern
    "account_lockout_password_reset": "auth",
    "email_verification": "auth",
    "oauth_connections": "auth",
    "user_invitations": "auth",
    "tokens": "auth",
    "onboarding": "auth",
    # platform plumbing
    "tenant": "core",
    "geo": "core",
    "partition_infrastructure": "core",
    "object_storage_lifecycle": "core",
    "forms": "core",
    "audit_partitioning": "audit",
    # clinical reference and decision support
    "cds_drug_reference": "clinical",
    "cds_ingredients": "clinical",
    "cds_lab_reference": "clinical",
    "cds_state_formulary": "clinical",
    "allergen_catalog": "clinical",
    "medication_reconciliation": "clinical",
    "long_term_medications": "clinical",
    "indwelling_devices": "clinical",
    "hypoglycemia_events": "clinical",
    "cpoe_safety_audit": "clinical",
    "orders": "clinical",
    "advance_directives": "clinical",
    # nursing and ward
    "stations": "nursing",
    "station_handoffs": "nursing",
    "vte_risk_assessment": "nursing",
    "readmission_risk": "nursing",
    "nutrition_screening": "diet",
    "bedside": "nursing",
    "ward_par_stock": "supply_chain",
    # inpatient
    "icu": "ipd",
    "sepsis_hour1_bundle": "ipd",
    "mds_assessments": "ipd",
    "snf_admissions": "ipd",
    "transfusion_observations": "blood_bank",
    # emergency
    "er_bays": "emergency",
    "er_discharge_summary": "emergency",
    "er_observation_notes": "emergency",
    "ambulance": "emergency",
    # home and community care — seven separate migrations, one domain
    "home_care_packages": "home_care",
    "home_care_referrals": "home_care",
    "home_discharge_program": "home_care",
    "home_escalations": "home_care",
    "home_med_administration": "home_care",
    "home_progress_notes": "home_care",
    "home_visits": "home_care",
    "hospice_enrollments": "home_care",
    "bereavement_followups": "home_care",
    "caregiver_education": "home_care",
    # remote care
    "telemedicine": "telemedicine",
    "tele_chat_messages": "telemedicine",
    "tele_triage": "telemedicine",
    "remote_vital_readings": "telemedicine",
    "prescription_verify_links": "telemedicine",
    # devices
    "device_code_pairing": "devices",
    "device_node_keys": "devices",
    "device_pairing": "devices",
    "device_push_tokens": "devices",
    "vpn_devices": "devices",
    "bme": "facilities",
    "housekeeping": "facilities",
    "security": "facilities",
    "cssd": "theatre",
    # external systems
    "abdm_nhcx": "integration",
    "nhcx_callback_log": "integration",
    "nhcx_participants": "integration",
    "tpa_recon": "insurance",
    # specialties
    "dental": "specialty",
    "ophthalmology": "specialty",
    "oncology_depth": "specialty",
    "rehab_progress": "specialty",
    # research
    "trial_adverse_events": "clinical_trials",
    "trial_irb_submissions": "clinical_trials",
    "trial_randomizations": "clinical_trials",
    "trial_visits": "clinical_trials",
    # public-facing content
    "blog_posts": "cms",
    "news_articles": "cms",
    "testimonials": "cms",
    "health_packages": "cms",
    "public_booking_otps": "front_office",
    # messaging
    "notification": "notifications",
    "dlt_templates": "notifications",
    "family_messages": "notifications",
    "communication": "notifications",
    # records
    "roi": "mrd",
    "document_ingestion": "mrd",
    "documents": "mrd",
    "case_sheet_scans": "mrd",
    "consent": "patient",
    # quality and compliance
    "infection_control": "quality",
    "nabh_phase2_data_captures": "quality",
    "occ_health_exposures": "hr",
    "staff_location_assignments": "hr",
    "lms": "hr",
    "user_pharmacy_assignments": "pharmacy",
    # approvals platform (new)
    "central_approvals_platform": "approvals",
    "iam_access_requests": "approvals",
    # ai and simulation
    "ai_chat": "ai",
    "simulator_agent_findings": "ai",
    # displays
    "tv": "tv_displays",
    "command_center": "dashboards",
}

# Tables that no `CREATE TABLE` statement produces, so the parser cannot find
# their origin. Each needs a note saying how it actually came to exist.
TABLE_OVERRIDES: dict[str, str] = {
    # Created by `ALTER TABLE audit_log RENAME TO audit_log_legacy` inside a
    # DO block in 0106_audit_partitioning: the pre-partitioning audit table,
    # set aside rather than dropped so the old rows stay readable.
    "audit_log_legacy": "audit",
}

# Emitted before everything else, because everything else depends on them.
PRELUDE = "0001_extensions_types_functions"
# Emitted last: foreign keys that cross module boundaries, which cannot sit
# inside either module's file without imposing an ordering that does not exist.
EPILOGUE = "0900_cross_module_foreign_keys"
SEED = "0950_reference_data"


def canonical_module(raw: str) -> str:
    """Map a migration's name onto a domain.

    Longest alias wins, so `structured_camp_planning` resolves to camp rather
    than matching nothing and becoming its own file.
    """
    if raw in MODULE_ALIASES:
        return MODULE_ALIASES[raw]
    for alias in sorted(MODULE_ALIASES, key=len, reverse=True):
        if raw.startswith(f"{alias}_") or raw.endswith(f"_{alias}"):
            return MODULE_ALIASES[alias]
    return raw


def table_owners() -> dict[str, str]:
    """`table -> canonical module`, from whichever migration created it.

    First creation wins. A table dropped and recreated later keeps its original
    home, which is almost always where a reader expects to find it.
    """
    owners: dict[str, str] = {}
    for name in sorted(os.listdir(ARCHIVE)):
        if not name.endswith(".sql"):
            continue
        module = canonical_module(re.sub(r"^\d+_", "", name[:-4]))
        with open(os.path.join(ARCHIVE, name), encoding="utf-8", errors="replace") as handle:
            text = handle.read()
        for table in re.findall(
            r"CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_0-9]+)", text, re.I
        ):
            owners.setdefault(table.lower(), module)
    owners.update(TABLE_OVERRIDES)
    return owners



# ── parsing the oracle ──────────────────────────────────────────────────────


def split_statements(sql: str) -> list[str]:
    """Split a dump into statements on top-level semicolons.

    Naive splitting on ";" corrupts function bodies: a `$$ ... ; ... $$` block
    contains semicolons that are not statement terminators, and so do string
    literals. This tracks both.
    """
    out: list[str] = []
    buf: list[str] = []
    i, n = 0, len(sql)
    in_single = False
    dollar_tag: str | None = None
    while i < n:
        ch = sql[i]

        if dollar_tag:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            buf.append(ch)
            i += 1
            continue

        if in_single:
            buf.append(ch)
            # '' inside a literal is an escaped quote, not the end of it.
            if ch == "'":
                if i + 1 < n and sql[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if ch == "'":
            in_single = True
            buf.append(ch)
            i += 1
            continue

        if ch == "$":
            match = re.match(r"\$[A-Za-z_0-9]*\$", sql[i:])
            if match:
                dollar_tag = match.group(0)
                buf.append(dollar_tag)
                i += len(dollar_tag)
                continue

        if ch == "-" and sql.startswith("--", i):
            end = sql.find("\n", i)
            end = n if end == -1 else end
            buf.append(sql[i:end])
            i = end
            continue

        if ch == ";":
            statement = "".join(buf).strip()
            if statement:
                out.append(statement + ";")
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out


# Each pattern yields the table the statement belongs to, so it can be filed
# under that table's module.
TARGETS = [
    ("table",      re.compile(r"^CREATE TABLE (?:IF NOT EXISTS )?(?:ONLY )?(?:public\.)?([a-z_0-9]+)", re.I)),
    ("index",      re.compile(r"^CREATE (?:UNIQUE )?INDEX .*? ON (?:ONLY )?(?:public\.)?([a-z_0-9]+)", re.I | re.S)),
    ("policy",     re.compile(r"^CREATE POLICY .*? ON (?:public\.)?([a-z_0-9]+)", re.I | re.S)),
    ("trigger",    re.compile(r"^CREATE TRIGGER .*? ON (?:public\.)?([a-z_0-9]+)", re.I | re.S)),
    ("constraint", re.compile(r"^ALTER TABLE (?:ONLY )?(?:public\.)?([a-z_0-9]+)\s+ADD CONSTRAINT", re.I | re.S)),
    ("rls",        re.compile(r"^ALTER TABLE (?:ONLY )?(?:public\.)?([a-z_0-9]+).*ROW LEVEL SECURITY", re.I | re.S)),
    ("altertable", re.compile(r"^ALTER TABLE (?:ONLY )?(?:public\.)?([a-z_0-9]+)", re.I | re.S)),
    ("comment",    re.compile(r"^COMMENT ON (?:TABLE|COLUMN) (?:public\.)?([a-z_0-9]+)", re.I)),
]

# Statements that belong to no table and are emitted in the prelude.
PRELUDE_KINDS = re.compile(r"^(SET|SELECT pg_catalog|CREATE EXTENSION|CREATE TYPE|CREATE (OR REPLACE )?FUNCTION|COMMENT ON EXTENSION|CREATE (OR REPLACE )?VIEW|ALTER INDEX)", re.I)

FK_RE = re.compile(r"FOREIGN KEY .*? REFERENCES (?:public\.)?([a-z_0-9]+)", re.I | re.S)


def strip_leading_comments(statement: str) -> str:
    """Drop pg_dump's `-- Name: x; Type: TABLE; ...` banner from the front.

    The splitter keeps those lines because they belong to the statement, but
    they sit before the keyword every pattern below anchors on.
    """
    lines = statement.split("\n")
    while lines and (not lines[0].strip() or lines[0].lstrip().startswith("--")):
        lines.pop(0)
    return "\n".join(lines).lstrip()


def classify(statement: str) -> tuple[str, str | None]:
    body = strip_leading_comments(statement)
    if PRELUDE_KINDS.match(body):
        # ALTER INDEX ... ATTACH PARTITION belongs with its table, not the
        # prelude — but the index name does not name the table reliably, so it
        # is emitted late, after every partition exists.
        if body.upper().startswith("ALTER INDEX"):
            return ("attach_index", None)
        return ("prelude", None)
    for kind, pattern in TARGETS:
        match = pattern.match(body)
        if match:
            return (kind, match.group(1).lower())
    if body.upper().startswith("INSERT INTO"):
        match = re.match(r"INSERT INTO (?:public\.)?([a-z_0-9]+)", body, re.I)
        return ("seed", match.group(1).lower() if match else None)
    return ("other", None)

def analyse() -> int:
    owners = table_owners()
    by_module: dict[str, list[str]] = collections.defaultdict(list)
    for table, module in owners.items():
        by_module[module].append(table)

    print(f"{len(owners)} tables across {len(by_module)} canonical modules\n")
    for module, tables in sorted(by_module.items(), key=lambda kv: -len(kv[1])):
        print(f"  {len(tables):>4}  {module}")

    small = [m for m, t in by_module.items() if len(t) <= 2]
    print(f"\n{len(small)} modules still own <=2 tables:")
    print("  " + ", ".join(sorted(small)[:40]))
    print("\nAdd entries to MODULE_ALIASES for any of those that belong to a bigger domain.")
    return 0




# ── recovering the rationale ────────────────────────────────────────────────

# pg_dump's own banner. Several archived migrations were themselves generated,
# so `-- Name: foo; Type: TABLE; Schema: public` appears above 638 of the 861
# CREATE TABLE statements. It says nothing the SQL does not.
PGDUMP_BANNER = re.compile(r"^--\s*Name:\s+\S+;\s*Type:", re.I)
DECORATION = re.compile(r"^--\s*[─═—-]*\s*$")


def table_comments() -> dict[str, list[str]]:
    """`table -> the comment block a human wrote above its CREATE TABLE`.

    This is the reason to refactor rather than squash. `pg_dump` keeps six
    COMMENT ON TABLE statements out of 861 tables; everything explaining *why*
    a table exists lives in the migration that introduced it, as a plain SQL
    comment, and a dump discards all of it.

    Only 127 tables turn out to have genuine prose. The rest carry a generated
    banner or nothing — worth knowing, because it sets the honest expectation
    for what a reader will find.
    """
    found: dict[str, list[str]] = {}
    for name in sorted(os.listdir(ARCHIVE)):
        if not name.endswith(".sql"):
            continue
        with open(os.path.join(ARCHIVE, name), encoding="utf-8", errors="replace") as handle:
            lines = handle.read().split("\n")
        for index, line in enumerate(lines):
            match = re.match(
                r"\s*CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_0-9]+)", line, re.I
            )
            if not match:
                continue
            table = match.group(1).lower()
            if table in found:
                continue
            # Walk back over at most one blank line, then the comment block.
            # The house style separates the two; more than one blank line means
            # the comment belongs to whatever came before, not to this table.
            cursor, blanks = index - 1, 0
            while cursor >= 0 and not lines[cursor].strip() and blanks < 1:
                blanks += 1
                cursor -= 1
            block: list[str] = []
            while cursor >= 0 and lines[cursor].lstrip().startswith("--"):
                block.insert(0, lines[cursor].rstrip())
                cursor -= 1
            if not block or any(PGDUMP_BANNER.match(b.strip()) for b in block):
                continue
            prose = [b for b in block if b.strip() != "--" and not DECORATION.match(b.strip())]
            if prose:
                found[table] = prose
    return found


def without_pgdump_banner(statement: str) -> str:
    """Drop pg_dump's `-- Name: x; Type: TABLE; Schema: public; Owner: -` block.

    It restates the statement below it and nothing else, and it appears above
    every one of the ~10,700 statements in the dump. Removing it is most of
    what makes the emitted files readable, and it is the only pg_dump artefact
    that survives into them.
    """
    lines = statement.split("\n")
    while lines and (
        not lines[0].strip()
        or lines[0].strip() == "--"
        or PGDUMP_BANNER.match(lines[0].strip())
    ):
        lines.pop(0)
    return "\n".join(lines)


# ── emitting ────────────────────────────────────────────────────────────────

# Non-foreign-key constraints stay with their table: a PRIMARY KEY, UNIQUE or
# CHECK is part of what the table *is*. Foreign keys are relationships between
# tables and are deferred, so no file has to be ordered around them.
FK_CONSTRAINT = re.compile(r"ADD CONSTRAINT .*? FOREIGN KEY", re.I | re.S)


def module_header(module: str, tables: list[str]) -> str:
    return f"""-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: {len(tables)}
-- Drops: none
-- {module.replace('_', ' ')} — schema.
--
-- Each table is declared once, in its final shape, with its indexes, policies
-- and triggers beside it. Before this refactor the definition of a single
-- table was spread over as many as nine migrations, and reading it meant
-- replaying the history in your head.
--
-- Foreign keys are not here. They are relationships rather than structure, and
-- deferring them to the end of the file (same-module) or to
-- 0900_cross_module_foreign_keys.sql (everything else) means no file has to be
-- ordered around anything another file declares.

"""


ATTACH_RE = re.compile(
    r"ALTER TABLE (?:ONLY )?(?:public\.)?([a-z_0-9]+)\s+ATTACH PARTITION (?:public\.)?([a-z_0-9]+)",
    re.I | re.S,
)

# A function whose signature names a table cannot be created before that table.
# `RETURNS SETOF identity_providers` is the case that broke the first attempt.
RETURNS_TABLE_RE = re.compile(r"RETURNS\s+(?:SETOF\s+)?(?:public\.)?([a-z_0-9]+)", re.I)


def emit_files(statements: list[tuple[str, str, str | None]], owners: dict[str, str]) -> dict[str, list[str]]:
    """Bucket every statement into the file it belongs in."""
    # Partition children are created by `ensure_partitions()` at runtime, so no
    # migration declares them and they have no module of their own. They belong
    # with their parent — and crucially, before the ATTACH that adopts them.
    partition_parent: dict[str, str] = {}
    for _kind, text, _table in statements:
        match = ATTACH_RE.search(strip_leading_comments(text))
        if match:
            partition_parent[match.group(2).lower()] = match.group(1).lower()
    for child, parent in partition_parent.items():
        if parent in owners:
            owners.setdefault(child, owners[parent])
    files: dict[str, list[str]] = collections.defaultdict(list)
    # table -> the statements that describe it, in emission order
    per_table: dict[str, dict[str, list[str]]] = collections.defaultdict(
        lambda: collections.defaultdict(list)
    )
    module_fks: dict[str, list[str]] = collections.defaultdict(list)

    for kind, raw, table in statements:
        text = without_pgdump_banner(raw)
        if kind == "prelude" or (kind == "other" and text.lstrip().upper().startswith("COMMENT ON FUNCTION")):
            body = strip_leading_comments(text)
            # PostgreSQL validates a `LANGUAGE sql` body when the function is
            # created, so one that reads a table cannot precede it. A plpgsql
            # body is not validated until it runs, and trigger functions must
            # exist *before* the triggers that reference them — so those stay
            # in the prelude regardless of what they touch.
            is_sql_language = re.search(r"LANGUAGE\s+sql\b", body, re.I) is not None
            returns = RETURNS_TABLE_RE.search(body)
            if re.match(r"CREATE\s+(OR\s+REPLACE\s+)?FUNCTION", body, re.I) and is_sql_language:
                files["0890_views_and_table_functions"].append(text)
            elif returns and returns.group(1).lower() in owners:
                files["0890_views_and_table_functions"].append(text)
            elif re.match(r"CREATE\s+(OR\s+REPLACE\s+)?VIEW", body, re.I):
                files["0890_views_and_table_functions"].append(text)
            else:
                files[PRELUDE].append(text)
        elif kind == "attach_index":
            files["0910_partition_indexes"].append(text)
        elif kind == "seed":
            files[SEED].append(text)
        elif kind == "constraint" and table and FK_CONSTRAINT.search(text):
            referenced = FK_RE.search(text)
            target = referenced.group(1).lower() if referenced else None
            here, there = owners.get(table), owners.get(target or "")
            if here and here == there:
                module_fks[here].append(text)
            else:
                files[EPILOGUE].append(text)
        elif table:
            per_table[table][kind].append(text)
        else:
            files[PRELUDE].append(text)

    # Order within a table: what it is, then how it is constrained, then how it
    # is found, then who may see it, then what fires on it.
    order = ["table", "constraint", "index", "rls", "policy", "trigger", "comment"]
    # ATTACH PARTITION is held back: every child in this module must exist
    # first, and they are separate tables emitted in name order.
    attaches: dict[str, list[str]] = collections.defaultdict(list)
    for table, kinds in per_table.items():
        for text in kinds.get("altertable", []):
            if ATTACH_RE.search(strip_leading_comments(text)):
                attaches[owners.get(table, "unassigned")].append(text)
            else:
                kinds.setdefault("constraint", []).insert(0, text)
    comments = table_comments()
    by_module: dict[str, list[str]] = collections.defaultdict(list)
    for table in sorted(per_table):
        module = owners.get(table, "unassigned")
        block: list[str] = []
        if table in comments:
            # Carried verbatim from the migration that introduced the table.
            # Reworded it would be a guess; as written it is what the author
            # meant at the time, which is what a reader needs.
            block.append("\n".join(comments[table]))
        for kind in order:
            block.extend(per_table[table].get(kind, []))
        if block:
            by_module[module].append("\n\n".join(block))

    for index, module in enumerate(sorted(by_module), start=1):
        name = f"{10 * index:04d}_{module}"
        files[name].append(module_header(module, [t for t in per_table if owners.get(t) == module]))
        files[name].extend(by_module[module])
        if attaches.get(module):
            files[name].append(
                "-- ── partition attachment ────────────────────────────────────────────\n"
                "-- After every child above exists."
            )
            files[name].extend(attaches[module])
        if module_fks.get(module):
            files[name].append(
                "-- ── foreign keys within this module ─────────────────────────────────\n"
                "-- Declared last so the tables above can appear in any order."
            )
            files[name].extend(module_fks[module])

    return files


def emit() -> int:
    with open(ORACLE, encoding="utf-8") as handle:
        oracle = handle.read()
    owners = table_owners()
    statements = []
    for text in split_statements(oracle):
        kind, table = classify(text)
        statements.append((kind, text, table))

    files = emit_files(statements, owners)

    written, total_statements = 0, 0
    for name in sorted(files):
        path = os.path.join(OUT_DIR, f"{name}.sql")
        body = "\n\n".join(files[name]).rstrip() + "\n"
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(body)
        written += 1
        total_statements += len(files[name])
        print(f"  {len(files[name]):>5} statements  {name}.sql")
    print(f"\n{written} files, {total_statements:,} statements")
    print("\nNow verify: scripts/verify_refactor.sh")
    return 0

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analyse", action="store_true", help="show the module mapping")
    parser.add_argument("--emit", action="store_true", help="write the refactored files")
    args = parser.parse_args()

    if not os.path.exists(ORACLE):
        raise SystemExit(f"no baseline at {ORACLE} — it is the source of truth for this")
    if args.analyse or not args.emit:
        return analyse()
    return emit()


if __name__ == "__main__":
    sys.exit(main())

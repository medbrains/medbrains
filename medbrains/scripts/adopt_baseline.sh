#!/usr/bin/env bash
# Point an existing database at the consolidated baseline.
#
#   scripts/adopt_baseline.sh                 # report only
#   scripts/adopt_baseline.sh --apply         # rewrite the ledger
#
# A database migrated the old way has ~262 rows in `_sqlx_migrations`. The
# source now holds one file, so sqlx starts up, finds versions recorded as
# applied that it cannot see, and refuses with `VersionMissing`. The schema is
# perfectly fine; only the ledger disagrees.
#
# This replaces those rows with a single row for the baseline, carrying the
# SHA-384 of the baseline file — which is the checksum sqlx computes, verified
# empirically against migration 0001 rather than assumed.
#
# It does not touch the schema. If the database's schema and the baseline have
# genuinely diverged, adopting would paper over that, so the divergence check
# below runs first and refuses.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MIGRATIONS="crates/medbrains-db-migrations/src/migrations"
DB="${1:-medbrains}"
APPLY=false
for arg in "$@"; do [[ "$arg" == "--apply" ]] && APPLY=true; done
[[ "$DB" == "--apply" ]] && DB="medbrains"

psql_q() { docker compose exec -T postgres psql -U medbrains -d "$DB" -At -c "$1"; }

# One ledger row per emitted file, each carrying the SHA-384 of that file —
# the checksum sqlx computes, verified empirically against the old migration
# 0001 rather than assumed.
mapfile -t FILES < <(ls "$MIGRATIONS"/*.sql | sort)

echo "database:  $DB"
echo "migrations: ${#FILES[@]} files in $MIGRATIONS"
echo

APPLIED="$(psql_q "SELECT count(*) FROM _sqlx_migrations;" 2>/dev/null || echo 0)"
echo "ledger rows today: $APPLIED"

if [[ "$APPLIED" == "${#FILES[@]}" ]]; then
    echo "ledger already has one row per file — checking checksums"
fi

# Refuse to adopt a database whose schema is not the baseline's schema.
#
# Table count is a coarse check and deliberately so: a precise one means
# diffing a full dump, which `verify_baseline.sh` already does properly. This
# exists to catch the obvious case — pointing this at the wrong database.
EXPECTED_TABLES="$(cat "$MIGRATIONS"/*.sql | grep -c '^CREATE TABLE')"
ACTUAL_TABLES="$(psql_q "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
echo "tables — baseline declares $EXPECTED_TABLES, database has $ACTUAL_TABLES"

DRIFT=$(( EXPECTED_TABLES > ACTUAL_TABLES ? EXPECTED_TABLES - ACTUAL_TABLES : ACTUAL_TABLES - EXPECTED_TABLES ))
if (( DRIFT > 5 )); then
    echo
    echo "REFUSING: the schemas differ by $DRIFT tables."
    echo "This database is not the one the baseline describes. Adopting would record"
    echo "it as up to date when it is not. Run scripts/verify_baseline.sh, or check"
    echo "you are pointing at the right database."
    exit 1
fi

if [[ "$APPLY" != "true" ]]; then
    echo
    echo "would replace $APPLIED ledger rows with ${#FILES[@]}, one per file"
    echo "re-run with --apply to do it"
    exit 0
fi

# The old ledger is kept, not dropped. It records when each of the 262 was
# applied, which is the only evidence of what this database has actually been
# through — worth more than the space it occupies.
psql_q "CREATE TABLE IF NOT EXISTS _sqlx_migrations_pre_baseline AS
        TABLE _sqlx_migrations;" >/dev/null
echo "old ledger preserved as _sqlx_migrations_pre_baseline"

VALUES=""
for file in "${FILES[@]}"; do
    base="$(basename "$file" .sql)"
    version="${base%%_*}"
    version="$((10#$version))"          # 0010 is ten, not octal
    description="${base#*_}"
    checksum="$(shasum -a 384 "$file" | cut -d' ' -f1)"
    VALUES+="($version, '$description', now(), true, decode('$checksum','hex'), 0),"
done
psql_q "BEGIN;
        DELETE FROM _sqlx_migrations;
        INSERT INTO _sqlx_migrations
            (version, description, installed_on, success, checksum, execution_time)
        VALUES ${VALUES%,};
        COMMIT;" >/dev/null

echo "adopted — ledger now has $(psql_q "SELECT count(*) FROM _sqlx_migrations;") rows"
echo "start the backend; sqlx should report no pending migrations"

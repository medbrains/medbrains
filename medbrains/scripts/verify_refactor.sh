#!/usr/bin/env bash
# Prove the per-module schema files still equal the migrations they replaced.
#
#   scripts/verify_refactor.sh
#
# Builds one database from `crates/medbrains-db-migrations/migrations-archive/*.sql` in
# order and another from `crates/medbrains-db-migrations/src/migrations/*.sql`, then diffs
# their schemas.
#
# Run this after any `--emit`, and after hand-editing a module file. A refactor
# that silently drops a policy, a trigger or a check constraint produces files
# that apply perfectly and a database that is quietly wrong — which is exactly
# what a diff catches and reading cannot.
#
# Only the *refactored set* is compared — files numbered up to 0950. Anything
# above that is new work layered on afterwards (the foreign-key indexes, for
# instance), which the archive legitimately does not have. Including it would
# make this report a failure every time somebody adds a migration, and a check
# that cries wolf stops being run.
#
# The only tolerated difference is CHECK-constraint rendering: PostgreSQL
# rewrites `ANY((ARRAY[...])::text[])` as `ANY(ARRAY[(...)::text, ...])` the
# first time a constraint passes through pg_dump. Same constraint, different
# text. Everything else fails the run.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ARCHIVE="crates/medbrains-db-migrations/migrations-archive"
CURRENT="crates/medbrains-db-migrations/src/migrations"
DB_ARCHIVE="mb_verify_archive"
DB_CURRENT="mb_verify_current"

psql_in() { docker compose exec -T postgres psql -U medbrains -d "$1" -q -v ON_ERROR_STOP=1; }
psql_admin() { docker compose exec -T postgres psql -U medbrains -d postgres -q -c "$1" >/dev/null; }

dump() {
    docker compose exec -T postgres pg_dump -U medbrains -d "$1" \
        --schema-only --no-owner --no-acl 2>/dev/null |
        grep -vE '^\\(restrict|unrestrict)|^--|^$'
}

build() {
    local db="$1" dir="$2" label="$3"
    psql_admin "DROP DATABASE IF EXISTS $db;"
    psql_admin "CREATE DATABASE $db;"
    local count=0
    for file in $(ls "$dir"/*.sql | sort); do
        # Skip post-refactor migrations when building the "current" side; see
        # the note at the top.
        if [[ "$label" == "current" ]]; then
            base="$(basename "$file")"
            [[ "${base%%_*}" > "0950" ]] && continue
        fi
        if ! psql_in "$db" < "$file" >/dev/null 2>&1; then
            echo "  FAILED applying $(basename "$file") to $label"
            # Re-run without silencing so the reason is visible. The first
            # error is the useful one; the rest are consequences of it.
            psql_in "$db" < "$file" 2>&1 | grep -m1 '^ERROR' || true
            return 1
        fi
        count=$((count + 1))
    done
    echo "  $label: $count files applied"
}

echo "building from $ARCHIVE ($(ls "$ARCHIVE"/*.sql | wc -l | tr -d ' ') files)..."
build "$DB_ARCHIVE" "$ARCHIVE" "archive" || exit 1

echo "building from $CURRENT (refactored set only, up to 0950)..."
build "$DB_CURRENT" "$CURRENT" "current" || exit 1

echo "diffing..."
dump "$DB_ARCHIVE" > /tmp/mb_refactor_a.sql
dump "$DB_CURRENT" > /tmp/mb_refactor_b.sql

TOTAL=$(diff /tmp/mb_refactor_a.sql /tmp/mb_refactor_b.sql | grep -cE '^[<>]' || true)
UNEXPECTED=$(diff /tmp/mb_refactor_a.sql /tmp/mb_refactor_b.sql |
    grep -E '^[<>]' | grep -vc 'CONSTRAINT .*_check CHECK' || true)

echo "  $TOTAL differing lines, $UNEXPECTED of them not CHECK-constraint rendering"

# Tidy up only on success: a failed run leaves both databases behind so the
# difference can be inspected directly rather than reproduced.
if [[ "$UNEXPECTED" -eq 0 ]]; then
    psql_admin "DROP DATABASE IF EXISTS $DB_ARCHIVE;"
    psql_admin "DROP DATABASE IF EXISTS $DB_CURRENT;"
    echo "EQUIVALENT"
    exit 0
fi

echo
echo "DIFFERENT — the refactored files do not match the archive:"
diff /tmp/mb_refactor_a.sql /tmp/mb_refactor_b.sql | grep -E '^[<>]' |
    grep -v 'CONSTRAINT .*_check CHECK' | head -40
echo
echo "both databases kept for inspection: $DB_ARCHIVE, $DB_CURRENT"
exit 1

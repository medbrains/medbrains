#!/usr/bin/env bash
# Prove the consolidated baseline still equals the migrations it replaced.
#
#   scripts/verify_baseline.sh
#
# Builds one database from `crates/medbrains-db-migrations/migrations-archive/*.sql` in
# order and another from `crates/medbrains-db-migrations/src/migrations/0001_baseline.sql`,
# then diffs their schemas. They must be identical apart from CHECK-constraint
# rendering, which PostgreSQL normalises on the first dump round-trip.
#
# Worth running whenever the archive is touched, and worth running once before
# trusting the baseline in the first place: a consolidation that silently drops
# a policy or a trigger looks exactly like a successful one.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ARCHIVE="crates/medbrains-db-migrations/migrations-archive"
BASELINE="crates/medbrains-db-migrations/src/migrations/0001_baseline.sql"
FROM_MIGRATIONS="mb_verify_migrations"
FROM_BASELINE="mb_verify_baseline"

psql_in() { docker compose exec -T postgres psql -U medbrains -d "$1" -q -v ON_ERROR_STOP=1; }
psql_admin() { docker compose exec -T postgres psql -U medbrains -d postgres -q -c "$1"; }

# `--no-owner --no-acl` because ownership differs between environments and is
# not part of what we are comparing. Comments and blank lines are dropped so a
# reordered comment cannot read as a schema change.
dump() {
    docker compose exec -T postgres pg_dump -U medbrains -d "$1" \
        --schema-only --no-owner --no-acl 2>/dev/null |
        grep -vE '^\\(restrict|unrestrict)|^--|^$'
}

if [[ ! -d "$ARCHIVE" ]]; then
    echo "no archive at $ARCHIVE — nothing to verify against"
    exit 1
fi

echo "building $FROM_MIGRATIONS from $(ls "$ARCHIVE"/*.sql | wc -l | tr -d ' ') archived migrations..."
psql_admin "DROP DATABASE IF EXISTS $FROM_MIGRATIONS;" >/dev/null
psql_admin "CREATE DATABASE $FROM_MIGRATIONS;" >/dev/null
for file in $(ls "$ARCHIVE"/*.sql | sort); do
    if ! psql_in "$FROM_MIGRATIONS" < "$file" >/dev/null 2>&1; then
        echo "  FAILED applying $(basename "$file")"
        exit 1
    fi
done

echo "building $FROM_BASELINE from the baseline..."
psql_admin "DROP DATABASE IF EXISTS $FROM_BASELINE;" >/dev/null
psql_admin "CREATE DATABASE $FROM_BASELINE;" >/dev/null
psql_in "$FROM_BASELINE" < "$BASELINE" >/dev/null

echo "diffing..."
dump "$FROM_MIGRATIONS" > /tmp/mb_verify_a.sql
dump "$FROM_BASELINE" > /tmp/mb_verify_b.sql

if diff -q /tmp/mb_verify_a.sql /tmp/mb_verify_b.sql >/dev/null; then
    echo "IDENTICAL"
    exit 0
fi

# The only tolerated difference. PostgreSQL re-renders
# `ANY((ARRAY[...])::text[])` as `ANY(ARRAY[(...)::text, ...])` when a CHECK
# constraint makes its first trip through pg_dump. Semantically the same
# constraint; textually not.
UNEXPECTED=$(diff /tmp/mb_verify_a.sql /tmp/mb_verify_b.sql |
    grep -E '^[<>]' | grep -vc 'CONSTRAINT .*_check CHECK' || true)

TOTAL=$(diff /tmp/mb_verify_a.sql /tmp/mb_verify_b.sql | grep -cE '^[<>]' || true)
echo "  $TOTAL differing lines, $UNEXPECTED of them not CHECK-constraint rendering"

if [[ "$UNEXPECTED" -eq 0 ]]; then
    echo "EQUIVALENT (differences are CHECK-constraint rendering only)"
    exit 0
fi

echo "DIFFERENT — the baseline does not match the migrations:"
diff /tmp/mb_verify_a.sql /tmp/mb_verify_b.sql | grep -E '^[<>]' |
    grep -v 'CONSTRAINT .*_check CHECK' | head -40
exit 1

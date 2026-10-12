#!/usr/bin/env bash
# Runnable check for db-roles.sh against the dev Postgres (`make db`, port 5435).
# No framework: bash + asserts.
#   bash deploy/standalone/test-db-roles.sh
#
# It sets random passwords on medbrains_app / medbrains_outbox_worker while it
# runs and puts the dev ones (make dev-db-roles) back on exit.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OWNER="${TEST_OWNER_URL:-postgres://medbrains:medbrains_dev@localhost:5435/medbrains}"

# shellcheck source=./db-roles.sh
. "$HERE/db-roles.sh"
# The dedicated-host container is not what we test against: force the URL path.
DB_ROLES_CONTAINER=no-such-container

command -v psql >/dev/null || { echo "SKIP: psql not installed"; exit 0; }
db_login_psql "$OWNER" <<<'SELECT 1' >/dev/null 2>&1 \
    || { echo "SKIP: dev Postgres not reachable (make db)"; exit 0; }

TMP="$(mktemp -d)"
restore() {
    db_roles_sql medbrains_dev medbrains_dev | db_admin_psql "$OWNER" >/dev/null
    rm -rf "$TMP"
}
trap restore EXIT

fail=0
check() { # check <label> <expected> <actual>
    if [[ "$2" == "$3" ]]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected '$2', got '$3'"
        fail=1
    fi
}
as_role() { db_login_psql "$(db_env_get "$1" "$ENV")" <<<"$2"; }

ENV="$TMP/env"
printf 'PORT=3000\nDATABASE_URL=%s\nJWT_PUBLIC_KEY=abc=def\n' "$OWNER" > "$ENV"
chmod 640 "$ENV"

# ── fresh install: one owner URL becomes three ───────────────────────
db_roles_configure "$ENV" >/dev/null
check "requests connect as medbrains_app" medbrains_app "$(db_url_user "$(db_env_get DATABASE_URL "$ENV")")"
check "migrations keep the owner" "$OWNER" "$(db_env_get MIGRATION_DATABASE_URL "$ENV")"
check "workers connect as medbrains_outbox_worker" medbrains_outbox_worker \
    "$(db_url_user "$(db_env_get WORKER_DATABASE_URL "$ENV")")"
check "other keys untouched" "abc=def" "$(db_env_get JWT_PUBLIC_KEY "$ENV")"
check "file mode kept" 640 "$(stat -f %Lp "$ENV" 2>/dev/null || stat -c %a "$ENV")"
check "passwords are generated, not the dev ones" 32 \
    "$(db_url_password "$(db_env_get DATABASE_URL "$ENV")" | tr -d '\n' | wc -c | tr -d ' ')"

# ── what the split is for ────────────────────────────────────────────
check "medbrains_app is neither superuser nor bypasses RLS" "f|f" \
    "$(as_role DATABASE_URL 'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user')"
check "medbrains_app sees 0 patients with no tenant set" 0 \
    "$(as_role DATABASE_URL 'SELECT count(*) FROM patients')"
owner_count="$(as_role MIGRATION_DATABASE_URL 'SELECT count(*) FROM patients')"
check "the worker crosses tenants (sees what the owner sees)" "$owner_count" \
    "$(as_role WORKER_DATABASE_URL 'SELECT count(*) FROM patients')"

# ── re-run: nothing changes, passwords kept, still logs in ──────────
before="$(cat "$ENV")"
db_roles_configure "$ENV" >/dev/null
check "re-run is idempotent" "$before" "$(cat "$ENV")"
check "kept password still logs in" 1 "$(as_role DATABASE_URL 'SELECT 1')"

# ── attach re-run: the owner URL moved; the other two follow it ─────
moved="${OWNER/localhost/127.0.0.1}"
app_pw="$(db_url_password "$(db_env_get DATABASE_URL "$ENV")")"
db_env_set "$(db_roles_owner_key "$ENV")" "$moved" "$ENV"
db_roles_configure "$ENV" >/dev/null
check "app URL follows the owner's host" "$(db_url_as "$moved" medbrains_app "$app_pw")" \
    "$(db_env_get DATABASE_URL "$ENV")"
check "one line per key" 1 "$(grep -c '^DATABASE_URL=' "$ENV")"

# ── an owner that cannot log in leaves the file alone ───────────────
before="$(cat "$ENV")"
db_env_set MIGRATION_DATABASE_URL "${moved/medbrains_dev@/wrong@}" "$ENV"
broken="$(cat "$ENV")"
if db_roles_configure "$ENV" >/dev/null 2>&1; then
    echo "FAIL a bad owner password must fail"
    fail=1
else
    echo "ok   a bad owner password fails"
fi
check "nothing written on failure" "$broken" "$(cat "$ENV")"

# ── dedicated host: admin SQL and the login check run inside the container ─
DEV_CONTAINER="${TEST_PG_CONTAINER:-medbrains-postgres-1}"
if docker container inspect "$DEV_CONTAINER" >/dev/null 2>&1; then
    DB_ROLES_CONTAINER="$DEV_CONTAINER"
    printf 'DATABASE_URL=%s\n' "$OWNER" > "$ENV"
    db_roles_configure "$ENV" >/dev/null
    check "container path: medbrains_app logs in, sees 0 patients" 0 \
        "$(as_role DATABASE_URL 'SELECT count(*) FROM patients')"
    DB_ROLES_CONTAINER=no-such-container
else
    echo "skip container path ($DEV_CONTAINER not running)"
fi

exit "$fail"

#!/usr/bin/env bash
# One throwaway PostgreSQL 17 per machine for the Rust DB tests.
#
#   scripts/test_db.sh          # start it, or reuse it; prints the server URL
#   scripts/test_db.sh stop     # stop it (data kept; the next start is instant)
#
# Shared by every worktree and agent: the tests copy a migrated template
# database per test (medbrains-db-migrations `testing`), so a shared server is
# safe and only the first test after a migration change pays for migrating.
#
# Deliberately not the dev database, not Docker, and not medbrains/infra/.env:
# it lives outside the repo, listens on 127.0.0.1 only, on its own port, and
# holds nothing but test copies. Durability is switched off (fsync, full page
# writes) because a crash loses only data a test would have thrown away.
set -euo pipefail
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
DATA="${MEDBRAINS_TEST_PG_DATA:-$HOME/.local/share/medbrains-test-pg}"
PORT=54317 # fixed; the Rust helper's default URL names it too
PASSWORD=medbrains_test # a test-only cluster on loopback; not a secret
URL="postgres://medbrains:$PASSWORD@127.0.0.1:$PORT/postgres"

if [[ ! -x "$PG_BIN/pg_ctl" ]] || ! "$PG_BIN/postgres" --version | grep -q ' 17\.'; then
  echo "PostgreSQL 17 not found at $PG_BIN (brew install postgresql@17, or set PG_BIN)." >&2
  exit 1
fi

if [[ "${1:-}" == "stop" ]]; then
  "$PG_BIN/pg_ctl" -D "$DATA" -m fast stop
  exit 0
fi

if [[ ! -f "$DATA/PG_VERSION" ]]; then
  mkdir -p "$DATA"
  "$PG_BIN/initdb" -D "$DATA" -U medbrains -E UTF8 --locale=C >/dev/null
  cat >>"$DATA/postgresql.conf" <<EOF
# medbrains test cluster (scripts/test_db.sh)
listen_addresses = '127.0.0.1'
port = $PORT
unix_socket_directories = '$DATA'
max_connections = 300
fsync = off
synchronous_commit = off
full_page_writes = off
EOF
elif [[ "$(cat "$DATA/PG_VERSION")" != "17" ]]; then
  echo "$DATA holds a PostgreSQL $(cat "$DATA/PG_VERSION") cluster, not 17. Move it aside." >&2
  exit 1
fi

# Rewritten every run, so an older cluster is brought up to this policy.
# - The socket sits in the 0700 data dir, so only this OS user reaches it.
# - The two login roles the migrations create (0981, 0984) have no password,
#   and the tests must log in as them for row level security to apply: trust
#   them, and only them, on loopback.
# - Everyone else, the superuser included, needs the password.
cat >"$DATA/pg_hba.conf" <<EOF
# medbrains test cluster (scripts/test_db.sh): rewritten on every run
local all all trust
host all medbrains_app,medbrains_outbox_worker 127.0.0.1/32 trust
host all all 127.0.0.1/32 scram-sha-256
EOF

if "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$DATA" reload >/dev/null
else
  "$PG_BIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -w start >/dev/null
fi
# The password, and the marker the Rust helper refuses to run without.
"$PG_BIN/psql" -h "$DATA" -p "$PORT" -U medbrains -d postgres -qAt >/dev/null <<SQL
ALTER ROLE medbrains PASSWORD '$PASSWORD';
SELECT 'CREATE DATABASE medbrains_test_cluster'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'medbrains_test_cluster') \gexec
SQL
echo "$URL"

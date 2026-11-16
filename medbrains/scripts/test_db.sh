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
URL="postgres://medbrains@127.0.0.1:$PORT/postgres"

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
  # Trust auth: the roles the migrations create (medbrains_app, the worker)
  # have no password, and the tests must log in as them for RLS to apply.
  # Safe only because it is loopback-only and holds no real data.
  "$PG_BIN/initdb" -D "$DATA" -U medbrains --auth=trust -E UTF8 --locale=C >/dev/null
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

if ! "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -w start >/dev/null
fi
echo "$URL"

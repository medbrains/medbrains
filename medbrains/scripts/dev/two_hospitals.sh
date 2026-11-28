#!/usr/bin/env bash
# Two separate hospital installs on one Mac, for testing what moves between
# hospitals (referrals, transfers, ABDM exchange) without any cloud account.
#
#   scripts/dev/two_hospitals.sh start    # both clusters, servers, web apps
#   scripts/dev/two_hospitals.sh stop     # stop everything; data is kept
#   scripts/dev/two_hospitals.sh reset    # stop and delete both installs
#   scripts/dev/two_hospitals.sh status
#
# Each hospital gets its own PostgreSQL 17 cluster, its own debug server with
# its own JWT pair, and its own Vite dev server, on ports clear of the normal
# dev stack (5432, 5435, 5436, 54317, 3000, 5173). Nothing is shared: two
# servers on one database would be one hospital, not two.
#
#   Hospital A   web http://hospital-a.localhost:5181   api 127.0.0.1:3101   pg 55431
#   Hospital B   web http://hospital-b.localhost:5182   api 127.0.0.1:3102   pg 55432
#
# The two web origins differ by host name, not only by port: browsers keep one
# cookie jar per host, so on one host the second sign-in would log the first
# out. Both sign in as admin / admin123 (the development seed). The browser
# reaches each API through its Vite proxy (same origin), so CORS is unused; the
# server refuses a non-HTTPS CORS_ORIGIN, hence the placeholder HTTPS origin.
#
# The server binary is built once beforehand, so this script never starts a
# cargo job (ENGINEERING.md, "Never start a build while one is running"):
#
#   bash scripts/build_guard.sh --wait
#   SQLX_OFFLINE=true CARGO_TARGET_DIR=/tmp/mb-target-two-hosp \
#     cargo build -p medbrains-server --bin medbrains-server
#
# SpiceDB is left unset, so each server uses the Postgres-native authz backend
# (a shared SpiceDB would merge the two hospitals' relations). Data lives in
# $TWO_HOSP_HOME, default /tmp/mb-two-hosp/state. Invented patients only.
# Every value here is a development default, not a secret.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="${TWO_HOSP_HOME:-/tmp/mb-two-hosp/state}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
SERVER_BIN="${SERVER_BIN:-${CARGO_TARGET_DIR:-/tmp/mb-target-two-hosp}/debug/medbrains-server}"
PG_PASSWORD=medbrains_dev
HOSPITALS=(a b)

# Print an error and stop; every failure names the fix.
die() { echo "two_hospitals: $*" >&2; exit 1; }

# Set the per-hospital variables for hospital $1 (a or b).
hospital() {
  H="$1"
  case "$H" in
    a) PG_PORT=55431 API_PORT=3101 WEB_PORT=5181 NAME="Hospital A" ;;
    b) PG_PORT=55432 API_PORT=3102 WEB_PORT=5182 NAME="Hospital B" ;;
    *) die "unknown hospital '$H' (a or b)" ;;
  esac
  DIR="$STATE/hospital-$H"
  WEB_ORIGIN="http://hospital-$H.localhost:$WEB_PORT"
}

# Poll a readiness command for up to $1 seconds; the rest is the command.
wait_until() {
  local seconds="$1" i; shift
  for ((i = 0; i < seconds * 2; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

# Stop when port $1 is taken by something this script did not start, which
# would otherwise answer the readiness check in our process's place.
require_free_port() {
  if nc -z 127.0.0.1 "$1" 2>/dev/null; then die "port $1 is in use by another process"; fi
}

# True when pid file $1 names a live process.
is_running() { [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null; }

# Run SQL as the cluster owner against database $1 of the current hospital.
pg_sql() {
  PGPASSWORD="$PG_PASSWORD" "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$PG_PORT" -U medbrains -d "$1" -At -c "$2"
}

# Create (first run) and start the current hospital's cluster, its database
# and the app/worker roles, exactly as scripts/dev/native_stack.sh does.
start_postgres() {
  [[ -x "$PG_BIN/pg_ctl" ]] || die "PostgreSQL 17 missing: brew install postgresql@17"
  if [[ ! -f "$DIR/pg/PG_VERSION" ]]; then
    local pwfile; pwfile="$(mktemp)"
    printf '%s\n' "$PG_PASSWORD" >"$pwfile"
    "$PG_BIN/initdb" -D "$DIR/pg" -U medbrains --pwfile="$pwfile" \
      --auth=scram-sha-256 --encoding=UTF8 --locale=C >"$DIR/initdb.log"
    rm -f "$pwfile"
  fi
  if ! "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PG_PORT"; then
    "$PG_BIN/pg_ctl" -D "$DIR/pg" -l "$DIR/postgres.log" -w -t 60 \
      -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k $DIR" start >/dev/null
  fi
  [[ "$(pg_sql postgres "SELECT 1 FROM pg_database WHERE datname='medbrains'")" == 1 ]] \
    || pg_sql postgres "CREATE DATABASE medbrains"
  bash -c '. "$1/deploy/standalone/db-roles.sh" && db_roles_sql "$2" "$2"' _ "$ROOT_DIR" "$PG_PASSWORD" \
    | PGPASSWORD="$PG_PASSWORD" "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 \
        -h 127.0.0.1 -p "$PG_PORT" -U medbrains -d medbrains >/dev/null
  echo "$NAME postgres: 127.0.0.1:$PG_PORT"
}

# A JWT pair of the hospital's own, kept across restarts so sessions survive.
ensure_jwt_pair() {
  [[ -f "$DIR/jwt-private.pem" ]] && return 0
  openssl genpkey -algorithm ed25519 -out "$DIR/jwt-private.pem" 2>/dev/null
  openssl pkey -in "$DIR/jwt-private.pem" -pubout -out "$DIR/jwt-public.pem"
  chmod 600 "$DIR/jwt-private.pem"
}

# Start the current hospital's server from its own directory, so neither the
# repo's .env nor config.toml is picked up; wait for /api/health.
start_server() {
  [[ -x "$SERVER_BIN" ]] || die "server binary missing at $SERVER_BIN; build it (see the header)"
  ensure_jwt_pair
  if ! is_running "$DIR/server.pid"; then
    require_free_port "$API_PORT"
    local db="127.0.0.1:$PG_PORT/medbrains"
    (cd "$DIR" && env -i PATH="$PATH" HOME="$HOME" \
      MEDBRAINS_ENV=development HOST=127.0.0.1 PORT="$API_PORT" \
      DATABASE_URL="postgres://medbrains_app:$PG_PASSWORD@$db" \
      MIGRATION_DATABASE_URL="postgres://medbrains:$PG_PASSWORD@$db" \
      WORKER_DATABASE_URL="postgres://medbrains_outbox_worker:$PG_PASSWORD@$db" \
      JWT_PRIVATE_KEY="$(cat "$DIR/jwt-private.pem")" JWT_PUBLIC_KEY="$(cat "$DIR/jwt-public.pem")" \
      CORS_ORIGIN="https://hospital-$H.medbrains.localhost" SECURE_COOKIES=false MEDBRAINS_SECRETS_BACKEND=env \
      MEDBRAINS_PUBLIC_BASE_URL="http://127.0.0.1:$API_PORT" \
      MEDBRAINS_SEED_HOSPITAL_NAME="$NAME" MEDBRAINS_NOTIFY_SIMULATOR=true \
      ${GOTENBERG_URL:+GOTENBERG_URL="$GOTENBERG_URL"} \
      RUST_LOG="${RUST_LOG:-medbrains_server=info,tower_http=info}" \
      nohup "$SERVER_BIN" >>"$DIR/server.log" 2>&1 & echo $! >"$DIR/server.pid")
  fi
  # A fresh database runs every migration on first boot: allow a few minutes.
  wait_until 600 curl -sf "http://127.0.0.1:$API_PORT/api/health" \
    || die "$NAME server not healthy; see $DIR/server.log"
  echo "$NAME api: http://127.0.0.1:$API_PORT"
}

# Start the current hospital's Vite dev server against its own API, with its
# own optimiser cache (two Vites sharing one cache rewrite it under each other).
start_web() {
  local web="$ROOT_DIR/apps/web" vite="$ROOT_DIR/node_modules/vite/bin/vite.js"
  [[ -f "$vite" ]] || die "web deps missing: pnpm install in $ROOT_DIR"
  # The app imports the workspace packages' built lib/, which a fresh checkout lacks.
  if [[ ! -d "$ROOT_DIR/packages/stores/lib" ]]; then
    (cd "$ROOT_DIR" && TURBO_TELEMETRY_DISABLED=1 node_modules/.bin/turbo run build \
      --filter='@medbrains/web^...' >"$STATE/packages-build.log" 2>&1) \
      || die "workspace package build failed; see $STATE/packages-build.log"
  fi
  if ! is_running "$DIR/web.pid"; then
    require_free_port "$WEB_PORT"
    (cd "$web" && VITE_DEV_PORT="$WEB_PORT" VITE_API_PROXY="http://127.0.0.1:$API_PORT" \
      VITE_CACHE_DIR="$DIR/vite-cache" \
      nohup node "$vite" --host 127.0.0.1 >>"$DIR/web.log" 2>&1 & echo $! >"$DIR/web.pid")
  fi
  wait_until 120 curl -sf "http://127.0.0.1:$WEB_PORT/" || die "$NAME web not up; see $DIR/web.log"
  echo "$NAME web: $WEB_ORIGIN"
}

# Stop the process in pid file $1 with TERM (never KILL: let it clean up).
stop_pid() {
  if is_running "$1"; then
    local pid; pid="$(cat "$1")"
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    wait_until 20 bash -c "! kill -0 $pid" || echo "pid $pid still running after 20s"
  fi
  rm -f "$1"
}

# Stop the current hospital: web, server, then its cluster.
stop_hospital() {
  stop_pid "$DIR/web.pid"
  stop_pid "$DIR/server.pid"
  if [[ -f "$DIR/pg/postmaster.pid" ]]; then
    "$PG_BIN/pg_ctl" -D "$DIR/pg" -m fast -w stop >/dev/null
  fi
  echo "$NAME stopped"
}

# One line per hospital part: up or down.
status_hospital() {
  local pg=down api=down web=down
  "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PG_PORT" && pg=up
  curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null && api=up
  curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null && web=up
  echo "$NAME  pg:$PG_PORT $pg  api:$API_PORT $api  web:$WEB_ORIGIN $web"
}

cmd="${1:-status}"
for h in "${HOSPITALS[@]}"; do
  hospital "$h"
  case "$cmd" in
    start) mkdir -p "$DIR"; start_postgres; start_server; start_web ;;
    stop) stop_hospital ;;
    reset) stop_hospital; rm -rf "$DIR"; echo "$NAME deleted" ;;
    status) status_hospital ;;
    *) die "usage: $0 start|stop|reset|status" ;;
  esac
done

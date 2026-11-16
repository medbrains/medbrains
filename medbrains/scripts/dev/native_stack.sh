#!/usr/bin/env bash
# The local dev stack without Docker: PostgreSQL 17, SpiceDB, rustenberg and
# Stalwart run as plain macOS processes, plus Headscale when asked for.
#
#   scripts/dev/native_stack.sh start  [service...]   # default: the core four
#   scripts/dev/native_stack.sh stop   [service...]
#   scripts/dev/native_stack.sh status
#   scripts/dev/native_stack.sh reset                 # drop + recreate the databases
#   scripts/dev/native_stack.sh import-docker         # copy the Docker dev DB in
#
# Why: local dev no longer needs a Linux VM for services that all have native
# macOS builds (docs/DECISIONS.md, 2026-11-16; docs/DEV-SETUP.md). Data lives in
# $MEDBRAINS_DEV_HOME, outside the repo, so a worktree or a `git clean` never
# takes the database with it. Everything binds 127.0.0.1 only.
#
# Ports mirror docker-compose.yml except PostgreSQL, which takes 5436 so this
# cluster, Docker's (5435) and the test cluster (54317) can all run at once.
# Every value below is a development default from .env.example, not a secret.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_HOME="${MEDBRAINS_DEV_HOME:-$HOME/.local/share/medbrains-dev}"
BIN="$DEV_HOME/bin"
RUN="$DEV_HOME/run"
LOGS="$DEV_HOME/logs"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PG_DATA="$DEV_HOME/pg17"
PG_PORT="${DEV_PG_PORT:-5436}"
PG_PASSWORD=medbrains_dev
SPICEDB_TOKEN="${SPICEDB_TOKEN:-devsecret}"
SPICEDB_URI="postgres://spicedb:spicedb_dev@127.0.0.1:$PG_PORT/spicedb?sslmode=disable"
RUSTENBERG_PORT="${RUSTENBERG_PORT:-3005}"
STALWART_DIR="$DEV_HOME/stalwart"
STALWART_ADMIN_SECRET="${STALWART_ADMIN_SECRET:-medbrains_dev}"
HEADSCALE_DIR="$DEV_HOME/headscale"
HEADSCALE_PORT="${HEADSCALE_PORT:-8089}"
CORE=(postgres spicedb rustenberg stalwart)

mkdir -p "$BIN" "$RUN" "$LOGS"

# Print an error and stop; every failure names the fix.
die() { echo "native_stack: $*" >&2; exit 1; }

# True when the pid file for $1 names a live process.
is_running() {
  local pid_file="$RUN/$1.pid"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

# Poll a readiness command for up to $1 seconds; the rest is the command.
wait_until() {
  local seconds="$1"; shift
  local i
  for ((i = 0; i < seconds * 2; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

# Start a long-running binary detached, recording its pid; $1 is the name.
spawn() {
  local name="$1"; shift
  nohup "$@" >>"$LOGS/$name.log" 2>&1 &
  echo $! >"$RUN/$name.pid"
}

# Run SQL as the cluster owner against database $1.
pg_sql() {
  PGPASSWORD="$PG_PASSWORD" "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$PG_PORT" -U medbrains -d "$1" -At -c "$2"
}

# Create the cluster on first run, start it, and make the spicedb database.
start_postgres() {
  [[ -x "$PG_BIN/pg_ctl" ]] || die "PostgreSQL 17 missing: brew install postgresql@17"
  if [[ ! -f "$PG_DATA/PG_VERSION" ]]; then
    echo "postgres: creating cluster in $PG_DATA"
    local pwfile; pwfile="$(mktemp)"
    printf '%s\n' "$PG_PASSWORD" >"$pwfile"
    "$PG_BIN/initdb" -D "$PG_DATA" -U medbrains --pwfile="$pwfile" \
      --auth=scram-sha-256 --encoding=UTF8 --locale=C >"$LOGS/initdb.log"
    rm -f "$pwfile"
  fi
  if ! "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PG_PORT"; then
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$LOGS/postgres.log" -w -t 60 \
      -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k $RUN" start >/dev/null
  fi
  wait_until 30 "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PG_PORT" || die "postgres not ready; see $LOGS/postgres.log"
  [[ "$(pg_sql postgres "SELECT 1 FROM pg_database WHERE datname='medbrains'")" == 1 ]] \
    || pg_sql postgres "CREATE DATABASE medbrains"
  # Same steps as compose's spicedb_db_init.
  [[ "$(pg_sql postgres "SELECT 1 FROM pg_database WHERE datname='spicedb'")" == 1 ]] \
    || pg_sql postgres "CREATE DATABASE spicedb"
  [[ "$(pg_sql postgres "SELECT 1 FROM pg_roles WHERE rolname='spicedb'")" == 1 ]] \
    || pg_sql postgres "CREATE ROLE spicedb LOGIN PASSWORD 'spicedb_dev'"
  pg_sql postgres "GRANT ALL PRIVILEGES ON DATABASE spicedb TO spicedb"
  pg_sql spicedb "GRANT ALL ON SCHEMA public TO spicedb"
  # The app and worker roles with the .env.example password, so a fresh
  # cluster needs no separate `make dev-db-roles`. Idempotent.
  bash -c '. "$1/deploy/standalone/db-roles.sh" && db_roles_sql "$2" "$2"' _ "$ROOT_DIR" "$PG_PASSWORD" \
    | PGPASSWORD="$PG_PASSWORD" "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 \
        -h 127.0.0.1 -p "$PG_PORT" -U medbrains -d medbrains >/dev/null
  echo "postgres: ready on 127.0.0.1:$PG_PORT"
}

# Migrate SpiceDB's datastore to head, then serve gRPC on 50051.
start_spicedb() {
  [[ -x "$BIN/spicedb" ]] || die "spicedb missing in $BIN (docs/DEV-SETUP.md, step 1)"
  if ! is_running spicedb; then
    "$BIN/spicedb" datastore migrate head --datastore-engine=postgres \
      --datastore-conn-uri="$SPICEDB_URI" >>"$LOGS/spicedb.log" 2>&1 \
      || die "spicedb migrate failed; see $LOGS/spicedb.log"
    spawn spicedb "$BIN/spicedb" serve --grpc-preshared-key="$SPICEDB_TOKEN" \
      --grpc-addr=127.0.0.1:50051 --datastore-engine=postgres \
      --datastore-conn-uri="$SPICEDB_URI" --metrics-addr=127.0.0.1:9091 \
      --dispatch-cluster-enabled=false --telemetry-endpoint=""
  fi
  wait_until 30 curl -sf http://127.0.0.1:9091/metrics || die "spicedb not ready; see $LOGS/spicedb.log"
  wait_until 15 nc -z 127.0.0.1 50051 || die "spicedb gRPC not listening; see $LOGS/spicedb.log"
  echo "spicedb: ready on 127.0.0.1:50051"
}

# The repo's Gotenberg-compatible PDF renderer, on Gotenberg's dev port.
start_rustenberg() {
  local bin="${RUSTENBERG_BIN:-$BIN/rustenberg}"
  [[ -x "$bin" ]] || die "rustenberg missing at $bin (docs/DEV-SETUP.md, step 1)"
  local chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [[ -z "${CHROMIUM_PATH:-}" && -x "$chrome" ]]; then export CHROMIUM_PATH="$chrome"; fi
  if ! is_running rustenberg; then
    HOST=127.0.0.1 PORT="$RUSTENBERG_PORT" spawn rustenberg "$bin"
  fi
  wait_until 30 curl -sf "http://127.0.0.1:$RUSTENBERG_PORT/health" || die "rustenberg not ready; see $LOGS/rustenberg.log"
  echo "rustenberg: ready on 127.0.0.1:$RUSTENBERG_PORT"
}

# Write Stalwart's config once, as compose's entrypoint did, with loopback
# listeners. macOS lets a normal user bind a port below 1024 only on the
# wildcard address, so mail listens on 1587/1465/1993 and the pf rules from
# `sudo make dev-pf-setup` forward 587/465/993 to them; admin/JMAP is 8086.
init_stalwart() {
  [[ -f "$STALWART_DIR/etc/config.toml" ]] && return 0
  # --init prints a random admin password; it is replaced below, so drop it.
  "$BIN/stalwart" --init "$STALWART_DIR" >/dev/null 2>&1
  local cfg="$STALWART_DIR/etc/config.toml" tmp
  tmp="$(mktemp)"
  # Drop the generated listeners (25, 110, 143, 4190, 8080 too) and add ours.
  awk '/^\[server\.listener\./ {skip=1; next} /^\[/ {skip=0} !skip' "$cfg" >"$tmp"
  cat >>"$tmp" <<'EOF'

[server.listener.submission]
bind = "127.0.0.1:1587"
protocol = "smtp"

[server.listener.submissions]
bind = "127.0.0.1:1465"
protocol = "smtp"
tls.implicit = true

[server.listener.imaptls]
bind = "127.0.0.1:1993"
protocol = "imap"
tls.implicit = true

[server.listener.https]
bind = "127.0.0.1:8086"
protocol = "http"
tls.implicit = true
EOF
  local cert="$ROOT_DIR/var/local-https/medbrains.localhost.pem"
  if [[ -f "$cert" ]]; then
    printf '\n[certificate.default]\ncert = "%%{file:%s}%%"\nprivate-key = "%%{file:%s}%%"\ndefault = true\n' \
      "$cert" "${cert%.pem}-key.pem" >>"$tmp"
  fi
  mv "$tmp" "$cfg"
}

# Start Stalwart with the fallback admin pinned to STALWART_ADMIN_SECRET.
start_stalwart() {
  [[ -x "$BIN/stalwart" ]] || die "stalwart missing in $BIN (docs/DEV-SETUP.md, step 1)"
  init_stalwart
  local cfg="$STALWART_DIR/etc/config.toml"
  # Re-pinned every start, like compose, so a changed secret takes effect.
  sed -i '' "/^\[authentication.fallback-admin\]/,/^\[/ s|^secret = .*|secret = \"$STALWART_ADMIN_SECRET\"|" "$cfg"
  if ! is_running stalwart; then spawn stalwart "$BIN/stalwart" --config "$cfg"; fi
  wait_until 30 nc -z 127.0.0.1 1587 || die "stalwart not ready; see $LOGS/stalwart.log"
  echo "stalwart: ready (smtp 1587/1465, imaps 1993, admin https://127.0.0.1:8086)"
}

# Headscale (VPN control plane), opt-in like compose's `vpn` profile.
start_headscale() {
  [[ -x "$BIN/headscale" ]] || die "headscale missing in $BIN (docs/DEV-SETUP.md, step 1)"
  mkdir -p "$HEADSCALE_DIR"
  # The repo config with its container paths and port moved to this machine.
  sed -e "s|/var/lib/headscale|$HEADSCALE_DIR|g" \
      -e "s|^server_url: .*|server_url: http://127.0.0.1:$HEADSCALE_PORT|" \
      -e "s|^listen_addr: .*|listen_addr: 127.0.0.1:$HEADSCALE_PORT|" \
      -e "s|^metrics_listen_addr: .*|metrics_listen_addr: 127.0.0.1:9092|" \
      "$ROOT_DIR/deploy/headscale/config.yaml" >"$HEADSCALE_DIR/config.yaml"
  # The repo config has no DERP map, which 0.23 refuses to start without; a
  # local embedded relay avoids fetching Tailscale's. No update check either.
  cat >>"$HEADSCALE_DIR/config.yaml" <<EOF
unix_socket: $HEADSCALE_DIR/headscale.sock
unix_socket_permission: "0770"
disable_check_updates: true
derp:
  server:
    enabled: true
    region_id: 999
    region_code: dev
    region_name: MedBrains dev
    stun_listen_addr: 127.0.0.1:3478
    private_key_path: $HEADSCALE_DIR/derp_server_private.key
    automatically_add_embedded_derp_region: true
  urls: []
  paths: []
EOF
  if ! is_running headscale; then
    spawn headscale "$BIN/headscale" serve --config "$HEADSCALE_DIR/config.yaml"
  fi
  wait_until 30 curl -sf "http://127.0.0.1:$HEADSCALE_PORT/health" || die "headscale not ready; see $LOGS/headscale.log"
  echo "headscale: ready on 127.0.0.1:$HEADSCALE_PORT"
}

# Stop one service with TERM and wait for it to exit.
stop_one() {
  local name="$1"
  if [[ "$name" == postgres ]]; then
    if [[ -f "$PG_DATA/postmaster.pid" ]]; then
      "$PG_BIN/pg_ctl" -D "$PG_DATA" -m fast -w stop >/dev/null && echo "postgres: stopped"
    fi
    return 0
  fi
  if is_running "$name"; then
    local pid; pid="$(cat "$RUN/$name.pid")"
    kill -TERM "$pid"
    wait_until 20 bash -c "! kill -0 $pid" || echo "$name: still running after 20s (pid $pid)"
    echo "$name: stopped"
  fi
  rm -f "$RUN/$name.pid"
}

# One line per service: up or down, and where.
status() {
  if "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PG_PORT"; then echo "postgres    up    127.0.0.1:$PG_PORT"
  else echo "postgres    down"; fi
  local name
  for name in spicedb rustenberg stalwart headscale; do
    if is_running "$name"; then echo "$(printf '%-11s' "$name") up    pid $(cat "$RUN/$name.pid")"
    else echo "$(printf '%-11s' "$name") down"; fi
  done
}

# pg_dump the running Docker dev database and restore it into the native one.
# Read-only on the Docker side: the pgdata volume is never touched.
import_docker() {
  local cid
  cid="$(cd "$ROOT_DIR" && docker compose ps -q postgres 2>/dev/null || true)"
  [[ -n "$cid" ]] || die "Docker postgres is not running. Start it with: docker compose up -d postgres"
  start_postgres
  local tables
  tables="$(pg_sql medbrains "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
  if [[ "$tables" != 0 && "${FORCE_IMPORT:-}" != true ]]; then
    die "native medbrains already has $tables tables. Re-run with FORCE_IMPORT=true to replace it."
  fi
  local dump
  dump="$DEV_HOME/docker-import-$(date +%Y%m%d-%H%M%S).dump"
  echo "dumping Docker medbrains + spicedb to $dump"
  (cd "$ROOT_DIR" && docker compose exec -T postgres pg_dump -U medbrains -d medbrains -Fc) >"$dump"
  (cd "$ROOT_DIR" && docker compose exec -T postgres pg_dump -U medbrains -d spicedb -Fc) >"$dump.spicedb" || true
  # Roles are cluster-wide and pg_dump does not carry them.
  (cd "$ROOT_DIR" && docker compose exec -T postgres pg_dumpall -U medbrains --roles-only) \
    | grep -vE '^(CREATE|ALTER) ROLE medbrains( |;)' \
    | PGPASSWORD="$PG_PASSWORD" "$PG_BIN/psql" -X -q -h 127.0.0.1 -p "$PG_PORT" -U medbrains -d postgres >/dev/null 2>&1 || true
  pg_sql postgres "DROP DATABASE IF EXISTS medbrains WITH (FORCE)"
  pg_sql postgres "CREATE DATABASE medbrains"
  PGPASSWORD="$PG_PASSWORD" "$PG_BIN/pg_restore" -h 127.0.0.1 -p "$PG_PORT" -U medbrains \
    -d medbrains --no-owner --role=medbrains --exit-on-error "$dump"
  if [[ -s "$dump.spicedb" ]]; then
    stop_one spicedb
    pg_sql postgres "DROP DATABASE IF EXISTS spicedb WITH (FORCE)"
    pg_sql postgres "CREATE DATABASE spicedb OWNER spicedb"
    PGPASSWORD="$PG_PASSWORD" "$PG_BIN/pg_restore" -h 127.0.0.1 -p "$PG_PORT" -U medbrains \
      -d spicedb --no-owner --role=spicedb "$dump.spicedb" || true
  fi
  echo "imported. The dump stays at $dump; the Docker volume is unchanged."
}

cmd="${1:-status}"; shift || true
services=("$@")
case "$cmd" in
  start)
    [[ ${#services[@]} -gt 0 ]] || services=("${CORE[@]}")
    for s in "${services[@]}"; do "start_$s"; done ;;
  stop)
    [[ ${#services[@]} -gt 0 ]] || services=(headscale stalwart rustenberg spicedb postgres)
    for s in "${services[@]}"; do stop_one "$s"; done ;;
  status) status ;;
  # Changes whenever the cluster or the spicedb database is recreated, which
  # is when SpiceDB's schema must be written again (spicedb_local_schema.sh).
  spicedb-id) pg_sql postgres "SELECT system_identifier || '-' || (SELECT oid FROM pg_database WHERE datname = 'spicedb') FROM pg_control_system()" ;;
  # Drop and recreate the medbrains and spicedb databases (make db-reset).
  reset)
    stop_one spicedb
    start_postgres >/dev/null
    pg_sql postgres "DROP DATABASE IF EXISTS medbrains WITH (FORCE)"
    pg_sql postgres "DROP DATABASE IF EXISTS spicedb WITH (FORCE)"
    start_postgres
    start_spicedb ;;
  import-docker) import_docker ;;
  *) die "usage: $0 start|stop [service...] | status | reset | spicedb-id | import-docker" ;;
esac

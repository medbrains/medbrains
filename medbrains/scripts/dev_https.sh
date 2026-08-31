#!/usr/bin/env bash
set -euo pipefail

# When launched from `make dev`, MAKEFLAGS carries the parent recipe's variable
# assignments + jobserver (e.g. " -- DEV_PROXY_CONFIG=… -j --jobserver-fds=8,9").
# Native build scripts that shell out to their own `make` (jemalloc-sys, etc.)
# choke on it ("No rule to make target '-j'"). We don't run make from here, so
# clear it before any cargo build pulls in a C dependency.
unset MAKEFLAGS MFLAGS MAKELEVEL

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Running the dev stack as root poisons target/ with root-owned build
# artifacts that later break plain `cargo build` for everyone. The proxy no
# longer needs root (pf redirects 80/443 -> 8080/8443), so there is no reason.
if [[ "$(id -u)" == "0" ]]; then
  echo "ERROR: do not run make dev with sudo."
  echo "Ports 80/443 are forwarded to unprivileged 8080/8443 by pf — one-time setup:"
  echo "  make dev-pf-setup"
  exit 1
fi

# The proxy binds unprivileged 8080/8443; pf forwards the world's connections
# from 80/443 to them. Without the anchor every dev URL refuses to connect, and
# finding that out after a full compile is a bad way to learn it. Stop here,
# let the one-time setup run, then come back.
if [[ ! -f /etc/pf.anchors/medbrains-dev ]] || ! grep -q 'medbrains-dev' /etc/pf.conf; then
  if [[ "${DEV_ALLOW_NO_PF:-false}" != "true" ]]; then
    echo "One-time setup not done: pf is not yet forwarding ports 80/443 -> 8080/8443."
    echo "$ORIGIN would refuse to connect."
    echo
    echo "Run this first (asks for your password once, never again):"
    echo "  make dev-pf-setup"
    echo
    echo "Then run make dev again."
    exit 1
  fi
  echo "WARNING: pf port-forward not installed — $ORIGIN will refuse connections."
fi

ORIGIN="${DEV_HTTPS_ORIGIN:-https://medbrains.localhost}"
DESKTOP_ORIGIN="${DEV_DESKTOP_HTTPS_ORIGIN:-https://medbrains-desktop.localhost}"
SIMULATOR_ORIGIN="${DEV_SIMULATOR_HTTPS_ORIGIN:-https://medbrains-simulator.localhost}"
ICD_ORIGIN="${DEV_ICD_HTTPS_ORIGIN:-https://medbrains-icd.localhost}"
DEV_HTTPS_DOMAIN="${DEV_HTTPS_DOMAIN:-${ORIGIN#http://}}"
DEV_HTTPS_DOMAIN="${DEV_HTTPS_DOMAIN#https://}"
DEV_HTTPS_DOMAIN="${DEV_HTTPS_DOMAIN%%/*}"
DEV_SIMULATOR_HTTPS_DOMAIN="${DEV_SIMULATOR_HTTPS_DOMAIN:-${SIMULATOR_ORIGIN#http://}}"
DEV_SIMULATOR_HTTPS_DOMAIN="${DEV_SIMULATOR_HTTPS_DOMAIN#https://}"
DEV_SIMULATOR_HTTPS_DOMAIN="${DEV_SIMULATOR_HTTPS_DOMAIN%%/*}"
export DEV_HTTPS_DOMAIN
export DEV_SIMULATOR_HTTPS_DOMAIN
export DEV_HTTPS_ALT_DOMAINS="${DEV_HTTPS_ALT_DOMAINS:-medbrains-desktop.localhost,medbrains-simulator.localhost,medbrains-icd.localhost,medbrains-kiwi.localhost}"
PROXY_CONFIG="${DEV_PROXY_CONFIG:-infra/local/pingora-dev.toml}"
SKIP_BACKEND_BUILD="${SKIP_BACKEND_BUILD:-false}"
STOP_STALE_DEV_PORTS="${STOP_STALE_DEV_PORTS:-true}"
PROXY_RUST_LOG="${PROXY_RUST_LOG:-medbrains_proxy=info,pingora_proxy=off,pingora_core::services::listening=off,pingora=warn}"
BACKEND_BIN="$ROOT_DIR/target/debug/medbrains-server"
PROXY_BIN="$ROOT_DIR/target/debug/medbrains-proxy"

log_dir="$ROOT_DIR/var/log/dev"
mkdir -p "$log_dir"

port_listeners() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

port_listener_pids() {
  local port="$1"
  # Exclude Docker Desktop / VPNKit processes so we never kill the Docker engine.
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    local comm
    comm="$(ps -p "$pid" -o comm= 2>/dev/null)" || continue
    case "$comm" in
      *docker*|*Docker*|vpnkit|hyperkit) continue ;;
    esac
    echo "$pid"
  done || true
}

port_accepts_connections() {
  local port="$1"

  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return
  fi

  [[ -n "$(port_listener_pids "$port")" ]]
}

stop_stale_port_listeners() {
  local port="$1"
  local service="$2"
  local pids
  local remaining

  if [[ "$STOP_STALE_DEV_PORTS" != "true" ]]; then
    return
  fi

  pids="$(port_listener_pids "$port")"
  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Stopping stale $service listener(s) on port $port: $pids"
  kill $pids 2>/dev/null || true
  sleep 1

  remaining="$(port_listener_pids "$port")"
  if [[ -n "$remaining" ]]; then
    echo "Force-stopping stale $service listener(s) on port $port: $remaining"
    kill -9 $remaining 2>/dev/null || true
    sleep 1
  fi
}

require_port_free() {
  local port="$1"
  local service="$2"
  # Skip Docker Desktop-owned listeners (they're harmless for dev proxy).
  local docker_pids
  docker_pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    local comm
    comm="$(ps -p "$pid" -o comm= 2>/dev/null)" || continue
    case "$comm" in
      *docker*|*Docker*|vpnkit|hyperkit) echo "$pid" ;;
    esac
  done)" || true

  local all_pids
  all_pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | while read -r pid; do
    local comm
    comm="$(ps -p "$pid" -o comm= 2>/dev/null)" || continue
    case "$comm" in
      *docker*|*Docker*|vpnkit|hyperkit) continue ;;
    esac
    echo "$pid"
  done)" || true

  if [[ -n "$all_pids" ]]; then
    echo "Cannot start $service: port $port is already in use."
    echo
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null
    echo
    echo "Stop the process above, then rerun: make dev"
    exit 1
  fi

  if [[ -n "$docker_pids" ]]; then
    echo "  (port $port owned by Docker Desktop — proxy will use alternate port)"
  fi
}

check_child_started() {
  local pid="$1"
  local service="$2"
  local log_path="$3"

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "$service failed to start. Last log lines:"
    tail -80 "$log_path" 2>/dev/null || true
    exit 1
  fi
}

wait_for_port() {
  local port="$1"
  local service="$2"
  local timeout_seconds="${3:-15}"
  local pid="${4:-}"
  local log_path="${5:-}"
  local started_at
  local now

  started_at="$(date +%s)"
  echo "Waiting for $service on port $port..."
  while true; do
    if port_accepts_connections "$port"; then
      return
    fi

    if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
      echo "$service exited before binding port $port. Last log lines:"
      tail -80 "${log_path:-$log_dir/proxy.log}" 2>/dev/null || true
      exit 1
    fi

    now="$(date +%s)"
    if (( now - started_at >= timeout_seconds )); then
      echo "$service did not bind port $port within ${timeout_seconds}s."
      echo
      echo "Last $service log lines:"
      tail -80 "${log_path:-$log_dir/proxy.log}" 2>/dev/null || true
      exit 1
    fi

    sleep 1
  done
}

echo "MedBrains local HTTPS: $ORIGIN"
echo "  web UI:  $ORIGIN"
echo "  desktop: $DESKTOP_ORIGIN"
echo "  simulator: $SIMULATOR_ORIGIN"
echo "  ICD-API: $ICD_ORIGIN"
echo "  API:     $ORIGIN/api"
echo "  health:  $ORIGIN/api/health"
echo
echo "Internal service ports are implementation details:"
echo "  backend -> http://127.0.0.1:3000"
echo "  vite    -> http://127.0.0.1:5173"
echo "  simulator vite -> http://127.0.0.1:5180"
echo "  pingora -> https://0.0.0.0:8443 (pf redirects 443 -> 8443, see scripts/dev_pf_setup.sh)"
echo
echo "Logs:"
echo "  backend: $log_dir/backend.log"
echo "  web:     $log_dir/web.log"
echo "  simulator: $log_dir/simulator.log"
echo "  proxy:   $log_dir/proxy.log"
echo

stop_stale_port_listeners 3000 "backend"
stop_stale_port_listeners 5173 "Vite web"
stop_stale_port_listeners 5180 "Vite simulator"
stop_stale_port_listeners 8080 "Pingora HTTP proxy"
stop_stale_port_listeners 8443 "Pingora HTTPS proxy"

require_port_free 3000 "backend"
require_port_free 5173 "Vite web"
require_port_free 5180 "Vite simulator"
require_port_free 8080 "Pingora HTTP proxy"
require_port_free 8443 "Pingora HTTPS proxy"

# If Docker Desktop occupies 8080/8443, auto-select alternate ports for Pingora.
PROXY_HTTP_PORT=8080
PROXY_HTTPS_PORT=8443

find_free_port() {
  local start="$1"
  local port="$start"
  while (( port < start + 20 )); do
    if ! lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$port"
      return
    fi
    (( port++ ))
  done
  echo "$start"
}

if lsof -tiTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  PROXY_HTTP_PORT="$(find_free_port 8081)"
fi
if lsof -tiTCP:8443 -sTCP:LISTEN >/dev/null 2>&1; then
  PROXY_HTTPS_PORT="$(find_free_port 8444)"
fi
if [[ "$PROXY_HTTP_PORT" != 8080 || "$PROXY_HTTPS_PORT" != 8443 ]]; then
  echo "Docker Desktop occupies default proxy ports — using $PROXY_HTTP_PORT/$PROXY_HTTPS_PORT instead"
  PROXY_CONFIG="$log_dir/pingora-dev-docker.toml"
  sed -e "s/^http_port = 8080/http_port = $PROXY_HTTP_PORT/" \
      -e "s/^https_port = 8443/https_port = $PROXY_HTTPS_PORT/" \
      "$ROOT_DIR/infra/local/pingora-dev.toml" > "$PROXY_CONFIG"
  echo ""
  echo "  NOTE: pf port-forward (make dev-pf-setup) still points to 8080/8443."
  echo "  URLs via https://medbrains.localhost may not work until you re-run:"
  echo "    sudo DEV_PROXY_HTTP_PORT=$PROXY_HTTP_PORT DEV_PROXY_HTTPS_PORT=$PROXY_HTTPS_PORT make dev-pf-setup"
  echo ""
  echo "  Or access the proxy directly: http://localhost:$PROXY_HTTP_PORT"
  echo ""
fi

backend_needs_build=false
migrations_dir="$ROOT_DIR/crates/medbrains-db-migrations/src/migrations"
migration_stamp="$log_dir/migrations.sha256"

if [[ -d "$migrations_dir" ]]; then
  current_migrations_hash="$(
    find "$migrations_dir" -type f -name "*.sql" -print \
      | LC_ALL=C sort \
      | while IFS= read -r file; do shasum -a 256 "$file"; done \
      | shasum -a 256 \
      | awk '{print $1}'
  )"
  previous_migrations_hash="$(cat "$migration_stamp" 2>/dev/null || true)"

  if [[ "$current_migrations_hash" != "$previous_migrations_hash" ]]; then
    echo "Migration files changed; refreshing backend embedded migration cache..."
    cargo clean -p medbrains-db >/dev/null
    cargo clean -p medbrains-server >/dev/null
    printf "%s\n" "$current_migrations_hash" >"$migration_stamp"
    backend_needs_build=true
  fi
fi

# Parallel rustc front-end: cargo already parallelizes across crates, but
# `medbrains-server` is one ~226k-line crate whose front-end (parse/typeck/borrowck/
# MIR) is the serial bottleneck on stable. `-Zthreads` multi-threads it. RUSTC_BOOTSTRAP=1
# unlocks the flag on the *pinned stable* compiler (same codegen as CI, just threaded),
# so we don't drift onto nightly. Opt out with MB_RUSTC_THREADS=1; tune with e.g. =10.
MB_RUSTC_THREADS="${MB_RUSTC_THREADS:-8}"
if [[ "$SKIP_BACKEND_BUILD" != "true" || "$backend_needs_build" == "true" || ! -x "$BACKEND_BIN" ]]; then
  echo "Compiling backend before launch (parallel front-end: ${MB_RUSTC_THREADS} threads)..."
  # CARGO_INCREMENTAL=0 is load-bearing, not tuning: the threaded front-end and
  # the incremental dep-graph encoder disagree, and rustc 1.94.1 ICEs with
  # "trying to encode a dep node twice" partway through medbrains-server.
  # Clearing target/debug/incremental does not help -- the two features simply
  # cannot both be on. Incremental buys little here anyway, since this builds
  # one crate that has just changed.
  RUSTC_BOOTSTRAP=1 CARGO_INCREMENTAL=0 \
    RUSTFLAGS="${RUSTFLAGS:-} -Zthreads=${MB_RUSTC_THREADS}" \
    cargo build -p medbrains-server --bin medbrains-server
fi

echo "Compiling Pingora proxy before launch..."
cargo build -p medbrains-proxy >/dev/null

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend, web, simulator, and Pingora. Open: $ORIGIN"
echo

# DEV_BACKEND_WATCH=true (via `make dev-watch`) runs the backend under
# cargo-watch: any save under crates/ triggers an incremental rebuild + restart.
# Thanks to the crate split only the changed crate + a server relink recompile.
if [[ "${DEV_BACKEND_WATCH:-false}" == "true" ]] && command -v cargo-watch >/dev/null 2>&1; then
  ( cd "$ROOT_DIR" && exec cargo watch --watch crates \
      --exec 'run -p medbrains-server --bin medbrains-server' ) \
    >"$log_dir/backend.log" 2>&1 &
else
  "$BACKEND_BIN" >"$log_dir/backend.log" 2>&1 &
fi
backend_pid="$!"
pnpm dev:web >"$log_dir/web.log" 2>&1 &
web_pid="$!"
DEV_SIMULATOR_HTTPS_DOMAIN="$DEV_SIMULATOR_HTTPS_DOMAIN" VITE_DEV_PORT=5180 \
  pnpm --filter @medbrains/simulator-admin dev >"$log_dir/simulator.log" 2>&1 &
simulator_pid="$!"
RUST_LOG="$PROXY_RUST_LOG" "$PROXY_BIN" --config "$PROXY_CONFIG" >"$log_dir/proxy.log" 2>&1 &
proxy_pid="$!"

sleep 2

check_child_started "$backend_pid" "Backend" "$log_dir/backend.log"
check_child_started "$web_pid" "Vite web" "$log_dir/web.log"
check_child_started "$simulator_pid" "Vite simulator" "$log_dir/simulator.log"
check_child_started "$proxy_pid" "Pingora" "$log_dir/proxy.log"
# Under DEV_BACKEND_WATCH the backend runs via cargo-watch, whose first `cargo
# run` compiles before binding — that can take minutes, so give it a long window
# instead of the 15s used for the prebuilt-binary path.
backend_port_timeout=15
[[ "${DEV_BACKEND_WATCH:-false}" == "true" ]] && backend_port_timeout=900
wait_for_port 3000 "Backend" "$backend_port_timeout" "$backend_pid" "$log_dir/backend.log"
wait_for_port 5173 "Vite web" 15 "$web_pid" "$log_dir/web.log"
wait_for_port 5180 "Vite simulator" 15 "$simulator_pid" "$log_dir/simulator.log"
wait_for_port 8443 "Pingora HTTPS proxy" 15 "$proxy_pid" "$log_dir/proxy.log"

echo "Ready URL: $ORIGIN"
echo "Simulator URL: $SIMULATOR_ORIGIN"
echo "Use Ctrl+C to stop all dev services."
echo

tail -n +1 -f "$log_dir/backend.log" | LC_ALL=C sed -u "s/^/[backend] /" &
tail -n +1 -f "$log_dir/web.log" \
  | LC_ALL=C sed -u \
    -e "s#http://localhost:5173/#$ORIGIN/#g" \
    -e "s#http://127.0.0.1:5173/#$ORIGIN/#g" \
    -e "s#Network: use --host to expose#Proxy:   $ORIGIN#g" \
    -e "s/^/[web] /" &
tail -n +1 -f "$log_dir/simulator.log" \
  | LC_ALL=C sed -u \
    -e "s#http://localhost:5180/#$SIMULATOR_ORIGIN/#g" \
    -e "s#http://127.0.0.1:5180/#$SIMULATOR_ORIGIN/#g" \
    -e "s#Network: use --host to expose#Proxy:   $SIMULATOR_ORIGIN#g" \
    -e "s/^/[simulator] /" &
tail -n +1 -f "$log_dir/proxy.log" | LC_ALL=C sed -u "s/^/[proxy] /" &
wait

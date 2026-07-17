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
export DEV_HTTPS_ALT_DOMAINS="${DEV_HTTPS_ALT_DOMAINS:-medbrains-desktop.localhost,medbrains-simulator.localhost,medbrains-icd.localhost}"
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
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
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
  if ! kill $pids 2>/dev/null; then
    if [[ "$port" == "80" || "$port" == "443" ]]; then
      sudo kill $pids 2>/dev/null || true
    fi
  fi
  sleep 1

  remaining="$(port_listener_pids "$port")"
  if [[ -n "$remaining" ]]; then
    echo "Force-stopping stale $service listener(s) on port $port: $remaining"
    if ! kill -9 $remaining 2>/dev/null; then
      if [[ "$port" == "80" || "$port" == "443" ]]; then
        sudo kill -9 $remaining 2>/dev/null || true
      fi
    fi
    sleep 1
  fi
}

require_port_free() {
  local port="$1"
  local service="$2"
  local listeners

  listeners="$(port_listeners "$port")"
  if [[ -n "$listeners" ]]; then
    echo "Cannot start $service: port $port is already in use."
    echo
    echo "$listeners"
    echo
    echo "Stop the process above, then rerun: make dev"
    exit 1
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
echo "  pingora -> https://0.0.0.0:443"
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
stop_stale_port_listeners 80 "Pingora HTTP proxy"
stop_stale_port_listeners 443 "Pingora HTTPS proxy"

require_port_free 3000 "backend"
require_port_free 5173 "Vite web"
require_port_free 5180 "Vite simulator"
require_port_free 80 "Pingora HTTP proxy"
require_port_free 443 "Pingora HTTPS proxy"

backend_needs_build=false
migrations_dir="$ROOT_DIR/crates/medbrains-db/src/migrations"
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
  RUSTC_BOOTSTRAP=1 RUSTFLAGS="${RUSTFLAGS:-} -Zthreads=${MB_RUSTC_THREADS}" \
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
RUST_LOG="$PROXY_RUST_LOG" sudo -E "$PROXY_BIN" --config "$PROXY_CONFIG" >"$log_dir/proxy.log" 2>&1 &
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
wait_for_port 443 "Pingora HTTPS proxy" 15 "$proxy_pid" "$log_dir/proxy.log"

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

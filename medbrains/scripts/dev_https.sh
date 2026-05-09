#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ORIGIN="${DEV_HTTPS_ORIGIN:-https://medbrains.localhost}"
DEV_HTTPS_DOMAIN="${DEV_HTTPS_DOMAIN:-${ORIGIN#http://}}"
DEV_HTTPS_DOMAIN="${DEV_HTTPS_DOMAIN#https://}"
DEV_HTTPS_DOMAIN="${DEV_HTTPS_DOMAIN%%/*}"
export DEV_HTTPS_DOMAIN
PROXY_CONFIG="${DEV_PROXY_CONFIG:-infra/local/pingora-dev.toml}"
SKIP_BACKEND_BUILD="${SKIP_BACKEND_BUILD:-false}"
STOP_STALE_DEV_PORTS="${STOP_STALE_DEV_PORTS:-true}"
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
echo "  API:     $ORIGIN/api"
echo "  health:  $ORIGIN/api/health"
echo
echo "Internal service ports are implementation details:"
echo "  backend -> http://127.0.0.1:3000"
echo "  vite    -> http://127.0.0.1:5173"
echo "  pingora -> https://0.0.0.0:443"
echo
echo "Logs:"
echo "  backend: $log_dir/backend.log"
echo "  web:     $log_dir/web.log"
echo "  proxy:   $log_dir/proxy.log"
echo

stop_stale_port_listeners 3000 "backend"
stop_stale_port_listeners 5173 "Vite web"
stop_stale_port_listeners 80 "Pingora HTTP proxy"
stop_stale_port_listeners 443 "Pingora HTTPS proxy"

require_port_free 3000 "backend"
require_port_free 5173 "Vite web"
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

if [[ "$SKIP_BACKEND_BUILD" != "true" || "$backend_needs_build" == "true" || ! -x "$BACKEND_BIN" ]]; then
  echo "Compiling backend before launch..."
  cargo build -p medbrains-server --bin medbrains-server
fi

echo "Compiling Pingora proxy before launch..."
cargo build -p medbrains-proxy >/dev/null

echo "Authorizing sudo for local HTTPS ports 80/443..."
sudo -v

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend, web, and Pingora. Open: $ORIGIN"
echo

"$BACKEND_BIN" >"$log_dir/backend.log" 2>&1 &
backend_pid="$!"
pnpm dev:web >"$log_dir/web.log" 2>&1 &
web_pid="$!"
sudo -n -E "$PROXY_BIN" --config "$PROXY_CONFIG" >"$log_dir/proxy.log" 2>&1 &
proxy_pid="$!"

sleep 2

check_child_started "$backend_pid" "Backend" "$log_dir/backend.log"
check_child_started "$web_pid" "Vite web" "$log_dir/web.log"
check_child_started "$proxy_pid" "Pingora" "$log_dir/proxy.log"
wait_for_port 3000 "Backend" 15 "$backend_pid" "$log_dir/backend.log"
wait_for_port 5173 "Vite web" 15 "$web_pid" "$log_dir/web.log"
wait_for_port 443 "Pingora HTTPS proxy" 15 "$proxy_pid" "$log_dir/proxy.log"

echo "Ready URL: $ORIGIN"
echo "Use Ctrl+C to stop all dev services."
echo

tail -n +1 -f "$log_dir/backend.log" | sed -u "s/^/[backend] /" &
tail -n +1 -f "$log_dir/web.log" \
  | sed -u \
    -e "s#http://localhost:5173/#$ORIGIN/#g" \
    -e "s#http://127.0.0.1:5173/#$ORIGIN/#g" \
    -e "s#Network: use --host to expose#Proxy:   $ORIGIN#g" \
    -e "s/^/[web] /" &
tail -n +1 -f "$log_dir/proxy.log" | sed -u "s/^/[proxy] /" &
wait

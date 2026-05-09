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
BACKEND_BIN="$ROOT_DIR/target/debug/medbrains-server"
PROXY_BIN="$ROOT_DIR/target/debug/medbrains-proxy"

log_dir="$ROOT_DIR/var/log/dev"
mkdir -p "$log_dir"

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

cleanup() {
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend, web, and Pingora. Open: $ORIGIN"
echo

"$BACKEND_BIN" >"$log_dir/backend.log" 2>&1 &
pnpm dev:web >"$log_dir/web.log" 2>&1 &
sudo -E "$PROXY_BIN" --config "$PROXY_CONFIG" >"$log_dir/proxy.log" 2>&1 &

sleep 2

if ! kill -0 "$!" 2>/dev/null; then
  echo "Pingora failed to start. Last proxy log lines:"
  tail -80 "$log_dir/proxy.log"
  exit 1
fi

echo "Ready URL: $ORIGIN"
echo "Use Ctrl+C to stop all dev services."
echo

tail -n +1 -f "$log_dir/backend.log" | sed -u "s/^/[backend] /" &
tail -n +1 -f "$log_dir/web.log" \
  | sed -u \
    -e "s#http://localhost:5173/#$ORIGIN/#g" \
    -e "s#Network: use --host to expose#Proxy:   $ORIGIN#g" \
    -e "s/^/[web] /" &
tail -n +1 -f "$log_dir/proxy.log" | sed -u "s/^/[proxy] /" &
wait

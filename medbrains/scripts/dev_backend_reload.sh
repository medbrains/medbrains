#!/usr/bin/env bash
#
# Backend dev runner with React-Native-Metro-style hotkeys: the Rust server is
# built once and run in the background; pressing `r` rebuilds and restarts it,
# `q` quits. Rust rebuilds are slow, so this is a manual trigger (no
# rebuild-on-every-save watcher) — you decide when to reload.
#
#   r = rebuild + restart backend
#   q = quit (also Ctrl-C)
#
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# jemalloc-sys and other C deps shell out to `make`; a leaked MAKEFLAGS=-j from
# the parent `make` breaks them. Clear it before any cargo build.
unset MAKEFLAGS

export SPICEDB_ENDPOINT="${SPICEDB_ENDPOINT:-http://localhost:50051}"
export SPICEDB_TOKEN="${SPICEDB_TOKEN:-devsecret}"

BIN="$ROOT_DIR/target/debug/medbrains-server"
backend_pid=""

build() {
  printf '\n▶ building backend…\n'
  if cargo build -p medbrains-server --bin medbrains-server; then
    printf '✓ build ok\n'
    return 0
  fi
  printf '✗ build failed — keeping the running process\n'
  return 1
}

start() {
  "$BIN" &
  backend_pid=$!
  printf '✓ backend up (pid %s) on :3000\n' "$backend_pid"
}

stop() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null
    wait "$backend_pid" 2>/dev/null
  fi
  backend_pid=""
}

restart() {
  # Build first; only swap the process if the build succeeds, so a broken
  # edit doesn't take the server down.
  build || return
  stop
  start
}

cleanup() {
  trap - EXIT INT TERM
  stop
  exit 0
}
trap cleanup EXIT INT TERM

# Sync the local SpiceDB schema like `make dev-backend` does.
scripts/spicedb_local_schema.sh || true

build && start
printf '\n  \033[1mr\033[0m = rebuild+restart    \033[1mq\033[0m = quit\n\n'

# Read single keypresses without requiring Enter. Requires a TTY (it has one
# when run from `make` in a terminal).
while true; do
  IFS= read -rsn1 key || break
  case "$key" in
    r | R) restart ;;
    q | Q) cleanup ;;
  esac
done

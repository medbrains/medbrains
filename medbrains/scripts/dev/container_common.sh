#!/usr/bin/env bash
# Shared helpers for the dev services that have no native macOS build and so
# run under Apple's `container` (github.com/apple/container) instead of Docker.
# Sourced by orthanc.sh, icd_api.sh and kiwi.sh; not run directly.
#
# Data goes in named `container` volumes (medbrains-*), outside the repo.
# Ports publish on 127.0.0.1 only, the same host ports as docker-compose.yml.

set -euo pipefail

# Stop with a message that names the fix.
die() { echo "$(basename "$0"): $*" >&2; exit 1; }

# The CLI must be installed and its system service running.
require_container() {
  command -v container >/dev/null 2>&1 \
    || die "Apple container is not installed (docs/DEV-SETUP.md, 'Extras')"
  container system status >/dev/null 2>&1 || container system start
}

# True when a container named $1 exists, running or not.
container_exists() { container inspect "$1" >/dev/null 2>&1; }

# Start the existing container $1 if stopped; return 1 when it must be created.
resume_container() {
  container_exists "$1" || return 1
  container start "$1" >/dev/null 2>&1 || true
  echo "$1: running"
}

# Stop and remove container $1. Its named volume, and so its data, stays.
remove_container() {
  if container_exists "$1"; then
    container stop "$1" >/dev/null 2>&1 || true
    container rm "$1" >/dev/null
    echo "$1: stopped (data kept in its volume)"
  fi
}

# Print the IPv4 address of container $1 on the default network.
container_ip() {
  container inspect "$1" | python3 -I -c '
import json, sys
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("address", "ipv4Address") and isinstance(v, str) and "." in v:
                print(v.split("/")[0]); sys.exit(0)
            walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(json.load(sys.stdin)); sys.exit(1)'
}

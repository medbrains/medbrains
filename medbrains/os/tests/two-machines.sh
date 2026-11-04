#!/usr/bin/env bash
# Boots a fresh main machine and a fresh node on one virtual LAN, for the join flow
# (OS-SETUP-AND-TRUST §8). The LAN is a QEMU socket netdev: a wire carrying whole Ethernet frames,
# so multicast crosses it and mDNS gets a fair test. Drive each with vm.py and its own OS_WORK.
#
#   OS_WORK=/tmp/mb-osimage-join os/tests/two-machines.sh path/to/debug-image.raw
#
# Main machine: $OS_WORK/main/vm, web on 127.0.0.1:${JOIN_WEB_PORT:-8450}. Node: $OS_WORK/node/vm,
# with no other network than the wire.
set -euo pipefail

OS="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="$1"
ROOT="${OS_WORK:-/tmp/mb-osimage-join}"
WIRE="${JOIN_WIRE_PORT:-8451}"
WEB="${JOIN_WEB_PORT:-8450}"

LAN="-device virtio-net-pci,netdev=lan,mac=52:54:00:4a:00"
MAIN_NET="-netdev socket,id=lan,listen=127.0.0.1:$WIRE $LAN:01"
MAIN_NET+=" -netdev user,id=net0,hostfwd=tcp:127.0.0.1:$WEB-:443 -device virtio-net-pci,netdev=net0"
NODE_NET="-netdev socket,id=lan,connect=127.0.0.1:$WIRE $LAN:02"

OS_WORK="$ROOT/main" OS_NET_ARGS="$MAIN_NET" "$OS/qemu-run.sh" --fresh "$IMAGE" &
main=$!
trap 'kill "$main" 2>/dev/null || true' EXIT
sleep 2
OS_WORK="$ROOT/node" OS_NET_ARGS="$NODE_NET" "$OS/qemu-run.sh" --fresh "$IMAGE"

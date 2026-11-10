#!/bin/sh
# Run as root on a node after it joined (two-machines.sh): a node holds no secrets but its own key,
# so the identity provider started for setup must be stopped and its data gone.
set -eu
[ -e /var/lib/medbrains/config/role-node ] || { echo "FAIL: this machine is not a node"; exit 1; }
pgrep -x kanidmd >/dev/null && { echo "FAIL: kanidmd still runs on a node"; exit 1; }
[ -n "$(ls -A /var/lib/kanidm 2>/dev/null)" ] && { echo "FAIL: /var/lib/kanidm still holds data on a node"; exit 1; }
[ -e /run/medbrains-console/kanidm-for-setup ] && { echo "FAIL: the setup marker is still there"; exit 1; }
echo "ok: the node holds no identity provider"

#!/usr/bin/env bash
# Nothing may answer on the network before setup finishes, so everything the main machine runs
# carries the role condition itself and none of it is enabled directly. Fails if one drifts.
set -euo pipefail

OS="$(cd "$(dirname "$0")/.." && pwd)"
UNITS="$OS/mkosi.extra/usr/lib/systemd/system"
ROLE=ConditionPathExists=/var/lib/medbrains/config/role-main
for unit in medbrains-main.target medbrains-server.service medbrains-db-init.service \
    medbrains-console-status.service caddy.service.d/10-medbrains.conf kanidm-setup.service medbrains-signin-limit.service \
    postgresql@.service.d/10-medbrains.conf; do
    grep -qx "$ROLE" "$UNITS/$unit" || { echo "FAIL: $unit has no role condition"; exit 1; }
done
# Kanidm may also run for setup, on loopback, so that it can make the first administrator.
grep -qx "ConditionPathExists=|/var/lib/medbrains/config/role-main" "$UNITS/kanidmd.service" || { echo "FAIL: kanidmd has no role condition"; exit 1; }
enabled="$(sed -n '/^systemctl enable/,/[^\\]$/p' "$OS/mkosi.postinst.chroot")"
for unit in medbrains-server caddy postgresql medbrains-db-init kanidmd kanidm-setup medbrains-signin-limit; do
    if grep -qw "$unit" <<<"$enabled"; then echo "FAIL: postinst enables $unit"; exit 1; fi
done
grep -qx 'disable caddy.service' "$UNITS/../system-preset/10-medbrains.preset" ||
    { echo "FAIL: Debian's preset would enable caddy"; exit 1; }
grep -qx 'disable chronyd-restricted.service' "$UNITS/../system-preset/10-medbrains.preset" ||
    { echo "FAIL: the restricted chrony can take the LAN's time port away"; exit 1; }
echo PASS

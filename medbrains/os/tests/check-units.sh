#!/usr/bin/env bash
# Nothing may answer on the network before setup finishes, so everything the main machine runs
# carries the role condition itself and none of it is enabled directly. Fails if one drifts.
set -euo pipefail

OS="$(cd "$(dirname "$0")/.." && pwd)"
UNITS="$OS/mkosi.extra/usr/lib/systemd/system"
ROLE=ConditionPathExists=/var/lib/medbrains/config/role-main
for unit in medbrains-main.target medbrains-server.service medbrains-db-init.service \
    medbrains-console-status.service medbrains-front.service medbrains-front-certs.service \
    postgresql@.service.d/10-medbrains.conf medbrains-agent-main.service \
    medbrains-role-network.service; do
    grep -qx "$ROLE" "$UNITS/$unit" || { echo "FAIL: $unit has no role condition"; exit 1; }
done
enabled="$(sed -n '/^systemctl enable/,/[^\\]$/p' "$OS/mkosi.postinst.chroot")"
for unit in medbrains-server medbrains-front postgresql medbrains-db-init; do
    if grep -qw "$unit" <<<"$enabled"; then echo "FAIL: postinst enables $unit"; exit 1; fi
done
if grep -rqi caddy "$OS/mkosi.conf" "$OS/mkosi.postinst.chroot" "$OS/mkosi.extra"; then
    echo "FAIL: Caddy is back in the image"; exit 1
fi
grep -qx 'disable chronyd-restricted.service' "$UNITS/../system-preset/10-medbrains.preset" ||
    { echo "FAIL: the restricted chrony can take the LAN's time port away"; exit 1; }
# A node runs the screen and the agent, and opens nothing: no main-machine port in the base firewall.
grep -qx 'ConditionPathExists=/var/lib/medbrains/config/role-node' "$UNITS/medbrains-node.target" ||
    { echo "FAIL: medbrains-node.target has no role condition"; exit 1; }
if sed -n '/chain input/,/^    }/p' "$OS/mkosi.extra/etc/nftables.conf" | grep -Eq 'dport .*(80|443|123|7844)'; then
    echo "FAIL: the base firewall opens a main machine's port on every machine"; exit 1
fi
for port in 7844 7845 443 123; do
    grep -q "dport.*$port" "$OS/mkosi.extra/usr/lib/medbrains/main-machine.nft" ||
        { echo "FAIL: a main machine does not open $port"; exit 1; }
done
grep -q '^allow' "$OS/mkosi.extra/etc/chrony/chrony.conf" &&
    { echo "FAIL: chrony would serve time on a node"; exit 1; }
grep -q '^server ' "$OS/mkosi.extra/etc/chrony/chrony.conf" &&
    { echo "FAIL: chrony.conf names sources for every role; a node must ask only its main machine"; exit 1; }
grep -q 'port 1023' "$OS/mkosi.extra/usr/lib/medbrains/time-role" ||
    { echo "FAIL: a node has no time source"; exit 1; }
# The agents' limits, and the clock's port: below 1024, so nothing else here can bind it.
for unit in medbrains-agent.service medbrains-agent-main.service; do
    for setting in MemoryMax= TasksMax= SystemCallFilter=; do
        grep -q "^$setting" "$UNITS/$unit" || { echo "FAIL: $unit has no $setting"; exit 1; }
    done
done
grep -q 'CAP_NET_BIND_SERVICE' "$UNITS/medbrains-agent.service" ||
    { echo "FAIL: the agent cannot bind the clock's port"; exit 1; }
# The screen's trust store stays out of the screen's own reach.
grep -q 'BindReadOnlyPaths=/var/lib/medbrains-settings/local-front.pem:' "$UNITS/cage-console.service" ||
    { echo "FAIL: the screen's trust store is somewhere its user can write"; exit 1; }
# The certificate run is root: sandboxed, and never stuck holding the lock every front start needs.
for setting in TimeoutStartSec= ProtectSystem=strict NoNewPrivileges=yes CapabilityBoundingSet=; do
    grep -q "^$setting" "$UNITS/medbrains-front-certs.service" ||
        { echo "FAIL: medbrains-front-certs.service has no $setting"; exit 1; }
done
# A main machine takes no router advertisements, on every network it can use.
for network in 80-wired 81-wireless 10-medbrains-fixed 50-medbrains-preferred; do
    grep -q "$network" "$OS/mkosi.extra/usr/lib/medbrains/role-network" ||
        { echo "FAIL: role-network leaves router advertisements on for $network"; exit 1; }
done
# Setup starts this for a new hospital only, so a node never holds its secrets or database.
if grep -qw medbrains-firstboot <<<"$enabled"; then echo "FAIL: postinst enables first boot on a node"; exit 1; fi
echo PASS

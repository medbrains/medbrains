#!/usr/bin/env bash
#
# One-time sudo setup that lets `make dev` run WITHOUT sudo.
#
# The Pingora dev proxy must bind ports 80/443, which only root may do on
# macOS. Instead of running the whole dev stack as root (which poisons
# target/ with root-owned build artifacts), this installs pf redirect rules
# on the loopback interface:
#
#   80  -> 8080
#   443 -> 8443
#
# The proxy then binds 8080/8443 as your normal user and every
# https://*.medbrains.localhost URL keeps working unchanged.
#
# Usage:
#   sudo scripts/dev_pf_setup.sh           # install rules (persistent)
#   sudo scripts/dev_pf_setup.sh --remove  # remove rules
set -euo pipefail

ANCHOR_NAME="medbrains-dev"
ANCHOR_FILE="/etc/pf.anchors/${ANCHOR_NAME}"
PF_CONF="/etc/pf.conf"
HTTP_LISTEN="${DEV_PROXY_HTTP_PORT:-8080}"
HTTPS_LISTEN="${DEV_PROXY_HTTPS_PORT:-8443}"

if [[ "$(id -u)" != "0" ]]; then
  echo "Run this script with sudo: sudo scripts/dev_pf_setup.sh"
  exit 1
fi

remove_rules() {
  if [[ ! -f "$ANCHOR_FILE" ]]; then
    echo "No ${ANCHOR_FILE} — nothing to remove."
    return
  fi

  cp "$PF_CONF" "${PF_CONF}.bak-medbrains-dev"
  grep -v "${ANCHOR_NAME}" "$PF_CONF" > "${PF_CONF}.tmp" && mv "${PF_CONF}.tmp" "$PF_CONF"
  rm -f "$ANCHOR_FILE"
  pfctl -f "$PF_CONF" >/dev/null 2>&1 || true
  echo "Removed ${ANCHOR_NAME} anchor from ${PF_CONF} (backup at ${PF_CONF}.bak-medbrains-dev)."
}

if [[ "${1:-}" == "--remove" ]]; then
  remove_rules
  exit 0
fi

if [[ "${1:-}" != "" ]]; then
  echo "Usage: sudo scripts/dev_pf_setup.sh [--remove]"
  exit 64
fi

cat > "$ANCHOR_FILE" <<EOF
# Redirect privileged ports to the unprivileged MedBrains dev proxy so
# \`make dev\` never needs root. Installed by scripts/dev_pf_setup.sh.
rdr pass on lo0 inet proto tcp from any to any port 80 -> 127.0.0.1 port ${HTTP_LISTEN}
rdr pass on lo0 inet proto tcp from any to any port 443 -> 127.0.0.1 port ${HTTPS_LISTEN}
rdr pass on lo0 inet6 proto tcp from any to any port 80 -> ::1 port ${HTTP_LISTEN}
rdr pass on lo0 inet6 proto tcp from any to any port 443 -> ::1 port ${HTTPS_LISTEN}
EOF
chmod 644 "$ANCHOR_FILE"

cp "$PF_CONF" "${PF_CONF}.bak-medbrains-dev"

# Insert rdr-anchor before the first filter rule, load-anchor at the end.
# Idempotent: skip whichever line is already present.
if ! grep -q "rdr-anchor \"${ANCHOR_NAME}\"" "$PF_CONF"; then
  awk -v line="rdr-anchor \"${ANCHOR_NAME}\"" '
    !done && /^[[:space:]]*(pass|block|anchor|dummynet-anchor)[[:space:]]/ {
      print line; done = 1
    }
    { print }
  ' "$PF_CONF" > "${PF_CONF}.tmp" && mv "${PF_CONF}.tmp" "$PF_CONF"
fi

if ! grep -q "load anchor \"${ANCHOR_NAME}\"" "$PF_CONF"; then
  printf 'load anchor "%s" from "%s"\n' "$ANCHOR_NAME" "$ANCHOR_FILE" >> "$PF_CONF"
fi

if ! pfctl -f "$PF_CONF"; then
  echo "pfctl rejected ${PF_CONF} — restoring backup."
  cp "${PF_CONF}.bak-medbrains-dev" "$PF_CONF"
  pfctl -f "$PF_CONF" || true
  exit 1
fi

pfctl -E >/dev/null 2>&1 || true

echo
echo "Installed: ports 80->${HTTP_LISTEN} and 443->${HTTPS_LISTEN} on loopback."
echo "Rules persist across reboots via ${PF_CONF}. Remove anytime with:"
echo "  sudo scripts/dev_pf_setup.sh --remove"
echo
echo "Now run plain: make dev   (no sudo)"

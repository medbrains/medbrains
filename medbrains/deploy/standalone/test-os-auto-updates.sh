#!/usr/bin/env bash
# shellcheck disable=SC2016  # the ${distro_codename} literals are what apt expands
# Renders os-auto-updates.sh into a temp root and checks the policy it writes.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./os-auto-updates.sh
source "$HERE/os-auto-updates.sh"
ROOT="$(mktemp -d)"; trap 'rm -rf "$ROOT"' EXIT
fail() { echo "FAIL: $*"; exit 1; }

OS_UPDATES_ROOT="$ROOT" configure_os_auto_updates >/dev/null
UU="$ROOT/etc/apt/apt.conf.d/52medbrains-unattended-upgrades"
grep -q '^#clear Unattended-Upgrade::Origins-Pattern;' "$UU" || fail "distribution origins not cleared"
grep -q 'codename=${distro_codename}-security,label=Debian-Security' "$UU" || fail "no Debian security origin"
grep -q 'archive=${distro_codename}-security,label=Ubuntu' "$UU" || fail "no Ubuntu security origin"
[[ "$(grep -c '^    "origin=' "$UU")" == 2 ]] || fail "an origin other than security is allowed"
grep -q 'Automatic-Reboot "false"' "$UU" || fail "reboot must be off by default"
grep -q 'OnCalendar=\*-\*-\* 03:30' "$ROOT/etc/systemd/system/apt-daily-upgrade.timer.d/medbrains-window.conf" \
    || fail "default window not 03:30"
grep -q 'Unattended-Upgrade "1"' "$ROOT/etc/apt/apt.conf.d/20auto-upgrades" || fail "periodic upgrade off"

OS_UPDATES_ROOT="$ROOT" OS_UPDATE_REBOOT=1 OS_UPDATE_REBOOT_TIME=04:15 OS_UPDATE_WINDOW=01:00 \
    configure_os_auto_updates >/dev/null
grep -q 'Automatic-Reboot "true"' "$UU" || fail "OS_UPDATE_REBOOT=1 ignored"
grep -q 'Automatic-Reboot-Time "04:15"' "$UU" || fail "reboot time ignored"
grep -q 'OnCalendar=\*-\*-\* 01:00' "$ROOT/etc/systemd/system/apt-daily-upgrade.timer.d/medbrains-window.conf" \
    || fail "window ignored"

if OS_UPDATES_ROOT="$ROOT" OS_UPDATE_WINDOW='3am; rm -rf /' configure_os_auto_updates >/dev/null 2>&1; then
    fail "a malformed window was accepted"
fi
echo "ok: os-auto-updates writes a security-only policy with the configured window and reboot"

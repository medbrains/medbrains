#!/usr/bin/env bash
# Automatic OS security updates for the host (Debian 12 / Ubuntu 22.04+).
#
# Security updates only, from the distribution's security archive: never
# feature updates, never Docker's or anyone else's repository. MedBrains itself
# is NOT updated by apt — it updates through its own signed releases
# (docs/SECURITY-RELEASE-PROCESS.md).
#
# Sourced by install.sh; `bash os-auto-updates.sh` also works on its own.
#
#   OS_AUTO_UPDATES=1|0        on by default on a dedicated host; off on an attach
#                              host (somebody else owns its update policy)
#   OS_UPDATE_WINDOW=03:30     when the nightly upgrade starts (host local time), after
#                              the 02:30 sealed backup and the 03:00 WAL-G backup
#   OS_UPDATE_REBOOT=0|1       reboot by itself when an update needs it; off by
#                              default — a reboot stops the HMS for a minute or two
#   OS_UPDATE_REBOOT_TIME=04:30   when that reboot may happen
#
# Logs: /var/log/unattended-upgrades/ and the journal (unattended-upgrades).
# OS_UPDATES_ROOT writes the config under another root, for the test.

configure_os_auto_updates() {
    local root="${OS_UPDATES_ROOT:-}"
    local window="${OS_UPDATE_WINDOW:-03:30}"
    local reboot_time="${OS_UPDATE_REBOOT_TIME:-04:30}"
    local reboot="false"
    [[ "${OS_UPDATE_REBOOT:-0}" == "1" ]] && reboot="true"
    local t
    for t in "$window" "$reboot_time"; do
        if [[ ! "$t" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]]; then
            echo "    ERROR: '$t' is not a 24-hour HH:MM time (OS_UPDATE_WINDOW / OS_UPDATE_REBOOT_TIME)" >&2
            return 1
        fi
    done

    if [[ -z "$root" ]]; then
        apt-get install -y --no-install-recommends unattended-upgrades
    fi
    mkdir -p "$root/etc/apt/apt.conf.d" "$root/etc/systemd/system/apt-daily-upgrade.timer.d"

    cat > "$root/etc/apt/apt.conf.d/20auto-upgrades" <<'EOF'
// Written by the MedBrains installer (os-auto-updates.sh).
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

    # #clear empties the distribution's own origin lists first, so this file is
    # the whole policy: the security archive and nothing else.
    cat > "$root/etc/apt/apt.conf.d/52medbrains-unattended-upgrades" <<EOF
// Written by the MedBrains installer (os-auto-updates.sh). Security updates only.
#clear Unattended-Upgrade::Allowed-Origins;
#clear Unattended-Upgrade::Origins-Pattern;
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=\${distro_codename}-security,label=Debian-Security";
    "origin=Ubuntu,archive=\${distro_codename}-security,label=Ubuntu";
};
Unattended-Upgrade::Automatic-Reboot "$reboot";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "$reboot_time";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::SyslogEnable "true";
EOF

    cat > "$root/etc/systemd/system/apt-daily-upgrade.timer.d/medbrains-window.conf" <<EOF
# Written by the MedBrains installer: the hospital's maintenance window.
[Timer]
OnCalendar=
OnCalendar=*-*-* $window
RandomizedDelaySec=15m
EOF

    if [[ -z "$root" ]]; then
        systemctl daemon-reload
        systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
        unattended-upgrade --dry-run >/dev/null 2>&1 \
            || echo "    WARNING: unattended-upgrade --dry-run failed — check /var/log/unattended-upgrades/"
    fi
    echo "    OS security updates: nightly at $window, automatic reboot $reboot (at $reboot_time)"
    [[ "$reboot" == "false" ]] && echo "    A kernel update waits for a planned reboot: /var/run/reboot-required says when one is due."
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    set -euo pipefail
    configure_os_auto_updates
fi

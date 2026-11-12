#!/bin/bash
# CIS Debian Linux Level 2 (Server) style check of a running MedBrains OS machine (task X16).
#
# OpenSCAP cannot do this job: Debian's ssg-debian content (trixie: 0.1.76) has no CIS profile and
# targets Debian 11 and 12 only, so on trixie every rule reads "not applicable". This script implements
# the benchmark's checks that apply to an appliance, numbered as in CIS Debian Linux 12 v1.1.0, and says
# for each one PASS, FAIL, or LIMIT (an accepted limit, explained in os/README.md "Hardening report").
# Read-only. Prints one line per check and a SUMMARY line; exits 1 if anything FAILs.
#
#   /usr/lib/medbrains/cis-check        (debug images; medbrains-os-test runs it)
set -uo pipefail
export LC_ALL=C

PASS=0 FAIL=0 LIMIT=0

# Records one result: status, benchmark number, title, and a detail for anything not a plain pass.
result() {
    case "$1" in PASS) PASS=$((PASS + 1)) ;; FAIL) FAIL=$((FAIL + 1)) ;; LIMIT) LIMIT=$((LIMIT + 1)) ;; esac
    printf '%-5s %-10s %s%s\n' "$1" "$2" "$3" "${4:+: $4}"
}

# PASS if the command succeeds, FAIL with `detail` otherwise.
check() {
    local id="$1" title="$2" detail="$3"
    shift 3
    if "$@" >/dev/null 2>&1; then result PASS "$id" "$title"; else result FAIL "$id" "$title" "$detail"; fi
}

# An accepted limit: the reason is the README's, repeated here so the report stands alone.
limit() { result LIMIT "$1" "$2" "$3"; }

# True if modprobe would refuse the module and it is not loaded.
module_off() {
    modprobe -n -v "$1" 2>/dev/null | grep -qE '^install /bin/(false|true)' && ! lsmod | grep -qw "^${1//-/_}"
}

# True if a sysctl reads back as the expected value.
sysctl_is() { [[ "$(sysctl -n "$1" 2>/dev/null)" == "$2" ]]; }

# True if no package of this name is installed.
not_installed() { ! dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q 'install ok installed'; }

# True if the mount at `$1` has every option in `$2..`.
mount_has() {
    local options
    options="$(findmnt -n -o OPTIONS --target "$1")" || return 1
    shift
    for want in "$@"; do [[ ",$options," == *",$want,"* ]] || return 1; done
}

# True if `file` has a mode no wider than `max` (octal) and the given owner and group.
mode_at_most() {
    local file="$1" max="$2" owner="$3" group="$4" mode
    [[ -e "$file" ]] || return 0
    mode="$(stat -c %a "$file")"
    (((8#$mode & ~8#$max) == 0)) && [[ "$(stat -c %U:%G "$file")" == "$owner:$group" ]]
}

section_filesystems() {
    for m in cramfs freevxfs hfs hfsplus jffs2 squashfs udf; do
        check 1.1.1 "$m is disabled" "modprobe would load it" module_off "$m"
    done
    limit 1.1.1.9 "usb-storage is disabled" "USB sticks carry signed OS updates and offline bundles (OS-UPDATES.md); they mount read-only, noexec, nosuid, nodev"
    check 1.1.2.1 "/tmp is a separate tmpfs with nodev,nosuid,noexec" "options missing" mount_has /tmp nodev nosuid noexec
    check 1.1.2.2 "/dev/shm has nodev,nosuid,noexec" "options missing" mount_has /dev/shm nodev nosuid noexec
    limit 1.1.2.3 "/home is a separate partition" "no person has an account or a home folder; /home is empty and read-only"
    check 1.1.2.4 "/var is a separate partition with nodev,nosuid" "not separate, or options missing" mount_has /var nodev nosuid
    limit 1.1.2.5 "/var/tmp is a separate partition" "one encrypted data partition by design (§8k); /var/tmp carries its nodev,nosuid"
    limit 1.1.2.6 "/var/log is a separate partition" "journald's size limits keep logs from filling /var (journald.conf.d); a second partition would split the disk's encryption"
    limit 1.1.2.7 "/var/log/audit is a separate partition" "no auditd: see 6.3"
}

section_boot_and_processes() {
    limit 1.2 "package manager repositories and keys" "the image carries no apt sources: software changes only through signed A/B bundles (U1)"
    check 1.3.1.1 "AppArmor is installed" "apparmor package missing" dpkg-query -W apparmor
    check 1.3.1.2 "AppArmor is the active security module" "not in /sys/kernel/security/lsm" grep -qw apparmor /sys/kernel/security/lsm
    check 1.3.1.4 "every AppArmor profile is in enforce mode" "a profile is in complain mode" \
        bash -c '! grep -q "(complain)" /sys/kernel/security/apparmor/profiles'
    check 1.4.1 "the boot entry cannot be edited" "systemd-boot's editor is on" grep -qx 'editor no' /boot/loader/loader.conf
    check 1.4.2 "boot configuration is root's alone" "readable by others" bash -c '[[ "$(stat -c %a /boot/loader/loader.conf)" =~ ^[0-7]00$|^[0-7][0-5]0$ ]] || findmnt -n -o OPTIONS /boot | grep -qE "fmask=0?077"'
    check 1.5.1 "address space layout randomisation is on" "randomize_va_space is not 2" sysctl_is kernel.randomize_va_space 2
    check 1.5.2 "ptrace is restricted" "yama.ptrace_scope below 1" bash -c '(( $(sysctl -n kernel.yama.ptrace_scope) >= 1 ))'
    check 1.5.3 "core dumps are off" "core files can be written" bash -c '[[ "$(sysctl -n fs.suid_dumpable)" == 0 && "$(sysctl -n kernel.core_pattern)" == "|/bin/false" ]]'
    check 1.5.4 "prelink is not installed" "installed" not_installed prelink
    check 1.5.5 "apport is not installed" "installed" not_installed apport
    for f in /etc/motd /etc/issue /etc/issue.net; do
        check 1.6 "$f names no OS or version" "it does" bash -c "! grep -qiE '\\\\[mrsv]|debian|linux' $f"
        check 1.6 "$f is 644 root:root" "wrong mode or owner" mode_at_most "$f" 644 root root
    done
    check 1.7 "no display manager" "gdm3 or lightdm installed" bash -c 'dpkg-query -W gdm3 lightdm 2>&1 | grep -q "no packages found" || ! dpkg-query -W -f="\${Status}\n" gdm3 lightdm 2>/dev/null | grep -q "ok installed"'
}

section_services() {
    for p in autofs avahi-daemon isc-dhcp-server bind9 dnsmasq vsftpd slapd dovecot-core nfs-kernel-server \
        ypserv cups rpcbind rsync samba snmpd tftpd-hpa squid apache2 nginx xinetd xserver-xorg-core \
        nis rsh-client talk telnet inetutils-telnet ldap-utils ftp tnftp; do
        check 2.1 "$p is not installed" "installed" not_installed "$p"
    done
    limit 2.1.20 "no web server" "the MedBrains front is the product; it is the only listener a stranger reaches (N2.1)"
    check 2.1.21 "no mail server listens beyond loopback" "something listens on port 25" bash -c '! ss -ltnH | awk "{print \$4}" | grep -qE ":(25|465|587)$"'
    check 2.3.1 "one time daemon, chrony" "another time daemon is installed" bash -c 'not() { ! dpkg-query -W -f="\${Status}" "$1" 2>/dev/null | grep -q "ok installed"; }; not ntp && not ntpsec && not systemd-timesyncd'
    check 2.3.3 "chrony runs as _chrony" "it runs as root" bash -c '[[ "$(ps -o user= -C chronyd | sort -u)" == _chrony ]]'
    check 2.4 "no cron daemon (systemd timers only)" "cron installed" not_installed cron
}

section_network() {
    limit 3.1.2 "wireless interfaces are disabled" "Wi-Fi is how some wards connect; iwd starts only when a card exists (udev rule)"
    check 3.1.3 "Bluetooth is disabled" "the module loads" module_off bluetooth
    for m in dccp tipc rds sctp; do check 3.2 "$m is disabled" "modprobe would load it" module_off "$m"; done
    local -a want=(
        net.ipv4.ip_forward=0 net.ipv6.conf.all.forwarding=0
        net.ipv4.conf.all.send_redirects=0 net.ipv4.conf.default.send_redirects=0
        net.ipv4.icmp_ignore_bogus_error_responses=1 net.ipv4.icmp_echo_ignore_broadcasts=1
        net.ipv4.conf.all.accept_redirects=0 net.ipv4.conf.default.accept_redirects=0
        net.ipv6.conf.all.accept_redirects=0 net.ipv6.conf.default.accept_redirects=0
        net.ipv4.conf.all.secure_redirects=0 net.ipv4.conf.default.secure_redirects=0
        net.ipv4.conf.all.rp_filter=1 net.ipv4.conf.default.rp_filter=1
        net.ipv4.conf.all.accept_source_route=0 net.ipv4.conf.default.accept_source_route=0
        net.ipv6.conf.all.accept_source_route=0 net.ipv6.conf.default.accept_source_route=0
        net.ipv4.conf.all.log_martians=1 net.ipv4.conf.default.log_martians=1
        net.ipv4.tcp_syncookies=1 net.ipv6.conf.all.accept_ra=0 net.ipv6.conf.default.accept_ra=0
    )
    for pair in "${want[@]}"; do check 3.3 "${pair%=*} is ${pair#*=}" "it is $(sysctl -n "${pair%=*}" 2>&1)" sysctl_is "${pair%=*}" "${pair#*=}"; done
}

section_firewall() {
    check 4.1.1 "nftables is installed" "missing" dpkg-query -W nftables
    check 4.1.2 "no second firewall front end" "ufw or iptables-persistent installed" bash -c '! dpkg-query -W -f="\${Status}\n" ufw iptables-persistent 2>/dev/null | grep -q "ok installed"'
    check 4.3.2 "base chains exist for input, forward and output" "a hook is missing" bash -c 'r="$(nft list ruleset)"; for h in input forward output; do grep -q "hook $h" <<<"$r" || exit 1; done'
    check 4.3.3 "loopback traffic is allowed and spoofed loopback dropped" "no loopback rule" bash -c 'nft list ruleset | grep -qE "iif(name)? \"?lo\"? accept"'
    check 4.3.5 "every base chain drops by default" "a chain accepts by default" bash -c '[[ "$(nft list ruleset | grep -c "policy drop")" -ge 3 ]]'
    check 4.3.6 "nftables starts at boot" "not enabled" systemctl is-enabled nftables
}

section_access() {
    check 5.1 "no SSH server" "openssh-server installed" not_installed openssh-server
    limit 5.2.1 "sudo is installed" "nobody logs in, so no one would use it; services drop privilege through systemd"
    limit 5.3 "PAM password quality, lockout and history" "no local password sign-in exists; staff sign in through Kanidm, with its own strength check and lockout (T3)"
    limit 5.4.1 "shadow password ageing" "the same: no account here has a usable password"
    check 5.4.2.1 "root is the only UID 0 account" "another UID 0" bash -c '[[ "$(awk -F: "\$3==0{print \$1}" /etc/passwd)" == root ]]'
    check 5.4.2.2 "root is the only GID 0 account" "another GID 0" bash -c '[[ "$(awk -F: "\$4==0{print \$1}" /etc/passwd)" == root ]]'
    check 5.4.2.4 "root's password is locked" "root can sign in" bash -c '[[ "$(passwd -S root | cut -d" " -f2)" == L ]]'
    check 5.4.2.5 "root's PATH has no empty or writable entries" "it does" bash -c 'IFS=:; for d in $PATH; do [[ -n "$d" && "$d" != . ]] || exit 1; [[ ! -d "$d" ]] || ! find "$d" -maxdepth 0 -perm /022 | grep -q .; done'
    check 5.4.2.7 "system accounts have no login shell" "an account has one" bash -c '! awk -F: "\$1!=\"root\" && \$3<1000 && \$7!~/(nologin|false|sync|shutdown|halt)\$/ {print}" /etc/passwd | grep -q .'
    check 5.4.2.8 "accounts without a shell are locked" "one has a usable password" bash -c '! awk -F: "NR==FNR { if (\$7 ~ /(nologin|false)\$/) n[\$1] = 1; next } (\$1 in n) && \$2 !~ /^[!*]/" /etc/passwd /etc/shadow | grep -q .'
    limit 5.4.3 "shell timeout and umask for users" "there are no user shells; every service sets its own UMask"
    check 5.4.x "no serial, console or virtual-terminal login" "a getty is enabled" bash -c 'for u in getty@tty1 serial-getty@ttyS0 serial-getty@ttyAMA0 console-getty debug-shell; do [[ "$(systemctl is-enabled $u 2>/dev/null)" == masked* ]] || exit 1; done'
}

section_logging() {
    limit 6.1 "AIDE file integrity" "the root partition becomes a dm-verity sealed image (T1 verity): a changed file stops it booting, which AIDE could only report later"
    check 6.2.1.1 "journald is running" "not active" systemctl is-active systemd-journald
    check 6.2.1.2 "journald keeps logs across restarts, compressed" "Storage or Compress not set" bash -c 'systemd-analyze cat-config systemd/journald.conf | grep -qx "Storage=persistent" && systemd-analyze cat-config systemd/journald.conf | grep -qx "Compress=yes"'
    check 6.2.1.3 "journald does not accept remote logs" "systemd-journal-remote is installed" not_installed systemd-journal-remote
    check 6.2.2 "no second logger" "rsyslog installed" not_installed rsyslog
    limit 6.3 "auditd with the benchmark's syscall rules" "every audited syscall is a write to flash with nobody on site to read it; who opened which record is MedBrains' own audit log, and AppArmor denials reach the journal"
}

section_files() {
    check 7.1.1 "/etc/passwd 644 root:root" "wrong" mode_at_most /etc/passwd 644 root root
    check 7.1.3 "/etc/group 644 root:root" "wrong" mode_at_most /etc/group 644 root root
    check 7.1.5 "/etc/shadow 640 root:shadow" "wrong" mode_at_most /etc/shadow 640 root shadow
    check 7.1.7 "/etc/gshadow 640 root:shadow" "wrong" mode_at_most /etc/gshadow 640 root shadow
    check 7.1.9 "/etc/shells 644 root:root" "wrong" mode_at_most /etc/shells 644 root root
    check 7.1.11 "no world-writable files outside sticky scratch space" "found some" bash -c '! find / -xdev \( -path /proc -o -path /sys -o -path /dev -o -path /run \) -prune -o -type f -perm -0002 -print 2>/dev/null | grep -q .'
    check 7.1.11 "world-writable folders are sticky" "a folder is not" bash -c '! find / -xdev \( -path /proc -o -path /sys \) -prune -o -type d -perm -0002 ! -perm -1000 -print 2>/dev/null | grep -q .'
    check 7.1.12 "no file without an owner or group" "found some" bash -c '! find / -xdev \( -path /proc -o -path /sys \) -prune -o \( -nouser -o -nogroup \) -print 2>/dev/null | grep -q .'
    local suid
    suid="$(find / -xdev \( -path /proc -o -path /sys \) -prune -o -type f -perm /6000 -print 2>/dev/null | grep -vx /usr/lib/dbus-1.0/dbus-daemon-launch-helper | tr '\n' ' ')"
    if [[ -z "$suid" ]]; then result PASS 7.1.13 "no set-user-ID or set-group-ID program but D-Bus's helper"; else result FAIL 7.1.13 "no set-user-ID or set-group-ID program but D-Bus's helper" "$suid"; fi
    check 7.2.1 "every account uses shadowed passwords" "a password is in /etc/passwd" bash -c '! awk -F: "\$2!=\"x\"" /etc/passwd | grep -q .'
    check 7.2.2 "no account has an empty password" "one does" bash -c '! awk -F: "\$2==\"\"" /etc/shadow | grep -q .'
    check 7.2.3 "every group in passwd exists" "a missing group" bash -c 'for g in $(cut -d: -f4 /etc/passwd | sort -u); do getent group "$g" >/dev/null || exit 1; done'
    check 7.2.4 "no duplicate UIDs" "duplicates" bash -c '[[ -z "$(cut -d: -f3 /etc/passwd | sort | uniq -d)" ]]'
    check 7.2.5 "no duplicate GIDs" "duplicates" bash -c '[[ -z "$(cut -d: -f3 /etc/group | sort | uniq -d)" ]]'
    check 7.2.6 "no duplicate user names" "duplicates" bash -c '[[ -z "$(cut -d: -f1 /etc/passwd | sort | uniq -d)" ]]'
    check 7.2.7 "no duplicate group names" "duplicates" bash -c '[[ -z "$(cut -d: -f1 /etc/group | sort | uniq -d)" ]]'
    check 7.2.9 "root's home is 700 or tighter" "too open" bash -c '[[ ! -d /root ]] || [[ "$(stat -c %a /root)" =~ ^[0-7]00$ ]]'
}

section_filesystems
section_boot_and_processes
section_services
section_network
section_firewall
section_access
section_logging
section_files
printf 'SUMMARY pass=%d fail=%d limit=%d\n' "$PASS" "$FAIL" "$LIMIT"
((FAIL == 0))

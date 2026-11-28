#!/usr/bin/env bash
# Fails when a disk about to become an image still holds anything that must be made
# per machine: host keys, a machine id, login keys, passwords, shell history, private
# keys or MedBrains secrets. These are the checks a marketplace scanner makes, run
# before the image exists.
#   seal-check.sh [root-dir]     default /
#   seal-check.sh --self-test    plants each kind of leftover and expects a refusal
set -uo pipefail
FOUND=0

# Reports one leftover.
bad() { echo "SEAL FAIL: $*" >&2; FOUND=$((FOUND + 1)); }

# Checks the tree at $1 and returns non-zero when anything was left behind.
check() {
    local r="${1%/}" f
    FOUND=0
    for f in "$r"/etc/ssh/ssh_host_*; do [[ -e "$f" ]] && bad "SSH host key $f"; done
    [[ -s "$r/etc/machine-id" ]] && bad "/etc/machine-id is set"
    for f in etc/medbrains/env etc/medbrains/initial-admin-password root/medbrains-backup-identity.txt \
        etc/letsencrypt/live etc/postgresql/17/main var/lib/postgresql/17/main var/lib/cloud/instance \
        var/lib/medbrains-first-boot.done; do
        [[ -e "$r/$f" ]] && bad "/$f exists"
    done
    while IFS= read -r f; do bad "login key, history or cloud credential: $f"; done < <(
        find "$r/root" "$r/home" "$r/etc" "$r/var" -xdev -type f -size +0 \( -name 'authorized_keys*' \
            -o -name '.*_history' -o -name .lesshst -o -name .viminfo -o -path '*/.aws/*' \) 2>/dev/null)
    # The baked release under usr/local/lib/medbrains-image is public and checksum-verified, so it is not searched.
    while IFS= read -r f; do bad "private key in $f"; done < <(
        grep -rIlE -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' "$r/etc" "$r/root" "$r/home" "$r/var" \
            "$r/opt" "$r/srv" "$r/tmp" "$r/usr/local/bin" "$r/usr/local/sbin" 2>/dev/null)
    while IFS= read -r f; do bad "account '$f' has a password, or needs none"; done < <(
        awk -F: '$2 !~ /^[!*]/ { print $1 }' "$r/etc/shadow" 2>/dev/null)
    set -- "$r/etc/ssh/sshd_config" "$r"/etc/ssh/sshd_config.d/*.conf
    grep -qsiE '^[[:space:]]*PasswordAuthentication[[:space:]]+no' "$@" || bad "sshd does not refuse passwords"
    grep -qsiE '^[[:space:]]*(PasswordAuthentication|PermitEmptyPasswords|PermitRootLogin)[[:space:]]+yes' "$@" \
        && bad "sshd allows a password or root login"
    return $((FOUND > 0))
}

# Builds a clean tree, proves it passes, then plants one leftover at a time and proves each is refused.
self_test() {
    local t case_ path fails=0 pem='-----BEGIN' # split so the repository's secret scan sees no key here
    t="$(mktemp -d)"
    for case_ in "" 'etc/ssh/ssh_host_ed25519_key|k' 'etc/machine-id|0123' 'root/.ssh/authorized_keys|ssh-ed25519 A' \
        'home/admin/.bash_history|ls' 'root/.aws/credentials|[default]' 'etc/medbrains/env|JWT_PRIVATE_KEY=x' \
        'etc/medbrains/initial-admin-password|pw' 'root/medbrains-backup-identity.txt|AGE-SECRET-KEY-1' \
        "var/lib/x/tls.pem|$pem PRIVATE KEY-----" "etc/ssl/private/k.key|$pem RSA PRIVATE KEY-----" \
        'etc/shadow|root:$y$hash:1::::::' 'etc/shadow|admin::1::::::' \
        'etc/ssh/sshd_config.d/99.conf|PasswordAuthentication yes' 'etc/ssh/sshd_config.d/00.conf|# nothing'; do
        rm -rf "$t" && mkdir -p "$t/etc/ssh/sshd_config.d" "$t/root" "$t/home" "$t/var"
        echo 'PasswordAuthentication no' > "$t/etc/ssh/sshd_config.d/00.conf"
        echo 'root:*:1::::::' > "$t/etc/shadow" && : > "$t/etc/machine-id"
        path="${case_%%|*}"
        if [[ -n "$case_" ]]; then mkdir -p "$t/$(dirname "$path")" && echo "${case_#*|}" > "$t/$path"; fi
        if check "$t" 2>/dev/null; then
            [[ -n "$case_" ]] && { echo "self-test: NOT refused: $path"; fails=1; }
        else
            [[ -z "$case_" ]] && { echo "self-test: a clean tree was refused"; fails=1; }
        fi
    done
    rm -rf "$t"
    [[ "$fails" -eq 0 ]] && echo "seal-check self-test: ok"
    return "$fails"
}

if [[ "${1:-}" == "--self-test" ]]; then self_test; exit; fi
check "${1:-/}" && echo "seal check: clean"

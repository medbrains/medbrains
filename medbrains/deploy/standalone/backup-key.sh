# shellcheck shell=bash
# The backup sealing key, sourced by install.sh. Every backup is sealed with
# age to the public keys in the recipients file; the private key (identity)
# is the hospital's and lives offline. Decision:
# docs/decisions/2026-11-28-post-quantum-backup-sealing.md
#
# New keys are post-quantum hybrids (ML-KEM-768 + X25519, `age1pq1…`): a
# backup copied today must not open on a quantum computer decades from now.
# An old classic key (`age1…`) keeps working, with a loud warning, and its
# identity keeps opening the backups already sealed to it.

# Upstream age with -pq (1.3.0+). Ubuntu 22.04/24.04 and Debian 12/13 ship
# older ones. Hashes: GitHub's asset digests for the v1.3.2 release.
AGE_PQ_VERSION=v1.3.2
declare -A AGE_PQ_SHA256=(
    [amd64]=cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10
    [arm64]=6b8dc4333c53a5a57c9e5834e3a48f92605d7154014cd07269ff3327db5d37f4
)

# True when the age on PATH can make post-quantum keys and seal to them.
age_has_pq() { command -v age-keygen >/dev/null && age-keygen -pq >/dev/null 2>&1; }

# Puts the pinned upstream age in /usr/local/bin when the distro's has no -pq.
# The tarball is checked against its pinned hash before anything is installed.
ensure_age_pq() {
    age_has_pq && return 0
    local arch tmp rc=1
    case "$(uname -m)" in x86_64) arch=amd64 ;; aarch64) arch=arm64 ;; *) return 1 ;; esac
    tmp="$(mktemp -d)"
    curl -fsSL -o "$tmp/age.tgz" \
        "https://github.com/FiloSottile/age/releases/download/$AGE_PQ_VERSION/age-$AGE_PQ_VERSION-linux-$arch.tar.gz" \
        && echo "${AGE_PQ_SHA256[$arch]}  $tmp/age.tgz" | sha256sum --check --quiet \
        && tar -xzf "$tmp/age.tgz" -C "$tmp" \
        && install -m 0755 "$tmp/age/age" "$tmp/age/age-keygen" /usr/local/bin/ && rc=0
    rm -rf "$tmp"
    return "$rc"
}

# Prints pq, classic or none: the kind of the uncommented keys in file $1.
backup_recipients_kind() {
    if ! grep -qvE '^[[:space:]]*(#|$)' "$1" 2>/dev/null; then echo none
    elif grep -qvE '^[[:space:]]*(#|$|age1pq1)' "$1"; then echo classic
    else echo pq; fi
}

# Makes a keypair for this hospital: identity $2 (0600), its public half in $1.
# Post-quantum when age can; a classic key only when it cannot (warned after).
make_backup_key() {
    if age_has_pq; then (umask 077 && age-keygen -pq -o "$2" 2>/dev/null)
    else (umask 077 && age-keygen -o "$2" 2>/dev/null); fi
    age-keygen -y "$2" > "$1" && chmod 0644 "$1"
    echo "    ****************************************************************"
    echo "    A backup key was made for this hospital: $2"
    echo "    Every backup is sealed to it and NOTHING ELSE can open them."
    echo "    Copy it to two offline places now (USB in a safe, password"
    echo "    manager, a printed copy), then remove it from this server:"
    echo "        shred -u $2"
    echo "    Guide: Admin guide → Backups, 'Keep the backup key safe'."
    echo "    ****************************************************************"
}

# Refuses a recipients file age cannot seal to, and warns loudly on classic keys.
check_backup_recipients() {
    [[ -s "$1" ]] && command -v age >/dev/null || return 0
    if ! age -R "$1" </dev/null >/dev/null 2>&1; then
        echo "ERROR: $1 holds no valid age public key (age1pq1… or age1…)." >&2
        echo "       age cannot mix post-quantum (age1pq1…) and classic (age1…) keys in" >&2
        echo "       one file, and age1pq1… keys need age 1.3 or newer." >&2
        return 1
    fi
    [[ "$(backup_recipients_kind "$1")" == classic ]] || return 0
    echo "    ****************************************************************" >&2
    echo "    WARNING: backups are sealed to a CLASSIC key only (age1…, X25519)." >&2
    echo "    A copy taken today could be opened by a future quantum computer." >&2
    echo "    Make a post-quantum key (age-keygen -pq) and set it with" >&2
    echo "    BACKUP_AGE_RECIPIENT=age1pq1…: Admin guide → Backups, 'Rotate'." >&2
    echo "    ****************************************************************" >&2
}

# Sets up the recipients file $1 for identity path $2 and supplied keys $3:
#   1. $3 (BACKUP_AGE_RECIPIENT, one key per line) — set it to rotate.
#   2. the file a previous install left — kept as it is.
#   3. an identity left here earlier — its public half re-derived, never replaced.
#   4. none of these: a keypair made here (make_backup_key).
setup_backup_key() {
    local recipients="$1" identity="$2" supplied="$3"
    if [[ -n "$supplied" ]]; then
        printf '%s\n' "$supplied" > "$recipients" && chmod 0644 "$recipients"
    elif [[ ! -s "$recipients" && -s "$identity" ]]; then
        echo "    NOTE: $recipients is missing but $identity exists."
        if command -v age-keygen >/dev/null && age-keygen -y "$identity" > "$recipients"; then
            chmod 0644 "$recipients"
            echo "          Restored the public key from it; the private key is untouched."
        else
            rm -f "$recipients"
            echo "    ERROR: could not read the public key from $identity. Restore" >&2
            echo "           $recipients (the public key, from your offline copy) or set" >&2
            echo "           BACKUP_AGE_RECIPIENT, then re-run. The key file was not changed." >&2
            return 1
        fi
    elif [[ ! -s "$recipients" ]]; then
        if command -v age-keygen >/dev/null; then make_backup_key "$recipients" "$identity"
        else
            echo "    WARNING: no backup key — set BACKUP_AGE_RECIPIENT=age1pq1… or install age." >&2
            echo "             medbrains-pg-backup refuses to run until $recipients exists." >&2
        fi
    fi
    check_backup_recipients "$recipients"
}

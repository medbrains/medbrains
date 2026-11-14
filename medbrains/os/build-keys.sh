# The image build's key handling, sourced by build.sh and by os/tests/build-keys-test.sh. Every check
# stops the build with a reason: a key that is missing, empty, malformed or not its certificate's must
# never become an image that quietly checks nothing.

KEYS_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Stops the build with $1.
key_fail() {
    echo "build.sh: $1" >&2
    exit 1
}

# Refuses a key file that exists but is empty: what a failed earlier run leaves behind.
refuse_empty_key() {
    if [[ -e "$1" && ! -s "$1" ]]; then
        key_fail "$1 is empty, probably left by a failed run. Remove it and build again."
    fi
}

# Makes the debug update key $1 (a base64 seed, mode 0600) if it is not there, and writes its public
# key, base64, to $2. Both read through ed25519_der.py, by structure.
make_debug_update_key() {
    local der seed
    refuse_empty_key "$1"
    if [[ ! -f "$1" ]]; then
        der="$(mktemp)"
        openssl genpkey -algorithm ed25519 -outform DER -out "$der" 2>/dev/null || key_fail 'openssl could not make a key.'
        seed="$(python3 -I "$KEYS_HERE/ed25519_der.py" private "$der")" || { rm -f "$der"; key_fail 'openssl made no Ed25519 key.'; }
        rm -f "$der"
        (umask 077 && printf '%s\n' "$seed" > "$1.tmp") && mv "$1.tmp" "$1"
    fi
    der="$(mktemp)"
    python3 -I "$KEYS_HERE/ed25519_der.py" pkcs8 "$(cat "$1")" > "$der.pkcs8" || { rm -f "$der" "$der.pkcs8"; key_fail "$1 is not an Ed25519 seed."; }
    openssl pkey -inform DER -in "$der.pkcs8" -pubout -outform DER -out "$der" 2>/dev/null || { rm -f "$der" "$der.pkcs8"; key_fail "$1 could not be read."; }
    python3 -I "$KEYS_HERE/ed25519_der.py" public "$der" > "$2" || { rm -f "$der" "$der.pkcs8"; key_fail "$1 gave no public key."; }
    rm -f "$der" "$der.pkcs8"
}

# Makes a throwaway RSA key $1 and its certificate $2 for a debug image, unless they are there.
make_throwaway_key() {
    refuse_empty_key "$1"
    [[ -f "$1" ]] || openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj /CN=throwaway \
        -keyout "$1" -out "$2" 2>/dev/null || key_fail 'openssl could not make a throwaway key.'
}

# A release image ($1 is not 1) needs its PCR key $2, its Secure Boot key $3 and its rollback number $4.
# Without the PCR key it would seal the data disk to PCR 4 and 7 alone; without Secure Boot every update
# asks for the recovery key; without a rollback number an older release would open the disk.
require_release_keys() {
    [[ "$1" == 1 ]] && return 0
    [[ -n "${2:-}" ]] || key_fail 'a release image needs OS_PCR_KEY and OS_PCR_CERT, to sign its expected PCR 11 (OS-KEYS.md).'
    [[ -n "${3:-}" ]] || key_fail 'a release image needs OS_SB_KEY and OS_SB_CERT, to sign for Secure Boot (OS-KEYS.md).'
    [[ "${4:-}" =~ ^[1-9][0-9]{0,8}$ ]] || key_fail 'a release image needs OS_ROLLBACK, a positive integer raised every release (OS-KEYS.md).'
}

# Succeeds only if the private key $1 and the certificate $2 hold the same public key.
check_pcr_key_matches() {
    local from_key from_cert
    refuse_empty_key "$1"
    refuse_empty_key "$2"
    from_key="$(openssl pkey -in "$1" -pubout 2>/dev/null)" || key_fail "key $1 can't be read."
    from_cert="$(openssl x509 -in "$2" -pubkey -noout 2>/dev/null)" || key_fail "certificate $2 can't be read."
    [[ -n "$from_key" && "$from_key" == "$from_cert" ]] || key_fail "key $1 is not the key of certificate $2."
}

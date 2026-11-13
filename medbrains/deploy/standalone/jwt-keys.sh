# shellcheck shell=bash
# JWT signing pair for /etc/medbrains/env, sourced by install.sh.
#
#   JWT_PRIVATE_KEY  base64 PKCS#8 DER (Ed25519)
#   JWT_PUBLIC_KEY   base64 SPKI DER (Ed25519); installs before 2026-11 wrote the
#                    raw 32-byte key, which is still accepted
#
# The server refuses to start on a pair that does not match
# (medbrains-crypto keys::jwt_keys); check_jwt_pair refuses the same pair here
# first, so a bad key stops the install, not a restart days later. openssl
# errors are shown, never discarded: a key step that failed must say why.

# Fixed DER header of an Ed25519 SubjectPublicKeyInfo (RFC 8410 §4): it is
# prepended to a raw 32-byte key to rebuild the SPKI, never cut off one.
JWT_ED25519_SPKI_HEADER='\x30\x2a\x30\x05\x06\x03\x2b\x65\x70\x03\x21\x00'

# Generates a fresh pair into JWT_NEW_PRIVATE / JWT_NEW_PUBLIC (base64).
# shellcheck disable=SC2034 # read by the script that sources this file
generate_jwt_pair() {
    local dir
    dir="$(mktemp -d)"
    openssl genpkey -algorithm Ed25519 -outform DER -out "$dir/priv.der"
    openssl pkey -inform DER -in "$dir/priv.der" -pubout -outform DER -out "$dir/pub.der"
    JWT_NEW_PRIVATE="$(openssl base64 -A -in "$dir/priv.der")"
    JWT_NEW_PUBLIC="$(openssl base64 -A -in "$dir/pub.der")"
    rm -rf "$dir"
}

# Returns 0 only when $1 (private) is an Ed25519 key that derives $2 (public).
check_jwt_pair() {
    local dir rc=0
    dir="$(mktemp -d)"
    printf '%s' "$1" | openssl base64 -d -A > "$dir/priv.der" || rc=1
    printf '%s' "$2" | openssl base64 -d -A > "$dir/pub.bin" || rc=1
    if [[ "$(wc -c < "$dir/pub.bin")" -eq 32 ]]; then
        # shellcheck disable=SC2059 # the header is the format: \x escapes, no input
        { printf "$JWT_ED25519_SPKI_HEADER"; cat "$dir/pub.bin"; } > "$dir/pub.der"
    else
        cp "$dir/pub.bin" "$dir/pub.der"
    fi
    if [[ "$rc" -eq 0 ]]; then
        openssl pkey -inform DER -pubin -in "$dir/pub.der" -noout || rc=1
        openssl pkey -inform DER -in "$dir/priv.der" -pubout -outform DER \
            -out "$dir/derived.der" || rc=1
    fi
    [[ "$rc" -eq 0 ]] && { cmp -s "$dir/derived.der" "$dir/pub.der" || rc=1; }
    rm -rf "$dir"
    return "$rc"
}

# Prints the value of $1 in env file $2 as the server reads it: the text after
# the first '=', with a trailing \r and one pair of surrounding quotes removed.
jwt_env_value() {
    local value
    value="$({ grep "^$1=" "$2" || true; } | tail -n 1 | cut -d= -f2-)"
    value="${value%$'\r'}"
    if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then
        value="${value:1:${#value}-2}"
    fi
    printf '%s' "$value"
}

# Returns 0 when the JWT keys may come from somewhere other than the env
# file: a systemd drop-in (or a file it loads) or the server's config.toml.
# $1 is the drop-in directory, $2 the config.toml path.
jwt_keys_elsewhere() {
    local dropins="$1" toml="$2" files=() f
    for f in "$dropins"/*.conf; do
        [[ -f "$f" ]] || continue
        files+=("$f")
        while IFS= read -r f; do files+=("$f"); done \
            < <(sed -n 's/^EnvironmentFile=-\{0,1\}//p' "$f")
    done
    [[ -f "$toml" ]] && files+=("$toml")
    [[ "${#files[@]}" -gt 0 ]] && grep -qsiE 'jwt_(private|public)_key' "${files[@]}"
}

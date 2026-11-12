#!/usr/bin/env bash
# Runnable check for jwt-keys.sh: a damaged or mismatched JWT pair is refused.
# No framework: bash + asserts. Needs only openssl.
#   bash deploy/standalone/test-jwt-keys.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./jwt-keys.sh
. "$HERE/jwt-keys.sh"

fail=0
# Prints PASS/FAIL for one case; $2 is "accept" or "refuse".
expect() {
    local name="$1" want="$2" got=refuse
    check_jwt_pair "$3" "$4" 2>/dev/null && got=accept
    if [[ "$got" == "$want" ]]; then echo "PASS $name"; else echo "FAIL $name (got $got)"; fail=1; fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

generate_jwt_pair
PRIV="$JWT_NEW_PRIVATE" PUB="$JWT_NEW_PUBLIC"
generate_jwt_pair
OTHER_PUB="$JWT_NEW_PUBLIC"

printf '%s' "$PUB" | openssl base64 -d -A > "$TMP/spki.der"
# The raw key older installs wrote: the 32 bytes after the fixed 12-byte header.
dd if="$TMP/spki.der" of="$TMP/raw.bin" bs=1 skip=12 status=none
RAW_PUB="$(openssl base64 -A -in "$TMP/raw.bin")"
printf '%s' "$PRIV" | openssl base64 -d -A > "$TMP/priv.der"
CUT_PRIV="$(head -c 47 "$TMP/priv.der" | openssl base64 -A)"
CUT_PUB="$(head -c 31 "$TMP/raw.bin" | openssl base64 -A)"

expect "generated pair" accept "$PRIV" "$PUB"
expect "raw 32-byte public key" accept "$PRIV" "$RAW_PUB"
expect "mismatched pair" refuse "$PRIV" "$OTHER_PUB"
expect "public key as the private key" refuse "$PUB" "$PUB"
expect "private key cut by one byte" refuse "$CUT_PRIV" "$PUB"
expect "public key cut to 31 bytes" refuse "$PRIV" "$CUT_PUB"
expect "empty pair" refuse "" ""
exit "$fail"

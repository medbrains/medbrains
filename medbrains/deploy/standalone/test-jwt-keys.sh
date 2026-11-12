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
# Values are read as the server reads them: quotes and a Windows line end go.
printf 'JWT_PRIVATE_KEY="%s"\r\nJWT_PUBLIC_KEY=%s\n' "$PRIV" "'$PUB'" > "$TMP/env"
expect "quoted, CRLF env lines" accept "$(jwt_env_value JWT_PRIVATE_KEY "$TMP/env")" \
    "$(jwt_env_value JWT_PUBLIC_KEY "$TMP/env")"

# Keys set in a drop-in, a file it loads, or config.toml are not overwritten.
mkdir -p "$TMP/d"
elsewhere() { if jwt_keys_elsewhere "$TMP/d" "$TMP/config.toml"; then echo yes; else echo no; fi; }
check() { if [[ "$2" == "$3" ]]; then echo "PASS $1"; else echo "FAIL $1 (got $2)"; fail=1; fi; }
check "missing line reads empty" "$(jwt_env_value JWT_MISSING "$TMP/env")" ""
check "no drop-in, no config.toml" "$(elsewhere)" no
printf '[Service]\nEnvironment=JWT_PRIVATE_KEY=x\n' > "$TMP/d/jwt.conf"
check "key in a drop-in" "$(elsewhere)" yes
printf '[Service]\nEnvironmentFile=-%s\n' "$TMP/extra.env" > "$TMP/d/jwt.conf"
printf 'JWT_PUBLIC_KEY=x\n' > "$TMP/extra.env"
check "key in a file a drop-in loads" "$(elsewhere)" yes
rm "$TMP/d/jwt.conf"
printf 'jwt_private_key = "x"\n' > "$TMP/config.toml"
check "key in config.toml" "$(elsewhere)" yes
exit "$fail"

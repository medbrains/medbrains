#!/usr/bin/env bash
# Checks the image build's key handling (os/build-keys.sh, os/ed25519_der.py) on this machine, with
# openssl and python3 only. Each case would pass a broken key into an image if its check went away.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FAILED=0

# Runs `$3...` in a subshell with the helpers loaded; passes if it exits 0 when $2 is "ok", non-zero if "refused".
case_() {
    local name="$1" want="$2" got=ok
    shift 2
    (source "$HERE/../build-keys.sh" && "$@") >/dev/null 2>&1 || got=refused
    if [[ "$got" == "$want" ]]; then echo "pass  $name"; else echo "FAIL  $name: $got"; FAILED=1; fi
}

# The debug key is made, its public key derived, and a second run keeps the same key.
case_ "a debug update key is made and read by structure" ok make_debug_update_key "$WORK/a.key" "$WORK/a.pub"
first="$(cat "$WORK/a.pub" 2>/dev/null)"
case_ "a second build keeps the key" ok make_debug_update_key "$WORK/a.key" "$WORK/a.pub"
if [[ -n "$first" && "$first" == "$(cat "$WORK/a.pub")" && "$(base64 -d < "$WORK/a.pub" | wc -c | tr -d ' ')" == 32 ]]; then
    echo "pass  the public key is 32 bytes and stable"
else
    echo "FAIL  the public key is 32 bytes and stable"; FAILED=1
fi

: > "$WORK/empty.key"
case_ "an empty key file from a failed run is refused" refused make_debug_update_key "$WORK/empty.key" "$WORK/e.pub"
printf '%s\n' "$(head -c 32 /dev/zero | base64)" > "$WORK/zero.key"
case_ "an all-zero seed is refused" refused make_debug_update_key "$WORK/zero.key" "$WORK/z.pub"
printf 'c2hvcnQ=\n' > "$WORK/short.key"
case_ "a seed that is not 32 bytes is refused" refused make_debug_update_key "$WORK/short.key" "$WORK/s.pub"

# Structure, not length: 48 bytes with another prefix is not a key.
head -c 48 /dev/urandom > "$WORK/random.der"
case_ "DER of the right length but wrong structure is refused" refused python3 -I "$HERE/../ed25519_der.py" private "$WORK/random.der"

case_ "a release image without a PCR key is refused" refused require_release_keys 0 "" "$WORK/s.pem" 3
case_ "a release image without a Secure Boot key is refused" refused require_release_keys 0 "$WORK/k.pem" "" 3
case_ "a release image without a rollback number is refused" refused require_release_keys 0 "$WORK/k.pem" "$WORK/s.pem" ""
case_ "a release image with a rollback number of 0 is refused" refused require_release_keys 0 "$WORK/k.pem" "$WORK/s.pem" 0
case_ "a release image with both keys and a number goes on" ok require_release_keys 0 "$WORK/k.pem" "$WORK/s.pem" 3
case_ "a debug image may go on without them" ok require_release_keys 1 "" "" ""
case_ "a throwaway key is made with its certificate" ok make_throwaway_key "$WORK/t.pem" "$WORK/t.crt"
case_ "a throwaway key matches its certificate" ok check_pcr_key_matches "$WORK/t.pem" "$WORK/t.crt"

openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=a -keyout "$WORK/a.pem" -out "$WORK/a.crt" 2>/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=b -keyout "$WORK/b.pem" -out "$WORK/b.crt" 2>/dev/null
case_ "a PCR key and its own certificate match" ok check_pcr_key_matches "$WORK/a.pem" "$WORK/a.crt"
case_ "a PCR key with another key's certificate is refused" refused check_pcr_key_matches "$WORK/a.pem" "$WORK/b.crt"
: > "$WORK/empty.pem"
case_ "an empty PCR key is refused" refused check_pcr_key_matches "$WORK/empty.pem" "$WORK/a.crt"
exit "$FAILED"

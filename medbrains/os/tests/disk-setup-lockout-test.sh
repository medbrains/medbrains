#!/usr/bin/env bash
# disk-setup's provision_lockout against stubbed tpm2-tools: each password is tried at most once (never an empty
# one when a password is set), and a TPM whose state cannot be read leads to "no PIN", not a silent exit under
# set -e. Runs alone, with no VM or TPM.
set -uo pipefail

SETUP="$(cd "$(dirname "$0")/.." && pwd)/mkosi.extra/usr/lib/medbrains/disk-setup"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"
for tool in tpm2_dictionarylockout tpm2_changeauth; do
    # shellcheck disable=SC2016 # the stub expands these when it runs, not here
    printf '#!/bin/sh\necho "%s $*" >> "$STUB_CALLS"\nexit "${STUB_%s_RC:-0}"\n' "$tool" "${tool#tpm2_}" > "$WORK/bin/$tool"
done
cat > "$WORK/bin/tpm2_getcap" <<'STUB'
#!/bin/sh
[ -n "$STUB_AUTH_SET" ] || exit 1
echo "  lockoutAuthSet:            $STUB_AUTH_SET"
STUB
chmod +x "$WORK/bin/"*
printf 'apple-banana' > "$WORK/key"
failed=0

# Runs provision_lockout once in a fresh shell under disk-setup's own options; prints LOCKOUT_OURS and the calls.
# shellcheck disable=SC2329 # called through declare -f in expect
run() {
    : > "$WORK/calls"
    PATH="$WORK/bin:$PATH" STUB_CALLS="$WORK/calls" bash -c 'set -euo pipefail; source <(sed "/^case /,\$d" "$1")
        provision_lockout "$2" 2>/dev/null; echo "ours=$LOCKOUT_OURS"' _ "$SETUP" "$WORK/key"
    echo "calls=$(awk '{ print $1 ($0 ~ / -p / ? "+auth" : "") }' "$WORK/calls" | tr '\n' ',')"
}

# Compares one run's output with what it must print.
expect() {
    local name="$1" want="$2" got
    shift 2
    got="$(env "$@" bash -c "$(declare -f run); WORK='$WORK' SETUP='$SETUP'; run")"
    got="$(tr '\n' ' ' <<<"$got")"
    if [[ "$got" == "$want" ]]; then echo "pass  $name"; else echo "FAIL  $name: got [$got], want [$want]"; failed=1; fi
}

expect "an unreadable TPM gives no PIN and does not stop setup" "ours=0 calls= " STUB_AUTH_SET=
expect "a new TPM gets the limits, then our password" "ours=1 calls=tpm2_dictionarylockout,tpm2_changeauth, " STUB_AUTH_SET=0
expect "a set password is tried once, ours, with no empty try first" "ours=1 calls=tpm2_dictionarylockout+auth, " STUB_AUTH_SET=1
expect "somebody else's password: one try, then no PIN" "ours=0 calls=tpm2_dictionarylockout+auth, " STUB_AUTH_SET=1 STUB_dictionarylockout_RC=1
expect "a password that will not set: no PIN" "ours=0 calls=tpm2_dictionarylockout,tpm2_changeauth, " STUB_AUTH_SET=0 STUB_changeauth_RC=1
exit "$failed"

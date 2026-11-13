#!/usr/bin/env bash
# Checks disk-setup's `finish` with a stand-in systemd-cryptenroll, so a failure can be forced. No machine
# needed. A failed read must stop first boot and must never record the disk as chosen to be unencrypted.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../mkosi.extra/usr/lib/medbrains/disk-setup"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FAILED=0

# Runs finish with cryptenroll printing $2 and exiting $3; checks the exit status $4 and the record $5.
check() {
    local name="$1" output="$2" code="$3" want_code="$4" want_record="$5" got
    rm -f "$WORK/config/disk-protection"
    mkdir -p "$WORK/bin" "$WORK/config"
    cat > "$WORK/bin/systemd-cryptenroll" <<STUB
#!/bin/sh
[ "\$#" -gt 1 ] && exit 1
printf '%s\n' '$output'
exit $code
STUB
    chmod +x "$WORK/bin/systemd-cryptenroll"
    PATH="$WORK/bin:$PATH" MEDBRAINS_DISK_PART=/dev/null MEDBRAINS_DISK_CONFIG="$WORK/config" \
        bash "$SCRIPT" finish </dev/null >/dev/null 2>&1
    got=$?
    local record=""
    [[ -f "$WORK/config/disk-protection" ]] && record="$(cat "$WORK/config/disk-protection")"
    if [[ "$got" -eq "$want_code" && "$record" == "$want_record" ]]; then
        echo "pass  $name"
    else
        echo "FAIL  $name: exit $got, record '$record'"
        FAILED=1
    fi
}

check "a failed slot read records nothing" "" 1 1 ""
check "an empty-key slot records the choice" "SLOT TYPE
   0 password" 0 0 "unencrypted-chosen"
check "no seal and no choice records nothing" "SLOT TYPE
   1 recovery" 0 1 ""
check "a seal whose recovery key cannot be made records nothing" "SLOT TYPE
   0 tpm2" 0 1 ""

# The recovery key the person types back: all of it, each group its full length, and it must open the
# disk. A stand-in cryptsetup opens only for the right key, or for anything ("any"), so the shape check
# is seen on its own.
KEY=cbdefghi-jklnrtuv-cbdefghi-jklnrtuv-cbdefghi-jklnrtuv-cbdefghi-jklnrtuv
typed() {
    local name="$1" accepts="$2" typed="$3" want="$4" got
    mkdir -p "$WORK/bin" "$WORK/run"
    cat > "$WORK/bin/cryptsetup" <<STUB
#!/bin/bash
for arg; do [[ "\$arg" == --key-file=* ]] && file="\${arg#--key-file=}"; done
[[ "$accepts" == any ]] && exit 0
[[ "\$(cat "\$file")" == "$accepts" ]]
STUB
    chmod +x "$WORK/bin/cryptsetup"
    got=0
    (export PATH="$WORK/bin:$PATH" MEDBRAINS_DISK_PART=/dev/null MEDBRAINS_KEY_DIR="$WORK/run"
        source "$SCRIPT" && typed_key_opens "$typed") >/dev/null 2>&1 || got=1
    if [[ "$got" == "$want" && -z "$(ls -A "$WORK/run")" ]]; then
        echo "pass  $name"
    else
        echo "FAIL  $name: got $got, left $(ls -A "$WORK/run")"
        FAILED=1
    fi
}
typed "the whole key opens" "$KEY" "$KEY" 0
typed "one group is not enough" "$KEY" "cbdefghi" 1
typed "a key that does not open the disk is refused" "$KEY" "${KEY/cbdefghi/cbdefghj}" 1
typed "a group of the wrong length is refused" any "${KEY/cbdefghi/cbdefgh}" 1
typed "a ninth group is refused" any "$KEY-cbdefghi" 1

# A local variable named in an exit trap is unbound by the time the trap runs, which turned a finished
# re-seal into a failure and left the key file behind.
if grep -nE "^ +local .*KEY_FILE|trap .*key_file" "$SCRIPT"; then
    echo "FAIL  the key file's trap uses a local variable"
    FAILED=1
else
    echo "pass  the key file's trap does not use a local variable"
fi
exit "$FAILED"

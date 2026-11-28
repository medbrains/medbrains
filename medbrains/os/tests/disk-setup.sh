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

# A local variable named in an exit trap is unbound by the time the trap runs, which turned a finished
# re-seal into a failure and left the key file behind.
if grep -nE "^ +local .*KEY_FILE|trap .*key_file" "$SCRIPT"; then
    echo "FAIL  the key file's trap uses a local variable"
    FAILED=1
else
    echo "pass  the key file's trap does not use a local variable"
fi

# Runs ask_about_missing_tpm with the debug mark at $2 (present or not) and $3 typed; checks its exit status
# $4, that systemctl ran $5 (or nothing), and that STORE UNENCRYPTED was offered only if $6 is yes.
check_no_tpm() {
    local name="$1" marker="$2" typed="$3" want_code="$4" want_calls="$5" want_offer="$6" got calls out offered=no
    printf '#!/bin/sh\necho "$*" >> "%s/calls"\n' "$WORK" > "$WORK/bin/systemctl"
    chmod +x "$WORK/bin/systemctl"
    : > "$WORK/calls"
    out="$(printf '%b' "$typed" | PATH="$WORK/bin:$PATH" bash -c 'set -euo pipefail; source <(sed "/^case /,\$d" "$1")
        DEBUG_MARKER="$2"; ask_about_missing_tpm' _ "$SCRIPT" "$marker" 2>&1)"
    got=$?
    calls="$(cat "$WORK/calls")"
    grep -q 'STORE UNENCRYPTED and press Enter' <<<"$out" && offered=yes
    if [[ "$got" -eq "$want_code" && "$calls" == "$want_calls" && "$offered" == "$want_offer" ]]; then
        echo "pass  $name"
    else
        echo "FAIL  $name: exit $got, systemctl '$calls', offered $offered"
        FAILED=1
    fi
}

: > "$WORK/debug-image"
check_no_tpm "a release image never offers to store unencrypted" "$WORK/none" 'STORE UNENCRYPTED\nOFF\n' 1 poweroff no
check_no_tpm "a release image with no answer stores nothing" "$WORK/none" '' 1 "" no
check_no_tpm "a debug image may store unencrypted" "$WORK/debug-image" 'STORE UNENCRYPTED\n' 0 "" yes
check_no_tpm "a debug image can still turn off" "$WORK/debug-image" 'OFF\n' 1 poweroff yes
exit "$FAILED"

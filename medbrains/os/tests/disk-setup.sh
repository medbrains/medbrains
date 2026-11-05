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
exit "$FAILED"

#!/usr/bin/env bash
# require-encrypted-data, every answer it can get, with findmnt and lsblk stubbed. Runs alone, with no VM.
set -uo pipefail

GUARD="$(cd "$(dirname "$0")/.." && pwd)/mkosi.extra/usr/lib/medbrains/require-encrypted-data"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/root/usr/lib/medbrains" "$WORK/root/var/lib/medbrains/config"
cat > "$WORK/bin/findmnt" <<'EOF'
#!/bin/sh
[ -n "$STUB_SOURCE" ] && echo "$STUB_SOURCE"
EOF
cat > "$WORK/bin/lsblk" <<'EOF'
#!/bin/sh
[ -n "$STUB_TYPES" ] && printf '%b\n' "$STUB_TYPES"
EOF
chmod +x "$WORK/bin/findmnt" "$WORK/bin/lsblk"
RECORD="$WORK/root/var/lib/medbrains/config/disk-protection"
MARKER="$WORK/root/usr/lib/medbrains/debug-image"
failed=0

# Runs the guard with one state of the world and compares its exit code.
expect() {
    local name="$1" want="$2" source_device="$3" types="$4" record="$5" marker="$6" got
    rm -f "$RECORD" "$MARKER"
    [[ -n "$record" ]] && printf '%s\n' "$record" > "$RECORD"
    [[ "$marker" == yes ]] && touch "$MARKER"
    PATH="$WORK/bin:$PATH" STUB_SOURCE="$source_device" STUB_TYPES="$types" GUARD_ROOT="$WORK/root" GUARD_DATA_PATH=/data \
        bash "$GUARD" >/dev/null 2>&1
    got=$?
    if [[ "$got" == "$want" ]]; then echo "PASS  $name"; else echo "FAIL  $name: exit $got"; failed=1; fi
}

expect "sealed disk starts" 0 /dev/mapper/medbrains-data 'crypt\npart\ndisk' encrypted-tpm2 no
expect "sealed disk with a PIN starts" 0 /dev/mapper/medbrains-data 'crypt\npart\ndisk' encrypted-tpm2-pin no
expect "plain partition refuses" 1 /dev/vda4 'part\ndisk' '' no
expect "plain partition with a stale record refuses" 1 /dev/vda4 'part\ndisk' encrypted-tpm2 no
expect "dm-crypt with an empty key, chosen at setup, refuses" 1 /dev/mapper/medbrains-data 'crypt\npart\ndisk' unencrypted-chosen no
expect "dm-crypt with no record refuses" 1 /dev/mapper/medbrains-data 'crypt\npart\ndisk' '' no
expect "unknown source device refuses" 1 '' '' encrypted-tpm2 no
expect "debug image starts on a plain disk" 0 /dev/vda4 'part\ndisk' '' yes
[[ "$failed" == 0 ]] && echo "ALL PASSED"
exit "$failed"

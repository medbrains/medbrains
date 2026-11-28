#!/usr/bin/env bash
# require-encrypted-data, every answer it can get, with findmnt stubbed and a made-up /sys. Runs alone, with no VM.
# lsblk always fails here, as it does under kanidmd's PrivateDevices (MB-123): the guard must not need it.
set -uo pipefail

GUARD="$(cd "$(dirname "$0")/.." && pwd)/mkosi.extra/usr/lib/medbrains/require-encrypted-data"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin" "$WORK/root/usr/lib/medbrains" "$WORK/root/var/lib/medbrains/config"
cat > "$WORK/bin/findmnt" <<'EOF'
#!/bin/sh
[ -n "$STUB_SOURCE" ] && echo " $STUB_SOURCE"
EOF
cat > "$WORK/bin/lsblk" <<'EOF'
#!/bin/sh
exit 32
EOF
chmod +x "$WORK/bin/findmnt" "$WORK/bin/lsblk"
RECORD="$WORK/root/var/lib/medbrains/config/disk-protection"
MARKER="$WORK/root/usr/lib/medbrains/debug-image"
failed=0
# A made-up /sys/dev/block: 259:4 a plain partition, 254:0 dm-crypt on it, 254:1 LVM on that crypt.
SYS="$WORK/sys/dev/block"
mkdir -p "$SYS/259:4" "$SYS/254:0/dm" "$SYS/254:0/slaves/vda4" "$SYS/254:1/dm" "$SYS/254:1/slaves/dm-0"
echo CRYPT-LUKS2-0123-medbrains-data > "$SYS/254:0/dm/uuid"; echo 259:4 > "$SYS/254:0/slaves/vda4/dev"
echo LVM-abc > "$SYS/254:1/dm/uuid"; echo 254:0 > "$SYS/254:1/slaves/dm-0/dev"

# Runs the guard with one state of the world and compares its exit code.
expect() {
    local name="$1" want="$2" source_device="$3" types="$4" record="$5" marker="$6" got
    rm -f "$RECORD" "$MARKER"
    [[ -n "$record" ]] && printf '%s\n' "$record" > "$RECORD"
    [[ "$marker" == yes ]] && touch "$MARKER"
    PATH="$WORK/bin:$PATH" STUB_SOURCE="$source_device" STUB_TYPES="$types" GUARD_ROOT="$WORK/root" GUARD_SYS="$WORK/sys" GUARD_DATA_PATH=/data \
        bash "$GUARD" >/dev/null 2>&1
    got=$?
    if [[ "$got" == "$want" ]]; then echo "PASS  $name"; else echo "FAIL  $name: exit $got"; failed=1; fi
}

expect "sealed disk starts, with no lsblk" 0 254:0 '' encrypted-tpm2 no
expect "sealed disk with a PIN starts" 0 254:0 '' encrypted-tpm2-pin no
expect "LVM on a sealed disk starts" 0 254:1 '' encrypted-tpm2 no
expect "plain partition refuses" 1 259:4 '' '' no
expect "plain partition with a stale record refuses" 1 259:4 '' encrypted-tpm2 no
expect "dm-crypt with an empty key, chosen at setup, refuses" 1 254:0 '' unencrypted-chosen no
expect "dm-crypt with no record refuses" 1 254:0 '' '' no
expect "unknown source device refuses" 1 '' '' encrypted-tpm2 no
expect "a device sysfs does not know refuses" 1 8:0 '' encrypted-tpm2 no
expect "debug image starts on a plain disk" 0 259:4 '' '' yes
[[ "$failed" == 0 ]] && echo "ALL PASSED"
exit "$failed"

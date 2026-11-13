#!/usr/bin/env bash
# Converts the release .raw into the disk formats hypervisors and clouds take, all from the same bytes:
#
#   ./formats.sh <image.raw> <name> <arch> <out-dir>
#
#   <name>.qcow2          Proxmox, KVM, libvirt (both arches)
#   <name>.vmdk           VMware (stream-optimised; also the AWS import-snapshot file) x86-64 only
#   <name>.ova            VMware ESXi / Workstation / Fusion: UEFI, 4 vCPU, 4 GB      x86-64 only
#   <name>.vhdx           Hyper-V generation 2 (UEFI)                                 x86-64 only
#   <name>-azure.vhd.zst  Azure: fixed-size VHD, size a whole number of MiB           x86-64 only
#
# <name> is medbrains-os-<version>-<arch>[-unsigned]. Needs qemu-img (qemu-utils), tar, zstd, sha256sum.
# A file over GitHub's 2 GiB limit per release file stops the build here, not at upload. os/README.md
# "Virtual machines and clouds" says which file to use where and what each hypervisor needs for the TPM.
set -euo pipefail

RAW="$1"
NAME="$2"
ARCH="$3"
OUT="$4"
HERE="$(cd "$(dirname "$0")" && pwd)"
MAX_RELEASE_FILE=$((2 * 1024 * 1024 * 1024 - 1))
MIB=1048576
mkdir -p "$OUT"

# Writes the OVA: the OVF descriptor first (the format requires it), then a SHA-256 manifest, then the disk.
make_ova() {
    local vmdk="$1" work disk_bytes capacity
    work="$(mktemp -d)"
    cp "$vmdk" "$work/$NAME.vmdk"
    disk_bytes=$(stat -c %s "$work/$NAME.vmdk" 2>/dev/null || stat -f %z "$work/$NAME.vmdk")
    capacity=$(stat -c %s "$RAW" 2>/dev/null || stat -f %z "$RAW")
    sed -e "s/@NAME@/$NAME/g" -e "s/@DISK_BYTES@/$disk_bytes/" -e "s/@CAPACITY@/$capacity/" \
        "$HERE/medbrains-os.ovf" > "$work/$NAME.ovf"
    (cd "$work" && for f in "$NAME.ovf" "$NAME.vmdk"; do
        printf 'SHA256(%s)= %s\n' "$f" "$(sha256sum "$f" | cut -d' ' -f1)"
    done > "$NAME.mf")
    tar -cf "$OUT/$NAME.ova" --format=ustar -C "$work" "$NAME.ovf" "$NAME.mf" "$NAME.vmdk"
    rm -rf "$work"
}

# Writes the Azure VHD: fixed size, the virtual size a whole number of MiB, as Azure requires. The .raw is
# not (the backup GPT follows the last partition), so a padded copy is converted; the padding is zeros.
make_azure_vhd() {
    local bytes src="$RAW" work
    bytes=$(stat -c %s "$RAW" 2>/dev/null || stat -f %z "$RAW")
    work="$(mktemp -d)"
    if (( bytes % MIB != 0 )); then
        src="$work/disk.raw"
        cp "$RAW" "$src"
        truncate -s $(( (bytes / MIB + 1) * MIB )) "$src"
    fi
    qemu-img convert -U -f raw -O vpc -o subformat=fixed,force_size=on "$src" "$work/$NAME-azure.vhd"
    zstd -q -T0 -19 --rm "$work/$NAME-azure.vhd" -o "$OUT/$NAME-azure.vhd.zst"
    rm -rf "$work"
}

# Refuses a file GitHub would refuse.
check_release_sizes() {
    local f bytes
    for f in "$OUT"/*; do
        bytes=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")
        if (( bytes > MAX_RELEASE_FILE )); then
            echo "$f is $bytes bytes: over GitHub's 2 GiB limit for a release file" >&2
            exit 1
        fi
    done
}

qemu-img convert -U -c -f raw -O qcow2 "$RAW" "$OUT/$NAME.qcow2"
if [[ "$ARCH" == x86-64 ]]; then
    qemu-img convert -U -f raw -O vmdk -o subformat=streamOptimized "$RAW" "$OUT/$NAME.vmdk"
    make_ova "$OUT/$NAME.vmdk"
    qemu-img convert -U -f raw -O vhdx -o subformat=dynamic "$RAW" "$OUT/$NAME.vhdx"
    make_azure_vhd
fi
check_release_sizes
ls -l "$OUT"

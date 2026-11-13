#!/usr/bin/env bash
# Builds the MedBrains OS installer .iso: boots from a USB stick or a DVD (UEFI, x86-64 or arm64) and
# writes the release image to a disk the operator names (os/installer/).
#
#   ./build-iso.sh --arch x86-64|arm64 --image medbrains-os-<ver>-<arch>.raw.zst --out <file.iso>
#
# The image goes onto the ISO as it is, so the disk the installer writes is the release .raw byte for byte,
# with its PCR-signed boot file untouched. The installer itself is one boot file built by mkosi (Format=uki).
# OS_SB_KEY and OS_SB_CERT, if set, sign that boot file for UEFI Secure Boot. The ISO is a hybrid: El Torito
# for a DVD and a GPT with an EFI partition for a USB stick. mkosi has no ISO output, so xorriso wraps it.
#
# Runs directly on Linux (root, plus xorriso, dosfstools, mtools and zstd); on a Mac in the builder container.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ARCH=""
IMAGE=""
OUT=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --arch) ARCH="$2"; shift 2 ;;
        --image) IMAGE="$2"; shift 2 ;;
        --out) OUT="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done
case "$ARCH" in
    x86-64) BOOT_FILE=BOOTX64.EFI; PLATFORM=linux/amd64 ;;
    arm64) BOOT_FILE=BOOTAA64.EFI; PLATFORM=linux/arm64 ;;
    *) echo "--arch x86-64|arm64" >&2; exit 2 ;;
esac
[[ -f "$IMAGE" && "$IMAGE" == *.raw.zst ]] || { echo "--image must be a .raw.zst" >&2; exit 2; }
[[ -n "$OUT" ]] || { echo "--out <file.iso>" >&2; exit 2; }
IMAGE="$(cd "$(dirname "$IMAGE")" && pwd)/$(basename "$IMAGE")"
OUT_DIR="$(mkdir -p "$(dirname "$OUT")" && cd "$(dirname "$OUT")" && pwd)"
OUT_NAME="$(basename "$OUT")"
OS_WORK="${OS_WORK:-/tmp/mb-osimage}"
CACHE="$OS_WORK/cache-installer-$ARCH"
mkdir -p "$CACHE"

# Builds the installer boot file and the ISO in one Linux environment. Arguments: the installer config,
# the image, the output folder and name, the cache. Runs as root.
assemble() {
    local src="$1" image="$2" out_dir="$3" out_name="$4" cache="$5" work size sha esp_mib
    shift 5
    work="$(mktemp -d)"
    cp -R "$src" "$work/installer"
    (cd "$work/installer" && mkosi --architecture "$ARCH" --output-directory "$work/out" \
        --cache-directory "$cache" "$@" -f build)
    # What the installer checks the written disk against: the size and SHA-256 of the uncompressed image.
    size=$(zstd -dc "$image" | wc -c)
    sha=$(zstd -dc "$image" | sha256sum | cut -d' ' -f1)
    mkdir -p "$work/iso/medbrains"
    ln "$image" "$work/iso/medbrains/medbrains-os.raw.zst" 2>/dev/null || cp "$image" "$work/iso/medbrains/medbrains-os.raw.zst"
    printf '%s %s\n' "$size" "$sha" > "$work/iso/medbrains/image.info"
    # The EFI partition: the installer's boot file at the removable-media path, with room to spare.
    esp_mib=$(( $(stat -c %s "$work/out/medbrains-installer.efi") / 1048576 + 8 ))
    truncate -s "${esp_mib}M" "$work/esp.img"
    mkfs.vfat -n MBINSTALL "$work/esp.img" >/dev/null
    mmd -i "$work/esp.img" ::/EFI ::/EFI/BOOT
    mcopy -i "$work/esp.img" "$work/out/medbrains-installer.efi" "::/EFI/BOOT/$BOOT_FILE"
    xorriso -as mkisofs -iso-level 3 -V MEDBRAINS_INSTALL -o "$out_dir/$out_name" \
        -partition_offset 16 -append_partition 2 0xef "$work/esp.img" -appended_part_as_gpt \
        -e --interval:appended_partition_2:all:: -no-emul-boot "$work/iso"
    rm -rf "$work"
}

SB_ARGS=()
SB_MOUNTS=()
if [[ -n "${OS_SB_KEY:-}" ]]; then
    SB_ARGS=(--secure-boot yes --secure-boot-key "$OS_SB_KEY" --secure-boot-certificate "$OS_SB_CERT")
    SB_MOUNTS=(-v "$OS_SB_KEY:$OS_SB_KEY:ro" -v "$OS_SB_CERT:$OS_SB_CERT:ro")
fi

if [[ "$(uname -s)" == Linux ]]; then
    assemble "$HERE/installer" "$IMAGE" "$OUT_DIR" "$OUT_NAME" "$CACHE" ${SB_ARGS[@]+"${SB_ARGS[@]}"}
else
    # The builder runs natively, as in build.sh; --architecture picks the installer's architecture.
    [[ "$(uname -m)" == arm64 ]] && PLATFORM=linux/arm64
    docker build -q --platform "$PLATFORM" -t "medbrains-os-builder:${PLATFORM#linux/}" \
        -f "$HERE/builder.Dockerfile" "$HERE" >/dev/null
    docker run --rm --privileged --platform "$PLATFORM" -v /var/tmp \
        -v "$HERE/installer:/src:ro" -v "$IMAGE:/image.raw.zst:ro" -v "$OUT_DIR:/out" -v "$CACHE:/cache" \
        ${SB_MOUNTS[@]+"${SB_MOUNTS[@]}"} -e ARCH="$ARCH" -e BOOT_FILE="$BOOT_FILE" \
        "medbrains-os-builder:${PLATFORM#linux/}" \
        bash -c "set -euo pipefail; $(declare -f assemble); assemble /src /image.raw.zst /out \"\$0\" /cache \"\$@\"" \
        "$OUT_NAME" ${SB_ARGS[@]+"${SB_ARGS[@]}"}
fi
ls -lh "$OUT_DIR/$OUT_NAME"

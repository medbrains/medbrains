#!/usr/bin/env bash
# Boots a built arm64 image under Apple Virtualization, through UTM, as the VM "MedBrains Dev".
# It touches no other VM, and refuses to replace this one while it is running.
#
#   ./utm-run.sh [--small] [path/to/image.raw]    # a fresh box from the image
#   ./utm-run.sh --serial                         # print the serial port's path
#   ./utm-run.sh --stop                           # stop it
#
# The display is 2880x1800 at 220 PPI, which is what makes it sharp on a Retina Mac: the shell
# gets real pixels and scales itself by 2. --small gives 1920x1200 at 80 PPI, which macOS upscales.
# A debug image gives a root shell on the serial port: OS_SERIAL=<path> os/tests/vm.py sh '...'.
set -euo pipefail

NAME="MedBrains Dev"
UTMCTL=/Applications/UTM.app/Contents/MacOS/utmctl
BUNDLE="$HOME/Library/Containers/com.utmapp.UTM/Data/Documents/$NAME.utm"
OS_WORK="${OS_WORK:-/tmp/mb-osimage-shell}"
DISK_GB=32

# Prints this VM's status, or nothing if UTM doesn't know it.
vm_status() {
    "$UTMCTL" status "$NAME" 2>/dev/null || true
}

# Prints the path of the VM's serial port once it has one.
serial_path() {
    osascript -e "tell application \"UTM\" to get address of item 1 of (serial ports of virtual machine named \"$NAME\")"
}

case "${1:-}" in
    --serial) serial_path; exit 0 ;;
    --stop) "$UTMCTL" stop "$NAME"; exit 0 ;;
esac

WIDTH=2880 HEIGHT=1800 PPI=220
if [[ "${1:-}" == --small ]]; then
    WIDTH=1920 HEIGHT=1200 PPI=80
    shift
fi
IMAGE="${1:-$(ls -t "$OS_WORK"/out-arm64/medbrains-os*.raw | head -1)}"

STATUS="$(vm_status)"
if [[ "$STATUS" == started ]]; then
    echo "$NAME is running: $0 --stop first" >&2
    exit 1
fi
if [[ -n "$STATUS" ]]; then
    "$UTMCTL" delete "$NAME"
fi

mkdir -p "$BUNDLE/Data"
cp -c "$IMAGE" "$BUNDLE/Data/disk.img"
truncate -s "${DISK_GB}G" "$BUNDLE/Data/disk.img"
cat > "$BUNDLE/config.json" <<JSON
{
  "Backend": "Apple", "ConfigurationVersion": 4,
  "Display": [{ "DynamicResolution": false, "HeightPixels": $HEIGHT, "PixelsPerInch": $PPI, "WidthPixels": $WIDTH }],
  "Drive": [{ "Identifier": "$(uuidgen)", "ImageName": "disk.img", "Nvme": false, "ReadOnly": false }],
  "Information": { "IconCustom": false, "Name": "$NAME", "UUID": "$(uuidgen)" },
  "Network": [{ "MacAddress": "62:0c:a0:8a:e7:47", "Mode": "Shared" }],
  "Serial": [{ "Mode": "Ptty" }],
  "System": { "Architecture": "aarch64", "CPUCount": 4, "MemorySize": 4096,
              "Boot": { "EfiVariableStoragePath": "efi_vars.fd", "OperatingSystem": "Linux", "SecureBoot": false, "UEFIBoot": true } },
  "Virtualization": { "Audio": false, "AudioInput": false, "Balloon": true, "ClipboardSharing": false, "Entropy": true, "Keyboard": "Generic", "Pointer": "Mouse" }
}
JSON
plutil -convert xml1 -o "$BUNDLE/config.plist" "$BUNDLE/config.json"
rm "$BUNDLE/config.json"

open -a UTM "$BUNDLE"
for _ in $(seq 30); do
    [[ -n "$(vm_status)" ]] && break
    sleep 1
done
"$UTMCTL" start "$NAME"
echo "serial: $(serial_path)"

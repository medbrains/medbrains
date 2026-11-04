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

# UTM's AppleScript makes the disk's copy and the EFI store, which nothing else can create, but
# leaves the keyboard and pointer off and has no way to set them or the display. Those are only in
# the bundle's plist, which UTM reads at launch, so it must quit; never while another VM runs.
if "$UTMCTL" list | awk 'NR > 1 && $2 != "stopped"' | grep -q .; then
    echo "another VM is running in UTM; stop it first, because this has to quit UTM" >&2
    exit 1
fi
osascript <<APPLESCRIPT
tell application "UTM"
    make new virtual machine with properties {backend:apple, configuration:{name:"$NAME", memory:4096, cpu cores:4, os:linux, drives:{{source:POSIX file "$IMAGE", removable:false}}, network interfaces:{{mode:shared}}, displays:{{dynamic resolution:false}}}}
    quit
end tell
APPLESCRIPT
while pgrep -x UTM >/dev/null; do sleep 1; done

PLIST="$BUNDLE/config.plist"
for setting in "Virtualization:Keyboard Generic" "Virtualization:Pointer Mouse" \
    "Display:0:WidthPixels $WIDTH" "Display:0:HeightPixels $HEIGHT" "Display:0:PixelsPerInch $PPI"; do
    /usr/libexec/PlistBuddy -c "Set :$setting" "$PLIST"
done
/usr/libexec/PlistBuddy -c "Print :Serial:0" "$PLIST" >/dev/null 2>&1 ||
    /usr/libexec/PlistBuddy -c "Add :Serial:0 dict" -c "Add :Serial:0:Mode string Ptty" "$PLIST"
truncate -s "${DISK_GB}G" "$BUNDLE/Data/$(/usr/libexec/PlistBuddy -c 'Print :Drive:0:ImageName' "$PLIST")"

open -a UTM
until "$UTMCTL" status "$NAME" >/dev/null 2>&1; do sleep 1; done
"$UTMCTL" start "$NAME"
echo "serial: $(serial_path)"

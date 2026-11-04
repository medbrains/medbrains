#!/usr/bin/env bash
# Boots a built image in QEMU on an Apple-silicon Mac (or arm64 Linux with KVM).
#
#   ./qemu-run.sh [--fresh] [path/to/image.raw]
#
# The image stays untouched: the VM writes to a 32 GB qcow2 overlay, which is
# what first boot grows the data partition into. --fresh discards the overlay
# (a brand-new box); without it, a reboot keeps its data.
#
#   Web:     https://localhost:8443  (OS_WEB_PORT to change it)
#   Serial:  $OS_WORK/vm/serial.sock   (socat -,raw,echo=0 UNIX:<path>)
#   Monitor: $OS_WORK/vm/monitor.sock  (screendump /path/to/shot.png -f png)
#   Screen:  $OS_WORK/vm/vnc.sock; size OS_SCREEN_W x OS_SCREEN_H (1280x800)
#   Input:   $OS_WORK/vm/qmp.sock (QMP send-key, input-send-event)
#   OS_SECOND_NIC=1 adds a second wired link, for choosing between them.
set -euo pipefail

OS_WORK="${OS_WORK:-/tmp/mb-osimage}"
VM="$OS_WORK/vm"
if [[ "${1:-}" == "--fresh" ]]; then
    rm -rf "$VM"
    shift
fi
IMAGE="${1:-$(ls -t "$OS_WORK"/out-arm64/medbrains-os*.raw | head -1)}"
mkdir -p "$VM"

QEMU_SHARE="$(dirname "$(dirname "$(command -v qemu-system-aarch64)")")/share/qemu"
[[ -f "$VM/vars.fd" ]] || cp "$QEMU_SHARE/edk2-arm-vars.fd" "$VM/vars.fd"
[[ -f "$VM/disk.qcow2" ]] || qemu-img create -q -f qcow2 -F raw -b "$IMAGE" "$VM/disk.qcow2" 32G

case "$(uname -s)" in
    Darwin) ACCEL=hvf ;;
    *) ACCEL=kvm ;;
esac

exec qemu-system-aarch64 \
    -machine virt -accel "$ACCEL" -cpu host -smp 4 -m 4096 \
    -drive "if=pflash,format=raw,readonly=on,file=$QEMU_SHARE/edk2-aarch64-code.fd" \
    -drive "if=pflash,format=raw,file=$VM/vars.fd" \
    -drive "if=virtio,format=qcow2,file=$VM/disk.qcow2" \
    -device "virtio-gpu-pci,xres=${OS_SCREEN_W:-1280},yres=${OS_SCREEN_H:-800}" -device qemu-xhci -device usb-kbd -device usb-tablet \
    -device i6300esb \
    -netdev "user,id=net0,hostfwd=tcp:127.0.0.1:${OS_WEB_PORT:-8443}-:443" -device virtio-net-pci,netdev=net0 \
    ${OS_SECOND_NIC:+-netdev user,id=net1,net=10.0.3.0/24 -device virtio-net-pci,netdev=net1} \
    -display none -vnc "unix:$VM/vnc.sock" \
    -serial "unix:$VM/serial.sock,server,nowait" \
    -monitor "unix:$VM/monitor.sock,server,nowait" \
    -qmp "unix:$VM/qmp.sock,server,nowait"

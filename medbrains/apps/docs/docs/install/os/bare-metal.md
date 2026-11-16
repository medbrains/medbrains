---
title: Install on a physical machine
sidebar_label: Physical machine (ISO)
sidebar_position: 2
description: "Install MedBrains OS on a physical server or mini PC from a USB stick or DVD with the installer ISO, or write the raw image straight to its disk."
---

# Install on a physical machine

**Who:** the IT person installing the hospital's main machine.
**You need:** the machine (see [what it needs](/install/os/)), a USB stick of
8 GB or more, another computer to write the stick, and the `.iso` for your
machine, [verified](/install/verify-a-download/).

The installer erases one disk you name. It never touches the stick it runs
from.

## 1. Write the installer to a USB stick

On Linux, find the stick's name first (`lsblk`), then write it. Writing to the
wrong name erases that disk.

```bash
lsblk -o NAME,SIZE,MODEL,TRAN
sudo dd if=medbrains-os-v3.33.0-x86-64.iso of=/dev/sdX bs=4M conv=fsync status=progress
```

On Windows, use [Rufus](https://rufus.ie) and choose **DD Image mode** when
asked. On macOS, use `diskutil list` to find the stick, then
`sudo dd if=medbrains-os-v3.33.0-x86-64.iso of=/dev/rdiskN bs=4m`.

A DVD works too: burn the `.iso` as a disc image.

## 2. Set the firmware

In the machine's firmware settings (often F2, F10, F12 or Del at power on):

1. Turn on **TPM 2.0** (it may be called PTT on Intel or fTPM on AMD).
2. Turn **Secure Boot off**.
3. Make sure the machine starts in **UEFI** mode.

## 3. Run the installer

Start the machine from the stick (from the UEFI boot menu).

1. The installer reads the whole stick and checks its SHA-256. A damaged
   stick is refused here, before any disk is offered.
2. It lists the machine's disks with size, model, bus and serial number.
   Type the disk's name, for example `nvme0n1`.
3. Type `ERASE nvme0n1` exactly. Any other answer writes nothing and goes
   back to the list.
4. It writes the image, reads it back and compares the checksum. Then it
   makes that disk the first boot entry, called **MedBrains OS**.
5. **Expected:** it says it will restart in 15 seconds. Take the stick out.

The installer also works on a serial console (`ttyS0`, or `ttyAMA0` on arm64).

## Without the installer: write the disk directly

If you can take the disk out, write the raw image from another Linux computer:

```bash
zstd -d medbrains-os-v3.33.0-x86-64.raw.zst
sudo dd if=medbrains-os-v3.33.0-x86-64.raw of=/dev/sdX bs=4M conv=fsync status=progress
```

## Check it worked

The machine shows its firmware logo, then the MedBrains logo, then the first
setup screen. Go on to [first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| The machine does not start from the stick | Pick the stick in the UEFI boot menu. Check the firmware is in UEFI mode. On Windows, rewrite the stick in Rufus **DD** mode, not ISO mode |
| The installer refuses the medium | The stick is damaged or the copy is incomplete. Rewrite it, or use another stick |
| Your disk is not listed | It is in use (part of RAID, LVM or encryption), read-only, or smaller than 4.5 GB. Disks inside a hardware RAID show as one disk |
| `Security Violation` at start | Secure Boot is on. Turn it off |
| After install, the old system starts | Pick **MedBrains OS** in the boot menu, or move it to the top of the boot order |

**Deeper:** how the installer pins and checks the disk is in
[`os/README.md`, "Installer"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#installer-iso-on-a-physical-machine).

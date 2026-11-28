---
title: Install on arm64 and Raspberry Pi
sidebar_label: arm64 and Raspberry Pi
sidebar_position: 8
description: "Run MedBrains OS on arm64 servers and boards with UEFI firmware. The Raspberry Pi 5 path, with UEFI firmware and an NVMe disk, is not yet tested."
---

# Install on arm64 and Raspberry Pi

**Who:** the IT person installing on an ARM machine.
**You need:** an arm64 machine with **UEFI firmware** and a TPM 2.0, an NVMe
or SSD disk, and the arm64 file, [verified](/install/verify-a-download/).

## arm64 servers and boards with UEFI

These work like any physical machine. Use the
[physical machine guide](/install/os/bare-metal/) with
`medbrains-os-v3.33.0-arm64.iso`, or write
`medbrains-os-v3.33.0-arm64.raw.zst` to the disk. The installer's serial
console is `ttyAMA0`.

## Raspberry Pi 5

:::caution Not tested on real hardware
The Pi 5 does not boot UEFI out of the box, and the Debian kernel's Pi 5
support is partial. Until a Pi image ships, this path is for trials only.
:::

1. Install community UEFI firmware for the Pi 5 on a small SD card or in the
   EEPROM. The SD card holds only firmware, never data.
2. Put the NVMe disk in a USB enclosure and connect it to a Linux computer.
   Find its name with `lsblk`, then write the image:

   ```bash
   zstd -d medbrains-os-v3.33.0-arm64.raw.zst
   sudo dd if=medbrains-os-v3.33.0-arm64.raw of=/dev/sdX bs=4M conv=fsync status=progress
   ```

3. Fit the NVMe to the Pi with an NVMe HAT, fit **active cooling**, and start
   it.

**NVMe only.** SD cards are not supported for data: a database wears them
out, and a worn card corrupts clinical records. The Pi 5 has no TPM, so setup
will ask whether to carry on unencrypted unless you fit a TPM module.

## Check it worked

The screen shows the MedBrains logo, then the first setup screen. Go on to
[first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| A rainbow screen, or nothing after the firmware | The UEFI firmware is missing or old. Reinstall it |
| The disk is not found | Check the NVMe HAT and that the firmware boots from NVMe |
| The board throttles or restarts under load | Fit active cooling and the official 27 W power supply |

**Deeper:** [`os/README.md`, "Flash to a Raspberry Pi 5"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#flash-to-a-raspberry-pi-5).

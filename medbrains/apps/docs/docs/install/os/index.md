---
title: Install MedBrains OS
sidebar_label: Which file to use
sidebar_position: 1
description: "MedBrains OS is one image in many formats. Pick the file for your machine, hypervisor or cloud, check hardware, TPM and Secure Boot, then install."
---

# Install MedBrains OS

**Who:** the IT person who installs the hospital's main machine.

MedBrains OS is one disk image with everything inside: the operating system,
PostgreSQL, the MedBrains server and a screen that opens MedBrains. Every
format below holds the same image, so it behaves the same everywhere.

## What the machine needs

| | Minimum |
|---|---|
| Processor | 4 cores, x86-64 (Intel or AMD) or arm64 |
| Memory | 4 GB |
| Disk | 64 GB SSD or NVMe. The image needs 4.5 GB; first boot gives the rest to patient data. **No SD cards** |
| Firmware | UEFI. Legacy BIOS does not work |
| Security chip | **TPM 2.0**, real or virtual. It encrypts the patient data on the disk |
| Network | a cable. Internet is not needed |

**Intel and AMD machines both use the `x86-64` files.**

## Pick your file

Change `3.33.0` to the version you install. Every file is on the
[release page](https://github.com/medbrains/medbrains/releases).

| Where it runs | File | Guide |
|---|---|---|
| A physical machine, from a USB stick or DVD | `medbrains-os-v3.33.0-x86-64.iso` or `-arm64.iso` | [Physical machine](/install/os/bare-metal/) |
| A physical machine, written straight to its disk | `medbrains-os-v3.33.0-x86-64.raw.zst` or `-arm64.raw.zst` | [Physical machine](/install/os/bare-metal/) |
| Proxmox VE, KVM, libvirt, OpenStack | `medbrains-os-v3.33.0-x86-64.qcow2` or `-arm64.qcow2` | [Proxmox and KVM](/install/os/proxmox-kvm/) |
| VMware ESXi, vSphere, Workstation, Fusion (Intel Mac) | `medbrains-os-v3.33.0-x86-64.ova` | [VMware](/install/os/vmware/) |
| Microsoft Hyper-V | `medbrains-os-v3.33.0-x86-64.vhdx` | [Hyper-V](/install/os/hyper-v/) |
| Amazon Web Services | `medbrains-os-v3.33.0-x86-64.vmdk`; arm64 uses the `.raw.zst` | [AWS](/install/os/aws/) |
| Microsoft Azure | `medbrains-os-v3.33.0-x86-64-azure.vhd.zst` | [Azure](/install/os/azure/) |
| Raspberry Pi 5 and arm64 boards | `medbrains-os-v3.33.0-arm64.raw.zst` | [arm64 and Raspberry Pi](/install/os/arm64-raspberry-pi/) |

[Verify the file](/install/verify-a-download/) before you use it. A file
whose name ends in `-unsigned` is for trials only.

## Two settings to get right first

- **TPM 2.0 on.** Without it, setup stops before it stores anything and asks
  whether to carry on unencrypted. Turn the TPM on, or give the virtual
  machine a virtual TPM, before the first start.
- **Secure Boot off.** The image is not yet signed for Secure Boot. Decide
  before the first start: the disk is sealed to the boot settings then, and
  changing Secure Boot later makes the machine ask for the recovery key.

## After the install

Every guide ends at the first start. Then follow
[first boot and the recovery key](/admin/first-boot/).

**Deeper:** the image, its formats and its disk layout are described in
[`os/README.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md)
and [OS setup and trust](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-SETUP-AND-TRUST.md).

---
title: Install on VMware
sidebar_label: VMware (OVA)
sidebar_position: 4
description: "Deploy MedBrains OS on VMware ESXi, vSphere, Workstation or Fusion from the OVA, add a virtual TPM, turn off Secure Boot and grow the disk first."
---

# Install on VMware

**Who:** the person who runs the hospital's VMware estate.
**You need:** ESXi 7.0 U2 or later (or Workstation 16.2 / Fusion 12.2 on an
Intel Mac), and `medbrains-os-v3.33.0-x86-64.ova`,
[verified](/install/verify-a-download/).

The OVA asks for UEFI firmware, 4 vCPU, 4 GB, a SATA disk and a VMXNET3 card.
Its virtual hardware is version 19.

## 1. Deploy the template

- **vSphere:** *Deploy OVF Template*, then pick the `.ova`.
- **Workstation or Fusion:** *File > Open*, then pick the `.ova`.

Do not start the VM yet.

## 2. Add a virtual TPM

A virtual TPM needs VM encryption.

- **vSphere:** set up a key provider first (the built-in **Native Key
  Provider** is enough). Then *Edit Settings > Add New Device > Trusted
  Platform Module*.
- **Workstation or Fusion:** turn on the VM's *Encryption* setting, then add a
  *Trusted Platform Module*.

## 3. Turn off Secure Boot and grow the disk

1. *VM Options > Boot Options*: clear **Secure Boot**.
2. Grow the hard disk to 64 GB or more.
3. Start the VM.

## Check it worked

The console shows the MedBrains logo, then the first setup screen. Go on to
[first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| "Unsupported hardware version 19" | The host is older than ESXi 7.0 U2. Upgrade it, or use the `.vmdk` on a newer host |
| *Trusted Platform Module* is greyed out | No key provider (vSphere) or encryption is off (Workstation, Fusion) |
| A Secure Boot error at start | Clear **Secure Boot** in *Boot Options* |
| Attaching the `.vmdk` alone fails | It is stream-optimised. On ESXi convert it first: `vmkfstools -i medbrains-os-v3.33.0-x86-64.vmdk -d thin medbrains.vmdk` |

**Deeper:** [`os/README.md`, "VMware"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#vmware-ova).

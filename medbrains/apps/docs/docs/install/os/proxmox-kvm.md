---
title: Install on Proxmox, KVM or libvirt
sidebar_label: Proxmox and KVM (qcow2)
sidebar_position: 3
description: "Run MedBrains OS as a virtual machine on Proxmox VE, KVM or libvirt from the qcow2 image, with UEFI, a virtual TPM 2.0 and a disk grown before first start."
---

# Install on Proxmox, KVM or libvirt

**Who:** the person who runs the hospital's hypervisor.
**You need:** shell access to the Proxmox node or KVM host, and the
`medbrains-os-v3.33.0-x86-64.qcow2` file (or `-arm64.qcow2`),
[verified](/install/verify-a-download/), copied onto it.

## Proxmox VE

1. Create a VM in the web interface with:
   - **BIOS:** OVMF (UEFI), **Machine:** q35;
   - an **EFI disk without pre-enrolled keys** (pre-enrolled keys turn on
     Secure Boot);
   - **TPM state**, version **v2.0**;
   - 4 cores, 4 GB memory, and **no disk**.
2. Import the image, attach it and grow it. Replace `100` with your VM ID and
   `local-lvm` with your storage:

   ```bash
   qm disk import 100 medbrains-os-v3.33.0-x86-64.qcow2 local-lvm
   qm set 100 --virtio0 local-lvm:vm-100-disk-1 --boot order=virtio0
   qm disk resize 100 virtio0 +60G
   ```

   `qm disk import` prints the name of the disk it made. Use that name in
   `qm set`.
3. Start the VM and open its console.

## KVM with libvirt

```bash
qemu-img resize medbrains-os-v3.33.0-x86-64.qcow2 64G
virt-install --name medbrains --memory 4096 --vcpus 4 \
  --boot uefi --tpm emulator,model=tpm-crb,version=2.0 \
  --disk medbrains-os-v3.33.0-x86-64.qcow2,bus=virtio \
  --import --os-variant debian12 --network network=default
```

`--tpm emulator` needs `swtpm` installed on the host.

## Check it worked

The console shows the MedBrains logo, then the first setup screen. Go on to
[first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| `BdsDxe: failed to load Boot0001` or a UEFI shell | The VM is not booting the imported disk. Set it first in the boot order |
| `Access Denied` or a Secure Boot error | The EFI disk has pre-enrolled keys. Remove it and add one without them |
| Setup stops and asks about a TPM | Add **TPM state v2.0** (Proxmox) or `--tpm` (libvirt), then start again |
| Data partition is tiny | The disk was not grown before the first start. Grow it and reinstall; first boot only grows into free space once |

**Deeper:** [`os/README.md`, "Install and run"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#install-and-run).

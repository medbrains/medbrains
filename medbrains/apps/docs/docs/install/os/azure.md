---
title: Install on Microsoft Azure
sidebar_label: Azure (VHD)
sidebar_position: 7
description: "Upload MedBrains OS to Azure as a page blob, make a generation 2 Trusted Launch disk with a virtual TPM, then create the VM and finish setup."
---

# Install on Microsoft Azure

**Who:** the person who runs the hospital's Azure subscription.
**You need:** the Azure CLI (`az login` done), `azcopy`, a storage account and
container with a SAS token, a resource group, and
`medbrains-os-v3.33.0-x86-64-azure.vhd.zst`, [verified](/install/verify-a-download/).

## 1. Unpack

Azure takes only an uncompressed, fixed-size VHD. This file already is one,
once unpacked:

```bash
zstd -d medbrains-os-v3.33.0-x86-64-azure.vhd.zst
```

## 2. Upload and make a disk

Change `myaccount`, `images`, `my-rg` and the SAS token to yours:

```bash
azcopy copy medbrains-os-v3.33.0-x86-64-azure.vhd \
  "https://myaccount.blob.core.windows.net/images/medbrains.vhd?<SAS>" --blob-type PageBlob
az disk create -g my-rg -n medbrains-os --hyper-v-generation V2 \
  --security-type TrustedLaunch \
  --source "https://myaccount.blob.core.windows.net/images/medbrains.vhd"
az disk update -g my-rg -n medbrains-os --size-gb 64
```

## 3. Create the VM

**Trusted Launch** gives the virtual TPM. Secure Boot stays off until the
image is signed for it.

```bash
az vm create -g my-rg -n medbrains --attach-os-disk medbrains-os --os-type linux \
  --size Standard_D4s_v5 --security-type TrustedLaunch \
  --enable-vtpm true --enable-secure-boot false
```

Allow port 443 from the hospital network only, in the VM's network security
group.

## Check it worked

The appliance has no SSH. Open **VM > Help > Serial console** (boot
diagnostics must be on). It shows the first setup screen. Go on to
[first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| `az disk create` refuses the blob | It was uploaded as a block blob. Upload again with `--blob-type PageBlob` |
| "VHD is not fixed size" or wrong size | You uploaded the `.zst`, or a converted copy. Upload the file `zstd -d` made |
| The VM does not start, generation error | The disk was made without `--hyper-v-generation V2` |
| Setup asks about a TPM | The VM was made without `--enable-vtpm true` |

**Deeper:** [`os/README.md`, "Microsoft Azure"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#microsoft-azure--azurevhdzst).

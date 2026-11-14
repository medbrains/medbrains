---
title: Install on Hyper-V
sidebar_label: Hyper-V (VHDX)
sidebar_position: 5
description: "Run MedBrains OS on Microsoft Hyper-V from the VHDX image: a generation 2 VM with Secure Boot off, a virtual TPM and a 64 GB disk, in PowerShell."
---

# Install on Hyper-V

**Who:** the person who runs the hospital's Hyper-V hosts.
**You need:** Windows Server or Windows 10/11 Pro with Hyper-V, an
administrator PowerShell, a virtual switch, and
`medbrains-os-v3.33.0-x86-64.vhdx`, [verified](/install/verify-a-download/).

The VM must be **generation 2** (UEFI). Generation 1 cannot start it.

## Create the VM

Run in an administrator PowerShell, in the folder that holds the `.vhdx`.
Change `External` to your switch's name (`Get-VMSwitch` lists them).

```powershell
Resize-VHD .\medbrains-os-v3.33.0-x86-64.vhdx -SizeBytes 64GB
New-VM -Name MedBrains -Generation 2 -MemoryStartupBytes 4GB `
  -VHDPath .\medbrains-os-v3.33.0-x86-64.vhdx -SwitchName External
Set-VMProcessor MedBrains -Count 4
Set-VMFirmware MedBrains -EnableSecureBoot Off
Set-VMKeyProtector MedBrains -NewLocalKeyProtector
Enable-VMTPM MedBrains
Start-VM MedBrains
```

**Expected:** each command returns without an error. `Get-VMSecurity MedBrains`
shows `TpmEnabled : True`.

## Check it worked

Open the VM's console in Hyper-V Manager. It shows the MedBrains logo, then
the first setup screen. Go on to
[first boot and the recovery key](/admin/first-boot/).

## If it fails

| What you see | What to do |
|---|---|
| "The image's hash and certificate are not allowed" | Secure Boot is still on: `Set-VMFirmware MedBrains -EnableSecureBoot Off` |
| `Enable-VMTPM` fails | Run `Set-VMKeyProtector MedBrains -NewLocalKeyProtector` first. On a guarded fabric, use your Host Guardian key protector |
| "No operating system was loaded" | The VM is generation 1. Delete it and create it with `-Generation 2` |
| Setup stops and asks about a TPM | The TPM was added after the first start. Add it, then reinstall from a fresh `.vhdx` |

**Deeper:** [`os/README.md`, "Hyper-V"](https://github.com/medbrains/medbrains/blob/main/medbrains/os/README.md#hyper-v-vhdx).

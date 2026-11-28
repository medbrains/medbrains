---
date: 2026-11-28
title: The data disk's recovery key is made and shown before the TPM first opens it
status: decided
area: os
---
## What

On first boot `disk-setup prepare` creates the data partition with a random setup key as well as the TPM seal, adds the recovery key with that setup key, wipes the setup key, and shows the recovery key (with its proof) before `systemd-cryptsetup` first tries the TPM. `finish` reuses that key. A PCR signing key the TPM cannot load is left out of the seal (PCR 4+7 only), and `os/build.sh` refuses an `OS_PCR_KEY` that is not RSA 2048. Jira KAN-2, refs #6289.

## Why

The v3.35.6 release key is RSA 4096. swtpm, and most TPMs, refuse it (`TPM_RC_VALUE` from `TPM2_LoadExternal`), so every x86 machine with a TPM failed its first unlock. The recovery key was only made after `/var` opened, so the disk had nothing to type and systemd went straight to emergency mode with root locked, at every boot. A key larger than the TPM can load seals fine and never unseals, so the build guard and the `tpm2_testparms` check both refuse it.

## Rejected

Making the recovery key with the TPM right after sealing: it fails in exactly the case it is for. Leaving the PCR 11 policy in and only rotating the key: any other unlock failure on the first start would still brick the machine. Allowing RSA 3072: optional in the TCG PC Client profile, so not every chip loads it.

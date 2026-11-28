---
date: 2026-11-28
title: A release OS image never stores patient data unencrypted
status: decided
area: security
---
## What

On a machine with no TPM 2.0, a release image of MedBrains OS stops at first boot, says to turn the TPM on in the BIOS (PTT, fTPM or Security Device) or use a machine that has one, and offers only `OFF`. Only a debug image, marked at build by `/usr/lib/medbrains/debug-image`, still offers `STORE UNENCRYPTED`, for testing. The installer checks for the TPM, and reports Secure Boot, before it lists any disk, and on a release medium with no TPM it stops and erases nothing.

## Why

The owner: "remove store unencrypted mode, only for testing it should be there", and "at BIOS level or startup level it should ask for TPM". An unencrypted disk lets anyone who takes or copies it read every patient record, and an operator on a first-boot screen is not the person who can accept that risk for a hospital. Checking before the installer erases a disk means a machine that cannot run the OS is found before anything is lost.

A release image no longer runs on a machine with no TPM at all, including today's Raspberry Pi 5, until a TPM add-on is supported.

## Rejected

Keeping the prompt with a stronger warning: a warning is clicked through, and the risk falls on patients, not on the person typing. Going unencrypted silently when no TPM is found: patient data at rest with nobody having decided it.

---
title: Build and test the OS image
sidebar_position: 5
description: "Build and test the MedBrains OS disk image: make os-image, os-test and os-boot, QEMU and UTM, debug versus release images, and the memory and disk budgets."
---

# Build and test the OS image

Source of truth: `medbrains/os/README.md` and the `os-*` targets in
`medbrains/Makefile`.

| Command | Does |
|---|---|
| `make os-image ARCH=arm64` (or `x86-64`) | Cross-builds the server, setup service, agent and front with `cargo zigbuild`, builds Kanidm and the web app, then `os/build.sh`. Writes `medbrains-os_<commit>.raw` |
| `make os-image DEBUG=1` | The same, as a debug image |
| `make os-test IMAGE=path/to/image.raw` | Boots a fresh debug image, makes it a main machine, and checks firewall, kernel hardening, time, memory, disk and joining |
| `make os-boot` | Boots the arm64 image in QEMU (`FRESH=1` for a brand-new box) |

On Linux, `os/build.sh` runs mkosi directly, with no Docker. On a Mac it falls
back to a privileged Debian builder container.

## QEMU and UTM

| | QEMU (`os/qemu-run.sh`) | UTM (`os/utm-run.sh`) |
|---|---|---|
| Runs | Headless, driven by `os/tests/vm.py` over sockets | Apple Virtualization, VM "MedBrains Dev" |
| TPM | None on arm64: type `STORE UNENCRYPTED`. The sealed disk is tested on x86-64 | — |
| Notes | Used by `os-test` | No QMP; refuses while another VM runs |

## Debug and release images

A debug image adds a root shell on the serial console, debugging tools
(`strace`, `tpm2-tools`, `wtype`, `grim`), a throwaway disk-sealing key, and
lets the identity provider run on an unencrypted disk. **Never ship a debug
image:** it gives root to anyone with a serial cable.

## Budgets

`crates/medbrains-os-test/budgets.json` holds the memory and disk ceilings
that `make os-test` enforces, measured on QEMU with 4 GB: idle machine,
server after a page load, growth over 50 connections, and system disk used.
They are ratchets: lower them as they improve, and never raise one without a
reason in the PR. `os-test` needs QEMU and is not in CI yet.

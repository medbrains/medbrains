---
date: 2026-11-28
title: The release boots every x86-64 OS image with a TPM before upload
status: decided
area: os
---
## What

The release's os-image job boots the x86-64 image it just built, headless in QEMU with OVMF and a software TPM (swtpm), and stops before upload unless first boot reaches the recovery key screen with the data disk sealed to the TPM, `/var` on it, no emergency mode, and the network unit and app manifest readable by an unprivileged user (`os/tests/smoke-boot.py`). A release image has no shell and prints nothing on its serial port, so the boot uses a copy with one report unit written offline into the system partition; that partition is not measured, so the copy boots the same signed boot file and seals the same way. `os-smoke.yml` runs the same boot nightly on the latest published release.

## Why

The 2026-11-28 end-to-end test found that v3.35.6 on x86-64 with a TPM drops to emergency mode on first boot: a box that cannot be set up. No CI job booted the artefact we publish, so it shipped. KVM keeps it to about 5 minutes; TCG, on a runner without KVM, about 25.

## Rejected

Checking the screen with screenshots and OCR: slow and brittle; the report reads tty1's text from `/dev/vcs1`. Building a separate debug image to boot: a second 35-minute build, and it would test a different artefact. Booting arm64: its runner has no KVM, and an emulated arm64 boot with a TPM is not one we have seen work; arm64 is not boot-tested before release, and the release notes say so. Going past the recovery key to the setup screen: needs the key typed back through the emulated keyboard; left for later.

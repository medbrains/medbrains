---
date: 2026-11-28
title: The OS image build sets its own umask
status: decided
area: os
---
## What

`os/build.sh`, `os/build-iso.sh` and `os/formats.sh` set `umask 022` at the top, and the release job's OS step goes back to `umask 022` after writing its signing-key files.

## Why

The release job set `umask 077` for its signing keys (#5566, 13 November) and kept it for the whole step, so every file the image adds was built root-only (88 of 88 in v3.33.0, v3.33.2, v3.35.5 and v3.35.6): the network service could not read its settings, the launcher showed no apps, and the box was unreachable. A local build has no such umask, so local tests passed. Found by booting the published v3.35.6 arm64 image in QEMU.

## Rejected

Fixing modes file by file in the image recipe: the next added file would break again. Removing the 077: mkosi refuses group- or world-readable key files.

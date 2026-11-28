---
date: 2026-11-28
title: The release checks every OS image's file modes before upload
status: decided
area: os
---
## What

`os/tests/check-image-modes.py` reads the built `.raw` offline and fails if a file from `os/mkosi.extra` has fewer read or execute bits than git gives it, anything under `/usr/share/medbrains` or `/usr/share/kanidm` is not world-readable, a binary build.sh installs is not world-executable, a directory on the way is not searchable, or any of them is not owned by root. The release's os-image job runs its self-test and then the check right after the build; a failure ends the job before upload, so that image is never released.

## Why

v3.35.6 was built under the signing keys' umask 077, so every file the OS adds was 0600 or 0700 (fixed in #6308). The network unit, the app manifests and the setup scripts were unreadable to the services that need them, and the box could not be set up. CI never looked inside the artefact it published. On the published v3.35.6 x86-64 image the check reports 1,507 problems; on a copy with the modes repaired it passes.

## Rejected

Mounting the image to check it: needs root and Linux, and the same check should run on a Mac. Fixing modes after the build: hides the cause, and #6308 fixes the cause. Checking only a list of known files: the next leak is in a file nobody listed, so every file the OS adds is checked against git.

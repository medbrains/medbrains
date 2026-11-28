---
date: 2026-11-28
title: The identity provider's encrypted-disk check reads sysfs, not lsblk
status: decided
area: os
---
## What

`require-encrypted-data` finds the block device under `/var/lib/kanidm` with `findmnt` (MAJ:MIN) and walks `/sys/dev/block/<dev>` and its `slaves`, a few layers at most, for a device-mapper UUID starting `CRYPT-`. Anything it cannot read still counts as not encrypted. Jira MB-123.

## Why

`lsblk` opens `/dev` nodes, and kanidmd's `PrivateDevices`, `PrivateUsers` and `DevicePolicy=closed` hide them even from a `+` command, so on a correctly sealed release image the check always said "not on an encrypted disk", the identity provider never started, and setup's "Your new hospital" step silently put its form back. Debug images skip the check, so it was first seen on a TPM-sealed x86 image (KAN-2 testing).

## Rejected

Dropping the sandbox options from kanidmd: they protect the identity provider. A separate unsandboxed unit writing a result file: a second mechanism and a file that can go stale, where sysfs answers directly inside the sandbox.

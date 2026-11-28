---
date: 2026-11-28
title: A release carries an OS image only with a pass from every check
status: decided
area: os
---
## What

The release job's "OS image checks" step reads `os-checks-<arch>.txt` from each OS image artifact and removes the image unless it records a pass for every check: `file-modes` for both architectures, and `smoke-boot` too for x86-64. The release notes get an "OS image checks" section saying, per architecture, which checks passed, or that the image was not released and why; arm64 is marked as not boot-tested. The record file itself is not published.

## Why

The owner's goal after the 2026-11-28 end-to-end test: it must be impossible to publish an OS image that cannot set up a working box. A failing check already fails the os-image job before upload; requiring a recorded pass as well means a check that is skipped, renamed or deleted from that job withholds the image instead of letting it through. The notes tell the owner, before pressing Publish, what was proven about the image.

## Rejected

Failing the whole release when an OS check fails: the server and web app are still worth releasing, and the release already leaves out a failed OS job's files (v3.35.1). Trusting the job result alone: it cannot tell a check that passed from one that never ran.

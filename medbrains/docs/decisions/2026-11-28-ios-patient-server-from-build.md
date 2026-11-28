---
date: 2026-11-28
title: The iOS patient app takes its server from the build, https only
status: proposed
area: security
---

## What

The iOS patient app reads its server from the `MB_SERVER_URL` build setting (Info.plist key
`MBServerURL`). Debug builds default to `http://127.0.0.1:3000`; a Release build refuses to build
unless the setting is `https://…` (a pre-build script in `apps/ios/project.yml`). The `-baseURL`
and `-hospitalCode` launch arguments are honoured in Debug builds only, in both the patient and
the staff app. The release job passes `PATIENT_SERVER_URL` as `MB_SERVER_URL` and leaves the iOS
patient app out when it is unset, as it already does for Android. This is the iOS half of the
2026-11-12 Android decision (#5470).

## Why

The shipped iOS patient app pointed at the developer's machine over cleartext, and any shipped
build could be pointed elsewhere by its launch arguments.

## Rejected

- A hardcoded production URL: each hospital runs its own server.
- An empty Release default: the patient app has no QR binding and could reach no hospital.

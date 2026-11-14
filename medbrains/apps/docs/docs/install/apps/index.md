---
title: Install the MedBrains applications
sidebar_label: Overview
sidebar_position: 1
description: "Which MedBrains application file to use: the Linux server, the web app, Docker for trials, desktop apps for Windows, macOS and Linux, and staff phone apps."
---

# Install the MedBrains applications

**Who:** IT staff who install MedBrains without the OS appliance, or who
connect staff computers and phones to a hospital server.

Every file is on the
[release page](https://github.com/medbrains/medbrains/releases).
[Verify each file](/install/verify-a-download/) before you install it.

## The server

| You want | File | Guide |
|---|---|---|
| MedBrains on your own Linux server | `medbrains-server-bins-linux-x86-64.tar.gz` or `-arm64.tar.gz`, plus `medbrains-web-dist.tar.gz` | [Linux server](/install/apps/server/) |
| A quick trial in containers | the repository's `Dockerfile` and on-prem compose file | [Docker](/install/apps/docker/) |

The [MedBrains OS appliance](/install/os/) already contains the server and the
web app. You do not need either file on an appliance.

## Clients that connect to a server

| Device | File | Guide |
|---|---|---|
| Windows PC | `MedBrains_3.33.0_x64-setup-unsigned.exe` or `MedBrains_3.33.0_x64-unsigned.msi` | [Desktop app](/install/apps/desktop/) |
| Mac | `MedBrains_3.33.0_universal-unsigned.dmg` | [Desktop app](/install/apps/desktop/) |
| Linux PC | `MedBrains_3.33.0_amd64.deb`, `MedBrains-3.33.0-1.x86_64.rpm` or `MedBrains_3.33.0_amd64.AppImage` | [Desktop app](/install/apps/desktop/) |
| Android staff phone | `medbrains-staff-android.apk` | [Android staff app](/install/apps/android/) |
| iPhone | `medbrains-staff-ios-unsigned.xcarchive.zip` (for developers) | [iPhone apps](/install/apps/ios/) |

Any modern browser also works: open the hospital's web address. A desktop app
is not required.

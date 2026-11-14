---
title: Install MedBrains
sidebar_label: Overview
sidebar_position: 1
description: "Choose how to install MedBrains: the MedBrains OS appliance on a machine, a virtual machine or a cloud, and check every download against the signed SHA256SUMS."
---

# Install MedBrains

**Who:** the IT person who sets up MedBrains for a hospital.

Every file comes from one place: the
[GitHub release page](https://github.com/medbrains/medbrains/releases).
Every file on it is listed in a signed `SHA256SUMS`.

## Choose a route

| You have | Use | Guide |
|---|---|---|
| A small server or mini PC for the hospital | MedBrains OS, the appliance: the system, database and server in one image | [MedBrains OS](/install/os/) |
| A hypervisor (Proxmox, VMware, Hyper-V, KVM) | the same appliance as a virtual machine | [MedBrains OS](/install/os/) |
| A cloud account (AWS, Azure) | the same appliance as a cloud image | [MedBrains OS](/install/os/) |
| Your own Linux server | the server and web app, with the standalone kit | [Linux server](/install/apps/server/) |
| Staff computers and phones | the desktop and phone apps, connected to a server | [Applications](/install/apps/) |

The appliance is the supported route. It has no command line to look after.
You manage it from its own screen and from MedBrains.

## Before you install anything

1. [Verify the download](/install/verify-a-download/). It takes two commands.
2. Read the [release notes](/release-notes/) for the version you install.

## After you install

1. [First boot and the recovery key](/admin/first-boot/).
2. [Set up a hospital](/get-started/set-up-a-hospital/).

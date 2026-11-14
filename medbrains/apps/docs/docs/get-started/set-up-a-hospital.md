---
title: Set up a hospital in 30 minutes
sidebar_position: 3
description: "Set up a new hospital in MedBrains in about 30 minutes, from first boot of the hospital box to the first administrator, staff accounts, roles and modules."
---

# Set up a hospital in 30 minutes

**Who:** the person setting up the hospital, usually IT or the administrator.
**You need:** the MedBrains OS box, [installed](/install/os/) (or a server already running MedBrains),
a network cable, and a phone with an authenticator app.

## 1. Start the box (10 minutes)

1. Connect the box to the network and a screen, and switch it on.
2. Follow the setup screens: network, time zone, then **Setting up a new
   hospital**.
3. Enter the hospital name, your username and a password.
4. Scan the QR code with your authenticator app and type the 6-digit code.
5. Select **Confirm and start**.

The full steps, with screenshots, are in
[first boot and the authenticator](/admin/first-boot/).

## 2. Sign in (2 minutes)

On the box's desktop, select **MedBrains** in the dock and sign in with the
username and password you chose. See [sign in to MedBrains](/admin/sign-in/).

## 3. Choose your modules (5 minutes)

Go to **Admin** → **Settings** → **Modules**. Switch on the modules your
hospital uses, or choose an **Edition** and select **Apply edition**. A module
that another module needs cannot be switched off while that one is on.

## 4. Add your staff (10 minutes)

1. Go to **Admin** → **Users** and select **Add User**.
2. Enter the person's details, choose their **Role** and **Departments**, and
   select **Create user**.
3. For many people at once, use **Bulk Import**.

See the [admin quick guide](/admin/quick-guide/) for roles and permissions.

## 5. Join the other computers (a few minutes each)

Each ward or reception PC that runs MedBrains OS joins the main box by
approval. See [join a ward PC](/admin/join-a-machine/).

## On a Linux server: the setup wizard

A [Linux server install](/install/apps/server/) has no box screen. Sign in as
the first administrator (the installer prints where its password is), then
open `https://<your server>/onboarding`. The wizard walks through 15 steps:
welcome, administrator, hospital, region and regulations, facilities,
locations, departments, users, modules, number sequences, services, beds,
billing and tax, branding, and review. You can go live once departments,
services and sequences are filled in. Opened without signing in, the page says
**Registration is closed**.

:::note
Departments, wards, beds, services and prices can also be changed later from
the admin screens. Their guides are coming in a later phase.
:::

## Next

[Your first patient, end to end](/get-started/first-patient-end-to-end/).

---
title: Admin quick guide
sidebar_position: 7
description: "Quick guide for hospital administrators in MedBrains: add staff, set roles and per-user permissions, switch modules on or off, single sign-on and backup status."
---

# Admin quick guide

**Who:** hospital administrators.

## Add a member of staff

1. Go to **Admin** → **Users** and select **Add User**.
2. **Identity:** username, full name, email, phone and a password of at least
   8 characters.
3. **Role + Depts:** choose the **Role** and **Departments**.
4. **Groups** and **Overrides** are optional.
5. Select **Review**, then **Create user**.

For many people at once, use **Bulk Import**. Each user's row has **Edit
user**, **Reset password** and **Delete user**.

## Give one person more, or less, access

On the user's row, select **Permission overrides**. This opens **Admin** →
**Settings** → **Access Matrix** for that person. Set each permission to
**Allowed**, **Not granted** or **Inherit** (from the role), and save.

## Create a role

1. Go to **Admin** → **Roles & Permissions** and select **Add Role**.
2. Enter a **Role Code** (for example `senior_nurse`) and **Role Name**, and
   optionally a **Permission Template**. Select **Create**.
3. From the role's **More actions** menu, choose **Permissions** to tick what
   it can do, or **Field access** to hide sensitive fields.

Built-in roles carry a **System** badge and cannot be deleted. You cannot
give a role a permission you do not hold yourself.

:::info Administrator roles are managed only by administrators
Only an administrator can give someone the Super Admin or Hospital Admin
role, or change an administrator's account. Everyone else does not see those
choices, and the server refuses them: "Only a hospital administrator can
change an administrator's account."
:::

## Switch modules on or off

Go to **Admin** → **Settings** → **Modules**. Flip a module's switch, or
choose an **Edition** and select **Apply edition**. Switching a module off
removes its menu **and** its API. A module cannot go off while another module
that needs it is on; each card shows **Needs:** and **Needed by:**.

## Single sign-on

Go to **Admin** → **Single Sign-On** and select **Add provider**. Enter the
provider's details, then map its groups to roles under **Group mappings**.
A directory group can never be mapped to an administrator role.

## Check backups

Go to **Admin** → **Settings** → **System health**. The **Database backups**
card shows whether the latest backup succeeded. There is no screen to start or
restore a backup yet; see [backups](/admin/backups/).

## Machines

See [join a ward PC](/admin/join-a-machine/) and
[remove a machine](/admin/remove-a-machine/).

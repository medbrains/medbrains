---
title: Updates and rollback
sidebar_position: 9
description: "How MedBrains updates: the OS box's A/B slots that go back by themselves when an update fails, and the Linux server kit's install.sh update and rollback."
---

# Updates and rollback

**Who:** the administrator who keeps MedBrains up to date.
**You need:** a backup from the last 24 hours, and the
[release notes](/release-notes/) of the version you are moving to.

Database changes (migrations) apply by themselves when the new server starts.
So **back up first**, every time.

## On the MedBrains OS box

:::caution Not yet available on release images
The updater is built, but no release update key exists yet, so a release
image refuses every update bundle. The first-boot screen says "Installing
updates is not available in this version". Until a key ships, move to a new
version by installing it fresh and restoring the data.
:::

How it works once the key ships:

- The box has two system slots, **A** and **B**. An update is written to the
  slot not in use, so the running system is never touched.
- **Settings > Updates** shows the running version, what is waiting, and the
  last result. The buttons are **Restart to update…**, **Look for updates**,
  **Install from a USB stick**, **Try that version again** and **Go back to
  version X…**. The top bar shows **Update ready**, **Security fix ready**,
  **Last update failed** or **Updates need attention**.
- Without a quiet window, only a person applies an update. In a quiet window
  it applies only when nobody is connected.
- **It goes back by itself.** The new version has 3 tries and 5 minutes to
  show that the database, the server, the TLS front and the sign-in service are
  up. If it cannot, the box restarts into the old version.
- Offline sites copy the update to a USB stick in a folder named
  `medbrains-update/`.

**Known risk:** if a new version changes the database and then fails, the old
version may not start on the changed database. A backup taken just before is
the way back.

## On a Linux server (standalone kit)

1. Take a backup and check it finished:

   ```bash
   sudo systemctl start medbrains-pg-backup.service
   journalctl -u medbrains-pg-backup -n 20
   ```

2. Put the new release files in `/tmp` as in
   [install the server](/install/apps/server/) (steps 2 and 3).
3. Run the installer again:

   ```bash
   sudo bash /tmp/standalone/install.sh hms.example-hospital.org it@example-hospital.org
   ```

   It keeps the running programs and web app as `.prev`, takes a backup before
   the new database changes, and refuses to restart if that backup fails.

Do not replace `/usr/local/bin/medbrains-server` by hand: the installer also
adds keys that new versions need.

## Check it worked

```bash
curl -fsS http://127.0.0.1:3000/api/health     # {"status":"ok",...}
```

The version is shown in **Settings > Updates** (OS box) and in the release
notes you followed.

## Roll back (Linux server)

```bash
sudo medbrains-rollback
```

It swaps every `.prev` program and the previous web app back and restarts the
services. If the new version already changed the database, roll back the
database too, from the backup taken in step 1: see
[backups](/admin/backups/).

## If it fails

| What you see | What to do |
|---|---|
| The installer stops: backup failed | Fix the backup first (`journalctl -u medbrains-pg-backup`). Nothing was changed |
| The server will not start after the update | `journalctl -u medbrains-server -n 50`, then `sudo medbrains-rollback` |
| `nothing to roll back — no .prev artifacts found` | This host has had no update through the installer yet |
| OS box: **Last update failed** | The box went back by itself. **Try that version again** once the cause is known |

**Deeper:** [OS updates](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-UPDATES.md)
and [releases and support](/operate/releases/).

---
title: Backups and restore
sidebar_position: 8
description: "How MedBrains backs up the hospital database and keys, sealed to an offline age key: check status, take one now, prove it with a restore drill, and restore."
---

# Backups and restore

**Who:** the administrator responsible for the hospital's data.
**You need:** the offline backup key (`medbrains-backup.key.age`) and its
passphrase, made when the server was installed. See
[install the server](/install/apps/server/), step 1.

:::caution OS box
The MedBrains OS box does not take backups by itself yet. Its folder
`/var/backups/medbrains` exists, but no timer runs. Until it does, keep the
disk recovery key safe and plan a second copy of the data.
:::

## What the Linux server kit backs up

| What | When | Kept |
|---|---|---|
| The database (`pg_dump -Fc`), sealed with age | daily at 02:30 UTC, and before every update | 31 days, and the first of each month for 366 days |
| The settings and keys in `/etc/medbrains`, sealed with age | with each database backup | 31 days |
| Stored documents and files | nightly mirror | while present; old versions 90 days |

Backups go to the S3 bucket given to the installer, or to a folder set as
`BACKUP_DIR` in `/etc/medbrains/env`. The server can write backups but never
read them: the private key is not on it.

## Check backup status

Go to **Admin > Settings > System health**. The backup card shows when the last
good backup finished. It turns red when that is more than 26 hours ago.

The card needs the `admin.backup.manage` permission as well as access to the
settings tab.

From the server:

```bash
systemctl list-timers medbrains-pg-backup.timer          # next run
sudo systemctl start medbrains-host-check.service        # checks the last backup's age
```

## Take a backup now

```bash
sudo systemctl start medbrains-pg-backup.service
journalctl -u medbrains-pg-backup -n 20
```

## Prove it: the restore drill

A backup is only good once it has been restored. Run the drill on your own
computer every quarter. It needs `age`, the PostgreSQL 17 client, Docker, and
credentials that can read the bucket:

```bash
make restore-drill FROM=s3://my-bucket/pg-backups/my-host/ IDENTITY=medbrains-backup.key.age
```

It downloads the newest backup, decrypts it, restores it into a throwaway
PostgreSQL 17, checks the migrations, row counts and permissions, and prints
the timings. Add `--secrets-from s3://my-bucket/secrets-backups/my-host/` to
check the keys archive too.

## Restore

Restore beside the live database, check it, then swap. Never restore over the
live database. In short:

1. Stop the server and the backup timer, and take a dump of what is there now.
2. Decrypt the chosen backup **on your own computer** with the offline key.
3. On a new server, restore the keys in `/etc/medbrains/env` from the secrets
   backup **before** the server starts. Without them, sealed data stays locked.
4. Restore into a new database, run the drill's checks, then rename it into
   place and start the server.
5. Record the window of data lost, and tell the hospital which entries to
   re-enter from paper.

The full runbook, with every command, is in
[backup and restore](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/ops/BACKUP-RESTORE.md).

## If it fails

| What you see | What to do |
|---|---|
| System health is red | `journalctl -u medbrains-pg-backup -n 50` shows why. Often the bucket or disk is full, or its permissions changed |
| The card shows an error | The user lacks `admin.backup.manage` |
| `age: no identity matched` | The backup was sealed to a different key. Check `/etc/medbrains/backup-recipients.txt` holds **your** public key |
| The drill fails on permissions | The backup is older than 2026-10-12. Follow the grants step in the runbook |

---
title: Troubleshooting
sidebar_position: 6
description: "Fix common MedBrains problems: an OS box that will not start, a server that refuses to start, failed health checks, backups, updates and devices."
---

# Troubleshooting

**Who:** IT staff looking after a MedBrains box or server.

Start with the health check. On a server:

```bash
curl -fsS http://127.0.0.1:3000/api/health      # {"status":"ok",...}
journalctl -u medbrains-server -n 50
```

On an OS box, press **Ctrl+Alt+F2** for the support console, and
**Ctrl+Alt+F1** to go back.

## The OS box

| What you see | What to do |
|---|---|
| It stops and asks about a TPM | Turn the TPM on in the firmware, or give the VM a virtual TPM 2.0. See [first boot](/admin/first-boot/) |
| It asks for the recovery key | The board, firmware or boot settings changed. See [recovery](/operate/recovery/) |
| A power cut during setup | Setup starts again; nothing is left half made. If the cut came while the recovery key was on screen, a **new** key is shown: the old one no longer works |
| "That code did not match" at the authenticator step | Type the code the app shows now, and check the box's clock |
| The desktop says something failed | Press **Ctrl+Alt+F2**. Each failed service is listed with a plain reason |
| **Last update failed** in the top bar | The box went back by itself. See [updates](/admin/updates/) |

## The server

| What you see | What to do |
|---|---|
| `refusing to start: JWT_PRIVATE_KEY does not belong to its public key` | The two halves do not match. See [replace a key](/operate/keys/#replace-a-key) |
| The server stops at start with a migration error | Restore the backup taken before the update, then `sudo medbrains-rollback` |
| `permission denied for schema public` at start | `MIGRATION_DATABASE_URL` is missing; migrations need the owner role |
| Health check fails with a database error | PostgreSQL is down. On the server kit: `sudo docker ps` |
| The web app is blank | `STATIC_DIR` (default `/var/www/medbrains`) has no `index.html`. Reinstall the web files |

## Backups

| What you see | What to do |
|---|---|
| **System health** is red | The last backup is more than 26 hours old. `journalctl -u medbrains-pg-backup -n 50` |
| A restore cannot decrypt | The backup was sealed to another key. Check `/etc/medbrains/backup-recipients.txt` |

More in [backups](/admin/backups/).

## Devices

| What you see | What to do |
|---|---|
| A phone says the hospital code expired | Print a new QR in **Devices > Hospital binding**. See [Android](/install/apps/android/) |
| A phone cannot reach the server | The phone's network cannot reach it, or the server's certificate changed since the code was made |
| The desktop app refuses the address | It must be `https://`. See [desktop](/install/apps/desktop/) |
| A ward PC will not join | See [join a ward PC](/admin/join-a-machine/) |

## Still stuck

Search the [issues](https://github.com/medbrains/medbrains/issues), or open one
with what you saw and what you tried. **Never include patient data, keys or
your server's address.** Report a security problem privately through
[a security advisory](https://github.com/medbrains/medbrains/security/advisories/new).

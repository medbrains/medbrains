---
title: Keys and secrets on a hospital server
sidebar_label: Keys and secrets
sidebar_position: 2
description: "Every key a MedBrains server or OS box holds: recovery key, PIN, JWT pair and data keys. Where each lives, how to check it, and what to do if one is lost."
---

# Keys and secrets on a hospital server

**Who:** the hospital's IT lead and whoever keeps the safe.
**You need:** to know which kind of install you run:
[the OS appliance](/install/os/) or [the Linux server kit](/install/apps/server/).

MedBrains makes every key itself, at first boot or at install. Nobody types a
key in, and MedBrains (the project) holds no copy of any of them. That also
means **a lost key cannot be recovered by anyone**. Read the "If lost" column
before you need it.

## The keys

| Key | What it protects | Where it is | If lost | If stolen |
|---|---|---|---|---|
| **Disk recovery key** (appliance) | Opens the encrypted data disk on any machine | Paper only, written down at first boot | If the TPM also fails, the data is gone. Only a backup helps | Anyone with a copy of the disk can read it. Replace the machine's disk protection at once (see below) |
| **Disk PIN** (appliance, optional) | Ties the disk to a person at every start | The person's memory | The recovery key opens the disk | Still needs the machine's TPM; wrong guesses lock the TPM |
| **TPM seal** (appliance) | Opens the disk by itself at each start | Inside the TPM chip | The recovery key opens the disk; then re-seal | Useless without that machine's TPM |
| **JWT signing pair** (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`) | Every sign-in session and device token | Appliance: `/var/lib/medbrains/config/env`. Server kit: `/etc/medbrains/env` | Everyone signs in again; phones re-pair. No data lost | Anyone can sign in as anyone until it is replaced. **Treat as an emergency** |
| **Data keys** (`MEDBRAINS_IDENTIFIER_HMAC_KEY`, `_ABDM_SECRET_KEY`, `_NHCX_SECRET_KEY`, `_PACS_SECRET_KEY`, `_EVENT_TOKEN_KEY`, `_SIGNATURE_KEY_ENCRYPTION_KEY`, `_OAUTH_TOKEN_KEY`) | Secrets sealed inside the database: ID fingerprints, exchange credentials, doctors' signing keys, printed QR tokens, SSO tokens | Same file as the JWT pair | What they sealed stops opening: doctors re-enrol signing keys, exchange secrets are entered again, ID duplicate matching stops for good | Together with a copy of the database, those secrets can be read |
| **Backup key** (server kit) | Every backup | Your offline `medbrains-backup.key.age`, never on the server | **Every backup is unreadable** | Backups can be read. Make a new key and re-seal from now on |
| **Database passwords** | Local database logins | Same env file | Reset as `postgres`; no data lost | Database access from that machine only |

The env file has mode `0640`, owner `root:medbrains`. On the appliance it sits
on the encrypted disk.

## Keep them safe

1. **Recovery key:** keep the paper in a locked place away from the machine.
   Make a second copy for a second named person if your policy allows it.
2. **Env file (server kit):** the nightly backup seals `/etc/medbrains` with
   the database, because a restored database is unreadable without it. Check
   that `secrets-backups/` fills up (see [backups](/admin/backups/)).
3. **Never** paste any of these keys into an issue, a chat or an email.

## Check the keys are good

The server checks its keys every time it starts, and refuses to start on a bad
one rather than warning. It logs the JWT key's fingerprint, never the key:

```bash
journalctl -u medbrains-server | grep "JWT signing pair checked"   # server kit
```

A mismatched pair stops the server with
`refusing to start: JWT_PRIVATE_KEY does not belong to its public key`.

## Replace a key

**There is no rotation yet for the JWT pair or the data keys.** No key id, no
"verify with the old key". Replacing a key ends what it protected:

- **JWT pair (server kit):** empty both values in `/etc/medbrains/env` (leave
  `JWT_PRIVATE_KEY=` and `JWT_PUBLIC_KEY=`), then run `install.sh` again. It
  makes a new pair. Everyone signs in again; phones and desktops re-pair.
- **Data keys:** do not replace one unless it was stolen. If you must, plan for
  the losses in the table above.
- **Recovery key:** replacing it is **not supported yet**: the TPM's lockout
  password is derived from it and no command moves both. If a recovery key
  leaks, move the data to a freshly installed machine.

## If a key is stolen

1. **JWT key:** replace it now (above). Then check the **Audit** screen (`/audit`, permission `audit.log.view`) for
   sign-ins you do not recognise.
2. **Env file or a whole server copied:** replace the JWT pair, change the
   database passwords, and treat the sealed exchange secrets as exposed: rotate
   them with each exchange (ABDM, NHCX, PACS).
3. **Recovery key and a disk copy:** treat the data on that disk as disclosed.
   Follow your breach-notification rules.
4. Tell the MedBrains maintainers privately through
   [a security advisory](https://github.com/medbrains/medbrains/security/advisories/new)
   if you think the cause is in MedBrains.

**Deeper:** every key with its algorithm, lifetime and failure table is in
[OS keys](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-KEYS.md).
How releases themselves are signed is in [release signing](/operate/release-signing/).

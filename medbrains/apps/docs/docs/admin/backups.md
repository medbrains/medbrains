---
title: Backups
sidebar_position: 8
description: "How MedBrains seals every backup to the hospital's own post-quantum key, where to keep that key, how to restore onto a new machine, how to rotate the key, and the monthly check that a backup opens."
---

# Backups

Every night the server copies the hospital database, and the folder of keys it
needs to start, and seals both with [age](https://age-encryption.org). Sealed
means locked: only the hospital's **backup key** can open them. The server
holds only the public half of that key. It can make backups but cannot read
them, and neither can MedBrains.

New keys are **post-quantum** (ML-KEM-768 + X25519, written `age1pq1…`).
Patient records stay sensitive for decades. Someone who copies a backup today
could keep it until a quantum computer can break today's locks, so new
backups use a lock that such a computer cannot open either.

Where to see it: **Admin** → **Settings** → **System health** shows the last
good backup. It turns red after 26 hours and warns if the key is a classic
(not post-quantum) one.

This page is for the standalone server kit. The MedBrains OS box does not run
backups yet.

## The two halves of the key

| Half | Looks like | Where it lives | Secret? |
|---|---|---|---|
| Public key | `age1pq1…` (about 2,000 characters) | `/etc/medbrains/backup-recipients.txt` on the server, mode 0644 | No |
| Private key (the identity) | `AGE-SECRET-KEY-PQ-1…` (77 characters) | **Offline only**: never on the server for long | **Yes**: it opens every backup |

## How the key is made

Pick one way.

**A. On your own computer (recommended).** Use a computer that is not the
server. You need age 1.3 or newer (`age --version`; on a Mac,
`brew install age`).

1. Make the key: `age-keygen -pq -o medbrains-backup.key`
2. Write down the public key: `age-keygen -y medbrains-backup.key > medbrains-backup.pub`
3. Lock the private key with a passphrase: `age -p -o medbrains-backup.key.age medbrains-backup.key`
4. Delete the unlocked copy: `rm -P medbrains-backup.key` (Linux: `shred -u medbrains-backup.key`)
5. Give the public key to the install:
   `sudo BACKUP_AGE_RECIPIENT="$(cat medbrains-backup.pub)" bash install.sh <domain> <email>`

**B. Let the install make it.** If you give no key, `install.sh` makes one on
the server at `/root/medbrains-backup-identity.txt` (mode 0600) and prints that
path between rows of stars. Until you move it, root on the server can read
every backup, and each backup run warns about it.

1. Copy it off the server: `scp root@<server>:/root/medbrains-backup-identity.txt medbrains-backup.key`
2. Do steps 2 to 4 of way A on your computer.
3. Remove it from the server: `sudo shred -u /root/medbrains-backup-identity.txt`

If you give a classic key (`age1…` with no `pq`), backups still work, but
the install, every backup run and System health warn until you
[rotate](#rotate-to-a-new-key). You cannot mix classic and post-quantum keys
in one file; the install refuses it.

## Keep the backup key safe

1. Keep **two** copies of `medbrains-backup.key.age` in two places that cannot
   fail together. For example: a USB stick in the hospital safe, and the
   password manager of a second named person.
2. Keep the passphrase somewhere other than the key file.
3. Optional: a paper copy. Print the one line that starts with
   `AGE-SECRET-KEY-PQ-1` (77 characters). Put it in a sealed envelope in a
   safe, and write the date on the envelope. To use it later, type the line
   into a file, then `age-keygen -y` on that file gives back the public key.
4. Keep `medbrains-backup.pub` beside them. It is not secret, and a new server
   needs it.
5. To stop one lost key from ending every backup, give a second person their
   own post-quantum key, kept by them. Add its public key as a second line
   (step 5 of way A, both lines in `BACKUP_AGE_RECIPIENT`). Either key then
   opens every new backup.

## If the backup key is lost

**Nobody can open a backup without its key: not the hospital, not MedBrains,
not anyone.** There is no reset and no copy anywhere else. Backups sealed to a
lost key are gone.

1. If the server still runs, the live data is safe. Make a new key now (way A
   above), give it to the install, then take a backup at once:
   `sudo systemctl start medbrains-pg-backup.service`
2. Run the [monthly check](#monthly-check-that-a-backup-opens) with the new
   key the same day.
3. Record it as an incident: the date, what was lost, and that backups before
   that day cannot be restored.
4. If the server is also gone, the data cannot be recovered from backups.
   Re-enter it from paper records.

## Restore onto a new server

You need: the backup file (`<date>.dump.age`), the keys file
(`<date>.tar.age`) from the same night, the private key and its passphrase,
and your own computer with age 1.3+ and PostgreSQL 17. With S3 the files are
in `pg-backups/<host>/` and `secrets-backups/<host>/`; without S3 they are in
the server's backup folder (`BACKUP_DIR`, usually `/var/backups/medbrains`).

1. **On your computer, check the backup opens.** From the `medbrains` folder
   of the MedBrains source:
   `bash deploy/standalone/medbrains-restore-drill --from <date>.dump.age --identity medbrains-backup.key.age`.
   It must end with `RESTORE DRILL PASSED`.
2. **Open the keys file:**
   `age -d -i medbrains-backup.key.age <date>.tar.age | tar -xOf - medbrains/env > old-env`.
   Keep `old-env` on your computer only.
3. **Install MedBrains on the new server with the same public key:**
   `sudo BACKUP_AGE_RECIPIENT="$(cat medbrains-backup.pub)" bash install.sh <domain> <email>`
4. **Stop the server:** `sudo systemctl stop medbrains-server medbrains-pg-backup.timer`
5. **Put back the old keys.** In `/etc/medbrains/env` on the new server, set
   these lines to their values in `old-env`: `MEDBRAINS_IDENTIFIER_HMAC_KEY`,
   `MEDBRAINS_ABDM_SECRET_KEY`, `MEDBRAINS_NHCX_SECRET_KEY`,
   `MEDBRAINS_PACS_SECRET_KEY`, `MEDBRAINS_EVENT_TOKEN_KEY`,
   `MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY`, `MEDBRAINS_OAUTH_TOKEN_KEY`,
   `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`. Without them the restored records
   cannot be matched or read.
6. **Send the opened backup to the server**, never leaving it on disk unlocked:
   `age -d -i medbrains-backup.key.age <date>.dump.age | ssh <admin>@<new-server> 'umask 077; cat > /var/tmp/restore.dump'`
7. **Restore it beside the new empty database, then swap** (the owner role
   on the kit's database is `medbrains`):
   ```sh
   sudo -u postgres createdb -O medbrains medbrains_restore
   sudo -u postgres pg_restore -d medbrains_restore --no-owner --role=medbrains --exit-on-error -j 4 /var/tmp/restore.dump
   sudo -u postgres psql -c 'ALTER DATABASE medbrains RENAME TO medbrains_empty' \
                         -c 'ALTER DATABASE medbrains_restore RENAME TO medbrains'
   sudo systemctl start medbrains-server medbrains-pg-backup.timer
   curl -s https://<domain>/api/health                 # must show "status":"ok"
   ```
   Sign in and open a patient you know. The full checks are steps 5 to 8 of
   the restore runbook,
   [`docs/ops/BACKUP-RESTORE.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/ops/BACKUP-RESTORE.md#restore-runbook).
8. **Clean up:** `sudo shred -u /var/tmp/restore.dump` on the server, and
   `shred -u old-env` (Mac: `rm -P old-env`) on your computer.
9. **Take a fresh backup:** `sudo systemctl start medbrains-pg-backup.service`,
   then check that System health shows it.

## Rotate to a new key

Rotate when a key may have been seen, when a key holder leaves, or to move
from a classic key to a post-quantum one.

1. Make the new key on your computer (way A, steps 1 to 4), named for example
   `medbrains-backup-2027.key.age` and `medbrains-backup-2027.pub`.
2. Give it to the server. Re-run the install with it, or replace the whole
   content of `/etc/medbrains/backup-recipients.txt` with it:
   `sudo BACKUP_AGE_RECIPIENT="$(cat medbrains-backup-2027.pub)" bash install.sh <domain> <email>`
3. Take a backup: `sudo systemctl start medbrains-pg-backup.service`, then
   `journalctl -u medbrains-pg-backup -n 20`. It must not say "classic backup key".
4. Run the [monthly check](#monthly-check-that-a-backup-opens) with the new key.
5. **Keep the old key.** Old backups stay sealed to it and only it opens them.
   Keep it as safely as the new one until the last old backup has expired.
   In S3 that is 31 days for daily backups and a year for monthly ones.
6. **Re-seal the old copies you keep** (on a NAS, archive disks or downloads)
   so they need the new key. On your computer, in the folder that holds them:
   ```sh
   set -o pipefail
   age -d medbrains-backup.key.age > old.key       # asks the old passphrase
   age -d medbrains-backup-2027.key.age > new.key  # asks the new passphrase
   for f in *.age; do
     age -d -i old.key "$f" | age -R medbrains-backup-2027.pub -o "$f.new" \
       && cmp <(age -d -i old.key "$f") <(age -d -i new.key "$f.new") \
       && mv "$f.new" "$f" && echo "re-sealed $f" \
       || { rm -f "$f.new"; echo "NOT re-sealed $f: kept as it was"; }
   done
   rm -P old.key new.key                           # Linux: shred -u old.key new.key
   ```
   A file prints `re-sealed` only after the new copy has been opened with the
   new key and matched byte for byte. Any other file is left as it was. S3 objects cannot be rewritten (the
   bucket locks them), so they expire on their own.

Rotation protects backups from now on. A copy someone took before the
rotation stays sealed to the old key.

## Monthly check that a backup opens

A backup nobody has opened is a hope. Once a month, on your computer:

1. From the `medbrains` folder of the MedBrains source, run the drill on the
   newest backup. With S3:
   `make restore-drill FROM=s3://<bucket>/pg-backups/<host>/ IDENTITY=medbrains-backup.key.age`.
   Without S3, copy the newest `*.dump.age` from the backup folder and pass
   that file as `FROM=`.
2. It asks the passphrase, restores into a throwaway database, and checks the
   tables, row counts and access rights.
3. It must print `ok   sealed post-quantum` and `RESTORE DRILL PASSED`. If it
   prints `sealed classic`, [rotate](#rotate-to-a-new-key).
4. Once a quarter, check the keys file too. It lists key names, never values:
   `bash deploy/standalone/medbrains-restore-drill --from s3://<bucket>/pg-backups/<host>/ --identity medbrains-backup.key.age --secrets-from s3://<bucket>/secrets-backups/<host>/`
5. Write the date and the result in the hospital's backup log. A failure is
   fixed the same day.

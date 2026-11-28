---
date: 2026-11-28
title: Seal new backups to a post-quantum hybrid age key (ML-KEM-768 + X25519)
status: decided
area: security
---
## What

The standalone kit makes the hospital's backup key with `age-keygen -pq`: a hybrid ML-KEM-768 + X25519 key (`age1pq1…`, header stanza `mlkem768x25519`, age 1.3+). `install.sh` installs upstream age v1.3.2, pinned by SHA-256, when the distro's age has no `-pq`. A classic `age1…` key, supplied or left by an older install, keeps working, with a loud warning at install, in every backup log and on System health. Old backups are not re-sealed unless the operator runs the rotation steps in the admin guide; the old identity keeps opening them.

## Why

Backups hold patient records that stay sensitive for decades, and they leave the machine. Anyone who copies a sealed backup today can keep it until a quantum computer can break X25519 ("harvest now, decrypt later"). The hybrid stays safe while either half holds: ML-KEM-768 against a quantum computer, X25519 against a flaw found in the newer ML-KEM. The owner asked for it on 2026-11-28 (#6289).

## Rejected

- **Classic X25519 only:** safe today, open to harvest-now-decrypt-later for records that must stay private for decades.
- **Pure post-quantum (ML-KEM alone, no X25519):** ML-KEM is young; a flaw found in it, or in an implementation, would open every backup. The hybrid costs about 2 KB of header per file.
- **Mixing classic and post-quantum recipients in one file:** age refuses it, because the file would be only as strong as its classic recipient.
- **Depending on the distro's age:** Ubuntu 22.04/24.04 and Debian 12/13 ship age below 1.3, which has no post-quantum keys.

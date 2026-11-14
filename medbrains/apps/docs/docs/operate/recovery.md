---
title: Recovery
sidebar_position: 4
description: "Get a MedBrains box or server back: the recovery key prompt after a board or firmware change, TPM lockout, a failed update, the support console, a lost machine."
---

# Recovery

**Who:** IT staff when a MedBrains machine does not come back as expected.
**You need:** the disk recovery key (on paper), and for a lost machine, the
latest backup and its offline key.

## The box asks for the recovery key

The data disk opens by itself only on the same machine, with the same boot
settings. It asks for the recovery key when:

- the disk was moved to another machine;
- the board or the TPM was changed;
- a firmware update or Secure Boot change altered the boot settings;
- a new boot file was installed;
- the PIN was wrong twice, or the TPM locked itself after too many failed
  starts.

After 20 seconds the screen says in plain words why. **Type the recovery
key**; the characters are not shown. The disk opens and the box starts.

Then the seal must be renewed, so the box opens by itself again. Today that
needs a root shell, which release images do not offer; a screen for it is
planned. The command, for when a shell is available, is:

```bash
/usr/lib/medbrains/disk-setup reseal <file holding the recovery key>
```

It drops any PIN; set one again afterwards. After a TPM lockout,
`disk-setup clear-lockout <file>` lifts it. Without either command, the lockout
heals by itself over time while the machine stays on.

## Recovery key lost

If the box still starts by itself, the data is safe for now, but you have no
way in if the TPM or board fails. Move the data to a freshly installed machine
while it still starts, and write down the new machine's key. Replacing the key
in place is not supported yet.

**Recovery key lost and the TPM gone:** the data cannot be opened by anyone.
Only a backup brings it back.

## The box does not finish starting

Press **Ctrl+Alt+F2** for the support console. It shows what is still
starting, the slowest steps, and for each failed service a plain reason (for
example "Database did not start") with its last 10 log lines. It only shows;
it runs no commands. **Ctrl+Alt+F1** goes back.

## An update failed

- **OS box:** it goes back to the old version by itself after 3 failed tries.
  The top bar says **Last update failed**. See [updates](/admin/updates/).
- **Linux server:** `sudo medbrains-rollback`, then restore the database if the
  new version had already changed it.

## A machine is lost, stolen or dead

1. Install a new machine ([OS box](/install/os/) or [server](/install/apps/server/)).
2. Restore the latest backup and its keys: see [backups](/admin/backups/).
3. If it was stolen: replace the JWT pair so every session it held ends, and
   follow [if a key is stolen](/operate/keys/#if-a-key-is-stolen). Remove the
   machine from the hospital: see [remove a machine](/admin/remove-a-machine/).

There is no factory reset yet. To retire a machine, its data key must be
destroyed; see
[disposal in OS keys](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-KEYS.md).

**Deeper:** [OS keys, failure table](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/architecture/OS-KEYS.md#failure-table-os-principles-section-7).

# MedBrains OS: sending updates

Status: PROPOSED, 2026-11-04. Details RFC-HOSPITAL-OS §8b (D4). Task U1 in `OS-BUILD-PLAN.md`. Nothing here is built.
`systemd-sysupdate` and boot counting are candidates, not tested on this image.

## The path

```
We build and sign → release channel → main machine checks and downloads → hospital approves or window opens
                                             │
                               nodes download from the main machine, in rings
                                             │
                      write to the unused slot → reboot → health check → keep, or roll back by itself
```

No internet: the same signed bundle arrives on USB, and the main machine carries on from there.

## What gets updated

| Part | How | Why separately |
|---|---|---|
| OS: Linux, Debian packages, PostgreSQL | Whole signed image into the other slot (A/B) | Never half-updated; `/usr` stays read-only |
| MedBrains and other apps | Own signed package, on its own schedule | A small fix should not need a full OS image |
| Database | Runs with the app update, after a backup | The hard part, below |
| Settings and patient data | Never touched | Live on the data partition (§8b) |

## Rules

1. **Signed or refused.** A machine verifies the signature before writing anything. USB gets the same check.
2. **The hospital decides when.** It picks a channel and a maintenance window. Security fixes are marked and urged, never forced into a clinical shift, and an emergency override is logged.
3. **Rings.** Test machine, then one ward, then the rest. A failure stops the rollout.
4. **Automatic rollback.** A machine that does not pass its health check after reboot returns to the old slot.
5. **Nothing phones home.** The machine asks for the release list; no patient data or usage goes out (§8j).
6. **No master key over hospitals.** We publish; each hospital's main machine decides and signs commands for its own nodes.

## The hard part: the database

Booting the old slot cannot undo a schema change, so a plain rollback after a migration can leave old code on a new
database. So:

- **Always a verified backup first,** on the data partition, with a check that it restores.
- **Migrations stay compatible with the previous version** for one release: add first, remove in a later release. Today nothing enforces this; it needs a CI check.
- **If a migration itself fails,** the update stops and the machine restores the backup before reopening.

## Sizes

Root slots are 2 GB each and the system is about 1.2 GB today. Bundles should be compressed, and deltas added only if
measured download sizes demand it. Offline sites use USB.

## Who runs it

- **Base flaws:** a weekly image rebuild picks up Debian's security updates.
- **Targets:** critical in 72 hours, high in 7 days, medium in 30 (`SECURITY-RELEASE-PROCESS.md`).
- **Publishing** stays with the owner. Auto tags (R2) only start it on a merged version change.

## Test before calling it done

Customise a machine, update it, cut power mid-update, fail the health check on purpose, roll back, and prove settings
and data are byte-identical each time.

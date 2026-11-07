# MedBrains OS: sending updates

Status: U1 and U1.1 built, 2026-11-05: `crates/medbrains-os-update`. App updates apart from the OS (U1.2), backup before
migration (U1.3) and rollout through a main machine (U1.4) are not built. Details RFC-HOSPITAL-OS §8b (D4).

## The path

```
We build and sign → release channel → machine checks signature, version, space → downloads to the data disk →
    checks hashes → writes the other slot → waits for a person or a quiet window → restarts into it on trial →
    health check → marked good, or back to the old slot by itself
```

No internet: the same signed bundle arrives on a USB stick, and every check after the copy is the same.

## What gets updated

| Part | How | Why separately |
|---|---|---|
| OS: Linux, Debian packages, PostgreSQL, today also the server | Whole signed image into the other slot (A/B) | Never half-updated |
| MedBrains and other apps | Own signed package, on its own schedule (U1.2, not built) | A small fix should not need a full OS image |
| Database | Runs with the app update, after a backup (U1.3, not built) | The hard part, below |
| Settings and patient data | Never touched | Live on the data partition (§8b) |

## How it works

**Two slots, one boot file each.** System partitions are named after their version (`medbrains_3.33.0`), and an empty one
`_empty`. A boot file (UKI) names its partition on its command line, `root=PARTLABEL=medbrains_3.33.0`, so it can only
start its own system. Finding the root by partition type would not do: systemd's `gpt-auto` always takes the newest label,
which would defeat rollback.

**Install and apply are two steps.** Installing writes the other slot while the machine works, at low priority, and leaves
the boot file in `EFI/MedBrains/`, where the loader never looks. So a power cut or an ordinary restart can't change
the system by surprise. Applying renames the boot file into `EFI/Linux/` as `medbrains-os_<version>+3-0.efi`, and restarts.

**Boot counting is systemd's.** `systemd-boot` lowers the `+3` on each start and skips an entry at zero. `systemd-bless-boot`
removes the count only once `boot-complete.target` is reached, which needs `medbrains-update-health.service`:

- `/var` is on its own partition; firewall, setup service and screen run if enabled; no unit has failed.
- On a main machine also: database and server units run, and `/api/health` says `"status":"ok"` (it answers 200 either way).
- Services get 5 minutes to get there. A failure marks the entry bad and restarts at once, and the old version says why.
- A boot stuck anywhere, health never having run: `medbrains-update-deadline.timer` survives emergency mode, needs neither
  `/var` nor the boot partition, and restarts the machine after 10 minutes. Each start used brings the old slot nearer.

A version that can't reach its own system stops in the initrd, where neither of those run: `os/trial-initrd/` adds one small unit to
the boot file's initrd that restarts from emergency mode, on a counted boot only. `panic=10` restarts a dead kernel. Hardware watchdog as before. `systemd-boot-update.service` is masked: a kernel fix must
not rewrite the boot loader on the way past, the one write here with no second copy. Replacing the loader is not built.

**A new system adopts this machine.** It gets the machine id, because a new one would change the DHCP identity and start a
new journal folder. Installing refuses a system whose user or group numbers differ, because `/var` keeps numbers, not names.
This is not theoretical: `medbrains` and `kiosk` were dynamic, and the Pingora branch's new user moved `kiosk` by one.
They are now pinned to 990 and 989.

## Rules

1. **Signed or refused.** Ed25519 over the manifest's exact bytes, checked in Rust with a key in the image, before anything
   else is fetched. The manifest holds the hashes of the payload, and the payload is checked on the data disk before a
   system or boot partition is touched. USB gets the same check, on a copy, so a stick can't change between check and use.
2. **Only forward.** Refused: same or older than what runs, or below the floor. The floor rises only when a signed update
   that declared it **proves good**, so a failed update can't strand a machine. Versions are dotted numbers only, so our
   order and systemd-boot's can't disagree.
3. **A person can always go back.** Settings' Go back marks the running entry as having no starts left, and the other slot
   boots. It writes no version, so the floor doesn't apply. What it can't do is return further than the other slot.
4. **The hospital decides when.** No window set means only a person applies. In a window, the timer applies only with a
   confirmed clock and nobody connected to 443, 8443 or 3000; not being able to tell counts as in use. **A security fix waits
   like any other**: it is said on the top bar and Settings, and nothing restarts for it. Emergency override: not built.
5. **Rings.** Test machine, then one ward, then the rest (U1.4, not built).
6. **Nothing phones home.** No address set means the machine never looks. Set, it asks for a static manifest, and sends nothing.
7. **No master key over hospitals.** We publish; each hospital's main machine decides and signs commands for its own nodes (U1.4).

Plan O13: `apply` and `go-back` on a main machine are severe actions. Today anyone at the screen can press them. They and the
settings pass through one door, `crates/medbrains-os-setup/src/updates.rs`, where the permission check goes.

## Bundles

A folder of four files, the same on a USB stick (`medbrains-update/`) and at an address (`<url>/<arch>/`):

| File | What |
|---|---|
| `manifest.json` | Format, version, architecture, floor, security flag, one sentence, hashes and sizes. Unknown fields refused |
| `manifest.sig` | One line per signature: `<key id> <base64>`. Up to 4, so one bundle can carry an old and a new key |
| `root.img.zst` | The system partition, compressed |
| `boot.efi` | The boot file |

`medbrains-os-bundle` makes them (`keygen`, `extract`, `make`, `sign`). It runs on a build machine and is not in the image.

## Signing keys

**Test key: debug images only.** `build.sh --debug` makes one per build folder, `test-1`, and adds the mark file
`THIS-IS-A-DEBUG-IMAGE` beside it. The updater ignores any key named `test-*` without the mark. `build.sh` copies only
`os/update-keys/*.pub` into a release image and fails if one is named `test-*`. A debug image gives root to anyone with a serial
cable, so this key protects nothing and only lets the tests run.

**Release key: designed, not made** (plan X2). Until it exists, a release image refuses every bundle and says so.

| Question | Answer |
|---|---|
| Algorithm | Ed25519. One small signature, and the manifest is the only thing signed, so signing never touches the image |
| Where it lives | Never on a build machine. An air-gapped computer that stays off and locked, with the seed on two encrypted USB sticks kept apart, or a hardware token doing Ed25519. A CI runner must not be able to sign |
| How a release is signed | The build makes the bundle and `manifest.json`. Only that small file crosses to the signing machine; a person reads its version and hashes, runs `medbrains-os-bundle sign`, and carries back `manifest.sig` |
| Two people | Holding the key is the owner's; two named people should witness each signing. Not enforced by anything yet |
| Public half | `os/update-keys/release-<n>.pub`, in every image |

**Rotation.** Trust comes from the image, so a new key arrives in an update: (1) release R ships `release-1` and `release-2`, signed by 1;
(2) R+1 is signed by both; (3) once machines are past R, later images drop `release-1`. Tested: one bundle signed by two keys passes on a
machine holding either (`a_bundle_signed_by_two_keys_passes_on_old_and_new_machines`).

**A stolen key.** Rotating drops it only from machines that update. A thief can sign a bundle with a high version for anything
that still trusts it, so a stolen key needs a same-day release raising the floor, and the release list on another path. Machines
offline during that window stay exposed. There is no revocation list: a machine has no trusted time or channel to read one from.

**The boot signing key is a different key.** `OS_PCR_KEY` (OS-KEYS.md) signs what may open the disk; this one what may be
installed. They could be the same physical custody. Keep them apart in software: a mistake with one mustn't release the other.

### Why not `systemd-sysupdate`

We tried it on paper first, as the plan asked, and did not use it, for reasons read from its own manual (`sysupdate.d(5)`, 257):

| Need | sysupdate 257 | Result |
|---|---|---|
| USB checked like online | "only has an effect if the source resource type is selected as url-file or url-tar": a local file is **not verified at all** | Fails rule 1 |
| Refuse before writing | Streams to the partition and checks after | Fails rule 1 |
| Floor, wrong architecture | No floor; architecture only by file name | Fails rule 2 |
| Size | `systemd-container` 2.5 MB plus `gpg` 1.7 MB and its dependencies; not in the image | Against H7 |

It would need all of `medbrains-os-update`'s checks in front of it, leaving it the partition naming and the boot file's `+3`, about 40
lines here. The updater is 0.78 MB; `fdisk` (0.6 MB) and `zstd` (2.1 MB) were added to the image.

## The sealed data disk

The seal is PCR 7 plus PCR 11 by signature (OS-KEYS.md). What an update changes:

| What changes | PCR 7 | PCR 11 | At the next start |
|---|---|---|---|
| New boot file, signed by the same `OS_PCR_KEY` | same | new value, new signature, same key | **Opens by itself.** Tested on swtpm |
| Back to the old slot, automatically or by a person | same | old value, old signature | **Opens by itself.** Tested on swtpm |
| New boot file signed by another key, or by none | same | no accepted signature | **Would ask for the recovery key.** The updater refuses it before writing, with that reason. Tested |
| Image with no key today (a release image until X2): seal is PCR 7 alone | same | not sealed | Opens by itself, and a changed boot file also opens it: OS-KEYS.md's gap |
| Firmware update or Secure Boot turned on | **changes** | | **Asks for the recovery key once**, then needs `disk-setup reseal`. Nothing in an OS update changes firmware or boot loader, so an update can't cause this. It can't be avoided for a firmware update, and that is not ours to prevent |
| Boot file somehow published with no valid seal | same | no match | Prompt on screen. **Nobody typing:** the deadline restarts it and the slot runs out of starts, so the old version opens the disk by itself in about 30 minutes. **Tested on swtpm** |

**Rotating `OS_PCR_KEY`: designed, not built.** A disk is sealed to one key, so the refusal above blocks a release signed by a new one. To
rotate, a release must add a second seal while the disk is open, with `systemd-cryptenroll --unlock-tpm2-device=auto --tpm2-device=auto
--tpm2-pcrs=7 --tpm2-public-key=<new> --tpm2-public-key-pcrs=11`, and only then may a later release carry the new key. systemd tries each token.
Until built, losing that key means an updated machine needs its recovery key once, so it is held like the release key.

**PCR 11 covers the boot file, not the system partition** (OS-KEYS.md gap 1). Someone with the disk in their hands can change a slot, and
the disk still opens. Verity closes that, not this.

## The hard part: the database

**Not solved by this task, and it blocks real use.** Today the server ships inside the OS image and migrates at start, on the trial boot.
If a version migrates and then fails, the old server meets a newer database. `sqlx` refuses to start on unknown applied migrations, so
rollback could return to a machine whose server does not start. All tests here used the same server binary in every slot, so no
migration ran. U1.3 must land before the first release whose image carries a migration:

- **Always a verified backup first,** on the data partition, with a check that it restores.
- **Migrations stay compatible with the previous version** for one release: add first, remove in a later release. Today nothing enforces this; it needs a CI check.
- **If a migration itself fails,** the update stops and the machine restores the backup before reopening.

## Sizes

See the measured table below. Deltas only if measured download sizes demand it. Offline sites use USB.

## Who runs it

- **Base flaws:** a weekly image rebuild picks up Debian's security updates.
- **Targets:** critical in 72 hours, high in 7 days, medium in 30 (`SECURITY-RELEASE-PROCESS.md`).
- **Publishing** stays with the owner. Auto tags (R2) only start it on a merged version change.

## What the screen says

Settings has an Updates section, read through the setup service: the version running, what waits in one sentence, the last result, and only the
buttons that would work now: **Restart to update…**, **Look for updates**, **Install from a USB stick**, **Try that version again**, **Go back to version X…**.
Restarts ask first. The address and quiet window are set there too. The top bar shows a chip only with something to say: Update ready, Security fix
ready, Last update failed or Updates need attention. It opens Settings.

## Failure table (OS-PRINCIPLES section 7)

"Test" is in `crates/medbrains-os-test/src/update_steps.rs`, on QEMU, unless it says unit (in the crate), or reasoned.

| What fails | Effect | How we notice | What the machine does | Test |
|---|---|---|---|---|
| Unsigned, unknown key, changed manifest | None | Signature, before any payload | Refused, reason on screen, nothing written | `refusals` |
| Payload changed after signing | None | Hash, on the data disk, before writing | Refused, staged copy removed | `refusals` |
| Wrong architecture, older, same, below floor, too big | None | Signed manifest against facts | Refused with the reason | `refusals`, `update_cycle`, unit |
| Attacker replays an old signed bundle | None | Version rules | Refused | `update_cycle` |
| Not enough space, data disk or boot partition | None | `df`, before anything | Refused with the reason | `low_space` |
| A second update or apply at once | Would race | File lock | Second refuses | unit-free: `flock` semantics, reasoned |
| Download stalls or link drops | Install stops | curl's stall limit | Failed, staged copy removed, running system untouched, can be retried | reasoned; same path as a failed fetch |
| Disk fails, image write or read-back wrong | Slot unusable | Hash on the way in, and again from disk, past the cache | Stays `_empty`, no boot entry, reported | reasoned: not injected |
| New system's user numbers differ | Files would change owner | Compared while mounted | Refused; slot stays unnamed | unit, `id_conflicts` |
| Power cut downloading | Partial staged file | Record says fetching at start | Cleared, "interrupted" | `power_cuts_installing` |
| Power cut writing the slot | Half a system in `_empty` | Name is `_empty`; no boot entry | Boots old; slot overwritten next time | `power_cuts_installing` |
| Power cut around each rename | One name or the other (GPT has two checksummed copies) | | Boots old | `power_cuts_installing`, before and after each |
| Power cut with update waiting | None | Record says waiting | Boots old, still waiting | `power_cuts_installing` |
| Power cut publishing the boot file | Old or new name. FAT has no journal: a torn rename could leave a damaged directory entry | | Boots one of them; fsck not automated on the boot partition | Before and after tested; mid-rename **reasoned**, not reachable from a VM |
| Power cut after publishing | New version on trial | Loader counts | Starts new version on trial | `power_cuts_applying` |
| Power cut on each trial start | Starts used up | Loader's count | After 3, old version; "rolled back" | `power_cuts_applying` |
| New version fails health | Would be unusable | Health check | Marks bad, restarts, old version says why, not retried by itself | `failed_health` |
| New version has no working system | Stops in the initrd, at a prompt nobody can use. The first run of this test showed it stayed there | Initrd's emergency target | `medbrains-trial-reboot` restarts it, on a counted boot only, until out of starts | `failed_start` |
| Kernel dies on new version | Never reaches health | `panic=10` | Same | reasoned: same counting |
| Kernel or initrd hangs with no panic | **Stays hung until power is cycled** unless a hardware watchdog was armed by firmware | | A person powers it off; that start was counted | Stated limit |
| A key held down during start, with two boot entries | Boot menu opens and **waits for a person**, so a stuck key or a scanner firing would stop an unattended restart | Seen by accident: our test harness typing on the serial port did this | Stays at the menu | Open. Harness now sends nothing during a start. T1's `timeout 0` does not cover it; `menu-disabled` would, and also removes the hand-held way back. Owner call |
| Health passes, power cut before blessing | Next start counted again | Count still there | Health passes again | reasoned: idempotent |
| Update record damaged | Would forget the floor | Parse fails | Screen says so; no action offered; a person must act | unit |
| Boot partition full or read-only at apply | Apply fails | rename fails | Stays waiting; says failed | reasoned |
| Quiet window typo | Would restart at random | Parse | Refused on save; never open if read | unit |
| Clock wrong or unknown | Window at the wrong hour | chrony | Doesn't apply | `waits_for_quiet`, partly |
| Someone connected in the window | Would drop them | `ss` | Doesn't apply | `waits_for_quiet` |
| New version loses its seal | Prompt nobody answers | Deadline | Old version opens the disk | `seal_prompt_rolls_back` |
| Migration then failure | **Old server may not start on newer database** | Health, on the old slot too | **Not handled. U1.3** | Not tested |
| Release key stolen | Anyone can sign | Outside this machine | Rotation and floor, above | Design |
| Loader or firmware update | Not done by this | | | Out of scope |

## What is proved

Filled in from the run recorded in `docs/DECISIONS.md`.

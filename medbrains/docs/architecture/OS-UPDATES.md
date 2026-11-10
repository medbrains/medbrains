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

**Two slots, one boot file each.** A slot is a read-only system partition and its dm-verity hash tree
(`OS-VERITY.md`). They are named after their version (`medbrains_3.33.0`, `medbrains_3.33.0_verity`), and an empty slot
`_empty`. A boot file (UKI) carries the tree's root hash on its command line, `roothash=…`, and systemd finds the two
partitions by the UUIDs that hash gives them, so a boot file can only start its own system, block for block. Finding the
root by partition type would not do: systemd's `gpt-auto` always takes the newest, which would defeat rollback.

**Install and apply are two steps.** Installing writes the other slot while the machine works, at low priority, and leaves
the boot file in `EFI/MedBrains/`, where the loader never looks. So a power cut or an ordinary restart can't change
the system by surprise. Applying renames the boot file into `EFI/Linux/` as `medbrains-os_<version>+3-0.efi`, and restarts.

**Boot counting is systemd's.** `systemd-boot` lowers the `+3` on each start and skips an entry at zero. `systemd-bless-boot`
removes the count only once `boot-complete.target` is reached, which needs `medbrains-update-health.service`:

- `/var` is on its own partition; firewall, setup service and screen run if enabled; no unit has failed.
- On a main machine also: database, server and TLS front units run, Kanidm if enabled, and `/api/health` says `"status":"ok"` (it answers 200 either way).
- Services get 5 minutes to get there. A failure marks the entry bad and restarts at once, and the old version says why.
- A boot stuck anywhere, health never having run: `medbrains-update-deadline.timer` survives emergency mode, needs neither
  `/var` nor the boot partition, and restarts the machine after 10 minutes. Each start used brings the old slot nearer.

A version that can't reach its own system stops in the initrd, where neither of those run: `os/trial-initrd/` adds one small unit to
the boot file's initrd that restarts from emergency mode, on a counted boot only. `panic=10` restarts a dead kernel. Hardware watchdog as before. `systemd-boot-update.service` is masked: a kernel fix must
not rewrite the boot loader on the way past, the one write here with no second copy. Replacing the loader is not built.

**A new system adopts this machine.** The machine id is kept as the data partition's UUID and given to every system at
start (`OS-VERITY.md`), because a new one would change the DHCP identity and start a new journal folder. Installing refuses a system whose user or group numbers differ, because `/var` keeps numbers, not names.
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

A folder of five files, the same on a USB stick (`medbrains-update/`) and at an address (`<url>/<arch>/`):

| File | What |
|---|---|
| `manifest.json` | Format, version, architecture, floor, oldest version it upgrades from, expiry, security flag, one sentence, hashes and sizes. Unknown fields refused |
| `manifest.sig` | One line per signature: `<key id> <base64>`. Up to 4: an old and a new key, or two people's |
| `root.img.zst` | The system partition, compressed |
| `verity.img.zst` | Its hash tree, compressed. Format 2; a format 1 bundle has none and is refused |
| `boot.efi` | The boot file |

`medbrains-os-bundle` makes them (`keygen`, `extract`, `make`, `refresh`, `sign`). It runs on a build machine and is not in the image.

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

### Against TUF's attacks (U1.5)

[The Update Framework](https://theupdateframework.github.io/specification/latest/#goals-to-protect-against-specific-attacks) lists the
attacks an update system must survive. We **did not adopt TUF metadata**: TUF's four roles, delegations and many targets are for
repositories serving many packages to many publishers; we ship one image per architecture from one publisher, and the Rust client
(`tough`) would add more code than this whole updater. Each attack is closed another way, or is a written limit:

| TUF attack | Here | Proved by |
|---|---|---|
| Arbitrary installation | Ed25519 signature over the manifest, which holds every file's hash | `refusals`: unsigned, wrong key, changed manifest, changed payload |
| Rollback: an old update served again | Only newer than running, never below the floor; the floor rises when a signed update proves good | `refusals` (older, same), `update_cycle` (old signed bundle, below floor), unit tests |
| Indefinite freeze: updates held back | Every manifest carries `expires`; releases re-sign the channel's manifest (`medbrains-os-bundle refresh`) weekly, 30 days by default. An expired one is refused, and the screen shows when the machine last read a signed list | `refusals` (expired), unit test |
| Mix-and-match: files from different releases | One manifest signs the system image and the boot file together | `mixed_refused` |
| Key compromise | Rotation by shipping the next key in an update; **a threshold** (`update-keys/threshold`) so release images can need two keys held by two people | unit tests: rotation, two keys, one key twice |
| Fast-forward: a stolen key signs version 999 | Not closed by a single key: such a bundle installs and its floor strands the machine. The threshold is the answer: one stolen key is not enough | Written limit until release images set threshold 2 (X2) |
| Endless data, slow retrieval | Every file has a signed size, downloads stop at it; a link slower than 1 KB/s for 2 minutes ends | Reasoned; `refusals` (too big) covers the size check |
| Malicious mirror refusing updates | Same as freeze: the screen's "last looked" date stops moving | Visible, not refused: a mirror that answers nothing has nothing to refuse |
| Wrong software (other architecture, other product) | Architecture in the signed manifest; one key set per product | `refusals` (wrong architecture) |
| Extraneous dependencies | Not applicable: one image, nothing fetched beside it | |

**Clock.** Expiry trusts this machine's clock. A clock set far back accepts an expired manifest; one set ahead refuses a good
one, and the screen says so. Time comes from NTS when there is internet (N1.2), and through the main machine for nodes.

### A rolled-back version stays refused (U1.6)

A version that rolled back joins a bounded list of failed versions. The daily timer and the quiet window never install it again;
only a person pressing **Try that version again** does. A newer version installs normally. Red Hat's image mode documents the trap
this avoids: the update timer reapplying a bad image within hours. Proved by `not_retried`: the bad version rolls back, the timer runs
with the channel still offering it, and the machine stays where it is.

### Upgrading in steps, for Kanidm (U1.8)

Kanidm supports each release for four months and upgrades one minor version at a time (feature/os-kanidm's `kanidm-upgrade`
refuses anything else). Whole-image updates would let a machine that missed a quarter jump two minors. So every manifest says
`upgrades_from`: the oldest version that may install it directly. A machine further behind follows that back to the bundle of
that version, kept beside the newest in a folder named after it (`<url>/<arch>/<version>/`, the same on a stick), verifies it on its
own, and installs that first; the next look continues. Bounded to eight steps. Proved by `catches_up_in_order`.

**The release rule:** a release may raise Kanidm by at most one minor, and then sets `upgrades_from` to the release that carried the
minor before. The channel keeps that release while machines may still need it: four months, Kanidm's support window. A health check
waits for `kanidmd.service` on a main machine whenever it is enabled. Not on a node: presets enable it everywhere and its condition
skips it there, so checking it on a node would roll back every good update.

**Not built:** Kanidm's database moves on the new version's first start. Going back afterwards meets a newer database, the same as
PostgreSQL in "The hard part" below; `kanidm-upgrade` keeps a backup and U1.3 must restore it on rollback.

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

**The system partition is now covered too**, through the root hash on the boot file's command line (`OS-VERITY.md`): a changed
slot does not start. **But the seal includes PCR 4, the boot file's own hash, so a new version's first start asks for the recovery
key** (DECISIONS 2026-11-05, after the rows above were tested). The rows "Opens by itself" above predate PCR 4. The fix, a seal for
the new boot file's predicted PCR 4 added before applying, is open (`OS-VERITY.md`, "Open").

### Proposal: no recovery key after an update (must land before any release key)

**The problem.** The seal includes PCR 4, which holds the hash of the boot loader and of the boot file the firmware started
(DECISIONS 2026-11-05, the attack it closes). Every update ships a new boot file, so PCR 4 changes and the first start of every
new version stops at the recovery-key prompt. A hospital cannot have a person type 64 characters after each update, and a
machine that waits there is a ward without a system. Until this is fixed, no release may be signed.

**Fix A, recommended: seal to the predicted PCR 4 before applying.** PCR 4 is not secret or random: it is the SHA-256 chain of the
firmware's `EV_EFI_BOOT_SERVICES_APPLICATION` events, one per binary it started, each the binary's Authenticode hash. The
machine knows all of them except the new boot file's, and that one is a hash of a file it already holds and has verified.

1. At install, after the slot is named and before the boot file is staged: replay the running machine's PCR 4 event log
   (`/sys/kernel/security/tpm0/binary_bios_measurements`), replacing the running boot file's Authenticode digest with the new
   one's. systemd 257 ships the parts: `systemd-pcrlock log` reads and checks the log against the live PCR, `lock-uki` and
   `lock-pe` compute the Authenticode digests. Refuse the install if the replayed log does not reproduce today's PCR 4: an
   unreadable log must not become a guessed seal.
2. Add a second TPM2 token while the disk is open: `systemd-cryptenroll --unlock-tpm2-device=auto --tpm2-device=auto
   --tpm2-pcrs=4:sha256=<predicted>+7 --tpm2-public-key=<key> --tpm2-public-key-pcrs=11`. The old token stays, so a rollback
   or a person going back still opens by itself.
3. When the new version proves good, drop the old token; when it rolls back, drop the new one. At most two tokens, both
   named in the update record, so a power cut at any step leaves a token that opens the disk for whichever version boots.

Cost: about 150 lines in the updater (log replay, Authenticode digest, two `cryptenroll` calls, the record), one new failure
row per step, and x86-64 swtpm tests: update opens by itself, rollback opens by itself, a cut between enrolling and staging opens.
Ruled out: `systemd-pcrlock make-policy` as the whole answer. It moves the seal to an NV-index policy that tolerates listed
variants, a larger change to `disk-setup` and recovery than this needs; its log and digest code is what we reuse.

**Fix B: Secure Boot, then drop PCR 4.** With our key in the firmware's db and Secure Boot on, the firmware refuses an
attacker's boot file and PCR 7 records the policy, so the seal can be PCR 7 plus signed PCR 11 and survives every update.
Needs a key enrolled per machine at installation (or shim with a vendor certificate), a signing key held like the release key
(X2), and a plan for machines whose firmware cannot enrol keys. It also closes the loader-command-line gap in `OS-VERITY.md`.
It is the end state; A is what makes updates usable before every installed machine has it.

Tracked in #5452, linked from #5403 and #5404.

## The hard part: the database

**Not solved by this task, and it blocks real use.** Today the server ships inside the OS image and migrates at start, on the trial boot.
If a version migrates and then fails, the old server meets a newer database. `sqlx` refuses to start on unknown applied migrations, so
rollback could return to a machine whose server does not start. All tests here used the same server binary in every slot, so no
migration ran. U1.3 must land before the first release whose image carries a migration:

- **Always a verified backup first,** on the data partition, with a check that it restores.
- **Migrations stay compatible with the previous version** for one release: add first, remove in a later release. Today nothing enforces this; it needs a CI check.
- **If a migration itself fails,** the update stops and the machine restores the backup before reopening.

## Sizes

Measured on the arm64 debug image of 2026-11-09 (main before this merged):

| Part | Size | Room |
|---|---|---|
| Boot partition | 512 MiB | One boot file is 153 MB. An install removes the other slot's entry before staging the new one, so at most two are there: about 307 MB, leaving about 200 MB. Refused before writing if not |
| Hash tree, each slot | 32 MiB, fixed; the tree over 2 GiB is 16.1 MiB | Refused before writing if a tree would not fit |
| System slot, each | 2 GiB, fixed when the disk is first written | 658 MiB free inside the filesystem. The partition image is the whole slot, so a bundle always fits the other slot; growing past 2 GiB would need a new layout that no update can make, so watch this number each release |
| Data disk | the rest of the disk | Bundle plus 1 GiB kept free, checked before downloading |

Compressed bundle size: not yet measured. Deltas only if measured download sizes demand it. Offline sites use USB.

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
| Power cut writing the slot | Half a system in `_empty` | Name is `_empty`, UUIDs random; no boot entry | Boots old; slot overwritten next time | `power_cuts_installing` |
| System and tree disagree with the boot file's root hash | Would never start | `veritysetup verify` before naming | Fails, slot stays `_empty` | `unsealed_never_named` |
| Slot changed after it was installed | Would run changed code | dm-verity at start | Stops in the initrd, counted starts run out, old version | `changed_slot_rolls_back` |
| Power cut around each rename | One name or UUID or the other (GPT has two checksummed copies) | | Boots old | `power_cuts_installing`, at sfdisk 1, 3, 5, 7 and after 8 |
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

The unit tests in the crate run in CI, including the install-order model with the hash tree (`plan.rs`). The QEMU scenarios
(`update_steps.rs`, `update_power.rs`, `update_verity.rs`) were run on the merged code for the first time on 2026-11-10, on an arm64
debug image with the sealed system partition (`OS-VERITY.md`), and found three bugs in the test harness itself, now fixed: setup's
authenticator step was not answered; every background command was a shell syntax error, so the power-cut scenarios never
installed anything; and scenarios shared one set of firmware variables.

| Scenario | Result |
|---|---|
| refusals, including a changed hash tree | pass |
| update, keep `/var`, go back, update twice | pass |
| USB, failed health, not retried, mixed releases, catches up in order | pass |
| a system its boot file's seal does not match is never named | pass |
| a slot changed after it was installed does not start, and rolls back | pass |
| network cable out, too little space | pass |
| power cut at each install step: downloading, before emptying, half emptied, written and verified, tree named, named, while writing, waiting | **every cut boots the old version, healthy, `/var` unchanged** |
| the same scenario's final step, applying the reinstalled update | **fails: the machine did not restart into the new version** |
| power cut while applying and on trial | **fails: the first start after the cut ran the old version** |
| a security fix waits for a quiet window | **fails: the window's apply did not restart into the new version** |
| a new version that cannot even start | **fails: stays hung after the initrd; `medbrains-has-init` is the fix under test** |

The three apply failures share one symptom and are not yet explained; the update cycle's own apply passes. Until they are, a
release must not ship on this branch. x86-64 with swtpm (`update_sealed.rs`, the disk scenarios) was not run.

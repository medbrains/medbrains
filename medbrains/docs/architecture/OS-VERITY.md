# MedBrains OS: the sealed system partition

Status: built 2026-11-10 (plan T1, "verity"), in review; three update-apply scenarios still fail (`OS-UPDATES.md`, What is proved). The equivalent of macOS's Signed System Volume: the system
partition is read-only and every block of it is checked against a hash the signed boot file carries. A
system changed by anyone, online or with the disk in their hands, does not run. Class A: failure table below.

## Design

**One boot file, one system.** Each A/B slot is two partitions: the system (ext4, 2 GiB, never mounted
writable) and its dm-verity hash tree (32 MiB, the tree is 16.1 MiB). `systemd-repart` computes the tree when
the image is built, and mkosi puts its root hash on the boot file's command line as `roothash=`. The boot
file (UKI) is one signed file, so the root hash is covered by everything that covers the boot file: PCR 11's
signed policy, PCR 4, and the update manifest's signature.

**Found by the hash, not by a name.** `systemd-veritysetup-generator` finds the two partitions by the UUIDs the
root hash gives them, the first half for the system and the second for the tree (Discoverable Partitions
Specification), and opens `/dev/mapper/root`, which the command line mounts read-only. This replaces
`root=PARTLABEL=medbrains_<version>`: a boot file still starts only its own system, and now also only that
system's exact bytes. Labels stay, for the updater and the screen: `medbrains_<v>` and `medbrains_<v>_verity`.

**Tree on the command line, not a signature partition.** A verity signature partition is for images whose root
hash does not travel in a signed boot file. Ours does. Checking such a signature in the kernel needs the
signing certificate in a kernel keyring, which means Secure Boot's db or a kernel we build; neither exists.

**ext4, not erofs.** The device under it is read-only, so ext4 can't be written either way, and the update
tooling (`debugfs`) keeps working. erofs would save space with compression; not needed while a slot has
658 MiB free.

**On corruption: refuse the block, then act on it.** dm-verity returns an I/O error for a block that fails
its check, so changed bytes never run. That alone is not enough: the first image built this way, with one byte
of `/usr/lib/os-release` changed, **started normally** with that one file unreadable (systemd logs "Failed to
read os-release file, ignoring"). So `medbrains-seal.service` (`medbrains-os-update seal`) checks the kernel's
verdict at every start, before the data disk is set up, and udev starts it again for every block the kernel
reports later (`05-medbrains-seal.rules`, dm-verity's `DM_VERITY_ERR_BLOCK_NR` event). A broken seal then:

- on a new version's trial start: fails the trial, and the loader returns to the old version;
- with a usable version in the other slot: goes back to it, recording why;
- with neither: stops everything (emergency target) and says in plain words, on the screen and the serial
  port, that the system may have been changed and must be reinstalled. Patient data stays locked.

The trial health check also refuses a broken or unreadable seal. Not `panic-on-corruption` or
`restart-on-corruption`: on a machine with no other slot that is a restart loop with nothing on the screen.
A boot that fails before the system starts (a bad block in the kernel's own path to the root) stops in the
initrd with a plain message (`medbrains-boot-failed`), and on a counted start restarts, as before.

## The read-only root: what used to be written

Every path the OS writes, and where it lives now. Found by reading every unit and script in `os/`, then
booting with the root read-only and running `make os-test`; `systemctl --failed` and the journal's
"Read-only file system" lines were the check.

| Path | Writer | Now |
|---|---|---|
| `/etc/machine-id` | systemd at first boot; the updater copied it into each new slot | **Kept as the data partition's GPT UUID.** `disk-setup` creates that partition with the first boot's id as its UUID; on every later start the initrd (`initrd-machine-id`) reads it from the boot disk and bind-mounts it over `/etc/machine-id` before the system starts. The image holds an empty file, so systemd makes an id in memory on the first start without treating every start as a first boot. The updater no longer writes into a slot at all |
| `/var` (database, Kanidm, logs, journal, update state, settings, front keys, iwd, chrony, kiosk) | everything | encrypted data partition, as before |
| Network settings | the setup service | `/var/lib/medbrains/network`, copied to `/run/systemd/network` at boot (U2.3, before this) |
| Time zone | the setup service | `/etc/localtime` links to `/var/lib/medbrains-settings/localtime` (before this) |
| Secrets, PostgreSQL configuration | first boot | `/etc/medbrains`, `/etc/postgresql` link into `/var` (before this) |
| `/etc/resolv.conf` | resolved | link into `/run` (before this) |
| `/etc/hosts` | nobody: fixed in the image | unchanged |
| `/tmp` | programs | tmpfs, Debian's default |
| An update's mount of the new slot | the updater | `ro,noload`, to read its user numbers only; one written block would break the seal |

## Updates

A bundle is format 2: `verity.img.zst` beside `root.img.zst`, both hashed in the signed manifest. The updater
takes the root hash from the new boot file's command line, refuses a boot file without one before writing,
and installs in this order (`crates/medbrains-os-update/src/plan.rs`, model-tested at every step):

1. Remove the boot entry of the version in the other slot.
2. Empty the slot: its name to `_empty`, then fresh random UUIDs on both partitions, so no boot file can find
   them while they change, then the tree's name.
3. Write the system, read it back past the cache.
4. Write the tree, read it back.
5. `veritysetup verify` every block against the tree and the boot file's root hash. A slot whose parts
   disagree is never named.
6. Check the new system's user and group numbers, mounted read-only.
7. Name the tree: the UUID its boot file looks for, then its name.
8. Name the system: its UUID, then `medbrains_<v>`, which says the slot is whole.
9. Stage the boot file where the loader does not look.

A power cut between any two writes leaves the old version booting: no boot entry names the slot until step 9,
and even then only after a person applies it. Trial boots, counting and rollback are unchanged.

## The TPM seal

**Unchanged: PCR 4 and 7, and PCR 11 by signature.** The root hash is on the boot file's command line, which
the stub measures into PCR 11 and which is part of the boot file the firmware measures into PCR 4. A boot
file with another root hash is another boot file: the seal already refuses it. Measuring the hash again into a
PCR of its own would add nothing.

**After an update:** verity changes nothing here. PCR 4 holds the boot file's own hash, so a new boot file
changes it, and the data disk asks for its recovery key at the first start of a new version, as it has since
PCR 4 joined the seal (DECISIONS 2026-11-05). Not closed by this work: see "Open".

## What this closes, and what it does not

| Attack | Before | Now |
|---|---|---|
| A file on the system partition changed while the machine is off, then booted in this machine | **Ran, with the disk open**, without a PIN (`known_gap_system_partition_edit_opens`) | **Does not start.** The changed block fails its check, and the seal check stops the start with a plain message, or goes back. Tested on arm64: `tamper`, `changed_slot_rolls_back` |
| A changed system with a recomputed tree, and a boot file carrying the new root hash | — | The boot file changed: PCR 4 and 11 differ and the disk stays locked (`changed_boot_file_stays_locked`) |
| Root, while running, changes a system file | Possible | The device is read-only; a remount is refused. Tested (`the system partition is sealed and read-only`). Writing the raw partition under it is possible for root and is caught at the next read, as above |
| **Our own boot file started with another command line, from a loader entry the attacker adds to the boot partition** | — | **Open without Secure Boot.** systemd-stub accepts a loader's command line when Secure Boot is off and measures it into PCR 12, which the seal leaves out because PCR 12 was unstable (DECISIONS 2026-11-04). PCR 4 and 11 match, so the disk opens for whatever `roothash=` was given. Reasoned from systemd 257's stub, not yet run. Closed by Secure Boot, which makes the stub ignore it, or by refusing to unlock when PCR 12 shows a loader command line |

## Failure table

| What fails | Effect | How we notice | What the machine does | Test |
|---|---|---|---|---|
| A system block changed offline | Would run changed code | dm-verity on read, then the seal check at start | Refuses the block; stops with a message, goes back, or the trial rolls back | `tamper`, `changed_slot_rolls_back` |
| A block changed under a proven, running version | That program reads an I/O error | dm-verity's event, through udev | Goes back to the other slot, or stops and says why | unit (`seal::respond`); reasoned on QEMU |
| The seal can't be read | Not known | `veritysetup` fails | Says so; a trial fails its health check; a proven version carries on: not known is not broken | unit |
| A bundle whose system does not match its boot file | Would never start | `veritysetup verify` before naming | Install fails, slot stays `_empty`, running system untouched | `unsealed_never_named` |
| A boot file without `roothash=` | Would start no system | Read from the staged boot file | Refused before anything is written | unit (`roothash`), reasoned |
| Tree changed in the bundle | | Signed hash | Refused before writing | `refusals` (`tampered-verity`) |
| Power cut emptying or naming the slot | A slot half renamed | No boot entry names it | Boots the old version | `power_cuts_installing`, at sfdisk 1, 3, 5, 7 and after 8 |
| Disk lost the write | Slot unusable | Read-back hash, then verify | Not named | reasoned |
| Data partition missing in the initrd | No id to give | Check in `initrd-machine-id` | systemd makes one in memory (the first start's path) | first boot of every test |
| Disk of another machine plugged in | Could lend its id | Only the boot disk is read | Ignored | reasoned |

## Sizes and time

Measured on the arm64 debug image of 2026-11-10.

| | Before | Now |
|---|---|---|
| Disk image | 4,832,907,264 bytes | 4,900,016,128 bytes: + 64 MiB, the two 32 MiB tree partitions |
| System slot | 2 GiB, 658 MiB free inside | unchanged: the tree has its own partition |
| Hash tree | | 16,916,480 bytes (16.1 MiB) over 2 GiB; fits its 32 MiB partition twice over |
| Bundle | root 370 MB + boot file 146 MB compressed | + `verity.img.zst`, 10.1 MB |
| Install | write + read back 2 GiB | + 16 MiB written and read back, + one full read of the slot by `veritysetup verify` |

Boot time: see "Evidence".

## Open

1. **Recovery key after every update** (PCR 4), #5452. Fix: before applying, add a TPM slot for the new boot file's
   predicted PCR 4 (`systemd-cryptenroll --tpm2-pcrs=4:sha256=<value>+7`, the value computed from the firmware
   event log with the new boot file's Authenticode hash in place of the running one's), and drop the old slot
   once the new version proves good; or Secure Boot, then drop PCR 4.
2. **Loader command line** (above). Secure Boot, or an initrd check of PCR 12.
3. **Secure Boot** itself and a release signing key (plan T1, X2).
4. **A full scan of the slot** on a schedule, so a bad block in a rarely read file is found before it is
   needed (with U2.4).

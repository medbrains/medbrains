//! The writes of an install, one per `plan::Step`, in the order `plan` fixes and its model checks. Nothing
//! here runs before `install` has verified the signature, the version rules, the space and the hashes.

use std::fs;
use std::path::{Path, PathBuf};

use crate::disk::{self, Part, Slots};
use crate::install::Stopped;
use crate::manifest::{self, Manifest};
use crate::plan::Step;
use crate::state::BootFile;
use crate::{owners, paths, pe, verity};

const CMDLINE_SECTION: &str = ".cmdline";
/// The most of a boot file that is read when it is hashed: the boot partition is 512 MiB.
const MAX_BOOT_FILE: u64 = 512 * 1024 * 1024;

/// Boot entries for what is in the inactive slot, and any with no starts left. Never the running one.
pub fn old_boot_entries(slots: &Slots) -> Result<Vec<disk::BootEntry>, String> {
    let old = slots.inactive.version();
    Ok(disk::boot_entries()?
        .into_iter()
        .filter(|entry| !entry.selected)
        .filter(|entry| old == Some(entry.version.as_str()) || entry.tries_left == Some(0))
        .collect())
}

/// Where a version's boot file waits until it is applied.
pub fn staged_boot_path(version: &str) -> PathBuf {
    Path::new(disk::STAGED_BOOT_DIR).join(format!("{version}.efi"))
}

/// Removes any boot file left waiting.
fn remove_staged_boot() -> Result<(), String> {
    match fs::remove_dir_all(disk::STAGED_BOOT_DIR) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("{}: {e}", disk::STAGED_BOOT_DIR)),
    }
}

/// The root hash the new boot file will start its system with. A boot file without one, or whose
/// command line would undo the seal, would start an unsealed system, or none, so it is refused before
/// anything is written. So is one whose slot UUIDs are the running system's: naming the other slot with
/// them would leave two partitions a boot file could start.
fn sealed_roothash(staging: &Path, slots: &Slots) -> Result<String, Stopped> {
    let refused = |why: String| {
        Stopped::Refused(format!(
            "This update's boot file does not seal its system, so it was refused. {why}"
        ))
    };
    let boot =
        fs::read(staging.join(manifest::BOOT_FILE)).map_err(|e| Stopped::Fault(e.to_string()))?;
    let line = pe::section(&boot, CMDLINE_SECTION)
        .ok_or_else(|| refused("It has no command line.".to_owned()))?;
    let line = String::from_utf8_lossy(line);
    let hash = verity::sealed_cmdline(&line).map_err(refused)?;
    let (data, tree) = verity::partition_uuids(hash)
        .ok_or_else(|| refused("Its root hash can't name a slot.".to_owned()))?;
    let running = [slots.active.uuid.as_str(), slots.active_hash.uuid.as_str()];
    if running.contains(&data.as_str()) || running.contains(&tree.as_str()) {
        return Err(refused(
            "It names the running system's own partitions.".to_owned(),
        ));
    }
    Ok(hash.to_owned())
}

/// Checks every boot file on the boot partition that this machine recorded still has the hash it was
/// put there with, before anything there is deleted: a boot partition that changed is not cleaned up.
fn check_boot_files(known: &[BootFile]) -> Result<(), String> {
    for entry in disk::boot_entries()? {
        let Some(want) = known.iter().find(|k| k.version == entry.version) else {
            continue;
        };
        let (have, _) = disk::hash_file(&entry.path, MAX_BOOT_FILE)?;
        if have != want.sha256 {
            return Err(format!(
                "The boot file for version {} is not the one this machine put there, so nothing on \
                 the boot partition was deleted. Call your system administrator.",
                entry.version
            ));
        }
    }
    Ok(())
}

/// Gives a partition a UUID and then a name: the name says what it holds, so it goes last.
fn name(disk: &str, part: &Part, uuid: &str, label: &str) -> Result<(), String> {
    verity::set_uuid(disk, &part.number, &part.path, uuid)?;
    disk::set_label(disk, part, label)
}

/// What one install writes: where, what, and the root hash that names it.
#[derive(Debug)]
pub struct Job<'a> {
    slots: &'a Slots,
    manifest: &'a Manifest,
    staging: &'a Path,
    roothash: String,
    known: &'a [BootFile],
}

impl<'a> Job<'a> {
    /// Prepares the writes for a bundle staged and verified in `staging`, with `known` the boot files
    /// this machine recorded.
    pub fn new(
        slots: &'a Slots,
        manifest: &'a Manifest,
        staging: &'a Path,
        known: &'a [BootFile],
    ) -> Result<Self, Stopped> {
        Ok(Self {
            slots,
            manifest,
            staging,
            roothash: sealed_roothash(staging, slots)?,
            known,
        })
    }

    /// The UUIDs the new boot file looks for: its system partition's and its hash tree's.
    fn uuids(&self) -> Result<(String, String), String> {
        verity::partition_uuids(&self.roothash)
            .ok_or_else(|| "The boot file's root hash can't name a slot.".to_owned())
    }

    /// Marks the slot as holding nothing, its name first so nothing reads it as a version while it
    /// changes, then UUIDs no boot file looks for.
    fn empty(&self) -> Result<(), String> {
        let (disk, data, tree) = (
            &self.slots.disk,
            &self.slots.inactive,
            &self.slots.inactive_hash,
        );
        disk::set_label(disk, data, disk::EMPTY_LABEL)?;
        verity::set_uuid(disk, &data.number, &data.path, &verity::random_uuid()?)?;
        name(disk, tree, &verity::random_uuid()?, disk::EMPTY_LABEL)
    }

    /// Carries out one write.
    pub fn run(&self, step: Step) -> Result<(), String> {
        let (slots, manifest, staging) = (self.slots, self.manifest, self.staging);
        let version = &manifest.version;
        match step {
            Step::RemoveOldBoot => {
                check_boot_files(self.known)?;
                for entry in old_boot_entries(slots)? {
                    fs::remove_file(&entry.path).map_err(|e| e.to_string())?;
                    crate::state::sync_parent(&entry.path).map_err(|e| e.to_string())?;
                }
                remove_staged_boot()?;
                disk::flush_boot_partition()
            }
            Step::EmptySlot => self.empty(),
            Step::WriteSlot => disk::write_slot(
                &staging.join(manifest::ROOT_FILE),
                &slots.inactive.path,
                manifest.root.raw_size,
                &manifest.root.raw_sha256,
            ),
            Step::WriteHash => disk::write_slot(
                &staging.join(manifest::VERITY_FILE),
                &slots.inactive_hash.path,
                manifest.verity.raw_size,
                &manifest.verity.raw_sha256,
            ),
            Step::VerifySlot => verity::verify(
                &slots.inactive.path,
                &slots.inactive_hash.path,
                &self.roothash,
            ),
            Step::CheckOwners => {
                owners::check_owners(&slots.inactive.path, Path::new(paths::SLOT_MOUNT))
            }
            Step::NameHash => name(
                &slots.disk,
                &slots.inactive_hash,
                &self.uuids()?.1,
                &disk::hash_label(version),
            ),
            Step::NameSlot => name(
                &slots.disk,
                &slots.inactive,
                &self.uuids()?.0,
                &disk::slot_label(version),
            ),
            Step::StageBoot => {
                fs::create_dir_all(disk::STAGED_BOOT_DIR).map_err(|e| e.to_string())?;
                disk::copy_flushed(
                    &staging.join(manifest::BOOT_FILE),
                    &staged_boot_path(version),
                )?;
                disk::flush_boot_partition()
            }
        }
    }
}

//! Takes a bundle from its source to the inactive slot. Class A: `docs/architecture/OS-UPDATES.md` has
//! its failure table. Nothing is written to a system or boot partition until the signature, the
//! version rules, the space and both payload hashes have all passed.

use std::fs::{self, File};
use std::path::{Path, PathBuf};

use crate::disk::{self, Slots};
use crate::manifest::{self, Facts, Manifest};
use crate::paths;
use crate::pe;
use crate::plan::{INSTALL_STEPS, Step};
use crate::source::Source;
use crate::state::{Ending, Stage, State, Target};
use crate::version::Version;

const PCR_KEY_SECTION: &str = ".pcrpkey";
/// Releases a machine may be behind and still catch up in one go, one step per restart.
const MAX_STEPS: usize = 8;
/// Where the running boot file's public key is put at boot, when it has one.
const RUNNING_PCR_KEY: &str = "/run/systemd/tpm2-pcr-public-key.pem";

/// Why an install stopped.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Stopped {
    /// The bundle was judged and refused: nothing of it was written.
    Refused(String),
    /// Something went wrong along the way. The running system is untouched.
    Fault(String),
    /// Nothing to do: this machine already runs it, or it is already waiting.
    NothingToDo(String),
}

/// The running version, from the system partition.
pub fn current_version() -> Result<String, String> {
    let text = fs::read_to_string("/usr/lib/os-release").map_err(|e| e.to_string())?;
    os_release_version(&text).ok_or_else(|| "This system has no image version.".to_owned())
}

/// `IMAGE_VERSION` from os-release text.
fn os_release_version(text: &str) -> Option<String> {
    text.lines()
        .find_map(|line| line.strip_prefix("IMAGE_VERSION="))
        .map(|value| value.trim_matches('"').to_owned())
}

/// Seconds since 1970, or 0 if the clock is before that.
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// Holds the one lock, so two installs or an install and an apply can't run together. The kernel
/// drops it when this program ends, however it ends.
pub fn lock() -> Result<File, String> {
    fs::create_dir_all(paths::STATE_DIR).map_err(|e| e.to_string())?;
    let file = File::create(Path::new(paths::STATE_DIR).join("lock")).map_err(|e| e.to_string())?;
    file.try_lock()
        .map_err(|_| "An update step is already running.".to_owned())?;
    Ok(file)
}

/// Empties the staging folder and any boot file waiting in the boot partition's folder.
pub fn clear_staging() -> Result<(), String> {
    match fs::remove_dir_all(paths::STAGING_DIR) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("{}: {e}", paths::STAGING_DIR)),
    }
}

/// Reads and verifies the manifest. Up to here nothing but two small files has been fetched.
fn read_manifest(source: &Source, scratch: &Path) -> Result<Manifest, Stopped> {
    let refused = |words: String| Stopped::Refused(words);
    let bytes = source
        .fetch_small(manifest::MANIFEST_FILE, scratch, manifest::MAX_SMALL_FILE)
        .map_err(refused)?;
    let signatures = source
        .fetch_small(manifest::SIGNATURE_FILE, scratch, manifest::MAX_SMALL_FILE)
        .map_err(|_| refused("This update has no signature, so it was refused.".to_owned()))?;
    let dir = Path::new(paths::KEYS_DIR);
    let (keys, threshold) = (manifest::load_keys(dir), manifest::load_threshold(dir));
    manifest::verify_signature(&bytes, &String::from_utf8_lossy(&signatures), &keys, threshold)
        .map_err(refused)?;
    serde_json::from_slice(&bytes)
        .map_err(|e| refused(format!("This update's description can't be read: {e}")))
}

/// Follows `upgrades_from` back from the newest bundle to the first one this machine may install, so a machine
/// that missed releases catches up one step at a time, in order. Each step is verified on its own. Bounded:
/// a machine further behind than `MAX_STEPS` is told to install an older bundle first.
fn find_installable(
    source: &Source,
    current: &Version,
    scratch: &Path,
) -> Result<(Source, Manifest), Stopped> {
    let (mut source, mut manifest) = (source.clone(), read_manifest(source, scratch)?);
    for _ in 0..MAX_STEPS {
        match Version::parse(&manifest.upgrades_from) {
            Some(from) if *current < from && Version::parse(&manifest.version) > Some(from.clone()) => {
                let step = source.step(&from.to_string());
                manifest = read_manifest(&step, scratch)?;
                source = step;
            }
            _ => break,
        }
    }
    Ok((source, manifest))
}

/// Gathers what the version and space rules need.
fn gather_facts(state: &State, slots: &Slots, retry: bool) -> Result<Facts, String> {
    let current = current_version()?;
    let current = Version::parse(&current)
        .ok_or_else(|| format!("This system's version {current} can't be compared."))?;
    let reclaimed = old_boot_entries(slots)?
        .iter()
        .filter_map(|entry| fs::metadata(&entry.path).ok())
        .map(|meta| meta.len())
        .sum::<u64>();
    Ok(Facts {
        current,
        arch: manifest::this_arch().to_owned(),
        floor: state.floor.as_deref().and_then(Version::parse),
        failed: state.failed.clone(),
        retry,
        slot_bytes: slots.inactive.bytes,
        data_free: disk::free_bytes(paths::STATE_DIR)?,
        esp_free: disk::free_bytes(disk::ESP)?.saturating_add(reclaimed),
        now: now(),
    })
}

/// Boot entries for what is in the inactive slot, and any with no starts left. Never the running one.
fn old_boot_entries(slots: &Slots) -> Result<Vec<disk::BootEntry>, String> {
    let old = slots.inactive.version();
    Ok(disk::boot_entries()?
        .into_iter()
        .filter(|entry| !entry.selected)
        .filter(|entry| old == Some(entry.version.as_str()) || entry.tries_left == Some(0))
        .collect())
}

/// Fetches and checks the payload against the signed hashes, on the data disk, before any slot is
/// touched. A USB stick is copied first too, so it can't change between being checked and being used.
fn stage_payload(source: &Source, manifest: &Manifest, staging: &Path) -> Result<(), Stopped> {
    let check = |name: &str, want_hash: &str, want_size: u64| -> Result<(), Stopped> {
        let to = staging.join(name);
        let changed = || {
            Stopped::Refused(format!(
                "This update was changed after it was signed ({name} does not match), so it was refused."
            ))
        };
        source.fetch(name, &to, want_size).map_err(|e| {
            if e.contains(crate::source::TOO_BIG) {
                changed()
            } else {
                Stopped::Fault(e)
            }
        })?;
        let (hash, size) = disk::hash_file(&to, want_size).map_err(Stopped::Fault)?;
        if hash != want_hash || size != want_size {
            return Err(changed());
        }
        Ok(())
    };
    check(
        manifest::BOOT_FILE,
        &manifest.boot.sha256,
        manifest.boot.size,
    )?;
    check(
        manifest::ROOT_FILE,
        &manifest.root.sha256,
        manifest.root.size,
    )
}

/// True if a boot file carrying `new_key` would still open a disk sealed under `running_key`.
fn seal_allows(running_key: Option<&[u8]>, new_key: Option<&[u8]>) -> bool {
    let trim = |key: &'_ [u8]| String::from_utf8_lossy(key).trim().to_owned();
    match (running_key, new_key) {
        // No key today means the disk is sealed to Secure Boot state alone, or not at all.
        (None, _) => true,
        (Some(running), Some(new)) => trim(running) == trim(new),
        (Some(_), None) => false,
    }
}

/// Refuses a boot file that would leave the data disk asking for its recovery key at the next start.
/// `OS-KEYS.md`: the seal names the key that signed the running boot file, so the new one must carry it.
fn check_seal(staging: &Path) -> Result<(), Stopped> {
    let running = fs::read(RUNNING_PCR_KEY).ok();
    let boot = fs::read(staging.join(manifest::BOOT_FILE)).map_err(|e| Stopped::Fault(e.to_string()))?;
    if seal_allows(running.as_deref(), pe::section(&boot, PCR_KEY_SECTION)) {
        return Ok(());
    }
    Err(Stopped::Refused(
        "This update is signed for boot with a different key, so this machine's data disk would ask \
         for its recovery key after restarting. It was not installed."
            .to_owned(),
    ))
}

/// Carries out one write, in the order `plan` fixes.
fn run_step(step: Step, slots: &Slots, manifest: &Manifest, staging: &Path) -> Result<(), String> {
    match step {
        Step::RemoveOldBoot => {
            for entry in old_boot_entries(slots)? {
                fs::remove_file(&entry.path).map_err(|e| e.to_string())?;
                crate::state::sync_parent(&entry.path).map_err(|e| e.to_string())?;
            }
            remove_staged_boot()
        }
        Step::EmptySlot => disk::set_label(slots, disk::EMPTY_LABEL),
        Step::WriteSlot => disk::write_slot(
            &staging.join(manifest::ROOT_FILE),
            &slots.inactive.path,
            manifest.root.raw_size,
            &manifest.root.raw_sha256,
        ),
        Step::AdoptIdentity => {
            disk::adopt_identity(&slots.inactive.path, Path::new(paths::SLOT_MOUNT))
        }
        Step::LabelSlot => disk::set_label(slots, &disk::slot_label(&manifest.version)),
        Step::StageBoot => {
            fs::create_dir_all(disk::STAGED_BOOT_DIR).map_err(|e| e.to_string())?;
            disk::copy_flushed(
                &staging.join(manifest::BOOT_FILE),
                &staged_boot_path(&manifest.version),
            )
        }
    }
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

/// Judges, stages and writes. State is saved before each stage, so a power cut is reported truthfully.
fn install_checked(source: &Source, retry: bool, state: &mut State) -> Result<String, Stopped> {
    let staging = Path::new(paths::STAGING_DIR);
    clear_staging().map_err(Stopped::Fault)?;
    fs::create_dir_all(staging).map_err(|e| Stopped::Fault(e.to_string()))?;
    let slots = disk::read_slots().map_err(Stopped::Fault)?;
    let running = Version::parse(&current_version().map_err(Stopped::Fault)?)
        .ok_or_else(|| Stopped::Fault("This system's version can't be compared.".to_owned()))?;
    let (source, manifest) = find_installable(source, &running, staging)?;
    let source = &source;
    state.checked = Some(now());
    if state.stage == Stage::Waiting
        && state.target.as_ref().is_some_and(|t| t.version == manifest.version)
    {
        return Err(Stopped::NothingToDo(format!(
            "Version {} is already waiting.",
            manifest.version
        )));
    }
    let facts = gather_facts(state, &slots, retry).map_err(Stopped::Fault)?;
    if Version::parse(&manifest.version).as_ref() == Some(&facts.current) {
        return Err(Stopped::NothingToDo(format!(
            "This machine already runs version {}.",
            manifest.version
        )));
    }
    if let Some(words) = manifest::refusal(&manifest, &facts) {
        return Err(Stopped::Refused(words));
    }
    begin(state, &manifest, Stage::Fetching)?;
    stage_payload(source, &manifest, staging)?;
    check_seal(staging)?;
    begin(state, &manifest, Stage::Writing)?;
    state.previous = None;
    for step in INSTALL_STEPS {
        run_step(step, &slots, &manifest, staging).map_err(Stopped::Fault)?;
    }
    state.stage = Stage::Waiting;
    save(state)?;
    clear_staging().map_err(Stopped::Fault)?;
    Ok(manifest.version)
}

/// Records that `stage` has started for this bundle.
fn begin(state: &mut State, manifest: &Manifest, stage: Stage) -> Result<(), Stopped> {
    state.stage = stage;
    state.target = Some(Target {
        version: manifest.version.clone(),
        min_version: manifest.min_version.clone(),
        security: manifest.security,
        summary: manifest.summary.clone(),
    });
    save(state)
}

/// Saves the record at its usual place.
fn save(state: &State) -> Result<(), Stopped> {
    state
        .save(Path::new(paths::STATE_FILE))
        .map_err(Stopped::Fault)
}

/// Runs an install from `source` and records how it ended. Returns the words for whoever asked.
pub fn install(source: &Source, retry: bool) -> Result<String, Stopped> {
    let _lock = lock().map_err(Stopped::Fault)?;
    let path = Path::new(paths::STATE_FILE);
    let mut state = State::load(path).map_err(Stopped::Fault)?;
    if state.stage == Stage::Applied {
        return Err(Stopped::Refused(
            "The machine is still proving the last update. Try again when it has finished.".to_owned(),
        ));
    }
    let was_waiting = (state.stage == Stage::Waiting).then(|| state.target.clone()).flatten();
    match install_checked(source, retry, &mut state) {
        Ok(version) => Ok(format!(
            "Version {version} is ready. It will be used after the next update restart."
        )),
        Err(stopped) => {
            record_stop(&mut state, was_waiting, &stopped);
            save(&state)?;
            // Best effort: the next start clears this folder too.
            drop(clear_staging());
            Err(stopped)
        }
    }
}

/// Writes how an attempt stopped. A refused bundle leaves a waiting update waiting; a failed write has
/// already destroyed it, so that one ends.
fn record_stop(state: &mut State, was_waiting: Option<Target>, stopped: &Stopped) {
    let version = state.target.as_ref().map_or_else(String::new, |t| t.version.clone());
    let wrote_slot = state.stage == Stage::Writing;
    match stopped {
        Stopped::NothingToDo(_) => {}
        Stopped::Refused(words) if !wrote_slot => {
            state.stage = if was_waiting.is_some() { Stage::Waiting } else { Stage::Idle };
            state.target = was_waiting;
            state.note(&version, Ending::Refused, words, now());
        }
        Stopped::Refused(words) | Stopped::Fault(words) if !wrote_slot => {
            state.stage = if was_waiting.is_some() { Stage::Waiting } else { Stage::Idle };
            state.target = was_waiting;
            state.note(&version, Ending::Failed, words, now());
        }
        Stopped::Refused(words) | Stopped::Fault(words) => {
            state.finish(&version, Ending::Failed, words, now());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Stopped, os_release_version, record_stop, seal_allows};
    use crate::state::{Ending, Stage, State, Target};

    /// A version parts of the machine agree on, in os-release's own quoting.
    #[test]
    fn the_version_is_read_from_os_release() {
        let text = "ID=debian\nIMAGE_ID=\"medbrains-os\"\nIMAGE_VERSION=\"1.2.3\"\n";
        assert_eq!(os_release_version(text).as_deref(), Some("1.2.3"));
        assert_eq!(os_release_version("ID=debian\n"), None);
    }

    /// Requirement: an update must not leave a machine asking for a recovery key by surprise.
    #[test]
    fn a_boot_file_with_another_key_would_lock_a_sealed_disk() {
        assert!(seal_allows(None, None));
        assert!(seal_allows(None, Some(b"new")));
        assert!(seal_allows(Some(b"key\n"), Some(b"key")));
        assert!(!seal_allows(Some(b"key"), Some(b"other")));
        assert!(!seal_allows(Some(b"key"), None));
    }

    /// A target at version 2.
    fn target() -> Target {
        Target {
            version: "2.0.0".to_owned(),
            min_version: "1.0.0".to_owned(),
            security: false,
            summary: String::new(),
        }
    }

    /// A tampered stick must not cancel an update already waiting.
    #[test]
    fn a_refused_bundle_leaves_a_waiting_update_waiting() {
        let mut state = State {
            stage: Stage::Fetching,
            target: Some(Target {
                version: "3.0.0".to_owned(),
                ..target()
            }),
            ..State::default()
        };
        record_stop(
            &mut state,
            Some(target()),
            &Stopped::Refused("tampered".to_owned()),
        );
        assert_eq!(state.stage, Stage::Waiting);
        assert_eq!(state.target, Some(target()));
        assert_eq!(state.last.map(|o| o.result), Some(Ending::Refused));
    }

    /// Once the slot was being written, whatever waited there is gone, and the record must say so.
    #[test]
    fn a_failed_write_ends_the_attempt() {
        let mut state = State {
            stage: Stage::Writing,
            target: Some(target()),
            ..State::default()
        };
        record_stop(&mut state, Some(target()), &Stopped::Fault("io".to_owned()));
        assert_eq!(state.stage, Stage::Idle);
        assert_eq!(state.target, None);
        assert_eq!(state.last.map(|o| o.result), Some(Ending::Failed));
    }
}

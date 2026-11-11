//! What the machine does when its system partition fails its seal check (`OS-VERITY.md`).
//!
//! dm-verity has already refused the changed block; this makes sure the machine does not carry on as if
//! nothing happened, without pulling a working machine out from under the people using it. Run once at
//! every start, before the data disk is set up, and again by udev whenever the kernel reports a block that
//! failed (`seal --running`).
//!
//! - A new version on trial fails its trial at once: nobody depends on it yet.
//! - At start, with nowhere to go back to, the machine stops before the data disk is opened.
//! - At start with an earlier version in the other slot, the check leaves a note on the boot partition
//!   (the record is on the data disk, not open yet) and the start goes on; `reconcile` then goes back, if
//!   that version left today's database schema, or stops.
//! - While a proven version is in use: said loudly on every console and the top bar and recorded, and
//!   acted on at the next start or quiet window, never at once.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::child::{self, USUAL_LIMIT};
use crate::install::{current_version, now};
use crate::state::{Damaged, Ending, State};
use crate::{boot, disk, paths, verity};

/// More consoles than any machine has: `/proc/consoles` is read, so bound it anyway.
const MAX_CONSOLES: usize = 8;
/// The most of a note on the boot partition that is read: it is a few hundred bytes.
const MAX_MARKER: u64 = 4096;

/// Said on the screen and the serial port when there is nowhere to go back to.
pub const STOPPED_WORDS: &str = "MedBrains stopped: the system partition failed its seal check, so it \
    may have been changed. Nothing more will run and patient data stays locked. Call your system \
    administrator: the system must be reinstalled from a MedBrains USB installer.";

/// Said when the earlier version cannot be trusted with today's database.
pub const INCOMPATIBLE_WORDS: &str = "MedBrains stopped: the system partition failed its seal check, \
    and the earlier version on this machine is not known to work with today's database, so it was not \
    started. Nothing more will run. Call your system administrator: reinstall this version from a \
    MedBrains USB installer.";

/// Said, and kept on the top bar, while a damaged system keeps running.
pub const ALERT_WORDS: &str = "MedBrains: this machine's system partition failed its seal check. It \
    keeps running for now. At the next restart or quiet window it goes back to the earlier version, or \
    stops if that is not safe. Call your system administrator.";

/// What to do about the seal, decided from what is known. Kept apart so the choice is tested.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Response {
    /// Intact, or not known: nothing to act on. Not known is logged, never read as broken or fine.
    Carry,
    /// A new version on trial: fail it, and the loader returns to the old one.
    FailTrial,
    /// At start, with an earlier version to go to: leave a note, and let `reconcile` decide once the
    /// record and the schemas can be read.
    Defer,
    /// A proven version, in use: say so loudly and record it; act at the next start or quiet window.
    Alert,
    /// Nowhere to go: stop everything and say why.
    Stop,
}

/// The response to `intact` on a boot that is `on_trial`, checked `at_start` or while running, with
/// `has_previous` saying whether the other slot holds a version to go back to.
pub fn respond(
    intact: Option<bool>,
    on_trial: bool,
    at_start: bool,
    has_previous: bool,
) -> Response {
    match (intact, on_trial, at_start, has_previous) {
        (Some(true) | None, ..) => Response::Carry,
        (Some(false), true, ..) => Response::FailTrial,
        (Some(false), false, false, _) => Response::Alert,
        (Some(false), false, true, true) => Response::Defer,
        (Some(false), false, true, false) => Response::Stop,
    }
}

/// What a seal check at start leaves on the boot partition for `reconcile`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Marker {
    /// The version that was starting, if it could be read.
    pub version: String,
    /// Its system partition's UUID.
    pub uuid: String,
    /// When, in seconds since 1970.
    pub at: u64,
    /// True if it was a proven version, not one on trial.
    pub proven: bool,
    /// The start it was found in.
    pub boot_id: String,
}

/// Says `words` where a person and the logs will see them: every console, the screen and any serial port
/// (`/dev/console` is only the last of them), and the kernel log. Best effort: the action that follows must
/// not wait on a screen.
fn announce(words: &str) {
    let consoles = fs::read_to_string("/proc/consoles").unwrap_or_default();
    for name in consoles
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .take(MAX_CONSOLES)
    {
        if let Ok(mut console) = OpenOptions::new().write(true).open(format!("/dev/{name}")) {
            drop(write!(console, "\r\n{words}\r\n\r\n"));
        }
    }
    if let Ok(mut kmsg) = OpenOptions::new().write(true).open("/dev/kmsg") {
        drop(writeln!(kmsg, "<2>{words}"));
    }
}

/// Writes one critical line to the journal, as the audit trail of what the seal check found and did.
fn audit(line: &str) {
    drop(writeln!(std::io::stderr(), "<2>medbrains-seal: {line}"));
}

/// Leaves `marker` on the boot partition, flushed, for `reconcile`. Best effort: the response must not
/// wait on a boot partition that is itself damaged.
fn write_marker(marker: &Marker) {
    let written = serde_json::to_vec(marker)
        .map_err(|e| e.to_string())
        .and_then(|bytes| {
            crate::state::write_atomically(Path::new(paths::SEAL_MARKER), &bytes)
                .map_err(|e| e.to_string())
        })
        .and_then(|()| disk::flush_boot_partition());
    if let Err(why) = written {
        audit(&format!(
            "the note for the next start could not be written: {why}"
        ));
    }
}

/// The note a seal check at start left, if any. A damaged one is still a sign the seal failed, so it
/// reads as one about an unknown version.
pub fn read_marker() -> Option<Marker> {
    let path = Path::new(paths::SEAL_MARKER);
    let size = fs::metadata(path).ok()?.len();
    let text = (size <= MAX_MARKER).then(|| fs::read(path).ok()).flatten();
    Some(
        text.and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_else(|| Marker {
                version: String::new(),
                uuid: String::new(),
                at: now(),
                proven: false,
                boot_id: String::new(),
            }),
    )
}

/// Removes the note once the record holds it, flushed, so a power cut between the two repeats the
/// recording rather than losing it.
pub fn remove_marker() -> Result<(), String> {
    match fs::remove_file(paths::SEAL_MARKER) {
        Ok(()) => disk::flush_boot_partition(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("{}: {e}", paths::SEAL_MARKER)),
    }
}

/// Puts a note from the boot partition into the record, with an audit line. A trial's note becomes the
/// reason its rollback is reported with; a proven version's is recorded as a damaged slot. Returns true if
/// it is about the system running now, which this start must act on.
pub fn record_marker(state: &mut State, marker: &Marker, current: &str) -> bool {
    audit(&format!(
        "the seal check at start found version {} damaged (slot {}, at {}, on trial: {})",
        marker.version, marker.uuid, marker.at, !marker.proven
    ));
    if !marker.proven {
        state
            .health_reason
            .get_or_insert_with(|| "The system partition failed its seal check.".to_owned());
        return false;
    }
    let shown = if marker.version.is_empty() {
        "unknown"
    } else {
        marker.version.as_str()
    };
    let words = format!("Version {shown} failed its seal check when it started.");
    state.note(&marker.version, Ending::SealFailed, &words, now());
    let here = marker.version == current
        && verity::running_slot_uuid().is_some_and(|uuid| uuid == marker.uuid);
    if here {
        state.damaged = Some(Damaged {
            version: marker.version.clone(),
            uuid: marker.uuid.clone(),
            at: marker.at,
            boot_id: marker.boot_id.clone(),
        });
    }
    here
}

/// True if the record says the system running now is a damaged slot.
pub fn running_slot_damaged(state: &State) -> bool {
    let running = verity::running_slot_uuid();
    state
        .damaged
        .as_ref()
        .is_some_and(|damaged| running.as_deref() == Some(damaged.uuid.as_str()))
}

/// Acts on a damaged running slot: goes back to the earlier version if it left today's database schema,
/// and otherwise stops with a plain message. The damaged slot is recorded, not the version, so the same
/// version can be installed again over it.
pub fn act_on_damage(current: &str) -> Result<(), String> {
    let path = Path::new(paths::STATE_FILE);
    let state = State::load(path)?;
    let previous = boot::previous_version()?;
    if let Some(previous) = previous.filter(|p| state.can_go_back(p, current)) {
        audit(&format!("going back from damaged {current} to {previous}"));
        announce(
            "MedBrains: the system partition failed its seal check, so the machine goes back.",
        );
        return boot::go_back_to(
            &previous,
            "Version CURRENT's system partition failed its seal check, so the machine went back to PREVIOUS. Install CURRENT again to repair it.",
            false,
        );
    }
    audit(&format!(
        "stopping on damaged {current}: no compatible earlier version"
    ));
    let mut state = state;
    state.note(current, Ending::SealFailed, INCOMPATIBLE_WORDS, now());
    drop(state.save(path));
    stop(INCOMPATIBLE_WORDS)
}

/// Stops everything on the emergency target, saying `words` on every console first.
fn stop(words: &str) -> Result<(), String> {
    announce(words);
    child::run("systemctl", &["isolate", "emergency.target"], USUAL_LIMIT)
        .map(|_| ())
        .ok_or_else(|| "systemctl did not answer.".to_owned())
}

/// Records a damaged running slot found while the machine is in use, and says so. Nothing restarts.
fn alert(version: &str) -> Result<(), String> {
    announce(ALERT_WORDS);
    let uuid = verity::running_slot_uuid().unwrap_or_default();
    audit(&format!(
        "version {version} (slot {uuid}) failed its seal check while running"
    ));
    let path = Path::new(paths::STATE_FILE);
    let mut state = State::load(path)?;
    if state.damaged.as_ref().is_some_and(|d| d.uuid == uuid) {
        return Ok(());
    }
    state.damaged = Some(Damaged {
        version: version.to_owned(),
        uuid,
        at: now(),
        boot_id: boot::boot_id(),
    });
    state.note(version, Ending::SealFailed, ALERT_WORDS, now());
    state.save(path)
}

/// Checks the seal and acts on it; `at_start` for the check before the data disk, false for udev's.
pub fn check(at_start: bool) -> Result<(), String> {
    let intact = verity::root_is_intact();
    if intact.is_none() {
        announce("MedBrains: the system partition's seal could not be read.");
    }
    let has_previous = intact == Some(false) && boot::previous_version().ok().flatten().is_some();
    let on_trial = boot::on_trial();
    let response = respond(intact, on_trial, at_start, has_previous);
    // A broken seal can make os-release unreadable; the version is then unknown.
    let version = current_version().unwrap_or_default();
    if at_start && response != Response::Carry {
        write_marker(&Marker {
            version: version.clone(),
            uuid: verity::running_slot_uuid().unwrap_or_default(),
            at: now(),
            proven: !on_trial,
            boot_id: boot::boot_id(),
        });
    }
    match response {
        Response::Carry => Ok(()),
        Response::FailTrial => {
            announce(
                "MedBrains: this new version failed its seal check, so the machine goes back.",
            );
            boot::fail_trial("The system partition failed its seal check.")
        }
        Response::Defer => {
            announce("MedBrains: the system partition failed its seal check. Deciding what to do.");
            Ok(())
        }
        Response::Alert => alert(&version),
        Response::Stop => stop(STOPPED_WORDS),
    }
}

#[cfg(test)]
mod tests {
    use super::{Response, respond};

    /// A broken seal never carries on; an unreadable one never stops a working machine; a machine in
    /// use is never restarted by it; and only a start with nowhere to go stops.
    #[test]
    fn a_broken_seal_is_acted_on_without_pulling_a_machine_in_use() {
        assert_eq!(respond(Some(true), true, true, true), Response::Carry);
        assert_eq!(respond(None, false, false, false), Response::Carry);
        assert_eq!(respond(Some(false), true, true, false), Response::FailTrial);
        assert_eq!(respond(Some(false), true, false, true), Response::FailTrial);
        assert_eq!(respond(Some(false), false, false, true), Response::Alert);
        assert_eq!(respond(Some(false), false, false, false), Response::Alert);
        assert_eq!(respond(Some(false), false, true, true), Response::Defer);
        assert_eq!(respond(Some(false), false, true, false), Response::Stop);
    }
}

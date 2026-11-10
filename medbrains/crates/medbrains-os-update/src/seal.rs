//! What the machine does when its system partition fails its seal check (`OS-VERITY.md`).
//!
//! dm-verity has
//! already refused the changed block; this makes sure the machine does not carry on as if nothing
//! happened. Run once at every start, before the data disk is set up, and again by udev whenever the kernel
//! reports a block that failed.

use std::fs::{self, OpenOptions};
use std::io::Write;

use crate::boot;
use crate::child::{self, USUAL_LIMIT};
use crate::verity;

/// More consoles than any machine has: `/proc/consoles` is read, so bound it anyway.
const MAX_CONSOLES: usize = 8;

/// Said on the screen and the serial port when there is nowhere to go back to.
pub const STOPPED_WORDS: &str = "MedBrains stopped: the system partition failed its seal check, so it \
    may have been changed. Nothing more will run and patient data stays locked. Call your system \
    administrator: the system must be reinstalled from a MedBrains USB installer.";

/// What to do about the seal, decided from what is known. Kept apart so the choice is tested.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Response {
    /// Intact, or not known: nothing to act on. Not known is logged, never read as broken or fine.
    Carry,
    /// A new version on trial: fail it, and the loader returns to the old one.
    FailTrial,
    /// The other slot has a usable version: go back to it.
    GoBack(String),
    /// Nowhere to go: stop everything and say why.
    Stop,
}

/// The response to `intact` on a boot that is `on_trial`, with `previous` the version to go back to.
pub fn respond(intact: Option<bool>, on_trial: bool, previous: Option<String>) -> Response {
    match (intact, on_trial, previous) {
        (Some(true) | None, _, _) => Response::Carry,
        (Some(false), true, _) => Response::FailTrial,
        (Some(false), false, Some(version)) => Response::GoBack(version),
        (Some(false), false, None) => Response::Stop,
    }
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

/// Checks the seal and acts on it.
pub fn check() -> Result<(), String> {
    let intact = verity::root_is_intact();
    if intact.is_none() {
        announce("MedBrains: the system partition's seal could not be read.");
    }
    let previous = if intact == Some(false) {
        boot::previous_version().ok().flatten()
    } else {
        None
    };
    match respond(intact, boot::on_trial(), previous) {
        Response::Carry => Ok(()),
        Response::FailTrial => {
            announce(
                "MedBrains: this new version failed its seal check, so the machine goes back.",
            );
            boot::fail_trial("The system partition failed its seal check.")
        }
        Response::GoBack(version) => {
            announce(
                "MedBrains: the system partition failed its seal check, so the machine goes back.",
            );
            boot::go_back_to(
                &version,
                "Version CURRENT failed its seal check, so the machine went back to PREVIOUS by itself.",
            )
        }
        Response::Stop => {
            announce(STOPPED_WORDS);
            child::run("systemctl", &["isolate", "emergency.target"], USUAL_LIMIT)
                .map(|_| ())
                .ok_or_else(|| "systemctl did not answer.".to_owned())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Response, respond};

    /// A broken seal never carries on; an unreadable one never stops a working machine.
    #[test]
    fn a_broken_seal_goes_back_or_stops_and_nothing_else_does() {
        let one = || Some("1.0.1".to_owned());
        assert_eq!(respond(Some(true), true, one()), Response::Carry);
        assert_eq!(respond(None, false, None), Response::Carry);
        assert_eq!(respond(Some(false), true, None), Response::FailTrial);
        assert_eq!(respond(Some(false), true, one()), Response::FailTrial);
        assert_eq!(
            respond(Some(false), false, one()),
            Response::GoBack("1.0.1".to_owned())
        );
        assert_eq!(respond(Some(false), false, None), Response::Stop);
    }
}

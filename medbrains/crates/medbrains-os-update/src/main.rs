//! The machine's side of updates. Started by systemd units, by the setup service, or by hand in a debug
//! image.
//!
//!     medbrains-os-update install [--retry] [--from <https address or folder>]
//!     medbrains-os-update usb [--retry]
//!     medbrains-os-update apply | go-back | tick
//!     medbrains-os-update reconcile | health | deadline
//!     medbrains-os-update status
//!
//! Exit status: 0 done or nothing to do, 1 failed, 2 refused, 3 bad usage.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use medbrains_os_update::install::{self, Stopped};
use medbrains_os_update::manifest::MANIFEST_FILE;
use medbrains_os_update::source::{self, Source, USB_FOLDER};
use medbrains_os_update::{boot, disk, paths, view};

const REFUSED: u8 = 2;
const BAD_USAGE: u8 = 3;

/// Says one line where the journal and a person at a debug shell will see it.
fn say(line: &str) {
    drop(writeln!(std::io::stderr(), "{line}"));
}

/// Turns how an install stopped into a line and an exit status.
fn finish_install(result: Result<String, Stopped>) -> ExitCode {
    match result {
        Ok(words) => {
            say(&words);
            ExitCode::SUCCESS
        }
        Err(Stopped::NothingToDo(words)) => {
            say(&words);
            ExitCode::SUCCESS
        }
        Err(Stopped::Refused(words)) => {
            say(&format!("refused: {words}"));
            ExitCode::from(REFUSED)
        }
        Err(Stopped::Fault(words)) => {
            say(&format!("failed: {words}"));
            ExitCode::FAILURE
        }
    }
}

/// The configured source, or `None` if this machine was never told where updates come from.
fn configured_source() -> Result<Option<Source>, String> {
    let Ok(text) = fs::read_to_string(paths::URL_FILE) else {
        return Ok(None);
    };
    let ca = Path::new(paths::CA_FILE)
        .exists()
        .then(|| PathBuf::from(paths::CA_FILE));
    let base = format!(
        "{}/{}",
        text.trim().trim_end_matches('/'),
        medbrains_os_update::manifest::this_arch()
    );
    Source::parse(&base, ca).map(Some)
}

/// `install`: from a named place, or the configured address.
fn run_install(args: &[String]) -> ExitCode {
    let retry = args.iter().any(|arg| arg == "--retry");
    let from = args
        .iter()
        .position(|arg| arg == "--from")
        .and_then(|at| args.get(at + 1));
    let source = match from {
        Some(text) => Source::parse(
            text,
            Path::new(paths::CA_FILE)
                .exists()
                .then(|| PathBuf::from(paths::CA_FILE)),
        ),
        None => match configured_source() {
            Ok(Some(source)) => Ok(source),
            Ok(None) => {
                say("No update address is set, so this machine does not look for updates.");
                return ExitCode::SUCCESS;
            }
            Err(words) => Err(words),
        },
    };
    match source {
        Ok(source) => finish_install(install::install(&source, retry)),
        Err(words) => {
            say(&words);
            ExitCode::from(BAD_USAGE)
        }
    }
}

/// `usb`: looks on each removable partition for a bundle, and installs the first it finds. Read-only,
/// and nothing on the stick can run. Bounded: `list_sticks` returns a short list.
fn run_usb(args: &[String]) -> ExitCode {
    let retry = args.iter().any(|arg| arg == "--retry");
    let sticks = match source::list_sticks() {
        Ok(sticks) => sticks,
        Err(words) => {
            say(&format!("failed: {words}"));
            return ExitCode::FAILURE;
        }
    };
    let at = Path::new(paths::USB_MOUNT);
    for stick in &sticks {
        let result = disk::with_mounted(stick, at, "ro,noexec,nosuid,nodev", || {
            let folder = at.join(USB_FOLDER);
            if !folder.join(MANIFEST_FILE).exists() {
                return Ok(None);
            }
            Ok(Some(install::install(&Source::Folder(folder), retry)))
        });
        match result {
            Ok(Some(result)) => return finish_install(result),
            Ok(None) => {}
            Err(words) => say(&format!("{stick}: {words}")),
        }
    }
    say("No USB stick holds an update.");
    ExitCode::from(REFUSED)
}

/// Turns a plain result into a line and an exit status.
fn finish_step(result: Result<(), String>) -> ExitCode {
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(words) => {
            say(&format!("failed: {words}"));
            ExitCode::FAILURE
        }
    }
}

/// `status`: the screen's answer, for a person at a debug shell.
fn run_status() -> ExitCode {
    drop(writeln!(std::io::stdout(), "{}", view::view()));
    ExitCode::SUCCESS
}

/// Picks the action.
fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let rest = args.get(1..).unwrap_or_default();
    match args.first().map(String::as_str) {
        Some("install") => run_install(rest),
        Some("install-retry") => run_install(&["--retry".to_owned()]),
        Some("usb") => run_usb(rest),
        Some("usb-retry") => run_usb(&["--retry".to_owned()]),
        Some("apply") => finish_step(boot::apply()),
        Some("go-back") => finish_step(boot::go_back()),
        Some("tick") => finish_step(boot::tick()),
        Some("reconcile") => finish_step(boot::reconcile()),
        Some("health") => finish_step(boot::health()),
        Some("deadline") => finish_step(boot::deadline()),
        Some("status") => run_status(),
        _ => {
            say(
                "usage: medbrains-os-update install|usb|apply|go-back|tick|reconcile|health|deadline|status",
            );
            ExitCode::from(BAD_USAGE)
        }
    }
}

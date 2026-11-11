//! What happens around a restart: applying a waiting update, proving a new version on its first
//! starts, going back, and the quiet window. Class A: `OS-UPDATES.md` has its failure table.

use std::fs;
use std::path::Path;
use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::child::{self, USUAL_LIMIT};
use crate::disk;
use crate::install::{self, current_version, now};
use crate::paths;
use crate::plan::TRIES;
use crate::state::{Ending, Stage, State};

/// How long a new version gets to pass its checks, unless the setting says otherwise.
const HEALTH_SECONDS: u64 = 300;
/// How much longer a boot may stay on trial, stuck anywhere, before the machine restarts itself.
const DEADLINE_MARGIN_SECONDS: u64 = 300;
const HEALTH_POLL: Duration = Duration::from_secs(5);
const SERVER_HEALTH: &str = "http://127.0.0.1:3000/api/health";
const ROLE_MAIN: &str = "/var/lib/medbrains/config/role-main";
/// Must be running on every machine, whenever they are enabled.
const ALWAYS_UNITS: [&str; 3] = [
    "nftables.service",
    "medbrains-os-setup.service",
    "cage-console.service",
];
/// Must also be running on a main machine, whenever they are enabled. Not on a node: presets enable
/// kanidmd everywhere and its condition skips it on a node, which must not read as a failed update.
const MAIN_ENABLED_UNITS: [&str; 1] = ["kanidmd.service"];
/// Must also be running on a main machine.
const MAIN_UNITS: [&str; 3] = [
    "postgresql@17-main.service",
    "medbrains-server.service",
    "medbrains-front.service",
];
/// Exists only when the loader started this boot from a counted entry.
const BOOT_COUNT_VARIABLE: &str =
    "/sys/firmware/efi/efivars/LoaderBootCountPath-4a67b082-0a4c-41cf-b6c7-440b29bb8c4f";
/// Ports a person or another machine reaches the app on. A connection from elsewhere means in use. Loopback
/// does not count: this machine's own screen and front keep connections to 8443 and 3000 open all the time,
/// so counting them meant a quiet window never came, measured on QEMU.
const IN_USE_FILTER: &str =
    "( sport = :443 or sport = :8443 or sport = :3000 ) and not dst 127.0.0.0/8 and not dst [::1]";

/// Asks a unit's state; the text is the answer, whatever the exit status.
fn unit_answer(verb: &str, unit: &str) -> String {
    child::run("systemctl", &[verb, unit], USUAL_LIMIT).map_or_else(String::new, |done| {
        String::from_utf8_lossy(&done.stdout).trim().to_owned()
    })
}

/// The first reason this machine isn't healthy yet, or `None`. Each row is a real check, and anything
/// that can't be asked counts as not healthy.
fn health_problem() -> Option<String> {
    if crate::verity::root_is_intact() != Some(true) {
        return Some(
            "The system partition failed its seal check, or it could not be read.".to_owned(),
        );
    }
    let root = disk::run_text("findmnt", &["-no", "SOURCE", "/"], USUAL_LIMIT).ok()?;
    let var =
        disk::run_text("findmnt", &["-no", "SOURCE", "/var"], USUAL_LIMIT).unwrap_or_default();
    if var.is_empty() || var == root {
        return Some("The data disk is not mounted.".to_owned());
    }
    if let Some(unit) = stopped_enabled_unit(&ALWAYS_UNITS) {
        return Some(format!("{unit} is not running."));
    }
    let failed = disk::run_text(
        "systemctl",
        &["--failed", "--plain", "--no-legend", "--no-pager"],
        USUAL_LIMIT,
    )
    .unwrap_or_else(|_| "systemctl did not answer".to_owned());
    if !failed.is_empty() {
        return Some(format!("A service failed: {failed}"));
    }
    if Path::new(ROLE_MAIN).exists() {
        return server_problem();
    }
    None
}

/// The first of `units` that is enabled and not running.
fn stopped_enabled_unit<'a>(units: &[&'a str]) -> Option<&'a str> {
    units.iter().copied().find(|unit| {
        unit_answer("is-enabled", unit) == "enabled" && unit_answer("is-active", unit) != "active"
    })
}

/// The first reason the main machine's server isn't healthy, or `None`.
fn server_problem() -> Option<String> {
    if let Some(unit) = stopped_enabled_unit(&MAIN_ENABLED_UNITS) {
        return Some(format!("{unit} is not running."));
    }
    for unit in MAIN_UNITS {
        if unit_answer("is-active", unit) != "active" {
            return Some(format!("{unit} is not running."));
        }
    }
    let answer = disk::run_text(
        "curl",
        &["-sS", "-m", "8", SERVER_HEALTH],
        Duration::from_secs(12),
    );
    match answer {
        Ok(text) if health_says_ok(&text) => None,
        Ok(_) => Some("The server says its database is not working.".to_owned()),
        Err(_) => Some("The server did not answer.".to_owned()),
    }
}

/// True only if the server's health answer says all is well; its status code is 200 either way.
fn health_says_ok(answer: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(answer)
        .ok()
        .and_then(|value| value.get("status")?.as_str().map(|s| s == "ok"))
        .unwrap_or(false)
}

/// A number of seconds from a setting file, for hardware slower than the default allows for.
fn seconds_setting(path: &str, default: u64) -> u64 {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| text.trim().parse().ok())
        .unwrap_or(default)
}

/// True if this boot is still on trial: the loader counted it, and it has not reached
/// `boot-complete.target`. Works with the boot partition and data disk both missing.
pub fn on_trial() -> bool {
    Path::new(BOOT_COUNT_VARIABLE).exists()
        && unit_answer("is-active", "boot-complete.target") != "active"
}

/// Proves a new version. Passing marks it good, so the unit's success lets systemd bless the boot.
/// Failing marks the boot bad and restarts: the old version comes back and reports the reason.
pub fn health() -> Result<(), String> {
    let path = Path::new(paths::STATE_FILE);
    let limit = Duration::from_secs(seconds_setting(paths::HEALTH_SECONDS_FILE, HEALTH_SECONDS));
    let deadline = Instant::now() + limit;
    let mut problem = health_problem();
    // Bounded by the deadline: services get time to start, and restart on their own.
    while problem.is_some() && Instant::now() < deadline {
        sleep(HEALTH_POLL);
        problem = health_problem();
    }
    let Some(reason) = problem else {
        let mut state = State::load(path)?;
        state.mark_good(&current_version()?, now());
        return state.save(path);
    };
    fail_trial(&reason)
}

/// Ends a trial boot that failed: records why, marks the boot bad and restarts, so the old version comes
/// back and says so. `/var` may be the very thing that failed, and the restart must still happen.
pub fn fail_trial(reason: &str) -> Result<(), String> {
    let path = Path::new(paths::STATE_FILE);
    if let Ok(mut state) = State::load(path) {
        state.mark_failed_health(reason);
        drop(state.save(path));
    }
    drop(child::run(
        "/usr/lib/systemd/systemd-bless-boot",
        &["bad"],
        USUAL_LIMIT,
    ));
    disk::run_text("systemctl", &["reboot"], USUAL_LIMIT)?;
    Err(reason.to_owned())
}

/// Run at each start: puts the record right and notes what a person could go back to.
pub fn reconcile() -> Result<(), String> {
    let _lock = install::lock()?;
    let path = Path::new(paths::STATE_FILE);
    let mut state = State::load(path)?;
    let before = state.clone();
    state.reconcile(&current_version()?, on_trial(), now());
    if state.stage == Stage::Idle {
        install::clear_staging()?;
    }
    state.previous = previous_version().ok().flatten();
    if state != before {
        state.save(path)?;
    }
    Ok(())
}

/// The version a person can go back to: what the other slot holds, if it still has a usable boot entry.
pub fn previous_version() -> Result<Option<String>, String> {
    let slots = disk::read_slots()?;
    let Some(version) = slots.inactive.version() else {
        return Ok(None);
    };
    let usable = disk::boot_entries()?
        .iter()
        .any(|entry| entry.version == version && entry.tries_left != Some(0));
    Ok(usable.then(|| version.to_owned()))
}

/// Makes a waiting update the next start, and restarts. The boot file appears last, so a power cut
/// before it changes nothing, and one after it simply starts the new version on trial.
pub fn apply() -> Result<(), String> {
    let _lock = install::lock()?;
    let path = Path::new(paths::STATE_FILE);
    let mut state = State::load(path)?;
    let Some(target) = state
        .target
        .clone()
        .filter(|_| state.stage == Stage::Waiting)
    else {
        return Err("No update is waiting.".to_owned());
    };
    let staged = crate::steps::staged_boot_path(&target.version);
    let name = format!("medbrains-os_{}+{TRIES}-0.efi", target.version);
    let published = Path::new(disk::BOOT_DIR).join(name);
    fs::rename(&staged, &published).map_err(|e| format!("{}: {e}", staged.display()))?;
    crate::state::sync_parent(&published).map_err(|e| e.to_string())?;
    disk::flush_boot_partition()?;
    state.stage = Stage::Applied;
    state.save(path)?;
    disk::run_text("systemctl", &["reboot"], USUAL_LIMIT).map(|_| ())
}

/// A person chose to return to the previous version: the running one is marked as having no starts
/// left, so the loader picks the other. Allowed below the floor: that rule stops installs, not this.
pub fn go_back() -> Result<(), String> {
    let _lock = install::lock()?;
    // A damaged record means a person must look first (OS-UPDATES.md); refuse rather than guess.
    State::load(Path::new(paths::STATE_FILE))?;
    let Some(previous) = previous_version()? else {
        return Err("There is no earlier version on this machine to go back to.".to_owned());
    };
    go_back_to(
        &previous,
        "A person went back from version CURRENT to PREVIOUS.",
    )
}

/// Marks the running entry as having no starts left and restarts into `previous`, recording `words`, in
/// which CURRENT and PREVIOUS stand for the versions.
pub fn go_back_to(previous: &str, words: &str) -> Result<(), String> {
    let path = Path::new(paths::STATE_FILE);
    let entries = disk::boot_entries()?;
    let running = entries
        .iter()
        .find(|entry| entry.selected)
        .ok_or_else(|| "The running boot entry can't be found.".to_owned())?;
    let name = disk::counted_name(&running.path, 0, TRIES)
        .ok_or_else(|| "The running boot entry has an odd name.".to_owned())?;
    let renamed = running.path.with_file_name(name);
    fs::rename(&running.path, &renamed).map_err(|e| e.to_string())?;
    crate::state::sync_parent(&renamed).map_err(|e| e.to_string())?;
    disk::flush_boot_partition()?;
    // A broken seal can make os-release unreadable; the record then names no version.
    let current = current_version().unwrap_or_default();
    if let Ok(mut state) = State::load(path) {
        state.add_failed(&current);
        let words = words
            .replace("CURRENT", &current)
            .replace("PREVIOUS", previous);
        state.finish(&current, Ending::WentBack, &words, now());
        drop(state.save(path));
    }
    disk::run_text("systemctl", &["reboot"], USUAL_LIMIT).map(|_| ())
}

/// The last resort for a trial boot stuck anywhere: a service that hangs, or a prompt nobody answers.
/// Each restart uses one start, so the loader soon returns to the old version.
pub fn deadline() -> Result<(), String> {
    if !on_trial() {
        return Ok(());
    }
    let uptime = fs::read_to_string("/proc/uptime").map_err(|e| e.to_string())?;
    let elapsed = uptime
        .split(['.', ' '])
        .next()
        .and_then(|n| n.parse::<u64>().ok())
        .ok_or_else(|| "/proc/uptime can't be read.".to_owned())?;
    let limit =
        seconds_setting(paths::HEALTH_SECONDS_FILE, HEALTH_SECONDS) + DEADLINE_MARGIN_SECONDS;
    if elapsed < limit {
        return Ok(());
    }
    disk::run_text("systemctl", &["reboot", "--force"], USUAL_LIMIT).map(|_| ())
}

/// A time such as `02:30`, in minutes after midnight.
fn minutes(text: &str) -> Option<u32> {
    let (hours, minutes) = text.trim().split_once(':')?;
    let (hours, minutes): (u32, u32) = (hours.parse().ok()?, minutes.parse().ok()?);
    (hours < 24 && minutes < 60).then_some(hours * 60 + minutes)
}

/// A window such as `02:00-04:30`, as its two ends.
fn parse_window(window: &str) -> Option<(u32, u32)> {
    let (start, end) = window.split_once('-')?;
    Some((minutes(start)?, minutes(end)?))
}

/// True if `window` can be read.
pub fn window_is_valid(window: &str) -> bool {
    parse_window(window).is_some()
}

/// True if `now` lies in a window, which may cross midnight. A window that can't be read is never
/// open: a machine must not restart on a typo.
fn in_window(window: &str, now: &str) -> bool {
    let (Some((start, end)), Some(now)) = (parse_window(window), minutes(now)) else {
        return false;
    };
    if start <= end {
        start <= now && now < end
    } else {
        now >= start || now < end
    }
}

/// True if someone is connected to the app. Not being able to tell counts as in use.
fn machine_in_use() -> bool {
    let done = child::run(
        "ss",
        &["-Htn", "state", "established", IN_USE_FILTER],
        USUAL_LIMIT,
    );
    done.is_none_or(|done| !done.success || !done.stdout.iter().all(u8::is_ascii_whitespace))
}

/// True if chrony trusts the time. Unknown is not trusted: the window is only meaningful with a true clock.
fn clock_is_true() -> bool {
    disk::run_text("chronyc", &["-c", "tracking"], USUAL_LIMIT)
        .is_ok_and(|csv| csv.contains("Normal"))
}

/// Run every few minutes by a timer: applies a waiting update only in the quiet window, with a true
/// clock and nobody connected. A security fix waits like any other, and the screen urges a person.
pub fn tick() -> Result<(), String> {
    let state = State::load(Path::new(paths::STATE_FILE))?;
    if state.stage != Stage::Waiting {
        return Ok(());
    }
    let Ok(window) = fs::read_to_string(paths::WINDOW_FILE) else {
        return Ok(());
    };
    let time = disk::run_text("date", &["+%H:%M"], USUAL_LIMIT)?;
    if in_window(&window, &time) && clock_is_true() && !machine_in_use() {
        return apply();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{health_says_ok, in_window};

    /// The window is what decides a restart with nobody asking, so a bad setting must mean no.
    #[test]
    fn the_window_is_read_strictly_and_crosses_midnight() {
        assert!(in_window("02:00-04:00", "02:00"));
        assert!(in_window("02:00-04:00", "03:59"));
        assert!(!in_window("02:00-04:00", "04:00"));
        assert!(!in_window("02:00-04:00", "01:59"));
        assert!(in_window("23:00-01:00", "23:30"));
        assert!(in_window("23:00-01:00", "00:30"));
        assert!(!in_window("23:00-01:00", "12:00"));
        for bad in ["", "soon", "25:00-26:00", "02:00", "02:60-03:00", "x-y"] {
            assert!(!in_window(bad, "02:30"), "{bad}");
        }
        assert!(!in_window("02:00-04:00", "garbage"));
    }

    /// The health answer is 200 even with the database down, so its status field is what counts.
    #[test]
    fn only_an_ok_status_counts_as_healthy() {
        assert!(health_says_ok(r#"{"status":"ok","postgres":"connected"}"#));
        assert!(!health_says_ok(
            r#"{"status":"degraded","postgres":"disconnected"}"#
        ));
        assert!(!health_says_ok("<html>502</html>"));
        assert!(!health_says_ok(""));
    }
}

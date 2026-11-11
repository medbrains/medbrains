//! What the screen says about updates. Read from the record alone, with no helper programs, so the
//! setup service can answer it on every poll.

use std::fs;
use std::path::Path;

use serde_json::{Value, json};

use crate::install::now;
use crate::state::{Stage, State};
use crate::{manifest, paths, verity};

/// How long a security fix may wait before the screen says so loudly: the target for a critical fix
/// (`SECURITY-RELEASE-PROCESS.md`) is 72 hours, so waiting that long again is already late.
const SECURITY_OVERDUE_SECONDS: u64 = 72 * 60 * 60;

/// Said when the running system failed its seal check and keeps running.
const DAMAGED_WORDS: &str = "This machine's system partition failed its seal check. It keeps running \
    for now; at the next restart or quiet window it goes back to the earlier version, or stops if that \
    is not safe. Call your system administrator.";

/// The running version's line in os-release text.
fn image_version(text: &str) -> Option<&str> {
    text.lines()
        .find_map(|line| line.strip_prefix("IMAGE_VERSION="))
        .map(|value| value.trim_matches('"'))
}

/// One sentence for the state an update is in.
fn headline(state: &State) -> String {
    let target = state.target.as_ref();
    let version = target.map_or("", |t| t.version.as_str());
    match state.stage {
        Stage::Idle => "No update is waiting.".to_owned(),
        Stage::Fetching => format!("Downloading and checking version {version}."),
        Stage::Writing => format!("Installing version {version}. The machine keeps working."),
        Stage::Waiting if target.is_some_and(|t| t.security) => {
            format!(
                "A security fix, version {version}, is ready. Restart when you can: nothing restarts this machine while it is in use."
            )
        }
        Stage::Waiting => format!("Version {version} is ready and waits for a restart."),
        Stage::Applied => format!("Checking that version {version} works."),
    }
}

/// What the screen must say loudly, if anything: the running system failed its seal check, or a
/// security fix has waited past its deadline. `running` is the running slot's UUID.
fn alarm(state: &State, running: Option<&str>, now: u64) -> Option<String> {
    if state
        .damaged
        .as_ref()
        .is_some_and(|damaged| Some(damaged.uuid.as_str()) == running)
    {
        return Some(DAMAGED_WORDS.to_owned());
    }
    let target = state.target.as_ref().filter(|t| t.security)?;
    let ready = target.ready_at.filter(|_| state.stage == Stage::Waiting)?;
    (now.saturating_sub(ready) >= SECURITY_OVERDUE_SECONDS).then(|| {
        format!(
            "A security fix, version {}, has waited more than three days. Restart this machine as soon \
             as you can: nothing restarts it while it is in use.",
            target.version
        )
    })
}

/// The whole answer, from the record and the facts beside it.
fn build_view(
    state: &State,
    current: &str,
    has_keys: bool,
    url: Option<&str>,
    window: Option<&str>,
) -> Value {
    let alarm = alarm(state, verity::running_slot_uuid().as_deref(), now());
    json!({
        "current": current,
        "stage": state.stage,
        "target": state.target.as_ref().map(|t| &t.version),
        "security": state.target.as_ref().is_some_and(|t| t.security && state.stage == Stage::Waiting),
        "summary": state.target.as_ref().map(|t| &t.summary),
        "headline": alarm.clone().unwrap_or_else(|| headline(state)),
        "alarm": alarm,
        "last": state.last,
        "checked": state.checked,
        "previous": state.previous,
        "url": url,
        "window": window,
        "has_keys": has_keys,
        "can_apply": state.stage == Stage::Waiting,
        "can_go_back": state.previous.is_some() && matches!(state.stage, Stage::Idle),
        "can_install": has_keys && matches!(state.stage, Stage::Idle | Stage::Waiting),
    })
}

/// What the screen shows. A record that can't be read is said in words and offers no action: it holds
/// the anti-rollback floor, so nothing may proceed without it.
pub fn view() -> Value {
    let release = fs::read_to_string("/usr/lib/os-release").unwrap_or_default();
    let current = image_version(&release).unwrap_or("unknown");
    let has_keys = !manifest::load_keys(Path::new(paths::KEYS_DIR)).is_empty();
    let setting = |path: &str| {
        fs::read_to_string(path)
            .ok()
            .map(|text| text.trim().to_owned())
    };
    let (url, window) = (setting(paths::URL_FILE), setting(paths::WINDOW_FILE));
    match State::load(Path::new(paths::STATE_FILE)) {
        Ok(state) => build_view(&state, current, has_keys, url.as_deref(), window.as_deref()),
        Err(words) => json!({
            "current": current,
            "stage": "fault",
            "headline": words,
            "url": url,
            "window": window,
            "has_keys": has_keys,
            "can_apply": false,
            "can_go_back": false,
            "can_install": false,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::{SECURITY_OVERDUE_SECONDS, alarm, build_view, headline};
    use crate::state::{Damaged, Stage, State, Target};

    /// A state waiting on version 2.
    fn waiting(security: bool) -> State {
        State {
            stage: Stage::Waiting,
            target: Some(Target {
                version: "2.0.0".to_owned(),
                min_version: "1.0.0".to_owned(),
                security,
                summary: "Fixes a kernel flaw.".to_owned(),
                ..Target::default()
            }),
            ..State::default()
        }
    }

    /// A security fix says so, and says it will not restart a machine in use.
    #[test]
    fn a_security_fix_is_urged_without_a_threat() {
        assert!(headline(&waiting(true)).contains("security fix"));
        assert!(
            headline(&waiting(true)).contains("nothing restarts this machine while it is in use")
        );
        assert!(!headline(&waiting(false)).contains("security"));
    }

    /// A security fix left waiting past its deadline, and a damaged running system, are said loudly;
    /// nothing else is, and a damaged slot that is not running is not.
    #[test]
    fn only_an_overdue_fix_or_a_damaged_running_system_is_loud() {
        let mut state = waiting(true);
        if let Some(target) = state.target.as_mut() {
            target.ready_at = Some(1_000);
        }
        assert_eq!(
            alarm(&state, None, 1_000 + SECURITY_OVERDUE_SECONDS - 1),
            None
        );
        assert!(alarm(&state, None, 1_000 + SECURITY_OVERDUE_SECONDS).is_some());
        let mut ordinary = waiting(false);
        if let Some(target) = ordinary.target.as_mut() {
            target.ready_at = Some(0);
        }
        assert_eq!(alarm(&ordinary, None, u64::MAX), None);
        let damaged = State {
            damaged: Some(Damaged {
                uuid: "a-b".to_owned(),
                ..Damaged::default()
            }),
            ..State::default()
        };
        assert!(alarm(&damaged, Some("a-b"), 0).is_some());
        assert_eq!(alarm(&damaged, Some("c-d"), 0), None);
    }

    /// Controls appear only for what can actually be done now.
    #[test]
    fn controls_follow_the_stage() {
        let view = build_view(&waiting(true), "1.0.0", true, None, None);
        assert_eq!(view["can_apply"], true);
        assert_eq!(view["security"], true);
        assert_eq!(view["can_go_back"], false);
        let idle = State {
            previous: Some("0.9.0".to_owned()),
            ..State::default()
        };
        let view = build_view(&idle, "1.0.0", true, Some("https://mirror"), None);
        assert_eq!(view["can_apply"], false);
        assert_eq!(view["can_go_back"], true);
        assert_eq!(view["can_install"], true);
        let keyless = build_view(&idle, "1.0.0", false, None, None);
        assert_eq!(keyless["can_install"], false);
    }
}

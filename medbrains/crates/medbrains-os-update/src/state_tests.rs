//! Every stage meets every kind of boot. Requirement: a power cut at any step leaves a truthful record.

use super::{Ending, Stage, State, Target, raised_floor};

const STAGES: [Stage; 5] = [
    Stage::Idle,
    Stage::Fetching,
    Stage::Writing,
    Stage::Waiting,
    Stage::Applied,
];

/// An update to version 2.0.0 that declares a floor of 1.5.0.
fn target() -> Target {
    Target {
        version: "2.0.0".to_owned(),
        min_version: "1.5.0".to_owned(),
        security: true,
        summary: String::new(),
        ..Target::default()
    }
}

/// A state at `stage`, with or without a target.
fn at(stage: Stage, with_target: bool) -> State {
    State {
        stage,
        target: with_target.then(target),
        ..State::default()
    }
}

/// Property: a start never leaves a half-done stage behind, and never lies about the running version.
#[test]
fn reconcile_always_ends_in_a_stage_that_is_true() {
    for stage in STAGES {
        for with_target in [false, true] {
            for current in ["1.0.0", "2.0.0"] {
                for on_trial in [false, true] {
                    let mut state = at(stage, with_target);
                    state.reconcile(current, on_trial, 7);
                    assert!(!matches!(state.stage, Stage::Fetching | Stage::Writing));
                    if state.stage == Stage::Applied {
                        assert!(
                            on_trial && current == "2.0.0",
                            "{stage:?} {current} {on_trial}"
                        );
                    }
                    if state.stage == Stage::Waiting {
                        assert_eq!(current, "1.0.0");
                        assert!(with_target);
                    }
                    let mut again = state.clone();
                    again.reconcile(current, on_trial, 8);
                    assert_eq!(again.stage, state.stage, "reconcile must settle at once");
                }
            }
        }
    }
}

/// Booting the old version with the new one applied means it failed, whatever the reason.
#[test]
fn back_on_the_old_version_is_reported_and_not_retried_by_itself() {
    let mut state = at(Stage::Applied, true);
    state.mark_failed_health("The server did not answer.");
    state.reconcile("1.0.0", false, 9);
    assert_eq!(state.stage, Stage::Idle);
    assert_eq!(state.failed, ["2.0.0"]);
    let last = state.last.as_ref();
    assert_eq!(last.map(|o| o.result), Some(Ending::RolledBack));
    assert!(last.is_some_and(|o| o.words.contains("The server did not answer.")));
}

/// The floor rises only when the new version has proved good, so a failed update can't strand a machine.
#[test]
fn the_floor_rises_only_on_success() {
    let mut failed = at(Stage::Applied, true);
    failed.reconcile("1.0.0", false, 1);
    assert_eq!(failed.floor, None);
    let mut good = at(Stage::Applied, true);
    good.reconcile("2.0.0", true, 1);
    assert_eq!(good.floor, None, "still on trial");
    good.mark_good("2.0.0", 2);
    assert_eq!(good.floor.as_deref(), Some("1.5.0"));
}

/// A later, lower or unreadable floor can never lower the one that is held.
#[test]
fn the_floor_never_falls() {
    assert_eq!(
        raised_floor(Some("2.0.0"), Some("1.0.0")).as_deref(),
        Some("2.0.0")
    );
    assert_eq!(
        raised_floor(Some("2.0.0"), Some("junk")).as_deref(),
        Some("2.0.0")
    );
    assert_eq!(raised_floor(Some("2.0.0"), None).as_deref(), Some("2.0.0"));
    assert_eq!(raised_floor(None, Some("1.0.0")).as_deref(), Some("1.0.0"));
}

/// The failed list stays bounded, and a version that later succeeds leaves it.
#[test]
fn the_failed_list_is_bounded_and_forgives_success() {
    let mut state = State::default();
    for n in 0..20 {
        state.add_failed(&format!("1.0.{n}"));
    }
    assert_eq!(state.failed.len(), super::MAX_FAILED);
    state.add_failed("2.0.0");
    state.target = Some(target());
    state.mark_good("2.0.0", 3);
    assert!(!state.failed.iter().any(|v| v == "2.0.0"));
}

/// A saved state reads back the same; a damaged one is a fault, not a blank machine.
#[test]
fn a_damaged_record_is_a_fault_and_not_an_empty_state() {
    let dir = std::env::temp_dir().join(format!("mb-update-state-{}", std::process::id()));
    assert!(std::fs::create_dir_all(&dir).is_ok());
    let path = dir.join("state.json");
    assert_eq!(State::load(&path), Ok(State::default()));
    let state = at(Stage::Waiting, true);
    assert!(state.save(&path).is_ok());
    assert_eq!(State::load(&path), Ok(state));
    assert!(std::fs::write(&path, b"{ not json").is_ok());
    assert!(State::load(&path).is_err());
    assert!(std::fs::remove_dir_all(&dir).is_ok());
}

/// Going back is allowed only to a version known to have left today's database schema; one never
/// recorded, or one that left another, is not.
#[test]
fn going_back_needs_the_same_recorded_schema() {
    let mut state = State::default();
    assert!(!state.can_go_back("1.0.0", "2.0.0"));
    state.record_schema("2.0.0", "20261101");
    assert!(!state.can_go_back("1.0.0", "2.0.0"));
    state.record_schema("1.0.0", "20261001");
    assert!(!state.can_go_back("1.0.0", "2.0.0"));
    state.record_schema("1.0.0", "20261101");
    assert!(state.can_go_back("1.0.0", "2.0.0"));
    for n in 0..20 {
        state.record_schema(&format!("3.0.{n}"), "x");
    }
    assert!(state.schemas.len() <= 8);
}

/// A version that can't be named is never recorded as failed.
#[test]
fn an_unnamed_version_is_not_recorded_as_failed() {
    let mut state = State::default();
    state.add_failed("");
    assert!(state.failed.is_empty());
}

/// Boot file hashes are kept per version and bounded.
#[test]
fn boot_file_hashes_are_kept_per_version() {
    let mut state = State::default();
    state.record_boot_file("1.0.0", "aa");
    state.record_boot_file("1.0.0", "bb");
    assert_eq!(state.boot_file_hash("1.0.0"), Some("bb"));
    for n in 0..10 {
        state.record_boot_file(&format!("2.0.{n}"), "cc");
    }
    assert!(state.boot_files.len() <= 4);
}

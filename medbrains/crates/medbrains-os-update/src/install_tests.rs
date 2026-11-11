//! Tests for how an install records its end and guards the sealed disk.
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
        ..Target::default()
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

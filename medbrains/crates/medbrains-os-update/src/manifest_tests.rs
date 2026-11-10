//! Tests for what a machine may accept. Requirement: `OS-UPDATES.md` rules 1, 2 and 4.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ed25519_dalek::{Signer, SigningKey};

use super::{
    BootImage, DATA_RESERVE, Facts, Manifest, RootImage, TrustedKey, key_counts, load_keys,
    refusal, verify_signature,
};
use crate::version::Version;

const GIB: u64 = 1024 * 1024 * 1024;

/// A signing key from a fixed seed, which is fine in a test and nowhere else.
fn signing(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

/// The trusted form of `key`.
fn trusted(id: &str, key: &SigningKey) -> Vec<TrustedKey> {
    TrustedKey::parse(id, &STANDARD.encode(key.verifying_key().to_bytes()))
        .into_iter()
        .collect()
}

/// A signature line for `manifest`.
fn line(id: &str, key: &SigningKey, manifest: &[u8]) -> String {
    format!("{id} {}\n", STANDARD.encode(key.sign(manifest).to_bytes()))
}

/// A bundle that passes every check against `facts`.
fn manifest() -> Manifest {
    Manifest {
        format: 2,
        version: "1.2.0".to_owned(),
        arch: "arm64".to_owned(),
        min_version: "1.0.0".to_owned(),
        upgrades_from: "1.0.0".to_owned(),
        expires: 2_000,
        security: false,
        summary: String::new(),
        root: RootImage {
            sha256: String::new(),
            size: GIB,
            raw_sha256: String::new(),
            raw_size: 2 * GIB,
        },
        verity: RootImage {
            sha256: String::new(),
            size: GIB / 64,
            raw_sha256: String::new(),
            raw_size: GIB / 64,
        },
        boot: BootImage {
            sha256: String::new(),
            size: GIB / 8,
        },
    }
}

/// A machine with room, on the version given.
fn facts(current: &str) -> Option<Facts> {
    Some(Facts {
        current: Version::parse(current)?,
        arch: "arm64".to_owned(),
        floor: None,
        failed: Vec::new(),
        retry: false,
        slot_bytes: 2 * GIB,
        hash_bytes: GIB / 32,
        data_free: 10 * GIB,
        esp_free: GIB / 4,
        now: 1_000,
    })
}

/// A signature from a trusted key verifies; any change to the bytes, or an untrusted key, does not.
#[test]
fn only_a_trusted_signature_over_the_exact_bytes_passes() {
    let (good, other) = (signing(1), signing(2));
    let keys = trusted("release-1", &good);
    let bytes = b"{\"version\":\"1.2.0\"}";
    let signed = line("release-1", &good, bytes);
    assert_eq!(
        verify_signature(bytes, &signed, &keys, 1),
        Ok(vec!["release-1".to_owned()])
    );
    assert!(verify_signature(b"{\"version\":\"9.9.9\"}", &signed, &keys, 1).is_err());
    assert!(verify_signature(bytes, "", &keys, 1).is_err());
    assert!(verify_signature(bytes, &line("release-1", &other, bytes), &keys, 1).is_err());
    assert!(verify_signature(bytes, &line("unknown", &other, bytes), &keys, 1).is_err());
    assert!(verify_signature(bytes, &signed, &[], 1).is_err());
}

/// Rotation: a bundle signed by old and new keys passes on a machine that trusts either one.
#[test]
fn a_bundle_signed_by_two_keys_passes_on_old_and_new_machines() {
    let (old, new) = (signing(1), signing(2));
    let bytes = b"manifest";
    let both = format!(
        "{}{}",
        line("k-old", &old, bytes),
        line("k-new", &new, bytes)
    );
    assert!(verify_signature(bytes, &both, &trusted("k-old", &old), 1).is_ok());
    assert!(verify_signature(bytes, &both, &trusted("k-new", &new), 1).is_ok());
}

/// The rule that keeps the test key out of the field: without the debug mark, it does not count.
#[test]
fn a_test_key_counts_only_on_a_debug_image() {
    assert!(key_counts("test-2026.pub", true));
    assert!(!key_counts("test-2026.pub", false));
    assert!(key_counts("release-1.pub", false));
    let dir = std::env::temp_dir().join(format!("mb-update-keys-{}", std::process::id()));
    assert!(std::fs::create_dir_all(&dir).is_ok());
    let public = STANDARD.encode(signing(3).verifying_key().to_bytes());
    assert!(std::fs::write(dir.join("test-a.pub"), &public).is_ok());
    assert!(
        load_keys(&dir).is_empty(),
        "a release image must not trust the test key"
    );
    assert!(std::fs::write(dir.join(super::DEBUG_IMAGE_MARK), "").is_ok());
    assert_eq!(load_keys(&dir).len(), 1);
    assert!(std::fs::remove_dir_all(&dir).is_ok());
}

/// One change to a bundle or to the machine's facts.
type Change = fn(&mut Manifest, &mut Facts);

/// Each row is a way to be refused; a bundle that breaks none of them is accepted.
#[test]
fn each_reason_to_refuse_is_applied() {
    let base = facts("1.1.0");
    assert!(base.is_some());
    let Some(base) = base else { return };
    assert_eq!(refusal(&manifest(), &base), None);
    let cases: [(Change, &str); 16] = [
        (|m, f| m.expires = f.now, "run out"),
        (
            |m, _| "1.3.0".clone_into(&mut m.upgrades_from),
            "contradict",
        ),
        (
            |m, _| "1.1.5".clone_into(&mut m.upgrades_from),
            "Install version 1.1.5 first",
        ),
        (|m, _| m.format = 1, "format"),
        (|m, _| "x86-64".clone_into(&mut m.arch), "x86-64"),
        (|m, _| "1.2.0-beta".clone_into(&mut m.version), "unreadable"),
        (|m, _| "1.1.0".clone_into(&mut m.version), "already"),
        (|m, _| "1.0.9".clone_into(&mut m.version), "older"),
        (|m, _| "1.3.0".clone_into(&mut m.min_version), "contradict"),
        (|_, f| f.floor = Version::parse("1.3.0"), "known problems"),
        (|_, f| f.failed = vec!["1.2.0".to_owned()], "failed"),
        (|m, f| m.root.raw_size = f.slot_bytes + 1, "does not fit"),
        (|m, f| m.verity.raw_size = f.hash_bytes + 1, "does not fit"),
        (|m, _| m.verity.raw_size = 0, "does not fit"),
        (
            |m, f| f.data_free = m.root.size + m.verity.size + m.boot.size + DATA_RESERVE - 1,
            "data disk",
        ),
        (|m, f| f.esp_free = m.boot.size, "boot partition"),
    ];
    for (break_it, expected) in cases {
        let (mut m, mut f) = (manifest(), base.clone());
        break_it(&mut m, &mut f);
        let why = refusal(&m, &f).unwrap_or_default();
        assert!(why.contains(expected), "expected {expected}, got: {why}");
    }
}

/// A person may retry a failed version; nobody may install below the floor, even so.
#[test]
fn retry_overrides_only_the_failed_list() {
    let base = facts("1.1.0");
    assert!(base.is_some());
    let Some(mut base) = base else { return };
    base.failed = vec!["1.2.0".to_owned()];
    base.retry = true;
    assert_eq!(refusal(&manifest(), &base), None);
    base.floor = Version::parse("1.3.0");
    assert!(refusal(&manifest(), &base).is_some());
}

/// Anti-rollback, for every combination: anything accepted is newer than current and at the floor or above.
#[test]
fn no_accepted_version_is_ever_old_or_below_the_floor() {
    let versions: Vec<String> = (0..4)
        .flat_map(|a| (0..4).map(move |b| format!("1.{a}.{b}")))
        .collect();
    let mut accepted = 0;
    for current in &versions {
        for floor in &versions {
            for offered in &versions {
                let mut m = manifest();
                m.version.clone_from(offered);
                m.min_version.clone_from(offered);
                let Some(mut f) = facts(current) else {
                    continue;
                };
                f.floor = Version::parse(floor);
                if refusal(&m, &f).is_none() {
                    accepted += 1;
                    let offered = Version::parse(offered);
                    assert!(offered > Version::parse(current) && offered >= Version::parse(floor));
                }
            }
        }
    }
    assert!(accepted > 0, "the rule must not simply refuse everything");
}

/// TUF's stolen-key defence: with a threshold of two, one key alone, even signing twice, is not enough.
#[test]
fn a_threshold_needs_that_many_different_keys() {
    let (first, second) = (signing(1), signing(2));
    let mut keys = trusted("a", &first);
    keys.extend(trusted("b", &second));
    let bytes = b"manifest";
    let one = line("a", &first, bytes);
    let twice = format!("{one}{one}");
    let both = format!("{}{}", line("a", &first, bytes), line("b", &second, bytes));
    assert!(verify_signature(bytes, &one, &keys, 2).is_err());
    assert!(verify_signature(bytes, &twice, &keys, 2).is_err());
    assert_eq!(
        verify_signature(bytes, &both, &keys, 2).map(|ids| ids.len()),
        Ok(2)
    );
}

/// The threshold file can only raise the bar: missing, zero or junk means one.
#[test]
fn the_threshold_is_at_least_one() {
    let dir = std::env::temp_dir().join(format!("mb-update-threshold-{}", std::process::id()));
    assert!(std::fs::create_dir_all(&dir).is_ok());
    assert_eq!(super::load_threshold(&dir), 1);
    for (text, want) in [("2\n", 2), ("0", 1), ("junk", 1)] {
        assert!(std::fs::write(dir.join("threshold"), text).is_ok());
        assert_eq!(super::load_threshold(&dir), want);
    }
    assert!(std::fs::remove_dir_all(&dir).is_ok());
}

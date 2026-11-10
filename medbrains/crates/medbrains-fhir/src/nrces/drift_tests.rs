//! IG version drift. The builders, the rules `profiles.json` holds, the
//! package the HL7 validator gate downloads and the package the fixture
//! extractor reads must all be the one NRCeS release. NRCeS 7.0 is coming
//! (it adds an IPS dependency); when it ships, this fails until every one of
//! them is moved together — re-pin, re-extract, re-validate, review the
//! builders — rather than one drifting quietly.

use serde_json::Value;

use super::{NRCES_IG_CANONICAL, NRCES_IG_VERSION, NRCES_PROFILE_BASE};

const VALIDATOR_GATE: &str = include_str!("../../../../scripts/check_fhir_validator.py");
const FIXTURE_EXTRACTOR: &str = include_str!("../../../../scripts/nrces_profile_fixture.py");

/// What follows the first `marker` in `text`.
fn after<'a>(text: &'a str, marker: &str) -> &'a str {
    text.split_once(marker).map_or("", |(_, rest)| rest)
}

/// The 64-hex sha256 right after `marker` in `text`.
fn pin_after<'a>(text: &'a str, marker: &str) -> &'a str {
    after(text, marker).get(..64).unwrap_or_default()
}

#[test]
fn every_rule_comes_from_the_release_the_builders_declare() {
    let p: Value = serde_json::from_str(include_str!("profiles.json")).unwrap_or_default();
    for section in ["compositions", "bundles"] {
        let rules = p[section].as_object();
        assert!(rules.is_some_and(|r| !r.is_empty()), "{section} is empty");
        for (name, rule) in rules.into_iter().flatten() {
            assert_eq!(rule["version"], NRCES_IG_VERSION, "{section}.{name}");
        }
    }
    let source = p["source"].as_str().unwrap_or_default();
    assert!(
        source.contains(&format!("ndhm.in#{NRCES_IG_VERSION}")),
        "{source}"
    );
}

#[test]
fn the_validator_gate_and_the_extractor_pin_the_same_package() {
    let extractor = pin_after(FIXTURE_EXTRACTOR, "PINNED_SHA256 = \"");
    assert_eq!(
        extractor.len(),
        64,
        "the extractor's pin is not where it was"
    );
    let gate = pin_after(after(VALIDATOR_GATE, "IG = {"), "\"sha256\": \"");
    assert_eq!(
        gate, extractor,
        "the validator gate and the extractor pin different IGs"
    );
    assert!(
        VALIDATOR_GATE.contains(&format!("\"ndhm.in-{NRCES_IG_VERSION}.tgz\"")),
        "the validator gate caches a different IG release"
    );
}

#[test]
fn the_canonical_and_the_profiles_live_under_one_ig() {
    let base = NRCES_PROFILE_BASE.trim_end_matches("StructureDefinition/");
    assert!(
        NRCES_IG_CANONICAL.starts_with(base),
        "{NRCES_IG_CANONICAL} vs {base}"
    );
    assert!(NRCES_IG_CANONICAL.ends_with("/ndhm.in"));
}

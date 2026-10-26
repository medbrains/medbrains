//! Golden bundles for the HL7 validator (`make check-fhir-validator`): with
//! `NRCES_BUNDLE_DIR` set, every bundle a test proves conformant is also
//! written there, named after the test, and the official validator then runs
//! over the directory with the pinned IG package. A bundle written with
//! [`emit_broken`] must be *refused* by the validator — proof the gate bites.

use serde_json::Value;

use super::conformance::violations;

fn write(prefix: &str, bundle: &Value) {
    let Ok(dir) = std::env::var("NRCES_BUNDLE_DIR") else {
        return;
    };
    let thread = std::thread::current();
    let test = thread
        .name()
        .and_then(|n| n.rsplit("::").next())
        .unwrap_or("bundle");
    let profile = bundle["entry"][0]["resource"]["meta"]["profile"][0]
        .as_str()
        .and_then(|p| p.rsplit('/').next())
        .unwrap_or("Bundle");
    let path = format!("{dir}/{prefix}{test}-{profile}.json");
    let body = serde_json::to_vec_pretty(bundle).unwrap_or_default();
    assert!(std::fs::write(&path, body).is_ok(), "cannot write {path}");
}

/// Asserts our structural check passes, then hands the bundle to the validator.
pub(super) fn assert_conformant(bundle: &Value) {
    let v = violations(bundle);
    assert!(v.is_empty(), "violations: {v:#?}\n{bundle:#}");
    write("", bundle);
}

/// A bundle we broke on purpose; the validator run must report errors on it.
pub(super) fn emit_broken(bundle: &Value) {
    write("expect-fail-", bundle);
}

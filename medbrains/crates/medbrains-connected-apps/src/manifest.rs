//! The one manifest every extension carries (RFC-HOSPITAL-OS §8f item 3, §8g).
//!
//! The same document describes a background service, a SMART app, an MCP tool
//! or a WASM block: what it does in one sentence, who publishes it, which
//! permissions it needs, which FHIR resources it reads, which events it wants,
//! which classes of data it touches and where it sends them. The hospital sees
//! exactly this before approving, and the app gets exactly this — nothing the
//! manifest does not say.
//!
//! The published contract is `docs/extensions/manifest.schema.json`; this is
//! its server-side enforcement. Both are exercised by the shared fixtures in
//! `docs/extensions/fixtures/`, so the TypeScript CLI and the server cannot
//! drift on what a valid manifest is.

use std::collections::BTreeSet;

use medbrains_core::clinical_events::ClinicalEventName;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

pub const MANIFEST_VERSION: u32 = 1;

/// The FHIR R4 resources readable in protocol v1, with their permission.
///
/// Each is paired with the permission the existing FHIR API checks for it. A
/// read is a promise the permission must back; the scope is derived, never
/// granted on its own.
pub const READS: &[(&str, &str)] = &[
    ("Patient", permissions::patients::VIEW),
    ("Encounter", permissions::opd::queue::VIEW),
    ("Observation", permissions::lab::orders::VIEW),
];

/// `DataClass` (medbrains-authz) in manifest spelling.
pub const DATA_CLASSES: &[&str] = &[
    "routine",
    "sensitive",
    "identifying",
    "restricted",
    "confidential",
    "sealed",
];

pub const KINDS: &[&str] = &["service", "smart-app", "mcp-tool", "wasm-block"];

const MAX_PERMISSIONS: usize = 50;
const MAX_LIST: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Publisher {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contact: Option<String>,
}

/// One place the extension sends hospital data — the privacy label's core.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Destination {
    pub name: String,
    pub url: String,
    pub purpose: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub manifest_version: u32,
    pub kind: String,
    pub name: String,
    pub purpose: String,
    pub publisher: Publisher,
    pub version: String,
    pub permissions: Vec<String>,
    #[serde(default)]
    pub reads: Vec<String>,
    #[serde(default)]
    pub events: Vec<String>,
    pub data_classes: Vec<String>,
    #[serde(default)]
    pub sends_data_to: Vec<Destination>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(default)]
    pub redirect_uris: Vec<String>,
    /// For MCP tools and WASM blocks: the call's input and output.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<serde_json::Value>,
}

impl Manifest {
    /// SMART-style scopes for the token response: the permissions, plus one
    /// `system/<Resource>.read` per declared read.
    #[must_use]
    pub fn scopes(&self) -> Vec<String> {
        let mut scopes = self.permissions.clone();
        scopes.extend(self.reads.iter().map(|r| format!("system/{r}.read")));
        scopes
    }
}

fn is_permission_code(code: &str) -> bool {
    let segment_ok = |p: &str| {
        !p.is_empty()
            && p.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    };
    code.starts_with(|c: char| c.is_ascii_lowercase())
        && code.contains('.')
        && code.split('.').all(segment_ok)
}

fn is_semver(v: &str) -> bool {
    let core = v.split(['-', '+']).next().unwrap_or_default();
    let nums: Vec<&str> = core.split('.').collect();
    nums.len() == 3
        && nums
            .iter()
            .all(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()))
}

fn is_https(url: &str) -> bool {
    url.strip_prefix("https://")
        .is_some_and(|rest| !rest.is_empty() && !rest.contains(char::is_whitespace))
}

fn text(errors: &mut Vec<String>, field: &str, value: &str, max: usize) {
    let len = value.trim().chars().count();
    if len == 0 || len > max {
        errors.push(format!("{field} must be 1–{max} characters"));
    }
}

fn unique(errors: &mut Vec<String>, field: &str, items: &[String]) {
    if items.iter().collect::<BTreeSet<_>>().len() != items.len() {
        errors.push(format!("{field} lists something twice"));
    }
}

/// Parse and check a manifest. Every problem is reported at once, in words a
/// developer can act on, so a fix is one round trip, not one per mistake.
///
/// # Errors
/// The list of problems, or the parse error as a one-item list.
pub fn validate(raw: &serde_json::Value) -> Result<Manifest, Vec<String>> {
    let m: Manifest = serde_json::from_value(raw.clone()).map_err(|e| vec![e.to_string()])?;
    let mut errors = Vec::new();
    check_identity(&m, &mut errors);
    check_access(&m, &mut errors);
    check_privacy(&m, &mut errors);
    if errors.is_empty() {
        Ok(m)
    } else {
        Err(errors)
    }
}

/// Who it is: kind, name, purpose, publisher, version.
fn check_identity(m: &Manifest, errors: &mut Vec<String>) {
    if m.manifest_version != MANIFEST_VERSION {
        errors.push(format!("manifestVersion must be {MANIFEST_VERSION}"));
    }
    if !KINDS.contains(&m.kind.as_str()) {
        errors.push(format!("kind must be one of {}", KINDS.join(", ")));
    }
    text(errors, "name", &m.name, 80);
    text(errors, "purpose", &m.purpose, 200);
    if m.purpose.contains('\n') {
        errors.push("purpose must be one sentence".to_owned());
    }
    text(errors, "publisher.name", &m.publisher.name, 120);
    if m.publisher.url.as_deref().is_some_and(|u| !is_https(u)) {
        errors.push("publisher.url must be https".to_owned());
    }
    if !is_semver(&m.version) {
        errors.push("version must be semantic, like 1.2.0".to_owned());
    }
}

/// What it may do: permissions, FHIR reads, events.
fn check_access(m: &Manifest, errors: &mut Vec<String>) {
    if m.permissions.is_empty() || m.permissions.len() > MAX_PERMISSIONS {
        errors.push(format!("permissions must list 1–{MAX_PERMISSIONS} codes"));
    }
    unique(errors, "permissions", &m.permissions);
    for p in &m.permissions {
        if !is_permission_code(p) {
            errors.push(format!(
                "'{p}' is not a permission code (like patients.view)"
            ));
        }
    }

    unique(errors, "reads", &m.reads);
    for r in &m.reads {
        match READS.iter().find(|(name, _)| name == r) {
            None => errors.push(format!(
                "reads: '{r}' is not readable in protocol v1 (Patient, Encounter, Observation)"
            )),
            Some((_, needs)) if !m.permissions.iter().any(|p| p == needs) => {
                errors.push(format!("reads {r} needs the permission {needs}"));
            }
            Some(_) => {}
        }
    }

    unique(errors, "events", &m.events);
    for e in &m.events {
        if e.parse::<ClinicalEventName>().is_err() {
            errors.push(format!("'{e}' is not an event MedBrains sends"));
        }
    }
    if !m.events.is_empty() && m.webhook_url.is_none() {
        errors.push("events need a webhookUrl to deliver them to".to_owned());
    }
    if m.webhook_url.as_deref().is_some_and(|u| !is_https(u)) {
        errors.push("webhookUrl must be https".to_owned());
    }
}

/// The privacy label: data classes, destinations, URIs, schemas.
fn check_privacy(m: &Manifest, errors: &mut Vec<String>) {
    if m.data_classes.is_empty() {
        errors.push("dataClasses must name at least one class".to_owned());
    }
    unique(errors, "dataClasses", &m.data_classes);
    for c in &m.data_classes {
        if !DATA_CLASSES.contains(&c.as_str()) {
            errors.push(format!(
                "dataClasses: '{c}' must be one of {}",
                DATA_CLASSES.join(", ")
            ));
        }
    }

    if (!m.reads.is_empty() || !m.events.is_empty()) && m.sends_data_to.is_empty() {
        errors.push("sendsDataTo must say where the data it reads goes".to_owned());
    }
    if m.sends_data_to.len() > MAX_LIST
        || m.redirect_uris.len() > MAX_LIST
        || m.events.len() > MAX_LIST * 5
    {
        errors.push(format!(
            "lists are capped (sendsDataTo and redirectUris at {MAX_LIST})"
        ));
    }
    for (i, d) in m.sends_data_to.iter().enumerate() {
        text(errors, &format!("sendsDataTo[{i}].name"), &d.name, 120);
        text(
            errors,
            &format!("sendsDataTo[{i}].purpose"),
            &d.purpose,
            200,
        );
        if !is_https(&d.url) {
            errors.push(format!("sendsDataTo[{i}].url must be https"));
        }
    }
    for u in &m.redirect_uris {
        if !is_https(u) {
            errors.push(format!("redirect URI '{u}' must be https"));
        }
    }
    for (field, schema) in [
        ("inputSchema", &m.input_schema),
        ("outputSchema", &m.output_schema),
    ] {
        if schema.as_ref().is_some_and(|s| !s.is_object()) {
            errors.push(format!("{field} must be a JSON Schema object"));
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use std::path::PathBuf;

    use super::validate;

    fn fixtures(dir: &str) -> Vec<(String, serde_json::Value)> {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docs/extensions/fixtures")
            .join(dir);
        let mut out: Vec<_> = std::fs::read_dir(&root)
            .expect("fixtures dir")
            .map(|e| e.unwrap().path())
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .map(|p| {
                let raw = std::fs::read_to_string(&p).unwrap();
                (p.display().to_string(), serde_json::from_str(&raw).unwrap())
            })
            .collect();
        out.sort_by(|a, b| a.0.cmp(&b.0));
        assert!(!out.is_empty(), "no fixtures in {dir}");
        out
    }

    #[test]
    fn every_valid_fixture_is_accepted() {
        for (path, raw) in fixtures("valid") {
            assert!(validate(&raw).is_ok(), "{path}: {:?}", validate(&raw).err());
        }
    }

    #[test]
    fn every_invalid_fixture_is_refused_for_the_reason_it_names() {
        // Each invalid fixture carries `"$expect": "<substring of an error>"`,
        // removed before validation, so a fixture cannot pass for the wrong
        // reason.
        for (path, mut raw) in fixtures("invalid") {
            // `$serverOnly` marks a rule only the server can check (event
            // names); the offline CLI skips those fixtures, the server must not.
            if let Some(o) = raw.as_object_mut() {
                o.remove("$serverOnly");
            }
            let expect = raw
                .as_object_mut()
                .and_then(|o| o.remove("$expect"))
                .and_then(|v| v.as_str().map(str::to_owned))
                .expect("$expect");
            let errors = validate(&raw).expect_err(&path);
            assert!(
                errors.iter().any(|e| e.contains(&expect)),
                "{path}: wanted '{expect}', got {errors:?}"
            );
        }
    }

    #[test]
    fn scopes_are_permissions_plus_derived_fhir_reads() {
        let (_, raw) = fixtures("valid").into_iter().next().unwrap();
        let m = validate(&raw).unwrap();
        let scopes = m.scopes();
        assert!(m.permissions.iter().all(|p| scopes.contains(p)));
        for r in &m.reads {
            assert!(scopes.contains(&format!("system/{r}.read")));
        }
    }
}

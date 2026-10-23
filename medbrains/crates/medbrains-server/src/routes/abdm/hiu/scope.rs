//! What a consent allows, decided without a database: ABDM's purpose codes
//! and record types, the window a grant narrows to, and whether one pushed
//! entry decrypts, matches its checksum, is a FHIR bundle and falls inside
//! the consent. Anything outside is refused, never stored.

use std::collections::BTreeSet;

use chrono::{DateTime, FixedOffset, NaiveDate, Utc};
use medbrains_crypto::fidelius::{self, KeyMaterial};
use serde_json::Value;

/// ABDM's consent purposes (v3), with the text the consent manager shows.
pub const PURPOSES: [(&str, &str); 6] = [
    ("CAREMGT", "Care Management"),
    ("BTG", "Break the Glass"),
    ("PUBHLTH", "Public Health"),
    ("HPAYMT", "Healthcare Payment"),
    ("DSRCH", "Disease Specific Healthcare Research"),
    ("PATRQT", "Self Requested"),
];

/// ABDM's health-information types.
pub const HI_TYPES: [&str; 8] = [
    "OPConsultation",
    "Prescription",
    "DiagnosticReport",
    "DischargeSummary",
    "ImmunizationRecord",
    "HealthDocumentRecord",
    "WellnessRecord",
    "Invoice",
];

/// `NRCeS` Composition profiles, by the HI type each one carries.
const PROFILE_HI_TYPES: [(&str, &str); 8] = [
    ("OPConsultRecord", "OPConsultation"),
    ("PrescriptionRecord", "Prescription"),
    ("DiagnosticReportRecord", "DiagnosticReport"),
    ("DischargeSummaryRecord", "DischargeSummary"),
    ("ImmunizationRecord", "ImmunizationRecord"),
    ("HealthDocumentRecord", "HealthDocumentRecord"),
    ("WellnessRecord", "WellnessRecord"),
    ("InvoiceRecord", "Invoice"),
];
/// Entries looked at for the Composition; `NRCeS` puts it first.
const COMPOSITION_SCAN: usize = 5;
/// Indian Standard Time, the calendar record dates are kept in.
const IST_SECONDS: i32 = 19_800;

#[must_use]
pub fn purpose_text(code: &str) -> Option<&'static str> {
    PURPOSES.iter().find(|(c, _)| *c == code).map(|(_, t)| *t)
}

/// The requested types, each known and named once; `None` when any is
/// unknown or none is given.
#[must_use]
pub fn clean_hi_types(types: &[String]) -> Option<Vec<String>> {
    let set: BTreeSet<&str> = types.iter().map(String::as_str).collect();
    let known = !set.is_empty() && set.iter().all(|t| HI_TYPES.contains(t));
    known.then(|| set.into_iter().map(str::to_owned).collect())
}

/// What a consent covers: record types, dates and how long a copy is kept.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Window {
    pub hi_types: Vec<String>,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub erase_at: DateTime<Utc>,
}

/// What may be kept: the grant, never wider than what was asked. `None`
/// when nothing of the request survives.
#[must_use]
pub fn narrow(asked: &Window, granted: &Window) -> Option<Window> {
    let hi_types: Vec<String> = granted
        .hi_types
        .iter()
        .filter(|t| asked.hi_types.contains(t))
        .cloned()
        .collect();
    let (from, to) = (asked.from.max(granted.from), asked.to.min(granted.to));
    (!hi_types.is_empty() && from <= to).then(|| Window {
        hi_types,
        from,
        to,
        erase_at: asked.erase_at.min(granted.erase_at),
    })
}

/// The HI type a bundle's Composition declares through its `NRCeS` profile.
#[must_use]
pub fn hi_type_of(bundle: &Value) -> Option<&'static str> {
    let composition = bundle["entry"]
        .as_array()?
        .iter()
        .take(COMPOSITION_SCAN)
        .map(|e| &e["resource"])
        .find(|r| r["resourceType"] == "Composition")?;
    composition["meta"]["profile"]
        .as_array()?
        .iter()
        .filter_map(Value::as_str)
        .filter_map(|p| p.rsplit('/').next())
        .find_map(|name| {
            PROFILE_HI_TYPES
                .iter()
                .find(|(profile, _)| *profile == name)
                .map(|(_, t)| *t)
        })
}

fn ist_date(t: DateTime<Utc>) -> Option<NaiveDate> {
    FixedOffset::east_opt(IST_SECONDS).map(|ist| t.with_timezone(&ist).date_naive())
}

/// The day the record is of: its Composition's `date`, date-only or full.
fn record_date(bundle: &Value) -> Option<NaiveDate> {
    let raw = bundle["entry"][0]["resource"]["date"].as_str()?;
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").ok().or_else(|| {
        DateTime::parse_from_rfc3339(raw)
            .ok()
            .and_then(|t| ist_date(t.into()))
    })
}

/// The consented scope one pushed entry must fall inside.
#[derive(Debug, Clone)]
pub struct Scope {
    pub care_context_refs: Vec<String>,
    pub hi_types: Vec<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

impl Scope {
    fn covers(&self, reference: &str, hi_type: &str, bundle: &Value) -> bool {
        let dated_inside = record_date(bundle).is_none_or(|day| {
            self.from.and_then(ist_date).is_none_or(|f| day >= f)
                && self.to.and_then(ist_date).is_none_or(|t| day <= t)
        });
        self.care_context_refs.iter().any(|r| r == reference)
            && self.hi_types.iter().any(|t| t == hi_type)
            && dated_inside
    }
}

/// One entry, decrypted and checked, ready to keep.
#[derive(Debug, Clone)]
pub struct Received {
    pub reference: String,
    pub hi_type: String,
    pub checksum: String,
    pub bundle: Value,
}

/// Why an entry was not kept, for ABDM's `statusResponses`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Refusal {
    pub reference: String,
    pub reason: &'static str,
}

/// Decrypt one pushed entry to our key and check it. `sender` is the HIP's
/// (public key, nonce) from the push's key material.
///
/// # Errors
/// A [`Refusal`] naming why: no content, does not decrypt, checksum
/// mismatch, not a FHIR bundle, or outside the consent.
pub fn open_entry(
    entry: &Value,
    ours: &KeyMaterial,
    sender: (&str, &str),
    scope: &Scope,
) -> Result<Received, Refusal> {
    let reference = entry["careContextReference"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let refuse = |reason| Refusal {
        reference: reference.clone(),
        reason,
    };
    // A `link` entry arrives here with its content already fetched (`link`).
    let content = entry["content"]
        .as_str()
        .ok_or_else(|| refuse("The entry carries no content"))?;
    let plain = fidelius::decrypt(content, ours, sender.0, sender.1)
        .map_err(|_| refuse("Could not be decrypted with this request's key"))?;
    let expected =
        fidelius::checksum(&plain).map_err(|_| refuse("Checksum could not be computed"))?;
    let given = entry["checksum"].as_str().unwrap_or_default();
    if !given.eq_ignore_ascii_case(&expected) {
        return Err(refuse("Checksum does not match the content"));
    }
    let bundle: Value =
        serde_json::from_str(&plain).map_err(|_| refuse("Content is not a FHIR bundle"))?;
    if bundle["resourceType"] != "Bundle" {
        return Err(refuse("Content is not a FHIR bundle"));
    }
    let only = match scope.hi_types.as_slice() {
        [one] => Some(one.clone()),
        _ => None,
    };
    let hi_type = hi_type_of(&bundle)
        .map(str::to_owned)
        .or(only)
        .ok_or_else(|| refuse("Record type not recognised"))?;
    if !scope.covers(&reference, &hi_type, &bundle) {
        return Err(refuse("Outside what the patient consented to"));
    }
    Ok(Received {
        reference,
        hi_type,
        checksum: expected,
        bundle,
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use chrono::{TimeZone, Utc};
    use medbrains_crypto::fidelius;
    use serde_json::{Value, json};

    use super::{Scope, Window, clean_hi_types, hi_type_of, narrow, open_entry, purpose_text};

    fn bundle(profile: &str, date: &str) -> Value {
        json!({ "resourceType": "Bundle", "type": "document", "entry": [{ "resource": {
            "resourceType": "Composition", "date": date,
            "meta": { "profile": [format!("https://nrces.in/ndhm/fhir/r4/StructureDefinition/{profile}")] } } }] })
    }

    fn scope() -> Scope {
        Scope {
            care_context_refs: vec!["OPC-1".into()],
            hi_types: vec!["OPConsultation".into(), "Prescription".into()],
            from: Some(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap()),
            to: Some(Utc.with_ymd_and_hms(2024, 12, 31, 0, 0, 0).unwrap()),
        }
    }

    fn push(
        plain: &str,
        checksum: &str,
        reference: &str,
    ) -> (Value, fidelius::KeyMaterial, fidelius::KeyMaterial) {
        let (hip, hiu) = (fidelius::generate().unwrap(), fidelius::generate().unwrap());
        let content = fidelius::encrypt(plain, &hip, &hiu.public_key, &hiu.nonce).unwrap();
        let entry =
            json!({ "content": content, "checksum": checksum, "careContextReference": reference });
        (entry, hip, hiu)
    }

    #[test]
    fn purposes_and_types_are_abdms() {
        assert_eq!(purpose_text("CAREMGT"), Some("Care Management"));
        assert_eq!(purpose_text("caremgt"), None);
        let asked = vec![
            "Prescription".to_owned(),
            "OPConsultation".into(),
            "Prescription".into(),
        ];
        assert_eq!(
            clean_hi_types(&asked).unwrap(),
            ["OPConsultation", "Prescription"]
        );
        assert!(clean_hi_types(&["Xray".to_owned()]).is_none());
        assert!(clean_hi_types(&[]).is_none());
    }

    #[test]
    fn a_grant_never_widens_the_request() {
        let day = |m| Utc.with_ymd_and_hms(2024, m, 1, 0, 0, 0).unwrap();
        let asked = Window {
            hi_types: vec!["OPConsultation".into()],
            from: day(1),
            to: day(6),
            erase_at: day(9),
        };
        let granted = Window {
            hi_types: vec!["OPConsultation".into(), "Invoice".into()],
            from: day(2),
            to: day(12),
            erase_at: day(12),
        };
        let kept = narrow(&asked, &granted).unwrap();
        assert_eq!(kept.hi_types, ["OPConsultation"]);
        assert_eq!(
            (kept.from, kept.to, kept.erase_at),
            (day(2), day(6), day(9))
        );
        let other = Window {
            hi_types: vec!["Invoice".into()],
            ..granted
        };
        assert!(narrow(&asked, &other).is_none());
    }

    #[test]
    fn the_composition_profile_names_the_type() {
        assert_eq!(
            hi_type_of(&bundle("PrescriptionRecord", "2024-03-01")),
            Some("Prescription")
        );
        assert_eq!(hi_type_of(&json!({ "resourceType": "Bundle" })), None);
    }

    #[test]
    fn an_entry_in_scope_opens_and_a_bad_checksum_is_refused() {
        let plain = bundle("OPConsultRecord", "2024-03-01T10:00:00+05:30").to_string();
        let sum = fidelius::checksum(&plain).unwrap();
        let (entry, hip, hiu) = push(&plain, &sum.to_uppercase(), "OPC-1");
        let got = open_entry(&entry, &hiu, (&hip.public_key, &hip.nonce), &scope()).unwrap();
        assert_eq!(
            (got.reference.as_str(), got.hi_type.as_str()),
            ("OPC-1", "OPConsultation")
        );

        let (entry, hip, hiu) = push(&plain, "00000000000000000000000000000000", "OPC-1");
        let refused =
            open_entry(&entry, &hiu, (&hip.public_key, &hip.nonce), &scope()).unwrap_err();
        assert_eq!(refused.reason, "Checksum does not match the content");
    }

    #[test]
    fn what_the_consent_does_not_cover_is_refused() {
        let outside = |plain: String, reference: &str| {
            let sum = fidelius::checksum(&plain).unwrap();
            let (entry, hip, hiu) = push(&plain, &sum, reference);
            open_entry(&entry, &hiu, (&hip.public_key, &hip.nonce), &scope())
                .unwrap_err()
                .reason
        };
        let consented = "Outside what the patient consented to";
        assert_eq!(
            outside(bundle("OPConsultRecord", "2024-03-01").to_string(), "OPC-9"),
            consented
        );
        assert_eq!(
            outside(bundle("InvoiceRecord", "2024-03-01").to_string(), "OPC-1"),
            consented
        );
        assert_eq!(
            outside(bundle("OPConsultRecord", "2023-03-01").to_string(), "OPC-1"),
            consented
        );
        assert_eq!(
            outside("{\"resourceType\":\"Patient\"}".into(), "OPC-1"),
            "Content is not a FHIR bundle"
        );
    }
}

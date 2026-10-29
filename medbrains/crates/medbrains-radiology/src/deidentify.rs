//! De-identifying DICOM on the way out of a de-identified share link.
//!
//! DICOM PS3.15 Annex E basic application confidentiality profile, applied
//! to the DICOM JSON (PS3.18 F.2) the viewer reads — QIDO results and study
//! metadata — with two of the standard's options:
//!
//! - **Retain Patient Characteristics**: sex, age, size and weight stay; a
//!   second opinion needs them.
//! - **Retain UIDs**: study, series and instance UIDs stay, because the
//!   viewer fetches its frames by them. They identify nobody outside the
//!   hospital that issued them.
//!
//! Names, IDs, birth date, addresses, phone numbers, accession numbers,
//! staff and institution names are replaced or removed. Pixel data passes
//! through unchanged, so text burned into an image (common on ultrasound and
//! scanned films) is NOT removed — the share screen says so. A whole DICOM
//! file would carry every header untouched, so it is never served on a
//! de-identified link.

use serde_json::{Map, Value, json};

/// Tags replaced with a dummy value (type 1/2 in the profile: keep present).
const REPLACE: [&str; 2] = [
    "00100010", // PatientName
    "00100020", // PatientID
];

/// Tags removed (profile action X/Z/D without a value worth keeping).
const REMOVE: [&str; 29] = [
    "00080050", // AccessionNumber
    "00080080", // InstitutionName
    "00080081", // InstitutionAddress
    "00080090", // ReferringPhysicianName
    "00080092", // ReferringPhysicianAddress
    "00080094", // ReferringPhysicianTelephoneNumbers
    "00081010", // StationName
    "00081040", // InstitutionalDepartmentName
    "00081048", // PhysiciansOfRecord
    "00081050", // PerformingPhysicianName
    "00081060", // NameOfPhysiciansReadingStudy
    "00081070", // OperatorsName
    "00100030", // PatientBirthDate
    "00100032", // PatientBirthTime
    "00101000", // OtherPatientIDs
    "00101001", // OtherPatientNames
    "00101002", // OtherPatientIDsSequence
    "00101040", // PatientAddress
    "00101060", // PatientMotherBirthName
    "00101090", // MedicalRecordLocator
    "00102154", // PatientTelephoneNumbers
    "00102160", // EthnicGroup
    "00102180", // Occupation
    "001021B0", // AdditionalPatientHistory
    "00104000", // PatientComments
    "00200010", // StudyID
    "00321032", // RequestingPhysician
    "00380010", // AdmissionID
    "00400275", // RequestAttributesSequence
];

/// Nested sequences are walked this deep; real metadata is far shallower.
const MAX_DEPTH: usize = 8;

fn scrub_dataset(dataset: &mut Map<String, Value>, pseudonym: &str, depth: usize) {
    for tag in REMOVE {
        dataset.remove(tag);
    }
    if let Some(name) = dataset.get_mut(REPLACE[0]) {
        *name = json!({ "vr": "PN", "Value": [{ "Alphabetic": "ANONYMOUS" }] });
    }
    if let Some(id) = dataset.get_mut(REPLACE[1]) {
        *id = json!({ "vr": "LO", "Value": [pseudonym] });
    }
    if depth >= MAX_DEPTH {
        return;
    }
    for element in dataset.values_mut() {
        if element.get("vr").and_then(Value::as_str) == Some("SQ")
            && let Some(items) = element.get_mut("Value").and_then(Value::as_array_mut)
        {
            for item in items.iter_mut().filter_map(Value::as_object_mut) {
                scrub_dataset(item, pseudonym, depth + 1);
            }
        }
    }
}

/// De-identify a DICOM JSON body: an array of datasets, or one dataset.
/// `None` when it is not DICOM JSON — the caller must not pass it on.
#[must_use]
pub fn scrub_json(body: &[u8], pseudonym: &str) -> Option<Vec<u8>> {
    let mut value: Value = serde_json::from_slice(body).ok()?;
    match &mut value {
        Value::Array(datasets) => {
            for d in datasets.iter_mut() {
                scrub_dataset(d.as_object_mut()?, pseudonym, 0);
            }
        }
        Value::Object(d) => scrub_dataset(d, pseudonym, 0),
        _ => return None,
    }
    serde_json::to_vec(&value).ok()
}

/// What a de-identified link may relay, by content type: DICOM JSON (to be
/// scrubbed) or pixel data. `None` for anything else — a whole DICOM file
/// carries every identifying header untouched.
#[must_use]
pub fn relay_kind(content_type: &str) -> Option<RelayKind> {
    let ct = content_type.to_ascii_lowercase();
    if ct.contains("json") {
        Some(RelayKind::Json)
    } else if ct.starts_with("image/")
        || (ct.starts_with("multipart/related") && !ct.contains("application/dicom"))
        || ct.starts_with("application/octet-stream")
    {
        Some(RelayKind::Pixels)
    } else {
        None
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum RelayKind {
    Json,
    Pixels,
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn study() -> Value {
        json!([{
            "00100010": { "vr": "PN", "Value": [{ "Alphabetic": "Iyer^Ravi" }] },
            "00100020": { "vr": "LO", "Value": ["UH-0042"] },
            "00100030": { "vr": "DA", "Value": ["19800309"] },
            "00100040": { "vr": "CS", "Value": ["M"] },
            "00101010": { "vr": "AS", "Value": ["046Y"] },
            "00080050": { "vr": "SH", "Value": ["RA00000095"] },
            "00080080": { "vr": "LO", "Value": ["City Hospital"] },
            "0020000D": { "vr": "UI", "Value": ["1.2.3"] },
            "00081250": { "vr": "SQ", "Value": [{
                "00100020": { "vr": "LO", "Value": ["UH-0042"] },
                "00081050": { "vr": "PN", "Value": [{ "Alphabetic": "Dr^Who" }] }
            }] }
        }])
    }

    #[test]
    fn identity_is_replaced_and_the_clinical_picture_kept() {
        let out = scrub_json(&serde_json::to_vec(&study()).unwrap(), "SHARE-1").unwrap();
        let text = String::from_utf8(out).unwrap();
        for gone in [
            "Iyer",
            "UH-0042",
            "19800309",
            "RA00000095",
            "City Hospital",
            "Dr^Who",
        ] {
            assert!(!text.contains(gone), "{gone} survived: {text}");
        }
        for kept in ["ANONYMOUS", "SHARE-1", "\"M\"", "046Y", "1.2.3"] {
            assert!(text.contains(kept), "{kept} lost: {text}");
        }
    }

    #[test]
    fn a_whole_dicom_file_is_never_relayed() {
        assert_eq!(relay_kind("application/dicom+json"), Some(RelayKind::Json));
        assert_eq!(
            relay_kind("multipart/related; type=\"application/octet-stream\"; boundary=x"),
            Some(RelayKind::Pixels)
        );
        assert_eq!(
            relay_kind("multipart/related; type=\"application/dicom\"; boundary=x"),
            None
        );
        assert_eq!(relay_kind("application/dicom"), None);
        assert!(scrub_json(b"not json", "x").is_none());
    }
}

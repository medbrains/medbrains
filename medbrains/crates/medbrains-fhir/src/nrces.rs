//! NRCeS (ABDM FHIR IG) document bundles — what a HIP sends for a care
//! context: a FHIR `document` Bundle whose first entry is a `Composition`
//! carrying the record's profile (OPConsultRecord, PrescriptionRecord, …),
//! followed by every resource the composition references.
//!
//! IG: <https://nrces.in/ndhm/fhir/r4/>. Resources are built as JSON values:
//! the IG adds `meta.profile` to each one, and the typed structs here only
//! cover what the read API needs.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::mapper::{HFR_SYSTEM, HPR_SYSTEM, PatientView, SNOMED_SYSTEM, patient_to_fhir};

pub const NRCES_PROFILE_BASE: &str = "https://nrces.in/ndhm/fhir/r4/StructureDefinition/";
const CONFIDENTIALITY_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";
const BUNDLE_IDENTIFIER_SYSTEM: &str = "http://hip.in";

/// The record types this HIP shares, with ABDM's HI type and the IG profile.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecordKind {
    OpConsult,
    Prescription,
    DiagnosticReport,
    DischargeSummary,
}

impl RecordKind {
    /// ABDM `hiType` string.
    #[must_use]
    pub const fn hi_type(self) -> &'static str {
        match self {
            Self::OpConsult => "OPConsultation",
            Self::Prescription => "Prescription",
            Self::DiagnosticReport => "DiagnosticReport",
            Self::DischargeSummary => "DischargeSummary",
        }
    }

    /// The Composition profile name in the NRCeS IG.
    #[must_use]
    pub const fn profile_name(self) -> &'static str {
        match self {
            Self::OpConsult => "OPConsultRecord",
            Self::Prescription => "PrescriptionRecord",
            Self::DiagnosticReport => "DiagnosticReportRecord",
            Self::DischargeSummary => "DischargeSummaryRecord",
        }
    }

    /// SNOMED CT code for `Composition.type`, as fixed by each profile.
    #[must_use]
    pub const fn type_code(self) -> (&'static str, &'static str) {
        match self {
            Self::OpConsult => ("371530004", "Clinical consultation report"),
            Self::Prescription => ("440545006", "Prescription record"),
            Self::DiagnosticReport => ("721981007", "Diagnostic studies report"),
            Self::DischargeSummary => ("373942005", "Discharge summary"),
        }
    }

    /// From the care context's `source_kind`.
    #[must_use]
    pub fn from_source_kind(kind: &str) -> Option<Self> {
        match kind {
            "opd_consult" => Some(Self::OpConsult),
            "prescription" => Some(Self::Prescription),
            "lab_report" => Some(Self::DiagnosticReport),
            "discharge_summary" => Some(Self::DischargeSummary),
            _ => None,
        }
    }
}

/// The author or custodian named on a record, with its registry ID.
#[derive(Debug, Clone)]
pub struct Party {
    pub id: Uuid,
    pub name: String,
    /// HPR ID for a practitioner, HFR ID for an organisation.
    pub registry_id: Option<String>,
}

/// One composition section: narrative text and/or coded resources.
#[derive(Debug, Clone)]
pub struct Section {
    pub title: String,
    /// SNOMED CT section code and display.
    pub code: (&'static str, &'static str),
    pub lines: Vec<String>,
    /// Resources (JSON, with `resourceType` and `id`) the section lists.
    pub entries: Vec<Value>,
}

#[derive(Debug)]
pub struct DocumentInput<'a> {
    pub kind: RecordKind,
    pub id: Uuid,
    pub date: DateTime<Utc>,
    pub title: String,
    pub patient: &'a PatientView,
    pub author: Option<Party>,
    pub custodian: Option<Party>,
    pub encounter_id: Option<Uuid>,
    pub sections: Vec<Section>,
}

fn urn(id: &str) -> String {
    format!("urn:uuid:{id}")
}

fn profile(name: &str) -> Value {
    json!({ "profile": [format!("{NRCES_PROFILE_BASE}{name}")] })
}

fn entry(resource: Value) -> Value {
    let id = resource["id"].as_str().unwrap_or_default().to_owned();
    json!({ "fullUrl": urn(&id), "resource": resource })
}

fn reference(resource: &Value) -> Value {
    json!({ "reference": urn(resource["id"].as_str().unwrap_or_default()) })
}

fn practitioner(p: &Party) -> Value {
    let mut r = json!({
        "resourceType": "Practitioner", "id": p.id.to_string(), "meta": profile("Practitioner"),
        "name": [{ "text": p.name }],
    });
    if let Some(hpr) = p.registry_id.as_deref() {
        r["identifier"] = json!([{ "type": { "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MD",
            "display": "Medical License number" }] }, "system": HPR_SYSTEM, "value": hpr }]);
    }
    r
}

fn organization(o: &Party) -> Value {
    let mut r = json!({
        "resourceType": "Organization", "id": o.id.to_string(), "meta": profile("Organization"),
        "name": o.name,
    });
    if let Some(hfr) = o.registry_id.as_deref() {
        r["identifier"] = json!([{ "type": { "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "PRN",
            "display": "Provider number" }] }, "system": HFR_SYSTEM, "value": hfr }]);
    }
    r
}

fn narrative(lines: &[String]) -> Value {
    let body: String = lines
        .iter()
        .map(|l| format!("<p>{}</p>", escape(l)))
        .collect();
    json!({ "status": "generated", "div": format!("<div xmlns=\"http://www.w3.org/1999/xhtml\">{body}</div>") })
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// The NRCeS `DocumentBundle` for one record.
#[must_use]
pub fn document_bundle(input: &DocumentInput<'_>) -> Value {
    let date = input.date.to_rfc3339();
    let mut patient = serde_json::to_value(patient_to_fhir(input.patient)).unwrap_or(Value::Null);
    patient["resourceType"] = json!("Patient");
    patient["meta"] = profile("Patient");
    let patient_ref = reference(&patient);

    let author = input.author.as_ref().map(practitioner);
    let custodian = input.custodian.as_ref().map(organization);
    let class = if input.kind == RecordKind::DischargeSummary {
        "IMP"
    } else {
        "AMB"
    };
    let encounter = input.encounter_id.map(|id| {
        json!({
            "resourceType": "Encounter", "id": id.to_string(), "meta": profile("Encounter"),
            "status": "finished",
            "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                       "code": class },
            "subject": patient_ref,
        })
    });

    let (code, display) = input.kind.type_code();
    let mut composition = json!({
        "resourceType": "Composition",
        "id": input.id.to_string(),
        "meta": profile(input.kind.profile_name()),
        "language": "en-IN",
        "identifier": { "system": "https://ndhm.in/phr", "value": input.id.to_string() },
        "status": "final",
        "type": { "coding": [{ "system": SNOMED_SYSTEM, "code": code, "display": display }], "text": display },
        "subject": patient_ref,
        "date": date,
        "title": input.title,
        "author": author.as_ref().map_or_else(Vec::new, |a| vec![reference(a)]),
    });
    if let Some(e) = &encounter {
        composition["encounter"] = reference(e);
    }
    if let Some(c) = &custodian {
        composition["custodian"] = reference(c);
    }
    let mut section_resources = Vec::new();
    composition["section"] = Value::Array(
        input
            .sections
            .iter()
            .map(|s| {
                let mut section = json!({
                    "title": s.title,
                    "code": { "coding": [{ "system": SNOMED_SYSTEM, "code": s.code.0, "display": s.code.1 }] },
                });
                if !s.lines.is_empty() {
                    section["text"] = narrative(&s.lines);
                }
                if !s.entries.is_empty() {
                    section["entry"] =
                        Value::Array(s.entries.iter().map(reference).collect());
                    section_resources.extend(s.entries.iter().cloned());
                }
                section
            })
            .collect(),
    );

    let mut entries = vec![entry(composition), entry(patient)];
    entries.extend(author.into_iter().map(entry));
    entries.extend(custodian.into_iter().map(entry));
    entries.extend(encounter.into_iter().map(entry));
    entries.extend(section_resources.into_iter().map(entry));

    json!({
        "resourceType": "Bundle",
        "id": Uuid::new_v4().to_string(),
        "meta": {
            "versionId": "1",
            "lastUpdated": Utc::now().to_rfc3339(),
            "profile": [format!("{NRCES_PROFILE_BASE}DocumentBundle")],
            "security": [{ "system": CONFIDENTIALITY_SYSTEM, "code": "V", "display": "very restricted" }],
        },
        "identifier": { "system": BUNDLE_IDENTIFIER_SYSTEM, "value": input.id.to_string() },
        "type": "document",
        "timestamp": date,
        "entry": entries,
    })
}

/// A `MedicationRequest` (PrescriptionRecord, OPConsultRecord).
#[must_use]
pub fn medication_request(
    patient_id: Uuid,
    authored_on: DateTime<Utc>,
    drug: &str,
    instructions: &str,
) -> Value {
    json!({
        "resourceType": "MedicationRequest", "id": Uuid::new_v4().to_string(),
        "meta": profile("MedicationRequest"),
        "status": "active", "intent": "order",
        "medicationCodeableConcept": { "text": drug },
        "subject": { "reference": urn(&patient_id.to_string()) },
        "authoredOn": authored_on.to_rfc3339(),
        "dosageInstruction": [{ "text": instructions }],
    })
}

/// One lab result as an `Observation`.
#[must_use]
pub fn observation(patient_id: Uuid, name: &str, value: &str, unit: Option<&str>) -> Value {
    let shown = unit.map_or_else(|| value.to_owned(), |u| format!("{value} {u}"));
    json!({
        "resourceType": "Observation", "id": Uuid::new_v4().to_string(),
        "meta": profile("Observation"),
        "status": "final", "code": { "text": name },
        "subject": { "reference": urn(&patient_id.to_string()) },
        "valueString": shown,
    })
}

/// A `DiagnosticReportLab` over the given observations.
#[must_use]
pub fn diagnostic_report(
    patient_id: Uuid,
    name: &str,
    issued: DateTime<Utc>,
    results: &[Value],
) -> Value {
    json!({
        "resourceType": "DiagnosticReport", "id": Uuid::new_v4().to_string(),
        "meta": profile("DiagnosticReportLab"),
        "status": "final", "code": { "text": name },
        "subject": { "reference": urn(&patient_id.to_string()) },
        "issued": issued.to_rfc3339(),
        "result": results.iter().map(reference).collect::<Vec<_>>(),
    })
}

#[cfg(test)]
mod tests {
    use super::{DocumentInput, Party, RecordKind, Section, document_bundle, medication_request};
    use crate::mapper::PatientView;
    use chrono::Utc;
    use uuid::Uuid;

    fn patient() -> PatientView {
        PatientView {
            id: Uuid::new_v4(),
            uhid: "UH-1".into(),
            abha_id: Some("91-1111-2222-3333".into()),
            prefix: None,
            first_name: "Priya".into(),
            middle_name: None,
            last_name: "V".into(),
            gender: "female".into(),
            date_of_birth: None,
            phone: None,
            email: None,
            is_active: true,
        }
    }

    #[test]
    fn a_prescription_bundle_is_a_document_led_by_its_composition() {
        let p = patient();
        let rx = medication_request(p.id, Utc::now(), "Paracetamol 500 mg", "1 tab TDS x 3 days");
        let bundle = document_bundle(&DocumentInput {
            kind: RecordKind::Prescription,
            id: Uuid::new_v4(),
            date: Utc::now(),
            title: "Prescription".into(),
            patient: &p,
            author: Some(Party {
                id: Uuid::new_v4(),
                name: "Dr A".into(),
                registry_id: Some("71-1234-5678-9012".into()),
            }),
            custodian: None,
            encounter_id: None,
            sections: vec![Section {
                title: "Prescription".into(),
                code: ("440545006", "Prescription record"),
                lines: vec![],
                entries: vec![rx],
            }],
        });
        assert_eq!(bundle["type"], "document");
        assert_eq!(
            bundle["meta"]["profile"][0],
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"
        );
        let first = &bundle["entry"][0]["resource"];
        assert_eq!(first["resourceType"], "Composition");
        assert_eq!(
            first["meta"]["profile"][0],
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord"
        );
        assert_eq!(first["type"]["coding"][0]["code"], "440545006");
        // Every reference the composition makes resolves inside the bundle.
        let urls: Vec<&str> = bundle["entry"]
            .as_array()
            .map(|e| e.iter().filter_map(|x| x["fullUrl"].as_str()).collect())
            .unwrap_or_default();
        let section_ref = first["section"][0]["entry"][0]["reference"].as_str();
        assert!(section_ref.is_some_and(|r| urls.contains(&r)));
        assert!(
            first["subject"]["reference"]
                .as_str()
                .is_some_and(|r| urls.contains(&r))
        );
        assert!(bundle["entry"].as_array().is_some_and(|e| {
            e.iter()
                .any(|x| x["resource"]["resourceType"] == "Practitioner")
        }));
    }

    #[test]
    fn each_kind_maps_to_its_abdm_hi_type() {
        for (kind, hi) in [
            ("opd_consult", "OPConsultation"),
            ("prescription", "Prescription"),
            ("lab_report", "DiagnosticReport"),
            ("discharge_summary", "DischargeSummary"),
        ] {
            assert_eq!(
                RecordKind::from_source_kind(kind).map(RecordKind::hi_type),
                Some(hi)
            );
        }
        assert!(RecordKind::from_source_kind("x").is_none());
    }
}

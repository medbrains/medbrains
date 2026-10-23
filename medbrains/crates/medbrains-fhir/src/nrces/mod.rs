//! NRCeS (ABDM FHIR IG 6.5.0) document bundles — what a HIP sends for a care
//! context: a FHIR `document` Bundle whose first entry is a `Composition`
//! carrying the record's profile (OPConsultRecord, PrescriptionRecord, …),
//! followed by every resource the composition references.
//!
//! IG: <https://nrces.in/ndhm/fhir/r4/>. Resources are built as JSON values:
//! the IG adds `meta.profile` to each one, and the typed structs here only
//! cover what the read API needs. `conformance` checks a bundle against the
//! rules extracted from the IG's StructureDefinitions.

pub mod conformance;
mod records;
mod resources;
pub mod sections;

#[cfg(test)]
mod records_tests;
#[cfg(test)]
mod tests;

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

pub use records::{
    DocumentLine, ImmunizationLine, InvoiceHeader, InvoiceItem, VitalsLine, document_reference,
    immunization, invoice, vital_observations,
};
pub use resources::{
    Clinical, DiagnosisLine, LabReport, LabResult, condition, diagnostic_report,
    medication_request, observation,
};

use crate::mapper::{
    ABHA_SYSTEM, HFR_SYSTEM, HPR_SYSTEM, PatientView, SNOMED_SYSTEM, UHID_SYSTEM, patient_to_fhir,
};

pub const NRCES_PROFILE_BASE: &str = "https://nrces.in/ndhm/fhir/r4/StructureDefinition/";
const CONFIDENTIALITY_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";
const BUNDLE_IDENTIFIER_SYSTEM: &str = "http://hip.in";
const V2_0203: &str = "http://terminology.hl7.org/CodeSystem/v2-0203";
const NDHM_IDENTIFIER_TYPE: &str =
    "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code";
/// Our own staff and facility ids, for a doctor with no HPR ID or a campus
/// with no HFR ID — the profiles need an identifier either way.
const STAFF_SYSTEM: &str = "https://medbrains.health/staff";
const FACILITY_SYSTEM: &str = "https://medbrains.health/facility";

/// The record types this HIP shares, with ABDM's HI type and the IG profile.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RecordKind {
    OpConsult,
    Prescription,
    DiagnosticReport,
    DischargeSummary,
    Immunization,
    Wellness,
    HealthDocument,
    Invoice,
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
            Self::Immunization => "ImmunizationRecord",
            Self::Wellness => "WellnessRecord",
            Self::HealthDocument => "HealthDocumentRecord",
            Self::Invoice => "Invoice",
        }
    }

    /// Every kind, in the order a transfer builds them.
    pub const ALL: [Self; 8] = [
        Self::OpConsult,
        Self::Prescription,
        Self::DiagnosticReport,
        Self::DischargeSummary,
        Self::Immunization,
        Self::Wellness,
        Self::HealthDocument,
        Self::Invoice,
    ];

    /// The Composition profile name in the NRCeS IG.
    #[must_use]
    pub const fn profile_name(self) -> &'static str {
        match self {
            Self::OpConsult => "OPConsultRecord",
            Self::Prescription => "PrescriptionRecord",
            Self::DiagnosticReport => "DiagnosticReportRecord",
            Self::DischargeSummary => "DischargeSummaryRecord",
            Self::Immunization => "ImmunizationRecord",
            Self::Wellness => "WellnessRecord",
            Self::HealthDocument => "HealthDocumentRecord",
            Self::Invoice => "InvoiceRecord",
        }
    }

    /// SNOMED CT code for `Composition.type`, where the profile fixes one;
    /// `WellnessRecord` and `InvoiceRecord` fix none, and go by text as the
    /// IG's examples do.
    #[must_use]
    pub const fn type_code(self) -> Option<&'static str> {
        match self {
            Self::OpConsult => Some("371530004"),
            Self::Prescription => Some("440545006"),
            Self::DiagnosticReport => Some("721981007"),
            Self::DischargeSummary => Some("373942005"),
            Self::Immunization => Some("41000179103"),
            Self::HealthDocument => Some("419891008"),
            Self::Wellness | Self::Invoice => None,
        }
    }

    /// `Composition.type`'s words (the SNOMED display, where there is a code).
    #[must_use]
    pub const fn type_display(self) -> &'static str {
        match self {
            Self::OpConsult => "Clinical consultation report",
            Self::Prescription => "Prescription record",
            Self::DiagnosticReport => "Diagnostic studies report",
            Self::DischargeSummary => "Discharge summary",
            Self::Immunization => "Immunization record",
            Self::HealthDocument => "Record artifact",
            Self::Wellness => "Wellness Record",
            Self::Invoice => "Invoice Record",
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
            "immunization" => Some(Self::Immunization),
            "wellness" => Some(Self::Wellness),
            "health_document" => Some(Self::HealthDocument),
            "invoice" => Some(Self::Invoice),
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

/// The visit or admission a record belongs to (`Composition.encounter`).
#[derive(Debug, Clone)]
pub struct EncounterInfo {
    pub id: Uuid,
    pub inpatient: bool,
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
}

/// One composition section: narrative text and/or coded resources.
#[derive(Debug, Clone)]
pub struct Section {
    pub title: String,
    /// Section code; see [`sections`]. A wellness section goes by its title.
    pub code: Option<sections::SectionCode>,
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
    /// The clinician; without one the custodian organisation is the author.
    pub author: Option<Party>,
    pub custodian: Party,
    /// The visit or admission; an immunisation, document or bill may have none.
    pub encounter: Option<EncounterInfo>,
    pub sections: Vec<Section>,
    /// Resources the bundle carries that no section lists directly — the
    /// Observations a DiagnosticReport's `result` points at.
    pub resources: Vec<Value>,
}

fn urn(id: &str) -> String {
    format!("urn:uuid:{id}")
}

fn profile(name: &str) -> Value {
    json!({ "profile": [format!("{NRCES_PROFILE_BASE}{name}")] })
}

fn entry(resource: &Value) -> Value {
    let id = resource["id"].as_str().unwrap_or_default().to_owned();
    json!({ "fullUrl": urn(&id), "resource": resource })
}

/// A typed reference to a resource in the same bundle (the Prescription and
/// DiagnosticReport profiles slice section entries by `type`).
fn reference(resource: &Value) -> Value {
    json!({
        "reference": urn(resource["id"].as_str().unwrap_or_default()),
        "type": resource["resourceType"],
    })
}

/// The reference a record's author (or requester, or results interpreter)
/// takes: the practitioner, or the custodian organisation without one.
#[must_use]
pub fn author_reference(author: Option<&Party>, custodian: &Party) -> Value {
    author.map_or_else(
        || json!({ "reference": urn(&custodian.id.to_string()), "type": "Organization" }),
        |a| json!({ "reference": urn(&a.id.to_string()), "type": "Practitioner" }),
    )
}

/// The patient reference every clinical resource's `subject` takes.
#[must_use]
pub fn patient_reference(patient_id: Uuid) -> Value {
    json!({ "reference": urn(&patient_id.to_string()), "type": "Patient" })
}

fn identifier(kind: (&str, &str, &str), system: &str, value: &str) -> Value {
    let (type_system, code, display) = kind;
    json!({ "type": { "coding": [{ "system": type_system, "code": code, "display": display }] },
            "system": system, "value": value })
}

fn practitioner(p: &Party) -> Value {
    let id = p.id.to_string();
    let ident = p.registry_id.as_deref().map_or_else(
        || identifier((V2_0203, "EI", "Employee number"), STAFF_SYSTEM, &id),
        |hpr| identifier((V2_0203, "MD", "Medical License number"), HPR_SYSTEM, hpr),
    );
    json!({
        "resourceType": "Practitioner", "id": id, "meta": profile("Practitioner"),
        "identifier": [ident], "name": [{ "text": p.name }],
    })
}

fn organization(o: &Party) -> Value {
    let id = o.id.to_string();
    let ident = o.registry_id.as_deref().map_or_else(
        || {
            identifier(
                (V2_0203, "XX", "Organization identifier"),
                FACILITY_SYSTEM,
                &id,
            )
        },
        |hfr| identifier((V2_0203, "PRN", "Provider number"), HFR_SYSTEM, hfr),
    );
    json!({
        "resourceType": "Organization", "id": id, "meta": profile("Organization"),
        "identifier": [ident], "name": o.name,
    })
}

/// The NRCeS Patient: the read API's Patient with each identifier typed.
fn patient(p: &PatientView) -> Value {
    let mut patient = serde_json::to_value(patient_to_fhir(p)).unwrap_or(Value::Null);
    patient["resourceType"] = json!("Patient");
    patient["meta"] = profile("Patient");
    if let Some(ids) = patient["identifier"].as_array_mut() {
        for id in ids {
            let (system, code, display) = match id["system"].as_str() {
                Some(ABHA_SYSTEM) => (
                    NDHM_IDENTIFIER_TYPE,
                    "ABHA",
                    "Ayushman Bharat Health Account (ABHA) ID",
                ),
                Some(UHID_SYSTEM) => (V2_0203, "MR", "Medical record number"),
                _ => (NDHM_IDENTIFIER_TYPE, "OIN", "Other identifier"),
            };
            id["type"] =
                json!({ "coding": [{ "system": system, "code": code, "display": display }] });
        }
    }
    patient
}

fn encounter(e: &EncounterInfo, patient_ref: &Value) -> Value {
    let (code, display) = if e.inpatient {
        ("IMP", "inpatient encounter")
    } else {
        ("AMB", "ambulatory")
    };
    let mut r = json!({
        "resourceType": "Encounter", "id": e.id.to_string(), "meta": profile("Encounter"),
        "status": "finished",
        "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": code, "display": display },
        "subject": patient_ref,
    });
    let mut period = serde_json::Map::new();
    if let Some(t) = e.start {
        period.insert("start".into(), json!(t.to_rfc3339()));
    }
    if let Some(t) = e.end {
        period.insert("end".into(), json!(t.to_rfc3339()));
    }
    if !period.is_empty() {
        r["period"] = Value::Object(period);
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

fn section(s: &Section) -> Value {
    let mut out = json!({ "title": s.title });
    if let Some(sections::SectionCode(system, code, display)) = s.code {
        out["code"] = json!({ "coding": [{ "system": system, "code": code, "display": display }] });
    }
    if !s.lines.is_empty() {
        out["text"] = narrative(&s.lines);
    }
    if !s.entries.is_empty() {
        out["entry"] = Value::Array(s.entries.iter().map(reference).collect());
    }
    out
}

/// The NRCeS `DocumentBundle` for one record.
#[must_use]
pub fn document_bundle(input: &DocumentInput<'_>) -> Value {
    let date = input.date.to_rfc3339();
    let patient = patient(input.patient);
    let patient_ref = reference(&patient);
    let author = input.author.as_ref().map(practitioner);
    let custodian = organization(&input.custodian);
    let encounter = input.encounter.as_ref().map(|e| encounter(e, &patient_ref));

    let display = input.kind.type_display();
    let kind_type = input.kind.type_code().map_or_else(
        || json!({ "text": display }),
        |code| json!({ "coding": [{ "system": SNOMED_SYSTEM, "code": code, "display": display }], "text": display }),
    );
    let mut composition = json!({
        "resourceType": "Composition",
        "id": input.id.to_string(),
        "meta": profile(input.kind.profile_name()),
        "language": "en-IN",
        "identifier": { "system": "https://ndhm.in/phr", "value": input.id.to_string() },
        "status": "final",
        "type": kind_type,
        "subject": patient_ref,
        "date": date,
        "author": [author_reference(input.author.as_ref(), &input.custodian)],
        "title": input.title,
        "custodian": reference(&custodian),
        "section": input.sections.iter().map(section).collect::<Vec<_>>(),
    });
    if let Some(e) = &encounter {
        composition["encounter"] = reference(e);
    }

    let mut entries = vec![entry(&composition), entry(&patient)];
    entries.extend(author.iter().map(entry));
    entries.push(entry(&custodian));
    entries.extend(encounter.iter().map(entry));
    entries.extend(
        input
            .sections
            .iter()
            .flat_map(|s| s.entries.iter())
            .map(entry),
    );
    entries.extend(input.resources.iter().map(entry));

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

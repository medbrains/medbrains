//! A record's rows as NRCeS IG 6.5.0 composition sections, each in the
//! profile slice it belongs to (`medbrains_fhir::nrces::sections`): sliced
//! sections first, narratives no slice covers last (`openAtEnd`).
//!
//! Where things go:
//! - OP consult: complaints, the written diagnosis and the coded diagnoses
//!   (Conditions) → ChiefComplaints; examination → PhysicalExamination;
//!   follow-up → FollowUp; advice → a trailing "Outpatient care plan".
//! - Discharge: final diagnosis + Conditions → ChiefComplaints (as the IG's
//!   example does); condition at discharge → PhysicalExamination;
//!   investigations → Investigations; follow-up → CarePlan; course in
//!   hospital and treatment given → a trailing "Hospital course".
//! - Prescription and lab report: the profile's one section; a lab report's
//!   Observations hang off its DiagnosticReport, not the section.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use medbrains_fhir::nrces::sections::{self, SectionCode};
use medbrains_fhir::nrces::{
    Clinical, DiagnosisLine, LabReport, LabResult, Party, RecordKind, Section, author_reference,
    condition, diagnostic_report, medication_request, observation,
};
use serde_json::Value;
use uuid::Uuid;

/// One clinical record's narratives, author, time and encounter, whatever its kind.
#[derive(Debug, sqlx::FromRow)]
pub struct Record {
    pub id: Uuid,
    pub at: DateTime<Utc>,
    pub title: Option<String>,
    pub author_id: Option<Uuid>,
    pub author_name: Option<String>,
    pub author_hpr: Option<String>,
    /// `[key, text]` pairs.
    pub narratives: Value,
    /// The lab test's LOINC code.
    pub loinc: Option<String>,
    /// The lab report's interpretation or notes.
    pub conclusion: Option<String>,
    pub encounter_id: Uuid,
    pub encounter_start: Option<DateTime<Utc>>,
    pub encounter_end: Option<DateTime<Utc>>,
}

/// Line items for one kind's records, keyed by record (or encounter).
#[derive(Debug, Default)]
pub struct Rows {
    /// Prescription id → `(drug, instructions)`.
    pub drugs: HashMap<Uuid, Vec<(String, String)>>,
    /// Lab order id → results.
    pub results: HashMap<Uuid, Vec<LabResult>>,
    /// Encounter id → diagnoses.
    pub diagnoses: HashMap<Uuid, Vec<DiagnosisLine>>,
}

/// Whom the record is about and who wrote it.
#[derive(Debug)]
pub struct Who<'a> {
    pub patient_id: Uuid,
    pub author: Option<&'a Party>,
    pub custodian: &'a Party,
}

/// When a lab report has no interpretation: the profile requires a conclusion.
const NO_CONCLUSION: &str = "See results.";

fn texts(record: &Record) -> HashMap<&str, &str> {
    record
        .narratives
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|pair| {
            let text = pair[1].as_str().map(str::trim).filter(|t| !t.is_empty())?;
            Some((pair[0].as_str()?, text))
        })
        .collect()
}

/// A section, or none when it would be empty.
fn section(
    title: &str,
    code: SectionCode,
    lines: Vec<String>,
    entries: Vec<Value>,
) -> Option<Section> {
    (!lines.is_empty() || !entries.is_empty()).then(|| Section {
        title: title.to_owned(),
        code: Some(code),
        lines,
        entries,
    })
}

fn lines(t: &HashMap<&str, &str>, keys: &[(&str, &str)]) -> Vec<String> {
    keys.iter()
        .filter_map(|(key, label)| {
            let text = t.get(key)?;
            Some(if label.is_empty() {
                (*text).to_owned()
            } else {
                format!("{label}: {text}")
            })
        })
        .collect()
}

/// The sections of one record, and the resources the bundle carries that no
/// section lists (a lab report's Observations).
pub fn sections(
    kind: RecordKind,
    record: &Record,
    rows: &Rows,
    who: &Who<'_>,
) -> (Vec<Section>, Vec<Value>) {
    let ctx = Clinical {
        patient_id: who.patient_id,
        encounter_id: Some(record.encounter_id),
        at: record.at,
        practitioner: author_reference(who.author, who.custodian),
    };
    let t = texts(record);
    let conditions = || -> Vec<Value> {
        rows.diagnoses
            .get(&record.encounter_id)
            .into_iter()
            .flatten()
            .map(|d| condition(&ctx, d))
            .collect()
    };
    let mut extra = Vec::new();
    let out: Vec<Option<Section>> = match kind {
        RecordKind::OpConsult => vec![
            section(
                "Chief complaints and diagnosis",
                sections::CHIEF_COMPLAINTS,
                lines(&t, &[("complaints", ""), ("diagnosis", "Diagnosis")]),
                conditions(),
            ),
            section(
                "Physical examination",
                sections::PHYSICAL_EXAMINATION,
                lines(&t, &[("exam", "")]),
                vec![],
            ),
            section(
                "Follow up",
                sections::OP_FOLLOW_UP,
                lines(&t, &[("follow_up", "")]),
                vec![],
            ),
            section(
                "Advice",
                sections::OP_ADVICE,
                lines(&t, &[("advice", "")]),
                vec![],
            ),
        ],
        RecordKind::DischargeSummary => vec![
            section(
                "Final diagnosis",
                sections::CHIEF_COMPLAINTS,
                lines(&t, &[("final_diagnosis", "")]),
                conditions(),
            ),
            section(
                "Condition at discharge",
                sections::PHYSICAL_EXAMINATION,
                lines(&t, &[("condition_at_discharge", "")]),
                vec![],
            ),
            section(
                "Investigations",
                sections::DISCHARGE_INVESTIGATIONS,
                lines(&t, &[("investigations", "")]),
                vec![],
            ),
            section(
                "Follow up",
                sections::DISCHARGE_CARE_PLAN,
                lines(&t, &[("follow_up", "")]),
                vec![],
            ),
            section(
                "Course in hospital",
                sections::HOSPITAL_COURSE,
                lines(&t, &[("course", ""), ("treatment", "Treatment given")]),
                vec![],
            ),
        ],
        RecordKind::Prescription => {
            let drugs = rows.drugs.get(&record.id).into_iter().flatten();
            let entries = drugs
                .map(|(drug, how)| medication_request(&ctx, drug, how))
                .collect();
            vec![section(
                "Prescription",
                sections::PRESCRIPTION,
                lines(&t, &[("notes", "")]),
                entries,
            )]
        }
        RecordKind::DiagnosticReport => {
            let name = record.title.as_deref().unwrap_or("Lab report");
            let results = rows.results.get(&record.id).into_iter().flatten();
            extra = results.map(|r| observation(&ctx, r)).collect();
            let report = LabReport {
                name,
                loinc: record.loinc.as_deref(),
                conclusion: record.conclusion.as_deref().unwrap_or(NO_CONCLUSION),
            };
            let entry = diagnostic_report(&ctx, &report, &extra);
            vec![section(
                name,
                sections::DIAGNOSTIC_REPORT,
                Vec::new(),
                vec![entry],
            )]
        }
        // Built in `bundle_records`; never sent here.
        RecordKind::Immunization
        | RecordKind::Wellness
        | RecordKind::HealthDocument
        | RecordKind::Invoice => Vec::new(),
    };
    (out.into_iter().flatten().collect(), extra)
}

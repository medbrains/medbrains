//! FHIR R4 `DiagnosticReport` — a released lab or imaging report: what was
//! examined, when, the conclusion, and the Observations it reports.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::coding::{CodeableConcept, Coding};
use super::reference::Reference;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub id: String,
    /// `registered` | `partial` | `preliminary` | `final` | `amended` | ...
    pub status: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub category: Vec<CodeableConcept>,
    pub code: CodeableConcept,
    pub subject: Reference,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encounter: Option<Reference>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "effectiveDateTime")]
    pub effective_date_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issued: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub result: Vec<Reference>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conclusion: Option<String>,
}

/// Which department reported it — HL7 v2 table 0074.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportKind {
    Laboratory,
    Imaging,
}

/// What `MedBrains` knows about a released report.
#[derive(Debug, Clone)]
pub struct DiagnosticReportView {
    pub id: Uuid,
    pub kind: ReportKind,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    /// LOINC code when known; otherwise the hospital's own code.
    pub code: String,
    pub display: String,
    pub status: String,
    pub effective_at: DateTime<Utc>,
    pub issued_at: Option<DateTime<Utc>>,
    pub conclusion: Option<String>,
    pub observation_ids: Vec<Uuid>,
}

const SECTION_SYSTEM: &str = "http://terminology.hl7.org/CodeSystem/v2-0074";
const LOINC_SYSTEM: &str = "http://loinc.org";

/// A LOINC code is digits, a dash and a check digit (`2345-7`).
fn is_loinc(code: &str) -> bool {
    code.split_once('-').is_some_and(|(num, check)| {
        !num.is_empty()
            && num.chars().all(|c| c.is_ascii_digit())
            && check.len() == 1
            && check.chars().all(|c| c.is_ascii_digit())
    })
}

#[must_use]
pub fn diagnostic_report_to_fhir(v: &DiagnosticReportView) -> DiagnosticReport {
    let (section, section_display) = match v.kind {
        ReportKind::Laboratory => ("LAB", "Laboratory"),
        ReportKind::Imaging => ("RAD", "Radiology"),
    };
    DiagnosticReport {
        id: v.id.to_string(),
        status: v.status.clone(),
        category: vec![CodeableConcept {
            coding: vec![Coding {
                system: Some(SECTION_SYSTEM.to_owned()),
                code: section.to_owned(),
                display: Some(section_display.to_owned()),
            }],
            text: None,
        }],
        code: CodeableConcept {
            coding: vec![Coding {
                system: is_loinc(&v.code).then(|| LOINC_SYSTEM.to_owned()),
                code: v.code.clone(),
                display: Some(v.display.clone()),
            }],
            text: Some(v.display.clone()),
        },
        subject: Reference::to("Patient", v.patient_id),
        encounter: v.encounter_id.map(|e| Reference::to("Encounter", e)),
        effective_date_time: Some(v.effective_at.to_rfc3339()),
        issued: v.issued_at.map(|t| t.to_rfc3339()),
        result: v
            .observation_ids
            .iter()
            .map(|id| Reference::to("Observation", *id))
            .collect(),
        conclusion: v.conclusion.clone(),
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use uuid::Uuid;

    use super::{DiagnosticReportView, ReportKind, diagnostic_report_to_fhir, is_loinc};

    #[test]
    fn only_a_real_loinc_code_claims_the_loinc_system() {
        assert!(is_loinc("2345-7"));
        assert!(is_loinc("58410-2"));
        assert!(!is_loinc("CBC"));
        assert!(!is_loinc("HB-A1C"));
    }

    #[test]
    fn a_lab_report_links_its_observations_and_says_it_is_laboratory() {
        let obs = Uuid::new_v4();
        let report = diagnostic_report_to_fhir(&DiagnosticReportView {
            id: Uuid::new_v4(),
            kind: ReportKind::Laboratory,
            patient_id: Uuid::new_v4(),
            encounter_id: None,
            code: "58410-2".to_owned(),
            display: "Complete blood count".to_owned(),
            status: "final".to_owned(),
            effective_at: Utc::now(),
            issued_at: Some(Utc::now()),
            conclusion: None,
            observation_ids: vec![obs],
        });
        let json = serde_json::to_value(&report).unwrap_or_default();
        assert_eq!(json["category"][0]["coding"][0]["code"], "LAB");
        assert_eq!(json["code"]["coding"][0]["system"], "http://loinc.org");
        assert_eq!(json["result"][0]["reference"], format!("Observation/{obs}"));
    }
}

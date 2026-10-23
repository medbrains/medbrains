//! The clinical resources a `NRCeS` bundle carries: Condition, `MedicationRequest`,
//! Observation and `DiagnosticReportLab`, each with its IG profile.

use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::{patient_reference, profile, reference, urn};
use crate::mapper::{ICD10_SYSTEM, LOINC_SYSTEM, SNOMED_SYSTEM, UCUM_SYSTEM};
use crate::r4::diagnostic_report::is_loinc;

const CONDITION_CLINICAL: &str = "http://terminology.hl7.org/CodeSystem/condition-clinical";
const CONDITION_VERIFICATION: &str = "http://terminology.hl7.org/CodeSystem/condition-ver-status";
const CONDITION_CATEGORY: &str = "http://terminology.hl7.org/CodeSystem/condition-category";
const OBSERVATION_CATEGORY: &str = "http://terminology.hl7.org/CodeSystem/observation-category";
const INTERPRETATION: &str = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

/// Who and when, shared by every clinical resource of one record.
#[derive(Debug, Clone)]
pub struct Clinical {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub at: DateTime<Utc>,
    /// Requester / results interpreter: from [`super::author_reference`].
    pub practitioner: Value,
}

impl Clinical {
    fn base(&self, resource_type: &str, profile_name: &str, id: Uuid) -> Value {
        json!({
            "resourceType": resource_type, "id": id.to_string(), "meta": profile(profile_name),
            "subject": patient_reference(self.patient_id),
            "encounter": { "reference": urn(&self.encounter_id.to_string()), "type": "Encounter" },
        })
    }
}

/// A `diagnoses` row: ICD (10 or 11) primary, SNOMED CT when the doctor
/// picked one, and the words the doctor wrote.
#[derive(Debug, Clone)]
pub struct DiagnosisLine {
    pub id: Uuid,
    /// `icd10` | `icd11` | `snomed`.
    pub icd_system: String,
    pub icd_code: Option<String>,
    pub icd_display: Option<String>,
    pub snomed_code: Option<String>,
    pub snomed_display: Option<String>,
    pub description: String,
    /// `confirmed` | `probable` | `suspected` (ruled-out ones are not sent).
    pub certainty: Option<String>,
    pub onset: Option<NaiveDate>,
    pub resolved: Option<NaiveDate>,
    pub recorded: DateTime<Utc>,
}

fn non_empty(s: Option<&String>) -> Option<&str> {
    s.map(String::as_str)
        .map(str::trim)
        .filter(|c| !c.is_empty())
}

/// The codings of a diagnosis. The `NRCeS` Condition closes `code.coding` to
/// two slices, ICD-10 and SNOMED CT, each needing a display — so an ICD-10
/// or SNOMED code goes as a coding, and an ICD-11 code (no slice for it)
/// travels in the text instead: see [`diagnosis_text`].
fn diagnosis_codings(d: &DiagnosisLine) -> Vec<Value> {
    let mut coding = Vec::new();
    let icd = non_empty(d.icd_code.as_ref());
    let icd_display = non_empty(d.icd_display.as_ref()).unwrap_or(&d.description);
    match (d.icd_system.as_str(), icd) {
        ("icd10", Some(code)) => {
            coding.push(json!({ "system": ICD10_SYSTEM, "code": code, "display": icd_display }));
        }
        ("snomed", Some(code)) => {
            coding.push(json!({ "system": SNOMED_SYSTEM, "code": code, "display": icd_display }));
        }
        _ => {}
    }
    if let Some(code) = non_empty(d.snomed_code.as_ref()) {
        if !coding
            .iter()
            .any(|c| c["system"] == SNOMED_SYSTEM && c["code"] == code)
        {
            let display = non_empty(d.snomed_display.as_ref()).unwrap_or(&d.description);
            coding.push(json!({ "system": SNOMED_SYSTEM, "code": code, "display": display }));
        }
    }
    coding
}

/// The doctor's words, with an ICD-11 code (which no coding slice takes)
/// named so an HIU still receives it: `Dengue fever (ICD-11 1D2Z)`.
fn diagnosis_text(d: &DiagnosisLine) -> String {
    match (d.icd_system.as_str(), non_empty(d.icd_code.as_ref())) {
        ("icd11", Some(code)) => format!("{} (ICD-11 {code})", d.description),
        _ => d.description.clone(),
    }
}

/// A `Condition` for one diagnosis of the visit or admission.
#[must_use]
pub fn condition(ctx: &Clinical, d: &DiagnosisLine) -> Value {
    let mut r = ctx.base("Condition", "Condition", d.id);
    let (clinical, clinical_display) = if d.resolved.is_some() {
        ("resolved", "Resolved")
    } else {
        ("active", "Active")
    };
    let (verification, verification_display) = match d.certainty.as_deref() {
        Some("probable" | "suspected") => ("provisional", "Provisional"),
        _ => ("confirmed", "Confirmed"),
    };
    r["clinicalStatus"] = json!({ "coding": [{ "system": CONDITION_CLINICAL, "code": clinical, "display": clinical_display }] });
    r["verificationStatus"] = json!({ "coding": [{ "system": CONDITION_VERIFICATION, "code": verification, "display": verification_display }] });
    r["category"] = json!([{ "coding": [{ "system": CONDITION_CATEGORY, "code": "encounter-diagnosis", "display": "Encounter Diagnosis" }] }]);
    let coding = diagnosis_codings(d);
    r["code"] = if coding.is_empty() {
        json!({ "text": diagnosis_text(d) })
    } else {
        json!({ "coding": coding, "text": diagnosis_text(d) })
    };
    if let Some(onset) = d.onset {
        r["onsetDateTime"] = json!(onset.to_string());
    }
    if let Some(resolved) = d.resolved {
        r["abatementDateTime"] = json!(resolved.to_string());
    }
    r["recordedDate"] = json!(d.recorded.to_rfc3339());
    r
}

/// A `MedicationRequest` (`PrescriptionRecord`, `OPConsultRecord`). The drug
/// goes as text: SNOMED CT products come with the CDCI catalogue.
#[must_use]
pub fn medication_request(ctx: &Clinical, drug: &str, instructions: &str) -> Value {
    let mut r = ctx.base("MedicationRequest", "MedicationRequest", Uuid::new_v4());
    r["status"] = json!("active");
    r["intent"] = json!("order");
    r["medicationCodeableConcept"] = json!({ "text": drug });
    r["authoredOn"] = json!(ctx.at.to_rfc3339());
    r["requester"] = ctx.practitioner.clone();
    r["dosageInstruction"] = json!([{ "text": instructions }]);
    r
}

/// One `lab_results` row.
#[derive(Debug, Clone)]
pub struct LabResult {
    pub id: Uuid,
    pub name: String,
    pub value: String,
    /// `numeric_value`, when the analyser or technician gave a number.
    pub numeric: Option<f64>,
    pub unit: Option<String>,
    pub range: Option<String>,
    /// `lab_result_flag`: normal | low | high | `critical_low` | `critical_high` | abnormal.
    pub flag: Option<String>,
    /// LOINC code when one is known for this result.
    pub loinc: Option<String>,
}

/// The UCUM code for the units labs write; `None` sends the unit as text only.
fn ucum(unit: &str) -> Option<&'static str> {
    let code = match unit.trim().to_ascii_lowercase().replace('µ', "u").as_str() {
        "mg/dl" => "mg/dL",
        "g/dl" => "g/dL",
        "g/l" => "g/L",
        "mg/l" => "mg/L",
        "%" => "%",
        "mmol/l" => "mmol/L",
        "umol/l" => "umol/L",
        "meq/l" => "meq/L",
        "u/l" => "U/L",
        "iu/l" => "[IU]/L",
        "miu/l" => "m[IU]/L",
        "uiu/ml" => "u[IU]/mL",
        "ng/ml" => "ng/mL",
        "pg/ml" => "pg/mL",
        "ug/dl" => "ug/dL",
        "fl" => "fL",
        "pg" => "pg",
        "mm/hr" | "mm/h" => "mm/h",
        "sec" | "s" => "s",
        "/cumm" | "cells/cumm" | "/ul" | "cells/ul" => "/uL",
        "10^3/ul" | "x10^3/ul" | "thou/ul" => "10*3/uL",
        "10^6/ul" | "x10^6/ul" | "million/cumm" | "mill/cumm" => "10*6/uL",
        _ => return None,
    };
    Some(code)
}

fn quantity(value: f64, unit: Option<&str>) -> Value {
    let mut q = Map::new();
    q.insert("value".into(), json!(value));
    if let Some(u) = unit.map(str::trim).filter(|u| !u.is_empty()) {
        q.insert("unit".into(), json!(u));
        if let Some(code) = ucum(u) {
            q.insert("system".into(), json!(UCUM_SYSTEM));
            q.insert("code".into(), json!(code));
        }
    }
    Value::Object(q)
}

/// `"13.0-17.0"` or `"13 - 17"` as low and high; anything else is text only.
fn range(text: &str, unit: Option<&str>) -> Value {
    let mut r = json!({ "text": text });
    let bounds = text.split_once('-').and_then(|(lo, hi)| {
        Some((
            lo.trim().parse::<f64>().ok()?,
            hi.trim().parse::<f64>().ok()?,
        ))
    });
    if let Some((low, high)) = bounds {
        r["low"] = quantity(low, unit);
        r["high"] = quantity(high, unit);
    }
    r
}

fn interpretation(flag: &str) -> Option<(&'static str, &'static str)> {
    Some(match flag {
        "normal" => ("N", "Normal"),
        "low" => ("L", "Low"),
        "high" => ("H", "High"),
        "critical_low" => ("LL", "Critical low"),
        "critical_high" => ("HH", "Critical high"),
        "abnormal" => ("A", "Abnormal"),
        _ => return None,
    })
}

/// A `CodeableConcept` carrying LOINC only when the code really is LOINC.
fn lab_code(name: &str, loinc: Option<&str>) -> Value {
    match loinc.map(str::trim).filter(|c| is_loinc(c)) {
        Some(code) => {
            json!({ "coding": [{ "system": LOINC_SYSTEM, "code": code, "display": name }], "text": name })
        }
        None => json!({ "text": name }),
    }
}

/// One lab result as an `Observation`: a number as `valueQuantity` (UCUM
/// when the unit is known), anything else as `valueString`.
#[must_use]
pub fn observation(ctx: &Clinical, res: &LabResult) -> Value {
    let mut r = ctx.base("Observation", "Observation", res.id);
    r["status"] = json!("final");
    r["category"] = json!([{ "coding": [{ "system": OBSERVATION_CATEGORY, "code": "laboratory", "display": "Laboratory" }] }]);
    r["code"] = lab_code(&res.name, res.loinc.as_deref());
    r["effectiveDateTime"] = json!(ctx.at.to_rfc3339());
    let number = res
        .numeric
        .or_else(|| res.value.trim().parse::<f64>().ok())
        .filter(|n| n.is_finite());
    if let Some(n) = number {
        r["valueQuantity"] = quantity(n, res.unit.as_deref());
    } else {
        let unit = res.unit.as_deref().map(str::trim).filter(|u| !u.is_empty());
        r["valueString"] =
            json!(unit.map_or_else(|| res.value.clone(), |u| format!("{} {u}", res.value)));
    }
    if let Some(text) = res
        .range
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
    {
        r["referenceRange"] = json!([range(text, res.unit.as_deref())]);
    }
    if let Some((code, display)) = res.flag.as_deref().and_then(interpretation) {
        r["interpretation"] =
            json!([{ "coding": [{ "system": INTERPRETATION, "code": code, "display": display }] }]);
    }
    r
}

/// The test a `DiagnosticReportLab` reports on.
#[derive(Debug, Clone)]
pub struct LabReport<'a> {
    pub name: &'a str,
    pub loinc: Option<&'a str>,
    /// The pathologist's interpretation or notes; the profile requires one.
    pub conclusion: &'a str,
}

/// A `DiagnosticReportLab` over the given observations.
#[must_use]
pub fn diagnostic_report(ctx: &Clinical, report: &LabReport<'_>, results: &[Value]) -> Value {
    let mut r = ctx.base("DiagnosticReport", "DiagnosticReportLab", Uuid::new_v4());
    r["status"] = json!("final");
    r["code"] = lab_code(report.name, report.loinc);
    r["issued"] = json!(ctx.at.to_rfc3339());
    r["resultsInterpreter"] = json!([ctx.practitioner]);
    r["result"] = Value::Array(results.iter().map(reference).collect());
    r["conclusion"] = json!(report.conclusion);
    r
}

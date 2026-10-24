use chrono::{NaiveDate, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::conformance::violations;
use super::sections::{self, SectionCode};
use super::{
    Clinical, DiagnosisLine, DocumentInput, EncounterInfo, LabReport, LabResult, Party, RecordKind,
    Section, author_reference, condition, diagnostic_report, document_bundle, medication_request,
    observation,
};
use crate::mapper::{ObservationView, PatientView, observation_to_fhir};

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

fn doctor(hpr: Option<&str>) -> Party {
    Party {
        id: Uuid::new_v4(),
        name: "Dr A".into(),
        registry_id: hpr.map(str::to_owned),
    }
}

fn hospital() -> Party {
    Party {
        id: Uuid::new_v4(),
        name: "Main hospital".into(),
        registry_id: None,
    }
}

struct Fixture {
    patient: PatientView,
    author: Option<Party>,
    custodian: Party,
    encounter: EncounterInfo,
}

impl Fixture {
    fn new(author: Option<Party>) -> Self {
        Self {
            patient: patient(),
            author,
            custodian: hospital(),
            encounter: EncounterInfo {
                id: Uuid::new_v4(),
                inpatient: false,
                start: Some(Utc::now()),
                end: None,
            },
        }
    }

    fn ctx(&self) -> Clinical {
        Clinical {
            patient_id: self.patient.id,
            encounter_id: Some(self.encounter.id),
            at: Utc::now(),
            practitioner: author_reference(self.author.as_ref(), &self.custodian),
        }
    }

    fn bundle(&self, kind: RecordKind, sections: Vec<Section>, resources: Vec<Value>) -> Value {
        document_bundle(&DocumentInput {
            kind,
            id: Uuid::new_v4(),
            date: Utc::now(),
            title: kind.type_display().into(),
            patient: &self.patient,
            author: self.author.clone(),
            custodian: self.custodian.clone(),
            encounter: Some(self.encounter.clone()),
            sections,
            resources,
        })
    }
}

fn section(code: SectionCode, lines: &[&str], entries: Vec<Value>) -> Section {
    Section {
        title: code.2.into(),
        code: Some(code),
        lines: lines.iter().map(|l| (*l).to_owned()).collect(),
        entries,
    }
}

fn diagnosis(snomed: Option<&str>) -> DiagnosisLine {
    DiagnosisLine {
        id: Uuid::new_v4(),
        icd_system: "icd11".into(),
        icd_code: Some("1D2Z".into()),
        icd_display: Some("Dengue without warning signs".into()),
        snomed_code: snomed.map(str::to_owned),
        snomed_display: None,
        description: "Dengue fever".into(),
        certainty: Some("probable".into()),
        onset: NaiveDate::from_ymd_opt(2026, 10, 20),
        resolved: None,
        recorded: Utc::now(),
    }
}

fn result(value: &str, numeric: Option<f64>, unit: Option<&str>, loinc: Option<&str>) -> LabResult {
    LabResult {
        id: Uuid::new_v4(),
        name: "Haemoglobin".into(),
        value: value.into(),
        numeric,
        unit: unit.map(str::to_owned),
        range: Some("12.0-15.5".into()),
        flag: Some("low".into()),
        loinc: loinc.map(str::to_owned),
    }
}

fn assert_conformant(bundle: &Value) {
    let v = violations(bundle);
    assert!(v.is_empty(), "violations: {v:#?}");
}

#[test]
fn an_op_consult_with_diagnoses_conforms() {
    let f = Fixture::new(Some(doctor(Some("71-1234-5678-9012"))));
    let dx = condition(&f.ctx(), &diagnosis(Some("38362002")));
    let b = f.bundle(
        RecordKind::OpConsult,
        vec![
            section(
                sections::CHIEF_COMPLAINTS,
                &["Fever 3 days", "Diagnosis: Dengue"],
                vec![dx],
            ),
            section(sections::PHYSICAL_EXAMINATION, &["Febrile"], vec![]),
            section(sections::OP_FOLLOW_UP, &["Review in 3 days"], vec![]),
            section(sections::OP_ADVICE, &["Fluids"], vec![]),
        ],
        vec![],
    );
    assert_conformant(&b);
    let c = &b["entry"][0]["resource"];
    assert!(
        c["encounter"]["reference"].is_string(),
        "OPConsultRecord needs its encounter"
    );
    let cond = b["entry"].as_array().and_then(|e| {
        e.iter()
            .find(|x| x["resource"]["resourceType"] == "Condition")
    });
    let coding = &cond
        .map(|c| &c["resource"]["code"]["coding"])
        .cloned()
        .unwrap_or_default();
    // ICD-11 has no slice in the closed Condition.code.coding: it rides in the text.
    assert_eq!(coding.as_array().map(Vec::len), Some(1));
    assert_eq!(coding[0]["system"], "http://snomed.info/sct");
    assert_eq!(
        coding[0]["display"], "Dengue fever",
        "a SNOMED coding always has a display"
    );
    let text = cond
        .map(|c| &c["resource"]["code"]["text"])
        .cloned()
        .unwrap_or_default();
    assert_eq!(text, "Dengue fever (ICD-11 1D2Z)");
    let mut icd10 = diagnosis(None);
    icd10.icd_system = "icd10".into();
    icd10.icd_code = Some("A90".into());
    let c10 = condition(&f.ctx(), &icd10);
    assert_eq!(
        c10["code"]["coding"][0]["system"],
        "http://hl7.org/fhir/sid/icd-10"
    );
    assert_eq!(c10["code"]["text"], "Dengue fever");
}

#[test]
fn a_prescription_names_its_requester_and_has_one_section() {
    let f = Fixture::new(Some(doctor(None)));
    let rx = medication_request(&f.ctx(), "Paracetamol 500 mg", "1 tab TDS x 3 days");
    assert_eq!(rx["requester"]["type"], "Practitioner");
    let b = f.bundle(
        RecordKind::Prescription,
        vec![section(sections::PRESCRIPTION, &["After food"], vec![rx])],
        vec![],
    );
    assert_conformant(&b);
    // A doctor without an HPR ID still carries a typed identifier.
    let doc = b["entry"].as_array().and_then(|e| {
        e.iter()
            .find(|x| x["resource"]["resourceType"] == "Practitioner")
    });
    assert_eq!(
        doc.map(|d| &d["resource"]["identifier"][0]["type"]["coding"][0]["code"]),
        Some(&json!("EI"))
    );
}

#[test]
fn a_record_without_a_doctor_is_authored_by_the_hospital() {
    let f = Fixture::new(None);
    let rx = medication_request(&f.ctx(), "Amoxicillin 500 mg", "BD x 5 days");
    let b = f.bundle(
        RecordKind::Prescription,
        vec![section(sections::PRESCRIPTION, &[], vec![rx.clone()])],
        vec![],
    );
    assert_conformant(&b);
    let c = &b["entry"][0]["resource"];
    assert_eq!(c["author"][0]["type"], "Organization");
    assert_eq!(c["author"][0], rx["requester"]);
}

#[test]
fn a_lab_report_codes_loinc_and_sends_numbers_as_quantities() {
    let f = Fixture::new(Some(doctor(None)));
    let ctx = f.ctx();
    let hb = observation(
        &ctx,
        &result("10.2", Some(10.2), Some("g/dL"), Some("718-7")),
    );
    let note = observation(&ctx, &result("Positive", None, None, Some("12345")));
    assert_eq!(
        hb["valueQuantity"],
        json!({ "value": 10.2, "unit": "g/dL", "system": "http://unitsofmeasure.org", "code": "g/dL" })
    );
    assert_eq!(hb["code"]["coding"][0]["system"], "http://loinc.org");
    assert_eq!(hb["referenceRange"][0]["low"]["value"], 12.0);
    assert_eq!(hb["interpretation"][0]["coding"][0]["code"], "L");
    assert_eq!(note["valueString"], "Positive");
    assert!(
        note["code"]["coding"].is_null(),
        "an internal code is not LOINC"
    );
    let results = vec![hb, note];
    let report = diagnostic_report(
        &ctx,
        &LabReport {
            name: "CBC",
            loinc: Some("58410-2"),
            conclusion: "Anaemia",
        },
        &results,
    );
    let b = f.bundle(
        RecordKind::DiagnosticReport,
        vec![section(sections::DIAGNOSTIC_REPORT, &[], vec![report])],
        results,
    );
    assert_conformant(&b);
}

#[test]
fn a_discharge_summary_uses_the_discharge_section_codes() {
    let mut f = Fixture::new(Some(doctor(Some("71-1"))));
    f.encounter.inpatient = true;
    let dx = condition(&f.ctx(), &diagnosis(None));
    let b = f.bundle(
        RecordKind::DischargeSummary,
        vec![
            section(sections::CHIEF_COMPLAINTS, &["Dengue"], vec![dx]),
            section(sections::PHYSICAL_EXAMINATION, &["Stable"], vec![]),
            section(
                sections::DISCHARGE_INVESTIGATIONS,
                &["Platelets recovered"],
                vec![],
            ),
            section(sections::DISCHARGE_CARE_PLAN, &["Review in a week"], vec![]),
            section(sections::HOSPITAL_COURSE, &["Uneventful"], vec![]),
        ],
        vec![],
    );
    assert_conformant(&b);
    let enc = b["entry"].as_array().and_then(|e| {
        e.iter()
            .find(|x| x["resource"]["resourceType"] == "Encounter")
    });
    assert_eq!(
        enc.map(|e| &e["resource"]["class"]["code"]),
        Some(&json!("IMP"))
    );
}

#[test]
fn the_checker_catches_what_the_old_bundles_got_wrong() {
    let f = Fixture::new(Some(doctor(None)));
    let mut rx = medication_request(&f.ctx(), "X", "Y");
    if let Some(o) = rx.as_object_mut() {
        o.remove("requester");
    }
    let mut dx = condition(&f.ctx(), &diagnosis(None));
    dx["code"]["coding"] = json!([{ "system": "http://id.who.int/icd/release/11/mms", "code": "1D2Z", "display": "Dengue" }]);
    let old_follow_up = SectionCode(
        sections::CHIEF_COMPLAINTS.0,
        "736271009",
        "Outpatient care plan",
    );
    let mut b = f.bundle(
        RecordKind::OpConsult,
        vec![
            section(old_follow_up, &["Review"], vec![]),
            section(
                SectionCode(
                    sections::CHIEF_COMPLAINTS.0,
                    "422843007",
                    "Chief complaints",
                ),
                &["x"],
                vec![rx, dx],
            ),
        ],
        vec![],
    );
    if let Some(o) = b["entry"][0]["resource"].as_object_mut() {
        o.remove("encounter");
    }
    if let Some(o) = b.as_object_mut() {
        o.remove("timestamp");
        o.remove("meta");
    }
    let v = violations(&b).join("\n");
    assert!(v.contains("Bundle.timestamp missing"), "{v}");
    assert!(
        v.contains("matches no slice (closed)"),
        "an ICD-11 coding: {v}"
    );
    assert!(
        v.contains("Bundle.meta.profile must be DocumentBundle"),
        "{v}"
    );
    assert!(v.contains("Composition.encounter is required"), "{v}");
    assert!(v.contains("MedicationRequest.requester is required"), "{v}");
    assert!(v.contains("after an unsliced section"), "{v}");
    assert!(v.contains("display must be"), "{v}");
    assert!(v.contains("cannot hold MedicationRequest"), "{v}");
}

#[test]
fn the_section_codes_match_the_profiles() {
    let p: Value = serde_json::from_str(include_str!("profiles.json")).unwrap_or_default();
    let slice = |profile: &str, name: &str| {
        let s = p["compositions"][profile]["slices"]
            .as_array()
            .and_then(|s| s.iter().find(|x| x["name"] == name))
            .cloned()
            .unwrap_or_default();
        (
            s["code"].as_str().unwrap_or_default().to_owned(),
            s["display"].as_str().unwrap_or_default().to_owned(),
        )
    };
    let own = |c: SectionCode| (c.1.to_owned(), c.2.to_owned());
    assert_eq!(
        own(sections::CHIEF_COMPLAINTS),
        slice("OPConsultRecord", "ChiefComplaints")
    );
    assert_eq!(
        own(sections::CHIEF_COMPLAINTS),
        slice("DischargeSummaryRecord", "ChiefComplaints")
    );
    assert_eq!(
        own(sections::PHYSICAL_EXAMINATION),
        slice("OPConsultRecord", "PhysicalExamination")
    );
    assert_eq!(
        own(sections::OP_FOLLOW_UP),
        slice("OPConsultRecord", "FollowUp")
    );
    assert_eq!(
        own(sections::DISCHARGE_INVESTIGATIONS),
        slice("DischargeSummaryRecord", "Investigations")
    );
    assert_eq!(
        own(sections::DISCHARGE_CARE_PLAN),
        slice("DischargeSummaryRecord", "CarePlan")
    );
    assert_eq!(
        p["compositions"]["PrescriptionRecord"]["section_code"],
        sections::PRESCRIPTION.1
    );
    assert_eq!(
        p["compositions"]["DischargeSummaryRecord"]["version"],
        "6.5.0"
    );
}

#[test]
fn an_all_digit_internal_code_is_not_labelled_loinc() {
    let view = |code: &str| ObservationView {
        id: Uuid::new_v4(),
        patient_id: Uuid::new_v4(),
        encounter_id: None,
        code: code.into(),
        display: "Hb".into(),
        category: "laboratory".into(),
        effective_at: Utc::now(),
        value_numeric: Some(1.0),
        unit: None,
        value_string: None,
        status: "final".into(),
        abnormal_flag: None,
    };
    assert!(
        observation_to_fhir(&view("123")).code.coding[0]
            .system
            .is_none()
    );
    assert_eq!(
        observation_to_fhir(&view("718-7")).code.coding[0]
            .system
            .as_deref(),
        Some("http://loinc.org")
    );
}

#[test]
fn each_kind_maps_to_its_abdm_hi_type() {
    for (kind, hi) in [
        ("opd_consult", "OPConsultation"),
        ("prescription", "Prescription"),
        ("lab_report", "DiagnosticReport"),
        ("discharge_summary", "DischargeSummary"),
        ("immunization", "ImmunizationRecord"),
        ("wellness", "WellnessRecord"),
        ("health_document", "HealthDocumentRecord"),
        ("invoice", "Invoice"),
    ] {
        assert_eq!(
            RecordKind::from_source_kind(kind).map(RecordKind::hi_type),
            Some(hi)
        );
    }
    assert!(RecordKind::from_source_kind("x").is_none());
}

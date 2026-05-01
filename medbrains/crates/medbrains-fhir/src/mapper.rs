//! Mappers from MedBrains internal types to FHIR R4 resources.
//!
//! Kept in this crate (not in `medbrains-core`) so the core domain
//! types stay free of FHIR vocabulary. Each mapper is a pure function
//! that takes a borrowed internal type and returns the FHIR resource.

use chrono::{DateTime, NaiveDate, Utc};

use crate::r4::coding::{CodeableConcept, Coding};
use crate::r4::encounter::{Encounter, EncounterParticipant, Period};
use crate::r4::identifier::Identifier;
use crate::r4::observation::{Observation, Quantity};
use crate::r4::patient::{Address, ContactPoint, HumanName, Patient};
use crate::r4::reference::Reference;
use uuid::Uuid;

// FHIR system URIs for common identifier vocabularies.
pub const ABHA_SYSTEM: &str = "https://healthid.ndhm.gov.in";
pub const UHID_SYSTEM: &str = "https://medbrains.health/uhid";
pub const LOINC_SYSTEM: &str = "http://loinc.org";
pub const SNOMED_SYSTEM: &str = "http://snomed.info/sct";
pub const UCUM_SYSTEM: &str = "http://unitsofmeasure.org";
pub const ICD10_SYSTEM: &str = "http://hl7.org/fhir/sid/icd-10";
pub const RXNORM_SYSTEM: &str = "http://www.nlm.nih.gov/research/umls/rxnorm";
pub const ATC_SYSTEM: &str = "http://www.whocc.no/atc";
pub const HL7_ACT_CODE: &str = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

/// Minimal patient projection used by the mapper. The full
/// `medbrains_core::Patient` has 60+ fields; we only need ~10. Callers
/// build this from a SQL query that joins exactly what's needed.
pub struct PatientView {
    pub id: Uuid,
    pub uhid: String,
    pub abha_id: Option<String>,
    pub prefix: Option<String>,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub gender: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub is_active: bool,
}

pub fn patient_to_fhir(p: &PatientView) -> Patient {
    let mut identifier = vec![Identifier::new(UHID_SYSTEM, &p.uhid)];
    if let Some(abha) = p.abha_id.as_deref() {
        if !abha.is_empty() {
            identifier.push(Identifier::new(ABHA_SYSTEM, abha));
        }
    }

    let given = [p.first_name.as_str(), p.middle_name.as_deref().unwrap_or("")]
        .into_iter()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let prefix_vec: Vec<String> = p.prefix.iter().cloned().collect();
    let display = [
        p.prefix.as_deref().unwrap_or(""),
        p.first_name.as_str(),
        p.middle_name.as_deref().unwrap_or(""),
        p.last_name.as_str(),
    ]
    .iter()
    .filter(|s| !s.is_empty())
    .copied()
    .collect::<Vec<_>>()
    .join(" ");

    let name = HumanName {
        r#use: Some("official".to_owned()),
        text: Some(display),
        family: Some(p.last_name.clone()),
        given,
        prefix: prefix_vec,
    };

    let mut telecom = Vec::new();
    if let Some(phone) = p.phone.as_deref() {
        if !phone.is_empty() {
            telecom.push(ContactPoint {
                system: "phone".to_owned(),
                value: phone.to_owned(),
                r#use: Some("mobile".to_owned()),
            });
        }
    }
    if let Some(email) = p.email.as_deref() {
        if !email.is_empty() {
            telecom.push(ContactPoint {
                system: "email".to_owned(),
                value: email.to_owned(),
                r#use: None,
            });
        }
    }

    Patient {
        id: p.id.to_string(),
        identifier,
        active: p.is_active,
        name: vec![name],
        telecom,
        gender: Some(map_gender(&p.gender)),
        birth_date: p.date_of_birth.map(|d| d.to_string()),
        address: Vec::<Address>::new(),
    }
}

fn map_gender(g: &str) -> String {
    match g {
        "male" => "male".to_owned(),
        "female" => "female".to_owned(),
        "other" => "other".to_owned(),
        _ => "unknown".to_owned(),
    }
}

/// Minimal projection of an internal `Encounter` row.
pub struct EncounterView {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_display: Option<String>,
    pub doctor_id: Option<Uuid>,
    pub doctor_display: Option<String>,
    pub encounter_type: String,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

pub fn encounter_to_fhir(e: &EncounterView) -> Encounter {
    Encounter {
        id: e.id.to_string(),
        status: map_encounter_status(&e.status),
        class: encounter_class_for(&e.encounter_type),
        kind: vec![CodeableConcept::from_text(e.encounter_type.clone())],
        subject: Reference::to("Patient", e.patient_id).with_display(
            e.patient_display.clone().unwrap_or_default(),
        ),
        participant: e
            .doctor_id
            .map(|did| {
                vec![EncounterParticipant {
                    kind: vec![CodeableConcept::from_coding(
                        "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                        "PPRF",
                        "primary performer",
                    )],
                    individual: Reference::to("Practitioner", did).with_display(
                        e.doctor_display.clone().unwrap_or_default(),
                    ),
                }]
            })
            .unwrap_or_default(),
        period: Some(Period {
            start: e.started_at.to_rfc3339(),
            end: e.ended_at.map(|t| t.to_rfc3339()),
        }),
        reason_code: Vec::new(),
        service_provider: Vec::new(),
    }
}

fn map_encounter_status(s: &str) -> String {
    match s {
        "open" | "in_progress" | "in_consultation" => "in-progress".to_owned(),
        "scheduled" | "waiting" | "called" => "planned".to_owned(),
        "closed" | "completed" | "discharged" => "finished".to_owned(),
        "cancelled" => "cancelled".to_owned(),
        _ => "unknown".to_owned(),
    }
}

fn encounter_class_for(encounter_type: &str) -> Coding {
    let (code, display) = match encounter_type {
        "opd" | "outpatient" | "consultation" => ("AMB", "ambulatory"),
        "ipd" | "inpatient" | "admission" => ("IMP", "inpatient encounter"),
        "emergency" => ("EMER", "emergency"),
        "home_visit" => ("HH", "home health"),
        _ => ("AMB", "ambulatory"),
    };
    Coding {
        system: Some(HL7_ACT_CODE.to_owned()),
        code: code.to_owned(),
        display: Some(display.to_owned()),
    }
}

/// Minimal projection of a vital-sign or lab-result row.
pub struct ObservationView {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    /// LOINC code (preferred) or our internal code; mapper picks system.
    pub code: String,
    pub display: String,
    pub category: String, // "vital-signs" | "laboratory" | "imaging"
    pub effective_at: DateTime<Utc>,
    pub value_numeric: Option<f64>,
    pub unit: Option<String>,
    pub value_string: Option<String>,
    pub status: String, // final | preliminary | amended | cancelled
    pub abnormal_flag: Option<String>, // "H" | "L" | "HH" | "LL" | None
}

pub fn observation_to_fhir(o: &ObservationView) -> Observation {
    let code_system = if o.code.chars().any(char::is_alphabetic) {
        // Heuristic: LOINC codes are numeric-with-dashes (e.g. 8480-6).
        // Anything alphabetic is internal — drop the system.
        None
    } else {
        Some(LOINC_SYSTEM.to_owned())
    };

    let code = CodeableConcept {
        coding: vec![Coding {
            system: code_system,
            code: o.code.clone(),
            display: Some(o.display.clone()),
        }],
        text: Some(o.display.clone()),
    };

    let category = vec![CodeableConcept {
        coding: vec![Coding {
            system: Some(
                "http://terminology.hl7.org/CodeSystem/observation-category".to_owned(),
            ),
            code: o.category.clone(),
            display: None,
        }],
        text: None,
    }];

    let interpretation = o
        .abnormal_flag
        .as_ref()
        .map(|f| {
            let display = match f.as_str() {
                "H" => "High",
                "L" => "Low",
                "HH" => "Critical high",
                "LL" => "Critical low",
                _ => "Abnormal",
            };
            vec![CodeableConcept::from_coding(
                "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                f.clone(),
                display,
            )]
        })
        .unwrap_or_default();

    Observation {
        id: o.id.to_string(),
        status: o.status.clone(),
        category,
        code,
        subject: Reference::to("Patient", o.patient_id),
        encounter: o.encounter_id.map(|e| Reference::to("Encounter", e)),
        effective_date_time: Some(o.effective_at.to_rfc3339()),
        value_quantity: o.value_numeric.map(|v| Quantity {
            value: v,
            unit: o.unit.clone(),
            system: o.unit.as_ref().map(|_| UCUM_SYSTEM.to_owned()),
            code: o.unit.clone(),
        }),
        value_string: o.value_string.clone(),
        interpretation,
    }
}

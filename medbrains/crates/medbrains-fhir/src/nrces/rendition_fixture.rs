//! The records `rendition_tests` prints: one bundle of each kind as the HIP
//! builds it, with typical content. Synthetic data only.

use chrono::{NaiveDate, Utc};
use serde_json::Value;
use uuid::Uuid;

use super::sections::{self, SectionCode};
use super::{
    Clinical, DocumentInput, DocumentLine, EncounterInfo, ImmunizationLine, InvoiceHeader,
    LabReport, LabResult, Party, RecordKind, Section, VitalsLine, author_reference,
    diagnostic_report, document_bundle, document_reference, immunization, invoice,
    medication_request, observation, vital_observations,
};
use crate::mapper::PatientView;

/// `%PDF-1.4 %%EOF`: what the renderer's bytes look like, base64.
pub(super) const PDF: &str = "JVBERi0xLjQKJSVFT0YK";

/// A patient seen by a doctor at a hospital, on one visit.
pub(super) struct Fixture {
    pub(super) patient: PatientView,
    pub(super) doctor: Party,
    pub(super) hospital: Party,
    pub(super) visit: EncounterInfo,
}

impl Fixture {
    /// The one visit every record in these tests is from.
    pub(super) fn new() -> Self {
        Self {
            patient: PatientView {
                id: Uuid::new_v4(),
                uhid: "UH-77".into(),
                abha_id: Some("91-1111-2222-3333".into()),
                prefix: None,
                first_name: "Test".into(),
                middle_name: None,
                last_name: "Patient".into(),
                gender: "female".into(),
                date_of_birth: NaiveDate::from_ymd_opt(1990, 5, 10),
                phone: Some("+91 90000 00001".into()),
                email: None,
                is_active: true,
            },
            doctor: Party {
                id: Uuid::new_v4(),
                name: "Dr Sample Doctor".into(),
                registry_id: Some("71-0000-0000-0001".into()),
            },
            hospital: Party {
                id: Uuid::new_v4(),
                name: "Example Hospital".into(),
                registry_id: None,
            },
            visit: EncounterInfo {
                id: Uuid::new_v4(),
                inpatient: false,
                start: Some(Utc::now()),
                end: None,
            },
        }
    }

    /// The clinical context every resource is written in.
    fn ctx(&self) -> Clinical {
        Clinical {
            patient_id: self.patient.id,
            encounter_id: Some(self.visit.id),
            at: Utc::now(),
            practitioner: author_reference(Some(&self.doctor), &self.hospital),
        }
    }

    /// The document bundle of `kind` holding `sections` and `resources`.
    fn bundle(&self, kind: RecordKind, sections: Vec<Section>, resources: Vec<Value>) -> Value {
        let mut visit = self.visit.clone();
        visit.inpatient = kind == RecordKind::DischargeSummary;
        document_bundle(&DocumentInput {
            kind,
            id: Uuid::new_v4(),
            date: Utc::now(),
            title: kind.type_display().into(),
            patient: &self.patient,
            author: Some(self.doctor.clone()),
            custodian: self.hospital.clone(),
            encounter: Some(visit),
            sections,
            resources,
        })
    }

    /// A bundle of `kind` as the HIP builds it, with typical content.
    pub(super) fn record(&self, kind: RecordKind) -> Value {
        let ctx = self.ctx();
        match kind {
            RecordKind::OpConsult => self.bundle(
                kind,
                vec![
                    section(sections::CHIEF_COMPLAINTS, &["Fever 3 days"], vec![]),
                    section(sections::OP_FOLLOW_UP, &["Review in 3 days"], vec![]),
                    section(sections::OP_ADVICE, &["Fluids & rest"], vec![]),
                ],
                vec![],
            ),
            RecordKind::Prescription => {
                let rx = medication_request(&ctx, "Paracetamol 500 mg", "1 tab TDS x 3 days");
                self.bundle(
                    kind,
                    vec![section(sections::PRESCRIPTION, &[], vec![rx])],
                    vec![],
                )
            }
            RecordKind::DiagnosticReport => {
                let hb = observation(&ctx, &haemoglobin());
                let report = LabReport {
                    name: "CBC",
                    loinc: None,
                    conclusion: "Anaemia",
                };
                let dr = diagnostic_report(&ctx, &report, std::slice::from_ref(&hb));
                self.bundle(
                    kind,
                    vec![section(sections::DIAGNOSTIC_REPORT, &[], vec![dr])],
                    vec![hb],
                )
            }
            RecordKind::DischargeSummary => self.bundle(
                kind,
                vec![
                    section(sections::CHIEF_COMPLAINTS, &["Dengue"], vec![]),
                    section(sections::HOSPITAL_COURSE, &["Uneventful"], vec![]),
                ],
                vec![],
            ),
            _ => self.later_record(kind, &ctx),
        }
    }

    /// The kinds `record` leaves to this: immunization, wellness, an
    /// uploaded document and an invoice.
    fn later_record(&self, kind: RecordKind, ctx: &Clinical) -> Value {
        match kind {
            RecordKind::Immunization => {
                let shot = immunization(ctx, &hepatitis_b());
                self.bundle(
                    kind,
                    vec![section(sections::IMMUNIZATION, &[], vec![shot])],
                    vec![],
                )
            }
            RecordKind::Wellness => {
                let row = VitalsLine {
                    pulse: Some(84.0),
                    ..VitalsLine::default()
                };
                let (vitals, _) = vital_observations(ctx, &[row]);
                let titled = Section {
                    title: "Vital Signs".into(),
                    code: None,
                    lines: vec![],
                    entries: vitals,
                };
                self.bundle(kind, vec![titled], vec![])
            }
            RecordKind::HealthDocument => {
                let doc = document_reference(
                    ctx,
                    &DocumentLine {
                        id: Uuid::new_v4(),
                        title: "Referral letter".into(),
                        content_type: "application/pdf".into(),
                        data: PDF.into(),
                        created: Utc::now(),
                    },
                );
                self.bundle(
                    kind,
                    vec![section(sections::HEALTH_DOCUMENT, &[], vec![doc])],
                    vec![],
                )
            }
            _ => {
                let bill = invoice(ctx, &bill(), &[]);
                let only = Section {
                    title: "Invoice".into(),
                    code: None,
                    lines: vec![],
                    entries: vec![bill],
                };
                self.bundle(kind, vec![only], vec![])
            }
        }
    }
}

/// A section of `code` with `lines` of text and `entries`.
fn section(code: SectionCode, lines: &[&str], entries: Vec<Value>) -> Section {
    Section {
        title: code.2.into(),
        code: Some(code),
        lines: lines.iter().map(|l| (*l).to_owned()).collect(),
        entries,
    }
}

/// A low haemoglobin result.
fn haemoglobin() -> LabResult {
    LabResult {
        id: Uuid::new_v4(),
        name: "Haemoglobin".into(),
        value: "10.2".into(),
        numeric: Some(10.2),
        unit: Some("g/dL".into()),
        range: Some("12.0-15.5".into()),
        flag: Some("low".into()),
        loinc: None,
    }
}

/// A second hepatitis B dose.
fn hepatitis_b() -> ImmunizationLine {
    ImmunizationLine {
        id: Uuid::new_v4(),
        vaccine: "Hepatitis B vaccine".into(),
        code: None,
        on: NaiveDate::from_ymd_opt(2026, 10, 1).unwrap_or_default(),
        dose: Some(2),
        lot: None,
        route: None,
        given_elsewhere: false,
    }
}

/// A paid bill.
fn bill() -> InvoiceHeader {
    InvoiceHeader {
        id: Uuid::new_v4(),
        number: "INV-1".into(),
        paid: true,
        kind: "03",
        date: Utc::now(),
        currency: "INR".into(),
        net: 100.0,
        gross: 100.0,
    }
}

/// The PDF-carrying resources in a bundle.
pub(super) fn pdfs(b: &Value) -> Vec<&Value> {
    b["entry"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| &e["resource"])
        .filter(|r| {
            r["data"] == PDF && r["contentType"] == "application/pdf"
                || r["content"][0]["attachment"]["data"] == PDF
        })
        .collect()
}

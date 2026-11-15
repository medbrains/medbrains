//! Every shared structured record carries its PDF where its profile takes
//! one, the printed copy names the patient and the doctor, and an invoice
//! or an uploaded document gets none. Synthetic data only.

use chrono::{NaiveDate, Utc};
use serde_json::Value;
use uuid::Uuid;

use super::golden::assert_conformant;
use super::sections::{self, SectionCode};
use super::{
    Clinical, DocumentInput, DocumentLine, EncounterInfo, ImmunizationLine, InvoiceHeader,
    LabReport, LabResult, Party, RecordKind, Section, VitalsLine, attach_pdf, author_reference,
    diagnostic_report, document_bundle, document_reference, immunization, invoice,
    medication_request, observation, rendition, vital_observations,
};
use crate::mapper::PatientView;

/// `%PDF-1.4 %%EOF`: what the renderer's bytes look like, base64.
const PDF: &str = "JVBERi0xLjQKJSVFT0YK";

struct Fixture {
    patient: PatientView,
    doctor: Party,
    hospital: Party,
    visit: EncounterInfo,
}

impl Fixture {
    fn new() -> Self {
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

    fn ctx(&self) -> Clinical {
        Clinical {
            patient_id: self.patient.id,
            encounter_id: Some(self.visit.id),
            at: Utc::now(),
            practitioner: author_reference(Some(&self.doctor), &self.hospital),
        }
    }

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
    fn record(&self, kind: RecordKind) -> Value {
        let ctx = self.ctx();
        let s = |code: SectionCode, lines: &[&str], entries: Vec<Value>| Section {
            title: code.2.into(),
            code: Some(code),
            lines: lines.iter().map(|l| (*l).to_owned()).collect(),
            entries,
        };
        match kind {
            RecordKind::OpConsult => self.bundle(
                kind,
                vec![
                    s(sections::CHIEF_COMPLAINTS, &["Fever 3 days"], vec![]),
                    s(sections::OP_FOLLOW_UP, &["Review in 3 days"], vec![]),
                    s(sections::OP_ADVICE, &["Fluids & rest"], vec![]),
                ],
                vec![],
            ),
            RecordKind::Prescription => {
                let rx = medication_request(&ctx, "Paracetamol 500 mg", "1 tab TDS x 3 days");
                self.bundle(kind, vec![s(sections::PRESCRIPTION, &[], vec![rx])], vec![])
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
                    vec![s(sections::DIAGNOSTIC_REPORT, &[], vec![dr])],
                    vec![hb],
                )
            }
            RecordKind::DischargeSummary => self.bundle(
                kind,
                vec![
                    s(sections::CHIEF_COMPLAINTS, &["Dengue"], vec![]),
                    s(sections::HOSPITAL_COURSE, &["Uneventful"], vec![]),
                ],
                vec![],
            ),
            RecordKind::Immunization => {
                let shot = immunization(&ctx, &hepatitis_b());
                self.bundle(
                    kind,
                    vec![s(sections::IMMUNIZATION, &[], vec![shot])],
                    vec![],
                )
            }
            RecordKind::Wellness => {
                let row = VitalsLine {
                    pulse: Some(84.0),
                    ..VitalsLine::default()
                };
                let (vitals, _) = vital_observations(&ctx, &[row]);
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
                    &ctx,
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
                    vec![s(sections::HEALTH_DOCUMENT, &[], vec![doc])],
                    vec![],
                )
            }
            RecordKind::Invoice => {
                let bill = invoice(&ctx, &bill(), &[]);
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
fn pdfs(b: &Value) -> Vec<&Value> {
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

const STRUCTURED: [RecordKind; 6] = [
    RecordKind::OpConsult,
    RecordKind::Prescription,
    RecordKind::DiagnosticReport,
    RecordKind::DischargeSummary,
    RecordKind::Immunization,
    RecordKind::Wellness,
];

#[test]
fn each_structured_record_carries_its_pdf_where_its_profile_takes_one() {
    let f = Fixture::new();
    for kind in STRUCTURED {
        let mut b = f.record(kind);
        assert!(attach_pdf(&mut b, PDF), "{kind:?} takes a PDF");
        assert_conformant(&b);
        let found = pdfs(&b);
        assert_eq!(found.len(), 1, "{kind:?} carries exactly one PDF");
        let want = if kind == RecordKind::Prescription {
            "Binary"
        } else {
            "DocumentReference"
        };
        assert_eq!(found[0]["resourceType"], want, "{kind:?}");
        // The PDF is listed by a section, not left loose in the bundle.
        let id = found[0]["id"].as_str().unwrap_or_default();
        let listed = b["entry"][0]["resource"]["section"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|s| {
                s["entry"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|e| e["reference"] == format!("urn:uuid:{id}"))
            });
        assert!(listed, "{kind:?}: a section lists the PDF");
    }
}

#[test]
fn the_printed_copy_names_the_patient_and_the_doctor() {
    let f = Fixture::new();
    let today = NaiveDate::from_ymd_opt(2026, 11, 15).unwrap_or_default();
    for kind in STRUCTURED {
        let r = rendition(&f.record(kind), today)
            .map(|v| v["record"].clone())
            .unwrap_or_default();
        let p = &r["patient"];
        assert_eq!(p["name"], "Test Patient", "{kind:?}");
        assert_eq!(p["age"], "36 years");
        assert_eq!(p["gender"], "female");
        assert_eq!(p["mobile"], "+91 90000 00001");
        assert_eq!(p["abha_number"], "91-1111-2222-3333");
        assert_eq!(r["doctor"]["name"], "Dr Sample Doctor", "{kind:?}");
        assert_eq!(r["doctor"]["id"], f.doctor.id.to_string());
        assert_eq!(r["hospital"], "Example Hospital");
    }
    let lines = |kind| {
        rendition(&f.record(kind), today).map_or_else(Vec::new, |v| {
            v["record"]["sections"]
                .as_array()
                .into_iter()
                .flatten()
                .flat_map(|s| s["lines"].as_array().cloned().unwrap_or_default())
                .filter_map(|l| l.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
    };
    assert!(
        lines(RecordKind::OpConsult).contains(&"Fluids & rest".to_owned()),
        "narratives unescaped"
    );
    assert!(
        lines(RecordKind::Prescription)
            .contains(&"Paracetamol 500 mg — 1 tab TDS x 3 days".to_owned())
    );
    let lab = lines(RecordKind::DiagnosticReport);
    assert!(
        lab.iter().any(|l| l.starts_with("Haemoglobin: 10.2 g/dL")),
        "{lab:?}"
    );
    assert!(lab.contains(&"Conclusion: Anaemia".to_owned()));
    assert!(
        lines(RecordKind::Immunization)
            .iter()
            .any(|l| l.contains("Hepatitis B vaccine") && l.contains("dose 2"))
    );
}

#[test]
fn an_invoice_or_uploaded_document_gets_no_rendition() {
    let f = Fixture::new();
    for kind in [RecordKind::Invoice, RecordKind::HealthDocument] {
        let mut b = f.record(kind);
        let before = b.clone();
        assert!(rendition(&b, Utc::now().date_naive()).is_none(), "{kind:?}");
        assert!(!attach_pdf(&mut b, PDF), "{kind:?}");
        assert_eq!(b, before, "{kind:?} is left as built");
    }
    assert!(
        pdfs(&f.record(RecordKind::Invoice)).is_empty(),
        "an invoice carries no PDF"
    );
}

#[test]
fn the_pdf_section_comes_before_the_trailing_narratives() {
    let f = Fixture::new();
    for (kind, slice, trailing) in [
        (
            RecordKind::OpConsult,
            sections::OP_DOCUMENT,
            sections::OP_ADVICE,
        ),
        (
            RecordKind::DischargeSummary,
            sections::DISCHARGE_DOCUMENT,
            sections::HOSPITAL_COURSE,
        ),
    ] {
        let mut b = f.record(kind);
        attach_pdf(&mut b, PDF);
        let codes: Vec<String> = b["entry"][0]["resource"]["section"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|s| s["code"]["coding"][0]["code"].as_str().map(str::to_owned))
            .collect();
        let at = |c: &str| codes.iter().position(|x| x == c);
        assert!(
            at(slice.1) < at(trailing.1) && at(slice.1).is_some(),
            "{kind:?}: {codes:?}"
        );
    }
}

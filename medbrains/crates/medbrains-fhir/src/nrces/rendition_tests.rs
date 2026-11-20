//! Every shared structured record carries its PDF where its profile takes
//! one, the printed copy names the patient and the doctor, and an invoice
//! or an uploaded document gets none. Synthetic data only.

use chrono::{NaiveDate, Utc};

use super::golden::assert_conformant;
use super::rendition_fixture::{Fixture, PDF, pdfs};
use super::sections;
use super::{RecordKind, attach_pdf, rendition};

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

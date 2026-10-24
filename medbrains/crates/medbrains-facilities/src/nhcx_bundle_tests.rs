use chrono::Utc;
use serde_json::{Value, json};
use uuid::Uuid;

use super::*;
use crate::nhcx_claim_documents::DocKind;
use crate::nhcx_common::{PatientParty, PolicyParty, ProviderParty};

fn pdf(kind: DocKind, title: &str) -> DocumentRef {
    DocumentRef {
        document_type: title.to_owned(),
        file_name: Some(title.to_owned()),
        file_path: None,
        mime_type: Some("application/pdf".to_owned()),
        created_at: Utc::now(),
        data: Some("JVBERi0xLjQK".to_owned()),
        kind: Some(kind),
    }
}

fn final_claim(documents: &[DocumentRef]) -> Value {
    let patient = PatientParty {
        id: Uuid::new_v4(),
        uhid: "UH-1".to_owned(),
        first_name: "R".to_owned(),
        last_name: "Lakshmi".to_owned(),
        gender: "female".to_owned(),
        date_of_birth: None,
        abha_number: None,
    };
    let policy = PolicyParty::default();
    let provider = ProviderParty {
        name: "Hospital".to_owned(),
        hfr_facility_id: None,
    };
    let parties = Parties {
        patient: &patient,
        policy: &policy,
        provider: &provider,
        doctor: None,
        recipient: "payer@sbx",
    };
    let notes = ["Bill total INR 100".to_owned()];
    let content = ClaimContent {
        id: Uuid::new_v4(),
        use_: "claim",
        urgent: false,
        items: &[],
        diagnoses: &[],
        documents,
        pre_auth_ref: None,
        total: None,
        notes: &notes,
    };
    claim_bundle(&parties, &content)
}

fn supporting(bundle: &Value) -> Vec<Value> {
    bundle["entry"][0]["resource"]["supportingInfo"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

#[test]
fn every_document_goes_as_a_pdf_attachment_with_its_nrces_codes() {
    let docs = [
        pdf(DocKind::DischargeSummary, "Discharge Summary"),
        pdf(DocKind::FinalBill, "IPD Final Bill"),
        pdf(DocKind::LabReport, "Lab report — Haemoglobin"),
    ];
    let info = supporting(&final_claim(&docs));
    let expected = [("HDS", "DCR"), ("MB", "FB"), ("INV", "LIR")];
    for (i, (cat, code)) in expected.iter().enumerate() {
        let entry = &info[i];
        assert_eq!(entry["sequence"], json!(i + 1));
        assert_eq!(entry["category"]["coding"][0]["code"], json!(cat));
        assert_eq!(entry["code"]["coding"][0]["code"], json!(code));
        let att = &entry["valueAttachment"];
        assert_eq!(att["contentType"], json!("application/pdf"));
        assert!(att["data"].as_str().is_some_and(|d| !d.is_empty()));
        assert_eq!(att["title"], json!(docs[i].document_type));
        assert!(att["creation"].is_string());
    }
}

#[test]
fn the_bill_note_follows_the_documents_and_every_entry_has_a_code() {
    let docs = [pdf(DocKind::PatientDocument, "Referral letter")];
    let info = supporting(&final_claim(&docs));
    assert_eq!(info.len(), 2);
    assert_eq!(info[0]["category"]["coding"][0]["code"], json!("ATT"));
    assert_eq!(info[0]["code"]["text"], json!("Referral letter"));
    assert_eq!(info[1]["sequence"], json!(2));
    assert!(info[1]["valueString"].is_string());
    assert!(
        info.iter().all(|i| i["code"].is_object()),
        "code is 1..1 in the IG"
    );
}

fn line(system: &str, code: &str) -> DiagnosisLine {
    DiagnosisLine {
        icd_code: Some(code.to_owned()),
        icd_system: system.to_owned(),
        description: format!("Fixture {code}"),
        snomed_code: None,
        is_primary: true,
    }
}

#[test]
fn each_diagnosis_goes_in_the_system_it_was_coded_in() {
    // Fixture codes, not a catalogue.
    let icd10 = diagnosis(1, &line("icd10", "A90"));
    let icd11 = diagnosis(2, &line("icd11", "1D2Z"));
    let coding = |v: &Value| v["diagnosisCodeableConcept"]["coding"][0]["system"].clone();
    assert_eq!(coding(&icd10), "http://hl7.org/fhir/sid/icd-10");
    assert_eq!(coding(&icd11), "http://id.who.int/icd/release/11/mms");
    // A typed code of neither shape is not guessed into a system.
    let unknown = diagnosis(3, &line("", "12345"));
    assert_eq!(
        unknown["diagnosisCodeableConcept"]["coding"],
        serde_json::json!([])
    );
    assert_eq!(unknown["diagnosisCodeableConcept"]["text"], "Fixture 12345");
}

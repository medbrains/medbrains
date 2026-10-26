//! The NHCX bundles our builders send, built from a realistic pre-auth and
//! final claim, and written to `NRCES_BUNDLE_DIR` (when set) for the HL7
//! validator run in `make check-fhir-validator`. The structural assertions
//! here are the floor; the validator with the pinned IG is the real check.

use std::collections::HashSet;

use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use medbrains_fhir::nrces::Party;
use medbrains_fhir::nrces::conformance::nhcx_violations;

use crate::nhcx_bundle::{
    ClaimContent, DiagnosisLine, DocumentRef, ItemLine, Parties, claim_bundle, communication,
    eligibility_bundle,
};
use crate::nhcx_claim_documents::DocKind;
use crate::nhcx_common::{PatientParty, PolicyParty, ProviderParty};
use crate::nhcx_task_bundle::{TaskAsk, TaskParties, task_bundle};

fn emit(name: &str, bundle: &Value) {
    if let Ok(dir) = std::env::var("NRCES_BUNDLE_DIR") {
        let path = format!("{dir}/nhcx-{name}.json");
        let body = serde_json::to_vec_pretty(bundle).unwrap_or_default();
        assert!(std::fs::write(&path, body).is_ok(), "cannot write {path}");
    }
}

/// Every `urn:uuid:` reference names an entry of the bundle.
fn assert_references_resolve(bundle: &Value) {
    let urls: HashSet<&str> = bundle["entry"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|e| e["fullUrl"].as_str())
        .collect();
    let text = bundle.to_string();
    for r in text.split("\"reference\":\"").skip(1) {
        let r = r.split('"').next().unwrap_or_default();
        if r.starts_with("urn:uuid:") {
            assert!(urls.contains(r), "{r} does not resolve");
        }
    }
}

fn patient() -> PatientParty {
    PatientParty {
        id: Uuid::new_v4(),
        uhid: "UH-2041".to_owned(),
        first_name: "Lakshmi".to_owned(),
        last_name: "R".to_owned(),
        gender: "female".to_owned(),
        date_of_birth: NaiveDate::from_ymd_opt(1984, 3, 2),
        abha_number: Some("91-1111-2222-3333".to_owned()),
    }
}

fn policy() -> PolicyParty {
    PolicyParty {
        insurance_provider: "Sandbox General Insurance".to_owned(),
        policy_number: Some("POL-778812".to_owned()),
        member_id: Some("MEM-55120".to_owned()),
        plan_name: Some("Family Floater Gold".to_owned()),
        policy_holder_relation: Some("self".to_owned()),
        valid_from: NaiveDate::from_ymd_opt(2026, 4, 1),
        valid_until: NaiveDate::from_ymd_opt(2027, 3, 31),
    }
}

fn provider() -> ProviderParty {
    ProviderParty {
        id: Uuid::new_v4(),
        name: "City Hospital".to_owned(),
        hfr_facility_id: Some("IN2710000001".to_owned()),
    }
}

fn diagnoses() -> Vec<DiagnosisLine> {
    vec![DiagnosisLine {
        icd_code: Some("K35.8".to_owned()),
        icd_system: "icd10".to_owned(),
        description: "Acute appendicitis".to_owned(),
        snomed_code: Some("85189001".to_owned()),
        is_primary: true,
    }]
}

fn items() -> Vec<ItemLine> {
    vec![ItemLine {
        code: Some("SG039A".to_owned()),
        description: "Laparoscopic appendicectomy".to_owned(),
        quantity: Some(1),
        unit_price: Some(Decimal::new(45_000, 0)),
        net: Some(Decimal::new(45_000, 0)),
    }]
}

fn discharge_summary() -> DocumentRef {
    DocumentRef {
        document_type: "Discharge summary".to_owned(),
        file_name: Some("discharge-summary.pdf".to_owned()),
        file_path: None,
        mime_type: Some("application/pdf".to_owned()),
        created_at: Utc::now(),
        data: Some("JVBERi0xLjQK".to_owned()),
        kind: Some(DocKind::DischargeSummary),
    }
}

fn claim(use_: &str, pre_auth_ref: Option<&str>) -> Value {
    let (p, pol, prov) = (patient(), policy(), provider());
    let doctor = Party {
        id: Uuid::new_v4(),
        name: "Dr Arun Kumar".to_owned(),
        registry_id: Some("71-4455-6677-8899".to_owned()),
    };
    let parties = Parties {
        patient: &p,
        policy: &pol,
        provider: &prov,
        doctor: Some(&doctor),
        recipient: "1000003538@sbx",
    };
    let notes = ["Room rent INR 6000, surgery INR 39000".to_owned()];
    claim_bundle(
        &parties,
        &ClaimContent {
            id: Uuid::new_v4(),
            use_,
            urgent: false,
            items: &items(),
            diagnoses: &diagnoses(),
            documents: &[discharge_summary()],
            pre_auth_ref,
            total: None,
            notes: &notes,
        },
    )
}

#[test]
fn the_nhcx_bundles_reference_only_their_own_entries() {
    let (p, pol, prov) = (patient(), policy(), provider());
    // The desk clerk asking has no HPR id: named by our staff id.
    let desk = Party {
        id: Uuid::new_v4(),
        name: "Meena S".to_owned(),
        registry_id: None,
    };
    let parties = Parties {
        patient: &p,
        policy: &pol,
        provider: &prov,
        doctor: Some(&desk),
        recipient: "1000003538@sbx",
    };
    let eligibility = eligibility_bundle(&parties, Uuid::new_v4(), &[("1", "Medical Care")]);
    let preauth = claim("preauthorization", None);
    let final_claim = claim("claim", Some("PA-2026-0042"));
    let tasks = TaskParties {
        provider: &prov,
        payer_name: "Sandbox General Insurance",
        payer_code: "1000003538@sbx",
    };
    let search = task_bundle(
        &TaskAsk::Search {
            from: NaiveDate::from_ymd_opt(2026, 10, 1).unwrap_or_default(),
            to: NaiveDate::from_ymd_opt(2026, 10, 19).unwrap_or_default(),
            claim_number: None,
        },
        &tasks,
    );
    let reprocess = task_bundle(
        &TaskAsk::Reprocess {
            focus: Uuid::new_v4(),
            number: "CLM-1",
            reason: "Bills attached",
            rejected: true,
        },
        &tasks,
    );
    for (name, b) in [
        ("eligibility", &eligibility),
        ("preauth", &preauth),
        ("claim", &final_claim),
        ("task-search", &search),
        ("task-reprocess", &reprocess),
    ] {
        assert_eq!(b["type"], "collection", "{name}");
        assert_references_resolve(b);
        assert_eq!(nhcx_violations(b), Vec::<String>::new(), "{name}");
        emit(name, b);
    }
    let answer = communication(
        Uuid::new_v4(),
        Uuid::new_v4(),
        "Reports attached",
        &[discharge_summary()],
    );
    assert_eq!(answer["resourceType"], "Communication");
    assert_eq!(nhcx_violations(&answer), Vec::<String>::new());
    emit("communication", &answer);
}

/// Given a final claim with no billed lines and no coded diagnosis (an
/// admission closed before coding), When the desk submits it, Then the check
/// names both gaps, so the desk is told before the payer refuses it.
#[test]
fn a_claim_without_lines_or_diagnoses_is_refused_with_both_reasons() {
    let (p, pol, prov) = (patient(), policy(), provider());
    let parties = Parties {
        patient: &p,
        policy: &pol,
        provider: &prov,
        doctor: None,
        recipient: "1000003538@sbx",
    };
    let bare = claim_bundle(
        &parties,
        &ClaimContent {
            id: Uuid::new_v4(),
            use_: "claim",
            urgent: false,
            items: &[],
            diagnoses: &[],
            documents: &[],
            pre_auth_ref: None,
            total: None,
            notes: &[],
        },
    );
    let broken = nhcx_violations(&bare).join("\n");
    assert!(broken.contains("Claim.diagnosis is required"), "{broken}");
    assert!(broken.contains("Claim.item is required"), "{broken}");
    // A status enquiry carries an empty payload: nothing to check.
    assert!(nhcx_violations(&serde_json::json!({})).is_empty());
}

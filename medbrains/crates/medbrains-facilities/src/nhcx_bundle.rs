//! The FHIR R4 messages MedBrains sends to NHCX, per the NRCeS NHCX IG:
//! `CoverageEligibilityRequestBundle`, `ClaimBundle` (claim or
//! pre-authorisation) and the `Communication` that answers a payer query.
//!
//! Every bundle names the same parties: the patient (UHID, and the ABHA
//! number when ABDM verified it), the insurer by its HCX code, the hospital
//! as an Organization with its HFR id, the treating doctor with an HPR id
//! where known, and the Coverage built from the patient's policy.

use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::nhcx::{
    BENEFIT_CATEGORY_SYSTEM, CLAIM_BUNDLE_PROFILE, CLAIM_INFO_CATEGORY_SYSTEM,
    COMMUNICATION_PROFILE, CONFIDENTIALITY_SYSTEM, COVERAGE_ELIGIBILITY_BUNDLE_PROFILE,
    DIAGNOSIS_TYPE_SYSTEM, ICD11_SYSTEM, SNOMED_HEALTHCARE_PROFESSIONAL_CODE,
    SNOMED_INSTITUTIONAL_CLAIM_CODE,
};
use medbrains_fhir::mapper::{
    ABHA_SYSTEM, HFR_SYSTEM, HPR_SYSTEM, ICD10_SYSTEM, POLICY_SYSTEM, PROCESS_PRIORITY_SYSTEM,
    SNOMED_SYSTEM, UHID_SYSTEM,
};

use crate::nhcx_common::{PatientParty, PolicyParty, ProviderParty};

/// Who the message is about, from, and to.
pub(crate) struct Parties<'a> {
    pub(crate) patient: &'a PatientParty,
    pub(crate) policy: &'a PolicyParty,
    pub(crate) provider: &'a ProviderParty,
    /// The treating doctor's name and HPR id.
    pub(crate) doctor: Option<&'a (String, Option<String>)>,
    /// The payer's HCX participant code.
    pub(crate) recipient: &'a str,
}

/// A coded diagnosis from the encounter.
#[derive(Debug, sqlx::FromRow)]
pub(crate) struct DiagnosisLine {
    pub(crate) icd_code: Option<String>,
    pub(crate) icd_system: String,
    pub(crate) description: String,
    pub(crate) snomed_code: Option<String>,
    pub(crate) is_primary: bool,
}

/// A document sent as supporting information.
#[derive(Debug, sqlx::FromRow)]
pub(crate) struct DocumentRef {
    pub(crate) document_type: String,
    pub(crate) file_name: Option<String>,
    pub(crate) file_path: Option<String>,
    pub(crate) mime_type: Option<String>,
    pub(crate) created_at: chrono::DateTime<Utc>,
}

/// One billed or estimated line.
pub(crate) struct ItemLine {
    pub(crate) code: Option<String>,
    pub(crate) description: String,
    pub(crate) unit_price: Option<Decimal>,
    pub(crate) net: Option<Decimal>,
}

/// What a Claim carries beyond the parties.
pub(crate) struct ClaimContent<'a> {
    pub(crate) id: Uuid,
    /// `claim` or `preauthorization`.
    pub(crate) use_: &'a str,
    pub(crate) urgent: bool,
    pub(crate) items: &'a [ItemLine],
    pub(crate) diagnoses: &'a [DiagnosisLine],
    pub(crate) documents: &'a [DocumentRef],
}

fn fresh() -> (Uuid, String) {
    let id = Uuid::new_v4();
    (id, format!("urn:uuid:{id}"))
}

fn money(d: Option<Decimal>) -> Option<Value> {
    d.and_then(|d| d.to_f64())
        .map(|v| json!({ "value": v, "currency": "INR" }))
}

/// The intra-bundle references every bundle shares.
struct Urns {
    patient: String,
    coverage: (Uuid, String),
    insurer: (Uuid, String),
    provider: (Uuid, String),
    practitioner: (Uuid, String),
}

impl Urns {
    fn new(patient_id: Uuid) -> Self {
        Self {
            patient: format!("urn:uuid:{patient_id}"),
            coverage: fresh(),
            insurer: fresh(),
            provider: fresh(),
            practitioner: fresh(),
        }
    }
}

fn patient_entry(p: &PatientParty, urn: &str) -> Value {
    let mut identifier = vec![json!({ "system": UHID_SYSTEM, "value": p.uhid })];
    if let Some(abha) = p.abha_number.as_deref().filter(|s| !s.is_empty()) {
        identifier.push(json!({ "system": ABHA_SYSTEM, "value": abha }));
    }
    json!({ "fullUrl": urn, "resource": {
        "resourceType": "Patient",
        "id": p.id,
        "identifier": identifier,
        "name": [{ "text": format!("{} {}", p.first_name, p.last_name), "given": [p.first_name], "family": p.last_name }],
        "gender": p.gender,
        "birthDate": p.date_of_birth,
    }})
}

fn provider_entry(p: &ProviderParty, (id, urn): &(Uuid, String)) -> Value {
    let identifier: Vec<Value> = p
        .hfr_facility_id
        .iter()
        .map(|hfr| json!({ "system": HFR_SYSTEM, "value": hfr }))
        .collect();
    json!({ "fullUrl": urn, "resource": {
        "resourceType": "Organization", "id": id, "identifier": identifier, "name": p.name
    }})
}

fn coverage_entry(parties: &Parties<'_>, urns: &Urns) -> Value {
    let policy = parties.policy;
    let identifier: Vec<Value> = policy
        .policy_number
        .iter()
        .map(|n| json!({ "system": POLICY_SYSTEM, "value": n }))
        .collect();
    let class: Vec<Value> = policy
        .plan_name
        .iter()
        .map(|plan| json!({ "type": { "coding": [{ "code": "plan" }] }, "value": plan, "name": plan }))
        .collect();
    json!({ "fullUrl": urns.coverage.1, "resource": {
        "resourceType": "Coverage",
        "id": urns.coverage.0,
        "identifier": identifier,
        "status": "active",
        "subscriberId": policy.member_id,
        "beneficiary": { "reference": urns.patient },
        "relationship": policy.policy_holder_relation.as_ref().map(|r| json!({ "text": r })),
        "period": { "start": policy.valid_from, "end": policy.valid_until },
        "payor": [{ "reference": urns.insurer.1 }],
        "class": class,
    }})
}

/// Patient, insurer, hospital, [doctor] and coverage — the entries every
/// bundle carries after its focal resource.
fn shared_entries(parties: &Parties<'_>, urns: &Urns) -> Vec<Value> {
    let mut entries = vec![
        patient_entry(parties.patient, &urns.patient),
        json!({ "fullUrl": urns.insurer.1, "resource": {
            "resourceType": "Organization",
            "id": urns.insurer.0,
            "identifier": [{ "value": parties.recipient }],
            "name": parties.policy.insurance_provider
        }}),
        provider_entry(parties.provider, &urns.provider),
    ];
    if let Some((name, hpr)) = parties.doctor {
        let identifier: Vec<Value> = hpr
            .iter()
            .map(|h| json!({ "system": HPR_SYSTEM, "value": h }))
            .collect();
        entries.push(json!({ "fullUrl": urns.practitioner.1, "resource": {
            "resourceType": "Practitioner", "id": urns.practitioner.0,
            "identifier": identifier, "name": [{ "text": name }]
        }}));
    }
    entries.push(coverage_entry(parties, urns));
    entries
}

fn bundle(id: Uuid, profile: &str, focal: Value, rest: Vec<Value>, now: &str) -> Value {
    let mut entry = vec![focal];
    entry.extend(rest);
    json!({
        "resourceType": "Bundle",
        "id": id,
        "meta": {
            "profile": [profile],
            "security": [{ "system": CONFIDENTIALITY_SYSTEM, "code": "V", "display": "very restricted" }]
        },
        "type": "collection",
        "timestamp": now,
        "entry": entry
    })
}

fn diagnosis(seq: usize, d: &DiagnosisLine) -> Value {
    let mut coding = Vec::new();
    if let Some(code) = d.icd_code.as_deref().filter(|c| !c.is_empty()) {
        let system = match d.icd_system.as_str() {
            "icd11" => ICD11_SYSTEM,
            "snomed" => SNOMED_SYSTEM,
            _ => ICD10_SYSTEM,
        };
        coding.push(json!({ "system": system, "code": code, "display": d.description }));
    }
    if let Some(code) = d.snomed_code.as_deref().filter(|c| !c.is_empty()) {
        coding.push(json!({ "system": SNOMED_SYSTEM, "code": code }));
    }
    let kind = if d.is_primary {
        "principal"
    } else {
        "clinical"
    };
    json!({
        "sequence": seq,
        "diagnosisCodeableConcept": { "coding": coding, "text": d.description },
        "type": [{ "coding": [{ "system": DIAGNOSIS_TYPE_SYSTEM, "code": kind }] }]
    })
}

/// A document as a FHIR Attachment — its title, type and date; the URL only
/// when the store holds it at one the payer can reach.
fn attachment(doc: &DocumentRef) -> Value {
    let url = doc
        .file_path
        .as_deref()
        .filter(|p| p.starts_with("https://"));
    json!({
        "contentType": doc.mime_type,
        "title": doc.file_name.as_deref().unwrap_or(&doc.document_type),
        "url": url,
        "creation": doc.created_at.to_rfc3339(),
    })
}

fn supporting_info(seq: usize, doc: &DocumentRef) -> Value {
    json!({
        "sequence": seq,
        "category": { "coding": [{ "system": CLAIM_INFO_CATEGORY_SYSTEM, "code": "attachment" }], "text": doc.document_type },
        "valueAttachment": attachment(doc),
    })
}

/// The NHCX `ClaimBundle`: a Claim (claim or pre-authorisation) with its
/// items, diagnoses and supporting documents, then the shared entries.
pub(crate) fn claim_bundle(parties: &Parties<'_>, c: &ClaimContent<'_>) -> Value {
    let urns = Urns::new(parties.patient.id);
    let now = Utc::now().to_rfc3339();
    let items: Vec<Value> = c
        .items
        .iter()
        .enumerate()
        .map(|(i, l)| {
            json!({
                "sequence": i + 1,
                "productOrService": { "coding": l.code.iter().map(|code| json!({ "code": code })).collect::<Vec<_>>(), "text": l.description },
                "unitPrice": money(l.unit_price),
                "net": money(l.net),
            })
        })
        .collect();
    let total: Decimal = c.items.iter().filter_map(|l| l.net).sum();
    let care_provider = if parties.doctor.is_some() {
        &urns.practitioner.1
    } else {
        &urns.provider.1
    };
    let priority = if c.urgent { "stat" } else { "normal" };
    let focal = json!({ "fullUrl": format!("urn:uuid:{}", c.id), "resource": {
        "resourceType": "Claim",
        "id": c.id,
        "status": "active",
        "type": { "coding": [{ "system": SNOMED_SYSTEM, "code": SNOMED_INSTITUTIONAL_CLAIM_CODE, "display": "Inpatient care management (procedure)" }] },
        "use": c.use_,
        "patient": { "reference": urns.patient },
        "created": now,
        "insurer": { "reference": urns.insurer.1 },
        "provider": { "reference": urns.provider.1 },
        "priority": { "coding": [{ "system": PROCESS_PRIORITY_SYSTEM, "code": priority }] },
        "careTeam": [{
            "sequence": 1,
            "provider": { "reference": care_provider },
            "role": { "coding": [{ "system": SNOMED_SYSTEM, "code": SNOMED_HEALTHCARE_PROFESSIONAL_CODE, "display": "Healthcare professional (occupation)" }] }
        }],
        "diagnosis": c.diagnoses.iter().enumerate().map(|(i, d)| diagnosis(i + 1, d)).collect::<Vec<_>>(),
        "supportingInfo": c.documents.iter().enumerate().map(|(i, d)| supporting_info(i + 1, d)).collect::<Vec<_>>(),
        "insurance": [{ "sequence": 1, "focal": true, "coverage": { "reference": urns.coverage.1 } }],
        "item": items,
        "total": money(Some(total)),
    }});
    bundle(
        c.id,
        CLAIM_BUNDLE_PROFILE,
        focal,
        shared_entries(parties, &urns),
        &now,
    )
}

/// The NHCX `CoverageEligibilityRequestBundle`, asking about the given
/// benefit categories (`(code, display)`).
pub(crate) fn eligibility_bundle(
    parties: &Parties<'_>,
    record_id: Uuid,
    categories: &[(&str, &str)],
) -> Value {
    let urns = Urns::new(parties.patient.id);
    let now = Utc::now().to_rfc3339();
    let request_id = Uuid::new_v4();
    let items: Vec<Value> = categories
        .iter()
        .map(|(code, display)| {
            json!({ "category": { "coding": [{ "system": BENEFIT_CATEGORY_SYSTEM, "code": code, "display": display }] } })
        })
        .collect();
    let focal = json!({ "fullUrl": format!("urn:uuid:{request_id}"), "resource": {
        "resourceType": "CoverageEligibilityRequest",
        "id": request_id,
        "status": "active",
        "purpose": ["benefits", "validation"],
        "patient": { "reference": urns.patient },
        "servicedDate": Utc::now().date_naive(),
        "created": now,
        "provider": { "reference": urns.provider.1 },
        "insurer": { "reference": urns.insurer.1 },
        "insurance": [{ "focal": true, "coverage": { "reference": urns.coverage.1 } }],
        "item": items,
    }});
    let rest = shared_entries(parties, &urns);
    bundle(
        record_id,
        COVERAGE_ELIGIBILITY_BUNDLE_PROFILE,
        focal,
        rest,
        &now,
    )
}

/// The hospital's answer to a payer query: a `Communication` with the text
/// and each document as an attachment. NRCeS lists no bundle profile for it,
/// so the resource itself is the payload.
pub(crate) fn communication(
    query_id: Uuid,
    about: Uuid,
    text: &str,
    documents: &[DocumentRef],
) -> Value {
    let mut payload = vec![json!({ "contentString": text })];
    payload.extend(
        documents
            .iter()
            .map(|d| json!({ "contentAttachment": attachment(d) })),
    );
    json!({
        "resourceType": "Communication",
        "id": Uuid::new_v4(),
        "meta": { "profile": [COMMUNICATION_PROFILE] },
        "identifier": [{ "system": "https://medbrains.health/nhcx-payer-query", "value": query_id }],
        "status": "completed",
        "about": [{ "reference": format!("Claim/{about}") }],
        "sent": Utc::now().to_rfc3339(),
        "payload": payload,
    })
}

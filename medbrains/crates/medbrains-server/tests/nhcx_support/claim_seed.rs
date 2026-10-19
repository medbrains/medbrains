//! A discharged stay with its final bill and a cashless claim on it — what
//! the NHCX final-claim and payment tests start from.

use axum::http::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use super::Nhcx;
use super::seed::post;

/// The rows a final claim is built from.
pub struct ClaimSeed {
    pub claim: Uuid,
    pub invoice: Uuid,
    pub admission: Uuid,
    pub claim_number: String,
}

/// A stay with a coded diagnosis, a final bill of two lines (room rent
/// 3 × 3,000 and OT 21,000), an approved pre-auth `AUTH-77`, and a claim of
/// 30,000 on the bill. The discharge summary is left to the test.
pub async fn seed_claim(n: &Nhcx, patient: Uuid, policy: Uuid) -> ClaimSeed {
    let db = &n.app.db;
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(db)
        .await
        .expect("admin");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(n.tenant)
    .bind(patient)
    .fetch_one(db)
    .await
    .expect("encounter");
    sqlx::query(
        "INSERT INTO diagnoses (tenant_id, encounter_id, icd_code, description, is_primary) \
         VALUES ($1, $2, 'K35.80', 'Acute appendicitis', true)",
    )
    .bind(n.tenant)
    .bind(encounter)
    .execute(db)
    .await
    .expect("diagnosis");
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
             admission_number) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(n.tenant)
    .bind(encounter)
    .bind(patient)
    .bind(admin)
    .bind(format!("IP-NHCX-{}", n.tag))
    .fetch_one(db)
    .await
    .expect("admission");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, admission_id, \
             status, subtotal, total_amount, discount_amount, issued_at) \
         VALUES ($1, $2, $3, $4, $5, 'issued', 30000, 30000, 500, now()) RETURNING id",
    )
    .bind(n.tenant)
    .bind(format!("INV-NHCX-{}", n.tag))
    .bind(patient)
    .bind(encounter)
    .bind(admission)
    .fetch_one(db)
    .await
    .expect("invoice");
    for (code, desc, qty, unit, total) in [
        ("RR-1", "Room rent", 3, 3000, 9000),
        ("OT-1", "OT charges", 1, 21000, 21000),
    ] {
        sqlx::query(
            "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, \
                 quantity, unit_price, total_price, source) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')",
        )
        .bind(n.tenant)
        .bind(invoice)
        .bind(code)
        .bind(desc)
        .bind(qty)
        .bind(rust_decimal::Decimal::from(unit))
        .bind(rust_decimal::Decimal::from(total))
        .execute(db)
        .await
        .expect("bill line");
    }
    let claim_number = format!("CLM-{}", n.tag);
    let claim: Uuid = sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, \
             policy_number, member_id, claim_number, admission_id, insurance_id, claim_amount, status) \
         VALUES ($1, $2, $3, 'Mock Payer', $4, 'MEM-1', $5, $6, $7, 30000, 'initiated') \
         RETURNING id",
    )
    .bind(n.tenant)
    .bind(invoice)
    .bind(patient)
    .bind(format!("POL-{}", n.tag))
    .bind(&claim_number)
    .bind(admission)
    .bind(policy)
    .fetch_one(db)
    .await
    .expect("claim");
    sqlx::query(
        "INSERT INTO prior_auth_requests (tenant_id, pa_number, patient_id, patient_insurance_id, \
             service_type, encounter_id, insurance_claim_id, status, auth_number, \
             approved_amount, responded_at) \
         VALUES ($1, $2, $3, $4, 'surgery', $5, $6, 'approved', 'AUTH-77', 30000, now())",
    )
    .bind(n.tenant)
    .bind(format!("PA-CLM-{}", n.tag))
    .bind(patient)
    .bind(policy)
    .bind(encounter)
    .bind(claim)
    .execute(db)
    .await
    .expect("approved pre-auth");
    ClaimSeed {
        claim,
        invoice,
        admission,
        claim_number,
    }
}

/// Finalise the stay's discharge summary.
pub async fn finalise_discharge_summary(n: &Nhcx, admission: Uuid) {
    sqlx::query(
        "INSERT INTO ipd_discharge_summaries (tenant_id, admission_id, status, final_diagnosis, \
             course_in_hospital, finalized_at) \
         VALUES ($1, $2, 'finalized', 'Acute appendicitis', 'Laparoscopic appendicectomy, \
             uneventful recovery.', now())",
    )
    .bind(n.tenant)
    .bind(admission)
    .execute(&n.app.db)
    .await
    .expect("discharge summary");
}

/// Submit the final claim; returns its correlation id.
pub async fn submit_final_claim(n: &Nhcx, claim: Uuid) -> String {
    let resp = post(
        n,
        &format!("/api/billing/insurance-claims/{claim}/submit-to-nhcx"),
        &json!({ "recipient_code": n.payer_code, "use": "claim" }),
    )
    .await;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let queued: Value = resp.json().await.expect("json");
    queued["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned()
}

/// An adjudication amount in the shape NRCeS uses.
pub fn amount(code: &str, value: u32) -> Value {
    json!({
        "category": { "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/adjudication", "code": code }] },
        "amount": { "value": value, "currency": "INR" }
    })
}

/// The payer's ClaimResponse: room rent cut from 9,000 to 6,000, OT paid in
/// full — 27,000 of 30,000.
pub fn adjudicated_claim() -> Value {
    let mut cut = amount("benefit", 6000);
    cut["reason"] = json!({ "coding": [{ "code": "roomcap",
        "display": "Room rent above the policy limit" }] });
    let mut covered = amount("benefit", 21000);
    covered["reason"] = json!({ "coding": [{ "code": "covered", "display": "Covered" }] });
    json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "ClaimResponse", "use": "claim", "outcome": "complete",
        "disposition": "Room rent capped at the policy limit.",
        "item": [
            { "itemSequence": 1, "adjudication": [amount("submitted", 9000), cut] },
            { "itemSequence": 2, "adjudication": [amount("submitted", 21000), covered] }
        ],
        "total": [amount("submitted", 30000), amount("benefit", 27000)]
    }}]})
}

/// A payer's payment notice: one transfer (`utr`) paying each
/// `(claim reference, approved, tds)`.
pub fn payment_notice(utr: &str, lines: &[(&str, u32, u32)]) -> Value {
    let detail = |claim: &str, code: &str, value: u32| {
        json!({
            "identifier": { "value": claim },
            "type": { "coding": [{
                "system": "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-payment-type",
                "code": code }] },
            "amount": { "value": value, "currency": "INR" }
        })
    };
    let details: Vec<Value> = lines
        .iter()
        .flat_map(|(claim, gross, tds)| {
            [
                detail(claim, "approvedAmount", *gross),
                detail(claim, "tds", *tds),
            ]
        })
        .collect();
    let paid: u32 = lines.iter().map(|(_, g, t)| g - t).sum();
    json!({ "resourceType": "Bundle", "entry": [
        { "resource": { "resourceType": "Task", "status": "requested", "intent": "order",
            "code": { "coding": [{ "code": "deliver" }] } } },
        { "resource": { "resourceType": "PaymentNotice", "status": "active",
            "identifier": [{ "value": format!("PN-{utr}") }],
            "paymentDate": "2026-10-15", "amount": { "value": paid, "currency": "INR" } } },
        { "resource": { "resourceType": "PaymentReconciliation", "status": "active",
            "paymentDate": "2026-10-15",
            "paymentAmount": { "value": paid, "currency": "INR" },
            "paymentIdentifier": { "value": utr },
            "detail": details } }
    ]})
}

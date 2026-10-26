//! Insurer settlements reach the bill only through a pending posting that a
//! second person approves (migration 1227).
//!
//! Recording leaves the bill alone; approving posts an `insurance` payment
//! and the hospital's write-off, leaving the patient's share owing; the
//! recorder cannot decide it; the same settlement is filed once; more than
//! the bill has open is flagged and needs an explicit accept; a rejection
//! changes nothing; and a reversal puts the bill back. The backfill and the
//! 403s are in `claim_settlement_backfill_test`.

use crate::common::{self, Staff, TestApp};

use reqwest::{Client, StatusCode};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

pub(crate) fn dec(s: &str) -> Decimal {
    s.parse().expect("decimal")
}

pub(crate) struct Seeded {
    tenant: Uuid,
    patient: Uuid,
    pub(crate) invoice: Uuid,
    pub(crate) claim: Uuid,
}

/// Billing works a patient's account on a direct grant to that patient.
pub(crate) async fn grant(app: &TestApp, s: &Seeded, staff: &Staff) {
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'viewer', 'user', $3::text, $3)",
    )
    .bind(s.tenant)
    .bind(s.patient)
    .bind(staff.user_id)
    .execute(&app.db)
    .await
    .expect("viewer tuple");
}

/// A bill of `total` the patient paid `paid` of in cash, with a claim the
/// insurer approved for `approved`.
pub(crate) async fn seed(app: &TestApp, total: i64, paid: i64, approved: i64) -> Seeded {
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Settle', 'Patient', 'male'::gender, '9000001223') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-CS-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, subtotal, \
             total_amount, paid_amount) \
         VALUES ($1, $2, $3, 'issued', $4, $4, $5) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-CS-{tag}"))
    .bind(patient)
    .bind(Decimal::from(total))
    .bind(Decimal::from(paid))
    .fetch_one(&app.db)
    .await
    .expect("invoice");
    if paid > 0 {
        sqlx::query(
            "INSERT INTO payments (tenant_id, invoice_id, amount, mode) VALUES ($1, $2, $3, 'cash')",
        )
        .bind(tenant)
        .bind(invoice)
        .bind(Decimal::from(paid))
        .execute(&app.db)
        .await
        .expect("cash payment");
    }
    let claim: Uuid = sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, \
             tpa_name, claim_number, status, claim_amount, approved_amount) \
         VALUES ($1, $2, $3, 'Star Health', 'Medi Assist', $4, 'claim_approved', $5, $6) \
         RETURNING id",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(patient)
    .bind(format!("CLM-{tag}"))
    .bind(Decimal::from(total - paid))
    .bind(Decimal::from(approved))
    .fetch_one(&app.db)
    .await
    .expect("claim");
    Seeded {
        tenant,
        patient,
        invoice,
        claim,
    }
}

pub(crate) async fn call(
    client: &Client,
    csrf: &str,
    app: &TestApp,
    path: &str,
    body: &Value,
) -> (StatusCode, Value) {
    let res = client
        .request(
            if path.ends_with("/approve") || path.ends_with("/reject") || path.ends_with("/reverse")
            {
                reqwest::Method::PUT
            } else {
                reqwest::Method::POST
            },
            app.url(path),
        )
        .header("x-csrf-token", csrf)
        .json(body)
        .send()
        .await
        .expect("request");
    let status = res.status();
    (status, res.json().await.unwrap_or(Value::Null))
}

pub(crate) async fn bill(app: &TestApp, invoice: Uuid) -> (Decimal, Decimal, String) {
    sqlx::query_as(
        "SELECT paid_amount, written_off_amount, status::text FROM invoices WHERE id = $1",
    )
    .bind(invoice)
    .fetch_one(&app.db)
    .await
    .expect("bill")
}

pub(crate) fn settlement(claim: Uuid, amount: i64, utr: &str, deductions: &Value) -> Value {
    json!({
        "insurance_claim_id": claim, "settled_amount": amount, "tds_amount": amount / 10,
        "payment_reference": utr, "settlement_date": "2026-10-20", "deductions": deductions,
    })
}

#[tokio::test]
async fn finance_approves_a_recorded_settlement_onto_the_bill_and_can_reverse_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk: Staff = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;
    let s = seed(&app, 10000, 1000, 8000).await;
    grant(&app, &s, &clerk).await;
    let utr = format!("UTR{}", &Uuid::new_v4().simple().to_string()[..10]);
    let deductions = json!([
        { "reason": "Room rent above the cap", "amount": 600, "treatment": "patient" },
        { "reason": "Tariff disallowance", "amount": 400, "treatment": "write_off" },
    ]);
    let body = settlement(s.claim, 8000, &utr, &deductions);

    let (status, posting) = call(
        &clerk.client,
        &clerk.csrf,
        &app,
        "/api/billing/claim-settlements",
        &body,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{posting}");
    assert_eq!(posting["status"], "pending");
    assert_eq!(posting["deduction_total"], "1000.00");
    assert_eq!(
        bill(&app, s.invoice).await,
        (dec("1000"), dec("0"), "issued".into()),
        "recording posts nothing"
    );
    let id = posting["id"].as_str().expect("id").to_owned();

    let (again, _) = call(
        &clerk.client,
        &clerk.csrf,
        &app,
        "/api/billing/claim-settlements",
        &body,
    )
    .await;
    assert_eq!(
        again,
        StatusCode::CONFLICT,
        "the same settlement is filed once"
    );

    let approve = format!("/api/billing/claim-settlements/{id}/approve");
    let (status, _) = call(&clerk.client, &clerk.csrf, &app, &approve, &json!({})).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a billing clerk records; finance approves"
    );

    let (status, done) = call(&app.client, &csrf, &app, &approve, &json!({})).await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["status"], "approved");
    assert_eq!(done["posted_amount"], "8000.00");
    // 1000 cash + 8000 insurer + 400 written off: the patient still owes 600.
    assert_eq!(
        bill(&app, s.invoice).await,
        (dec("9400"), dec("400"), "partially_paid".into())
    );
    let (mode, amount, reference): (String, Decimal, Option<String>) = sqlx::query_as(
        "SELECT mode::text, amount, reference_number FROM payments \
          WHERE invoice_id = $1 AND mode = 'insurance' AND deleted_at IS NULL",
    )
    .bind(s.invoice)
    .fetch_one(&app.db)
    .await
    .expect("insurance payment");
    assert_eq!(
        (mode.as_str(), amount, reference),
        ("insurance", dec("8000"), Some(utr.clone()))
    );
    let (settled, claim_status, patient_payable): (Option<Decimal>, String, Decimal) =
        sqlx::query_as(
            "SELECT settled_amount, status, patient_payable FROM insurance_claims WHERE id = $1",
        )
        .bind(s.claim)
        .fetch_one(&app.db)
        .await
        .expect("claim");
    assert_eq!(
        (settled, claim_status.as_str()),
        (Some(dec("8000")), "settled")
    );
    assert_eq!(
        patient_payable,
        dec("600"),
        "the insurer's payment is not taken off the patient twice"
    );

    let (twice, _) = call(&app.client, &csrf, &app, &approve, &json!({})).await;
    assert_eq!(twice, StatusCode::CONFLICT, "a posting is approved once");

    let reverse = format!("/api/billing/claim-settlements/{id}/reverse");
    let (status, _) = call(&app.client, &csrf, &app, &reverse, &json!({ "reason": "" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a reversal needs a reason");
    let (status, undone) = call(
        &app.client,
        &csrf,
        &app,
        &reverse,
        &json!({ "reason": "Posted to the wrong claim" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{undone}");
    assert_eq!(undone["status"], "reversed");
    assert_eq!(
        bill(&app, s.invoice).await,
        (dec("1000"), dec("0"), "partially_paid".into())
    );
    let (settled, claim_status): (Option<Decimal>, String) =
        sqlx::query_as("SELECT settled_amount, status FROM insurance_claims WHERE id = $1")
            .bind(s.claim)
            .fetch_one(&app.db)
            .await
            .expect("claim");
    assert_eq!(
        (settled, claim_status.as_str()),
        (Some(dec("0")), "claim_approved")
    );
    let (refile, _) = call(
        &clerk.client,
        &clerk.csrf,
        &app,
        "/api/billing/claim-settlements",
        &body,
    )
    .await;
    assert_eq!(
        refile,
        StatusCode::OK,
        "a reversed settlement can be filed again, corrected"
    );
}

#[tokio::test]
async fn the_recorder_cannot_decide_a_rejection_changes_nothing_and_excess_needs_accepting() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let clerk = common::provision_staff(&app, &csrf, "billing_clerk", &[]).await;

    // Maker-checker binds even an administrator.
    let own = seed(&app, 5000, 0, 5000).await;
    let (_, mine) = call(
        &app.client,
        &csrf,
        &app,
        "/api/billing/claim-settlements",
        &settlement(own.claim, 4000, "UTR-OWN", &json!([])),
    )
    .await;
    let id = mine["id"].as_str().expect("id");
    let (status, why) = call(
        &app.client,
        &csrf,
        &app,
        &format!("/api/billing/claim-settlements/{id}/approve"),
        &json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{why}");

    // Rejected: the bill is exactly as it was.
    let r = seed(&app, 3000, 500, 2500).await;
    grant(&app, &r, &clerk).await;
    let (_, p) = call(
        &clerk.client,
        &clerk.csrf,
        &app,
        "/api/billing/claim-settlements",
        &settlement(r.claim, 2500, "UTR-REJ", &json!([])),
    )
    .await;
    let reject = format!(
        "/api/billing/claim-settlements/{}/reject",
        p["id"].as_str().expect("id")
    );
    let (status, _) = call(&app.client, &csrf, &app, &reject, &json!({ "reason": "x" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, rejected) = call(
        &app.client,
        &csrf,
        &app,
        &reject,
        &json!({ "reason": "UTR does not match the bank statement" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(rejected["status"], "rejected");
    assert_eq!(
        bill(&app, r.invoice).await,
        (dec("500"), dec("0"), "issued".into())
    );

    // More than the bill has open: flagged, refused until accepted, capped.
    let o = seed(&app, 5000, 0, 6000).await;
    grant(&app, &o, &clerk).await;
    let (_, over) = call(
        &clerk.client,
        &clerk.csrf,
        &app,
        "/api/billing/claim-settlements",
        &settlement(o.claim, 6000, "UTR-OVER", &json!([])),
    )
    .await;
    assert_eq!(over["needs_review"], true, "{over}");
    let approve = format!(
        "/api/billing/claim-settlements/{}/approve",
        over["id"].as_str().expect("id")
    );
    let (status, _) = call(&app.client, &csrf, &app, &approve, &json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT);
    let (status, done) = call(
        &app.client,
        &csrf,
        &app,
        &approve,
        &json!({ "accept_excess": true }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(
        (done["posted_amount"].clone(), done["excess_amount"].clone()),
        (json!("5000.00"), json!("1000.00"))
    );
    assert_eq!(
        bill(&app, o.invoice).await,
        (dec("5000"), dec("0"), "paid".into())
    );
}

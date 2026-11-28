//! A hospital that runs OPD without the Billing brick gets no bills from it.
//!
//! Registration + OPD hospitals saw a draft "OPD Consultation" invoice open on
//! every completed visit, for a desk they do not have. With Billing off, a
//! completed consultation opens no invoice and queues no charge; with Billing
//! on, it is charged as before. Switching Billing back on does not back-fill.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Sends `req` with the CSRF header; returns its status and JSON body.
async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Switches a brick through the Modules screen's endpoint.
async fn switch(app: &common::TestApp, csrf: &str, code: &str, status: &str) -> StatusCode {
    send(
        csrf,
        app.client
            .put(app.url(&format!("/api/setup/modules/{code}")))
            .json(&json!({ "status": status })),
    )
    .await
    .0
}

/// Opens a visit for a new patient, starts and completes its consultation;
/// returns the encounter.
async fn completed_visit(app: &common::TestApp, csrf: &str) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Brick', 'Bill', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-BB-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let encounter: Uuid = visit["encounter"]["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("encounter");
    let queue: Uuid = sqlx::query_scalar(
        "SELECT id FROM opd_queues WHERE encounter_id = $1 AND kind = 'primary' \
           AND deleted_at IS NULL",
    )
    .bind(encounter)
    .fetch_one(&app.db)
    .await
    .expect("queue row");
    for step in ["start", "complete"] {
        let (status, body) = send(
            csrf,
            app.client
                .put(app.url(&format!("/api/opd/queue/{queue}/{step}")))
                .json(&json!({})),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{step}: {body}");
    }
    encounter
}

/// The visit's invoices and its queued charges.
async fn bills(app: &common::TestApp, encounter: Uuid) -> (i64, i64) {
    sqlx::query_as(
        "SELECT (SELECT count(*) FROM invoices WHERE encounter_id = $1), \
                (SELECT count(*) FROM charge_attention_items WHERE encounter_id = $1)",
    )
    .bind(encounter)
    .fetch_one(&app.db)
    .await
    .expect("bills")
}

/// Given Billing switched off, When a consultation completes, Then no invoice
/// opens and no charge is queued; Given Billing on, Then the visit is billed;
/// switching Billing back on leaves the earlier visit unbilled.
#[tokio::test]
async fn opd_bills_a_visit_only_while_billing_is_on() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    assert_eq!(
        switch(&app, &csrf, "billing", "disabled").await,
        StatusCode::OK
    );
    let unbilled = completed_visit(&app, &csrf).await;
    let off = bills(&app, unbilled).await;
    // Put it back before asserting, so a failure cannot leave other tests without billing.
    assert_eq!(
        switch(&app, &csrf, "billing", "enabled").await,
        StatusCode::OK
    );

    let billed = completed_visit(&app, &csrf).await;
    let on = bills(&app, billed).await;

    assert_eq!(off, (0, 0), "billing off: no invoice, no queued charge");
    assert_eq!(on.0, 1, "billing on: the consultation's invoice, as before");
    assert_eq!(
        bills(&app, unbilled).await,
        (0, 0),
        "no back-fill after switching on"
    );
}

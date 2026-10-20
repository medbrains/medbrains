//! Notices reach a person (#205): each event queues one outbox row per
//! channel, addressed — a row without `to` dead-letters — and a redelivered
//! event texts nobody twice. `spawn_app` never starts the outbox worker, so
//! each test proves the emit half with a SELECT and the consume half by
//! dispatching the stored envelope directly, twice.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

const PHONE: &str = "9000000205";
const E164: &str = "+919000000205";

async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

async fn patient(app: &common::TestApp, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Notice', 'Patient', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-N-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .bind(PHONE)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

async fn invoice(app: &common::TestApp, tenant: Uuid, patient: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, status, subtotal, total_amount) \
         VALUES ($1, $2, $3, 'issued', 500.00, 500.00) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("INV-N-{}", &Uuid::new_v4().simple().to_string()[..10]))
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("invoice")
}

/// Dispatch twice, as a redelivery would, and return what was queued.
async fn deliver_twice(
    app: &common::TestApp,
    tenant: Uuid,
    event: &str,
    payload: &Value,
    queued: &str,
    needle: &str,
) -> Vec<Value> {
    app.dispatch(tenant, event, payload).await;
    app.dispatch(tenant, event, payload).await;
    app.outbox_rows(queued, needle).await
}

/// Rows queued for a record; report messages carry no ids in their payload.
async fn queued_for(app: &common::TestApp, event: &str, record: Uuid) -> Vec<Value> {
    sqlx::query_scalar(
        "SELECT payload FROM outbox_events WHERE event_type = $1 AND aggregate_id = $2",
    )
    .bind(event)
    .bind(record)
    .fetch_all(&app.db)
    .await
    .expect("outbox rows")
}

#[tokio::test]
async fn an_approved_claim_texts_the_patient_once() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let invoice = invoice(&app, tenant, patient).await;
    let claim: Value = app
        .client
        .post(app.url("/api/billing/insurance-claims"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "invoice_id": invoice, "patient_id": patient,
            "insurance_provider": "Star Health", "claim_type": "cashless",
        }))
        .send()
        .await
        .expect("claim")
        .json()
        .await
        .expect("claim json");
    let id = claim["id"].as_str().expect("claim id").to_owned();

    for _ in 0..2 {
        let resp = app
            .client
            .put(app.url(&format!("/api/billing/insurance-claims/{id}")))
            .header("x-csrf-token", &csrf)
            .json(&json!({ "status": "claim_approved", "approved_amount": 400 }))
            .send()
            .await
            .expect("approve");
        assert_eq!(resp.status(), StatusCode::OK);
    }
    let emitted = app.outbox_rows("billing.claim.approved", &id).await;
    assert_eq!(emitted.len(), 1, "approving twice is one approval");

    let sent = deliver_twice(
        &app,
        tenant,
        "billing.claim.approved",
        &emitted[0],
        "sms.claim_approved",
        &id,
    )
    .await;
    assert_eq!(sent.len(), 1, "a redelivered approval texts nobody twice");
    assert_eq!(sent[0]["to"], json!(E164));
    assert!(
        sent[0]["body"]
            .as_str()
            .unwrap_or_default()
            .contains("Star Health")
    );
}

#[tokio::test]
async fn a_verified_report_reaches_the_patient_only_when_the_hospital_dispatches_automatically() {
    let app = common::spawn_app().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let before: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'lab' \
           AND key = 'report_delivery_config'",
    )
    .bind(tenant)
    .fetch_optional(&app.db)
    .await
    .expect("config");
    let set = |value: Value| {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, 'lab', 'report_delivery_config', $2) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = $2, deleted_at = NULL",
        )
        .bind(tenant)
        .bind(value)
        .execute(&app.db)
    };
    let config = |auto: bool| {
        json!({ "sms_enabled": true, "whatsapp_enabled": false, "email_enabled": false,
                "auto_dispatch": auto, "default_method": "sms" })
    };

    set(config(false)).await.expect("manual");
    let held = Uuid::new_v4();
    let payload = json!({ "order_id": held, "patient_id": patient });
    app.dispatch(tenant, "lab.result.verified", &payload).await;
    assert!(
        queued_for(&app, "sms.lab_report_ready", held)
            .await
            .is_empty(),
        "manual delivery sends nothing"
    );

    set(config(true)).await.expect("auto");
    let order = Uuid::new_v4();
    let payload = json!({ "order_id": order, "patient_id": patient });
    app.dispatch(tenant, "lab.result.verified", &payload).await;
    app.dispatch(tenant, "lab.result.verified", &payload).await;
    let sent = queued_for(&app, "sms.lab_report_ready", order).await;
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0]["to"], json!(E164));
    assert!(
        !sent[0]["body"]
            .as_str()
            .unwrap_or_default()
            .contains("result:")
    );

    match before {
        Some(value) => set(value).await.expect("restore"),
        None => sqlx::query(
            "DELETE FROM tenant_settings WHERE tenant_id = $1 AND category = 'lab' \
               AND key = 'report_delivery_config'",
        )
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("restore"),
    };
}

#[tokio::test]
async fn a_prescription_with_refills_left_warns_the_patient_before_it_expires() {
    let app = common::spawn_app().await;
    let tenant = tenant(&app).await;
    let patient = patient(&app, tenant).await;
    let doctor: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("doctor");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    let rx: Uuid = sqlx::query_scalar(
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id, repeats_allowed, \
                                    repeat_interval_days, valid_until) \
         VALUES ($1, $2, $3, $4, 2, 30, current_date + 2) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(doctor)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("prescription");

    medbrains_server::services::prescription_expiry::scan_once(&app.db)
        .await
        .expect("scan");
    medbrains_server::services::prescription_expiry::scan_once(&app.db)
        .await
        .expect("rescan");
    let emitted = app
        .outbox_rows("opd.prescription.expiring", &rx.to_string())
        .await;
    assert_eq!(
        emitted.len(),
        1,
        "one notice per prescription, however often the scan runs"
    );

    let sent = deliver_twice(
        &app,
        tenant,
        "opd.prescription.expiring",
        &emitted[0],
        "sms.prescription_expiring",
        &rx.to_string(),
    )
    .await;
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0]["to"], json!(E164));
}

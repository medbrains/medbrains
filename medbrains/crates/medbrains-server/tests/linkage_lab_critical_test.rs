//! Lab → doctor — the table-only half of the critical-value linkage.
//!
//! Posting a critical result writes the alert row, the doctor's in-app
//! notification, and a `lab.result.posted` event on the clinical outbox. The
//! pipeline that consumes it queues one SMS to the ordering doctor's phone
//! — a phone the SMS handler will accept, delivered once however many times
//! the event arrives, and not at all when the doctor has no phone.

mod common;

use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> Value {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{path} → {status}: {text}");
    serde_json::from_str(&text).expect("json body")
}

async fn put(app: &common::TestApp, csrf: &str, path: &str, body: Value) {
    let resp = app
        .client
        .put(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    assert!(resp.status().is_success(), "{path} → {}", resp.status());
}

#[tokio::test]
async fn critical_result_pages_the_ordering_doctor_once_and_only_with_a_dialable_phone() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let patient = post(
        &app,
        &csrf,
        "/api/patients",
        json!({ "first_name": "Linkage", "last_name": "Critical", "gender": "male", "phone": "9990000076" }),
    )
    .await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let uhid = patient["uhid"].as_str().expect("uhid").to_owned();
    let tenant_id: Uuid = patient["tenant_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("tenant");

    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("depts");
    let department_id = depts[0]["id"].as_str().expect("department").to_owned();
    let encounter = post(
        &app,
        &csrf,
        "/api/opd/encounters",
        json!({ "patient_id": patient_id, "department_id": department_id, "encounter_type": "opd" }),
    )
    .await;
    let encounter_id = encounter["encounter"]["id"]
        .as_str()
        .or_else(|| encounter["id"].as_str())
        .expect("encounter id")
        .to_owned();

    let tests: Value = app
        .get(&app.client, "/api/lab/catalog")
        .await
        .json()
        .await
        .expect("catalog");
    let test_id = tests[0]["id"].as_str().expect("a lab test").to_owned();
    let order = post(
        &app,
        &csrf,
        "/api/lab/orders",
        json!({ "patient_id": patient_id, "encounter_id": encounter_id, "test_id": test_id }),
    )
    .await;
    let order_id = order["id"].as_str().expect("order id").to_owned();
    let ordered_by: Uuid = order["ordered_by"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("orderer");

    put(
        &app,
        &csrf,
        &format!("/api/lab/orders/{order_id}/collect"),
        json!({ "patient_identifier": uhid }),
    )
    .await;
    put(
        &app,
        &csrf,
        &format!("/api/lab/orders/{order_id}/process"),
        json!({}),
    )
    .await;
    post(
        &app,
        &csrf,
        &format!("/api/lab/orders/{order_id}/results"),
        json!({ "results": [{ "parameter_name": "Linkage analyte", "value": "2.1", "flag": "critical_low" }] }),
    )
    .await;

    // The alert row and the doctor's notification point at the order.
    let alerts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM lab_critical_alerts WHERE order_id = $1 AND acknowledged_at IS NULL",
    )
    .bind(order_id.parse::<Uuid>().expect("order uuid"))
    .fetch_one(&app.db)
    .await
    .expect("alerts");
    assert_eq!(alerts, 1);
    let notified: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notifications WHERE entity_id = $1 AND title = 'Critical lab value'",
    )
    .bind(order_id.parse::<Uuid>().expect("order uuid"))
    .fetch_one(&app.db)
    .await
    .expect("notifications");
    assert_eq!(notified, 1);

    let posted = app.outbox_rows("lab.result.posted", &order_id).await;
    assert_eq!(posted.len(), 1, "one clinical event per result posting");
    let payload = posted[0]["payload"].clone();
    assert_eq!(payload["critical_count"], json!(1));

    // The orderer is the shared admin; put the phone back afterwards.
    let original_phone: Option<String> =
        sqlx::query_scalar("SELECT phone FROM users WHERE id = $1")
            .bind(ordered_by)
            .fetch_one(&app.db)
            .await
            .expect("phone");

    // No phone on the orderer → no SMS row, and no dead letter either.
    sqlx::query("UPDATE users SET phone = NULL WHERE id = $1")
        .bind(ordered_by)
        .execute(&app.db)
        .await
        .expect("clear phone");
    app.dispatch(tenant_id, "lab.result.posted", &payload).await;
    assert!(
        app.outbox_rows("sms.cds_critical_interaction", &order_id)
            .await
            .is_empty()
    );

    // A bare ten-digit phone is dialled as an Indian mobile; delivered twice, queued once.
    sqlx::query("UPDATE users SET phone = '9876543210' WHERE id = $1")
        .bind(ordered_by)
        .execute(&app.db)
        .await
        .expect("set phone");
    app.dispatch(tenant_id, "lab.result.posted", &payload).await;
    app.dispatch(tenant_id, "lab.result.posted", &payload).await;
    let sms = app
        .outbox_rows("sms.cds_critical_interaction", &order_id)
        .await;
    assert_eq!(sms.len(), 1);
    assert_eq!(sms[0]["to"], json!("+919876543210"));
    assert!(
        sms[0]["body"]
            .as_str()
            .is_some_and(|b| b.contains("Critical"))
    );

    sqlx::query("UPDATE users SET phone = $2 WHERE id = $1")
        .bind(ordered_by)
        .bind(original_phone)
        .execute(&app.db)
        .await
        .expect("restore phone");
}

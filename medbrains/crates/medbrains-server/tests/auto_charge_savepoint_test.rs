//! A best-effort auto-charge never takes the module's own write down with it.
//!
//! Diet orders were charged against `admission_id.unwrap_or(order id)` as the
//! encounter. The invoice insert failed its foreign key, the handler discarded
//! the error, and the aborted transaction committed as a silent ROLLBACK: the
//! request answered 200 and no diet order existed.

use crate::common;

use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_diet_order_answered_200_is_a_diet_order_that_exists() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let resp = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "first_name": "Diet", "last_name": "Persist", "gender": "male", "date_of_birth": "1970-05-05", "phone": "9990000314" }))
        .send()
        .await
        .expect("patient");
    let patient: Value = resp.json().await.expect("patient json");

    let resp = app
        .client
        .post(app.url("/api/diet/orders"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient["id"], "diet_type": "regular" }))
        .send()
        .await
        .expect("diet order");
    let status = resp.status();
    let order: Value = resp.json().await.expect("diet json");
    assert!(status.is_success(), "{status}: {order}");
    let order_id: Uuid = order["id"].as_str().and_then(|s| s.parse().ok()).expect("order id");

    let saved: i64 = sqlx::query_scalar("SELECT count(*) FROM diet_orders WHERE id = $1")
        .bind(order_id)
        .fetch_one(&app.db)
        .await
        .expect("count");
    assert_eq!(saved, 1, "the order the client was told about was committed");

    // And it was billed, to the patient rather than to a made-up encounter.
    let billed: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT i.encounter_id FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id \
          WHERE ii.source = 'diet'::charge_source AND ii.source_id = $1",
    )
    .bind(order_id)
    .fetch_optional(&app.db)
    .await
    .expect("charge");
    assert_eq!(billed, Some(None), "one patient-level charge");
}

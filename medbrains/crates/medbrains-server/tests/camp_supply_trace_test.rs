//! A packed camp medicine takes its batch and expiry after it was added.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: reqwest::Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_uppercase()
}

/// Given a camp whose packed medicine lacks batch and expiry, When the batch
/// and expiry are recorded on the row, Then it is saved; And an expired batch
/// is refused.
#[tokio::test]
async fn a_packed_camp_medicine_takes_its_batch_and_expiry() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let camp: Uuid = sqlx::query_scalar(
        "INSERT INTO camps (tenant_id, camp_code, name, camp_type, scheduled_date) \
         SELECT u.tenant_id, $1, 'Supply Camp', 'general_health'::camp_type, CURRENT_DATE + 7 \
           FROM users u WHERE u.username = 'admin' RETURNING id",
    )
    .bind(format!("SC{}", tag()))
    .fetch_one(&app.db)
    .await
    .expect("camp");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO camp_supply_items (tenant_id, camp_id, category, item_name, planned_qty, packed_qty) \
         SELECT tenant_id, id, 'medicine', 'Paracetamol 500 mg', 100, 100 FROM camps WHERE id = $1 \
         RETURNING id",
    )
    .bind(camp)
    .fetch_one(&app.db)
    .await
    .expect("supply");
    let path = format!("/api/camp/supplies/{item}");

    let (status, body) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &path,
        json!({ "batch_no": "PCM-2201", "expiry_date": "2020-01-31" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "an expired batch: {body}");

    let (status, row) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &path,
        json!({ "batch_no": " PCM-2201 ", "expiry_date": "2099-01-31" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{row}");
    assert_eq!(row["batch_no"], "PCM-2201");
    assert_eq!(row["expiry_date"], "2099-01-31");
}

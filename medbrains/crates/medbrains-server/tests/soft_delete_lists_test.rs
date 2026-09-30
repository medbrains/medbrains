//! A deleted row leaves the list.
//!
//! `DELETE` is turned into a soft delete by the database; a list that does not
//! filter `deleted_at` keeps showing it. These walk create → delete → list
//! through the API, the way the screens do.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn ids(list: &Value) -> Vec<String> {
    list.as_array()
        .into_iter()
        .flatten()
        .filter_map(|row| row["id"].as_str().map(str::to_owned))
        .collect()
}

async fn patient(app: &common::TestApp) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Soft', 'Delete', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-SD-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// Given an allergy recorded in error, When the clinician removes it, Then it
/// is gone from the patient's allergy list — a wrong allergy that stays on
/// the chart withholds a drug the patient can take.
#[tokio::test]
async fn a_removed_allergy_leaves_the_chart() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let base = format!("/api/patients/{}/allergies", patient(&app).await);

    let (status, allergy) = send(
        &csrf,
        app.client.post(app.url(&base)).json(&json!({
            "allergy_type": "drug",
            "allergen_name": "Penicillin (entered in error)",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{allergy}");
    let id = allergy["allergy"]["id"].as_str().expect("id").to_owned();

    let (status, _) = send(&csrf, app.client.delete(app.url(&format!("{base}/{id}")))).await;
    assert!(status.is_success(), "delete: {status}");

    let (_, list) = send(&csrf, app.client.get(app.url(&base))).await;
    assert!(
        !ids(&list).contains(&id),
        "the removed allergy is still listed"
    );
}

/// Given a payment method a hospital retires, When the admin deletes it, Then
/// the cashier's list no longer offers it.
#[tokio::test]
async fn a_deleted_payment_method_is_no_longer_offered() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let code = format!(
        "SD{}",
        &Uuid::new_v4().simple().to_string()[..6].to_uppercase()
    );

    let (status, method) = send(
        &csrf,
        app.client
            .post(app.url("/api/setup/payment-methods"))
            .json(&json!({ "code": code, "name": "Retired wallet" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{method}");
    let id = method["id"].as_str().expect("id").to_owned();

    let (status, _) = send(
        &csrf,
        app.client
            .delete(app.url(&format!("/api/setup/payment-methods/{id}"))),
    )
    .await;
    assert!(status.is_success(), "delete: {status}");

    let (_, list) = send(&csrf, app.client.get(app.url("/api/setup/payment-methods"))).await;
    assert!(
        !ids(&list).contains(&id),
        "the deleted payment method is still offered"
    );
}

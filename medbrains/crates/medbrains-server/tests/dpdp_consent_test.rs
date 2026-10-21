//! DPDP Act 2023 at the registration desk: the notice shown in the patient's
//! language and the purposes they agree to are recorded with the patient;
//! withdrawing is a new decision, never an edit, and the history stays. A
//! consent to an old notice, or to a purpose the notice does not name, is
//! refused.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};

async fn call(app: &common::TestApp, csrf: &str, method: Method, path: &str, body: Value) -> (StatusCode, Value) {
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

fn registration(phone: &str, privacy: Value) -> Value {
    json!({
        "first_name": "Meena", "last_name": "Raman", "gender": "female",
        "phone": phone, "date_of_birth": "1990-03-12", "privacy": privacy,
    })
}

#[tokio::test]
async fn the_desk_records_the_notice_and_the_patient_can_withdraw() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let phone = format!("97{}", &uuid::Uuid::new_v4().as_u128().to_string()[..8]);

    // A consent to a notice the patient was not shown is refused.
    let stale = json!({ "notice_version": "2020-01", "notice_language": "ta", "purposes": ["research"] });
    let (s, _) = call(&app, &csrf, Method::POST, "/api/patients", registration(&phone, stale)).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let notice = json!({ "notice_version": "2026-10", "notice_language": "ta",
        "purposes": ["abdm_linking", "health_reminders"] });
    let (s, patient) = call(&app, &csrf, Method::POST, "/api/patients", registration(&phone, notice)).await;
    assert!(s.is_success(), "{patient}");
    let id = patient["id"].as_str().unwrap_or_default().to_owned();
    let path = format!("/api/patients/{id}/dpdp-consent");

    let (_, consent) = call(&app, &csrf, Method::GET, &path, Value::Null).await;
    assert_eq!(consent["history"][0]["purposes"], json!(["abdm_linking", "health_reminders"]));
    assert_eq!(consent["history"][0]["notice_language"], "ta");
    assert_eq!(consent["history"][0]["source"], "registration");

    // Only purposes the notice names.
    let (s, _) = call(&app, &csrf, Method::PUT, &path,
        json!({ "notice_version": "2026-10", "notice_language": "en", "purposes": ["marketing"] })).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // Withdrawing reminders is a new decision; the first one stays on record.
    let (s, after) = call(&app, &csrf, Method::PUT, &path,
        json!({ "notice_version": "2026-10", "notice_language": "en", "purposes": ["abdm_linking"] })).await;
    assert!(s.is_success(), "{after}");
    assert_eq!(after["history"][0]["purposes"], json!(["abdm_linking"]));
    assert_eq!(after["history"][0]["source"], "patient_update");
    assert_eq!(after["history"].as_array().map(Vec::len), Some(2));
}

//! The DPDP rights desk: a request is recorded with a 90-day due date, a
//! nominee request names the nominee, an erasure refused for the record's
//! legal retention says so, and an answered request cannot be answered again.
//! The data summary answers an access request with what is held.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};

async fn call(
    app: &common::TestApp,
    csrf: &str,
    method: Method,
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

#[tokio::test]
async fn a_rights_request_is_recorded_answered_once_and_summarised() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let phone = format!("95{}", &uuid::Uuid::new_v4().as_u128().to_string()[..8]);
    let (s, patient) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/patients",
        json!({
        "first_name": "Kavya", "last_name": "Rights", "gender": "female",
        "phone": phone, "date_of_birth": "1988-01-20" }),
    )
    .await;
    assert!(s.is_success(), "{patient}");
    let pid = patient["id"].as_str().unwrap_or_default().to_owned();

    let (s, _) = call(&app, &csrf, Method::POST, "/api/privacy-requests",
        json!({ "patient_id": pid, "request_type": "nominee", "details": "Name my husband as nominee" })).await;
    assert_eq!(
        s,
        StatusCode::BAD_REQUEST,
        "a nominee request names the nominee"
    );

    let (s, req) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/privacy-requests",
        json!({ "patient_id": pid, "request_type": "erasure", "details": "Delete all my records",
                "received_via": "email" }),
    )
    .await;
    assert!(s.is_success(), "{req}");
    assert_eq!(req["status"], "open");
    let received =
        chrono::DateTime::parse_from_rfc3339(req["received_at"].as_str().unwrap_or_default())
            .expect("received");
    let due = chrono::DateTime::parse_from_rfc3339(req["due_at"].as_str().unwrap_or_default())
        .expect("due");
    assert_eq!((due - received).num_days(), 90);

    let decide = format!(
        "/api/privacy-requests/{}/decide",
        req["id"].as_str().unwrap_or_default()
    );
    let (s, _) = call(
        &app,
        &csrf,
        Method::PUT,
        &decide,
        json!({ "status": "refused", "decision": "no" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "a refusal says why");
    let reason =
        "Medical records must be kept 3 years (IMC Regulations 1.3.1); contact details erased";
    let (s, done) = call(
        &app,
        &csrf,
        Method::PUT,
        &decide,
        json!({ "status": "refused", "decision": reason }),
    )
    .await;
    assert!(s.is_success(), "{done}");
    assert_eq!(done["decision"], reason);
    let (s, _) = call(
        &app,
        &csrf,
        Method::PUT,
        &decide,
        json!({ "status": "completed", "decision": "Erased everything" }),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT, "answered once");

    let (s, summary) = call(
        &app,
        &csrf,
        Method::GET,
        &format!("/api/patients/{pid}/data-summary"),
        Value::Null,
    )
    .await;
    assert!(s.is_success(), "{summary}");
    assert_eq!(summary["held"].as_array().map(Vec::len), Some(12));
}

//! The data processors register: what each outside service receives, where
//! it keeps it, and whether its agreement is in force. A processor with no
//! agreement is flagged; one keeping data abroad says so by its country; an
//! agreement ending before it was signed, or an unknown data category, is
//! refused; a processor cannot be its own sub-processor.

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
async fn processors_carry_their_agreement_and_where_data_goes() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let t = uuid::Uuid::new_v4().simple().to_string()[..6].to_owned();

    let (s, _) = call(&app, &csrf, Method::POST, "/api/data-processors", json!({
        "name": format!("Bad {t}"), "service": "SMS", "country": "IN", "data_categories": ["dna"] })).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "unknown category");
    let (s, _) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/data-processors",
        json!({
        "name": format!("Bad {t}"), "service": "SMS", "country": "IN",
        "dpa_signed_on": "2026-05-01", "dpa_expires_on": "2026-01-01" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "ends before signed");

    let (s, cloud) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/data-processors",
        json!({
        "name": format!("Cloud {t}"), "service": "Hosting", "country": "IN",
        "data_categories": ["identity", "clinical"], "dpa_reference": "MSA-2026-01",
        "dpa_signed_on": "2026-01-01", "dpa_expires_on": "2030-01-01" }),
    )
    .await;
    assert!(s.is_success(), "{cloud}");
    assert_eq!(cloud["dpa_state"], "in_force");

    let (s, ai) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/data-processors",
        json!({
        "name": format!("AI {t}"), "service": "Clinical summaries", "country": "US",
        "data_categories": ["clinical"], "sub_processor_of": cloud["id"] }),
    )
    .await;
    assert!(s.is_success(), "{ai}");
    assert_eq!(ai["dpa_state"], "missing", "no agreement is flagged");
    assert_eq!(ai["sub_processor_of_name"], format!("Cloud {t}"));

    let (s, _) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/data-processors",
        json!({
        "name": format!("cloud {t}"), "service": "Dup", "country": "IN" }),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT, "one entry per processor");

    let ai_path = format!(
        "/api/data-processors/{}",
        ai["id"].as_str().unwrap_or_default()
    );
    let (s, _) = call(
        &app,
        &csrf,
        Method::PUT,
        &ai_path,
        json!({
        "name": format!("AI {t}"), "service": "x", "country": "US", "sub_processor_of": ai["id"] }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "not its own sub-processor");
    let (s, retired) = call(&app, &csrf, Method::PUT, &ai_path, json!({
        "name": format!("AI {t}"), "service": "Clinical summaries", "country": "US", "status": "retired" })).await;
    assert!(s.is_success(), "{retired}");
    assert_eq!(retired["status"], "retired");
}

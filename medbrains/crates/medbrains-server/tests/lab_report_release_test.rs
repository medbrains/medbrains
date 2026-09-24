//! A lab report is printable only after somebody released it.
//!
//! `verify_results` is where a result becomes clinical. It refuses on an
//! unacknowledged critical value, on a QC run that failed and nobody reviewed,
//! and on a critical value released by the person who entered it. All of that
//! was enforceable and none of it was enforced, because the report endpoints
//! would print an order straight past every one of those gates — letterhead,
//! reference ranges, a pathologist name field and all. A sheet that looks
//! released is treated as released.

mod common;

use serde_json::{Value, json};

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
    serde_json::from_str(&text).unwrap_or(Value::Null)
}

async fn put(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> reqwest::StatusCode {
    app.client
        .put(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request")
        .status()
}

#[tokio::test]
async fn a_lab_report_prints_only_once_the_order_has_been_released() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let patient = post(
        &app,
        &csrf,
        "/api/patients",
        json!({ "first_name": "Release", "last_name": "Gate", "gender": "female", "phone": "9990000411" }),
    )
    .await;
    let patient_id = patient["id"].as_str().expect("patient id").to_owned();
    let uhid = patient["uhid"].as_str().expect("uhid").to_owned();

    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await
        .expect("departments");
    let department_id = depts[0]["id"].as_str().expect("a department").to_owned();
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
    // A perfectly ordinary, non-critical result: nothing else is holding this
    // order back, so release is the only thing standing between it and paper.
    post(
        &app,
        &csrf,
        &format!("/api/lab/orders/{order_id}/results"),
        json!({ "results": [{ "parameter_name": "Haemoglobin", "value": "13.4", "flag": "normal" }] }),
    )
    .await;

    // Results entered, run finished — the order is ready to be released and
    // has not been. This is the window the gate exists for.
    put(
        &app,
        &csrf,
        &format!("/api/lab/orders/{order_id}/complete"),
        json!({}),
    )
    .await;

    for report in ["lab-report", "lab-report-full"] {
        let resp = app
            .get(&app.client, &format!("/api/print-data/{report}/{order_id}"))
            .await;
        assert_eq!(
            resp.status(),
            reqwest::StatusCode::BAD_REQUEST,
            "{report} printed an order nobody had released"
        );
        let body = resp.text().await.unwrap_or_default();
        assert!(
            body.contains("not been released"),
            "{report} refused without saying why: {body}"
        );
    }

    let released = put(
        &app,
        &csrf,
        &format!("/api/lab/orders/{order_id}/verify"),
        json!({}),
    )
    .await;
    assert!(released.is_success(), "the order releases: {released}");

    for report in ["lab-report", "lab-report-full"] {
        let resp = app
            .get(&app.client, &format!("/api/print-data/{report}/{order_id}"))
            .await;
        assert!(
            resp.status().is_success(),
            "{report} must print once released, got {}",
            resp.status()
        );
    }
}

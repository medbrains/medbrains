//! A dialysis unit's safety rules, through the API: a dialyzer is one
//! patient's for life, counts every use and stops at the hospital's limit; a
//! worn dialyzer (TCV below 80%) is discarded; a seropositive patient's
//! dialyzer is single-use and they go only on a machine kept for their
//! serology; a machine takes one patient per shift.

mod common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

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

async fn patient(app: &common::TestApp, tenant: Uuid, tag: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Dialysis', 'Patient', 'male', '9000000002') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-DX-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

#[tokio::test]
async fn dialyzers_and_machines_follow_the_units_safety_rules() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let t = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let ravi = patient(&app, tenant, &format!("{t}A")).await;
    let mala = patient(&app, tenant, &format!("{t}B")).await;

    // Reuse limit 2 keeps the test short.
    let (s, _) = call(&app, &csrf, Method::PUT, "/api/specialty/dialysis/reuse-policy", json!({ "max_uses": 2 })).await;
    assert!(s.is_success());

    let (s, clean) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/machines",
        json!({ "code": format!("HD{t}1"), "name": "Machine 1", "serology": "none" })).await;
    assert!(s.is_success(), "{clean}");
    let (_, hbsag) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/machines",
        json!({ "code": format!("HD{t}2"), "name": "Machine 2", "serology": "hbsag" })).await;

    // Serology decides the machine; one patient per machine per shift.
    let today = chrono::Utc::now().date_naive().to_string();
    let book = |machine: &Value, patient: Uuid, serology: &str, shift: &str| json!({
        "machine_id": machine["id"], "patient_id": patient, "slot_date": today, "shift": shift, "serology": serology });
    let (s, _) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/slots", book(&hbsag, ravi, "none", "morning")).await;
    assert_eq!(s, StatusCode::CONFLICT, "a seronegative patient never goes on an HBsAg machine");
    let (s, slot) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/slots", book(&clean, ravi, "none", "morning")).await;
    assert!(s.is_success(), "{slot}");
    let (s, _) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/slots", book(&clean, mala, "none", "morning")).await;
    assert_eq!(s, StatusCode::CONFLICT, "the machine is taken for that shift");

    // A seropositive patient's dialyzer is single-use whatever the limit.
    let (_, single) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/dialyzers",
        json!({ "patient_id": mala, "label": format!("DZ{t}M"), "serology": "hbsag" })).await;
    assert_eq!(single["max_uses"], 1, "{single}");

    let (_, dz) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/dialyzers",
        json!({ "patient_id": ravi, "label": format!("DZ{t}R"), "serology": "none", "baseline_tcv_ml": 100 })).await;
    assert_eq!(dz["max_uses"], 2, "{dz}");
    let session = |patient: Uuid, dialyzer: &Value, slot: Option<&Value>| json!({
        "patient_id": patient, "access_type": "AV fistula", "dialyzer_id": dialyzer["id"],
        "slot_id": slot.map(|s| s["id"].clone()) });

    // Never shared.
    let (s, refused) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/sessions", session(mala, &dz, None)).await;
    assert_eq!(s, StatusCode::CONFLICT, "{refused}");

    // Use 1, on the booked shift: the machine comes from the booking.
    let (s, first) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/sessions", session(ravi, &dz, Some(&slot))).await;
    assert!(s.is_success(), "{first}");
    assert_eq!(first["session"]["dialyzer_use"], 1);
    assert_eq!(first["session"]["machine_number"], format!("HD{t}1"));

    // Reprocessed and still good (85 of 100 ml), use 2; then the limit.
    let reprocess = format!("/api/specialty/dialysis/dialyzers/{}/reprocess", dz["id"].as_str().unwrap_or_default());
    let (_, ok) = call(&app, &csrf, Method::POST, &reprocess, json!({ "tcv_ml": 85 })).await;
    assert_eq!(ok["status"], "in_use");
    let (_, second) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/sessions", session(ravi, &dz, None)).await;
    assert_eq!(second["session"]["dialyzer_use"], 2);
    let (s, limit) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/sessions", session(ravi, &dz, None)).await;
    assert_eq!(s, StatusCode::CONFLICT, "{limit}");

    // A worn dialyzer is discarded at reprocessing.
    let (_, dz2) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/dialyzers",
        json!({ "patient_id": ravi, "label": format!("DZ{t}S"), "serology": "none", "baseline_tcv_ml": 100 })).await;
    let reprocess2 = format!("/api/specialty/dialysis/dialyzers/{}/reprocess", dz2["id"].as_str().unwrap_or_default());
    let (_, worn) = call(&app, &csrf, Method::POST, &reprocess2, json!({ "tcv_ml": 70 })).await;
    assert_eq!(worn["status"], "discarded", "{worn}");
    let (s, _) = call(&app, &csrf, Method::POST, "/api/specialty/dialysis/sessions", session(ravi, &dz2, None)).await;
    assert_eq!(s, StatusCode::CONFLICT, "a discarded dialyzer is not used");

    // Back to the hospital's usual limit for other suites.
    call(&app, &csrf, Method::PUT, "/api/specialty/dialysis/reuse-policy", json!({ "max_uses": 6 })).await;
}

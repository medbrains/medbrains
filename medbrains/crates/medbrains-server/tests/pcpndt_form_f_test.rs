//! PC-PNDT Rule 9(4): an ultrasound of a pregnant woman has a Form F, filled
//! before the scan is reported. Ordering one opens a draft linked to the order
//! (her LMP from the antenatal registration); the report cannot be verified
//! until the form carries the indication, the performing doctor and both
//! declarations; the completed form prints with no sex of the foetus anywhere.
//! An ultrasound of a woman who is not pregnant opens nothing.

use crate::common;

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

async fn woman(app: &common::TestApp, tenant: Uuid, uhid: String) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Lakshmi', 'Devi', 'female', '9000000003') RETURNING id",
    )
    .bind(tenant)
    .bind(uhid)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

#[tokio::test]
async fn an_ultrasound_of_a_pregnant_woman_is_not_reported_without_form_f() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let t = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let (s, usg) = call(&app, &csrf, Method::POST, "/api/radiology/modalities",
        json!({ "code": format!("US{t}"), "name": "Ultrasound", "is_ultrasound": true })).await;
    assert!(s.is_success(), "{usg}");
    assert_eq!(usg["is_ultrasound"], true);

    let pregnant = woman(&app, tenant, format!("UH-FF-{t}A")).await;
    sqlx::query(
        "INSERT INTO maternity_registrations (tenant_id, patient_id, registration_number, lmp_date, edd_date, status) \
         VALUES ($1, $2, $3, current_date - 70, current_date + 210, 'active')",
    )
    .bind(tenant)
    .bind(pregnant)
    .bind(format!("ANC-{t}"))
    .execute(&app.db)
    .await
    .expect("antenatal registration");
    let not_pregnant = woman(&app, tenant, format!("UH-FF-{t}B")).await;

    // An ultrasound for a woman with no pregnancy on record opens nothing.
    let (_, plain) = call(&app, &csrf, Method::POST, "/api/radiology/orders",
        json!({ "patient_id": not_pregnant, "modality_id": usg["id"], "body_part": "Abdomen" })).await;
    let none: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pcpndt_forms WHERE radiology_order_id = $1")
        .bind(plain["id"].as_str().and_then(|s| s.parse::<Uuid>().ok()))
        .fetch_one(&app.db)
        .await
        .expect("count");
    assert_eq!(none, 0, "no Form F for a woman who is not pregnant");

    // For the antenatal patient a draft opens, her LMP and weeks filled in.
    let (s, order) = call(&app, &csrf, Method::POST, "/api/radiology/orders",
        json!({ "patient_id": pregnant, "modality_id": usg["id"], "body_part": "Obstetric" })).await;
    assert!(s.is_success(), "{order}");
    let order_id = order["id"].as_str().unwrap_or_default().to_owned();
    let (_, forms) = call(&app, &csrf, Method::GET,
        &format!("/api/regulatory/pcpndt-forms?radiology_order_id={order_id}"), Value::Null).await;
    let form = forms[0].clone();
    assert_eq!(form["status"], "draft", "{forms}");
    assert_eq!(form["gestational_age_weeks"], 10);
    assert!(form["form_number"].as_str().is_some_and(|n| n.starts_with("FF-")));
    let form_id = form["id"].as_str().unwrap_or_default().to_owned();

    // The report is written but cannot be verified while the form is a draft.
    let (s, report) = call(&app, &csrf, Method::POST, &format!("/api/radiology/orders/{order_id}/report"),
        json!({ "findings": "Single live intrauterine pregnancy." })).await;
    assert!(s.is_success(), "{report}");
    let verify = format!("/api/radiology/reports/{}/verify", report["id"].as_str().unwrap_or_default());
    let (s, refused) = call(&app, &csrf, Method::PUT, &verify, Value::Null).await;
    assert_eq!(s, StatusCode::CONFLICT, "{refused}");

    // Both declarations are required.
    let complete = format!("/api/regulatory/pcpndt-forms/{form_id}/complete");
    let body = |woman_declares: bool| json!({
        "indication": "Estimation of gestational age (dating)", "performing_doctor_id": admin,
        "living_sons": 1, "living_daughters": 0, "self_referred": false,
        "result_summary": "Viable pregnancy, 10 weeks.", "woman_declares": woman_declares,
        "doctor_declares": true });
    let (s, _) = call(&app, &csrf, Method::PUT, &complete, body(false)).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, done) = call(&app, &csrf, Method::PUT, &complete, body(true)).await;
    assert!(s.is_success(), "{done}");
    assert_eq!(done["status"], "submitted");

    let (s, verified) = call(&app, &csrf, Method::PUT, &verify, Value::Null).await;
    assert!(s.is_success(), "the report verifies once Form F is complete: {verified}");

    // The printed Form F: her details, the indication, both declarations.
    let (s, print) = call(&app, &csrf, Method::GET, &format!("/api/print-data/pcpndt-form-f/{form_id}"), Value::Null).await;
    assert!(s.is_success(), "{print}");
    assert_eq!(print["woman"]["weeks_of_pregnancy"], 10);
    assert_eq!(print["woman"]["living_sons"], 1);
    assert_eq!(print["procedure"]["indication"], "Estimation of gestational age (dating)");
    assert!(print["declarations"]["doctor"].as_str().is_some_and(|d| d.contains("neither detected nor disclosed")));
    assert!(print["declarations"]["doctor_declared_at"].is_string());
    let text = print.to_string().to_lowercase();
    assert!(!text.contains("\"sex\"") && !text.contains("gender\":\"m"), "no sex of the foetus anywhere");
}

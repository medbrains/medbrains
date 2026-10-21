//! Dental charting and treatment plans (#230): tooth numbers are FDI, a
//! finding recorded in error is removed but kept, and a procedure is billed
//! to the visit once — when it is done, never when it is cancelled.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn call(
    app: &common::TestApp,
    csrf: &str,
    m: Method,
    path: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut req = app
        .client
        .request(m, app.url(path))
        .header("x-csrf-token", csrf);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req.send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn a_procedure_is_billed_once_when_done_and_never_when_cancelled() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Dental', 'Patient', 'female', '9000000230') RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-DN-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ($1, $2, 'opd') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");

    let (status, exam) = call(&app, &csrf, Method::POST, "/api/specialty/dental/exams",
        Some(json!({ "patient_id": patient, "encounter_id": encounter, "chief_complaint": "Pain lower left" }))).await;
    assert_eq!(status, StatusCode::OK, "{exam}");
    let exam = exam["id"].as_str().expect("exam id").to_owned();

    let (status, _) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/specialty/dental/exams/{exam}/chart"),
        Some(json!({ "tooth_number": "19", "condition": "caries" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "19 is not a tooth");
    let (_, finding) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/specialty/dental/exams/{exam}/chart"),
        Some(json!({ "tooth_number": "36", "condition": "caries", "surface": "occlusal" })),
    )
    .await;
    let finding = finding["id"].as_str().expect("finding").to_owned();
    let (status, fixed) = call(
        &app,
        &csrf,
        Method::PUT,
        &format!("/api/specialty/dental/chart/{finding}"),
        Some(json!({ "condition": "root_canal" })),
    )
    .await;
    assert_eq!(
        (status, fixed["condition"].as_str()),
        (StatusCode::OK, Some("root_canal"))
    );
    call(
        &app,
        &csrf,
        Method::DELETE,
        &format!("/api/specialty/dental/chart/{finding}"),
        None,
    )
    .await;
    let (_, chart) = call(
        &app,
        &csrf,
        Method::GET,
        &format!("/api/specialty/dental/exams/{exam}/chart"),
        None,
    )
    .await;
    assert_eq!(
        chart.as_array().map(Vec::len),
        Some(0),
        "a removed finding leaves the chart"
    );
    let kept: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM dental_chart_entries WHERE id = $1::uuid AND deleted_at IS NOT NULL",
    )
    .bind(&finding)
    .fetch_one(&app.db)
    .await
    .expect("kept");
    assert_eq!(kept, 1, "and is kept, marked removed");

    let plan = |tooth: &str, procedure: &str, price: f64| json!({ "tooth_number": tooth, "procedure": procedure, "price": price });
    let path = format!("/api/specialty/dental/exams/{exam}/treatment");
    let (_, rct) = call(
        &app,
        &csrf,
        Method::POST,
        &path,
        Some(plan("36", "Root canal treatment", 4500.0)),
    )
    .await;
    let (_, scaling) = call(
        &app,
        &csrf,
        Method::POST,
        &path,
        Some(plan("", "Scaling", 800.0)),
    )
    .await;
    let rct = rct["id"].as_str().expect("rct").to_owned();
    let scaling = scaling["id"].as_str().expect("scaling").to_owned();

    let (status, done) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/specialty/dental/treatment/{rct}/complete"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(done["status"], "done");
    let (status, _) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/specialty/dental/treatment/{rct}/complete"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "done once");
    let (status, _) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/specialty/dental/treatment/{rct}/cancel"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "a done procedure stays done");
    let (status, _) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/specialty/dental/treatment/{scaling}/cancel"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let billed: Vec<(String, rust_decimal::Decimal)> = sqlx::query_as(
        "SELECT ii.description, ii.unit_price FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id \
          WHERE i.encounter_id = $1 AND ii.source = 'dental'",
    )
    .bind(encounter)
    .fetch_all(&app.db)
    .await
    .expect("billed");
    assert_eq!(
        billed.len(),
        1,
        "only the done procedure is billed: {billed:?}"
    );
    assert_eq!(billed[0].0, "Root canal treatment (tooth 36)");
    assert_eq!(billed[0].1, rust_decimal::Decimal::from(4500));
}

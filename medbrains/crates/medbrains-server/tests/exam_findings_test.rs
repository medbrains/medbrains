//! Examination findings at a place on the body: "tenderness, right iliac
//! fossa" kept with the site's code and side, inside the consultation.

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

async fn encounter(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Exam', 'Finding', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-EF-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned()
}

/// Given a doctor records tenderness at a picked site, Then the consultation
/// keeps the finding with its code and side; a finding with an unknown side
/// or no description is refused rather than stored.
#[tokio::test]
async fn a_site_finding_is_kept_with_its_code_and_side() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let url = app.url(&format!(
        "/api/opd/encounters/{}/consultation",
        encounter(&app, &csrf).await
    ));
    let exam = |laterality: &str, finding: &str| {
        json!({ "physical_examination": { "abdomen": "Soft", "findings": [{
            "site": "Right iliac fossa", "site_code": null,
            "laterality": laterality, "finding": finding,
        }]}})
    };

    let (status, _) = send(&csrf, app.client.post(&url).json(&exam("upper", "Tender"))).await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "an unknown side is refused"
    );
    let (status, _) = send(&csrf, app.client.post(&url).json(&exam("right", "  "))).await;
    assert_eq!(
        status,
        StatusCode::UNPROCESSABLE_ENTITY,
        "a finding needs a description"
    );

    let (status, consultation) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&exam("right", "Tender, guarding")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{consultation}");
    let finding = &consultation["physical_examination"]["findings"][0];
    assert_eq!(finding["site"], "Right iliac fossa");
    assert_eq!(finding["laterality"], "right");
    assert_eq!(finding["finding"], "Tender, guarding");
}

/// Given a consultation whose examination has system notes, When the phone
/// saves only the site findings, Then the notes are kept beside them.
#[tokio::test]
async fn saving_findings_alone_keeps_the_system_notes() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let url = app.url(&format!(
        "/api/opd/encounters/{}/consultation",
        encounter(&app, &csrf).await
    ));
    let (status, created) = send(
        &csrf,
        app.client.post(&url).json(&json!({
            "chief_complaint": "Knee pain",
            "physical_examination": { "musculoskeletal": "Antalgic gait" },
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["id"].as_str().expect("consultation id");

    let (status, updated) = send(
        &csrf,
        app.client.put(format!("{url}/{id}")).json(
            &json!({ "physical_examination": { "findings": [{
                "site": "Left knee", "site_code": null,
                "laterality": "left", "finding": "Effusion",
            }]}}),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{updated}");
    let exam = &updated["physical_examination"];
    assert_eq!(exam["musculoskeletal"], "Antalgic gait");
    assert_eq!(exam["findings"][0]["site"], "Left knee");
}

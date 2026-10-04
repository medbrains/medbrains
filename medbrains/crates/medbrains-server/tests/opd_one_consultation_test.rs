//! One consultation per visit: the History tab, the ROS and the exam write
//! into the same note the SOAP tab saves, so a second note would hide them.

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
         SELECT tenant_id, $1, 'One', 'Note', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-ON-{suffix}"))
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

/// Given a visit whose note carries the history the History tab wrote, When
/// a second note is posted for the same visit, Then it is refused (409) and
/// the history is still on the note the visit reads; saving SOAP fields as an
/// update keeps it too.
#[tokio::test]
async fn a_visit_keeps_one_consultation_note() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let url = app.url(&format!(
        "/api/opd/encounters/{}/consultation",
        encounter(&app, &csrf).await
    ));
    let (status, created) = send(
        &csrf,
        app.client.post(&url).json(
            &json!({ "chief_complaint": "Cough", "hpi": "Cough for 3 weeks, worse at night" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{created}");
    let id = created["id"].as_str().expect("consultation id");

    let (status, refused) = send(
        &csrf,
        app.client
            .post(&url)
            .json(&json!({ "chief_complaint": "Cough", "plan": "Chest X-ray" })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "a second note: {refused}");

    let (status, updated) = send(
        &csrf,
        app.client
            .put(format!("{url}/{id}"))
            .json(&json!({ "chief_complaint": "Cough", "plan": "Chest X-ray" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{updated}");

    let (status, read) = send(&csrf, app.client.get(&url)).await;
    assert_eq!(status, StatusCode::OK, "{read}");
    assert_eq!(read["id"], created["id"], "the visit reads the one note");
    assert_eq!(read["plan"], "Chest X-ray");
    assert_eq!(
        read["hpi"], "Cough for 3 weeks, worse at night",
        "the history survives"
    );
}

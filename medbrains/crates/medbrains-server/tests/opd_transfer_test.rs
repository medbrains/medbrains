//! Moving a waiting visit to another department
//! (RFCs/modules/RFC-MODULE-token-queues.md, P2, scenario 33).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn department(app: &common::TestApp, label: &str) -> Uuid {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("TR{suffix}"))
    .bind(format!("{label} {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

async fn patient(app: &common::TestApp) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Moved', 'Patient', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-TR-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a patient registered to General Medicine who needs Orthopaedics,
/// When the desk moves the visit, Then the visit, its queue row and its token
/// are in Orthopaedics, and the patient is called after those who came before
/// them and before those who came later — not sent to the back.
#[tokio::test]
async fn a_moved_visit_keeps_its_place_by_arrival() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (general, ortho) = (
        department(&app, "General").await,
        department(&app, "Ortho").await,
    );
    let token_in = |dept: Uuid| json!({ "module": "opd", "scope": "department", "scope_id": dept });

    let (_, earlier) = post(&app, &csrf, "/api/tokens/issue", token_in(ortho)).await;
    let (status, visit) = post(
        &app,
        &csrf,
        "/api/opd/encounters",
        json!({ "patient_id": patient(&app).await, "department_id": general }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let encounter = visit["encounter"]["id"]
        .as_str()
        .expect("encounter id")
        .to_owned();
    let (_, later) = post(&app, &csrf, "/api/tokens/issue", token_in(ortho)).await;

    let (status, moved) = post(
        &app,
        &csrf,
        &format!("/api/opd/encounters/{encounter}/transfer"),
        json!({ "department_id": ortho }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{moved}");

    let (dept, queue_dept): (Option<Uuid>, Option<Uuid>) = sqlx::query_as(
        "SELECT e.department_id, q.department_id FROM encounters e \
           JOIN opd_queues q ON q.encounter_id = e.id WHERE e.id = $1::uuid",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("visit");
    assert_eq!((dept, queue_dept), (Some(ortho), Some(ortho)));

    let call_next = || post(&app, &csrf, "/api/tokens/call-next", token_in(ortho));
    assert_eq!(call_next().await.1["id"], earlier["id"]);
    let (_, moved_token) = call_next().await;
    assert_eq!(
        moved_token["entity_id"],
        encounter.as_str(),
        "before the later arrival"
    );
    assert_eq!(
        moved_token["number"], moved["token_number"],
        "the number the desk was told"
    );
    assert_eq!(call_next().await.1["id"], later["id"]);

    // Called now: moving it is a referral, not a transfer.
    let (status, body) = post(
        &app,
        &csrf,
        &format!("/api/opd/encounters/{encounter}/transfer"),
        json!({ "department_id": general }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("refer"), "{body}");
}

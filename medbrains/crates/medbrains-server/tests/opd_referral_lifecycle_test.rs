//! A referral's life: accepting puts the patient in the colleague's queue on
//! the same visit; the opinion sends them back; the visit stays the first
//! doctor's to close (RFC-MODULE-opd-referral-journey, slice 1).

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
         SELECT tenant_id, $1, 'Refer', 'Red', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-RL-{suffix}"))
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

async fn put(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    send(csrf, app.client.put(app.url(path)).json(&body)).await
}

async fn rows(app: &common::TestApp, encounter: &str) -> Vec<(String, String)> {
    sqlx::query_as(
        "SELECT kind, status::text FROM opd_queues \
          WHERE encounter_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at",
    )
    .bind(encounter)
    .fetch_all(&app.db)
    .await
    .expect("queue rows")
}

/// Given a visit referred to Cardiology for an opinion, When it is accepted,
/// Then a cross-consult row joins the visit with its own token in the same
/// visit number; accepting again is refused; When the opinion is given, Then
/// the colleague's row closes, the patient is back with the referring doctor
/// at `returned` priority, and the visit itself is still open.
#[tokio::test]
async fn a_referral_is_accepted_answered_and_returns_the_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let (patient, cardiology): (Uuid, Uuid) = sqlx::query_as(
        "SELECT e.patient_id, d.id FROM encounters e \
           JOIN departments d ON d.tenant_id = e.tenant_id AND d.code <> 'GEN-MEDICINE' \
          WHERE e.id = $1::uuid AND d.is_active ORDER BY d.code LIMIT 1",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("another department");

    let (status, referral) = send(
        &csrf,
        app.client.post(app.url("/api/opd/referrals")).json(&json!({
            "patient_id": patient, "encounter_id": encounter,
            "to_department_id": cardiology, "urgency": "urgent",
            "reason": "Exertional chest pain",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{referral}");
    let id = referral["id"].as_str().expect("referral id");
    let general: Uuid =
        sqlx::query_scalar("SELECT department_id FROM encounters WHERE id = $1::uuid")
            .bind(&encounter)
            .fetch_one(&app.db)
            .await
            .expect("visit department");
    assert_eq!(
        referral["from_department_id"],
        json!(general),
        "from the visit's department"
    );

    let (status, accepted) = put(
        &app,
        &csrf,
        &format!("/api/opd/referrals/{id}/accept"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{accepted}");
    assert_eq!(accepted["referral"]["status"], "accepted");
    assert_eq!(
        rows(&app, &encounter).await,
        vec![
            ("primary".into(), "waiting".into()),
            ("cross_consult".into(), "waiting".into())
        ]
    );
    let (visit_tokens, distinct_visits): (i64, i64) = sqlx::query_as(
        "SELECT count(*), count(DISTINCT visit_id) FROM tokens \
          WHERE module = 'opd' AND token_date = CURRENT_DATE AND patient_id = $1",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("tokens");
    assert_eq!(
        (visit_tokens, distinct_visits),
        (2, 1),
        "two places, one visit number"
    );

    let (status, _) = put(
        &app,
        &csrf,
        &format!("/api/opd/referrals/{id}/accept"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "accepting twice is refused");

    let (status, done) = put(
        &app,
        &csrf,
        &format!("/api/opd/referrals/{id}/complete"),
        json!({ "opinion": "Stable angina; start aspirin, TMT next week" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{done}");
    assert_eq!(
        done["referral"]["response_notes"],
        "Stable angina; start aspirin, TMT next week"
    );
    assert_eq!(
        rows(&app, &encounter).await,
        vec![
            ("primary".into(), "waiting".into()),
            ("cross_consult".into(), "completed".into()),
            ("returned".into(), "waiting".into()),
        ]
    );
    let returned_priority: String = sqlx::query_scalar(
        "SELECT t.priority FROM tokens t JOIN opd_queues q ON q.id = t.entity_id \
          WHERE q.encounter_id = $1::uuid AND q.kind = 'returned'",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("returned token");
    assert_eq!(returned_priority, "returned");
    let visit_status: String =
        sqlx::query_scalar("SELECT status::text FROM encounters WHERE id = $1::uuid")
            .bind(&encounter)
            .fetch_one(&app.db)
            .await
            .expect("visit");
    assert_ne!(
        visit_status, "completed",
        "the colleague's opinion does not close the visit"
    );
}

/// A decline needs a reason; a referral can be withdrawn only while pending.
#[tokio::test]
async fn a_referral_is_declined_with_a_reason_and_cannot_then_be_withdrawn() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let encounter = encounter(&app, &csrf).await;
    let (patient, other): (Uuid, Uuid) = sqlx::query_as(
        "SELECT e.patient_id, d.id FROM encounters e \
           JOIN departments d ON d.tenant_id = e.tenant_id AND d.id <> e.department_id \
          WHERE e.id = $1::uuid AND d.is_active ORDER BY d.code LIMIT 1",
    )
    .bind(&encounter)
    .fetch_one(&app.db)
    .await
    .expect("another department");
    let (_, referral) = send(
        &csrf,
        app.client.post(app.url("/api/opd/referrals")).json(&json!({
            "patient_id": patient, "encounter_id": encounter,
            "to_department_id": other, "reason": "Opinion",
        })),
    )
    .await;
    let id = referral["id"].as_str().expect("referral id");

    let (status, _) = put(
        &app,
        &csrf,
        &format!("/api/opd/referrals/{id}/decline"),
        json!({ "reason": "  " }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a decline says why");
    let (status, declined) = put(
        &app,
        &csrf,
        &format!("/api/opd/referrals/{id}/decline"),
        json!({ "reason": "Not a cardiac picture; see medicine" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{declined}");
    assert_eq!(declined["referral"]["status"], "declined");
    let (status, _) = put(
        &app,
        &csrf,
        &format!("/api/opd/referrals/{id}/cancel"),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "only a pending referral can be withdrawn"
    );
    assert_eq!(
        rows(&app, &encounter).await,
        vec![("primary".into(), "waiting".into())]
    );
}

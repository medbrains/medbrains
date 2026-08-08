//! Following your own token from your phone — GitHub #1514.
//!
//! Kiosk check-in already issued a queue token and told the patient the number.
//! After that there was nowhere to watch it: `/api/tokens/mine` needs staff
//! permissions and reads a different table than check-in writes, so the only
//! way to learn your position was to stand in front of the waiting-room screen.
//! A digital token you cannot follow is a screenshot.
//!
//! These tests pin the part that carries risk: the status link is reachable by
//! anyone holding it, so it must answer for exactly one token and disclose
//! nothing the waiting-room board does not already show to the whole room.

mod common;

use reqwest::StatusCode;
use uuid::Uuid;

struct Booking {
    id: String,
    status_token: String,
    token_number: String,
}

async fn a_department(app: &common::TestApp, tenant: Uuid) -> Uuid {
    // Codes are constrained to ^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$.
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("PT{suffix}"))
    .bind(format!("Phone Token {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("create an isolated department");
    row.0
}

/// Put a token in a queue and take the link the desk would hand the patient.
///
/// Not through kiosk check-in, which is the other way this link is minted:
/// the only source of check-in QR codes is `POST /api/public/appointments/book`,
/// and that endpoint is broken independently of this work — it omits
/// `created_by`, which the appointments table requires. Until that is fixed no
/// QR can be minted at all, so the desk is the only path a patient can actually
/// reach today, and the only one worth pinning.
async fn a_token_and_its_link(app: &common::TestApp, csrf: &str) -> Booking {
    let tenant: (Uuid,) = sqlx::query_as("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let department = a_department(app, tenant.0).await;

    let resp = app
        .client
        .post(app.url("/api/tv/tokens"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({ "department_id": department, "priority": "normal" }))
        .send()
        .await
        .expect("create token");
    let status = resp.status();
    let body = resp.text().await.expect("body");
    assert_eq!(status, StatusCode::OK, "token creation failed: {body}");
    let token: serde_json::Value = serde_json::from_str(&body).expect("token json");
    let id = token["id"].as_str().expect("token id").to_owned();

    let resp = app
        .client
        .get(app.url(&format!("/api/opd/queue-tokens/{id}/status-link")))
        .send()
        .await
        .expect("status link request");
    let status = resp.status();
    let body = resp.text().await.expect("body");
    assert_eq!(status, StatusCode::OK, "status link failed: {body}");
    let link: serde_json::Value = serde_json::from_str(&body).expect("link json");

    Booking {
        id,
        status_token: link["status_token"]
            .as_str()
            .expect("the desk must get a link to hand over")
            .to_owned(),
        token_number: token["token_number"]
            .as_str()
            .expect("token number")
            .to_owned(),
    }
}

async fn status_of(app: &common::TestApp, token: &str) -> reqwest::Response {
    app.client
        .get(app.url(&format!("/api/public/queue-token/{token}")))
        .send()
        .await
        .expect("status request")
}

/// Given a patient who checked in, When their phone follows the link, Then it
/// reports the token they were given and where it stands.
#[tokio::test]
async fn a_checked_in_patient_can_follow_their_token() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let booking = a_token_and_its_link(&app, &csrf).await;

    let resp = status_of(&app, &booking.status_token).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let status: serde_json::Value = resp.json().await.expect("status json");

    assert_eq!(
        status["token_number"].as_str(),
        Some(booking.token_number.as_str()),
        "the link must report the number the patient is holding",
    );
    assert_eq!(status["status"], "waiting");
    assert!(
        status["ahead"].as_i64().is_some(),
        "a waiting token must say how many are called first",
    );
}

/// Given the link is reachable by anyone holding it, When it is read, Then it
/// discloses no more than the waiting-room screen does.
///
/// This is the whole risk of an unauthenticated status link: it must never
/// become a way to turn a URL into a patient's identity.
#[tokio::test]
async fn the_public_link_discloses_no_identity() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let booking = a_token_and_its_link(&app, &csrf).await;

    let status: serde_json::Value = status_of(&app, &booking.status_token)
        .await
        .json()
        .await
        .expect("status json");

    for leaked in [
        "patient_name",
        "patient_id",
        "uhid",
        "phone",
        "doctor_name",
        "appointment_id",
        "department_id",
    ] {
        assert!(
            status.get(leaked).is_none(),
            "a public token link must not expose {leaked}",
        );
    }
}

/// Given a link that has been altered, When it is read, Then it is refused
/// rather than answered for whatever row it now points at.
#[tokio::test]
async fn a_tampered_link_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let booking = a_token_and_its_link(&app, &csrf).await;

    let mut tampered = booking.status_token.clone();
    tampered.push('x');

    let resp = status_of(&app, &tampered).await;
    assert_eq!(
        resp.status(),
        StatusCode::BAD_REQUEST,
        "an altered link must not resolve",
    );
}

/// Given something that is not one of our links at all, When it is read, Then
/// it is refused. A guessed or invented path must not reach the queue.
#[tokio::test]
async fn an_invented_link_is_refused() {
    let app = common::spawn_app().await;

    let resp = status_of(&app, "MBE1-not-a-real-token").await;
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

/// Given the patient has been called, When they check the link, Then it says so
/// and stops reporting a position.
///
/// A stale "3 ahead" left showing after a patient has been called reads as
/// though they were still waiting, which is worse than no number at all.
#[tokio::test]
async fn a_called_token_reports_no_position() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let booking = a_token_and_its_link(&app, &csrf).await;

    // By id, not token_number: numbers restart per department, so "T-001"
    // belongs to every other suite's queue as much as this one's.
    sqlx::query("UPDATE queue_tokens SET status = 'called', called_at = now() WHERE id = $1::uuid")
        .bind(&booking.id)
        .execute(&app.db)
        .await
        .expect("call the token");

    let status: serde_json::Value = status_of(&app, &booking.status_token)
        .await
        .json()
        .await
        .expect("status json");

    assert_eq!(status["status"], "called");
    assert!(
        status["ahead"].is_null(),
        "a called patient is not waiting behind anybody",
    );
    assert!(status["estimated_wait_minutes"].is_null());
}

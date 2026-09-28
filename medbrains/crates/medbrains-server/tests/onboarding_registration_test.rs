//! Registration is a first-run act, not an open door.
//!
//! `POST /api/onboarding/init` needs no credential — nobody has one before the
//! first organisation exists — so it was reachable by anyone and minted a
//! tenant and a super admin on a server already holding a hospital's patients.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Given a server that already runs a hospital, When a stranger registers a
/// new organisation, Then it is refused and nothing is created; And the
/// status the wizard reads says registration is closed.
#[tokio::test]
async fn a_server_that_runs_a_hospital_takes_no_new_registrations() {
    let app = common::spawn_app().await;
    let status: Value = app
        .client
        .get(app.url("/api/onboarding/status"))
        .send()
        .await
        .expect("status")
        .json()
        .await
        .expect("status json");
    assert_eq!(
        status["needs_setup"], false,
        "the wizard is told it is closed"
    );

    let code = format!("X{}", &Uuid::new_v4().simple().to_string()[..7]).to_uppercase();
    let refused = app
        .client
        .post(app.url("/api/onboarding/init"))
        .json(&json!({
            "hospital_name": "Stranger Hospital", "hospital_code": code, "hospital_type": "standalone_clinic",
            "admin_username": format!("stranger_{}", code.to_lowercase()),
            "admin_email": format!("{}@example.org", code.to_lowercase()),
            "admin_password": "Stranger#2026Aa9", "admin_full_name": "A Stranger",
        }))
        .send()
        .await
        .expect("init");
    assert_eq!(refused.status(), StatusCode::FORBIDDEN);

    let created: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tenants WHERE code = $1)")
        .bind(&code)
        .fetch_one(&app.db)
        .await
        .expect("tenant lookup");
    assert!(!created, "no organisation was created");
}

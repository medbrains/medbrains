//! Registration records how the patient agreed to be contacted
//! (RFCs/modules/RFC-MODULE-notification-simulator.md, S2a).
//!
//! WhatsApp and email need the patient's own yes (DPDP Act 2023, WhatsApp
//! business policy) and a record of who took it; nothing asked before.

mod common;

use reqwest::StatusCode;
use uuid::Uuid;

async fn register(
    app: &common::TestApp,
    csrf: &str,
    extra: serde_json::Value,
) -> reqwest::Response {
    let suffix = &Uuid::new_v4().simple().to_string()[..6];
    let mut body = serde_json::json!({
        "first_name": "Kavya",
        "last_name": format!("Consent{suffix}"),
        "gender": "female",
        "phone": format!("98{}", &Uuid::new_v4().as_u128().to_string()[..8]),
        "date_of_birth": "1990-04-01",
    });
    if let (Some(base), Some(add)) = (body.as_object_mut(), extra.as_object()) {
        base.extend(add.clone());
    }
    app.client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("register request")
}

/// Given a patient who agrees to WhatsApp and prefers it, When registered,
/// Then the agreement is recorded with who took it, and no email agreement is.
#[tokio::test]
async fn an_agreed_channel_is_recorded_with_who_took_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let resp = register(
        &app,
        &csrf,
        serde_json::json!({
            "contact": { "preferred_method": "whatsapp", "whatsapp_opt_in": true, "email_opt_in": false }
        }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
    let patient: serde_json::Value = resp.json().await.expect("patient json");
    let id = Uuid::parse_str(patient["id"].as_str().expect("id")).expect("uuid");

    let rows: Vec<(String, bool, String, Option<Uuid>)> = sqlx::query_as(
        "SELECT channel, granted, source, recorded_by FROM patient_contact_consents \
          WHERE patient_id = $1",
    )
    .bind(id)
    .fetch_all(&app.db)
    .await
    .expect("consent rows");
    assert_eq!(rows.len(), 1, "only the channel agreed to is recorded");
    assert_eq!((rows[0].0.as_str(), rows[0].1, rows[0].2.as_str()), ("whatsapp", true, "registration"));
    assert!(rows[0].3.is_some(), "who took the consent is recorded");

    let method: Option<String> =
        sqlx::query_scalar("SELECT preferred_contact_method FROM patients WHERE id = $1")
            .bind(id)
            .fetch_one(&app.db)
            .await
            .expect("preferred method");
    assert_eq!(method.as_deref(), Some("whatsapp"));
}

/// Given nothing asked, When registered, Then nothing is recorded — silence is
/// not consent.
#[tokio::test]
async fn silence_is_not_consent() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let resp = register(&app, &csrf, serde_json::json!({})).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let patient: serde_json::Value = resp.json().await.expect("patient json");
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patient_contact_consents WHERE patient_id = $1::uuid",
    )
    .bind(patient["id"].as_str().expect("id"))
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(count, 0);
}

/// Agreeing to email with no address, or preferring WhatsApp without agreeing
/// to it, is refused before anything is written.
#[tokio::test]
async fn an_agreement_that_cannot_be_honoured_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    for contact in [
        serde_json::json!({ "whatsapp_opt_in": false, "email_opt_in": true }),
        serde_json::json!({ "preferred_method": "whatsapp", "whatsapp_opt_in": false, "email_opt_in": false }),
    ] {
        let resp = register(&app, &csrf, serde_json::json!({ "contact": contact })).await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST, "{contact}");
    }
}

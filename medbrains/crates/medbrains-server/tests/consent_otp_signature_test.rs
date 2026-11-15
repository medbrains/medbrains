//! A consent signature cannot claim an OTP that was never verified.
//!
//! The signature endpoint stored whatever method it was told. Nothing sends or
//! checks a code for a consent, so "otp" on the record asserted a check that
//! did not happen.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// Given no code was verified, When a signature is recorded as "otp", Then it
/// is refused and nothing is stored.
#[tokio::test]
async fn an_otp_signature_without_a_verified_code_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let consent_id = Uuid::new_v4();

    let status = app
        .client
        .post(app.url("/api/consent/signatures"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "consent_source": "patient_consent",
            "consent_id": consent_id,
            "signature_type": "otp",
        }))
        .send()
        .await
        .expect("signature")
        .status();

    let stored: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM consent_signature_metadata WHERE consent_id = $1")
            .bind(consent_id)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(stored, 0);
}

/// Given no code was verified, When a generated document is signed as "otp",
/// Then it is refused and nothing is stored: the same rule as consent.
#[tokio::test]
async fn an_otp_document_signature_without_a_verified_code_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    app.step_up(&app.client, &csrf, "admin123").await;
    let output = Uuid::new_v4();

    let status = app
        .client
        .post(app.url(&format!("/api/documents/outputs/{output}/signatures")))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "document_output_id": output,
            "signer_role": "author",
            "signature_type": "otp",
        }))
        .send()
        .await
        .expect("signature")
        .status();

    let stored: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM document_output_signatures WHERE document_output_id = $1",
    )
    .bind(output)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(stored, 0);
}

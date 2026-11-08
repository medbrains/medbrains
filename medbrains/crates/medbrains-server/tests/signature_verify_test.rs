//! The public check of a signed document: what the QR on a signed print
//! opens for an insurer, a court clerk or another hospital.
//!
//! Each test pins one promise of the page: an untouched record verifies, one
//! changed field shows as changed, a withdrawn link says so, a guessed token
//! answers exactly like a missing one, and nothing about the patient or the
//! care ever leaves.

use std::collections::BTreeSet;

use crate::{common, signatures_test};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// The only keys a checked document may answer with. Adding one is a
/// decision about what a stranger holding the paper may learn.
const CHECKED_KEYS: &[&str] = &[
    "document_type",
    "facility",
    "key_revoked_on",
    "key_status",
    "signature_intact",
    "signed_at",
    "signer_council",
    "signer_name",
    "signer_registration",
    "status",
    "unchanged",
];

/// A prescription the admin wrote and signed, and the token its QR carries.
async fn signed_prescription(app: &common::TestApp) -> (String, String, String) {
    let csrf = signatures_test::signer_session(app).await;
    let admin_id = signatures_test::admin_user_id(app, &csrf).await;
    signatures_test::issue_default_credential(app, &csrf, &admin_id).await;
    let record_id = signatures_test::doctor_prescription(app, &admin_id).await;
    signatures_test::review(app, &csrf, "prescription", &record_id).await;
    let signed = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "record_type": "prescription", "record_id": record_id }))
        .send()
        .await
        .expect("sign");
    assert_eq!(signed.status(), StatusCode::OK);
    let body: Value = signed.json().await.expect("sign json");
    let signed_record_id = body["signed_record"]["id"]
        .as_str()
        .unwrap_or("")
        .to_owned();
    let token: String = sqlx::query_scalar(
        "SELECT token FROM signature_verify_links \
         WHERE signed_record_id = $1::uuid AND revoked_at IS NULL",
    )
    .bind(&signed_record_id)
    .fetch_one(&app.db)
    .await
    .expect("signing mints the record's public link");
    (record_id, signed_record_id, token)
}

/// `GET` the public check with no session, as the person scanning would.
async fn check(app: &common::TestApp, token: &str) -> (StatusCode, String) {
    let resp = reqwest::Client::new()
        .get(app.url(&format!("/api/public/signatures/verify/{token}")))
        .send()
        .await
        .expect("public check");
    let status = resp.status();
    (status, resp.text().await.unwrap_or_default())
}

fn keys(body: &Value) -> BTreeSet<&str> {
    body.as_object()
        .map(|o| o.keys().map(String::as_str).collect())
        .unwrap_or_default()
}

#[tokio::test]
async fn an_unchanged_record_verifies_and_names_no_patient() {
    let app = common::spawn_app_as_request_role().await;
    let (_, _, token) = signed_prescription(&app).await;

    let (status, text) = check(&app, &token).await;
    assert_eq!(status, StatusCode::OK, "{text}");
    let body: Value = serde_json::from_str(&text).expect("json");
    assert_eq!(body["status"], "unchanged", "{body}");
    assert_eq!(body["unchanged"], true);
    assert_eq!(body["document_type"], "prescription");
    assert_eq!(body["key_status"], "active");
    assert!(body["signer_name"].as_str().is_some_and(|n| !n.is_empty()));
    assert!(body["facility"].as_str().is_some_and(|n| !n.is_empty()));

    assert_eq!(
        keys(&body),
        CHECKED_KEYS.iter().copied().collect(),
        "the page answers these keys and no others"
    );
    // The patient the helper registers is "Qrtestpatient Verifyonly", phone 9990003003.
    // The name is deliberately unlike any seeded staff name: CI seeds a "Dr. Asha Rao".
    for leaked in ["Qrtestpatient", "Verifyonly", "9990003003", "uhid", "patient", "diagnos"] {
        assert!(!text.contains(leaked), "{leaked} must not appear: {text}");
    }
}

#[tokio::test]
async fn one_changed_field_shows_changed() {
    let app = common::spawn_app_as_request_role().await;
    let (record_id, _, token) = signed_prescription(&app).await;

    sqlx::query("UPDATE prescriptions SET notes = 'altered after signing' WHERE id = $1::uuid")
        .bind(&record_id)
        .execute(&app.db)
        .await
        .expect("alter the record");

    let (status, text) = check(&app, &token).await;
    assert_eq!(status, StatusCode::OK, "{text}");
    let body: Value = serde_json::from_str(&text).expect("json");
    assert_eq!(body["status"], "changed", "{body}");
    assert_eq!(body["unchanged"], false);
}

#[tokio::test]
async fn a_revoked_key_still_verifies_what_it_signed_and_says_revoked() {
    let app = common::spawn_app_as_request_role().await;
    let (_, _, token) = signed_prescription(&app).await;
    sqlx::query(
        "UPDATE doctor_signature_credentials SET revoked_at = now(), revoked_reason = 'badge lost' \
         WHERE id = (SELECT signer_credential_id FROM signed_records sr \
                       JOIN signature_verify_links l ON l.signed_record_id = sr.id \
                      WHERE l.token = $1)",
    )
    .bind(&token)
    .execute(&app.db)
    .await
    .expect("revoke the key");

    let (_, text) = check(&app, &token).await;
    let body: Value = serde_json::from_str(&text).expect("json");
    assert_eq!(body["status"], "unchanged", "{body}");
    assert_eq!(body["key_status"], "revoked");
    assert!(body["key_revoked_on"].is_string(), "{body}");
}

#[tokio::test]
async fn a_withdrawn_link_says_so_and_nothing_else() {
    let app = common::spawn_app_as_request_role().await;
    let (_, signed_record_id, token) = signed_prescription(&app).await;
    let csrf = app.login_admin().await;

    let revoked = app
        .client
        .post(app.url(&format!(
            "/api/signatures/{signed_record_id}/verify-link/revoke"
        )))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "copy reported stolen" }))
        .send()
        .await
        .expect("revoke");
    assert_eq!(revoked.status(), StatusCode::OK);

    let (status, text) = check(&app, &token).await;
    assert_eq!(status, StatusCode::OK, "{text}");
    let body: Value = serde_json::from_str(&text).expect("json");
    assert_eq!(body["status"], "withdrawn", "{body}");
    assert_eq!(keys(&body), BTreeSet::from(["status", "withdrawn_on"]));

    // Issuing again mints a fresh link; the withdrawn one stays withdrawn.
    let issued = app
        .client
        .post(app.url(&format!("/api/signatures/{signed_record_id}/verify-link")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("issue");
    assert_eq!(issued.status(), StatusCode::OK);
    let fresh: Value = issued.json().await.expect("issue json");
    assert_ne!(fresh["token"], token);
    let (_, again) = check(&app, &token).await;
    assert!(again.contains("withdrawn"), "{again}");
}

#[tokio::test]
async fn a_random_token_answers_exactly_like_a_missing_one() {
    let app = common::spawn_app_as_request_role().await;
    let random = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    assert_eq!(random.len(), 64, "the shape of a real token");

    let guessed = check(&app, &random).await;
    let missing = check(&app, "not-a-token").await;
    assert_eq!(guessed.0, StatusCode::NOT_FOUND);
    assert_eq!(
        guessed, missing,
        "a well-formed guess must not be told apart from nonsense"
    );
}

#[tokio::test]
async fn a_signature_from_before_online_checks_is_never_called_changed() {
    let app = common::spawn_app_as_request_role().await;
    let (record_id, signed_record_id, token) = signed_prescription(&app).await;
    // Made the way signatures were before schema v2, then the record moves on.
    sqlx::query(
        "UPDATE signed_records SET payload_snapshot = jsonb_set(payload_snapshot, '{schema}', \
         '\"medbrains.signable.prescription.v1\"') WHERE id = $1::uuid",
    )
    .bind(&signed_record_id)
    .execute(&app.db)
    .await
    .expect("age the signature");
    sqlx::query("UPDATE prescriptions SET notes = 'moved on' WHERE id = $1::uuid")
        .bind(&record_id)
        .execute(&app.db)
        .await
        .expect("alter the record");

    let (status, text) = check(&app, &token).await;
    assert_eq!(status, StatusCode::OK, "{text}");
    let body: Value = serde_json::from_str(&text).expect("json");
    assert_eq!(body["status"], "signed_before_checks", "{body}");
    assert!(
        body["unchanged"].is_null(),
        "neither changed nor unchanged: {body}"
    );
    assert_eq!(body["signature_intact"], true, "the stored hash still verifies: {body}");
    assert_eq!(body["key_status"], "active");
    assert!(body["signer_name"].as_str().is_some_and(|n| !n.is_empty()));
    assert_eq!(keys(&body), CHECKED_KEYS.iter().copied().collect());
}

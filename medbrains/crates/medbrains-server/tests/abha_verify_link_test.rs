//! An ABHA counts as verified only through a server-side verification record
//! for the same number, made by the same member of staff, used once.
//!
//! The ABDM calls themselves need live sandbox keys; these tests start from a
//! verification row as the OTP step leaves it.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

fn abha_digits() -> String {
    let n = Uuid::new_v4().as_u128() % 1_000_000_000_000;
    format!("91{n:012}")
}

/// A verification as `POST …/otp` leaves it, owned by the admin.
async fn verified(app: &common::TestApp, abha: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO abha_verifications \
           (tenant_id, created_by, method, otp_system, environment, login_id_cipher, abdm_txn_id, \
            stage, abha_number, profile, verified_at, expires_at) \
         SELECT tenant_id, id, 'abha_number', 'aadhaar', 'sandbox', 'cipher', 'txn', \
                'verified', $1, $2, now(), now() + interval '30 minutes' \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(abha)
    .bind(json!({
        "abha_number": abha, "kyc_verified": true, "first_name": "Priya",
        "middle_name": "S", "last_name": "Varude", "date_of_birth": "1989-11-26", "gender": "female"
    }))
    .fetch_one(&app.db)
    .await
    .expect("verification row")
}

async fn register(
    app: &common::TestApp,
    csrf: &str,
    abha: Option<&str>,
    verification: Option<Uuid>,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "first_name": "Priya", "last_name": "Varude", "gender": "female",
            "date_of_birth": "1989-11-26",
            "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "abha_number": abha, "abha_verification_id": verification,
        }))
        .send()
        .await
        .expect("register");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn link_row(app: &common::TestApp, patient: &str) -> (bool, Option<String>, bool) {
    sqlx::query_as(
        "SELECT kyc_verified, verification_method, verified_by IS NOT NULL \
         FROM patient_abha_links WHERE patient_id = $1::uuid AND deleted_at IS NULL",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("link row")
}

/// Given a verified ABHA, When the patient is registered with it, Then the
/// link is saved verified with who and how — and the same verification
/// cannot verify a second registration.
#[tokio::test]
async fn a_registration_with_its_verification_is_linked_verified_once() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let abha = abha_digits();
    let verification = verified(&app, &abha).await;

    let (status, patient) = register(&app, &csrf, Some(&abha), Some(verification)).await;
    assert!(status.is_success(), "{patient}");
    let id = patient["id"].as_str().expect("id");
    assert_eq!(
        link_row(&app, id).await,
        (true, Some("abha_aadhaar_otp".to_owned()), true)
    );

    let (again, _) = register(&app, &csrf, Some(&abha), Some(verification)).await;
    assert_eq!(again, StatusCode::BAD_REQUEST, "a verification is used once");
}

/// A typed ABHA number without a verification is kept, but unverified; and a
/// verification for another number cannot vouch for it.
#[tokio::test]
async fn a_typed_or_mismatched_abha_stays_unverified() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let typed = abha_digits();
    let (status, patient) = register(&app, &csrf, Some(&typed), None).await;
    assert!(status.is_success(), "{patient}");
    assert_eq!(link_row(&app, patient["id"].as_str().expect("id")).await, (false, None, false));

    let other = verified(&app, &abha_digits()).await;
    let (mismatch, _) = register(&app, &csrf, Some(&abha_digits()), Some(other)).await;
    assert_eq!(mismatch, StatusCode::BAD_REQUEST, "the verified number must be the one submitted");
}

/// Given an existing patient, When staff link a verified ABHA and choose to
/// take ABHA's name and gender, Then those change and the date of birth they
/// did not choose stays; linking the same ABHA to another patient is refused.
#[tokio::test]
async fn linking_an_existing_patient_applies_only_the_chosen_details() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (_, patient) = register(&app, &csrf, None, None).await;
    let id = patient["id"].as_str().expect("id").to_owned();
    sqlx::query(
        "UPDATE patients SET first_name = 'Priyanka', gender = 'other', \
           date_of_birth = '1990-01-01' WHERE id = $1::uuid",
    )
    .bind(&id)
    .execute(&app.db)
    .await
    .expect("seed differing details");

    let abha = abha_digits();
    let verification = verified(&app, &abha).await;
    let resp = app
        .client
        .post(app.url(&format!("/api/abdm/abha/verifications/{verification}/link")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": id, "apply": ["name", "gender"] }))
        .send()
        .await
        .expect("link");
    assert_eq!(resp.status(), StatusCode::OK);

    let (first, gender, dob): (String, String, String) = sqlx::query_as(
        "SELECT first_name, gender::text, date_of_birth::text FROM patients WHERE id = $1::uuid",
    )
    .bind(&id)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    assert_eq!((first.as_str(), gender.as_str()), ("Priya", "female"));
    assert_eq!(dob, "1990-01-01", "a detail staff did not choose is left alone");

    let (_, second) = register(&app, &csrf, None, None).await;
    let again = verified(&app, &abha).await;
    let resp = app
        .client
        .post(app.url(&format!("/api/abdm/abha/verifications/{again}/link")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": second["id"], "apply": [] }))
        .send()
        .await
        .expect("second link");
    assert_eq!(resp.status(), StatusCode::CONFLICT, "one ABHA, one patient");
}

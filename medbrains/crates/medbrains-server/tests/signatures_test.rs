//! Integration tests for digital signature endpoints + signing module.
//! Per RFCs/sprints/SPRINT-doctor-activities.md §7.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;

use medbrains_server::signing;

// ──────────────────────────────────────────────────────────
//  Pure unit tests on the signing module (no HTTP server)
// ──────────────────────────────────────────────────────────

#[test]
fn test_canonicalization_is_deterministic() {
    let a = json!({ "z": 1, "a": 2, "m": { "y": 3, "x": 4 } });
    let b = json!({ "a": 2, "m": { "x": 4, "y": 3 }, "z": 1 });
    let ca = signing::canonicalize(&a).unwrap();
    let cb = signing::canonicalize(&b).unwrap();
    assert_eq!(ca, cb, "same logical payload must produce identical bytes");
}

#[test]
fn test_payload_hash_stable() {
    let p = json!({ "patient_id": "abc", "drug": "metformin" });
    let canonical = signing::canonicalize(&p).unwrap();
    let h1 = signing::payload_hash(&canonical);
    let h2 = signing::payload_hash(&canonical);
    assert_eq!(h1, h2, "hash must be stable");
    assert_eq!(h1.len(), 32, "SHA-256 must be 32 bytes");
}

#[test]
fn test_sign_and_verify_round_trip() {
    let (priv_key, pub_key) = signing::generate_keypair().unwrap();
    let payload = json!({ "record_type": "prescription", "drug": "amoxicillin", "dose": "500mg" });
    let signed = signing::sign_payload(&priv_key, &payload).unwrap();
    signing::verify(&pub_key, &signed.hash, &signed.signature).expect("verify must succeed");
}

#[test]
fn test_signature_fails_on_tampered_payload() {
    let (priv_key, pub_key) = signing::generate_keypair().unwrap();
    let original = json!({ "patient": "X", "amount": 1000 });
    let signed = signing::sign_payload(&priv_key, &original).unwrap();

    let tampered = json!({ "patient": "X", "amount": 9999 });
    let tampered_canonical = signing::canonicalize(&tampered).unwrap();
    let tampered_hash = signing::payload_hash(&tampered_canonical);

    assert!(
        signing::verify(&pub_key, &tampered_hash, &signed.signature).is_err(),
        "tampered payload must fail verification"
    );
}

#[test]
fn test_signature_fails_with_wrong_public_key() {
    let (priv_key1, _) = signing::generate_keypair().unwrap();
    let (_, pub_key2) = signing::generate_keypair().unwrap();
    let payload = json!({ "x": 1 });
    let signed = signing::sign_payload(&priv_key1, &payload).unwrap();

    assert!(
        signing::verify(&pub_key2, &signed.hash, &signed.signature).is_err(),
        "different keypair must fail verification"
    );
}

// ──────────────────────────────────────────────────────────
//  HTTP integration tests — require running Postgres
// ──────────────────────────────────────────────────────────

/// Helper: login as admin and get the admin user_id from /api/auth/me.
async fn admin_user_id(app: &common::TestApp, _csrf: &str) -> String {
    let resp = app
        .client
        .get(app.url("/api/auth/me"))
        .send()
        .await
        .expect("me request");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: serde_json::Value = resp.json().await.expect("me json");
    // MeResponse #[serde(flatten)] user — fields are at the top level.
    body["id"].as_str().unwrap_or("").to_owned()
}

/// Helper: issue a default Ed25519 credential for the given user via admin
/// endpoint. Returns the credential id.
async fn issue_default_credential(
    app: &common::TestApp,
    csrf: &str,
    doctor_user_id: &str,
) -> String {
    let resp = app
        .client
        .post(app.url("/api/admin/signature-credentials"))
        .header("X-CSRF-Token", csrf)
        .json(&json!({
            "doctor_user_id": doctor_user_id,
            "make_default": true,
        }))
        .send()
        .await
        .expect("issue cred");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "credential issue must succeed"
    );
    let body: serde_json::Value = resp.json().await.expect("cred json");
    body["credential"]["id"].as_str().unwrap_or("").to_owned()
}

/// Helper: a prescription written by `doctor_user_id`. The server signs the
/// record it reads, not a payload the client sends, so a signature needs a
/// real record, and a primary signature one this doctor wrote.
async fn doctor_prescription(app: &common::TestApp, doctor_user_id: &str) -> String {
    let doctor_id = uuid::Uuid::parse_str(doctor_user_id).expect("admin id");
    let tenant_id: uuid::Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE id = $1")
        .bind(doctor_id)
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let uhid = format!("SIG{}", &uuid::Uuid::new_v4().simple().to_string()[..10]);
    let patient_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Asha', 'Signer', 'female', '9990003003') RETURNING id",
    )
    .bind(tenant_id)
    .bind(&uhid)
    .fetch_one(&app.db)
    .await
    .expect("insert patient");
    let encounter_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, doctor_id) \
         VALUES ($1, $2, 'opd'::encounter_type, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(doctor_id)
    .fetch_one(&app.db)
    .await
    .expect("insert encounter");
    let prescription_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(doctor_id)
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("insert prescription");
    prescription_id.to_string()
}

// Note: a "sign without any credential returns 400" test is omitted
// because the dev-DB is persistent across test runs and unrelated tests
// create credentials for the admin user. The error path itself is
// exercised at the type level — see `signing::sign_payload` errors and
// the `cred_row.ok_or_else` branch in routes/signatures.rs.

#[tokio::test]
async fn test_sign_with_credential_succeeds() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin_id = admin_user_id(&app, &csrf).await;
    let _cred_id = issue_default_credential(&app, &csrf, &admin_id).await;

    let record_id = doctor_prescription(&app, &admin_id).await;
    let resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": record_id,
            "payload": { "drug": "metformin", "dose": "500mg" },
            "signer_role": "primary",
            "legal_class": "clinical",
        }))
        .send()
        .await
        .expect("sign request");

    assert_eq!(resp.status(), StatusCode::OK);
    let body: serde_json::Value = resp.json().await.expect("sign json");
    assert!(body["signed_record"]["id"].is_string());
    assert!(body["payload_hash_hex"].is_string());
    assert!(body["signature_hex"].is_string());
    assert_eq!(body["signed_record"]["record_type"], "prescription");
    assert_eq!(body["signed_record"]["legal_class"], "clinical");
    assert_eq!(body["signed_record"]["signer_role"], "primary");
}

#[tokio::test]
async fn test_verify_endpoint_round_trip() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin_id = admin_user_id(&app, &csrf).await;
    issue_default_credential(&app, &csrf, &admin_id).await;

    let record_id = doctor_prescription(&app, &admin_id).await;

    // Sign
    let sign_resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": record_id,
        }))
        .send()
        .await
        .expect("sign");
    assert_eq!(sign_resp.status(), StatusCode::OK);
    let sign_body: serde_json::Value = sign_resp.json().await.unwrap();
    let signed_record_id = sign_body["signed_record"]["id"].as_str().unwrap();

    // Verify against the payload the server signed → success
    let v_resp = app
        .client
        .post(app.url("/api/signatures/verify"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "signed_record_id": signed_record_id }))
        .send()
        .await
        .expect("verify");
    assert_eq!(v_resp.status(), StatusCode::OK);
    let v_body: serde_json::Value = v_resp.json().await.unwrap();
    assert_eq!(v_body["verified"], true, "verify must succeed");
    assert_eq!(v_body["credential_revoked"], false);
    assert_eq!(
        v_body["recomputed_hash_hex"], v_body["stored_hash_hex"],
        "hashes must match"
    );

    // Verify with TAMPERED payload → fail
    let tampered = json!({ "record_type": "prescription", "notes": "dose changed after signing" });
    let t_resp = app
        .client
        .post(app.url("/api/signatures/verify"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "signed_record_id": signed_record_id,
            "payload": tampered,
        }))
        .send()
        .await
        .expect("verify tampered");
    assert_eq!(t_resp.status(), StatusCode::OK);
    let t_body: serde_json::Value = t_resp.json().await.unwrap();
    assert_eq!(t_body["verified"], false, "tampered must fail");
    assert_ne!(
        t_body["recomputed_hash_hex"], t_body["stored_hash_hex"],
        "hashes must differ"
    );
}

#[tokio::test]
async fn test_revoked_credential_cannot_sign() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin_id = admin_user_id(&app, &csrf).await;
    let cred_id = issue_default_credential(&app, &csrf, &admin_id).await;

    // Revoke the credential
    let r_resp = app
        .client
        .post(app.url(&format!(
            "/api/admin/signature-credentials/{cred_id}/revoke"
        )))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "compromised" }))
        .send()
        .await
        .expect("revoke");
    assert_eq!(r_resp.status(), StatusCode::OK);

    // Attempt sign with the now-revoked default → 400
    let sign_resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": doctor_prescription(&app, &admin_id).await,
        }))
        .send()
        .await
        .expect("sign-after-revoke");
    assert_eq!(
        sign_resp.status(),
        StatusCode::BAD_REQUEST,
        "sign with revoked credential must fail"
    );
}

#[tokio::test]
async fn test_co_signer_creates_separate_row() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin_id = admin_user_id(&app, &csrf).await;
    issue_default_credential(&app, &csrf, &admin_id).await;

    let record_id = doctor_prescription(&app, &admin_id).await;

    // Primary sign
    let p_resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": record_id,
            "signer_role": "primary",
        }))
        .send()
        .await
        .expect("primary sign");
    assert_eq!(p_resp.status(), StatusCode::OK);

    // Co-signer (same admin in this test — verifies multi-row handling
    // even if same user; in real flow it'd be a different user)
    let c_resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": record_id,
            "signer_role": "co_signer",
        }))
        .send()
        .await
        .expect("co-sign");
    assert_eq!(c_resp.status(), StatusCode::OK);

    // List signatures for the record — must be 2 rows in chronological order
    let list_resp = app
        .client
        .get(app.url(&format!(
            "/api/signatures/list?record_type=prescription&record_id={record_id}"
        )))
        .send()
        .await
        .expect("list sigs");
    assert_eq!(list_resp.status(), StatusCode::OK);
    let list_body: serde_json::Value = list_resp.json().await.unwrap();
    let arr = list_body.as_array().expect("array");
    assert_eq!(arr.len(), 2, "must have 2 signed_records rows");

    let roles: Vec<&str> = arr
        .iter()
        .map(|r| r["signer_role"].as_str().unwrap())
        .collect();
    assert!(roles.contains(&"primary"));
    assert!(roles.contains(&"co_signer"));
}

#[tokio::test]
async fn test_sign_invalid_role_rejected() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin_id = admin_user_id(&app, &csrf).await;
    issue_default_credential(&app, &csrf, &admin_id).await;

    let resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": uuid::Uuid::new_v4().to_string(),
            "payload": { "x": 1 },
            "signer_role": "INVALID_ROLE",
        }))
        .send()
        .await
        .expect("sign invalid role");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_sign_invalid_legal_class_rejected() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin_id = admin_user_id(&app, &csrf).await;
    issue_default_credential(&app, &csrf, &admin_id).await;

    let resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "record_type": "prescription",
            "record_id": uuid::Uuid::new_v4().to_string(),
            "payload": { "x": 1 },
            "legal_class": "totally_made_up_class",
        }))
        .send()
        .await
        .expect("sign invalid class");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

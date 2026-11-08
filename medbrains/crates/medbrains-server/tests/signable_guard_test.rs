//! A signature always covers what the record says now, is made by the
//! record's author after reviewing it, and only by someone who may see the
//! patient (migration 1418 and `medbrains-documents/src/signable.rs`).
//!
//! Scenarios:
//! - changing only the drugs of a signed prescription takes its signature
//!   off and is audited; the doctor signs again;
//! - an injury added under a signed MLC takes the signature off; under a
//!   closed case it is refused (MB409) except on the amendment path, which
//!   also lets the closed case itself change; reopening a closed case or a
//!   void certificate is refused;
//! - soft-deleting a signed record takes the signature off, a final one
//!   refuses;
//! - no review, a stale review or a review of other content: 409;
//! - a co-author column (`registered_by`) does not sign as primary, but
//!   co-signs with the co-sign right;
//! - a signer who may not see the patient is refused; a witness needs a
//!   signing right.

use crate::signable_types_test::{
    admin_signer, attend, audits, certificate, is_signed, keyed_staff, patient_visit, post,
    review_and_sign,
};
use crate::{common, signatures_test};

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// The SQLSTATE `sql` fails with on the owner connection, if it fails.
async fn sqlstate(app: &common::TestApp, sql: &str, id: Uuid) -> Option<String> {
    sqlx::query(sql)
        .bind(id)
        .execute(&app.db)
        .await
        .err()
        .and_then(|e| e.as_database_error().and_then(|d| d.code().map(|c| c.into_owned())))
}

/// A prescription by the admin with one drug; (prescription, item).
async fn prescription(app: &common::TestApp, admin: Uuid, tenant: Uuid) -> (Uuid, Uuid) {
    let rx: Uuid = signatures_test::doctor_prescription(app, &admin.to_string())
        .await
        .parse()
        .expect("rx id");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, frequency, \
            duration, route, quantity) \
         VALUES ($1, $2, 'Amoxicillin 500mg', '1 cap', 'TID', '5 days', 'oral', 15) RETURNING id",
    )
    .bind(tenant)
    .bind(rx)
    .fetch_one(&app.db)
    .await
    .expect("item");
    (rx, item)
}

/// An MLC examined by `examiner` and registered by `registrar`.
async fn mlc_case(app: &common::TestApp, tenant: Uuid, examiner: Uuid, registrar: Uuid) -> Uuid {
    let (patient, _, _) = patient_visit(app, tenant, examiner).await;
    attend(app, tenant, patient, registrar).await;
    sqlx::query_scalar(
        "INSERT INTO mlc_cases (tenant_id, patient_id, mlc_number, examining_doctor_id, \
            registered_by, examination_findings) \
         VALUES ($1, $2, $3, $4, $5, 'Abrasion right knee') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(format!("MLC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(examiner)
    .bind(registrar)
    .fetch_one(&app.db)
    .await
    .expect("mlc case")
}

/// Add injury number `n` to `case` on the owner connection.
fn add_injury(n: i32) -> String {
    format!(
        "INSERT INTO mlc_injuries (tenant_id, mlc_case_id, injury_number, injury_type, location, description) \
         SELECT tenant_id, id, {n}, 'abrasion', 'right knee', 'Graze' FROM mlc_cases WHERE id = $1"
    )
}

#[tokio::test]
async fn changing_only_the_drugs_of_a_signed_prescription_takes_the_signature_off() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let (rx, item) = prescription(&app, admin, tenant).await;
    assert_eq!(review_and_sign(&app.client, &app, &csrf, "prescription", rx).await.0, StatusCode::OK);

    sqlx::query("UPDATE prescription_items SET drug_name = 'Tramadol 50mg' WHERE id = $1")
        .bind(item)
        .execute(&app.db)
        .await
        .expect("change the drug");
    assert!(!is_signed(&app, "prescriptions", rx).await, "a changed drug is not what was signed");
    assert_eq!(audits(&app, "prescription.signature_cleared", rx).await, 1);

    let (status, body) = review_and_sign(&app.client, &app, &csrf, "prescription", rx).await;
    assert_eq!(status, StatusCode::OK, "the doctor signs the corrected prescription: {body}");

    // Removing a drug (a soft delete) takes it off again.
    sqlx::query("DELETE FROM prescription_items WHERE id = $1")
        .bind(item)
        .execute(&app.db)
        .await
        .expect("remove the drug");
    assert!(!is_signed(&app, "prescriptions", rx).await);
    assert_eq!(audits(&app, "prescription.signature_cleared", rx).await, 2);
}

#[tokio::test]
async fn an_injury_clears_a_signed_case_and_a_closed_case_changes_only_by_amendment() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let case = mlc_case(&app, tenant, admin, admin).await;
    assert_eq!(review_and_sign(&app.client, &app, &csrf, "mlc_report", case).await.0, StatusCode::OK);
    assert_eq!(sqlstate(&app, &add_injury(1), case).await, None);
    assert!(!is_signed(&app, "mlc_cases", case).await, "a new injury is not on the signed report");
    assert_eq!(audits(&app, "mlc_report.signature_cleared", case).await, 1);

    sqlx::query("UPDATE mlc_cases SET status = 'closed'::mlc_status WHERE id = $1")
        .bind(case)
        .execute(&app.db)
        .await
        .expect("closing is allowed");
    assert_eq!(sqlstate(&app, &add_injury(2), case).await.as_deref(), Some("MB409"));
    let reopen = "UPDATE mlc_cases SET status = 'court_pending'::mlc_status WHERE id = $1";
    assert_eq!(sqlstate(&app, reopen, case).await.as_deref(), Some("MB409"), "no reopening");

    // The amendment path (its reason is in the hash-chained audit log).
    let mut tx = app.db.begin().await.expect("tx");
    sqlx::query("SET LOCAL medbrains.signable_amendment = 'on'")
        .execute(&mut *tx)
        .await
        .expect("amendment flag");
    sqlx::query(&add_injury(2))
        .bind(case)
        .execute(&mut *tx)
        .await
        .expect("an amendment adds the injury");
    sqlx::query("UPDATE mlc_cases SET opinion = 'Grievous, on review' WHERE id = $1")
        .bind(case)
        .execute(&mut *tx)
        .await
        .expect("an amendment changes the closed report");
    tx.commit().await.expect("commit");
    let after = "UPDATE mlc_cases SET opinion = 'Again' WHERE id = $1";
    assert_eq!(sqlstate(&app, after, case).await.as_deref(), Some("MB409"), "the flag ends with its transaction");
}

#[tokio::test]
async fn a_soft_delete_clears_a_signature_and_a_final_record_refuses_reopening_or_deletion() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let cert = certificate(&app, tenant, admin).await;
    assert_eq!(review_and_sign(&app.client, &app, &csrf, "medical_certificate", cert).await.0, StatusCode::OK);
    assert_eq!(sqlstate(&app, "DELETE FROM medical_certificates WHERE id = $1", cert).await, None);
    assert!(!is_signed(&app, "medical_certificates", cert).await);
    assert_eq!(audits(&app, "medical_certificate.signature_cleared", cert).await, 1);

    let void = certificate(&app, tenant, admin).await;
    sqlx::query("UPDATE medical_certificates SET is_void = true WHERE id = $1")
        .bind(void)
        .execute(&app.db)
        .await
        .expect("voiding is allowed");
    let unvoid = "UPDATE medical_certificates SET is_void = false WHERE id = $1";
    assert_eq!(sqlstate(&app, unvoid, void).await.as_deref(), Some("MB409"));
    let delete = "DELETE FROM medical_certificates WHERE id = $1";
    assert_eq!(sqlstate(&app, delete, void).await.as_deref(), Some("MB409"));
}

#[tokio::test]
async fn signing_needs_a_fresh_review_of_the_same_content() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let cert = certificate(&app, tenant, admin).await;
    let target = json!({ "record_type": "medical_certificate", "record_id": cert });
    let sign = || post(&app.client, &app, &csrf, "/api/signatures/sign", target.clone());

    let (status, body) = sign().await;
    assert_eq!(status, StatusCode::CONFLICT, "no review: {body}");
    assert!(body.to_string().contains("review it before signing"), "{body}");

    post(&app.client, &app, &csrf, "/api/signatures/review", target.clone()).await;
    sqlx::query("UPDATE medical_certificates SET remarks = 'Changed after review' WHERE id = $1")
        .bind(cert)
        .execute(&app.db)
        .await
        .expect("edit");
    assert_eq!(sign().await.0, StatusCode::CONFLICT, "the review was of other content");

    post(&app.client, &app, &csrf, "/api/signatures/review", target.clone()).await;
    sqlx::query(
        "UPDATE signature_reviews SET reviewed_at = now() - interval '31 minutes' WHERE record_id = $1",
    )
    .bind(cert)
    .execute(&app.db)
    .await
    .expect("age the review");
    assert_eq!(sign().await.0, StatusCode::CONFLICT, "a review older than 30 minutes");

    post(&app.client, &app, &csrf, "/api/signatures/review", target.clone()).await;
    let (status, body) = sign().await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

#[tokio::test]
async fn only_the_author_column_signs_as_primary_and_others_co_sign() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let registrar = common::provision_staff_with(
        &app,
        &csrf,
        "doctor",
        &[medbrains_core::permissions::doctor::signature::CO_SIGN],
        &[],
    )
    .await;
    signatures_test::issue_default_credential(&app, &csrf, &registrar.user_id.to_string()).await;
    app.step_up(&registrar.client, &registrar.csrf, &registrar.password).await;
    let case = mlc_case(&app, tenant, admin, registrar.user_id).await;

    let (status, _) =
        review_and_sign(&registrar.client, &app, &registrar.csrf, "mlc_report", case).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "registered_by is not the examining doctor");

    let co_sign = json!({ "record_type": "mlc_report", "record_id": case, "signer_role": "co_signer" });
    let (status, _) =
        post(&registrar.client, &app, &registrar.csrf, "/api/signatures/review", co_sign.clone()).await;
    assert_eq!(status, StatusCode::OK);
    let (status, body) =
        post(&registrar.client, &app, &registrar.csrf, "/api/signatures/sign", co_sign).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["signed_record"]["signer_role"], json!("co_signer"));
}

#[tokio::test]
async fn every_signer_must_see_the_patient_and_a_witness_needs_a_signing_right() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let doctor = keyed_staff(&app, &csrf, "doctor").await;
    signatures_test::register_doctor(&app, &doctor.user_id.to_string()).await;
    let (patient, encounter, _) = patient_visit(&app, tenant, admin).await;
    let cert: Uuid = sqlx::query_scalar(
        "INSERT INTO medical_certificates (tenant_id, patient_id, encounter_id, doctor_id, \
            certificate_type, diagnosis) VALUES ($1, $2, $3, $4, 'fitness', 'Fit') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(encounter)
    .bind(doctor.user_id)
    .fetch_one(&app.db)
    .await
    .expect("certificate");
    let (status, _) =
        review_and_sign(&doctor.client, &app, &doctor.csrf, "medical_certificate", cert).await;
    assert!(
        matches!(status, StatusCode::NOT_FOUND | StatusCode::FORBIDDEN),
        "the author who may not see the patient does not sign: {status}"
    );
    attend(&app, tenant, patient, doctor.user_id).await;
    let (status, _) =
        review_and_sign(&doctor.client, &app, &doctor.csrf, "medical_certificate", cert).await;
    assert_eq!(status, StatusCode::OK, "with access, the author signs");

    let clerk = keyed_staff(&app, &csrf, "receptionist").await;
    attend(&app, tenant, patient, clerk.user_id).await;
    let witness = json!({ "record_type": "medical_certificate", "record_id": cert, "signer_role": "witness" });
    let (status, _) = post(&clerk.client, &app, &clerk.csrf, "/api/signatures/review", witness).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "a witness needs a signing right");
}

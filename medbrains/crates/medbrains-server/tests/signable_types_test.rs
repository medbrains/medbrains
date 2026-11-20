//! Every clinical record type is signable, by the right person, and a signed
//! record cannot change under its signature.
//!
//! Scenarios (RFC-MODULE-paperless-records, "signable types"):
//! - every listed type reads the live schema (an unknown id answers 404, not
//!   a broken query);
//! - a doctor's certificate: reviewed then signed; each signed field shows
//!   "changed" on the public check; an edit takes the signature off and is
//!   audited; a voided certificate refuses edits (MB409, answered 409);
//!   a doctor with no registration, without the certificate licence, or not
//!   the author is refused; no step-up is refused;
//! - a nurse's vitals entry: signed by its nurse with a licence on her
//!   profile; a nurse without one is refused; a nurse cannot sign a doctor's
//!   certificate; the early-warning score written after signing does not take
//!   the signature off, an unsigned edit writes no audit row;
//! - an MLC report: an injury changed after signing reads as changed; a
//!   closed case refuses edits; a doctor not allowed to sign MLCs is refused.

use crate::{common, signature_payload_test, signatures_test};
use medbrains_documents::signable::SIGNABLE;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// The admin: stepped up, keyed and registered as a doctor.
pub(crate) async fn admin_signer(app: &common::TestApp) -> (String, Uuid, Uuid) {
    let csrf = signatures_test::signer_session(app).await;
    let admin = signatures_test::admin_user_id(app, &csrf).await;
    signatures_test::issue_default_credential(app, &csrf, &admin).await;
    let admin: Uuid = admin.parse().expect("admin id");
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE id = $1")
        .bind(admin)
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    (csrf, admin, tenant)
}

/// POST `path` as `client`; the status and the JSON body.
pub(crate) async fn post(
    client: &Client,
    app: &common::TestApp,
    csrf: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Review then sign `record_id` as `client`; the sign status and body.
pub(crate) async fn review_and_sign(
    client: &Client,
    app: &common::TestApp,
    csrf: &str,
    record_type: &str,
    record_id: Uuid,
) -> (StatusCode, Value) {
    let target = json!({ "record_type": record_type, "record_id": record_id });
    let (status, _) = post(client, app, csrf, "/api/signatures/review", target.clone()).await;
    if status != StatusCode::OK {
        return (status, Value::Null);
    }
    post(client, app, csrf, "/api/signatures/sign", target).await
}

/// The public check token of a signature.
pub(crate) async fn token_of(app: &common::TestApp, signed: &Value) -> String {
    sqlx::query_scalar(
        "SELECT token FROM signature_verify_links WHERE signed_record_id = $1::uuid AND revoked_at IS NULL",
    )
    .bind(signed["signed_record"]["id"].as_str().unwrap_or_default())
    .fetch_one(&app.db)
    .await
    .expect("link")
}

/// Make `user` the patient's attending clinician, so they may see the record.
pub(crate) async fn attend(app: &common::TestApp, tenant: Uuid, patient: Uuid, user: Uuid) {
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'attending_physician', 'user', $3::text, $3) \
         ON CONFLICT DO NOTHING",
    )
    .bind(tenant)
    .bind(patient)
    .bind(user)
    .execute(&app.db)
    .await
    .expect("attending tuple");
}

/// A patient with an OPD visit by `doctor`, who attends them;
/// (patient, encounter, department).
pub(crate) async fn patient_visit(
    app: &common::TestApp,
    tenant: Uuid,
    doctor: Uuid,
) -> (Uuid, Uuid, Uuid) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("department");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Signable', 'Record', 'female', '9990006006') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SGT{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id, doctor_id) \
         VALUES ($1, $2, 'opd'::encounter_type, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(dept)
    .bind(doctor)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    attend(app, tenant, patient, doctor).await;
    (patient, encounter, dept)
}

/// A fitness certificate written by `doctor`.
pub(crate) async fn certificate(app: &common::TestApp, tenant: Uuid, doctor: Uuid) -> Uuid {
    let (patient, encounter, _) = patient_visit(app, tenant, doctor).await;
    sqlx::query_scalar(
        "INSERT INTO medical_certificates (tenant_id, patient_id, encounter_id, doctor_id, \
            certificate_type, certificate_number, issued_date, valid_from, valid_to, diagnosis, remarks) \
         VALUES ($1, $2, $3, $4, 'fitness', $5, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 7, \
                 'Viral fever, recovered', 'Fit to resume work') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(encounter)
    .bind(doctor)
    .bind(format!("MC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("certificate")
}

/// The number of `action` audit rows on `entity`.
pub(crate) async fn audits(app: &common::TestApp, action: &str, entity: Uuid) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = $1 AND entity_id = $2")
        .bind(action)
        .bind(entity)
        .fetch_one(&app.db)
        .await
        .expect("audit count")
}

/// Whether `table` row `id` is flagged signed.
pub(crate) async fn is_signed(app: &common::TestApp, table: &str, id: Uuid) -> bool {
    sqlx::query_scalar(&format!("SELECT is_signed FROM {table} WHERE id = $1"))
        .bind(id)
        .fetch_one(&app.db)
        .await
        .expect("is_signed")
}

/// A staff member of `role`, stepped up, with a signing key.
pub(crate) async fn keyed_staff(
    app: &common::TestApp,
    admin_csrf: &str,
    role: &str,
) -> common::Staff {
    let staff = common::provision_staff(app, admin_csrf, role, &[]).await;
    signatures_test::issue_key(app, admin_csrf, &staff.user_id.to_string()).await;
    app.step_up(&staff.client, &staff.csrf, &staff.password)
        .await;
    staff
}

#[tokio::test]
async fn every_signable_type_reads_the_live_schema() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, _, tenant) = admin_signer(&app).await;
    let types: Vec<Value> = app
        .client
        .get(app.url("/api/signatures/types"))
        .send()
        .await
        .expect("types")
        .json()
        .await
        .expect("types json");
    let published: Vec<&str> = types
        .iter()
        .filter_map(|t| t["record_type"].as_str())
        .collect();
    let table: Vec<&str> = SIGNABLE.iter().map(|t| t.record_type).collect();
    assert_eq!(
        published, table,
        "the server publishes exactly the types it signs"
    );
    for t in &types {
        assert_eq!(
            t["step_up"],
            json!(true),
            "{t}: every signature needs a step-up"
        );
    }
    for t in SIGNABLE {
        // Every payload query runs against the migrated schema.
        let row = sqlx::query_scalar::<_, Value>(t.payload_sql)
            .bind(tenant)
            .bind(Uuid::new_v4())
            .fetch_optional(&app.db)
            .await
            .unwrap_or_else(|e| panic!("{}: {e}", t.record_type));
        assert!(row.is_none(), "{}", t.record_type);
        let (status, body) = post(
            &app.client,
            &app,
            &csrf,
            "/api/signatures/review",
            json!({ "record_type": t.record_type, "record_id": Uuid::new_v4() }),
        )
        .await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{}: {body}", t.record_type);
    }
    let (status, _) = post(
        &app.client,
        &app,
        &csrf,
        "/api/signatures/review",
        json!({ "record_type": "progress_note", "record_id": Uuid::new_v4() }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "notes sign through their own ledger"
    );
}

#[tokio::test]
async fn a_certificate_is_reviewed_signed_and_every_field_counts() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let cert = certificate(&app, tenant, admin).await;
    let (status, signed) =
        review_and_sign(&app.client, &app, &csrf, "medical_certificate", cert).await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    assert!(
        signed["signed_record"]["reviewed_at"].is_string(),
        "the review is on the signature"
    );
    assert_eq!(
        signed["signed_record"]["legal_class"],
        json!("medico_legal")
    );
    assert!(is_signed(&app, "medical_certificates", cert).await);
    let token = token_of(&app, &signed).await;
    signature_payload_test::each_field_counts(
        &app,
        &token,
        "medical_certificates",
        cert,
        &[
            ("diagnosis", "'Dengue'"),
            ("remarks", "'Unfit'"),
            ("valid_to", "valid_to + 3"),
            ("certificate_type", "'sick_leave'"),
        ],
    )
    .await;
}

#[tokio::test]
async fn editing_a_signed_certificate_takes_the_signature_off_and_a_void_one_refuses() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let cert = certificate(&app, tenant, admin).await;
    assert_eq!(
        review_and_sign(&app.client, &app, &csrf, "medical_certificate", cert)
            .await
            .0,
        StatusCode::OK
    );
    sqlx::query("UPDATE medical_certificates SET diagnosis = 'Corrected' WHERE id = $1")
        .bind(cert)
        .execute(&app.db)
        .await
        .expect("edit");
    assert!(
        !is_signed(&app, "medical_certificates", cert).await,
        "the edit takes the signature off"
    );
    assert_eq!(
        audits(&app, "medical_certificate.signature_cleared", cert).await,
        1
    );
    let (status, _) = review_and_sign(&app.client, &app, &csrf, "medical_certificate", cert).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the corrected certificate signs again"
    );
    let (status, _) = review_and_sign(&app.client, &app, &csrf, "medical_certificate", cert).await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a signed record is not signed twice by its author"
    );

    sqlx::query("UPDATE medical_certificates SET is_void = true, void_reason = 'issued in error' WHERE id = $1")
        .bind(cert)
        .execute(&app.db)
        .await
        .expect("void is not a content edit");
    let err = sqlx::query("UPDATE medical_certificates SET diagnosis = 'Again' WHERE id = $1")
        .bind(cert)
        .execute(&app.db)
        .await
        .err()
        .and_then(|e| {
            e.as_database_error()
                .and_then(|d| d.code().map(|c| c.into_owned()))
        });
    assert_eq!(
        err.as_deref(),
        Some("MB409"),
        "a voided certificate is final"
    );
}

#[tokio::test]
async fn only_a_registered_licensed_author_signs_a_certificate() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, _, tenant) = admin_signer(&app).await;
    let doctor = keyed_staff(&app, &csrf, "doctor").await;
    let cert = certificate(&app, tenant, doctor.user_id).await;

    // No registration on the profile: refused, before anything is shown.
    let (status, _) = review_and_sign(
        &doctor.client,
        &app,
        &doctor.csrf,
        "medical_certificate",
        cert,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "no registered profile");

    signatures_test::register_doctor(&app, &doctor.user_id.to_string()).await;
    sqlx::query(
        "UPDATE doctor_profiles SET can_sign_fitness_certificate = false WHERE user_id = $1",
    )
    .bind(doctor.user_id)
    .execute(&app.db)
    .await
    .expect("no licence");
    let (status, _) = review_and_sign(
        &doctor.client,
        &app,
        &doctor.csrf,
        "medical_certificate",
        cert,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "not allowed to sign certificates"
    );

    signatures_test::register_doctor(&app, &doctor.user_id.to_string()).await;
    let someone_elses = certificate(
        &app,
        tenant,
        Uuid::parse_str(&signatures_test::admin_user_id(&app, &csrf).await).expect("admin"),
    )
    .await;
    let (status, _) = review_and_sign(
        &doctor.client,
        &app,
        &doctor.csrf,
        "medical_certificate",
        someone_elses,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "not the author");

    let (status, body) = review_and_sign(
        &doctor.client,
        &app,
        &doctor.csrf,
        "medical_certificate",
        cert,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // A session without a fresh step-up does not sign.
    let unstepped = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    signatures_test::issue_default_credential(&app, &csrf, &unstepped.user_id.to_string()).await;
    let own = certificate(&app, tenant, unstepped.user_id).await;
    let (status, body) = post(
        &unstepped.client,
        &app,
        &unstepped.csrf,
        "/api/signatures/sign",
        json!({ "record_type": "medical_certificate", "record_id": own }),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], json!("step_up_required"), "{body}");
}

/// A vitals entry recorded by `nurse`.
pub(crate) async fn vitals_entry(
    app: &common::TestApp,
    tenant: Uuid,
    admin: Uuid,
    nurse: Uuid,
) -> Uuid {
    let (patient, encounter, _) = patient_visit(app, tenant, admin).await;
    attend(app, tenant, patient, nurse).await;
    sqlx::query_scalar(
        "INSERT INTO vitals (tenant_id, encounter_id, patient_id, recorded_by, temperature, pulse, \
            systolic_bp, diastolic_bp, respiratory_rate, spo2) \
         VALUES ($1, $2, $3, $4, 37.2, 88, 122, 78, 16, 98) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(nurse)
    .fetch_one(&app.db)
    .await
    .expect("vitals")
}

/// Give `nurse` a nurse profile, with `licence` when given.
pub(crate) async fn nurse_profile(app: &common::TestApp, nurse: Uuid, licence: Option<&str>) {
    sqlx::query(
        "WITH existing AS ( \
            UPDATE nurse_profiles SET license_number = $2 WHERE user_id = $1 RETURNING 1) \
         INSERT INTO nurse_profiles (tenant_id, user_id, license_number) \
         SELECT tenant_id, id, $2 FROM users \
          WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM existing)",
    )
    .bind(nurse)
    .bind(licence)
    .execute(&app.db)
    .await
    .expect("nurse profile");
}

#[tokio::test]
async fn a_nurse_signs_her_vitals_and_only_what_a_nurse_signs() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let nurse = keyed_staff(&app, &csrf, "nurse").await;
    nurse_profile(&app, nurse.user_id, Some("TNNC-12345")).await;
    let entry = vitals_entry(&app, tenant, admin, nurse.user_id).await;

    // An unsigned entry edits freely and writes no signature audit.
    sqlx::query("UPDATE vitals SET pulse = 90 WHERE id = $1")
        .bind(entry)
        .execute(&app.db)
        .await
        .expect("unsigned edit");
    assert_eq!(audits(&app, "vitals.signature_cleared", entry).await, 0);

    let (status, signed) = review_and_sign(&nurse.client, &app, &nurse.csrf, "vitals", entry).await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    let token = token_of(&app, &signed).await;

    // The early-warning score is computed after the entry: not what she signed.
    sqlx::query("UPDATE vitals SET ews_total = 3 WHERE id = $1")
        .bind(entry)
        .execute(&app.db)
        .await
        .expect("ews");
    assert!(
        is_signed(&app, "vitals", entry).await,
        "a score does not take the signature off"
    );
    assert_eq!(
        signature_payload_test::status_of(&app, &token).await,
        "unchanged"
    );

    sqlx::query("UPDATE vitals SET spo2 = 91 WHERE id = $1")
        .bind(entry)
        .execute(&app.db)
        .await
        .expect("edit");
    assert!(!is_signed(&app, "vitals", entry).await);
    assert_eq!(audits(&app, "vitals.signature_cleared", entry).await, 1);
    assert_eq!(
        signature_payload_test::status_of(&app, &token).await,
        "changed"
    );

    // A nurse does not sign a doctor's certificate.
    let cert = certificate(&app, tenant, nurse.user_id).await;
    let (status, _) = review_and_sign(
        &nurse.client,
        &app,
        &nurse.csrf,
        "medical_certificate",
        cert,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // A nurse with no licence number on her profile does not sign.
    let unlicensed = keyed_staff(&app, &csrf, "nurse").await;
    nurse_profile(&app, unlicensed.user_id, None).await;
    let theirs = vitals_entry(&app, tenant, admin, unlicensed.user_id).await;
    let (status, _) =
        review_and_sign(&unlicensed.client, &app, &unlicensed.csrf, "vitals", theirs).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn an_mlc_report_signs_its_injuries_and_a_closed_case_is_final() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let (patient, _, _) = patient_visit(&app, tenant, admin).await;
    let case: Uuid = sqlx::query_scalar(
        "INSERT INTO mlc_cases (tenant_id, patient_id, mlc_number, case_type, examining_doctor_id, \
            examination_findings, opinion) \
         VALUES ($1, $2, $3, 'assault', $4, 'Bruise left forearm', 'Simple injury') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(format!("MLC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("mlc case");
    let injury: Uuid = sqlx::query_scalar(
        "INSERT INTO mlc_injuries (tenant_id, mlc_case_id, injury_number, injury_type, location, \
            size_cm, description) \
         VALUES ($1, $2, 1, 'contusion', 'left forearm', '3 x 2', 'Reddish bruise') RETURNING id",
    )
    .bind(tenant)
    .bind(case)
    .fetch_one(&app.db)
    .await
    .expect("injury");

    let (status, signed) = review_and_sign(&app.client, &app, &csrf, "mlc_report", case).await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    let token = token_of(&app, &signed).await;
    signature_payload_test::each_field_counts(
        &app,
        &token,
        "mlc_injuries",
        injury,
        &[
            ("description", "'Laceration'"),
            ("location", "'right forearm'"),
        ],
    )
    .await;

    sqlx::query("UPDATE mlc_cases SET status = 'closed'::mlc_status WHERE id = $1")
        .bind(case)
        .execute(&app.db)
        .await
        .expect("close");
    let err = sqlx::query("UPDATE mlc_cases SET opinion = 'Grievous' WHERE id = $1")
        .bind(case)
        .execute(&app.db)
        .await
        .err()
        .and_then(|e| {
            e.as_database_error()
                .and_then(|d| d.code().map(|c| c.into_owned()))
        });
    assert_eq!(err.as_deref(), Some("MB409"), "a closed MLC is final");

    // A doctor not allowed to sign medico-legal cases is refused.
    let doctor = keyed_staff(&app, &csrf, "doctor").await;
    signatures_test::register_doctor(&app, &doctor.user_id.to_string()).await;
    sqlx::query("UPDATE doctor_profiles SET can_sign_mlc = false WHERE user_id = $1")
        .bind(doctor.user_id)
        .execute(&app.db)
        .await
        .expect("no mlc licence");
    let theirs: Uuid = sqlx::query_scalar(
        "INSERT INTO mlc_cases (tenant_id, patient_id, mlc_number, examining_doctor_id) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(format!("MLC-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(doctor.user_id)
    .fetch_one(&app.db)
    .await
    .expect("their case");
    attend(&app, tenant, patient, doctor.user_id).await;
    let (status, _) =
        review_and_sign(&doctor.client, &app, &doctor.csrf, "mlc_report", theirs).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

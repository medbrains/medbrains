//! What a signature covers: every field the printed document shows, and
//! nothing that was deleted. Checked through the public verify page, which
//! recomputes the hash from the live record, so a field left out of the
//! signed payload would let the paper and the record disagree while the page
//! still said "unchanged".

use crate::{common, signatures_test};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Signed in as admin with a fresh step-up and a default signing key.
async fn signer(app: &common::TestApp) -> (String, Uuid, Uuid) {
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

/// Sign `record_id` as the primary signer; the status and, on success, the token.
async fn sign(
    app: &common::TestApp,
    csrf: &str,
    record_type: &str,
    record_id: Uuid,
) -> (StatusCode, Option<String>) {
    let resp = app
        .client
        .post(app.url("/api/signatures/sign"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "record_type": record_type, "record_id": record_id }))
        .send()
        .await
        .expect("sign");
    let status = resp.status();
    if status != StatusCode::OK {
        return (status, None);
    }
    let body: Value = resp.json().await.expect("sign json");
    let token: String = sqlx::query_scalar(
        "SELECT token FROM signature_verify_links WHERE signed_record_id = $1::uuid AND revoked_at IS NULL",
    )
    .bind(body["signed_record"]["id"].as_str().unwrap_or_default())
    .fetch_one(&app.db)
    .await
    .expect("link");
    (status, Some(token))
}

/// The public page's status for `token`.
async fn status_of(app: &common::TestApp, token: &str) -> String {
    let body: Value = reqwest::Client::new()
        .get(app.url(&format!("/api/public/signatures/verify/{token}")))
        .send()
        .await
        .expect("check")
        .json()
        .await
        .expect("check json");
    body["status"].as_str().unwrap_or_default().to_owned()
}

/// Change one column of one row, expect "changed", put it back, expect "unchanged".
async fn each_field_counts(
    app: &common::TestApp,
    token: &str,
    table: &str,
    id: Uuid,
    fields: &[(&str, &str)],
) {
    let original: Value =
        sqlx::query_scalar(&format!("SELECT to_jsonb(t) FROM {table} t WHERE id = $1"))
            .bind(id)
            .fetch_one(&app.db)
            .await
            .expect("original row");
    for (column, altered) in fields {
        sqlx::query(&format!(
            "UPDATE {table} SET {column} = {altered} WHERE id = $1"
        ))
        .bind(id)
        .execute(&app.db)
        .await
        .unwrap_or_else(|e| panic!("alter {column}: {e}"));
        assert_eq!(
            status_of(app, token).await,
            "changed",
            "{table}.{column} is printed, so it must be signed"
        );
        sqlx::query(&format!(
            "UPDATE {table} t SET {column} = (jsonb_populate_record(NULL::{table}, $2)).{column} WHERE id = $1"
        ))
        .bind(id)
        .bind(&original)
        .execute(&app.db)
        .await
        .unwrap_or_else(|e| panic!("restore {column}: {e}"));
        assert_eq!(
            status_of(app, token).await,
            "unchanged",
            "restoring {column} restores the match"
        );
    }
}

/// A prescription with one fully written item; returns (prescription, item).
async fn prescription_with_item(app: &common::TestApp, admin: Uuid, tenant: Uuid) -> (Uuid, Uuid) {
    let rx: Uuid = signatures_test::doctor_prescription(app, &admin.to_string())
        .await
        .parse()
        .expect("rx id");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, frequency, \
            duration, route, instructions, quantity, time_slots, end_date) \
         VALUES ($1, $2, 'Amoxicillin 500mg', '1 cap', 'TID', '5 days', 'oral', 'after food', 15, \
                 ARRAY['08:00','14:00','20:00'], CURRENT_DATE + 5) RETURNING id",
    )
    .bind(tenant)
    .bind(rx)
    .fetch_one(&app.db)
    .await
    .expect("item");
    (rx, item)
}

/// A lab result the admin entered, on an order whose visit sits in a department.
async fn lab_result(
    app: &common::TestApp,
    admin: Uuid,
    tenant: Uuid,
    entered_by: Option<Uuid>,
) -> Uuid {
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let test_id: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $2, 'Haemoglobin') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIG-HB-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("test");
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("department");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Lab', 'Signed', 'female', '9990004004') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIGL{tag}"))
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
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, department_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(test_id)
    .bind(admin)
    .bind(dept)
    .fetch_one(&app.db)
    .await
    .expect("order");
    sqlx::query_scalar(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, result_value, unit, \
            normal_range, reference_range, flag, is_abnormal, is_critical, critical_flag, method, entered_by) \
         VALUES ($1, $2, 'Haemoglobin', '13.2', '13.2', 'g/dL', '12-15', '12-15', 'normal', \
                 false, false, NULL, 'Cyanmethaemoglobin', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .bind(entered_by)
    .fetch_one(&app.db)
    .await
    .expect("result")
}

#[tokio::test]
async fn every_printed_prescription_field_is_signed() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = signer(&app).await;
    let (rx, item) = prescription_with_item(&app, admin, tenant).await;
    let (_, token) = sign(&app, &csrf, "prescription", rx).await;
    let token = token.expect("signed");
    assert_eq!(status_of(&app, &token).await, "unchanged");
    each_field_counts(
        &app,
        &token,
        "prescription_items",
        item,
        &[
            ("drug_name", "drug_name || ' x'"),
            ("dosage", "dosage || ' x'"),
            ("frequency", "'QID'"),
            ("duration", "'7 days'"),
            ("route", "'iv'"),
            ("instructions", "'before food'"),
            ("quantity", "quantity + 1"),
            ("time_slots", "ARRAY['09:00']"),
            ("end_date", "end_date + 1"),
        ],
    )
    .await;
    each_field_counts(&app, &token, "prescriptions", rx, &[("notes", "'altered'")]).await;
}

#[tokio::test]
async fn every_printed_lab_field_is_signed_and_a_department_scoped_report_verifies() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = signer(&app).await;
    let result = lab_result(&app, admin, tenant, Some(admin)).await;
    let (status, token) = sign(&app, &csrf, "lab_report", result).await;
    assert_eq!(status, StatusCode::OK);
    let token = token.expect("signed");
    // The order's visit is in a department; the public check runs with the
    // tenant context only and must still read the report as signed.
    assert_eq!(status_of(&app, &token).await, "unchanged");
    each_field_counts(
        &app,
        &token,
        "lab_results",
        result,
        &[
            ("parameter_name", "'Hb'"),
            ("value", "'9.1'"),
            ("result_value", "'9.1'"),
            ("unit", "'mmol/L'"),
            ("normal_range", "'11-16'"),
            ("reference_range", "'11-16'"),
            ("flag", "'low'::lab_result_flag"),
            ("is_abnormal", "true"),
            ("is_critical", "true"),
            ("critical_flag", "'critical_low'"),
            ("method", "'HPLC'"),
        ],
    )
    .await;
}

#[tokio::test]
async fn a_deleted_item_or_record_reads_as_changed() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = signer(&app).await;
    let (rx, item) = prescription_with_item(&app, admin, tenant).await;
    let token = sign(&app, &csrf, "prescription", rx)
        .await
        .1
        .expect("signed");

    sqlx::query("UPDATE prescription_items SET deleted_at = now() WHERE id = $1")
        .bind(item)
        .execute(&app.db)
        .await
        .expect("delete item");
    assert_eq!(
        status_of(&app, &token).await,
        "changed",
        "a deleted item is not on the record"
    );
    sqlx::query("UPDATE prescription_items SET deleted_at = NULL WHERE id = $1")
        .bind(item)
        .execute(&app.db)
        .await
        .expect("restore item");
    assert_eq!(status_of(&app, &token).await, "unchanged");

    sqlx::query("UPDATE prescriptions SET deleted_at = now() WHERE id = $1")
        .bind(rx)
        .execute(&app.db)
        .await
        .expect("delete record");
    assert_eq!(
        status_of(&app, &token).await,
        "changed",
        "a deleted record is not the signed one"
    );
}

#[tokio::test]
async fn only_the_reporter_or_validator_signs_a_report_as_primary() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = signer(&app).await;

    let someone_elses = lab_result(&app, admin, tenant, None).await;
    let (status, _) = sign(&app, &csrf, "lab_report", someone_elses).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "the admin neither entered nor verified it"
    );
    let own = lab_result(&app, admin, tenant, Some(admin)).await;
    assert_eq!(sign(&app, &csrf, "lab_report", own).await.0, StatusCode::OK);

    // Radiology: reported by another doctor, signed by the admin.
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let other: Value = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "username": format!("rad_{tag}"), "email": format!("rad_{tag}@example.test"),
                       "password": format!("Rad#{tag}Aa9"), "full_name": format!("Dr {tag}"), "role": "doctor" }))
        .send()
        .await
        .expect("user")
        .json()
        .await
        .expect("user json");
    let other: Uuid = other["id"]
        .as_str()
        .expect("other id")
        .parse()
        .expect("uuid");
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'X-ray') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIG-XR-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Rad', 'Signed', 'male', '9990005005') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIGR{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_orders (tenant_id, patient_id, modality_id, ordered_by) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(modality)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("order");
    let report = |reporter: Uuid| {
        sqlx::query_scalar::<sqlx::Postgres, Uuid>(
            "INSERT INTO radiology_reports (tenant_id, order_id, reported_by, findings) \
             VALUES ($1, $2, $3, 'No acute findings') RETURNING id",
        )
        .bind(tenant)
        .bind(order)
        .bind(reporter)
    };
    let theirs = report(other)
        .fetch_one(&app.db)
        .await
        .expect("their report");
    assert_eq!(
        sign(&app, &csrf, "radiology_report", theirs).await.0,
        StatusCode::NOT_FOUND
    );
    let mine = report(admin).fetch_one(&app.db).await.expect("my report");
    assert_eq!(
        sign(&app, &csrf, "radiology_report", mine).await.0,
        StatusCode::OK
    );
}

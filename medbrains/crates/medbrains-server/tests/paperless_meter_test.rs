//! The paperless meter counts a signature only while it still covers the
//! record: signed through `/api/signatures/sign`, then edited (the 1418 edit
//! guard takes the signature off), a recount reads it as unsigned.

use crate::signable_types_test::{admin_signer, post, review_and_sign};
use crate::{common, signatures_test};

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// A prescription with one drug on an OPD visit to a department of its own,
/// so its `paperless_daily` row is this test's alone; (prescription, item,
/// department).
async fn prescription_in_own_department(
    app: &common::TestApp,
    admin: Uuid,
    tenant: Uuid,
) -> (Uuid, Uuid, Uuid) {
    let rx: Uuid = signatures_test::doctor_prescription(app, &admin.to_string())
        .await
        .parse()
        .expect("rx id");
    let code = format!(
        "PLM-{}",
        Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    );
    let dept: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $2, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("department");
    sqlx::query(
        "UPDATE encounters SET department_id = $1 \
          WHERE id = (SELECT encounter_id FROM prescriptions WHERE id = $2)",
    )
    .bind(dept)
    .bind(rx)
    .execute(&app.db)
    .await
    .expect("visit department");
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
    (rx, item, dept)
}

/// Recount through the API, then read the department's prescription row:
/// (created, signed).
async fn recount(app: &common::TestApp, csrf: &str, dept: Uuid) -> (i32, i32) {
    let (status, body) = post(
        &app.client,
        app,
        csrf,
        "/api/analytics/paperless/refresh",
        json!({ "days": 1 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "recount: {body}");
    sqlx::query_as(
        "SELECT created, signed FROM paperless_daily \
          WHERE department_id = $1 AND doc_type = 'prescription'",
    )
    .bind(dept)
    .fetch_one(&app.db)
    .await
    .expect("meter row")
}

/// Given a prescription signed by its author through the sign path, When the
/// meter recounts, Then it is signed; When a drug is then changed and the
/// meter recounts, Then it is not: the edit took the signature off, and the
/// meter follows the record, not the signature's history.
#[tokio::test]
async fn a_signature_cleared_by_an_edit_is_not_counted() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let (rx, item, dept) = prescription_in_own_department(&app, admin, tenant).await;
    let (status, body) = review_and_sign(&app.client, &app, &csrf, "prescription", rx).await;
    assert_eq!(status, StatusCode::OK, "sign: {body}");
    assert_eq!(recount(&app, &csrf, dept).await, (1, 1));

    sqlx::query("UPDATE prescription_items SET drug_name = 'Tramadol 50mg' WHERE id = $1")
        .bind(item)
        .execute(&app.db)
        .await
        .expect("change the drug");
    assert_eq!(
        recount(&app, &csrf, dept).await,
        (1, 0),
        "the edit took the signature off"
    );
}

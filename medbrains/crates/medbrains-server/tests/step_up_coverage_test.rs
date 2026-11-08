//! Every route that puts a clinician's name to a record, or writes a
//! prescription, asks for the password again. A session alone is refused
//! with `step_up_required` before anything is written.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// POST as the signed-in admin, who has not stepped up.
async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or_default())
}

fn is_step_up(status: StatusCode, body: &Value) -> bool {
    status == StatusCode::FORBIDDEN && body["error"] == "step_up_required"
}

#[tokio::test]
async fn countersigning_and_signing_a_document_need_a_fresh_step_up() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let (status, body) = post(
        &app,
        &csrf,
        &format!("/api/clinical-notes/{}/countersign", Uuid::new_v4()),
        json!({}),
    )
    .await;
    assert!(is_step_up(status, &body), "countersign: {status} {body}");

    let output = Uuid::new_v4();
    let (status, body) = post(
        &app,
        &csrf,
        &format!("/api/documents/outputs/{output}/signatures"),
        json!({ "document_output_id": output, "signer_role": "author", "signature_type": "digital" }),
    )
    .await;
    assert!(
        is_step_up(status, &body),
        "document signature: {status} {body}"
    );
}

#[tokio::test]
async fn a_basket_with_a_drug_needs_a_fresh_step_up_and_writes_nothing_without_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Basket', 'Drug', 'male', '9990006006') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIGB{}", &Uuid::new_v4().simple().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd'::encounter_type) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    let (status, body) = post(
        &app,
        &csrf,
        "/api/orders/basket/sign",
        json!({ "encounter_id": encounter, "patient_id": patient, "items": [{
            "kind": "drug", "drug_id": Uuid::new_v4(), "drug_name": "Paracetamol 500mg",
            "dose": "1 tab", "frequency": "TID", "route": "oral", "quantity": 10, "unit_price": "1.00"
        }]}),
    )
    .await;
    assert!(
        is_step_up(status, &body),
        "basket with a drug: {status} {body}"
    );
    let written: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM prescriptions WHERE encounter_id = $1")
            .bind(encounter)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(written, 0, "a refused basket writes no prescription");
}

/// A patient with an open OPD visit seen by the admin, in a department.
async fn opd_visit(app: &common::TestApp) -> (Uuid, Uuid, Uuid, Uuid) {
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("department");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Step', 'Up', 'female', '9990007007') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIGS{}", &Uuid::new_v4().simple().to_string()[..8]))
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
    (tenant, dept, patient, encounter)
}

/// Prescriptions on `encounter`, live ones only.
async fn live_prescriptions(app: &common::TestApp, encounter: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM prescriptions WHERE encounter_id = $1 AND deleted_at IS NULL",
    )
    .bind(encounter)
    .fetch_one(&app.db)
    .await
    .expect("count")
}

#[tokio::test]
async fn an_order_set_with_a_medication_needs_a_fresh_step_up() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, _, patient, encounter) = opd_visit(&app).await;
    let template: Uuid = sqlx::query_scalar(
        "INSERT INTO order_set_templates (tenant_id, name, is_current, is_active) \
         VALUES ($1, $2, true, true) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("Step-up set {}", Uuid::new_v4().simple()))
    .fetch_one(&app.db)
    .await
    .expect("template");
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO order_set_template_items (tenant_id, template_id, item_type, drug_name, \
            dosage, frequency, duration, route) \
         VALUES ($1, $2, 'medication'::order_set_item_type, 'Paracetamol 500mg', '1 tab', \
                 'TID', '3 days', 'oral') RETURNING id",
    )
    .bind(tenant)
    .bind(template)
    .fetch_one(&app.db)
    .await
    .expect("item");
    let activate = json!({ "template_id": template, "encounter_id": encounter, "patient_id": patient,
                           "items": [{ "template_item_id": item, "selected": true }] });

    let (status, body) = post(&app, &csrf, "/api/order-sets/activate", activate.clone()).await;
    assert!(
        is_step_up(status, &body),
        "refused without step-up: {status} {body}"
    );
    assert_eq!(
        live_prescriptions(&app, encounter).await,
        0,
        "and wrote nothing"
    );

    app.step_up(&app.client, &csrf, "admin123").await;
    let (status, body) = post(&app, &csrf, "/api/order-sets/activate", activate).await;
    assert_eq!(status, StatusCode::OK, "accepted after step-up: {body}");
    assert_eq!(
        live_prescriptions(&app, encounter).await,
        1,
        "one prescription per activation"
    );
}

#[tokio::test]
async fn admitting_a_visit_with_a_live_prescription_needs_a_fresh_step_up() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, dept, patient, encounter) = opd_visit(&app).await;
    sqlx::query(
        "INSERT INTO prescriptions (tenant_id, encounter_id, patient_id, doctor_id) \
         SELECT $1, $2, $3, doctor_id FROM encounters WHERE id = $2",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .execute(&app.db)
    .await
    .expect("prescription");
    let path = format!("/api/opd/encounters/{encounter}/admit-to-ipd");
    let body = json!({ "department_id": dept });

    let (status, refused) = post(&app, &csrf, &path, body.clone()).await;
    assert!(
        is_step_up(status, &refused),
        "refused without step-up: {status} {refused}"
    );
    let admissions: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM admissions WHERE patient_id = $1")
            .bind(patient)
            .fetch_one(&app.db)
            .await
            .expect("admissions");
    assert_eq!(admissions, 0, "a refused admission is rolled back whole");

    app.step_up(&app.client, &csrf, "admin123").await;
    let (status, admitted) = post(&app, &csrf, &path, body).await;
    assert_eq!(status, StatusCode::OK, "accepted after step-up: {admitted}");
    let ipd: Uuid = admitted["ipd_encounter"]["id"]
        .as_str()
        .expect("ipd encounter")
        .parse()
        .expect("uuid");
    assert_eq!(
        live_prescriptions(&app, ipd).await,
        1,
        "the live prescription is copied"
    );
}

#[tokio::test]
async fn a_visit_whose_only_prescription_was_deleted_admits_without_step_up() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, dept, patient, encounter) = opd_visit(&app).await;
    sqlx::query(
        "INSERT INTO prescriptions (tenant_id, encounter_id, patient_id, doctor_id, deleted_at) \
         SELECT $1, $2, $3, doctor_id, now() FROM encounters WHERE id = $2",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .execute(&app.db)
    .await
    .expect("deleted prescription");

    let (status, admitted) = post(
        &app,
        &csrf,
        &format!("/api/opd/encounters/{encounter}/admit-to-ipd"),
        json!({ "department_id": dept }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "nothing to copy, so no password: {admitted}"
    );
    let ipd: Uuid = admitted["ipd_encounter"]["id"]
        .as_str()
        .expect("ipd encounter")
        .parse()
        .expect("uuid");
    let copied: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM prescriptions WHERE encounter_id = $1")
            .bind(ipd)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(copied, 0, "the deleted prescription is not copied");
}

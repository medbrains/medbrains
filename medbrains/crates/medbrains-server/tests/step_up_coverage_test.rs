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

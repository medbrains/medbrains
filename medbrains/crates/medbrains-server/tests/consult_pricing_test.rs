//! OPD consultation pricing (#296): the doctor's own fee is billed, and a
//! repeat visit inside the hospital's free-revisit window bills nothing and
//! says so — the counter never has to remember who came back.

mod common;

use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

/// Register, call, start and complete a visit; return its encounter.
async fn visit(app: &common::TestApp, csrf: &str, patient: Uuid, dept: Uuid, doctor: Uuid) -> Uuid {
    let registered: Value = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_id": patient, "department_id": dept, "doctor_id": doctor }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("register json");
    let queue = registered["queue"]["id"]
        .as_str()
        .or_else(|| registered["queue_id"].as_str())
        .expect("queue")
        .to_owned();
    for step in ["call", "start", "complete"] {
        let res = app
            .client
            .put(app.url(&format!("/api/opd/queue/{queue}/{step}")))
            .header("x-csrf-token", csrf)
            .send()
            .await
            .expect(step);
        assert!(res.status().is_success(), "{step}: {}", res.status());
    }
    registered["encounter"]["id"]
        .as_str()
        .or_else(|| registered["id"].as_str())
        .expect("encounter")
        .parse()
        .expect("uuid")
}

async fn consult_line(app: &common::TestApp, encounter: Uuid) -> (Decimal, String) {
    sqlx::query_as(
        "SELECT ii.unit_price, ii.description FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id \
          WHERE i.encounter_id = $1 AND ii.source::text = 'opd' LIMIT 1",
    )
    .bind(encounter)
    .fetch_one(&app.db)
    .await
    .expect("consultation line")
}

#[tokio::test]
async fn the_doctors_fee_is_billed_and_a_revisit_in_the_window_is_free() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, doctor): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let fee_before: Option<Decimal> =
        sqlx::query_scalar("SELECT consultation_fee FROM users WHERE id = $1")
            .bind(doctor)
            .fetch_one(&app.db)
            .await
            .expect("fee");
    let window_before: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'billing' AND key = 'opd_revisit'",
    )
    .bind(tenant)
    .fetch_optional(&app.db)
    .await
    .expect("window");
    sqlx::query("UPDATE users SET consultation_fee = 500 WHERE id = $1")
        .bind(doctor)
        .execute(&app.db)
        .await
        .expect("fee");
    let set_window = |v: Value| {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'billing', 'opd_revisit', $2) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = $2, deleted_at = NULL",
        )
        .bind(tenant)
        .bind(v)
        .execute(&app.db)
    };
    set_window(json!({ "days": 7, "same_doctor": true }))
        .await
        .expect("window");

    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let dept: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Revisit', 'Patient', 'male'::gender, '9000000296') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-RV-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");

    let first = visit(&app, &csrf, patient, dept, doctor).await;
    let (price, text) = consult_line(&app, first).await;
    assert_eq!(price, Decimal::from(500), "{text}");
    assert!(text.starts_with("OPD consultation — Dr"), "{text}");

    let second = visit(&app, &csrf, patient, dept, doctor).await;
    let (price, text) = consult_line(&app, second).await;
    assert_eq!(price, Decimal::ZERO, "a revisit within 7 days is free");
    assert_eq!(text, "Free revisit (day 0 of 7) — OPD consultation");

    set_window(json!({ "days": 0, "same_doctor": true }))
        .await
        .expect("off");
    let third = visit(&app, &csrf, patient, dept, doctor).await;
    assert_eq!(
        consult_line(&app, third).await.0,
        Decimal::from(500),
        "window off: paid"
    );

    sqlx::query("UPDATE users SET consultation_fee = $1 WHERE id = $2")
        .bind(fee_before)
        .bind(doctor)
        .execute(&app.db)
        .await
        .expect("restore fee");
    match window_before {
        Some(v) => {
            set_window(v).await.expect("restore window");
        }
        None => {
            sqlx::query("DELETE FROM tenant_settings WHERE tenant_id = $1 AND category = 'billing' AND key = 'opd_revisit'")
                .bind(tenant)
                .execute(&app.db)
                .await
                .expect("restore window");
        }
    }
}

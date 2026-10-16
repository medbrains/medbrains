//! Equipment past its calibration is locked out of patient use (NABH FMS,
//! NABL ISO 15189 §5.3): the calibration is locked, the equipment goes out of
//! service, a hand unlock is refused, an analyser linked to it cannot post
//! lab results — and recording a passing calibration lifts the lock.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn an_overdue_calibration_locks_the_analyser_until_it_passes_again() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();

    let equipment: Uuid = sqlx::query_scalar(
        "INSERT INTO bme_equipment (tenant_id, name) VALUES ($1, $2) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("Chemistry analyser {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("equipment");
    let device: Uuid = sqlx::query_scalar(
        "INSERT INTO device_instances (tenant_id, adapter_code, name, code, bme_equipment_id) \
         VALUES ($1, 'test_hl7', $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("Analyser {tag}"))
    .bind(format!("AN-{tag}"))
    .bind(equipment)
    .fetch_one(&app.db)
    .await
    .expect("device");

    // A calibration already past its due date is locked the moment it is recorded.
    let resp = app
        .client
        .post(app.url("/api/bme/calibrations"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "equipment_id": equipment,
            "calibration_status": "calibrated",
            "last_calibrated_date": "2025-09-01",
            "next_due_date": "2026-09-01",
        }))
        .send()
        .await
        .expect("create calibration");
    assert_eq!(resp.status(), StatusCode::OK);
    let cal: Value = resp.json().await.expect("calibration json");
    assert_eq!(
        cal["is_locked"],
        json!(true),
        "an overdue calibration was not locked"
    );
    let cal_id = cal["id"].as_str().expect("id").to_owned();
    let status: String = sqlx::query_scalar("SELECT status::text FROM bme_equipment WHERE id = $1")
        .bind(equipment)
        .fetch_one(&app.db)
        .await
        .expect("status");
    assert_eq!(status, "out_of_service");

    // Results from the locked analyser are refused and kept for review.
    let ingest = || {
        app.client
            .post(app.url("/api/device-ingest/lab"))
            .header("x-csrf-token", &csrf)
            .json(&json!({
                "device_instance_id": device,
                "protocol": "hl7v2",
                "parsed_payload": {},
                "mapped_data": {},
            }))
            .send()
    };
    let refused = ingest().await.expect("ingest");
    assert_eq!(
        refused.status(),
        StatusCode::CONFLICT,
        "a locked analyser posted results"
    );
    let kept: String = sqlx::query_scalar(
        "SELECT processing_status::text FROM device_messages \
          WHERE device_instance_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(device)
    .fetch_one(&app.db)
    .await
    .expect("message");
    assert_eq!(kept, "rejected");

    // A hand unlock is refused while the calibration is still overdue.
    let unlock = app
        .client
        .put(app.url(&format!("/api/bme/calibrations/{cal_id}")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "is_locked": false }))
        .send()
        .await
        .expect("unlock");
    assert_eq!(unlock.status(), StatusCode::CONFLICT);

    // A passing calibration lifts the lock; the analyser is returned to service by hand.
    let pass = app
        .client
        .put(app.url(&format!("/api/bme/calibrations/{cal_id}")))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "calibration_status": "calibrated",
            "last_calibrated_date": "2026-10-12",
            "next_due_date": "2099-10-12",
            "is_in_tolerance": true,
            "certificate_number": format!("CAL-{tag}"),
        }))
        .send()
        .await
        .expect("recalibrate");
    assert_eq!(pass.status(), StatusCode::OK);
    let passed: Value = pass.json().await.expect("json");
    assert_eq!(passed["is_locked"], json!(false));
    sqlx::query("UPDATE bme_equipment SET status = 'active' WHERE id = $1")
        .bind(equipment)
        .execute(&app.db)
        .await
        .expect("return to service");
    let accepted = ingest().await.expect("ingest");
    assert_ne!(
        accepted.status(),
        StatusCode::CONFLICT,
        "a released analyser is still refused"
    );
}

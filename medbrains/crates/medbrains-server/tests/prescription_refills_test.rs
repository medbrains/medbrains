//! A doctor authorises refills on a prescription; the pharmacy issues each
//! one into its queue no sooner than the interval, never past the
//! prescription's expiry, and never for a controlled drug.

mod common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let request = match method {
        "PUT" => app.client.put(app.url(path)),
        _ => app.client.post(app.url(path)),
    };
    let resp = request
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn line(id: Uuid, name: &str) -> Value {
    json!({ "drug_name": name, "catalog_item_id": id, "dosage": "1 tab",
            "frequency": "OD", "duration": "30 days", "route": "oral" })
}

#[tokio::test]
async fn refills_follow_the_doctors_terms() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let stepped = app
        .client
        .post(app.url("/api/auth/step-up"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "password": "admin123" }))
        .send()
        .await
        .expect("step-up");
    assert!(
        stepped.status().is_success(),
        "step-up: {}",
        stepped.status()
    );

    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let pick = |controlled: bool| {
        let db = app.db.clone();
        async move {
            sqlx::query_as::<_, (Uuid, String)>(
                "SELECT id, name FROM pharmacy_catalog WHERE tenant_id = $1 AND is_active \
                   AND (is_controlled OR coalesce(drug_schedule, '') IN ('X', 'H1', 'NDPS')) = $2 \
                 ORDER BY name LIMIT 1",
            )
            .bind(tenant)
            .bind(controlled)
            .fetch_one(&db)
            .await
            .expect("a seeded drug")
        }
    };
    let (plain, plain_name) = pick(false).await;
    let (controlled, controlled_name) = pick(true).await;
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Refill', 'Patient', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-RF-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        &app,
        &csrf,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": patient, "department_id": department }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let rx_path = format!(
        "/api/opd/encounters/{}/prescriptions",
        visit["encounter"]["id"].as_str().unwrap_or_default()
    );
    let today = Utc::now().date_naive();

    // A controlled drug is never refillable.
    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        &rx_path,
        json!({
        "items": [line(controlled, &controlled_name)],
        "repeats_allowed": 1, "repeat_interval_days": 30,
        "valid_until": today + Duration::days(60) }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.to_string().contains(&controlled_name), "{body}");

    // Validity must cover the refills: two, thirty days apart, need sixty days.
    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        &rx_path,
        json!({
        "items": [line(plain, &plain_name)],
        "repeats_allowed": 2, "repeat_interval_days": 30,
        "valid_until": today + Duration::days(20) }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    let (status, rx) = send(
        &app,
        &csrf,
        "POST",
        &rx_path,
        json!({
        "items": [line(plain, &plain_name)],
        "repeats_allowed": 2, "repeat_interval_days": 30,
        "valid_until": today + Duration::days(90) }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{rx}");
    assert_eq!(rx["prescription"]["repeats_allowed"], json!(2));
    let rx_id: Uuid = rx["prescription"]["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("rx id");
    let refills = format!("/api/pharmacy/prescriptions/{rx_id}/repeats");

    // Not on the day it was written: the first refill waits one interval.
    let eligibility: Value = app
        .client
        .get(app.url(&format!(
            "/api/pharmacy/prescriptions/{rx_id}/repeat-eligibility"
        )))
        .send()
        .await
        .expect("eligibility")
        .json()
        .await
        .expect("json");
    assert_eq!(
        eligibility["is_eligible_now"],
        json!(false),
        "{eligibility}"
    );
    assert!(
        eligibility["reason"]
            .as_str()
            .is_some_and(|r| r.contains("next refill")),
        "{eligibility}"
    );
    let (status, _) = send(&app, &csrf, "POST", &refills, json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT);

    // A month on, the refill goes into the pharmacy's queue as its own entry.
    sqlx::query("UPDATE prescriptions SET created_at = now() - interval '31 days' WHERE id = $1")
        .bind(rx_id)
        .execute(&app.db)
        .await
        .expect("age the prescription");
    let (status, refill) = send(&app, &csrf, "POST", &refills, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{refill}");
    assert_eq!(refill["repeat_index"], json!(1));
    let queue_id: Uuid = refill["rx_queue_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("queue id");
    let (state, index): (String, Option<i32>) = sqlx::query_as(
        "SELECT status::text, repeat_index FROM pharmacy_prescriptions WHERE id = $1",
    )
    .bind(queue_id)
    .fetch_one(&app.db)
    .await
    .expect("queue entry");
    assert_eq!((state.as_str(), index), ("pending_review", Some(1)));

    // The second waits another interval.
    let (status, _) = send(&app, &csrf, "POST", &refills, json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT);

    // Once expired, the pharmacist can't approve it.
    sqlx::query("UPDATE prescriptions SET valid_until = CURRENT_DATE - 1 WHERE id = $1")
        .bind(rx_id)
        .execute(&app.db)
        .await
        .expect("expire");
    let (status, body) = send(
        &app,
        &csrf,
        "PUT",
        &format!("/api/pharmacy/rx-queue/{queue_id}/review"),
        json!({ "action": "approved" }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("expired"), "{body}");
}

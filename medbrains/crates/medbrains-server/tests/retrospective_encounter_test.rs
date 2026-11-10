//! A clinician records a visit after the fact. The retrospective entry is an
//! OPD encounter dated when it happened, marked retrospective and waiting for
//! approval; a date in the future or beyond the backdate window is refused.

use crate::common;

use chrono::{Duration, Utc};
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn a_late_visit_is_recorded_on_the_day_it_happened() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "first_name": "Late", "last_name": "Entry", "gender": "female", "date_of_birth": "1980-05-01",
            "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
        }))
        .send().await.expect("register").json().await.expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.deleted_at IS NULL ORDER BY d.code LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let entry = |when: chrono::DateTime<Utc>| {
        json!({
            "patient_id": patient["id"], "department_id": department, "doctor_id": doctor.user_id,
            "clinical_event_date": when, "reason": "Paper register entered after a power cut",
            "chief_complaint": "Fever for two days",
        })
    };
    let post = |body: Value| {
        let (client, url, csrf) = (
            app.client.clone(),
            app.url("/api/retrospective/encounters"),
            csrf.clone(),
        );
        async move {
            client
                .post(url)
                .header("x-csrf-token", csrf)
                .json(&body)
                .send()
                .await
                .expect("post")
        }
    };

    let when = Utc::now() - Duration::hours(30);
    let resp = post(entry(when)).await;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let made: Value = resp.json().await.expect("json");
    let id: Uuid = made["encounter_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("encounter id");
    let (kind, retro, complaint, date, status): (String, bool, Option<String>, chrono::NaiveDate, String) =
        sqlx::query_as(
            "SELECT encounter_type::text, is_retrospective, chief_complaints, encounter_date, status::text \
               FROM encounters WHERE id = $1",
        )
        .bind(id).fetch_one(&app.db).await.expect("encounter");
    assert_eq!(
        (kind.as_str(), retro, status.as_str()),
        ("opd", true, "completed")
    );
    assert_eq!(complaint.as_deref(), Some("Fever for two days"));
    assert!(
        (date - when.date_naive()).num_days().abs() <= 1,
        "dated when it happened: {date}"
    );
    assert_eq!(made["status"], "pending", "waits for approval by default");

    assert_eq!(
        post(entry(Utc::now() + Duration::hours(2))).await.status(),
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        post(entry(Utc::now() - Duration::days(30))).await.status(),
        StatusCode::BAD_REQUEST,
        "beyond the 72-hour default window"
    );
}

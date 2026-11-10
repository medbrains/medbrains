//! Front-desk and ER guards found walking the core day on a demo hospital.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn first_department(app: &common::TestApp, client: &reqwest::Client) -> Value {
    let depts: Value = client
        .get(app.url("/api/setup/departments"))
        .send()
        .await
        .expect("departments")
        .json()
        .await
        .expect("departments json");
    depts[0]["id"].clone()
}

async fn new_patient(app: &common::TestApp, client: &reqwest::Client, csrf: &str, phone: &str) -> Value {
    client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "first_name": "Guard", "last_name": "Day", "gender": "female", "date_of_birth": "1988-08-08", "phone": phone }))
        .send()
        .await
        .expect("patient")
        .json()
        .await
        .expect("patient json")
}

/// Given the desk booking an appointment, When the slot is already over,
/// Then it is refused; And completing a booked but never checked-in
/// appointment says to check the patient in, rather than 404.
#[tokio::test]
async fn appointments_cannot_be_booked_in_the_past_or_completed_unseen() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let patient = new_patient(&app, &app.client, &csrf, "9990000516").await;
    let department = first_department(&app, &app.client).await;
    let book = |date: String| {
        app.client
            .post(app.url("/api/opd/appointments"))
            .header("x-csrf-token", &csrf)
            .json(&json!({
                "patient_id": patient["id"], "doctor_id": doctor.user_id, "department_id": department,
                "appointment_date": date, "slot_start": "10:00:00", "slot_end": "10:15:00",
            }))
            .send()
    };
    let today = chrono::Utc::now().date_naive();

    let resp = book((today - chrono::Duration::days(1)).to_string()).await.expect("past");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    let resp = book((today + chrono::Duration::days(2)).to_string()).await.expect("future");
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
    let appointment: Value = resp.json().await.expect("appointment");
    let resp = app
        .client
        .put(app.url(&format!("/api/opd/appointments/{}/complete", appointment["id"].as_str().expect("id"))))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("complete");
    assert_eq!(resp.status(), StatusCode::CONFLICT);
}

/// Given a hospital whose jurisdictional police station is configured, When
/// an ER visit is registered as medico-legal, Then the MLC case it opens names
/// that station instead of leaving it blank.
#[tokio::test]
async fn an_er_mlc_names_the_configured_police_station() {
    let app = common::spawn_app().await;
    // Its own hospital, so no other test's police contact can race this one.
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let code = format!("ML{suffix}");
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'MLC Station Hospital', 'standalone_clinic') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("hospital");
    let username = format!("mladmin_{}", suffix.to_lowercase());
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash) \
         SELECT $1, $2, $2 || '@mlc-check.example.org', 'MLC Admin', 'hospital_admin', password_hash \
           FROM users WHERE username = 'admin'",
    )
    .bind(tenant)
    .bind(&username)
    .execute(&app.db)
    .await
    .expect("admin");
    let client = reqwest::Client::builder().cookie_store(true).build().expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": "admin123", "hospital_code": code }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();

    let resp = client
        .put(app.url("/api/setup/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "category": "emergency", "key": "police_contact", "value": { "station": "Anna Nagar PS" } }))
        .send()
        .await
        .expect("settings");
    assert!(resp.status().is_success(), "{}", resp.text().await.unwrap_or_default());
    let patient = new_patient(&app, &client, &csrf, "9990000517").await;
    let resp = client
        .post(app.url("/api/emergency/visits"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "patient_id": patient["id"], "chief_complaint": "Fall at home", "is_mlc": true }))
        .send()
        .await
        .expect("er visit");
    assert!(resp.status().is_success(), "{}", resp.text().await.unwrap_or_default());
    let visit: Value = resp.json().await.expect("visit json");

    let station: Option<String> = sqlx::query_scalar(
        "SELECT police_station FROM mlc_cases WHERE tenant_id = $1 AND er_visit_id = $2",
    )
    .bind(tenant)
    .bind(visit["id"].as_str().and_then(|s| s.parse::<Uuid>().ok()).expect("visit id"))
    .fetch_one(&app.db)
    .await
    .expect("mlc case");
    assert_eq!(station.as_deref(), Some("Anna Nagar PS"));
}

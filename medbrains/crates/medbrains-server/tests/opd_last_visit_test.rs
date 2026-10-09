//! The desk starting a returning patient's visit sees who saw them last: the
//! latest OPD visit that happened, not a cancelled one; a doctor who has left
//! is named but not offered; a first-timer has none; and only staff who start
//! visits may ask.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// Staff in `role` with a login: their user id and signed-in client.
async fn staff(app: &common::TestApp, admin_csrf: &str, role: &str) -> (Uuid, Client) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("lv_{tag}"), format!("Last#{tag}Aa9"));
    let user: Value = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Dr {tag}"), "role": role,
        }))
        .send()
        .await
        .expect("create user")
        .json()
        .await
        .expect("user json");
    let id: Uuid = user["id"].as_str().expect("id").parse().expect("uuid");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    (id, client)
}

async fn department(app: &common::TestApp, code: &str) -> Uuid {
    sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = $1",
    )
    .bind(code)
    .fetch_one(&app.db)
    .await
    .expect("department")
}

async fn patient(app: &common::TestApp) -> Uuid {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Return', 'Visit', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-LV-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

/// A past OPD visit `days_ago`, seen by `doctor` in `dept`.
async fn visit(
    app: &common::TestApp,
    p: Uuid,
    doctor: Uuid,
    dept: Uuid,
    days_ago: i32,
    status: &str,
) {
    sqlx::query(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, \
                                 encounter_date, doctor_id, department_id) \
         SELECT tenant_id, $1, 'opd', $2::encounter_status, CURRENT_DATE - $3, $4, $5 \
           FROM patients WHERE id = $1",
    )
    .bind(p)
    .bind(status)
    .bind(days_ago)
    .bind(doctor)
    .bind(dept)
    .execute(&app.db)
    .await
    .expect("visit");
}

async fn last_visit(app: &common::TestApp, client: &Client, p: Uuid) -> (StatusCode, Value) {
    let resp = client
        .get(app.url(&format!("/api/opd/patients/{p}/last-visit")))
        .send()
        .await
        .expect("last visit");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn the_desk_sees_who_saw_a_returning_patient_last() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let medicine = department(&app, "GEN-MEDICINE").await;
    let (earlier, _) = staff(&app, &csrf, "doctor").await;
    let (latest, _) = staff(&app, &csrf, "doctor").await;
    let (cancelled, _) = staff(&app, &csrf, "doctor").await;
    let (_, desk) = staff(&app, &csrf, "receptionist").await;
    let (_, lab) = staff(&app, &csrf, "lab_technician").await;

    let returning = patient(&app).await;
    visit(&app, returning, earlier, medicine, 60, "completed").await;
    visit(&app, returning, latest, medicine, 20, "completed").await;
    visit(&app, returning, cancelled, medicine, 5, "cancelled").await;

    let (status, last) = last_visit(&app, &desk, returning).await;
    assert_eq!(status, StatusCode::OK, "{last}");
    assert_eq!(
        last["doctor_id"],
        json!(latest),
        "the cancelled visit is skipped: {last}"
    );
    assert_eq!(last["department_id"], json!(medicine));

    sqlx::query("UPDATE users SET is_active = false WHERE id = $1")
        .bind(latest)
        .execute(&app.db)
        .await
        .expect("deactivate");
    let (_, last) = last_visit(&app, &desk, returning).await;
    assert!(
        last["doctor_id"].is_null(),
        "a doctor who left is not offered: {last}"
    );
    assert!(
        last["doctor_name"].is_string(),
        "but is still named: {last}"
    );

    let first_timer = patient(&app).await;
    let (status, none) = last_visit(&app, &desk, first_timer).await;
    assert_eq!((status, none), (StatusCode::OK, Value::Null));

    let (status, _) = last_visit(&app, &lab, returning).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "only staff who start visits may ask"
    );
}

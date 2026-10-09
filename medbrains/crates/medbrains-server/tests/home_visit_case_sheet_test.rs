//! A home visit is a visit of its own: scheduled, it has a case sheet; the
//! nurse sent on it writes and signs the nursing note there; a nurse who was
//! not sent does not open it; a home visit offers home notes, not a clinic
//! consultation; and home care is the care team's, not the front desk's.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A member of staff in `role` with a login and a staff record: their
/// employee id, client, CSRF.
async fn staff(app: &common::TestApp, admin_csrf: &str, role: &str) -> (Uuid, Client, String) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("home_{tag}"), format!("Home#{tag}Aa9"));
    let dept: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, user) = send(
        admin_csrf,
        app.client.post(app.url("/api/setup/users")).json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Staff {tag}"),
            "role": role, "department_ids": [dept],
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{user}");
    let user_id: Uuid = user["id"].as_str().expect("id").parse().expect("uuid");
    let employee: Uuid = sqlx::query_scalar(
        "INSERT INTO employees (tenant_id, employee_code, first_name, user_id) \
         SELECT tenant_id, $1, 'Nurse', $2 FROM users WHERE id = $2 RETURNING id",
    )
    .bind(format!("HN-{tag}"))
    .bind(user_id)
    .fetch_one(&app.db)
    .await
    .expect("employee");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    (
        employee,
        client,
        login["csrf_token"].as_str().unwrap_or("").to_owned(),
    )
}

#[tokio::test]
async fn the_nurse_sent_on_a_home_visit_signs_its_note_on_its_case_sheet() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Home', 'Bound', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-HV-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let (sent, nurse_client, nurse_csrf) = staff(&app, &csrf, "nurse").await;
    let (_, other_client, other_csrf) = staff(&app, &csrf, "nurse").await;

    let (status, visit) = send(
        &csrf,
        app.client.post(app.url("/api/home-health/visits")).json(
            &json!({ "patient_id": patient, "nurse_id": sent,
                           "scheduled_date": chrono::Utc::now().date_naive(),
                           "purpose": "Wound dressing" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let encounter = visit["encounter_id"]
        .as_str()
        .expect("the visit has a case sheet")
        .to_owned();
    let kind: String =
        sqlx::query_scalar("SELECT encounter_type::text FROM encounters WHERE id = $1::uuid")
            .bind(&encounter)
            .fetch_one(&app.db)
            .await
            .expect("encounter");
    assert_eq!(kind, "home_health");

    let types: Value = nurse_client
        .get(app.url(&format!(
            "/api/clinical-notes/types?encounter_id={encounter}"
        )))
        .send()
        .await
        .expect("types")
        .json()
        .await
        .expect("json");
    let codes: Vec<&str> = types
        .as_array()
        .expect("types")
        .iter()
        .filter_map(|t| t["code"].as_str())
        .collect();
    assert!(codes.contains(&"nursing"), "{codes:?}");
    assert!(
        !codes.contains(&"consultation"),
        "no clinic consultation at home: {codes:?}"
    );

    let (status, note) = send(
        &nurse_csrf,
        nurse_client
            .post(app.url(&format!("/api/encounters/{encounter}/clinical-notes")))
            .json(&json!({ "note_type_code": "nursing",
                           "sections": [{ "code": "observation", "text": "<p>Wound clean, dressing changed</p>" }] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{note}");
    let note_id = note["id"].as_str().expect("note").to_owned();
    let (status, signed) = send(
        &nurse_csrf,
        nurse_client
            .post(app.url(&format!("/api/clinical-notes/{note_id}/sign")))
            .json(&json!({})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    assert_eq!(signed["status"], "signed");

    let (status, _) = send(
        &other_csrf,
        other_client
            .post(app.url(&format!("/api/encounters/{encounter}/clinical-notes")))
            .json(&json!({ "note_type_code": "nursing" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a nurse not sent does not open the visit"
    );
}

#[tokio::test]
async fn doctors_and_nurses_reach_home_care_and_the_front_desk_does_not() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    for (role, expected) in [
        ("doctor", StatusCode::OK),
        ("nurse", StatusCode::OK),
        ("receptionist", StatusCode::FORBIDDEN),
    ] {
        let (_, client, staff_csrf) = staff(&app, &csrf, role).await;
        let (status, body) =
            send(&staff_csrf, client.get(app.url("/api/home-health/visits"))).await;
        assert_eq!(status, expected, "{role}: {body}");
    }
}

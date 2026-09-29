//! Editing a user changes only what the edit names.

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder, body: Value) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a doctor with a registration number and a department, When an admin
/// deactivates them, Then both survive; When the admin empties the
/// specialization, Then it clears.
#[tokio::test]
async fn deactivating_a_doctor_keeps_their_registration_and_departments() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.is_active LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let tag = &Uuid::new_v4().simple().to_string()[..10];

    let (status, user) = send(
        &csrf,
        app.client.post(app.url("/api/setup/users")),
        json!({
            "username": format!("partial_{tag}"),
            "email": format!("partial_{tag}@example.test"),
            "password": format!("Partial#{tag}Aa9"),
            "full_name": "Partial Update Doctor",
            "role": "doctor",
            "specialization": "Cardiology",
            "medical_registration_number": format!("REG-{tag}"),
            "department_ids": [department],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{user}");
    let url = app.url(&format!(
        "/api/setup/users/{}",
        user["id"].as_str().expect("id")
    ));

    let (status, after) = send(&csrf, app.client.put(&url), json!({ "is_active": false })).await;
    assert_eq!(status, StatusCode::OK, "{after}");
    assert_eq!(after["is_active"], false);
    assert_eq!(after["medical_registration_number"], format!("REG-{tag}"));
    assert_eq!(after["department_ids"], json!([department]));
    assert_eq!(after["specialization"], "Cardiology");

    let (status, cleared) =
        send(&csrf, app.client.put(&url), json!({ "specialization": "" })).await;
    assert_eq!(status, StatusCode::OK, "{cleared}");
    assert_eq!(
        cleared["specialization"],
        Value::Null,
        "an emptied field clears"
    );
    assert_eq!(cleared["department_ids"], json!([department]));
}

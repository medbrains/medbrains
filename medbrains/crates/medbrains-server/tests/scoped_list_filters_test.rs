//! Filtering a list as scoped staff (not a bypass role).
//!
//! The visible-record set is the list query's `$2`; binding it after the
//! filters sent the array to a scalar placeholder, and every filtered list a
//! doctor or pharmacist opened answered 500.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::json;
use uuid::Uuid;

/// A staff member of this role in the department with this code, signed in on
/// their own client.
async fn staff(app: &common::TestApp, csrf: &str, role: &str, department: &str) -> Client {
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = $1",
    )
    .bind(department)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("scoped_{tag}"), format!("Scoped#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Scoped {role}"),
            "role": role,
            "department_ids": [department],
        }))
        .send()
        .await
        .expect("create user");
    assert_eq!(resp.status(), StatusCode::OK);

    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let resp = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    assert_eq!(resp.status(), StatusCode::OK);
    client
}

/// Give the department one grant of this type, so the visible set is not
/// empty — an empty set answers before the query runs, and would hide the bug.
async fn seed_visible(app: &common::TestApp, object_type: &str, department: &str) {
    sqlx::query(
        "INSERT INTO relation_tuples (tuple_id, tenant_id, object_type, object_id, relation, \
           subject_type, subject_id, granted_by, granted_reason, source) \
         SELECT gen_random_uuid(), d.tenant_id, $1, gen_random_uuid(), 'dept_member', \
           'department', d.id::text, u.id, 'scoped_list_filters_test', 'explicit' \
           FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = $2",
    )
    .bind(object_type)
    .bind(department)
    .execute(&app.db)
    .await
    .expect("seed grant");
}

async fn status_of(app: &common::TestApp, client: &Client, path: &str) -> StatusCode {
    client
        .get(app.url(path))
        .send()
        .await
        .expect("list")
        .status()
}

#[tokio::test]
async fn a_pharmacist_filters_orders_by_status() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    seed_visible(&app, "pharmacy_order", "PHARMACY").await;
    let pharmacist = staff(&app, &csrf, "pharmacist", "PHARMACY").await;
    let path = "/api/pharmacy/orders?status=ordered";
    assert_eq!(status_of(&app, &pharmacist, path).await, StatusCode::OK);
}

#[tokio::test]
async fn a_doctor_filters_visits_by_status() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    seed_visible(&app, "encounter", "GEN-MEDICINE").await;
    let doctor = staff(&app, &csrf, "doctor", "GEN-MEDICINE").await;
    let path = "/api/opd/encounters?status=open";
    assert_eq!(status_of(&app, &doctor, path).await, StatusCode::OK);
}

//! Someone refused a page asks for access from the access-denied screen. The
//! request used to sit unseen until an administrator happened to open the
//! Access requests page; now everyone who can approve it is told — never a
//! security guard, whose door-access rights once doubled as approval — and the
//! requester is not told about their own request.

mod common;

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

#[tokio::test]
async fn an_access_request_tells_the_people_who_can_approve_it() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant)
        .fetch_one(&app.db)
        .await
        .expect("department");
    let t = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let (username, password) = (format!("rc_{t}"), format!("Rc#{t}Aa9"));
    let created = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", &admin_csrf)
        .json(&json!({ "username": username, "email": format!("{username}@example.test"),
                       "password": password, "full_name": format!("Reception {t}"),
                       "role": "receptionist", "department_ids": [dept] }))
        .send()
        .await
        .expect("create user");
    assert!(created.status().is_success(), "create: {}", created.status());

    let desk = Client::builder().cookie_store(true).build().expect("client");
    let login: Value = desk
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or("").to_owned();
    let expires = (chrono::Utc::now() + chrono::Duration::hours(8)).to_rfc3339();
    let resp = desk
        .post(app.url("/api/iam/access-requests"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "requested_permissions": ["blood_bank.donors.list"],
                       "reason": format!("Covering the blood bank desk {t}"),
                       "requested_expires_at": expires }))
        .send()
        .await
        .expect("request access");
    assert_eq!(resp.status(), StatusCode::OK);
    let request: Value = resp.json().await.expect("request json");
    let request_id = request["id"].as_str().unwrap_or_default().to_owned();

    // Read the rows, not the inbox page: the inbox lists emergencies first, so
    // a long-lived dev database pages a new notice out of sight.
    let recipients: Vec<String> = sqlx::query_scalar(
        "SELECT u.username FROM notifications n JOIN users u ON u.id = n.user_id \
          WHERE n.entity_id = $1::uuid AND n.title = 'Access request waiting for review' \
            AND n.action_url = '/admin/access-requests'",
    )
    .bind(&request_id)
    .fetch_all(&app.db)
    .await
    .expect("notifications");
    assert!(recipients.iter().any(|u| u == "admin"), "the approver is told: {recipients:?}");
    assert!(
        !recipients.contains(&username),
        "the requester is not told of their own request"
    );
    // Door-access rights are not permission-granting rights: a security guard
    // holds `security.access.manage` and must not be asked to approve.
    let guards: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.user_id \
          WHERE n.entity_id = $1::uuid AND u.role::text = 'security_guard'",
    )
    .bind(&request_id)
    .fetch_one(&app.db)
    .await
    .expect("guards");
    assert_eq!(guards, 0, "a security guard is not an access-request approver");
}

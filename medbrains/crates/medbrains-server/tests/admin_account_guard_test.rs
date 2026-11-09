//! Only an administrator gives, removes or changes an administrator account.
//!
//! `admin.users.create` and `.update` are delegated to user managers. Held any way but a bypass
//! role (here `access_matrix.extra`, or an access group), they must not promote anyone to
//! `hospital_admin` or `super_admin`, nor edit, reset, deactivate or remove an account that holds
//! one; a bypass administrator still can.

use crate::common;

use medbrains_core::permissions::admin::users::{CREATE, UPDATE};
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// Sends `body` with `method` to `path` as this client and returns the status.
async fn send(
    app: &common::TestApp,
    (client, csrf): (&Client, &str),
    method: reqwest::Method,
    path: &str,
    body: Value,
) -> StatusCode {
    client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request")
        .status()
}

/// Every refused change, as `caller`, on a fresh nurse and a fresh hospital administrator.
async fn assert_refused(app: &common::TestApp, admin_csrf: &str, caller: (&Client, &str)) {
    use reqwest::Method;
    let nurse = common::provision_staff(app, admin_csrf, "nurse", &[]).await;
    let admin = common::provision_staff(app, admin_csrf, "hospital_admin", &[]).await;
    let (n, a) = (nurse.user_id, admin.user_id);
    for role in ["hospital_admin", "super_admin"] {
        let promote = json!({ "role": role });
        let path = format!("/api/setup/users/{n}");
        assert_eq!(
            send(app, caller, Method::PUT, &path, promote).await,
            StatusCode::FORBIDDEN
        );
        let tag = &Uuid::new_v4().simple().to_string()[..8];
        let make = json!({ "username": format!("esc_{tag}"), "email": format!("esc_{tag}@example.test"),
                           "password": format!("Esc#{tag}Aa9"), "full_name": "Escalated", "role": role });
        let created = send(app, caller, Method::POST, "/api/setup/users", make).await;
        assert_eq!(created, StatusCode::FORBIDDEN, "{role}");
    }
    let edits = [
        (
            Method::PUT,
            format!("/api/setup/users/{a}"),
            json!({ "role": "nurse" }),
        ),
        (
            Method::PUT,
            format!("/api/setup/users/{a}"),
            json!({ "is_active": false }),
        ),
        (
            Method::PUT,
            format!("/api/setup/users/{a}"),
            json!({ "full_name": "Taken over" }),
        ),
        (
            Method::POST,
            format!("/api/setup/users/{a}/reset-password"),
            json!({}),
        ),
        (
            Method::PUT,
            format!("/api/setup/users/{a}/access-matrix"),
            json!({ "extra_permissions": [], "denied_permissions": ["admin.users.list"] }),
        ),
    ];
    for (method, path, body) in edits {
        assert_eq!(
            send(app, caller, method, &path, body).await,
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    let role: String = sqlx::query_scalar("SELECT role::text FROM users WHERE id = $1")
        .bind(n)
        .fetch_one(&app.db)
        .await
        .expect("role");
    assert_eq!(role, "nurse");
    let (role, active): (String, bool) =
        sqlx::query_as("SELECT role::text, is_active FROM users WHERE id = $1")
            .bind(a)
            .fetch_one(&app.db)
            .await
            .expect("admin");
    assert_eq!((role.as_str(), active), ("hospital_admin", true));
}

#[tokio::test]
async fn a_user_manager_by_extra_permission_cannot_touch_an_administrator() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let manager =
        common::provision_staff_with(&app, &admin_csrf, "nurse", &[CREATE, UPDATE], &[]).await;
    // Ordinary work stays open to the manager.
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let path = format!("/api/setup/users/{}", nurse.user_id);
    let caller = (&manager.client, manager.csrf.as_str());
    let rename = json!({ "full_name": "Renamed nurse" });
    assert_eq!(
        send(&app, caller, reqwest::Method::PUT, &path, rename).await,
        StatusCode::OK
    );
    assert_refused(&app, &admin_csrf, caller).await;
}

#[tokio::test]
async fn a_user_manager_by_access_group_cannot_touch_an_administrator() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let staff = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let group: Uuid = sqlx::query_scalar(
        "INSERT INTO access_groups (tenant_id, code, name, permissions) \
         SELECT tenant_id, $2, $2, $3 FROM users WHERE id = $1 RETURNING id",
    )
    .bind(staff.user_id)
    .bind(format!("user_managers_{tag}"))
    .bind(json!([CREATE, UPDATE]))
    .fetch_one(&app.db)
    .await
    .expect("group");
    sqlx::query(
        "INSERT INTO access_group_members (group_id, user_id, tenant_id) \
         SELECT $1, id, tenant_id FROM users WHERE id = $2",
    )
    .bind(group)
    .bind(staff.user_id)
    .execute(&app.db)
    .await
    .expect("member");
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(staff.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": staff.password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    assert_refused(&app, &admin_csrf, (&client, &csrf)).await;
}

#[tokio::test]
async fn a_bypass_administrator_promotes_and_changes_administrators() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let caller = (&app.client, admin_csrf.as_str());
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let admin = common::provision_staff(&app, &admin_csrf, "hospital_admin", &[]).await;
    let promote = json!({ "role": "hospital_admin" });
    let path = format!("/api/setup/users/{}", nurse.user_id);
    assert_eq!(
        send(&app, caller, reqwest::Method::PUT, &path, promote).await,
        StatusCode::OK
    );
    let demote = json!({ "role": "nurse" });
    let path = format!("/api/setup/users/{}", admin.user_id);
    assert_eq!(
        send(&app, caller, reqwest::Method::PUT, &path, demote).await,
        StatusCode::OK
    );
    let reset = format!("/api/setup/users/{}/reset-password", nurse.user_id);
    assert_eq!(
        send(&app, caller, reqwest::Method::POST, &reset, json!({})).await,
        StatusCode::OK
    );
}

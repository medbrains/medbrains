//! Only an administrator gives, removes or changes an administrator account.
//!
//! `admin.users.create` and `.update` are delegated to user managers. Held any way but a bypass
//! role (here `access_matrix.extra`, or an access group), they must not promote anyone to
//! `hospital_admin` or `super_admin`, nor edit, reset, deactivate or remove an account that holds
//! one; a bypass administrator still can.

use crate::common;

use medbrains_core::permissions::{admin, hr};
use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// What a delegated user manager holds: every permission one of the guarded handlers asks for,
/// so a refusal below can only come from the administrator-account guard.
const MANAGER: [&str; 6] = [
    admin::users::CREATE,
    admin::users::UPDATE,
    admin::users::DELETE,
    hr::employees::CREATE,
    hr::employees::UPDATE,
    admin::settings::modules::MANAGE,
];

/// Sends `body` with `method` to `path` as this client and returns the status.
async fn send(
    app: &common::TestApp,
    (client, csrf): (&Client, &str),
    method: Method,
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

/// As [`send`], asserting the administrator-account guard refused it, not a missing permission.
async fn assert_guarded(
    app: &common::TestApp,
    (client, csrf): (&Client, &str),
    method: Method,
    path: &str,
    body: Value,
) {
    let resp = client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert_eq!(status, StatusCode::FORBIDDEN, "{path}: {text}");
    assert!(text.contains("Only an administrator"), "{path}: {text}");
}

/// A new user body with `role`, unique per call.
fn new_user(role: &str) -> Value {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    json!({ "username": format!("esc_{tag}"), "email": format!("esc_{tag}@example.test"),
            "password": format!("Esc#{tag}Aa9"), "full_name": "Escalated", "role": role })
}

/// The bulk, import, invitation, HR and onboarding paths that also give or change
/// an administrator account, each refused to `caller`; `a` is a hospital administrator.
async fn assert_refused_elsewhere(
    app: &common::TestApp,
    admin_csrf: &str,
    caller: (&Client, &str),
    a: Uuid,
) {
    let bulk = json!({ "users": [new_user("nurse"), new_user("hospital_admin")] });
    assert_guarded(app, caller, Method::POST, "/api/setup/users/bulk", bulk).await;
    let invite = json!({ "email": format!("inv_{}@example.test", Uuid::new_v4().simple()),
                         "role": "super_admin" });
    assert_guarded(app, caller, Method::POST, "/api/admin/invitations", invite).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let hire = json!({ "employee_code": format!("E{tag}"), "first_name": "Hired",
                       "provision_login": true, "login_username": format!("hire_{tag}"),
                       "login_password": format!("Hire#{tag}Aa9"), "login_role": "hospital_admin" });
    assert_guarded(app, caller, Method::POST, "/api/hr/employees", hire).await;
    // Per-user widget access goes through `/access-matrix`, refused in `assert_refused`; the
    // dashboard crate's `admin_set_user_widget_access` is mounted on no route.
    let setup = json!({ "facilities": [], "locations": [], "departments": [], "roles": [],
                        "module_statuses": {}, "users": [new_user("super_admin")] });
    assert_guarded(app, caller, Method::POST, "/api/onboarding/setup", setup).await;

    // Terminating the administrator's employee record would deactivate their login.
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let record = json!({ "employee_code": format!("E{tag}"), "first_name": "Admin", "user_id": a });
    let employee: Value = app
        .client
        .post(app.url("/api/hr/employees"))
        .header("x-csrf-token", admin_csrf)
        .json(&record)
        .send()
        .await
        .expect("employee")
        .json()
        .await
        .expect("employee json");
    let path = format!(
        "/api/hr/employees/{}",
        employee["id"].as_str().unwrap_or_default()
    );
    let terminate = json!({ "status": "terminated" });
    assert_guarded(app, caller, Method::PUT, &path, terminate).await;

    // The CSV import skips the administrator row and imports the rest.
    let tags = Uuid::new_v4().simple().to_string();
    let (ok, esc) = (&tags[..8], &tags[8..16]);
    let csv = json!({ "headers": ["username", "full_name", "email", "role"], "rows": [
        { "values": [format!("ok_{ok}"), "Fine", format!("ok_{ok}@example.test"), "nurse"] },
        { "values": [format!("esc_{esc}"), "Esc", format!("esc_{esc}@example.test"), "super_admin"] },
    ]});
    let (client, csrf) = caller;
    let result: Value = client
        .post(app.url("/api/setup/users/import"))
        .header("x-csrf-token", csrf)
        .json(&csv)
        .send()
        .await
        .expect("import")
        .json()
        .await
        .expect("import json");
    assert_eq!(
        (result["imported"].as_i64(), result["skipped"].as_i64()),
        (Some(1), Some(1)),
        "{result}"
    );
    let minted: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
        .bind(format!("esc_{esc}"))
        .fetch_one(&app.db)
        .await
        .expect("minted");
    assert!(!minted, "{result}");
}

/// Every refused change, as `caller`, on a fresh nurse and a fresh hospital administrator.
async fn assert_refused(app: &common::TestApp, admin_csrf: &str, caller: (&Client, &str)) {
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
        (Method::DELETE, format!("/api/setup/users/{a}"), json!({})),
    ];
    for (method, path, body) in edits {
        assert_guarded(app, caller, method, &path, body).await;
    }
    assert_refused_elsewhere(app, admin_csrf, caller, a).await;
    let role: String = sqlx::query_scalar("SELECT role::text FROM users WHERE id = $1")
        .bind(n)
        .fetch_one(&app.db)
        .await
        .expect("role");
    assert_eq!(role, "nurse");
    let (role, active): (String, bool) = sqlx::query_as(
        "SELECT role::text, is_active FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
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
    let manager = common::provision_staff_with(&app, &admin_csrf, "nurse", &MANAGER, &[]).await;
    // Ordinary work stays open to the manager.
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let path = format!("/api/setup/users/{}", nurse.user_id);
    let caller = (&manager.client, manager.csrf.as_str());
    let rename = json!({ "full_name": "Renamed nurse" });
    assert_eq!(
        send(&app, caller, Method::PUT, &path, rename).await,
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
    .bind(json!(MANAGER))
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
        send(&app, caller, Method::PUT, &path, promote).await,
        StatusCode::OK
    );
    let demote = json!({ "role": "nurse" });
    let path = format!("/api/setup/users/{}", admin.user_id);
    assert_eq!(
        send(&app, caller, Method::PUT, &path, demote).await,
        StatusCode::OK
    );
    let reset = format!("/api/setup/users/{}/reset-password", nurse.user_id);
    assert_eq!(
        send(&app, caller, Method::POST, &reset, json!({})).await,
        StatusCode::OK
    );
}

/// Accepts a fresh `role` invitation that `inviter` sent, returning the status.
async fn accept_invitation(app: &common::TestApp, role: &str, inviter: Uuid) -> StatusCode {
    let raw = Uuid::new_v4().simple().to_string();
    let tag = &raw[..8];
    sqlx::query(
        "INSERT INTO user_invitations (tenant_id, email, role, token_hash, invited_by, expires_at) \
         SELECT tenant_id, $2, $3, $4, id, now() + interval '1 day' FROM users WHERE id = $1",
    )
    .bind(inviter)
    .bind(format!("inv_{tag}@example.test"))
    .bind(role)
    .bind(hex::encode(Sha256::digest(raw.as_bytes())))
    .execute(&app.db)
    .await
    .expect("invitation");
    let accept = json!({ "username": format!("inv_{tag}"), "password": format!("Inv#{tag}Aa9") });
    app.client
        .post(app.url(&format!("/api/public/invitations/{raw}/accept")))
        .json(&accept)
        .send()
        .await
        .expect("accept")
        .status()
}

#[tokio::test]
async fn an_administrator_invitation_holds_only_while_its_inviter_is_an_administrator() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let admin = common::provision_staff(&app, &admin_csrf, "hospital_admin", &[]).await;
    let from_nurse = accept_invitation(&app, "hospital_admin", nurse.user_id).await;
    assert_eq!(from_nurse, StatusCode::FORBIDDEN);
    let from_admin = accept_invitation(&app, "hospital_admin", admin.user_id).await;
    assert_eq!(from_admin, StatusCode::OK);
    // A nurse invitation does not need an administrator behind it.
    assert_eq!(
        accept_invitation(&app, "nurse", nurse.user_id).await,
        StatusCode::OK
    );
}

#[tokio::test]
async fn onboarding_setup_is_closed_on_a_tenant_that_never_ran_init() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let rows: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM onboarding_progress p JOIN users u ON u.tenant_id = p.tenant_id \
         WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("progress");
    assert_eq!(
        rows, 0,
        "the seeded tenant is the case under test: no progress row"
    );
    let setup = json!({ "facilities": [], "locations": [], "departments": [], "roles": [],
                        "module_statuses": {}, "users": [] });
    let caller = (&app.client, admin_csrf.as_str());
    let status = send(&app, caller, Method::POST, "/api/onboarding/setup", setup).await;
    assert_eq!(status, StatusCode::CONFLICT);
}

//! Every other path that hands out a role or codes answers to the same rule:
//! a caller outside the bypass roles grants only what they hold now.
//!
//! The first round closed the user, group, role and temporary-grant screens.
//! These are the side doors: renaming a role, an HR login, the Setup workbook,
//! the onboarding wizard, CSV import, bulk create, lifting a denial, and the
//! field-access levels. Each test fails if its rule is taken out.

use crate::common::{self, Staff};
use crate::no_self_grant_test::{
    HELD, LACKED, MANAGER, admin, assert_refused_naming, send, sign_in_again,
};

use reqwest::StatusCode;
use serde_json::{Value, json};

/// A built-in role whose seeded codes include `LACKED`, which the manager
/// (a receptionist with `MANAGER` extras) does not hold.
const WIDER_ROLE: &str = "lab_technician";

/// A user manager who also holds `more`.
async fn manager_with(app: &common::TestApp, admin: &Staff, more: &[&str]) -> Staff {
    let codes: Vec<&str> = MANAGER.iter().chain(more).copied().collect();
    common::provision_staff_with(app, &admin.csrf, "receptionist", &codes, &[]).await
}

/// A short unique suffix for usernames and codes.
fn tag() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..8].to_owned()
}

/// A new account's fields, for the user create, bulk and onboarding bodies.
fn person(tag: &str, prefix: &str, role: &str) -> Value {
    json!({
        "username": format!("{prefix}{tag}"), "email": format!("{prefix}{tag}@example.test"),
        "password": format!("Grant#{tag}Aa9"), "full_name": "Granted Person", "role": role,
    })
}

/// A role code cannot be renamed once it is built in or held, nor to a code
/// staff hold; an unused custom role can be. Editing a role's codes adds only
/// codes the caller holds.
#[tokio::test]
async fn a_role_code_rename_is_refused_when_it_would_move_codes() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &[]).await;
    let t = tag();

    let system: String =
        sqlx::query_scalar("SELECT id::text FROM roles WHERE code = 'receptionist' LIMIT 1")
            .fetch_one(&app.db)
            .await
            .expect("receptionist role");
    let rename = |code: &str| json!({ "code": code, "name": "Front desk renamed" });
    let url = |id: &str| app.url(&format!("/api/setup/roles/{id}"));
    let (status, body) = send(&admin, admin.client.put(url(&system)), rename(&format!("x{t}"))).await;
    assert_eq!(status, StatusCode::CONFLICT, "a built-in role: {body}");

    let (status, role) = send(
        &admin,
        admin.client.post(app.url("/api/setup/roles")),
        json!({ "code": format!("c{t}"), "name": format!("Custom {t}"), "permissions": [HELD] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{role}");
    let custom = role["id"].as_str().unwrap_or_default().to_owned();
    let (status, body) = send(&admin, admin.client.put(url(&custom)), rename("nurse")).await;
    assert_eq!(status, StatusCode::CONFLICT, "to a code staff hold: {body}");
    let (status, body) =
        send(&admin, admin.client.put(url(&custom)), rename(&format!("d{t}"))).await;
    assert_eq!(status, StatusCode::OK, "an unused custom role: {body}");

    let with = |codes: &[&str]| {
        json!({ "code": format!("d{t}"), "name": "Custom renamed", "permissions": codes })
    };
    let (status, body) =
        send(&manager, manager.client.put(url(&custom)), with(&[HELD, LACKED])).await;
    assert_refused_naming(status, &body, "update_role with codes");
    let (status, body) = send(&manager, manager.client.put(url(&custom)), with(&[])).await;
    assert_eq!(status, StatusCode::OK, "dropping codes: {body}");
}

/// Given a manager without `LACKED`, When they give a role carrying it by
/// create, bulk create or CSV import, or lift a denial of it, Then each is
/// refused; When HR provisions a login with a bypass role, Then it is refused.
#[tokio::test]
async fn every_account_path_grants_only_held_codes() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &["hr.employees.create"]).await;
    let t = tag();

    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/setup/users")),
        person(&t, "cw", WIDER_ROLE),
    )
    .await;
    assert_refused_naming(status, &body, "create with a wider role");
    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/setup/users/bulk")),
        json!({ "users": [person(&t, "bw", WIDER_ROLE)] }),
    )
    .await;
    assert_refused_naming(status, &body, "bulk create with a wider role");
    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/setup/users/import")),
        json!({
            "headers": ["username", "full_name", "email", "role"],
            "rows": [{ "values": [format!("iw{t}"), "Imported", format!("iw{t}@example.test"), WIDER_ROLE] }],
        }),
    )
    .await;
    assert_refused_naming(status, &body, "CSV import with a wider role");

    let target = common::provision_staff_with(&app, &admin.csrf, "receptionist", &[], &[LACKED]).await;
    let matrix = app.url(&format!("/api/setup/users/{}/access-matrix", target.user_id));
    let lift = json!({ "extra_permissions": [], "denied_permissions": [] });
    let (status, body) = send(&manager, manager.client.put(&matrix), lift).await;
    assert_refused_naming(status, &body, "lifting a denial");

    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/hr/employees")),
        json!({
            "employee_code": format!("E{t}"), "first_name": "Hired", "email": format!("hr{t}@example.test"),
            "provision_login": true, "login_username": format!("hr{t}"),
            "login_password": format!("Grant#{t}Aa9"), "login_role": "super_admin",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "an HR bypass login: {body}");
    assert!(
        body["detail"].as_str().is_some_and(|d| d.contains("super_admin role")),
        "refused for the role, not something else: {body}"
    );
}

/// Given a manager with the workbook permission, When the Staff sheet gives a
/// role beyond theirs, Then the upload is refused; When it changes their own
/// role, Then that row is a problem and nothing applies.
#[tokio::test]
async fn the_workbook_cannot_grant_beyond_the_caller_or_change_their_row() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &["admin.workbook.import"]).await;
    let me: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(manager.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");
    let t = tag();
    let sheet = |username: &str, role: &str| {
        json!({ "dry_run": true, "staff": [{
            "username": username, "full_name": "Sheet Person",
            "email": format!("{username}@example.test"), "role": role,
        }] })
    };
    let upload = app.url("/api/setup/workbook/import");

    let (status, body) =
        send(&manager, manager.client.post(&upload), sheet(&format!("ws{t}"), WIDER_ROLE)).await;
    assert_refused_naming(status, &body, "a sheet with a wider role");

    let (status, body) = send(&manager, manager.client.post(&upload), sheet(&me, "nurse")).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["applied"], false, "{body}");
    assert!(
        body["problems"].to_string().contains("This is you"),
        "their own row is refused: {body}"
    );
}

/// Given a manager with the modules permission, When the onboarding wizard
/// would create an account with a bypass role, or one beyond theirs, Then it
/// is refused before anything is written.
#[tokio::test]
async fn the_onboarding_wizard_grants_only_held_roles() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &["admin.settings.modules.manage"]).await;
    let t = tag();
    let wizard = |user: Value| {
        json!({
            "facilities": [], "locations": [], "departments": [], "roles": [],
            "module_statuses": {}, "users": [user],
        })
    };
    let url = app.url("/api/onboarding/setup");

    let (status, body) =
        send(&manager, manager.client.post(&url), wizard(person(&t, "ob", "super_admin"))).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "a bypass account: {body}");
    let (status, body) =
        send(&manager, manager.client.post(&url), wizard(person(&t, "ow", WIDER_ROLE))).await;
    assert_refused_naming(status, &body, "a wider account");
}

/// Given a manager who sees a field masked, When they set it to `view` for
/// someone, Then it is refused naming the field; `mask` and stricter pass.
#[tokio::test]
async fn field_access_opens_no_wider_than_the_caller_sees() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &[]).await;
    const FIELD: &str = "patients.preferred_language";
    let own = app.url(&format!("/api/setup/users/{}/access-matrix", manager.user_id));
    let (status, body) = send(
        &admin,
        admin.client.put(&own),
        json!({ "extra_permissions": MANAGER, "denied_permissions": [], "field_access": { FIELD: "mask" } }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let manager = sign_in_again(&app, &manager).await;

    let target = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let matrix = app.url(&format!("/api/setup/users/{}/access-matrix", target.user_id));
    let level = |l: &str| {
        json!({ "extra_permissions": [], "denied_permissions": [], "field_access": { FIELD: l } })
    };
    let (status, body) = send(&manager, manager.client.put(&matrix), level("view")).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");
    assert!(body["detail"].as_str().is_some_and(|d| d.contains(FIELD)), "{body}");
    let (status, body) = send(&manager, manager.client.put(&matrix), level("mask")).await;
    assert_eq!(status, StatusCode::OK, "as the manager sees it: {body}");
    let (status, body) = send(&manager, manager.client.put(&matrix), level("hidden")).await;
    assert_eq!(status, StatusCode::OK, "stricter: {body}");
}

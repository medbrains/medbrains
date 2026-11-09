//! Round-4 follow-ups to "grant only what you hold": the sign-in policy, a
//! provider's removal, HR offboarding that is not a move, HR linking a login
//! at creation, and a second delete of the same account.

use crate::common::{self, Staff};
use crate::no_self_grant_test::{MANAGER, admin, send};

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// A short unique suffix for codes.
fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_owned()
}

/// A user manager who also holds `more`.
async fn manager_with(app: &common::TestApp, admin: &Staff, more: &[&str]) -> Staff {
    let codes: Vec<&str> = MANAGER.iter().chain(more).copied().collect();
    common::provision_staff_with(app, &admin.csrf, "receptionist", &codes, &[]).await
}

/// A config bundle holding only `settings`.
fn bundle(settings: Value) -> Value {
    json!({ "dry_run": false, "bundle": {
        "bundle_version": 1, "exported_at": "2026-11-09T00:00:00Z",
        "document_templates": [], "settings": settings } })
}

/// Given a manager who manages settings, When they write the sign-in policy
/// through the settings API or a config import, Then both are refused; a
/// hospital administrator may, an unchanged policy re-imports, and other
/// categories are unaffected.
#[tokio::test]
async fn only_a_bypass_admin_writes_the_sign_in_policy() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &["admin.settings.general.manage"]).await;
    let settings = app.url("/api/setup/settings");
    let import = app.url("/api/setup/config-import");
    // `false` is the default, so the shared test tenant still signs in by password.
    let policy = json!({ "category": "auth", "key": "password_login_disabled", "value": false });
    let padded = json!({ "category": " auth", "key": "password_login_disabled", "value": true });
    let units = json!({ "category": "regression_test", "key": format!("u{}", tag()), "value": 1 });

    for body in [policy.clone(), padded] {
        let (status, answer) = send(&manager, manager.client.put(&settings), body.clone()).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{body}: {answer}");
    }
    let (status, answer) = send(&manager, manager.client.put(&settings), units.clone()).await;
    assert_eq!(status, StatusCode::OK, "another category: {answer}");
    let (status, answer) = send(&admin, admin.client.put(&settings), policy.clone()).await;
    assert_eq!(status, StatusCode::OK, "an administrator: {answer}");

    let changed = json!([{ "category": "auth", "key": "break_glass_username",
                           "value": format!("bg{}", tag()) }]);
    let (status, answer) = send(
        &manager,
        manager.client.post(&import),
        bundle(changed.clone()),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "an import that changes it: {answer}"
    );
    let (status, answer) = send(
        &manager,
        manager.client.post(&import),
        bundle(json!([policy, units])),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "an unchanged policy re-imports: {answer}"
    );
    let (status, answer) = send(&admin, admin.client.post(&import), bundle(changed)).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "an administrator's import: {answer}"
    );
}

/// Given a manager who manages settings, When they delete a sign-in
/// provider, Then it is refused and the provider stays; an administrator may.
#[tokio::test]
async fn only_a_bypass_admin_deletes_a_provider() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &["admin.settings.general.manage"]).await;
    let new = json!({ "code": format!("d{}", tag()), "name": "Old IdP", "protocol": "oidc" });
    let providers = app.url("/api/admin/sso/providers");
    let (status, provider) = send(&admin, admin.client.post(&providers), new).await;
    assert_eq!(status, StatusCode::OK, "{provider}");
    let one = app.url(&format!(
        "/api/admin/sso/providers/{}",
        provider["id"].as_str().unwrap_or_default()
    ));

    let (status, body) = send(&manager, manager.client.delete(&one), json!({})).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "a manager: {body}");
    let (status, body) = send(&admin, admin.client.delete(&one), json!({})).await;
    assert_eq!(status, StatusCode::OK, "an administrator: {body}");
}

/// An employee record made by the admin for `user`; its id.
async fn employee(app: &common::TestApp, admin: &Staff, user: Uuid) -> String {
    let (status, body) = send(
        admin,
        admin.client.post(app.url("/api/hr/employees")),
        json!({ "employee_code": format!("E{}", tag()), "first_name": "Staff", "user_id": user }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["id"].as_str().unwrap_or_default().to_owned()
}

/// Whether `user`'s login is active.
async fn is_active(app: &common::TestApp, user: Uuid) -> bool {
    sqlx::query_scalar("SELECT is_active FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("user")
}

/// Given an employee record already terminated and linked to an
/// administrator whose login was re-activated, When an HR clerk edits its
/// phone or moves it to another ending status, Then the login keeps its
/// access: only the move into an ending status revokes it.
#[tokio::test]
async fn hr_revokes_access_only_on_the_move_to_an_ending_status() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let clerk = manager_with(&app, &admin, &["hr.employees.update"]).await;
    let boss = common::provision_staff(&app, &admin.csrf, "hospital_admin", &[]).await;
    let record = employee(&app, &admin, boss.user_id).await;
    sqlx::query("UPDATE employees SET status = 'terminated' WHERE id = $1::uuid")
        .bind(&record)
        .execute(&app.db)
        .await
        .expect("terminated");
    let edit = |body: Value| {
        send(
            &clerk,
            clerk
                .client
                .put(app.url(&format!("/api/hr/employees/{record}"))),
            body,
        )
    };

    let (status, body) = edit(json!({ "phone": "9000000000" })).await;
    assert_eq!(status, StatusCode::OK, "a phone edit: {body}");
    let (status, body) = edit(json!({ "status": "resigned" })).await;
    assert_eq!(status, StatusCode::OK, "ending to ending: {body}");
    assert!(
        is_active(&app, boss.user_id).await,
        "the administrator keeps their login"
    );
}

/// Given an HR clerk who creates employees, When they create one linked to
/// their own login or an administrator's, Then each is refused; one linked to
/// a receptionist goes through.
#[tokio::test]
async fn hr_cannot_create_a_record_linked_to_themselves_or_an_administrator() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let clerk = manager_with(&app, &admin, &["hr.employees.create"]).await;
    let boss = common::provision_staff(&app, &admin.csrf, "hospital_admin", &[]).await;
    let other = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let create = |user: Uuid| {
        let body = json!({ "employee_code": format!("E{}", tag()), "first_name": "Staff",
                           "user_id": user });
        send(
            &clerk,
            clerk.client.post(app.url("/api/hr/employees")),
            body,
        )
    };

    let (status, body) = create(clerk.user_id).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "their own login: {body}");
    let (status, body) = create(boss.user_id).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "an administrator's: {body}");
    let (status, body) = create(other.user_id).await;
    assert_eq!(status, StatusCode::OK, "a receptionist's: {body}");
}

/// Given a deleted account, When it is deleted or its password reset again,
/// Then each answers 404.
#[tokio::test]
async fn a_deleted_account_is_not_found() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let clerk = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let user = app.url(&format!("/api/setup/users/{}", clerk.user_id));

    let (status, body) = send(&admin, admin.client.delete(&user), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(&admin, admin.client.delete(&user), json!({})).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "a second delete: {body}");
    let reset = app.url(&format!(
        "/api/setup/users/{}/reset-password",
        clerk.user_id
    ));
    let (status, body) = send(&admin, admin.client.post(&reset), json!({})).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "a reset: {body}");
}

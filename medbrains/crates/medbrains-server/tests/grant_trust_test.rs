//! The last ways round "grant only what you hold" (who a provider trusts:
//! `sso_mapping_guard_test`): adopting an administrator by email, deleting or offboarding an
//! administrator or yourself, invitations from someone narrowed since, and a
//! Staff sheet that must re-import as it was exported.

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

/// Given a hospital administrator and an ordinary account, When an SSO
/// sign-in asserts each one's email, Then only the ordinary one is adopted.
#[tokio::test]
async fn an_sso_email_never_adopts_an_administrator() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let boss = common::provision_staff(&app, &admin.csrf, "hospital_admin", &[]).await;
    let clerk = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let email_of = |id: Uuid| {
        sqlx::query_as::<_, (Uuid, String)>("SELECT tenant_id, email FROM users WHERE id = $1")
            .bind(id)
            .fetch_one(&app.db)
    };
    for (who, adopted) in [(boss.user_id, None), (clerk.user_id, Some(clerk.user_id))] {
        let (tenant, email) = email_of(who).await.expect("email");
        let mut tx = app.db.begin().await.expect("tx");
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await.expect("tenant");
        let found = medbrains_sso_login::email_link_candidate(&mut tx, tenant, &email)
            .await
            .expect("lookup");
        assert_eq!(found, adopted, "{email}");
    }
}

/// Given a manager who may delete users, When they delete a hospital
/// administrator or themselves, Then each is refused and the account stays;
/// another receptionist they may delete.
#[tokio::test]
async fn a_manager_cannot_delete_an_administrator_or_themselves() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &["admin.users.delete"]).await;
    let boss = common::provision_staff(&app, &admin.csrf, "hospital_admin", &[]).await;
    let clerk = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let delete = |id: Uuid| {
        send(&manager, manager.client.delete(app.url(&format!("/api/setup/users/{id}"))), json!({}))
    };
    let live = |id: Uuid| {
        sqlx::query_scalar::<_, bool>("SELECT deleted_at IS NULL FROM users WHERE id = $1")
            .bind(id)
            .fetch_one(&app.db)
    };

    let (status, body) = delete(boss.user_id).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "an administrator: {body}");
    let (status, body) = delete(manager.user_id).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "themselves: {body}");
    assert!(live(boss.user_id).await.expect("boss") && live(manager.user_id).await.expect("me"));
    let (status, body) = delete(clerk.user_id).await;
    assert_eq!(status, StatusCode::OK, "a receptionist: {body}");
}

/// An employee record made by the admin, linked to `user` if given; its id.
async fn employee(app: &common::TestApp, admin: &Staff, user: Option<Uuid>) -> String {
    let t = tag();
    let (status, body) = send(
        admin,
        admin.client.post(app.url("/api/hr/employees")),
        json!({ "employee_code": format!("E{t}"), "first_name": "Staff", "user_id": user }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["id"].as_str().unwrap_or_default().to_owned()
}

/// Given an HR clerk, When they link an employee record to their own login
/// or an administrator's, or end the employment of one linked to an
/// administrator, Then each is refused; ending a receptionist's goes through.
#[tokio::test]
async fn hr_cannot_offboard_an_administrator_or_relink_to_themselves() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let clerk = manager_with(&app, &admin, &["hr.employees.update"]).await;
    let boss = common::provision_staff(&app, &admin.csrf, "hospital_admin", &[]).await;
    let other = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let edit = |id: String, body: Value| {
        send(&clerk, clerk.client.put(app.url(&format!("/api/hr/employees/{id}"))), body)
    };

    let unlinked = employee(&app, &admin, None).await;
    let (status, body) = edit(unlinked.clone(), json!({ "user_id": clerk.user_id })).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "linking to themselves: {body}");
    let (status, body) = edit(unlinked, json!({ "user_id": boss.user_id })).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "linking to an administrator: {body}");
    let bosses = employee(&app, &admin, Some(boss.user_id)).await;
    let (status, body) = edit(bosses, json!({ "status": "terminated" })).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "terminating an administrator: {body}");
    let active: bool = sqlx::query_scalar("SELECT is_active FROM users WHERE id = $1")
        .bind(boss.user_id)
        .fetch_one(&app.db)
        .await
        .expect("boss");
    assert!(active, "the administrator's login is untouched");
    let others = employee(&app, &admin, Some(other.user_id)).await;
    let (status, body) = edit(others, json!({ "status": "terminated" })).await;
    assert_eq!(status, StatusCode::OK, "terminating a receptionist: {body}");
}

/// An invitation to `role` sent by `inviter`, written straight to the table
/// as the create screen would; the raw token.
async fn invitation(app: &common::TestApp, inviter: Uuid, role: &str) -> String {
    let raw = Uuid::new_v4().simple().to_string();
    sqlx::query(
        "INSERT INTO user_invitations (tenant_id, email, role, token_hash, invited_by, expires_at) \
         SELECT tenant_id, $2, $3, encode(sha256(convert_to($4, 'UTF8')), 'hex'), id, \
                now() + interval '1 day' FROM users WHERE id = $1",
    )
    .bind(inviter)
    .bind(format!("inv{}@example.test", &raw[..8]))
    .bind(role)
    .bind(&raw)
    .execute(&app.db)
    .await
    .expect("invitation");
    raw
}

/// Given invitations from a manager, When one is for a role whose codes the
/// manager no longer holds, Then accepting it is refused; one within their
/// codes is accepted.
#[tokio::test]
async fn an_invitation_is_checked_against_its_sender_on_acceptance() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = manager_with(&app, &admin, &[]).await;
    let accept = |raw: String| {
        let t = tag();
        app.client
            .post(app.url(&format!("/api/public/invitations/{raw}/accept")))
            .json(&json!({ "username": format!("in{t}"), "password": format!("Invite#{t}Aa9") }))
            .send()
    };

    let wider = invitation(&app, manager.user_id, "lab_technician").await;
    let resp = accept(wider).await.expect("accept");
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST, "a role beyond the sender");
    let within = invitation(&app, manager.user_id, "receptionist").await;
    let resp = accept(within).await.expect("accept");
    assert_eq!(resp.status(), StatusCode::OK, "{}", resp.text().await.unwrap_or_default());
}

/// Given a deactivated receptionist, When the Staff sheet is exported and
/// their row imported again, Then it applies and they stay deactivated.
#[tokio::test]
async fn an_exported_deactivated_row_imports_again() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let person = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let user = app.url(&format!("/api/setup/users/{}", person.user_id));
    let (status, body) = send(&admin, admin.client.put(&user), json!({ "is_active": false })).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let book: Value = app.get(&app.client, "/api/setup/workbook").await.json().await.expect("export");
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(person.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");
    let mut row = book["staff"]
        .as_array()
        .and_then(|s| s.iter().find(|s| s["username"] == username.as_str()))
        .cloned()
        .expect("the deactivated person is exported");
    row["row"] = json!(2);
    let (status, result) = send(
        &admin,
        admin.client.post(app.url("/api/setup/workbook/import")),
        json!({ "dry_run": false, "staff": [row] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["applied"], true, "{result}");
    let active: bool = sqlx::query_scalar("SELECT is_active FROM users WHERE id = $1")
        .bind(person.user_id)
        .fetch_one(&app.db)
        .await
        .expect("person");
    assert!(!active, "the sheet does not re-activate them");
}

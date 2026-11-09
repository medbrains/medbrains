//! The edges of "grant only what you hold": administrators' accounts, the
//! caller's own access scope, single sign-on, and removed group members.
//!
//! A manager outside the bypass roles must not edit an administrator's
//! account or their own departments and facilities; a directory group mapping
//! must not give what the mapper lacks, nor a bypass role; an SSO membership
//! must survive a second sign-in; and a removed group member must lose the
//! group's object access in the PG relation backend too.

use crate::common;
use crate::no_self_grant_test::{HELD, LACKED, MANAGER, admin, assert_refused_naming, send};

use medbrains_authz::{AuthzBackend, AuthzContext, Relation, Subject, backend_pg::PgAuthzBackend};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// A short unique suffix for codes.
fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_owned()
}

/// The tenant a user belongs to.
async fn tenant_of(app: &common::TestApp, user: Uuid) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// An access group carrying `code`, made by the admin; its id.
async fn group_with(app: &common::TestApp, admin: &common::Staff, code: &str) -> Uuid {
    let t = tag();
    let (status, group) = send(
        admin,
        admin.client.post(app.url("/api/access-groups")),
        json!({ "code": format!("g{t}"), "name": format!("g{t}"), "permissions": [code] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{group}");
    group["id"].as_str().and_then(|id| id.parse().ok()).expect("group id")
}

/// Given a manager, When they edit an administrator's name or deactivate
/// them, or change their own departments or facilities, Then each is refused;
/// another receptionist's departments they may change.
#[tokio::test]
async fn a_manager_cannot_edit_an_administrator_or_their_own_scope() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager = common::provision_staff_with(&app, &admin.csrf, "receptionist", MANAGER, &[]).await;
    let user = |id: Uuid| app.url(&format!("/api/setup/users/{id}"));

    let (status, body) =
        send(&manager, manager.client.put(user(admin.user_id)), json!({ "full_name": "Not Admin" })).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "renaming the admin: {body}");
    let (status, body) =
        send(&manager, manager.client.put(user(admin.user_id)), json!({ "is_active": false })).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "deactivating the admin: {body}");

    let dept: Uuid = sqlx::query_scalar("SELECT id FROM departments WHERE deleted_at IS NULL LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a department");
    let scope = json!({ "department_ids": [dept] });
    let (status, body) =
        send(&manager, manager.client.put(user(manager.user_id)), scope.clone()).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "own departments: {body}");
    let other = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let (status, body) = send(&manager, manager.client.put(user(other.user_id)), scope).await;
    assert_eq!(status, StatusCode::OK, "someone else's departments: {body}");

    let facilities = app.url(&format!("/api/setup/users/{}/facilities", manager.user_id));
    let (status, body) =
        send(&manager, manager.client.put(&facilities), json!({ "facility_ids": [] })).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "own facilities: {body}");
}

/// Given a manager who configures SSO, When they map a directory group to a
/// bypass role, a role beyond theirs or a wider access group, or default new
/// sign-ins to a wider role, Then each is refused; a held group maps.
#[tokio::test]
async fn an_sso_mapping_grants_only_what_the_mapper_holds() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let codes: Vec<&str> = MANAGER.iter().copied().chain(["admin.settings.general.manage"]).collect();
    let manager = common::provision_staff_with(&app, &admin.csrf, "receptionist", &codes, &[]).await;
    let t = tag();
    let providers = app.url("/api/admin/sso/providers");
    let (status, body) = send(
        &manager,
        manager.client.post(&providers),
        json!({ "code": format!("w{t}"), "name": "Wide", "protocol": "oidc", "default_role": "lab_technician" }),
    )
    .await;
    assert_refused_naming(status, &body, "a wider default role");
    let (status, provider) = send(
        &admin,
        admin.client.post(&providers),
        json!({ "code": format!("p{t}"), "name": "Test IdP", "protocol": "oidc" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{provider}");
    let mappings = app.url(&format!(
        "/api/admin/sso/providers/{}/mappings",
        provider["id"].as_str().unwrap_or_default()
    ));
    let map = |body: serde_json::Value| send(&manager, manager.client.post(&mappings), body);

    let (status, body) = map(json!({ "idp_group": "admins", "role_code": "hospital_admin" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a bypass role: {body}");
    let (status, body) = map(json!({ "idp_group": "lab", "role_code": "lab_technician" })).await;
    assert_refused_naming(status, &body, "a wider role");
    let wide = group_with(&app, &admin, LACKED).await;
    let (status, body) = map(json!({ "idp_group": "wide", "access_group_id": wide })).await;
    assert_refused_naming(status, &body, "a wider group");
    let held = group_with(&app, &admin, HELD).await;
    let (status, body) = map(json!({ "idp_group": "held", "access_group_id": held })).await;
    assert_eq!(status, StatusCode::OK, "a held group: {body}");
}

/// Given a directory group mapped to an access group, When the same person
/// signs in with SSO twice, Then they are still a member and hold its codes.
#[tokio::test]
async fn sso_memberships_survive_a_second_sign_in() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let person = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let tenant = tenant_of(&app, person.user_id).await;
    let group = group_with(&app, &admin, HELD).await;

    for _ in 0..2 {
        let mut tx = app.db.begin().await.expect("tx");
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await.expect("tenant");
        medbrains_sso_login::sync_sso_memberships(&mut tx, tenant, person.user_id, &[group])
            .await
            .expect("sync");
        tx.commit().await.expect("commit");
    }
    let held = medbrains_server_core::permissions::resolve_permissions(
        &app.db,
        tenant,
        person.user_id,
        "receptionist",
    )
    .await
    .expect("resolve");
    assert!(held.contains(&HELD.to_owned()), "the second sign-in kept the membership");
}

/// Given a group with view on a patient and a member of it, When the admin
/// removes the member, Then the PG relation backend no longer lets them view
/// it or lists it for them.
#[tokio::test]
async fn a_removed_member_loses_group_access_in_the_pg_backend() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let member = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let tenant = tenant_of(&app, member.user_id).await;
    let group = group_with(&app, &admin, HELD).await;
    let patient = Uuid::new_v4();
    let as_user = |user: Uuid, is_bypass: bool| AuthzContext {
        tenant_id: tenant,
        user_id: user,
        role: "receptionist".to_owned(),
        department_ids: Vec::new(),
        is_bypass,
    };
    let authz = PgAuthzBackend::new(app.db.clone());
    authz
        .write_tuple(&as_user(admin.user_id, true), "patient", patient, Relation::Viewer, Subject::Group(group), None, None)
        .await
        .expect("group tuple");
    let members = app.url(&format!("/api/access-groups/{group}/members"));
    let (status, body) =
        send(&admin, admin.client.post(&members), json!({ "user_id": member.user_id })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let ctx = as_user(member.user_id, false);
    let can_view = || authz.check(&ctx, Relation::Viewer, "patient", patient);
    assert!(can_view().await.expect("check"), "a member views through the group");

    let leave = app.url(&format!("/api/access-groups/{group}/members/{}", member.user_id));
    let (status, body) = send(&admin, admin.client.delete(&leave), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(!can_view().await.expect("check"), "a removed member does not");
    let listed = authz.list_accessible(&ctx, "patient", Relation::Viewer).await.expect("list");
    assert!(!listed.contains(&patient), "nor is it listed for them");
}

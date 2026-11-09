//! Nobody grants what they do not hold, and nobody grants themselves.
//!
//! A user manager outside the bypass roles held `admin.users.update` and could
//! reach every permission with it: write any code into a user's extras (their
//! own included), build an access group with any codes and join it, edit a
//! role's codes, or approve a temporary grant wider than themselves. Every
//! grant path now refuses codes the caller lacks, and refuses the caller's own
//! account; a bypass administrator keeps full control.

use crate::common::{self, Staff};

use reqwest::StatusCode;
use serde_json::{Value, json};

pub(crate) const HELD: &str = "blood_bank.donors.list";
pub(crate) const LACKED: &str = "lab.results.verify";
pub(crate) const MANAGER: &[&str] = &[
    "admin.users.create",
    "admin.users.update",
    "admin.roles.create",
    "admin.roles.update",
    "admin.access_requests.review",
    HELD,
];

/// Send `body` with `staff`'s session; the status and the JSON answer.
pub(crate) async fn send(staff: &Staff, req: reqwest::RequestBuilder, body: Value) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", &staff.csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A refusal that names the code the caller does not hold.
pub(crate) fn assert_refused_naming(status: StatusCode, body: &Value, what: &str) {
    assert_eq!(status, StatusCode::FORBIDDEN, "{what}: {body}");
    assert!(
        body["detail"].as_str().is_some_and(|d| d.contains(LACKED)),
        "{what}: {body}"
    );
}

/// Sign `staff` in again: a change to their access bumps `perm_version`, and
/// the session from before it answers 401.
pub(crate) async fn sign_in_again(app: &common::TestApp, staff: &Staff) -> Staff {
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(staff.user_id)
        .fetch_one(&app.db)
        .await
        .expect("username");
    let client = reqwest::Client::builder()
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
    Staff {
        client,
        csrf,
        user_id: staff.user_id,
        password: staff.password.clone(),
    }
}

/// The admin, as a `Staff` with the default admin session.
pub(crate) async fn admin(app: &common::TestApp) -> Staff {
    let csrf = app.login_admin().await;
    let user_id = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin' LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("admin id");
    Staff {
        client: app.client.clone(),
        csrf,
        user_id,
        password: "admin123".to_owned(),
    }
}

/// Given a user manager without `LACKED`, When they put it in a user's extras,
/// a new user's extras, a group, a role or a temporary grant, Then each is
/// refused naming the code; When they give `HELD`, Then it goes through.
#[tokio::test]
async fn a_user_manager_grants_only_codes_they_hold() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager =
        common::provision_staff_with(&app, &admin.csrf, "receptionist", MANAGER, &[]).await;
    let target = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let matrix = app.url(&format!(
        "/api/setup/users/{}/access-matrix",
        target.user_id
    ));
    let tag = &uuid::Uuid::new_v4().simple().to_string()[..8];

    let lacked = json!({ "extra_permissions": [LACKED], "denied_permissions": [] });
    let (status, body) = send(&manager, manager.client.put(&matrix), lacked).await;
    assert_refused_naming(status, &body, "extra");
    let held = json!({ "extra_permissions": [HELD], "denied_permissions": [] });
    let (status, body) = send(&manager, manager.client.put(&matrix), held).await;
    assert_eq!(status, StatusCode::OK, "a held extra: {body}");

    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/setup/users")),
        json!({
            "username": format!("ng{tag}"), "email": format!("ng{tag}@example.test"),
            "password": format!("Grant#{tag}Aa9"), "full_name": "New Grant", "role": "receptionist",
            "access_matrix": { "extra": [LACKED] },
        }),
    )
    .await;
    assert_refused_naming(status, &body, "a new user's extras");
    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/setup/users")),
        json!({
            "username": format!("na{tag}"), "email": format!("na{tag}@example.test"),
            "password": format!("Grant#{tag}Aa9"), "full_name": "New Admin", "role": "super_admin",
        }),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "a bypass role: {body}");
    let invite = json!({ "email": format!("inv{tag}@example.test"), "role": "super_admin" });
    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/admin/invitations")),
        invite,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "inviting a bypass role: {body}"
    );

    let groups = app.url("/api/access-groups");
    let group =
        |code: &str, perm: &str| json!({ "code": code, "name": code, "permissions": [perm] });
    let (status, body) = send(
        &manager,
        manager.client.post(&groups),
        group(&format!("g1{tag}"), LACKED),
    )
    .await;
    assert_refused_naming(status, &body, "a group");
    let (status, body) = send(
        &manager,
        manager.client.post(&groups),
        group(&format!("g2{tag}"), HELD),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "a held group: {body}");
    let (status, wide) = send(
        &admin,
        admin.client.post(&groups),
        group(&format!("g3{tag}"), LACKED),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{wide}");
    let members = app.url(&format!(
        "/api/access-groups/{}/members",
        wide["id"].as_str().unwrap_or_default()
    ));
    let (status, body) = send(
        &manager,
        manager.client.post(&members),
        json!({ "user_id": target.user_id }),
    )
    .await;
    assert_refused_naming(status, &body, "joining a wider group");

    let (status, role) = send(
        &admin,
        admin.client.post(app.url("/api/setup/roles")),
        json!({
            "code": format!("r{tag}"), "name": format!("Role {tag}"), "permissions": [],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{role}");
    let role_perms = app.url(&format!(
        "/api/setup/roles/{}/permissions",
        role["id"].as_str().unwrap_or_default()
    ));
    let (status, body) = send(
        &manager,
        manager.client.put(&role_perms),
        json!({ "permissions": [LACKED] }),
    )
    .await;
    assert_refused_naming(status, &body, "a role edit");
    let (status, body) = send(
        &manager,
        manager.client.put(&role_perms),
        json!({ "permissions": [HELD] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "a held role edit: {body}");
    let (status, body) = send(
        &manager,
        manager.client.post(app.url("/api/setup/roles")),
        json!({
            "code": format!("q{tag}"), "name": format!("Wide {tag}"), "permissions": [LACKED],
        }),
    )
    .await;
    assert_refused_naming(status, &body, "a new role");

    let requester = common::provision_staff(&app, &admin.csrf, "receptionist", &[]).await;
    let (status, request) = send(
        &requester,
        requester.client.post(app.url("/api/iam/access-requests")),
        json!({
            "requested_permissions": [LACKED], "reason": format!("Covering the lab {tag}"),
            "requested_expires_at": (chrono::Utc::now() + chrono::Duration::hours(8)).to_rfc3339(),
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{request}");
    let approve = app.url(&format!(
        "/api/iam/access-requests/{}/approve",
        request["id"].as_str().unwrap_or_default()
    ));
    let (status, body) = send(&manager, manager.client.post(&approve), json!({})).await;
    assert_refused_naming(status, &body, "a temporary grant");
    let (status, body) = send(&admin, admin.client.post(&approve), json!({})).await;
    assert_eq!(status, StatusCode::OK, "the admin approves it: {body}");
}

/// Given a user manager, When they change their own extras, role or group
/// membership, Then each is refused; When the admin changes them, Then it
/// goes through, and a removed member loses the group's codes.
#[tokio::test]
async fn a_user_manager_cannot_change_their_own_access() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let manager =
        common::provision_staff_with(&app, &admin.csrf, "receptionist", MANAGER, &[]).await;
    let me = manager.user_id;
    let tag = &uuid::Uuid::new_v4().simple().to_string()[..8];

    let matrix = app.url(&format!("/api/setup/users/{me}/access-matrix"));
    let nothing = json!({ "extra_permissions": [HELD], "denied_permissions": [] });
    let (status, body) = send(&manager, manager.client.put(&matrix), nothing.clone()).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "own extras: {body}");
    let user = app.url(&format!("/api/setup/users/{me}"));
    let (status, body) = send(
        &manager,
        manager.client.put(&user),
        json!({ "role": "doctor" }),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "own role: {body}");

    let (status, group) = send(
        &admin,
        admin.client.post(app.url("/api/access-groups")),
        json!({
            "code": format!("s{tag}"), "name": format!("s{tag}"), "permissions": [HELD],
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{group}");
    let group_id = group["id"].as_str().unwrap_or_default().to_owned();
    let members = app.url(&format!("/api/access-groups/{group_id}/members"));
    let (status, body) = send(
        &manager,
        manager.client.post(&members),
        json!({ "user_id": me }),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "joining a group: {body}");

    let reset = |id: uuid::Uuid| app.url(&format!("/api/setup/users/{id}/reset-password"));
    let (status, body) = send(&manager, manager.client.post(reset(me)), json!({})).await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "own password via the admin reset: {body}"
    );
    let (status, body) = send(
        &manager,
        manager.client.post(reset(admin.user_id)),
        json!({}),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "an administrator's password: {body}"
    );

    let (status, body) = send(
        &admin,
        admin.client.put(&matrix),
        json!({ "extra_permissions": MANAGER, "denied_permissions": [] }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the admin edits the manager: {body}"
    );
    let (status, body) = send(
        &admin,
        admin.client.post(&members),
        json!({ "user_id": me }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "the admin adds the manager: {body}");
    let manager = sign_in_again(&app, &manager).await;
    let leave = app.url(&format!("/api/access-groups/{group_id}/members/{me}"));
    let (status, body) = send(&manager, manager.client.delete(&leave), json!({})).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "leaving a group: {body}");
    let (status, body) = send(
        &manager,
        manager.client.put(&user),
        json!({ "full_name": "Still Me" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "own name is not access: {body}");

    let tenant_id = sqlx::query_scalar("SELECT tenant_id FROM users WHERE id = $1")
        .bind(me)
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    sqlx::query("UPDATE users SET access_matrix = '{}' WHERE id = $1")
        .bind(me)
        .execute(&app.db)
        .await
        .expect("clear extras");
    let resolve = || {
        medbrains_server_core::permissions::resolve_permissions(
            &app.db,
            tenant_id,
            me,
            "receptionist",
        )
    };
    assert!(
        resolve().await.expect("resolve").contains(&HELD.to_owned()),
        "a member holds it"
    );
    let (status, body) = send(&admin, admin.client.delete(&leave), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(
        !resolve().await.expect("resolve").contains(&HELD.to_owned()),
        "a removed member no longer holds the group's codes"
    );
}

/// Given a CSV of staff without passwords, When the admin imports it, Then
/// each account gets a distinct random one-time password, returned once, and
/// must change it at first sign-in; the old `Welcome@<username>` does not work.
#[tokio::test]
async fn imported_accounts_get_random_passwords_they_must_change() {
    let app = common::spawn_app().await;
    let admin = admin(&app).await;
    let tag = &uuid::Uuid::new_v4().simple().to_string()[..8];
    let names = [format!("imp_a{tag}"), format!("imp_b{tag}")];
    let rows: Vec<Value> = names
        .iter()
        .map(|n| json!({ "values": [n, "Imported Person", format!("{n}@example.test")] }))
        .collect();
    let (status, result) = send(
        &admin,
        admin.client.post(app.url("/api/setup/users/import")),
        json!({
            "headers": ["username", "full_name", "email"], "rows": rows,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["imported"], 2, "{result}");
    let issued = result["one_time_passwords"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert_eq!(issued.len(), 2, "{result}");
    assert_ne!(
        issued[0]["password"], issued[1]["password"],
        "each one differs"
    );

    for entry in &issued {
        let username = entry["username"].as_str().unwrap_or_default();
        let password = entry["password"].as_str().unwrap_or_default();
        assert!(
            password.len() >= 12 && !password.contains(username),
            "{password}"
        );
        let login = |p: String| {
            app.client
                .post(app.url("/api/auth/login"))
                .json(&json!({ "username": username, "password": p }))
                .send()
        };
        let old = login(format!("Welcome@{username}")).await.expect("login");
        assert_ne!(
            old.status(),
            StatusCode::OK,
            "the predictable password is gone"
        );
        let resp = login(password.to_owned()).await.expect("login");
        assert_eq!(resp.status(), StatusCode::OK);
        let body: Value = resp.json().await.unwrap_or_default();
        assert_eq!(body["user"]["must_change_password"], true, "{body}");
    }
}

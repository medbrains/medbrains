//! MedBrains staff reach a hospital's data only under that hospital's grant.
//!
//! Each test is one scenario from `docs/compliance/vendor-access.md`: no grant
//! is a 403 even for a bypass role; a masked grant masks; unmasked waits for a
//! second person; an expired or revoked grant is refused on the next request;
//! one hospital's grant does not open another; and an outage of the grant
//! check is a 503, never an open door.

use crate::common::{self, TestApp};

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// A signed-in account made for one test.
struct Account {
    client: Client,
    csrf: String,
    user_id: Uuid,
    email: String,
    password: String,
}

/// The seeded hospital, where `admin` works.
async fn home_tenant(app: &TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant")
}

/// Sign `username` in on a fresh client, at `hospital_code` when given.
async fn sign_in(
    app: &TestApp,
    username: &str,
    password: &str,
    hospital: Option<&str>,
) -> (Client, String) {
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let resp = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password, "hospital_code": hospital }))
        .send()
        .await
        .expect("login");
    assert_eq!(resp.status(), StatusCode::OK, "login {username}");
    let body: Value = resp.json().await.expect("login json");
    (
        client,
        body["csrf_token"].as_str().unwrap_or_default().to_owned(),
    )
}

/// Make an account the way a hospital does, give it `role`, and sign it in.
/// A `medbrains.in` address makes it a MedBrains account from the start.
async fn account(app: &TestApp, admin_csrf: &str, role: &str, domain: &str) -> Account {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("va{tag}"), format!("Vendor#{tag}Aa9"));
    let email = format!("{username}@{domain}");
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username, "email": email, "password": password,
            "full_name": format!("Test {role}"), "role": "receptionist",
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    // The role is set here so a bypass role can be tested: the setup screen
    // rightly does not hand those out.
    let user_id: Uuid = sqlx::query_scalar(
        "UPDATE users SET role = $2::user_role, perm_version = perm_version + 1 WHERE username = $1 \
         RETURNING id",
    )
    .bind(&username)
    .bind(role)
    .fetch_one(&app.db)
    .await
    .expect("role");
    let (client, csrf) = sign_in(app, &username, &password, None).await;
    Account {
        client,
        csrf,
        user_id,
        email,
        password,
    }
}

/// A patient, and the attending relation that lets `viewer` see them in lists.
async fn patient_seen_by(app: &TestApp, tenant: Uuid, viewer: Uuid) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Lakshmi', 'Ramanathan', 'female'::gender, '9876501234') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-VA-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'patient', $2, 'attending_physician', 'user', $3::text, $3)",
    )
    .bind(tenant)
    .bind(id)
    .bind(viewer)
    .execute(&app.db)
    .await
    .expect("tuple");
    id
}

/// POST as `who`, returning status and body.
async fn post(app: &TestApp, who: (&Client, &str), path: &str, body: Value) -> (StatusCode, Value) {
    let resp = who
        .0
        .post(app.url(path))
        .header("x-csrf-token", who.1)
        .json(&body)
        .send()
        .await
        .expect("post");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// GET as `client`, returning status and body text.
async fn get(app: &TestApp, client: &Client, path: &str) -> (StatusCode, String) {
    let resp = client.get(app.url(path)).send().await.expect("get");
    let status = resp.status();
    (status, resp.text().await.unwrap_or_default())
}

/// The admin, stepped up, gives `email` access; returns status and grant.
async fn grant(
    app: &TestApp,
    csrf: &str,
    email: &str,
    scope: &[&str],
    masked: bool,
) -> (StatusCode, Value) {
    app.step_up(&app.client, csrf, "admin123").await;
    post(
        app,
        (&app.client, csrf),
        "/api/security/vendor-access/grants",
        json!({ "grantee_email": email, "reason": "Ticket 4411: patient list slow",
                "scope": scope, "is_masked": masked, "hours": 2 }),
    )
    .await
}

/// The grant's id from a create or action answer.
fn id_of(grant: &Value) -> String {
    grant["id"].as_str().expect("grant id").to_owned()
}

/// Given no grant, a MedBrains account holding a bypass role is refused, sees
/// itself as `vendor_support` with no permissions, and the attempt is audited.
#[tokio::test]
async fn no_grant_refuses_even_a_bypass_role() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;

    let (status, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, _) = get(&app, &vendor.client, "/api/admin/kernel").await;
    assert_eq!(status, StatusCode::FORBIDDEN, "configuration is closed too");

    let (status, me) = get(&app, &vendor.client, "/api/auth/me").await;
    assert_eq!(status, StatusCode::OK);
    let me: Value = serde_json::from_str(&me).expect("me");
    assert_eq!(me["role"], "vendor_support");
    assert_eq!(me["permissions"], json!([]));

    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE user_id = $1 AND action = 'vendor_access_refused'",
    )
    .bind(vendor.user_id)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    // Once a minute per account, counting the rest: two refusals, one row.
    assert_eq!(audited, 1, "refusals audited: {audited}");
}

/// Given a masked grant for patients, the MedBrains person sees the list with
/// ids but no name or phone, every request is an event under the grant, and
/// the person cannot widen their own access.
#[tokio::test]
async fn masked_grant_masks_patient_data() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = home_tenant(&app).await;
    let vendor = account(&app, &csrf, "super_admin", "medbrains.in").await;
    let patient = patient_seen_by(&app, tenant, vendor.user_id).await;

    let (status, made) = grant(&app, &csrf, &vendor.email, &["patients"], true).await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["status"], "active");

    let (status, body) = get(&app, &vendor.client, "/api/patients?limit=200").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(
        body.contains(&patient.to_string()),
        "the record is reachable by id"
    );
    assert!(
        !body.contains("Lakshmi") && !body.contains("9876501234"),
        "{body}"
    );
    assert!(body.contains("[MASKED]"));

    let (status, _) = post(
        &app,
        (&vendor.client, &vendor.csrf),
        "/api/security/vendor-access/grants",
        json!({ "grantee_email": vendor.email, "reason": "widen my own access",
                "scope": ["admin"], "is_masked": false }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a grant never carries the grant permission"
    );

    let (status, events) = get(
        &app,
        &app.client,
        &format!("/api/security/vendor-access/grants/{}/events", id_of(&made)),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let events: Value = serde_json::from_str(&events).expect("events");
    let rows = events["data"].as_array().expect("rows");
    assert!(
        rows.iter().any(|e| e["path"] == "/api/patients"
            && e["status_code"] == 200
            && e["was_masked"] == true),
        "{events}"
    );
}

/// Given an unmasked grant, it opens nothing until a different person with the
/// approve permission approves it; the person who asked cannot.
#[tokio::test]
async fn unmasked_needs_a_second_approver() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = home_tenant(&app).await;
    let vendor = account(&app, &csrf, "super_admin", "sub.medbrains.in").await;
    patient_seen_by(&app, tenant, vendor.user_id).await;

    let (status, made) = grant(&app, &csrf, &vendor.email, &["patients"], false).await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["status"], "pending_approval");
    let (status, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(status, StatusCode::FORBIDDEN, "not open before approval");

    let approve = format!(
        "/api/security/vendor-access/grants/{}/approve",
        id_of(&made)
    );
    let (status, _) = post(&app, (&app.client, &csrf), &approve, json!({})).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "the asker cannot approve");

    let officer = account(&app, &csrf, "it_security_officer", "example.test").await;
    app.step_up(&officer.client, &officer.csrf, &officer.password)
        .await;
    let (status, approved) =
        post(&app, (&officer.client, &officer.csrf), &approve, json!({})).await;
    assert_eq!(status, StatusCode::OK, "{approved}");
    assert_eq!(approved["status"], "active");

    let (status, body) = get(&app, &vendor.client, "/api/patients?limit=200").await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains("Lakshmi"), "unmasked after approval");
}

/// Given a grant past its expiry, the next request is refused and the grant
/// reads as expired.
#[tokio::test]
async fn an_expired_grant_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;
    let (_, made) = grant(&app, &csrf, &vendor.email, &["patients"], true).await;
    let (status, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(status, StatusCode::OK);

    sqlx::query(
        "UPDATE vendor_access_grants SET created_at = now() - interval '3 hours', \
                expires_at = now() - interval '1 second' WHERE id = $1::uuid",
    )
    .bind(id_of(&made))
    .execute(&app.db)
    .await
    .expect("expire");
    let (status, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (_, list) = get(&app, &app.client, "/api/security/vendor-access/grants").await;
    let list: Value = serde_json::from_str(&list).expect("list");
    let row = list["data"]
        .as_array()
        .expect("rows")
        .iter()
        .find(|g| g["id"] == made["id"])
        .cloned()
        .expect("row");
    assert_eq!(row["status"], "expired");
}

/// Given an open session, the hospital ends it and the very next request from
/// the same signed-in session is refused.
#[tokio::test]
async fn revoking_mid_session_refuses_the_next_request() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;
    let (_, made) = grant(&app, &csrf, &vendor.email, &["patients"], true).await;
    let (status, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(status, StatusCode::OK);

    let revoke = format!("/api/security/vendor-access/grants/{}/revoke", id_of(&made));
    let (status, ended) = post(
        &app,
        (&app.client, &csrf),
        &revoke,
        json!({ "reason": "done" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(ended["status"], "revoked");
    let (status, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

/// Given a grant at one hospital, the same MedBrains person signed in at
/// another hospital has no access there.
#[tokio::test]
async fn one_hospitals_grant_does_not_open_another() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;
    let (status, _) = grant(&app, &csrf, &vendor.email, &["patients"], true).await;
    assert_eq!(status, StatusCode::OK);

    let code = format!(
        "VA{}",
        Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    );
    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other Hospital', \
         'multi_specialty') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let username = format!("vb{}", &Uuid::new_v4().simple().to_string()[..10]);
    sqlx::query(
        "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role) \
         SELECT $1, $2, $2 || '@medbrains.in', password_hash, full_name, 'hospital_admin' \
           FROM users WHERE id = $3",
    )
    .bind(other)
    .bind(&username)
    .bind(vendor.user_id)
    .execute(&app.db)
    .await
    .expect("same person at the other hospital");
    let (there, _) = sign_in(&app, &username, &vendor.password, Some(&code)).await;
    let (status, _) = get(&app, &there, "/api/patients").await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

/// Given the grant check cannot be answered, the request is a 503 — never let
/// through, never a 404 that reads as "no such record".
#[tokio::test]
async fn an_outage_of_the_grant_check_is_503() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;
    let (status, _) = grant(&app, &csrf, &vendor.email, &["patients"], true).await;
    assert_eq!(status, StatusCode::OK);

    sqlx::query("REVOKE SELECT ON vendor_access_grants FROM medbrains_app")
        .execute(&app.db)
        .await
        .expect("break the check");
    let (during, _) = get(&app, &vendor.client, "/api/patients").await;
    sqlx::query("GRANT SELECT ON vendor_access_grants TO medbrains_app")
        .execute(&app.db)
        .await
        .expect("restore the check");
    assert_eq!(during, StatusCode::SERVICE_UNAVAILABLE);
    let (after, _) = get(&app, &vendor.client, "/api/patients").await;
    assert_eq!(after, StatusCode::OK);
}

/// What the hospital types is checked: a reason, a real scope, at most 72
/// hours, an existing account, not one's own, and one live grant at a time.
#[tokio::test]
async fn a_grant_must_be_well_formed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "receptionist", "medbrains.in").await;
    let colleague = account(&app, &csrf, "receptionist", "example.test").await;
    app.step_up(&app.client, &csrf, "admin123").await;
    let path = "/api/security/vendor-access/grants";
    let with = |email: &str, reason: &str, scope: Value, hours: i64| json!({ "grantee_email": email, "reason": reason, "scope": scope, "hours": hours });
    let cases = [
        (with(&vendor.email, "short", json!(["opd"]), 4), "reason"),
        (
            with(&vendor.email, "Investigating ticket 12", json!(["opdd"]), 4),
            "scope",
        ),
        (
            with(&vendor.email, "Investigating ticket 12", json!(["vpn"]), 4),
            "ungrantable",
        ),
        (
            with(&vendor.email, "Investigating ticket 12", json!(["opd"]), 73),
            "hours",
        ),
        (
            with(
                "nobody@medbrains.in",
                "Investigating ticket 12",
                json!(["opd"]),
                4,
            ),
            "account",
        ),
        (
            with(
                "admin@medbrains.localhost",
                "Investigating ticket 12",
                json!(["opd"]),
                4,
            ),
            "self",
        ),
        (
            with(
                &colleague.email,
                "Investigating ticket 12",
                json!(["opd"]),
                4,
            ),
            "colleague",
        ),
    ];
    for (body, why) in cases {
        let (status, _) = post(&app, (&app.client, &csrf), path, body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{why}");
    }
    let ok = with(
        &vendor.email,
        "Investigating ticket 12",
        json!(["config"]),
        72,
    );
    let (status, made) = post(&app, (&app.client, &csrf), path, ok.clone()).await;
    assert_eq!(status, StatusCode::OK, "{made}");
    assert_eq!(made["is_masked"], true, "masked unless asked otherwise");
    let (status, _) = post(&app, (&app.client, &csrf), path, ok).await;
    assert_eq!(status, StatusCode::CONFLICT, "one live grant at a time");
}

/// Issue an API key as the admin; returns (id, secret).
async fn issue_key(app: &TestApp, csrf: &str) -> (Uuid, String) {
    let resp = app
        .client
        .post(app.url("/api/admin/api-keys"))
        .header("x-csrf-token", csrf)
        .json(
            &json!({ "name": format!("va{}", &Uuid::new_v4().simple().to_string()[..8]),
                       "permissions": ["patients.list"], "rate_limit_per_minute": 60 }),
        )
        .send()
        .await
        .expect("issue");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("issue json");
    let secret = body["secret"].as_str().expect("secret").to_owned();
    let id: Uuid = sqlx::query_scalar("SELECT id FROM api_keys ORDER BY created_at DESC LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("key id");
    (id, secret)
}

/// GET with an API key; returns the status.
async fn with_key(app: &TestApp, secret: &str, path: &str) -> StatusCode {
    Client::new()
        .get(app.url(path))
        .bearer_auth(secret)
        .send()
        .await
        .expect("key request")
        .status()
}

/// Given an API key made by an account on a MedBrains domain, the key is
/// refused: a key must not outlive the grant of the person who made it.
#[tokio::test]
async fn a_key_a_vendor_account_made_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "receptionist", "medbrains.in").await;
    let (key, secret) = issue_key(&app, &csrf).await;
    assert_eq!(
        with_key(&app, &secret, "/api/patients").await,
        StatusCode::OK
    );
    sqlx::query("UPDATE api_keys SET created_by = $2 WHERE id = $1")
        .bind(key)
        .bind(vendor.user_id)
        .execute(&app.db)
        .await
        .expect("made by the vendor");
    assert_eq!(
        with_key(&app, &secret, "/api/patients").await,
        StatusCode::FORBIDDEN
    );
}

/// Given an account that made a key and a webhook, when it becomes a
/// MedBrains account, both are revoked (not deleted) and each revocation is
/// on the audit chain.
#[tokio::test]
async fn flagging_an_account_revokes_what_it_made() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let person = account(&app, &csrf, "receptionist", "example.test").await;
    let (key, secret) = issue_key(&app, &csrf).await;
    sqlx::query("UPDATE api_keys SET created_by = $2 WHERE id = $1")
        .bind(key)
        .bind(person.user_id)
        .execute(&app.db)
        .await
        .expect("made by the person");
    assert_eq!(
        with_key(&app, &secret, "/api/patients").await,
        StatusCode::OK
    );

    sqlx::query("UPDATE users SET is_vendor_staff = true WHERE id = $1")
        .bind(person.user_id)
        .execute(&app.db)
        .await
        .expect("flag");
    let revoked: bool =
        sqlx::query_scalar("SELECT revoked_at IS NOT NULL FROM api_keys WHERE id = $1")
            .bind(key)
            .fetch_one(&app.db)
            .await
            .expect("key row kept");
    assert!(revoked, "the key was not revoked");
    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vendor_credential_revocations r \
          JOIN audit_log a ON a.entity_id = r.id AND a.entity_type = 'vendor_credential_revocations' \
         WHERE r.credential_id = $1 AND r.kind = 'api_key'",
    )
    .bind(key)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1, "the revocation is not on the audit chain");
    assert_eq!(
        with_key(&app, &secret, "/api/patients").await,
        StatusCode::UNAUTHORIZED
    );
    let cleared = sqlx::query("UPDATE users SET is_vendor_staff = false WHERE id = $1")
        .bind(person.user_id)
        .execute(&app.db)
        .await;
    assert!(cleared.is_err(), "the flag was cleared");
}

/// Given an approved unmasked grant, what it opens is fixed; it can only end.
#[tokio::test]
async fn an_approved_grant_cannot_be_widened() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "receptionist", "medbrains.in").await;
    let (_, made) = grant(&app, &csrf, &vendor.email, &["patients"], false).await;
    let officer = account(&app, &csrf, "it_security_officer", "example.test").await;
    app.step_up(&officer.client, &officer.csrf, &officer.password)
        .await;
    let approve = format!(
        "/api/security/vendor-access/grants/{}/approve",
        id_of(&made)
    );
    let (status, _) = post(&app, (&officer.client, &officer.csrf), &approve, json!({})).await;
    assert_eq!(status, StatusCode::OK);

    for change in [
        "scope = ARRAY['patients','admin']",
        "is_masked = true",
        "expires_at = expires_at + interval '1 hour'",
    ] {
        let widened = sqlx::query(&format!(
            "UPDATE vendor_access_grants SET {change} WHERE id = $1::uuid"
        ))
        .bind(id_of(&made))
        .execute(&app.db)
        .await;
        assert!(widened.is_err(), "{change} was allowed after approval");
    }
    let revoke = format!("/api/security/vendor-access/grants/{}/revoke", id_of(&made));
    let (status, _) = post(&app, (&app.client, &csrf), &revoke, json!({})).await;
    assert_eq!(status, StatusCode::OK, "ending it is still allowed");
}

/// Given a MedBrains account holding a bypass role, "tell every holder of a
/// permission" does not tell it.
#[tokio::test]
async fn permission_holders_never_include_a_vendor_account() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = home_tenant(&app).await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;
    let mut tx = app.db.begin().await.expect("tx");
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .expect("tenant");
    let marker = format!("va-holders-{}", Uuid::new_v4().simple());
    medbrains_notifications::notify_permission_holders(
        &mut tx,
        tenant,
        "admin.users.list",
        Uuid::nil(),
        |user_id| medbrains_notifications::NewNotification {
            user_id,
            kind: "test",
            title: &marker,
            body: None,
            category: None,
            entity_type: None,
            entity_id: None,
            action_url: None,
        },
    )
    .await
    .expect("notify");
    tx.commit().await.expect("commit");
    let told: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND title = $2")
            .bind(vendor.user_id)
            .bind(&marker)
            .fetch_one(&app.db)
            .await
            .expect("count");
    assert_eq!(told, 0, "a MedBrains account was told");
}

/// Given a MedBrains account with a live grant, the notification socket still
/// refuses it: a stream cannot be masked or recorded per request.
#[tokio::test]
async fn the_notification_socket_refuses_a_vendor_account() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let vendor = account(&app, &csrf, "hospital_admin", "medbrains.in").await;
    let (status, _) = grant(&app, &csrf, &vendor.email, &["patients"], true).await;
    assert_eq!(status, StatusCode::OK);
    let username = vendor
        .email
        .split('@')
        .next()
        .unwrap_or_default()
        .to_owned();
    let login = Client::new()
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": vendor.password }))
        .send()
        .await
        .expect("login");
    let token = login
        .cookies()
        .find(|c| c.name() == "access_token")
        .map(|c| c.value().to_owned())
        .expect("access token");
    let url = format!("ws://{}/api/ws/notifications?token={token}", app.addr);
    assert!(
        tokio_tungstenite::connect_async(url).await.is_err(),
        "a MedBrains account opened the notification socket"
    );
}

/// `PUT /api/setup/users/{id}` with a new email, as `who`; returns the status.
async fn change_email(app: &TestApp, who: (&Client, &str), user: Uuid, email: &str) -> StatusCode {
    who.0
        .put(app.url(&format!("/api/setup/users/{user}")))
        .header("x-csrf-token", who.1)
        .json(&json!({ "email": email }))
        .send()
        .await
        .expect("update")
        .status()
}

/// Whether `user` is flagged as a vendor account, and its current address.
async fn flag_and_email(app: &TestApp, user: Uuid) -> (bool, String) {
    sqlx::query_as("SELECT is_vendor_staff, email FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("user")
}

/// Given the request role (what production runs as), an administrator who
/// moves a colleague's address onto `@medbrains.in` is refused: the flag would
/// be permanent and revoke everything the colleague set up.
#[tokio::test]
async fn an_admin_cannot_move_a_colleague_onto_a_medbrains_address() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let colleague = account(&app, &csrf, "receptionist", "example.test").await;
    let target = format!("moved.{}@medbrains.in", colleague.user_id.simple());
    let status = change_email(&app, (&app.client, &csrf), colleague.user_id, &target).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        flag_and_email(&app, colleague.user_id).await,
        (false, colleague.email)
    );
}

/// Given the request role, an administrator who moves their own address onto
/// a MedBrains domain is refused too.
#[tokio::test]
async fn nobody_can_move_themselves_onto_a_medbrains_address() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let me = account(&app, &csrf, "hospital_admin", "example.test").await;
    let target = format!("me.{}@medbrains.in", me.user_id.simple());
    let status = change_email(&app, (&me.client, &me.csrf), me.user_id, &target).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(flag_and_email(&app, me.user_id).await, (false, me.email));
}

/// Given the request role, adding a MedBrains support account — the intended
/// flow — works, and the account is a vendor account from its first write.
#[tokio::test]
async fn adding_a_medbrains_account_flags_it() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let support = account(&app, &csrf, "receptionist", "medbrains.in").await;
    assert!(flag_and_email(&app, support.user_id).await.0);
}

/// `POST /api/auth/change-password` as `who`; returns the status.
async fn change_password(app: &TestApp, who: &Account, body: Value) -> StatusCode {
    who.client
        .post(app.url("/api/auth/change-password"))
        .header("x-csrf-token", &who.csrf)
        .json(&body)
        .send()
        .await
        .expect("change password")
        .status()
}

/// Given the seeded admin handed to a hospital (placeholder address, server
/// not hosted), the first password change needs the administrator's real
/// address: missing, the placeholder or a MedBrains address is refused; a real
/// one is saved with the new password.
#[tokio::test]
async fn the_handed_over_admin_gives_a_real_address_with_the_new_password() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let admin = account(&app, &csrf, "super_admin", "medbrains.localhost").await;
    let new_password = "Handed#Over9Pass";
    let attempt = |email: Option<&str>| json!({ "current_password": admin.password, "new_password": new_password, "email": email });
    assert_eq!(
        change_password(&app, &admin, attempt(None)).await,
        StatusCode::UNPROCESSABLE_ENTITY,
        "no address"
    );
    assert_eq!(
        change_password(&app, &admin, attempt(Some("other@medbrains.localhost"))).await,
        StatusCode::BAD_REQUEST,
        "the placeholder"
    );
    assert_eq!(
        change_password(&app, &admin, attempt(Some("eng@medbrains.in"))).await,
        StatusCode::BAD_REQUEST,
        "a MedBrains address"
    );
    let real = format!("chief.{}@hospital.example", admin.user_id.simple());
    assert_eq!(
        change_password(&app, &admin, attempt(Some(&real))).await,
        StatusCode::OK
    );
    assert_eq!(flag_and_email(&app, admin.user_id).await, (false, real));
}

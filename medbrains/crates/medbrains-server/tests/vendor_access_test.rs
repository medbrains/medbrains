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
    assert!(audited >= 2, "refusals audited: {audited}");
}

/// Given a masked grant for patients, the MedBrains person sees the list with
/// ids but no name or phone, every request is an event under the grant, and
/// the person cannot widen their own access.
#[tokio::test]
async fn masked_grant_masks_patient_data() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = home_tenant(&app).await;
    let vendor = account(&app, &csrf, "super_admin", "example.test").await;
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
    let vendor = account(&app, &csrf, "super_admin", "medbrains.in").await;
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

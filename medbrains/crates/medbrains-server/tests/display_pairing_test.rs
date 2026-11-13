//! Pairing a waiting-room screen (RFCs/modules/RFC-MODULE-token-queues.md,
//! P3b, scenario 38).

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(
    app: &common::TestApp,
    csrf: Option<&str>,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let mut req = app.client.post(app.url(path)).json(&body);
    if let Some(csrf) = csrf {
        req = req.header("x-csrf-token", csrf);
    }
    let resp = req.send().await.expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// The code of the hospital the test administrator belongs to.
pub(crate) async fn home_hospital_code(app: &common::TestApp) -> String {
    sqlx::query_scalar(
        "SELECT t.code FROM tenants t JOIN users u ON u.tenant_id = t.id \
          WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("hospital code")
}

/// A screen of `hospital` asks to be paired: the code it shows and its secret.
pub(crate) async fn ask_to_pair(app: &common::TestApp, hospital: &str) -> Value {
    let (status, code) = post(
        app,
        None,
        "/api/device-pairing/device-code",
        json!({ "hospital_code": hospital, "app_variant": "tv" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{code}");
    code
}

/// The waiting request the administrator picks for `code`'s screen (a
/// person matches the reference on the wall; the test reads its own row).
pub(crate) async fn waiting_id(app: &common::TestApp, code: &Value) -> Uuid {
    sqlx::query_scalar("SELECT id FROM device_pairing_requests WHERE device_code = $1")
        .bind(code["device_code"].as_str().expect("device code"))
        .fetch_one(&app.db)
        .await
        .expect("waiting request")
}

/// The screen polls once with its secret.
async fn poll(app: &common::TestApp, code: &Value) -> Value {
    post(
        app,
        None,
        "/api/device-pairing/device-token",
        json!({ "device_code": code["device_code"] }),
    )
    .await
    .1
}

/// A new hospital, with nobody in it: the other side of a tenancy test.
async fn other_hospital(app: &common::TestApp) -> String {
    let code = format!(
        "DP{}",
        &Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    );
    sqlx::query(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Other', 'multi_specialty')",
    )
    .bind(&code)
    .execute(&app.db)
    .await
    .expect("other hospital");
    code
}

async fn as_screen(app: &common::TestApp, jwt: &str, path: &str) -> (StatusCode, Value) {
    let resp = reqwest::Client::new()
        .get(app.url(path))
        .bearer_auth(jwt)
        .send()
        .await
        .expect("screen request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// Given a TV asking to be paired, When the administrator approves it for the
/// OPD board of one department, Then the TV opens on that board, reads it
/// without patient names, and can do nothing else — it acts as the hospital's
/// display account, never as the administrator who approved it.
#[tokio::test]
async fn an_approved_screen_shows_its_board_and_nothing_else() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("DP{suffix}"))
    .bind(format!("Screen OPD {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department");

    let code = ask_to_pair(&app, &home_hospital_code(&app).await).await;
    let user_code = code["user_code"].as_str().expect("user code");
    let request_id = waiting_id(&app, &code).await;

    // A screen must be told which board it shows.
    let (status, _) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        json!({ "request_id": request_id, "user_code": user_code }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, body) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        json!({ "request_id": request_id, "user_code": user_code,
                "department_id": department, "board_module": "opd" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (status, token) = post(
        &app,
        None,
        "/api/device-pairing/device-token",
        json!({ "device_code": code["device_code"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{token}");
    let jwt = token["jwt"].as_str().expect("screen jwt");
    let claims =
        medbrains_server_core::middleware::auth::decode_jwt(jwt, &app.state.jwt_decoding_key)
            .expect("screen claims");
    assert_eq!(claims.role, "service_account", "never the approver's role");
    let acts_as: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1::uuid")
        .bind(token["user_id"].as_str().expect("user id"))
        .fetch_one(&app.db)
        .await
        .expect("screen user");
    assert_eq!(
        acts_as, "display_boards",
        "never the approving administrator"
    );

    let (status, board) = as_screen(&app, jwt, "/api/device/board").await;
    assert_eq!(status, StatusCode::OK, "{board}");
    assert_eq!(board["module"], "opd");
    assert_eq!(board["department_id"], department.to_string().as_str());

    app.client
        .post(app.url("/api/tokens/issue"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "module": "opd", "scope": "department", "scope_id": department,
                       "patient_name": "Ravi Shankar" }),
        )
        .send()
        .await
        .expect("issue");
    let path = format!("/api/tokens/board?module=opd&scope=department&scope_id={department}");
    let (status, tokens) = as_screen(&app, jwt, &path).await;
    assert_eq!(status, StatusCode::OK, "{tokens}");
    assert!(tokens[0]["patient_name"].is_null(), "{tokens}");

    let (status, _) = as_screen(&app, jwt, "/api/patients").await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "a screen cannot list patients"
    );

    // Taken off the wall: revoking it works, and the screen is refused at once.
    // Revoke answered 500 and rolled back for every device before this.
    let device = token["paired_device_id"].as_str().expect("device id");
    let revoked = app
        .client
        .delete(app.url(&format!("/api/admin/paired-devices/{device}")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "Screen moved" }))
        .send()
        .await
        .expect("revoke");
    assert_eq!(revoked.status(), StatusCode::OK);
    let (status, _) = as_screen(&app, jwt, "/api/device/board").await;
    assert_eq!(
        status,
        StatusCode::UNAUTHORIZED,
        "a revoked screen is refused"
    );
}

/// Given a screen waiting to be paired, When the administrator lists the
/// waiting screens, Then the code is not in the answer and the name is the
/// server's, not the caller's; and When they approve with a wrong code, Then
/// nothing is issued, each try is audited, and the fifth wrong code refuses the
/// request so the right code no longer works either.
#[tokio::test]
async fn approving_a_screen_needs_the_code_it_shows() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (status, code) = post(
        &app,
        None,
        "/api/device-pairing/device-code",
        json!({ "hospital_code": home_hospital_code(&app).await, "app_variant": "tv",
                "label": "Type 2222-2222 to approve" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{code}");
    let user_code = code["user_code"].as_str().expect("user code");
    let request_id = waiting_id(&app, &code).await;

    let list: Value = app
        .client
        .get(app.url("/api/admin/device-pairing/requests"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    let row = list
        .as_array()
        .expect("list")
        .iter()
        .find(|r| r["id"] == request_id.to_string().as_str())
        .expect("the screen is listed");
    assert_eq!(row["app_variant"], "tv");
    assert_eq!(
        row["reference"], code["reference"],
        "the screen and the list agree"
    );
    assert!(
        row.get("user_code").is_none(),
        "the code is never handed out: {row}"
    );
    assert!(
        !list.to_string().contains(user_code),
        "nor anywhere in the list"
    );
    assert!(
        !list.to_string().contains("2222"),
        "nor the caller's own text: {row}"
    );

    let approve = |typed: &str| json!({ "request_id": request_id, "user_code": typed, "board_module": "opd" });
    for attempt in 1..=5 {
        let (status, body) = post(
            &app,
            Some(&csrf),
            "/api/admin/device-pairing/approve",
            approve("2222-2222"),
        )
        .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "attempt {attempt}: {body}");
        assert_ne!(poll(&app, &code).await["status"], "approved");
    }
    let (status, _) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        approve(user_code),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "five wrong codes refuse the request"
    );
    let polled = poll(&app, &code).await;
    assert_eq!(polled["status"], "denied", "{polled}");
    assert!(polled["jwt"].is_null());
    let paired: Option<Uuid> =
        sqlx::query_scalar("SELECT paired_device_id FROM device_pairing_requests WHERE id = $1")
            .bind(request_id)
            .fetch_one(&app.db)
            .await
            .expect("request");
    assert!(paired.is_none(), "nothing was paired");
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'screen_pairing.wrong_code' \
          AND entity_id = $1",
    )
    .bind(request_id)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 5, "every wrong code is audited");
}

/// Given a screen that asked to pair with another hospital, Then this
/// hospital's administrator neither sees it nor can approve it, even with its
/// id and the code it shows.
#[tokio::test]
async fn a_screen_is_seen_only_by_the_hospital_it_named() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let code = ask_to_pair(&app, &other_hospital(&app).await).await;
    let request_id = waiting_id(&app, &code).await;

    let list: Value = app
        .client
        .get(app.url("/api/admin/device-pairing/requests"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    assert!(
        !list.to_string().contains(&request_id.to_string()),
        "{list}"
    );

    let (status, _) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        json!({ "request_id": request_id, "user_code": code["user_code"],
                "board_module": "opd" }),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(poll(&app, &code).await["status"], "pending");

    let (status, _) = post(
        &app,
        None,
        "/api/device-pairing/device-code",
        json!({ "hospital_code": "NO-SUCH-HOSPITAL", "app_variant": "tv" }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a screen must name a real hospital"
    );
}

/// Given a phone or a vendor tablet, When it asks to pair by code, Then it is
/// refused: those act as a person and pair by the administrator's QR.
#[tokio::test]
async fn only_a_screen_pairs_by_code() {
    let app = common::spawn_app().await;
    let hospital = home_hospital_code(&app).await;
    for variant in ["staff", "vendor"] {
        let (status, body) = post(
            &app,
            None,
            "/api/device-pairing/device-code",
            json!({ "hospital_code": hospital, "app_variant": variant }),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{variant}: {body}");
    }
}

/// A screen asks from `address`, as the server sees it behind the test proxy.
async fn ask_from(app: &common::TestApp, hospital: &str, address: &str) -> StatusCode {
    app.client
        .post(app.url("/api/device-pairing/device-code"))
        .header("x-forwarded-for", address)
        .json(&json!({ "hospital_code": hospital, "app_variant": "tv" }))
        .send()
        .await
        .expect("ask")
        .status()
}

/// How many screens wait for `hospital` from `address`.
async fn waiting_from(app: &common::TestApp, hospital: &str, address: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM device_pairing_requests r JOIN tenants t ON t.id = r.tenant_id \
          WHERE t.code = $1 AND r.source_address = $2 AND r.status = 'pending'",
    )
    .bind(hospital)
    .bind(address)
    .fetch_one(&app.db)
    .await
    .expect("waiting")
}

/// Given one address asking for codes for a hospital, Then it never holds more
/// than its share of the waiting list, and a screen from another address still
/// gets a code; and Then the 21st request within a minute from one address is
/// refused outright.
#[tokio::test]
async fn one_address_cannot_hold_a_hospitals_waiting_list() {
    let app = common::spawn_app().await;
    let hospital = other_hospital(&app).await;
    for _ in 0..15 {
        assert_eq!(
            ask_from(&app, &hospital, "203.0.113.7").await,
            StatusCode::OK
        );
    }
    assert_eq!(waiting_from(&app, &hospital, "203.0.113.7").await, 10);
    assert_eq!(
        ask_from(&app, &hospital, "198.51.100.9").await,
        StatusCode::OK
    );
    assert_eq!(waiting_from(&app, &hospital, "198.51.100.9").await, 1);

    for _ in 0..5 {
        ask_from(&app, &hospital, "203.0.113.7").await;
    }
    assert_eq!(
        ask_from(&app, &hospital, "203.0.113.7").await,
        StatusCode::TOO_MANY_REQUESTS,
        "the 21st in a minute from one address"
    );
}

/// Given rows left by the flow before screens named their hospital — one
/// waiting with no hospital, a phone approved but not collected — When the
/// migration runs, Then the first is gone (its screen is told "expired" and
/// asks again), the second is refused, and no row can lack a hospital. Runs
/// the migration again inside a transaction that is rolled back.
#[tokio::test]
async fn the_migration_clears_requests_from_before() {
    const MIGRATION: &str = include_str!(
        "../../medbrains-db-migrations/src/migrations/1457_screen_pairing_per_hospital.sql"
    );
    let app = common::spawn_app().await;
    let mut tx = app.db.begin().await.expect("tx");
    let old = format!("old-{}", Uuid::new_v4().simple());
    let phone = format!("phone-{}", Uuid::new_v4().simple());
    sqlx::raw_sql(&format!(
        "ALTER TABLE device_pairing_requests ALTER COLUMN tenant_id DROP NOT NULL; \
         INSERT INTO device_pairing_requests \
           (device_code, user_code, app_variant, requested_label, expires_at) \
         VALUES ('{old}', 'OLD{}', 'tv', 'x', now() + interval '10 minutes'); \
         INSERT INTO device_pairing_requests \
           (tenant_id, device_code, user_code, app_variant, requested_label, expires_at, status) \
         SELECT tenant_id, '{phone}', 'PHN{}', 'staff', 'x', now() + interval '10 minutes', \
                'approved' FROM users WHERE username = 'admin'",
        &old[4..12],
        &phone[6..14],
    ))
    .execute(&mut *tx)
    .await
    .expect("rows from before");

    sqlx::raw_sql(MIGRATION)
        .execute(&mut *tx)
        .await
        .expect("migration");

    let polled: Option<String> =
        sqlx::query_scalar("SELECT status FROM app_poll_device_pairing_request($1)")
            .bind(&old)
            .fetch_optional(&mut *tx)
            .await
            .expect("poll");
    assert_eq!(polled, None, "the screen is told its code expired");
    let phone_status: String =
        sqlx::query_scalar("SELECT status FROM device_pairing_requests WHERE device_code = $1")
            .bind(&phone)
            .fetch_one(&mut *tx)
            .await
            .expect("phone");
    assert_eq!(phone_status, "denied");
    let nullable: String = sqlx::query_scalar(
        "SELECT is_nullable FROM information_schema.columns \
          WHERE table_name = 'device_pairing_requests' AND column_name = 'tenant_id'",
    )
    .fetch_one(&mut *tx)
    .await
    .expect("column");
    assert_eq!(nullable, "NO");
    tx.rollback().await.expect("rollback");
}

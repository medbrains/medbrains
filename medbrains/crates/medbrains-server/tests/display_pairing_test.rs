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
pub async fn home_hospital_code(app: &common::TestApp) -> String {
    sqlx::query_scalar(
        "SELECT t.code FROM tenants t JOIN users u ON u.tenant_id = t.id \
          WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("hospital code")
}

/// A screen of `hospital` asks to be paired: the code it shows and its secret.
pub async fn ask_to_pair(app: &common::TestApp, hospital: &str, label: &str) -> Value {
    let (status, code) = post(
        app,
        None,
        "/api/device-pairing/device-code",
        json!({ "hospital_code": hospital, "app_variant": "tv", "label": label }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{code}");
    code
}

/// The waiting request the administrator picks for `code`'s screen. The list
/// never carries the code, so the test finds it as a person would: by label.
pub async fn waiting_id(app: &common::TestApp, label: &str) -> Uuid {
    sqlx::query_scalar(
        "SELECT id FROM device_pairing_requests WHERE requested_label = $1 \
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(label)
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

    let label = format!("Waiting hall TV {suffix}");
    let code = ask_to_pair(&app, &home_hospital_code(&app).await, &label).await;
    let user_code = code["user_code"].as_str().expect("user code");
    let request_id = waiting_id(&app, &label).await;

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
    assert_eq!(claims.permissions, vec!["display.board.read".to_owned()]);
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
/// waiting screens, Then the code is not in the answer; and When they approve
/// with a wrong code, Then nothing is issued, and the fifth wrong code refuses
/// the request so the right code no longer works either.
#[tokio::test]
async fn approving_a_screen_needs_the_code_it_shows() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let label = format!("Code check TV {}", Uuid::new_v4().simple());
    let code = ask_to_pair(&app, &home_hospital_code(&app).await, &label).await;
    let user_code = code["user_code"].as_str().expect("user code");

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
        .find(|r| r["requested_label"] == label.as_str())
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
    let request_id = row["id"].clone();

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
    let issued: i64 = sqlx::query_scalar("SELECT count(*) FROM paired_devices WHERE label = $1")
        .bind(&label)
        .fetch_one(&app.db)
        .await
        .expect("devices");
    assert_eq!(issued, 0, "nothing was paired");
}

/// Given a screen that asked to pair with another hospital, Then this
/// hospital's administrator neither sees it nor can approve it, even with its
/// id and the code it shows.
#[tokio::test]
async fn a_screen_is_seen_only_by_the_hospital_it_named() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let label = format!("Other hospital TV {}", Uuid::new_v4().simple());
    let code = ask_to_pair(&app, &other_hospital(&app).await, &label).await;
    let request_id = waiting_id(&app, &label).await;

    let list: Value = app
        .client
        .get(app.url("/api/admin/device-pairing/requests"))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    assert!(!list.to_string().contains(&label), "{list}");

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
        json!({ "hospital_code": "NO-SUCH-HOSPITAL", "app_variant": "tv", "label": "x" }),
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
            json!({ "hospital_code": hospital, "app_variant": variant, "label": "Phone" }),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{variant}: {body}");
    }
}

/// Given one address asking for codes, Then the 21st within a minute is
/// refused; and given a hospital with 50 screens already waiting, Then a new
/// screen is refused until some are dealt with.
#[tokio::test]
async fn asking_for_codes_is_bounded() {
    let app = common::spawn_app().await;
    let hospital = other_hospital(&app).await;
    sqlx::query(
        "INSERT INTO device_pairing_requests \
           (tenant_id, device_code, user_code, app_variant, requested_label, expires_at) \
         SELECT t.id, md5(random()::text || g), substr(md5(random()::text || g), 1, 8), 'tv', \
                'Filler', now() + interval '10 minutes' \
           FROM tenants t, generate_series(1, 50) g WHERE t.code = $1",
    )
    .bind(&hospital)
    .execute(&app.db)
    .await
    .expect("filler requests");
    let ask = json!({ "hospital_code": hospital, "app_variant": "tv", "label": "One more" });
    let (status, body) = post(&app, None, "/api/device-pairing/device-code", ask.clone()).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS, "{body}");
    assert_ne!(
        body["error"], "too_many_requests",
        "the hospital's cap, not the address's"
    );

    for _ in 0..19 {
        post(&app, None, "/api/device-pairing/device-code", ask.clone()).await;
    }
    let (status, body) = post(&app, None, "/api/device-pairing/device-code", ask).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(body["error"], "too_many_requests", "{body}");
}

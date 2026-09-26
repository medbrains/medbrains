//! Counters serving a queue (RFCs/modules/RFC-MODULE-token-queues.md, P2,
//! scenario 11).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

struct Fixture {
    tenant: Uuid,
    admin: Uuid,
    /// Another active user of the hospital.
    colleague: Uuid,
    department: Uuid,
}

async fn fixture(app: &common::TestApp) -> Fixture {
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let department = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("QK{suffix}"))
    .bind(format!("Counters {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("department");
    let colleague = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND id <> $2 AND is_active LIMIT 1",
    )
    .bind(tenant)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("a colleague");
    Fixture {
        tenant,
        admin,
        colleague,
        department,
    }
}

async fn station(app: &common::TestApp, tenant: Uuid, name: &str) -> Uuid {
    let code = format!("W{}", &Uuid::new_v4().simple().to_string()[..8]);
    sqlx::query_scalar(
        "INSERT INTO stations (tenant_id, code, name, station_type) \
         VALUES ($1, $2, $3, 'pharmacy_counter') RETURNING id",
    )
    .bind(tenant)
    .bind(code)
    .bind(name)
    .fetch_one(&app.db)
    .await
    .expect("station")
}

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: reqwest::Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn call_token(
    app: &common::TestApp,
    csrf: &str,
    token_id: &str,
    counter: Value,
) -> (StatusCode, Value) {
    let path = format!("/api/tokens/{token_id}/call");
    send(
        app,
        csrf,
        reqwest::Method::POST,
        &path,
        json!({ "counter_label": counter }),
    )
    .await
}

/// Scenario 11 and the board's "which window": once a queue has counters,
/// every call names one of them; a counter kept for one doctor refuses
/// everybody else; and the called token carries the counter's name.
#[tokio::test]
async fn a_queue_calls_to_its_own_counters_by_the_staff_allowed_there() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let f = fixture(&app).await;
    let suffix = &Uuid::new_v4().simple().to_string()[..6];
    let (window, room) = (format!("Window {suffix}"), format!("Room {suffix}"));
    let window_id = station(&app, f.tenant, &window).await;
    let room_id = station(&app, f.tenant, &room).await;
    // A real counter that does not serve this queue.
    station(&app, f.tenant, &format!("Elsewhere {suffix}")).await;

    let (_, queue) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/queues",
        json!({
            "name": "Pharmacy", "module": "opd", "scope": "department", "scope_id": f.department,
            "prefix": "P", "start_at": 1, "pad_width": 3, "reset_rule": "daily",
            "max_tokens_per_period": null, "lifecycle": "permanent", "valid_from": null,
            "valid_until": null, "status": "active",
        }),
    )
    .await;
    let queue_id = queue["id"].as_str().expect("queue id");
    // Room kept for somebody who is not the admin.
    let (status, saved) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &format!("/api/queues/{queue_id}/counters"),
        json!([
            { "station_id": window_id, "staff_user_ids": [] },
            { "station_id": room_id, "staff_user_ids": [f.colleague] },
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{saved}");

    let issue = || {
        send(
            &app,
            &csrf,
            reqwest::Method::POST,
            "/api/tokens/issue",
            json!({
                "module": "opd", "scope": "department", "scope_id": f.department,
            }),
        )
    };
    let (_, token) = issue().await;
    let token_id = token["id"].as_str().expect("token id").to_owned();
    let call = |counter: Value| call_token(&app, &csrf, &token_id, counter);

    let (status, body) = call(Value::Null).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.to_string().contains("Choose your counter"), "{body}");
    let (status, _) = call(json!(format!("Elsewhere {suffix}"))).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a counter serving another queue"
    );
    let (status, body) = call(json!(room)).await;
    assert_eq!(status, StatusCode::FORBIDDEN, "{body}");

    let (status, called) = call(json!(window)).await;
    assert_eq!(status, StatusCode::OK, "{called}");
    assert_eq!(
        called["counter_label"],
        window.as_str(),
        "the board names the window"
    );

    // The same rule for Call next at the desk.
    issue().await;
    let (status, _) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/tokens/call-next",
        json!({
            "module": "opd", "scope": "department", "scope_id": f.department,
        }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "call next must name a counter too"
    );

    // Giving the room to the admin lets them call there.
    let (status, _) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &format!("/api/queues/{queue_id}/counters"),
        json!([
            { "station_id": room_id, "staff_user_ids": [f.admin] },
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, called) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/tokens/call-next",
        json!({
            "module": "opd", "scope": "department", "scope_id": f.department, "counter_label": room,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{called}");
    assert_eq!(called["counter_label"], room.as_str());
}

/// A counter listed twice, or two counters with one name, would make "which
/// window" ambiguous — refused. So is staff who is not a user here: dropping
/// them would open a kept counter to everybody.
#[tokio::test]
async fn counters_with_the_same_name_are_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let f = fixture(&app).await;
    let name = format!("Twin {}", &Uuid::new_v4().simple().to_string()[..6]);
    let a = station(&app, f.tenant, &name).await;
    let b = station(&app, f.tenant, &name).await;
    let (_, queue) = send(
        &app,
        &csrf,
        reqwest::Method::POST,
        "/api/queues",
        json!({
            "name": "Twins", "module": "opd", "scope": "department", "scope_id": f.department,
            "prefix": "T", "start_at": 1, "pad_width": 3, "reset_rule": "daily",
            "max_tokens_per_period": null, "lifecycle": "permanent", "valid_from": null,
            "valid_until": null, "status": "active",
        }),
    )
    .await;
    let path = format!(
        "/api/queues/{}/counters",
        queue["id"].as_str().expect("queue id")
    );
    let (status, _) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &path,
        json!([
            { "station_id": a }, { "station_id": b },
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = send(
        &app,
        &csrf,
        reqwest::Method::PUT,
        &path,
        json!([{ "station_id": a, "staff_user_ids": [Uuid::new_v4()] }]),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "unknown staff is refused");
}

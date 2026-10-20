//! The customer display at a counter (#4883): a paired screen bound to one
//! counter shows the payment in progress there and nothing else.

mod common;

use futures::StreamExt;
use reqwest::StatusCode;
use serde_json::{Value, json};
use std::time::Duration;
use uuid::Uuid;

/// Everything a display's snapshot may carry. A new field is a privacy
/// decision: add it here on purpose, not by accident.
const ALLOWED_STATE_KEYS: [&str; 11] = [
    "seq",
    "session",
    "phase",
    "patient",
    "lines",
    "total_due_paise",
    "tender",
    "amount_paise",
    "qr",
    "card_status",
    "change_paise",
];

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

async fn as_device(app: &common::TestApp, jwt: Option<&str>, path: &str) -> (StatusCode, Value) {
    let mut req = reqwest::Client::new().get(app.url(path));
    if let Some(jwt) = jwt {
        req = req.bearer_auth(jwt);
    }
    let resp = req.send().await.expect("device request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn counter(app: &common::TestApp, name: &str) -> Uuid {
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    sqlx::query_scalar(
        "INSERT INTO stations (tenant_id, code, name, station_type) \
         SELECT tenant_id, $1, $2, 'billing_counter' FROM users WHERE username = 'admin' \
         RETURNING id",
    )
    .bind(format!("CD-{suffix}"))
    .bind(format!("{name} {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("counter")
}

/// Pair a display to a counter through the real device-code flow: returns
/// its JWT and device id.
async fn pair_display(app: &common::TestApp, csrf: &str, station: Uuid) -> (String, String) {
    let (_, code) = post(
        app,
        None,
        "/api/device-pairing/device-code",
        json!({ "app_variant": "tv", "label": "Counter tablet" }),
    )
    .await;
    let user_code = code["user_code"].as_str().expect("user code");
    let (status, body) = post(
        app,
        Some(csrf),
        "/api/admin/device-pairing/approve",
        json!({ "user_code": user_code, "board_module": "counter_display", "station_id": station }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, token) = post(
        app,
        None,
        "/api/device-pairing/device-token",
        json!({ "device_code": code["device_code"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{token}");
    (
        token["jwt"].as_str().expect("jwt").to_owned(),
        token["paired_device_id"]
            .as_str()
            .expect("device")
            .to_owned(),
    )
}

async fn publish(app: &common::TestApp, csrf: &str, station: Uuid, event: Value) -> Value {
    let (status, body) = post(
        app,
        Some(csrf),
        &format!("/api/counter-display/{station}/events"),
        event,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body
}

type Socket =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

async fn next_frame(socket: &mut Socket, within: Duration) -> Option<Value> {
    tokio::time::timeout(within, async {
        while let Some(Ok(message)) = socket.next().await {
            if let Ok(text) = message.to_text() {
                if let Ok(frame) = serde_json::from_str::<Value>(text) {
                    return Some(frame);
                }
            }
        }
        None
    })
    .await
    .ok()
    .flatten()
}

/// Given two counters each with a paired display, When the cashier at counter
/// A collects from Ravi Kumar Sharma, Then A's display shows "Ravi S.", the
/// totals and the QR live, then "Paid" — and B's display receives nothing.
#[tokio::test]
async fn a_display_shows_its_own_counter_and_only_the_allowed_fields() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (a, b) = (
        counter(&app, "Billing A").await,
        counter(&app, "Billing B").await,
    );

    // A customer display must be told its counter.
    let (_, code) = post(
        &app,
        None,
        "/api/device-pairing/device-code",
        json!({ "app_variant": "tv", "label": "x" }),
    )
    .await;
    let (status, _) = post(
        &app,
        Some(&csrf),
        "/api/admin/device-pairing/approve",
        json!({ "user_code": code["user_code"], "board_module": "counter_display" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "no counter, no display");

    let (jwt_a, _) = pair_display(&app, &csrf, a).await;
    let (jwt_b, _) = pair_display(&app, &csrf, b).await;

    let (status, view) = as_device(&app, Some(&jwt_a), "/api/device/counter-display").await;
    assert_eq!(status, StatusCode::OK, "{view}");
    assert_eq!(view["station_id"], a.to_string().as_str());
    assert_eq!(view["state"]["phase"], "idle");

    let ws = |jwt: &str| format!("ws://{}/ws/counter-display?token={jwt}", app.addr);
    let (mut socket_a, _) = tokio_tungstenite::connect_async(ws(&jwt_a))
        .await
        .expect("A's socket");
    let (mut socket_b, _) = tokio_tungstenite::connect_async(ws(&jwt_b))
        .await
        .expect("B's socket");
    let first = next_frame(&mut socket_a, Duration::from_secs(5))
        .await
        .expect("A's first frame");
    assert_eq!(first["phase"], "idle");
    next_frame(&mut socket_b, Duration::from_secs(5))
        .await
        .expect("B's first frame");

    let (status, live) = as_device(&app, None, &format!("/api/counter-display/{a}/status")).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{live}");
    let status: Value = app
        .client
        .get(app.url(&format!("/api/counter-display/{a}/status")))
        .send()
        .await
        .expect("status")
        .json()
        .await
        .expect("json");
    assert_eq!(status, json!({ "paired": true, "connected": true }));

    let session = Uuid::new_v4();
    publish(
        &app,
        &csrf,
        a,
        json!({ "type": "session_start", "session": session, "patient_name": "Ravi Kumar Sharma" }),
    )
    .await;
    publish(
        &app,
        &csrf,
        a,
        json!({ "type": "items", "session": session, "total_due_paise": 60_000,
                "lines": [{ "label": "Pharmacy", "amount_paise": 60_000 }] }),
    )
    .await;
    publish(
        &app,
        &csrf,
        a,
        json!({ "type": "qr_shown", "session": session, "amount_paise": 60_000,
                "upi_uri": "upi://pay?pa=hospital@bank&am=600.00", "close_by": 1_900_000_000 }),
    )
    .await;

    let mut frame = Value::Null;
    while frame["phase"] != "qr" {
        frame = next_frame(&mut socket_a, Duration::from_secs(5))
            .await
            .expect("A hears the QR");
    }
    assert_eq!(frame["patient"], "Ravi S.");
    assert_eq!(frame["total_due_paise"], 60_000);
    let text = frame.to_string();
    assert!(
        !text.contains("Kumar") && !text.contains("Sharma"),
        "{text}"
    );
    let keys: Vec<&String> = frame.as_object().expect("object").keys().collect();
    assert!(
        keys.iter()
            .all(|k| ALLOWED_STATE_KEYS.contains(&k.as_str())),
        "{keys:?}"
    );

    // A late event from another session never lands on this patient's screen.
    publish(
        &app,
        &csrf,
        a,
        json!({ "type": "paid", "session": Uuid::new_v4(), "amount_paise": 1 }),
    )
    .await;
    publish(
        &app,
        &csrf,
        a,
        json!({ "type": "paid", "session": session, "amount_paise": 60_000, "change_paise": 0 }),
    )
    .await;
    while frame["phase"] != "paid" {
        frame = next_frame(&mut socket_a, Duration::from_secs(5))
            .await
            .expect("A hears paid");
    }
    assert_eq!(frame["amount_paise"], 60_000);

    assert!(
        next_frame(&mut socket_b, Duration::from_millis(500))
            .await
            .is_none(),
        "counter B's display heard counter A's patient"
    );
    let (_, view_b) = as_device(&app, Some(&jwt_b), "/api/device/counter-display").await;
    assert_eq!(view_b["state"]["phase"], "idle");
    assert!(view_b["state"]["patient"].is_null());

    // A display reads; it cannot publish to its own counter or any other.
    let resp = reqwest::Client::new()
        .post(app.url(&format!("/api/counter-display/{a}/events")))
        .bearer_auth(&jwt_a)
        .json(&json!({ "type": "cleared", "session": session }))
        .send()
        .await
        .expect("display publish");
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    // A QR that is not a UPI link or an https image is refused.
    let (status, _) = post(
        &app,
        Some(&csrf),
        &format!("/api/counter-display/{a}/events"),
        json!({ "type": "qr_shown", "session": session, "amount_paise": 1, "image_url": "http://evil/qr.png" }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

/// Given a device that is not paired, or whose pairing was revoked, When it
/// asks for a counter display or opens the socket, Then it is refused with 401.
#[tokio::test]
async fn an_unpaired_or_revoked_display_is_refused() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let station = counter(&app, "Billing C").await;

    let (status, _) = as_device(&app, None, "/api/device/counter-display").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let refused = tokio_tungstenite::connect_async(format!(
        "ws://{}/ws/counter-display?token=not-a-token",
        app.addr
    ))
    .await;
    assert!(
        matches!(refused, Err(tokio_tungstenite::tungstenite::Error::Http(ref r)) if r.status() == 401),
        "{refused:?}"
    );
    let refused =
        tokio_tungstenite::connect_async(format!("ws://{}/ws/counter-display", app.addr)).await;
    assert!(refused.is_err(), "no token, no socket");

    let (jwt, device) = pair_display(&app, &csrf, station).await;
    let revoked = app
        .client
        .delete(app.url(&format!("/api/admin/paired-devices/{device}")))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "reason": "Tablet replaced" }))
        .send()
        .await
        .expect("revoke");
    assert_eq!(revoked.status(), StatusCode::OK);
    let (status, _) = as_device(&app, Some(&jwt), "/api/device/counter-display").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let refused = tokio_tungstenite::connect_async(format!(
        "ws://{}/ws/counter-display?token={jwt}",
        app.addr
    ))
    .await;
    assert!(
        matches!(refused, Err(tokio_tungstenite::tungstenite::Error::Http(ref r)) if r.status() == 401),
        "{refused:?}"
    );

    let status: Value = app
        .client
        .get(app.url(&format!("/api/counter-display/{station}/status")))
        .send()
        .await
        .expect("status")
        .json()
        .await
        .expect("json");
    assert_eq!(status, json!({ "paired": false, "connected": false }));
}

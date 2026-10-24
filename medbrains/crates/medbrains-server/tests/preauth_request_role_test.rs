//! Callers that arrive with no hospital — a payment provider's notice, a
//! display asking to be paired — still work when requests run as
//! `medbrains_app`, which row level security applies to (migration 1206).

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Every pre-auth function from 1206 is the app's to call, and nobody else's.
#[tokio::test]
async fn the_preauth_functions_are_granted_to_the_app_only() {
    let app = common::spawn_app().await;
    let open_to_public: Vec<String> = sqlx::query_scalar(
        "SELECT p.proname::text FROM pg_proc p, aclexplode(p.proacl) a \
          WHERE p.proname = ANY($1) AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'",
    )
    .bind(FUNCTIONS)
    .fetch_all(&app.db)
    .await
    .expect("acl");
    assert!(open_to_public.is_empty(), "{open_to_public:?}");
    for name in FUNCTIONS {
        let granted: bool = sqlx::query_scalar(
            "SELECT bool_and(has_function_privilege('medbrains_app', p.oid, 'EXECUTE')) \
               FROM pg_proc p WHERE p.proname = $1",
        )
        .bind(name)
        .fetch_one(&app.db)
        .await
        .expect("privilege");
        assert!(granted, "{name}");
    }
}

const FUNCTIONS: &[&str] = &[
    "app_gateway_txn_tenant",
    "app_log_unmatched_webhook",
    "app_open_device_pairing_request",
    "app_poll_device_pairing_request",
    "app_device_pairing_token_tenant",
    "app_register_bridge_agent",
    "app_bridge_heartbeat",
    "app_rx_verify_link",
];

/// Given a notice for an order no hospital made, When it arrives as the
/// request role, Then it is answered and filed for finance, not a 500 the
/// provider retries forever.
#[tokio::test]
async fn an_unknown_order_is_filed_not_refused() {
    let app = common::spawn_app_as_request_role().await;
    let order = format!("order_{}", Uuid::new_v4().simple());
    let resp = app
        .client
        .post(app.url("/api/webhooks/razorpay"))
        .json(&json!({ "event": "order.paid", "payload": { "order": { "entity": { "id": order } } } }))
        .send()
        .await
        .expect("webhook");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"], "unknown_order");
    let filed: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM payment_webhook_exceptions \
          WHERE provider = 'razorpay' AND order_ref = $1 AND tenant_id IS NULL",
    )
    .bind(&order)
    .fetch_one(&app.db)
    .await
    .expect("exception");
    assert_eq!(filed, 1);
}

/// Given a display with no hospital, When it asks for a code and polls,
/// Then it is told to wait, and each poll is counted.
#[tokio::test]
async fn a_display_asks_to_pair_and_waits() {
    let app = common::spawn_app_as_request_role().await;
    let code: Value = app
        .client
        .post(app.url("/api/device-pairing/device-code"))
        .json(&json!({ "app_variant": "tv", "label": "Lobby TV" }))
        .send()
        .await
        .expect("code")
        .json()
        .await
        .expect("code json");
    let device_code = code["device_code"].as_str().expect("device code");
    for _ in 0..2 {
        let polled: Value = app
            .client
            .post(app.url("/api/device-pairing/device-token"))
            .json(&json!({ "device_code": device_code }))
            .send()
            .await
            .expect("poll")
            .json()
            .await
            .expect("poll json");
        assert_eq!(polled["status"], "pending");
    }
    let polls: i32 =
        sqlx::query_scalar("SELECT poll_count FROM device_pairing_requests WHERE device_code = $1")
            .bind(device_code)
            .fetch_one(&app.db)
            .await
            .expect("polls");
    assert_eq!(polls, 2);
}

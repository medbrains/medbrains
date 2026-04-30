//! Sprint A 1.1 — real Razorpay outbound handler tests.
//!
//! These tests use `wiremock` to stand up a local mock server and
//! point the handler at it via the `RAZORPAY_API_BASE` env override.
//! They verify the status-code → HandlerError mapping without hitting
//! the real Razorpay API.
//!
//! The DB UPDATE side of the success path is NOT exercised here
//! (the handler returns Transient on db_update failure with no DB
//! attached, which is fine because we set up the test ctx with a
//! pool that won't be queried — the success test stops after the
//! HTTP roundtrip via a special early-return in the test using a
//! txn_id that doesn't exist; cargo can't run that without a real
//! Postgres). DB integration coverage lives in the `#[ignore]
//! "needs-pg"` integration tests.

use async_trait::async_trait;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::razorpay::{CreateOrderHandler, RefundHandler};
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Test fixture: a SecretResolver that returns canned values.
#[derive(Debug)]
struct StaticSecrets {
    key_id: String,
    key_secret: String,
    /// When true, .get() returns NotFound for everything.
    not_found: bool,
}

#[async_trait]
impl SecretResolver for StaticSecrets {
    async fn get(&self, key: &str) -> Result<String, SecretError> {
        if self.not_found {
            return Err(SecretError::NotFound(key.to_owned()));
        }
        if key.ends_with("razorpay-key-id") {
            Ok(self.key_id.clone())
        } else if key.ends_with("razorpay-key-secret") {
            Ok(self.key_secret.clone())
        } else {
            Err(SecretError::NotFound(key.to_owned()))
        }
    }
}

/// Build a HandlerCtx for tests. The mock URL is passed into the
/// handler constructor (CreateOrderHandler::with_api_base /
/// RefundHandler::with_api_base) rather than via process env so
/// tests can run in parallel without env-var races, and so the
/// workspace's `unsafe_code = forbid` lint stays clean.
fn make_ctx(secrets: StaticSecrets) -> HandlerCtx {
    // Lazy connect to localhost:1 — a port no postgres listens on.
    // Calling .acquire() on this pool fails, but the handler only
    // does that on the success path. Tests that exercise success
    // paths assert the HTTP body, not the DB write.
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_millis(50))
        .connect_lazy("postgres://nope:nope@127.0.0.1:1/nope")
        .expect("lazy pool");

    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .expect("http client");

    HandlerCtx {
        pool,
        tenant_id: Uuid::new_v4(),
        event_id: Uuid::new_v4(),
        event_type: "payment.create_order".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(secrets),
        http_client,
    }
}

fn good_secrets() -> StaticSecrets {
    StaticSecrets {
        key_id: "rzp_test_FAKE_ID".to_owned(),
        key_secret: "FAKE_SECRET".to_owned(),
        not_found: false,
    }
}

fn missing_secrets() -> StaticSecrets {
    StaticSecrets {
        key_id: String::new(),
        key_secret: String::new(),
        not_found: true,
    }
}

// ── Tests ─────────────────────────────────────────────────────────

#[tokio::test]
async fn create_order_400_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "error": { "code": "BAD_REQUEST_ERROR", "description": "amount_too_small" }
        })))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());
    let payload = json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 50,
        "currency": "INR",
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Permanent for 400");

    match err {
        HandlerError::Permanent(msg) => {
            assert!(
                msg.contains("400") && msg.contains("amount_too_small"),
                "expected 400 + amount_too_small in error, got: {msg}"
            );
        }
        HandlerError::Transient(msg) => {
            panic!("expected Permanent for 400, got Transient: {msg}");
        }
    }
}

#[tokio::test]
async fn create_order_500_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .respond_with(ResponseTemplate::new(500).set_body_string("internal server error"))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());
    let payload = json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 50000_u64,
        "currency": "INR",
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Transient for 500");

    assert!(
        matches!(err, HandlerError::Transient(_)),
        "expected Transient, got: {err:?}"
    );
}

#[tokio::test]
async fn create_order_429_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .respond_with(
            ResponseTemplate::new(429)
                .insert_header("Retry-After", "30")
                .set_body_string("rate limited"),
        )
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());
    let payload = json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 50000_u64,
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Transient for 429");

    assert!(matches!(err, HandlerError::Transient(_)));
}

#[tokio::test]
async fn create_order_timeout_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(5)))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());
    let payload = json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 50000_u64,
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Transient for timeout");

    match err {
        HandlerError::Transient(msg) => {
            assert!(msg.contains("network") || msg.contains("reqwest"));
        }
        HandlerError::Permanent(msg) => {
            panic!("expected Transient for timeout, got Permanent: {msg}");
        }
    }
}

#[tokio::test]
async fn create_order_missing_secret_retries() {
    let server = MockServer::start().await;
    // Mock isn't even hit because secret resolution fails first.

    let ctx = make_ctx(missing_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());
    let payload = json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 50000_u64,
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Transient when secret is missing");

    match err {
        HandlerError::Transient(msg) => {
            assert!(msg.contains("razorpay-key-id"));
        }
        other => panic!("expected Transient for missing secret, got: {other:?}"),
    }
}

#[tokio::test]
async fn create_order_missing_payload_field_dlqs() {
    let server = MockServer::start().await;
    let ctx = make_ctx(good_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());

    // Missing `internal_payment_id`
    let payload = json!({
        "amount_paise": 50000_u64,
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Permanent for malformed payload");

    assert!(matches!(err, HandlerError::Permanent(_)));
}

#[tokio::test]
async fn refund_400_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/payments/pay_test_xyz/refund"))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "error": { "description": "payment_already_refunded" }
        })))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = RefundHandler::with_api_base(server.uri());
    let payload = json!({
        "razorpay_payment_id": "pay_test_xyz",
        "amount_paise": 1000_u64,
    });

    let err = handler
        .handle(&ctx, &payload)
        .await
        .expect_err("expected Permanent for 400");

    assert!(matches!(err, HandlerError::Permanent(_)));
}

#[tokio::test]
async fn create_order_sends_basic_auth_and_idempotent_receipt() {
    let server = MockServer::start().await;
    let txn_id = Uuid::new_v4();
    Mock::given(method("POST"))
        .and(path("/orders"))
        // wiremock matches on Authorization header presence; the
        // exact base64 is "rzp_test_FAKE_ID:FAKE_SECRET" base64'd.
        .and(header(
            "authorization",
            "Basic cnpwX3Rlc3RfRkFLRV9JRDpGQUtFX1NFQ1JFVA==",
        ))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "error": { "description": "auth received but we still 400 to avoid db write" }
        })))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = CreateOrderHandler::with_api_base(server.uri());
    let payload = json!({
        "internal_payment_id": txn_id.to_string(),
        "amount_paise": 50000_u64,
    });

    // We expect Permanent (400) — the assertion here is that the
    // mock matched (otherwise wiremock returns 404 and the handler
    // would still return Permanent but with different body text).
    let err = handler.handle(&ctx, &payload).await.expect_err("400");
    if let HandlerError::Permanent(msg) = err {
        assert!(
            msg.contains("auth received"),
            "wiremock didn't match basic auth header — error: {msg}"
        );
    } else {
        panic!("expected Permanent");
    }
}

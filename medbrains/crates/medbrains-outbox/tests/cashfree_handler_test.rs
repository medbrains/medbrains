//! Cashfree outbound handler tests — `wiremock` mock server, no live creds.
//! Verifies the status-code → HandlerError mapping and that the Cashfree
//! auth + version headers are sent, against the verified sandbox contract.

use async_trait::async_trait;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::cashfree::CashfreeCreateOrderHandler;
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[derive(Debug)]
struct StaticSecrets {
    not_found: bool,
}

#[async_trait]
impl SecretResolver for StaticSecrets {
    async fn get(&self, key: &str) -> Result<String, SecretError> {
        if self.not_found {
            return Err(SecretError::NotFound(key.to_owned()));
        }
        if key.ends_with("cashfree-client-id") {
            Ok("TEST_APP_ID".to_owned())
        } else if key.ends_with("cashfree-client-secret") {
            Ok("TEST_SECRET".to_owned())
        } else {
            Err(SecretError::NotFound(key.to_owned()))
        }
    }
}

fn make_ctx() -> HandlerCtx {
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
        event_type: "payment.cashfree.create_order".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(StaticSecrets { not_found: false }),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::default_base()),
        http_client,
    }
}

fn order_payload() -> serde_json::Value {
    json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 50000_u64,
        "currency": "INR",
    })
}

#[tokio::test]
async fn cf_create_order_422_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .respond_with(ResponseTemplate::new(422).set_body_json(json!({
            "type": "invalid_request_error", "message": "order_amount_invalid"
        })))
        .mount(&server)
        .await;

    let handler = CashfreeCreateOrderHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(), &order_payload())
        .await
        .expect_err("expected Permanent for 422");

    match err {
        HandlerError::Permanent(msg) => assert!(
            msg.contains("422") && msg.contains("order_amount_invalid"),
            "got: {msg}"
        ),
        HandlerError::Transient(msg) => panic!("expected Permanent, got Transient: {msg}"),
    }
}

#[tokio::test]
async fn cf_create_order_500_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .respond_with(ResponseTemplate::new(500).set_body_string("server error"))
        .mount(&server)
        .await;

    let handler = CashfreeCreateOrderHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(), &order_payload())
        .await
        .expect_err("expected Transient for 500");
    assert!(matches!(err, HandlerError::Transient(_)), "got: {err:?}");
}

/// Verifies the Cashfree auth + version headers are actually sent: the mock
/// only matches when all three headers are present, so a match-then-500 proves
/// the handler attached them (a missing header would 404 → different message).
#[tokio::test]
async fn cf_create_order_sends_auth_and_version_headers() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/orders"))
        .and(header("x-client-id", "TEST_APP_ID"))
        .and(header("x-client-secret", "TEST_SECRET"))
        .and(header("x-api-version", "2023-08-01"))
        .respond_with(ResponseTemplate::new(500).set_body_string("matched headers"))
        .mount(&server)
        .await;

    let handler = CashfreeCreateOrderHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(), &order_payload())
        .await
        .expect_err("expected Transient (500) once headers matched");
    match err {
        HandlerError::Transient(msg) => assert!(msg.contains("matched headers"), "got: {msg}"),
        HandlerError::Permanent(msg) => panic!("headers likely not sent (404): {msg}"),
    }
}

#[tokio::test]
async fn cf_create_order_missing_secret_is_transient() {
    let server = MockServer::start().await;
    let mut ctx = make_ctx();
    ctx.secret_resolver = Arc::new(StaticSecrets { not_found: true });
    let handler = CashfreeCreateOrderHandler::with_api_base(server.uri());
    let err = handler
        .handle(&ctx, &order_payload())
        .await
        .expect_err("expected Transient when secret missing");
    assert!(matches!(err, HandlerError::Transient(_)), "got: {err:?}");
}

//! RazorpayX virtual-account handler tests — `wiremock`, no live keys.
//! Covers the create-VA request contract + error mapping; the success path
//! writes to the DB (skipped here, like the Razorpay/Cashfree handler tests).

use async_trait::async_trait;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::razorpayx::VirtualAccountCreateHandler;
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;
use wiremock::matchers::{method, path};
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
        Ok("rzp_test_FAKE".to_owned())
    }
}

fn make_ctx(not_found: bool) -> HandlerCtx {
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
        event_type: "payment.razorpayx.create_va".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(StaticSecrets { not_found }),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::default_base()),
        http_client,
    }
}

fn va_payload() -> serde_json::Value {
    json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 250000_u64,
    })
}

#[tokio::test]
async fn create_va_422_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/virtual_accounts"))
        .respond_with(ResponseTemplate::new(422).set_body_json(json!({
            "error": { "description": "receiver_invalid" }
        })))
        .mount(&server)
        .await;
    let handler = VirtualAccountCreateHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(false), &va_payload())
        .await
        .expect_err("expected Permanent for 422");
    assert!(matches!(err, HandlerError::Permanent(_)), "got: {err:?}");
}

#[tokio::test]
async fn create_va_500_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/virtual_accounts"))
        .respond_with(ResponseTemplate::new(500).set_body_string("server error"))
        .mount(&server)
        .await;
    let handler = VirtualAccountCreateHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(false), &va_payload())
        .await
        .expect_err("expected Transient for 500");
    assert!(matches!(err, HandlerError::Transient(_)), "got: {err:?}");
}

#[tokio::test]
async fn create_va_missing_secret_is_transient() {
    let server = MockServer::start().await;
    let handler = VirtualAccountCreateHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(true), &va_payload())
        .await
        .expect_err("expected Transient when secret missing");
    assert!(matches!(err, HandlerError::Transient(_)), "got: {err:?}");
}

//! Pine Labs Plutus cloud-POS handler tests — `wiremock`, no live terminal.
//! Covers the UploadBilledTransaction contract + error mapping (the pre-poll
//! paths, which return before the terminal poll loop so they run fast). The
//! approved-poll + invoice-settle path needs a real DB + the poll interval and
//! is left to integration coverage.

use async_trait::async_trait;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::pinelabs::PineLabsPosSaleHandler;
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
        Ok("TEST".to_owned())
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
        event_type: "payment.pinelabs.pos_sale".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(StaticSecrets { not_found }),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::default_base()),
        http_client,
    }
}

fn sale_payload() -> serde_json::Value {
    json!({
        "internal_payment_id": Uuid::new_v4().to_string(),
        "amount_paise": 150000_u64,
    })
}

#[tokio::test]
async fn upload_4xx_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/UploadBilledTransaction"))
        .respond_with(ResponseTemplate::new(401).set_body_string("unauthorized"))
        .mount(&server)
        .await;
    let handler = PineLabsPosSaleHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(false), &sale_payload())
        .await
        .expect_err("expected Permanent for 401");
    assert!(matches!(err, HandlerError::Permanent(_)), "got: {err:?}");
}

#[tokio::test]
async fn upload_rejected_response_code_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/UploadBilledTransaction"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "ResponseCode": 3, "ResponseMessage": "terminal busy"
        })))
        .mount(&server)
        .await;
    let handler = PineLabsPosSaleHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(false), &sale_payload())
        .await
        .expect_err("expected Permanent for rejected upload");
    match err {
        HandlerError::Permanent(msg) => assert!(msg.contains("terminal busy"), "got: {msg}"),
        HandlerError::Transient(msg) => panic!("expected Permanent, got Transient: {msg}"),
    }
}

#[tokio::test]
async fn missing_secret_is_transient() {
    let server = MockServer::start().await;
    let handler = PineLabsPosSaleHandler::with_api_base(server.uri());
    let err = handler
        .handle(&make_ctx(true), &sale_payload())
        .await
        .expect_err("expected Transient when secret missing");
    assert!(matches!(err, HandlerError::Transient(_)), "got: {err:?}");
}

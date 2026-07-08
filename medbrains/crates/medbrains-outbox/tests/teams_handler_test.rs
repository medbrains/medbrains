//! Teams handler tests — `wiremock`, no live Azure app.
//! Covers the client-credentials + create-onlineMeeting two-step error mapping. The static secret
//! resolver returns "MTEST" for every key, so the tenant + organizer path segments are "MTEST".

use async_trait::async_trait;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::teams::TeamsCreateMeetingHandler;
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
        Ok("MTEST".to_owned())
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
        event_type: "meeting.teams.create".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(StaticSecrets { not_found }),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::default_base()),
        http_client,
    }
}

fn payload() -> serde_json::Value {
    json!({ "consultation_id": Uuid::new_v4().to_string(), "topic": "Visit" })
}

fn handler(server: &MockServer) -> TeamsCreateMeetingHandler {
    // graph_base + login_base both point at the mock; tenant/organizer resolve to "MTEST".
    TeamsCreateMeetingHandler::with_bases(server.uri(), server.uri())
}

#[tokio::test]
async fn token_401_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/MTEST/oauth2/v2.0/token"))
        .respond_with(ResponseTemplate::new(401).set_body_string("invalid_client"))
        .mount(&server)
        .await;
    let err = handler(&server)
        .handle(&make_ctx(false), &payload())
        .await
        .expect_err("expected Permanent for token 401");
    assert!(matches!(err, HandlerError::Permanent(_)), "got: {err:?}");
}

#[tokio::test]
async fn meeting_400_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/MTEST/oauth2/v2.0/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "access_token": "tok" })))
        .mount(&server)
        .await;
    Mock::given(method("POST"))
        .and(path("/users/MTEST/onlineMeetings"))
        .respond_with(ResponseTemplate::new(400).set_body_string("bad request"))
        .mount(&server)
        .await;
    let err = handler(&server)
        .handle(&make_ctx(false), &payload())
        .await
        .expect_err("expected Permanent for meeting 400");
    assert!(matches!(err, HandlerError::Permanent(_)), "got: {err:?}");
}

#[tokio::test]
async fn missing_secret_is_transient() {
    let server = MockServer::start().await;
    let err = handler(&server)
        .handle(&make_ctx(true), &payload())
        .await
        .expect_err("expected Transient when secret missing");
    assert!(matches!(err, HandlerError::Transient(_)), "got: {err:?}");
}

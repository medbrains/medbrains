//! Phase 8 — real Twilio outbound handler tests.
//!
//! Same wiremock pattern as `razorpay_handler_test.rs`. We point the
//! handler at a local mock server via `SmsSendHandler::with_api_base`
//! so tests run in parallel without env-var races and the workspace's
//! `unsafe_code = forbid` lint stays clean.

use async_trait::async_trait;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_outbox::handler::{Handler, HandlerCtx, HandlerError};
use medbrains_outbox::handlers::twilio::SmsSendHandler;
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;
use wiremock::matchers::{header, header_exists, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[derive(Debug)]
struct StaticSecrets {
    account_sid: String,
    auth_token: String,
    from_number: String,
    not_found: bool,
}

#[async_trait]
impl SecretResolver for StaticSecrets {
    async fn get(&self, key: &str) -> Result<String, SecretError> {
        if self.not_found {
            return Err(SecretError::NotFound(key.to_owned()));
        }
        if key.ends_with("twilio-account-sid") {
            Ok(self.account_sid.clone())
        } else if key.ends_with("twilio-auth-token") {
            Ok(self.auth_token.clone())
        } else if key.ends_with("twilio-from-number") {
            Ok(self.from_number.clone())
        } else {
            Err(SecretError::NotFound(key.to_owned()))
        }
    }
}

fn make_ctx(secrets: StaticSecrets) -> HandlerCtx {
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
        event_type: "sms.appointment_reminder".to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(secrets),
        http_client,
    }
}

fn good_secrets() -> StaticSecrets {
    StaticSecrets {
        account_sid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".to_owned(),
        auth_token: "FAKE_TOKEN".to_owned(),
        from_number: "+15005550006".to_owned(),
        not_found: false,
    }
}

fn missing_secrets() -> StaticSecrets {
    StaticSecrets {
        account_sid: String::new(),
        auth_token: String::new(),
        from_number: String::new(),
        not_found: true,
    }
}

const SAMPLE_TO: &str = "+919876543210";
const SAMPLE_BODY: &str = "Your appointment is confirmed for 11:30 AM.";

// ── Tests ─────────────────────────────────────────────────────────

#[tokio::test]
async fn sms_2xx_returns_sid() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({
            "sid": "SM_test_message_sid",
            "status": "queued",
            "to": SAMPLE_TO,
        })))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let result = handler.handle(&ctx, &payload).await.expect("expected Ok");
    assert_eq!(result["sid"], "SM_test_message_sid");
    assert_eq!(result["status"], "queued");
}

#[tokio::test]
async fn sms_400_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .respond_with(ResponseTemplate::new(400).set_body_json(json!({
            "code": 21211,
            "message": "Invalid 'To' Phone Number",
            "more_info": "https://www.twilio.com/docs/errors/21211",
            "status": 400,
        })))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Permanent");
    match err {
        HandlerError::Permanent(msg) => {
            assert!(msg.contains("400"), "expected 400 in error: {msg}");
        }
        other => panic!("expected Permanent for 400, got {other:?}"),
    }
}

#[tokio::test]
async fn sms_401_dlqs() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .respond_with(ResponseTemplate::new(401).set_body_string("auth failed"))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.otp", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Permanent");
    assert!(matches!(err, HandlerError::Permanent(_)));
}

#[tokio::test]
async fn sms_500_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .respond_with(ResponseTemplate::new(500).set_body_string("internal server error"))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Transient");
    assert!(matches!(err, HandlerError::Transient(_)));
}

#[tokio::test]
async fn sms_429_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .respond_with(ResponseTemplate::new(429).set_body_string("rate limited"))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Transient");
    assert!(matches!(err, HandlerError::Transient(_)));
}

#[tokio::test]
async fn sms_timeout_retries() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(5)))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Transient");
    match err {
        HandlerError::Transient(msg) => {
            assert!(msg.contains("network") || msg.contains("reqwest"));
        }
        HandlerError::Permanent(msg) => panic!("expected Transient for timeout, got Permanent: {msg}"),
    }
}

#[tokio::test]
async fn sms_missing_secret_retries() {
    let server = MockServer::start().await;
    let ctx = make_ctx(missing_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Transient");
    match err {
        HandlerError::Transient(msg) => assert!(msg.contains("twilio-account-sid")),
        other => panic!("expected Transient for missing secret, got {other:?}"),
    }
}

#[tokio::test]
async fn sms_missing_payload_dlqs() {
    let server = MockServer::start().await;
    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Permanent");
    assert!(matches!(err, HandlerError::Permanent(_)));
}

#[tokio::test]
async fn sms_non_e164_payload_dlqs() {
    let server = MockServer::start().await;
    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": "919876543210", "body": SAMPLE_BODY });

    let err = handler.handle(&ctx, &payload).await.expect_err("expected Permanent");
    match err {
        HandlerError::Permanent(msg) => assert!(msg.contains("E.164")),
        other => panic!("expected Permanent, got {other:?}"),
    }
}

#[tokio::test]
async fn sms_sends_basic_auth_and_idempotency_header() {
    let server = MockServer::start().await;
    // The wiremock matcher fails the request unless it carries both
    // the Twilio Basic auth header and the I-Idempotency-Token. If
    // the handler sends them, the mock returns a successful 201 and
    // the assertion at the bottom passes; otherwise wiremock 404s
    // and the body assertion fails.
    Mock::given(method("POST"))
        .and(path(
            "/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json",
        ))
        .and(header(
            "authorization",
            "Basic QUN4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eDpGQUtFX1RPS0VO",
        ))
        .and(header_exists("i-idempotency-token"))
        .respond_with(ResponseTemplate::new(201).set_body_json(json!({
            "sid": "SM_test_idempotent",
            "status": "queued",
        })))
        .mount(&server)
        .await;

    let ctx = make_ctx(good_secrets());
    let handler = SmsSendHandler::with_api_base("sms.appointment_reminder", server.uri());
    let payload = json!({ "to": SAMPLE_TO, "body": SAMPLE_BODY });

    let result = handler.handle(&ctx, &payload).await.expect("expected Ok");
    assert_eq!(result["sid"], "SM_test_idempotent");
}

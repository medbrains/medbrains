//! Google Meet handler — creates a Meet space for a tele-consultation.
//!
//! OAuth2 refresh-token flow (a stored offline token for a workspace user): POST
//! `{token_url}` with `grant_type=refresh_token` + client id/secret + refresh token → access token,
//! then POST `{api_base}/spaces` (Meet REST v2, scope `meetings.space.created`) → `meetingUri`,
//! stored on the consult. Runs only for `meeting.google_meet.create`. Creds need a tenant's Google
//! Cloud OAuth client + a refresh token.

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_MEET_API: &str = "https://meet.googleapis.com/v2";

#[derive(Debug, Default)]
pub struct GoogleMeetCreateHandler {
    api_base: Option<String>,
    token_url: Option<String>,
}

impl GoogleMeetCreateHandler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Test override: point both the OAuth + Meet calls at a mock server.
    pub fn with_bases(api_base: impl Into<String>, token_url: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
            token_url: Some(token_url.into()),
        }
    }

    fn api_base(&self, payload: &Value) -> String {
        payload["api_base"]
            .as_str()
            .filter(|s| !s.is_empty())
            .or(self.api_base.as_deref())
            .unwrap_or(GOOGLE_MEET_API)
            .trim_end_matches('/')
            .to_owned()
    }

    fn token_url(&self, payload: &Value) -> String {
        payload["token_url"]
            .as_str()
            .filter(|s| !s.is_empty())
            .or(self.token_url.as_deref())
            .unwrap_or(GOOGLE_TOKEN_URL)
            .to_owned()
    }
}

#[async_trait]
impl Handler for GoogleMeetCreateHandler {
    fn event_type(&self) -> &'static str {
        "meeting.google_meet.create"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let consult_id = parse_consult_id(payload)?;

        let client_id = resolve_secret(ctx, "google-client-id").await?;
        let client_secret = resolve_secret(ctx, "google-client-secret").await?;
        let refresh_token = resolve_secret(ctx, "google-refresh-token").await?;

        // 1. Refresh-token → access token.
        let token_resp = ctx
            .http_client
            .post(self.token_url(payload))
            .form(&[
                ("grant_type", "refresh_token"),
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("refresh_token", refresh_token.as_str()),
            ])
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;
        if !token_resp.status().is_success() {
            return Err(classify_status(
                token_resp.status(),
                &token_resp.text().await.unwrap_or_default(),
            ));
        }
        let token_body: Value = token_resp
            .json()
            .await
            .map_err(|e| HandlerError::Transient(format!("google token parse: {e}")))?;
        let access_token = token_body["access_token"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("google token missing access_token".into()))?;

        // 2. Create a Meet space.
        let space_resp = ctx
            .http_client
            .post(format!("{}/spaces", self.api_base(payload)))
            .bearer_auth(access_token)
            .json(&serde_json::json!({}))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;
        if !space_resp.status().is_success() {
            return Err(classify_status(
                space_resp.status(),
                &space_resp.text().await.unwrap_or_default(),
            ));
        }
        let space_body: Value = space_resp
            .json()
            .await
            .map_err(|e| HandlerError::Transient(format!("google space parse: {e}")))?;
        let join_url = space_body["meetingUri"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("google response missing meetingUri".into()))?;

        tracing::info!(tenant_id = %ctx.tenant_id, consult_id = %consult_id, "google_meet.create ok");

        sqlx::query(
            "UPDATE tele_consultations SET meeting_url = $1, updated_at = now() WHERE id = $2",
        )
        .bind(join_url)
        .bind(consult_id)
        .execute(&ctx.pool)
        .await
        .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;

        Ok(serde_json::json!({ "status": "created", "join_url": join_url }))
    }
}

fn parse_consult_id(payload: &Value) -> Result<Uuid, HandlerError> {
    payload["consultation_id"]
        .as_str()
        .ok_or_else(|| HandlerError::Permanent("missing consultation_id".into()))?
        .parse()
        .map_err(|e| HandlerError::Permanent(format!("bad consultation_id uuid: {e}")))
}

async fn resolve_secret(ctx: &HandlerCtx, name: &str) -> Result<String, HandlerError> {
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let key = format!("medbrains/{env}/{tenant}/{name}", tenant = ctx.tenant_id);
    ctx.secret_resolver
        .get(&key)
        .await
        .map_err(|e| HandlerError::Transient(format!("secret {name}: {e}")))
}

fn classify_reqwest_err(e: &reqwest::Error) -> HandlerError {
    if e.is_timeout() || e.is_connect() {
        HandlerError::Transient(format!("network: {e}"))
    } else if e.is_builder() {
        HandlerError::Permanent(format!("request build: {e}"))
    } else {
        HandlerError::Transient(format!("reqwest: {e}"))
    }
}

fn classify_status(status: reqwest::StatusCode, body: &str) -> HandlerError {
    let trimmed = body.chars().take(512).collect::<String>();
    match status.as_u16() {
        400 | 401 | 403 | 404 | 422 => HandlerError::Permanent(format!("google {status}: {trimmed}")),
        429 | 500..=599 => HandlerError::Transient(format!("google {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("google unexpected {status}: {trimmed}")),
    }
}

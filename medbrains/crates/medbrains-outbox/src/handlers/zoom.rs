//! Zoom meeting handler — creates a Zoom meeting for a tele-consultation.
//!
//! Server-to-Server OAuth (account-level, no user redirect): first POST
//! `{token_url}?grant_type=account_credentials&account_id=…` with Basic
//! client_id:secret to get a token, then POST `{api_base}/users/me/meetings`
//! with that Bearer token (scope `meeting:write:admin`) → `join_url`, stored
//! on the consult. Runs only for `meeting.zoom.create`. Verified against Zoom
//! developer docs (RFC-MODULE-telemedicine §3); creds need a tenant's Zoom
//! S2S app.

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const ZOOM_API_BASE: &str = "https://api.zoom.us/v2";
const ZOOM_TOKEN_URL: &str = "https://zoom.us/oauth/token";

#[derive(Debug, Default)]
pub struct ZoomCreateMeetingHandler {
    api_base: Option<String>,
    token_url: Option<String>,
}

impl ZoomCreateMeetingHandler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Test override: point both the OAuth + API calls at a mock server.
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
            .unwrap_or(ZOOM_API_BASE)
            .trim_end_matches('/')
            .to_owned()
    }

    fn token_url(&self, payload: &Value) -> String {
        payload["token_url"]
            .as_str()
            .filter(|s| !s.is_empty())
            .or(self.token_url.as_deref())
            .unwrap_or(ZOOM_TOKEN_URL)
            .to_owned()
    }
}

#[async_trait]
impl Handler for ZoomCreateMeetingHandler {
    fn event_type(&self) -> &'static str {
        "meeting.zoom.create"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let consult_id_str = payload["consultation_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing consultation_id".into()))?;
        let consult_id: Uuid = consult_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad consultation_id uuid: {e}")))?;
        let topic = payload["topic"].as_str().unwrap_or("Tele-consultation");

        let account_id = resolve_secret(ctx, "zoom-account-id").await?;
        let client_id = resolve_secret(ctx, "zoom-client-id").await?;
        let client_secret = resolve_secret(ctx, "zoom-client-secret").await?;

        // 1. Account-credentials token.
        let token_resp = ctx
            .http_client
            .post(self.token_url(payload))
            .query(&[
                ("grant_type", "account_credentials"),
                ("account_id", account_id.as_str()),
            ])
            .basic_auth(&client_id, Some(&client_secret))
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
            .map_err(|e| HandlerError::Transient(format!("zoom token parse: {e}")))?;
        let access_token = token_body["access_token"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("zoom token missing access_token".into()))?;

        // 2. Create the meeting.
        let meet_resp = ctx
            .http_client
            .post(format!("{}/users/me/meetings", self.api_base(payload)))
            .bearer_auth(access_token)
            .json(&serde_json::json!({
                "topic": topic,
                "type": 2, // scheduled
                "settings": { "join_before_host": true, "waiting_room": true },
            }))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;
        if !meet_resp.status().is_success() {
            return Err(classify_status(
                meet_resp.status(),
                &meet_resp.text().await.unwrap_or_default(),
            ));
        }
        let meet_body: Value = meet_resp
            .json()
            .await
            .map_err(|e| HandlerError::Transient(format!("zoom meeting parse: {e}")))?;
        let join_url = meet_body["join_url"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("zoom response missing join_url".into()))?;

        tracing::info!(tenant_id = %ctx.tenant_id, consult_id = %consult_id, "zoom.create_meeting ok");

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

// ── helpers ─────────────────────────────────────────────────────────

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
        400 | 401 | 403 | 404 | 422 => HandlerError::Permanent(format!("zoom {status}: {trimmed}")),
        429 | 500..=599 => HandlerError::Transient(format!("zoom {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("zoom unexpected {status}: {trimmed}")),
    }
}

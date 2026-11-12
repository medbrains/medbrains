//! Microsoft Teams handler — creates a Teams online meeting for a tele-consultation.
//!
//! App-only (client-credentials) OAuth: POST `{login_base}/{tenant}/oauth2/v2.0/token` with
//! `grant_type=client_credentials` + client id/secret + scope `.default` → token, then POST
//! `{graph_base}/users/{organizer}/onlineMeetings` (app needs an application-access-policy for that
//! user) → `joinWebUrl`, stored on the consult. Runs only for `meeting.teams.create`. Creds need a
//! tenant's Azure AD app + an organizer user id.

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";
const LOGIN_BASE: &str = "https://login.microsoftonline.com";

#[derive(Debug, Default)]
pub struct TeamsCreateMeetingHandler {
    graph_base: Option<String>,
    login_base: Option<String>,
}

impl TeamsCreateMeetingHandler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Test override: point both the OAuth + Graph calls at a mock server.
    pub fn with_bases(graph_base: impl Into<String>, login_base: impl Into<String>) -> Self {
        Self {
            graph_base: Some(graph_base.into()),
            login_base: Some(login_base.into()),
        }
    }

    fn graph_base(&self, payload: &Value) -> String {
        payload["graph_base"]
            .as_str()
            .filter(|s| !s.is_empty())
            .or(self.graph_base.as_deref())
            .unwrap_or(GRAPH_BASE)
            .trim_end_matches('/')
            .to_owned()
    }

    fn login_base(&self, payload: &Value) -> String {
        payload["login_base"]
            .as_str()
            .filter(|s| !s.is_empty())
            .or(self.login_base.as_deref())
            .unwrap_or(LOGIN_BASE)
            .trim_end_matches('/')
            .to_owned()
    }
}

#[async_trait]
impl Handler for TeamsCreateMeetingHandler {
    fn event_type(&self) -> &'static str {
        "meeting.teams.create"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let consult_id = parse_consult_id(payload)?;
        let topic = payload["topic"].as_str().unwrap_or("Tele-consultation");

        let tenant = resolve_secret(ctx, "ms-tenant-id").await?;
        let client_id = resolve_secret(ctx, "ms-client-id").await?;
        let client_secret = resolve_secret(ctx, "ms-client-secret").await?;
        let organizer = resolve_secret(ctx, "ms-organizer-user-id").await?;

        // 1. Client-credentials token.
        let token_resp = ctx
            .http_client
            .post(format!("{}/{}/oauth2/v2.0/token", self.login_base(payload), tenant))
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("scope", "https://graph.microsoft.com/.default"),
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
            .map_err(|e| HandlerError::Transient(format!("teams token parse: {e}")))?;
        let access_token = token_body["access_token"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("teams token missing access_token".into()))?;

        // 2. Create the online meeting.
        let meet_resp = ctx
            .http_client
            .post(format!(
                "{}/users/{organizer}/onlineMeetings",
                self.graph_base(payload)
            ))
            .bearer_auth(access_token)
            .json(&serde_json::json!({ "subject": topic }))
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
            .map_err(|e| HandlerError::Transient(format!("teams meeting parse: {e}")))?;
        let join_url = meet_body["joinWebUrl"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("teams response missing joinWebUrl".into()))?;

        tracing::info!(tenant_id = %ctx.tenant_id, consult_id = %consult_id, "teams.create ok");

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
        400 | 401 | 403 | 404 | 422 => HandlerError::Permanent(format!("teams {status}: {trimmed}")),
        429 | 500..=599 => HandlerError::Transient(format!("teams {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("teams unexpected {status}: {trimmed}")),
    }
}

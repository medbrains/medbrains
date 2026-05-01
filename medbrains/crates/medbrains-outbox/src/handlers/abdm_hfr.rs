//! `abdm.hfr.register` outbox handler — submits a facility
//! registration to the NHA HFR (Health Facility Registry) gateway.
//!
//! Phase 11.2. Pairs with `routes::abdm::hfr::register` which queues
//! an event of type `abdm.hfr.register` after persisting the row at
//! status=queued. This handler does the actual gateway POST, then
//! updates the abdm_hfr_registrations row with the NHA-issued
//! facility id (or an error message).
//!
//! Status mapping mirrors the NHCX handler:
//!   2xx                        → Ok + UPDATE row to status='submitted'
//!                                 (NHA approval is async — the final
//!                                 'approved' / 'rejected' transition
//!                                 happens via the gateway callback
//!                                 path)
//!   400 / 401 / 403 / 422      → Permanent (DLQ — operator fix needed)
//!   429 / 5xx / network        → Transient (retry per Worker backoff)
//!
//! NHA HFR endpoint shape is documented at
//! <https://hfr.abdm.gov.in/api/v1/swagger>. The exact path for
//! facility registration is `/v1/facility/registration` against the
//! base URL the env supplies via SecretResolver.

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const HFR_API_BASE: &str = "https://hfr-staging.abdm.gov.in";

#[derive(Debug)]
pub struct HfrRegisterHandler {
    api_base: Option<String>,
}

impl HfrRegisterHandler {
    pub const fn new() -> Self {
        Self { api_base: None }
    }

    pub fn with_api_base(api_base: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
        }
    }

    fn api_base(&self) -> &str {
        self.api_base.as_deref().unwrap_or(HFR_API_BASE)
    }
}

impl Default for HfrRegisterHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Handler for HfrRegisterHandler {
    fn event_type(&self) -> &'static str {
        "abdm.hfr.register"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        // Required payload — the registration row id + the original
        // HfrRegisterRequest body the route persisted in payload JSONB.
        let registration_id = payload["registration_id"]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| HandlerError::Permanent("missing/invalid registration_id".into()))?;
        let body = payload
            .get("body")
            .ok_or_else(|| HandlerError::Permanent("missing body (HFR payload)".into()))?;

        let token = resolve_secret(ctx, "abdm-hfr-token").await?;
        let url = format!("{}/v1/facility/registration", self.api_base());

        let resp = ctx
            .http_client
            .post(&url)
            .bearer_auth(&token)
            .json(body)
            .send()
            .await
            .map_err(classify_reqwest_err)?;

        let status = resp.status();
        if status.is_success() {
            let resp_body: Value = resp.json().await.map_err(|e| {
                HandlerError::Transient(format!("hfr parse: {e}"))
            })?;
            let nha_facility_id = resp_body["facility_id"]
                .as_str()
                .or_else(|| resp_body["fcn"].as_str())
                .map(str::to_owned);

            // Move the registration row to status='submitted'. The
            // 'approved' / 'rejected' transition happens later via
            // the gateway callback path.
            sqlx::query(
                "UPDATE abdm_hfr_registrations \
                    SET status = 'submitted', \
                        nha_facility_id = $1, \
                        response = $2, \
                        updated_at = now() \
                  WHERE id = $3",
            )
            .bind(nha_facility_id.as_deref())
            .bind(&resp_body)
            .bind(registration_id)
            .execute(&ctx.pool)
            .await
            .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                registration_id = %registration_id,
                ?nha_facility_id,
                "abdm.hfr.register submitted"
            );

            return Ok(serde_json::json!({
                "registration_id": registration_id,
                "nha_facility_id": nha_facility_id,
                "status": "submitted",
            }));
        }

        // Non-2xx: persist the error so the admin UI surfaces it.
        let body_text = resp.text().await.unwrap_or_default();
        let trimmed = body_text.chars().take(512).collect::<String>();
        let _ = sqlx::query(
            "UPDATE abdm_hfr_registrations \
                SET status = 'failed', \
                    error_message = $1, \
                    updated_at = now() \
              WHERE id = $2 AND status IN ('queued', 'submitted')",
        )
        .bind(format!("hfr {status}: {trimmed}"))
        .bind(registration_id)
        .execute(&ctx.pool)
        .await;

        Err(classify_status(status, &trimmed))
    }
}

// ── helpers ────────────────────────────────────────────────────────

async fn resolve_secret(ctx: &HandlerCtx, name: &str) -> Result<String, HandlerError> {
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let key = format!("medbrains/{env}/{tenant}/{name}", tenant = ctx.tenant_id);
    ctx.secret_resolver
        .get(&key)
        .await
        .map_err(|e| HandlerError::Transient(format!("secret {name}: {e}")))
}

fn classify_reqwest_err(e: reqwest::Error) -> HandlerError {
    if e.is_timeout() || e.is_connect() {
        HandlerError::Transient(format!("network: {e}"))
    } else if e.is_builder() {
        HandlerError::Permanent(format!("request build: {e}"))
    } else {
        HandlerError::Transient(format!("reqwest: {e}"))
    }
}

fn classify_status(status: reqwest::StatusCode, body: &str) -> HandlerError {
    match status.as_u16() {
        400 | 401 | 403 | 404 | 422 => {
            HandlerError::Permanent(format!("hfr {status}: {body}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("hfr {status}: {body}")),
        _ => HandlerError::Transient(format!("hfr unexpected {status}: {body}")),
    }
}

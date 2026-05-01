//! NHCX (National Health Claim Exchange) outbound handler.
//!
//! Phase 11 of the hybrid roadmap — first ABDM-certified path that
//! goes live. Submits a FHIR R4 transaction Bundle (Patient +
//! Coverage + Encounter + Claim) to the NHCX gateway and records the
//! ClaimResponse callback against the local claim row.
//!
//! Why this lives in the outbox (vs an inline route call):
//! - NHCX requires every submission to carry a unique
//!   `correlation_id`; outbox `event_id` is exactly that.
//! - Network blips during gateway transit must not lose claims.
//!   Transient → backoff → retry is the correct shape.
//! - Audit chain — the outbox already journals every attempt.
//!
//! Status mapping (mirrors Razorpay / Twilio):
//!   2xx                   → Ok with NHCX request_id
//!   400/401/403/404/422   → Permanent (DLQ — operator intervention)
//!   429 / 5xx / network   → Transient (retry per Worker backoff)
//!
//! NHCX endpoint shape per
//! <https://www.nha.gov.in/abdm/health-claim-exchange-nhcx>:
//!   POST {gateway}/hcx/v1/Claim/submit
//!     body: FHIR Bundle (transaction)
//!     headers: Authorization Bearer (HFR token), x-hcx-recipient-code,
//!              x-hcx-sender-code, x-hcx-correlation-id, x-hcx-timestamp
//!
//! The shape is stable enough to lock down at compile time; the
//! gateway-specific token-issuance flow is handled by SecretResolver.

use async_trait::async_trait;
use serde_json::Value;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const NHCX_API_BASE: &str = "https://nhcx-staging.abdm.gov.in";

#[derive(Debug)]
pub struct ClaimSubmitHandler {
    api_base: Option<String>,
}

impl ClaimSubmitHandler {
    pub const fn new() -> Self {
        Self { api_base: None }
    }

    pub fn with_api_base(api_base: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
        }
    }

    fn api_base(&self) -> &str {
        self.api_base.as_deref().unwrap_or(NHCX_API_BASE)
    }
}

impl Default for ClaimSubmitHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Handler for ClaimSubmitHandler {
    fn event_type(&self) -> &'static str {
        "abdm.nhcx.claim_submit"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        // Required payload fields. The route that queues this event
        // is responsible for assembling the FHIR Bundle per
        // medbrains-fhir helpers.
        let bundle = payload.get("bundle").ok_or_else(|| {
            HandlerError::Permanent("missing bundle (FHIR transaction Bundle)".into())
        })?;
        let recipient_code = payload["recipient_code"].as_str().ok_or_else(|| {
            HandlerError::Permanent("missing recipient_code (NHCX payer hcx-id)".into())
        })?;

        let token = resolve_secret(ctx, "abdm-hfr-token").await?;
        let sender_code = resolve_secret(ctx, "abdm-facility-hcx-id").await?;

        let url = format!("{}/hcx/v1/Claim/submit", self.api_base());
        let timestamp = chrono::Utc::now().to_rfc3339();

        let resp = ctx
            .http_client
            .post(&url)
            .bearer_auth(&token)
            .header("x-hcx-recipient-code", recipient_code)
            .header("x-hcx-sender-code", &sender_code)
            .header("x-hcx-correlation-id", ctx.event_id.to_string())
            .header("x-hcx-timestamp", timestamp)
            .json(bundle)
            .send()
            .await
            .map_err(classify_reqwest_err)?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp.json().await.map_err(|e| {
                HandlerError::Transient(format!("nhcx parse: {e}"))
            })?;
            let request_id = body["request_id"]
                .as_str()
                .or_else(|| body["api_call_id"].as_str())
                .ok_or_else(|| {
                    HandlerError::Permanent("nhcx response missing request_id".into())
                })?;

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id = %ctx.event_id,
                nhcx_request_id = request_id,
                "abdm.nhcx.claim_submit ok"
            );

            return Ok(serde_json::json!({
                "request_id": request_id,
                "submitted_at": chrono::Utc::now().to_rfc3339(),
            }));
        }

        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
    }
}

// ── helpers (mirror razorpay/twilio for consistency) ───────────────

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
    let trimmed = body.chars().take(512).collect::<String>();
    match status.as_u16() {
        400 | 401 | 403 | 404 | 422 => {
            HandlerError::Permanent(format!("nhcx {status}: {trimmed}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("nhcx {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("nhcx unexpected {status}: {trimmed}")),
    }
}

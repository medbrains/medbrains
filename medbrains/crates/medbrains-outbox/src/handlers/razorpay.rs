//! Razorpay handlers — typed, real (no pipeline JSON in the path).
//!
//! Covers:
//! - `payment.create_order`  → POST /v1/orders with `receipt = internal_payment_id`
//! - `payment.refund`        → POST /v1/payments/{id}/refund
//!
//! Idempotency: Razorpay deduplicates orders by `receipt`. We pass our
//! internal_payment_id as the receipt so a worker retry after a network
//! blip never creates a second order.
//!
//! Sprint A spec: `RFCs/sprints/SPRINT-A-outbox.md` §6.
//! Phase 1.1: real HTTPS calls + per-tenant SecretResolver + status-code
//! mapping → Transient/Permanent.
//!
//! Status-code map:
//!   2xx                          → Ok + UPDATE payment_gateway_transactions
//!   400 / 401 / 403 / 404        → Permanent (DLQ — operator action needed)
//!   429 / 5xx / network / timeout → Transient (retry per Worker backoff)
//!
//! Razorpay's order.create returns the same order_id when called with
//! a duplicate `receipt`, so a Transient-then-retry cycle that already
//! created the order on the first attempt converges naturally.

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const RAZORPAY_API_BASE: &str = "https://api.razorpay.com/v1";

/// `payment.create_order` handler — real HTTPS via reqwest.
///
/// Default constructs hits production Razorpay; tests use
/// `with_api_base()` to point at a mock server.
#[derive(Debug, Default)]
pub struct CreateOrderHandler {
    api_base: Option<String>,
}

impl CreateOrderHandler {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_api_base(api_base: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
        }
    }

    fn api_base(&self) -> &str {
        self.api_base.as_deref().unwrap_or(RAZORPAY_API_BASE)
    }
}

#[async_trait]
impl Handler for CreateOrderHandler {
    fn event_type(&self) -> &'static str {
        "payment.create_order"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        // Required payload fields
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;

        let amount = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise (u64)".into()))?;
        let currency = payload["currency"].as_str().unwrap_or("INR");

        // Per-tenant credentials
        let key_id = resolve_secret(ctx, "razorpay-key-id").await?;
        let key_secret = resolve_secret(ctx, "razorpay-key-secret").await?;

        let url = format!("{}/orders", self.api_base());

        let resp = ctx
            .http_client
            .post(&url)
            .basic_auth(&key_id, Some(&key_secret))
            .json(&serde_json::json!({
                "amount":   amount,
                "currency": currency,
                "receipt":  txn_id.to_string(),
                "notes": {
                    "tenant_id":   ctx.tenant_id.to_string(),
                    "event_id":    ctx.event_id.to_string(),
                },
            }))
            .send()
            .await
            .map_err(classify_reqwest_err)?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("razorpay parse: {e}")))?;
            let order_id = body["id"]
                .as_str()
                .ok_or_else(|| HandlerError::Permanent("razorpay response missing id".into()))?;

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                txn_id    = %txn_id,
                order_id,
                "razorpay.create_order ok"
            );

            // Update payment_gateway_transactions with the new order_id
            // (worker connects with BYPASSRLS so no tenant filter needed
            // for this internal control-plane write).
            sqlx::query(
                "UPDATE payment_gateway_transactions \
                    SET status = 'created', gateway_order_id = $1, updated_at = now() \
                  WHERE id = $2",
            )
            .bind(order_id)
            .bind(txn_id)
            .execute(&ctx.pool)
            .await
            .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;

            return Ok(serde_json::json!({
                "order_id": order_id,
                "status":   "created",
            }));
        }

        // Non-2xx: classify
        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
    }
}

/// `payment.refund` handler — real HTTPS via reqwest.
#[derive(Debug, Default)]
pub struct RefundHandler {
    api_base: Option<String>,
}

impl RefundHandler {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_api_base(api_base: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
        }
    }

    fn api_base(&self) -> &str {
        self.api_base.as_deref().unwrap_or(RAZORPAY_API_BASE)
    }
}

#[async_trait]
impl Handler for RefundHandler {
    fn event_type(&self) -> &'static str {
        "payment.refund"
    }

    async fn handle(
        &self,
        ctx: &HandlerCtx,
        payload: &Value,
    ) -> Result<Value, HandlerError> {
        let payment_id = payload["razorpay_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing razorpay_payment_id".into()))?;
        let amount = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise".into()))?;
        let speed = payload["speed"].as_str().unwrap_or("normal");

        let key_id = resolve_secret(ctx, "razorpay-key-id").await?;
        let key_secret = resolve_secret(ctx, "razorpay-key-secret").await?;

        let url = format!("{}/payments/{payment_id}/refund", self.api_base());

        let resp = ctx
            .http_client
            .post(&url)
            .basic_auth(&key_id, Some(&key_secret))
            .json(&serde_json::json!({
                "amount": amount,
                "speed":  speed,
                "notes": {
                    "tenant_id": ctx.tenant_id.to_string(),
                    "event_id":  ctx.event_id.to_string(),
                },
            }))
            .send()
            .await
            .map_err(classify_reqwest_err)?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("razorpay parse: {e}")))?;
            let refund_id = body["id"]
                .as_str()
                .ok_or_else(|| HandlerError::Permanent("razorpay response missing id".into()))?;

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                payment_id, refund_id,
                "razorpay.refund ok"
            );

            return Ok(serde_json::json!({
                "refund_id": refund_id,
                "status":    body["status"].as_str().unwrap_or("processed"),
            }));
        }

        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
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
    let trimmed = body.chars().take(512).collect::<String>();
    match status.as_u16() {
        400 | 401 | 403 | 404 | 422 => {
            HandlerError::Permanent(format!("razorpay {status}: {trimmed}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("razorpay {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("razorpay unexpected {status}: {trimmed}")),
    }
}

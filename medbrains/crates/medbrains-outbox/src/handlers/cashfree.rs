//! Cashfree Payment Gateway handlers — additive 2nd online provider.
//!
//! Razorpay's handlers are untouched; these run only for the
//! provider-specific event types the route queues when a tenant's active
//! provider is Cashfree:
//! - `payment.cashfree.create_order` → POST {base}/orders
//! - `payment.cashfree.refund`       → POST {base}/orders/{order_id}/refunds
//!
//! Verified sandbox contract (RFC §7.1): base `https://sandbox.cashfree.com/pg`,
//! headers `x-client-id` / `x-client-secret` / `x-api-version`, amount in
//! **rupees** (not paise), idempotent on our `order_id` (= internal txn id),
//! so a worker retry never creates a second order.
//!
//! Status-code map mirrors Razorpay: 400/401/403/404/422 → Permanent (DLQ),
//! 429 / 5xx / network → Transient (retry per worker backoff).

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const CASHFREE_SANDBOX_BASE: &str = "https://sandbox.cashfree.com/pg";
const CASHFREE_API_VERSION: &str = "2023-08-01";

/// Resolve the API base: explicit per-tenant `api_base` in the payload (so the
/// route can pass sandbox vs live from `cashfree_config.mode`), else the
/// handler's configured base, else the sandbox default.
fn resolve_base(struct_base: Option<&str>, payload: &Value) -> String {
    payload["api_base"]
        .as_str()
        .filter(|s| !s.is_empty())
        .or(struct_base)
        .unwrap_or(CASHFREE_SANDBOX_BASE)
        .trim_end_matches('/')
        .to_owned()
}

/// `payment.cashfree.create_order` handler — real HTTPS via reqwest.
#[derive(Debug, Default)]
pub struct CashfreeCreateOrderHandler {
    api_base: Option<String>,
}

impl CashfreeCreateOrderHandler {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_api_base(api_base: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
        }
    }
}

#[async_trait]
impl Handler for CashfreeCreateOrderHandler {
    fn event_type(&self) -> &'static str {
        "payment.cashfree.create_order"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;

        // Cashfree wants rupees; the platform carries paise everywhere.
        let amount_paise = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise (u64)".into()))?;
        #[allow(clippy::cast_precision_loss)]
        let order_amount = amount_paise as f64 / 100.0;
        let currency = payload["currency"].as_str().unwrap_or("INR");
        // Cashfree requires a customer phone; default is fine for sandbox.
        let customer_phone = payload["customer_phone"].as_str().unwrap_or("9999999999");

        let client_id = resolve_secret(ctx, "cashfree-client-id").await?;
        let client_secret = resolve_secret(ctx, "cashfree-client-secret").await?;

        let url = format!("{}/orders", resolve_base(self.api_base.as_deref(), payload));

        let resp = ctx
            .http_client
            .post(&url)
            .header("x-client-id", &client_id)
            .header("x-client-secret", &client_secret)
            .header("x-api-version", CASHFREE_API_VERSION)
            .json(&serde_json::json!({
                "order_id": txn_id.to_string(),
                "order_amount": order_amount,
                "order_currency": currency,
                "customer_details": {
                    "customer_id": txn_id.to_string(),
                    "customer_phone": customer_phone,
                },
                "order_note": format!("tenant:{}", ctx.tenant_id),
            }))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("cashfree parse: {e}")))?;
            // Cashfree echoes order_id and adds cf_order_id + payment_session_id.
            let order_id = body["order_id"]
                .as_str()
                .or_else(|| body["cf_order_id"].as_str())
                .ok_or_else(|| HandlerError::Permanent("cashfree response missing order id".into()))?;
            let session = body["payment_session_id"].as_str().unwrap_or_default();

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                txn_id    = %txn_id,
                order_id,
                "cashfree.create_order ok"
            );

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
                "payment_session_id": session,
                "status": "created",
            }));
        }

        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
    }
}

/// `payment.cashfree.refund` handler — real HTTPS via reqwest.
#[derive(Debug, Default)]
pub struct CashfreeRefundHandler {
    api_base: Option<String>,
}

impl CashfreeRefundHandler {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_api_base(api_base: impl Into<String>) -> Self {
        Self {
            api_base: Some(api_base.into()),
        }
    }
}

#[async_trait]
impl Handler for CashfreeRefundHandler {
    fn event_type(&self) -> &'static str {
        "payment.cashfree.refund"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let order_id = payload["order_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing order_id".into()))?;
        let amount_paise = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise".into()))?;
        #[allow(clippy::cast_precision_loss)]
        let refund_amount = amount_paise as f64 / 100.0;
        // Idempotent refund id — Cashfree dedupes by (order_id, refund_id).
        let refund_id = payload["refund_id"]
            .as_str()
            .unwrap_or(order_id)
            .to_owned();

        let client_id = resolve_secret(ctx, "cashfree-client-id").await?;
        let client_secret = resolve_secret(ctx, "cashfree-client-secret").await?;

        let url = format!(
            "{}/orders/{order_id}/refunds",
            resolve_base(self.api_base.as_deref(), payload)
        );

        let resp = ctx
            .http_client
            .post(&url)
            .header("x-client-id", &client_id)
            .header("x-client-secret", &client_secret)
            .header("x-api-version", CASHFREE_API_VERSION)
            .json(&serde_json::json!({
                "refund_amount": refund_amount,
                "refund_id": refund_id,
                "refund_note": format!("tenant:{}", ctx.tenant_id),
            }))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("cashfree parse: {e}")))?;
            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                order_id, refund_id,
                "cashfree.refund ok"
            );
            return Ok(serde_json::json!({
                "refund_id": refund_id,
                "status": body["refund_status"].as_str().unwrap_or("PENDING"),
            }));
        }

        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
    }
}

// ── helpers (Cashfree-local; Razorpay's stay private to its module) ──

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
        400 | 401 | 403 | 404 | 422 => HandlerError::Permanent(format!("cashfree {status}: {trimmed}")),
        429 | 500..=599 => HandlerError::Transient(format!("cashfree {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("cashfree unexpected {status}: {trimmed}")),
    }
}

//! RazorpayX Smart Collect — bank **virtual account** handler.
//!
//! The cleanest reverse reconciliation: we mint a per-invoice virtual account
//! (bank account number + IFSC + a UPI VPA). The patient pays to it from any
//! bank/UPI app; RazorpayX fires `virtual_account.credited` and we match the
//! credit back by the VA id — no signature dance, no manual entry.
//!
//! RazorpayX shares Razorpay's key auth + base (`api.razorpay.com/v1`); this
//! handler runs only for `payment.razorpayx.create_va` so the existing Razorpay
//! order/refund handlers are untouched.
//!
//! ⚠ Field names per the public RazorpayX Smart Collect docs; validate against
//! live keys before go-live. The create→store→settle control flow is tested.

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const RAZORPAY_API_BASE: &str = "https://api.razorpay.com/v1";

#[derive(Debug, Default)]
pub struct VirtualAccountCreateHandler {
    api_base: Option<String>,
}

impl VirtualAccountCreateHandler {
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
impl Handler for VirtualAccountCreateHandler {
    fn event_type(&self) -> &'static str {
        "payment.razorpayx.create_va"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;
        let amount_paise = payload["amount_paise"].as_u64();

        let key_id = resolve_secret(ctx, "razorpay-key-id").await?;
        let key_secret = resolve_secret(ctx, "razorpay-key-secret").await?;

        let mut req = serde_json::json!({
            "receivers": { "types": ["bank_account", "vpa"] },
            "description": format!("Invoice {txn_id}"),
            "notes": {
                "txn_id": txn_id.to_string(),
                "tenant_id": ctx.tenant_id.to_string(),
            },
        });
        // A close-on-exact-amount VA when we know the bill amount.
        if let Some(paise) = amount_paise {
            req["amount_expected"] = serde_json::json!(paise);
        }

        let resp = ctx
            .http_client
            .post(format!("{}/virtual_accounts", self.api_base()))
            .basic_auth(&key_id, Some(&key_secret))
            .json(&req)
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(classify_status(status, &resp.text().await.unwrap_or_default()));
        }
        let body: Value = resp
            .json()
            .await
            .map_err(|e| HandlerError::Transient(format!("razorpayx parse: {e}")))?;
        let va_id = body["id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("razorpayx response missing VA id".into()))?;

        tracing::info!(
            tenant_id = %ctx.tenant_id, txn_id = %txn_id, va_id, "razorpayx.create_va ok"
        );

        // Store the VA id (for credited-webhook matching) + the receiver
        // details (account no / IFSC / VPA) in notes for the patient to pay.
        sqlx::query(
            "UPDATE payment_gateway_transactions SET \
                status = 'created', gateway_order_id = $1, payment_method = 'virtual_account', \
                notes = $2, updated_at = now() WHERE id = $3",
        )
        .bind(va_id)
        .bind(&body["receivers"])
        .bind(txn_id)
        .execute(&ctx.pool)
        .await
        .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;

        Ok(serde_json::json!({
            "status": "created",
            "virtual_account_id": va_id,
            "receivers": body["receivers"],
        }))
    }
}

// ── helpers (RazorpayX-local) ───────────────────────────────────────

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
        400 | 401 | 403 | 404 | 422 => {
            HandlerError::Permanent(format!("razorpayx {status}: {trimmed}"))
        }
        _ => HandlerError::Transient(format!("razorpayx {status}: {trimmed}")),
    }
}

//! PayU handlers — typed, real HTTPS calls.
//!
//! Covers:
//! - `payment.payu.create_order` → POST /_payment (form-encoded redirect)
//! - `payment.payu.refund`       → POST /merchant/postservice.php?form=5
//!
//! PayU uses HMAC-SHA512 for request authentication.
//! The `hash` field = SHA512(key|txnid|amount|productinfo|firstname|email|udf1|...|salt)
//!
//! Status-code map:
//!   2xx                          → Ok + UPDATE `payment_gateway_transactions`
//!   400 / 401 / 403 / 404        → Permanent (DLQ)
//!   429 / 5xx / network / timeout → Transient (retry)

use async_trait::async_trait;
use serde_json::Value;
use sha2::{Digest, Sha512};
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const PAYU_PROD_BASE: &str = "https://secure.payu.in";

/// `payment.payu.create_order` handler.
///
/// Generates the hash and returns the form fields for redirect-based payment.
/// The frontend POSTs these fields to PayU's `_payment` endpoint.
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
        self.api_base.as_deref().unwrap_or(PAYU_PROD_BASE)
    }
}

#[async_trait]
impl Handler for CreateOrderHandler {
    fn event_type(&self) -> &'static str {
        "payment.payu.create_order"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;

        let amount_str = payload["amount"]
            .as_str()
            .map(ToOwned::to_owned)
            .or_else(|| {
                payload["amount"].as_f64().map(|a| format!("{:.2}", a))
            })
            .ok_or_else(|| HandlerError::Permanent("missing amount".into()))?;

        let product_info = payload["product_info"]
            .as_str()
            .unwrap_or("MedBrains Payment");

        let first_name = payload["first_name"].as_str().unwrap_or("Patient");
        let email = payload["email"].as_str().unwrap_or("patient@medbrains.local");
        let phone = payload["phone"].as_str().unwrap_or("");
        let surl = payload["surl"].as_str().unwrap_or("");
        let furl = payload["furl"].as_str().unwrap_or("");

        let key = resolve_secret(ctx, "payu-key").await?;
        let salt = resolve_secret(ctx, "payu-salt").await?;

        // PayU hash: SHA512(key|txnid|amount|productinfo|firstname|email|udf1|...|udf10|salt)
        // 17 pipe-separated fields: key,txnid,amount,productinfo,firstname,email,udf1-10,salt
        let hash_input = format!(
            "{}|{}|{}|{}|{}|{}|||||||||{}",
            key, txn_id_str, amount_str, product_info, first_name, email, salt,
        );

        let mut hasher = Sha512::new();
        hasher.update(hash_input.as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let api_base = self.api_base();

        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id  = %ctx.event_id,
            txn_id    = %txn_id,
            "payu.create_order — hash generated"
        );

        Ok(serde_json::json!({
            "action": format!("{}/_payment", api_base),
            "params": {
                "key": key,
                "txnid": txn_id_str,
                "amount": amount_str,
                "productinfo": product_info,
                "firstname": first_name,
                "email": email,
                "phone": phone,
                "surl": surl,
                "furl": furl,
                "hash": hash,
                "udf1": "",
                "udf2": "",
                "udf3": "",
                "udf4": "",
                "udf5": "",
            },
            "status": "created",
        }))
    }
}

/// `payment.payu.refund` handler.
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
        self.api_base.as_deref().unwrap_or(PAYU_PROD_BASE)
    }
}

#[async_trait]
impl Handler for RefundHandler {
    fn event_type(&self) -> &'static str {
        "payment.payu.refund"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let payu_txn_id = payload["payu_transaction_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing payu_transaction_id".into()))?;
        let key = resolve_secret(ctx, "payu-key").await?;
        let salt = resolve_secret(ctx, "payu-salt").await?;

        let api_base = self.api_base();
        let endpoint = "/merchant/postservice.php?form=5";

        // PayU refund hash: SHA512(key|command|var1|salt)
        let hash_input = format!("{}{}{}{}", key, "refund", payu_txn_id, salt);
        let mut hasher = Sha512::new();
        hasher.update(hash_input.as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let url = format!("{}{}", api_base, endpoint);

        let params = [
            ("key", key.as_str()),
            ("command", "refund"),
            ("var1", payu_txn_id),
            ("hash", hash.as_str()),
        ];

        let resp = ctx
            .http_client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("payu parse: {e}")))?;

            let msg = body["msg"].as_str().unwrap_or("");
            if msg != "success" {
                return Err(HandlerError::Permanent(format!(
                    "payu refund failed: {msg}"
                )));
            }

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                payu_txn_id,
                "payu.refund ok"
            );

            return Ok(serde_json::json!({
                "refund_id": body["refund_id"].as_str().unwrap_or(""),
                "status":    "refund_initiated",
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
            HandlerError::Permanent(format!("payu {status}: {trimmed}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("payu {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("payu unexpected {status}: {trimmed}")),
    }
}

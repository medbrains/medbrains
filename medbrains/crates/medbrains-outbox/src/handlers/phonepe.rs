//! PhonePe handlers — typed, real HTTPS calls.
//!
//! Covers:
//! - `payment.phonepe.create_order` → POST /pg/v1/pay
//! - `payment.phonepe.refund`       → POST /pg/v1/refund
//!
//! PhonePe uses a SHA256-based X-VERIFY header for authentication:
//!   X-VERIFY = SHA256(base64(payload) + "/pg/v1/pay" + salt) + "###" + salt_index
//!
//! Amount is in paise (integer). Currency is always INR.
//!
//! Status-code map:
//!   2xx                          → Ok + UPDATE `payment_gateway_transactions`
//!   400 / 401 / 403 / 404        → Permanent (DLQ)
//!   429 / 5xx / network / timeout → Transient (retry)

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const PHONEPE_PROD_BASE: &str = "https://api.phonepe.com/apis/pg";

/// `payment.phonepe.create_order` handler.
///
/// Creates a UPI collect / intent request via PhonePe PG API.
/// The patient receives a UPI collect request on their PhonePe app,
/// or the frontend renders a QR code for intent-based payment.
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
        self.api_base
            .as_deref()
            .unwrap_or(PHONEPE_PROD_BASE)
    }
}

#[async_trait]
impl Handler for CreateOrderHandler {
    fn event_type(&self) -> &'static str {
        "payment.phonepe.create_order"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;

        let amount = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise (u64)".into()))?;

        let phone = payload["phone"]
            .as_str()
            .unwrap_or("");

        let merchant_id = resolve_secret(ctx, "phonepe-merchant-id").await?;
        let salt = resolve_secret(ctx, "phonepe-salt-key").await?;
        let salt_index = payload["salt_index"]
            .as_str()
            .unwrap_or("1");

        // PhonePe requires a unique transaction ID per order
        let phonepe_txn_id = format!("MB_{}", txn_id);

        let api_base = self.api_base();
        let endpoint = "/pg/v1/pay";

        let request_body = serde_json::json!({
            "merchantId": merchant_id,
            "transactionId": phonepe_txn_id,
            "amount": amount,
            "merchantTransactionId": txn_id.to_string(),
            "callbackUrl": payload["callback_url"].as_str().unwrap_or(""),
            "mobileNumber": phone,
            "paymentInstrument": {
                "type": "UPI_COLLECT",
                "vpa": payload["vpa"].as_str().unwrap_or(""),
            },
        });

        let body_str = serde_json::to_string(&request_body)
            .map_err(|e| HandlerError::Permanent(format!("json serialize: {e}")))?;
        let body_base64 = BASE64.encode(body_str.as_bytes());

        // X-VERIFY = SHA256(base64(body) + endpoint + salt) + "###" + salt_index
        let hash_input = format!("{}{}{}", body_base64, endpoint, salt);
        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let hash_result = format!("{:x}", hasher.finalize());
        let x_verify = format!("{}###{}", hash_result, salt_index);

        let url = format!("{}{}", api_base, endpoint);

        let resp = ctx
            .http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("X-VERIFY", &x_verify)
            .body(body_base64.clone())
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("phonepe parse: {e}")))?;

            let code = body["code"].as_str().unwrap_or("");
            if code != "PAYMENT_INITIATED" && code != "SUCCESS" {
                let msg = body["message"].as_str().unwrap_or("unknown error");
                return Err(HandlerError::Permanent(format!(
                    "phonepe init failed: {code} — {msg}"
                )));
            }

            let order_id = body["data"]["merchantTransactionId"]
                .as_str()
                .unwrap_or(txn_id_str);

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                txn_id    = %txn_id,
                phonepe_txn_id,
                "phonepe.create_order ok"
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
                "status":   "created",
                "phonepe_txn_id": phonepe_txn_id,
            }));
        }

        let body_text = resp.text().await.unwrap_or_default();
        Err(classify_status(status, &body_text))
    }
}

/// `payment.phonepe.refund` handler.
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
        self.api_base
            .as_deref()
            .unwrap_or(PHONEPE_PROD_BASE)
    }
}

#[async_trait]
impl Handler for RefundHandler {
    fn event_type(&self) -> &'static str {
        "payment.phonepe.refund"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let phonepe_txn_id = payload["phonepe_transaction_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing phonepe_transaction_id".into()))?;
        let amount = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise".into()))?;

        let merchant_id = resolve_secret(ctx, "phonepe-merchant-id").await?;
        let salt = resolve_secret(ctx, "phonepe-salt-key").await?;
        let salt_index = payload["salt_index"]
            .as_str()
            .unwrap_or("1");

        let refund_id = format!("MBREF_{}", Uuid::new_v4());

        let api_base = self.api_base();
        let endpoint = "/pg/v1/refund";

        let request_body = serde_json::json!({
            "merchantId": merchant_id,
            "transactionId": refund_id,
            "originalTransactionId": phonepe_txn_id,
            "amount": amount,
        });

        let body_str = serde_json::to_string(&request_body)
            .map_err(|e| HandlerError::Permanent(format!("json serialize: {e}")))?;
        let body_base64 = BASE64.encode(body_str.as_bytes());

        let hash_input = format!("{}{}{}", body_base64, endpoint, salt);
        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let hash_result = format!("{:x}", hasher.finalize());
        let x_verify = format!("{}###{}", hash_result, salt_index);

        let url = format!("{}{}", api_base, endpoint);

        let resp = ctx
            .http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("X-VERIFY", &x_verify)
            .body(body_base64)
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if status.is_success() {
            let body: Value = resp
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("phonepe parse: {e}")))?;

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                phonepe_txn_id, refund_id,
                "phonepe.refund ok"
            );

            return Ok(serde_json::json!({
                "refund_id": refund_id,
                "status":    body["code"].as_str().unwrap_or("REFUND_INITIATED"),
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
            HandlerError::Permanent(format!("phonepe {status}: {trimmed}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("phonepe {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("phonepe unexpected {status}: {trimmed}")),
    }
}

//! Pine Labs Plutus cloud-POS handler — additive POS provider (poll model).
//!
//! Unlike the online gateways (webhook settle), a POS card machine is driven
//! by **push + poll**: we upload the billed sale to the terminal, the cashier
//! has the customer tap/insert, and we poll for the result. Razorpay/Cashfree
//! handlers are untouched; this runs only for `payment.pinelabs.pos_sale`.
//!
//! Verified UAT endpoints (RFC §7.2):
//!   {base}/UploadBilledTransaction   → returns PlutusTransactionReferenceID (PTRID)
//!   {base}/GetCloudBasedTxnStatus    → poll until terminal
//! base (UAT): https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1
//!
//! ⚠ The exact Pine Labs request/response FIELD NAMES below are per the public
//! integration guide and MUST be validated against a real UAT terminal before
//! go-live; the status-mapping + poll/settle control flow is covered by tests.
//!
//! On APPROVED we settle the invoice inline (worker connects with BYPASSRLS,
//! so by-id writes need no tenant context) so a POS approval can never leave
//! the invoice uncollected.

use async_trait::async_trait;
use serde_json::Value;
use std::time::Duration;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const PINELABS_UAT_BASE: &str =
    "https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1";
/// Pine Labs `ResponseCode` for "transaction still in progress at the terminal".
const PLUTUS_PROCESSING: i64 = 1001;
/// Max poll attempts × interval ≈ how long the cashier has at the terminal.
const POLL_ATTEMPTS: u32 = 20;
const POLL_INTERVAL: Duration = Duration::from_secs(3);

fn resolve_base(struct_base: Option<&str>, payload: &Value) -> String {
    payload["api_base"]
        .as_str()
        .filter(|s| !s.is_empty())
        .or(struct_base)
        .unwrap_or(PINELABS_UAT_BASE)
        .trim_end_matches('/')
        .to_owned()
}

#[derive(Debug, Default)]
pub struct PineLabsPosSaleHandler {
    api_base: Option<String>,
}

impl PineLabsPosSaleHandler {
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
impl Handler for PineLabsPosSaleHandler {
    fn event_type(&self) -> &'static str {
        "payment.pinelabs.pos_sale"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;
        let amount_paise = payload["amount_paise"]
            .as_u64()
            .ok_or_else(|| HandlerError::Permanent("missing amount_paise".into()))?;

        let creds = PlutusCreds::resolve(ctx).await?;
        let base = resolve_base(self.api_base.as_deref(), payload);

        // 1. Push the billed sale to the terminal → PTRID.
        let upload = ctx
            .http_client
            .post(format!("{base}/UploadBilledTransaction"))
            .json(&serde_json::json!({
                "MerchantID": creds.merchant_id,
                "SecurityToken": creds.security_token,
                "ClientID": creds.client_id,
                "StoreID": creds.store_id,
                "Amount": amount_paise,
                "TransactionNumber": txn_id.to_string(),
                "SequenceNumber": 1,
                "AllowedPaymentMode": 10, // all card/UPI modes
                "AutoCancelDurationInMinutes": 5,
            }))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = upload.status();
        if !status.is_success() {
            return Err(classify_status(status, &upload.text().await.unwrap_or_default()));
        }
        let body: Value = upload
            .json()
            .await
            .map_err(|e| HandlerError::Transient(format!("plutus upload parse: {e}")))?;
        if body["ResponseCode"].as_i64() != Some(0) {
            return Err(HandlerError::Permanent(format!(
                "plutus upload rejected: {} {}",
                body["ResponseCode"], body["ResponseMessage"]
            )));
        }
        let ptrid = body["PlutusTransactionReferenceID"]
            .as_str()
            .map(ToOwned::to_owned)
            .or_else(|| body["PlutusTransactionReferenceID"].as_i64().map(|n| n.to_string()))
            .ok_or_else(|| HandlerError::Permanent("plutus upload missing PTRID".into()))?;

        sqlx::query(
            "UPDATE payment_gateway_transactions \
                SET gateway_order_id = $1, status = 'created', updated_at = now() WHERE id = $2",
        )
        .bind(&ptrid)
        .bind(txn_id)
        .execute(&ctx.pool)
        .await
        .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;

        // 2. Poll the terminal until the customer completes (or times out).
        for _ in 0..POLL_ATTEMPTS {
            tokio::time::sleep(POLL_INTERVAL).await;
            let poll = ctx
                .http_client
                .post(format!("{base}/GetCloudBasedTxnStatus"))
                .json(&serde_json::json!({
                    "MerchantID": creds.merchant_id,
                    "SecurityToken": creds.security_token,
                    "ClientID": creds.client_id,
                    "StoreID": creds.store_id,
                    "PlutusTransactionReferenceID": ptrid,
                }))
                .send()
                .await
                .map_err(|e| classify_reqwest_err(&e))?;
            if !poll.status().is_success() {
                continue; // transient terminal blip — keep polling
            }
            let status_body: Value = poll
                .json()
                .await
                .map_err(|e| HandlerError::Transient(format!("plutus status parse: {e}")))?;
            match status_body["ResponseCode"].as_i64() {
                Some(0) => {
                    settle_pos_approval(ctx, txn_id, &ptrid, &status_body).await?;
                    return Ok(serde_json::json!({ "status": "captured", "ptrid": ptrid }));
                }
                Some(PLUTUS_PROCESSING) => {} // still at the terminal — keep polling
                other => {
                    mark_pos_failed(ctx, txn_id, &status_body).await?;
                    return Ok(serde_json::json!({
                        "status": "failed",
                        "ptrid": ptrid,
                        "response_code": other,
                    }));
                }
            }
        }

        // Timed out waiting for the terminal — leave 'created'; the cashier can
        // re-query/cancel. Transient so the worker doesn't DLQ a live sale.
        Err(HandlerError::Transient(format!(
            "plutus poll timeout for PTRID {ptrid}"
        )))
    }
}

/// On terminal APPROVED: mark the txn captured and post the payment to the
/// invoice (revenue-safe — a POS approval always settles). BYPASSRLS by-id.
async fn settle_pos_approval(
    ctx: &HandlerCtx,
    txn_id: Uuid,
    ptrid: &str,
    status_body: &Value,
) -> Result<(), HandlerError> {
    #[derive(sqlx::FromRow)]
    struct TxnRow {
        tenant_id: Uuid,
        invoice_id: Option<Uuid>,
        amount: rust_decimal::Decimal,
        status: String,
    }
    let txn = sqlx::query_as::<_, TxnRow>(
        "SELECT tenant_id, invoice_id, amount, status \
           FROM payment_gateway_transactions WHERE id = $1",
    )
    .bind(txn_id)
    .fetch_one(&ctx.pool)
    .await
    .map_err(|e| HandlerError::Transient(format!("db read: {e}")))?;

    if txn.status == "captured" {
        return Ok(()); // idempotent — already settled
    }

    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
            status = 'captured', gateway_payment_id = $1, payment_method = 'card', \
            webhook_payload = $2, verified_at = now(), updated_at = now() WHERE id = $3",
    )
    .bind(ptrid)
    .bind(status_body)
    .bind(txn_id)
    .execute(&ctx.pool)
    .await
    .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;

    if let Some(invoice_id) = txn.invoice_id {
        sqlx::query(
            "INSERT INTO payments \
                (tenant_id, invoice_id, amount, mode, reference_number, notes, paid_at) \
             VALUES ($1, $2, $3, 'card'::payment_mode, $4, 'Pine Labs POS', now())",
        )
        .bind(txn.tenant_id)
        .bind(invoice_id)
        .bind(txn.amount)
        .bind(ptrid)
        .execute(&ctx.pool)
        .await
        .map_err(|e| HandlerError::Transient(format!("payment insert: {e}")))?;

        sqlx::query(
            "UPDATE invoices SET \
                paid_amount = paid_amount + $1, \
                status = CASE WHEN paid_amount + $1 >= total_amount \
                    THEN 'paid'::invoice_status ELSE 'partially_paid'::invoice_status END, \
                updated_at = now() WHERE id = $2 AND tenant_id = $3",
        )
        .bind(txn.amount)
        .bind(invoice_id)
        .bind(txn.tenant_id)
        .execute(&ctx.pool)
        .await
        .map_err(|e| HandlerError::Transient(format!("invoice update: {e}")))?;
    }
    Ok(())
}

async fn mark_pos_failed(
    ctx: &HandlerCtx,
    txn_id: Uuid,
    status_body: &Value,
) -> Result<(), HandlerError> {
    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
            status = 'failed', webhook_payload = $1, updated_at = now() WHERE id = $2",
    )
    .bind(status_body)
    .bind(txn_id)
    .execute(&ctx.pool)
    .await
    .map_err(|e| HandlerError::Transient(format!("db update: {e}")))?;
    Ok(())
}

struct PlutusCreds {
    merchant_id: String,
    security_token: String,
    client_id: String,
    store_id: String,
}

impl PlutusCreds {
    async fn resolve(ctx: &HandlerCtx) -> Result<Self, HandlerError> {
        Ok(Self {
            merchant_id: resolve_secret(ctx, "pinelabs-merchant-id").await?,
            security_token: resolve_secret(ctx, "pinelabs-security-token").await?,
            client_id: resolve_secret(ctx, "pinelabs-client-id").await?,
            store_id: resolve_secret(ctx, "pinelabs-store-id").await?,
        })
    }
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
        400 | 401 | 403 | 404 | 422 => HandlerError::Permanent(format!("plutus {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("plutus {status}: {trimmed}")),
    }
}

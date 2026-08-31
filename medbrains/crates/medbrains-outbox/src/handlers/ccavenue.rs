//! CCAvenue handlers — typed, real HTTPS calls.
//!
//! Covers:
//! - `payment.ccavenue.create_order` → POST /transaction.do?command=initiateTxn
//! - `payment.ccavenue.refund`       → POST /transaction.do?command=refundOrder
//!
//! CCAvenue uses AES-256-CBC encryption for request/response.
//! The `encRequest` field is encrypted, and the response `encResp` is decrypted.
//!
//! Status-code map:
//!   2xx                          → Ok + UPDATE `payment_gateway_transactions`
//!   400 / 401 / 403 / 404        → Permanent (DLQ)
//!   429 / 5xx / network / timeout → Transient (retry)

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use cipher::{block_padding::NoPadding, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use serde_json::Value;
use uuid::Uuid;

use crate::handler::{Handler, HandlerCtx, HandlerError};

const CCAVENUE_PROD_BASE: &str = "https://www.ccavenue.com";

type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

/// `payment.ccavenue.create_order` handler.
///
/// Encrypts the order data and returns the encrypted form fields for redirect.
/// The frontend POSTs these fields to CCAvenue's `transaction.do` endpoint.
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
        self.api_base.as_deref().unwrap_or(CCAVENUE_PROD_BASE)
    }
}

#[async_trait]
impl Handler for CreateOrderHandler {
    fn event_type(&self) -> &'static str {
        "payment.ccavenue.create_order"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let txn_id_str = payload["internal_payment_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing internal_payment_id".into()))?;
        let txn_id: Uuid = txn_id_str
            .parse()
            .map_err(|e| HandlerError::Permanent(format!("bad internal_payment_id uuid: {e}")))?;

        let amount = payload["amount"]
            .as_str()
            .map(ToOwned::to_owned)
            .or_else(|| {
                payload["amount"].as_f64().map(|a| format!("{:.2}", a))
            })
            .ok_or_else(|| HandlerError::Permanent("missing amount".into()))?;

        let merchant_id = resolve_secret(ctx, "ccavenue-merchant-id").await?;
        let working_key = resolve_secret(ctx, "ccavenue-working-key").await?;

        let currency = payload["currency"].as_str().unwrap_or("INR");
        let redirect_url = payload["redirect_url"].as_str().unwrap_or("");
        let cancel_url = payload["cancel_url"].as_str().unwrap_or("");
        let language = payload["language"].as_str().unwrap_or("EN");

        let api_base = self.api_base();
        let endpoint = "/transaction.do?command=initiateTxn";

        // CCAvenue order params (key-value pairs, then encrypted)
        let order_params = format!(
            "merchant_id={}&order_id={}&amount={}&currency={}&redirect_url={}&cancel_url={}&language={}&billing_name={}&billing_address={}&billing_city={}&billing_state={}&billing_zip={}&billing_country={}&billing_tel={}&billing_email={}",
            urlencoding::encode(&merchant_id),
            urlencoding::encode(txn_id_str),
            urlencoding::encode(&amount),
            urlencoding::encode(currency),
            urlencoding::encode(redirect_url),
            urlencoding::encode(cancel_url),
            urlencoding::encode(language),
            urlencoding::encode(payload["billing_name"].as_str().unwrap_or("Patient")),
            urlencoding::encode(payload["billing_address"].as_str().unwrap_or("")),
            urlencoding::encode(payload["billing_city"].as_str().unwrap_or("")),
            urlencoding::encode(payload["billing_state"].as_str().unwrap_or("")),
            urlencoding::encode(payload["billing_zip"].as_str().unwrap_or("")),
            urlencoding::encode(payload["billing_country"].as_str().unwrap_or("India")),
            urlencoding::encode(payload["billing_tel"].as_str().unwrap_or("")),
            urlencoding::encode(payload["billing_email"].as_str().unwrap_or("patient@medbrains.local")),
        );

        let encrypted = encrypt_aes_cbc(&order_params, &working_key)
            .map_err(|e| HandlerError::Permanent(format!("encryption failed: {e}")))?;

        tracing::info!(
            tenant_id = %ctx.tenant_id,
            event_id  = %ctx.event_id,
            txn_id    = %txn_id,
            "ccavenue.create_order — encrypted payload generated"
        );

        Ok(serde_json::json!({
            "action": format!("{}{}", api_base, endpoint),
            "params": {
                "encRequest": encrypted,
                "access_code": merchant_id,
            },
            "status": "created",
        }))
    }
}

/// `payment.ccavenue.refund` handler.
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
        self.api_base.as_deref().unwrap_or(CCAVENUE_PROD_BASE)
    }
}

#[async_trait]
impl Handler for RefundHandler {
    fn event_type(&self) -> &'static str {
        "payment.ccavenue.refund"
    }

    async fn handle(&self, ctx: &HandlerCtx, payload: &Value) -> Result<Value, HandlerError> {
        let order_id = payload["order_id"]
            .as_str()
            .ok_or_else(|| HandlerError::Permanent("missing order_id".into()))?;
        let amount = payload["amount"]
            .as_str()
            .map(ToOwned::to_owned)
            .or_else(|| {
                payload["amount"].as_f64().map(|a| format!("{:.2}", a))
            })
            .ok_or_else(|| HandlerError::Permanent("missing amount".into()))?;

        let working_key = resolve_secret(ctx, "ccavenue-working-key").await?;

        let api_base = self.api_base();
        let endpoint = "/transaction.do?command=refundOrder";

        let refund_params = format!(
            "order_id={}&amount={}&reason={}",
            urlencoding::encode(order_id),
            urlencoding::encode(&amount),
            urlencoding::encode(payload["reason"].as_str().unwrap_or("Customer request")),
        );

        let encrypted = encrypt_aes_cbc(&refund_params, &working_key)
            .map_err(|e| HandlerError::Permanent(format!("encryption failed: {e}")))?;

        let url = format!("{}{}", api_base, endpoint);

        let resp = ctx
            .http_client
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!("encRequest={}", urlencoding::encode(&encrypted)))
            .send()
            .await
            .map_err(|e| classify_reqwest_err(&e))?;

        let status = resp.status();
        if status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();

            // CCAvenue returns form-encoded response with encResp
            let enc_resp = body_text
                .split("encResp=")
                .nth(1)
                .unwrap_or("")
                .split('&')
                .next()
                .unwrap_or("");

            let decoded_resp = urlencoding::decode(enc_resp)
                .map_err(|e| HandlerError::Transient(format!("url decode: {e}")))?
                .to_string();

            let decrypted = decrypt_aes_cbc(&decoded_resp, &working_key)
                .map_err(|e| HandlerError::Permanent(format!("decryption failed: {e}")))?;

            tracing::info!(
                tenant_id = %ctx.tenant_id,
                event_id  = %ctx.event_id,
                order_id,
                "ccavenue.refund — response decrypted"
            );

            Ok(serde_json::json!({
                "status": "refund_initiated",
                "response": decrypted,
            }))
        } else {
            let body_text = resp.text().await.unwrap_or_default();
            Err(classify_status(status, &body_text))
        }
    }
}

// ── helpers ────────────────────────────────────────────────────────

fn encrypt_aes_cbc(plaintext: &str, working_key: &str) -> Result<String, String> {
    let key = working_key.as_bytes();
    let iv = key[..16].to_vec(); // CCAvenue uses first 16 bytes of key as IV

    let mut buf = plaintext.as_bytes().to_vec();
    // PKCS7 padding
    let pad_len = 16 - (buf.len() % 16);
    buf.extend(std::iter::repeat_n(pad_len as u8, pad_len));

    let encryptor = Aes256CbcEnc::new_from_slices(key, &iv)
        .map_err(|e| format!("cipher init: {e}"))?;
    let ciphertext = encryptor.encrypt_padded_vec_mut::<NoPadding>(&buf);

    Ok(BASE64.encode(&ciphertext))
}

fn decrypt_aes_cbc(ciphertext_b64: &str, working_key: &str) -> Result<String, String> {
    let key = working_key.as_bytes();
    let iv = key[..16].to_vec();

    let ciphertext = BASE64
        .decode(ciphertext_b64)
        .map_err(|e| format!("base64 decode: {e}"))?;

    let decryptor = Aes256CbcDec::new_from_slices(key, &iv)
        .map_err(|e| format!("cipher init: {e}"))?;
    let mut buf = ciphertext.clone();
    decryptor
        .decrypt_padded_mut::<NoPadding>(&mut buf)
        .map_err(|e| format!("decrypt: {e}"))?;

    String::from_utf8(buf).map_err(|e| format!("utf8: {e}"))
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
        400 | 401 | 403 | 404 | 422 => {
            HandlerError::Permanent(format!("ccavenue {status}: {trimmed}"))
        }
        429 | 500..=599 => HandlerError::Transient(format!("ccavenue {status}: {trimmed}")),
        _ => HandlerError::Transient(format!("ccavenue unexpected {status}: {trimmed}")),
    }
}

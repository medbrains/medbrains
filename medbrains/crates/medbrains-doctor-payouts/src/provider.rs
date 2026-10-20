//! How a payout leaves the hospital, behind one provider-neutral trait: a
//! bank file finance uploads (and later confirms with the UTR), or RazorpayX
//! Payouts. Cash is recorded by hand and needs no provider.

use std::time::Duration;

use async_trait::async_trait;
use medbrains_core::secrets::SecretResolver;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::Tx;

/// One payout to send.
#[derive(Debug, Clone)]
pub struct PayoutRequest {
    pub idempotency_key: String,
    pub statement_id: Uuid,
    pub amount: Decimal,
    /// `bank` or `upi`.
    pub mode: String,
    pub payee_name: String,
    pub account_number: Option<String>,
    pub ifsc: Option<String>,
    pub vpa: Option<String>,
}

/// What the provider said.
#[derive(Debug)]
pub enum Sent {
    /// Waiting for a person to confirm it (a bank file).
    Pending,
    /// Accepted; the money is on its way.
    Processing { provider_ref: String },
    Paid {
        provider_ref: String,
        utr: Option<String>,
    },
    /// A definite no; the statement can be paid another way.
    Refused(String),
    /// No answer: whether it acted is unknown, so retry with the same key.
    Unreachable(String),
}

#[async_trait]
pub trait PayoutProvider: Send + Sync + std::fmt::Debug {
    fn code(&self) -> &'static str;
    async fn send(&self, req: &PayoutRequest) -> Sent;
}

/// Payouts go into a bank upload file; finance enters each UTR afterwards.
#[derive(Debug)]
pub struct BankFile;

#[async_trait]
impl PayoutProvider for BankFile {
    fn code(&self) -> &'static str {
        "bank_file"
    }

    async fn send(&self, _req: &PayoutRequest) -> Sent {
        Sent::Pending
    }
}

/// The secret that points RazorpayX calls at a stand-in (tests, sandboxes);
/// the same one the collect side uses.
pub const API_BASE_OVERRIDE: &str = "RAZORPAY_API_BASE_OVERRIDE";
const API_BASE: &str = "https://api.razorpay.com/v1";
const CALL_TIMEOUT: Duration = Duration::from_secs(20);

/// RazorpayX Payouts: a composite payout (contact + fund account + payout in
/// one call) to a bank account by IMPS or to a UPI ID, purpose "vendor bill",
/// with an idempotency key so a retry never pays twice.
#[derive(Debug)]
pub struct RazorpayX {
    pub base: String,
    pub key_id: String,
    pub key_secret: String,
    pub account_number: String,
}

impl RazorpayX {
    /// The tenant's RazorpayX payout settings (`payments` / `razorpayx_payouts`:
    /// `key_id`, `key_secret`, `account_number`), or `None` when not set up.
    pub async fn configured(
        tx: &mut Tx<'_>,
        secrets: &dyn SecretResolver,
        tenant_id: Uuid,
    ) -> Result<Option<Self>, AppError> {
        let cfg = sqlx::query_scalar::<_, Value>(
            "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'payments' \
               AND key = 'razorpayx_payouts' AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;
        let base = secrets
            .get(API_BASE_OVERRIDE)
            .await
            .ok()
            .filter(|b| b.starts_with("http"))
            .map_or_else(
                || API_BASE.to_owned(),
                |b| b.trim_end_matches('/').to_owned(),
            );
        Ok(cfg.and_then(|c| {
            let field = |k: &str| {
                c[k].as_str()
                    .map(ToOwned::to_owned)
                    .filter(|v| !v.is_empty())
            };
            Some(Self {
                base,
                key_id: field("key_id")?,
                key_secret: field("key_secret")?,
                account_number: field("account_number")?,
            })
        }))
    }

    fn body(&self, req: &PayoutRequest) -> Value {
        let contact = json!({ "name": req.payee_name, "type": "vendor",
                              "reference_id": req.statement_id.to_string() });
        let fund_account = if req.mode == "upi" {
            json!({ "account_type": "vpa", "vpa": { "address": req.vpa }, "contact": contact })
        } else {
            json!({ "account_type": "bank_account", "contact": contact,
                    "bank_account": { "name": req.payee_name, "ifsc": req.ifsc,
                                      "account_number": req.account_number } })
        };
        let paise = (req.amount * Decimal::ONE_HUNDRED)
            .round()
            .to_i64()
            .unwrap_or_default();
        json!({
            "account_number": self.account_number,
            "amount": paise,
            "currency": "INR",
            "mode": if req.mode == "upi" { "UPI" } else { "IMPS" },
            "purpose": "vendor bill",
            "fund_account": fund_account,
            "queue_if_low_balance": true,
            "reference_id": req.statement_id.simple().to_string(),
            "narration": "Doctor professional fees",
        })
    }
}

#[async_trait]
impl PayoutProvider for RazorpayX {
    fn code(&self) -> &'static str {
        "razorpayx"
    }

    async fn send(&self, req: &PayoutRequest) -> Sent {
        let client = match reqwest::Client::builder().timeout(CALL_TIMEOUT).build() {
            Ok(c) => c,
            Err(e) => return Sent::Unreachable(format!("http client: {e}")),
        };
        let response = match client
            .post(format!("{}/payouts", self.base))
            .basic_auth(&self.key_id, Some(&self.key_secret))
            .header("X-Payout-Idempotency", &req.idempotency_key)
            .json(&self.body(req))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => return Sent::Unreachable(format!("RazorpayX did not answer: {e}")),
        };
        let status = response.status();
        let answer: Value = response.json().await.unwrap_or(Value::Null);
        if status.as_u16() == 429 || status.is_server_error() {
            return Sent::Unreachable(format!("RazorpayX is unavailable ({status})"));
        }
        if !status.is_success() {
            let why = answer["error"]["description"].as_str().unwrap_or("refused");
            return Sent::Refused(why.to_owned());
        }
        let provider_ref = answer["id"].as_str().unwrap_or_default().to_owned();
        match answer["status"].as_str() {
            Some("processed") => Sent::Paid {
                provider_ref,
                utr: answer["utr"].as_str().map(ToOwned::to_owned),
            },
            Some("rejected" | "cancelled" | "failed" | "reversed") => Sent::Refused(
                answer["status_details"]["description"]
                    .as_str()
                    .unwrap_or("rejected by RazorpayX")
                    .to_owned(),
            ),
            _ => Sent::Processing { provider_ref },
        }
    }
}

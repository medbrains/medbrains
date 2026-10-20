//! PhonePe Payment Gateway (Standard Checkout v2) behind [`OnlineProvider`].
//!
//! VERIFIED (developer.phonepe.com, standard checkout API reference):
//! * Token: `POST /v1/oauth/token`, form `client_id`, `client_version`,
//!   `client_secret`, `grant_type=client_credentials` → `access_token`;
//!   calls carry `Authorization: O-Bearer <token>`. UAT host
//!   `api-preprod.phonepe.com/apis/pg-sandbox` (token and payments); live
//!   token `api.phonepe.com/apis/identity-manager`, payments
//!   `api.phonepe.com/apis/pg`.
//! * Pay: `POST /checkout/v2/pay` `{ merchantOrderId (≤63), amount (paise,
//!   ≥100), expireAfter (300–3600 s), paymentFlow: { type: PG_CHECKOUT,
//!   merchantUrls: { redirectUrl } } }` → `{ orderId, state, redirectUrl }`.
//! * Status: `GET /checkout/v2/order/{merchantOrderId}/status` → `state`
//!   (`PENDING`/`COMPLETED`/`FAILED`), `amount`, `paymentDetails[]`
//!   (`paymentMode`, `transactionId`, `amount`, `state`).
//! * Refund: `POST /payments/v2/refund` `{ merchantRefundId (≤63, unique),
//!   originalMerchantOrderId, amount }` → `{ refundId, state }`.
//! * Webhook events `checkout.order.completed`, `checkout.order.failed`,
//!   `pg.refund.completed`, `pg.refund.failed`; `payload.state` is the
//!   truth. Authenticated by `Authorization: SHA256(username:password)`
//!   with the username and password the hospital set on PhonePe's dashboard.
//!
//! INFERRED: the webhook digest is lowercase hex of SHA-256 over
//! `username:password` ([`webhook_auth`]); [`EXPIRE_AFTER_SECS`]. A refund
//! may be partial (the docs: "≤ the original amount"); whether a second
//! refund of one payment is taken is not stated, so `multiple_refunds` is
//! off. No dynamic QR or payment link in PG v2 checkout.

use async_trait::async_trait;
use axum::http::HeaderMap;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use super::http::{client, send};
use super::{
    Capabilities, Checkout, CheckoutAsk, ClientProof, Ctx, KeyField, Keys, Located, Notice,
    OnlineProvider, Opened, PaymentRecord, PaymentState, ProviderError, ProviderEvent, RefundAsk,
    Via, header,
};

const WHO: &str = "PhonePe";
const SANDBOX: &str = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const LIVE_PG: &str = "https://api.phonepe.com/apis/pg";
const LIVE_AUTH: &str = "https://api.phonepe.com/apis/identity-manager";
/// Inferred: twenty minutes to pay on PhonePe's page (the range is 5–60).
pub const EXPIRE_AFTER_SECS: i64 = 20 * 60;

#[derive(Debug)]
pub struct PhonePe;

const FIELDS: &[KeyField] = &[
    KeyField {
        name: "client_id",
        label: "Client ID",
        secret: false,
        required: true,
    },
    KeyField {
        name: "client_version",
        label: "Client version",
        secret: false,
        required: true,
    },
    KeyField {
        name: "client_secret",
        label: "Client secret",
        secret: true,
        required: true,
    },
    KeyField {
        name: "webhook_username",
        label: "Webhook username",
        secret: false,
        required: true,
    },
    KeyField {
        name: "webhook_password",
        label: "Webhook password",
        secret: true,
        required: true,
    },
];

/// What PhonePe sends in a webhook's `Authorization` header.
pub fn webhook_auth(username: &str, password: &str) -> String {
    hex::encode(Sha256::digest(format!("{username}:{password}").as_bytes()))
}

async fn token(ctx: &Ctx<'_>) -> Result<String, ProviderError> {
    let auth = if ctx.base == LIVE_PG {
        LIVE_AUTH
    } else {
        ctx.base.as_str()
    };
    let form = [
        ("client_id", ctx.keys.need("client_id")?),
        ("client_version", ctx.keys.need("client_version")?),
        ("client_secret", ctx.keys.need("client_secret")?),
        ("grant_type", "client_credentials"),
    ];
    // ponytail: a token per call; cache it until `expires_at` if call volume matters.
    let v = send(
        client().post(format!("{auth}/v1/oauth/token")).form(&form),
        WHO,
    )
    .await?;
    v["access_token"]
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| ProviderError::Refused("PhonePe gave no access token".to_owned()))
}

async fn call(ctx: &Ctx<'_>, path: &str, body: Option<&Value>) -> Result<Value, ProviderError> {
    let bearer = format!("O-Bearer {}", token(ctx).await?);
    let url = format!("{}{path}", ctx.base);
    let request = match body {
        Some(b) => client().post(url).json(b),
        None => client().get(url),
    };
    send(request.header("Authorization", bearer), WHO).await
}

#[async_trait]
impl OnlineProvider for PhonePe {
    fn code(&self) -> &'static str {
        "phonepe"
    }
    fn label(&self) -> &'static str {
        "PhonePe"
    }
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            checkout: true,
            partial_refund: true,
            // Not stated in the docs: off until verified against the sandbox.
            multiple_refunds: false,
            ..Capabilities::default()
        }
    }
    fn key_fields(&self) -> &'static [KeyField] {
        FIELDS
    }
    fn api_base(&self, live: bool) -> &'static str {
        if live { LIVE_PG } else { SANDBOX }
    }

    async fn create_checkout(
        &self,
        ctx: &Ctx<'_>,
        ask: &CheckoutAsk<'_>,
    ) -> Result<Opened, ProviderError> {
        let redirect = ask.return_url.ok_or_else(|| {
            ProviderError::Refused("PhonePe needs the page to send the patient back to".to_owned())
        })?;
        let order_id = ask.txn_id.to_string();
        let body = json!({
            "merchantOrderId": order_id, "amount": ask.amount_paise, "expireAfter": EXPIRE_AFTER_SECS,
            "metaInfo": { "udf1": ask.tenant_id.to_string() },
            "paymentFlow": { "type": "PG_CHECKOUT", "message": ask.description,
                             "merchantUrls": { "redirectUrl": redirect } },
        });
        let v = call(ctx, "/checkout/v2/pay", Some(&body)).await?;
        let url = v["redirectUrl"].as_str().ok_or_else(|| {
            ProviderError::Refused("PhonePe's answer had no payment page".to_owned())
        })?;
        Ok(Opened {
            order_ref: order_id,
            checkout: Checkout::Redirect {
                url: url.to_owned(),
            },
        })
    }

    async fn fetch_payment(
        &self,
        ctx: &Ctx<'_>,
        proof: &ClientProof<'_>,
    ) -> Result<PaymentRecord, ProviderError> {
        let path = format!(
            "/checkout/v2/order/{}/status?details=false",
            urlencoding::encode(proof.order_ref)
        );
        let v = call(ctx, &path, None).await?;
        let attempt = &v["paymentDetails"][0];
        let state = match v["state"].as_str() {
            Some("COMPLETED") => PaymentState::Paid,
            Some("FAILED") => PaymentState::Failed(
                attempt["errorCode"]
                    .as_str()
                    .unwrap_or("The payment failed")
                    .to_owned(),
            ),
            _ => PaymentState::Pending,
        };
        Ok(PaymentRecord {
            state,
            payment_id: attempt["transactionId"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
            amount_paise: v["amount"].as_i64(),
            method: attempt["paymentMode"].as_str().map(ToOwned::to_owned),
        })
    }

    async fn refund(&self, ctx: &Ctx<'_>, ask: &RefundAsk<'_>) -> Result<String, ProviderError> {
        let body = json!({ "merchantRefundId": ask.idempotency_key,
                           "originalMerchantOrderId": ask.order_ref, "amount": ask.amount_paise });
        let v = call(ctx, "/payments/v2/refund", Some(&body)).await?;
        v["refundId"]
            .as_str()
            .map(ToOwned::to_owned)
            .ok_or_else(|| ProviderError::Refused("PhonePe's answer named no refund".to_owned()))
    }

    fn locate(&self, _headers: &HeaderMap, body: &str) -> Located {
        let Ok(v) = serde_json::from_str::<Value>(body) else {
            return Located::Unreadable;
        };
        let p = &v["payload"];
        p["merchantOrderId"]
            .as_str()
            .or_else(|| p["originalMerchantOrderId"].as_str())
            .map_or(Located::Unreadable, |s| Located::Order(s.to_owned()))
    }

    fn parse_webhook(
        &self,
        keys: &Keys,
        headers: &HeaderMap,
        body: &str,
    ) -> Result<Notice, ProviderError> {
        let expected = webhook_auth(
            keys.need("webhook_username")?,
            keys.need("webhook_password")?,
        );
        let given = header(headers, "authorization").ok_or(ProviderError::BadSignature)?;
        if !given.trim().eq_ignore_ascii_case(&expected) {
            return Err(ProviderError::BadSignature);
        }
        let v: Value = serde_json::from_str(body)
            .map_err(|e| ProviderError::Refused(format!("invalid webhook payload: {e}")))?;
        Ok(notice_of(&v))
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), ProviderError> {
        token(ctx).await.map(|_| ())
    }
}

fn notice_of(v: &Value) -> Notice {
    let p = &v["payload"];
    let event = v["event"].as_str().unwrap_or_default();
    let attempt = &p["paymentDetails"][0];
    let state = p["state"].as_str().unwrap_or_default();
    let refund_id = p["refundId"].as_str().unwrap_or_default().to_owned();
    let made = match (event, state) {
        ("checkout.order.completed", "COMPLETED") => ProviderEvent::Captured {
            via: Via::Checkout,
            payment_id: attempt["transactionId"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
            amount_paise: p["amount"].as_i64(),
            method: attempt["paymentMode"].as_str().map(ToOwned::to_owned),
            lookup: None,
        },
        ("checkout.order.failed", _) => ProviderEvent::Failed {
            code: attempt["errorCode"].as_str().map(ToOwned::to_owned),
            reason: attempt["detailedErrorCode"].as_str().map(ToOwned::to_owned),
        },
        ("pg.refund.completed", "COMPLETED") => ProviderEvent::Refunded {
            refund_id: refund_id.clone(),
            amount_paise: p["amount"].as_i64().unwrap_or_default(),
            reason: None,
        },
        ("pg.refund.failed", _) => ProviderEvent::RefundFailed {
            refund_id: refund_id.clone(),
            amount_paise: p["amount"].as_i64().unwrap_or_default(),
        },
        _ => ProviderEvent::Ignored(format!("{event} {state}")),
    };
    // Our order id: unique per payment row, where PhonePe's may repeat in tests.
    let subject = p["merchantOrderId"]
        .as_str()
        .filter(|_| refund_id.is_empty())
        .unwrap_or(&refund_id);
    Notice {
        event_id: format!("{event}:{subject}:{state}"),
        event: made,
    }
}

#[cfg(test)]
#[path = "phonepe_tests.rs"]
mod tests;

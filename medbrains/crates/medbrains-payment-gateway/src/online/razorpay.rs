//! Razorpay behind [`OnlineProvider`] — the behaviour checkout, the counter
//! QR, payment links and refunds had when they called it directly.
//!
//! VERIFIED against Razorpay's API reference: `POST /v1/orders`,
//! `GET /v1/payments/{id}`, `POST /v1/payments/{id}/refund` (`receipt` is
//! unique, so a repeat is rejected), `POST /v1/payments/qr_codes`
//! (`upi_qr`, single use, fixed amount; an on-demand feature),
//! `POST /v1/payment_links` (`reference_id` unique), RazorpayX
//! `POST /v1/payouts` with `X-Payout-Idempotency`. Checkout signature:
//! HMAC-SHA256 of `order_id|payment_id` under the key secret; webhook:
//! HMAC-SHA256 of the raw body under the webhook secret, hex, in
//! `X-Razorpay-Signature`, deduplicated by `X-Razorpay-Event-Id`.

use async_trait::async_trait;
use axum::http::HeaderMap;
use medbrains_doctor_payouts::provider::{PayoutProvider, PayoutRequest, RazorpayX, Sent};
use serde_json::{Value, json};

use super::http::{client, close, send};
use super::{
    Capabilities, Checkout, CheckoutAsk, ClientProof, Ctx, KeyField, Keys, LinkAsk, LinkMade,
    Located, Notice, OnlineProvider, Opened, PaymentRecord, PaymentState, ProviderError,
    ProviderEvent, QrAsk, QrMade, RefundAsk, Via, header,
};
use crate::razorpay::{Credentials, signature_matches};

const WHO: &str = "Razorpay";

/// Razorpay Payments (and RazorpayX for payouts).
#[derive(Debug)]
pub struct Razorpay;

const FIELDS: &[KeyField] = &[
    KeyField {
        name: "key_id",
        label: "Key ID",
        secret: false,
        required: true,
    },
    KeyField {
        name: "key_secret",
        label: "Key secret",
        secret: true,
        required: true,
    },
    KeyField {
        name: "webhook_secret",
        label: "Webhook secret",
        secret: true,
        required: false,
    },
    KeyField {
        name: "payout_account_number",
        label: "RazorpayX account number (payouts)",
        secret: false,
        required: false,
    },
];

/// Razorpay's keys say their own mode (`rzp_live_…` / `rzp_test_…`).
pub fn with_mode(mut keys: Keys) -> Keys {
    if keys.get("mode").is_none()
        && let Some(id) = keys.get("key_id")
    {
        let mode = if id.starts_with("rzp_live_") {
            "live"
        } else {
            "test"
        };
        keys.set("mode", mode);
    }
    keys
}

/// The resolver's credentials as [`Keys`].
pub fn keys_of(c: Credentials) -> Keys {
    let mut values = serde_json::Map::new();
    values.insert("key_id".to_owned(), Value::String(c.key_id));
    values.insert("key_secret".to_owned(), Value::String(c.key_secret));
    if let Some(w) = c.webhook_secret {
        values.insert("webhook_secret".to_owned(), Value::String(w));
    }
    with_mode(Keys::new(values, c.source))
}

async fn call(ctx: &Ctx<'_>, path: &str, body: Option<&Value>) -> Result<Value, ProviderError> {
    let url = format!("{}{path}", ctx.base);
    let request = match body {
        Some(b) => client().post(&url).json(b),
        None => client().get(&url),
    };
    let id = ctx.keys.need("key_id")?;
    let secret = ctx.keys.need("key_secret")?;
    send(request.basic_auth(id, Some(secret)), WHO).await
}

fn id_in(answer: &Value, what: &str) -> Result<String, ProviderError> {
    answer["id"]
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| ProviderError::Refused(format!("Razorpay's answer named no {what}")))
}

#[async_trait]
impl OnlineProvider for Razorpay {
    fn code(&self) -> &'static str {
        "razorpay"
    }
    fn label(&self) -> &'static str {
        "Razorpay"
    }
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            checkout: true,
            dynamic_qr: true,
            payment_links: true,
            partial_refund: true,
            multiple_refunds: true,
            payouts: true,
            upi_collect: false,
            emi: true,
        }
    }
    fn key_fields(&self) -> &'static [KeyField] {
        FIELDS
    }
    fn api_base(&self, _live: bool) -> &'static str {
        "https://api.razorpay.com/v1"
    }

    async fn create_checkout(
        &self,
        ctx: &Ctx<'_>,
        ask: &CheckoutAsk<'_>,
    ) -> Result<Opened, ProviderError> {
        let body = json!({
            "amount": ask.amount_paise, "currency": "INR", "receipt": ask.txn_id.to_string(),
            "notes": { "tenant_id": ask.tenant_id, "internal_payment_id": ask.txn_id },
        });
        let order_id = id_in(&call(ctx, "/orders", Some(&body)).await?, "order")?;
        Ok(Opened {
            order_ref: order_id.clone(),
            checkout: Checkout::RazorpayJs {
                key_id: ctx.keys.need("key_id")?.to_owned(),
                order_id,
            },
        })
    }

    fn verify_payment(&self, keys: &Keys, proof: &ClientProof<'_>) -> Result<(), ProviderError> {
        let (Some(payment), Some(signature)) = (proof.payment_id, proof.signature) else {
            return Err(ProviderError::BadSignature);
        };
        let message = format!("{}|{payment}", proof.order_ref);
        if signature_matches(keys.need("key_secret")?, message.as_bytes(), signature) {
            Ok(())
        } else {
            Err(ProviderError::BadSignature)
        }
    }

    async fn fetch_payment(
        &self,
        ctx: &Ctx<'_>,
        proof: &ClientProof<'_>,
    ) -> Result<PaymentRecord, ProviderError> {
        let id = proof
            .payment_id
            .ok_or_else(|| ProviderError::Refused("Name the payment to look up".to_owned()))?;
        let path = format!("/payments/{}", urlencoding::encode(id));
        let p = call(ctx, &path, None).await.map_err(|e| match e {
            ProviderError::Refused(w) => {
                ProviderError::Refused(format!("Razorpay does not know this payment: {w}"))
            }
            other => other,
        })?;
        if p["order_id"].as_str() != Some(proof.order_ref) {
            return Err(ProviderError::Refused(
                "That payment is not for this order".to_owned(),
            ));
        }
        let state = match p["status"].as_str() {
            Some("captured") => PaymentState::Paid,
            Some("failed") => PaymentState::Failed(
                p["error_description"]
                    .as_str()
                    .unwrap_or("failed")
                    .to_owned(),
            ),
            _ => PaymentState::Pending,
        };
        Ok(PaymentRecord {
            state,
            payment_id: id.to_owned(),
            amount_paise: p["amount"].as_i64(),
            method: p["method"].as_str().map(ToOwned::to_owned),
        })
    }

    async fn create_dynamic_qr(
        &self,
        ctx: &Ctx<'_>,
        ask: &QrAsk<'_>,
    ) -> Result<QrMade, ProviderError> {
        let body = json!({
            "type": "upi_qr", "name": "MedBrains counter", "usage": "single_use",
            "fixed_amount": true, "payment_amount": ask.amount_paise,
            "description": ask.description, "close_by": ask.close_by,
            "notes": { "tenant_id": ask.tenant_id, "internal_payment_id": ask.txn_id },
        });
        let v = call(ctx, "/payments/qr_codes", Some(&body))
            .await
            .map_err(|e| match e {
                ProviderError::Refused(w) => {
                    ProviderError::Refused(format!("Razorpay would not make a UPI QR: {w}"))
                }
                other => other,
            })?;
        match (v["id"].as_str(), v["image_url"].as_str()) {
            (Some(id), Some(url)) => Ok(QrMade {
                order_ref: id.to_owned(),
                image_url: url.to_owned(),
                close_by: v["close_by"].as_i64().unwrap_or(ask.close_by),
            }),
            _ => Err(ProviderError::Refused(
                "Razorpay's answer named no QR".to_owned(),
            )),
        }
    }

    async fn create_payment_link(
        &self,
        ctx: &Ctx<'_>,
        ask: &LinkAsk<'_>,
    ) -> Result<LinkMade, ProviderError> {
        let mut body = json!({
            "amount": ask.amount_paise, "currency": "INR", "accept_partial": ask.accept_partial,
            "reference_id": ask.txn_id.to_string(), "description": ask.description,
            // The payer sees the link in their app; Razorpay sends nothing of its own.
            "notify": { "sms": false, "email": false }, "reminder_enable": ask.remind,
            "notes": { "tenant_id": ask.tenant_id.to_string(),
                       "internal_payment_id": ask.txn_id.to_string() },
        });
        if let Some(at) = ask.expire_by {
            body["expire_by"] = json!(at);
        }
        if let Some(contact) = ask.contact {
            body["customer"] = json!({ "contact": contact });
        }
        if let Some(min) = ask.min_part_paise.filter(|_| ask.accept_partial) {
            body["first_min_partial_amount"] = json!(min);
        }
        let v = call(ctx, "/payment_links", Some(&body)).await?;
        match (v["id"].as_str(), v["short_url"].as_str()) {
            (Some(id), Some(url)) => Ok(LinkMade {
                order_ref: id.to_owned(),
                url: url.to_owned(),
            }),
            _ => Err(ProviderError::Refused(
                "Razorpay's answer named no link".to_owned(),
            )),
        }
    }

    /// `POST /v1/payment_links/{id}/cancel`.
    async fn cancel_payment_link(
        &self,
        ctx: &Ctx<'_>,
        order_ref: &str,
    ) -> Result<(), ProviderError> {
        let url = format!(
            "{}/payment_links/{}/cancel",
            ctx.base,
            urlencoding::encode(order_ref)
        );
        let request = client()
            .post(url)
            .basic_auth(ctx.keys.need("key_id")?, Some(ctx.keys.need("key_secret")?));
        close(request, WHO).await
    }

    async fn refund(&self, ctx: &Ctx<'_>, ask: &RefundAsk<'_>) -> Result<String, ProviderError> {
        let body = json!({
            "amount": ask.amount_paise, "receipt": ask.idempotency_key,
            "notes": { "reason": ask.reason, "internal_payment_id": ask.txn_id },
        });
        let path = format!("/payments/{}/refund", urlencoding::encode(ask.payment_id));
        id_in(&call(ctx, &path, Some(&body)).await?, "refund")
    }

    async fn payout(&self, ctx: &Ctx<'_>, req: &PayoutRequest) -> Sent {
        let x = match (
            ctx.keys.need("key_id"),
            ctx.keys.need("key_secret"),
            ctx.keys.need("payout_account_number"),
        ) {
            (Ok(id), Ok(secret), Ok(account)) => RazorpayX {
                base: ctx.base.clone(),
                key_id: id.to_owned(),
                key_secret: secret.to_owned(),
                account_number: account.to_owned(),
            },
            _ => return Sent::Refused("RazorpayX payouts are not set up".to_owned()),
        };
        x.send(req).await
    }

    fn locate(&self, _headers: &HeaderMap, body: &str) -> Located {
        let Ok(v) = serde_json::from_str::<Value>(body) else {
            return Located::Unreadable;
        };
        let p = &v["payload"];
        if v["event"]
            .as_str()
            .is_some_and(|e| e.starts_with("payout."))
        {
            return Located::NotOurs;
        }
        // A link and a counter QR are filed under their own ids; their
        // payments carry an order Razorpay made, which nothing here knows.
        [
            &p["payment_link"]["entity"]["id"],
            &p["qr_code"]["entity"]["id"],
            &p["order"]["entity"]["id"],
            &p["payment"]["entity"]["order_id"],
            &p["refund"]["entity"]["order_id"],
        ]
        .into_iter()
        .find_map(Value::as_str)
        .map_or(Located::Unreadable, |s| Located::Order(s.to_owned()))
    }

    fn parse_webhook(
        &self,
        keys: &Keys,
        headers: &HeaderMap,
        body: &str,
    ) -> Result<Notice, ProviderError> {
        let signature =
            header(headers, "x-razorpay-signature").ok_or(ProviderError::BadSignature)?;
        let secret = keys
            .get("webhook_secret")
            .map_or_else(|| keys.need("key_secret"), Ok)?;
        if !signature_matches(secret, body.as_bytes(), signature) {
            return Err(ProviderError::BadSignature);
        }
        let event_id = header(headers, "x-razorpay-event-id")
            .ok_or_else(|| ProviderError::Refused("missing X-Razorpay-Event-Id header".to_owned()))?
            .to_owned();
        let v: Value = serde_json::from_str(body)
            .map_err(|e| ProviderError::Refused(format!("invalid webhook payload: {e}")))?;
        Ok(Notice {
            event_id,
            event: event_of(&v),
        })
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), ProviderError> {
        call(ctx, "/payments?count=1", None).await.map(|_| ())
    }
}

fn captured(via: Via, payment: &Value) -> ProviderEvent {
    ProviderEvent::Captured {
        via,
        payment_id: payment["id"].as_str().unwrap_or_default().to_owned(),
        amount_paise: payment["amount"].as_i64(),
        method: payment["method"].as_str().map(ToOwned::to_owned),
        lookup: None,
    }
}

fn event_of(v: &Value) -> ProviderEvent {
    let p = &v["payload"];
    let payment = &p["payment"]["entity"];
    let refund = &p["refund"]["entity"];
    let event = v["event"].as_str().unwrap_or_default();
    match event {
        "payment.captured" | "order.paid" => captured(Via::Checkout, payment),
        "payment_link.paid" | "payment_link.partially_paid" => captured(Via::Link, payment),
        "payment_link.expired" => ProviderEvent::LinkClosed { expired: true },
        "payment_link.cancelled" => ProviderEvent::LinkClosed { expired: false },
        "qr_code.credited" => captured(Via::Qr, payment),
        "payment.failed" => ProviderEvent::Failed {
            code: payment["error_code"].as_str().map(ToOwned::to_owned),
            reason: payment["error_description"].as_str().map(ToOwned::to_owned),
        },
        "refund.created" | "refund.processed" => {
            match (refund["id"].as_str(), refund["amount"].as_i64()) {
                (Some(id), Some(paise)) => ProviderEvent::Refunded {
                    refund_id: id.to_owned(),
                    amount_paise: paise,
                    reason: refund["notes"]["reason"].as_str().map(ToOwned::to_owned),
                },
                _ => ProviderEvent::Ignored("refund without an id or amount".to_owned()),
            }
        }
        "refund.failed" => ProviderEvent::RefundFailed {
            refund_id: refund["id"].as_str().unwrap_or_default().to_owned(),
            amount_paise: refund["amount"].as_i64().unwrap_or_default(),
        },
        "payment.dispute.created" => ProviderEvent::Dispute {
            payment_id: payment["id"].as_str().unwrap_or_default().to_owned(),
            amount_paise: p["dispute"]["entity"]["amount"].as_i64(),
            reason: p["dispute"]["entity"]["reason_description"]
                .as_str()
                .unwrap_or("Disputed with the payer's bank")
                .to_owned(),
        },
        "payout.processed" => ProviderEvent::PayoutDone {
            reference: p["payout"]["entity"]["reference_id"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
            utr: p["payout"]["entity"]["utr"].as_str().map(ToOwned::to_owned),
        },
        "payout.failed" | "payout.reversed" | "payout.rejected" => ProviderEvent::PayoutFailed {
            reference: p["payout"]["entity"]["reference_id"]
                .as_str()
                .unwrap_or_default()
                .to_owned(),
            reason: event.to_owned(),
        },
        other => ProviderEvent::Ignored(other.to_owned()),
    }
}

#[cfg(test)]
#[path = "razorpay_tests.rs"]
mod tests;

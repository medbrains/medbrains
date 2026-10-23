//! Cashfree Payments behind [`OnlineProvider`].
//!
//! VERIFIED (cashfree.com/docs, API version 2023-08-01):
//! * Auth headers `x-client-id`, `x-client-secret`, `x-api-version`; bases
//!   `https://sandbox.cashfree.com/pg` and `https://api.cashfree.com/pg`.
//! * `POST /orders` (`order_id` ours, ≤ 45; `order_amount` in rupees;
//!   `customer_details.customer_id` + `customer_phone` required) answers
//!   `payment_session_id`, which the JS SDK v3 opens.
//! * `GET /orders/{order_id}/payments`: `cf_payment_id`, `payment_status`
//!   (`SUCCESS`, `FAILED`, `PENDING`, `USER_DROPPED`…), `payment_amount`,
//!   `payment_group` (`upi`, `credit_card`, `net_banking`…).
//! * `POST /orders/{order_id}/refunds` with `refund_id` (ours, unique per
//!   order, so a repeat is rejected), `refund_amount` in rupees; several
//!   partial refunds up to the payment.
//! * `POST /links` (`link_id` ours, `link_amount`, `link_purpose`,
//!   `customer_details.customer_phone` required, `link_expiry_time` ISO 8601)
//!   answers `link_url`; `PAYMENT_LINK_EVENT` carries `data.link_id`,
//!   `link_status` (`PAID`…), `link_amount_paid`, `order.transaction_id`.
//! * Webhooks: `x-webhook-signature` = base64 HMAC-SHA256 of
//!   `x-webhook-timestamp` + raw body under the client secret. (The docs'
//!   pseudocode puts a `.` between them; every code sample and SDK does not —
//!   the samples are followed.)
//!
//! INFERRED (named so they can be checked against the sandbox):
//! * [`QR_SESSION`]: the UPI QR comes from `POST /orders/sessions` with
//!   `payment_method.upi.channel = "qrcode"`, its image at
//!   `data.payload.qrcode` (the docs name the channel but show no answer).
//! * [`LINK_ORDER_PREFIX`]: a link's payments also raise
//!   `PAYMENT_SUCCESS_WEBHOOK` on an order Cashfree names `CFPay_…`; those
//!   are taken through the link's own event, never twice.
//! * `PAYMENT_LINK_EVENT` is delivered as JSON, like the payment webhooks.
//! * Refund webhooks: `REFUND_STATUS_WEBHOOK` with `data.refund`.
//! * Disputes: `DISPUTE_CREATED` with `data.dispute`.

use async_trait::async_trait;
use axum::http::HeaderMap;
use base64::Engine as _;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::{Value, json};
use sha2::Sha256;

use super::http::{client, close, send};
use super::{
    Capabilities, Checkout, CheckoutAsk, ClientProof, Ctx, KeyField, Keys, LinkAsk, LinkMade,
    Located, Notice, OnlineProvider, Opened, PaymentRecord, PaymentState, ProviderError,
    ProviderEvent, QrAsk, QrMade, RefundAsk, Via, header, paise_of, rupees_text, text,
};

const WHO: &str = "Cashfree";
pub const API_VERSION: &str = "2023-08-01";
/// Inferred: the UPI channel that answers with a QR image.
pub const QR_SESSION: &str = "qrcode";
/// Inferred: Cashfree's own order ids for a payment link's payments.
pub const LINK_ORDER_PREFIX: &str = "CFPay_";
/// Cashfree requires a payer phone on orders and links; when the counter has
/// none this is sent (inferred acceptable: Cashfree's own samples use it).
const NO_PHONE: &str = "9999999999";

#[derive(Debug)]
pub struct Cashfree;

const FIELDS: &[KeyField] = &[
    KeyField {
        name: "client_id",
        label: "App ID (client ID)",
        secret: false,
        required: true,
    },
    KeyField {
        name: "client_secret",
        label: "Secret key",
        secret: true,
        required: true,
    },
];

fn request(
    ctx: &Ctx<'_>,
    method: reqwest::Method,
    path: &str,
) -> Result<reqwest::RequestBuilder, ProviderError> {
    Ok(client()
        .request(method, format!("{}{path}", ctx.base))
        .header("x-client-id", ctx.keys.need("client_id")?)
        .header("x-client-secret", ctx.keys.need("client_secret")?)
        .header("x-api-version", API_VERSION))
}

async fn post(ctx: &Ctx<'_>, path: &str, body: &Value) -> Result<Value, ProviderError> {
    send(request(ctx, reqwest::Method::POST, path)?.json(body), WHO).await
}

/// Make an order for a payment row; its session id.
async fn order(
    ctx: &Ctx<'_>,
    order_id: &str,
    paise: i64,
    phone: Option<&str>,
    note: &str,
) -> Result<String, ProviderError> {
    let body = json!({
        "order_id": order_id, "order_amount": rupees_text(paise), "order_currency": "INR",
        "customer_details": { "customer_id": order_id, "customer_phone": phone.unwrap_or(NO_PHONE) },
        "order_note": note,
    });
    post(ctx, "/orders", &body).await?["payment_session_id"]
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            ProviderError::Refused("Cashfree's answer named no payment session".to_owned())
        })
}

/// A webhook's signature: base64 HMAC-SHA256 of timestamp + raw body.
pub fn signature_ok(secret: &str, timestamp: &str, body: &str, signature: &str) -> bool {
    let Ok(given) = base64::engine::general_purpose::STANDARD.decode(signature.trim()) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(timestamp.as_bytes());
    mac.update(body.as_bytes());
    mac.verify_slice(&given).is_ok()
}

#[async_trait]
impl OnlineProvider for Cashfree {
    fn code(&self) -> &'static str {
        "cashfree"
    }
    fn label(&self) -> &'static str {
        "Cashfree"
    }
    fn capabilities(&self) -> Capabilities {
        Capabilities {
            checkout: true,
            dynamic_qr: true,
            payment_links: true,
            partial_refund: true,
            multiple_refunds: true,
            // Cashfree Payouts is a separate product, not built here.
            payouts: false,
            upi_collect: false,
            emi: true,
        }
    }
    fn key_fields(&self) -> &'static [KeyField] {
        FIELDS
    }
    fn api_base(&self, live: bool) -> &'static str {
        if live {
            "https://api.cashfree.com/pg"
        } else {
            "https://sandbox.cashfree.com/pg"
        }
    }

    async fn create_checkout(
        &self,
        ctx: &Ctx<'_>,
        ask: &CheckoutAsk<'_>,
    ) -> Result<Opened, ProviderError> {
        let order_id = ask.txn_id.to_string();
        let note = format!("tenant:{}", ask.tenant_id);
        let session_id = order(ctx, &order_id, ask.amount_paise, ask.phone, &note).await?;
        let mode = if ctx.keys.live() {
            "production"
        } else {
            "sandbox"
        };
        Ok(Opened {
            order_ref: order_id,
            checkout: Checkout::CashfreeJs {
                session_id,
                mode: mode.to_owned(),
            },
        })
    }

    async fn fetch_payment(
        &self,
        ctx: &Ctx<'_>,
        proof: &ClientProof<'_>,
    ) -> Result<PaymentRecord, ProviderError> {
        let path = format!("/orders/{}/payments", urlencoding::encode(proof.order_ref));
        let list = send(request(ctx, reqwest::Method::GET, &path)?, WHO).await?;
        let payments = list.as_array().cloned().unwrap_or_default();
        let paid = payments.iter().find(|p| p["payment_status"] == "SUCCESS");
        let Some(p) = paid.or_else(|| payments.first()) else {
            return Ok(PaymentRecord {
                state: PaymentState::Pending,
                payment_id: String::new(),
                amount_paise: None,
                method: None,
            });
        };
        let state = match p["payment_status"].as_str() {
            Some("SUCCESS") => PaymentState::Paid,
            Some("FAILED" | "CANCELLED" | "VOID") => PaymentState::Failed(
                p["payment_message"]
                    .as_str()
                    .unwrap_or("The payment failed")
                    .to_owned(),
            ),
            _ => PaymentState::Pending,
        };
        Ok(PaymentRecord {
            state,
            payment_id: text(&p["cf_payment_id"]).unwrap_or_default(),
            amount_paise: paise_of(&p["payment_amount"]),
            method: p["payment_group"].as_str().map(ToOwned::to_owned),
        })
    }

    async fn create_dynamic_qr(
        &self,
        ctx: &Ctx<'_>,
        ask: &QrAsk<'_>,
    ) -> Result<QrMade, ProviderError> {
        let order_id = ask.txn_id.to_string();
        let session = order(ctx, &order_id, ask.amount_paise, None, ask.description).await?;
        let body = json!({ "payment_session_id": session,
                           "payment_method": { "upi": { "channel": QR_SESSION } } });
        let answer = post(ctx, "/orders/sessions", &body).await?;
        let image = answer["data"]["payload"]["qrcode"]
            .as_str()
            .ok_or_else(|| ProviderError::Refused("Cashfree's answer carried no QR".to_owned()))?;
        let image_url = if image.starts_with("data:") {
            image.to_owned()
        } else {
            format!("data:image/png;base64,{image}")
        };
        Ok(QrMade {
            order_ref: order_id,
            image_url,
            close_by: ask.close_by,
        })
    }

    async fn create_payment_link(
        &self,
        ctx: &Ctx<'_>,
        ask: &LinkAsk<'_>,
    ) -> Result<LinkMade, ProviderError> {
        let link_id = ask.txn_id.simple().to_string();
        let mut body = json!({
            "link_id": link_id, "link_amount": rupees_text(ask.amount_paise), "link_currency": "INR",
            "link_purpose": ask.description,
            "customer_details": { "customer_phone": ask.contact.unwrap_or(NO_PHONE) },
            "link_notify": { "send_sms": false, "send_email": false },
            "link_partial_payments": ask.accept_partial,
            "link_auto_reminders": ask.remind,
            "link_notes": { "internal_payment_id": ask.txn_id.to_string() },
        });
        if let Some(min) = ask.min_part_paise.filter(|_| ask.accept_partial) {
            body["link_minimum_partial_amount"] = json!(rupees_text(min));
        }
        if let Some(at) = ask
            .expire_by
            .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
        {
            body["link_expiry_time"] = json!(at.to_rfc3339());
        }
        let v = post(ctx, "/links", &body).await?;
        let url = v["link_url"]
            .as_str()
            .ok_or_else(|| ProviderError::Refused("Cashfree's answer named no link".to_owned()))?;
        Ok(LinkMade {
            order_ref: link_id,
            url: url.to_owned(),
        })
    }

    /// `POST /links/{link_id}/cancel`.
    async fn cancel_payment_link(
        &self,
        ctx: &Ctx<'_>,
        order_ref: &str,
    ) -> Result<(), ProviderError> {
        let path = format!("/links/{}/cancel", urlencoding::encode(order_ref));
        close(request(ctx, reqwest::Method::POST, &path)?, WHO).await
    }

    async fn refund(&self, ctx: &Ctx<'_>, ask: &RefundAsk<'_>) -> Result<String, ProviderError> {
        let body = json!({ "refund_id": ask.idempotency_key, "refund_amount": rupees_text(ask.amount_paise),
                           "refund_note": ask.reason });
        let path = format!("/orders/{}/refunds", urlencoding::encode(ask.order_ref));
        let v = post(ctx, &path, &body).await?;
        Ok(v["refund_id"]
            .as_str()
            .unwrap_or(ask.idempotency_key)
            .to_owned())
    }

    fn locate(&self, _headers: &HeaderMap, body: &str) -> Located {
        let Ok(v) = serde_json::from_str::<Value>(body) else {
            return Located::Unreadable;
        };
        let d = &v["data"];
        if v["type"] == "PAYMENT_LINK_EVENT" {
            return d["link_id"]
                .as_str()
                .map_or(Located::Unreadable, |s| Located::Order(s.to_owned()));
        }
        match d["order"]["order_id"]
            .as_str()
            .or_else(|| d["refund"]["order_id"].as_str())
            .or_else(|| d["order_id"].as_str())
        {
            Some(id) if id.starts_with(LINK_ORDER_PREFIX) => Located::NotOurs,
            Some(id) => Located::Order(id.to_owned()),
            None => Located::Unreadable,
        }
    }

    fn parse_webhook(
        &self,
        keys: &Keys,
        headers: &HeaderMap,
        body: &str,
    ) -> Result<Notice, ProviderError> {
        let (Some(signature), Some(timestamp)) = (
            header(headers, "x-webhook-signature"),
            header(headers, "x-webhook-timestamp"),
        ) else {
            return Err(ProviderError::BadSignature);
        };
        if !signature_ok(keys.need("client_secret")?, timestamp, body, signature) {
            return Err(ProviderError::BadSignature);
        }
        let v: Value = serde_json::from_str(body)
            .map_err(|e| ProviderError::Refused(format!("invalid webhook payload: {e}")))?;
        Ok(notice_of(&v))
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), ProviderError> {
        // An order that cannot exist: 404 means the keys were accepted.
        match send(
            request(ctx, reqwest::Method::GET, "/orders/medbrains-ping")?,
            WHO,
        )
        .await
        {
            Ok(_) => Ok(()),
            Err(ProviderError::Refused(w))
                if w.to_ascii_lowercase().contains("not found") || w.contains("404") =>
            {
                Ok(())
            }
            Err(e) => Err(e),
        }
    }
}

fn notice_of(v: &Value) -> Notice {
    let d = &v["data"];
    let kind = v["type"].as_str().unwrap_or_default();
    let payment_id = text(&d["payment"]["cf_payment_id"]);
    let (event_id, event) = match kind {
        "PAYMENT_SUCCESS_WEBHOOK" => (
            format!("{kind}:{}", payment_id.clone().unwrap_or_default()),
            ProviderEvent::Captured {
                // A QR and a checkout are both orders; the row knows which it was.
                via: Via::Checkout,
                payment_id: payment_id.unwrap_or_default(),
                amount_paise: paise_of(&d["payment"]["payment_amount"]),
                method: d["payment"]["payment_group"]
                    .as_str()
                    .map(ToOwned::to_owned),
                lookup: None,
            },
        ),
        "PAYMENT_FAILED_WEBHOOK" | "PAYMENT_USER_DROPPED_WEBHOOK" => (
            format!("{kind}:{}", payment_id.unwrap_or_default()),
            ProviderEvent::Failed {
                code: text(&d["error_details"]["error_code"]),
                reason: d["payment"]["payment_message"]
                    .as_str()
                    .map(ToOwned::to_owned),
            },
        ),
        "PAYMENT_LINK_EVENT" => {
            let status = d["link_status"].as_str().unwrap_or_default();
            let txn = text(&d["order"]["transaction_id"]).unwrap_or_default();
            let event = match status {
                // Inferred: a part pays the link's `order` (`order_amount`);
                // `link_amount_paid` is the running total, the whole of a link
                // paid in one go.
                "PAID" | "PARTIALLY_PAID" => ProviderEvent::Captured {
                    via: Via::Link,
                    payment_id: txn.clone(),
                    amount_paise: paise_of(&d["order"]["order_amount"])
                        .or_else(|| paise_of(&d["link_amount_paid"])),
                    // The link event does not say how it was paid: its order does.
                    method: None,
                    lookup: d["order"]["order_id"].as_str().map(ToOwned::to_owned),
                },
                "EXPIRED" => ProviderEvent::LinkClosed { expired: true },
                "CANCELLED" => ProviderEvent::LinkClosed { expired: false },
                other => ProviderEvent::Ignored(format!("link {other}")),
            };
            // Each part is its own event: the payment names it.
            (
                format!(
                    "{kind}:{}:{status}:{txn}",
                    d["link_id"].as_str().unwrap_or_default()
                ),
                event,
            )
        }
        "REFUND_STATUS_WEBHOOK" => {
            let r = &d["refund"];
            let id = text(&r["refund_id"]).unwrap_or_default();
            let paise = paise_of(&r["refund_amount"]).unwrap_or_default();
            let status = r["refund_status"].as_str().unwrap_or_default();
            let event = match status {
                "SUCCESS" => ProviderEvent::Refunded {
                    refund_id: id.clone(),
                    amount_paise: paise,
                    reason: r["refund_note"].as_str().map(ToOwned::to_owned),
                },
                "CANCELLED" | "FAILED" => ProviderEvent::RefundFailed {
                    refund_id: id.clone(),
                    amount_paise: paise,
                },
                other => ProviderEvent::Ignored(format!("refund {other}")),
            };
            (format!("{kind}:{id}:{status}"), event)
        }
        "DISPUTE_CREATED" => {
            let x = &d["dispute"];
            (
                format!("{kind}:{}", text(&x["dispute_id"]).unwrap_or_default()),
                ProviderEvent::Dispute {
                    payment_id: payment_id.unwrap_or_default(),
                    amount_paise: paise_of(&x["dispute_amount"]),
                    reason: x["reason_description"]
                        .as_str()
                        .unwrap_or("Disputed with the payer's bank")
                        .to_owned(),
                },
            )
        }
        other => (
            format!("{other}:{}", v["event_time"].as_str().unwrap_or_default()),
            ProviderEvent::Ignored(other.to_owned()),
        ),
    };
    Notice { event_id, event }
}

#[cfg(test)]
#[path = "cashfree_tests.rs"]
mod tests;

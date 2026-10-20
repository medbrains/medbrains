#![allow(dead_code, unreachable_pub)]

//! Each provider's own webhook bodies, in its documented shape.

use serde_json::{Value, json};

fn rupees(paise: i64) -> String {
    format!("{}.{:02}", paise / 100, paise % 100)
}

/// How each provider names a card payment (all post as `card`).
pub fn card_word(provider: &str) -> &'static str {
    match provider {
        "cashfree" => "credit_card",
        "phonepe" => "CARD",
        "payu" => "CC",
        _ => "card",
    }
}

/// A checkout payment captured.
pub fn captured(provider: &str, order: &str, payment: &str, paise: i64, method: &str) -> Value {
    match provider {
        "razorpay" => json!({ "event": "payment.captured", "payload": { "payment": { "entity": {
            "id": payment, "order_id": order, "amount": paise, "method": method, "status": "captured" } } } }),
        "cashfree" => {
            json!({ "type": "PAYMENT_SUCCESS_WEBHOOK", "data": { "order": { "order_id": order },
            "payment": { "cf_payment_id": payment, "payment_status": "SUCCESS",
                         "payment_amount": paise as f64 / 100.0, "payment_group": method } } })
        }
        "phonepe" => {
            json!({ "event": "checkout.order.completed", "payload": { "merchantOrderId": order,
            "orderId": "OMO1", "state": "COMPLETED", "amount": paise,
            "paymentDetails": [{ "paymentMode": method, "transactionId": payment, "state": "COMPLETED", "amount": paise }] } })
        }
        _ => {
            json!({ "txnid": order, "status": "success", "mihpayid": payment, "amount": rupees(paise),
            "productinfo": "MedBrains payment", "firstname": "Patient", "email": "patient@medbrains.local", "mode": method })
        }
    }
}

/// A refund made, as the provider reports it; `None` where it has no notice.
pub fn refunded(
    provider: &str,
    order: &str,
    payment: &str,
    refund: &str,
    paise: i64,
) -> Option<Value> {
    match provider {
        "razorpay" => Some(json!({ "event": "refund.processed", "payload": {
            "refund": { "entity": { "id": refund, "amount": paise, "payment_id": payment } },
            "payment": { "entity": { "id": payment, "order_id": order } } } })),
        "cashfree" => Some(
            json!({ "type": "REFUND_STATUS_WEBHOOK", "data": { "refund": {
            "refund_id": refund, "order_id": order, "refund_amount": paise as f64 / 100.0, "refund_status": "SUCCESS" } } }),
        ),
        "phonepe" => Some(
            json!({ "event": "pg.refund.completed", "payload": { "originalMerchantOrderId": order,
            "merchantRefundId": "m", "refundId": refund, "state": "COMPLETED", "amount": paise } }),
        ),
        _ => None,
    }
}

/// A payment link paid in full; Cashfree's names the order it made.
pub fn link_paid(provider: &str, link: &str, payment: &str, paise: i64) -> Value {
    if provider == "cashfree" {
        return json!({ "type": "PAYMENT_LINK_EVENT", "data": { "link_id": link, "link_status": "PAID",
            "link_amount": rupees(paise), "link_amount_paid": rupees(paise),
            "order": { "order_id": cashfree_link_order(link), "transaction_id": payment, "transaction_status": "SUCCESS" } } });
    }
    json!({ "event": "payment_link.paid", "payload": { "payment_link": { "entity": { "id": link, "status": "paid" } },
        "payment": { "entity": { "id": payment, "amount": paise, "method": "upi", "status": "captured" } } } })
}

/// The order Cashfree makes for a link's payment.
pub fn cashfree_link_order(link: &str) -> String {
    format!("CFPay_{link}")
}

/// A counter QR paid by UPI.
pub fn qr_credited(provider: &str, qr: &str, payment: &str, paise: i64) -> Value {
    if provider == "cashfree" {
        return captured(provider, qr, payment, paise, "upi");
    }
    json!({ "event": "qr_code.credited", "payload": {
        "qr_code": { "entity": { "id": qr } },
        "payment": { "entity": { "id": payment, "amount": paise, "method": "upi", "status": "captured" } } } })
}

/// One part of a link paid (#4871): `paid_so_far` paise including this one,
/// `whole` when it completes the link.
pub fn link_part(
    provider: &str,
    link: &str,
    payment: &str,
    paise: i64,
    paid_so_far: i64,
    whole: bool,
) -> Value {
    if provider == "cashfree" {
        let status = if whole { "PAID" } else { "PARTIALLY_PAID" };
        return json!({ "type": "PAYMENT_LINK_EVENT", "data": { "link_id": link, "link_status": status,
            "link_amount_paid": rupees(paid_so_far),
            "order": { "order_id": cashfree_link_order(link), "order_amount": rupees(paise),
                       "transaction_id": payment, "transaction_status": "SUCCESS" } } });
    }
    let event = if whole {
        "payment_link.paid"
    } else {
        "payment_link.partially_paid"
    };
    json!({ "event": event, "payload": {
        "payment_link": { "entity": { "id": link, "amount_paid": paid_so_far } },
        "payment": { "entity": { "id": payment, "amount": paise, "method": "upi", "status": "captured" } } } })
}

/// The provider says the link expired.
pub fn link_expired(provider: &str, link: &str) -> Value {
    if provider == "cashfree" {
        return json!({ "type": "PAYMENT_LINK_EVENT", "data": { "link_id": link, "link_status": "EXPIRED" } });
    }
    json!({ "event": "payment_link.expired", "payload": { "payment_link": { "entity": { "id": link, "status": "expired" } } } })
}

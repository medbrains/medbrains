use super::{PhonePe, webhook_auth};
use crate::online::{Keys, Located, OnlineProvider, ProviderError, ProviderEvent, test_headers};
use serde_json::json;

fn keys() -> Keys {
    let m = json!({ "client_id": "c", "client_version": "1", "client_secret": "s",
                    "webhook_username": "medbrains", "webhook_password": "hook-pass" });
    Keys::new(m.as_object().cloned().unwrap_or_default(), "test")
}

/// The docs' `checkout.order.completed` sample, authorised as PhonePe
/// authorises it.
#[test]
fn the_documented_completed_order_is_a_capture_once_authorised() {
    let body = json!({ "event": "checkout.order.completed", "payload": {
        "merchantOrderId": "merchantOrderId", "orderId": "OMO2403282020198641071317",
        "state": "COMPLETED", "amount": 10000,
        "paymentDetails": [{ "paymentMode": "UPI_QR", "transactionId": "OM12334",
                             "state": "COMPLETED", "amount": 10000 }] } })
    .to_string();
    // SHA-256 of "medbrains:hook-pass".
    assert_eq!(webhook_auth("medbrains", "hook-pass").len(), 64);
    let h = test_headers(&[("authorization", webhook_auth("medbrains", "hook-pass"))]);
    assert_eq!(
        PhonePe.locate(&h, &body),
        Located::Order("merchantOrderId".to_owned())
    );
    let n = PhonePe.parse_webhook(&keys(), &h, &body);
    assert!(
        matches!(n.map(|n| n.event), Ok(ProviderEvent::Captured { amount_paise: Some(10_000), ref payment_id, .. }) if payment_id == "OM12334")
    );
    let wrong = test_headers(&[("authorization", webhook_auth("medbrains", "other"))]);
    assert_eq!(
        PhonePe.parse_webhook(&keys(), &wrong, &body),
        Err(ProviderError::BadSignature)
    );
}

#[test]
fn the_documented_refund_is_found_by_its_original_order() {
    let body = json!({ "event": "pg.refund.completed", "payload": {
        "merchantRefundId": "merchantRefundId", "originalMerchantOrderId": "Refund-12345",
        "refundId": "OMR7878098045517540996", "state": "COMPLETED", "amount": 50000 } })
    .to_string();
    assert_eq!(
        PhonePe.locate(&test_headers(&[]), &body),
        Located::Order("Refund-12345".to_owned())
    );
    let n = super::notice_of(&serde_json::from_str(&body).unwrap_or_default());
    assert_eq!(
        n.event,
        ProviderEvent::Refunded {
            refund_id: "OMR7878098045517540996".to_owned(),
            amount_paise: 50_000,
            reason: None
        }
    );
}

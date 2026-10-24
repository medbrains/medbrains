use super::{Cashfree, signature_ok};
use crate::online::{
    Keys, Located, OnlineProvider, ProviderError, ProviderEvent, Via, test_headers,
};
use base64::Engine as _;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::json;
use sha2::Sha256;

fn sign(secret: &str, ts: &str, body: &str) -> String {
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return String::new();
    };
    mac.update(ts.as_bytes());
    mac.update(body.as_bytes());
    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

fn keys() -> Keys {
    Keys::new(
        json!({ "client_id": "cf", "client_secret": "sec" })
            .as_object()
            .cloned()
            .unwrap_or_default(),
        "test",
    )
}

/// The docs' timestamp example (`1617695238078`), signed as their code
/// samples sign: timestamp then raw body, no separator.
#[test]
fn the_signature_is_timestamp_then_raw_body_under_the_secret() {
    let ts = "1617695238078";
    let body = r#"{"data":{"order":{"order_id":"o1"}},"type":"PAYMENT_SUCCESS_WEBHOOK"}"#;
    let good = sign("sec", ts, body);
    assert!(signature_ok("sec", ts, body, &good));
    assert!(!signature_ok("sec", "1617695238079", body, &good));
    assert!(!signature_ok("other", ts, body, &good));
    assert!(!signature_ok(
        "sec",
        ts,
        body,
        &sign("sec", &format!("{ts}."), body)
    ));
    assert!(!signature_ok("sec", ts, body, "%%%"));
}

#[test]
fn a_success_webhook_is_a_capture_of_its_order() {
    let body = json!({ "type": "PAYMENT_SUCCESS_WEBHOOK", "data": {
        "order": { "order_id": "o1" },
        "payment": { "cf_payment_id": 12345, "payment_amount": 400.0, "payment_group": "upi" } } })
    .to_string();
    let h = test_headers(&[
        ("x-webhook-timestamp", "1".to_owned()),
        ("x-webhook-signature", sign("sec", "1", &body)),
    ]);
    assert_eq!(Cashfree.locate(&h, &body), Located::Order("o1".to_owned()));
    let n = Cashfree.parse_webhook(&keys(), &h, &body);
    assert!(
        matches!(n.map(|n| n.event), Ok(ProviderEvent::Captured { via: Via::Checkout, amount_paise: Some(40_000), ref method, .. }) if method.as_deref() == Some("upi"))
    );
    let forged = test_headers(&[
        ("x-webhook-timestamp", "2".to_owned()),
        ("x-webhook-signature", sign("sec", "1", &body)),
    ]);
    assert_eq!(
        Cashfree.parse_webhook(&keys(), &forged, &body),
        Err(ProviderError::BadSignature)
    );
}

#[test]
fn a_paid_link_is_found_by_its_link_id_and_its_own_order_is_not_ours() {
    let link = json!({ "type": "PAYMENT_LINK_EVENT", "data": { "link_id": "abc", "link_status": "PAID",
        "link_amount_paid": "22.00", "order": { "order_id": "CFPay_x", "transaction_id": 1021206 } } }).to_string();
    let h = test_headers(&[]);
    assert_eq!(Cashfree.locate(&h, &link), Located::Order("abc".to_owned()));
    let paid = json!({ "type": "PAYMENT_SUCCESS_WEBHOOK", "data": { "order": { "order_id": "CFPay_x" } } }).to_string();
    assert_eq!(Cashfree.locate(&h, &paid), Located::NotOurs);
    let n = super::notice_of(&serde_json::from_str(&link).unwrap_or_default());
    assert_eq!(
        n.event,
        ProviderEvent::Captured {
            via: Via::Link,
            payment_id: "1021206".to_owned(),
            amount_paise: Some(2200),
            method: None,
            lookup: Some("CFPay_x".to_owned())
        }
    );
}

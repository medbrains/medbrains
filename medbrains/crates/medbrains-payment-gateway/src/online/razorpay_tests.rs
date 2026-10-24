use super::{OnlineProvider, Razorpay, event_of};
use crate::online::{Keys, Located, ProviderError, ProviderEvent, Via, test_headers};
use hmac::{Hmac, KeyInit, Mac};
use serde_json::json;
use sha2::Sha256;

fn hex_hmac(secret: &str, msg: &str) -> String {
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return String::new();
    };
    mac.update(msg.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn keys() -> Keys {
    let map = json!({ "key_id": "rzp_test_x", "key_secret": "ks", "webhook_secret": "ws" });
    super::with_mode(Keys::new(
        map.as_object().cloned().unwrap_or_default(),
        "test",
    ))
}

#[test]
fn a_webhook_verifies_only_under_the_webhook_secret() {
    let body = json!({ "event": "payment.captured", "payload": { "payment": { "entity": {
        "id": "pay_1", "order_id": "order_1", "amount": 500, "method": "upi" } } } })
    .to_string();
    let mut h = test_headers(&[
        ("x-razorpay-event-id", "evt_1".to_owned()),
        ("x-razorpay-signature", hex_hmac("ws", &body)),
    ]);
    let notice = Razorpay.parse_webhook(&keys(), &h, &body);
    assert!(matches!(
        notice.map(|n| n.event),
        Ok(ProviderEvent::Captured {
            via: Via::Checkout,
            amount_paise: Some(500),
            ..
        })
    ));
    h.extend(test_headers(&[(
        "x-razorpay-signature",
        hex_hmac("ks", &body),
    )]));
    assert_eq!(
        Razorpay.parse_webhook(&keys(), &h, &body),
        Err(ProviderError::BadSignature)
    );
    assert_eq!(
        Razorpay.locate(&h, &body),
        Located::Order("order_1".to_owned())
    );
}

#[test]
fn the_checkout_signature_is_order_pipe_payment_under_the_key_secret() {
    let proof = crate::online::ClientProof {
        order_ref: "order_1",
        payment_id: Some("pay_1"),
        signature: Some(&hex_hmac("ks", "order_1|pay_1")),
    };
    assert_eq!(Razorpay.verify_payment(&keys(), &proof), Ok(()));
    let forged = crate::online::ClientProof {
        signature: Some("00"),
        ..proof
    };
    assert_eq!(
        Razorpay.verify_payment(&keys(), &forged),
        Err(ProviderError::BadSignature)
    );
}

#[test]
fn a_link_and_a_qr_are_captures_by_their_own_route() {
    let link = json!({ "event": "payment_link.paid", "payload": { "payment": { "entity": { "id": "p" } } } });
    assert!(matches!(
        event_of(&link),
        ProviderEvent::Captured { via: Via::Link, .. }
    ));
    let qr = json!({ "event": "qr_code.credited", "payload": { "payment": { "entity": { "id": "p" } } } });
    assert!(matches!(
        event_of(&qr),
        ProviderEvent::Captured { via: Via::Qr, .. }
    ));
    assert_eq!(keys().get("mode"), Some("test"));
}

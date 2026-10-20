use super::{
    BTreeMap, PayU, fields_of, method_of, origin_of, payment_hash, response_hash_ok, sha512_hex,
    txnid,
};
use crate::online::{Keys, OnlineProvider, ProviderError, ProviderEvent, test_headers};
use serde_json::json;

fn f(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
        .collect()
}

/// The docs' basic example: the string hashed is
/// `gtKFFx|123456789|10.00|Test Product|John|john@example.com|||||||||||<Salt>`.
#[test]
fn the_request_hash_is_the_documented_string() {
    let fields = f(&[
        ("key", "gtKFFx"),
        ("txnid", "123456789"),
        ("amount", "10.00"),
        ("productinfo", "Test Product"),
        ("firstname", "John"),
        ("email", "john@example.com"),
    ]);
    let expected =
        sha512_hex("gtKFFx|123456789|10.00|Test Product|John|john@example.com|||||||||||salt");
    assert_eq!(payment_hash(&fields, "salt"), expected);
}

#[test]
fn a_callback_verifies_only_with_the_reverse_hash() {
    let mut fields = f(&[
        ("key", "gtKFFx"),
        ("txnid", "MB1"),
        ("amount", "10.00"),
        ("productinfo", "Bill"),
        ("firstname", "Patient"),
        ("email", "p@x"),
        ("status", "success"),
        ("mihpayid", "403993715521"),
        ("mode", "UPI"),
    ]);
    let reverse = sha512_hex("salt|success|||||||||||p@x|Patient|Bill|10.00|MB1|gtKFFx");
    fields.insert("hash".to_owned(), reverse);
    assert!(response_hash_ok(&fields, "salt"));
    assert!(!response_hash_ok(&fields, "other"));
    let body: String = fields
        .iter()
        .map(|(k, v)| format!("{k}={}", urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    assert_eq!(fields_of(&body), fields);
    let keys = Keys::new(
        json!({ "key": "gtKFFx", "salt": "salt" })
            .as_object()
            .cloned()
            .unwrap_or_default(),
        "t",
    );
    let n = PayU.parse_webhook(&keys, &test_headers(&[]), &body);
    assert!(
        matches!(n.map(|n| n.event), Ok(ProviderEvent::Captured { amount_paise: Some(1000), ref method, .. }) if method.as_deref() == Some("upi"))
    );
    let tampered = body.replace("amount=10.00", "amount=1.00");
    assert_eq!(
        PayU.parse_webhook(&keys, &test_headers(&[]), &tampered)
            .map(|n| n.event_id),
        Err(ProviderError::BadSignature)
    );
}

#[test]
fn ids_and_words_fit_payu() {
    assert_eq!(txnid(uuid::Uuid::nil()).len(), 25);
    assert_eq!(method_of("CC"), "card");
    assert_eq!(method_of("NB"), "netbanking");
    assert_eq!(
        origin_of("https://h.example/billing/x?y"),
        Some("https://h.example")
    );
    assert_eq!(
        origin_of("http://127.0.0.1:5173"),
        Some("http://127.0.0.1:5173")
    );
    assert_eq!(origin_of("nope"), None);
}

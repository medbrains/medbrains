use super::{PROVIDERS, paise_of, provider_for, rupees_text};
use serde_json::json;

#[test]
fn every_provider_is_found_by_its_own_code_once() {
    for p in PROVIDERS {
        assert_eq!(provider_for(p.code()).map(|f| f.code()), Some(p.code()));
    }
    assert!(provider_for("ccavenue").is_none());
}

#[test]
fn every_provider_checks_out_and_refunds() {
    for p in PROVIDERS {
        let c = p.capabilities();
        assert!(c.checkout && c.partial_refund, "{}", p.code());
        assert!(p.key_fields().iter().any(|f| f.secret), "{}", p.code());
    }
}

#[test]
fn rupee_amounts_convert_to_paise_exactly() {
    assert_eq!(paise_of(&json!("22.00")), Some(2200));
    assert_eq!(paise_of(&json!(22.5)), Some(2250));
    assert_eq!(paise_of(&json!("x")), None);
    assert_eq!(rupees_text(123_456), "1234.56");
    assert_eq!(rupees_text(100), "1.00");
}

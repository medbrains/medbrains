//! HCX message encryption — a compact JWE whose plaintext is the FHIR bundle
//! and whose *protected header* carries the HCX routing headers
//! (`x-hcx-sender_code`, `x-hcx-recipient_code`, `x-hcx-correlation_id`, …).
//!
//! Per the HCX open protocol (v0.7.1, "Message security and integrity") there
//! is no inner JWS and no unprotected header: the recipient's public key
//! encrypts the bundle, and the gateway routes on the protected header alone.

use josekit::jwe::{self, JweHeader, RSA_OAEP_256, RsaesJweAlgorithm};
use serde_json::{Map, Value};

use crate::CryptoError;

/// Key management algorithm. The HCX spec text names `RSA-OAEP`; the HCX
/// reference SDKs and the NHCX sandbox use `RSA-OAEP-256`. Change it here once
/// NHA confirms otherwise — nothing else names the algorithm.
pub const HCX_KEY_ALGORITHM: RsaesJweAlgorithm = RSA_OAEP_256;
/// Content encryption — fixed by the spec.
pub const HCX_CONTENT_ENCRYPTION: &str = "A256GCM";

/// A participant publishes either an X.509 certificate or a bare public key;
/// both are accepted and reduced to an SPKI `PUBLIC KEY` PEM.
///
/// # Errors
/// [`CryptoError::InvalidKey`] when the PEM is neither.
pub fn public_key_pem(cert_or_key_pem: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let text = std::str::from_utf8(cert_or_key_pem).map_err(|_| CryptoError::InvalidKey)?;
    if !text.contains("BEGIN CERTIFICATE") {
        return Ok(cert_or_key_pem.to_vec());
    }
    let cert =
        openssl::x509::X509::from_pem(cert_or_key_pem).map_err(|_| CryptoError::InvalidKey)?;
    cert.public_key()
        .and_then(|key| key.public_key_to_pem())
        .map_err(|_| CryptoError::InvalidKey)
}

/// Encrypt `bundle` for the recipient, with `protected` (the `x-hcx-*`
/// headers) in the JWE protected header. Returns the compact serialization.
///
/// # Errors
/// [`CryptoError::InvalidKey`] for an unusable certificate,
/// [`CryptoError::Encrypt`] otherwise.
pub fn encrypt_hcx(
    bundle: &Value,
    protected: &Map<String, Value>,
    recipient_cert_pem: &[u8],
) -> Result<String, CryptoError> {
    let mut header = JweHeader::from_map(protected.clone()).map_err(|_| CryptoError::Encrypt)?;
    header.set_content_encryption(HCX_CONTENT_ENCRYPTION);
    let encrypter = HCX_KEY_ALGORITHM
        .encrypter_from_pem(public_key_pem(recipient_cert_pem)?)
        .map_err(|_| CryptoError::InvalidKey)?;
    let plaintext = serde_json::to_vec(bundle).map_err(|_| CryptoError::Encoding)?;
    jwe::serialize_compact(&plaintext, &header, &encrypter).map_err(|_| CryptoError::Encrypt)
}

/// Decrypt a compact HCX JWE with our private key. Returns the protected
/// header (routing headers included) and the bundle.
///
/// # Errors
/// [`CryptoError::InvalidKey`] for an unusable key,
/// [`CryptoError::Decrypt`] for a JWE not meant for us or tampered with.
pub fn decrypt_hcx(
    token: &str,
    private_key_pem: &[u8],
) -> Result<(Map<String, Value>, Value), CryptoError> {
    let decrypter = HCX_KEY_ALGORITHM
        .decrypter_from_pem(private_key_pem)
        .map_err(|_| CryptoError::InvalidKey)?;
    let (plaintext, header) =
        jwe::deserialize_compact(token, &decrypter).map_err(|_| CryptoError::Decrypt)?;
    let bundle = serde_json::from_slice(&plaintext).map_err(|_| CryptoError::Encoding)?;
    Ok((header.claims_set().clone(), bundle))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use openssl::{pkey::PKey, rsa::Rsa};
    use serde_json::json;

    use super::*;

    fn key_pair() -> (Vec<u8>, Vec<u8>) {
        let key = PKey::from_rsa(Rsa::generate(2048).unwrap()).unwrap();
        (
            key.private_key_to_pem_pkcs8().unwrap(),
            key.public_key_to_pem().unwrap(),
        )
    }

    fn headers() -> Map<String, Value> {
        let mut map = Map::new();
        map.insert("x-hcx-sender_code".into(), json!("hosp-1@hcx"));
        map.insert("x-hcx-recipient_code".into(), json!("payer-1@hcx"));
        map.insert("x-hcx-correlation_id".into(), json!("c0ffee"));
        map
    }

    #[test]
    fn round_trips_the_bundle_and_routing_headers() {
        let (private, public) = key_pair();
        let bundle = json!({ "resourceType": "Bundle", "id": "b1" });
        let token = encrypt_hcx(&bundle, &headers(), &public).unwrap();
        assert_eq!(token.split('.').count(), 5, "compact JWE");

        let (header, decrypted) = decrypt_hcx(&token, &private).unwrap();
        assert_eq!(decrypted, bundle, "the plaintext is the bundle itself");
        assert_eq!(header["alg"], json!("RSA-OAEP-256"));
        assert_eq!(header["enc"], json!("A256GCM"));
        assert_eq!(header["x-hcx-sender_code"], json!("hosp-1@hcx"));
        assert_eq!(header["x-hcx-recipient_code"], json!("payer-1@hcx"));
        assert_eq!(header["x-hcx-correlation_id"], json!("c0ffee"));
    }

    #[test]
    fn a_certificate_works_as_the_recipient_key() {
        let (private, _) = key_pair();
        let key = PKey::private_key_from_pem(&private).unwrap();
        let mut name = openssl::x509::X509NameBuilder::new().unwrap();
        name.append_entry_by_text("CN", "payer").unwrap();
        let name = name.build();
        let mut cert = openssl::x509::X509Builder::new().unwrap();
        cert.set_subject_name(&name).unwrap();
        cert.set_issuer_name(&name).unwrap();
        cert.set_pubkey(&key).unwrap();
        cert.sign(&key, openssl::hash::MessageDigest::sha256())
            .unwrap();
        let pem = cert.build().to_pem().unwrap();

        let token = encrypt_hcx(&json!({ "ok": true }), &headers(), &pem).unwrap();
        assert_eq!(
            decrypt_hcx(&token, &private).unwrap().1,
            json!({ "ok": true })
        );
    }

    #[test]
    fn another_key_cannot_read_it() {
        let (_, public) = key_pair();
        let (other_private, _) = key_pair();
        let token = encrypt_hcx(&json!({}), &headers(), &public).unwrap();
        assert!(decrypt_hcx(&token, &other_private).is_err());
    }
}

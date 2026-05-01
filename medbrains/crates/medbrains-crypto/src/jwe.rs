//! JWE encrypt + decrypt using `RSA-OAEP-256 + A256GCM`.
//!
//! Used by NHCX for end-to-end payload confidentiality. Each registered
//! payer (TPA / insurer) publishes an RSA public key via the NHCX
//! participant directory; the hospital encrypts with that key. Reverse
//! direction (payer → hospital) decrypts with our own private key.

use josekit::jwe::{JweHeader, RSA_OAEP_256};
use josekit::jwt::{self, JwtPayload};

use crate::CryptoError;

pub fn encrypt_for_payer(
    payload: &serde_json::Value,
    audience: &str,
    public_key_pem: &[u8],
) -> Result<String, CryptoError> {
    let mut jwt_payload = JwtPayload::new();
    jwt_payload.set_audience(vec![audience]);
    jwt_payload
        .set_claim("payload", Some(payload.clone()))
        .map_err(|_| CryptoError::Encrypt)?;

    let mut header = JweHeader::new();
    header.set_token_type("JWT");
    header.set_content_encryption("A256GCM");

    let encrypter = RSA_OAEP_256
        .encrypter_from_pem(public_key_pem)
        .map_err(|_| CryptoError::InvalidKey)?;
    jwt::encode_with_encrypter(&jwt_payload, &header, &encrypter)
        .map_err(|_| CryptoError::Encrypt)
}

pub fn decrypt_from_payer(
    token: &str,
    expected_audience: &str,
    private_key_pem: &[u8],
) -> Result<serde_json::Value, CryptoError> {
    let decrypter = RSA_OAEP_256
        .decrypter_from_pem(private_key_pem)
        .map_err(|_| CryptoError::InvalidKey)?;
    let (payload, _header) =
        jwt::decode_with_decrypter(token, &decrypter).map_err(|_| CryptoError::Decrypt)?;
    let aud_ok = payload
        .audience()
        .map(|aud| aud.iter().any(|a| a == &expected_audience))
        .unwrap_or(false);
    if !aud_ok {
        return Err(CryptoError::Decrypt);
    }
    payload
        .claim("payload")
        .cloned()
        .ok_or(CryptoError::Decrypt)
}

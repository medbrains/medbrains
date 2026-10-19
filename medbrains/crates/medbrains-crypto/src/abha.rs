//! ABHA V3 field encryption.
//!
//! ABDM requires the Aadhaar number, mobile, ABHA number and every OTP to be
//! encrypted with `RSA/ECB/OAEPWithSHA-1AndMGF1Padding` under the key from
//! `GET /v3/profile/public/certificate` (ABHA V3 SOP §2). OpenSSL's
//! `PKCS1_OAEP` padding is exactly that: SHA-1 digest, MGF1 with SHA-1.

use base64::{Engine, engine::general_purpose::STANDARD};
use openssl::{pkey::PKey, rsa::Padding};

use crate::CryptoError;

/// Encrypt `plaintext` for ABDM with the base64 DER public key it published.
///
/// # Errors
/// [`CryptoError::InvalidKey`] when the key does not decode to an RSA key;
/// [`CryptoError::Encrypt`] when the plaintext is too long for the key.
pub fn encrypt_field(public_key_b64: &str, plaintext: &str) -> Result<String, CryptoError> {
    let compact: String = public_key_b64.split_whitespace().collect();
    let der = STANDARD
        .decode(compact)
        .map_err(|_| CryptoError::InvalidKey)?;
    let rsa = PKey::public_key_from_der(&der)
        .and_then(|key| key.rsa())
        .map_err(|_| CryptoError::InvalidKey)?;
    let mut out = vec![0_u8; usize::try_from(rsa.size()).map_err(|_| CryptoError::InvalidKey)?];
    let written = rsa
        .public_encrypt(plaintext.as_bytes(), &mut out, Padding::PKCS1_OAEP)
        .map_err(|_| CryptoError::Encrypt)?;
    out.truncate(written);
    Ok(STANDARD.encode(out))
}

#[cfg(test)]
mod tests {
    use super::encrypt_field;
    use base64::{Engine, engine::general_purpose::STANDARD};
    use openssl::{rsa::Padding, rsa::Rsa};

    /// What ABDM decrypts with its private key must be what we sent — with
    /// OAEP/SHA-1 padding, not the RSA-OAEP-256 the JWE helpers use.
    #[test]
    fn a_field_round_trips_through_oaep_sha1() -> Result<(), Box<dyn std::error::Error>> {
        let private = Rsa::generate(2048)?;
        let public_b64 = STANDARD.encode(private.public_key_to_der()?);
        let cipher = STANDARD.decode(encrypt_field(&public_b64, "123456")?)?;
        let mut plain = vec![0_u8; usize::try_from(private.size())?];
        let n = private.private_decrypt(&cipher, &mut plain, Padding::PKCS1_OAEP)?;
        assert_eq!(&plain[..n], b"123456");
        Ok(())
    }

    #[test]
    fn a_key_that_is_not_rsa_is_refused() {
        assert!(encrypt_field("bm90IGEga2V5", "1").is_err());
    }
}

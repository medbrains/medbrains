//! RS256 JWTs — the HCX gateway's bearer token on the callbacks it delivers.

use std::time::{Duration, SystemTime};

use josekit::jws::{JwsHeader, RS256};
use josekit::jwt::{self, JwtPayload, JwtPayloadValidator};
use serde_json::{Map, Value};

use crate::CryptoError;

/// Sign `claims` as an RS256 JWT that expires after `ttl`.
///
/// # Errors
/// [`CryptoError::InvalidKey`] for an unusable key, [`CryptoError::Sign`] otherwise.
pub fn sign_rs256(
    claims: Map<String, Value>,
    ttl: Duration,
    private_key_pem: &[u8],
) -> Result<String, CryptoError> {
    let mut payload = JwtPayload::from_map(claims).map_err(|_| CryptoError::Sign)?;
    let now = SystemTime::now();
    payload.set_issued_at(&now);
    payload.set_expires_at(&(now + ttl));
    let mut header = JwsHeader::new();
    header.set_token_type("JWT");
    let signer = RS256
        .signer_from_pem(private_key_pem)
        .map_err(|_| CryptoError::InvalidKey)?;
    jwt::encode_with_signer(&payload, &header, &signer).map_err(|_| CryptoError::Sign)
}

/// Verify an RS256 JWT against `public_key_pem` (a public key or an X.509
/// certificate). It must carry an `exp`, and be within it.
///
/// # Errors
/// [`CryptoError::InvalidKey`] for an unusable key; [`CryptoError::Verify`]
/// for a bad signature, a missing `exp`, or an expired token.
pub fn verify_rs256(token: &str, public_key_pem: &[u8]) -> Result<Map<String, Value>, CryptoError> {
    let verifier = RS256
        .verifier_from_pem(crate::jwe::public_key_pem(public_key_pem)?)
        .map_err(|_| CryptoError::InvalidKey)?;
    let (payload, _header) =
        jwt::decode_with_verifier(token, &verifier).map_err(|_| CryptoError::Verify)?;
    if payload.expires_at().is_none() {
        return Err(CryptoError::Verify);
    }
    let mut validator = JwtPayloadValidator::new();
    validator.set_base_time(SystemTime::now());
    validator
        .validate(&payload)
        .map_err(|_| CryptoError::Verify)?;
    Ok(payload.claims_set().clone())
}

/// Verify an RS256 JWT against any RSA key in a JWKS document (`{"keys":[…]}`),
/// such as the ABDM gateway's `/certs`. Keys are tried in order; a JWKS holds
/// a handful, so this stays bounded.
///
/// # Errors
/// [`CryptoError::Verify`] when no key in the set verifies the token.
pub fn verify_rs256_jwks(token: &str, jwks: &Value) -> Result<Map<String, Value>, CryptoError> {
    let keys = jwks["keys"].as_array().ok_or(CryptoError::InvalidKey)?;
    keys.iter()
        .filter(|k| k["kty"] == "RSA")
        .filter_map(|k| rsa_jwk_pem(k["n"].as_str()?, k["e"].as_str()?).ok())
        .find_map(|pem| verify_rs256(token, &pem).ok())
        .ok_or(CryptoError::Verify)
}

/// An RSA public key from a JWK's base64url `n` and `e`, as PEM.
fn rsa_jwk_pem(n: &str, e: &str) -> Result<Vec<u8>, CryptoError> {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    let part = |v: &str| {
        URL_SAFE_NO_PAD
            .decode(v.trim_end_matches('='))
            .map_err(|_| CryptoError::Encoding)
            .and_then(|b| openssl::bn::BigNum::from_slice(&b).map_err(|_| CryptoError::InvalidKey))
    };
    openssl::rsa::Rsa::from_public_components(part(n)?, part(e)?)
        .and_then(|rsa| rsa.public_key_to_pem())
        .map_err(|_| CryptoError::InvalidKey)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use openssl::{pkey::PKey, rsa::Rsa};

    use super::*;

    fn key_pair() -> (Vec<u8>, Vec<u8>) {
        let key = PKey::from_rsa(Rsa::generate(2048).unwrap()).unwrap();
        (
            key.private_key_to_pem_pkcs8().unwrap(),
            key.public_key_to_pem().unwrap(),
        )
    }

    #[test]
    fn verifies_its_own_signature_only() {
        let (private, public) = key_pair();
        let (_, other_public) = key_pair();
        let token = sign_rs256(Map::new(), Duration::from_secs(60), &private).unwrap();
        assert!(verify_rs256(&token, &public).is_ok());
        assert!(verify_rs256(&token, &other_public).is_err());
    }

    #[test]
    fn refuses_an_expired_token() {
        let (private, public) = key_pair();
        let mut claims = Map::new();
        claims.insert("exp".into(), Value::from(1_000));
        let mut payload = JwtPayload::from_map(claims).unwrap();
        payload.set_issued_at(&SystemTime::UNIX_EPOCH);
        let signer = RS256.signer_from_pem(&private).unwrap();
        let token = jwt::encode_with_signer(&payload, &JwsHeader::new(), &signer).unwrap();
        assert!(verify_rs256(&token, &public).is_err());
    }

    #[test]
    fn verifies_against_a_jwks_and_only_its_keys() {
        use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
        let rsa = Rsa::generate(2048).unwrap();
        let private = PKey::from_rsa(rsa.clone())
            .unwrap()
            .private_key_to_pem_pkcs8()
            .unwrap();
        let jwk = |r: &Rsa<openssl::pkey::Private>| {
            serde_json::json!({ "kty": "RSA", "alg": "RS256",
                "n": URL_SAFE_NO_PAD.encode(r.n().to_vec()), "e": URL_SAFE_NO_PAD.encode(r.e().to_vec()) })
        };
        let other = Rsa::generate(2048).unwrap();
        let token = sign_rs256(Map::new(), Duration::from_secs(60), &private).unwrap();
        let jwks = serde_json::json!({ "keys": [jwk(&other), jwk(&rsa)] });
        assert!(verify_rs256_jwks(&token, &jwks).is_ok());
        let wrong = serde_json::json!({ "keys": [jwk(&other)] });
        assert!(verify_rs256_jwks(&token, &wrong).is_err());
    }
}

//! RSA-signed JWTs: the HCX gateway's RS256 bearer token, and the ABDM
//! gateway's callback token, signed with either of the RS256 and RS512 keys
//! it publishes at `/api/hiecm/gateway/v3/certs`.

use std::time::{Duration, SystemTime};

use josekit::jws::{JwsHeader, JwsVerifier, RS256, RS512};
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
    verify_with(token, &verifier, Duration::ZERO)
}

/// The RSA signature algorithms a gateway token may use. Anything else
/// (`none`, HMAC, EC) is refused before any key is tried.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum RsaAlg {
    Rs256,
    Rs512,
}

impl RsaAlg {
    fn of(token: &str) -> Result<Self, CryptoError> {
        match peek_part(token, 0)?.get("alg").and_then(Value::as_str) {
            Some("RS256") => Ok(Self::Rs256),
            Some("RS512") => Ok(Self::Rs512),
            _ => Err(CryptoError::Verify),
        }
    }

    fn verifier(self, pem: &[u8]) -> Result<Box<dyn JwsVerifier>, CryptoError> {
        let built = match self {
            Self::Rs256 => RS256.verifier_from_pem(pem).map(|v| Box::new(v) as Box<dyn JwsVerifier>),
            Self::Rs512 => RS512.verifier_from_pem(pem).map(|v| Box::new(v) as Box<dyn JwsVerifier>),
        };
        built.map_err(|_| CryptoError::InvalidKey)
    }
}

/// Verify an RS256 or RS512 JWT (the algorithm its header names) against
/// `public_key_pem`, accepting an `exp` up to `leeway` in the past. As
/// [`verify_rs256`] otherwise.
///
/// # Errors
/// As [`verify_rs256`]; [`CryptoError::Verify`] for any other algorithm.
pub fn verify_rsa(
    token: &str,
    public_key_pem: &[u8],
    leeway: Duration,
) -> Result<Map<String, Value>, CryptoError> {
    let alg = RsaAlg::of(token)?;
    let verifier = alg.verifier(&crate::jwe::public_key_pem(public_key_pem)?)?;
    verify_with(token, verifier.as_ref(), leeway)
}

fn verify_with(
    token: &str,
    verifier: &dyn JwsVerifier,
    leeway: Duration,
) -> Result<Map<String, Value>, CryptoError> {
    let (payload, _header) =
        jwt::decode_with_verifier(token, verifier).map_err(|_| CryptoError::Verify)?;
    if payload.expires_at().is_none() {
        return Err(CryptoError::Verify);
    }
    let mut validator = JwtPayloadValidator::new();
    validator.set_base_time(SystemTime::now() - leeway);
    validator
        .validate(&payload)
        .map_err(|_| CryptoError::Verify)?;
    Ok(payload.claims_set().clone())
}

/// Verify an RS256 or RS512 JWT against the RSA keys of a JWKS document.
///
/// Such as the ABDM gateway's `/certs` (`{"keys":[…]}`), accepting an `exp`
/// up to `leeway` in the past. A key whose `kid` or `alg` contradicts the
/// token is skipped; a JWKS holds a handful, so this stays bounded.
///
/// # Errors
/// [`CryptoError::InvalidKey`] for a document with no key list;
/// [`CryptoError::Verify`] when no key in it verifies the token.
pub fn verify_rsa_jwks(
    token: &str,
    jwks: &Value,
    leeway: Duration,
) -> Result<Map<String, Value>, CryptoError> {
    let keys = jwks["keys"].as_array().ok_or(CryptoError::InvalidKey)?;
    let alg = RsaAlg::of(token)?;
    let header = peek_part(token, 0)?;
    let kid = header.get("kid").and_then(Value::as_str);
    let alg_name = header.get("alg").and_then(Value::as_str);
    keys.iter()
        .filter(|k| k["kty"] == "RSA")
        .filter(|k| kid.is_none_or(|kid| k["kid"].as_str().is_none_or(|own| own == kid)))
        .filter(|k| k["alg"].as_str().is_none_or(|own| Some(own) == alg_name))
        .filter_map(|k| rsa_jwk_pem(k["n"].as_str()?, k["e"].as_str()?).ok())
        .find_map(|pem| verify_with(token, alg.verifier(&pem).ok()?.as_ref(), leeway).ok())
        .ok_or(CryptoError::Verify)
}

/// The claims of a token, NOT verified — only to choose which keys to verify
/// it with. Never trust what this returns.
///
/// # Errors
/// [`CryptoError::Encoding`] for a token that is not three base64url parts.
pub fn peek_claims(token: &str) -> Result<Map<String, Value>, CryptoError> {
    peek_part(token, 1)
}

fn peek_part(token: &str, index: usize) -> Result<Map<String, Value>, CryptoError> {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    let part = token.split('.').nth(index).ok_or(CryptoError::Encoding)?;
    let bytes = URL_SAFE_NO_PAD
        .decode(part.trim_end_matches('='))
        .map_err(|_| CryptoError::Encoding)?;
    serde_json::from_slice(&bytes).map_err(|_| CryptoError::Encoding)
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
        assert!(verify_rsa_jwks(&token, &jwks, Duration::ZERO).is_ok());
        let wrong = serde_json::json!({ "keys": [jwk(&other)] });
        assert!(verify_rsa_jwks(&token, &wrong, Duration::ZERO).is_err());
    }

    fn sign_with(alg: &str, private: &[u8]) -> String {
        let mut payload = JwtPayload::new();
        payload.set_expires_at(&(SystemTime::now() + Duration::from_secs(60)));
        let header = JwsHeader::new();
        if alg == "RS512" {
            jwt::encode_with_signer(&payload, &header, &RS512.signer_from_pem(private).unwrap())
        } else {
            jwt::encode_with_signer(&payload, &header, &RS256.signer_from_pem(private).unwrap())
        }
        .unwrap()
    }

    /// The ABDM gateway publishes an RS512 key next to its RS256 one
    /// (dev.abdm.gov.in/api/hiecm/gateway/v3/certs); a token signed with it
    /// must verify, and a key labelled for the other algorithm is skipped.
    #[test]
    fn verifies_rs512_from_a_jwks_and_matches_alg() {
        use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
        let rsa = Rsa::generate(2048).unwrap();
        let private = PKey::from_rsa(rsa.clone()).unwrap().private_key_to_pem_pkcs8().unwrap();
        let jwk = |alg: &str| serde_json::json!({ "kty": "RSA", "alg": alg,
            "n": URL_SAFE_NO_PAD.encode(rsa.n().to_vec()), "e": URL_SAFE_NO_PAD.encode(rsa.e().to_vec()) });
        let token = sign_with("RS512", &private);
        assert!(verify_rsa_jwks(&token, &serde_json::json!({ "keys": [jwk("RS512")] }), Duration::ZERO).is_ok());
        assert!(verify_rsa_jwks(&token, &serde_json::json!({ "keys": [jwk("RS256")] }), Duration::ZERO).is_err());
        let public = PKey::from_rsa(rsa).unwrap().public_key_to_pem().unwrap();
        assert!(verify_rsa(&token, &public, Duration::ZERO).is_ok());
        assert!(verify_rsa(&sign_with("RS256", &private), &public, Duration::ZERO).is_ok());
    }

    /// The gateway repeats a refused callback ~16 minutes later with the same,
    /// by then expired, token (care-abdm E10): a leeway accepts it, and only it.
    #[test]
    fn a_leeway_accepts_a_recently_expired_token_only() {
        let (private, public) = key_pair();
        let mut payload = JwtPayload::new();
        payload.set_expires_at(&(SystemTime::now() - Duration::from_secs(120)));
        let signer = RS256.signer_from_pem(&private).unwrap();
        let token = jwt::encode_with_signer(&payload, &JwsHeader::new(), &signer).unwrap();
        assert!(verify_rsa(&token, &public, Duration::ZERO).is_err());
        assert!(verify_rsa(&token, &public, Duration::from_secs(600)).is_ok());
        assert!(verify_rsa(&token, &public, Duration::from_secs(60)).is_err());
    }

    /// `alg: none` and HMAC tokens never reach a key.
    #[test]
    fn refuses_non_rsa_algorithms() {
        use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
        let (_, public) = key_pair();
        let part = |v: Value| URL_SAFE_NO_PAD.encode(v.to_string());
        let none = format!("{}.{}.", part(serde_json::json!({"alg":"none"})), part(serde_json::json!({"exp": 9_999_999_999_u64})));
        assert!(verify_rsa(&none, &public, Duration::ZERO).is_err());
        let hs = format!("{}.{}.c2ln", part(serde_json::json!({"alg":"HS256"})), part(serde_json::json!({"exp": 9_999_999_999_u64})));
        assert!(verify_rsa(&hs, &public, Duration::ZERO).is_err());
        assert_eq!(peek_claims(&hs).unwrap()["exp"], 9_999_999_999_u64);
    }
}

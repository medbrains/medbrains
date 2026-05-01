//! JWS sign + verify using RS256 (NHCX-required signature alg).

use josekit::jws::{JwsHeader, RS256};
use josekit::jwt::{self, JwtPayload};

use crate::CryptoError;

/// Sign a JSON payload as a compact JWS (RS256). The PEM-encoded
/// private key must be a 2048-bit (or larger) RSA key registered in
/// NHCX participant onboarding. The hospital's `participant_code` is
/// embedded in the `iss` claim.
pub fn sign_rs256(
    payload: &serde_json::Value,
    issuer: &str,
    private_key_pem: &[u8],
) -> Result<String, CryptoError> {
    let mut jwt_payload = JwtPayload::new();
    jwt_payload.set_issuer(issuer);
    jwt_payload.set_issued_at(&std::time::SystemTime::now());
    jwt_payload
        .set_claim("payload", Some(payload.clone()))
        .map_err(|_| CryptoError::Sign)?;

    let mut header = JwsHeader::new();
    header.set_token_type("JWT");

    let signer = RS256
        .signer_from_pem(private_key_pem)
        .map_err(|_| CryptoError::InvalidKey)?;
    jwt::encode_with_signer(&jwt_payload, &header, &signer).map_err(|_| CryptoError::Sign)
}

/// Verify a compact JWS using the issuer's public key (PEM). Returns
/// the decoded `payload` claim if the signature is valid; rejects on
/// any tampering, expired iat, or unknown issuer.
pub fn verify_rs256(
    token: &str,
    expected_issuer: &str,
    public_key_pem: &[u8],
) -> Result<serde_json::Value, CryptoError> {
    let verifier = RS256
        .verifier_from_pem(public_key_pem)
        .map_err(|_| CryptoError::InvalidKey)?;
    let (payload, _header) =
        jwt::decode_with_verifier(token, &verifier).map_err(|_| CryptoError::Verify)?;
    let iss = payload.issuer().ok_or(CryptoError::Verify)?;
    if iss != expected_issuer {
        return Err(CryptoError::Verify);
    }
    payload
        .claim("payload")
        .cloned()
        .ok_or(CryptoError::Verify)
}

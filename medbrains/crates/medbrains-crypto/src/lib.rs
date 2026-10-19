//! Crypto helpers for NHCX (JWE + the gateway's RS256 JWT) and ABDM
//! (Fidelius transfer encryption).
//!
//! 1. **NHCX** — the FHIR bundle is the plaintext of a compact JWE
//!    (`RSA-OAEP-256 + A256GCM`) encrypted for the recipient, with the
//!    `x-hcx-*` routing headers in its protected header (`jwe::encrypt_hcx`).
//!    The gateway authenticates its callbacks with an RS256 bearer JWT
//!    (`jws::verify_rs256`).
//!
//! 2. **ABDM health-information transfer** — each FHIR bundle is encrypted
//!    for the HIU with Fidelius (`fidelius`): ECDH on Curve25519 in
//!    Weierstrass form, HKDF from the two nonces, AES-256-GCM.
//!
//! 3. **UHI (Beckn)** — every UHI call is signed with ed25519 over a
//!    BLAKE2b-512 digest of the body (`beckn`).
//!
//! Errors are intentionally opaque (`CryptoError`) so signing-key
//! material can never leak through error paths.

use thiserror::Error;

pub mod abha;
pub mod aead;
pub mod beckn;
pub mod fidelius;
pub mod jwe;
pub mod jws;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("invalid key material")]
    InvalidKey,
    #[error("encrypt failed")]
    Encrypt,
    #[error("decrypt failed")]
    Decrypt,
    #[error("sign failed")]
    Sign,
    #[error("verify failed")]
    Verify,
    #[error("encoding error")]
    Encoding,
}

//! Keyed fingerprints for identifiers that must never be recoverable.
//!
//! An Aadhaar number is 12 digits with a check digit: about 10^11
//! possibilities, which a plain SHA-256 — even salted with the tenant id —
//! gives back in minutes on one GPU. That is storing the Aadhaar number, which
//! UIDAI Circular 14/2025 forbids outside an Aadhaar Data Vault. A keyed HMAC
//! whose key lives in the secret store, not the database, cannot be reversed
//! from a database copy, and still lets registration spot the same person twice.

use hmac::{Hmac, Mac};
use medbrains_server_core::state::AppState;
use sha2::Sha256;
use uuid::Uuid;

/// Where the fingerprint key lives in the secret store.
const KEY_NAME: &str = "MEDBRAINS_IDENTIFIER_HMAC_KEY";
/// Development fallback only; production sets the key in the secret store.
const DEV_KEY: &[u8] = b"medbrains-dev-identifier-hmac-key";

pub(crate) async fn identifier_key(state: &AppState) -> Vec<u8> {
    match state.secret_resolver.get(KEY_NAME).await {
        Ok(value) if value.len() >= 32 => value.into_bytes(),
        _ => DEV_KEY.to_vec(),
    }
}

/// HMAC-SHA256 of `tenant:kind:value`, hex.
pub(crate) fn keyed_fingerprint(key: &[u8], tenant_id: Uuid, kind: &str, value: &str) -> String {
    // ponytail: HMAC accepts any key length, so `new_from_slice` cannot fail;
    // an empty fingerprint would only ever fail to match.
    Hmac::<Sha256>::new_from_slice(key).map_or_else(
        |_| String::new(),
        |mut mac| {
            mac.update(format!("{tenant_id}:{kind}:{value}").as_bytes());
            mac.finalize()
                .into_bytes()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect()
        },
    )
}

#[cfg(test)]
mod tests {
    use super::keyed_fingerprint;
    use sha2::{Digest, Sha256};
    use uuid::Uuid;

    /// Without the key, the stored value is not the old guessable hash, and a
    /// different key gives a different fingerprint.
    #[test]
    fn a_fingerprint_needs_the_key() {
        let tenant = Uuid::nil();
        let digits = "234567890123";
        let a = keyed_fingerprint(
            b"key-one-key-one-key-one-key-one!",
            tenant,
            "aadhaar",
            digits,
        );
        let b = keyed_fingerprint(
            b"key-two-key-two-key-two-key-two!",
            tenant,
            "aadhaar",
            digits,
        );
        let plain: String = Sha256::digest(format!("{tenant}:aadhaar:{digits}").as_bytes())
            .iter()
            .map(|x| format!("{x:02x}"))
            .collect();
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
        assert_ne!(a, plain);
        assert_eq!(
            a,
            keyed_fingerprint(
                b"key-one-key-one-key-one-key-one!",
                tenant,
                "aadhaar",
                digits
            )
        );
    }
}

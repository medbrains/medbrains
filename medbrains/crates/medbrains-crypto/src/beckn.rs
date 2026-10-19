//! UHI request signatures — UHI's variant of Beckn HTTP signing.
//!
//! UHI (NHA's Unified Health Interface) is Beckn-based but does **not** sign
//! the way Beckn's BECKN-006 draft does. NHA's own gateway, registry and
//! reference HSPA (github.com/NHA-ABDM/UHI, `Crypt.generateAuthorizationParams`)
//! all do this, and it is what the network checks:
//!
//! 1. `digest = base64(BLAKE2b-512(body))`
//! 2. `signing string = "(created): <c> (expires): <e> digest: BLAKE-512=<digest>"`
//!    — single spaces, not Beckn's newlines
//! 3. the signing string is hashed again: `base64(BLAKE2b-512(signing string))`
//! 4. that base64 text is signed with ed25519
//!
//! and the header is a JSON object, not Beckn's `Signature keyId="…"` list:
//!
//! ```text
//! Authorization: {"headers":"(created) (expires) digest","expires":"1679652060",
//!   "signature":"<b64>","created":"1679652050",
//!   "keyId":"<subscriber_id>|<unique_key_id>|ed25519","algorithm":"ed25519"}
//! ```
//!
//! Keys travel as base64 DER, as the UHI registry stores them: PKCS#8 for the
//! private key (`MC4CAQAwBQYDK2VwBCIEI…`), SPKI for the public key
//! (`MCowBQYDK2VwAyEA…`). Raw 32-byte keys are accepted too.

use base64::{Engine, engine::general_purpose::STANDARD};
use blake2::{Blake2b512, Digest};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::CryptoError;

/// The only algorithm UHI uses.
pub const ALGORITHM: &str = "ed25519";
/// The headers every signature covers.
pub const SIGNED_HEADERS: &str = "(created) (expires) digest";
/// DER prefix of an ed25519 PKCS#8 private key (RFC 8410).
const PKCS8_PREFIX: [u8; 16] = [
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
];
/// DER prefix of an ed25519 SPKI public key (RFC 8410).
const SPKI_PREFIX: [u8; 12] = [
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
];
/// Clock skew allowed either side of the signature's window. NHA signs with
/// a ten-second window, so the allowance matters more than usual.
const SKEW_SECONDS: i64 = 30;

/// A key pair, both halves base64 DER.
#[derive(Debug)]
pub struct KeyPair {
    pub private_key: String,
    pub public_key: String,
}

/// A new random ed25519 key pair.
pub fn generate() -> KeyPair {
    let seed: [u8; 32] = rand::random();
    let key = SigningKey::from_bytes(&seed);
    KeyPair {
        private_key: STANDARD.encode([PKCS8_PREFIX.as_slice(), seed.as_slice()].concat()),
        public_key: encode_public(&key.verifying_key()),
    }
}

fn encode_public(key: &VerifyingKey) -> String {
    STANDARD.encode([SPKI_PREFIX.as_slice(), key.as_bytes().as_slice()].concat())
}

/// The public key (base64 SPKI) of a base64 private key.
///
/// # Errors
/// [`CryptoError::InvalidKey`] when the key is not PKCS#8 or 32 raw bytes.
pub fn public_key_of(private_key_b64: &str) -> Result<String, CryptoError> {
    Ok(encode_public(
        &signing_key(private_key_b64)?.verifying_key(),
    ))
}

/// The 32 key bytes of base64 `b64`: raw, or after a DER `prefix`.
fn key_bytes(b64: &str, prefix: &[u8]) -> Result<[u8; 32], CryptoError> {
    let bytes = STANDARD
        .decode(b64.trim())
        .map_err(|_| CryptoError::InvalidKey)?;
    let raw = bytes.strip_prefix(prefix).unwrap_or(&bytes);
    raw.try_into().map_err(|_| CryptoError::InvalidKey)
}

fn signing_key(private_key_b64: &str) -> Result<SigningKey, CryptoError> {
    Ok(SigningKey::from_bytes(&key_bytes(
        private_key_b64,
        &PKCS8_PREFIX,
    )?))
}

fn blake2b(data: &[u8]) -> String {
    STANDARD.encode(Blake2b512::digest(data))
}

/// `base64(BLAKE2b-512(body))`.
pub fn digest(body: &[u8]) -> String {
    blake2b(body)
}

/// The signing string, as UHI builds it.
pub fn signing_string(created: i64, expires: i64, digest_b64: &str) -> String {
    format!("(created): {created} (expires): {expires} digest: BLAKE-512={digest_b64}")
}

/// What ed25519 actually signs: the base64 hash of the signing string.
fn to_sign(created: i64, expires: i64, digest_b64: &str) -> String {
    blake2b(signing_string(created, expires, digest_b64).as_bytes())
}

/// The header object, field for field as NHA's `HeaderDTO`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct HeaderJson {
    headers: String,
    expires: String,
    signature: String,
    created: String,
    #[serde(rename = "keyId")]
    key_id: String,
    algorithm: String,
}

/// The `Authorization` header value for `body`, valid from `created` to
/// `expires` (unix seconds).
///
/// # Errors
/// [`CryptoError::InvalidKey`] for an unusable private key.
pub fn sign(
    subscriber_id: &str,
    unique_key_id: &str,
    private_key_b64: &str,
    body: &[u8],
    (created, expires): (i64, i64),
) -> Result<String, CryptoError> {
    let key = signing_key(private_key_b64)?;
    let signature = key.sign(to_sign(created, expires, &digest(body)).as_bytes());
    serde_json::to_string(&HeaderJson {
        headers: SIGNED_HEADERS.to_owned(),
        expires: expires.to_string(),
        signature: STANDARD.encode(signature.to_bytes()),
        created: created.to_string(),
        key_id: format!("{subscriber_id}|{unique_key_id}|{ALGORITHM}"),
        algorithm: ALGORITHM.to_owned(),
    })
    .map_err(|_| CryptoError::Encoding)
}

/// A parsed `Authorization` (or `X-Gateway-Authorization`) header.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignatureHeader {
    pub subscriber_id: String,
    pub unique_key_id: String,
    pub created: i64,
    pub expires: i64,
    signature: String,
}

impl SignatureHeader {
    /// Parse a UHI signature header.
    ///
    /// # Errors
    /// [`CryptoError::Encoding`] when it is not the JSON object, a field is
    /// malformed, or the algorithm or covered headers are not UHI's.
    pub fn parse(header: &str) -> Result<Self, CryptoError> {
        let h: HeaderJson = serde_json::from_str(header).map_err(|_| CryptoError::Encoding)?;
        let mut key_id = h.key_id.splitn(3, '|');
        let subscriber_id = key_id.next().unwrap_or_default().to_owned();
        let unique_key_id = key_id.next().unwrap_or_default().to_owned();
        if subscriber_id.is_empty()
            || unique_key_id.is_empty()
            || key_id.next() != Some(ALGORITHM)
            || h.algorithm != ALGORITHM
            || h.headers != SIGNED_HEADERS
        {
            return Err(CryptoError::Encoding);
        }
        let number = |v: &str| v.trim().parse::<i64>().map_err(|_| CryptoError::Encoding);
        Ok(Self {
            subscriber_id,
            unique_key_id,
            created: number(&h.created)?,
            expires: number(&h.expires)?,
            signature: h.signature,
        })
    }

    /// Check the signature over `body` with the sender's registered public
    /// key, at unix time `now`.
    ///
    /// # Errors
    /// [`CryptoError::Verify`] when the window has passed or not begun, or
    /// the signature does not match; [`CryptoError::InvalidKey`] for an
    /// unusable public key.
    pub fn verify(&self, body: &[u8], public_key_b64: &str, now: i64) -> Result<(), CryptoError> {
        if self.created > now + SKEW_SECONDS || self.expires < now - SKEW_SECONDS {
            return Err(CryptoError::Verify);
        }
        self.verify_digest(&digest(body), public_key_b64)
    }

    fn verify_digest(&self, digest_b64: &str, public_key_b64: &str) -> Result<(), CryptoError> {
        let key = VerifyingKey::from_bytes(&key_bytes(public_key_b64, &SPKI_PREFIX)?)
            .map_err(|_| CryptoError::InvalidKey)?;
        let signature: [u8; 64] = STANDARD
            .decode(&self.signature)
            .ok()
            .and_then(|b| b.try_into().ok())
            .ok_or(CryptoError::Verify)?;
        key.verify(
            to_sign(self.created, self.expires, digest_b64).as_bytes(),
            &Signature::from_bytes(&signature),
        )
        .map_err(|_| CryptoError::Verify)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use base64::{Engine, engine::general_purpose::STANDARD};
    use ed25519_dalek::Signer;

    use super::{SignatureHeader, digest, generate, public_key_of, sign, signing_key, to_sign};

    const BODY: &[u8] = br#"{"context":{"action":"search"},"message":{}}"#;
    const WINDOW: (i64, i64) = (1_700_000_000, 1_700_000_300);

    // The test vector in NHA's "Signing UHI APIs" document (NHA-ABDM/UHI,
    // docs/). The body is printed there pretty-printed and its exact bytes
    // cannot be recovered, so the vector is checked from its digest on.
    const UHI_PRIVATE: &str = "MC4CAQAwBQYDK2VwBCIEIGCioWvsJleY53bW5+8G9vWWqsdGA9y1JMoVvLslaFA7";
    const UHI_PUBLIC: &str = "MCowBQYDK2VwAyEA9AwjtMBySgjkf3cx2pzAYt8pL1qAlhil3WUulCSpFnI=";
    const UHI_DIGEST: &str =
        "W9UFzCRHgPpPoJxDFuGIz9bWqOjpc6f+Tv32bN1X3qSesscMXhUSdMyGsloAgn8+wo95otF2FQDz+YOBVz2hqA==";
    const UHI_SIGNATURE: &str =
        "EfImhDOjl1SiwwUYKHSmz52u/FYZSggS5B177WaxvQg5OApvCk/OQW/n0nsSdRdm7KM8cXm/T77pdF7jI5G3Bw==";

    #[test]
    fn nhas_published_vector_signs_and_verifies() {
        assert_eq!(public_key_of(UHI_PRIVATE).unwrap(), UHI_PUBLIC);
        let key = signing_key(UHI_PRIVATE).unwrap();
        let signature = key.sign(to_sign(1_679_652_050, 1_679_652_060, UHI_DIGEST).as_bytes());
        assert_eq!(STANDARD.encode(signature.to_bytes()), UHI_SIGNATURE);

        let header = format!(
            r#"{{"headers":"(created) (expires) digest","expires":"1679652060","signature":"{UHI_SIGNATURE}","created":"1679652050","keyId":"eua-nha|eua.nha.k1|ed25519","algorithm":"ed25519"}}"#
        );
        let parsed = SignatureHeader::parse(&header).unwrap();
        assert_eq!(parsed.subscriber_id, "eua-nha");
        assert_eq!(parsed.unique_key_id, "eua.nha.k1");
        parsed.verify_digest(UHI_DIGEST, UHI_PUBLIC).unwrap();
        assert!(parsed.verify_digest(&digest(b"other"), UHI_PUBLIC).is_err());
    }

    #[test]
    fn blake2b_512_matches_rfc_7693() {
        // RFC 7693 Appendix A, BLAKE2b-512("abc"), in base64. (The hash
        // check printed in NHA's document is not BLAKE2b-512 of its input.)
        assert_eq!(
            digest(b"abc"),
            "uoClP5gcTQ1qJ5e2nxL26UwhLxRoWsS3SxK7b9v/otF9h8U5Kqt5LcJS1d5FM8yVGNOKqNvxklq5I4bt1ACZIw=="
        );
    }

    #[test]
    fn a_signed_body_verifies_and_a_tampered_one_does_not() {
        let pair = generate();
        assert!(pair.public_key.starts_with("MCowBQYDK2VwAyEA"), "SPKI DER");
        let header = sign("hspa.test", "k1", &pair.private_key, BODY, WINDOW).unwrap();
        let parsed = SignatureHeader::parse(&header).unwrap();
        assert_eq!(parsed.subscriber_id, "hspa.test");
        parsed
            .verify(BODY, &pair.public_key, WINDOW.0 + 10)
            .unwrap();

        let tampered = br#"{"context":{"action":"search"},"message":{"x":1}}"#;
        assert!(
            parsed
                .verify(tampered, &pair.public_key, WINDOW.0 + 10)
                .is_err()
        );
        assert!(
            parsed
                .verify(BODY, &generate().public_key, WINDOW.0 + 10)
                .is_err()
        );
        assert!(
            parsed
                .verify(BODY, &pair.public_key, WINDOW.1 + 3600)
                .is_err(),
            "expired"
        );
        assert!(
            parsed
                .verify(BODY, &pair.public_key, WINDOW.0 - 3600)
                .is_err(),
            "not yet"
        );
    }

    #[test]
    fn a_fixed_key_signs_deterministically_and_raw_keys_work() {
        let a = sign("bap.test", "key-1", UHI_PRIVATE, BODY, WINDOW).unwrap();
        assert_eq!(
            a,
            sign("bap.test", "key-1", UHI_PRIVATE, BODY, WINDOW).unwrap()
        );
        let raw_private = STANDARD.encode(&STANDARD.decode(UHI_PRIVATE).unwrap()[16..]);
        assert_eq!(
            sign("bap.test", "key-1", &raw_private, BODY, WINDOW).unwrap(),
            a
        );
        let raw_public = STANDARD.encode(&STANDARD.decode(UHI_PUBLIC).unwrap()[12..]);
        SignatureHeader::parse(&a)
            .unwrap()
            .verify(BODY, &raw_public, WINDOW.0)
            .unwrap();
    }

    #[test]
    fn malformed_headers_and_keys_are_refused() {
        let ok = |key_id: &str, alg: &str, headers: &str, created: &str| {
            format!(
                r#"{{"headers":"{headers}","expires":"2","signature":"x","created":"{created}","keyId":"{key_id}","algorithm":"{alg}"}}"#
            )
        };
        let full = "(created) (expires) digest";
        for bad in [
            String::new(),
            r#"Signature keyId="a|b|ed25519""#.to_owned(),
            ok("a|b|rsa", "ed25519", full, "1"),
            ok("a|b|ed25519", "rsa", full, "1"),
            ok("a|b|ed25519", "ed25519", "digest", "1"),
            ok("|b|ed25519", "ed25519", full, "1"),
            ok("a|b|ed25519", "ed25519", full, "soon"),
        ] {
            assert!(SignatureHeader::parse(&bad).is_err(), "{bad}");
        }
        assert!(SignatureHeader::parse(&ok("a|b|ed25519", "ed25519", full, "1")).is_ok());
        assert!(public_key_of("not base64!").is_err());
        assert!(public_key_of("AQID").is_err(), "3 bytes is not a key");
    }
}

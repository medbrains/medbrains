//! Fidelius — ABDM's end-to-end encryption for health-information transfer.
//!
//! Byte-for-byte what `mgrmtech/fidelius-cli` (the implementation ABDM links
//! to) and NHA's ABDM wrapper do:
//!
//! - ECDH on **Curve25519 in short-Weierstrass form** (BouncyCastle
//!   `CustomNamedCurves "curve25519"`), *not* X25519: raw scalar
//!   multiplication, no clamping. The shared secret is the affine X of `d·Q`,
//!   32 bytes big-endian.
//! - Public keys are the uncompressed point `04‖X‖Y` (65 bytes, base64). A
//!   peer key may also arrive as X.509 SubjectPublicKeyInfo with explicit
//!   curve parameters; its last 65 bytes are that same point.
//! - `xor[i] = sender_nonce[i] ^ requester_nonce[i]` (32-byte nonces);
//!   salt = `xor[..20]`, IV = `xor[20..]` (the last 12 bytes).
//! - AES key = HKDF-SHA256(ikm = shared secret, salt, info = empty), 32 bytes.
//! - AES-256-GCM, 128-bit tag, no AAD; output base64(ciphertext‖tag).
//!
//! Checked against the fidelius-cli README test vector in the tests below.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use hkdf::Hkdf;
use openssl::bn::{BigNum, BigNumContext};
use openssl::ec::{EcGroup, EcPoint, PointConversionForm};
use rand::Rng;
use sha2::Sha256;

use crate::CryptoError;

const P: &str = "7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFED";
const A: &str = "2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA984914A144";
const B: &str = "7B425ED097B425ED097B425ED097B425ED097B425ED097B4260B5E9C7710C864";
const GX: &str = "2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD245A";
const GY: &str = "20AE19A1B8A086B4E01EDD2C7748D14C923D4D7E6D7C61B229E9C5A27ECED3D9";
const N: &str = "1000000000000000000000000000000014DEF9DEA2F79CD65812631A5CF5D3ED";
const POINT_LEN: usize = 65;
const NONCE_LEN: usize = 32;
const SALT_LEN: usize = 20;
const IV_LEN: usize = 12;

/// One side's key material, every field base64 as ABDM carries it.
#[derive(Clone)]
pub struct KeyMaterial {
    pub private_key: String,
    /// Uncompressed point `04‖X‖Y`.
    pub public_key: String,
    pub nonce: String,
}

// Hand-written so the private key never reaches a log line.
impl std::fmt::Debug for KeyMaterial {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KeyMaterial")
            .field("public_key", &self.public_key)
            .finish_non_exhaustive()
    }
}

fn bn(hex: &str) -> Result<BigNum, CryptoError> {
    BigNum::from_hex_str(hex).map_err(|_| CryptoError::InvalidKey)
}

fn curve() -> Result<(EcGroup, BigNumContext), CryptoError> {
    let mut ctx = BigNumContext::new().map_err(|_| CryptoError::InvalidKey)?;
    let mut group = EcGroup::from_components(bn(P)?, bn(A)?, bn(B)?, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let mut g = EcPoint::new(&group).map_err(|_| CryptoError::InvalidKey)?;
    let (gx, gy) = (bn(GX)?, bn(GY)?);
    g.set_affine_coordinates_gfp(&group, &gx, &gy, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    group
        .set_generator(
            g,
            bn(N)?,
            BigNum::from_u32(8).map_err(|_| CryptoError::InvalidKey)?,
        )
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok((group, ctx))
}

fn decode(b64: &str) -> Result<Vec<u8>, CryptoError> {
    B64.decode(b64.trim()).map_err(|_| CryptoError::Encoding)
}

/// A peer public key: the raw point, or the point at the end of an X.509 SPKI.
fn peer_point(group: &EcGroup, b64: &str, ctx: &mut BigNumContext) -> Result<EcPoint, CryptoError> {
    let bytes = decode(b64)?;
    let point = bytes
        .len()
        .checked_sub(POINT_LEN)
        .map(|start| &bytes[start..])
        .filter(|p| p.first() == Some(&0x04))
        .ok_or(CryptoError::InvalidKey)?;
    EcPoint::from_bytes(group, point, ctx).map_err(|_| CryptoError::InvalidKey)
}

fn shared_secret(private_b64: &str, peer_public_b64: &str) -> Result<[u8; 32], CryptoError> {
    let (group, mut ctx) = curve()?;
    let d = BigNum::from_slice(&decode(private_b64)?).map_err(|_| CryptoError::InvalidKey)?;
    let q = peer_point(&group, peer_public_b64, &mut ctx)?;
    let mut s = EcPoint::new(&group).map_err(|_| CryptoError::InvalidKey)?;
    s.mul2(&group, &q, &d, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let mut x = BigNum::new().map_err(|_| CryptoError::InvalidKey)?;
    let mut y = BigNum::new().map_err(|_| CryptoError::InvalidKey)?;
    s.affine_coordinates_gfp(&group, &mut x, &mut y, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let padded = x.to_vec_padded(32).map_err(|_| CryptoError::InvalidKey)?;
    let mut out = [0_u8; 32];
    out.copy_from_slice(&padded);
    Ok(out)
}

fn cipher(
    private_b64: &str,
    own_nonce_b64: &str,
    peer_public_b64: &str,
    peer_nonce_b64: &str,
    own_is_sender: bool,
) -> Result<(Aes256Gcm, [u8; IV_LEN]), CryptoError> {
    let (own, peer) = (decode(own_nonce_b64)?, decode(peer_nonce_b64)?);
    if own.len() != NONCE_LEN || peer.len() != NONCE_LEN {
        return Err(CryptoError::InvalidKey);
    }
    // XOR is symmetric, so the order only matters for documentation.
    let (sender, requester) = if own_is_sender {
        (&own, &peer)
    } else {
        (&peer, &own)
    };
    let xor: Vec<u8> = sender.iter().zip(requester).map(|(a, b)| a ^ b).collect();
    let mut iv = [0_u8; IV_LEN];
    iv.copy_from_slice(&xor[NONCE_LEN - IV_LEN..]);
    let shared = shared_secret(private_b64, peer_public_b64)?;
    let mut key = [0_u8; 32];
    Hkdf::<Sha256>::new(Some(&xor[..SALT_LEN]), &shared)
        .expand(&[], &mut key)
        .map_err(|_| CryptoError::InvalidKey)?;
    let aes = Aes256Gcm::new_from_slice(&key).map_err(|_| CryptoError::InvalidKey)?;
    Ok((aes, iv))
}

/// Fresh key material for one transfer: a private scalar, its public point
/// and a 32-byte nonce.
///
/// # Errors
/// [`CryptoError::InvalidKey`] if the curve cannot be built.
pub fn generate() -> Result<KeyMaterial, CryptoError> {
    let (group, mut ctx) = curve()?;
    let order = bn(N)?;
    let mut d = BigNum::new().map_err(|_| CryptoError::InvalidKey)?;
    while d.num_bits() == 0 {
        order
            .rand_range(&mut d)
            .map_err(|_| CryptoError::InvalidKey)?;
    }
    let mut q = EcPoint::new(&group).map_err(|_| CryptoError::InvalidKey)?;
    q.mul_generator2(&group, &d, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let point = q
        .to_bytes(&group, PointConversionForm::UNCOMPRESSED, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let mut nonce = [0_u8; NONCE_LEN];
    rand::rng().fill_bytes(&mut nonce);
    Ok(KeyMaterial {
        private_key: B64.encode(d.to_vec()),
        public_key: B64.encode(point),
        nonce: B64.encode(nonce),
    })
}

/// Encrypt `plaintext` from the sender (HIP) to the requester (HIU).
///
/// # Errors
/// [`CryptoError::InvalidKey`] for unusable keys or nonces.
pub fn encrypt(
    plaintext: &str,
    sender: &KeyMaterial,
    requester_public_b64: &str,
    requester_nonce_b64: &str,
) -> Result<String, CryptoError> {
    let (aes, iv) = cipher(
        &sender.private_key,
        &sender.nonce,
        requester_public_b64,
        requester_nonce_b64,
        true,
    )?;
    let out = aes
        .encrypt(&Nonce::from(iv), plaintext.as_bytes())
        .map_err(|_| CryptoError::Encrypt)?;
    Ok(B64.encode(out))
}

/// Decrypt what a sender encrypted to `requester` (the HIU side).
///
/// # Errors
/// [`CryptoError::Decrypt`] when the tag does not verify.
pub fn decrypt(
    ciphertext_b64: &str,
    requester: &KeyMaterial,
    sender_public_b64: &str,
    sender_nonce_b64: &str,
) -> Result<String, CryptoError> {
    let (aes, iv) = cipher(
        &requester.private_key,
        &requester.nonce,
        sender_public_b64,
        sender_nonce_b64,
        false,
    )?;
    let out = aes
        .decrypt(&Nonce::from(iv), decode(ciphertext_b64)?.as_ref())
        .map_err(|_| CryptoError::Decrypt)?;
    String::from_utf8(out).map_err(|_| CryptoError::Decrypt)
}

/// The `checksum` ABDM asks for on each pushed entry: MD5 of the plaintext,
/// hex. An integrity tag for the HIU, not a security control (GCM is).
///
/// # Errors
/// [`CryptoError::Encoding`] if the digest cannot be computed.
pub fn checksum(plaintext: &str) -> Result<String, CryptoError> {
    openssl::hash::hash(openssl::hash::MessageDigest::md5(), plaintext.as_bytes())
        .map(|d| d.iter().map(|b| format!("{b:02x}")).collect())
        .map_err(|_| CryptoError::Encoding)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{KeyMaterial, checksum, decrypt, encrypt, generate};

    // The test vector published in mgrmtech/fidelius-cli's README.
    const SENDER_PRIVATE: &str = "AYhVZpbVeX4KS5Qm/W0+9Ye2q3rnVVGmqRICmseWni4=";
    const SENDER_PUBLIC: &str =
        "BABVt+mpRLMXiQpIfEq6bj8hlXsdtXIxLsspmMgLNI1SR5mHgDVbjHO2A+U4QlMddGzqyEidzm1AkhtSxSO2Ahg=";
    const SENDER_NONCE: &str = "lmXgblZwotx+DfBgKJF0lZXtAXgBEYr5khh79Zytr2Y=";
    const REQUESTER_PRIVATE: &str = "DMxHPri8d7IT23KgLk281zZenMfVHSdeamq0RhwlIBk=";
    const REQUESTER_PUBLIC: &str =
        "BAheD5rUqTy4V5xR4/6HWmYpopu5CO+KO8BECS0udNqUTSNo91TIqIIy1A4Vh+F94c+n9vAcwXU2bGcfsI5f69Y=";
    const REQUESTER_NONCE: &str = "6uj1RdDUbcpI3lVMZvijkMC8Te20O4Bcyz0SyivX8Eg=";
    const PLAINTEXT: &str = "Wormtail should never have been Potter cottage's secret keeper.";
    const CIPHERTEXT: &str = "pzMvVZNNVtJzqPkkxcCbBUWgDEBy/mBXIeT2dJWI16ZAQnnXUb9lI+S4k8XK6mgZSKKSRIHkcNvJpllnBg548wUgavBa0vCRRwdL6kY6Yw==";

    fn km(private_key: &str, public_key: &str, nonce: &str) -> KeyMaterial {
        KeyMaterial {
            private_key: private_key.into(),
            public_key: public_key.into(),
            nonce: nonce.into(),
        }
    }

    #[test]
    fn matches_the_published_fidelius_vector() {
        let sender = km(SENDER_PRIVATE, SENDER_PUBLIC, SENDER_NONCE);
        let out = encrypt(PLAINTEXT, &sender, REQUESTER_PUBLIC, REQUESTER_NONCE).unwrap();
        assert_eq!(out, CIPHERTEXT);
        let requester = km(REQUESTER_PRIVATE, REQUESTER_PUBLIC, REQUESTER_NONCE);
        let back = decrypt(CIPHERTEXT, &requester, SENDER_PUBLIC, SENDER_NONCE).unwrap();
        assert_eq!(back, PLAINTEXT);
    }

    #[test]
    fn generated_keys_round_trip_and_reject_a_wrong_nonce() {
        let (hip, hiu) = (generate().unwrap(), generate().unwrap());
        let sealed = encrypt(
            "{\"resourceType\":\"Bundle\"}",
            &hip,
            &hiu.public_key,
            &hiu.nonce,
        )
        .unwrap();
        let opened = decrypt(&sealed, &hiu, &hip.public_key, &hip.nonce).unwrap();
        assert_eq!(opened, "{\"resourceType\":\"Bundle\"}");
        assert!(decrypt(&sealed, &hiu, &hip.public_key, &hiu.nonce).is_err());
        assert!(!format!("{hip:?}").contains(&hip.private_key));
    }

    #[test]
    fn the_entry_checksum_is_md5_hex() {
        assert_eq!(checksum("abc").unwrap(), "900150983cd24fb0d6963f7d28e17f72");
    }
}

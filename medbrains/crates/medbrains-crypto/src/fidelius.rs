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
//!   peer key may also arrive as X.509 `SubjectPublicKeyInfo` (`id-ecPublicKey`
//!   with this curve's explicit parameters, or BouncyCastle's named-curve OID);
//!   see `fidelius_spki.rs`. Its curve must be this one.
//! - A peer point is refused at infinity, off the curve, or outside the
//!   prime-order subgroup (`n·Q ≠ O`; the cofactor is 8, so small-order points
//!   exist). Our private scalar must be `1 ≤ d < n`, at most 32 bytes, and is
//!   written padded to 32; [`check_pair`] proves a reopened `d` still derives
//!   its stored public point.
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
use openssl::ec::{EcGroup, EcGroupRef, EcPoint, EcPointRef, PointConversionForm};
use rand::Rng;
use sha2::Sha256;

use crate::CryptoError;

#[path = "fidelius_spki.rs"]
mod spki;

const P: &str = "7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFED";
const A: &str = "2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA984914A144";
const B: &str = "7B425ED097B425ED097B425ED097B425ED097B425ED097B4260B5E9C7710C864";
const GX: &str = "2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD245A";
const GY: &str = "20AE19A1B8A086B4E01EDD2C7748D14C923D4D7E6D7C61B229E9C5A27ECED3D9";
const N: &str = "1000000000000000000000000000000014DEF9DEA2F79CD65812631A5CF5D3ED";
const POINT_LEN: usize = 65;
/// Bytes of a coordinate or of the private scalar, big-endian.
const SCALAR_BYTES: usize = 32;
/// [`SCALAR_BYTES`] as `BigNum::to_vec_padded` takes it.
const SCALAR_LEN: i32 = 32;
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

/// A peer public key: the raw uncompressed point, or an SPKI on this curve.
/// Only points in the prime-order subgroup are returned.
fn peer_point(group: &EcGroup, b64: &str, ctx: &mut BigNumContext) -> Result<EcPoint, CryptoError> {
    let bytes = decode(b64)?;
    let raw = if bytes.len() == POINT_LEN {
        bytes
    } else {
        spki::spki_point(group, &bytes, ctx)?
    };
    let q = EcPoint::from_bytes(group, &raw, ctx).map_err(|_| CryptoError::InvalidKey)?;
    in_subgroup(group, &q, ctx)?;
    Ok(q)
}

/// Refuse the point at infinity, a point off the curve, and any point with
/// a small-order component: only `n·Q = O` (with `Q ≠ O`) is accepted.
fn in_subgroup(
    group: &EcGroupRef,
    q: &EcPointRef,
    ctx: &mut BigNumContext,
) -> Result<(), CryptoError> {
    if q.is_infinity(group)
        || !q
            .is_on_curve(group, ctx)
            .map_err(|_| CryptoError::InvalidKey)?
    {
        return Err(CryptoError::InvalidKey);
    }
    let mut nq = EcPoint::new(group).map_err(|_| CryptoError::InvalidKey)?;
    let order = bn(N)?;
    nq.mul2(group, q, &order, ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    if nq.is_infinity(group) {
        Ok(())
    } else {
        Err(CryptoError::InvalidKey)
    }
}

/// Our private scalar: at most 32 bytes and `1 ≤ d < n`.
fn private_scalar(b64: &str) -> Result<BigNum, CryptoError> {
    let raw = decode(b64)?;
    if raw.is_empty() || raw.len() > SCALAR_BYTES {
        return Err(CryptoError::InvalidKey);
    }
    let d = BigNum::from_slice(&raw).map_err(|_| CryptoError::InvalidKey)?;
    if d.num_bits() == 0 || d >= bn(N)? {
        return Err(CryptoError::InvalidKey);
    }
    Ok(d)
}

/// The uncompressed point `d·G`, base64.
fn public_of(group: &EcGroup, d: &BigNum, ctx: &mut BigNumContext) -> Result<String, CryptoError> {
    let mut q = EcPoint::new(group).map_err(|_| CryptoError::InvalidKey)?;
    q.mul_generator2(group, d, ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let point = q
        .to_bytes(group, PointConversionForm::UNCOMPRESSED, ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    Ok(B64.encode(point))
}

/// Prove reopened key material is whole: the private scalar is in range and
/// derives the stored public point. A key cut or padded in storage fails here
/// instead of producing ciphertext nobody can open.
///
/// # Errors
/// [`CryptoError::InvalidKey`] when either half is damaged or they differ.
pub fn check_pair(km: &KeyMaterial) -> Result<(), CryptoError> {
    let (group, mut ctx) = curve()?;
    let d = private_scalar(&km.private_key)?;
    let stored = decode(&km.public_key)?;
    if decode(&public_of(&group, &d, &mut ctx)?)? == stored {
        Ok(())
    } else {
        Err(CryptoError::InvalidKey)
    }
}

/// Check a peer's public key before any work is done for it.
///
/// # Errors
/// [`CryptoError::InvalidKey`] for anything but a subgroup point on this curve.
pub fn check_peer_key(b64: &str) -> Result<(), CryptoError> {
    let (group, mut ctx) = curve()?;
    peer_point(&group, b64, &mut ctx).map(|_| ())
}

/// The ECDH shared secret: affine X of `d·Q`, 32 bytes big-endian.
fn shared_secret(private_b64: &str, peer_public_b64: &str) -> Result<[u8; 32], CryptoError> {
    let (group, mut ctx) = curve()?;
    let d = private_scalar(private_b64)?;
    let q = peer_point(&group, peer_public_b64, &mut ctx)?;
    let mut shared = EcPoint::new(&group).map_err(|_| CryptoError::InvalidKey)?;
    shared
        .mul2(&group, &q, &d, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let mut affine_x = BigNum::new().map_err(|_| CryptoError::InvalidKey)?;
    let mut affine_y = BigNum::new().map_err(|_| CryptoError::InvalidKey)?;
    shared
        .affine_coordinates_gfp(&group, &mut affine_x, &mut affine_y, &mut ctx)
        .map_err(|_| CryptoError::InvalidKey)?;
    let padded = affine_x
        .to_vec_padded(SCALAR_LEN)
        .map_err(|_| CryptoError::InvalidKey)?;
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
    let public_key = public_of(&group, &d, &mut ctx)?;
    let mut nonce = [0_u8; NONCE_LEN];
    rand::rng().fill_bytes(&mut nonce);
    Ok(KeyMaterial {
        private_key: B64.encode(
            d.to_vec_padded(SCALAR_LEN)
                .map_err(|_| CryptoError::InvalidKey)?,
        ),
        public_key,
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
#[path = "fidelius_tests.rs"]
mod tests;

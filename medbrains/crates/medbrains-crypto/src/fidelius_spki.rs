//! A Fidelius peer key sent as X.509 `SubjectPublicKeyInfo`.
//!
//! Java HIPs and HIUs build keys with BouncyCastle, which writes the curve
//! either as explicit X9.62 parameters or as its own named-curve OID
//! (cryptlib `1.3.6.1.4.1.3029.1.5.1`, from `ECGenParameterSpec("curve25519")`).
//! OpenSSL knows no such name, so when OpenSSL cannot parse the key a strict
//! DER walk accepts exactly two shapes: `id-ecPublicKey` with that OID, or with
//! explicit parameters equal to ours. Anything else, including trailing bytes,
//! is refused. The point it yields still goes through the subgroup check.

use openssl::bn::{BigNum, BigNumContext};
use openssl::ec::{EcGroup, EcGroupRef, PointConversionForm};
use openssl::pkey::{Id, PKey};

use crate::CryptoError;

const SEQUENCE: u8 = 0x30;
const INTEGER: u8 = 0x02;
const BIT_STRING: u8 = 0x03;
const OCTET_STRING: u8 = 0x04;
const OID: u8 = 0x06;
/// `id-ecPublicKey`, 1.2.840.10045.2.1.
const ID_EC_PUBLIC_KEY: &[u8] = &[0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01];
/// `prime-field`, 1.2.840.10045.1.1.
const PRIME_FIELD: &[u8] = &[0x2a, 0x86, 0x48, 0xce, 0x3d, 0x01, 0x01];
/// BouncyCastle's (cryptlib) curve25519, 1.3.6.1.4.1.3029.1.5.1.
const CRYPTLIB_CURVE25519: &[u8] = &[0x2b, 0x06, 0x01, 0x04, 0x01, 0x97, 0x55, 0x01, 0x05, 0x01];
/// The Fidelius curve's cofactor.
const COFACTOR: &[u8] = &[0x08];

/// The uncompressed point inside an SPKI on this curve: OpenSSL first, then
/// the strict walk for the encodings OpenSSL cannot name.
pub(super) fn spki_point(
    group: &EcGroup,
    der: &[u8],
    ctx: &mut BigNumContext,
) -> Result<Vec<u8>, CryptoError> {
    openssl_point(group, der, ctx).or_else(|_| walked_point(group, der, ctx))
}

/// Parse with OpenSSL; the key's explicit curve must equal ours.
fn openssl_point(
    group: &EcGroup,
    der: &[u8],
    ctx: &mut BigNumContext,
) -> Result<Vec<u8>, CryptoError> {
    let key = PKey::public_key_from_der(der).map_err(|_| CryptoError::InvalidKey)?;
    if key.id() != Id::EC {
        return Err(CryptoError::InvalidKey);
    }
    let ec = key.ec_key().map_err(|_| CryptoError::InvalidKey)?;
    if curve_identity(group, ctx)? != curve_identity(ec.group(), ctx)? {
        return Err(CryptoError::InvalidKey);
    }
    ec.public_key()
        .to_bytes(ec.group(), PointConversionForm::UNCOMPRESSED, ctx)
        .map_err(|_| CryptoError::InvalidKey)
}

/// The field, coefficients, order (minimal big-endian) and uncompressed
/// generator of a curve.
fn curve_identity(
    group: &EcGroupRef,
    ctx: &mut BigNumContext,
) -> Result<Vec<Vec<u8>>, CryptoError> {
    let fail = |_| CryptoError::InvalidKey;
    let (mut field, mut coef_a, mut coef_b, mut order) = (
        BigNum::new().map_err(fail)?,
        BigNum::new().map_err(fail)?,
        BigNum::new().map_err(fail)?,
        BigNum::new().map_err(fail)?,
    );
    group
        .components_gfp(&mut field, &mut coef_a, &mut coef_b, ctx)
        .map_err(fail)?;
    group.order(&mut order, ctx).map_err(fail)?;
    let generator = group
        .generator_opt()
        .ok_or(CryptoError::InvalidKey)?
        .to_bytes(group, PointConversionForm::UNCOMPRESSED, ctx)
        .map_err(fail)?;
    Ok(vec![
        field.to_vec(),
        coef_a.to_vec(),
        coef_b.to_vec(),
        order.to_vec(),
        generator,
    ])
}

/// One DER element: `(tag, content, rest)`. Definite lengths of at most two
/// bytes, minimally encoded; anything else is refused.
fn element(input: &[u8]) -> Result<(u8, &[u8], &[u8]), CryptoError> {
    let (&tag, rest) = input.split_first().ok_or(CryptoError::InvalidKey)?;
    let (&first, rest) = rest.split_first().ok_or(CryptoError::InvalidKey)?;
    let (len, rest) = if first < 0x80 {
        (usize::from(first), rest)
    } else {
        let count = usize::from(first & 0x7f);
        if !(1..=2).contains(&count) {
            return Err(CryptoError::InvalidKey);
        }
        let (bytes, rest) = rest
            .split_at_checked(count)
            .ok_or(CryptoError::InvalidKey)?;
        let len = bytes
            .iter()
            .fold(0_usize, |acc, b| acc << 8 | usize::from(*b));
        if len < 0x80 || bytes.first() == Some(&0) {
            return Err(CryptoError::InvalidKey);
        }
        (len, rest)
    };
    let (content, rest) = rest.split_at_checked(len).ok_or(CryptoError::InvalidKey)?;
    Ok((tag, content, rest))
}

/// The content of the next element, which must carry `tag`, and what follows.
fn expect(input: &[u8], tag: u8) -> Result<(&[u8], &[u8]), CryptoError> {
    match element(input)? {
        (found, content, rest) if found == tag => Ok((content, rest)),
        _ => Err(CryptoError::InvalidKey),
    }
}

/// `bytes` without leading zeros, as `BigNum::to_vec` writes a number.
fn minimal(bytes: &[u8]) -> Vec<u8> {
    bytes.iter().copied().skip_while(|b| *b == 0).collect()
}

/// Walk the SPKI by hand: `id-ecPublicKey`, then the cryptlib OID or our
/// explicit parameters, then a 65-byte uncompressed point.
fn walked_point(
    group: &EcGroup,
    der: &[u8],
    ctx: &mut BigNumContext,
) -> Result<Vec<u8>, CryptoError> {
    let (spki, rest) = expect(der, SEQUENCE)?;
    let (algorithm, rest_spki) = expect(spki, SEQUENCE)?;
    let (bits, after_bits) = expect(rest_spki, BIT_STRING)?;
    let (oid, params) = expect(algorithm, OID)?;
    if !rest.is_empty() || !after_bits.is_empty() || oid != ID_EC_PUBLIC_KEY {
        return Err(CryptoError::InvalidKey);
    }
    match element(params)? {
        (OID, name, []) if name == CRYPTLIB_CURVE25519 => {}
        (SEQUENCE, explicit, []) => explicit_is_ours(group, explicit, ctx)?,
        _ => return Err(CryptoError::InvalidKey),
    }
    match bits.split_first() {
        Some((0, point)) if point.len() == super::POINT_LEN => Ok(point.to_vec()),
        _ => Err(CryptoError::InvalidKey),
    }
}

/// X9.62 `ECParameters` (version 1, prime field, a, b, optional seed, base,
/// order, optional cofactor), compared field by field with our curve.
fn explicit_is_ours(
    group: &EcGroup,
    params: &[u8],
    ctx: &mut BigNumContext,
) -> Result<(), CryptoError> {
    let (version, rest) = expect(params, INTEGER)?;
    let (field_id, rest) = expect(rest, SEQUENCE)?;
    let (curve, rest) = expect(rest, SEQUENCE)?;
    let (base, rest) = expect(rest, OCTET_STRING)?;
    let (order, rest) = expect(rest, INTEGER)?;
    let cofactor_ok = match element(rest) {
        Err(_) if rest.is_empty() => true,
        Ok((INTEGER, cofactor, [])) => cofactor == COFACTOR,
        _ => false,
    };
    let (field_type, prime) = expect(field_id, OID)?;
    let (prime, after_prime) = expect(prime, INTEGER)?;
    let (coef_a, rest_curve) = expect(curve, OCTET_STRING)?;
    let (coef_b, seed) = expect(rest_curve, OCTET_STRING)?;
    let seed_ok = seed.is_empty() || matches!(element(seed), Ok((BIT_STRING, _, [])));
    let parsed = vec![
        minimal(prime),
        minimal(coef_a),
        minimal(coef_b),
        minimal(order),
        base.to_vec(),
    ];
    let ours = curve_identity(group, ctx)?;
    if version == [1]
        && field_type == PRIME_FIELD
        && after_prime.is_empty()
        && seed_ok
        && cofactor_ok
        && parsed == ours
    {
        Ok(())
    } else {
        Err(CryptoError::InvalidKey)
    }
}

//! Patient route helpers — Aadhaar masking, hash storage, and display logic.
//!
//! Patient Aadhaar numbers are never stored or returned in raw form.
//! Only masked and SHA-256 hashed representations are retained.

use sha2::{Digest, Sha256};

/// Compute the SHA-256 hex digest of a raw Aadhaar number.
///
/// The raw value is discarded after hashing; only the hex digest is stored
/// in `patients.aadhaar_hash`.
pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// Return a masked display form of an Aadhaar number.
///
/// only masked/hash storage is retained in the database. This helper exists
/// purely for display purposes (e.g., last-4 hint to authorized roles).
pub fn masked_aadhaar(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 4 {
        return "XXXX-XXXX-XXXX".to_string();
    }
    let last4 = &digits[digits.len() - 4..];
    format!("XXXX-XXXX-{last4}")
}

/// Patient record as stored — contains only hashed/masked Aadhaar, never raw.
#[derive(Debug, Clone)]
pub struct PatientRecord {
    pub id: uuid::Uuid,
    pub name: String,
    /// SHA-256 hash of the Aadhaar number; raw value is never persisted.
    pub aadhaar_hash: String,
    /// Masked display form (e.g., XXXX-XXXX-1234); derived, not authoritative.
    pub aadhaar_masked: String,
}

impl PatientRecord {
    /// Create a new record, hashing and masking the Aadhaar in one step.
    pub fn new(id: uuid::Uuid, name: String, raw_aadhaar: &str) -> Self {
        Self {
            id,
            name,
            aadhaar_hash: sha256_hex(raw_aadhaar),
            aadhaar_masked: masked_aadhaar(raw_aadhaar),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_hex_produces_deterministic_digest() {
        let a = sha256_hex("123456789012");
        let b = sha256_hex("123456789012");
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn masked_aadhaar_shows_only_last_four() {
        let result = masked_aadhaar("234567890123");
        assert_eq!(result, "XXXX-XXXX-0123");
    }

    #[test]
    fn patient_record_never_stores_raw_aadhaar() {
        let record = PatientRecord::new(uuid::Uuid::new_v4(), "Test".into(), "123456789012");
        assert_ne!(record.aadhaar_hash, "123456789012");
        assert!(record.aadhaar_masked.starts_with("XXXX"));
    }
}

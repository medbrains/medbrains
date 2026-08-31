//! Field-level access control for sensitive data (PHI, financial, credentials).
//!
//! Controls which fields a role/user can see, mask, or hide entirely.
//! Enforced at the middleware layer before JSON serialization.

use serde::{Deserialize, Serialize};

/// Access level for a specific field, determined by the caller's role and
/// the field's DataClass classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FieldAccessLevel {
    /// Field is fully visible (FieldAccessLevel::View).
    View,
    /// Field is masked (e.g., Aadhaar → XXXX-XXXX-1234).
    Mask,
    /// Field is entirely hidden (omitted from the response).
    Hidden,
}

/// Resolve which fields a given role should restrict for a specific entity type.
pub fn resolve_restricted_fields(role: &str, entity_type: &str) -> Vec<(&'static str, FieldAccessLevel)> {
    match (role, entity_type) {
        ("receptionist", "patients") => vec![
            ("aadhaar_hash", FieldAccessLevel::Hidden),
            ("abha_number", FieldAccessLevel::Mask),
            ("insurance_policy_number", FieldAccessLevel::Hidden),
        ],
        ("nurse", "patients") => vec![
            ("aadhaar_hash", FieldAccessLevel::Hidden),
        ],
        ("lab_technician", "patients") => vec![
            ("aadhaar_hash", FieldAccessLevel::Hidden),
            ("insurance_policy_number", FieldAccessLevel::Hidden),
        ],
        _ => vec![],
    }
}

/// Validate that a write attempt is allowed for the given field and access level.
pub fn validate_write_access(
    role: &str,
    field_name: &str,
    access_level: FieldAccessLevel,
) -> Result<(), FieldAccessError> {
    if access_level == FieldAccessLevel::Hidden && role != "super_admin" {
        return Err(FieldAccessError::CannotWriteToRestrictedField {
            field: field_name.to_string(),
            level: access_level,
        });
    }
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum FieldAccessError {
    #[error("Cannot write to restricted fields: '{field}' (level={level:?})")]
    CannotWriteToRestrictedField {
        field: String,
        level: FieldAccessLevel,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn receptionist_cannot_see_aadhaar() {
        let fields = resolve_restricted_fields("receptionist", "patients");
        let aadhaar = fields.iter().find(|(name, _)| *name == "aadhaar_hash");
        assert!(matches!(aadhaar, Some((_, FieldAccessLevel::Hidden))));
    }

    #[test]
    fn validate_write_rejects_hidden_field() {
        let result = validate_write_access("nurse", "aadhaar_hash", FieldAccessLevel::Hidden);
        assert!(result.is_err());
    }
}

//! Field-level access enforcement for write operations.
//!
//! When a user's `field_access` map marks a field as `"view"` or `"hidden"`,
//! the server must reject writes that include those fields. This module
//! provides helpers for route handlers to validate incoming payloads
//! against the user's resolved field access levels.

use std::collections::HashMap;

use medbrains_core::form::FieldAccessLevel;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Field-level access was tied to the form builder. With static React forms,
/// there are no per-field access overrides — every authorized user can edit
/// every field on their static form. Stubbed to always return an empty map.
pub async fn resolve_restricted_fields(
    _db: &PgPool,
    _tenant_id: Uuid,
    _user_id: Uuid,
    _role: &str,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    Ok(HashMap::new())
}

/// Validate that a JSON body does not contain restricted fields.
///
/// `module_prefix` is prepended to each key in the body to match against
/// the `field_access` map (e.g., `"patients"` checks `"patients.first_name"`).
/// Returns `Ok(())` if valid, or `Err(AppError::BadRequest)` with details
/// if restricted fields are present.
#[allow(clippy::implicit_hasher)]
pub fn validate_write_access(
    body: &serde_json::Value,
    restricted: &HashMap<String, FieldAccessLevel>,
    module_prefix: &str,
) -> Result<(), AppError> {
    if restricted.is_empty() {
        return Ok(());
    }

    let Some(obj) = body.as_object() else {
        return Ok(());
    };

    let mut violations = Vec::new();

    for key in obj.keys() {
        let field_code = format!("{module_prefix}.{key}");
        if let Some(level) = restricted.get(&field_code) {
            let level_str = match level {
                FieldAccessLevel::View => "read-only",
                FieldAccessLevel::Hidden => "hidden",
                FieldAccessLevel::Edit => continue,
            };
            violations.push(format!("{key} ({level_str})"));
        }
    }

    if violations.is_empty() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "Cannot write to restricted fields: {}",
        violations.join(", ")
    )))
}

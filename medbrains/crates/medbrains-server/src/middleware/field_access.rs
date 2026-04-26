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
use crate::middleware::authorization::BYPASS_ROLES;

/// Resolve field access levels and return a map of restricted fields
/// (fields that are NOT editable). Returns an empty map for bypass roles.
pub async fn resolve_restricted_fields(
    db: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    if BYPASS_ROLES.contains(&role) {
        return Ok(HashMap::new());
    }

    let full_map = crate::routes::forms::resolve_field_access(db, tenant_id, user_id, role).await?;

    // Only keep fields that are NOT editable
    Ok(full_map
        .into_iter()
        .filter(|(_, level)| *level != FieldAccessLevel::Edit)
        .collect())
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

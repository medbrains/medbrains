//! Field-level access enforcement for write operations.
//!
//! When a user's `field_access` map marks a field as `"view"`, `"mask"`, or
//! `"hidden"`, the server must reject writes that include those fields. This module
//! provides helpers for route handlers to validate incoming payloads
//! against the user's resolved field access levels.

use std::collections::HashMap;

use medbrains_core::form::FieldAccessLevel;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Resolve field-level restrictions from role defaults plus user overrides.
///
/// The returned map contains only non-edit restrictions. A user-level
/// `"edit"` entry removes a role-level restriction for that field.
pub async fn resolve_restricted_fields(
    db: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    if role == "super_admin" || role == "hospital_admin" {
        return Ok(HashMap::new());
    }

    let role_field_access = sqlx::query_scalar!(
        "SELECT field_access_defaults FROM roles \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true",
        tenant_id,
        role
    )
    .fetch_optional(db)
    .await?;

    let user_access_matrix = sqlx::query_scalar!(
        "SELECT access_matrix FROM users WHERE id = $1 AND tenant_id = $2",
        user_id,
        tenant_id
    )
    .fetch_optional(db)
    .await?;

    let mut restricted = HashMap::new();
    if let Some(value) = role_field_access {
        merge_field_access_map(&mut restricted, &value)?;
    }

    if let Some(Value::Object(matrix)) = user_access_matrix {
        if let Some(value) = matrix.get("field_access") {
            merge_field_access_map(&mut restricted, value)?;
        }
    }

    Ok(restricted)
}

/// Validate that a JSON body does not contain restricted fields.
///
/// `module_prefix` is prepended to each key in the body to match against
/// the `field_access` map (e.g., `"patients"` checks `"patients.first_name"`).
/// Returns `Ok(())` if valid, or `Err(AppError::BadRequest)` with details
/// if restricted fields are present.
#[allow(clippy::implicit_hasher)]
pub fn validate_write_access(
    body: &Value,
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
                FieldAccessLevel::Mask => "masked",
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

fn merge_field_access_map(
    restricted: &mut HashMap<String, FieldAccessLevel>,
    value: &Value,
) -> Result<(), AppError> {
    let Value::Object(map) = value else {
        return Ok(());
    };

    for (field_code, raw_level) in map {
        let Some(level) = raw_level.as_str() else {
            return Err(AppError::Internal(format!(
                "Invalid field access level for {field_code}: expected string"
            )));
        };
        match parse_field_access_level(level, field_code)? {
            FieldAccessLevel::Edit => {
                restricted.remove(field_code);
            }
            parsed @ (FieldAccessLevel::View
            | FieldAccessLevel::Mask
            | FieldAccessLevel::Hidden) => {
                restricted.insert(field_code.clone(), parsed);
            }
        }
    }

    Ok(())
}

fn parse_field_access_level(level: &str, field_code: &str) -> Result<FieldAccessLevel, AppError> {
    match level {
        "edit" => Ok(FieldAccessLevel::Edit),
        "view" => Ok(FieldAccessLevel::View),
        "mask" => Ok(FieldAccessLevel::Mask),
        "hidden" => Ok(FieldAccessLevel::Hidden),
        other => Err(AppError::Internal(format!(
            "Invalid field access level for {field_code}: {other}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_edit_override_removes_role_restriction() {
        let mut restricted = HashMap::new();
        let role_result = merge_field_access_map(
            &mut restricted,
            &serde_json::json!({ "patients.aadhaar_number": "hidden" }),
        );
        let user_result = merge_field_access_map(
            &mut restricted,
            &serde_json::json!({ "patients.aadhaar_number": "edit" }),
        );

        assert!(role_result.is_ok());
        assert!(user_result.is_ok());
        assert!(!restricted.contains_key("patients.aadhaar_number"));
    }

    #[test]
    fn invalid_field_access_value_is_rejected() {
        let mut restricted = HashMap::new();
        let result = merge_field_access_map(
            &mut restricted,
            &serde_json::json!({ "patients.aadhaar_number": "owner" }),
        );

        assert!(result.is_err());
    }

    #[test]
    fn mask_level_is_a_restriction() {
        let mut restricted = HashMap::new();
        let result = merge_field_access_map(
            &mut restricted,
            &serde_json::json!({ "patients.phone": "mask" }),
        );

        assert!(result.is_ok());
        assert_eq!(
            restricted.get("patients.phone"),
            Some(&FieldAccessLevel::Mask)
        );
    }
}

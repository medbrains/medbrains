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
    let mut conn = medbrains_db::pool::tenant_conn(db, &tenant_id).await?;
    if role == "super_admin" || role == "hospital_admin" {
        return Ok(HashMap::new());
    }

    let role_field_access = sqlx::query_scalar!(
        "SELECT field_access_defaults FROM roles \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true",
        tenant_id,
        role
    )
    .fetch_optional(&mut *conn)
    .await?;

    let user_access_matrix = sqlx::query_scalar!(
        "SELECT access_matrix FROM users WHERE id = $1 AND tenant_id = $2",
        user_id,
        tenant_id
    )
    .fetch_optional(&mut *conn)
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

/// Narrow a configured level to what the field's declared class permits.
///
/// Only ever stricter. A role may withhold more than the class requires — a
/// hospital can decide its receptionists do not see diagnoses — but it may not
/// mask something the class says must be withheld entirely.
fn narrow_to_class(field_code: &str, configured: FieldAccessLevel) -> FieldAccessLevel {
    use medbrains_authz::classification::DataClass;

    let class_floor = match medbrains_authz::field_class::class_of(field_code) {
        // Ordinary data imposes no floor at all — the role decides entirely.
        // Giving `Routine` a floor would mean an *unclassified* field is
        // silently hidden more than anyone asked for, and forgetting to
        // classify would quietly remove data from screens.
        DataClass::Routine => FieldAccessLevel::Edit,
        // Masking suits identifiers: a partial date of birth is useful, and
        // nobody is surprised the field exists.
        DataClass::Identifying => FieldAccessLevel::Mask,
        // For everything else the value must not reach the client at all.
        DataClass::Sensitive
        | DataClass::Restricted
        | DataClass::Confidential
        | DataClass::Sealed => FieldAccessLevel::Hidden,
    };

    // Stricter of the two. `Hidden` beats `Mask` beats `View`.
    let rank = |level: FieldAccessLevel| match level {
        FieldAccessLevel::Edit => 0,
        FieldAccessLevel::View => 1,
        FieldAccessLevel::Mask => 2,
        FieldAccessLevel::Hidden => 3,
    };
    if rank(class_floor) > rank(configured) {
        class_floor
    } else {
        configured
    }
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
                // The configuration decides *whether* a field is restricted
                // for this role. The declared class decides *how* — which is
                // why the configured level is narrowed here rather than
                // trusted.
                //
                // Without this, the same HIV result is masked in one panel and
                // hidden in another, because two administrators answered the
                // same question differently. Masking a clinical value is the
                // worse of the two: "Diagnosis: ****" still says a diagnosis
                // exists, and for a restricted result the existence is usually
                // the disclosure.
                restricted.insert(field_code.clone(), narrow_to_class(field_code, parsed));
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

#[cfg(test)]
mod class_narrowing_tests {
    use super::narrow_to_class;
    use medbrains_core::form::FieldAccessLevel;

    /// The rule from §0.6: configuration says *whether*, the class says *how*.
    /// An administrator who ticks "mask" on a clinical value gets it withheld
    /// instead, because a partially revealed diagnosis is worse than none.
    #[test]
    fn masking_a_clinical_value_is_upgraded_to_withholding() {
        assert_eq!(
            narrow_to_class("opd.diagnosis", FieldAccessLevel::Mask),
            FieldAccessLevel::Hidden,
        );
        assert_eq!(
            narrow_to_class("emergency.mlc.pocso_report", FieldAccessLevel::Mask),
            FieldAccessLevel::Hidden,
        );
    }

    /// A government identifier cannot be masked — the visible half is enough
    /// to correlate against another source.
    #[test]
    fn government_identifiers_cannot_be_masked() {
        assert_eq!(
            narrow_to_class("patients.identifiers.id_number", FieldAccessLevel::Mask),
            FieldAccessLevel::Hidden,
        );
    }

    /// Identifiers keep the presentation that is actually useful at a desk.
    #[test]
    fn identifiers_may_still_be_masked() {
        assert_eq!(
            narrow_to_class("patients.date_of_birth", FieldAccessLevel::Mask),
            FieldAccessLevel::Mask,
        );
    }

    /// Narrowing is one-way. A role that chose to hide a field does not get it
    /// re-opened because the class would have allowed masking.
    #[test]
    fn narrowing_never_loosens_what_a_role_chose() {
        assert_eq!(
            narrow_to_class("patients.date_of_birth", FieldAccessLevel::Hidden),
            FieldAccessLevel::Hidden,
        );
        assert_eq!(
            narrow_to_class("billing.amount", FieldAccessLevel::Hidden),
            FieldAccessLevel::Hidden,
        );
    }

    /// An unclassified field is not silently withheld — it keeps whatever the
    /// role configured, so forgetting to classify never hides data.
    #[test]
    fn an_unclassified_field_keeps_its_configured_level() {
        assert_eq!(
            narrow_to_class("not.a.declared.field", FieldAccessLevel::View),
            FieldAccessLevel::View,
        );
    }
}

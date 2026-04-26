use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims};

/// Roles that bypass all permission checks.
pub const BYPASS_ROLES: &[&str] = &["super_admin", "hospital_admin"];

/// Returns `true` if the user's role bypasses all permission/scope checks.
pub fn is_bypass_role(claims: &Claims) -> bool {
    BYPASS_ROLES.contains(&claims.role.as_str())
}

/// Require the user to have a specific permission.
/// `super_admin` and `hospital_admin` bypass all checks.
pub fn require_permission(claims: &Claims, perm: &str) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    if claims.permissions.iter().any(|p| p == perm) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

/// Require the user to have at least one of the specified permissions.
/// `super_admin` and `hospital_admin` bypass all checks.
pub fn require_any_permission(claims: &Claims, perms: &[&str]) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    if perms
        .iter()
        .any(|perm| claims.permissions.iter().any(|p| p == perm))
    {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

/// Require the user to have access to a specific department.
/// Bypass roles always have access. Other roles must have the department
/// in their `department_ids` list.
pub fn require_department_access(claims: &Claims, department_id: &Uuid) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    if claims.department_ids.is_empty() || claims.department_ids.contains(department_id) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

/// Build a SQL `WHERE` clause fragment for department scoping.
/// Returns `None` for bypass roles (no filtering needed).
/// Returns `Some(department_ids)` for scoped users.
pub fn scoped_department_ids(claims: &Claims) -> Option<&[Uuid]> {
    if is_bypass_role(claims) || claims.department_ids.is_empty() {
        return None;
    }
    Some(&claims.department_ids)
}

/// Check ownership: verify a record belongs to the requesting user.
///
/// Bypass roles always pass. For other roles, `created_by` must
/// match the user's ID, or `assigned_id` (e.g. `doctor_id`) must match.
pub fn require_ownership(
    claims: &Claims,
    created_by: Option<Uuid>,
    assigned_id: Option<Uuid>,
) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    if created_by == Some(claims.sub) || assigned_id == Some(claims.sub) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

/// Check if user owns a resource (non-error version).
///
/// Returns `true` for bypass roles, or if `created_by` / `assigned_id`
/// matches the user's ID. Useful for conditional filtering.
pub fn is_owner_or_assigned(
    claims: &Claims,
    created_by: Option<Uuid>,
    assigned_id: Option<Uuid>,
) -> bool {
    if is_bypass_role(claims) {
        return true;
    }
    created_by == Some(claims.sub) || assigned_id == Some(claims.sub)
}

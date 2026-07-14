//! Module-entitlement enforcement — makes the deployment edition (`hospital_type`) a REAL boundary
//! rather than a cosmetic one.
//!
//! Each tenant's edition seeds a `module_config` row per module with a `status`
//! (`available` / `enabled` / `disabled`); the onboarding wizard and the admin Modules screen let an
//! operator toggle it. Until now the edition only drove which modules the **frontend** shows in the
//! nav — the API for a disabled module still answered if called directly. That makes tiered editions
//! unenforceable: a "Small Clinic" deployment could still reach the eye-hospital, OT or research
//! endpoints. This guard closes that: a module route calls `require_module_enabled` and a request to
//! a module the tenant has switched off is refused.
//!
//! This is a **per-tenant licensing** gate, not a per-user permission — so bypass roles
//! (`super_admin` / `hospital_admin`) do NOT bypass it. A small-clinic admin still did not license
//! the specialty module. It composes on top of `require_permission` (which handles user authority)
//! and RLS (which handles tenancy).

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Pure decision: given the stored module status (if any), is the module DISABLED for this tenant?
/// Only an explicit `disabled` status blocks. An absent row or any other status (`enabled` /
/// `available`) is allowed — this matches the auth `disabled_modules` contract, where an absent code
/// means the module is on by default.
fn module_is_disabled(status: Option<&str>) -> bool {
    matches!(status, Some("disabled"))
}

/// Require the tenant to have module `code` enabled in its edition. Returns `403 Forbidden` when the
/// module is explicitly `disabled` in `module_config`.
///
/// Fails **open** (allows) on a database error or an absent row, so a transient issue never takes a
/// live module offline — only an explicit `disabled` status refuses the request. Call it after
/// `require_permission` in a module's route handlers.
pub async fn require_module_enabled(
    db: &PgPool,
    tenant_id: Uuid,
    code: &str,
) -> Result<(), AppError> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status::text FROM module_config WHERE tenant_id = $1 AND code = $2")
            .bind(tenant_id)
            .bind(code)
            .fetch_optional(db)
            .await
            .unwrap_or(None);
    if module_is_disabled(status.as_deref()) {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::module_is_disabled;

    #[test]
    fn explicit_disabled_blocks() {
        assert!(module_is_disabled(Some("disabled")));
    }

    #[test]
    fn enabled_is_allowed() {
        assert!(!module_is_disabled(Some("enabled")));
    }

    #[test]
    fn available_is_allowed() {
        assert!(!module_is_disabled(Some("available")));
    }

    #[test]
    fn absent_row_is_allowed_default_on() {
        assert!(!module_is_disabled(None));
    }
}

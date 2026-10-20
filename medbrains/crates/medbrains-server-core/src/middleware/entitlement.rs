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
//!
//! Three outcomes, not two (#4891). A database fault is `Unknown` and answers 503 — it never
//! grants a module (the old fail-open) and never refuses one as if unlicensed. Edition modules
//! treat an absent row as on; licensed add-ons (`medbrains_core::onboarding::ADD_ON_MODULES`)
//! need an explicit `enabled`.

use medbrains_authz::decision::Outcome;
use medbrains_core::onboarding::is_add_on_module;
use medbrains_db::pool::DbError;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Pure decision from the stored module status (if any).
///
/// `disabled` always refuses and `enabled` always allows. Anything else — no row, `available`,
/// `coming_soon` — allows an edition module (the auth `disabled_modules` contract: absent = on)
/// and refuses a licensed add-on, which nobody has bought until an operator enables it.
fn module_outcome(code: &str, status: Option<&str>) -> Outcome {
    match status {
        Some("disabled") => Outcome::Deny,
        Some("enabled") => Outcome::Allow,
        _ if is_add_on_module(code) => Outcome::Deny,
        _ => Outcome::Allow,
    }
}

async fn read_status(db: &PgPool, tenant_id: Uuid, code: &str) -> Result<Option<String>, DbError> {
    let mut conn = medbrains_db::pool::tenant_conn(db, &tenant_id).await?;
    let status = sqlx::query_scalar(
        "SELECT status::text FROM module_config \
         WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(&mut *conn)
    .await?;
    Ok(status)
}

/// Whether the tenant has module `code`. A database fault is `Unknown` — never on, never off.
pub async fn module_entitlement(db: &PgPool, tenant_id: Uuid, code: &str) -> Outcome {
    match read_status(db, tenant_id, code).await {
        Ok(status) => module_outcome(code, status.as_deref()),
        Err(err) => {
            tracing::error!(target: "authz", error = %err, module = code,
                "module entitlement unreadable — refusing as 503, not as unlicensed");
            Outcome::Unknown
        }
    }
}

/// Require the tenant to have module `code`. `403` when it is disabled (or an add-on not
/// enabled), `503` when the licence could not be read. Call it after `require_permission`.
pub async fn require_module_enabled(
    db: &PgPool,
    tenant_id: Uuid,
    code: &str,
) -> Result<(), AppError> {
    match module_entitlement(db, tenant_id, code).await {
        Outcome::Allow => Ok(()),
        Outcome::Deny => Err(AppError::Forbidden),
        Outcome::Unknown => Err(AppError::ServiceUnavailable(format!(
            "could not check whether the {code} module is licensed — try again shortly"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use medbrains_authz::decision::Outcome;

    use super::module_outcome;

    #[test]
    fn explicit_disabled_blocks_core_and_add_on() {
        assert_eq!(module_outcome("ot", Some("disabled")), Outcome::Deny);
        assert_eq!(module_outcome("companion", Some("disabled")), Outcome::Deny);
    }

    #[test]
    fn explicit_enabled_allows_core_and_add_on() {
        assert_eq!(module_outcome("ot", Some("enabled")), Outcome::Allow);
        assert_eq!(module_outcome("companion", Some("enabled")), Outcome::Allow);
    }

    #[test]
    fn core_module_absent_or_available_is_on() {
        assert_eq!(module_outcome("ot", None), Outcome::Allow);
        assert_eq!(module_outcome("ot", Some("available")), Outcome::Allow);
    }

    #[test]
    fn add_on_absent_available_or_coming_soon_is_refused() {
        assert_eq!(module_outcome("companion", None), Outcome::Deny);
        assert_eq!(
            module_outcome("companion", Some("available")),
            Outcome::Deny
        );
        assert_eq!(
            module_outcome("companion", Some("coming_soon")),
            Outcome::Deny
        );
    }
}

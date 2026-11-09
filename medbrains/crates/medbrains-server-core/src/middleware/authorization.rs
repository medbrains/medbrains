use medbrains_authz::decision::Outcome;
use medbrains_core::permissions;
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims};

// Decided in the kernel. Re-exported because this module is the one handlers use
// for every other scope check (department, ownership, board) and these return no
// HTTP type, so there is nothing for a caller to gain by importing them elsewhere.
pub use medbrains_kernel::authz::{BYPASS_ROLES, authz_context, is_bypass_role, outcome_of};

/// What a caller who is not an administrator is told when they would give, take away or change
/// an administrator's account.
const ADMIN_ACCOUNT_ONLY: &str =
    "Only an administrator can give, remove or change an administrator account.";

/// Refuses a caller without a bypass role who would give any of `roles` when one is a bypass role.
///
/// `admin.users.create` or `.update` is held by delegated user managers; it must not let them
/// make anyone, themselves included, a `hospital_admin` or `super_admin`.
///
/// # Errors
/// `AppError::ForbiddenReason` with a plain message.
pub fn require_admin_to_give_role<'a>(
    claims: &Claims,
    roles: impl IntoIterator<Item = &'a str>,
) -> Result<(), AppError> {
    if is_bypass_role(claims) || !roles.into_iter().any(|r| BYPASS_ROLES.contains(&r.trim())) {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(ADMIN_ACCOUNT_ONLY.to_owned()))
}

/// Refuses a caller without a bypass role who would change an account that holds one.
///
/// Its role, access, active flag, password and removal all count: a delegated user manager
/// must not be able to lock out or take over an administrator. An account that does not
/// exist passes, so the caller's own not-found answer stands. The row is locked for the
/// caller's transaction, so a concurrent promotion cannot slip between this check and the write.
///
/// # Errors
/// `AppError::ForbiddenReason` with a plain message, or the database error.
pub async fn require_admin_to_change_account(
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    user_id: Uuid,
) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role::text FROM users WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(user_id)
    .bind(claims.tenant_id)
    .fetch_optional(conn)
    .await?;
    require_admin_to_give_role(claims, role.as_deref())
}

/// Require the user to have a specific permission.
/// `super_admin` and `hospital_admin` bypass all checks.
pub fn require_permission(claims: &Claims, perm: &str) -> Result<(), AppError> {
    Ok(medbrains_kernel::authz::require_permission(claims, perm)?)
}

/// Require the user to have at least one of the specified permissions.
/// `super_admin` and `hospital_admin` bypass all checks.
pub fn require_any_permission(claims: &Claims, perms: &[&str]) -> Result<(), AppError> {
    Ok(medbrains_kernel::authz::require_any_permission(
        claims, perms,
    )?)
}

/// Whether these claims may read a wall board's live contents.
///
/// Two ways in, and they are not the same identity. An operator holds
/// `admin.tv_displays.board` and may read a board from anywhere, because
/// looking at a ward's waiting count from a desk is part of running the place.
/// A wall display holds `display.board.read` and may read one **only while it
/// is a paired device** — the role exists for screens bolted to corridors, and
/// a credential lifted off one should not become a way to read every board in
/// the hospital from a laptop.
///
/// Shared rather than per-crate because the boards are: the TV queue endpoints
/// live in `medbrains-tv`, the unified token board in `medbrains-tokens`, and a
/// display that could read one but not the other is a display showing half a
/// hospital.
///
/// # Errors
///
/// `AppError::Forbidden` when neither route applies.
pub fn require_board_read(claims: &Claims) -> Result<(), AppError> {
    if require_permission(claims, permissions::admin::tv_displays::BOARD).is_ok() {
        return Ok(());
    }
    let holds_display_code = require_permission(claims, permissions::display::board::READ).is_ok();
    if holds_display_code && claims.paired_device_id.is_some() {
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
    if claims.department_ids.contains(department_id) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

/// Build a SQL `WHERE` clause fragment for department scoping.
/// Returns `None` for bypass roles (no filtering needed).
/// Returns `Some(department_ids)` for scoped users.
pub fn scoped_department_ids(claims: &Claims) -> Option<&[Uuid]> {
    if is_bypass_role(claims) {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn claims(role: &str, department_ids: Vec<Uuid>) -> Claims {
        Claims {
            sub: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: role.to_owned(),
            permissions: Vec::new(),
            department_ids,
            perm_version: 1,
            paired_device_id: None,
            act: None,
            exp: 4_102_444_800,
        }
    }

    #[test]
    fn department_access_requires_explicit_department_for_non_bypass_roles() {
        let dept = Uuid::new_v4();
        let claims = claims("doctor", Vec::new());

        assert!(require_department_access(&claims, &dept).is_err());
    }

    #[test]
    fn department_access_allows_matching_department() {
        let dept = Uuid::new_v4();
        let claims = claims("doctor", vec![dept]);

        assert!(require_department_access(&claims, &dept).is_ok());
    }

    #[test]
    fn department_access_bypass_roles_remain_unscoped() {
        let dept = Uuid::new_v4();
        let claims = claims("hospital_admin", Vec::new());

        assert!(require_department_access(&claims, &dept).is_ok());
        assert!(scoped_department_ids(&claims).is_none());
    }

    #[test]
    fn scoped_department_ids_returns_empty_slice_for_unassigned_non_bypass_user() {
        let claims = claims("nurse", Vec::new());

        assert_eq!(scoped_department_ids(&claims), Some(&[] as &[Uuid]));
    }
}

/// Collapse at the boundary, and only at the boundary: `Deny` answers 404 so as
/// not to confirm a record exists, `Unknown` answers 503 so an outage never reads
/// as "there is no such patient". The decision is `medbrains_kernel::authz::collapse`.
pub fn collapse(outcome: Outcome) -> Result<(), AppError> {
    Ok(medbrains_kernel::authz::collapse(outcome)?)
}

#[cfg(test)]
mod outcome_tests {
    use super::{collapse, outcome_of};
    use crate::error::AppError;
    use medbrains_authz::decision::{Outcome, any};

    fn outage() -> Result<bool, medbrains_authz::AuthzError> {
        Err(medbrains_authz::AuthzError::Other(
            "spicedb unreachable".to_owned(),
        ))
    }

    /// The bug this whole change exists to remove: an outage arriving as
    /// `false`, and from there as "no such record".
    #[test]
    fn an_outage_is_not_a_denial() {
        assert_eq!(outcome_of(Ok(false), "patient"), Outcome::Deny);
        assert_eq!(outcome_of(outage(), "patient"), Outcome::Unknown);
        assert_ne!(
            outcome_of(outage(), "patient"),
            outcome_of(Ok(false), "patient"),
        );
    }

    /// A clinician told "no such encounter" during an outage will conclude the
    /// record is missing and act on that. 503 is retryable and alertable; 404
    /// is a clinical statement the system is not entitled to make.
    #[test]
    fn an_outage_answers_503_and_a_refusal_answers_404() {
        assert!(matches!(
            collapse(Outcome::Unknown),
            Err(AppError::ServiceUnavailable(_))
        ));
        assert!(matches!(collapse(Outcome::Deny), Err(AppError::NotFound)));
        assert!(collapse(Outcome::Allow).is_ok());
    }

    /// A refusal that arrives as an `Err` is still a refusal. Mapping every
    /// error to `Unknown` would turn an ordinary "no" into a 503 and page
    /// somebody at 3am for a permission working exactly as designed.
    #[test]
    fn a_refusal_delivered_as_an_error_is_still_a_denial() {
        let refused = Err(medbrains_authz::AuthzError::Forbidden {
            relation: "viewer".to_owned(),
            object_type: "patient".to_owned(),
            object_id: uuid::Uuid::nil(),
        });
        assert_eq!(outcome_of(refused, "patient"), Outcome::Deny);
        let caveat = Err(medbrains_authz::AuthzError::CaveatFailed(
            "off shift".to_owned(),
        ));
        assert_eq!(outcome_of(caveat, "patient"), Outcome::Deny);
    }

    /// A registry gap denies, but it is not retryable — calling it a 503 sends
    /// an operator to inspect healthy infrastructure.
    #[test]
    fn our_own_misconfiguration_denies_rather_than_reporting_an_outage() {
        let unregistered = Err(medbrains_authz::AuthzError::UnknownObjectType(
            "wibble".to_owned(),
        ));
        assert_eq!(outcome_of(unregistered, "wibble"), Outcome::Deny);
        assert!(matches!(
            collapse(outcome_of(
                Err(medbrains_authz::AuthzError::UnknownObjectType(
                    "wibble".to_owned()
                )),
                "wibble"
            )),
            Err(AppError::NotFound)
        ));
    }

    /// Failing closed is not negotiable: no combination reaches `Ok` without a
    /// definite grant somewhere.
    #[test]
    fn an_outage_never_grants_access() {
        for outcome in [Outcome::Unknown, Outcome::Deny] {
            assert!(collapse(outcome).is_err());
        }
        assert!(collapse(any([Outcome::Unknown, Outcome::Unknown])).is_err());
        assert!(collapse(any([Outcome::Unknown, Outcome::Deny])).is_err());
    }

    /// Why the direct check does not short-circuit on `Unknown`: the fan-out
    /// can still find a definite grant, and a clinician with real access must
    /// not be refused because one of two lookups was unwell.
    #[test]
    fn a_partial_outage_still_grants_a_clinician_with_a_real_grant() {
        let direct = outcome_of(outage(), "patient");
        let reachable = Outcome::Allow; // found via an encounter
        assert_eq!(any([direct, reachable]), Outcome::Allow);
        assert!(collapse(any([direct, reachable])).is_ok());
    }

    /// The converse: a definite direct denial plus an unwell fan-out is still
    /// an outage, not a refusal, because the fan-out was the branch that could
    /// have granted it.
    #[test]
    fn a_denial_plus_an_outage_is_an_outage() {
        let combined = any([Outcome::Deny, Outcome::Unknown]);
        assert_eq!(combined, Outcome::Unknown);
        assert!(matches!(
            collapse(combined),
            Err(AppError::ServiceUnavailable(_))
        ));
    }

    /// A patient with no encounters and no admissions is a real "nothing to
    /// reach it through" — that must stay a 404 and not become a 503.
    #[test]
    fn no_encounters_with_a_healthy_direct_check_is_still_not_found() {
        let direct = outcome_of(Ok(false), "patient");
        assert!(matches!(
            collapse(any([direct, Outcome::Deny])),
            Err(AppError::NotFound)
        ));
    }
}

#[cfg(test)]
mod board_read_tests {
    use medbrains_core::permissions;

    use super::require_board_read;
    use crate::middleware::auth::Claims;

    fn claims(perms: &[&str], paired: Option<uuid::Uuid>) -> Claims {
        Claims {
            sub: uuid::Uuid::nil(),
            tenant_id: uuid::Uuid::nil(),
            role: "display".to_owned(),
            permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: paired,
            act: None,
            exp: 0,
        }
    }

    #[test]
    fn a_wall_display_reads_a_board_only_while_it_is_a_paired_device() {
        let code = permissions::display::board::READ;
        assert!(require_board_read(&claims(&[code], Some(uuid::Uuid::new_v4()))).is_ok());
        // The same credential off the wall. This is the whole reason the code
        // exists rather than granting the operator's.
        assert!(require_board_read(&claims(&[code], None)).is_err());
    }

    #[test]
    fn an_operator_reads_a_board_from_anywhere() {
        let code = permissions::admin::tv_displays::BOARD;
        assert!(require_board_read(&claims(&[code], None)).is_ok());
    }

    #[test]
    fn holding_neither_code_is_refused() {
        assert!(
            require_board_read(&claims(&["opd.queue.list"], Some(uuid::Uuid::new_v4()))).is_err()
        );
    }
}

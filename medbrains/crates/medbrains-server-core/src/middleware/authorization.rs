use medbrains_authz::AuthzContext;
use medbrains_core::permissions;
use medbrains_authz::decision::Outcome;
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
    let holds_display_code =
        require_permission(claims, permissions::display::board::READ).is_ok();
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

/// Build a `medbrains-authz::AuthzContext` from JWT claims.
///
/// Bridge from request-time identity (Claims) to the resource-scoped
/// permission resolver (`state.authz.check(...)`). Bypass roles are
/// flagged so the SpiceDB backend short-circuits without a network
/// round-trip.
///
/// Group memberships are NOT loaded here — the resolver looks them up
/// from `access_group_members` so JWTs stay small. If hot-path latency
/// ever demands it, add a `groups` Vec to Claims + populate at login.
pub fn authz_context(claims: &Claims) -> AuthzContext {
    AuthzContext {
        tenant_id: claims.tenant_id,
        user_id: claims.sub,
        role: claims.role.clone(),
        department_ids: claims.department_ids.clone(),
        is_bypass: is_bypass_role(claims),
    }
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

/// Turn a backend answer into a three-valued outcome.
///
/// The reason this is not `.unwrap_or(false)`: a refusal and an outage are
/// different facts, and the endpoints here answer a denial with `NotFound` so
/// as not to be an existence oracle. Collapse the two and a SpiceDB outage
/// tells a clinician at the bedside that the encounter **does not exist** —
/// not that the system is unwell. Failing closed is right; failing closed
/// while lying about why is not.
///
/// Not every `Err` is an outage, and treating them alike is its own bug.
/// `AuthzError` carries both *decisions* and *failures*:
///
/// - `Forbidden` / `CaveatFailed` are answers. The engine evaluated the
///   question and the answer was no. These are `Deny`.
/// - `UnknownObjectType` / `InvalidRelation` / `ExpansionDepthExceeded` are
///   our own bugs — a registry gap or a runaway rewrite. They deny, but a 503
///   would send an operator to check infrastructure that is perfectly healthy,
///   and no amount of retrying fixes a missing registry entry.
/// - `Backend` / `Other` are the genuine "could not ask" cases. Only these are
///   `Unknown`, because only these are worth retrying.
///
/// The error is logged here because this is the only place that still holds
/// it. Above this line it is an `Outcome` and the cause is gone.
pub fn outcome_of(result: Result<bool, medbrains_authz::AuthzError>, what: &str) -> Outcome {
    use medbrains_authz::AuthzError as E;
    match result {
        Ok(true) => Outcome::Allow,
        Ok(false) => Outcome::Deny,
        Err(err @ (E::Forbidden { .. } | E::CaveatFailed(_))) => {
            tracing::debug!(target: "authz", error = %err, check = what, "access refused");
            Outcome::Deny
        }
        Err(
            err @ (E::UnknownObjectType(_) | E::InvalidRelation { .. }
            | E::ExpansionDepthExceeded(_)),
        ) => {
            tracing::error!(target: "authz", error = %err, check = what,
                "authorization misconfigured — denying; retrying will not help");
            Outcome::Deny
        }
        Err(err @ (E::Backend(_) | E::Other(_))) => {
            tracing::error!(target: "authz", error = %err, check = what,
                "authorization backend unavailable — refusing as 503, not as absent");
            Outcome::Unknown
        }
    }
}

/// Collapse at the boundary, and only at the boundary.
///
/// `Deny` becomes `NotFound` deliberately (not `Forbidden`) so the endpoint
/// does not confirm that a record exists to someone who may not see it.
/// `Unknown` becomes 503, which is the whole point: retryable, alertable, and
/// distinguishable from "there is no such patient".
pub fn collapse(outcome: Outcome) -> Result<(), AppError> {
    match outcome {
        Outcome::Allow => Ok(()),
        Outcome::Deny => Err(AppError::NotFound),
        Outcome::Unknown => Err(AppError::ServiceUnavailable(
            "authorization backend unavailable".to_owned(),
        )),
    }
}

#[cfg(test)]
mod outcome_tests {
    use super::{collapse, outcome_of};
    use medbrains_authz::decision::{Outcome, any};
    use crate::error::AppError;

    fn outage() -> Result<bool, medbrains_authz::AuthzError> {
        Err(medbrains_authz::AuthzError::Other("spicedb unreachable".to_owned()))
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
        let caveat = Err(medbrains_authz::AuthzError::CaveatFailed("off shift".to_owned()));
        assert_eq!(outcome_of(caveat, "patient"), Outcome::Deny);
    }

    /// A registry gap denies, but it is not retryable — calling it a 503 sends
    /// an operator to inspect healthy infrastructure.
    #[test]
    fn our_own_misconfiguration_denies_rather_than_reporting_an_outage() {
        let unregistered = Err(medbrains_authz::AuthzError::UnknownObjectType("wibble".to_owned()));
        assert_eq!(outcome_of(unregistered, "wibble"), Outcome::Deny);
        assert!(matches!(
            collapse(outcome_of(
                Err(medbrains_authz::AuthzError::UnknownObjectType("wibble".to_owned())),
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
        assert!(require_board_read(&claims(&["opd.queue.list"], Some(uuid::Uuid::new_v4()))).is_err());
    }
}

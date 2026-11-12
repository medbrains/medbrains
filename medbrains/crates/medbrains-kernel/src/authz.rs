//! Authorisation: one decision, three outcomes.
//!
//! Wraps `AuthzBackend::check` / `bulk_check` (`medbrains-authz`) and owns the
//! three-outcome mapping [`outcome_of`]. Coarse permission checks,
//! [`require_permission`] and [`require_any_permission`], read the permission
//! set resolved once per session into the claims, so they cost a slice scan and
//! no query.
//!
//! Generic over the backend so a concrete backend dispatches statically; the
//! server's `Arc<dyn AuthzBackend>` passes through as `B = dyn AuthzBackend`.

use std::collections::HashMap;

/// The relation an [`authorize`] call asks about, so callers need not reach
/// past the kernel for it.
pub use medbrains_authz::Relation;
use medbrains_authz::{AuthzBackend, AuthzContext, AuthzError};
use uuid::Uuid;

use crate::{Claims, KernelError};

pub use medbrains_authz::decision::Outcome;

/// Roles that bypass all permission checks.
pub const BYPASS_ROLES: &[&str] = &["super_admin", "hospital_admin"];

/// Returns `true` if the user's role bypasses all permission/scope checks.
pub fn is_bypass_role(claims: &Claims) -> bool {
    BYPASS_ROLES.contains(&claims.role.as_str())
}

/// Require the user to have a specific permission.
/// Bypass roles pass every check.
pub fn require_permission(claims: &Claims, perm: &str) -> Result<(), KernelError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    if claims.permissions.iter().any(|p| p == perm) {
        return Ok(());
    }
    Err(KernelError::Forbidden)
}

/// Require the user to have at least one of the specified permissions.
/// Bypass roles pass every check.
pub fn require_any_permission(claims: &Claims, perms: &[&str]) -> Result<(), KernelError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    if perms
        .iter()
        .any(|perm| claims.permissions.iter().any(|p| p == perm))
    {
        return Ok(());
    }
    Err(KernelError::Forbidden)
}

/// Build a `medbrains-authz::AuthzContext` from JWT claims.
///
/// Bridge from request-time identity (Claims) to the resource-scoped
/// permission resolver (`state.authz.check(...)`). Bypass roles are
/// flagged so the `SpiceDB` backend short-circuits without a network
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

/// Turn a backend answer into a three-valued outcome.
///
/// The reason this is not `.unwrap_or(false)`: a refusal and an outage are
/// different facts, and endpoints answer a denial with `NotFound` so as not to
/// be an existence oracle. Collapse the two and a `SpiceDB` outage tells someone
/// mid-task that the record **does not exist** — not that the system is unwell.
/// Failing closed is right; failing closed while lying about why is not.
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
pub fn outcome_of(result: Result<bool, AuthzError>, what: &str) -> Outcome {
    use AuthzError as E;
    match result {
        Ok(true) => Outcome::Allow,
        Ok(false) => Outcome::Deny,
        Err(err @ (E::Forbidden { .. } | E::CaveatFailed(_))) => {
            tracing::debug!(target: "authz", error = %err, check = what, "access refused");
            Outcome::Deny
        }
        Err(
            err @ (E::UnknownObjectType(_)
            | E::InvalidRelation { .. }
            | E::ExpansionDepthExceeded(_)),
        ) => {
            tracing::error!(target: "authz", error = %err, check = what,
                "authorization misconfigured — denying; retrying will not help");
            Outcome::Deny
        }
        Err(err @ E::AccessSetTooLarge { .. }) => {
            // Unknown, emphatically not Deny. The subject almost certainly can
            // see these records — there are simply too many to enumerate — so
            // denying would hand them an empty list of records they are
            // entitled to. Unlike the cases above, retrying will not help
            // either: this needs a narrower query, which is a code change.
            tracing::error!(target: "authz", error = %err, check = what,
                "access set too large to enumerate — refusing as 503, not as absent");
            Outcome::Unknown
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
/// distinguishable from "there is no such record".
pub fn collapse(outcome: Outcome) -> Result<(), KernelError> {
    match outcome {
        Outcome::Allow => Ok(()),
        Outcome::Deny => Err(KernelError::NotFound),
        Outcome::Unknown => Err(KernelError::ServiceUnavailable(
            "authorization backend unavailable".to_owned(),
        )),
    }
}

/// The record a decision is about: `update` on `document:456`, never a bare
/// `update`.
#[derive(Debug, Clone, Copy)]
pub struct Resource<'a> {
    pub kind: &'a str,
    pub id: Uuid,
}

/// May `actor` do `action` on `resource`?
///
/// `Unknown` when the backend could not answer (outage, timeout) **or** when
/// the actor carries no tenant — the kernel never trusts a caller that has
/// lost its context. Collapse at the HTTP boundary with [`collapse`].
#[inline]
pub async fn authorize<B: AuthzBackend + ?Sized>(
    backend: &B,
    actor: &AuthzContext,
    action: Relation,
    resource: Resource<'_>,
) -> Outcome {
    if actor.tenant_id.is_nil() {
        return Outcome::Unknown;
    }
    let answer = backend
        .check(actor, action, resource.kind, resource.id)
        .await;
    outcome_of(answer, resource.kind)
}

/// [`authorize`] for every row of a list, in one backend round trip.
///
/// Every id gets an outcome: if the batch fails, or the backend leaves an id
/// out, that id is `Unknown` — never silently dropped, so a list cannot render
/// an outage as emptiness.
pub async fn authorize_many<B: AuthzBackend + ?Sized>(
    backend: &B,
    actor: &AuthzContext,
    action: Relation,
    kind: &str,
    ids: &[Uuid],
) -> HashMap<Uuid, Outcome> {
    if actor.tenant_id.is_nil() {
        return ids.iter().map(|id| (*id, Outcome::Unknown)).collect();
    }
    let items: Vec<(String, Relation, Uuid)> = ids
        .iter()
        .map(|id| (kind.to_owned(), action, *id))
        .collect();
    match backend.bulk_check(actor, &items).await {
        Ok(answers) => items
            .into_iter()
            .map(|key| {
                let outcome = answers
                    .get(&key)
                    .map_or(Outcome::Unknown, |allowed| outcome_of(Ok(*allowed), kind));
                (key.2, outcome)
            })
            .collect(),
        Err(e) => {
            let outcome = outcome_of(Err(e), kind);
            ids.iter().map(|id| (*id, outcome)).collect()
        }
    }
}

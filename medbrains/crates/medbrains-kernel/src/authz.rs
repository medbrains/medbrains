//! Authorisation: one decision, three outcomes.
//!
//! Wraps `AuthzBackend::check` / `bulk_check` (`medbrains-authz`) and the
//! three-outcome mapping `outcome_of` (`medbrains-server-core`). Coarse
//! permission checks re-export `require_permission` / `require_any_permission`
//! — they read the permission set resolved once per session into the claims,
//! so they cost a slice scan and no query. The per-patient check re-exports
//! `medbrains_authz_gate::require_patient_access`.
//!
//! Generic over the backend so a concrete backend dispatches statically; the
//! server's `Arc<dyn AuthzBackend>` passes through as `B = dyn AuthzBackend`.

use std::collections::HashMap;

use medbrains_authz::{AuthzBackend, AuthzContext, Relation};
use medbrains_server_core::middleware::authorization::outcome_of;
use uuid::Uuid;

pub use medbrains_authz::decision::Outcome;
pub use medbrains_authz_gate::require_patient_access;
pub use medbrains_server_core::middleware::authorization::{
    authz_context, collapse, is_bypass_role, require_any_permission, require_permission,
};

/// The record a decision is about: `update` on `patient:456`, never a bare
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

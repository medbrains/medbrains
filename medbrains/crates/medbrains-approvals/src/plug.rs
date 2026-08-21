//! What a domain plugs in, and how it is registered.
//!
//! Three seams, because the sixteen existing implementations differ in exactly
//! three ways and no more:
//!
//! * most need something to *happen* when a request is approved — a permission
//!   granted, stock released, a leave marked;
//! * a few need a way of choosing approvers that the built-in rules cannot
//!   express;
//! * one, pre-authorisation, is decided by an insurer rather than a person.
//!
//! Everything else — ordering, quorum, witnesses, delegation, escalation, the
//! audit trail — is the engine's, and a domain neither implements nor can
//! weaken it.
//!
//! The engine names no domain crate. Domains depend on the engine and register
//! themselves at the composition root, so adding the seventeenth domain never
//! edits a file here.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::error::EngineError;

pub type Tx<'a> = Transaction<'a, Postgres>;

/// A request, as a domain sees it.
///
/// Deliberately not the storage row: a handler should not be reaching into
/// `current_step_seq` or rewriting a status. It gets what it needs to act.
#[derive(Debug, Clone)]
pub struct EffectContext {
    pub tenant_id: Uuid,
    pub request_id: Uuid,
    pub kind: String,
    pub requester_id: Uuid,
    /// Who the request is about, when that is not the requester.
    pub on_behalf_of_id: Option<Uuid>,
    /// The domain row this concerns, when one already existed.
    pub subject_type: Option<String>,
    pub subject_id: Option<Uuid>,
    /// Answers to the request type's configured fields.
    pub payload: Value,
    /// Who made the final decision, and when it is being applied.
    pub decided_by: Uuid,
}

/// What happens when a request of some kind is decided.
///
/// The only seam most domains need.
#[async_trait]
pub trait ApprovalEffect: Send + Sync {
    /// Domain preconditions.
    ///
    /// Called twice: once before the request is raised, so a hopeless request
    /// is refused at the desk rather than after three approvals, and again
    /// immediately before the final approval commits — because the world moves
    /// in between. Stock is consumed, an attendance record appears, a blood
    /// unit is cross-matched to somebody else. A check that only ran at the
    /// start is a check against a state that no longer exists.
    ///
    /// # Errors
    /// Whatever the domain considers disqualifying.
    async fn validate(&self, tx: &mut Tx<'_>, ctx: &EffectContext) -> Result<(), EngineError>;

    /// Apply the outcome.
    ///
    /// Runs inside the deciding transaction. An effect that fails rolls the
    /// approval back with it, which is the only acceptable behaviour: a
    /// request marked approved beside a permission that was never granted is
    /// a lie that nothing in the system would ever correct.
    ///
    /// # Errors
    /// Anything that should abandon the approval.
    async fn on_approved(&self, tx: &mut Tx<'_>, ctx: &EffectContext) -> Result<(), EngineError>;

    /// Most domains have nothing to do here; the default is nothing.
    ///
    /// # Errors
    /// Anything that should abandon the rejection.
    async fn on_rejected(&self, _tx: &mut Tx<'_>, _ctx: &EffectContext) -> Result<(), EngineError> {
        Ok(())
    }

    /// Undo a grant after the fact.
    ///
    /// Distinct from rejection: the access existed and may have been used, so
    /// this is a withdrawal rather than a refusal.
    ///
    /// # Errors
    /// Anything that should abandon the revocation.
    async fn on_revoked(&self, _tx: &mut Tx<'_>, _ctx: &EffectContext) -> Result<(), EngineError> {
        Ok(())
    }
}

/// A decision that arrives from outside, asynchronously.
///
/// Pre-authorisation is decided by an insurer: the request is submitted and
/// the answer arrives later on a webhook. Modelling that as a human step would
/// mean a clerk clicking "approve" on the payer's behalf, and the audit trail
/// would record a person making a decision they did not make.
#[async_trait]
pub trait ExternalDecider: Send + Sync {
    /// Send the request onward. Returns the reference to correlate the reply.
    ///
    /// # Errors
    /// Transport or formatting failures.
    async fn submit(&self, tx: &mut Tx<'_>, ctx: &EffectContext) -> Result<String, EngineError>;

    /// Read an inbound payload as a decision.
    ///
    /// # Errors
    /// A payload that cannot be understood — which must not be guessed at.
    fn interpret(&self, payload: &Value) -> Result<ExternalOutcome, EngineError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExternalOutcome {
    Approved,
    Rejected,
    /// Acknowledged but not yet decided. Common with payers, and distinct from
    /// silence: it means the clock is still running rather than that the
    /// message was lost.
    Pending,
}

/// The plugged-in handlers, assembled once at startup.
///
/// A registry rather than a match statement: a match would put every domain's
/// name in this crate and invert the dependency the whole design rests on.
#[derive(Default)]
pub struct Registry {
    effects: HashMap<String, Arc<dyn ApprovalEffect>>,
    external: HashMap<String, Arc<dyn ExternalDecider>>,
}

impl std::fmt::Debug for Registry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Trait objects are not Debug; the useful information is which keys
        // are wired, which is exactly what a startup log wants.
        f.debug_struct("Registry")
            .field("effects", &self.effect_keys())
            .field("external", &self.external_keys())
            .finish()
    }
}

impl Registry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Register the effect for an `effect_key`.
    ///
    /// Returns the previous registration if one existed, which the caller
    /// should treat as a wiring bug — two handlers for one key means one of
    /// them silently never runs.
    pub fn register_effect(
        &mut self,
        key: impl Into<String>,
        effect: Arc<dyn ApprovalEffect>,
    ) -> Option<Arc<dyn ApprovalEffect>> {
        self.effects.insert(key.into(), effect)
    }

    pub fn register_external(
        &mut self,
        key: impl Into<String>,
        decider: Arc<dyn ExternalDecider>,
    ) -> Option<Arc<dyn ExternalDecider>> {
        self.external.insert(key.into(), decider)
    }

    /// The effect for a key, if one is registered.
    ///
    /// `None` is not an error. A request type with no `effect_key` is the
    /// config-only case — a parking pass, an ID card — where the approval
    /// itself is the outcome and no code exists or needs to.
    #[must_use]
    pub fn effect(&self, key: Option<&str>) -> Option<Arc<dyn ApprovalEffect>> {
        self.effects.get(key?).map(Arc::clone)
    }

    #[must_use]
    pub fn external(&self, key: &str) -> Option<Arc<dyn ExternalDecider>> {
        self.external.get(key).map(Arc::clone)
    }

    /// Registered effect keys, sorted. For startup logging and for the admin
    /// console, which must not offer an `effect_key` nothing implements.
    #[must_use]
    pub fn effect_keys(&self) -> Vec<&str> {
        let mut keys: Vec<&str> = self.effects.keys().map(String::as_str).collect();
        keys.sort_unstable();
        keys
    }

    #[must_use]
    pub fn external_keys(&self) -> Vec<&str> {
        let mut keys: Vec<&str> = self.external.keys().map(String::as_str).collect();
        keys.sort_unstable();
        keys
    }

    /// Whether a key configured on a request type has an implementation.
    ///
    /// A type naming an `effect_key` that nothing implements would collect
    /// approvals and then do nothing at all — the worst failure this system
    /// can have, because everyone involved believes it worked. The admin
    /// console checks this when a type is saved.
    #[must_use]
    pub fn can_satisfy(&self, effect_key: Option<&str>) -> bool {
        effect_key.is_none_or(|key| self.effects.contains_key(key))
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::{ApprovalEffect, EffectContext, Registry, Tx};
    use crate::error::EngineError;
    use async_trait::async_trait;
    use std::sync::Arc;

    struct Noop;

    #[async_trait]
    impl ApprovalEffect for Noop {
        async fn validate(&self, _tx: &mut Tx<'_>, _c: &EffectContext) -> Result<(), EngineError> {
            Ok(())
        }
        async fn on_approved(
            &self,
            _tx: &mut Tx<'_>,
            _c: &EffectContext,
        ) -> Result<(), EngineError> {
            Ok(())
        }
    }

    #[test]
    fn a_config_only_type_needs_no_effect() {
        // The tier-0 case, and the reason `effect_key` is nullable: for a
        // parking pass the approval *is* the outcome.
        let registry = Registry::new();
        assert!(registry.can_satisfy(None));
        assert!(registry.effect(None).is_none());
    }

    #[test]
    fn a_type_naming_an_unimplemented_effect_is_not_satisfiable() {
        // Otherwise it would collect every approval and then do nothing,
        // while everyone involved believed it had worked.
        let registry = Registry::new();
        assert!(!registry.can_satisfy(Some("pharmacy.ndps_dispense")));
    }

    #[test]
    fn a_registered_effect_is_found_and_satisfiable() {
        let mut registry = Registry::new();
        assert!(
            registry
                .register_effect("iam.grant", Arc::new(Noop))
                .is_none()
        );
        assert!(registry.can_satisfy(Some("iam.grant")));
        assert!(registry.effect(Some("iam.grant")).is_some());
        assert_eq!(registry.effect_keys(), vec!["iam.grant"]);
    }

    #[test]
    fn registering_a_key_twice_reports_the_collision() {
        // Two handlers for one key means one of them silently never runs, so
        // the caller is handed the displaced one rather than left guessing.
        let mut registry = Registry::new();
        registry.register_effect("iam.grant", Arc::new(Noop));
        assert!(
            registry
                .register_effect("iam.grant", Arc::new(Noop))
                .is_some(),
            "a duplicate registration must be visible to the composition root"
        );
    }
}

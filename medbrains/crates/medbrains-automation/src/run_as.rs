//! Whose authority a workflow runs with.
//!
//! A workflow fired by a schedule at 03:00 has no user behind it. Something has
//! to decide what it may read, and the answer cannot be "everything" — that
//! would make saving a workflow a way around the permission system.
//!
//! So a workflow carries the permissions of whoever activated it, and it can
//! never hold more than that person did. Automation is therefore a delegation
//! of authority somebody already had, not a new source of it.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use uuid::Uuid;

/// The identity a workflow executes under.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAs {
    pub tenant_id: Uuid,
    /// Who armed this workflow. Recorded so an audit can answer "under whose
    /// authority did this run" without inference.
    pub user_id: Option<Uuid>,
    /// Sorted and de-duplicated, so two equivalent grants compare equal.
    permissions: BTreeSet<String>,
}

/// Why a proposed authority was refused.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum GrantError {
    #[error("a workflow cannot be granted permissions its activator does not hold: {0}")]
    Escalation(String),
}

impl RunAs {
    /// Grant a workflow the permissions it needs, bounded by the activator's.
    ///
    /// Refuses rather than silently trimming: a workflow quietly missing the
    /// permission it needs fails later, somewhere less obvious, and looks like
    /// a bug in the workflow rather than a decision made here.
    pub fn grant(
        tenant_id: Uuid,
        activator: Uuid,
        activator_permissions: &[String],
        requested: &[String],
    ) -> Result<Self, GrantError> {
        let held: BTreeSet<&str> =
            activator_permissions.iter().map(String::as_str).collect();

        let mut missing: Vec<&str> = requested
            .iter()
            .map(String::as_str)
            .filter(|permission| !held.contains(permission))
            .collect();

        if !missing.is_empty() {
            missing.sort_unstable();
            return Err(GrantError::Escalation(missing.join(", ")));
        }

        Ok(RunAs {
            tenant_id,
            user_id: Some(activator),
            permissions: requested.iter().cloned().collect(),
        })
    }

    /// An authority that can do nothing, for a workflow nobody has activated.
    #[must_use]
    pub fn none(tenant_id: Uuid) -> Self {
        RunAs { tenant_id, user_id: None, permissions: BTreeSet::new() }
    }

    /// Rebuild from what was stored, without re-checking: the check happened at
    /// activation, and the activator may since have left.
    #[must_use]
    pub fn restore(tenant_id: Uuid, user_id: Option<Uuid>, permissions: Vec<String>) -> Self {
        RunAs { tenant_id, user_id, permissions: permissions.into_iter().collect() }
    }

    #[must_use]
    pub fn allows(&self, permission: &str) -> bool {
        self.permissions.contains(permission)
    }

    /// Every permission this workflow holds, in a stable order.
    #[must_use]
    pub fn permissions(&self) -> Vec<String> {
        self.permissions.iter().cloned().collect()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.permissions.is_empty()
    }

    /// Narrow an existing authority. Used when re-activating: a workflow must
    /// not keep a permission the person re-arming it no longer holds.
    #[must_use]
    pub fn intersect(&self, still_held: &[String]) -> Self {
        let held: BTreeSet<&str> = still_held.iter().map(String::as_str).collect();
        RunAs {
            tenant_id: self.tenant_id,
            user_id: self.user_id,
            permissions: self
                .permissions
                .iter()
                .filter(|permission| held.contains(permission.as_str()))
                .cloned()
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    // Tests may state what must hold and stop if it does not; that is what a
    // test is. The denials exist for code the hospital runs.
    #![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

    use super::*;

    fn tenant() -> Uuid {
        Uuid::from_u128(1)
    }
    fn user() -> Uuid {
        Uuid::from_u128(2)
    }

    fn owned(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    #[test]
    fn a_workflow_may_hold_what_its_activator_holds() {
        let granted = RunAs::grant(
            tenant(),
            user(),
            &owned(&["patients.view", "patients.list", "billing.view"]),
            &owned(&["patients.view"]),
        )
        .expect("within the activator's authority");

        assert!(granted.allows("patients.view"));
        assert!(!granted.allows("patients.list"), "only what was asked for");
        assert_eq!(granted.user_id, Some(user()));
    }

    #[test]
    fn a_workflow_may_not_be_granted_more_than_its_activator() {
        // The whole point: saving a workflow must not be a way to read records
        // you could not read yourself.
        let refused = RunAs::grant(
            tenant(),
            user(),
            &owned(&["patients.view"]),
            &owned(&["patients.view", "patients.delete"]),
        )
        .expect_err("should refuse");

        assert_eq!(refused, GrantError::Escalation("patients.delete".into()));
    }

    #[test]
    fn the_refusal_names_every_missing_permission() {
        let refused = RunAs::grant(
            tenant(),
            user(),
            &owned(&[]),
            &owned(&["b.write", "a.read"]),
        )
        .expect_err("should refuse");

        // Sorted, so the message is stable enough to assert on and to read.
        assert_eq!(refused.to_string(), {
            let message = "a workflow cannot be granted permissions its activator does not hold";
            format!("{message}: a.read, b.write")
        });
    }

    #[test]
    fn an_unactivated_workflow_can_do_nothing() {
        let nobody = RunAs::none(tenant());

        assert!(nobody.is_empty());
        assert!(!nobody.allows("patients.view"));
        assert_eq!(nobody.user_id, None, "there is nobody to attribute it to");
    }

    #[test]
    fn asking_for_nothing_is_allowed_and_grants_nothing() {
        let granted =
            RunAs::grant(tenant(), user(), &owned(&["patients.view"]), &owned(&[]))
                .expect("asking for nothing is not escalation");
        assert!(granted.is_empty());
    }

    #[test]
    fn permissions_come_back_sorted_and_deduplicated() {
        let granted = RunAs::grant(
            tenant(),
            user(),
            &owned(&["b", "a"]),
            &owned(&["b", "a", "b"]),
        )
        .expect("granted");

        assert_eq!(granted.permissions(), owned(&["a", "b"]));
    }

    #[test]
    fn re_activating_drops_a_permission_the_activator_has_since_lost() {
        // Someone who moves department should not leave a workflow behind that
        // still reads what they no longer can.
        let original = RunAs::restore(tenant(), Some(user()), owned(&["patients.view", "billing.view"]));

        let narrowed = original.intersect(&owned(&["patients.view"]));

        assert!(narrowed.allows("patients.view"));
        assert!(!narrowed.allows("billing.view"));
    }

    #[test]
    fn a_restored_authority_is_not_re_checked() {
        // The activator may have left the hospital; the grant they made stands
        // until someone edits the workflow.
        let restored = RunAs::restore(tenant(), None, owned(&["patients.view"]));
        assert!(restored.allows("patients.view"));
    }

    #[test]
    fn an_authority_survives_the_json_it_is_stored_as() {
        let granted =
            RunAs::grant(tenant(), user(), &owned(&["patients.view"]), &owned(&["patients.view"]))
                .expect("granted");

        let encoded = serde_json::to_string(&granted).expect("serialises");
        let decoded: RunAs = serde_json::from_str(&encoded).expect("deserialises");

        assert_eq!(decoded, granted);
    }
}

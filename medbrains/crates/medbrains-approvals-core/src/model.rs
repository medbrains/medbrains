//! The values the approvals platform reasons about.
//!
//! These are plain data. Nothing here reads a database or a clock — a caller
//! loads the state, the core decides what may happen to it, and the caller
//! persists the result. That split is what lets every rule in
//! [`crate::controls`] be tested by constructing a value rather than seeding a
//! schema.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type UserId = Uuid;
pub type RequestId = Uuid;
pub type StepId = Uuid;

/// Where a request has got to.
///
/// One vocabulary for the whole system. The sixteen implementations this
/// replaces used four state machines between them, and two of them disagreed
/// on the word for the same outcome — `rejected` in IAM, `denied` in
/// antibiotic stewardship. A report that groups by status could not group
/// those together, so the same event counted as two different things.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequestStatus {
    /// Being composed. Not visible to approvers.
    Draft,
    /// Live, with a step awaiting decision.
    Pending,
    Approved,
    /// Refused. Never "denied" — see the type comment.
    Rejected,
    /// Withdrawn by the requester before a decision.
    Cancelled,
    /// Ran past `expires_at` without being decided.
    Expired,
    /// Approved, then withdrawn afterwards. Distinct from `Rejected`: the
    /// grant existed and was used, which matters to an audit.
    Revoked,
}

impl RequestStatus {
    /// Whether the request has finished, one way or another.
    ///
    /// A terminal request accepts no further decisions. Leave requests could
    /// be re-decided after approval, which silently rewrote payroll.
    #[must_use]
    pub const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Approved | Self::Rejected | Self::Cancelled | Self::Expired | Self::Revoked
        )
    }

    #[must_use]
    pub const fn is_open(self) -> bool {
        matches!(self, Self::Draft | Self::Pending)
    }
}

/// What one approver said on one step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Decision {
    Approve,
    Reject,
    /// Stood aside. Counts against neither the quorum nor the rejection, but
    /// is recorded — an approver declining to decide is information, and
    /// leaving it out makes a step look simply unattended.
    Abstain,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    /// Not reached yet.
    Waiting,
    /// Live and accepting decisions.
    Active,
    Approved,
    Rejected,
    /// Passed over — an optional step whose condition did not hold.
    Skipped,
}

/// Who is trying to act, with everything the controls need to judge them.
#[derive(Debug, Clone)]
pub struct Actor {
    pub user_id: UserId,
    /// Resolved assignees include this actor. Computed at step activation, so
    /// the check here is a set membership rather than a rule evaluation.
    pub is_assigned: bool,
    /// Holds a role that bypasses permission checks (`super_admin`,
    /// `hospital_admin`). Required for elevated payloads.
    pub is_bypass_role: bool,
    /// Present when acting under a delegation. The decision records the
    /// delegate as the actor and this alongside it — never the delegator as
    /// the actor, because they did not decide.
    pub via_delegation: Option<Uuid>,
}

/// A decision already recorded against the current step.
#[derive(Debug, Clone)]
pub struct RecordedDecision {
    pub actor_id: UserId,
    pub decision: Decision,
    pub witnessed_by: Option<UserId>,
}

/// One stage of a chain, as it currently stands.
#[derive(Debug, Clone)]
pub struct StepState {
    pub id: StepId,
    pub seq: i32,
    pub status: StepStatus,
    /// How many approvals this stage needs. Two expresses NDPS dual-lock and
    /// four-eyes review without either being special-cased.
    pub quorum: u32,
    /// Schedule X and similar: the decision is invalid without a witness who
    /// is not the actor.
    pub requires_witness: bool,
    pub decisions: Vec<RecordedDecision>,
    pub sla_due_at: Option<DateTime<Utc>>,
}

impl StepState {
    /// Approvals recorded so far. Abstentions do not count.
    #[must_use]
    pub fn approvals(&self) -> u32 {
        u32::try_from(
            self.decisions
                .iter()
                .filter(|d| d.decision == Decision::Approve)
                .count(),
        )
        .unwrap_or(u32::MAX)
    }

    #[must_use]
    pub fn has_decided(&self, user_id: UserId) -> bool {
        self.decisions.iter().any(|d| d.actor_id == user_id)
    }
}

/// A request, as far as the controls are concerned.
#[derive(Debug, Clone)]
pub struct RequestState {
    pub id: RequestId,
    pub kind: String,
    pub status: RequestStatus,
    pub requester_id: UserId,
    /// Who the request is *about*, when that differs from who raised it — the
    /// user being granted access, the employee taking the leave. They may not
    /// decide their own case any more than the requester may.
    pub on_behalf_of_id: Option<UserId>,
    /// Which stage is live. The decision guard keys on this, so a stale client
    /// cannot apply a decision to a stage that has already moved on.
    pub current_step_seq: i32,
    /// The payload needs a bypass role to approve — an elevated permission
    /// code, a controlled substance.
    pub requires_elevation: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

/// What the engine should do once a decision is accepted.
///
/// Returned rather than performed: the core does not write. The caller applies
/// this inside the deciding transaction, alongside the domain effect, so that
/// an effect which fails rolls the decision back with it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// Recorded, but the step still needs more approvals to meet its quorum.
    AwaitingQuorum { have: u32, need: u32 },
    /// This step is satisfied; activate the next one.
    AdvanceToNextStep,
    /// This step was the last. The request is approved and the domain effect
    /// should run.
    RequestApproved,
    /// A rejection ends the whole request immediately — there is no partial
    /// refusal, and continuing to collect approvals on a rejected request
    /// would imply the decision were still open.
    RequestRejected,
    /// An abstention changes nothing but the record.
    Recorded,
}

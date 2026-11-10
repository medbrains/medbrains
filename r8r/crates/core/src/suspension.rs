//! Stopping a run part-way and picking it up later.
//!
//! Some steps cannot be waited out inside a request. A prescription needs a
//! pharmacist to approve it; a discharge summary needs a consultant to sign it;
//! a follow-up happens in three days. Holding a task in memory for any of those
//! means the answer is lost the next time r8r is deployed — and the workflow
//! silently never finishes.
//!
//! So a node can end the run instead of producing output, saying what it is
//! waiting for. The engine records where it stopped and what was in flight, and
//! a later resume starts the workflow from the next node with that data. The
//! wait therefore survives a restart, because it lives in the database rather
//! than in a sleeping task.

use crate::execute_context::NodeOutput;
use chrono::{DateTime, Utc};
use r8r_workflow::interfaces::Items;
use serde::{Deserialize, Serialize};

/// What a node produced: either data, or a reason the run has stopped.
#[derive(Debug)]
pub enum NodeOutcome {
    Output(NodeOutput),
    Suspend(Box<Suspension>),
}

impl From<NodeOutput> for NodeOutcome {
    fn from(output: NodeOutput) -> Self {
        NodeOutcome::Output(output)
    }
}

impl NodeOutcome {
    /// The output, if the node produced any.
    #[must_use]
    pub fn output(self) -> Option<NodeOutput> {
        match self {
            NodeOutcome::Output(output) => Some(output),
            NodeOutcome::Suspend(_) => None,
        }
    }
}

/// Why a run stopped, and what would start it again.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Suspension {
    /// What the run is waiting for, in words, for whoever finds it waiting.
    pub reason: String,
    /// When it may continue without anybody doing anything.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resume_at: Option<DateTime<Utc>>,
    /// Whether a person has to act before it continues.
    #[serde(default)]
    pub needs_approval: bool,
    /// The items to carry into the rest of the workflow.
    #[serde(default)]
    pub items: Items,
}

impl Suspension {
    /// Wait until a moment passes.
    #[must_use]
    pub fn until(resume_at: DateTime<Utc>, items: Items) -> Self {
        Suspension {
            reason: format!("waiting until {}", resume_at.to_rfc3339()),
            resume_at: Some(resume_at),
            needs_approval: false,
            items,
        }
    }

    /// Wait for a person.
    ///
    /// No deadline: a run waiting on a pharmacist should still be waiting
    /// tomorrow, not quietly continue as though approval had been given.
    #[must_use]
    pub fn for_approval(reason: &str, items: Items) -> Self {
        Suspension {
            reason: reason.to_owned(),
            resume_at: None,
            needs_approval: true,
            items,
        }
    }

    /// May this resume on its own, at this moment?
    #[must_use]
    pub fn is_due(&self, now: DateTime<Utc>) -> bool {
        // Approval is never granted by the passage of time, even if a deadline
        // was also set — the deadline is when to stop waiting, not consent.
        if self.needs_approval {
            return false;
        }
        self.resume_at.is_some_and(|due| now >= due)
    }
}

/// Where a suspended run stopped.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuspendedAt {
    /// The node that stopped the run.
    pub node_id: String,
    pub node_name: String,
    #[serde(flatten)]
    pub suspension: Suspension,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    use serde_json::json;

    fn items() -> Items {
        vec![json!({ "prescription": "P-1" })]
    }

    #[test]
    fn a_timed_wait_resumes_once_its_moment_passes() {
        let due = Utc::now();
        let waiting = Suspension::until(due, items());

        assert!(!waiting.is_due(due - Duration::seconds(1)));
        assert!(waiting.is_due(due));
        assert!(waiting.is_due(due + Duration::hours(1)));
    }

    #[test]
    fn a_wait_for_a_person_never_resumes_on_its_own() {
        // The failure that matters: a prescription continuing as though a
        // pharmacist had approved it, because enough time went by.
        let waiting = Suspension::for_approval("pharmacist review", items());

        assert!(!waiting.is_due(Utc::now()));
        assert!(!waiting.is_due(Utc::now() + Duration::days(365)));
    }

    #[test]
    fn a_deadline_on_an_approval_is_when_to_stop_waiting_not_consent() {
        let mut waiting = Suspension::for_approval("pharmacist review", items());
        waiting.resume_at = Some(Utc::now() - Duration::hours(1));

        assert!(!waiting.is_due(Utc::now()), "time passing is not approval");
    }

    #[test]
    fn a_suspension_carries_the_items_the_rest_of_the_workflow_needs() {
        let waiting = Suspension::until(Utc::now(), items());
        assert_eq!(waiting.items, items());
    }

    #[test]
    fn a_suspension_survives_the_json_it_is_stored_as() {
        let waiting = Suspension::for_approval("consultant sign-off", items());

        let encoded = serde_json::to_string(&waiting).expect("serialises");
        let decoded: Suspension = serde_json::from_str(&encoded).expect("deserialises");

        assert_eq!(decoded.reason, waiting.reason);
        assert!(decoded.needs_approval);
        assert_eq!(decoded.items, items());
    }

    #[test]
    fn an_outcome_that_carries_data_yields_it() {
        let output = crate::execute_context::main_output(items());
        assert!(NodeOutcome::from(output).output().is_some());
    }

    #[test]
    fn an_outcome_that_stopped_the_run_yields_no_data() {
        let stopped = NodeOutcome::Suspend(Box::new(Suspension::until(Utc::now(), items())));
        assert!(stopped.output().is_none());
    }
}

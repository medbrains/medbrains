//! The rules that decide whether a decision may be recorded at all.
//!
//! Every one of these exists because a domain that hand-rolled its own
//! approval got it wrong. They live here, once, as pure functions, so that no
//! domain can forget one — a domain does not implement a control, it inherits
//! them by using the engine.
//!
//! The order below is the order they are applied, and it is deliberate:
//! authority questions ("may you act here at all?") are answered before state
//! questions ("is this step still open?"), so an unauthorised actor learns
//! nothing about the state of a request they have no business seeing.

use crate::error::ControlViolation;
use crate::model::{Actor, Decision, Outcome, RequestState, RequestStatus, StepState, StepStatus};

/// Judge one decision against one live request.
///
/// Returns what the caller should then do, or the first control that refuses.
/// Nothing is written here; see [`Outcome`].
///
/// # Errors
/// Returns the first [`ControlViolation`] that applies.
pub fn evaluate(
    request: &RequestState,
    step: &StepState,
    actor: &Actor,
    decision: Decision,
    witnessed_by: Option<uuid::Uuid>,
    expected_step_seq: i32,
) -> Result<Outcome, ControlViolation> {
    authorised_to_decide(request, actor)?;
    step_is_current(request, step, expected_step_seq)?;
    request_is_open(request)?;
    not_already_decided(step, actor)?;
    witness_is_valid(step, actor, witnessed_by)?;

    Ok(tally(step, decision))
}

/// Segregation of duties.
///
/// The requester may not decide their own request, and neither may the person
/// it is about. `iam_access_requests` has refused both since it was written;
/// `leave_requests` never checked, and since one permission authorises both of
/// its stages, a holder could approve their own leave end to end.
///
/// Elevation is checked here too: a payload flagged as elevated needs a bypass
/// role, mirroring the existing rule for elevated permission codes.
fn authorised_to_decide(request: &RequestState, actor: &Actor) -> Result<(), ControlViolation> {
    if actor.user_id == request.requester_id {
        return Err(ControlViolation::RequesterCannotDecide);
    }
    if request.on_behalf_of_id == Some(actor.user_id) {
        return Err(ControlViolation::SubjectCannotDecide);
    }
    if !actor.is_assigned {
        return Err(ControlViolation::NotAnApprover);
    }
    if request.requires_elevation && !actor.is_bypass_role {
        return Err(ControlViolation::ElevationRequired);
    }
    Ok(())
}

/// The stage being decided must be the stage that is live.
///
/// `expected_step_seq` comes from the client, which read it when the page
/// loaded. Checking it here — and again in the persisting `UPDATE`'s `WHERE`
/// clause — is what stops two approvers who clicked at the same moment from
/// both winning, and what stops a stage being skipped.
///
/// Stage skipping is not hypothetical: the leave update was keyed on the row
/// id alone, so `approve_admin` against a `draft` reached `approved` without
/// the department stage ever happening.
fn step_is_current(
    request: &RequestState,
    step: &StepState,
    expected_step_seq: i32,
) -> Result<(), ControlViolation> {
    if expected_step_seq != request.current_step_seq {
        return Err(ControlViolation::StaleStep {
            expected: expected_step_seq,
            current: request.current_step_seq,
        });
    }
    if step.seq != request.current_step_seq {
        return Err(ControlViolation::StepNotCurrent {
            step: step.seq,
            current: request.current_step_seq,
        });
    }
    if step.status != StepStatus::Active {
        return Err(ControlViolation::StepNotActive(step.status));
    }
    Ok(())
}

/// A finished request accepts nothing further.
fn request_is_open(request: &RequestState) -> Result<(), ControlViolation> {
    if request.status.is_terminal() {
        return Err(ControlViolation::RequestClosed(request.status));
    }
    if request.status == RequestStatus::Draft {
        return Err(ControlViolation::NotYetSubmitted);
    }
    Ok(())
}

/// One approver, one voice per step.
///
/// Without this a quorum of two is met by one person clicking twice, which
/// makes a dual lock a single lock with extra steps.
fn not_already_decided(step: &StepState, actor: &Actor) -> Result<(), ControlViolation> {
    if step.has_decided(actor.user_id) {
        return Err(ControlViolation::AlreadyDecided);
    }
    Ok(())
}

/// Schedule X and the like: a witness, who is not the person acting.
fn witness_is_valid(
    step: &StepState,
    actor: &Actor,
    witnessed_by: Option<uuid::Uuid>,
) -> Result<(), ControlViolation> {
    if !step.requires_witness {
        return Ok(());
    }
    match witnessed_by {
        None => Err(ControlViolation::WitnessRequired),
        // A self-witnessed controlled-drug entry is the exact thing the
        // witness requirement exists to prevent.
        Some(witness) if witness == actor.user_id => Err(ControlViolation::WitnessCannotBeActor),
        Some(_) => Ok(()),
    }
}

/// What this decision does to the step, once it is allowed.
///
/// A rejection ends the request outright. There is no partial refusal: a
/// request that is still collecting approvals after somebody rejected it
/// implies the question is open when it is not.
fn tally(step: &StepState, decision: Decision) -> Outcome {
    match decision {
        Decision::Reject => Outcome::RequestRejected,
        Decision::Abstain => Outcome::Recorded,
        Decision::Approve => {
            let have = step.approvals().saturating_add(1);
            if have >= step.quorum {
                Outcome::AdvanceToNextStep
            } else {
                Outcome::AwaitingQuorum {
                    have,
                    need: step.quorum,
                }
            }
        }
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{Outcome, evaluate};
    use crate::error::ControlViolation;
    use crate::model::{
        Actor, Decision, RecordedDecision, RequestState, RequestStatus, StepState, StepStatus,
    };
    use uuid::Uuid;

    fn request() -> RequestState {
        RequestState {
            id: Uuid::new_v4(),
            kind: "hr.leave".to_owned(),
            status: RequestStatus::Pending,
            requester_id: Uuid::new_v4(),
            on_behalf_of_id: None,
            current_step_seq: 1,
            requires_elevation: false,
            expires_at: None,
        }
    }

    fn step() -> StepState {
        StepState {
            id: Uuid::new_v4(),
            seq: 1,
            status: StepStatus::Active,
            quorum: 1,
            requires_witness: false,
            decisions: Vec::new(),
            sla_due_at: None,
        }
    }

    fn approver() -> Actor {
        Actor {
            user_id: Uuid::new_v4(),
            is_assigned: true,
            is_bypass_role: false,
            via_delegation: None,
        }
    }

    fn decide(
        r: &RequestState,
        s: &StepState,
        a: &Actor,
        d: Decision,
    ) -> Result<Outcome, ControlViolation> {
        evaluate(r, s, a, d, None, r.current_step_seq)
    }

    #[test]
    fn an_assigned_approver_can_approve() {
        let outcome = decide(&request(), &step(), &approver(), Decision::Approve);
        assert_eq!(outcome, Ok(Outcome::AdvanceToNextStep));
    }

    #[test]
    fn the_requester_cannot_decide_their_own_request() {
        let req = request();
        let mut actor = approver();
        actor.user_id = req.requester_id;
        assert_eq!(
            decide(&req, &step(), &actor, Decision::Approve),
            Err(ControlViolation::RequesterCannotDecide)
        );
    }

    #[test]
    fn the_subject_cannot_decide_their_own_case() {
        // The employee taking the leave, the user being granted the access.
        // They are frequently not the requester, and just as conflicted.
        let mut req = request();
        let actor = approver();
        req.on_behalf_of_id = Some(actor.user_id);
        assert_eq!(
            decide(&req, &step(), &actor, Decision::Approve),
            Err(ControlViolation::SubjectCannotDecide)
        );
    }

    #[test]
    fn a_bypass_role_does_not_excuse_a_conflict_of_interest() {
        // Being an administrator is authority, not impartiality. This is the
        // one thing elevation must never unlock.
        let req = request();
        let mut actor = approver();
        actor.user_id = req.requester_id;
        actor.is_bypass_role = true;
        assert_eq!(
            decide(&req, &step(), &actor, Decision::Approve),
            Err(ControlViolation::RequesterCannotDecide)
        );
    }

    #[test]
    fn someone_who_is_not_an_approver_is_refused() {
        let mut actor = approver();
        actor.is_assigned = false;
        assert_eq!(
            decide(&request(), &step(), &actor, Decision::Approve),
            Err(ControlViolation::NotAnApprover)
        );
    }

    #[test]
    fn an_elevated_payload_needs_a_bypass_role() {
        let mut req = request();
        req.requires_elevation = true;
        assert_eq!(
            decide(&req, &step(), &approver(), Decision::Approve),
            Err(ControlViolation::ElevationRequired)
        );

        let mut elevated = approver();
        elevated.is_bypass_role = true;
        assert!(decide(&req, &step(), &elevated, Decision::Approve).is_ok());
    }

    #[test]
    fn a_stage_cannot_be_skipped() {
        // The leave defect: `approve_admin` against a request still awaiting
        // its department stage. Deciding step 2 while step 1 is live must
        // fail rather than jump the chain.
        let req = request();
        let mut later = step();
        later.seq = 2;
        assert_eq!(
            evaluate(&req, &later, &approver(), Decision::Approve, None, 2),
            Err(ControlViolation::StaleStep {
                expected: 2,
                current: 1
            })
        );
    }

    #[test]
    fn a_stale_client_cannot_apply_a_decision_to_a_moved_on_step() {
        // Two approvers open the same request; the first decides. The second
        // is still holding step 1 and must be told, not silently applied.
        let mut req = request();
        req.current_step_seq = 2;
        assert_eq!(
            evaluate(&req, &step(), &approver(), Decision::Approve, None, 1),
            Err(ControlViolation::StaleStep {
                expected: 1,
                current: 2
            })
        );
    }

    #[test]
    fn a_decided_request_is_terminal() {
        // Re-deciding an approved leave silently rewrote payroll.
        for status in [
            RequestStatus::Approved,
            RequestStatus::Rejected,
            RequestStatus::Cancelled,
            RequestStatus::Expired,
            RequestStatus::Revoked,
        ] {
            let mut req = request();
            req.status = status;
            assert_eq!(
                decide(&req, &step(), &approver(), Decision::Approve),
                Err(ControlViolation::RequestClosed(status)),
                "{status:?} must not accept a further decision"
            );
        }
    }

    #[test]
    fn a_draft_is_not_yet_decidable() {
        let mut req = request();
        req.status = RequestStatus::Draft;
        assert_eq!(
            decide(&req, &step(), &approver(), Decision::Approve),
            Err(ControlViolation::NotYetSubmitted)
        );
    }

    #[test]
    fn one_person_cannot_satisfy_a_quorum_of_two() {
        // Otherwise a dual lock is a single lock with extra clicks.
        let actor = approver();
        let mut two = step();
        two.quorum = 2;
        two.decisions = vec![RecordedDecision {
            actor_id: actor.user_id,
            decision: Decision::Approve,
            witnessed_by: None,
        }];
        assert_eq!(
            decide(&request(), &two, &actor, Decision::Approve),
            Err(ControlViolation::AlreadyDecided)
        );
    }

    #[test]
    fn a_quorum_of_two_needs_two_different_people() {
        let mut two = step();
        two.quorum = 2;

        // First approval holds the step open.
        assert_eq!(
            decide(&request(), &two, &approver(), Decision::Approve),
            Ok(Outcome::AwaitingQuorum { have: 1, need: 2 })
        );

        // A different person completes it.
        two.decisions = vec![RecordedDecision {
            actor_id: Uuid::new_v4(),
            decision: Decision::Approve,
            witnessed_by: None,
        }];
        assert_eq!(
            decide(&request(), &two, &approver(), Decision::Approve),
            Ok(Outcome::AdvanceToNextStep)
        );
    }

    #[test]
    fn abstentions_do_not_count_towards_a_quorum() {
        let mut two = step();
        two.quorum = 2;
        two.decisions = vec![RecordedDecision {
            actor_id: Uuid::new_v4(),
            decision: Decision::Abstain,
            witnessed_by: None,
        }];
        assert_eq!(
            decide(&request(), &two, &approver(), Decision::Approve),
            Ok(Outcome::AwaitingQuorum { have: 1, need: 2 })
        );
    }

    #[test]
    fn a_rejection_ends_the_request_whatever_the_quorum() {
        let mut two = step();
        two.quorum = 5;
        assert_eq!(
            decide(&request(), &two, &approver(), Decision::Reject),
            Ok(Outcome::RequestRejected)
        );
    }

    #[test]
    fn a_witnessed_step_refuses_an_unwitnessed_decision() {
        let mut witnessed = step();
        witnessed.requires_witness = true;
        assert_eq!(
            decide(&request(), &witnessed, &approver(), Decision::Approve),
            Err(ControlViolation::WitnessRequired)
        );
    }

    #[test]
    fn nobody_witnesses_themselves() {
        // A self-witnessed Schedule X entry is precisely what the requirement
        // exists to prevent.
        let mut witnessed = step();
        witnessed.requires_witness = true;
        let actor = approver();
        assert_eq!(
            evaluate(
                &request(),
                &witnessed,
                &actor,
                Decision::Approve,
                Some(actor.user_id),
                1
            ),
            Err(ControlViolation::WitnessCannotBeActor)
        );
        assert!(
            evaluate(
                &request(),
                &witnessed,
                &actor,
                Decision::Approve,
                Some(Uuid::new_v4()),
                1
            )
            .is_ok()
        );
    }

    #[test]
    fn authority_is_checked_before_state() {
        // Someone with no business here must not learn whether the request is
        // closed, mid-chain, or does not concern them — they get the same
        // authority answer either way.
        let mut closed = request();
        closed.status = RequestStatus::Approved;
        let mut outsider = approver();
        outsider.is_assigned = false;
        assert_eq!(
            decide(&closed, &step(), &outsider, Decision::Approve),
            Err(ControlViolation::NotAnApprover)
        );
    }
}

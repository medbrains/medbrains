//! Recording a decision, and moving the request as a result.
//!
//! Everything here runs inside the caller's transaction. That is not a style
//! preference: the domain effect — granting the permission, releasing the
//! stock, marking the leave approved — runs in the same transaction, so an
//! effect that fails takes the approval down with it. A permission grant that
//! half-applied would leave a request marked approved and an access that was
//! never given, and nothing would say so.
//!
//! The core has already judged the decision against state read a moment ago.
//! Every write below re-states the assumptions that judgement rested on, in
//! the `WHERE` clause, so a request that moved in between updates nothing
//! rather than being clobbered.

use medbrains_approvals_core::{Decision, Outcome};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::error::StoreError;

type Tx<'a> = Transaction<'a, Postgres>;

/// One decision, and its consequence for the request.
#[derive(Debug, Clone)]
pub struct RecordDecision {
    pub tenant_id: Uuid,
    pub request_id: Uuid,
    pub step_id: Uuid,
    /// The stage the client believed was live. Re-checked in every `WHERE`.
    pub expected_step_seq: i32,
    pub actor_id: Uuid,
    pub decision: Decision,
    pub note: Option<String>,
    pub witnessed_by: Option<Uuid>,
    pub via_delegation_id: Option<Uuid>,
}

/// Write the decision and apply `outcome`.
///
/// Returns the request's resulting status, or [`StoreError::ConcurrentUpdate`]
/// if the request moved between the core judging it and this write.
///
/// # Errors
/// Database errors, or `ConcurrentUpdate` when a guard matches no rows.
pub async fn record(
    tx: &mut Tx<'_>,
    input: &RecordDecision,
    outcome: Outcome,
) -> Result<&'static str, StoreError> {
    insert_decision(tx, input).await?;

    match outcome {
        // The step still needs more approvals. Nothing about the request
        // changes — deliberately, so that a half-met quorum is visible as a
        // pending request rather than as some intermediate status nobody has
        // a name for.
        Outcome::AwaitingQuorum { .. } | Outcome::Recorded => Ok("pending"),
        Outcome::AdvanceToNextStep => advance(tx, input).await,
        Outcome::RequestApproved => {
            close_step(tx, input, "approved").await?;
            close_request(tx, input, "approved").await
        }
        Outcome::RequestRejected => {
            close_step(tx, input, "rejected").await?;
            close_request(tx, input, "rejected").await
        }
    }
}

/// The decision row. Append-only — there is no update path for one of these.
///
/// The unique index on `(step_id, actor_id)` is the backstop for one voice per
/// person. The core refuses a second vote with a readable message; this makes
/// it impossible even if a future path forgets to ask.
async fn insert_decision(tx: &mut Tx<'_>, input: &RecordDecision) -> Result<(), StoreError> {
    sqlx::query(
        "INSERT INTO approval_decisions \
           (tenant_id, step_id, request_id, actor_id, decision, note, witnessed_by, \
            via_delegation_id) \
         VALUES ($1, $2, $3, $4, $5::approval_decision_kind, $6, $7, $8)",
    )
    .bind(input.tenant_id)
    .bind(input.step_id)
    .bind(input.request_id)
    .bind(input.actor_id)
    .bind(decision_label(input.decision))
    .bind(input.note.as_deref())
    .bind(input.witnessed_by)
    .bind(input.via_delegation_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Close this stage and open the next, or finish the request if none remains.
async fn advance(tx: &mut Tx<'_>, input: &RecordDecision) -> Result<&'static str, StoreError> {
    close_step(tx, input, "approved").await?;

    let next_seq: Option<i32> = sqlx::query_scalar(
        "SELECT MIN(seq) FROM approval_steps \
         WHERE request_id = $1 AND tenant_id = $2 AND seq > $3 AND status = 'waiting'",
    )
    .bind(input.request_id)
    .bind(input.tenant_id)
    .bind(input.expected_step_seq)
    .fetch_one(&mut **tx)
    .await?;

    let Some(next_seq) = next_seq else {
        // Last stage. The caller runs the domain effect after this returns,
        // still inside this transaction.
        return close_request(tx, input, "approved").await;
    };

    // The guard that makes a stage un-skippable at the storage layer.
    //
    // `current_step_seq = $expected` means a request that already moved on —
    // because another approver got there first — matches zero rows, and the
    // caller is told rather than silently overwriting the other decision.
    // The leave module's equivalent update was keyed on the row id alone,
    // which is precisely how its department stage became optional.
    let moved = sqlx::query(
        "UPDATE approval_requests \
         SET current_step_seq = $4, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND current_step_seq = $3 \
           AND status = 'pending' \
         RETURNING id",
    )
    .bind(input.request_id)
    .bind(input.tenant_id)
    .bind(input.expected_step_seq)
    .bind(next_seq)
    .fetch_optional(&mut **tx)
    .await?;
    if moved.is_none() {
        return Err(StoreError::ConcurrentUpdate);
    }

    sqlx::query(
        "UPDATE approval_steps \
         SET status = 'active'::approval_step_status, activated_at = now(), updated_at = now() \
         WHERE request_id = $1 AND tenant_id = $2 AND seq = $3 AND status = 'waiting'",
    )
    .bind(input.request_id)
    .bind(input.tenant_id)
    .bind(next_seq)
    .execute(&mut **tx)
    .await?;

    Ok("pending")
}

/// Mark the live stage finished. Guarded on it still being active.
async fn close_step(
    tx: &mut Tx<'_>,
    input: &RecordDecision,
    status: &str,
) -> Result<(), StoreError> {
    let closed = sqlx::query(
        "UPDATE approval_steps \
         SET status = $4::approval_step_status, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND seq = $3 AND status = 'active' \
         RETURNING id",
    )
    .bind(input.step_id)
    .bind(input.tenant_id)
    .bind(input.expected_step_seq)
    .bind(status)
    .fetch_optional(&mut **tx)
    .await?;
    if closed.is_none() {
        return Err(StoreError::ConcurrentUpdate);
    }
    Ok(())
}

/// Finish the request. Guarded on the stage and on it still being pending, so
/// a terminal request cannot be re-closed into a different outcome.
async fn close_request(
    tx: &mut Tx<'_>,
    input: &RecordDecision,
    status: &'static str,
) -> Result<&'static str, StoreError> {
    let closed = sqlx::query(
        "UPDATE approval_requests \
         SET status = $4::approval_request_status, decided_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
           AND current_step_seq = $3 \
           AND status = 'pending' \
         RETURNING id",
    )
    .bind(input.request_id)
    .bind(input.tenant_id)
    .bind(input.expected_step_seq)
    .bind(status)
    .fetch_optional(&mut **tx)
    .await?;
    if closed.is_none() {
        return Err(StoreError::ConcurrentUpdate);
    }

    // A rejected request has no live stage left. Any stage still waiting is
    // marked skipped rather than left waiting for a decision that will never
    // be asked for — an inbox that keeps offering a dead request is how
    // approvers learn to ignore it.
    if status == "rejected" {
        sqlx::query(
            "UPDATE approval_steps \
             SET status = 'skipped'::approval_step_status, updated_at = now() \
             WHERE request_id = $1 AND tenant_id = $2 AND status = 'waiting'",
        )
        .bind(input.request_id)
        .bind(input.tenant_id)
        .execute(&mut **tx)
        .await?;
    }

    // Whatever the outcome, nothing is awaiting anyone any longer.
    sqlx::query("DELETE FROM approval_step_assignees WHERE request_id = $1 AND tenant_id = $2")
        .bind(input.request_id)
        .bind(input.tenant_id)
        .execute(&mut **tx)
        .await?;

    Ok(status)
}

const fn decision_label(decision: Decision) -> &'static str {
    match decision {
        Decision::Approve => "approve",
        Decision::Reject => "reject",
        Decision::Abstain => "abstain",
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::decision_label;
    use medbrains_approvals_core::Decision;

    #[test]
    fn decision_labels_match_the_database_enum() {
        // These strings are cast to `approval_decision_kind` in the insert. A
        // mismatch is a runtime 500 on every decision, so it is worth pinning
        // against the migration's ENUM ('approve', 'reject', 'abstain').
        assert_eq!(decision_label(Decision::Approve), "approve");
        assert_eq!(decision_label(Decision::Reject), "reject");
        assert_eq!(decision_label(Decision::Abstain), "abstain");
    }
}

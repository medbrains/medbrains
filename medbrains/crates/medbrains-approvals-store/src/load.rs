//! Reading the state a decision is judged against.
//!
//! The core decides nothing without being handed the current request, the live
//! step and who is asking. This module assembles exactly that and no more —
//! the payload, the form answers and the domain row are not needed to judge a
//! decision, and loading them would make the hot path pay for them.
//!
//! Everything here runs inside the caller's transaction, after
//! `set_tenant_context`, so RLS scopes every read.

use medbrains_approvals_core::{
    Actor, RecordedDecision, RequestState, RequestStatus, StepState, StepStatus,
};
use sqlx::{Postgres, Row, Transaction};
use uuid::Uuid;

use crate::error::StoreError;

type Tx<'a> = Transaction<'a, Postgres>;

/// Everything the core needs to judge one decision.
#[derive(Debug)]
pub struct DecisionContext {
    pub request: RequestState,
    pub step: StepState,
    pub actor: Actor,
}

/// Load the request, its live step, and the actor's standing on that step.
///
/// Three queries rather than one join: the step's decisions are a collection,
/// and flattening them into the request row would return the request once per
/// decision and make the caller de-duplicate. At these cardinalities — one
/// request, one step, a handful of decisions — three indexed lookups are
/// cheaper than the fan-out.
///
/// # Errors
/// [`StoreError::RequestNotFound`] or [`StoreError::StepNotFound`] when the
/// request or its live stage is missing; otherwise a database error.
pub async fn decision_context(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    request_id: Uuid,
    actor_id: Uuid,
    actor_is_bypass_role: bool,
) -> Result<DecisionContext, StoreError> {
    let request = request_state(tx, tenant_id, request_id).await?;
    let step = live_step(tx, tenant_id, request_id, request.current_step_seq).await?;
    let actor = actor_standing(tx, tenant_id, step.id, actor_id, actor_is_bypass_role).await?;
    Ok(DecisionContext {
        request,
        step,
        actor,
    })
}

async fn request_state(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<RequestState, StoreError> {
    let row = sqlx::query(
        "SELECT id, kind, status::text AS status, requester_id, on_behalf_of_id, \
                current_step_seq, requires_elevation, expires_at \
         FROM approval_requests \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(request_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(StoreError::RequestNotFound(request_id))?;

    Ok(RequestState {
        id: row.try_get("id")?,
        kind: row.try_get("kind")?,
        status: parse_request_status(row.try_get::<String, _>("status")?.as_str()),
        requester_id: row.try_get("requester_id")?,
        on_behalf_of_id: row.try_get("on_behalf_of_id")?,
        current_step_seq: row.try_get("current_step_seq")?,
        requires_elevation: row.try_get("requires_elevation")?,
        expires_at: row.try_get("expires_at")?,
    })
}

async fn live_step(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    request_id: Uuid,
    seq: i32,
) -> Result<StepState, StoreError> {
    let row = sqlx::query(
        "SELECT id, seq, status::text AS status, quorum, requires_witness, sla_due_at \
         FROM approval_steps \
         WHERE request_id = $1 AND tenant_id = $2 AND seq = $3",
    )
    .bind(request_id)
    .bind(tenant_id)
    .bind(seq)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(StoreError::StepNotFound {
        request: request_id,
        seq,
    })?;

    let step_id: Uuid = row.try_get("id")?;
    let decisions = sqlx::query(
        "SELECT actor_id, decision::text AS decision, witnessed_by \
         FROM approval_decisions \
         WHERE step_id = $1 AND tenant_id = $2 \
         ORDER BY signed_at",
    )
    .bind(step_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .map(|d| {
        Ok(RecordedDecision {
            actor_id: d.try_get("actor_id")?,
            decision: parse_decision(d.try_get::<String, _>("decision")?.as_str()),
            witnessed_by: d.try_get("witnessed_by")?,
        })
    })
    .collect::<Result<Vec<_>, sqlx::Error>>()?;

    let quorum: i32 = row.try_get("quorum")?;
    Ok(StepState {
        id: step_id,
        seq: row.try_get("seq")?,
        status: parse_step_status(row.try_get::<String, _>("status")?.as_str()),
        // The column is CHECK (quorum >= 1), so a negative value cannot be
        // stored; clamping rather than erroring keeps a corrupted row from
        // taking a whole inbox down, and a quorum of 1 is the safe reading.
        quorum: u32::try_from(quorum).unwrap_or(1).max(1),
        requires_witness: row.try_get("requires_witness")?,
        decisions,
        sla_due_at: row.try_get("sla_due_at")?,
    })
}

/// Whether this user is one of the resolved approvers for the live step.
///
/// A set membership against `approval_step_assignees`, not a rule evaluation.
/// The rule ran once when the step activated; asking it again per decision
/// would let a mid-flight change to a role silently move who was allowed to
/// decide a request that was already in front of somebody.
async fn actor_standing(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    step_id: Uuid,
    actor_id: Uuid,
    is_bypass_role: bool,
) -> Result<Actor, StoreError> {
    let row = sqlx::query(
        "SELECT via_delegation_id FROM approval_step_assignees \
         WHERE step_id = $1 AND tenant_id = $2 AND user_id = $3",
    )
    .bind(step_id)
    .bind(tenant_id)
    .bind(actor_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(Actor {
        user_id: actor_id,
        is_assigned: row.is_some(),
        is_bypass_role,
        via_delegation: row
            .and_then(|r| r.try_get("via_delegation_id").ok())
            .flatten(),
    })
}

// ── enum decoding ───────────────────────────────────────────────────────────
//
// Read as `::text` and mapped here rather than deriving `sqlx::Type`, because
// the runtime query API is the house style and a derive would pull the macro
// path in for three enums.
//
// The fallbacks are deliberately the *safe* reading rather than a panic: an
// unknown status is treated as one that cannot be decided, and an unknown
// decision as an abstention, so a value this build does not recognise can
// never be counted as an approval.

fn parse_request_status(raw: &str) -> RequestStatus {
    match raw {
        "draft" => RequestStatus::Draft,
        "pending" => RequestStatus::Pending,
        "approved" => RequestStatus::Approved,
        "rejected" => RequestStatus::Rejected,
        "cancelled" => RequestStatus::Cancelled,
        "revoked" => RequestStatus::Revoked,
        // Includes "expired" and anything a newer migration adds.
        _ => RequestStatus::Expired,
    }
}

fn parse_step_status(raw: &str) -> StepStatus {
    match raw {
        "active" => StepStatus::Active,
        "approved" => StepStatus::Approved,
        "rejected" => StepStatus::Rejected,
        "skipped" => StepStatus::Skipped,
        _ => StepStatus::Waiting,
    }
}

fn parse_decision(raw: &str) -> medbrains_approvals_core::Decision {
    use medbrains_approvals_core::Decision;
    match raw {
        "approve" => Decision::Approve,
        "reject" => Decision::Reject,
        _ => Decision::Abstain,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{parse_decision, parse_request_status, parse_step_status};
    use medbrains_approvals_core::{Decision, RequestStatus, StepStatus};

    #[test]
    fn known_statuses_round_trip() {
        assert_eq!(parse_request_status("pending"), RequestStatus::Pending);
        assert_eq!(parse_request_status("approved"), RequestStatus::Approved);
        assert_eq!(parse_request_status("rejected"), RequestStatus::Rejected);
        assert_eq!(parse_step_status("active"), StepStatus::Active);
        assert_eq!(parse_decision("approve"), Decision::Approve);
    }

    #[test]
    fn an_unrecognised_status_is_read_as_undecidable() {
        // A value written by a newer build must never open a request this
        // build would otherwise refuse to touch. Expired is terminal, so the
        // unknown case fails closed.
        assert!(parse_request_status("some_future_state").is_terminal());
        assert_eq!(parse_step_status("some_future_state"), StepStatus::Waiting);
    }

    #[test]
    fn an_unrecognised_decision_never_counts_as_an_approval() {
        // The one that matters: if a future decision kind were read as
        // `Approve`, an unknown value would silently satisfy a quorum.
        assert_eq!(parse_decision("some_future_kind"), Decision::Abstain);
        assert_eq!(parse_decision(""), Decision::Abstain);
    }
}

//! Deciding a request: judge, write, then let the domain act.
//!
//! The order matters and is the same every time:
//!
//! 1. load the state the controls need;
//! 2. ask the core whether this decision is allowed — it is pure, so this
//!    costs nothing and cannot touch the database;
//! 3. write the decision, with every assumption from step 2 restated in the
//!    `WHERE` clause;
//! 4. if the request is now settled, run the domain effect.
//!
//! All four share one transaction, owned by the caller. Step 4 failing undoes
//! steps 1–3, which is the only acceptable arrangement: a request marked
//! approved next to a permission that was never granted is a lie that nothing
//! would ever correct.

use medbrains_approvals_core::{Decision, Outcome, controls};
use medbrains_approvals_store::{RecordDecision, decide, load};
use uuid::Uuid;

use crate::error::EngineError;
use crate::plug::{EffectContext, Registry, Tx};

/// One person's decision on one request.
#[derive(Debug, Clone)]
pub struct DecisionInput {
    pub tenant_id: Uuid,
    pub request_id: Uuid,
    pub actor_id: Uuid,
    /// From the caller's session, not from the request body.
    pub actor_is_bypass_role: bool,
    pub decision: Decision,
    pub note: Option<String>,
    pub witnessed_by: Option<Uuid>,
    /// The stage the client believed was live when it rendered the page.
    ///
    /// Supplied by the client on purpose. Reading the current stage and then
    /// acting on it would make every decision unconditionally succeed against
    /// whatever the state happened to be, which is the defect this platform
    /// exists to remove.
    pub expected_step_seq: i32,
}

/// What happened.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decided {
    /// The request's status afterwards.
    pub status: String,
    /// What the core concluded, for the caller to render — "1 of 2 approvals".
    pub outcome: Outcome,
    /// Whether a domain effect ran.
    pub effect_applied: bool,
}

/// Record a decision and apply its consequences.
///
/// # Errors
/// A [`ControlViolation`](medbrains_approvals_core::ControlViolation) if a
/// control refuses, [`EngineError::UnregisteredEffect`] if the request type
/// names an effect nothing implements, or whatever the domain effect returns.
pub async fn decide_request(
    tx: &mut Tx<'_>,
    registry: &Registry,
    input: &DecisionInput,
) -> Result<Decided, EngineError> {
    let context = load::decision_context(
        tx,
        input.tenant_id,
        input.request_id,
        input.actor_id,
        input.actor_is_bypass_role,
    )
    .await?;

    // Pure, and therefore cheap enough to run before touching anything.
    let outcome = controls::evaluate(
        &context.request,
        &context.step,
        &context.actor,
        input.decision,
        input.witnessed_by,
        input.expected_step_seq,
    )?;

    // Resolve the handler *before* writing anything.
    //
    // A request type naming an effect this server does not implement must fail
    // the whole decision, not approve and quietly do nothing. Checking after
    // the write would leave the approval recorded and the effect missing.
    let effect_key = effect_key_for(tx, input.tenant_id, input.request_id).await?;
    let settles = matches!(
        outcome,
        Outcome::RequestApproved | Outcome::AdvanceToNextStep | Outcome::RequestRejected
    );
    let handler = if settles {
        let handler = registry.effect(effect_key.as_deref());
        if handler.is_none() && effect_key.is_some() {
            return Err(EngineError::UnregisteredEffect {
                kind: context.request.kind.clone(),
                effect_key: effect_key.unwrap_or_default(),
            });
        }
        handler
    } else {
        None
    };

    let record = RecordDecision {
        tenant_id: input.tenant_id,
        request_id: input.request_id,
        step_id: context.step.id,
        expected_step_seq: input.expected_step_seq,
        actor_id: input.actor_id,
        decision: input.decision,
        note: input.note.clone(),
        witnessed_by: input.witnessed_by,
        via_delegation_id: context.actor.via_delegation,
    };
    let status = decide::record(tx, &record, outcome).await?;

    // The effect runs only once the request is actually settled — not when a
    // stage merely advances, and not when a quorum is still short.
    let mut effect_applied = false;
    if let Some(handler) = handler {
        let ctx = effect_context(tx, input, &context.request.kind).await?;
        match status {
            "approved" => {
                // Re-validated here, against the state as it is now. The
                // check at raise time was against a world that has since
                // moved: stock consumed, an attendance record appeared, a
                // unit cross-matched to somebody else.
                handler.validate(tx, &ctx).await?;
                handler.on_approved(tx, &ctx).await?;
                effect_applied = true;
            }
            "rejected" => {
                handler.on_rejected(tx, &ctx).await?;
                effect_applied = true;
            }
            _ => {}
        }
    }

    Ok(Decided {
        status: status.to_owned(),
        outcome,
        effect_applied,
    })
}

/// The `effect_key` configured on this request's type, if any.
async fn effect_key_for(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<Option<String>, EngineError> {
    let key: Option<Option<String>> = sqlx::query_scalar(
        "SELECT t.effect_key FROM approval_requests r \
         JOIN request_types t ON t.id = r.request_type_id AND t.tenant_id = r.tenant_id \
         WHERE r.id = $1 AND r.tenant_id = $2",
    )
    .bind(request_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(key.flatten())
}

async fn effect_context(
    tx: &mut Tx<'_>,
    input: &DecisionInput,
    kind: &str,
) -> Result<EffectContext, EngineError> {
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT requester_id, on_behalf_of_id, subject_type, subject_id, payload \
         FROM approval_requests WHERE id = $1 AND tenant_id = $2",
    )
    .bind(input.request_id)
    .bind(input.tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    Ok(EffectContext {
        tenant_id: input.tenant_id,
        request_id: input.request_id,
        kind: kind.to_owned(),
        requester_id: row.try_get("requester_id")?,
        on_behalf_of_id: row.try_get("on_behalf_of_id")?,
        subject_type: row.try_get("subject_type")?,
        subject_id: row.try_get("subject_id")?,
        payload: row.try_get("payload")?,
        decided_by: input.actor_id,
    })
}

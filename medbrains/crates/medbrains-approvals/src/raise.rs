//! Raising a request: choose the chain, write it down, open the first stage.
//!
//! The chain is copied from the workflow into `approval_steps` rather than
//! referenced. A policy edited next month must not rewrite what happened last
//! month, and an audit years later has to read what actually ran, not what the
//! configuration says today.
//!
//! Almost everything here is a reason to refuse. A request that reaches an
//! inbox is a request somebody can act on; the failures worth catching all
//! happen before that:
//!
//! * a workflow with no stages;
//! * an approver rule the server cannot parse;
//! * a first stage that resolves to nobody;
//! * a request type naming an effect nothing implements.
//!
//! Every one of those produces a request that sits forever while everyone
//! assumes it is somebody else's turn. Refusing at the desk, where a person is
//! present to read the message, is the whole point.

use medbrains_approvals_core::{ApproverRule, conditions};
use serde_json::Value;
use sqlx::Row;
use uuid::Uuid;

use crate::directory::{self, ResolutionContext};
use crate::error::EngineError;
use crate::plug::{EffectContext, Registry, Tx};

/// A new request.
#[derive(Debug, Clone)]
pub struct RaiseInput {
    pub tenant_id: Uuid,
    /// The request type's `code`, e.g. `hr.leave`.
    pub kind: String,
    pub requester_id: Uuid,
    pub on_behalf_of_id: Option<Uuid>,
    pub reason: String,
    pub payload: Value,
    pub subject_type: Option<String>,
    pub subject_id: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Raised {
    pub request_id: Uuid,
    pub workflow_id: Uuid,
    pub steps: i32,
    /// Who the first stage went to. Empty only for a non-human first stage.
    pub first_step_assignees: Vec<Uuid>,
}

/// Create a request and open its first stage.
///
/// # Errors
/// [`EngineError::Domain`] for a misconfigured type or chain, whatever the
/// domain's `validate` returns, and database errors.
pub async fn raise_request(
    tx: &mut Tx<'_>,
    registry: &Registry,
    input: &RaiseInput,
) -> Result<Raised, EngineError> {
    let request_type = load_type(tx, input).await?;

    // Refuse before writing anything if the type names an effect this server
    // does not implement. Otherwise the request collects its approvals and
    // then does nothing, while everyone involved believes it worked.
    if !registry.can_satisfy(request_type.effect_key.as_deref()) {
        return Err(EngineError::UnregisteredEffect {
            kind: input.kind.clone(),
            effect_key: request_type.effect_key.unwrap_or_default(),
        });
    }

    let workflow = select_workflow(tx, &request_type, &input.payload).await?;
    let steps = load_workflow_steps(tx, input.tenant_id, workflow.id).await?;
    if steps.is_empty() {
        return Err(EngineError::Domain(format!(
            "the approval chain for '{}' has no stages, so nothing could ever decide it",
            input.kind
        )));
    }

    // Parse every rule up front. A chain whose third stage is unreadable must
    // not be discovered three approvals in, by which point two people have
    // already spent their attention on it.
    let rules = steps
        .iter()
        .map(|step| {
            ApproverRule::parse(&step.approver_rule).map_err(|error| {
                EngineError::Domain(format!(
                    "stage {} ('{}') of '{}' is misconfigured: {error}",
                    step.seq, step.name, input.kind
                ))
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    // Domain preconditions, before the request exists. Checked again before
    // the final approval commits, because the world moves in between.
    let request_id = Uuid::new_v4();
    if let Some(effect) = registry.effect(request_type.effect_key.as_deref()) {
        let ctx = EffectContext {
            tenant_id: input.tenant_id,
            request_id,
            kind: input.kind.clone(),
            requester_id: input.requester_id,
            on_behalf_of_id: input.on_behalf_of_id,
            subject_type: input.subject_type.clone(),
            subject_id: input.subject_id,
            payload: input.payload.clone(),
            decided_by: input.requester_id,
        };
        effect.validate(tx, &ctx).await?;
    }

    insert_request(tx, request_id, input, &request_type, workflow.id).await?;
    insert_steps(tx, request_id, input.tenant_id, &steps).await?;

    let assignees = open_first_step(tx, request_id, input, &steps[0], &rules[0]).await?;

    Ok(Raised {
        request_id,
        workflow_id: workflow.id,
        steps: i32::try_from(steps.len()).unwrap_or(i32::MAX),
        first_step_assignees: assignees,
    })
}

/// Resolve and record who decides the first stage.
///
/// A human stage that resolves to nobody is refused. That is the failure this
/// whole module is arranged around: a request in a queue nobody owns looks
/// identical to one that is merely waiting, and it will sit there until
/// somebody chases it on paper.
async fn open_first_step(
    tx: &mut Tx<'_>,
    request_id: Uuid,
    input: &RaiseInput,
    step: &WorkflowStep,
    rule: &ApproverRule,
) -> Result<Vec<Uuid>, EngineError> {
    sqlx::query(
        "UPDATE approval_steps \
         SET status = 'active'::approval_step_status, activated_at = now(), updated_at = now() \
         WHERE request_id = $1 AND tenant_id = $2 AND seq = $3",
    )
    .bind(request_id)
    .bind(input.tenant_id)
    .bind(step.seq)
    .execute(&mut **tx)
    .await?;

    if !rule.is_human() {
        // External or automatic: nobody opens an inbox for it, and leaving it
        // waiting for somebody to do so would strand the request.
        return Ok(Vec::new());
    }

    let ctx = ResolutionContext {
        tenant_id: input.tenant_id,
        requester_id: input.requester_id,
        on_behalf_of_id: input.on_behalf_of_id,
    };
    let assignees = directory::resolve(tx, rule, &ctx).await?;
    if assignees.is_empty() {
        return Err(EngineError::Domain(format!(
            "stage {} ('{}') has no eligible approver — the rule matches nobody, or matches only \
             the person asking",
            step.seq, step.name
        )));
    }

    for user_id in &assignees {
        sqlx::query(
            "INSERT INTO approval_step_assignees (tenant_id, step_id, request_id, user_id) \
             SELECT $1, s.id, $2, $3 FROM approval_steps s \
             WHERE s.request_id = $2 AND s.tenant_id = $1 AND s.seq = $4 \
             ON CONFLICT (step_id, user_id) DO NOTHING",
        )
        .bind(input.tenant_id)
        .bind(request_id)
        .bind(user_id)
        .bind(step.seq)
        .execute(&mut **tx)
        .await?;
    }

    Ok(assignees)
}

// ── loading configuration ───────────────────────────────────────────────────

#[derive(Debug)]
struct RequestTypeRow {
    id: Uuid,
    effect_key: Option<String>,
    default_workflow_id: Option<Uuid>,
    requires_justification: bool,
}

#[derive(Debug)]
struct WorkflowRow {
    id: Uuid,
}

#[derive(Debug)]
struct WorkflowStep {
    seq: i32,
    name: String,
    approver_rule: Value,
    quorum: i32,
    requires_witness: bool,
}

async fn load_type(tx: &mut Tx<'_>, input: &RaiseInput) -> Result<RequestTypeRow, EngineError> {
    let row = sqlx::query(
        "SELECT id, effect_key, default_workflow_id, requires_justification \
         FROM request_types \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true AND deleted_at IS NULL",
    )
    .bind(input.tenant_id)
    .bind(&input.kind)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| EngineError::Domain(format!("'{}' is not a request type here", input.kind)))?;

    let request_type = RequestTypeRow {
        id: row.try_get("id")?,
        effect_key: row.try_get("effect_key")?,
        default_workflow_id: row.try_get("default_workflow_id")?,
        requires_justification: row.try_get("requires_justification")?,
    };

    if request_type.requires_justification && input.reason.trim().is_empty() {
        return Err(EngineError::Domain(
            "this request needs a reason before it can be raised".to_owned(),
        ));
    }
    Ok(request_type)
}

/// The first active workflow whose conditions hold, newest version first.
///
/// Ordering by version descending means a newly published chain takes effect
/// for new requests without touching the ones already in flight, which pinned
/// their workflow when they were raised.
async fn select_workflow(
    tx: &mut Tx<'_>,
    request_type: &RequestTypeRow,
    payload: &Value,
) -> Result<WorkflowRow, EngineError> {
    let rows = sqlx::query(
        "SELECT id, conditions FROM approval_workflows \
         WHERE request_type_id = $1 AND is_active = true AND deleted_at IS NULL \
           AND effective_from <= now() \
         ORDER BY version DESC",
    )
    .bind(request_type.id)
    .fetch_all(&mut **tx)
    .await?;

    for row in &rows {
        let conditions: Value = row.try_get("conditions")?;
        if conditions::matches(&conditions, payload) {
            return Ok(WorkflowRow {
                id: row.try_get("id")?,
            });
        }
    }

    // Nothing matched. The type's declared default is the fallback, and if it
    // has none, this is a configuration gap rather than a user error.
    request_type
        .default_workflow_id
        .map(|id| WorkflowRow { id })
        .ok_or_else(|| {
            EngineError::Domain(
                "no approval chain applies to this request, and the request type has no default \
                 chain configured"
                    .to_owned(),
            )
        })
}

async fn load_workflow_steps(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    workflow_id: Uuid,
) -> Result<Vec<WorkflowStep>, EngineError> {
    sqlx::query(
        "SELECT seq, name, approver_rule, quorum, requires_witness \
         FROM approval_workflow_steps \
         WHERE workflow_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY seq",
    )
    .bind(workflow_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .map(|row| {
        Ok(WorkflowStep {
            seq: row.try_get("seq")?,
            name: row.try_get("name")?,
            approver_rule: row.try_get("approver_rule")?,
            quorum: row.try_get("quorum")?,
            requires_witness: row.try_get("requires_witness")?,
        })
    })
    .collect::<Result<Vec<_>, sqlx::Error>>()
    .map_err(EngineError::from)
}

// ── writing ─────────────────────────────────────────────────────────────────

async fn insert_request(
    tx: &mut Tx<'_>,
    request_id: Uuid,
    input: &RaiseInput,
    request_type: &RequestTypeRow,
    workflow_id: Uuid,
) -> Result<(), EngineError> {
    sqlx::query(
        "INSERT INTO approval_requests \
           (id, tenant_id, request_type_id, kind, subject_type, subject_id, requester_id, \
            on_behalf_of_id, reason, payload, workflow_id, status, current_step_seq, \
            submitted_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, \
                 'pending'::approval_request_status, 1, now(), $7)",
    )
    .bind(request_id)
    .bind(input.tenant_id)
    .bind(request_type.id)
    .bind(&input.kind)
    .bind(input.subject_type.as_deref())
    .bind(input.subject_id)
    .bind(input.requester_id)
    .bind(input.on_behalf_of_id)
    .bind(&input.reason)
    .bind(&input.payload)
    .bind(workflow_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Copy the chain onto the request.
///
/// One statement with `UNNEST` rather than a loop: a twenty-stage chain would
/// otherwise be twenty round trips to write something the database can insert
/// in one.
async fn insert_steps(
    tx: &mut Tx<'_>,
    request_id: Uuid,
    tenant_id: Uuid,
    steps: &[WorkflowStep],
) -> Result<(), EngineError> {
    let seqs: Vec<i32> = steps.iter().map(|s| s.seq).collect();
    let names: Vec<String> = steps.iter().map(|s| s.name.clone()).collect();
    let rules: Vec<Value> = steps.iter().map(|s| s.approver_rule.clone()).collect();
    let quorums: Vec<i32> = steps.iter().map(|s| s.quorum).collect();
    let witnesses: Vec<bool> = steps.iter().map(|s| s.requires_witness).collect();

    sqlx::query(
        "INSERT INTO approval_steps \
           (tenant_id, request_id, seq, name, approver_rule, quorum, requires_witness) \
         SELECT $1, $2, s.seq, s.name, s.rule, s.quorum, s.witness \
         FROM UNNEST($3::int[], $4::text[], $5::jsonb[], $6::int[], $7::bool[]) \
              AS s(seq, name, rule, quorum, witness)",
    )
    .bind(tenant_id)
    .bind(request_id)
    .bind(&seqs)
    .bind(&names)
    .bind(&rules)
    .bind(&quorums)
    .bind(&witnesses)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

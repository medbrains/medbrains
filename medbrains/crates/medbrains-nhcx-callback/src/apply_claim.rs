//! A payer's answer about a claim: `claim/on_submit` (and a pre-auth sent
//! from the claim desk), and the replies to the hospital's Tasks —
//! `task/on_submit` and `on_status` (or the base protocol's `hcx/on_status`,
//! `hcx/on_search`, `claim/on_cancel`, `claim/on_reprocess`).

use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::apply::{DECISION_SQL, Inbound, Matched, Tx, preauth_by_id};
use crate::parse::{self, Decision};
use crate::parse_claim::{self, TaskResult};

/// Statuses the payer's later answers no longer move.
const CLOSED: &str = "('settled', 'partially_settled', 'cancelled')";

/// `insurance_claims.status` for the payer's answer; `None` leaves it. A
/// query, an acknowledgement, an error or an unreadable answer decides
/// nothing about the claim — the desk sees it as `nhcx_decision`.
fn claim_status(is_claim: bool, decision: Decision) -> Option<&'static str> {
    Some(match (is_claim, decision) {
        (true, Decision::Approved | Decision::PartiallyApproved) => "claim_approved",
        (true, Decision::Rejected) => "claim_rejected",
        (false, Decision::Approved | Decision::PartiallyApproved) => "pre_auth_approved",
        (false, Decision::Rejected) => "pre_auth_rejected",
        (_, Decision::Cancelled) => "cancelled",
        _ => return None,
    })
}

/// `claim/on_submit` (or a pre-auth answer for the claim desk): the claim
/// this payer was sent with this correlation id.
pub(crate) async fn claim(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let found: Option<(Uuid, Option<String>)> = sqlx::query_as(
        "SELECT id, nhcx_use FROM insurance_claims \
          WHERE tenant_id = $1 AND nhcx_correlation_id = $2 AND nhcx_recipient_code = $3 \
            AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(m.tenant_id)
    .bind(m.correlation_id)
    .bind(m.sender)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((id, use_)) = found else {
        return Ok(None);
    };
    apply_response(tx, m, id, use_.as_deref()).await?;
    Ok(Some(("insurance_claims", id)))
}

/// Land a ClaimResponse on a claim: the payload, the approved amount, the
/// authorisation number, and — for a final claim — the adjudication line
/// by line.
pub(crate) async fn apply_response(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
    claim_id: Uuid,
    sent_use: Option<&str>,
) -> Result<(), AppError> {
    let adj = parse_claim::adjudication(m.response);
    let is_claim = adj.as_ref().and_then(|a| a.use_.as_deref()).or(sent_use) == Some("claim");
    let outcome = parse::outcome(m.response);
    let approved =
        parse::approved_amount(m.response).or_else(|| adj.as_ref().and_then(|a| a.approved));
    let decision = parse::decision(m.response, m.workflow_id, m.status, None);
    let status = claim_status(is_claim, decision);
    // A query's benefit total is not an approval; only an approval's is.
    let approved = approved.filter(|_| decision.is_approval());
    let stored = match adj.as_ref().filter(|_| is_claim) {
        Some(a) => Some(
            serde_json::to_value(a)
                .map_err(|e| AppError::Internal(format!("adjudication: {e}")))?,
        ),
        None => None,
    };
    let sql = format!(
        "UPDATE insurance_claims SET nhcx_response_payload = $1, nhcx_response_at = now(), \
                nhcx_status = $2, nhcx_outcome = COALESCE($3, nhcx_outcome), \
                approved_amount = COALESCE($4, approved_amount), \
                nhcx_pre_auth_ref = COALESCE($5, nhcx_pre_auth_ref), \
                nhcx_adjudication = COALESCE($6, nhcx_adjudication), \
                nhcx_adjudicated_at = CASE WHEN $6::jsonb IS NULL THEN nhcx_adjudicated_at ELSE now() END, \
                status = CASE WHEN status IN {CLOSED} THEN status ELSE COALESCE($7, status) END, \
                nhcx_decision = {decision_sql}, updated_at = now() \
          WHERE id = $8 AND tenant_id = $9",
        decision_sql = DECISION_SQL.replace("$D", "$10")
    );
    sqlx::query(&sql)
        .bind(m.response)
        .bind(m.status)
        .bind(&outcome)
        .bind(approved)
        .bind(parse::pre_auth_ref(m.response))
        .bind(stored)
        .bind(status)
        .bind(claim_id)
        .bind(m.tenant_id)
        .bind(decision.as_str())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

#[derive(Debug, sqlx::FromRow)]
struct TaskRow {
    id: Uuid,
    kind: String,
    insurance_claim_id: Option<Uuid>,
    prior_auth_id: Option<Uuid>,
}

/// The Task a reply answers: by correlation id, else — under the base
/// protocol, where the workflow id is the case's thread — the Task it names.
async fn find_task(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Option<TaskRow>, AppError> {
    Ok(sqlx::query_as::<_, TaskRow>(
        "SELECT id, kind, insurance_claim_id, prior_auth_id FROM nhcx_tasks \
          WHERE tenant_id = $1 AND recipient_code = $2 AND deleted_at IS NULL \
            AND nhcx_correlation_id = $3 \
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(m.correlation_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Name the claims here that a payer's answer lists — one query for all.
async fn match_found(
    tx: &mut Tx<'_>,
    m: &Inbound<'_>,
    result: &mut TaskResult,
) -> Result<(), AppError> {
    let refs: Vec<String> = result
        .claims
        .iter()
        .filter_map(|c| c.claim_ref.clone())
        .collect();
    if refs.is_empty() {
        return Ok(());
    }
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, r FROM insurance_claims, unnest($3::text[]) AS r \
          WHERE tenant_id = $1 AND nhcx_recipient_code = $2 AND deleted_at IS NULL \
            AND (claim_number = r OR id::text = r)",
    )
    .bind(m.tenant_id)
    .bind(m.sender)
    .bind(&refs)
    .fetch_all(&mut **tx)
    .await?;
    let by_ref: std::collections::HashMap<String, Uuid> =
        rows.into_iter().map(|(id, r)| (r, id)).collect();
    for c in &mut result.claims {
        c.matched_claim_id = c.claim_ref.as_ref().and_then(|r| by_ref.get(r).copied());
    }
    Ok(())
}

/// A reply to one of the hospital's Tasks.
pub(crate) async fn task(tx: &mut Tx<'_>, m: &Inbound<'_>) -> Result<Matched, AppError> {
    let Some(t) = find_task(tx, m).await? else {
        return Ok(None);
    };
    let mut result = parse_claim::task_result(m.response);
    match_found(tx, m, &mut result).await?;
    let stored = serde_json::to_value(&result)
        .map_err(|e| AppError::Internal(format!("task result: {e}")))?;
    sqlx::query(
        "UPDATE nhcx_tasks SET result = $1, nhcx_status = $2, nhcx_response_at = now() \
          WHERE id = $3 AND tenant_id = $4",
    )
    .bind(&stored)
    .bind(m.status)
    .bind(t.id)
    .bind(m.tenant_id)
    .execute(&mut **tx)
    .await?;
    let carries_answer = parse_claim::adjudication(m.response).is_some();
    match (t.insurance_claim_id, t.prior_auth_id) {
        (Some(claim_id), _) => {
            if t.kind == "cancel" && result.task_status.as_deref() == Some("completed") {
                cancel(tx, m, claim_id).await?;
            } else if carries_answer && t.kind != "search" {
                apply_response(tx, m, claim_id, None).await?;
            }
            Ok(Some(("insurance_claims", claim_id)))
        }
        (None, Some(pa_id)) => {
            if carries_answer {
                preauth_by_id(tx, m, pa_id).await?;
            }
            Ok(Some(("prior_auth_requests", pa_id)))
        }
        (None, None) => Ok(Some(("nhcx_tasks", t.id))),
    }
}

/// The payer agreed to cancel the claim. A claim it has already paid stays
/// as it is — money received is not undone by a cancellation.
async fn cancel(tx: &mut Tx<'_>, m: &Inbound<'_>, claim_id: Uuid) -> Result<(), AppError> {
    let sql = format!(
        "UPDATE insurance_claims SET status = 'cancelled', nhcx_status = $1, updated_at = now() \
          WHERE id = $2 AND tenant_id = $3 AND status NOT IN {CLOSED}"
    );
    sqlx::query(&sql)
        .bind(m.status)
        .bind(claim_id)
        .bind(m.tenant_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_decision_moves_the_claim() {
        assert_eq!(
            claim_status(true, Decision::Approved),
            Some("claim_approved")
        );
        assert_eq!(
            claim_status(true, Decision::PartiallyApproved),
            Some("claim_approved")
        );
        assert_eq!(
            claim_status(true, Decision::Rejected),
            Some("claim_rejected")
        );
        assert_eq!(
            claim_status(false, Decision::Approved),
            Some("pre_auth_approved")
        );
        assert_eq!(claim_status(true, Decision::Cancelled), Some("cancelled"));
        for d in [
            Decision::Queried,
            Decision::Received,
            Decision::Error,
            Decision::Unknown,
        ] {
            assert_eq!(claim_status(true, d), None, "{d:?} must not move the claim");
        }
    }
}

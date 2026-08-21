//! Reading requests: the approver's queue, and the requester's own list.
//!
//! The inbox is the screen every employee opens, so it is the one query in
//! this platform whose shape matters. It reads `approval_step_assignees`,
//! which the engine wrote when the stage activated, rather than evaluating
//! approver rules per candidate row — an index-only scan instead of a rule
//! engine run.
//!
//! Everything here is scoped by the tenant context set on the transaction, so
//! RLS applies to every read even though the queries do not name `tenant_id`
//! in a filter of their own.

use axum::extract::State;
use medbrains_core::permissions;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Serialize;
use sqlx::Row;
use uuid::Uuid;

use crate::ListQuery;

/// Enough to render a row in a list. Deliberately not the whole request:
/// the payload and the decision history are only needed on the detail screen,
/// and fetching them per row is how a list becomes slow.
#[derive(Debug, Serialize)]
pub struct RequestSummary {
    pub id: Uuid,
    pub kind: String,
    pub status: String,
    pub reason: String,
    pub requester_id: Uuid,
    pub current_step_seq: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub sla_due_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct StepView {
    pub seq: i32,
    pub name: String,
    pub status: String,
    pub quorum: i32,
    pub requires_witness: bool,
    pub decisions: Vec<DecisionView>,
}

#[derive(Debug, Serialize)]
pub struct DecisionView {
    pub actor_id: Uuid,
    pub decision: String,
    pub note: Option<String>,
    pub witnessed_by: Option<Uuid>,
    pub signed_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct RequestDetail {
    #[serde(flatten)]
    pub summary: RequestSummary,
    pub payload: serde_json::Value,
    pub on_behalf_of_id: Option<Uuid>,
    pub steps: Vec<StepView>,
}

const SUMMARY_COLUMNS: &str = "id, kind, status::text AS status, reason, requester_id, \
                               current_step_seq, created_at, sla_due_at";

fn summary_from(row: &sqlx::postgres::PgRow) -> Result<RequestSummary, sqlx::Error> {
    Ok(RequestSummary {
        id: row.try_get("id")?,
        kind: row.try_get("kind")?,
        status: row.try_get("status")?,
        reason: row.try_get("reason")?,
        requester_id: row.try_get("requester_id")?,
        current_step_seq: row.try_get("current_step_seq")?,
        created_at: row.try_get("created_at")?,
        sla_due_at: row.try_get("sla_due_at")?,
    })
}

/// What is awaiting this user's decision.
///
/// # Errors
/// Database errors.
pub async fn awaiting_me(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<axum::Json<Vec<RequestSummary>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The join is to `approval_step_assignees`, which is why this is a scan of
    // a composite index rather than an evaluation of every live approver rule.
    let rows = sqlx::query(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM approval_requests r \
         WHERE r.status = 'pending' AND r.deleted_at IS NULL \
           AND EXISTS ( \
                 SELECT 1 FROM approval_step_assignees a \
                 WHERE a.request_id = r.id AND a.tenant_id = r.tenant_id \
                   AND a.user_id = $1) \
         ORDER BY r.sla_due_at NULLS LAST, r.created_at \
         LIMIT 200"
    ))
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    let out = rows
        .iter()
        .map(summary_from)
        .collect::<Result<Vec<_>, _>>()?;
    tx.commit().await?;
    Ok(axum::Json(out))
}

/// What this user has asked for.
///
/// # Errors
/// Database errors.
pub async fn raised_by_me(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<axum::Json<Vec<RequestSummary>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Covered by idx_approval_requests_requester.
    let rows = sqlx::query(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM approval_requests r \
         WHERE r.requester_id = $1 AND r.deleted_at IS NULL \
         ORDER BY r.created_at DESC LIMIT 200"
    ))
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    let out = rows
        .iter()
        .map(summary_from)
        .collect::<Result<Vec<_>, _>>()?;
    tx.commit().await?;
    Ok(axum::Json(out))
}

/// The rows a caller may see when they are not overseeing the whole queue.
///
/// A request names what somebody asked for — a role, a permission, time off —
/// so the queue is a directory of who wanted what. Reading it should require
/// either a stake in the request or an explicit oversight grant.
///
/// Three ways to have a stake: you raised it, it is about you, or you are an
/// approver on it. Written as SQL rather than filtered in Rust so the `LIMIT`
/// still means a page of *visible* rows — filtering after the fact would
/// return a short page and look like the end of the list.
/// Takes the placeholder number because the two callers bind the caller in
/// different positions — a constant with `$4` baked in silently compared the
/// user id against the wrong parameter in `detail`.
fn visible_to_caller(placeholder: u8) -> String {
    format!(
        "(r.requester_id = ${placeholder} OR r.on_behalf_of_id = ${placeholder} \
          OR EXISTS (SELECT 1 FROM approval_step_assignees a \
                     WHERE a.request_id = r.id AND a.tenant_id = r.tenant_id \
                       AND a.user_id = ${placeholder}))"
    )
}

/// Filterable list of requests the caller may see.
///
/// Scoped by [`visible_to_caller`] unless they hold
/// `admin.approvals.oversee`. It previously returned every request in the
/// tenant to anyone with a session.
///
/// # Errors
/// Database errors.
pub async fn list(
    state: &AppState,
    claims: &Claims,
    query: &ListQuery,
) -> Result<Vec<RequestSummary>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // A bounded page, always. An approvals list with no ceiling is a table
    // scan waiting for the tenant that files ten thousand requests.
    let limit = query.limit.unwrap_or(100).clamp(1, 500);

    // Everyone sees their own; only an overseer sees everybody's.
    let oversees = require_permission(claims, permissions::admin::approvals::OVERSEE).is_ok();
    let scope = if oversees {
        "TRUE".to_owned()
    } else {
        visible_to_caller(4)
    };

    let rows = sqlx::query(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM approval_requests r \
         WHERE r.deleted_at IS NULL \
           AND ($1::text IS NULL OR r.kind = $1) \
           AND ($2::text IS NULL OR r.status::text = $2) \
           AND {scope} \
         ORDER BY r.created_at DESC LIMIT $3"
    ))
    .bind(query.kind.as_deref())
    .bind(query.status.as_deref())
    .bind(limit)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    let out = rows
        .iter()
        .map(summary_from)
        .collect::<Result<Vec<_>, _>>()?;
    tx.commit().await?;
    Ok(out)
}

/// One request, with its chain and every decision recorded against it.
///
/// # Errors
/// [`AppError::NotFound`] when no such request exists in this tenant.
pub async fn detail(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
) -> Result<RequestDetail, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Same visibility rule as the list. `NotFound` rather than `Forbidden` on
    // purpose: telling a stranger "this request exists but is not yours" leaks
    // that somebody filed one, which for a permission-escalation or a
    // grievance is most of what an observer wanted to know.
    let oversees = require_permission(claims, permissions::admin::approvals::OVERSEE).is_ok();
    let scope = if oversees {
        "TRUE".to_owned()
    } else {
        visible_to_caller(2)
    };

    let row = sqlx::query(&format!(
        "SELECT {SUMMARY_COLUMNS}, payload, on_behalf_of_id \
         FROM approval_requests r WHERE r.id = $1 AND r.deleted_at IS NULL \
           AND {scope}"
    ))
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Two queries rather than a join: the decisions are a collection per step,
    // and flattening them would return each step once per decision.
    let step_rows = sqlx::query(
        "SELECT id, seq, name, status::text AS status, quorum, requires_witness \
         FROM approval_steps WHERE request_id = $1 ORDER BY seq",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    let decision_rows = sqlx::query(
        "SELECT step_id, actor_id, decision::text AS decision, note, witnessed_by, signed_at \
         FROM approval_decisions WHERE request_id = $1 ORDER BY signed_at",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    let mut by_step: std::collections::HashMap<Uuid, Vec<DecisionView>> =
        std::collections::HashMap::new();
    for decision in &decision_rows {
        by_step
            .entry(decision.try_get("step_id")?)
            .or_default()
            .push(DecisionView {
                actor_id: decision.try_get("actor_id")?,
                decision: decision.try_get("decision")?,
                note: decision.try_get("note")?,
                witnessed_by: decision.try_get("witnessed_by")?,
                signed_at: decision.try_get("signed_at")?,
            });
    }

    let mut steps = Vec::with_capacity(step_rows.len());
    for step in &step_rows {
        let step_id: Uuid = step.try_get("id")?;
        steps.push(StepView {
            seq: step.try_get("seq")?,
            name: step.try_get("name")?,
            status: step.try_get("status")?,
            quorum: step.try_get("quorum")?,
            requires_witness: step.try_get("requires_witness")?,
            decisions: by_step.remove(&step_id).unwrap_or_default(),
        });
    }

    let detail = RequestDetail {
        summary: summary_from(&row)?,
        payload: row.try_get("payload")?,
        on_behalf_of_id: row.try_get("on_behalf_of_id")?,
        steps,
    };
    tx.commit().await?;
    Ok(detail)
}

#[cfg(test)]
mod tests {
    use super::visible_to_caller;

    /// The two callers bind the caller id in different positions, and a
    /// constant with `$4` baked in compared it against `LIMIT` in `detail`.
    /// That kind of mistake produces a query that still runs.
    #[test]
    fn the_placeholder_follows_the_bind_position() {
        let list = visible_to_caller(4);
        let detail = visible_to_caller(2);

        assert_eq!(
            list.matches("$4").count(),
            3,
            "all three comparisons use it"
        );
        assert!(
            !list.contains("$2"),
            "list must not reference the detail slot"
        );

        assert_eq!(detail.matches("$2").count(), 3);
        assert!(
            !detail.contains("$4"),
            "detail must not reference the list slot"
        );
    }

    /// Three ways to have a stake. Dropping one silently narrows who can see
    /// their own request, which reads as data loss rather than a permission
    /// change.
    #[test]
    fn every_stake_is_checked() {
        let sql = visible_to_caller(1);
        for stake in [
            "r.requester_id",
            "r.on_behalf_of_id",
            "approval_step_assignees",
        ] {
            assert!(
                sql.contains(stake),
                "{stake} is missing from the visibility rule"
            );
        }
        assert!(
            sql.contains("a.tenant_id = r.tenant_id"),
            "the assignee subquery must stay inside the tenant",
        );
    }
}

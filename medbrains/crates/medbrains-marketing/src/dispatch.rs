//! Starting an outreach run — the sender that did not exist.
//!
//! `mkt_outreach_runs` carried the whole lifecycle since 0975 —
//! `draft → pending_approval → approved → sending → completed`, with a
//! four-eyes CHECK constraint that genuinely works — and nothing ever moved a
//! run past `approved`. No handler, no job, no outbox consumer wrote
//! `sending`, `started_at`, `sent_count` or `failed_count`. An approved run
//! sat in the table forever, looking approved.
//!
//! # It does not talk to a vendor
//!
//! It resolves the gate, mints a ledger row per recipient, and queues through
//! the outbox handlers that already own the vendor call, the retry and the
//! backoff. A marketing-specific dispatcher would be a second delivery
//! pipeline with a second set of retry bugs, and the first one is not even
//! finished being debugged.
//!
//! # It refuses to start on an unresolved recipient
//!
//! [`consent::Sendability::Unknown`] means the gate could not reach an answer.
//! Sending to the recipients that did resolve would silently drop the rest and
//! report a successful run — the outage would look exactly like a cohort that
//! happened to be smaller. So the whole run stops, and says how many it could
//! not decide.
//!
//! # Blocked recipients are rows, not a smaller number
//!
//! Every exclusion is written in the same transaction as the sends. "Why
//! didn't my mother get the reminder" has an answer here and would otherwise
//! have none.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_outbox::queue::{OutboxRow, queue_in_tx};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::consent::{self, SendContext, Sendability};

/// Ceiling on one run. Matches `MAX_COHORT_MEMBERS`: a cohort cannot hold more
/// than this, so a run cannot either, and the bound is stated in both places
/// rather than inferred in one.
const MAX_RECIPIENTS: usize = 5_000;

#[derive(Debug, Serialize)]
pub struct DispatchResult {
    pub run_id: Uuid,
    pub queued: usize,
    pub blocked: usize,
    /// Why each excluded recipient was excluded, counted.
    pub blocked_by_reason: std::collections::HashMap<&'static str, usize>,
}

/// `POST /api/marketing/outreach/{id}/start`
///
/// Materialises the recipient ledger for an approved run and queues it.
///
/// # Errors
/// 403 without `marketing.outreach.dispatch`; 404 if the run is not in this
/// tenant; 409 if it is not approved, if the cohort is empty, or if the gate
/// could not decide about somebody.
pub async fn start_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(run_id): Path<Uuid>,
) -> Result<Json<DispatchResult>, AppError> {
    require_permission(&claims, permissions::marketing::outreach::DISPATCH)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let run: Option<(Uuid, String, String, String, String, Option<Uuid>)> = sqlx::query_as(
        "SELECT cohort_id, status, channel, traffic_class, purpose, campaign_id \
         FROM mkt_outreach_runs WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(run_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((cohort_id, status, channel, traffic_class, purpose, _campaign_id)) = run else {
        return Err(AppError::NotFound);
    };

    if status != "approved" {
        // Not idempotent-by-silence: a second click on a run already sending
        // must say so, because the alternative is an operator wondering
        // whether the first one worked.
        return Err(AppError::Conflict(format!(
            "a run is dispatched from 'approved', and this one is '{status}'"
        )));
    }

    let contact_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT contact_id FROM mkt_cohort_members \
         WHERE cohort_id = $1 AND tenant_id = $2 LIMIT $3",
    )
    .bind(cohort_id)
    .bind(claims.tenant_id)
    .bind(i64::try_from(MAX_RECIPIENTS).unwrap_or(i64::MAX))
    .fetch_all(&mut *tx)
    .await?;

    if contact_ids.is_empty() {
        // An empty cohort is almost always a cohort that was never resolved,
        // and dispatching it would mark the run completed having reached
        // nobody — which reads afterwards as "the campaign failed" rather
        // than "the list was empty".
        return Err(AppError::Conflict(
            "this cohort has no members — re-run it before dispatching".to_owned(),
        ));
    }

    // One round trip for the whole cohort. Never a check per recipient: five
    // thousand round trips on a path an operator is watching.
    let decisions = consent::resolve_sendable(
        &mut tx,
        claims.tenant_id,
        &contact_ids,
        &SendContext {
            channel: &channel,
            purpose: &purpose,
            traffic_class: &traffic_class,
        },
    )
    .await?;

    let unresolved = decisions.unresolved();
    if !unresolved.is_empty() {
        // The whole point of the third outcome. Proceeding would send to the
        // recipients that resolved and drop the rest without saying so.
        return Err(AppError::Conflict(format!(
            "the consent gate could not decide about {} of {} recipients, so \
             nothing was sent — sending to the rest would drop them silently",
            unresolved.len(),
            contact_ids.len()
        )));
    }

    let mut queued = 0usize;
    let mut blocked = 0usize;

    for contact_id in &contact_ids {
        let decision = decisions
            .decisions
            .get(contact_id)
            .unwrap_or(&Sendability::Unknown);

        let (status, address, reason) = match decision {
            Sendability::Sendable { address } => ("queued", Some(address.clone()), None),
            Sendability::Blocked { reason } => ("blocked", None, Some(*reason)),
            // Unreachable — the guard above returns before this — but matched
            // explicitly so a future outcome cannot be silently treated as a
            // send.
            Sendability::Unknown => ("blocked", None, Some(consent::blocked::UNKNOWN)),
        };

        // The ledger row is minted before anything is queued, and its id is
        // the idempotency key, so a retried worker cannot double-send.
        let message_id: Option<Uuid> = sqlx::query_scalar(
            "INSERT INTO mkt_messages \
                (tenant_id, run_id, contact_id, channel, address, traffic_class, \
                 purpose, status, blocked_reason) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
             ON CONFLICT (tenant_id, run_id, contact_id) DO NOTHING \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(run_id)
        .bind(contact_id)
        .bind(&channel)
        .bind(address.as_deref())
        .bind(&traffic_class)
        .bind(&purpose)
        .bind(status)
        .bind(reason)
        .fetch_optional(&mut *tx)
        .await?;

        // Already minted by an earlier attempt: leave it and its outbox event
        // alone rather than queueing a second time.
        let Some(message_id) = message_id else {
            continue;
        };

        if status == "blocked" {
            blocked += 1;
            continue;
        }

        let Some(address) = address else { continue };
        let event_type: &'static str = if channel == "whatsapp" {
            "whatsapp.marketing_outreach"
        } else {
            "sms.marketing_outreach"
        };

        queue_in_tx(
            &mut tx,
            OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "mkt_message",
                aggregate_id: Some(message_id),
                event_type,
                // The body comes from the approved template at send time. This
                // payload carries the address and the run, never the rendered
                // words — see the wall note in 0999.
                payload: json!({ "to": address, "message_id": message_id, "run_id": run_id }),
                idempotency_key: Some(message_id.to_string()),
            },
        )
        .await
        .map_err(|error| AppError::Internal(format!("could not queue the send: {error}")))?;

        queued += 1;
    }

    sqlx::query(
        "UPDATE mkt_outreach_runs SET status = 'sending', started_at = now(), \
                sent_count = $3, failed_count = 0 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(run_id)
    .bind(claims.tenant_id)
    .bind(i32::try_from(queued).unwrap_or(i32::MAX))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DispatchResult {
        run_id,
        queued,
        blocked,
        blocked_by_reason: decisions.blocked_tally(),
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MessageRow {
    pub id: Uuid,
    pub contact_id: Uuid,
    pub display_name: Option<String>,
    /// Last four digits only. A recipient ledger is a list of people who were
    /// messaged; the desk needs to recognise a row, not to redial from it.
    pub address_tail: Option<String>,
    pub status: String,
    pub blocked_reason: Option<String>,
    pub queued_at: chrono::DateTime<chrono::Utc>,
    pub sent_at: Option<chrono::DateTime<chrono::Utc>>,
    pub delivered_at: Option<chrono::DateTime<chrono::Utc>>,
    pub failure_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MessageQuery {
    /// Show only the excluded ones — the question the desk actually opens
    /// this screen to answer.
    pub blocked_only: Option<bool>,
}

/// `GET /api/marketing/outreach/{id}/messages`
///
/// Who a run reached, and why each excluded recipient was excluded.
///
/// Requires `marketing.messages.view` **and**, for a clinical cohort, the
/// permission that defined it. `cohorts.view` promises marketing a cohort's
/// name and size and never its membership, and a clinical recall run's
/// recipient list is exactly that membership — so it is withheld from the
/// marketing role that may see every other run.
///
/// # Errors
/// 403 without the permission, or without `cohorts.clinical_define` on a
/// clinical run; 404 if the run is not in this tenant.
pub async fn list_run_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(run_id): Path<Uuid>,
    Query(q): Query<MessageQuery>,
) -> Result<Json<Vec<MessageRow>>, AppError> {
    require_permission(&claims, permissions::marketing::messages::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let kind: Option<String> = sqlx::query_scalar(
        "SELECT c.criteria_kind FROM mkt_outreach_runs r \
         JOIN mkt_cohorts c ON c.id = r.cohort_id AND c.tenant_id = r.tenant_id \
         WHERE r.id = $1 AND r.tenant_id = $2",
    )
    .bind(run_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(kind) = kind else {
        return Err(AppError::NotFound);
    };

    // The per-record half. Naming the recipients of a clinical recall run is
    // naming the people who met a clinical criterion, so it needs the
    // permission that was allowed to define one.
    if kind == "clinical" {
        require_permission(&claims, permissions::marketing::cohorts::CLINICAL_DEFINE)?;
    }

    let rows = sqlx::query_as::<_, MessageRow>(
        "SELECT m.id, m.contact_id, c.display_name, \
                right(m.address, 4) AS address_tail, \
                m.status, m.blocked_reason, m.queued_at, m.sent_at, \
                m.delivered_at, m.failure_code \
         FROM mkt_messages m \
         JOIN mkt_contacts c ON c.id = m.contact_id AND c.tenant_id = m.tenant_id \
         WHERE m.run_id = $1 AND m.tenant_id = $2 \
           AND (NOT $3::boolean OR m.status = 'blocked') \
         ORDER BY m.status, m.queued_at \
         LIMIT 1000",
    )
    .bind(run_id)
    .bind(claims.tenant_id)
    .bind(q.blocked_only.unwrap_or(false))
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

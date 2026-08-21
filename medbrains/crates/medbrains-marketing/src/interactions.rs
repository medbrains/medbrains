//! The interaction timeline and call ingestion.
//!
//! Everything the hospital did about an enquiry lands here: calls, messages,
//! notes, stage changes. The missed-call number the product is sold on is one
//! `count(*)` over this table, which is why `answered` is a nullable boolean
//! and not an inference from `duration_secs > 0` — a two-second answered call
//! and a two-second ring are the same duration.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::contacts::{CHANNEL_PHONE, resolve_or_create};
use crate::telephony::CallEvent;
use crate::types::Interaction;

/// Record a call against the contact it came from, creating the contact if the
/// number is new.
///
/// A missed call raises a callback task in the same transaction. That is the
/// whole instrumentation story: an unanswered enquiry becomes a piece of work
/// somebody owns, rather than a line in a log nobody reads.
///
/// # Errors
/// Propagates database errors, or `AppError::BadRequest` if the caller's
/// number cannot be normalised.
pub async fn ingest_call(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    event: &CallEvent,
) -> Result<Uuid, AppError> {
    let contact = resolve_or_create(
        tx,
        tenant_id,
        CHANNEL_PHONE,
        &event.caller_number,
        "call",
    )
    .await?;

    // Idempotent on the switch's own call id. Providers retry a webhook they
    // did not get a 2xx for, and an AMI reconnect replays events across the
    // gap. A second landing is not harmless: the missed-call branch below
    // books a callback, so a retry would put the same patient in somebody's
    // queue twice and inflate the number the product is sold on.
    let interaction_id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, occurred_at, answered, \
             duration_secs, agent_id, recording_url, external_ref) \
         VALUES ($1, $2, $3, 'phone', $4, $5, $6, $7, $8, $9, $10) \
         ON CONFLICT (tenant_id, external_ref) WHERE external_ref IS NOT NULL \
         DO NOTHING \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(contact.id)
    .bind(event.kind())
    .bind(event.direction.as_str())
    .bind(event.started_at)
    .bind(event.outcome.answered())
    .bind(event.duration_secs)
    .bind(event.agent_id)
    .bind(event.recording_ref.as_deref())
    .bind(&event.external_ref)
    .fetch_optional(&mut **tx)
    .await?;

    // Already seen. Return the existing row and do nothing else — the callback
    // task from the first landing is already somebody's work.
    let Some(interaction_id) = interaction_id else {
        let existing: Uuid = sqlx::query_scalar(
            "SELECT id FROM mkt_interactions \
             WHERE tenant_id = $1 AND external_ref = $2",
        )
        .bind(tenant_id)
        .bind(&event.external_ref)
        .fetch_one(&mut **tx)
        .await?;
        return Ok(existing);
    };

    if event.outcome.answered() {
        sqlx::query(
            "UPDATE mkt_contacts SET last_contacted_at = $3, updated_at = now() \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(contact.id)
        .bind(tenant_id)
        .bind(event.started_at)
        .execute(&mut **tx)
        .await?;
    } else if event.outcome.needs_callback() {
        // Due now, not in an hour. Conversion falls roughly fourfold past five
        // minutes, so the task exists to be breached loudly if nobody acts.
        sqlx::query(
            "INSERT INTO mkt_tasks (tenant_id, contact_id, assigned_to, due_at, kind, note) \
             VALUES ($1, $2, $3, $4, 'callback', 'Missed call — automatic callback')",
        )
        .bind(tenant_id)
        .bind(contact.id)
        .bind(event.agent_id)
        .bind(event.started_at)
        .execute(&mut **tx)
        .await?;
    }

    Ok(interaction_id)
}

#[derive(Debug, Deserialize)]
pub struct LogInteractionRequest {
    pub kind: String,
    pub channel: String,
    pub direction: String,
    pub disposition: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TimelineQuery {
    pub limit: Option<i64>,
}

/// `GET /api/marketing/contacts/{id}/interactions`
///
/// Returns the timeline without `recording_url`. Playing back what a caller
/// actually said is a separate permission and a separate endpoint; a field
/// that shipped with every timeline read would collapse the two.
///
/// # Errors
/// Returns 403 without `marketing.contacts.view`.
pub async fn list_interactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Query(params): Query<TimelineQuery>,
) -> Result<Json<Vec<Interaction>>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let rows = sqlx::query_as::<_, Interaction>(
        "SELECT id, contact_id, kind, channel, direction, occurred_at, answered, \
                duration_secs, agent_id, disposition, note, external_ref \
         FROM mkt_interactions \
         WHERE tenant_id = $1 AND contact_id = $2 \
         ORDER BY occurred_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/contacts/{id}/interactions`
///
/// # Errors
/// Returns 403 without `marketing.interactions.log`, 404 if the contact is not
/// in this tenant.
pub async fn log_interaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<LogInteractionRequest>,
) -> Result<Json<Interaction>, AppError> {
    require_permission(&claims, permissions::marketing::interactions::LOG)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mkt_contacts WHERE id = $1 AND tenant_id = $2")
            .bind(contact_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as::<_, Interaction>(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, agent_id, disposition, note) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, contact_id, kind, channel, direction, occurred_at, answered, \
                   duration_secs, agent_id, disposition, note, external_ref",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(&body.kind)
    .bind(&body.channel)
    .bind(&body.direction)
    .bind(claims.sub)
    .bind(body.disposition.as_deref())
    .bind(body.note.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE mkt_contacts SET last_contacted_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// The number the audit in §11 is sold on.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MissedCallSummary {
    pub inbound_total: i64,
    pub unanswered: i64,
    pub callbacks_open: i64,
}

/// `GET /api/marketing/reports/missed-calls`
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn missed_call_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MissedCallSummary>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;
    // An aggregate over enquiry rows. No patient name is selected and none can
    // be: this counts calls, and the count is the thing the hospital has never
    // been able to see.

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MissedCallSummary>(
        "SELECT \
           count(*) FILTER (WHERE direction = 'inbound')::bigint AS inbound_total, \
           count(*) FILTER (WHERE direction = 'inbound' AND answered IS NOT TRUE)::bigint \
             AS unanswered, \
           (SELECT count(*) FROM mkt_tasks t \
             WHERE t.tenant_id = $1 AND t.status = 'open')::bigint AS callbacks_open \
         FROM mkt_interactions \
         WHERE tenant_id = $1 AND kind = 'call' AND occurred_at >= now() - interval '30 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

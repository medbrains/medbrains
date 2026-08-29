//! The callback worklist — who the desk owes a call, and when it was owed.
//!
//! # Why this exists
//!
//! `mkt_tasks` was write-only. `interactions::ingest_call` inserts a callback
//! row every time somebody rings and nobody picks up, and the only other
//! statements touching the table are three `count(*)`s. There was an index
//! built for the worklist query — `(tenant_id, status, due_at) WHERE status =
//! 'open'` — and no query that used it.
//!
//! So a missed call booked a callback that no screen could open. The hospital
//! could see the number "callbacks still owed" on the funnel tab and could not
//! see a single one of them.
//!
//! # Ordering is the feature
//!
//! Conversion falls roughly fourfold past five minutes, so the list is ordered
//! by how long the call has been owed, oldest first — not by when it was
//! created, and not grouped by agent. A desk with more enquiries than capacity
//! is choosing who to ring next, and the current answer is whoever happens to
//! be on screen.
//!
//! Deliberately not a lead score. A ranked queue of people who browsed the
//! oncology pages, pushed to a telecaller with the reason attached, is direct
//! solicitation under the NMC 2023 conduct regulations. Call the people who
//! asked, in the order they asked. That is a sort, not a model.

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
use uuid::Uuid;

/// Ceiling on one page of the worklist. A desk cannot work a thousand
/// callbacks in a sitting, and rendering them all makes the first ten slower
/// to reach.
const MAX_CALLBACKS: i64 = 200;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Callback {
    pub id: Uuid,
    pub contact_id: Uuid,
    pub display_name: Option<String>,
    pub primary_phone: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub assigned_to_name: Option<String>,
    pub due_at: chrono::DateTime<chrono::Utc>,
    pub kind: String,
    pub status: String,
    pub note: Option<String>,
    /// Seconds the call has been owed. Negative means it is not due yet.
    ///
    /// Computed in SQL rather than in the browser because a desk in one
    /// timezone reading a server in another must not disagree about whether a
    /// call is late.
    pub overdue_seconds: i64,
    /// The stage the enquiry is parked in, so the caller knows whether they
    /// are chasing a first contact or a booking.
    pub stage_name: Option<String>,
    /// When the SLA escalator marked this as breached. `None` means it is
    /// either inside its grace period or has not been through a pass yet —
    /// distinct from "on time", which is why the column is a timestamp and
    /// not a boolean.
    pub escalated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    /// `mine` limits to the caller's own list. Absent means the whole desk,
    /// which is what a supervisor and a small clinic both want.
    pub scope: Option<String>,
    /// Include callbacks not yet due. Off by default: the list is a worklist,
    /// not a diary.
    pub include_upcoming: Option<bool>,
}

const COLUMNS: &str = "t.id, t.contact_id, c.display_name, c.primary_phone, \
                       t.assigned_to, u.full_name AS assigned_to_name, \
                       t.due_at, t.kind, t.status, t.note, \
                       EXTRACT(EPOCH FROM (now() - t.due_at))::bigint AS overdue_seconds, \
                       s.name AS stage_name, t.escalated_at";

/// `GET /api/marketing/callbacks`
///
/// Open callbacks, longest-owed first.
///
/// One query with the joins the row needs — name, number, stage, assignee —
/// rather than a list call followed by a fetch per row. A worklist that issues
/// two hundred follow-up requests to render is a worklist nobody opens twice.
///
/// # Errors
/// Returns 403 without `marketing.pipeline.view`.
pub async fn list_callbacks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CallbackQuery>,
) -> Result<Json<Vec<Callback>>, AppError> {
    // A callback list is the enquiry pipeline filtered by what is due, so it
    // is the same read as the pipeline itself.
    require_permission(&claims, permissions::marketing::pipeline::VIEW)?;

    let mine_only = q.scope.as_deref() == Some("mine");
    let include_upcoming = q.include_upcoming.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Callback>(&format!(
        "SELECT {COLUMNS} FROM mkt_tasks t \
         JOIN mkt_contacts c ON c.id = t.contact_id AND c.tenant_id = t.tenant_id \
         LEFT JOIN mkt_pipeline_stages s \
                ON s.id = c.stage_id AND s.tenant_id = c.tenant_id \
         LEFT JOIN users u ON u.id = t.assigned_to \
         WHERE t.tenant_id = $1 AND t.status = 'open' \
           AND (NOT $2::boolean OR t.assigned_to = $3) \
           AND ($4::boolean OR t.due_at <= now()) \
         ORDER BY (t.escalated_at IS NOT NULL) DESC, t.due_at ASC \
         LIMIT $5"
    ))
    .bind(claims.tenant_id)
    .bind(mine_only)
    .bind(claims.sub)
    .bind(include_upcoming)
    .bind(MAX_CALLBACKS)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct CallbackSummary {
    pub open: i64,
    pub overdue: i64,
    /// Breached their stage's SLA and been escalated.
    pub breached: i64,
    /// The longest anything has been waiting, in seconds. `None` when nothing
    /// is overdue.
    pub oldest_overdue_seconds: Option<i64>,
}

/// `GET /api/marketing/callbacks/summary`
///
/// The three numbers a supervisor looks at. One `GROUP BY`, not three queries.
///
/// # Errors
/// Returns 403 without `marketing.pipeline.view`.
pub async fn callback_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CallbackSummary>, AppError> {
    require_permission(&claims, permissions::marketing::pipeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: (i64, i64, i64, Option<f64>) = sqlx::query_as(
        "SELECT count(*)::bigint, \
                count(*) FILTER (WHERE due_at <= now())::bigint, \
                count(*) FILTER (WHERE escalated_at IS NOT NULL)::bigint, \
                max(EXTRACT(EPOCH FROM (now() - due_at))) \
                    FILTER (WHERE due_at <= now()) \
         FROM mkt_tasks WHERE tenant_id = $1 AND status = 'open'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    #[allow(clippy::cast_possible_truncation)]
    Ok(Json(CallbackSummary {
        open: row.0,
        overdue: row.1,
        breached: row.2,
        oldest_overdue_seconds: row.3.map(|s| s as i64),
    }))
}

#[derive(Debug, Deserialize)]
pub struct CompleteCallbackRequest {
    pub note: Option<String>,
}

/// `POST /api/marketing/callbacks/{id}/complete`
///
/// Marks a callback done and writes the call onto the enquiry's timeline in
/// the same transaction. Closing the task without recording the call would
/// leave the desk's own history saying nobody ever rang.
///
/// # Errors
/// Returns 403 without `marketing.interactions.log`, 404 if the callback is
/// not in this tenant, 409 if it is already closed.
pub async fn complete_callback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteCallbackRequest>,
) -> Result<Json<Callback>, AppError> {
    // Completing a callback is logging that a call happened.
    require_permission(&claims, permissions::marketing::interactions::LOG)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT contact_id, status FROM mkt_tasks \
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((contact_id, status)) = existing else {
        return Err(AppError::NotFound);
    };
    if status != "open" {
        // Two agents working the same list is normal; both closing the same
        // callback should tell the second one why, not silently succeed.
        return Err(AppError::Conflict(
            "this callback has already been closed".to_owned(),
        ));
    }

    sqlx::query(
        "UPDATE mkt_tasks SET status = 'done', completed_at = now(), \
                note = COALESCE($3, note) \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.note.as_deref())
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, agent_id, \
             disposition, note) \
         VALUES ($1, $2, 'call', 'phone', 'outbound', $3, 'callback_done', $4)",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(claims.sub)
    .bind(body.note.as_deref())
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE mkt_contacts SET last_contacted_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let row = fetch_one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct RescheduleCallbackRequest {
    pub due_at: chrono::DateTime<chrono::Utc>,
    pub note: Option<String>,
}

/// `POST /api/marketing/callbacks/{id}/reschedule`
///
/// "Ring back after six." Moves the callback rather than closing it, so the
/// obligation survives — an agent who cannot reach somebody today should not
/// have to choose between a false "done" and leaving the row permanently
/// overdue.
///
/// # Errors
/// Returns 403 without `marketing.interactions.log`, 404 if not in this
/// tenant, 409 if already closed, 400 if the new time is in the past.
pub async fn reschedule_callback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RescheduleCallbackRequest>,
) -> Result<Json<Callback>, AppError> {
    require_permission(&claims, permissions::marketing::interactions::LOG)?;

    if body.due_at <= chrono::Utc::now() {
        return Err(AppError::BadRequest(
            "a rescheduled callback needs a time in the future".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM mkt_tasks WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    match status.as_deref() {
        None => return Err(AppError::NotFound),
        Some("open") => {}
        Some(_) => {
            return Err(AppError::Conflict(
                "a closed callback cannot be rescheduled".to_owned(),
            ));
        }
    }

    sqlx::query(
        "UPDATE mkt_tasks SET due_at = $3, note = COALESCE($4, note) \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.due_at)
    .bind(body.note.as_deref())
    .execute(&mut *tx)
    .await?;

    let row = fetch_one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

async fn fetch_one(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Callback, AppError> {
    sqlx::query_as::<_, Callback>(&format!(
        "SELECT {COLUMNS} FROM mkt_tasks t \
         JOIN mkt_contacts c ON c.id = t.contact_id AND c.tenant_id = t.tenant_id \
         LEFT JOIN mkt_pipeline_stages s \
                ON s.id = c.stage_id AND s.tenant_id = c.tenant_id \
         LEFT JOIN users u ON u.id = t.assigned_to \
         WHERE t.id = $1 AND t.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

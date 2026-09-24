//! The code blue page, answered.
//!
//! The activation pipeline reaches every active doctor and nurse. Until now
//! that was the end of it: the person running the arrest could not see who
//! was coming, and NABH's response-time measure —
//! `nabh_code_blue_activations.team_arrived_at`, from which
//! `response_seconds` is generated — had never been written by any code path.
//!
//! A response is one row per person per arrest. The earliest one is the
//! team's arrival, and the mirror is updated from it in the same
//! transaction, so the metric comes from the response itself rather than
//! from a form filled in afterwards.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::Serialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct CodeBlueResponder {
    pub code_blue_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub responded_at: DateTime<Utc>,
    /// How long after the call this person answered.
    pub seconds_after_call: i32,
}

/// `POST /api/nurse/code-blue/{id}/respond` — say you are on your way.
///
/// Idempotent: a second tap changes nothing and returns the same answer.
/// Only an arrest still in progress can be responded to — answering one that
/// has ended is not a response, and must not become the arrival time.
pub async fn respond_to_code_blue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::RESPOND)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let inserted = sqlx::query_scalar!(
        "INSERT INTO code_blue_responses (tenant_id, code_blue_id, user_id) \
         SELECT $1, $2, $3 FROM code_blue_events \
          WHERE id = $2 AND tenant_id = $1 AND ended_at IS NULL AND deleted_at IS NULL \
         ON CONFLICT (tenant_id, code_blue_id, user_id) WHERE deleted_at IS NULL DO NOTHING \
         RETURNING id",
        claims.tenant_id,
        id,
        claims.sub,
    )
    .fetch_optional(&mut *tx)
    .await?;

    // Nothing inserted means either already responded (fine) or no active
    // arrest by that id. Tell those apart: the second is a 404, because a
    // "Responding" that silently attached to nothing is the worse outcome.
    if inserted.is_none() {
        let active = sqlx::query_scalar!(
            "SELECT EXISTS( \
               SELECT 1 FROM code_blue_events \
                WHERE id = $2 AND tenant_id = $1 AND ended_at IS NULL AND deleted_at IS NULL \
             ) AS \"active!\"",
            claims.tenant_id,
            id,
        )
        .fetch_one(&mut *tx)
        .await?;
        if !active {
            return Err(AppError::NotFound);
        }
    }

    // First arrival fills the NABH measure and is never overwritten;
    // response_seconds is a generated column and derives itself.
    sqlx::query!(
        "UPDATE nabh_code_blue_activations n \
            SET team_arrived_at = COALESCE(n.team_arrived_at, r.first_at), \
                updated_at = now() \
           FROM (SELECT min(responded_at) AS first_at FROM code_blue_responses \
                  WHERE tenant_id = $1 AND code_blue_id = $2 AND deleted_at IS NULL) r \
          WHERE n.tenant_id = $1 AND n.source_module = 'code_blue_events' \
            AND n.source_record_id = $2 AND r.first_at IS NOT NULL",
        claims.tenant_id,
        id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "code_blue_id": id, "responded": true })))
}

/// `GET /api/nurse/code-blue/responders` — who has answered, for every arrest
/// still in progress. One round trip for the whole screen.
pub async fn list_code_blue_responders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CodeBlueResponder>>, AppError> {
    require_permission(&claims, permissions::nurse::code_blue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        CodeBlueResponder,
        "SELECT r.code_blue_id, r.user_id, u.full_name AS user_name, r.responded_at, \
                EXTRACT(EPOCH FROM (r.responded_at - e.started_at))::int \
                  AS \"seconds_after_call!\" \
           FROM code_blue_responses r \
           JOIN code_blue_events e ON e.id = r.code_blue_id AND e.tenant_id = r.tenant_id \
           JOIN users u ON u.id = r.user_id \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL AND e.ended_at IS NULL \
          ORDER BY r.code_blue_id, r.responded_at \
          LIMIT 500",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

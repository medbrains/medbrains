//! Pipeline stages and stage transitions.
//!
//! Stages are rows, not a Rust enum. A dental clinic's funnel and an IVF
//! unit's are different lengths with different names, and a tenant that has to
//! wait for a deployment to rename "Consulted" will keep its spreadsheet.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use uuid::Uuid;

use crate::funnel::{self, StageMove};
use crate::types::{MoveStageRequest, PipelineStage};

/// `GET /api/marketing/stages`
///
/// # Errors
/// Returns 403 without `marketing.pipeline.view`.
pub async fn list_stages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PipelineStage>>, AppError> {
    require_permission(&claims, permissions::marketing::pipeline::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PipelineStage>(
        "SELECT id, pipeline_id, code, name, position, is_won, is_lost, sla_minutes \
         FROM mkt_pipeline_stages WHERE tenant_id = $1 \
         ORDER BY pipeline_id, position",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/contacts/{id}/stage`
///
/// Moves an enquiry and records the move on its timeline in the same
/// transaction. A stage change with no trace is how a funnel report becomes
/// unauditable — the number moves and nobody can say who moved it.
///
/// # Errors
/// Returns 403 without `marketing.pipeline.move`, 404 if the contact or the
/// stage is not in this tenant.
pub async fn move_stage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<MoveStageRequest>,
) -> Result<Json<PipelineStage>, AppError> {
    require_permission(&claims, permissions::marketing::pipeline::MOVE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let stage = sqlx::query_as::<_, PipelineStage>(
        "SELECT id, pipeline_id, code, name, position, is_won, is_lost, sla_minutes \
         FROM mkt_pipeline_stages WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.stage_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Read the stage the enquiry is leaving before the UPDATE overwrites it.
    // A separate SELECT rather than a subquery inside RETURNING: the subquery
    // form does return the pre-update value, but it does so because of the
    // statement snapshot rather than because it looks like it does, and this
    // value is the half of the transition the history was missing.
    //
    // `FOR UPDATE` so two agents moving the same enquiry at once serialise
    // here instead of writing two events that each claim the same origin.
    let previous: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT stage_id FROM mkt_contacts \
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(from_stage_id) = previous else {
        return Err(AppError::NotFound);
    };

    sqlx::query(
        "UPDATE mkt_contacts SET stage_id = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .bind(stage.id)
    .execute(&mut *tx)
    .await?;

    funnel::record_stage_move(
        &mut tx,
        &StageMove {
            tenant_id: claims.tenant_id,
            contact_id,
            from_stage_id,
            to_stage_id: stage.id,
            actor_id: Some(claims.sub),
            source: funnel::source::AGENT,
            note: body.note.as_deref(),
        },
    )
    .await?;

    sqlx::query(
        "INSERT INTO mkt_interactions \
            (tenant_id, contact_id, kind, channel, direction, agent_id, disposition, note) \
         VALUES ($1, $2, 'stage_change', 'system', 'internal', $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(claims.sub)
    .bind(&stage.code)
    .bind(body.note.as_deref())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(stage))
}

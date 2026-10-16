//! A checklist's counts and score, computed from its criteria — never taken
//! from the client. Score is the share of applicable criteria found
//! compliant; a criterion not yet assessed counts against it, as it would on
//! survey day. Also: starting a new assessment period from an earlier
//! checklist's criteria, and removing a criterion entered by mistake.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Recounts the checklist from its live criteria and moves it from
/// `not_started` to `in_progress` once anything has been assessed.
pub(crate) async fn recount(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    checklist_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE compliance_checklists c SET \
           total_items = s.total, compliant_items = s.ok, non_compliant_items = s.bad, \
           compliance_score = CASE WHEN s.total - s.na > 0 \
             THEN round(s.ok * 100.0 / (s.total - s.na), 2) END, \
           overall_status = CASE WHEN c.overall_status = 'not_started' AND s.assessed > 0 \
             THEN 'in_progress'::compliance_checklist_status ELSE c.overall_status END, \
           updated_by = $3 \
         FROM (SELECT COUNT(*)::int AS total, \
                 (COUNT(*) FILTER (WHERE status = 'compliant'))::int AS ok, \
                 (COUNT(*) FILTER (WHERE status = 'non_compliant'))::int AS bad, \
                 COUNT(*) FILTER (WHERE status = 'not_applicable') AS na, \
                 COUNT(*) FILTER (WHERE status <> 'not_started') AS assessed \
               FROM compliance_checklist_items \
               WHERE checklist_id = $1 AND tenant_id = $2 AND deleted_at IS NULL) s \
         WHERE c.id = $1 AND c.tenant_id = $2",
    )
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Copies an earlier checklist's criteria, unassessed, into a new one — the
/// same standard assessed again for a new period.
pub(crate) async fn copy_criteria(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    from: Uuid,
    to: Uuid,
) -> Result<(), AppError> {
    let copied = sqlx::query(
        "INSERT INTO compliance_checklist_items \
           (tenant_id, checklist_id, item_number, criterion, created_by) \
         SELECT tenant_id, $2, item_number, criterion, $4 FROM compliance_checklist_items \
         WHERE checklist_id = $1 AND tenant_id = $3 AND deleted_at IS NULL",
    )
    .bind(from)
    .bind(to)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    if copied.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "The checklist to copy from has no criteria.".into(),
        ));
    }
    recount(tx, claims, to).await
}

/// DELETE `/api/regulatory/checklists/{checklist_id}/items/{item_id}` — a
/// criterion entered by mistake. One that does not apply is marked
/// `not_applicable` instead, so the record of that judgement survives.
pub async fn delete_checklist_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((checklist_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let removed = sqlx::query(
        "UPDATE compliance_checklist_items \
         SET deleted_at = now(), deleted_by = $4, delete_reason = 'Entered by mistake' \
         WHERE id = $1 AND checklist_id = $2 AND tenant_id = $3 AND deleted_at IS NULL",
    )
    .bind(item_id)
    .bind(checklist_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if removed.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    recount(&mut tx, &claims, checklist_id).await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "removed": item_id })))
}

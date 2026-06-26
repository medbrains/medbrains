//! Materials workspace — cross-domain read endpoints.
//!
//! The unified requisitions inbox surfaces every open/closed request a
//! storekeeper or department head deals with, regardless of whether it is a
//! store-item indent (`indents`) or an asset request/movement
//! (`asset_movements`), in one normalised shape. Actions stay on each
//! domain's own endpoints (approve an indent, complete an asset movement);
//! this is the single worklist that points at them.

use axum::{Extension, Json, extract::Query};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_any_permission,
    state::AppState,
};
use axum::extract::State;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Requisition {
    pub id: Uuid,
    /// "store_indent" | "asset_request".
    pub kind: String,
    pub reference: Option<String>,
    pub title: String,
    pub department_name: Option<String>,
    pub requested_by_name: Option<String>,
    pub priority: Option<String>,
    pub status: String,
    /// True while the request still needs someone to act (approve / fulfil).
    pub open: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RequisitionQuery {
    /// "store_indent" | "asset_request" — omit for both.
    pub kind: Option<String>,
    /// "open" → only requests still needing action.
    pub state: Option<String>,
}

pub async fn list_requisitions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<RequisitionQuery>,
) -> Result<Json<Vec<Requisition>>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::indent::LIST, permissions::assets::LIST],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Requisition>(
        "SELECT * FROM (\
            SELECT i.id, 'store_indent'::text AS kind, i.indent_number AS reference, \
                   COALESCE(NULLIF(i.justification, ''), i.indent_type, 'Store requisition') AS title, \
                   d.name AS department_name, u.full_name AS requested_by_name, \
                   i.priority, i.status, \
                   (i.status IN ('draft', 'submitted', 'approved', 'partially_issued')) AS open, \
                   i.created_at \
            FROM indents i \
            LEFT JOIN departments d ON d.id = i.department_id \
            LEFT JOIN users u ON u.id = i.requested_by \
            WHERE i.tenant_id = $1 \
            UNION ALL \
            SELECT m.id, 'asset_request'::text AS kind, \
                   CASE m.source_type WHEN 'bme_equipment' \
                       THEN COALESCE(be.asset_tag, be.serial_number) \
                       ELSE COALESCE(eq.asset_tag, eq.serial_number) END AS reference, \
                   CONCAT(INITCAP(m.movement_type), ' — ', \
                       COALESCE(CASE m.source_type WHEN 'bme_equipment' THEN be.name ELSE eq.name END, \
                                'asset')) AS title, \
                   td.name AS department_name, ru.full_name AS requested_by_name, \
                   NULL::text AS priority, m.status, \
                   (m.status = 'requested') AS open, \
                   m.created_at \
            FROM asset_movements m \
            LEFT JOIN departments td ON td.id = m.to_department_id \
            LEFT JOIN users ru ON ru.id = m.requested_by \
            LEFT JOIN bme_equipment be ON m.source_type = 'bme_equipment' AND be.id = m.source_id \
            LEFT JOIN equipment eq ON m.source_type = 'equipment' AND eq.id = m.source_id \
            WHERE m.tenant_id = $1 \
         ) req \
         WHERE ($2::text IS NULL OR req.kind = $2) \
           AND (NOT $3 OR req.open) \
         ORDER BY req.open DESC, req.created_at DESC \
         LIMIT 1000",
    )
    .bind(claims.tenant_id)
    .bind(query.kind.as_deref())
    .bind(query.state.as_deref() == Some("open"))
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

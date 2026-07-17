//! Materials workspace — cross-domain read endpoints.
//!
//! The unified requisitions inbox surfaces every open/closed request a
//! storekeeper or department head deals with, regardless of whether it is a
//! store-item indent (`indents`) or an asset request/movement
//! (`asset_movements`), in one normalised shape. Actions stay on each
//! domain's own endpoints (approve an indent, complete an asset movement);
//! this is the single worklist that points at them.

use axum::routing::get;
use axum::{Extension, Json, extract::Query};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
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

// ── Unified inventory cockpit ───────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InventoryItem {
    pub id: Uuid,
    /// "stock" (consumable store item) | "asset" (capital equipment).
    pub kind: String,
    pub code: Option<String>,
    pub name: String,
    pub category: Option<String>,
    pub department_name: Option<String>,
    pub unit: Option<String>,
    pub on_hand: Decimal,
    pub reorder_level: Option<i32>,
    pub unit_value: Option<Decimal>,
    pub total_value: Option<Decimal>,
    /// "in_stock" | "low" | "out" | "na" (assets carry no reorder level).
    pub stock_status: String,
}

#[derive(Debug, Deserialize)]
pub struct InventoryQuery {
    /// "stock" | "asset" — omit for both.
    pub kind: Option<String>,
    /// "low" → only stock items at/under reorder level (or out).
    pub state: Option<String>,
}

pub async fn list_inventory(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<InventoryQuery>,
) -> Result<Json<Vec<InventoryItem>>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::indent::LIST, permissions::assets::LIST],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InventoryItem>(
        "SELECT * FROM (\
            SELECT sc.id, 'stock'::text AS kind, sc.code, sc.name, sc.category, \
                   NULL::text AS department_name, sc.unit, \
                   sc.current_stock::numeric AS on_hand, sc.reorder_level, \
                   sc.base_price AS unit_value, \
                   (sc.current_stock * sc.base_price) AS total_value, \
                   CASE WHEN sc.current_stock <= 0 THEN 'out' \
                        WHEN sc.reorder_level > 0 AND sc.current_stock <= sc.reorder_level THEN 'low' \
                        ELSE 'in_stock' END AS stock_status \
            FROM store_catalog sc \
            WHERE sc.tenant_id = $1 AND sc.is_active \
            UNION ALL \
            SELECT be.id, 'asset'::text, COALESCE(be.asset_tag, be.serial_number), be.name, \
                   'biomedical'::text, d.name, 'unit'::text, 1::numeric, NULL::int, \
                   be.purchase_cost, be.purchase_cost, 'na'::text \
            FROM bme_equipment be LEFT JOIN departments d ON d.id = be.department_id \
            WHERE be.tenant_id = $1 \
            UNION ALL \
            SELECT eq.id, 'asset'::text, COALESCE(eq.asset_tag, eq.serial_number), eq.name, \
                   COALESCE(eq.category, 'general'), d.name, 'unit'::text, 1::numeric, NULL::int, \
                   eq.cost, eq.cost, 'na'::text \
            FROM equipment eq LEFT JOIN departments d ON d.id = eq.department_id \
            WHERE eq.tenant_id = $1 \
         ) inv \
         WHERE ($2::text IS NULL OR inv.kind = $2) \
           AND (NOT $3 OR inv.stock_status IN ('low', 'out')) \
         ORDER BY inv.kind, inv.name \
         LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(query.kind.as_deref())
    .bind(query.state.as_deref() == Some("low"))
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Materials analytics summary ─────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AnalyticsSummary {
    stock_value: Decimal,
    asset_value: Decimal,
    stock_item_count: i64,
    asset_count: i64,
    low_stock_count: i64,
    out_of_stock_count: i64,
    dead_stock_count: i64,
    open_requisitions: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CategoryValue {
    pub category: Option<String>,
    pub item_count: i64,
    pub stock_value: Decimal,
}

#[derive(Debug, Serialize)]
pub struct MaterialsAnalytics {
    pub stock_value: Decimal,
    pub asset_value: Decimal,
    pub total_value: Decimal,
    pub stock_item_count: i64,
    pub asset_count: i64,
    pub low_stock_count: i64,
    pub out_of_stock_count: i64,
    /// Items with stock on hand but no issue in the last 90 days.
    pub dead_stock_count: i64,
    pub open_requisitions: i64,
    /// Store stock value by category, highest first.
    pub categories: Vec<CategoryValue>,
}

pub async fn materials_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<MaterialsAnalytics>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::indent::LIST, permissions::assets::LIST],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let summary = sqlx::query_as::<_, AnalyticsSummary>(
        "SELECT \
            (SELECT COALESCE(SUM(current_stock * base_price), 0)::numeric FROM store_catalog \
                WHERE tenant_id = $1 AND is_active) AS stock_value, \
            (COALESCE((SELECT SUM(purchase_cost) FROM bme_equipment WHERE tenant_id = $1), 0) \
             + COALESCE((SELECT SUM(cost) FROM equipment WHERE tenant_id = $1), 0))::numeric AS asset_value, \
            (SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND is_active) AS stock_item_count, \
            ((SELECT COUNT(*) FROM bme_equipment WHERE tenant_id = $1) \
             + (SELECT COUNT(*) FROM equipment WHERE tenant_id = $1)) AS asset_count, \
            (SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND is_active \
                AND reorder_level > 0 AND current_stock > 0 AND current_stock <= reorder_level) AS low_stock_count, \
            (SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND is_active AND current_stock <= 0) AS out_of_stock_count, \
            (SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND is_active AND current_stock > 0 \
                AND (last_issue_date IS NULL OR last_issue_date < now() - INTERVAL '90 days')) AS dead_stock_count, \
            ((SELECT COUNT(*) FROM indents WHERE tenant_id = $1 \
                AND status IN ('draft', 'submitted', 'approved', 'partially_issued')) \
             + (SELECT COUNT(*) FROM asset_movements WHERE tenant_id = $1 AND status = 'requested')) AS open_requisitions",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let categories = sqlx::query_as::<_, CategoryValue>(
        "SELECT category, COUNT(*) AS item_count, \
            COALESCE(SUM(current_stock * base_price), 0)::numeric AS stock_value \
         FROM store_catalog WHERE tenant_id = $1 AND is_active \
         GROUP BY category ORDER BY stock_value DESC LIMIT 12",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(MaterialsAnalytics {
        total_value: summary.stock_value + summary.asset_value,
        stock_value: summary.stock_value,
        asset_value: summary.asset_value,
        stock_item_count: summary.stock_item_count,
        asset_count: summary.asset_count,
        low_stock_count: summary.low_stock_count,
        out_of_stock_count: summary.out_of_stock_count,
        dead_stock_count: summary.dead_stock_count,
        open_requisitions: summary.open_requisitions,
        categories,
    }))
}

/// Materials operational routes (requisitions/inventory/analytics views).
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/materials/requisitions", get(list_requisitions))
        .route("/api/materials/inventory", get(list_inventory))
        .route("/api/materials/analytics", get(materials_analytics))
}

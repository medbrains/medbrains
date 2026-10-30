//! The per-item online floor: the units the wards and the counter keep,
//! below which online orders may not sell (research brief §3). Unset, it is
//! the item's reorder level. Holds sit above it; the counter and the wards
//! are never limited by it.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::Serialize;
use uuid::Uuid;

/// Items the editor lists, at most.
const LIST_LIMIT: i64 = 500;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FloorRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    /// The floor the hospital set, when it set one.
    pub online_reserve_floor: Option<i32>,
    pub reorder_level: i32,
    /// Cleared, in-date units on hand across the pharmacy.
    pub on_hand: i64,
    /// Units live online holds keep.
    pub held: i64,
}

/// `GET /api/pharmacy/storefront/floors` — every item sold online with its
/// floor, stock and holds.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FloorRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, FloorRow>(
        "SELECT c.id, c.code, c.name, c.online_reserve_floor, c.reorder_level, \
                COALESCE(b.on_hand, 0) AS on_hand, COALESCE(h.held, 0) AS held \
           FROM pharmacy_catalog c \
           LEFT JOIN (SELECT catalog_item_id, SUM(quantity_on_hand)::bigint AS on_hand \
                        FROM pharmacy_batches \
                       WHERE tenant_id = $1 AND deleted_at IS NULL AND quarantine_status = 'cleared' \
                         AND quantity_on_hand > 0 AND expiry_date > CURRENT_DATE \
                       GROUP BY catalog_item_id) b ON b.catalog_item_id = c.id \
           LEFT JOIN (SELECT catalog_item_id, SUM(quantity)::bigint AS held \
                        FROM pharmacy_stock_holds \
                       WHERE tenant_id = $1 AND released_at IS NULL AND deleted_at IS NULL \
                         AND expires_at > now() \
                       GROUP BY catalog_item_id) h ON h.catalog_item_id = c.id \
          WHERE c.tenant_id = $1 AND c.sold_online AND c.is_active AND c.deleted_at IS NULL \
          ORDER BY c.name LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

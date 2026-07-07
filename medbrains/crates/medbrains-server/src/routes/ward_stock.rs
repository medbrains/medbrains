//! Ward / floor PAR (imprest) stock. Wards hold a par level of drugs; the pharmacy tops them
//! up to par (replenish, decrementing the pharmacy_catalog aggregate); nurses consume against
//! ward stock. Powers the inpatient ward-stock workflow (hospital editions).

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct WardStockRow {
    pub catalog_item_id: Uuid,
    pub drug_name: String,
    pub par_qty: i32,
    pub min_qty: i32,
    pub on_hand: i32,
    pub gap: i32,
}

#[derive(Debug, Deserialize)]
pub struct WardQuery {
    pub department_id: Uuid,
}

/// `GET /api/pharmacy/ward-stock?department_id=` — the ward's par vs on-hand vs gap.
pub async fn list_ward_stock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<WardQuery>,
) -> Result<Json<Vec<WardStockRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, WardStockRow>(
        "SELECT p.catalog_item_id, c.name AS drug_name, p.par_qty, p.min_qty, \
                COALESCE(s.quantity, 0) AS on_hand, \
                GREATEST(p.par_qty - COALESCE(s.quantity, 0), 0) AS gap \
         FROM ward_par_levels p \
         JOIN pharmacy_catalog c ON c.id = p.catalog_item_id \
         LEFT JOIN ward_stock s ON s.tenant_id = p.tenant_id \
              AND s.department_id = p.department_id AND s.catalog_item_id = p.catalog_item_id \
         WHERE p.tenant_id = $1 AND p.department_id = $2 ORDER BY c.name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(q.department_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct SetParRequest {
    pub department_id: Uuid,
    pub catalog_item_id: Uuid,
    pub par_qty: i32,
    pub min_qty: Option<i32>,
}

/// `POST /api/pharmacy/ward-stock/par` — set a ward's par level for a drug.
pub async fn set_ward_par(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SetParRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    if body.par_qty < 0 {
        return Err(AppError::BadRequest("par_qty cannot be negative".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO ward_par_levels (tenant_id, department_id, catalog_item_id, par_qty, min_qty) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 0)) \
         ON CONFLICT (tenant_id, department_id, catalog_item_id) DO UPDATE SET \
           par_qty = EXCLUDED.par_qty, min_qty = EXCLUDED.min_qty, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.catalog_item_id)
    .bind(body.par_qty)
    .bind(body.min_qty)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Debug, Deserialize)]
pub struct ReplenishRequest {
    pub department_id: Uuid,
}

/// `POST /api/pharmacy/ward-stock/replenish` — top every below-par item up to par, issuing
/// from the pharmacy (decrements the catalog aggregate by what's actually available).
pub async fn replenish_ward(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReplenishRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let gaps: Vec<(Uuid, i32, i32)> = sqlx::query_as(
        "SELECT p.catalog_item_id, \
                GREATEST(p.par_qty - COALESCE(s.quantity, 0), 0) AS gap, \
                COALESCE(c.current_stock, 0) AS available \
         FROM ward_par_levels p \
         JOIN pharmacy_catalog c ON c.id = p.catalog_item_id \
         LEFT JOIN ward_stock s ON s.tenant_id = p.tenant_id \
              AND s.department_id = p.department_id AND s.catalog_item_id = p.catalog_item_id \
         WHERE p.tenant_id = $1 AND p.department_id = $2 \
           AND p.par_qty > COALESCE(s.quantity, 0)",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut items_replenished = 0;
    let mut total_issued = 0;
    for (catalog_item_id, gap, available) in gaps {
        let issue = gap.min(available);
        if issue <= 0 {
            continue;
        }
        sqlx::query(
            "UPDATE pharmacy_catalog SET current_stock = current_stock - $1, updated_at = now() \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(issue)
        .bind(catalog_item_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO ward_stock (tenant_id, department_id, catalog_item_id, quantity) \
             VALUES ($1, $2, $3, $4) \
             ON CONFLICT (tenant_id, department_id, catalog_item_id) DO UPDATE SET \
               quantity = ward_stock.quantity + EXCLUDED.quantity, updated_at = now()",
        )
        .bind(claims.tenant_id)
        .bind(body.department_id)
        .bind(catalog_item_id)
        .bind(issue)
        .execute(&mut *tx)
        .await?;
        items_replenished += 1;
        total_issued += issue;
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "items_replenished": items_replenished,
        "total_issued": total_issued,
    })))
}

#[derive(Debug, Deserialize)]
pub struct ConsumeRequest {
    pub department_id: Uuid,
    pub catalog_item_id: Uuid,
    pub quantity: i32,
}

/// `POST /api/pharmacy/ward-stock/consume` — a ward consumes stock (nurse administration).
pub async fn consume_ward_stock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ConsumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    if body.quantity <= 0 {
        return Err(AppError::BadRequest("quantity must be positive".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let remaining: Option<i32> = sqlx::query_scalar(
        "UPDATE ward_stock SET quantity = quantity - $1, updated_at = now() \
         WHERE tenant_id = $2 AND department_id = $3 AND catalog_item_id = $4 \
           AND quantity >= $1 RETURNING quantity",
    )
    .bind(body.quantity)
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.catalog_item_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(remaining) = remaining else {
        return Err(AppError::BadRequest(
            "Insufficient ward stock for this item".to_owned(),
        ));
    };
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "remaining": remaining })))
}

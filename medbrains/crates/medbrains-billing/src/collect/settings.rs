//! Billing entities and lanes — the settings screen that makes them (#4885).
//!
//! `GET/POST /api/billing/entities`, `PUT /api/billing/entities/{id}`,
//! `GET /api/billing/lanes`, `PUT /api/billing/lanes/{lane}`.

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
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::lanes::is_lane;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BillingEntity {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub gstin: Option<String>,
    pub drug_licence: Option<String>,
    pub address: Option<String>,
    pub receipt_prefix: String,
    pub is_default: bool,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct EntityInput {
    pub code: String,
    pub name: String,
    pub gstin: Option<String>,
    pub drug_licence: Option<String>,
    pub address: Option<String>,
    pub receipt_prefix: String,
    #[serde(default)]
    pub is_default: bool,
    #[serde(default = "yes")]
    pub is_active: bool,
}

const fn yes() -> bool {
    true
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BillingLane {
    pub lane: String,
    pub legal_entity_id: Uuid,
    pub entity_name: Option<String>,
    pub revenue_department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub default_mode: String,
    pub charge_at: String,
    pub fee_amount: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct LaneInput {
    pub legal_entity_id: Uuid,
    pub revenue_department_id: Option<Uuid>,
    pub default_mode: String,
    pub charge_at: String,
    pub fee_amount: Option<Decimal>,
}

const ENTITY_COLUMNS: &str =
    "id, code, name, gstin, drug_licence, address, receipt_prefix, is_default, is_active";

async fn begin(state: &AppState, claims: &Claims) -> Result<Tx<'static>, AppError> {
    require_permission(claims, permissions::billing::lanes::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("SELECT public.billing_ensure_defaults($1)")
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

fn trimmed(v: Option<&str>) -> Option<String> {
    v.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// A unique or check violation is the user's input, not a fault.
fn refused(e: sqlx::Error) -> AppError {
    let code = e
        .as_database_error()
        .and_then(sqlx::error::DatabaseError::code)
        .map(std::borrow::Cow::into_owned);
    match code.as_deref() {
        Some("23505") => {
            AppError::Conflict("Another entity already uses that code or receipt prefix".to_owned())
        }
        Some("23514") => AppError::BadRequest(
            "Check the code, GSTIN (15 characters) and receipt prefix (up to 8 letters or digits)"
                .to_owned(),
        ),
        Some("23503") => AppError::BadRequest("Unknown department or entity".to_owned()),
        _ => AppError::from(e),
    }
}

pub async fn list_entities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BillingEntity>>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, BillingEntity>(&format!(
        "SELECT {ENTITY_COLUMNS} FROM billing_entities \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, code LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

async fn save_entity(
    tx: &mut Tx<'_>,
    claims: &Claims,
    id: Option<Uuid>,
    b: &EntityInput,
) -> Result<BillingEntity, AppError> {
    if b.is_default {
        sqlx::query(
            "UPDATE billing_entities SET is_default = false \
              WHERE tenant_id = $1 AND is_default AND id IS DISTINCT FROM $2",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .execute(&mut **tx)
        .await?;
    }
    let sql = match id {
        None => format!(
            "INSERT INTO billing_entities (tenant_id, code, name, gstin, drug_licence, address, \
               receipt_prefix, is_default, is_active, created_by) \
             VALUES ($1, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING {ENTITY_COLUMNS}"
        ),
        Some(_) => format!(
            "UPDATE billing_entities SET code = $3, name = $4, gstin = $5, drug_licence = $6, \
               address = $7, receipt_prefix = $8, is_default = $9 OR is_default, is_active = $10 \
              WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING {ENTITY_COLUMNS}"
        ),
    };
    sqlx::query_as::<_, BillingEntity>(&sql)
        .bind(claims.tenant_id)
        .bind(id)
        .bind(b.code.trim().to_uppercase())
        .bind(b.name.trim())
        .bind(trimmed(b.gstin.as_deref()).map(|g| g.to_uppercase()))
        .bind(trimmed(b.drug_licence.as_deref()))
        .bind(trimmed(b.address.as_deref()))
        .bind(b.receipt_prefix.trim().to_uppercase())
        .bind(b.is_default)
        .bind(b.is_active)
        .bind(claims.sub)
        .fetch_optional(&mut **tx)
        .await
        .map_err(refused)?
        .ok_or(AppError::NotFound)
}

pub async fn create_entity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<EntityInput>,
) -> Result<Json<BillingEntity>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let row = save_entity(&mut tx, &claims, None, &body).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_entity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EntityInput>,
) -> Result<Json<BillingEntity>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let row = save_entity(&mut tx, &claims, Some(id), &body).await?;
    tx.commit().await?;
    Ok(Json(row))
}

const LANE_SELECT: &str = "SELECT l.lane, l.legal_entity_id, e.name AS entity_name, \
       l.revenue_department_id, d.name AS department_name, l.default_mode, l.charge_at, \
       l.fee_amount \
  FROM billing_lanes l \
  LEFT JOIN billing_entities e ON e.id = l.legal_entity_id \
  LEFT JOIN departments d ON d.id = l.revenue_department_id \
 WHERE l.tenant_id = $1 AND l.deleted_at IS NULL";

pub async fn list_lanes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BillingLane>>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, BillingLane>(&format!(
        "{LANE_SELECT} ORDER BY array_position(ARRAY['registration', 'opd', 'lab', 'radiology', \
         'emergency', 'ipd', 'pharmacy'], l.lane)"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn update_lane(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(lane): Path<String>,
    Json(b): Json<LaneInput>,
) -> Result<Json<BillingLane>, AppError> {
    if !is_lane(&lane) {
        return Err(AppError::NotFound);
    }
    let mut tx = begin(&state, &claims).await?;
    let updated: Option<String> = sqlx::query_scalar(
        "UPDATE billing_lanes SET legal_entity_id = $3, revenue_department_id = $4, \
                default_mode = $5, charge_at = $6, fee_amount = $7 \
          WHERE tenant_id = $1 AND lane = $2 AND deleted_at IS NULL \
            AND EXISTS (SELECT 1 FROM billing_entities WHERE id = $3 AND tenant_id = $1 \
                          AND is_active AND deleted_at IS NULL) \
          RETURNING lane",
    )
    .bind(claims.tenant_id)
    .bind(&lane)
    .bind(b.legal_entity_id)
    .bind(b.revenue_department_id)
    .bind(&b.default_mode)
    .bind(&b.charge_at)
    .bind(b.fee_amount)
    .fetch_optional(&mut *tx)
    .await
    .map_err(refused)?;
    updated.ok_or_else(|| AppError::BadRequest("Pick an active billing entity".to_owned()))?;
    let row = sqlx::query_as::<_, BillingLane>(&format!("{LANE_SELECT} AND l.lane = $2"))
        .bind(claims.tenant_id)
        .bind(&lane)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

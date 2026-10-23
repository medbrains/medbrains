//! Duplicate drugs in the pharmacy catalogue (#4861): a report of likely
//! duplicates and a merge that moves every reference to the drug that stays.
//! Gated on `pharmacy.catalog.merge`, recorded in `pharmacy_catalog_merges`,
//! and refused outright when the two differ in schedule or NDPS control —
//! merging those would move controlled stock onto an uncontrolled record.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Name similarity (`pg_trgm`, 0–1) from which two drugs of the same strength
/// and form are reported as likely duplicates. Inferred; tune on real data.
pub const DUPLICATE_SIMILARITY: f64 = 0.6;
/// Pairs reported at once.
pub const DUPLICATE_PAIRS_LIMIT: i64 = 100;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DuplicatePair {
    pub a_id: Uuid,
    pub a_code: String,
    pub a_name: String,
    pub a_stock: i32,
    pub b_id: Uuid,
    pub b_code: String,
    pub b_name: String,
    pub b_stock: i32,
    pub strength: Option<String>,
    pub dosage_form: Option<String>,
    pub score: f64,
    /// Why these two may not be merged, when they may not.
    pub blocked_reason: Option<String>,
}

/// `GET /api/pharmacy/catalog/duplicates`
pub async fn list_duplicates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DuplicatePair>>, AppError> {
    require_permission(&claims, permissions::pharmacy::catalog::MERGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DuplicatePair>(
        "SELECT a.id AS a_id, a.code AS a_code, a.name AS a_name, a.current_stock AS a_stock, \
                b.id AS b_id, b.code AS b_code, b.name AS b_name, b.current_stock AS b_stock, \
                a.strength, a.dosage_form, \
                similarity(lower(a.name), lower(b.name))::float8 AS score, \
                CASE WHEN a.drug_schedule IS DISTINCT FROM b.drug_schedule \
                       OR a.is_controlled <> b.is_controlled \
                       OR a.narcotic_class IS DISTINCT FROM b.narcotic_class \
                     THEN 'They differ in drug schedule or NDPS control' END AS blocked_reason \
           FROM pharmacy_catalog a \
           JOIN pharmacy_catalog b ON b.tenant_id = a.tenant_id AND a.id < b.id \
                AND lower(a.name) % lower(b.name) \
                AND b.deleted_at IS NULL AND b.merged_into_id IS NULL \
          WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.merged_into_id IS NULL \
            AND regexp_replace(lower(COALESCE(a.strength, '')), '\\s', '', 'g') \
              = regexp_replace(lower(COALESCE(b.strength, '')), '\\s', '', 'g') \
            AND lower(COALESCE(a.dosage_form, '')) = lower(COALESCE(b.dosage_form, '')) \
            AND similarity(lower(a.name), lower(b.name)) >= $2 \
          ORDER BY score DESC, a.name LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(DUPLICATE_SIMILARITY)
    .bind(DUPLICATE_PAIRS_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct MergeRequest {
    pub survivor_id: Uuid,
    pub merged_id: Uuid,
    pub reason: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CatalogMerge {
    pub id: Uuid,
    pub survivor_id: Uuid,
    pub merged_id: Uuid,
    pub repointed: serde_json::Value,
    pub stock_moved: i32,
    pub reason: String,
    pub merged_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct Drug {
    id: Uuid,
    code: String,
    drug_schedule: Option<String>,
    is_controlled: bool,
    narcotic_class: Option<String>,
    current_stock: i32,
}

/// `POST /api/pharmacy/catalog/merge` — merge `merged_id` into `survivor_id`.
pub async fn merge_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MergeRequest>,
) -> Result<Json<CatalogMerge>, AppError> {
    require_permission(&claims, permissions::pharmacy::catalog::MERGE)?;
    if body.survivor_id == body.merged_id {
        return Err(AppError::BadRequest("Choose two different drugs".into()));
    }
    if body.reason.trim().len() < 5 {
        return Err(AppError::BadRequest(
            "Say why these are the same drug".into(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Lock both, in id order, so two merges never deadlock.
    let drugs: Vec<Drug> = sqlx::query_as(
        "SELECT id, code, drug_schedule, is_controlled, narcotic_class, current_stock \
           FROM pharmacy_catalog \
          WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL AND merged_into_id IS NULL \
          ORDER BY id FOR UPDATE",
    )
    .bind(claims.tenant_id)
    .bind(vec![body.survivor_id, body.merged_id])
    .fetch_all(&mut *tx)
    .await?;
    let find = |id: Uuid| drugs.iter().find(|d| d.id == id);
    let (Some(survivor), Some(merged)) = (find(body.survivor_id), find(body.merged_id)) else {
        return Err(AppError::NotFound);
    };
    if survivor.drug_schedule != merged.drug_schedule
        || survivor.is_controlled != merged.is_controlled
        || survivor.narcotic_class != merged.narcotic_class
    {
        return Err(AppError::Conflict(
            "These drugs differ in schedule or NDPS control and are never merged.".into(),
        ));
    }
    let repointed: serde_json::Value =
        sqlx::query_scalar("SELECT repoint_pharmacy_catalog_refs($1, $2)")
            .bind(merged.id)
            .bind(survivor.id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                AppError::Conflict(format!(
                    "Could not move the duplicate's records, nothing was merged: {e}"
                ))
            })?;
    sqlx::query("UPDATE pharmacy_catalog SET current_stock = current_stock + $2 WHERE id = $1")
        .bind(survivor.id)
        .bind(merged.current_stock)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "UPDATE pharmacy_catalog SET merged_into_id = $2, is_active = false, current_stock = 0, \
                deleted_at = now(), deleted_by = $3, delete_reason = $4 \
          WHERE id = $1",
    )
    .bind(merged.id)
    .bind(survivor.id)
    .bind(claims.sub)
    .bind(format!(
        "Merged into {}: {}",
        survivor.code,
        body.reason.trim()
    ))
    .execute(&mut *tx)
    .await?;
    let record = sqlx::query_as::<_, CatalogMerge>(
        "INSERT INTO pharmacy_catalog_merges \
             (tenant_id, survivor_id, merged_id, repointed, stock_moved, reason, merged_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7) \
         RETURNING id, survivor_id, merged_id, repointed, stock_moved, reason, merged_by, created_at",
    )
    .bind(claims.tenant_id)
    .bind(survivor.id)
    .bind(merged.id)
    .bind(&repointed)
    .bind(merged.current_stock)
    .bind(body.reason.trim())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(record))
}

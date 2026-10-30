//! NPPA ceiling prices (Drugs (Prices Control) Order 2013, paras 13-14): no
//! scheduled formulation is sold above its notified ceiling. NPPA publishes
//! ceilings as gazette notifications, not a machine-readable feed, so every
//! value here is the hospital's transcription — typed in, or imported from a
//! sheet — with the notification it came from. The storefront and the
//! counter price below `min(batch MRP, ceiling)`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Items one page lists, at most.
const LIST_LIMIT: i64 = 200;
/// Rows one import takes, at most.
const IMPORT_LIMIT: usize = 5000;
/// Said beside every ceiling, so nobody mistakes it for a live feed.
pub const SOURCE_NOTE: &str = "Transcribed by the hospital from NPPA notifications; NPPA \
     publishes no machine-readable feed (inferred). Check against the latest notification.";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CeilingRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub strength: Option<String>,
    pub mrp: Option<Decimal>,
    pub nppa_ceiling_price: Option<Decimal>,
    pub nppa_notification: Option<String>,
    pub nppa_ceiling_source: Option<String>,
    pub nppa_updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct Ceilings {
    pub rows: Vec<CeilingRow>,
    pub source_note: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct CeilingQuery {
    pub q: Option<String>,
}

/// `GET /api/pharmacy/nppa-ceilings?q=` — catalogue items and their
/// ceilings, those with one first.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<CeilingQuery>,
) -> Result<Json<Ceilings>, AppError> {
    require_permission(&claims, permissions::pharmacy::nppa::MANAGE)?;
    let q = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.to_lowercase()
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        });
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, CeilingRow>(
        "SELECT id, code, name, strength, mrp, nppa_ceiling_price, nppa_notification, \
                nppa_ceiling_source, nppa_updated_at \
           FROM pharmacy_catalog \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active \
            AND ($2::text IS NULL OR lower(name) LIKE '%' || $2 || '%' \
                 OR lower(code) LIKE '%' || $2 || '%') \
          ORDER BY nppa_ceiling_price IS NULL, name LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(q)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(Ceilings {
        rows,
        source_note: SOURCE_NOTE,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CeilingUpdate {
    /// None clears the ceiling.
    pub ceiling_price: Option<Decimal>,
    pub notification: Option<String>,
}

fn check(price: Option<Decimal>) -> Result<(), AppError> {
    if price.is_some_and(|p| p <= Decimal::ZERO) {
        return Err(AppError::BadRequest(
            "A ceiling price is more than zero".to_owned(),
        ));
    }
    Ok(())
}

/// `PUT /api/pharmacy/nppa-ceilings/{id}` — one item's ceiling, typed in.
pub async fn set(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CeilingUpdate>,
) -> Result<Json<CeilingRow>, AppError> {
    require_permission(&claims, permissions::pharmacy::nppa::MANAGE)?;
    check(body.ceiling_price)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, CeilingRow>(
        "UPDATE pharmacy_catalog \
            SET nppa_ceiling_price = $3, \
                nppa_notification = NULLIF(trim(COALESCE($4, '')), ''), \
                nppa_ceiling_source = CASE WHEN $3::numeric IS NULL THEN NULL ELSE 'manual' END, \
                nppa_updated_at = now(), updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING id, code, name, strength, mrp, nppa_ceiling_price, nppa_notification, \
                   nppa_ceiling_source, nppa_updated_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.ceiling_price)
    .bind(&body.notification)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ImportRow {
    /// The catalogue code.
    pub code: String,
    pub ceiling_price: Decimal,
    pub notification: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImportRequest {
    pub rows: Vec<ImportRow>,
}

#[derive(Debug, Serialize)]
pub struct Imported {
    pub updated: u64,
    /// Codes with no catalogue item.
    pub unmatched: Vec<String>,
}

/// `POST /api/pharmacy/nppa-ceilings/import` — ceilings from a sheet,
/// matched on catalogue code. One statement for all of them.
pub async fn import(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ImportRequest>,
) -> Result<Json<Imported>, AppError> {
    require_permission(&claims, permissions::pharmacy::nppa::MANAGE)?;
    if body.rows.is_empty() || body.rows.len() > IMPORT_LIMIT {
        return Err(AppError::BadRequest(format!(
            "Import 1 to {IMPORT_LIMIT} rows"
        )));
    }
    for r in &body.rows {
        check(Some(r.ceiling_price))?;
    }
    let codes: Vec<String> = body.rows.iter().map(|r| r.code.trim().to_owned()).collect();
    let prices: Vec<Decimal> = body.rows.iter().map(|r| r.ceiling_price).collect();
    let notes: Vec<Option<String>> = body.rows.iter().map(|r| r.notification.clone()).collect();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let matched: Vec<String> = sqlx::query_scalar(
        "UPDATE pharmacy_catalog c \
            SET nppa_ceiling_price = v.price, \
                nppa_notification = NULLIF(trim(COALESCE(v.note, '')), ''), \
                nppa_ceiling_source = 'import', nppa_updated_at = now(), updated_at = now() \
           FROM unnest($2::text[], $3::numeric[], $4::text[]) AS v(code, price, note) \
          WHERE c.tenant_id = $1 AND c.code = v.code AND c.deleted_at IS NULL \
         RETURNING c.code",
    )
    .bind(claims.tenant_id)
    .bind(&codes)
    .bind(&prices)
    .bind(&notes)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let found: std::collections::HashSet<&str> = matched.iter().map(String::as_str).collect();
    Ok(Json(Imported {
        updated: u64::try_from(matched.len()).unwrap_or(u64::MAX),
        unmatched: codes
            .iter()
            .filter(|c| !found.contains(c.as_str()))
            .cloned()
            .collect(),
    }))
}

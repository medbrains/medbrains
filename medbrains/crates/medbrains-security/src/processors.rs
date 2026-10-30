//! The register of data processors (DPDP Act s.8(2), s.16): every outside
//! service that handles patient data for the hospital, what it receives, the
//! country it keeps it in, and the agreement that binds it. A processor with
//! no agreement, an expired one, or one keeping data outside India is what a
//! privacy officer needs to see first, so the register says so for each.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const CATEGORIES: [&str; 6] = [
    "identity", "contact", "clinical", "billing", "images", "staff",
];
/// An agreement this close to expiry is flagged before it lapses.
const DPA_WARNING_DAYS: i32 = 30;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DataProcessor {
    pub id: Uuid,
    pub name: String,
    pub service: String,
    pub data_categories: Vec<String>,
    pub country: String,
    pub sub_processor_of: Option<Uuid>,
    pub sub_processor_of_name: Option<String>,
    pub dpa_reference: Option<String>,
    pub dpa_signed_on: Option<NaiveDate>,
    pub dpa_expires_on: Option<NaiveDate>,
    pub status: String,
    pub notes: Option<String>,
    /// `missing` | `expired` | `expiring` | `in_force`.
    pub dpa_state: String,
    pub created_at: DateTime<Utc>,
}

const SELECT: &str = "SELECT d.id, d.name, d.service, d.data_categories, d.country, \
        d.sub_processor_of, parent.name AS sub_processor_of_name, d.dpa_reference, \
        d.dpa_signed_on, d.dpa_expires_on, d.status, d.notes, \
        CASE WHEN d.dpa_reference IS NULL THEN 'missing' \
             WHEN d.dpa_expires_on < current_date THEN 'expired' \
             WHEN d.dpa_expires_on < current_date + $2 THEN 'expiring' \
             ELSE 'in_force' END AS dpa_state, \
        d.created_at \
   FROM data_processors d \
   LEFT JOIN data_processors parent ON parent.id = d.sub_processor_of";

/// `GET /api/data-processors` — active first; within them, the ones needing
/// attention (no agreement, lapsed) at the top.
pub async fn list_processors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DataProcessor>>, AppError> {
    require_permission(&claims, permissions::audit::processors::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DataProcessor>(&format!(
        "{SELECT} WHERE d.tenant_id = $1 AND d.deleted_at IS NULL \
         ORDER BY d.status, (d.dpa_reference IS NULL OR d.dpa_expires_on < current_date) DESC, d.name \
         LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(DPA_WARNING_DAYS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ProcessorInput {
    pub name: String,
    pub service: String,
    #[serde(default)]
    pub data_categories: Vec<String>,
    pub country: String,
    pub sub_processor_of: Option<Uuid>,
    pub dpa_reference: Option<String>,
    pub dpa_signed_on: Option<NaiveDate>,
    pub dpa_expires_on: Option<NaiveDate>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

impl ProcessorInput {
    fn validate(&self) -> Result<(), AppError> {
        if self.name.trim().is_empty() || self.service.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Name the processor and what it does".to_owned(),
            ));
        }
        if let Some(c) = self
            .data_categories
            .iter()
            .find(|c| !CATEGORIES.contains(&c.as_str()))
        {
            return Err(AppError::BadRequest(format!("{c} is not a data category")));
        }
        let country = self.country.trim();
        if country.len() != 2 || !country.chars().all(|ch| ch.is_ascii_uppercase()) {
            return Err(AppError::BadRequest(
                "Country is a two-letter code, e.g. IN or US".to_owned(),
            ));
        }
        if let (Some(signed), Some(expires)) = (self.dpa_signed_on, self.dpa_expires_on)
            && expires < signed
        {
            return Err(AppError::BadRequest(
                "The agreement ends before it was signed".to_owned(),
            ));
        }
        if self
            .status
            .as_deref()
            .is_some_and(|s| !["active", "retired"].contains(&s))
        {
            return Err(AppError::BadRequest(
                "Status is active or retired".to_owned(),
            ));
        }
        Ok(())
    }
}

fn opt(v: Option<&str>) -> Option<String> {
    v.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

async fn fetch_one(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<DataProcessor, AppError> {
    sqlx::query_as::<_, DataProcessor>(&format!("{SELECT} WHERE d.id = $1 AND d.tenant_id = $3"))
        .bind(id)
        .bind(DPA_WARNING_DAYS)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// `POST /api/data-processors`
pub async fn create_processor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ProcessorInput>,
) -> Result<Json<DataProcessor>, AppError> {
    require_permission(&claims, permissions::audit::processors::MANAGE)?;
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO data_processors (tenant_id, name, service, data_categories, country, \
           sub_processor_of, dpa_reference, dpa_signed_on, dpa_expires_on, notes, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(body.service.trim())
    .bind(&body.data_categories)
    .bind(body.country.trim())
    .bind(body.sub_processor_of)
    .bind(opt(body.dpa_reference.as_deref()))
    .bind(body.dpa_signed_on)
    .bind(body.dpa_expires_on)
    .bind(opt(body.notes.as_deref()))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => {
            AppError::Conflict("A processor with this name is already on the register".to_owned())
        }
        _ => AppError::from(e),
    })?;
    let row = fetch_one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/data-processors/{id}` — the whole entry, as edited.
pub async fn update_processor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ProcessorInput>,
) -> Result<Json<DataProcessor>, AppError> {
    require_permission(&claims, permissions::audit::processors::MANAGE)?;
    body.validate()?;
    if body.sub_processor_of == Some(id) {
        return Err(AppError::BadRequest(
            "A processor cannot be its own sub-processor".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let updated = sqlx::query(
        "UPDATE data_processors SET name = $3, service = $4, data_categories = $5, country = $6, \
           sub_processor_of = $7, dpa_reference = $8, dpa_signed_on = $9, dpa_expires_on = $10, \
           status = COALESCE($11, status), notes = $12 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(body.service.trim())
    .bind(&body.data_categories)
    .bind(body.country.trim())
    .bind(body.sub_processor_of)
    .bind(opt(body.dpa_reference.as_deref()))
    .bind(body.dpa_signed_on)
    .bind(body.dpa_expires_on)
    .bind(body.status.as_deref())
    .bind(opt(body.notes.as_deref()))
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    let row = fetch_one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

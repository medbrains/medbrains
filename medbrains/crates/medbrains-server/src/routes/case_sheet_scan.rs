//! Handwritten case-sheet digitization — B2 ingestion (RFC-CASE-SHEET-DIGITIZATION). A scanned
//! case sheet is uploaded (`uploaded`), submitted for parsing (`parsing`); an async on-prem
//! MinerU+VLM worker polls `status='parsing'`, does layout+HTR, and posts a structured per-field
//! draft back via `parse_result` (`parsed` / `failed`). The doctor review-and-commit UI (B3)
//! takes it from there. Gated by `mrd.case_sheets.*`.

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CaseSheetScan {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub scan_image_url: String,
    pub status: String,
    pub extracted_json: Option<serde_json::Value>,
    pub overall_confidence: Option<Decimal>,
    pub parse_error: Option<String>,
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScanRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub scan_image_url: String,
}

/// `POST /api/case-sheets/scans` — register an uploaded scan (S3 key) for a patient.
pub async fn create_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScanRequest>,
) -> Result<Json<CaseSheetScan>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;
    if body.scan_image_url.trim().is_empty() {
        return Err(AppError::BadRequest("scan_image_url is required".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = sqlx::query_as::<_, CaseSheetScan>(
        "INSERT INTO case_sheet_scans \
         (tenant_id, patient_id, encounter_id, scan_image_url, uploaded_by) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.scan_image_url.trim())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scan))
}

#[derive(Debug, Deserialize)]
pub struct ListScanQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
}

/// `GET /api/case-sheets/scans?status=&patient_id=` — list scans (worker filters `status=parsing`).
pub async fn list_scans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListScanQuery>,
) -> Result<Json<Vec<CaseSheetScan>>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scans = sqlx::query_as::<_, CaseSheetScan>(
        "SELECT * FROM case_sheet_scans WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
           AND ($3::uuid IS NULL OR patient_id = $3) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scans))
}

/// `GET /api/case-sheets/scans/{id}` — one scan with its extracted draft.
pub async fn get_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CaseSheetScan>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = sqlx::query_as::<_, CaseSheetScan>(
        "SELECT * FROM case_sheet_scans WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(scan))
}

/// `POST /api/case-sheets/scans/{id}/submit` — queue for parsing (worker picks it up).
pub async fn submit_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CaseSheetScan>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = sqlx::query_as::<_, CaseSheetScan>(
        "UPDATE case_sheet_scans SET status = 'parsing', parse_error = NULL, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('uploaded', 'failed', 'image_only') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Scan is not in a submittable state".to_owned()))?;
    tx.commit().await?;
    Ok(Json(scan))
}

#[derive(Debug, Deserialize)]
pub struct ParseResultRequest {
    pub extracted_json: Option<serde_json::Value>,
    pub overall_confidence: Option<Decimal>,
    pub parse_error: Option<String>,
}

/// `POST /api/case-sheets/scans/{id}/parse-result` — the MinerU+VLM worker posts the structured
/// draft back (or an error). `parsing` → `parsed` (or `failed`).
pub async fn parse_result(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ParseResultRequest>,
) -> Result<Json<CaseSheetScan>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;
    let new_status = if body.parse_error.is_some() {
        "failed"
    } else {
        "parsed"
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = sqlx::query_as::<_, CaseSheetScan>(
        "UPDATE case_sheet_scans SET status = $3, extracted_json = $4, \
             overall_confidence = $5, parse_error = $6, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'parsing' RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .bind(&body.extracted_json)
    .bind(body.overall_confidence)
    .bind(&body.parse_error)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Scan is not awaiting parse results".to_owned()))?;
    tx.commit().await?;
    Ok(Json(scan))
}

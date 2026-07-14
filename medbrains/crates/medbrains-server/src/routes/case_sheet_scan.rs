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

    // Register-first lock (opt-in): no case-sheet scan until the OPD visit is registered.
    super::opd::assert_patient_opd_registered(&mut tx, &claims.tenant_id, body.patient_id).await?;

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
    // Patient-scoped list is a clinical read → gate on patient access. The
    // unscoped list is the MRD processing queue (operational, role-gated).
    if let Some(patient_id) = q.patient_id {
        crate::authz_patient::require_patient_access(&state, &claims, patient_id).await?;
    }
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
    // A scanned case sheet is patient clinical content — gate on patient access
    // (reachable via the patient's care team; RFC-ACCESS-RESOLUTION-GRAPH).
    crate::authz_patient::require_patient_access(&state, &claims, scan.patient_id).await?;
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

#[derive(Debug, Deserialize)]
pub struct SaveReviewRequest {
    pub extracted_json: serde_json::Value,
}

/// `PUT /api/case-sheets/scans/{id}/review` — the doctor saves corrected fields. → `reviewing`.
pub async fn save_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SaveReviewRequest>,
) -> Result<Json<CaseSheetScan>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = sqlx::query_as::<_, CaseSheetScan>(
        "UPDATE case_sheet_scans SET extracted_json = $3, status = 'reviewing', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('parsed', 'reviewing', 'image_only') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.extracted_json)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Scan is not in a reviewable state".to_owned()))?;
    tx.commit().await?;
    Ok(Json(scan))
}

/// Render the structured draft as a clinical-note text block.
fn format_case_sheet_note(extracted: Option<&serde_json::Value>) -> String {
    let mut out = String::from("Digitized case sheet:");
    if let Some(serde_json::Value::Array(items)) = extracted {
        for item in items {
            let field = item.get("field").and_then(serde_json::Value::as_str).unwrap_or("");
            let value = item.get("value").and_then(serde_json::Value::as_str).unwrap_or("");
            if !field.is_empty() {
                out.push_str(&format!("\n- {field}: {value}"));
            }
        }
    }
    out
}

/// `POST /api/case-sheets/scans/{id}/commit` — file the verified case sheet into the patient's
/// clinical record (appends to the running note) and mark it `committed`.
pub async fn commit_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CaseSheetScan>, AppError> {
    require_permission(&claims, permissions::mrd::case_sheets::FILE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let scan = sqlx::query_as::<_, CaseSheetScan>(
        "SELECT * FROM case_sheet_scans \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('parsed', 'reviewing')",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Scan is not ready to commit".to_owned()))?;

    let note = format_case_sheet_note(scan.extracted_json.as_ref());
    sqlx::query(
        "INSERT INTO patient_clinical_notes \
            (tenant_id, patient_id, text, last_author_id, \
             last_author_name, last_edited_at, version) \
         VALUES ($1, $2, $3, $4, (SELECT full_name FROM users WHERE id = $4), now(), 1) \
         ON CONFLICT (tenant_id, patient_id) DO UPDATE SET \
            text = patient_clinical_notes.text || E'\\n\\n' || EXCLUDED.text, \
            last_author_id = EXCLUDED.last_author_id, \
            last_author_name = EXCLUDED.last_author_name, \
            last_edited_at = now(), \
            version = patient_clinical_notes.version + 1",
    )
    .bind(claims.tenant_id)
    .bind(scan.patient_id)
    .bind(&note)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    let committed = sqlx::query_as::<_, CaseSheetScan>(
        "UPDATE case_sheet_scans SET status = 'committed', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(committed))
}

//! Research datasets: de-identified extracts for ethics-approved studies,
//! released under maker-checker.
//!
//! A holder of `research.dataset.export` asks for a dataset over a period,
//! naming the study's purpose and its IEC approval — on the Data exports
//! screen, or through the assistant, which may prepare a request but never
//! sees a row. A *different* holder approves or rejects it. On approval the
//! extract is read and de-identified ([`deid`]) and kept for 24 hours as two
//! CSV files — the data, every row stamped with the export's reference, and
//! its data dictionary with the suppression report. Only the requester and
//! the approver may download, and each download is recorded with the file's
//! SHA-256. Expired files and the export's salt are then cleared.
//!
//! Legal frame: DPDP Act 2023 s.17(2)(b) (research, with the data not used
//! for decisions about the person and processed to the prescribed standards)
//! and the ICMR National Ethical Guidelines (2017): IEC approval before
//! release, the minimum data, and de-identification before data leaves the
//! hospital.

pub mod build;
pub mod datasets;
pub mod deid;
pub mod omop;

use axum::{
    Extension, Json,
    extract::{Path, State},
    routing::{get, post},
};
use base64::Engine as _;
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// How long a ready export may be downloaded.
const KEEP_HOURS: i64 = 24;
/// Longest period one export may cover (five years).
const MAX_PERIOD_DAYS: i64 = 1_830;

/// A new export request.
#[derive(Debug, Deserialize)]
pub struct NewExport {
    pub dataset: String,
    pub period_from: NaiveDate,
    pub period_to: NaiveDate,
    pub purpose: String,
    pub iec_reference: String,
}

/// An export as the screen lists it — never its files or salt.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportRow {
    pub id: Uuid,
    pub dataset: String,
    pub period_from: NaiveDate,
    pub period_to: NaiveDate,
    pub purpose: String,
    pub iec_reference: String,
    pub status: String,
    pub requested_by: Uuid,
    pub requested_by_name: Option<String>,
    pub requested_via: String,
    pub decided_by: Option<Uuid>,
    pub decided_by_name: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub decision_note: Option<String>,
    pub row_count: Option<i32>,
    pub suppressed_rows: Option<i32>,
    pub suppression_report: Option<Value>,
    pub data_sha256: Option<String>,
    pub ready_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// A file to save: its name, hash and contents.
#[derive(Debug, Serialize)]
pub struct ExportFile {
    pub filename: String,
    pub sha256: String,
    pub content: String,
    /// `utf-8` for CSV and text, `base64` for the OMOP zip.
    pub encoding: String,
}

#[derive(Debug, Deserialize)]
pub struct Decision {
    #[serde(default)]
    pub note: Option<String>,
}

const SELECT: &str = "SELECT x.id, x.dataset, x.period_from, x.period_to, x.purpose, x.iec_reference, \
    CASE WHEN x.status = 'ready' AND x.expires_at <= now() THEN 'expired' ELSE x.status END AS status, \
    x.requested_by, r.full_name AS requested_by_name, x.requested_via, x.decided_by, \
    d.full_name AS decided_by_name, x.decided_at, x.decision_note, x.row_count, x.suppressed_rows, \
    x.suppression_report, x.data_sha256, x.ready_at, x.expires_at, x.created_at \
    FROM research_exports x LEFT JOIN users r ON r.id = x.requested_by \
    LEFT JOIN users d ON d.id = x.decided_by WHERE x.tenant_id = $1 AND x.deleted_at IS NULL";

async fn tx_for(
    state: &AppState,
    tenant: Uuid,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await?;
    Ok(tx)
}

/// What is wrong with a request, if anything.
fn invalid(new: &NewExport) -> Option<String> {
    if datasets::fields(&new.dataset).is_none() && new.dataset != build::OMOP {
        return Some(format!(
            "choose one of: {}, {}",
            datasets::NAMES.join(", "),
            build::OMOP
        ));
    }
    let days = (new.period_to - new.period_from).num_days();
    if !(0..=MAX_PERIOD_DAYS).contains(&days) {
        return Some(format!(
            "the period must run forwards and cover at most {MAX_PERIOD_DAYS} days"
        ));
    }
    if new.period_to > Utc::now().date_naive() {
        return Some("the period cannot end in the future".to_owned());
    }
    if new.purpose.trim().chars().count() < 20 {
        return Some("describe the study's purpose in at least 20 characters".to_owned());
    }
    if new.iec_reference.trim().chars().count() < 3 {
        return Some("give the IEC approval reference".to_owned());
    }
    None
}

/// Record a request. Used by the screen and by the assistant (`via`).
///
/// # Errors
/// 403 without the permission; 400 for an invalid request.
pub async fn create_request(
    state: &AppState,
    claims: &Claims,
    new: &NewExport,
    via: &str,
) -> Result<ExportRow, AppError> {
    require_permission(claims, permissions::research::dataset::EXPORT)?;
    if let Some(why) = invalid(new) {
        return Err(AppError::BadRequest(why));
    }
    let mut tx = tx_for(state, claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO research_exports (tenant_id, dataset, period_from, period_to, purpose, \
         iec_reference, requested_by, requested_via) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&new.dataset)
    .bind(new.period_from)
    .bind(new.period_to)
    .bind(new.purpose.trim())
    .bind(new.iec_reference.trim())
    .bind(claims.sub)
    .bind(via)
    .fetch_one(&mut *tx)
    .await?;
    let row = one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(row)
}

async fn one(
    tx: &mut sqlx::Transaction<'static, sqlx::Postgres>,
    tenant: Uuid,
    id: Uuid,
) -> Result<ExportRow, AppError> {
    sqlx::query_as::<_, ExportRow>(&format!("{SELECT} AND x.id = $2"))
        .bind(tenant)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// `GET /api/research/exports` — the latest 100, after clearing expired files.
async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ExportRow>>, AppError> {
    require_permission(&claims, permissions::research::dataset::EXPORT)?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    purge_expired(&mut tx, claims.tenant_id).await?;
    let rows =
        sqlx::query_as::<_, ExportRow>(&format!("{SELECT} ORDER BY x.created_at DESC LIMIT 100"))
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Clear the files and salt of every export past its 24 hours.
async fn purge_expired(
    tx: &mut sqlx::Transaction<'static, sqlx::Postgres>,
    tenant: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE research_exports SET data_csv = NULL, dictionary_csv = NULL, salt = NULL \
         WHERE tenant_id = $1 AND expires_at <= now() AND (data_csv IS NOT NULL OR salt IS NOT NULL)",
    )
    .bind(tenant)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// `POST /api/research/exports`
async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(new): Json<NewExport>,
) -> Result<Json<ExportRow>, AppError> {
    Ok(Json(create_request(&state, &claims, &new, "screen").await?))
}

/// A requested export, locked, that `claims` may decide.
async fn decidable(
    tx: &mut sqlx::Transaction<'static, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<ExportRow, AppError> {
    sqlx::query("SELECT 1 FROM research_exports WHERE id = $1 AND tenant_id = $2 FOR UPDATE")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut **tx)
        .await?;
    let row = one(tx, claims.tenant_id, id).await?;
    if row.status != "requested" {
        return Err(AppError::Conflict(format!(
            "this export is already {}",
            row.status
        )));
    }
    if row.requested_by == claims.sub {
        return Err(AppError::ForbiddenReason(
            "a second holder of the permission must approve or reject this request".to_owned(),
        ));
    }
    Ok(row)
}

/// `POST /api/research/exports/{id}/reject`
async fn reject(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(decision): Json<Decision>,
) -> Result<Json<ExportRow>, AppError> {
    require_permission(&claims, permissions::research::dataset::EXPORT)?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    decidable(&mut tx, &claims, id).await?;
    sqlx::query(
        "UPDATE research_exports SET status = 'rejected', decided_by = $3, decided_at = now(), \
         decision_note = $4 WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(decision.note.as_deref().map(str::trim))
    .execute(&mut *tx)
    .await?;
    let row = one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

fn salt() -> Vec<u8> {
    [Uuid::new_v4().into_bytes(), Uuid::new_v4().into_bytes()].concat()
}

/// `POST /api/research/exports/{id}/approve` — approve, then build the files.
async fn approve(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(decision): Json<Decision>,
) -> Result<Json<ExportRow>, AppError> {
    require_permission(&claims, permissions::research::dataset::EXPORT)?;
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let row = decidable(&mut tx, &claims, id).await?;
    let salt = salt();
    let built = match build::build(&mut tx, claims.tenant_id, &row, &salt).await {
        Ok(built) => built,
        Err(datasets::ReadError::Db(e)) => return Err(e.into()),
        Err(e) => {
            sqlx::query(
                "UPDATE research_exports SET status = 'failed', decided_by = $3, decided_at = now(), \
                 decision_note = $4 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(claims.sub)
            .bind(e.to_string())
            .execute(&mut *tx)
            .await?;
            let row = one(&mut tx, claims.tenant_id, id).await?;
            tx.commit().await?;
            return Ok(Json(row));
        }
    };
    let hash = hex::encode(Sha256::digest(&built.data));
    sqlx::query(
        "UPDATE research_exports SET status = 'ready', decided_by = $3, decided_at = now(), \
         decision_note = $4, salt = $5, data_csv = $6, dictionary_csv = $7, data_sha256 = $8, \
         row_count = $9, suppressed_rows = $10, suppression_report = $11, ready_at = now(), \
         expires_at = now() + make_interval(hours => $12) WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(decision.note.as_deref().map(str::trim))
    .bind(&salt)
    .bind(&built.data)
    .bind(&built.dictionary)
    .bind(&hash)
    .bind(i32::try_from(built.rows).unwrap_or(i32::MAX))
    .bind(i32::try_from(built.suppressed).unwrap_or(i32::MAX))
    .bind(&built.report)
    .bind(i32::try_from(KEEP_HOURS).unwrap_or(24))
    .execute(&mut *tx)
    .await?;
    let row = one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Whether `user` may download `row` now.
fn may_download(row: &ExportRow, user: Uuid, now: DateTime<Utc>) -> Result<(), AppError> {
    if row.status != "ready" || row.expires_at.is_none_or(|t| t <= now) {
        return Err(AppError::Conflict(
            "this export is not ready, or its 24 hours are over".to_owned(),
        ));
    }
    if user != row.requested_by && Some(user) != row.decided_by {
        return Err(AppError::ForbiddenReason(
            "only the requester and the approver may download an export".to_owned(),
        ));
    }
    Ok(())
}

/// `GET /api/research/exports/{id}/files/{file}` — `data` or `dictionary`.
async fn download(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, file)): Path<(Uuid, String)>,
) -> Result<Json<ExportFile>, AppError> {
    require_permission(&claims, permissions::research::dataset::EXPORT)?;
    let column = match file.as_str() {
        "data" => "data_csv",
        "dictionary" => "dictionary_csv",
        _ => return Err(AppError::NotFound),
    };
    let mut tx = tx_for(&state, claims.tenant_id).await?;
    let row = one(&mut tx, claims.tenant_id, id).await?;
    may_download(&row, claims.sub, Utc::now())?;
    let bytes: Option<Vec<u8>> = sqlx::query_scalar(&format!(
        "SELECT {column} FROM research_exports WHERE id = $1 AND tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let bytes = bytes.ok_or(AppError::NotFound)?;
    let sha256 = hex::encode(Sha256::digest(&bytes));
    let (filename, text) = if file == "data" {
        build::data_file(&row)
    } else {
        (build::dictionary_file(&row), true)
    };
    let (content, encoding) = if text {
        let text = String::from_utf8(bytes).map_err(|e| AppError::Internal(e.to_string()))?;
        (text, "utf-8")
    } else {
        (
            base64::engine::general_purpose::STANDARD.encode(&bytes),
            "base64",
        )
    };
    sqlx::query(
        "INSERT INTO research_export_downloads (tenant_id, export_id, user_id, file, sha256) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .bind(&file)
    .bind(&sha256)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(ExportFile {
        filename,
        sha256,
        content,
        encoding: encoding.to_owned(),
    }))
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/research/exports", get(list).post(create))
        .route("/api/research/exports/{id}/approve", post(approve))
        .route("/api/research/exports/{id}/reject", post(reject))
        .route("/api/research/exports/{id}/files/{file}", get(download))
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;

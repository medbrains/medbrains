//! The coding switch and the ICD-10 importer, for Settings → Diagnosis coding.

use axum::{Extension, Json, extract::State, http::StatusCode};
use medbrains_core::diagnosis_coding::DiagnosisCoding;
use medbrains_core::permissions::{opd, terminology};
use serde::{Deserialize, Serialize};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;

use super::parse::Format;
use super::store::{self, Icd10Release, ReleaseMeta};

/// An ICD-10 file is ~5 MB as CSV and ~40 MB as `ClaML`.
pub const MAX_UPLOAD_BYTES: usize = 64 * 1024 * 1024;

/// Who may read the switch: everyone who can search codes (the picker needs
/// it), and the administrators who set it.
const READERS: [&str; 3] = [
    terminology::SEARCH,
    opd::queue::VIEW,
    terminology::coding::CONFIGURE,
];

#[derive(Debug, Serialize)]
pub struct DiagnosisCodingStatus {
    pub mode: DiagnosisCoding,
    /// The ICD-10 catalogue in use; `None` = not loaded.
    pub icd10_catalogue: Option<Icd10Release>,
}

async fn status(state: &AppState, claims: &Claims) -> Result<DiagnosisCodingStatus, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mode = store::load_coding(&mut tx, claims.tenant_id).await?;
    let icd10_catalogue = store::active_release(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(DiagnosisCodingStatus {
        mode,
        icd10_catalogue,
    })
}

/// `GET /api/terminology/diagnosis-coding`.
pub async fn get_diagnosis_coding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DiagnosisCodingStatus>, AppError> {
    require_any_permission(&claims, &READERS)?;
    Ok(Json(status(&state, &claims).await?))
}

#[derive(Debug, Deserialize)]
pub struct SetDiagnosisCoding {
    pub mode: DiagnosisCoding,
}

/// `PUT /api/terminology/diagnosis-coding` — existing diagnoses keep the
/// system they were coded in; only new ones follow the switch.
pub async fn set_diagnosis_coding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SetDiagnosisCoding>,
) -> Result<Json<DiagnosisCodingStatus>, AppError> {
    require_permission(&claims, terminology::coding::CONFIGURE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    store::save_coding(&mut tx, claims.tenant_id, claims.sub, body.mode).await?;
    tx.commit().await?;
    Ok(Json(status(&state, &claims).await?))
}

/// `GET /api/terminology/icd10/releases`.
pub async fn list_icd10_releases(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Icd10Release>>, AppError> {
    require_permission(&claims, terminology::coding::CONFIGURE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = store::list_releases(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ImportIcd10Request {
    /// `claml` | `csv`.
    pub format: String,
    pub version: String,
    /// Who supplied the file (e.g. "WHO, via our ICD-10 licence").
    pub source: String,
    /// The licence the hospital holds it under — required.
    pub licence_note: String,
    pub file_name: Option<String>,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct Icd10ImportResult {
    pub release: Icd10Release,
    /// This exact file is already the catalogue in use; nothing changed.
    pub already_loaded: bool,
}

fn required(value: &str, what: &str, max: usize) -> Result<(), AppError> {
    let n = value.trim().chars().count();
    if n == 0 || n > max {
        return Err(AppError::BadRequest(format!(
            "{what} is required (up to {max} characters)"
        )));
    }
    Ok(())
}

/// `POST /api/terminology/icd10/releases` — load the hospital's licensed
/// ICD-10 file, replacing the catalogue in use. Audited.
pub async fn import_icd10_release(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ImportIcd10Request>,
) -> Result<(StatusCode, Json<Icd10ImportResult>), AppError> {
    require_permission(&claims, terminology::coding::CONFIGURE)?;
    let format = Format::parse(body.format.trim())
        .ok_or_else(|| AppError::BadRequest("format must be claml or csv".to_owned()))?;
    required(&body.version, "Version", 64)?;
    required(&body.source, "Source", 200)?;
    required(&body.licence_note, "Licence note", 1000)?;
    let meta = ReleaseMeta {
        version: body.version,
        source: body.source,
        licence_note: body.licence_note,
        file_name: body
            .file_name
            .map(|f| f.trim().chars().take(200).collect::<String>())
            .filter(|f| !f.is_empty()),
        format,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (release, already_loaded) =
        store::import(&mut tx, claims.tenant_id, claims.sub, &meta, &body.content).await?;
    tx.commit().await?;
    let code = if already_loaded {
        StatusCode::OK
    } else {
        StatusCode::CREATED
    };
    Ok((
        code,
        Json(Icd10ImportResult {
            release,
            already_loaded,
        }),
    ))
}

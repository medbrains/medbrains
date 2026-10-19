//! Release management: upload a package, or import one the operator placed
//! in the server's import directory, then watch it load.
//!
//! The upload streams to a temporary file with a hard size limit — the body
//! is never held in memory — and is checked (layout, zip-slip) before any
//! work is queued. The import itself runs in the background; the release row
//! is the progress report.

use std::path::{Path as FsPath, PathBuf};

use axum::{
    Extension, Json,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use futures::StreamExt;
use medbrains_core::permissions::terminology::snomed;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::job::{self, ImportJob};
use crate::package::{self, PackageLayout};
use crate::release::{self, Claim, ClaimInput, SnomedRelease};

const GIB: u64 = 1024 * 1024 * 1024;
/// The International Edition package is ~0.5 GB; extensions are far smaller.
const DEFAULT_UPLOAD_MAX: u64 = 2 * GIB;
const DEFAULT_UNPACKED_MAX: u64 = 8 * GIB;
const MAX_LISTED_FILES: usize = 100;

fn env_bytes(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(default)
}

/// `SNOMED_IMPORT_DIR`: where the operator can place packages too large to
/// upload through a browser or a proxy. Unset = the option is off.
fn import_dir() -> Option<PathBuf> {
    std::env::var("SNOMED_IMPORT_DIR")
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

/// `GET /api/terminology/snomed/releases`.
pub async fn list_releases(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SnomedRelease>>, AppError> {
    require_permission(&claims, snomed::MANAGE)?;
    Ok(Json(release::list(&state.db).await?))
}

/// `GET /api/terminology/snomed/releases/{id}` — polled while importing.
pub async fn get_release(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SnomedRelease>, AppError> {
    require_permission(&claims, snomed::MANAGE)?;
    release::get(&state.db, id)
        .await?
        .map(Json)
        .ok_or(AppError::NotFound)
}

#[derive(Debug, Serialize)]
pub struct SnomedImportStarted {
    pub release: SnomedRelease,
    /// This edition and date was already loaded; nothing was re-imported.
    pub already_imported: bool,
}

/// `POST /api/terminology/snomed/releases/upload` — the zip is the body.
pub async fn upload_release(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    body: Body,
) -> Result<(StatusCode, Json<SnomedImportStarted>), AppError> {
    require_permission(&claims, snomed::MANAGE)?;
    let file_name = headers
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| FsPath::new(v).file_name().and_then(|n| n.to_str()))
        .map(|v| v.chars().take(200).collect::<String>())
        .unwrap_or_else(|| "upload.zip".to_owned());
    let dir = std::env::temp_dir().join("medbrains-snomed");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| io_error(&e))?;
    let zip_path = dir.join(format!("upload-{}.zip", Uuid::new_v4()));
    if let Err(e) = save_body(
        body,
        &zip_path,
        env_bytes("SNOMED_UPLOAD_MAX_BYTES", DEFAULT_UPLOAD_MAX),
    )
    .await
    {
        let _ = tokio::fs::remove_file(&zip_path).await;
        return Err(e);
    }
    let started = start(
        &state,
        &claims,
        Start {
            zip_path: zip_path.clone(),
            source: "upload",
            file_name,
            remove_zip: true,
        },
    )
    .await;
    let keep = matches!(&started, Ok((code, _)) if *code == StatusCode::ACCEPTED);
    if !keep {
        let _ = tokio::fs::remove_file(&zip_path).await;
    }
    started
}

async fn save_body(body: Body, path: &FsPath, max: u64) -> Result<(), AppError> {
    let mut file = tokio::fs::File::create(path)
        .await
        .map_err(|e| io_error(&e))?;
    let mut stream = body.into_data_stream();
    let mut written: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| AppError::BadRequest(format!("upload interrupted: {e}")))?;
        written += chunk.len() as u64;
        if written > max {
            return Err(AppError::BadRequest(format!(
                "The package is larger than {} MB. Place it in the server's import directory instead.",
                max / (1024 * 1024)
            )));
        }
        file.write_all(&chunk).await.map_err(|e| io_error(&e))?;
    }
    file.flush().await.map_err(|e| io_error(&e))?;
    if written == 0 {
        return Err(AppError::BadRequest("The upload was empty".to_owned()));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct SnomedImportFile {
    pub file_name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct SnomedImportFiles {
    /// False when `SNOMED_IMPORT_DIR` is not set on the server.
    pub directory_configured: bool,
    pub files: Vec<SnomedImportFile>,
}

/// `GET /api/terminology/snomed/import-files` — zips waiting in the import
/// directory, by name only (the path is never disclosed).
pub async fn list_import_files(
    Extension(claims): Extension<Claims>,
) -> Result<Json<SnomedImportFiles>, AppError> {
    require_permission(&claims, snomed::MANAGE)?;
    let Some(dir) = import_dir() else {
        return Ok(Json(SnomedImportFiles {
            directory_configured: false,
            files: Vec::new(),
        }));
    };
    let mut entries = tokio::fs::read_dir(&dir).await.map_err(|e| io_error(&e))?;
    let mut files = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(|e| io_error(&e))? {
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        let meta = entry.metadata().await.map_err(|e| io_error(&e))?;
        if meta.is_file() && name.to_ascii_lowercase().ends_with(".zip") {
            files.push(SnomedImportFile {
                file_name: name,
                size_bytes: meta.len(),
            });
            if files.len() >= MAX_LISTED_FILES {
                break;
            }
        }
    }
    files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(Json(SnomedImportFiles {
        directory_configured: true,
        files,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SnomedImportPathRequest {
    pub file_name: String,
}

/// `POST /api/terminology/snomed/releases/import-path` — import a zip from
/// the import directory, named by file name only.
pub async fn import_from_path(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SnomedImportPathRequest>,
) -> Result<(StatusCode, Json<SnomedImportStarted>), AppError> {
    require_permission(&claims, snomed::MANAGE)?;
    let dir = import_dir().ok_or_else(|| {
        AppError::BadRequest("No import directory is configured (SNOMED_IMPORT_DIR)".to_owned())
    })?;
    let path = resolve_in_dir(&dir, &body.file_name).await?;
    start(
        &state,
        &claims,
        Start {
            zip_path: path,
            source: "server_path",
            file_name: body.file_name,
            remove_zip: false,
        },
    )
    .await
}

/// The named file, only if it is a `.zip` directly inside `dir` — no
/// separators, no `..`, and no symlink pointing out of the directory.
async fn resolve_in_dir(dir: &FsPath, name: &str) -> Result<PathBuf, AppError> {
    let plain = !name.is_empty()
        && !name.starts_with('.')
        && !name.contains(['/', '\\'])
        && name.to_ascii_lowercase().ends_with(".zip");
    if !plain {
        return Err(AppError::BadRequest(
            "Name a .zip file in the import directory".to_owned(),
        ));
    }
    let root = tokio::fs::canonicalize(dir)
        .await
        .map_err(|e| io_error(&e))?;
    let path = tokio::fs::canonicalize(root.join(name))
        .await
        .map_err(|_| AppError::NotFound)?;
    if path.parent() != Some(root.as_path()) {
        return Err(AppError::BadRequest(
            "Name a .zip file in the import directory".to_owned(),
        ));
    }
    Ok(path)
}

#[derive(Debug)]
struct Start {
    zip_path: PathBuf,
    source: &'static str,
    file_name: String,
    remove_zip: bool,
}

/// Check the package, claim the release (idempotent), queue the import.
async fn start(
    state: &AppState,
    claims: &Claims,
    s: Start,
) -> Result<(StatusCode, Json<SnomedImportStarted>), AppError> {
    let zip = s.zip_path.clone();
    let layout: PackageLayout = tokio::task::spawn_blocking(move || package::inspect(&zip))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .map_err(|e| AppError::BadRequest(format!("This is not an RF2 release package: {e}")))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let name: Option<String> = sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await?;
    tx.commit().await?;

    let claim = release::claim(
        &state.db,
        &ClaimInput {
            identity: &layout.identity,
            source: s.source,
            file_name: &s.file_name,
            skipped: &layout.skipped,
            imported_by: claims.sub,
            imported_by_name: name.as_deref().unwrap_or("Unknown user"),
        },
    )
    .await?;
    match claim {
        Claim::AlreadyImported(release) => Ok((
            StatusCode::OK,
            Json(SnomedImportStarted {
                release,
                already_imported: true,
            }),
        )),
        Claim::Busy => Err(AppError::Conflict(
            "Another SNOMED CT import is running. Wait for it to finish.".to_owned(),
        )),
        Claim::Queued(release) => {
            let job = ImportJob {
                release_id: release.id,
                zip_path: s.zip_path,
                layout,
                remove_zip: s.remove_zip,
                max_unpacked_bytes: env_bytes("SNOMED_MAX_UNPACKED_BYTES", DEFAULT_UNPACKED_MAX),
            };
            let pool = state.db.clone();
            tokio::spawn(async move { job::run(&pool, &job).await });
            Ok((
                StatusCode::ACCEPTED,
                Json(SnomedImportStarted {
                    release,
                    already_imported: false,
                }),
            ))
        }
    }
}

fn io_error(e: &std::io::Error) -> AppError {
    tracing::warn!(error = %e, "SNOMED CT release file error");
    AppError::Internal("Could not read or write the release file".to_owned())
}

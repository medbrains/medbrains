//! Presigned URL endpoints for direct client-to-S3 uploads.
//!
//! Flow:
//!   1. Client calls POST /api/upload/presign to get a presigned PUT URL + key.
//!   2. Client uploads the file directly to S3 using the PUT URL.
//!   3. Client calls the relevant domain API (e.g. POST /api/patients/{id}/documents)
//!      passing the returned `key` as `file_url`.
//!
//! GET /api/upload/download-url?key= returns a presigned GET URL for reading
//! back any object the caller has permission to access.

use axum::routing::{get,post};
use std::time::Duration;

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

// ── Allowed upload categories ─────────────────────────────────────────────

const ALLOWED_CATEGORIES: &[&str] = &[
    "mlc_case_sheet",
    "mrd_document",
    "consent_form",
    "discharge_summary",
    "lab_report",
    "radiology_image",
    "patient_photo",
    "insurance_document",
    "prescription",
    "referral_letter",
    "operation_note",
    "nursing_assessment",
    "general",
];

// ── Request / Response types ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PresignUploadRequest {
    /// Document category — controls the S3 key prefix.
    pub category: String,
    /// Original filename — sanitized before use.
    pub filename: String,
    /// MIME type forwarded to the presigned PUT header (optional).
    pub mime_type: Option<String>,
    /// How many seconds the upload URL should remain valid (max 3600, default 900).
    pub expires_in: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct PresignUploadResponse {
    /// S3 object key — pass this as `file_url` when registering the document.
    pub key: String,
    /// Presigned PUT URL — upload the file bytes directly to this URL.
    pub upload_url: String,
    /// When this upload URL expires.
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct PresignDownloadQuery {
    /// S3 object key returned by the upload endpoint.
    pub key: String,
    /// How many seconds the download URL should remain valid (max 3600, default 3600).
    pub expires_in: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct PresignDownloadResponse {
    pub download_url: String,
    pub expires_at: DateTime<Utc>,
}

// ── Handlers ─────────────────────────────────────────────────────────────

/// POST /api/upload/presign
///
/// Returns a presigned S3 PUT URL. The caller uploads the file directly,
/// then registers the returned `key` in the domain table.
pub async fn presign_upload(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PresignUploadRequest>,
) -> Result<Json<PresignUploadResponse>, AppError> {
    require_upload_permission(&claims, &body.category)?;

    if !ALLOWED_CATEGORIES.contains(&body.category.as_str()) {
        return Err(AppError::BadRequest(format!(
            "unknown upload category '{}'. Allowed: {}",
            body.category,
            ALLOWED_CATEGORIES.join(", ")
        )));
    }

    if body.filename.trim().is_empty() {
        return Err(AppError::BadRequest("filename is required".to_owned()));
    }

    let s3 = state.s3.as_ref().ok_or_else(|| {
        AppError::BadRequest("S3 storage is not configured on this server".to_owned())
    })?;

    let expires_secs = body.expires_in.unwrap_or(900).clamp(60, 3600);
    let expires = Duration::from_secs(expires_secs);

    let key = medbrains_server_core::s3_presign::S3PresignClient::make_key(
        claims.tenant_id,
        &body.category,
        &body.filename,
    );

    let upload_url = s3
        .presign_upload(&key, body.mime_type.as_deref(), expires)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "S3 presign upload failed");
            AppError::Internal(e.to_string())
        })?;

    let expires_at = Utc::now() + chrono::Duration::seconds(expires_secs as i64);

    Ok(Json(PresignUploadResponse {
        key,
        upload_url,
        expires_at,
    }))
}

/// GET /api/upload/download-url?key=&expires_in=
///
/// Returns a presigned S3 GET URL for reading a stored object.
pub async fn presign_download(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PresignDownloadQuery>,
) -> Result<Json<PresignDownloadResponse>, AppError> {
    // Require at minimum patients::VIEW to fetch any document.
    if claims.role != "super_admin"
        && claims.role != "hospital_admin"
        && !claims.permissions.iter().any(|p| {
            p == permissions::patients::VIEW
                || p == permissions::documents::audit::LIST
                || p == permissions::documents::GENERATE
        })
    {
        return Err(AppError::Forbidden);
    }

    if params.key.trim().is_empty() {
        return Err(AppError::BadRequest("key is required".to_owned()));
    }

    // Scope-check: key must be prefixed with the caller's tenant_id
    let tenant_prefix = format!("{}/", claims.tenant_id);
    if !params.key.starts_with(&tenant_prefix) {
        return Err(AppError::Forbidden);
    }

    let s3 = state.s3.as_ref().ok_or_else(|| {
        AppError::BadRequest("S3 storage is not configured on this server".to_owned())
    })?;

    let expires_secs = params.expires_in.unwrap_or(3600).clamp(60, 3600);
    let expires = Duration::from_secs(expires_secs);

    let download_url = s3
        .presign_download(&params.key, expires)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "S3 presign download failed");
            AppError::Internal(e.to_string())
        })?;

    let expires_at = Utc::now() + chrono::Duration::seconds(expires_secs as i64);

    Ok(Json(PresignDownloadResponse {
        download_url,
        expires_at,
    }))
}

// ── Permission helper ─────────────────────────────────────────────────────

fn require_upload_permission(claims: &Claims, category: &str) -> Result<(), AppError> {
    if claims.role == "super_admin" || claims.role == "hospital_admin" {
        return Ok(());
    }
    let required = upload_permission_for_category(category);
    if claims.permissions.iter().any(|p| p == required) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

fn upload_permission_for_category(category: &str) -> &'static str {
    match category {
        "mlc_case_sheet" => permissions::emergency::mlc::CREATE,
        "mrd_document" => permissions::mrd::records::MANAGE,
        "radiology_image" => permissions::radiology::reports::CREATE,
        "lab_report" => permissions::lab::results::CREATE,
        "consent_form" | "discharge_summary" | "operation_note" | "nursing_assessment" => {
            permissions::documents::GENERATE
        }
        "insurance_document" => permissions::insurance::verification::CREATE,
        "prescription" | "referral_letter" => permissions::opd::visit::UPDATE,
        _ => permissions::patients::UPDATE,
    }
}

/// upload routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/upload/presign", post(presign_upload))
        .route("/api/upload/download-url", get(presign_download))
}

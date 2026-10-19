//! Supplier-bill scans (#4861): upload → `parsing` → the on-prem reader
//! claims it under a lease and posts a draft → `parsed` → a person reviews
//! (`grn_scan_review`) → commit. The worker side lives here; its payload is
//! documented in `grn_scan_contract`.

use std::time::Duration;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::grn_match;
use crate::grn_scan_contract::{ParseResult, to_draft};

/// How long a worker holds a claimed bill before another may take it.
pub const LEASE_MINUTES: i32 = 10;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PurchaseBillScan {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub vendor_id: Option<Uuid>,
    pub po_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub file_key: String,
    pub file_sha256: String,
    pub mime_type: Option<String>,
    pub status: String,
    pub claimed_by: Option<Uuid>,
    pub claimed_until: Option<DateTime<Utc>>,
    pub worker: Option<String>,
    pub extracted_json: Option<serde_json::Value>,
    pub overall_confidence: Option<Decimal>,
    pub parse_error: Option<String>,
    pub einvoice: Option<serde_json::Value>,
    pub irn: Option<String>,
    pub draft_json: Option<serde_json::Value>,
    pub grn_id: Option<Uuid>,
    pub fields_total: Option<i32>,
    pub fields_corrected: Option<i32>,
    pub lines_total: Option<i32>,
    pub lines_auto_matched: Option<i32>,
    pub lines_rematched: Option<i32>,
    pub uploaded_by: Uuid,
    pub committed_by: Option<Uuid>,
    pub committed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A presigned GET for the bill image. `None` when this server has no
/// object store configured — the screen says so instead of waiting.
pub async fn image_url(state: &AppState, key: &str) -> Result<Option<String>, AppError> {
    let Some(s3) = state.s3.as_ref() else {
        return Ok(None);
    };
    let url = s3
        .presign_download(key, Duration::from_secs(900))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Some(url))
}

pub async fn load_scan(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<PurchaseBillScan, AppError> {
    sqlx::query_as::<_, PurchaseBillScan>(
        "SELECT * FROM purchase_bill_scans WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct CreateScanRequest {
    pub file_key: String,
    pub file_sha256: String,
    pub mime_type: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub po_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
}

/// `POST /api/procurement/grn-scans` — register an uploaded bill and queue
/// it for the reader. The same file twice is refused, naming the first.
pub async fn create_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScanRequest>,
) -> Result<Json<PurchaseBillScan>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    let sha = body.file_sha256.trim().to_lowercase();
    if sha.len() != 64 || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::BadRequest(
            "file_sha256 must be 64 hex characters".into(),
        ));
    }
    if !body.file_key.starts_with(&format!("{}/", claims.tenant_id)) {
        return Err(AppError::Forbidden);
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let earlier: Option<(DateTime<Utc>, Option<String>)> = sqlx::query_as(
        "SELECT s.created_at, g.grn_number FROM purchase_bill_scans s \
           LEFT JOIN goods_receipt_notes g ON g.id = s.grn_id \
          WHERE s.tenant_id = $1 AND s.file_sha256 = $2 AND s.deleted_at IS NULL \
            AND s.status <> 'discarded' LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(&sha)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some((at, grn)) = earlier {
        let tail = grn.map_or_else(String::new, |g| format!(", posted as GRN {g}"));
        return Err(AppError::Conflict(format!(
            "This file was already uploaded on {}{tail}.",
            at.format("%d %b %Y")
        )));
    }
    let scan = sqlx::query_as::<_, PurchaseBillScan>(
        "INSERT INTO purchase_bill_scans (tenant_id, vendor_id, po_id, store_location_id, \
             file_key, file_sha256, mime_type, status, uploaded_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,'parsing',$8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.vendor_id)
    .bind(body.po_id)
    .bind(body.store_location_id)
    .bind(body.file_key.trim())
    .bind(&sha)
    .bind(&body.mime_type)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scan))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ScanListItem {
    pub id: Uuid,
    pub status: String,
    pub vendor_id: Option<Uuid>,
    pub vendor_name: Option<String>,
    pub invoice_number: Option<String>,
    pub overall_confidence: Option<Decimal>,
    pub grn_id: Option<Uuid>,
    pub grn_number: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListScansQuery {
    pub status: Option<String>,
}

/// `GET /api/procurement/grn-scans?status=` — the review queue.
pub async fn list_scans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListScansQuery>,
) -> Result<Json<Vec<ScanListItem>>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ScanListItem>(
        "SELECT s.id, s.status, s.vendor_id, v.name AS vendor_name, \
                s.draft_json #>> '{header,invoice_number}' AS invoice_number, \
                s.overall_confidence, s.grn_id, g.grn_number, s.created_at \
           FROM purchase_bill_scans s \
           LEFT JOIN vendors v ON v.id = s.vendor_id \
           LEFT JOIN goods_receipt_notes g ON g.id = s.grn_id \
          WHERE s.tenant_id = $1 AND s.deleted_at IS NULL \
            AND ($2::text IS NULL OR s.status = $2) \
          ORDER BY s.created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

async fn set_status(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    to: &str,
    from: &[&str],
) -> Result<Json<PurchaseBillScan>, AppError> {
    require_permission(claims, permissions::procurement::grn::SCAN)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current = load_scan(&mut tx, claims.tenant_id, id).await?;
    if !from.contains(&current.status.as_str()) {
        return Err(AppError::Conflict(format!(
            "This scan is {}.",
            current.status
        )));
    }
    let scan = sqlx::query_as::<_, PurchaseBillScan>(
        "UPDATE purchase_bill_scans SET status = $3, parse_error = NULL, claimed_by = NULL, \
                claimed_until = NULL \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(to)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scan))
}

/// `POST /api/procurement/grn-scans/{id}/submit` — send a failed scan back
/// to the reader.
pub async fn submit_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PurchaseBillScan>, AppError> {
    set_status(&state, &claims, id, "parsing", &["failed", "uploaded"]).await
}

/// `POST /api/procurement/grn-scans/{id}/discard` — drop a scan (a wrong
/// upload). Its file may then be uploaded again.
pub async fn discard_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PurchaseBillScan>, AppError> {
    set_status(
        &state,
        &claims,
        id,
        "discarded",
        &["uploaded", "parsing", "parsed", "reviewing", "failed"],
    )
    .await
}

#[derive(Debug, Serialize)]
pub struct ClaimResponse {
    pub scan: PurchaseBillScan,
    pub image_url: Option<String>,
    pub lease_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ClaimRequest {
    /// Claim this bill rather than the oldest queued one (a reader that is
    /// handed a job). Still only while it is queued and unleased.
    pub scan_id: Option<Uuid>,
}

/// `POST /api/procurement/grn-scans/claim` — the reader takes the oldest
/// queued bill (or the one named) under a lease. `null` when there is
/// nothing to read.
pub async fn claim_scan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ClaimRequest>,
) -> Result<Json<Option<ClaimResponse>>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN_WORKER)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let scan = sqlx::query_as::<_, PurchaseBillScan>(
        "UPDATE purchase_bill_scans SET claimed_by = $2, \
                claimed_until = now() + make_interval(mins => $3) \
          WHERE id = (SELECT id FROM purchase_bill_scans \
                       WHERE tenant_id = $1 AND status = 'parsing' AND deleted_at IS NULL \
                         AND ($4::uuid IS NULL OR id = $4) \
                         AND (claimed_until IS NULL OR claimed_until < now()) \
                       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) \
          RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(LEASE_MINUTES)
    .bind(body.scan_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    let Some(scan) = scan else {
        return Ok(Json(None));
    };
    let image_url = image_url(&state, &scan.file_key).await?;
    let lease_until = scan.claimed_until;
    Ok(Json(Some(ClaimResponse {
        scan,
        image_url,
        lease_until,
    })))
}

async fn vendor_by_gstin(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    gstin: Option<&str>,
) -> Result<Option<Uuid>, AppError> {
    let Some(gstin) = gstin else { return Ok(None) };
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM vendors WHERE tenant_id = $1 AND upper(gst_number) = upper($2) \
           AND deleted_at IS NULL LIMIT 2",
    )
    .bind(tenant_id)
    .bind(gstin)
    .fetch_all(&mut **tx)
    .await?;
    // Two vendors on one GSTIN is a vendor-master problem; do not guess.
    Ok(if ids.len() == 1 {
        ids.first().copied()
    } else {
        None
    })
}

/// `POST /api/procurement/grn-scans/{id}/parse-result` — the reader posts
/// what it read, while it holds the lease. The extraction is kept as sent
/// and never edited; the draft built from it is what the reviewer corrects.
pub async fn parse_result(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(raw): Json<serde_json::Value>,
) -> Result<Json<PurchaseBillScan>, AppError> {
    require_permission(&claims, permissions::procurement::grn::SCAN_WORKER)?;
    let parsed: ParseResult = serde_json::from_value(raw.clone())
        .map_err(|e| AppError::BadRequest(format!("parse-result payload: {e}")))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let held: Option<PurchaseBillScan> = sqlx::query_as(
        "SELECT * FROM purchase_bill_scans WHERE id = $1 AND tenant_id = $2 \
           AND status = 'parsing' AND claimed_by = $3 AND claimed_until > now() FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(scan) = held else {
        load_scan(&mut tx, claims.tenant_id, id).await?;
        return Err(AppError::Conflict(
            "This scan is not leased to you: claim it first, or it was already read.".into(),
        ));
    };
    let mut draft = to_draft(&parsed);
    draft.header.po_id = scan.po_id;
    draft.header.store_location_id = scan.store_location_id;
    draft.header.vendor_id = match scan.vendor_id {
        Some(v) => Some(v),
        None => {
            vendor_by_gstin(
                &mut tx,
                claims.tenant_id,
                draft.header.supplier_gstin.as_deref(),
            )
            .await?
        }
    };
    if let Some(vendor) = draft.header.vendor_id {
        let known = grn_match::aliases_for(&mut tx, claims.tenant_id, vendor, &draft.lines).await?;
        for (i, item) in known {
            if let Some(line) = draft.lines.get_mut(i) {
                line.catalog_item_id = Some(item);
                line.suggested_item_id = Some(item);
            }
        }
    }
    let status = if parsed.error.is_some() {
        "failed"
    } else {
        "parsed"
    };
    let confidence = parsed
        .overall_confidence
        .map(|c| c.clamp(0.0, 1.0))
        .and_then(Decimal::from_f64_retain)
        .map(|d| d.round_dp(4));
    let scan = sqlx::query_as::<_, PurchaseBillScan>(
        "UPDATE purchase_bill_scans SET status = $3, extracted_json = $4, overall_confidence = $5, \
                parse_error = $6, worker = $7, einvoice = $8, irn = $9, draft_json = $10, \
                vendor_id = COALESCE(vendor_id, $11), claimed_until = NULL \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(status)
    .bind(&raw)
    .bind(confidence)
    .bind(&parsed.error)
    .bind(&parsed.worker)
    .bind(
        parsed
            .einvoice_qr
            .as_ref()
            .map(serde_json::to_value)
            .transpose()
            .map_err(|e| AppError::Internal(e.to_string()))?,
    )
    .bind(&draft.header.irn)
    .bind(serde_json::to_value(&draft).map_err(|e| AppError::Internal(e.to_string()))?)
    .bind(draft.header.vendor_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scan))
}

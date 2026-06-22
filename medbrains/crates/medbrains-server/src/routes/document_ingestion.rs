//! Reverse print / document ingestion. Scanned paper is uploaded, barcode-
//! linked to its MRD record, and filed — attaching it to the patient's record.
//! Bulk via batches. Gated by `mrd.records.*`.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IngestionBatch {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub label: String,
    pub status: String,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IngestionItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub batch_id: Uuid,
    pub file_url: String,
    pub original_filename: String,
    pub mime_type: Option<String>,
    pub barcode: Option<String>,
    pub linked_medical_record_id: Option<Uuid>,
    pub linked_packet_id: Option<Uuid>,
    pub extracted_text: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBatchRequest {
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct AddItemRequest {
    pub file_url: String,
    pub original_filename: String,
    pub mime_type: Option<String>,
    pub barcode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LinkItemRequest {
    /// Record number scanned/typed from the document barcode.
    pub barcode: String,
}

/// `GET /api/document-ingestion/batches`
pub async fn list_batches(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<IngestionBatch>>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, IngestionBatch>(
        "SELECT * FROM document_ingestion_batches WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/document-ingestion/batches`
pub async fn create_batch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBatchRequest>,
) -> Result<Json<IngestionBatch>, AppError> {
    require_permission(&claims, permissions::mrd::records::CREATE)?;
    if body.label.trim().is_empty() {
        return Err(AppError::BadRequest("A batch label is required.".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, IngestionBatch>(
        "INSERT INTO document_ingestion_batches (tenant_id, label, created_by) \
         VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.label.trim())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/document-ingestion/batches/{batch_id}/items`
pub async fn list_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(batch_id): Path<Uuid>,
) -> Result<Json<Vec<IngestionItem>>, AppError> {
    require_permission(&claims, permissions::mrd::records::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, IngestionItem>(
        "SELECT * FROM document_ingestion_items \
         WHERE batch_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 500",
    )
    .bind(batch_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/document-ingestion/batches/{batch_id}/items` — register an
/// uploaded scan (file already pushed to storage via the presign upload).
pub async fn add_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(batch_id): Path<Uuid>,
    Json(body): Json<AddItemRequest>,
) -> Result<Json<IngestionItem>, AppError> {
    require_permission(&claims, permissions::mrd::records::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, IngestionItem>(
        "INSERT INTO document_ingestion_items \
           (tenant_id, batch_id, file_url, original_filename, mime_type, barcode, uploaded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(batch_id)
    .bind(body.file_url.trim())
    .bind(body.original_filename.trim())
    .bind(&body.mime_type)
    .bind(&body.barcode)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/document-ingestion/items/{item_id}/link` — resolve the barcode to
/// an MRD record number and link the scan to that record.
pub async fn link_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<Uuid>,
    Json(body): Json<LinkItemRequest>,
) -> Result<Json<IngestionItem>, AppError> {
    require_permission(&claims, permissions::mrd::records::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let record_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM mrd_medical_records \
         WHERE tenant_id = $1 AND record_number = $2 LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.barcode.trim())
    .fetch_optional(&mut *tx)
    .await?;
    let record_id = record_id.ok_or_else(|| {
        AppError::BadRequest(format!("No MRD record found for '{}'.", body.barcode.trim()))
    })?;

    let row = sqlx::query_as::<_, IngestionItem>(
        "UPDATE document_ingestion_items SET \
           barcode = $3, linked_medical_record_id = $4, status = 'linked', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(item_id)
    .bind(claims.tenant_id)
    .bind(body.barcode.trim())
    .bind(record_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/document-ingestion/items/{item_id}/file` — file a linked scan: it
/// is attached to the linked record's patient as a scanned document.
pub async fn file_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<Uuid>,
) -> Result<Json<IngestionItem>, AppError> {
    require_permission(&claims, permissions::mrd::records::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let item = sqlx::query_as::<_, IngestionItem>(
        "SELECT * FROM document_ingestion_items WHERE id = $1 AND tenant_id = $2",
    )
    .bind(item_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let record_id = item.linked_medical_record_id.ok_or_else(|| {
        AppError::BadRequest("Link the scan to an MRD record before filing.".to_owned())
    })?;

    // Attach the scan to the linked record's patient as a scanned document.
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM mrd_medical_records WHERE id = $1 AND tenant_id = $2",
    )
    .bind(record_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO patient_documents \
           (tenant_id, patient_id, document_type, document_name, file_url, mime_type, uploaded_by, notes) \
         VALUES ($1, $2, 'scanned_mrd', $3, $4, $5, $6, 'Filed from MRD reverse-print ingestion')",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(&item.original_filename)
    .bind(&item.file_url)
    .bind(&item.mime_type)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, IngestionItem>(
        "UPDATE document_ingestion_items SET status = 'filed', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(item_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

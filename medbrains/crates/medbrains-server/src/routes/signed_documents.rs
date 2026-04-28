//! Signature embedding helper for print routes.
//!
//! Print templates render signed records (prescriptions, discharge summaries,
//! certificates, lab/radiology reports) as PDFs. Each PDF needs the visual
//! signature stamped at the bottom: image + display_block + verify ref.
//!
//! `fetch_signature_for_print(tx, tenant, record_type, record_id)` returns
//! the latest primary signature for a record, ready to inject into the
//! print payload. If unsigned → returns None and the print template
//! renders a "DRAFT — UNSIGNED" watermark instead.
//!
//! Per RFCs/sprints/SPRINT-doctor-activities.md §2.4 + user requirement
//! "signatures in documents".

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Serialize, Clone)]
pub struct SignatureForPrint {
    pub signed_at: DateTime<Utc>,
    pub signer_user_id: Uuid,
    pub signer_name: Option<String>,
    /// URL of scanned signature image, stamped onto PDF at signature box.
    pub display_image_url: Option<String>,
    /// Text rendered below image: "Digitally signed by Dr. X on …"
    pub display_block: Option<String>,
    /// Hex-encoded signature_id for verification footer.
    pub verify_ref: String,
    /// Legal weight class — drives watermark styling on the PDF.
    pub legal_class: String,
}

#[derive(Debug, sqlx::FromRow)]
struct SigRow {
    id: Uuid,
    signed_at: DateTime<Utc>,
    signer_user_id: Uuid,
    display_image_snapshot: Option<String>,
    display_block: Option<String>,
    legal_class: String,
    signer_name: Option<String>,
}

/// Fetch the latest primary signature for a record. Returns None if
/// unsigned. Co-signer / attestor signatures are surfaced via
/// `fetch_all_signatures_for_print` for multi-signer documents.
pub async fn fetch_signature_for_print(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    record_type: &str,
    record_id: Uuid,
) -> Result<Option<SignatureForPrint>, AppError> {
    let row = sqlx::query_as::<_, SigRow>(
        "SELECT sr.id, sr.signed_at, sr.signer_user_id, \
                sr.display_image_snapshot, sr.display_block, sr.legal_class, \
                COALESCE(dp.display_name, u.full_name) AS signer_name \
         FROM signed_records sr \
         LEFT JOIN doctor_profiles dp \
            ON dp.user_id = sr.signer_user_id \
           AND dp.tenant_id = sr.tenant_id \
         LEFT JOIN users u ON u.id = sr.signer_user_id \
         WHERE sr.tenant_id = $1 \
           AND sr.record_type = $2 \
           AND sr.record_id = $3 \
           AND sr.signer_role = 'primary' \
         ORDER BY sr.signed_at DESC \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(record_type)
    .bind(record_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(row.map(|r| SignatureForPrint {
        signed_at: r.signed_at,
        signer_user_id: r.signer_user_id,
        signer_name: r.signer_name,
        display_image_url: r.display_image_snapshot,
        display_block: r.display_block,
        verify_ref: r.id.to_string(),
        legal_class: r.legal_class,
    }))
}

/// Fetch all signatures for a record (primary + co-signers + attestors)
/// in chronological order. Used when multiple signatures stamp the PDF
/// (e.g., operative notes signed by surgeon + anesthetist).
pub async fn fetch_all_signatures_for_print(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    record_type: &str,
    record_id: Uuid,
) -> Result<Vec<SignatureForPrint>, AppError> {
    let rows = sqlx::query_as::<_, SigRow>(
        "SELECT sr.id, sr.signed_at, sr.signer_user_id, \
                sr.display_image_snapshot, sr.display_block, sr.legal_class, \
                COALESCE(dp.display_name, u.full_name) AS signer_name \
         FROM signed_records sr \
         LEFT JOIN doctor_profiles dp \
            ON dp.user_id = sr.signer_user_id \
           AND dp.tenant_id = sr.tenant_id \
         LEFT JOIN users u ON u.id = sr.signer_user_id \
         WHERE sr.tenant_id = $1 \
           AND sr.record_type = $2 \
           AND sr.record_id = $3 \
         ORDER BY sr.signed_at",
    )
    .bind(tenant_id)
    .bind(record_type)
    .bind(record_id)
    .fetch_all(&mut **tx)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| SignatureForPrint {
            signed_at: r.signed_at,
            signer_user_id: r.signer_user_id,
            signer_name: r.signer_name,
            display_image_url: r.display_image_snapshot,
            display_block: r.display_block,
            verify_ref: r.id.to_string(),
            legal_class: r.legal_class,
        })
        .collect())
}

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

use medbrains_server_core::error::AppError;

/// Convenience: convert `Vec<SignatureForPrint>` (server-side shape with
/// strongly-typed timestamps and Uuid refs) into the
/// serialization-friendly `Vec<PrintSignatureData>` used by the print
/// data structs. Saves identical 9-line `.map(|s| ...)` blocks across
/// every print route.
#[must_use]
pub fn to_print_signatures(
    sigs: Vec<SignatureForPrint>,
) -> Vec<medbrains_core::print_data::PrintSignatureData> {
    sigs.into_iter()
        .map(|s| medbrains_core::print_data::PrintSignatureData {
            signed_at: s.signed_at.to_rfc3339(),
            signer_name: s.signer_name,
            display_image_url: s.display_image_url,
            display_block: s.display_block,
            verify_ref: s.verify_ref,
            verify_url: s.verify_url,
            legal_class: s.legal_class,
        })
        .collect()
}

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
    /// The public check page the print's QR opens, when the record has a
    /// live link and the deployment knows its public address.
    pub verify_url: Option<String>,
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
    verify_token: Option<String>,
}

/// The public check page for a verify token, at `MEDBRAINS_PUBLIC_BASE_URL`
/// (the same base the bill QR uses). `None` without a base: a QR pointing at
/// an address nobody outside can reach is worse than none.
#[must_use]
pub fn verify_url(token: Option<&str>) -> Option<String> {
    let base = std::env::var("MEDBRAINS_PUBLIC_BASE_URL").ok()?;
    token.map(|t| format!("{}/verify/signature/{t}", base.trim_end_matches('/')))
}

/// A row as the print needs it.
fn to_print(r: SigRow) -> SignatureForPrint {
    SignatureForPrint {
        signed_at: r.signed_at,
        signer_user_id: r.signer_user_id,
        signer_name: r.signer_name,
        display_image_url: r.display_image_snapshot,
        display_block: r.display_block,
        verify_ref: r.id.to_string(),
        verify_url: verify_url(r.verify_token.as_deref()),
        legal_class: r.legal_class,
    }
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
    let row = sqlx::query_as!(
        SigRow,
        "SELECT sr.id, sr.signed_at, sr.signer_user_id, \
                sr.display_image_snapshot, sr.display_block, sr.legal_class, \
                COALESCE(dp.display_name, u.full_name) AS signer_name, \
                vl.token AS \"verify_token?\" \
         FROM signed_records sr \
         LEFT JOIN doctor_profiles dp \
            ON dp.user_id = sr.signer_user_id \
           AND dp.tenant_id = sr.tenant_id \
         LEFT JOIN users u ON u.id = sr.signer_user_id \
         LEFT JOIN signature_verify_links vl \
            ON vl.signed_record_id = sr.id AND vl.tenant_id = sr.tenant_id \
           AND vl.revoked_at IS NULL AND vl.deleted_at IS NULL \
         WHERE sr.tenant_id = $1 \
           AND sr.record_type = $2 \
           AND sr.record_id = $3 \
           AND sr.signer_role = 'primary' \
           AND sr.deleted_at IS NULL \
         ORDER BY sr.signed_at DESC \
         LIMIT 1",
        tenant_id,
        record_type,
        record_id,
    )
    .fetch_optional(&mut **tx)
    .await?;

    Ok(row.map(to_print))
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
    fetch_signatures_for_records(tx, tenant_id, record_type, &[record_id]).await
}

/// Every signature on any of `record_ids`, in one query, oldest first: a
/// visit's several prescriptions, an order's several results.
pub async fn fetch_signatures_for_records(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    record_type: &str,
    record_ids: &[Uuid],
) -> Result<Vec<SignatureForPrint>, AppError> {
    let rows = sqlx::query_as!(
        SigRow,
        "SELECT sr.id, sr.signed_at, sr.signer_user_id, \
                sr.display_image_snapshot, sr.display_block, sr.legal_class, \
                COALESCE(dp.display_name, u.full_name) AS signer_name, \
                vl.token AS \"verify_token?\" \
         FROM signed_records sr \
         LEFT JOIN doctor_profiles dp \
            ON dp.user_id = sr.signer_user_id \
           AND dp.tenant_id = sr.tenant_id \
         LEFT JOIN users u ON u.id = sr.signer_user_id \
         LEFT JOIN signature_verify_links vl \
            ON vl.signed_record_id = sr.id AND vl.tenant_id = sr.tenant_id \
           AND vl.revoked_at IS NULL AND vl.deleted_at IS NULL \
         WHERE sr.tenant_id = $1 \
           AND sr.record_type = $2 \
           AND sr.record_id = ANY($3) \
           AND sr.deleted_at IS NULL \
         ORDER BY sr.signed_at LIMIT 5000",
        tenant_id,
        record_type,
        record_ids,
    )
    .fetch_all(&mut **tx)
    .await?;

    Ok(rows.into_iter().map(to_print).collect())
}

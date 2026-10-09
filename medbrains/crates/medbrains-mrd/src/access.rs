//! Who may open which medical record.
//!
//! Medical records staff file, issue and complete every chart, not only
//! those of patients in their care, so `mrd.records.view_all` opens any
//! patient's record — and every record opened that way is written to the
//! patient's access log, so the reach is answerable. Everyone else opens
//! only the records of patients they have access to.

use medbrains_authz_gate::{ParentLink, links};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::is_bypass_role;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

/// What the access log says the record was opened for.
const CUSTODIAN_ACCESS: &str = "mrd_custodian";

/// Holds the medical-records reach over every patient.
pub(crate) fn is_custodian(claims: &Claims) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::mrd::records::VIEW_ALL)
}

/// The patients a list may show: every one for medical records staff (or
/// the one asked for), otherwise those the caller has access to.
pub(crate) async fn list_filter(
    state: &AppState,
    claims: &Claims,
    requested: Option<Uuid>,
) -> Result<Option<Vec<Uuid>>, AppError> {
    if is_custodian(claims) {
        return Ok(requested.map(|id| vec![id]));
    }
    medbrains_authz_gate::patient_filter(state, claims, requested).await
}

/// Open one record held under `link`: medical records staff may, and it is
/// logged against the patient; anyone else needs access to that patient.
pub(crate) async fn open(
    state: &AppState,
    claims: &Claims,
    link: ParentLink,
    id: Uuid,
    what: &str,
) -> Result<(), AppError> {
    if !is_custodian(claims) {
        return medbrains_authz_gate::require_access_via(state, claims, link, id).await;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sql = format!(
        "SELECT {} FROM {} WHERE id = $1 AND tenant_id = $2",
        link.column, link.table
    );
    let patient: Uuid = sqlx::query_scalar(&sql)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    sqlx::query(
        "INSERT INTO patient_record_access_log \
           (tenant_id, patient_id, accessed_by, access_type, notes) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(patient)
    .bind(claims.sub)
    .bind(CUSTODIAN_ACCESS)
    .bind(what)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Open a case-sheet packet.
pub(crate) async fn open_packet(
    state: &AppState,
    claims: &Claims,
    packet_id: Uuid,
    what: &str,
) -> Result<(), AppError> {
    open(state, claims, links::CASE_SHEET_PACKET, packet_id, what).await
}

/// Open a medical record's file.
pub(crate) async fn open_record(
    state: &AppState,
    claims: &Claims,
    record_id: Uuid,
    what: &str,
) -> Result<(), AppError> {
    open(state, claims, links::MRD_RECORD, record_id, what).await
}

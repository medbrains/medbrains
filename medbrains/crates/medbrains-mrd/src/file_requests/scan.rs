//! The runner's scans at the shelf and at the clinic.
//!
//! The file barcode (the record number on the folder) is
//! scanned at the shelf ("picked") and at the clinic ("delivered"); a scan of
//! any other file is refused, so the wrong patient's folder cannot be logged
//! as delivered. Each scan opens the next movement in `mrd_record_movements`:
//! the runner holds it, then the clinic does. A scan never takes a file out of
//! another clinic's hands: if anyone but this errand holds it, the scan is
//! refused with who has it, and the file is returned to MRD first.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Tx, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Deserialize;
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use super::{FileRequest, fetch};

/// Where a scan was made.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanStep {
    /// At the shelf: the runner has the file.
    Picked,
    /// At the clinic: the doctor has it.
    Delivered,
}

#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    pub barcode: String,
    pub step: ScanStep,
}

/// The request's state, locked for this scan.
#[derive(sqlx::FromRow)]
struct Locked {
    status: String,
    medical_record_id: Uuid,
    record_number: String,
    department_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    pick_movement_id: Option<Uuid>,
}

/// Whether a scanned barcode names this file: the record number, ignoring
/// case and surrounding space (scanners add a newline, people type lower case).
pub fn barcode_matches(scanned: &str, record_number: &str) -> bool {
    let scanned = scanned.trim();
    !scanned.is_empty() && scanned.eq_ignore_ascii_case(record_number.trim())
}

/// Which status a scan may follow: a file is picked from the shelf (or found
/// after all), and delivered only once picked.
pub fn scan_allowed(step: ScanStep, status: &str) -> bool {
    match step {
        ScanStep::Picked => matches!(status, "requested" | "not_found"),
        ScanStep::Delivered => status == "picked",
    }
}

/// `POST /api/mrd/file-requests/{id}/scan` — record a pick-up or delivery
/// scan. A barcode for another file answers 409 and changes nothing.
pub async fn scan_file_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ScanRequest>,
) -> Result<Json<FileRequest>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::FULFIL)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let locked = lock(&mut tx, claims.tenant_id, id).await?;
    crate::access::open_record(
        &state,
        &claims,
        locked.medical_record_id,
        "file request scan",
    )
    .await?;
    if !barcode_matches(&body.barcode, &locked.record_number) {
        return Err(AppError::Conflict(format!(
            "This barcode is not the requested file. Scan file {}.",
            locked.record_number
        )));
    }
    if !scan_allowed(body.step, &locked.status) {
        return Err(AppError::Conflict(format!(
            "This file is {} and cannot be marked {} now.",
            locked.status,
            match body.step {
                ScanStep::Picked => "picked up",
                ScanStep::Delivered => "delivered",
            }
        )));
    }
    let ours = match body.step {
        ScanStep::Picked => None,
        ScanStep::Delivered => locked.pick_movement_id,
    };
    require_free(&mut tx, claims.tenant_id, locked.medical_record_id, ours).await?;
    match body.step {
        ScanStep::Picked => {
            let movement = move_file(
                &mut tx,
                &claims,
                (locked.medical_record_id, ours),
                (Some(claims.sub), None),
                "OPD file request: picked up",
            )
            .await?;
            sqlx::query(
                "UPDATE mrd_file_requests SET status = 'picked', picked_at = now(), \
                        picked_by = $3, pick_movement_id = $4 \
                  WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(claims.sub)
            .bind(movement)
            .execute(&mut *tx)
            .await?;
        }
        ScanStep::Delivered => {
            let to = (locked.doctor_id, locked.department_id);
            move_file(
                &mut tx,
                &claims,
                (locked.medical_record_id, ours),
                to,
                "OPD file request: delivered",
            )
            .await?;
            sqlx::query(
                "UPDATE mrd_file_requests SET status = 'delivered', delivered_at = now(), \
                        delivered_by = $3 \
                  WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
        }
    }
    let action = match body.step {
        ScanStep::Picked => "mrd_file_picked",
        ScanStep::Delivered => "mrd_file_delivered",
    };
    record(&mut tx, &claims, id, action).await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/mrd/file-requests/{id}/not-found` — the file is not on its
/// shelf. The supervisor is told on the escalation pass's next run; a later
/// pick-up scan still closes it as found.
pub async fn mark_file_not_found(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FileRequest>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::FULFIL)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let locked = lock(&mut tx, claims.tenant_id, id).await?;
    crate::access::open_record(
        &state,
        &claims,
        locked.medical_record_id,
        "file request not found",
    )
    .await?;
    if locked.status != "requested" {
        return Err(AppError::Conflict(format!(
            "This file is {} and cannot be marked not found.",
            locked.status
        )));
    }
    sqlx::query(
        "UPDATE mrd_file_requests SET status = 'not_found', escalated_at = NULL \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    record(&mut tx, &claims, id, "mrd_file_not_found").await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/mrd/file-requests/{id}/return` — shelve a cancelled visit's file.
///
/// For a picked file whose visit was cancelled: the runner's movement is
/// closed and the request ends `cancelled` / `returned_to_shelf`. Any other
/// request answers 409: a file for a visit still on is delivered, not shelved.
pub async fn return_file_to_shelf(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FileRequest>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::FULFIL)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let locked = lock(&mut tx, claims.tenant_id, id).await?;
    crate::access::open_record(
        &state,
        &claims,
        locked.medical_record_id,
        "file request return",
    )
    .await?;
    let current = fetch(&mut tx, claims.tenant_id, id).await?;
    if locked.status != "picked" {
        return Err(AppError::Conflict(format!(
            "This file is {}; only a file a runner has picked up goes back to the shelf here.",
            locked.status
        )));
    }
    if !current.visit_cancelled {
        return Err(AppError::Conflict(
            "This file's visit is still on; take it to the clinic instead.".to_owned(),
        ));
    }
    sqlx::query(
        "UPDATE mrd_record_movements SET returned_at = now(), status = 'returned' \
          WHERE tenant_id = $1 AND id = $2 AND returned_at IS NULL AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(locked.pick_movement_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE mrd_file_requests SET status = 'cancelled', closed_reason = 'returned_to_shelf' \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    record(&mut tx, &claims, id, "mrd_file_returned_to_shelf").await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The request, locked for this change. Missing (or another tenant's) is 404.
async fn lock(conn: &mut PgConnection, tenant_id: Uuid, id: Uuid) -> Result<Locked, AppError> {
    sqlx::query_as::<_, Locked>(
        "SELECT f.status, f.medical_record_id, r.record_number, f.department_id, f.doctor_id, \
                f.pick_movement_id \
           FROM mrd_file_requests f \
           JOIN mrd_medical_records r ON r.id = f.medical_record_id AND r.tenant_id = f.tenant_id \
          WHERE f.id = $1 AND f.tenant_id = $2 AND f.deleted_at IS NULL \
          FOR UPDATE OF f",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// Refuse the scan if anyone but this errand (`ours`, the runner's own
/// pick-up movement) holds the file: a clinic's file is returned to MRD
/// first, never taken from it by a scan.
async fn require_free(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    record_id: Uuid,
    ours: Option<Uuid>,
) -> Result<(), AppError> {
    let holder: Option<Option<String>> = sqlx::query_scalar(
        "SELECT COALESCE(d.name, u.full_name) FROM mrd_record_movements m \
           LEFT JOIN departments d ON d.id = m.issued_to_department_id \
           LEFT JOIN users u ON u.id = m.issued_to_user_id \
          WHERE m.tenant_id = $1 AND m.medical_record_id = $2 \
            AND m.returned_at IS NULL AND m.deleted_at IS NULL \
            AND m.id IS DISTINCT FROM $3 \
          ORDER BY m.issued_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(record_id)
    .bind(ours)
    .fetch_optional(&mut *conn)
    .await?;
    holder.map_or(Ok(()), |who| {
        Err(AppError::Conflict(format!(
            "The file is with {}. Return it to MRD first.",
            who.as_deref().unwrap_or("someone else")
        )))
    })
}

/// Hand the file on: close this errand's own movement (`ours`, if any) and
/// open one to `(user, department)`, due back tomorrow. Returns the new
/// movement. The caller has checked [`require_free`].
async fn move_file(
    conn: &mut PgConnection,
    claims: &Claims,
    (record_id, ours): (Uuid, Option<Uuid>),
    (to_user, to_department): (Option<Uuid>, Option<Uuid>),
    purpose: &str,
) -> Result<Uuid, AppError> {
    sqlx::query(
        "UPDATE mrd_record_movements SET returned_at = now(), status = 'returned' \
          WHERE tenant_id = $1 AND medical_record_id = $2 AND id = $3 \
            AND returned_at IS NULL AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(record_id)
    .bind(ours)
    .execute(&mut *conn)
    .await?;
    let movement: Uuid = sqlx::query_scalar(
        "INSERT INTO mrd_record_movements \
           (tenant_id, medical_record_id, issued_to_user_id, issued_to_department_id, \
            due_date, purpose, created_by) \
         VALUES ($1, $2, $3, $4, CURRENT_DATE + 1, $5, $6) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(record_id)
    .bind(to_user)
    .bind(to_department)
    .bind(purpose)
    .bind(claims.sub)
    .fetch_one(&mut *conn)
    .await?;
    sqlx::query(
        "UPDATE mrd_medical_records SET last_accessed_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(record_id)
    .bind(claims.tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(movement)
}

/// A file-request action (a scan, a return, a request by hand) in the
/// tenant's audit chain.
pub(super) async fn record(
    tx: &mut Tx,
    claims: &Claims,
    id: Uuid,
    action: &str,
) -> Result<(), AppError> {
    let values = json!({ "action": action });
    let entry = medbrains_kernel::audit::AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action,
        entity_type: "mrd_file_requests",
        entity_id: Some(id),
        old_values: None,
        new_values: Some(&values),
        ip_address: None,
    };
    medbrains_kernel::audit(tx, &entry).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ScanStep, barcode_matches, scan_allowed};

    #[test]
    fn only_this_files_barcode_matches() {
        assert!(barcode_matches(" mrd-000123\n", "MRD-000123"));
        assert!(!barcode_matches("MRD-000124", "MRD-000123"));
        assert!(!barcode_matches("   ", "MRD-000123"));
    }

    #[test]
    fn a_file_is_delivered_only_after_it_is_picked() {
        assert!(scan_allowed(ScanStep::Picked, "requested"));
        assert!(scan_allowed(ScanStep::Picked, "not_found"));
        assert!(!scan_allowed(ScanStep::Delivered, "requested"));
        assert!(scan_allowed(ScanStep::Delivered, "picked"));
        assert!(!scan_allowed(ScanStep::Picked, "delivered"));
        assert!(!scan_allowed(ScanStep::Picked, "cancelled"));
    }
}

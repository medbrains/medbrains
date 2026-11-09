//! Where the visit's paper file is: the consultation's chip.
//!
//! Requested, on the way, arrived or not found, for one visit the caller can
//! open. Cheap and polled; it says nothing clinical, so it has its own
//! permission. The clinical summary beside it is [`super::summary`].

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::Serialize;
use sqlx::PgConnection;
use uuid::Uuid;

/// The visit's file request, as the chip shows it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VisitFileRequest {
    pub id: Uuid,
    pub status: String,
    pub record_number: String,
    pub requested_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
    pub picked_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
}

/// Whether the patient has a paper file, and the visit's request for it.
/// A file with no request reads "not requested", never "no file".
#[derive(Debug, Serialize)]
pub struct VisitFileStatus {
    pub has_physical_file: bool,
    pub request: Option<VisitFileRequest>,
}

/// `GET /api/mrd/file-requests/by-encounter/{encounter_id}` — the chip.
pub async fn visit_file_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<VisitFileStatus>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::STATUS)?;
    open_encounter(&state, &claims, encounter_id).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let status = read_status(&mut tx, claims.tenant_id, encounter_id).await?;
    tx.commit().await?;
    Ok(Json(status))
}

/// `POST /api/mrd/file-requests/by-encounter/{encounter_id}/request`.
///
/// Ask for the visit's file by hand, when the chip reads "not requested". Writes
/// what the visit trigger would have (`mrd_request_file_for_visit`, so a
/// pre-pulled request is taken over and a second click asks nothing more).
/// A cancelled visit, or a patient with no paper file, answers 409.
pub async fn request_visit_file(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<VisitFileStatus>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::CREATE)?;
    open_encounter(&state, &claims, encounter_id).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let (cancelled, request): (bool, Option<Uuid>) = sqlx::query_as(
        "SELECT e.status = 'cancelled', \
                CASE WHEN e.status <> 'cancelled' THEN public.mrd_request_file_for_visit(e) END \
           FROM encounters e WHERE e.id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let Some(request) = request else {
        return Err(AppError::Conflict(
            if cancelled {
                "This visit was cancelled; it needs no file."
            } else {
                "This patient has no paper file on the shelf to request."
            }
            .to_owned(),
        ));
    };
    super::scan::record(&mut tx, &claims, request, "mrd_file_requested_by_hand").await?;
    let status = read_status(&mut tx, claims.tenant_id, encounter_id).await?;
    tx.commit().await?;
    Ok(Json(status))
}

/// The chip's read: whether the patient has a paper file, and the visit's
/// live request (a cancelled one only when there is no other).
async fn read_status(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<VisitFileStatus, AppError> {
    let patient = encounter_patient(&mut *conn, tenant_id, encounter_id).await?;
    let has_physical_file: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM public.mrd_current_file($1, $2))")
            .bind(tenant_id)
            .bind(patient)
            .fetch_one(&mut *conn)
            .await?;
    let request = sqlx::query_as::<_, VisitFileRequest>(
        "SELECT f.id, f.status, r.record_number, f.requested_at, f.due_at, f.picked_at, \
                f.delivered_at \
           FROM mrd_file_requests f \
           JOIN mrd_medical_records r ON r.id = f.medical_record_id AND r.tenant_id = f.tenant_id \
          WHERE f.tenant_id = $1 AND f.encounter_id = $2 AND f.deleted_at IS NULL \
          ORDER BY f.status = 'cancelled', f.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut *conn)
    .await?;
    Ok(VisitFileStatus {
        has_physical_file,
        request,
    })
}

/// The visit's patient; another tenant's or a missing visit is 404.
pub(super) async fn encounter_patient(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<Uuid, AppError> {
    sqlx::query_scalar(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(encounter_id)
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// The caller may open this visit (its department, its doctor, or a grant):
/// the per-record check both the chip and the summary make.
pub(super) async fn open_encounter(
    state: &AppState,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    medbrains_authz_gate::require_encounter_access(state, claims, encounter_id).await
}

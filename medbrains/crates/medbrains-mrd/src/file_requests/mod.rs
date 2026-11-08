//! MRD file requests: the paper file a patient waits for (migration 1417).
//!
//! An OPD visit asks for the patient's physical file the moment it is
//! created (a trigger on `encounters`, so every registration path does). The
//! runner works the queue here, scanning the file barcode at the shelf and at
//! the clinic; each scan is an ordinary `mrd_record_movements` row. A request
//! past its due time, or a file nobody can find, is escalated by [`jobs`].
//! The doctor's screen reads [`visit`] (the file chip) and [`summary`] (from the
//! digital record), so the consultation never waits for the paper.

pub mod jobs;
pub mod pull_list;
pub mod reports;
pub mod scan;
pub mod summary;
pub mod visit;

use axum::{
    Extension, Json,
    extract::{Query, State},
    routing::{get, post},
};
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

/// Requests shown at once: a records room has a few hundred open at its
/// busiest morning; past that the screen is no longer a queue.
const LIST_LIMIT: i64 = 300;

/// One file request, joined for the runner's queue.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FileRequest {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub medical_record_id: Uuid,
    pub record_number: String,
    pub encounter_id: Option<Uuid>,
    pub appointment_id: Option<Uuid>,
    pub source: String,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub location_label: Option<String>,
    pub visit_date: NaiveDate,
    pub slot_start: Option<NaiveTime>,
    pub status: String,
    pub requested_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
    pub picked_at: Option<DateTime<Utc>>,
    pub picked_by_name: Option<String>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub delivered_by_name: Option<String>,
    pub escalated_at: Option<DateTime<Utc>>,
    /// Where the file is now, when it is out: the open movement's holder.
    pub holder_department: Option<String>,
    pub holder_user: Option<String>,
    pub holder_since: Option<DateTime<Utc>>,
}

/// The queue's one query: the request, patient, file, people and where the
/// file is now (its open movement), joined once.
pub(crate) const REQUEST_SELECT: &str = "SELECT f.id, f.patient_id, \
        btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid, \
        f.medical_record_id, r.record_number, f.encounter_id, f.appointment_id, f.source, \
        f.department_id, d.name AS department_name, f.doctor_id, du.full_name AS doctor_name, \
        f.location_label, f.visit_date, a.slot_start, f.status, f.requested_at, f.due_at, \
        f.picked_at, pu.full_name AS picked_by_name, f.delivered_at, \
        vu.full_name AS delivered_by_name, f.escalated_at, \
        h.holder_department, h.holder_user, h.holder_since \
   FROM mrd_file_requests f \
   JOIN patients p ON p.id = f.patient_id AND p.tenant_id = f.tenant_id \
   JOIN mrd_medical_records r ON r.id = f.medical_record_id AND r.tenant_id = f.tenant_id \
   LEFT JOIN departments d ON d.id = f.department_id \
   LEFT JOIN users du ON du.id = f.doctor_id \
   LEFT JOIN users pu ON pu.id = f.picked_by \
   LEFT JOIN users vu ON vu.id = f.delivered_by \
   LEFT JOIN appointments a ON a.id = f.appointment_id \
   LEFT JOIN LATERAL ( \
        SELECT hd.name AS holder_department, hu.full_name AS holder_user, \
               m.issued_at AS holder_since \
          FROM mrd_record_movements m \
          LEFT JOIN departments hd ON hd.id = m.issued_to_department_id \
          LEFT JOIN users hu ON hu.id = m.issued_to_user_id \
         WHERE m.tenant_id = f.tenant_id AND m.medical_record_id = f.medical_record_id \
           AND m.returned_at IS NULL AND m.deleted_at IS NULL \
         ORDER BY m.issued_at DESC LIMIT 1) h ON true";

#[derive(Debug, Deserialize)]
pub struct ListFileRequestsQuery {
    /// A visit date: every request for that day (the pull list view),
    /// ordered by doctor and appointment time. Without it, the open queue.
    pub date: Option<NaiveDate>,
}

/// `GET /api/mrd/file-requests` — the runner's queue: open requests by due
/// time, or with `?date=` that day's requests by doctor and time.
pub async fn list_file_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListFileRequestsQuery>,
) -> Result<Json<Vec<FileRequest>>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::VIEW)?;
    let permitted = crate::access::list_filter(&state, &claims, None).await?;
    let order = if q.date.is_some() {
        "du.full_name NULLS LAST, a.slot_start NULLS LAST, f.due_at"
    } else {
        "f.due_at"
    };
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as::<_, FileRequest>(&format!(
        "{REQUEST_SELECT} WHERE f.tenant_id = $1 AND f.deleted_at IS NULL \
           AND ($2::uuid[] IS NULL OR f.patient_id = ANY($2)) \
           AND (f.visit_date = $3 \
                OR ($3::date IS NULL AND f.status IN ('requested', 'picked', 'not_found'))) \
         ORDER BY {order} LIMIT {LIST_LIMIT}"
    ))
    .bind(claims.tenant_id)
    .bind(permitted.as_deref())
    .bind(q.date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// One request by id, joined as the queue shows it.
pub(crate) async fn fetch(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<FileRequest, AppError> {
    sqlx::query_as::<_, FileRequest>(&format!(
        "{REQUEST_SELECT} WHERE f.id = $1 AND f.tenant_id = $2 AND f.deleted_at IS NULL"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// The file request routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/mrd/file-requests", get(list_file_requests))
        .route(
            "/api/mrd/file-requests/{id}/scan",
            post(scan::scan_file_request),
        )
        .route(
            "/api/mrd/file-requests/{id}/not-found",
            post(scan::mark_file_not_found),
        )
        .route(
            "/api/mrd/file-requests/pull-list",
            post(pull_list::build_pull_list),
        )
        .route(
            "/api/mrd/file-requests/backscan",
            get(reports::list_backscan_order),
        )
        .route(
            "/api/mrd/file-requests/delivery-times",
            get(reports::delivery_times),
        )
        .route(
            "/api/mrd/file-requests/by-encounter/{encounter_id}",
            get(visit::visit_file_status),
        )
        .route(
            "/api/mrd/file-requests/by-encounter/{encounter_id}/summary",
            get(summary::visit_digital_summary),
        )
}

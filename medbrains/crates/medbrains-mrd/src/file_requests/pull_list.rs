//! The night-before pull list: tomorrow's appointments as pre-pulled requests.
//!
//! The files are on their way before the patients arrive. Built by the
//! evening job ([`super::jobs`]) and on demand from the MRD screen. Idempotent per appointment (`uq_mrd_file_requests_appointment`):
//! building it twice, or after more bookings, only adds what is missing.

use axum::{Extension, Json, extract::State};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

/// Appointments taken per build: more than any OPD books for one day.
const PULL_LIMIT: i64 = 2000;

#[derive(Debug, Deserialize)]
pub struct BuildPullListRequest {
    /// The visit date; tomorrow (the hospital's clock) when omitted.
    pub date: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct PullListBuilt {
    pub date: NaiveDate,
    pub created: u64,
}

/// Write a pre-pulled request for each booked appointment on `date`.
///
/// Only patients with a physical file and no request yet. Returns how many
/// it wrote. The due time is the appointment's slot, on the hospital's clock
/// (the unit of work carries its time zone).
pub async fn generate(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    date: NaiveDate,
    created_by: Option<Uuid>,
) -> Result<u64, AppError> {
    let done = sqlx::query(
        "INSERT INTO mrd_file_requests \
           (tenant_id, patient_id, medical_record_id, appointment_id, source, department_id, \
            doctor_id, location_label, visit_date, status, due_at, created_by) \
         SELECT a.tenant_id, a.patient_id, f.record_id, a.id, 'pull_list', a.department_id, \
                a.doctor_id, f.location_label, a.appointment_date, \
                CASE WHEN f.record_status = 'missing' THEN 'not_found' ELSE 'requested' END, \
                (a.appointment_date + a.slot_start)::timestamptz, $3 \
           FROM appointments a \
          CROSS JOIN LATERAL public.mrd_current_file(a.tenant_id, a.patient_id) f \
          WHERE a.tenant_id = $1 AND a.appointment_date = $2 AND a.deleted_at IS NULL \
            AND a.status IN ('scheduled', 'confirmed') AND a.encounter_id IS NULL \
          ORDER BY a.slot_start \
          LIMIT $4 \
         ON CONFLICT DO NOTHING",
    )
    .bind(tenant_id)
    .bind(date)
    .bind(created_by)
    .bind(PULL_LIMIT)
    .execute(conn)
    .await?;
    Ok(done.rows_affected())
}

/// `POST /api/mrd/file-requests/pull-list` — build the pull list now.
pub async fn build_pull_list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BuildPullListRequest>,
) -> Result<Json<PullListBuilt>, AppError> {
    require_permission(&claims, permissions::mrd::file_request::FULFIL)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let date = match body.date {
        Some(date) => date,
        None => {
            sqlx::query_scalar("SELECT CURRENT_DATE + 1")
                .fetch_one(&mut *tx)
                .await?
        }
    };
    let created = generate(&mut tx, claims.tenant_id, date, Some(claims.sub)).await?;
    tx.commit().await?;
    Ok(Json(PullListBuilt { date, created }))
}

//! `GET /api/opd/patients/{id}/last-visit` — the doctor and department of a
//! returning patient's last OPD visit, so the desk starting today's visit can
//! send them back to the doctor who saw them.
//!
//! Only what the desk needs to choose a doctor: when, who, which department.
//! Diagnoses and complaints stay behind the care team's access. Gated on
//! `opd.visit.create`, the act it serves; like `create_encounter`, no record
//! check — the desk starts visits for patients not yet in anyone's care.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use uuid::Uuid;

/// The last OPD visit. An id is left out when that doctor or department can
/// no longer take patients, so the desk shows it but does not pre-select it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LastVisit {
    pub encounter_date: NaiveDate,
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
}

pub async fn get_last_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Option<LastVisit>>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let last = sqlx::query_as::<_, LastVisit>(
        "SELECT e.encounter_date, \
                CASE WHEN u.is_active AND u.deleted_at IS NULL THEN u.id END AS doctor_id, \
                u.full_name AS doctor_name, \
                CASE WHEN d.is_active AND d.deleted_at IS NULL THEN d.id END AS department_id, \
                d.name AS department_name \
           FROM encounters e \
           LEFT JOIN users u ON u.id = e.doctor_id \
           LEFT JOIN departments d ON d.id = e.department_id \
          WHERE e.tenant_id = $1 AND e.patient_id = $2 AND e.encounter_type = 'opd' \
            AND e.status <> 'cancelled' AND e.deleted_at IS NULL \
          ORDER BY e.encounter_date DESC, e.created_at DESC \
          LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(last))
}

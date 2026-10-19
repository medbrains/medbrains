//! The patient's own video consultations: when, with whom, and the link to
//! join. Only consultations that have not ended are listed, and only the
//! signed-in patient's.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_server_core::{error::AppError, state::AppState};
use serde::Serialize;
use uuid::Uuid;

use super::portal::PatientClaims;

#[derive(Debug, sqlx::FromRow)]
struct Row {
    id: Uuid,
    doctor_name: Option<String>,
    status: String,
    scheduled_at: Option<DateTime<Utc>>,
    meeting_url: Option<String>,
    room_id: String,
}

#[derive(Debug, Serialize)]
pub struct PortalTeleconsult {
    pub id: Uuid,
    pub doctor_name: Option<String>,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub join_url: String,
}

/// `GET /api/portal/teleconsults`
#[tracing::instrument(skip_all)]
pub async fn portal_teleconsults(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<PortalTeleconsult>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Row>(
        "SELECT t.id, u.full_name AS doctor_name, t.status, t.scheduled_at, t.meeting_url, t.room_id \
           FROM tele_consultations t LEFT JOIN users u ON u.id = t.doctor_id \
          WHERE t.tenant_id = $1 AND t.patient_id = $2 \
            AND t.status IN ('scheduled', 'waiting', 'in_progress') \
          ORDER BY t.scheduled_at NULLS LAST LIMIT 20",
    )
    .bind(claims.tenant_id)
    .bind(claims.pid)
    .fetch_all(&mut *tx)
    .await?;
    let base =
        medbrains_telehealth::telemedicine::resolve_video_base(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| PortalTeleconsult {
                join_url: medbrains_telehealth::telemedicine::join_url(
                    &base,
                    r.meeting_url.as_deref(),
                    &r.room_id,
                ),
                id: r.id,
                doctor_name: r.doctor_name,
                status: r.status,
                scheduled_at: r.scheduled_at,
            })
            .collect(),
    ))
}

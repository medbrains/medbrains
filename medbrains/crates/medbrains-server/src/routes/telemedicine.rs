//! Telemedicine — video-consultation session lifecycle.
//!
//! Provider-agnostic room model (default Jitsi, no paid SDK). Reuses OPD
//! permissions since a tele-consult is an OPD visit by video.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::telemedicine::{TeleConsultation, TeleJoinInfo};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const DEFAULT_VIDEO_BASE: &str = "https://meet.jit.si";

#[derive(Debug, Deserialize)]
pub struct CreateTeleConsultationRequest {
    pub patient_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub appointment_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
    /// jitsi (default, auto room) | external | google_meet | zoom | teams.
    pub provider: Option<String>,
    /// Required for non-Jitsi providers — the externally-created join link.
    pub meeting_url: Option<String>,
}

/// Video platforms a consult can run on.
const TELE_PROVIDERS: &[&str] = &["jitsi", "external", "google_meet", "zoom", "teams"];

#[derive(Debug, Deserialize)]
pub struct ListTeleConsultationsQuery {
    pub status: Option<String>,
    pub doctor_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTeleStatusRequest {
    /// waiting | in_progress | completed | cancelled | no_show
    pub status: String,
    pub doctor_notes: Option<String>,
    pub cancel_reason: Option<String>,
}

const VALID_STATUSES: &[&str] = &[
    "scheduled",
    "waiting",
    "in_progress",
    "completed",
    "cancelled",
    "no_show",
];

/// Per-tenant video room base (self-hosted Jitsi etc.), else the public default.
async fn resolve_video_base(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'telemedicine' AND key = 'video_base'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row
        .and_then(|v| v.as_str().map(ToOwned::to_owned))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_VIDEO_BASE.to_owned()))
}

/// POST /api/telemedicine/consultations
pub async fn create_tele_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTeleConsultationRequest>,
) -> Result<Json<TeleConsultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let doctor_id = body.doctor_id.unwrap_or(claims.sub);
    let room_id = format!("medbrains-{}", Uuid::new_v4());
    let provider = body
        .provider
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("jitsi");
    if !TELE_PROVIDERS.contains(&provider) {
        return Err(AppError::BadRequest(format!(
            "Invalid provider '{provider}'; expected one of {TELE_PROVIDERS:?}"
        )));
    }
    let meeting_url = body.meeting_url.as_deref().map(str::trim).filter(|s| !s.is_empty());
    // Non-Jitsi platforms must carry the externally-created join link.
    if provider != "jitsi" && meeting_url.is_none() {
        return Err(AppError::BadRequest(format!(
            "A meeting_url is required for provider '{provider}'"
        )));
    }

    let consult = sqlx::query_as::<_, TeleConsultation>(
        "INSERT INTO tele_consultations \
         (tenant_id, appointment_id, encounter_id, patient_id, doctor_id, room_id, \
          provider, meeting_url, status, scheduled_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.appointment_id)
    .bind(body.encounter_id)
    .bind(body.patient_id)
    .bind(doctor_id)
    .bind(&room_id)
    .bind(provider)
    .bind(meeting_url)
    .bind(body.scheduled_at)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(consult))
}

/// GET /api/telemedicine/consultations
pub async fn list_tele_consultations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListTeleConsultationsQuery>,
) -> Result<Json<Vec<TeleConsultation>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TeleConsultation>(
        "SELECT * FROM tele_consultations \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
           AND ($3::uuid IS NULL OR doctor_id = $3) \
           AND ($4::uuid IS NULL OR patient_id = $4) \
         ORDER BY scheduled_at DESC NULLS LAST, created_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(q.doctor_id)
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

async fn fetch_consult(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    id: Uuid,
) -> Result<TeleConsultation, AppError> {
    sqlx::query_as::<_, TeleConsultation>(
        "SELECT * FROM tele_consultations WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// GET /api/telemedicine/consultations/{id}
pub async fn get_tele_consultation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TeleConsultation>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let consult = fetch_consult(&mut tx, &claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(consult))
}

/// GET /api/telemedicine/consultations/{id}/join — the room URL + role label.
pub async fn get_join_info(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TeleJoinInfo>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let consult = fetch_consult(&mut tx, &claims.tenant_id, id).await?;
    let base = resolve_video_base(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;

    let display_name = if claims.sub == consult.doctor_id {
        "Doctor".to_owned()
    } else {
        "Patient".to_owned()
    };

    // Externally-created meetings (Meet/Zoom/Teams) carry their own link;
    // Jitsi derives it from the tenant's video base + room id.
    let join_url = consult
        .meeting_url
        .clone()
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| format!("{}/{}", base.trim_end_matches('/'), consult.room_id));

    Ok(Json(TeleJoinInfo {
        consultation_id: consult.id,
        join_url,
        room_id: consult.room_id,
        display_name,
        status: consult.status,
    }))
}

/// PUT /api/telemedicine/consultations/{id}/status — advance the session.
pub async fn update_tele_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTeleStatusRequest>,
) -> Result<Json<TeleConsultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let status = body.status.trim();
    if !VALID_STATUSES.contains(&status) {
        return Err(AppError::BadRequest(format!(
            "Invalid status '{status}'; expected one of {VALID_STATUSES:?}"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Stamp started_at/ended_at on the transitions that matter.
    let consult = sqlx::query_as::<_, TeleConsultation>(
        "UPDATE tele_consultations SET \
         status = $1, \
         doctor_notes = COALESCE($2, doctor_notes), \
         cancel_reason = COALESCE($3, cancel_reason), \
         started_at = CASE WHEN $1 = 'in_progress' AND started_at IS NULL \
             THEN now() ELSE started_at END, \
         ended_at = CASE WHEN $1 IN ('completed', 'cancelled', 'no_show') \
             THEN now() ELSE ended_at END, \
         updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(status)
    .bind(body.doctor_notes.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.cancel_reason.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(consult))
}

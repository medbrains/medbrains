//! Telemedicine — video-consultation session lifecycle.
//!
//! Provider-agnostic room model (default Jitsi, no paid SDK). Reuses OPD
//! permissions since a tele-consult is an OPD visit by video.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::telemedicine::{TeleConsultation, TeleConsultationListItem, TeleJoinInfo};
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
/// API-created providers that have a worker adapter today (others are
/// rejected until built, mirroring the payment `has_adapter` gate).
const TELE_API_PROVIDERS_WITH_ADAPTER: &[&str] = &["zoom", "google_meet", "teams"];

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
    // Three provider shapes:
    //  - jitsi:    auto room, no link needed.
    //  - external: doctor pastes a link → meeting_url required now.
    //  - API (zoom/google_meet/teams): the worker creates the meeting → no link
    //    at create, but the provider must have an adapter.
    let is_api_provider = matches!(provider, "zoom" | "google_meet" | "teams");
    if provider == "external" && meeting_url.is_none() {
        return Err(AppError::BadRequest(
            "A meeting_url is required for an external meeting".to_owned(),
        ));
    }
    if is_api_provider && !TELE_API_PROVIDERS_WITH_ADAPTER.contains(&provider) {
        return Err(AppError::ServiceUnavailable(format!(
            "Video provider '{provider}' has no adapter yet — connect it or paste an external link"
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

    // API providers: the worker creates the meeting off-thread and writes the
    // join link back to meeting_url (client polls GET /consultations/{id}).
    let meeting_event = match provider {
        "zoom" => Some("meeting.zoom.create"),
        "google_meet" => Some("meeting.google_meet.create"),
        "teams" => Some("meeting.teams.create"),
        _ => None,
    };
    if let Some(event_type) = meeting_event {
        medbrains_outbox::queue_in_tx(
            &mut tx,
            medbrains_outbox::OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "tele_consultation",
                aggregate_id: Some(consult.id),
                event_type,
                payload: serde_json::json!({
                    "consultation_id": consult.id,
                    "topic": "Tele-consultation",
                    "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
                }),
                idempotency_key: Some(consult.id.to_string()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
    }

    tx.commit().await?;
    Ok(Json(consult))
}

/// GET /api/telemedicine/consultations
pub async fn list_tele_consultations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListTeleConsultationsQuery>,
) -> Result<Json<Vec<TeleConsultationListItem>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Worklist omits doctor_notes — the detail view fetches the full record.
    let rows = sqlx::query_as::<_, TeleConsultationListItem>(
        "SELECT id, tenant_id, appointment_id, encounter_id, patient_id, doctor_id, room_id, \
         provider, meeting_url, status, scheduled_at, started_at, ended_at, cancel_reason, \
         created_by, created_at, updated_at FROM tele_consultations \
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
    let mut consult = sqlx::query_as::<_, TeleConsultation>(
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

    // #2949: on completion, auto-create the EMR visit record if the consult isn't already linked.
    if consult.status == "completed" && consult.encounter_id.is_none() {
        let enc_id: Uuid = sqlx::query_scalar(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type, doctor_id, notes) \
             VALUES ($1, $2, 'opd'::encounter_type, $3, 'Telemedicine consultation') RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(consult.patient_id)
        .bind(consult.doctor_id)
        .fetch_one(&mut *tx)
        .await?;
        consult = sqlx::query_as::<_, TeleConsultation>(
            "UPDATE tele_consultations SET encounter_id = $2, updated_at = now() \
             WHERE id = $1 AND tenant_id = $3 RETURNING *",
        )
        .bind(consult.id)
        .bind(enc_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(consult))
}

// ── Waiting room with queue position (#2945) ───────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct WaitingRoomQuery {
    pub doctor_id: Option<Uuid>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct WaitingRoomItem {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub doctor_id: Option<Uuid>,
    pub scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub position: i64,
    /// Triage acuity if the patient completed pre-consult intake (emergent bubbles to the top).
    pub acuity: Option<String>,
    pub red_flags: Option<Vec<String>>,
}

/// `GET /api/telemedicine/waiting-room?doctor_id=` — patients checked in and waiting, each with
/// their scheduled-queue position AND their triage acuity; the list is ordered emergent-first so a
/// red-flagged patient is seen before their scheduled slot.
pub async fn waiting_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<WaitingRoomQuery>,
) -> Result<Json<Vec<WaitingRoomItem>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, WaitingRoomItem>(
        "SELECT tc.id, tc.patient_id, \
            NULLIF(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, ''))), '') AS patient_name, \
            tc.doctor_id, tc.scheduled_at, \
            ROW_NUMBER() OVER (PARTITION BY tc.doctor_id \
                ORDER BY tc.scheduled_at NULLS LAST, tc.created_at) AS position, \
            tt.acuity, tt.red_flags \
         FROM tele_consultations tc \
         LEFT JOIN patients p ON p.id = tc.patient_id \
         LEFT JOIN tele_triage tt ON tt.tenant_id = tc.tenant_id AND tt.consultation_id = tc.id \
         WHERE tc.tenant_id = $1 AND tc.status = 'waiting' \
           AND ($2::uuid IS NULL OR tc.doctor_id = $2) \
         ORDER BY tc.doctor_id, \
            CASE tt.acuity WHEN 'emergent' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, position \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.doctor_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── Recording consent + optional recording (#2946) ─────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct UpdateRecordingRequest {
    pub recording_consent: Option<bool>,
    pub is_recording: Option<bool>,
    pub recording_url: Option<String>,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct RecordingState {
    pub recording_consent: bool,
    pub is_recording: bool,
    pub recording_url: Option<String>,
}

/// `PUT /api/telemedicine/consultations/{id}/recording` — set recording consent / toggle recording.
/// Recording can only turn on when consent is present (existing or in this request).
pub async fn update_recording(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRecordingRequest>,
) -> Result<Json<RecordingState>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, RecordingState>(
        "UPDATE tele_consultations SET \
            recording_consent = COALESCE($3, recording_consent), \
            is_recording = CASE \
                WHEN $4 IS NULL THEN is_recording \
                WHEN $4 = true AND COALESCE($3, recording_consent) = true THEN true \
                WHEN $4 = false THEN false \
                ELSE is_recording END, \
            recording_url = COALESCE($5, recording_url), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING recording_consent, is_recording, recording_url",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.recording_consent)
    .bind(body.is_recording)
    .bind(&body.recording_url)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Follow-up scheduling from within a session (#2947) ─────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct ScheduleFollowUpRequest {
    pub scheduled_at: chrono::DateTime<chrono::Utc>,
}

/// `POST /api/telemedicine/consultations/{id}/follow-up` — schedule a follow-up consult, copying
/// the patient / doctor / provider from this one and linking it via follow_up_of.
pub async fn schedule_follow_up(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ScheduleFollowUpRequest>,
) -> Result<Json<TeleConsultation>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, TeleConsultation>(
        "INSERT INTO tele_consultations \
         (tenant_id, patient_id, doctor_id, provider, status, scheduled_at, room_id, \
          follow_up_of, created_by) \
         SELECT tenant_id, patient_id, doctor_id, provider, 'scheduled', $3, \
                'mb-' || gen_random_uuid()::text, id, $4 \
         FROM tele_consultations WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.scheduled_at)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    // Link the follow-up's doctor to the patient so the scheduled tele-provider
    // can see the patient ahead of the visit (ReBAC). Additive — no lock-out.
    let authz_ctx = crate::middleware::authorization::authz_context(&claims);
    state
        .authz
        .write_tuple(
            &authz_ctx,
            "patient",
            row.patient_id,
            medbrains_authz::Relation::Viewer,
            medbrains_authz::Subject::User(row.doctor_id),
            None,
            Some("tele_followup_doctor".to_owned()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("tele follow-up authz grant failed: {e}")))?;

    Ok(Json(row))
}

// ── Chat messaging fallback (#2948) ────────────────────────────────────────

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct TeleChatMessage {
    pub id: Uuid,
    pub consultation_id: Uuid,
    pub sender_role: String,
    pub sender_id: Option<Uuid>,
    pub body: String,
    pub sent_at: chrono::DateTime<chrono::Utc>,
}

/// `GET /api/telemedicine/consultations/{id}/chat` — the chat thread for a consultation.
pub async fn list_chat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<TeleChatMessage>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, TeleChatMessage>(
        "SELECT id, consultation_id, sender_role, sender_id, body, sent_at \
         FROM tele_chat_messages WHERE tenant_id = $1 AND consultation_id = $2 \
         ORDER BY sent_at LIMIT 1000",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, serde::Deserialize)]
pub struct PostChatRequest {
    pub body: String,
    pub sender_role: Option<String>,
}

/// `POST /api/telemedicine/consultations/{id}/chat` — post a chat message.
pub async fn post_chat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PostChatRequest>,
) -> Result<Json<TeleChatMessage>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    if body.body.trim().is_empty() {
        return Err(AppError::BadRequest("Message body is required".to_owned()));
    }
    let role = body.sender_role.as_deref().unwrap_or("doctor");
    if !["doctor", "patient", "system"].contains(&role) {
        return Err(AppError::BadRequest("Invalid sender role".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, TeleChatMessage>(
        "INSERT INTO tele_chat_messages (tenant_id, consultation_id, sender_role, sender_id, body) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, consultation_id, sender_role, sender_id, body, sent_at",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(role)
    .bind(claims.sub)
    .bind(body.body.trim())
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── In-app video provider configuration (video_base + default provider) ────

#[derive(Debug, serde::Serialize)]
pub struct TeleProviderInfo {
    pub name: String,
    pub available: bool,
    pub requires_credentials: bool,
}

#[derive(Debug, serde::Serialize)]
pub struct TeleConfig {
    /// Effective Jitsi base (configured tenant setting, else the public default).
    pub video_base: String,
    /// True when a tenant setting overrides the public default.
    pub video_base_configured: bool,
    pub default_provider: String,
    pub providers: Vec<TeleProviderInfo>,
}

fn provider_infos() -> Vec<TeleProviderInfo> {
    TELE_PROVIDERS
        .iter()
        .map(|&p| {
            let is_api = matches!(p, "zoom" | "google_meet" | "teams");
            TeleProviderInfo {
                name: p.to_owned(),
                available: !is_api || TELE_API_PROVIDERS_WITH_ADAPTER.contains(&p),
                requires_credentials: is_api,
            }
        })
        .collect()
}

async fn setting_str(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    key: &str,
) -> Result<Option<String>, AppError> {
    let v = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'telemedicine' AND key = $2",
    )
    .bind(tenant_id)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(v.and_then(|v| v.as_str().map(ToOwned::to_owned)).filter(|s| !s.is_empty()))
}

async fn load_tele_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<TeleConfig, AppError> {
    let vb = setting_str(tx, tenant_id, "video_base").await?;
    let dp = setting_str(tx, tenant_id, "default_provider").await?;
    Ok(TeleConfig {
        video_base_configured: vb.is_some(),
        video_base: vb.unwrap_or_else(|| DEFAULT_VIDEO_BASE.to_owned()),
        default_provider: dp.unwrap_or_else(|| "jitsi".to_owned()),
        providers: provider_infos(),
    })
}

/// `GET /api/telemedicine/config` — the video provider configuration.
pub async fn get_tele_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TeleConfig>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let cfg = load_tele_config(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(cfg))
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateTeleConfigRequest {
    pub video_base: Option<String>,
    pub default_provider: Option<String>,
}

/// `PUT /api/telemedicine/config` — set the Jitsi base and/or default provider (non-secret config).
pub async fn update_tele_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateTeleConfigRequest>,
) -> Result<Json<TeleConfig>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    if let Some(dp) = &body.default_provider {
        if !TELE_PROVIDERS.contains(&dp.as_str()) {
            return Err(AppError::BadRequest(format!("Unknown provider '{dp}'")));
        }
        let is_api = matches!(dp.as_str(), "zoom" | "google_meet" | "teams");
        if is_api && !TELE_API_PROVIDERS_WITH_ADAPTER.contains(&dp.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Provider '{dp}' has no adapter — can't be the default"
            )));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    if let Some(vb) = body.video_base.as_deref().map(str::trim) {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, 'telemedicine', 'video_base', $2) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
                 updated_at = now()",
        )
        .bind(claims.tenant_id)
        .bind(serde_json::Value::String(vb.to_owned()))
        .execute(&mut *tx)
        .await?;
    }
    if let Some(dp) = &body.default_provider {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, 'telemedicine', 'default_provider', $2) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
                 updated_at = now()",
        )
        .bind(claims.tenant_id)
        .bind(serde_json::Value::String(dp.clone()))
        .execute(&mut *tx)
        .await?;
    }
    let cfg = load_tele_config(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(cfg))
}

// ── Tele-triage: explainable pre-consult red-flag / acuity engine ──────────

/// Result of the deterministic triage engine.
struct TriageOutcome {
    acuity: &'static str,
    recommended_timeframe: &'static str,
    red_flags: Vec<String>,
    reasoning: Vec<serde_json::Value>,
}

/// Grade a pre-consult intake into an acuity band with explainable red-flags. Deterministic and
/// transparent — every flag records the rule that fired (research-grounded triage red-flag sets,
/// not a black-box model). `symptoms` are lowercase snake_case codes; `vitals` is patient-reported.
fn run_triage(symptoms: &[String], severity: Option<i32>, vitals: &serde_json::Value) -> TriageOutcome {
    let has = |s: &str| symptoms.iter().any(|x| x == s);
    let num = |k: &str| vitals.get(k).and_then(serde_json::Value::as_f64);
    let mut red_flags: Vec<String> = Vec::new();
    let mut reasoning: Vec<serde_json::Value> = Vec::new();
    let mut flag = |code: &str, rule: &str| {
        red_flags.push(code.to_owned());
        reasoning.push(serde_json::json!({ "flag": code, "rule": rule }));
    };

    if has("chest_pain") && (has("sweating") || has("radiation_arm") || has("breathlessness")) {
        flag("possible_acs", "chest pain with an associated feature (sweating/radiation/dyspnoea)");
    }
    if has("facial_droop") || has("arm_weakness") || has("speech_difficulty") {
        flag("stroke_fast", "FAST-positive: facial droop / arm weakness / speech difficulty");
    }
    if has("breathlessness") && severity.is_some_and(|s| s >= 7) {
        flag("respiratory_distress", "breathlessness with severity >= 7/10");
    }
    if num("spo2").is_some_and(|v| v < 92.0) {
        flag("hypoxia", "SpO2 < 92%");
    }
    if has("fever") && (has("neck_stiffness") || has("photophobia")) {
        flag("meningism", "fever with neck stiffness / photophobia");
    }
    if has("anaphylaxis") || (has("rash") && has("breathlessness")) {
        flag("anaphylaxis", "anaphylaxis features (rash + dyspnoea)");
    }
    if has("severe_bleeding") {
        flag("severe_haemorrhage", "severe/uncontrolled bleeding reported");
    }
    if has("suicidal_ideation") {
        flag("self_harm_risk", "suicidal ideation reported");
    }
    if num("systolic").is_some_and(|v| v > 180.0) {
        flag("hypertensive_urgency", "systolic BP > 180 mmHg");
    }

    // Acuity: any red flag → emergent, except hypertensive urgency in isolation → urgent.
    let acuity = if red_flags.is_empty() {
        if severity.is_some_and(|s| s >= 7) { "urgent" } else { "routine" }
    } else if red_flags.len() == 1 && red_flags[0] == "hypertensive_urgency" {
        "urgent"
    } else {
        "emergent"
    };
    let recommended_timeframe = match acuity {
        "emergent" => "immediate — direct to emergency / do not wait for video",
        "urgent" => "within 2 hours",
        _ => "routine slot",
    };
    TriageOutcome { acuity, recommended_timeframe, red_flags, reasoning }
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct TeleTriage {
    pub id: Uuid,
    pub consultation_id: Uuid,
    pub patient_id: Uuid,
    pub chief_complaint: Option<String>,
    pub symptoms: Vec<String>,
    pub duration_hours: Option<i32>,
    pub severity: Option<i32>,
    pub vitals: serde_json::Value,
    pub acuity: String,
    pub red_flags: Vec<String>,
    pub recommended_timeframe: Option<String>,
    pub reasoning: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

const TRIAGE_COLS: &str = "id, consultation_id, patient_id, chief_complaint, symptoms, \
     duration_hours, severity, vitals, acuity, red_flags, recommended_timeframe, reasoning, \
     created_at";

#[derive(Debug, serde::Deserialize)]
pub struct SubmitTriageRequest {
    pub chief_complaint: Option<String>,
    #[serde(default)]
    pub symptoms: Vec<String>,
    pub duration_hours: Option<i32>,
    pub severity: Option<i32>,
    pub vitals: Option<serde_json::Value>,
}

/// `POST /api/telemedicine/consultations/{id}/triage` — submit intake; the engine grades it.
pub async fn submit_triage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubmitTriageRequest>,
) -> Result<Json<TeleTriage>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;
    if let Some(s) = body.severity {
        if !(0..=10).contains(&s) {
            return Err(AppError::BadRequest("Severity must be 0-10".to_owned()));
        }
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM tele_consultations WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let vitals = body.vitals.unwrap_or_else(|| serde_json::json!({}));
    let outcome = run_triage(&body.symptoms, body.severity, &vitals);
    let reasoning = serde_json::Value::Array(outcome.reasoning);

    let row = sqlx::query_as::<_, TeleTriage>(&format!(
        "INSERT INTO tele_triage \
         (tenant_id, consultation_id, patient_id, chief_complaint, symptoms, duration_hours, \
          severity, vitals, acuity, red_flags, recommended_timeframe, reasoning, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         ON CONFLICT (tenant_id, consultation_id) DO UPDATE SET \
            chief_complaint = EXCLUDED.chief_complaint, symptoms = EXCLUDED.symptoms, \
            duration_hours = EXCLUDED.duration_hours, severity = EXCLUDED.severity, \
            vitals = EXCLUDED.vitals, acuity = EXCLUDED.acuity, red_flags = EXCLUDED.red_flags, \
            recommended_timeframe = EXCLUDED.recommended_timeframe, reasoning = EXCLUDED.reasoning, \
            updated_at = now() \
         RETURNING {TRIAGE_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(patient_id)
    .bind(&body.chief_complaint)
    .bind(&body.symptoms)
    .bind(body.duration_hours)
    .bind(body.severity)
    .bind(&vitals)
    .bind(outcome.acuity)
    .bind(&outcome.red_flags)
    .bind(outcome.recommended_timeframe)
    .bind(&reasoning)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/telemedicine/consultations/{id}/triage` — the triage for a consult (if any).
pub async fn get_triage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Option<TeleTriage>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, TeleTriage>(&format!(
        "SELECT {TRIAGE_COLS} FROM tele_triage WHERE tenant_id = $1 AND consultation_id = $2"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod triage_tests {
    use super::run_triage;

    fn syms(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn acs_is_emergent() {
        let o = run_triage(&syms(&["chest_pain", "sweating"]), Some(6), &serde_json::json!({}));
        assert_eq!(o.acuity, "emergent");
        assert!(o.red_flags.contains(&"possible_acs".to_owned()));
    }

    #[test]
    fn hypoxia_from_vitals() {
        let o = run_triage(&syms(&["cough"]), Some(3), &serde_json::json!({ "spo2": 88 }));
        assert_eq!(o.acuity, "emergent");
        assert!(o.red_flags.contains(&"hypoxia".to_owned()));
    }

    #[test]
    fn hypertensive_urgency_alone_is_urgent() {
        let o = run_triage(&syms(&["headache"]), Some(4), &serde_json::json!({ "systolic": 190 }));
        assert_eq!(o.acuity, "urgent");
    }

    #[test]
    fn high_severity_no_flag_is_urgent() {
        let o = run_triage(&syms(&["abdominal_pain"]), Some(8), &serde_json::json!({}));
        assert_eq!(o.acuity, "urgent");
        assert!(o.red_flags.is_empty());
    }

    #[test]
    fn mild_is_routine() {
        let o = run_triage(&syms(&["sore_throat"]), Some(2), &serde_json::json!({}));
        assert_eq!(o.acuity, "routine");
    }
}

// ── Tele-triage research registry (de-identified, PHI-free) ────────────────
// Closes the loop on the triage engine: aggregate performance + a de-identified row export for
// research / rule-tuning. No patient_id, names, DOB, or free-text leave here — only structured
// triage inputs, the outcome, and a coarse age band + sex.

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AcuityCount {
    pub acuity: String,
    pub count: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct FlagCount {
    pub flag: String,
    pub count: i64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct AcuityDisposition {
    pub acuity: String,
    pub disposition: String,
    pub count: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct TriageResearchSummary {
    pub total: i64,
    pub by_acuity: Vec<AcuityCount>,
    pub red_flag_frequency: Vec<FlagCount>,
    pub acuity_disposition: Vec<AcuityDisposition>,
    /// Share of emergent triages whose consult produced an EMR encounter (a proxy for genuine
    /// escalation — informs whether the emergent band is over- or under-calling).
    pub emergent_escalation_rate: f64,
}

/// `GET /api/telemedicine/triage-research/summary` — aggregate triage performance (no PHI).
pub async fn triage_research_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TriageResearchSummary>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM tele_triage WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let by_acuity = sqlx::query_as::<_, AcuityCount>(
        "SELECT acuity, count(*) AS count FROM tele_triage WHERE tenant_id = $1 \
         GROUP BY acuity ORDER BY count DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let red_flag_frequency = sqlx::query_as::<_, FlagCount>(
        "SELECT flag, count(*) AS count \
         FROM tele_triage, unnest(red_flags) AS flag WHERE tenant_id = $1 \
         GROUP BY flag ORDER BY count DESC LIMIT 20",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let acuity_disposition = sqlx::query_as::<_, AcuityDisposition>(
        "SELECT tt.acuity, tc.status AS disposition, count(*) AS count \
         FROM tele_triage tt JOIN tele_consultations tc ON tc.id = tt.consultation_id \
         WHERE tt.tenant_id = $1 GROUP BY tt.acuity, tc.status ORDER BY tt.acuity, count DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let emergent_escalation_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE( \
            avg(CASE WHEN tc.encounter_id IS NOT NULL THEN 1.0 ELSE 0.0 END)::float8, 0.0) \
         FROM tele_triage tt JOIN tele_consultations tc ON tc.id = tt.consultation_id \
         WHERE tt.tenant_id = $1 AND tt.acuity = 'emergent'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(TriageResearchSummary {
        total,
        by_acuity,
        red_flag_frequency,
        acuity_disposition,
        emergent_escalation_rate,
    }))
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct TriageResearchRow {
    pub acuity: String,
    pub symptoms: Vec<String>,
    pub severity: Option<i32>,
    pub red_flags: Vec<String>,
    pub has_encounter: bool,
    pub disposition: String,
    pub age_band: Option<String>,
    pub biological_sex: Option<String>,
    pub triaged_week: chrono::NaiveDate,
}

/// `GET /api/telemedicine/triage-research/dataset` — a de-identified row-level research dataset.
/// No direct identifiers: age is a coarse band, timing is truncated to the ISO week.
pub async fn triage_research_dataset(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TriageResearchRow>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, TriageResearchRow>(
        "SELECT tt.acuity, tt.symptoms, tt.severity, tt.red_flags, \
            (tc.encounter_id IS NOT NULL) AS has_encounter, tc.status AS disposition, \
            CASE \
                WHEN p.date_of_birth IS NULL THEN NULL \
                WHEN date_part('year', age(p.date_of_birth)) < 18 THEN '0-17' \
                WHEN date_part('year', age(p.date_of_birth)) < 40 THEN '18-39' \
                WHEN date_part('year', age(p.date_of_birth)) < 65 THEN '40-64' \
                ELSE '65+' END AS age_band, \
            p.biological_sex, \
            date_trunc('week', tt.created_at)::date AS triaged_week \
         FROM tele_triage tt JOIN tele_consultations tc ON tc.id = tt.consultation_id \
         LEFT JOIN patients p ON p.id = tt.patient_id \
         WHERE tt.tenant_id = $1 ORDER BY tt.created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

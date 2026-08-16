//! TV Display & Queue Management routes.
//!
//! REST endpoints for:
//! - TV display configuration
//! - Token generation
//! - Queue management
//! - Announcements

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use axum::routing::{get,post};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::permissions::admin::tv_displays;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::queue_broadcast::{
    AnnouncementEvent, QueueBroadcaster, QueueEvent, QueueTokenInfo, TOKEN_ONLY_QUEUE_PATIENT_NAME,
};
use medbrains_server_core::state::AppState;

/// Permission gate in this module's `(StatusCode, String)` error shape.
///
/// The handlers here predate the shared `AppError` convention, so
/// `require_permission`'s `AppError::Forbidden` is mapped by hand.
fn require(claims: &Claims, perm: &str) -> Result<(), (StatusCode, String)> {
    require_permission(claims, perm)
        .map_err(|_| (StatusCode::FORBIDDEN, "forbidden".to_owned()))
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/// TV display configuration from database.
#[derive(Debug, Serialize, FromRow)]
pub struct TvDisplay {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub department_id: Option<Uuid>,
    pub location_name: String,
    pub display_type: String,
    pub doctors_per_screen: i32,
    pub show_patient_name: bool,
    pub show_wait_time: bool,
    pub language: serde_json::Value,
    pub announcement_enabled: bool,
    pub scroll_speed: i32,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

/// Queue token from database.
#[derive(Debug, Serialize, FromRow)]
pub struct QueueToken {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub token_date: NaiveDate,
    pub token_seq: i32,
    pub token_number: String,
    pub patient_id: Option<Uuid>,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub status: String,
    pub priority: String,
    pub called_at: Option<chrono::DateTime<Utc>>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
    pub created_at: chrono::DateTime<Utc>,
}

/// Request to create a new token.
#[derive(Debug, Deserialize)]
pub struct CreateTokenRequest {
    pub department_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    #[serde(default)]
    pub priority: Option<String>,
}

/// Response with created token.
#[derive(Debug, Serialize)]
pub struct CreateTokenResponse {
    pub id: Uuid,
    pub token_number: String,
    pub department_name: String,
    pub queue_position: i32,
    pub estimated_wait_minutes: Option<i32>,
}

/// Request to update display config.
#[derive(Debug, Deserialize)]
pub struct UpdateDisplayRequest {
    pub location_name: Option<String>,
    pub display_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub doctors_per_screen: Option<i32>,
    pub show_patient_name: Option<bool>,
    pub show_wait_time: Option<bool>,
    pub language: Option<Vec<String>>,
    pub announcement_enabled: Option<bool>,
    pub scroll_speed: Option<i32>,
}

/// Request to create display.
#[derive(Debug, Deserialize)]
pub struct CreateDisplayRequest {
    pub location_name: String,
    pub display_type: String,
    pub department_id: Option<Uuid>,
    #[serde(default = "default_doctors_per_screen")]
    pub doctors_per_screen: i32,
    #[serde(default)]
    pub show_patient_name: bool,
    #[serde(default = "default_true")]
    pub show_wait_time: bool,
    #[serde(default = "default_language")]
    pub language: Vec<String>,
    #[serde(default)]
    pub announcement_enabled: bool,
    #[serde(default = "default_scroll_speed")]
    pub scroll_speed: i32,
}

const fn default_doctors_per_screen() -> i32 {
    4
}

const fn default_true() -> bool {
    true
}

fn default_language() -> Vec<String> {
    vec!["en".to_string()]
}

const fn default_scroll_speed() -> i32 {
    3
}

fn public_token_board_display_type(display_type: &str) -> bool {
    matches!(
        display_type,
        "billing_queue"
            | "emergency_triage"
            | "lab_queue"
            | "opd_queue"
            | "pharmacy_queue"
            | "radiology_queue"
    )
}

fn protected_display_show_patient_name(display_type: &str, requested: bool) -> bool {
    !public_token_board_display_type(display_type) && requested
}

#[cfg(test)]
mod display_privacy_tests {
    use super::{
        BedWaitingSourceRow, bed_waiting_entry, protected_display_show_patient_name,
        public_token_board_display_type,
    };
    use medbrains_server_core::queue_broadcast::TOKEN_ONLY_QUEUE_PATIENT_NAME;

    #[test]
    fn public_token_board_display_types_are_token_only() {
        for display_type in [
            "billing_queue",
            "emergency_triage",
            "lab_queue",
            "opd_queue",
            "pharmacy_queue",
            "radiology_queue",
        ] {
            assert!(public_token_board_display_type(display_type));
            assert!(!protected_display_show_patient_name(display_type, true));
        }
    }

    #[test]
    fn non_public_display_types_can_follow_requested_visibility() {
        assert!(!public_token_board_display_type("doctor_room"));
        assert!(protected_display_show_patient_name("doctor_room", true));
        assert!(!protected_display_show_patient_name("doctor_room", false));
    }

    #[test]
    fn public_bed_waiting_entries_are_token_only() {
        let entry = bed_waiting_entry(BedWaitingSourceRow {
            ward_type: "icu".to_owned(),
            priority: "critical".to_owned(),
            wait_time_minutes: 42,
            status: "awaiting_bed".to_owned(),
        });

        assert_eq!(entry.patient_name, TOKEN_ONLY_QUEUE_PATIENT_NAME);
        assert_eq!(entry.ward_type, "icu");
        assert_eq!(entry.priority, "critical");
        assert_eq!(entry.wait_time_minutes, 42);
        assert_eq!(entry.status, "awaiting_bed");
    }
}

/// Request to broadcast announcement.
#[derive(Debug, Deserialize)]
pub struct BroadcastAnnouncementRequest {
    pub message: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    pub display_ids: Option<Vec<Uuid>>,
    pub ends_at: Option<chrono::DateTime<Utc>>,
}

fn default_priority() -> String {
    "info".to_string()
}

/// Query params for listing tokens.
#[derive(Debug, Deserialize)]
pub struct ListTokensQuery {
    pub department_id: Option<Uuid>,
    pub status: Option<String>,
    pub date: Option<NaiveDate>,
}

/// Queue state for a department.
#[derive(Debug, Serialize)]
pub struct DepartmentQueueState {
    pub department_id: Uuid,
    pub department_name: String,
    pub current_token: Option<QueueTokenInfo>,
    pub next_tokens: Vec<QueueTokenInfo>,
    pub waiting_count: i32,
    pub completed_count: i32,
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Management Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// GET /api/tv/displays
/// List all TV display configurations.
pub async fn list_displays(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TvDisplay>>, (StatusCode, String)> {
    require(&claims, tv_displays::LIST)?;
    let displays = sqlx::query_as::<_, TvDisplay>(
        r"
        SELECT id, tenant_id, department_id, location_name, display_type,
               doctors_per_screen,
               CASE
                   WHEN display_type IN (
                       'billing_queue',
                       'emergency_triage',
                       'lab_queue',
                       'opd_queue',
                       'pharmacy_queue',
                       'radiology_queue'
                   ) THEN false
                   ELSE show_patient_name
               END AS show_patient_name,
               show_wait_time,
               language, announcement_enabled, scroll_speed,
               created_at, updated_at
        FROM queue_display_config
        WHERE tenant_id = $1
        ORDER BY location_name
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(displays))
}

/// POST /api/tv/displays
/// Create a new TV display configuration.
pub async fn create_display(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateDisplayRequest>,
) -> Result<Json<TvDisplay>, (StatusCode, String)> {
    require(&claims, tv_displays::CREATE)?;
    let language_json = serde_json::to_value(&req.language)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let show_patient_name =
        protected_display_show_patient_name(&req.display_type, req.show_patient_name);

    let display = sqlx::query_as::<_, TvDisplay>(
        r"
        INSERT INTO queue_display_config (
            tenant_id, department_id, location_name, display_type,
            doctors_per_screen, show_patient_name, show_wait_time,
            language, announcement_enabled, scroll_speed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, tenant_id, department_id, location_name, display_type,
                  doctors_per_screen, show_patient_name, show_wait_time,
                  language, announcement_enabled, scroll_speed,
                  created_at, updated_at
        ",
    )
    .bind(claims.tenant_id)
    .bind(req.department_id)
    .bind(&req.location_name)
    .bind(&req.display_type)
    .bind(req.doctors_per_screen)
    .bind(show_patient_name)
    .bind(req.show_wait_time)
    .bind(&language_json)
    .bind(req.announcement_enabled)
    .bind(req.scroll_speed)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(display))
}

/// GET /api/tv/displays/{id}
/// Get a specific display configuration.
pub async fn get_display(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TvDisplay>, (StatusCode, String)> {
    require(&claims, tv_displays::LIST)?;
    let display = sqlx::query_as::<_, TvDisplay>(
        r"
        SELECT id, tenant_id, department_id, location_name, display_type,
               doctors_per_screen,
               CASE
                   WHEN display_type IN (
                       'billing_queue',
                       'emergency_triage',
                       'lab_queue',
                       'opd_queue',
                       'pharmacy_queue',
                       'radiology_queue'
                   ) THEN false
                   ELSE show_patient_name
               END AS show_patient_name,
               show_wait_time,
               language, announcement_enabled, scroll_speed,
               created_at, updated_at
        FROM queue_display_config
        WHERE id = $1 AND tenant_id = $2
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Display not found".to_string()))?;

    Ok(Json(display))
}

/// PUT /api/tv/displays/{id}
/// Update a TV display configuration.
pub async fn update_display(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateDisplayRequest>,
) -> Result<Json<TvDisplay>, (StatusCode, String)> {
    require(&claims, tv_displays::UPDATE)?;
    // Build dynamic update query
    let language_json = req.language.and_then(|l| serde_json::to_value(l).ok());

    let display = sqlx::query_as::<_, TvDisplay>(
        r"
        UPDATE queue_display_config
        SET location_name = COALESCE($3, location_name),
            display_type = COALESCE($4, display_type),
            department_id = COALESCE($5, department_id),
            doctors_per_screen = COALESCE($6, doctors_per_screen),
            show_patient_name = CASE
                WHEN COALESCE($4, display_type) IN (
                    'billing_queue',
                    'emergency_triage',
                    'lab_queue',
                    'opd_queue',
                    'pharmacy_queue',
                    'radiology_queue'
                ) THEN false
                ELSE COALESCE($7, show_patient_name)
            END,
            show_wait_time = COALESCE($8, show_wait_time),
            language = COALESCE($9, language),
            announcement_enabled = COALESCE($10, announcement_enabled),
            scroll_speed = COALESCE($11, scroll_speed),
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, department_id, location_name, display_type,
                  doctors_per_screen, show_patient_name, show_wait_time,
                  language, announcement_enabled, scroll_speed,
                  created_at, updated_at
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(req.location_name)
    .bind(req.display_type)
    .bind(req.department_id)
    .bind(req.doctors_per_screen)
    .bind(req.show_patient_name)
    .bind(req.show_wait_time)
    .bind(language_json)
    .bind(req.announcement_enabled)
    .bind(req.scroll_speed)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Display not found".to_string()))?;

    Ok(Json(display))
}

/// DELETE /api/tv/displays/{id}
/// Delete a TV display configuration.
pub async fn delete_display(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    require(&claims, tv_displays::DELETE)?;
    let result = sqlx::query(
        r"
        DELETE FROM queue_display_config
        WHERE id = $1 AND tenant_id = $2
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Display not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Generation Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// POST /api/tv/tokens
/// Generate a new queue token.
/// Minutes this department is likely to take to reach a given queue position.
///
/// Measured, not assumed. The previous estimate was `position * 5` — a constant
/// that was wrong in both directions: a department running three doctors clears
/// its queue far faster than five minutes a patient, and a single slow clinic
/// far slower, so the number on the slip bore no relation to the wait.
///
/// Throughput rather than consultation length, because throughput already
/// carries concurrency: three doctors working in parallel produce completions
/// three times as fast, with no staffing table to consult.
///
/// Falls back to the old constant until the department has finished enough
/// patients to mean anything. An estimate drawn from one data point is worse
/// than an honest guess, because it looks authoritative.
const ASSUMED_MINUTES_PER_PATIENT: i32 = 5;
const MIN_COMPLETIONS_FOR_A_PACE: i64 = 3;

async fn estimate_wait_minutes(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    department_id: Uuid,
    today: NaiveDate,
    position: i64,
) -> Option<i32> {
    let measured: Option<(i64, Option<i64>)> = sqlx::query_as(
        r"
        SELECT COUNT(*),
               ROUND(EXTRACT(EPOCH FROM (now() - MIN(called_at))) / 60)::bigint
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
          AND status = 'completed' AND called_at IS NOT NULL
        ",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();

    let pace = match measured {
        Some((completed, Some(elapsed)))
            if completed >= MIN_COMPLETIONS_FOR_A_PACE && elapsed > 0 =>
        {
            // At least a minute a patient: a department cannot clear its queue
            // faster than the clock, and rounding to zero would promise "no
            // wait" to everyone behind.
            i32::try_from(elapsed / completed)
                .unwrap_or(ASSUMED_MINUTES_PER_PATIENT)
                .max(1)
        }
        _ => ASSUMED_MINUTES_PER_PATIENT,
    };

    let ahead = i32::try_from(position).unwrap_or(i32::MAX);
    Some(ahead.saturating_mul(pace))
}

/// How many are ahead of one token, and how long that is likely to take.
///
/// Public because the printed slip needs the same two numbers the board shows.
/// The slip used to print no wait at all, and a second implementation would
/// have let paper and screen disagree about the same queue — the failure this
/// is meant to prevent.
///
/// Counted the way the queue is actually called: `priority DESC, token_seq ASC`.
/// Returns the number *ahead*, not the 1-based position.
pub async fn position_and_wait(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    department_id: Uuid,
    token_date: NaiveDate,
    token_seq: i32,
    priority: &str,
) -> Result<(i64, Option<i32>), sqlx::Error> {
    let ahead: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(*)
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
          AND status = 'waiting'
          AND (priority > $5::queue_priority
               OR (priority = $5::queue_priority AND token_seq < $4))
        ",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(token_date)
    .bind(token_seq)
    .bind(priority)
    .fetch_one(db)
    .await?;

    let wait = estimate_wait_minutes(db, tenant_id, department_id, token_date, ahead.0).await;
    Ok((ahead.0, wait))
}

pub async fn create_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateTokenRequest>,
) -> Result<Json<CreateTokenResponse>, (StatusCode, String)> {
    require(&claims, tv_displays::TOKENS)?;
    let today = Utc::now().date_naive();
    let priority = req.priority.as_deref().unwrap_or("normal");

    // Get department code for token prefix
    let dept_row: Option<(String,)> =
        sqlx::query_as("SELECT code FROM departments WHERE id = $1 AND tenant_id = $2")
            .bind(req.department_id)
            .bind(claims.tenant_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let dept_code = dept_row.map_or_else(|| "TKN".to_string(), |r| r.0);

    // Get next sequence number atomically
    let next_seq: (i32,) = sqlx::query_as(
        r"
        SELECT COALESCE(MAX(token_seq), 0) + 1
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
        ",
    )
    .bind(claims.tenant_id)
    .bind(req.department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let token_number = format!("{}-{:03}", dept_code, next_seq.0);

    // Insert the token
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        INSERT INTO queue_tokens (
            tenant_id, token_date, token_seq, token_number,
            patient_id, department_id, doctor_id, status, priority
        )
        -- $8 is cast explicitly: Postgres accepts an unknown-typed literal for
        -- an enum column, but not a parameter sqlx has typed as text, so this
        -- INSERT rejected every token before the cast was added.
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting', $8::queue_priority)
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority::text,
                  called_at, completed_at, created_at
        ",
    )
    .bind(claims.tenant_id)
    .bind(today)
    .bind(next_seq.0)
    .bind(&token_number)
    .bind(req.patient_id)
    .bind(req.department_id)
    .bind(req.doctor_id)
    .bind(priority)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (ahead, estimated_wait) = position_and_wait(
        &state.db,
        claims.tenant_id,
        req.department_id,
        today,
        next_seq.0,
        priority,
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get department name
    let dept_name: (String,) = sqlx::query_as("SELECT name FROM departments WHERE id = $1")
        .bind(req.department_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Broadcast queue update
    broadcast_queue_update(
        &state.queue_broadcaster,
        &state.db,
        claims.tenant_id,
        req.department_id,
    )
    .await;

    Ok(Json(CreateTokenResponse {
        id: token.id,
        token_number: token.token_number,
        department_name: dept_name.0,
        queue_position: i32::try_from(ahead).unwrap_or(i32::MAX).saturating_add(1),
        estimated_wait_minutes: estimated_wait,
    }))
}

/// GET /api/tv/tokens
/// List queue tokens with optional filters.
pub async fn list_tokens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListTokensQuery>,
) -> Result<Json<Vec<QueueToken>>, (StatusCode, String)> {
    require(&claims, tv_displays::TOKENS)?;
    let date = query.date.unwrap_or_else(|| Utc::now().date_naive());

    let tokens = sqlx::query_as::<_, QueueToken>(
        r"
        SELECT id, tenant_id, token_date, token_seq, token_number,
               patient_id, department_id, doctor_id, status, priority::text,
               called_at, completed_at, created_at
        FROM queue_tokens
        WHERE tenant_id = $1
          AND token_date = $2
          AND ($3::uuid IS NULL OR department_id = $3)
          AND ($4::text IS NULL OR status = $4)
        ORDER BY priority DESC, token_seq ASC
        ",
    )
    .bind(claims.tenant_id)
    .bind(date)
    .bind(query.department_id)
    .bind(query.status)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(tokens))
}

/// POST /api/tv/tokens/{id}/call
/// Call a token (mark as called).
pub async fn call_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QueueToken>, (StatusCode, String)> {
    require(&claims, tv_displays::TOKENS)?;
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        UPDATE queue_tokens
        SET status = 'called', called_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority::text,
                  called_at, completed_at, created_at
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Token not found".to_string()))?;

    // Broadcast the update
    broadcast_queue_update(
        &state.queue_broadcaster,
        &state.db,
        claims.tenant_id,
        token.department_id,
    )
    .await;

    Ok(Json(token))
}

/// POST /api/tv/tokens/{id}/complete
/// Mark a token as completed.
pub async fn complete_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QueueToken>, (StatusCode, String)> {
    require(&claims, tv_displays::TOKENS)?;
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        UPDATE queue_tokens
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority::text,
                  called_at, completed_at, created_at
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Token not found".to_string()))?;

    // Broadcast the update
    broadcast_queue_update(
        &state.queue_broadcaster,
        &state.db,
        claims.tenant_id,
        token.department_id,
    )
    .await;

    Ok(Json(token))
}

/// POST /api/tv/tokens/{id}/no-show
/// Mark a token as no-show.
pub async fn no_show_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QueueToken>, (StatusCode, String)> {
    require(&claims, tv_displays::TOKENS)?;
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        UPDATE queue_tokens
        SET status = 'no_show', completed_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority::text,
                  called_at, completed_at, created_at
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Token not found".to_string()))?;

    // Broadcast the update
    broadcast_queue_update(
        &state.queue_broadcaster,
        &state.db,
        claims.tenant_id,
        token.department_id,
    )
    .await;

    Ok(Json(token))
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue State Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// GET /`api/tv/queue/{department_id`}
/// Get current queue state for a department.
pub async fn get_queue_state(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(department_id): Path<Uuid>,
) -> Result<Json<DepartmentQueueState>, (StatusCode, String)> {
    let today = Utc::now().date_naive();

    // Get department name
    let dept: (String,) =
        sqlx::query_as("SELECT name FROM departments WHERE id = $1 AND tenant_id = $2")
            .bind(department_id)
            .bind(claims.tenant_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .ok_or((StatusCode::NOT_FOUND, "Department not found".to_string()))?;

    // Get waiting tokens
    let waiting_tokens =
        get_queue_tokens(&state.db, claims.tenant_id, department_id, today, "waiting").await?;

    // Get called/in_progress token (current)
    let current_tokens =
        get_queue_tokens(&state.db, claims.tenant_id, department_id, today, "called").await?;

    // Get counts
    let waiting_count: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(*) FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3 AND status = 'waiting'
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let completed_count: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(*) FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3 AND status = 'completed'
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(DepartmentQueueState {
        department_id,
        department_name: dept.0,
        current_token: current_tokens.into_iter().next(),
        next_tokens: waiting_tokens,
        waiting_count: waiting_count.0 as i32,
        completed_count: completed_count.0 as i32,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Announcement Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// POST /api/tv/announcements
/// Broadcast an announcement to displays.
pub async fn broadcast_announcement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<BroadcastAnnouncementRequest>,
) -> Result<Json<AnnouncementEvent>, (StatusCode, String)> {
    require(&claims, tv_displays::BROADCAST)?;
    // Store in database
    let id = Uuid::new_v4();
    sqlx::query(
        r"
        INSERT INTO tv_announcements (id, tenant_id, message, priority, display_ids, ends_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&req.message)
    .bind(&req.priority)
    .bind(&req.display_ids)
    .bind(req.ends_at)
    .bind(claims.sub)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let event = AnnouncementEvent {
        id,
        message: req.message,
        priority: req.priority,
        created_at: Utc::now(),
    };

    // Broadcast via WebSocket
    state
        .queue_broadcaster
        .broadcast_announcement(event.clone());

    Ok(Json(event))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/// Get queue tokens for a department with specific status.
async fn get_queue_tokens(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    department_id: Uuid,
    date: NaiveDate,
    status: &str,
) -> Result<Vec<QueueTokenInfo>, (StatusCode, String)> {
    #[derive(FromRow)]
    struct TokenRow {
        token_number: String,
        department_name: String,
        doctor_name: Option<String>,
        status: String,
        called_at: Option<chrono::DateTime<Utc>>,
    }

    let rows = sqlx::query_as::<_, TokenRow>(
        r"
        SELECT
            qt.token_number,
            d.name as department_name,
            u.full_name as doctor_name,
            qt.status,
            qt.called_at
        FROM queue_tokens qt
        JOIN departments d ON d.id = qt.department_id
        LEFT JOIN users u ON u.id = qt.doctor_id
        WHERE qt.tenant_id = $1
          AND qt.department_id = $2
          AND qt.token_date = $3
          AND qt.status = $4
        ORDER BY qt.priority DESC, qt.token_seq ASC
        LIMIT 20
        ",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(date)
    .bind(status)
    .fetch_all(db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(rows
        .into_iter()
        .map(|r| QueueTokenInfo {
            token_number: r.token_number,
            patient_name: TOKEN_ONLY_QUEUE_PATIENT_NAME.to_owned(),
            department_name: r.department_name,
            doctor_name: r.doctor_name,
            status: r.status,
            counter: None,
            called_at: r.called_at,
        })
        .collect())
}

/// Broadcast a queue update event via WebSocket.
async fn broadcast_queue_update(
    broadcaster: &QueueBroadcaster,
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    department_id: Uuid,
) {
    let today = Utc::now().date_naive();

    // Get current queue state
    let waiting = get_queue_tokens(db, tenant_id, department_id, today, "waiting")
        .await
        .unwrap_or_default();
    let called = get_queue_tokens(db, tenant_id, department_id, today, "called")
        .await
        .unwrap_or_default();

    // Get counts
    let waiting_count: i32 = sqlx::query_scalar(
        r"SELECT COUNT(*)::int FROM queue_tokens
           WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3 AND status = 'waiting'",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(db)
    .await
    .unwrap_or(0);

    let completed_count: i32 = sqlx::query_scalar(
        r"SELECT COUNT(*)::int FROM queue_tokens
           WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3 AND status = 'completed'",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(db)
    .await
    .unwrap_or(0);

    let event = QueueEvent::QueueUpdate {
        department_id,
        current_token: called.into_iter().next(),
        next_tokens: waiting,
        waiting_count,
        completed_count,
    };

    broadcaster
        .broadcast_queue_event(department_id, event)
        .await;
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialty Queue Display Types & Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// Pharmacy queue token for display.
#[derive(Clone, Debug, Serialize)]
pub struct PharmacyQueueToken {
    pub token_number: String,
    pub patient_name: String,
    pub prescription_count: i32,
    pub status: String,
    pub counter: Option<i32>,
    pub estimated_wait_minutes: Option<i32>,
}

/// Pharmacy queue statistics.
#[derive(Debug, Serialize)]
pub struct PharmacyQueueStats {
    pub waiting_count: i32,
    pub preparing_count: i32,
    pub ready_count: i32,
    pub dispensed_today: i32,
    pub avg_wait_minutes: i32,
}

/// Pharmacy queue display data.
#[derive(Debug, Serialize)]
pub struct PharmacyQueueDisplay {
    pub current_token: Option<PharmacyQueueToken>,
    pub preparing: Vec<PharmacyQueueToken>,
    pub ready_for_pickup: Vec<PharmacyQueueToken>,
    pub waiting: Vec<PharmacyQueueToken>,
    pub stats: PharmacyQueueStats,
}

#[derive(Debug, FromRow)]
struct PharmacyQueueSourceRow {
    id: Uuid,
    prescription_count: i64,
    queued_at: chrono::DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct PharmacyQueueStatsRow {
    waiting_count: i64,
    preparing_count: i64,
    ready_count: i64,
    dispensed_today: i64,
    avg_wait_minutes: Option<i32>,
}

/// Lab queue token for display.
#[derive(Debug, Serialize)]
pub struct LabQueueToken {
    pub token_number: String,
    pub patient_name: String,
    pub test_count: i32,
    pub is_fasting: bool,
    pub is_pediatric: bool,
    pub status: String,
    pub counter: Option<i32>,
}

/// Lab queue statistics.
#[derive(Debug, Serialize)]
pub struct LabQueueStats {
    pub waiting_count: i32,
    pub collected_today: i32,
    pub avg_wait_minutes: i32,
    pub counters_active: i32,
}

/// Lab queue display data.
#[derive(Debug, Serialize)]
pub struct LabQueueDisplay {
    pub current_tokens: Vec<LabQueueToken>,
    pub waiting: Vec<LabQueueToken>,
    pub collection_in_progress: Vec<LabQueueToken>,
    pub stats: LabQueueStats,
}

/// Radiology queue token for display.
#[derive(Debug, Serialize)]
pub struct RadiologyQueueToken {
    pub token_number: String,
    pub patient_name: String,
    pub modality: String,
    pub room_number: String,
    pub status: String,
    pub preparation_instructions: Option<String>,
}

/// Radiology queue statistics.
#[derive(Debug, Serialize)]
pub struct RadiologyQueueStats {
    pub waiting_count: i32,
    pub completed_today: i32,
    pub avg_scan_minutes: i32,
}

/// Radiology queue display data.
#[derive(Debug, Serialize)]
pub struct RadiologyQueueDisplay {
    pub modality: String,
    pub room_number: String,
    pub current_token: Option<RadiologyQueueToken>,
    pub waiting: Vec<RadiologyQueueToken>,
    pub stats: RadiologyQueueStats,
}

/// ER triage levels per Manchester Triage System.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TriageLevel {
    Red,    // Immediate (0 min target)
    Orange, // Very urgent (10 min target)
    Yellow, // Urgent (60 min target)
    Green,  // Standard (120 min target)
    Blue,   // Non-urgent (240 min target)
}

/// ER triage queue token (privacy-safe - no names on display).
#[derive(Debug, Serialize)]
pub struct ErTriageToken {
    pub token_number: String,
    pub triage_level: TriageLevel,
    pub waiting_minutes: i32,
    pub target_wait_minutes: i32,
    pub is_overdue: bool,
}

/// ER queue display data.
#[derive(Debug, Serialize)]
pub struct ErQueueDisplay {
    pub red: Vec<ErTriageToken>,
    pub orange: Vec<ErTriageToken>,
    pub yellow: Vec<ErTriageToken>,
    pub green: Vec<ErTriageToken>,
    pub blue: Vec<ErTriageToken>,
    pub resuscitation_bays_available: i32,
    pub total_waiting: i32,
}

#[derive(Debug, FromRow)]
struct ErQueueSourceRow {
    visit_number: String,
    triage_level: String,
    arrival_time: chrono::DateTime<Utc>,
}

/// Billing queue token for display.
#[derive(Debug, Serialize)]
pub struct BillingQueueToken {
    pub token_number: String,
    pub patient_name: String,
    pub queue_type: String,
    pub counter: Option<i32>,
    pub status: String,
}

/// Billing queue display data.
#[derive(Debug, Serialize)]
pub struct BillingQueueDisplay {
    pub opd_billing: Vec<BillingQueueToken>,
    pub ipd_discharge: Vec<BillingQueueToken>,
    pub advance_deposit: Vec<BillingQueueToken>,
    pub insurance_desk: Vec<BillingQueueToken>,
}

#[derive(Debug, FromRow)]
struct BillingQueueSourceRow {
    id: Uuid,
    queue_type: String,
    status: String,
}

/// Bed waiting entry for IPD public displays. Patient identity is token-only.
#[derive(Debug, Serialize)]
pub struct BedWaitingEntry {
    pub patient_name: String,
    pub ward_type: String,
    pub priority: String,
    pub wait_time_minutes: i32,
    pub status: String,
}

/// Bed availability display data.
#[derive(Debug, Serialize)]
pub struct BedAvailabilityDisplay {
    pub ward_type: String,
    pub total_beds: i32,
    pub occupied: i32,
    pub available: i32,
    pub waiting_list: Vec<BedWaitingEntry>,
}

#[derive(Debug, FromRow)]
struct BedAvailabilityStatsRow {
    total_beds: i64,
    available: i64,
}

#[derive(Debug, FromRow)]
struct BedWaitingSourceRow {
    ward_type: String,
    priority: String,
    wait_time_minutes: i32,
    status: String,
}

/// Queue analytics for a department.
#[derive(Debug, Serialize)]
pub struct QueueAnalytics {
    pub department_name: String,
    pub date: NaiveDate,
    pub total_tokens: i32,
    pub completed: i32,
    pub no_shows: i32,
    pub avg_wait_minutes: i32,
    pub peak_hour: i32,
    pub peak_hour_count: i32,
}

/// Real-time queue metrics.
#[derive(Debug, Serialize)]
pub struct QueueMetrics {
    pub current_waiting: i32,
    pub avg_wait_minutes: i32,
    pub throughput_per_hour: f32,
    pub estimated_wait_new_token: i32,
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialty Queue Display Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// GET /api/tv/queue/pharmacy
/// Get pharmacy queue display data. The TV surface is intentionally
/// token-only: no patient names are returned because waiting-area
/// displays must not expose PHI.
pub async fn get_pharmacy_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PharmacyQueueDisplay>, (StatusCode, String)> {
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let waiting_rows = sqlx::query_as::<_, PharmacyQueueSourceRow>(
        r"
        SELECT pr.id,
               COALESCE((
                   SELECT COUNT(*)
                   FROM prescription_items pi
                   WHERE pi.tenant_id = pr.tenant_id
                     AND pi.prescription_id = pr.prescription_id
                     AND COALESCE(pi.item_status, 'active') = 'active'
               ), 0)::bigint AS prescription_count,
               pr.received_at AS queued_at
        FROM pharmacy_prescriptions pr
        WHERE pr.tenant_id = $1
          AND pr.pharmacy_order_id IS NULL
          AND pr.status::text IN ('pending_review', 'on_hold', 'approved')
        ORDER BY
          CASE pr.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
          pr.received_at ASC
        LIMIT 40
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let preparing_rows = sqlx::query_as::<_, PharmacyQueueSourceRow>(
        r"
        SELECT po.id,
               COALESCE((
                   SELECT COUNT(*)
                   FROM pharmacy_order_items poi
                   WHERE poi.tenant_id = po.tenant_id
                     AND poi.order_id = po.id
                     AND poi.removed_at IS NULL
               ), 0)::bigint AS prescription_count,
               po.created_at AS queued_at
        FROM pharmacy_orders po
        WHERE po.tenant_id = $1
          AND po.status = 'ordered'
        ORDER BY po.created_at ASC
        LIMIT 40
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ready_rows = sqlx::query_as::<_, PharmacyQueueSourceRow>(
        r"
        SELECT po.id,
               COALESCE((
                   SELECT COUNT(*)
                   FROM pharmacy_order_items poi
                   WHERE poi.tenant_id = po.tenant_id
                     AND poi.order_id = po.id
                     AND poi.removed_at IS NULL
               ), 0)::bigint AS prescription_count,
               COALESCE(po.dispensed_at, po.updated_at) AS queued_at
        FROM pharmacy_orders po
        WHERE po.tenant_id = $1
          AND po.status = 'dispensed'
          AND (COALESCE(po.dispensed_at, po.updated_at) >= CURRENT_DATE AND COALESCE(po.dispensed_at, po.updated_at) < CURRENT_DATE + 1)
        ORDER BY COALESCE(po.dispensed_at, po.updated_at) DESC
        LIMIT 20
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stats_row = sqlx::query_as::<_, PharmacyQueueStatsRow>(
        r"
        SELECT
          (
            SELECT COUNT(*)
            FROM pharmacy_prescriptions pr
            WHERE pr.tenant_id = $1
              AND pr.pharmacy_order_id IS NULL
              AND pr.status::text IN ('pending_review', 'on_hold', 'approved')
          )::bigint AS waiting_count,
          (
            SELECT COUNT(*)
            FROM pharmacy_orders po
            WHERE po.tenant_id = $1
              AND po.status = 'ordered'
          )::bigint AS preparing_count,
          (
            SELECT COUNT(*)
            FROM pharmacy_orders po
            WHERE po.tenant_id = $1
              AND po.status = 'dispensed'
              AND (COALESCE(po.dispensed_at, po.updated_at) >= CURRENT_DATE AND COALESCE(po.dispensed_at, po.updated_at) < CURRENT_DATE + 1)
          )::bigint AS ready_count,
          (
            SELECT COUNT(*)
            FROM pharmacy_orders po
            WHERE po.tenant_id = $1
              AND po.status = 'dispensed'
              AND (COALESCE(po.dispensed_at, po.updated_at) >= CURRENT_DATE AND COALESCE(po.dispensed_at, po.updated_at) < CURRENT_DATE + 1)
          )::bigint AS dispensed_today,
          (
            SELECT FLOOR(EXTRACT(EPOCH FROM AVG(COALESCE(po.dispensed_at, po.updated_at) - po.created_at)) / 60)::int
            FROM pharmacy_orders po
            WHERE po.tenant_id = $1
              AND po.status = 'dispensed'
              AND (COALESCE(po.dispensed_at, po.updated_at) >= CURRENT_DATE AND COALESCE(po.dispensed_at, po.updated_at) < CURRENT_DATE + 1)
          ) AS avg_wait_minutes
        ",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let prepared_tokens = preparing_rows
        .into_iter()
        .map(|row| pharmacy_queue_token(&row, "preparing"))
        .collect::<Vec<_>>();
    let current_token = prepared_tokens.first().cloned();
    let preparing = prepared_tokens
        .into_iter()
        .skip(usize::from(current_token.is_some()))
        .collect::<Vec<_>>();
    let ready_for_pickup = ready_rows
        .into_iter()
        .map(|row| pharmacy_queue_token(&row, "ready"))
        .collect::<Vec<_>>();
    let waiting = waiting_rows
        .into_iter()
        .map(|row| pharmacy_queue_token(&row, "waiting"))
        .collect::<Vec<_>>();

    Ok(Json(PharmacyQueueDisplay {
        current_token,
        preparing,
        ready_for_pickup,
        waiting,
        stats: PharmacyQueueStats {
            waiting_count: saturating_i64_to_i32(stats_row.waiting_count),
            preparing_count: saturating_i64_to_i32(stats_row.preparing_count),
            ready_count: saturating_i64_to_i32(stats_row.ready_count),
            dispensed_today: saturating_i64_to_i32(stats_row.dispensed_today),
            avg_wait_minutes: stats_row.avg_wait_minutes.unwrap_or(0),
        },
    }))
}

fn pharmacy_queue_token(row: &PharmacyQueueSourceRow, display_status: &str) -> PharmacyQueueToken {
    let waited_minutes = Utc::now()
        .signed_duration_since(row.queued_at)
        .num_minutes()
        .max(0);

    PharmacyQueueToken {
        token_number: format_pharmacy_token(row.id),
        patient_name: TOKEN_ONLY_QUEUE_PATIENT_NAME.to_owned(),
        prescription_count: saturating_i64_to_i32(row.prescription_count),
        status: display_status.to_owned(),
        counter: None,
        estimated_wait_minutes: Some(saturating_i64_to_i32(waited_minutes)),
    }
}

fn format_pharmacy_token(id: Uuid) -> String {
    let stable_id = id.simple().to_string();
    format!("RX-{}", stable_id[..6].to_ascii_uppercase())
}

fn saturating_i64_to_i32(value: i64) -> i32 {
    i32::try_from(value).unwrap_or(if value.is_negative() {
        i32::MIN
    } else {
        i32::MAX
    })
}

/// GET /api/tv/queue/lab
/// Get lab sample collection queue display data.
pub async fn get_lab_queue(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<LabQueueDisplay>, (StatusCode, String)> {
    // Placeholder implementation - would query lab_orders table
    Ok(Json(LabQueueDisplay {
        current_tokens: vec![],
        waiting: vec![],
        collection_in_progress: vec![],
        stats: LabQueueStats {
            waiting_count: 0,
            collected_today: 0,
            avg_wait_minutes: 0,
            counters_active: 0,
        },
    }))
}

/// GET /api/tv/queue/radiology/{modality}
/// Get radiology queue display data by modality (xray, ct, mri, usg).
pub async fn get_radiology_queue(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(modality): Path<String>,
) -> Result<Json<RadiologyQueueDisplay>, (StatusCode, String)> {
    // Placeholder implementation - would query radiology_orders table
    Ok(Json(RadiologyQueueDisplay {
        modality: modality.to_uppercase(),
        room_number: "RAD-01".to_string(),
        current_token: None,
        waiting: vec![],
        stats: RadiologyQueueStats {
            waiting_count: 0,
            completed_today: 0,
            avg_scan_minutes: 0,
        },
    }))
}

/// GET /api/tv/queue/er
/// Get ER triage queue display data.
pub async fn get_er_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ErQueueDisplay>, (StatusCode, String)> {
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let rows = sqlx::query_as::<_, ErQueueSourceRow>(
        r"
        SELECT visit_number,
               triage_level::text AS triage_level,
               arrival_time
        FROM er_visits
        WHERE tenant_id = $1
          AND COALESCE(is_dummy, false) = false
          AND status::text IN ('registered', 'triaged')
          AND triage_level::text IN (
              'immediate',
              'emergent',
              'urgent',
              'less_urgent',
              'non_urgent'
          )
        ORDER BY
          CASE triage_level::text
            WHEN 'immediate' THEN 0
            WHEN 'emergent' THEN 1
            WHEN 'urgent' THEN 2
            WHEN 'less_urgent' THEN 3
            WHEN 'non_urgent' THEN 4
            ELSE 5
          END,
          arrival_time ASC
        LIMIT 100
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let resuscitation_bays_available: i64 = sqlx::query_scalar(
        r"
        SELECT COUNT(*)::bigint
        FROM bed_states bs
        JOIN ward_bed_mappings wbm
          ON wbm.tenant_id = bs.tenant_id
         AND wbm.bed_location_id = bs.location_id
         AND wbm.is_active = true
        JOIN wards w
          ON w.id = wbm.ward_id
         AND w.tenant_id = bs.tenant_id
         AND w.is_active = true
        LEFT JOIN bed_types bt
          ON bt.id = wbm.bed_type_id
         AND bt.tenant_id = wbm.tenant_id
         AND bt.is_active = true
        WHERE bs.tenant_id = $1
          AND bs.status = 'vacant_clean'
          AND (
              lower(w.ward_type) IN ('emergency', 'er', 'casualty', 'resuscitation')
              OR lower(w.name) LIKE '%emergency%'
              OR lower(w.name) LIKE '%resuscitation%'
              OR lower(w.name) LIKE '%casualty%'
              OR lower(COALESCE(bt.name, '')) LIKE '%resuscitation%'
          )
        ",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut display = ErQueueDisplay {
        red: vec![],
        orange: vec![],
        yellow: vec![],
        green: vec![],
        blue: vec![],
        resuscitation_bays_available: saturating_i64_to_i32(resuscitation_bays_available),
        total_waiting: 0,
    };

    let now = Utc::now();
    for row in rows {
        let Some(level) = er_display_triage_level(&row.triage_level) else {
            continue;
        };
        let token = er_triage_token(row, level, now);
        match level {
            TriageLevel::Red => display.red.push(token),
            TriageLevel::Orange => display.orange.push(token),
            TriageLevel::Yellow => display.yellow.push(token),
            TriageLevel::Green => display.green.push(token),
            TriageLevel::Blue => display.blue.push(token),
        }
    }

    display.total_waiting = saturating_i64_to_i32(
        i64::try_from(
            display.red.len()
                + display.orange.len()
                + display.yellow.len()
                + display.green.len()
                + display.blue.len(),
        )
        .unwrap_or(i64::MAX),
    );

    Ok(Json(display))
}

fn er_display_triage_level(level: &str) -> Option<TriageLevel> {
    match level {
        "immediate" => Some(TriageLevel::Red),
        "emergent" => Some(TriageLevel::Orange),
        "urgent" => Some(TriageLevel::Yellow),
        "less_urgent" => Some(TriageLevel::Green),
        "non_urgent" => Some(TriageLevel::Blue),
        _ => None,
    }
}

fn er_target_wait_minutes(level: TriageLevel) -> i32 {
    match level {
        TriageLevel::Red => 0,
        TriageLevel::Orange => 10,
        TriageLevel::Yellow => 60,
        TriageLevel::Green => 120,
        TriageLevel::Blue => 240,
    }
}

fn er_triage_token(
    row: ErQueueSourceRow,
    triage_level: TriageLevel,
    now: chrono::DateTime<Utc>,
) -> ErTriageToken {
    let waiting_minutes = saturating_i64_to_i32(
        now.signed_duration_since(row.arrival_time)
            .num_minutes()
            .max(0),
    );
    let target_wait_minutes = er_target_wait_minutes(triage_level);

    ErTriageToken {
        token_number: row.visit_number,
        triage_level,
        waiting_minutes,
        target_wait_minutes,
        is_overdue: waiting_minutes > target_wait_minutes,
    }
}

/// GET /api/tv/queue/billing
/// Get billing counter queue display data. Waiting-area billing
/// displays are token-only: no patient names or financial amounts.
pub async fn get_billing_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<BillingQueueDisplay>, (StatusCode, String)> {
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let opd_billing_rows = sqlx::query_as::<_, BillingQueueSourceRow>(
        r"
        SELECT id,
               CASE WHEN is_er_deferred THEN 'ER deferred billing' ELSE 'OPD billing' END AS queue_type,
               status::text AS status
        FROM invoices
        WHERE tenant_id = $1
          AND admission_id IS NULL
          AND corporate_id IS NULL
          AND status::text IN ('issued', 'partially_paid')
        ORDER BY COALESCE(issued_at, created_at) ASC
        LIMIT 30
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ipd_discharge_rows = sqlx::query_as::<_, BillingQueueSourceRow>(
        r"
        SELECT id,
               CASE WHEN is_interim THEN 'IPD interim bill' ELSE 'IPD discharge bill' END AS queue_type,
               status::text AS status
        FROM invoices
        WHERE tenant_id = $1
          AND admission_id IS NOT NULL
          AND corporate_id IS NULL
          AND status::text IN ('issued', 'partially_paid')
        ORDER BY COALESCE(issued_at, created_at) ASC
        LIMIT 30
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let insurance_rows = sqlx::query_as::<_, BillingQueueSourceRow>(
        r"
        SELECT id,
               'Insurance desk' AS queue_type,
               status::text AS status
        FROM invoices
        WHERE tenant_id = $1
          AND corporate_id IS NOT NULL
          AND status::text IN ('issued', 'partially_paid')
        ORDER BY COALESCE(issued_at, created_at) ASC
        LIMIT 30
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let advance_rows = sqlx::query_as::<_, BillingQueueSourceRow>(
        r"
        SELECT id,
               'Advance deposit' AS queue_type,
               status::text AS status
        FROM patient_advances
        WHERE tenant_id = $1
          AND status::text = 'active'
          AND (created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + 1)
        ORDER BY created_at DESC
        LIMIT 30
        ",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(BillingQueueDisplay {
        opd_billing: opd_billing_rows
            .into_iter()
            .map(|row| billing_queue_token(row, "BIL"))
            .collect(),
        ipd_discharge: ipd_discharge_rows
            .into_iter()
            .map(|row| billing_queue_token(row, "IPD"))
            .collect(),
        advance_deposit: advance_rows
            .into_iter()
            .map(|row| billing_queue_token(row, "ADV"))
            .collect(),
        insurance_desk: insurance_rows
            .into_iter()
            .map(|row| billing_queue_token(row, "INS"))
            .collect(),
    }))
}

fn billing_queue_token(row: BillingQueueSourceRow, prefix: &str) -> BillingQueueToken {
    BillingQueueToken {
        token_number: format_short_token(prefix, row.id),
        patient_name: TOKEN_ONLY_QUEUE_PATIENT_NAME.to_owned(),
        queue_type: row.queue_type,
        counter: None,
        status: row.status,
    }
}

fn format_short_token(prefix: &str, id: Uuid) -> String {
    let stable_id = id.simple().to_string();
    format!("{prefix}-{}", stable_id[..6].to_ascii_uppercase())
}

/// GET /`api/tv/queue/beds/{ward_type`}
/// Get bed availability and waiting list for a ward type.
pub async fn get_bed_availability(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ward_type): Path<String>,
) -> Result<Json<BedAvailabilityDisplay>, (StatusCode, String)> {
    let ward_type = normalise_tv_ward_type(&ward_type);
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stats = sqlx::query_as::<_, BedAvailabilityStatsRow>(
        r"
        SELECT COUNT(*)::bigint AS total_beds,
               COUNT(*) FILTER (WHERE bs.status::text = 'vacant_clean')::bigint AS available
        FROM ward_bed_mappings wbm
        JOIN wards w
          ON w.id = wbm.ward_id
         AND w.tenant_id = wbm.tenant_id
         AND w.is_active = true
        LEFT JOIN bed_states bs
          ON bs.tenant_id = wbm.tenant_id
         AND bs.location_id = wbm.bed_location_id
        WHERE wbm.tenant_id = $1
          AND wbm.is_active = true
          AND (
              $2 = 'all'
              OR replace(replace(lower(w.ward_type), ' ', '_'), '-', '_') = $2
              OR replace(replace(lower(w.name), ' ', '_'), '-', '_') LIKE '%' || $2 || '%'
          )
        ",
    )
    .bind(claims.tenant_id)
    .bind(&ward_type)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let waiting_rows = sqlx::query_as::<_, BedWaitingSourceRow>(
        r"
        SELECT COALESCE(w.ward_type, $2) AS ward_type,
               CASE
                 WHEN a.is_critical THEN 'critical'
                 ELSE COALESCE(NULLIF(a.priority, ''), 'routine')
               END AS priority,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - a.admitted_at)) / 60)::int AS wait_time_minutes,
               CASE
                 WHEN a.ward_id IS NULL THEN 'awaiting_ward'
                 ELSE 'awaiting_bed'
               END AS status
        FROM admissions a
        JOIN patients p
          ON p.id = a.patient_id
         AND p.tenant_id = a.tenant_id
        LEFT JOIN wards w
          ON w.id = a.ward_id
         AND w.tenant_id = a.tenant_id
         AND w.is_active = true
        WHERE a.tenant_id = $1
          AND COALESCE(a.is_dummy, false) = false
          AND a.status::text = 'admitted'
          AND a.bed_id IS NULL
          AND (
              $2 = 'all'
              OR (
                  w.id IS NOT NULL
                  AND (
                      replace(replace(lower(w.ward_type), ' ', '_'), '-', '_') = $2
                      OR replace(replace(lower(w.name), ' ', '_'), '-', '_') LIKE '%' || $2 || '%'
                  )
              )
          )
        ORDER BY
          a.is_critical DESC,
          CASE COALESCE(NULLIF(a.priority, ''), 'routine')
            WHEN 'critical' THEN 0
            WHEN 'emergency' THEN 1
            WHEN 'urgent' THEN 2
            WHEN 'high' THEN 3
            WHEN 'routine' THEN 4
            ELSE 5
          END,
          a.admitted_at ASC
        LIMIT 20
        ",
    )
    .bind(claims.tenant_id)
    .bind(&ward_type)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let total_beds = saturating_i64_to_i32(stats.total_beds);
    let available = saturating_i64_to_i32(stats.available);

    Ok(Json(BedAvailabilityDisplay {
        ward_type,
        total_beds,
        occupied: total_beds.saturating_sub(available),
        available,
        waiting_list: waiting_rows.into_iter().map(bed_waiting_entry).collect(),
    }))
}

fn bed_waiting_entry(row: BedWaitingSourceRow) -> BedWaitingEntry {
    BedWaitingEntry {
        patient_name: TOKEN_ONLY_QUEUE_PATIENT_NAME.to_owned(),
        ward_type: row.ward_type,
        priority: row.priority,
        wait_time_minutes: row.wait_time_minutes,
        status: row.status,
    }
}

fn normalise_tv_ward_type(value: &str) -> String {
    let mut normalised = String::new();
    let mut last_was_separator = true;

    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            normalised.push(ch.to_ascii_lowercase());
            last_was_separator = false;
        } else if !last_was_separator {
            normalised.push('_');
            last_was_separator = true;
        }
    }

    while normalised.ends_with('_') {
        normalised.pop();
    }

    if normalised.is_empty() {
        "general".to_owned()
    } else {
        normalised
    }
}

/// GET /`api/tv/queue/analytics/{department_id`}
/// Get queue analytics for a department.
pub async fn get_queue_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(department_id): Path<Uuid>,
) -> Result<Json<QueueAnalytics>, (StatusCode, String)> {
    let today = Utc::now().date_naive();

    // Get department name
    let dept: Option<(String,)> =
        sqlx::query_as("SELECT name FROM departments WHERE id = $1 AND tenant_id = $2")
            .bind(department_id)
            .bind(claims.tenant_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let dept_name = dept.map_or_else(|| "Unknown".to_string(), |d| d.0);

    // Get today's stats
    let stats: (i64, i64, i64) = sqlx::query_as(
        r"
        SELECT
            COUNT(*)::bigint as total,
            COUNT(*) FILTER (WHERE status = 'completed')::bigint as completed,
            COUNT(*) FILTER (WHERE status = 'no_show')::bigint as no_shows
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Calculate average wait time
    let avg_wait: Option<f64> = sqlx::query_scalar(
        r"
        SELECT AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60)::float8
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
          AND called_at IS NOT NULL
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get peak hour
    let peak: Option<(i32, i64)> = sqlx::query_as(
        r"
        SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::bigint as cnt
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
        GROUP BY hour
        ORDER BY cnt DESC
        LIMIT 1
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(QueueAnalytics {
        department_name: dept_name,
        date: today,
        total_tokens: stats.0 as i32,
        completed: stats.1 as i32,
        no_shows: stats.2 as i32,
        avg_wait_minutes: avg_wait.unwrap_or(0.0) as i32,
        peak_hour: peak.as_ref().map_or(9, |p| p.0),
        peak_hour_count: peak.as_ref().map_or(0, |p| p.1 as i32),
    }))
}

/// GET /`api/tv/queue/metrics/{department_id`}
/// Get real-time queue metrics for a department.
pub async fn get_queue_metrics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(department_id): Path<Uuid>,
) -> Result<Json<QueueMetrics>, (StatusCode, String)> {
    let today = Utc::now().date_naive();

    // Get current waiting count
    let waiting: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(*)::bigint
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3 AND status = 'waiting'
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Calculate average wait time for completed tokens
    let avg_wait: Option<f64> = sqlx::query_scalar(
        r"
        SELECT AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60)::float8
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
          AND called_at IS NOT NULL
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Calculate throughput (completions per hour in last 2 hours)
    let throughput: Option<f64> = sqlx::query_scalar(
        r"
        SELECT (COUNT(*)::float8 / 2.0)
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
          AND status = 'completed'
          AND completed_at > NOW() - INTERVAL '2 hours'
        ",
    )
    .bind(claims.tenant_id)
    .bind(department_id)
    .bind(today)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let avg = avg_wait.unwrap_or(15.0);
    let tput = throughput.unwrap_or(5.0);

    // Estimate wait for new token: waiting_count * avg_wait / throughput_per_hour * 60
    let estimated = if tput > 0.0 {
        ((waiting.0 as f64) / tput * 60.0) as i32
    } else {
        (waiting.0 as i32) * 5
    };

    Ok(Json(QueueMetrics {
        current_waiting: waiting.0 as i32,
        avg_wait_minutes: avg as i32,
        throughput_per_hour: tput as f32,
        estimated_wait_new_token: estimated,
    }))
}

/// TV displays / token boards routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/tv/displays",
            get(list_displays).post(create_display),
        )
        .route(
            "/api/tv/displays/{id}",
            get(get_display)
                .put(update_display)
                .delete(delete_display),
        )
        .route(
            "/api/tv/tokens",
            get(list_tokens).post(create_token),
        )
        .route(
            "/api/tv/tokens/{id}/call",
            post(call_token),
        )
        .route(
            "/api/tv/tokens/{id}/complete",
            post(complete_token),
        )
        .route(
            "/api/tv/tokens/{id}/no-show",
            post(no_show_token),
        )
        .route(
            "/api/tv/queue/{department_id}",
            get(get_queue_state),
        )
        .route(
            "/api/tv/announcements",
            post(broadcast_announcement),
        )
        .route(
            "/api/tv/queue/pharmacy",
            get(get_pharmacy_queue),
        )
        .route(
            "/api/tv/queue/lab",
            get(get_lab_queue),
        )
        .route(
            "/api/tv/queue/radiology/{modality}",
            get(get_radiology_queue),
        )
        .route(
            "/api/tv/queue/er",
            get(get_er_queue),
        )
        .route(
            "/api/tv/queue/billing",
            get(get_billing_queue),
        )
        .route(
            "/api/tv/queue/beds/{ward_type}",
            get(get_bed_availability),
        )
        .route(
            "/api/tv/queue/analytics/{department_id}",
            get(get_queue_analytics),
        )
        .route(
            "/api/tv/queue/metrics/{department_id}",
            get(get_queue_metrics),
        )
}

#[cfg(test)]
mod permission_tests {
    use super::tv_displays;

    /// The TV board handlers were gated in the UI (`P.ADMIN.TV_DISPLAYS.*`) but
    /// not on the server, so any authenticated role could delete a display,
    /// broadcast hospital-wide, or call/no-show queue tokens. These codes must
    /// stay byte-identical to `packages/types/src/permissions.ts` — a rename on
    /// either side silently reopens the hole.
    #[test]
    fn codes_match_the_frontend_permission_strings() {
        assert_eq!(tv_displays::LIST, "admin.tv_displays.list");
        assert_eq!(tv_displays::CREATE, "admin.tv_displays.create");
        assert_eq!(tv_displays::UPDATE, "admin.tv_displays.update");
        assert_eq!(tv_displays::DELETE, "admin.tv_displays.delete");
        assert_eq!(tv_displays::TOKENS, "admin.tv_displays.tokens");
        assert_eq!(tv_displays::BROADCAST, "admin.tv_displays.broadcast");
    }
}

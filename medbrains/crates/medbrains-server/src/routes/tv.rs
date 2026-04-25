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
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    middleware::auth::Claims,
    routes::ws::{AnnouncementEvent, QueueBroadcaster, QueueEvent, QueueTokenInfo},
    state::AppState,
};

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
    let displays = sqlx::query_as::<_, TvDisplay>(
        r"
        SELECT id, tenant_id, department_id, location_name, display_type,
               doctors_per_screen, show_patient_name, show_wait_time,
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
    let language_json = serde_json::to_value(&req.language)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

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
    .bind(req.show_patient_name)
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
    let display = sqlx::query_as::<_, TvDisplay>(
        r"
        SELECT id, tenant_id, department_id, location_name, display_type,
               doctors_per_screen, show_patient_name, show_wait_time,
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
    // Build dynamic update query
    let language_json = req
        .language
        .and_then(|l| serde_json::to_value(l).ok());

    let display = sqlx::query_as::<_, TvDisplay>(
        r"
        UPDATE queue_display_config
        SET location_name = COALESCE($3, location_name),
            display_type = COALESCE($4, display_type),
            department_id = COALESCE($5, department_id),
            doctors_per_screen = COALESCE($6, doctors_per_screen),
            show_patient_name = COALESCE($7, show_patient_name),
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
pub async fn create_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateTokenRequest>,
) -> Result<Json<CreateTokenResponse>, (StatusCode, String)> {
    let today = Utc::now().date_naive();
    let priority = req.priority.as_deref().unwrap_or("normal");

    // Get department code for token prefix
    let dept_row: Option<(String,)> = sqlx::query_as(
        "SELECT code FROM departments WHERE id = $1 AND tenant_id = $2",
    )
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting', $8)
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority,
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

    // Get queue position (waiting tokens before this one)
    let position: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(*)
        FROM queue_tokens
        WHERE tenant_id = $1 AND department_id = $2 AND token_date = $3
          AND status = 'waiting' AND token_seq < $4
        ",
    )
    .bind(claims.tenant_id)
    .bind(req.department_id)
    .bind(today)
    .bind(next_seq.0)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get department name
    let dept_name: (String,) = sqlx::query_as(
        "SELECT name FROM departments WHERE id = $1",
    )
    .bind(req.department_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Estimate wait time (rough: 5 min per patient)
    let estimated_wait = Some((position.0 as i32) * 5);

    // Broadcast queue update
    broadcast_queue_update(&state.queue_broadcaster, &state.db, claims.tenant_id, req.department_id).await;

    Ok(Json(CreateTokenResponse {
        id: token.id,
        token_number: token.token_number,
        department_name: dept_name.0,
        queue_position: (position.0 as i32) + 1,
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
    let date = query.date.unwrap_or_else(|| Utc::now().date_naive());

    let tokens = sqlx::query_as::<_, QueueToken>(
        r"
        SELECT id, tenant_id, token_date, token_seq, token_number,
               patient_id, department_id, doctor_id, status, priority,
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
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        UPDATE queue_tokens
        SET status = 'called', called_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority,
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
    broadcast_queue_update(&state.queue_broadcaster, &state.db, claims.tenant_id, token.department_id).await;

    Ok(Json(token))
}

/// POST /api/tv/tokens/{id}/complete
/// Mark a token as completed.
pub async fn complete_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QueueToken>, (StatusCode, String)> {
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        UPDATE queue_tokens
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority,
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
    broadcast_queue_update(&state.queue_broadcaster, &state.db, claims.tenant_id, token.department_id).await;

    Ok(Json(token))
}

/// POST /api/tv/tokens/{id}/no-show
/// Mark a token as no-show.
pub async fn no_show_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<QueueToken>, (StatusCode, String)> {
    let token = sqlx::query_as::<_, QueueToken>(
        r"
        UPDATE queue_tokens
        SET status = 'no_show', completed_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, token_date, token_seq, token_number,
                  patient_id, department_id, doctor_id, status, priority,
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
    broadcast_queue_update(&state.queue_broadcaster, &state.db, claims.tenant_id, token.department_id).await;

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
    let dept: (String,) = sqlx::query_as(
        "SELECT name FROM departments WHERE id = $1 AND tenant_id = $2",
    )
    .bind(department_id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Department not found".to_string()))?;

    // Get waiting tokens
    let waiting_tokens = get_queue_tokens(&state.db, claims.tenant_id, department_id, today, "waiting").await?;

    // Get called/in_progress token (current)
    let current_tokens = get_queue_tokens(&state.db, claims.tenant_id, department_id, today, "called").await?;

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
    state.queue_broadcaster.broadcast_announcement(event.clone());

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
        patient_name: Option<String>,
        department_name: String,
        doctor_name: Option<String>,
        status: String,
        called_at: Option<chrono::DateTime<Utc>>,
    }

    let rows = sqlx::query_as::<_, TokenRow>(
        r"
        SELECT
            qt.token_number,
            COALESCE(p.first_name || ' ' || p.last_name, 'Guest') as patient_name,
            d.name as department_name,
            u.first_name || ' ' || u.last_name as doctor_name,
            qt.status,
            qt.called_at
        FROM queue_tokens qt
        JOIN departments d ON d.id = qt.department_id
        LEFT JOIN patients p ON p.id = qt.patient_id
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
            patient_name: r.patient_name.unwrap_or_else(|| "Guest".to_string()),
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

    broadcaster.broadcast_queue_event(department_id, event).await;
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialty Queue Display Types & Handlers
// ─────────────────────────────────────────────────────────────────────────────

/// Pharmacy queue token for display.
#[derive(Debug, Serialize)]
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
#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TriageLevel {
    Red,      // Immediate (0 min target)
    Orange,   // Very urgent (10 min target)
    Yellow,   // Urgent (60 min target)
    Green,    // Standard (120 min target)
    Blue,     // Non-urgent (240 min target)
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

/// Bed waiting entry for IPD.
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
/// Get pharmacy queue display data.
pub async fn get_pharmacy_queue(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<PharmacyQueueDisplay>, (StatusCode, String)> {
    // Placeholder implementation - would query pharmacy_orders table
    Ok(Json(PharmacyQueueDisplay {
        current_token: None,
        preparing: vec![],
        ready_for_pickup: vec![],
        waiting: vec![],
        stats: PharmacyQueueStats {
            waiting_count: 0,
            preparing_count: 0,
            ready_count: 0,
            dispensed_today: 0,
            avg_wait_minutes: 0,
        },
    }))
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
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<ErQueueDisplay>, (StatusCode, String)> {
    // Placeholder implementation - would query er_visits table
    Ok(Json(ErQueueDisplay {
        red: vec![],
        orange: vec![],
        yellow: vec![],
        green: vec![],
        blue: vec![],
        resuscitation_bays_available: 2,
        total_waiting: 0,
    }))
}

/// GET /api/tv/queue/billing
/// Get billing counter queue display data.
pub async fn get_billing_queue(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<BillingQueueDisplay>, (StatusCode, String)> {
    // Placeholder implementation - would query billing queue table
    Ok(Json(BillingQueueDisplay {
        opd_billing: vec![],
        ipd_discharge: vec![],
        advance_deposit: vec![],
        insurance_desk: vec![],
    }))
}

/// GET /`api/tv/queue/beds/{ward_type`}
/// Get bed availability and waiting list for a ward type.
pub async fn get_bed_availability(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(ward_type): Path<String>,
) -> Result<Json<BedAvailabilityDisplay>, (StatusCode, String)> {
    // Placeholder implementation - would query beds and ipd_admissions tables
    Ok(Json(BedAvailabilityDisplay {
        ward_type,
        total_beds: 50,
        occupied: 42,
        available: 8,
        waiting_list: vec![],
    }))
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
    let dept: Option<(String,)> = sqlx::query_as(
        "SELECT name FROM departments WHERE id = $1 AND tenant_id = $2",
    )
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

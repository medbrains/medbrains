//! Unified multi-module token / queue system — issue, board, and advance
//! ("call / serve / complete / no-show") for any module + scope, with live
//! WebSocket push to displays (TV / web / mobile).

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    routes::ws::QueueEvent,
    state::AppState,
};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Token {
    pub id: Uuid,
    pub module: String,
    pub scope: String,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub number: String,
    pub seq: i32,
    pub status: String,
    pub priority: String,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub counter_label: Option<String>,
    pub called_at: Option<chrono::DateTime<chrono::Utc>>,
    pub served_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub token_date: chrono::NaiveDate,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

const SELECT: &str = "id, module, scope, scope_id, scope_label, number, seq, status, priority, \
     patient_id, patient_name, entity_type, entity_id, counter_label, called_at, served_at, \
     completed_at, token_date, created_at";

fn token_prefix(module: &str) -> &'static str {
    match module {
        "registration" => "R",
        "opd" => "T",
        "pharmacy" => "P",
        "billing" => "B",
        "lab" => "L",
        "radiology" => "X",
        "dispatch" => "D",
        _ => "Q",
    }
}

/// Tokens default ON; an admin disables a module via tenant_settings
/// (category 'tokens', key '<module>_enabled' -> {"enabled": false}) — so
/// "for some days token may not be needed" is a single toggle.
async fn module_tokens_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    module: &str,
) -> Result<bool, AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'tokens' AND key = $2",
    )
    .bind(tenant_id)
    .bind(format!("{module}_enabled"))
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value
        .and_then(|setting| setting.get("enabled").and_then(serde_json::Value::as_bool))
        .unwrap_or(true))
}

/// Fields for auto-issuing a token from a module's trigger handler.
#[derive(Debug)]
pub struct IssueToken<'a> {
    pub module: &'a str,
    pub scope: &'a str,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<&'a str>,
    pub priority: &'a str,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<&'a str>,
    pub entity_type: Option<&'a str>,
    pub entity_id: Option<Uuid>,
    pub issued_by: Option<Uuid>,
}

/// Issue a token inside an existing tenant-scoped transaction (auto-issuance
/// from registration / check-in / order / payment). Silently skips when the
/// module's tokens are disabled. Returns the token number (or None if skipped).
pub async fn issue_token_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    input: IssueToken<'_>,
) -> Result<Option<String>, AppError> {
    if !module_tokens_enabled(tx, tenant_id, input.module).await? {
        return Ok(None);
    }
    let seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM tokens \
         WHERE tenant_id = $1 AND module = $2 AND scope = $3 \
           AND scope_id IS NOT DISTINCT FROM $4 AND token_date = CURRENT_DATE",
    )
    .bind(tenant_id)
    .bind(input.module)
    .bind(input.scope)
    .bind(input.scope_id)
    .fetch_one(&mut **tx)
    .await?;
    let number = format!("{}-{seq:03}", token_prefix(input.module));
    sqlx::query(
        "INSERT INTO tokens \
         (tenant_id, module, scope, scope_id, scope_label, number, seq, priority, \
          patient_id, patient_name, entity_type, entity_id, issued_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
    )
    .bind(tenant_id)
    .bind(input.module)
    .bind(input.scope)
    .bind(input.scope_id)
    .bind(input.scope_label)
    .bind(&number)
    .bind(seq)
    .bind(input.priority)
    .bind(input.patient_id)
    .bind(input.patient_name)
    .bind(input.entity_type)
    .bind(input.entity_id)
    .bind(input.issued_by)
    .execute(&mut **tx)
    .await?;
    Ok(Some(number))
}

/// Issue a token only if the patient has no active (non-terminal) token for this
/// module today. For modules where one record ≠ one queue visit (lab issues a
/// row per test, billing a row per invoice) this keeps it to one token per
/// patient per day. Still gated by module enablement inside `issue_token_in_tx`.
pub async fn issue_token_once_per_patient_day(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    input: IssueToken<'_>,
) -> Result<Option<String>, AppError> {
    if let Some(patient_id) = input.patient_id {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM tokens \
             WHERE tenant_id = $1 AND module = $2 AND patient_id = $3 \
               AND token_date = CURRENT_DATE \
               AND status NOT IN ('completed', 'no_show', 'cancelled'))",
        )
        .bind(tenant_id)
        .bind(input.module)
        .bind(patient_id)
        .fetch_one(&mut **tx)
        .await?;
        if exists {
            return Ok(None);
        }
    }
    issue_token_in_tx(tx, tenant_id, input).await
}

async fn broadcast_status(state: &AppState, token: &Token) {
    if let Some(scope_id) = token.scope_id {
        state
            .queue_broadcaster
            .broadcast_queue_event(
                scope_id,
                QueueEvent::TokenStatusChanged {
                    token_number: token.number.clone(),
                    status: token.status.clone(),
                },
            )
            .await;
    }
}

// ── Issue ────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct IssueTokenInput {
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub priority: Option<String>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
}

/// POST /api/tokens/issue — issue the next token for a module + scope.
pub async fn issue_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueTokenInput>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    let scope = body.scope.unwrap_or_else(|| "department".to_owned());
    let priority = body.priority.unwrap_or_else(|| "normal".to_owned());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    if !module_tokens_enabled(&mut tx, claims.tenant_id, &body.module).await? {
        return Err(AppError::Forbidden);
    }

    let seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM tokens \
         WHERE tenant_id = $1 AND module = $2 AND scope = $3 \
           AND scope_id IS NOT DISTINCT FROM $4 AND token_date = CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .bind(&body.module)
    .bind(&scope)
    .bind(body.scope_id)
    .fetch_one(&mut *tx)
    .await?;

    let number = format!("{}-{seq:03}", token_prefix(&body.module));

    let token = sqlx::query_as::<_, Token>(&format!(
        "INSERT INTO tokens \
         (tenant_id, module, scope, scope_id, scope_label, number, seq, priority, \
          patient_id, patient_name, entity_type, entity_id, issued_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING {SELECT}"
    ))
    .bind(claims.tenant_id)
    .bind(&body.module)
    .bind(&scope)
    .bind(body.scope_id)
    .bind(&body.scope_label)
    .bind(&number)
    .bind(seq)
    .bind(&priority)
    .bind(body.patient_id)
    .bind(&body.patient_name)
    .bind(&body.entity_type)
    .bind(body.entity_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    broadcast_status(&state, &token).await;
    Ok(Json(token))
}

// ── Board ────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct BoardQuery {
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
}

/// GET /api/tokens/board — live tokens (waiting/called/serving) for a board.
pub async fn list_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<BoardQuery>,
) -> Result<Json<Vec<Token>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let tokens = sqlx::query_as::<_, Token>(&format!(
        "SELECT {SELECT} FROM tokens \
         WHERE module = $1 AND token_date = CURRENT_DATE \
           AND ($2::text IS NULL OR scope = $2) \
           AND ($3::uuid IS NULL OR scope_id = $3) \
           AND status IN ('waiting', 'called', 'serving') \
         ORDER BY CASE priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, seq ASC"
    ))
    .bind(&query.module)
    .bind(&query.scope)
    .bind(query.scope_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(tokens))
}

/// GET /api/tokens/mine — a patient's active tokens today (mobile "my token").
pub async fn my_tokens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<MyTokensQuery>,
) -> Result<Json<Vec<Token>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let tokens = sqlx::query_as::<_, Token>(&format!(
        "SELECT {SELECT} FROM tokens \
         WHERE patient_id = $1 AND token_date = CURRENT_DATE \
           AND status IN ('waiting', 'called', 'serving') ORDER BY created_at"
    ))
    .bind(query.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(tokens))
}

#[derive(Debug, Deserialize)]
pub struct MyTokensQuery {
    pub patient_id: Uuid,
}

// ── Advance (call / serve / complete / no-show) ──────────────────
#[derive(Debug, Deserialize)]
pub struct CallTokenInput {
    pub counter_label: Option<String>,
}

const VALID_TOKEN_STATUSES: [&str; 6] =
    ["waiting", "called", "serving", "completed", "no_show", "cancelled"];

async fn transition(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    status: &str,
    counter_label: Option<String>,
) -> Result<Token, AppError> {
    // `status` reaches here from advance_token as an arbitrary client string
    // (tokens.status is a plain text column with no CHECK). Reject anything
    // outside the queue lifecycle so a caller can't set 'foo' or skip states.
    if !VALID_TOKEN_STATUSES.contains(&status) {
        return Err(AppError::BadRequest(format!(
            "Invalid token status '{status}'"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let token = sqlx::query_as::<_, Token>(&format!(
        "UPDATE tokens SET status = $2, \
           called_at = CASE WHEN $2 = 'called' THEN now() ELSE called_at END, \
           called_by = CASE WHEN $2 = 'called' THEN $3 ELSE called_by END, \
           counter_label = COALESCE($4, counter_label), \
           served_at = CASE WHEN $2 = 'serving' THEN now() ELSE served_at END, \
           completed_at = CASE WHEN $2 IN ('completed', 'no_show') THEN now() ELSE completed_at END \
         WHERE id = $1 RETURNING {SELECT}"
    ))
    .bind(id)
    .bind(status)
    .bind(claims.sub)
    .bind(counter_label)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    if status == "called" {
        if let Some(scope_id) = token.scope_id {
            state
                .queue_broadcaster
                .broadcast_queue_event(
                    scope_id,
                    QueueEvent::TokenCalled {
                        token_number: token.number.clone(),
                        patient_name: token.patient_name.clone().unwrap_or_default(),
                        room: token.scope_label.clone(),
                        counter: token.counter_label.clone(),
                    },
                )
                .await;
        }
    } else {
        broadcast_status(state, &token).await;
    }
    Ok(token)
}

/// POST /api/tokens/{id}/call
pub async fn call_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CallTokenInput>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    Ok(Json(transition(&state, &claims, id, "called", body.counter_label).await?))
}

/// POST /api/tokens/{id}/serve
pub async fn serve_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    Ok(Json(transition(&state, &claims, id, "serving", None).await?))
}

/// POST /api/tokens/{id}/complete
pub async fn complete_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    Ok(Json(transition(&state, &claims, id, "completed", None).await?))
}

/// POST /api/tokens/{id}/no-show
pub async fn no_show_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    Ok(Json(transition(&state, &claims, id, "no_show", None).await?))
}

// ── Generic advance + call-next (drives the per-module workflow console) ──
#[derive(Debug, Deserialize)]
pub struct AdvanceTokenInput {
    pub status: String,
    pub counter_label: Option<String>,
}

/// POST /api/tokens/{id}/advance — set any workflow status (the per-module
/// workflow config decides which transitions a role may perform).
pub async fn advance_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdvanceTokenInput>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    Ok(Json(transition(&state, &claims, id, &body.status, body.counter_label).await?))
}

#[derive(Debug, Deserialize)]
pub struct CallNextInput {
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
    pub counter_label: Option<String>,
}

/// POST /api/tokens/call-next — call the next waiting token in a scope (the
/// staff "Call next"); returns null when the queue is empty.
pub async fn call_next(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CallNextInput>,
) -> Result<Json<Option<Token>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let next_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tokens \
         WHERE module = $1 AND token_date = CURRENT_DATE AND status = 'waiting' \
           AND ($2::text IS NULL OR scope = $2) AND ($3::uuid IS NULL OR scope_id = $3) \
         ORDER BY CASE priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, seq ASC \
         LIMIT 1",
    )
    .bind(&body.module)
    .bind(&body.scope)
    .bind(body.scope_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    match next_id {
        Some(id) => {
            let token = transition(&state, &claims, id, "called", body.counter_label).await?;
            Ok(Json(Some(token)))
        }
        None => Ok(Json(None)),
    }
}

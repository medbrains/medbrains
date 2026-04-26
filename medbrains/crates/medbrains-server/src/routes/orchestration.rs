//! HTTP route handlers for the Orchestration Engine.
//!
//! Provides endpoints for:
//! - Event registry browsing
//! - Connector CRUD + health checks
//! - Job queue listing + stats

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::{
    orchestration::{ConnectorRow, EventRegistryRow, JobQueueRow},
    permissions,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    orchestration,
    state::AppState,
};

// ── Request / Response Types ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    pub module: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EventListResponse {
    pub events: Vec<EventRegistryRow>,
    pub total: usize,
}

#[derive(Debug, Deserialize)]
pub struct CreateConnectorRequest {
    pub connector_type: String,
    pub name: String,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub health_check_url: Option<String>,
    pub retry_config: Option<serde_json::Value>,
    pub rate_limit: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConnectorRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub status: Option<String>,
    pub health_check_url: Option<String>,
    pub retry_config: Option<serde_json::Value>,
    pub rate_limit: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListJobsQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct JobListResponse {
    pub jobs: Vec<JobQueueRow>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Serialize)]
pub struct JobStatsResponse {
    pub pending: i64,
    pub running: i64,
    pub completed: i64,
    pub failed: i64,
    pub dead_letter: i64,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct HealthCheckResponse {
    pub connector_id: Uuid,
    pub is_healthy: bool,
}

// ── Event Registry Handlers ─────────────────────────────────

/// GET /api/orchestration/events
pub async fn list_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListEventsQuery>,
) -> Result<Json<EventListResponse>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let events = orchestration::registry::list_events(&state.db, params.module.as_deref()).await?;

    let total = events.len();
    Ok(Json(EventListResponse { events, total }))
}

// ── Connector Handlers ──────────────────────────────────────

/// GET /api/orchestration/connectors
pub async fn list_connectors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ConnectorRow>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let connectors =
        orchestration::connectors::list_connectors(&state.db, claims.tenant_id).await?;

    Ok(Json(connectors))
}

/// POST /api/orchestration/connectors
pub async fn create_connector(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConnectorRequest>,
) -> Result<Json<ConnectorRow>, AppError> {
    require_permission(&claims, permissions::integration::CREATE)?;

    let id = Uuid::new_v4();
    let config = body.config.unwrap_or(serde_json::json!({}));
    let retry_config = body.retry_config.unwrap_or(
        serde_json::json!({"max_retries": 3, "backoff_ms": 1000, "backoff_multiplier": 2}),
    );
    let rate_limit = body
        .rate_limit
        .unwrap_or(serde_json::json!({"requests_per_minute": 60}));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO connectors \
           (id, tenant_id, connector_type, name, description, config, \
            health_check_url, retry_config, rate_limit, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.connector_type)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&config)
    .bind(&body.health_check_url)
    .bind(&retry_config)
    .bind(&rate_limit)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let connector = orchestration::connectors::get_connector(&state.db, id).await?;

    Ok(Json(connector))
}

/// PUT /api/orchestration/connectors/{id}
pub async fn update_connector(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateConnectorRequest>,
) -> Result<Json<ConnectorRow>, AppError> {
    require_permission(&claims, permissions::integration::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Build dynamic UPDATE
    let existing = orchestration::connectors::get_connector(&state.db, id).await?;

    let name = body.name.as_deref().unwrap_or(&existing.name);
    let description = body
        .description
        .as_deref()
        .or(existing.description.as_deref());
    let config = body.config.as_ref().unwrap_or(&existing.config);
    let status = body.status.as_deref().unwrap_or(&existing.status);
    let health_check_url = body
        .health_check_url
        .as_deref()
        .or(existing.health_check_url.as_deref());
    let retry_config = body.retry_config.as_ref().unwrap_or(&existing.retry_config);
    let rate_limit = body.rate_limit.as_ref().unwrap_or(&existing.rate_limit);

    sqlx::query(
        "UPDATE connectors SET \
            name = $2, description = $3, config = $4, status = $5, \
            health_check_url = $6, retry_config = $7, rate_limit = $8 \
         WHERE id = $1",
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(config)
    .bind(status)
    .bind(health_check_url)
    .bind(retry_config)
    .bind(rate_limit)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let updated = orchestration::connectors::get_connector(&state.db, id).await?;

    Ok(Json(updated))
}

/// POST /api/orchestration/connectors/{id}/test
pub async fn test_connector(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<HealthCheckResponse>, AppError> {
    require_permission(&claims, permissions::integration::EXECUTE)?;

    let is_healthy = orchestration::connectors::health_check(&state.db, id).await?;

    Ok(Json(HealthCheckResponse {
        connector_id: id,
        is_healthy,
    }))
}

// ── Job Queue Handlers ──────────────────────────────────────

/// GET /api/orchestration/jobs
pub async fn list_jobs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListJobsQuery>,
) -> Result<Json<JobListResponse>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (jobs, total) = match params.status.as_deref() {
        Some(status) => {
            let jobs = sqlx::query_as::<_, JobQueueRow>(
                "SELECT id, tenant_id, job_type, pipeline_id, execution_id, \
                        connector_id, payload, status, priority, max_retries, \
                        retry_count, next_retry_at, locked_by, locked_at, \
                        started_at, completed_at, error, correlation_id, created_at \
                 FROM job_queue \
                 WHERE tenant_id = $1 AND status = $2 \
                 ORDER BY created_at DESC \
                 LIMIT $3 OFFSET $4",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&mut *tx)
            .await?;

            let total = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM job_queue \
                 WHERE tenant_id = $1 AND status = $2",
            )
            .bind(claims.tenant_id)
            .bind(status)
            .fetch_one(&mut *tx)
            .await?;

            (jobs, total)
        }
        None => {
            let jobs = sqlx::query_as::<_, JobQueueRow>(
                "SELECT id, tenant_id, job_type, pipeline_id, execution_id, \
                        connector_id, payload, status, priority, max_retries, \
                        retry_count, next_retry_at, locked_by, locked_at, \
                        started_at, completed_at, error, correlation_id, created_at \
                 FROM job_queue \
                 WHERE tenant_id = $1 \
                 ORDER BY created_at DESC \
                 LIMIT $2 OFFSET $3",
            )
            .bind(claims.tenant_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&mut *tx)
            .await?;

            let total =
                sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM job_queue WHERE tenant_id = $1")
                    .bind(claims.tenant_id)
                    .fetch_one(&mut *tx)
                    .await?;

            (jobs, total)
        }
    };

    tx.commit().await?;

    Ok(Json(JobListResponse {
        jobs,
        total,
        page,
        per_page,
    }))
}

/// GET /api/orchestration/jobs/stats
pub async fn job_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<JobStatsResponse>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(Debug, sqlx::FromRow)]
    struct StatusCount {
        status: String,
        count: i64,
    }

    let counts = sqlx::query_as::<_, StatusCount>(
        "SELECT status, COUNT(*)::bigint as count \
         FROM job_queue \
         WHERE tenant_id = $1 \
         GROUP BY status",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let mut stats = JobStatsResponse {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        dead_letter: 0,
        total: 0,
    };

    for sc in &counts {
        match sc.status.as_str() {
            "pending" => stats.pending = sc.count,
            "running" => stats.running = sc.count,
            "completed" => stats.completed = sc.count,
            "failed" => stats.failed = sc.count,
            "dead_letter" => stats.dead_letter = sc.count,
            _ => {}
        }
        stats.total += sc.count;
    }

    Ok(Json(stats))
}

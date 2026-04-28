#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::{
    integration::{
        IntegrationExecution, IntegrationNodeTemplate, IntegrationPipeline, PipelineSummary,
    },
    permissions,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Request / Response Types ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPipelinesQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PipelineListResponse {
    pub pipelines: Vec<PipelineSummary>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePipelineRequest {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub trigger_type: String,
    pub trigger_config: Option<serde_json::Value>,
    pub nodes: Option<serde_json::Value>,
    pub edges: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePipelineRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub trigger_type: Option<String>,
    pub trigger_config: Option<serde_json::Value>,
    pub nodes: Option<serde_json::Value>,
    pub edges: Option<serde_json::Value>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePipelineStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct TriggerPipelineRequest {
    pub input_data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListExecutionsQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ExecutionListResponse {
    pub executions: Vec<IntegrationExecution>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateNodeTemplateRequest {
    pub node_type: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub category: String,
    pub config_schema: Option<serde_json::Value>,
    pub default_config: Option<serde_json::Value>,
}

// ── Handlers ─────────────────────────────────────────────

/// GET /api/integration/pipelines
pub async fn list_pipelines(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPipelinesQuery>,
) -> Result<Json<PipelineListResponse>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (filter_clause, bind_status) = params
        .status
        .as_ref()
        .map_or(("", None), |s| ("AND p.status = $4", Some(s.clone())));

    let count_sql = format!(
        "SELECT COUNT(*) FROM integration_pipelines p \
         WHERE p.tenant_id = $1 {filter_clause}"
    );
    let list_sql = format!(
        "SELECT p.id, p.name, p.code, p.description, p.status, \
                p.trigger_type, p.version, \
                (SELECT COUNT(*) FROM integration_executions e WHERE e.pipeline_id = p.id) AS execution_count, \
                (SELECT MAX(e.created_at) FROM integration_executions e WHERE e.pipeline_id = p.id) AS last_run_at, \
                p.created_at, p.updated_at \
         FROM integration_pipelines p \
         WHERE p.tenant_id = $1 {filter_clause} \
         ORDER BY p.updated_at DESC \
         LIMIT $2 OFFSET $3"
    );

    let total: i64 = if let Some(ref status) = bind_status {
        sqlx::query_scalar(&count_sql)
            .bind(claims.tenant_id)
            .bind(status)
            .bind(status)
            .bind(status)
            .fetch_one(&mut *tx)
            .await?
    } else {
        sqlx::query_scalar(&count_sql)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?
    };

    let pipelines: Vec<PipelineSummary> = if let Some(ref status) = bind_status {
        sqlx::query_as::<_, PipelineSummary>(&list_sql)
            .bind(claims.tenant_id)
            .bind(per_page)
            .bind(offset)
            .bind(status)
            .fetch_all(&mut *tx)
            .await?
    } else {
        sqlx::query_as::<_, PipelineSummary>(&list_sql)
            .bind(claims.tenant_id)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&mut *tx)
            .await?
    };

    tx.commit().await?;

    Ok(Json(PipelineListResponse {
        pipelines,
        total,
        page,
        per_page,
    }))
}

/// POST /api/integration/pipelines
pub async fn create_pipeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePipelineRequest>,
) -> Result<Json<IntegrationPipeline>, AppError> {
    require_permission(&claims, permissions::integration::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let empty_obj = serde_json::json!({});
    let empty_arr = serde_json::json!([]);

    let pipeline = sqlx::query_as::<_, IntegrationPipeline>(
        "INSERT INTO integration_pipelines \
           (tenant_id, name, code, description, trigger_type, trigger_config, \
            nodes, edges, metadata, created_by, updated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(&body.description)
    .bind(&body.trigger_type)
    .bind(body.trigger_config.as_ref().unwrap_or(&empty_obj))
    .bind(body.nodes.as_ref().unwrap_or(&empty_arr))
    .bind(body.edges.as_ref().unwrap_or(&empty_arr))
    .bind(body.metadata.as_ref().unwrap_or(&empty_obj))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(pipeline))
}

/// GET /api/integration/pipelines/{id}
pub async fn get_pipeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IntegrationPipeline>, AppError> {
    require_permission(&claims, permissions::integration::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pipeline = sqlx::query_as::<_, IntegrationPipeline>(
        "SELECT * FROM integration_pipelines WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(pipeline))
}

/// PUT /api/integration/pipelines/{id}
pub async fn update_pipeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePipelineRequest>,
) -> Result<Json<IntegrationPipeline>, AppError> {
    require_permission(&claims, permissions::integration::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pipeline = sqlx::query_as::<_, IntegrationPipeline>(
        "UPDATE integration_pipelines SET \
           name = COALESCE($3, name), \
           description = COALESCE($4, description), \
           trigger_type = COALESCE($5, trigger_type), \
           trigger_config = COALESCE($6, trigger_config), \
           nodes = COALESCE($7, nodes), \
           edges = COALESCE($8, edges), \
           metadata = COALESCE($9, metadata), \
           version = version + 1, \
           updated_by = $10 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.trigger_type)
    .bind(&body.trigger_config)
    .bind(&body.nodes)
    .bind(&body.edges)
    .bind(&body.metadata)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(pipeline))
}

/// DELETE /api/integration/pipelines/{id}
pub async fn delete_pipeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::integration::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM integration_pipelines WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

/// PUT /api/integration/pipelines/{id}/status
pub async fn update_pipeline_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePipelineStatusRequest>,
) -> Result<Json<IntegrationPipeline>, AppError> {
    require_permission(&claims, permissions::integration::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let pipeline = sqlx::query_as::<_, IntegrationPipeline>(
        "UPDATE integration_pipelines SET status = $3, updated_by = $4 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(pipeline))
}

/// POST /api/integration/pipelines/{id}/trigger
pub async fn trigger_pipeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<TriggerPipelineRequest>,
) -> Result<Json<IntegrationExecution>, AppError> {
    require_permission(&claims, permissions::integration::EXECUTE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Load pipeline
    let pipeline = sqlx::query_as::<_, IntegrationPipeline>(
        "SELECT * FROM integration_pipelines WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let input = body.input_data.unwrap_or_else(|| serde_json::json!({}));

    // Create execution record
    let exec_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO integration_executions \
           (id, tenant_id, pipeline_id, pipeline_version, trigger_event, \
            status, input_data, triggered_by, started_at) \
         VALUES ($1, $2, $3, $4, 'manual', 'running', $5, $6, now())",
    )
    .bind(exec_id)
    .bind(claims.tenant_id)
    .bind(pipeline.id)
    .bind(pipeline.version)
    .bind(&input)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Execute pipeline by calling emit_event with a synthetic event
    // that matches this pipeline's trigger config
    let event_type = pipeline
        .trigger_config
        .get("event_type")
        .and_then(|v| v.as_str())
        .unwrap_or("manual");

    let _ = crate::events::emit_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        event_type,
        input,
    )
    .await;

    // Fetch the latest execution for this pipeline (emit_event created one)
    let execution = sqlx::query_as::<_, IntegrationExecution>(
        "SELECT * FROM integration_executions \
         WHERE pipeline_id = $1 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(execution))
}

/// GET /api/integration/pipelines/{id}/executions
pub async fn list_executions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pipeline_id): Path<Uuid>,
    Query(params): Query<ListExecutionsQuery>,
) -> Result<Json<ExecutionListResponse>, AppError> {
    require_permission(&claims, permissions::integration::VIEW)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM integration_executions \
         WHERE pipeline_id = $1 AND tenant_id = $2",
    )
    .bind(pipeline_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let executions = sqlx::query_as::<_, IntegrationExecution>(
        "SELECT * FROM integration_executions \
         WHERE pipeline_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC \
         LIMIT $3 OFFSET $4",
    )
    .bind(pipeline_id)
    .bind(claims.tenant_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(ExecutionListResponse {
        executions,
        total,
        page,
        per_page,
    }))
}

/// GET /api/integration/executions/{id}
pub async fn get_execution(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IntegrationExecution>, AppError> {
    require_permission(&claims, permissions::integration::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let execution = sqlx::query_as::<_, IntegrationExecution>(
        "SELECT * FROM integration_executions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    Ok(Json(execution))
}

/// GET /api/integration/node-templates
pub async fn list_node_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<IntegrationNodeTemplate>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let templates = sqlx::query_as::<_, IntegrationNodeTemplate>(
        "SELECT * FROM integration_node_templates \
         WHERE tenant_id IS NULL OR tenant_id = $1 \
         ORDER BY category, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(templates))
}

/// POST /api/integration/node-templates
pub async fn create_node_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNodeTemplateRequest>,
) -> Result<Json<IntegrationNodeTemplate>, AppError> {
    require_permission(&claims, permissions::integration::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let empty_obj = serde_json::json!({});

    let template = sqlx::query_as::<_, IntegrationNodeTemplate>(
        "INSERT INTO integration_node_templates \
           (tenant_id, node_type, code, name, description, icon, color, \
            category, config_schema, default_config) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.node_type)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.icon)
    .bind(&body.color)
    .bind(&body.category)
    .bind(body.config_schema.as_ref().unwrap_or(&empty_obj))
    .bind(body.default_config.as_ref().unwrap_or(&empty_obj))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(template))
}

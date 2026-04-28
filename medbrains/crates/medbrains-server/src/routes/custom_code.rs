//! Custom Code Snippet CRUD + test execution + AI generation routes.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    orchestration::code_executor,
    state::AppState,
};

// ── Types ─────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
pub struct CustomCodeSnippet {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub language: String,
    pub code: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
    pub is_active: bool,
    pub version: i32,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSnippetRequest {
    pub name: String,
    pub description: Option<String>,
    pub language: String,
    pub code: String,
    pub input_schema: Option<serde_json::Value>,
    pub output_schema: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSnippetRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub language: Option<String>,
    pub code: Option<String>,
    pub input_schema: Option<serde_json::Value>,
    pub output_schema: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct TestCodeRequest {
    pub language: String,
    pub code: String,
    pub input: serde_json::Value,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct TestCodeResult {
    pub success: bool,
    pub output: serde_json::Value,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AiGenerateRequest {
    pub prompt: String,
    pub language: String,
    pub input_schema: serde_json::Value,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AiGeneratedCode {
    pub code: String,
    pub output_schema: serde_json::Value,
    pub explanation: String,
}

// ── Handlers ──────────────────────────────────────────────

pub async fn list_snippets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CustomCodeSnippet>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CustomCodeSnippet>(
        "SELECT * FROM custom_code_snippets \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_snippet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateSnippetRequest>,
) -> Result<Json<CustomCodeSnippet>, AppError> {
    require_permission(&claims, permissions::integration::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CustomCodeSnippet>(
        "INSERT INTO custom_code_snippets \
         (tenant_id, name, description, language, code, input_schema, output_schema, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.language)
    .bind(&req.code)
    .bind(req.input_schema.unwrap_or(serde_json::json!({})))
    .bind(req.output_schema.unwrap_or(serde_json::json!({})))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_snippet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CustomCodeSnippet>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CustomCodeSnippet>(
        "SELECT * FROM custom_code_snippets WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_snippet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSnippetRequest>,
) -> Result<Json<CustomCodeSnippet>, AppError> {
    require_permission(&claims, permissions::integration::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CustomCodeSnippet>(
        "UPDATE custom_code_snippets SET \
         name = COALESCE($3, name), \
         description = COALESCE($4, description), \
         language = COALESCE($5, language), \
         code = COALESCE($6, code), \
         input_schema = COALESCE($7, input_schema), \
         output_schema = COALESCE($8, output_schema), \
         version = version + 1 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.language)
    .bind(&req.code)
    .bind(&req.input_schema)
    .bind(&req.output_schema)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn test_code(
    Extension(claims): Extension<Claims>,
    Json(req): Json<TestCodeRequest>,
) -> Result<Json<TestCodeResult>, AppError> {
    require_permission(&claims, permissions::integration::EXECUTE)?;

    let timeout = req.timeout_ms.unwrap_or(5000);
    let start = std::time::Instant::now();

    match code_executor::execute_code(&req.language, &req.code, &req.input, timeout).await {
        Ok(output) => {
            let duration_ms = start.elapsed().as_millis() as u64;
            Ok(Json(TestCodeResult {
                success: true,
                output,
                duration_ms,
                error: None,
            }))
        }
        Err(e) => {
            let duration_ms = start.elapsed().as_millis() as u64;
            Ok(Json(TestCodeResult {
                success: false,
                output: serde_json::Value::Null,
                duration_ms,
                error: Some(format!("{e:#}")),
            }))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CompileRustRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct CompileRustResult {
    pub success: bool,
    pub wasm_base64: Option<String>,
    pub size_bytes: usize,
    pub error: Option<String>,
}

pub async fn compile_rust(
    Extension(claims): Extension<Claims>,
    Json(req): Json<CompileRustRequest>,
) -> Result<Json<CompileRustResult>, AppError> {
    require_permission(&claims, permissions::integration::CREATE)?;

    match code_executor::compile_rust_to_wasm(&req.code).await {
        Ok(wasm_bytes) => {
            use base64::Engine as _;
            let encoded = base64::engine::general_purpose::STANDARD.encode(&wasm_bytes);
            Ok(Json(CompileRustResult {
                success: true,
                size_bytes: wasm_bytes.len(),
                wasm_base64: Some(encoded),
                error: None,
            }))
        }
        Err(e) => Ok(Json(CompileRustResult {
            success: false,
            size_bytes: 0,
            wasm_base64: None,
            error: Some(format!("{e:#}")),
        })),
    }
}

pub async fn ai_generate_code(
    Extension(claims): Extension<Claims>,
    Json(req): Json<AiGenerateRequest>,
) -> Result<Json<AiGeneratedCode>, AppError> {
    require_permission(&claims, permissions::integration::CREATE)?;

    let api_key = std::env::var("ANTHROPIC_API_KEY").map_err(|_| {
        AppError::BadRequest("ANTHROPIC_API_KEY not configured".into())
    })?;

    use rig::client::CompletionClient as _;
    use rig::providers::anthropic;

    let client = anthropic::Client::new(&api_key)
        .map_err(|e| AppError::BadRequest(format!("Failed to create AI client: {e}")))?;

    let preamble = format!(
        "You are writing {} code for a hospital management system pipeline.\n\
         The code runs in a sandboxed environment with access only to the input data.\n\
         Input schema: {}\n\
         {}\n\
         Return valid JSON with three fields:\n\
         - code: the source code as a string\n\
         - output_schema: JSON Schema describing the output\n\
         - explanation: brief description of what the code does",
        req.language,
        serde_json::to_string_pretty(&req.input_schema).unwrap_or_default(),
        req.context.as_deref().unwrap_or(""),
    );

    let extractor = client
        .extractor::<AiGeneratedCode>(anthropic::completion::CLAUDE_SONNET_4_6)
        .preamble(&preamble)
        .build();

    let result = extractor.extract(&req.prompt).await.map_err(|e| {
        AppError::BadRequest(format!("AI generation failed: {e}"))
    })?;

    Ok(Json(result))
}

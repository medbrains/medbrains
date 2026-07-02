//! Shared LLM access for the AI-assisted routes (custom-code generation,
//! LMS course generation).
//!
//! Resolves the AI provider per tenant from `tenant_settings`
//! (category `ai`, key `config` → `{ provider, model, api_key_secret }`),
//! falling back to `ANTHROPIC_API_KEY` from the environment so existing
//! deployments keep working. The API key is resolved through the configured
//! [`SecretResolver`](medbrains_core::secrets::SecretResolver) backend when a
//! `api_key_secret` reference is set, so keys live in the secret store rather
//! than the database or process env.

use axum::{
    Extension, Json,
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
};
use futures::{Stream, StreamExt as _};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::middleware::auth::Claims;
use crate::{error::AppError, state::AppState};

/// Default model when the tenant has not configured one.
const DEFAULT_MODEL: &str = rig::providers::anthropic::completion::CLAUDE_SONNET_4_6;

/// System preamble for the clinical assistant. Safety-framed: suggest, don't
/// order; defer to the treating clinician; never invent clinical data.
const SYSTEM_PROMPT: &str = "You are the MedBrains clinical assistant for hospital staff. \
Be concise and clinically accurate. Do not give definitive diagnoses or treatment orders — \
suggest options and defer to the treating clinician. Cite sources when you have them. If you are \
unsure or lack grounded evidence, say so plainly rather than guessing. Never invent patient data, \
drug doses, or lab values.";

#[derive(Debug)]
struct AiConfig {
    provider: String,
    model: String,
    api_key: String,
    /// Tenant opt-out: `ai.config.assistant_enabled = false` disables the chat
    /// assistant while leaving the extraction features (code/course-gen) working.
    enabled: bool,
}

async fn resolve_config(state: &AppState, tenant_id: &Uuid) -> Result<AiConfig, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    let stored = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'ai' AND key = 'config' AND deleted_at IS NULL",
    )
    .bind(*tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let cfg = stored.unwrap_or_default();
    let str_field = |name: &str| {
        cfg.get(name)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
    };

    let provider = str_field("provider").unwrap_or("anthropic").to_owned();
    let model = str_field("model").unwrap_or(DEFAULT_MODEL).to_owned();
    let enabled = cfg.get("assistant_enabled").and_then(serde_json::Value::as_bool) != Some(false);

    let api_key = match str_field("api_key_secret") {
        Some(secret) => state.secret_resolver.get(secret).await.map_err(|e| {
            AppError::BadRequest(format!("AI key secret '{secret}' unavailable: {e}"))
        })?,
        None => std::env::var("ANTHROPIC_API_KEY").map_err(|_| {
            AppError::BadRequest(
                "No AI provider configured: set tenant ai.config.api_key_secret or ANTHROPIC_API_KEY"
                    .to_owned(),
            )
        })?,
    };

    Ok(AiConfig {
        provider,
        model,
        api_key,
        enabled,
    })
}

/// Run a structured extraction with the tenant's configured AI provider.
///
/// `T` is the schema the model must return; it is extracted type-safely via
/// rig. Returns a `BadRequest` if the provider/key is unconfigured or the model
/// call fails.
pub async fn extract<T>(
    state: &AppState,
    tenant_id: &Uuid,
    preamble: &str,
    prompt: &str,
) -> Result<T, AppError>
where
    T: schemars::JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static,
{
    use rig::client::CompletionClient as _;
    use rig::providers::anthropic;

    let cfg = resolve_config(state, tenant_id).await?;

    match cfg.provider.as_str() {
        "anthropic" => {
            let client = anthropic::Client::new(&cfg.api_key)
                .map_err(|e| AppError::BadRequest(format!("Failed to create AI client: {e}")))?;
            let extractor = client
                .extractor::<T>(cfg.model.as_str())
                .preamble(preamble)
                .build();
            extractor
                .extract(prompt)
                .await
                .map_err(|e| AppError::BadRequest(format!("AI generation failed: {e}")))
        }
        other => Err(AppError::BadRequest(format!(
            "AI provider '{other}' is not supported by this build"
        ))),
    }
}

// ── Streaming chat (RFC-AI-CLINICAL-COPILOT Phase 1) ──────────────────
//
// `POST /api/ai/chat` streams the assistant reply over SSE, riding the normal
// auth/RLS/audit middleware (a WebSocket upgrade would bypass it). Persists both
// turns to `ai_conversations`/`ai_messages` so a thread survives reloads.
//
// Phase 1 sends only the system prompt + the user's own prior turns to the model
// — no auto-injected patient/chart data — so there is no system PHI egress yet.
// Grounding + guarded tools + the PHI-redaction of injected context land in later
// phases. `context` is accepted (for patient/encounter grouping) but not sent.

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub conversation_id: Option<Uuid>,
    pub message: String,
    #[serde(default)]
    pub context: Option<serde_json::Value>,
}

#[derive(sqlx::FromRow)]
struct HistoryRow {
    role: String,
    content: String,
}

/// One SSE frame carrying a JSON payload; falls back to `{}` if serialisation
/// somehow fails (avoids `unwrap`, which clippy denies).
// The `Result<_, Infallible>` wrap is required: it is the `Sse` stream item type.
#[allow(clippy::unnecessary_wraps)]
fn sse(payload: &serde_json::Value) -> Result<Event, std::convert::Infallible> {
    Ok(Event::default()
        .json_data(payload)
        .unwrap_or_else(|_| Event::default().data("{}")))
}

pub async fn chat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, AppError> {
    let message = req.message.trim().to_owned();
    if message.is_empty() {
        return Err(AppError::BadRequest("message must not be empty".to_owned()));
    }

    let cfg = resolve_config(&state, &claims.tenant_id).await?;
    if !cfg.enabled {
        return Err(AppError::Forbidden);
    }
    if cfg.provider != "anthropic" {
        return Err(AppError::BadRequest(format!(
            "AI provider '{}' does not support streaming chat in this build",
            cfg.provider
        )));
    }

    // Persist the user turn + load prior history — owner-scoped, under RLS.
    let tenant_id = claims.tenant_id;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let conversation_id = match req.conversation_id {
        Some(id) => {
            let owner = sqlx::query_scalar::<_, Uuid>(
                "SELECT owner_user_id FROM ai_conversations WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
            match owner {
                Some(o) if o == claims.sub => id,
                Some(_) => return Err(AppError::Forbidden),
                None => return Err(AppError::BadRequest("conversation not found".to_owned())),
            }
        }
        None => {
            let title: String = message.chars().take(60).collect();
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO ai_conversations (tenant_id, owner_user_id, title, model) \
                 VALUES ($1, $2, $3, $4) RETURNING id",
            )
            .bind(tenant_id)
            .bind(claims.sub)
            .bind(&title)
            .bind(&cfg.model)
            .fetch_one(&mut *tx)
            .await?
        }
    };

    let history_rows = sqlx::query_as::<_, HistoryRow>(
        "SELECT role, content FROM ai_messages \
         WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(conversation_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO ai_messages (tenant_id, conversation_id, role, content) \
         VALUES ($1, $2, 'user', $3)",
    )
    .bind(tenant_id)
    .bind(conversation_id)
    .bind(&message)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let history: Vec<rig::completion::Message> = history_rows
        .into_iter()
        .map(|r| match r.role.as_str() {
            "assistant" => rig::completion::Message::assistant(r.content),
            _ => rig::completion::Message::user(r.content),
        })
        .collect();

    let stream = async_stream::stream! {
        use rig::agent::MultiTurnStreamItem;
        use rig::client::CompletionClient as _;
        use rig::providers::anthropic;
        use rig::streaming::{StreamedAssistantContent, StreamingPrompt as _};

        let client = match anthropic::Client::new(&cfg.api_key) {
            Ok(c) => c,
            Err(e) => {
                yield sse(&serde_json::json!({ "type": "error", "message": format!("AI client error: {e}") }));
                return;
            }
        };
        let agent = client.agent(cfg.model.as_str()).preamble(SYSTEM_PROMPT).build();

        let mut answer = String::new();
        let mut chunks = agent.stream_prompt(message.as_str()).with_history(history).await;
        while let Some(item) = chunks.next().await {
            match item {
                Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(t))) => {
                    answer.push_str(&t.text);
                    yield sse(&serde_json::json!({ "type": "text", "text": t.text }));
                }
                Ok(_) => {}
                Err(e) => {
                    yield sse(&serde_json::json!({ "type": "error", "message": e.to_string() }));
                }
            }
        }

        // Persist the assistant turn + bump the conversation timestamp.
        match state.db.begin().await {
            Ok(tx) => {
                if let Err(e) = persist_assistant_turn(tx, &tenant_id, conversation_id, &answer).await {
                    tracing::error!(error = %e, "failed to persist assistant turn");
                }
            }
            Err(e) => tracing::error!(error = %e, "failed to open tx for assistant turn"),
        }

        yield sse(&serde_json::json!({ "type": "done", "conversationId": conversation_id }));
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

/// Write the completed assistant message and touch the conversation, under RLS.
async fn persist_assistant_turn(
    mut tx: sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    conversation_id: Uuid,
    answer: &str,
) -> Result<(), AppError> {
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    sqlx::query(
        "INSERT INTO ai_messages (tenant_id, conversation_id, role, content) \
         VALUES ($1, $2, 'assistant', $3)",
    )
    .bind(tenant_id)
    .bind(conversation_id)
    .bind(answer)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE ai_conversations SET last_message_at = now() WHERE id = $1 AND tenant_id = $2")
        .bind(conversation_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

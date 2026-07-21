//! Shared LLM access for the AI-assisted routes (custom-code generation,
//! LMS course generation, the clinical chat assistant).
//!
//! Resolves the AI provider per tenant from `tenant_settings`
//! (category `ai`, key `config` → `{ provider, model, api_key_secret }`),
//! falling back to `ANTHROPIC_API_KEY` from the environment so existing
//! deployments keep working. The API key is resolved through the configured
//! [`SecretResolver`](medbrains_core::secrets::SecretResolver) backend when a
//! `api_key_secret` reference is set, so keys live in the secret store rather
//! than the database or process env.

use serde::Serialize;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;

/// Default model when the tenant has not configured one.
const DEFAULT_MODEL: &str = rig::providers::anthropic::completion::CLAUDE_SONNET_4_6;

/// Resolved per-tenant AI provider settings.
#[derive(Debug)]
pub struct AiConfig {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    /// Tenant opt-out: `ai.config.assistant_enabled = false` disables the chat
    /// assistant while leaving the extraction features (code/course-gen) working.
    pub enabled: bool,
}

/// Resolve the tenant's AI provider config (provider/model/key/enabled) from
/// `tenant_settings`, with env-var fallbacks so existing deployments keep working.
pub async fn resolve_config(state: &AppState, tenant_id: &Uuid) -> Result<AiConfig, AppError> {
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

    // Provider precedence: tenant config > AI_PROVIDER env > (openrouter if its
    // key is set, else anthropic). Set AI_PROVIDER=ollama for local/private
    // inference (no PHI egress).
    let provider = match str_field("provider") {
        Some(p) => p.to_owned(),
        None => std::env::var("AI_PROVIDER").ok().unwrap_or_else(|| {
            if std::env::var("OPENROUTER_API_KEY").is_ok() {
                "openrouter".to_owned()
            } else {
                "anthropic".to_owned()
            }
        }),
    };
    let default_model = match provider.as_str() {
        "openrouter" => "openai/gpt-4o-mini",
        "bedrock" => "openai.gpt-oss-120b-1:0",
        "ollama" => "llama3.2",
        _ => DEFAULT_MODEL,
    };
    let model = str_field("model")
        .map(str::to_owned)
        .or_else(|| std::env::var("AI_MODEL").ok())
        .unwrap_or_else(|| default_model.to_owned());
    let enabled = cfg.get("assistant_enabled").and_then(serde_json::Value::as_bool) != Some(false);

    // Ollama is keyless (local). Others resolve a key from the secret store or env.
    let api_key = if provider == "ollama" {
        String::new()
    } else {
        match str_field("api_key_secret") {
            Some(secret) => state.secret_resolver.get(secret).await.map_err(|e| {
                AppError::BadRequest(format!("AI key secret '{secret}' unavailable: {e}"))
            })?,
            None => {
                let env_var = match provider.as_str() {
                    "openrouter" => "OPENROUTER_API_KEY",
                    "bedrock" => "BEDROCK_API_KEY",
                    _ => "ANTHROPIC_API_KEY",
                };
                std::env::var(env_var).map_err(|_| {
                    AppError::BadRequest(format!(
                        "No AI provider configured: set tenant ai.config.api_key_secret or {env_var}"
                    ))
                })?
            }
        }
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
    use rig::providers::{anthropic, openai, openrouter};

    let cfg = resolve_config(state, tenant_id).await?;

    // `extractor::<T>()` is a CompletionClient trait method, so the extraction loop is
    // identical across providers — only the client construction differs. The provider is
    // resolved from tenant config / AI_PROVIDER env (openrouter when OPENROUTER_API_KEY is
    // set, else anthropic), so callers stay provider-agnostic.
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
        "openrouter" => {
            let client = openrouter::Client::new(&cfg.api_key)
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
        "bedrock" => {
            // Bedrock's OpenAI-compatible endpoint speaks Chat Completions, and the
            // gpt-oss models there support tool-calling, so rig's OpenAI extractor works
            // when pointed at the Bedrock base URL with the ABSK bearer key. (Anthropic
            // Claude on Bedrock is Marketplace-payment-gated on this account, so gpt-oss
            // is the usable Bedrock family.)
            let region = std::env::var("AWS_REGION")
                .or_else(|_| std::env::var("BEDROCK_REGION"))
                .unwrap_or_else(|_| "us-east-1".to_owned());
            let base_url = std::env::var("BEDROCK_BASE_URL").unwrap_or_else(|_| {
                format!("https://bedrock-runtime.{region}.amazonaws.com/openai/v1")
            });
            let client = openai::CompletionsClient::builder()
                .api_key(&cfg.api_key)
                .base_url(&base_url)
                .build()
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

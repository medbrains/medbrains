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

use serde::Serialize;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

/// Default model when the tenant has not configured one.
const DEFAULT_MODEL: &str = rig::providers::anthropic::completion::CLAUDE_SONNET_4_6;

#[derive(Debug)]
struct AiConfig {
    provider: String,
    model: String,
    api_key: String,
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

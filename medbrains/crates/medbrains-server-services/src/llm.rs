//! Shared LLM access for the AI-assisted routes (custom-code generation,
//! LMS course generation, the clinical chat assistant).
//!
//! Resolves the AI provider per tenant from `tenant_settings`
//! (category `ai`, key `config` → `{ provider, model, api_key_secret }`),
//! then the `AI_PROVIDER` / `AI_MODEL` environment. Anthropic has no API key:
//! its access token comes from workload identity federation with this
//! machine's AWS identity ([`medbrains_anthropic_auth`], see [`anthropic`]).
//! Other providers' keys resolve through the configured
//! [`SecretResolver`](medbrains_core::secrets::SecretResolver) when an
//! `api_key_secret` reference is set, else from their environment variable.

use medbrains_core::ai_redact::Redacted;
use rig::DynModel;
use rig::operation::Completion;
use serde::Serialize;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;

/// Default model when the tenant has not configured one.
const DEFAULT_MODEL: &str = rig::providers::anthropic::CLAUDE_SONNET_4_6;

pub mod anthropic;

/// Resolved per-tenant AI provider settings.
pub struct AiConfig {
    pub provider: String,
    pub model: String,
    /// The provider credential: an API key, or for Anthropic a short-lived
    /// federated access token. Never printed (see the `Debug` impl).
    pub api_key: String,
    /// Tenant opt-out: `ai.config.assistant_enabled = false` disables the chat
    /// assistant while leaving the extraction features (code/course-gen) working.
    pub enabled: bool,
}

impl std::fmt::Debug for AiConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AiConfig")
            .field("provider", &self.provider)
            .field("model", &self.model)
            .field("enabled", &self.enabled)
            .finish_non_exhaustive()
    }
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
    let enabled = cfg
        .get("assistant_enabled")
        .and_then(serde_json::Value::as_bool)
        != Some(false);

    // Ollama is keyless (local); Anthropic is federated (no key exists).
    // Others resolve a key from the secret store or env.
    let api_key = match provider.as_str() {
        "ollama" => String::new(),
        "anthropic" => anthropic::access_token().await?,
        _ => match str_field("api_key_secret") {
            Some(secret) => state.secret_resolver.get(secret).await.map_err(|e| {
                AppError::BadRequest(format!("AI key secret '{secret}' unavailable: {e}"))
            })?,
            None => {
                let env_var = match provider.as_str() {
                    "bedrock" => "BEDROCK_API_KEY",
                    _ => "OPENROUTER_API_KEY",
                };
                std::env::var(env_var).map_err(|_| {
                    AppError::BadRequest(format!(
                        "No AI provider configured: set tenant ai.config.api_key_secret or {env_var}"
                    ))
                })?
            }
        },
    };

    Ok(AiConfig {
        provider,
        model,
        api_key,
        enabled,
    })
}

/// The OpenAI-compatible chat-completions base URL for a provider, or `None`
/// for providers that don't speak the OpenAI wire format natively (anthropic).
///
/// Callers that need raw function-calling (e.g. the simulator's native tool
/// loop) resolve the base here and POST `{base}/chat/completions` themselves.
///
/// # Errors
/// `ServiceUnavailable` when Bedrock is configured for a region outside India.
pub fn openai_compat_base_url(provider: &str) -> Result<Option<String>, AppError> {
    match provider {
        "openrouter" => Ok(Some("https://openrouter.ai/api/v1".to_owned())),
        "bedrock" => bedrock_base_url().map(Some),
        _ => Ok(None),
    }
}

/// The only regions a Bedrock call may go to. Every assistant call can carry
/// patient data, and patient data never leaves India (DPDP s.16).
pub const INDIA_REGIONS: [&str; 2] = ["ap-south-1", "ap-south-2"];

/// Bedrock's OpenAI-compatible base URL, from `BEDROCK_BASE_URL` or
/// `BEDROCK_REGION` (default `ap-south-1`). `AWS_REGION` is deliberately not
/// read: it is set for other AWS work and once sent chats to the US.
///
/// # Errors
/// `ServiceUnavailable` when the region or URL is outside [`INDIA_REGIONS`]:
/// nothing is sent.
pub fn bedrock_base_url() -> Result<String, AppError> {
    let region = std::env::var("BEDROCK_REGION").ok();
    let base = std::env::var("BEDROCK_BASE_URL").ok();
    bedrock_url_from(region.as_deref(), base.as_deref())
        .map_err(|why| AppError::ServiceUnavailable(format!("AI refused: {why}")))
}

/// [`bedrock_base_url`] without the environment, for tests and preflight.
///
/// # Errors
/// Why the region or URL is refused.
pub fn bedrock_url_from(region: Option<&str>, base: Option<&str>) -> Result<String, String> {
    if let Some(base) = base.map(str::trim).filter(|b| !b.is_empty()) {
        let host = base
            .strip_prefix("https://")
            .and_then(|rest| rest.split(['/', ':']).next())
            .unwrap_or_default();
        let in_india = host.ends_with(".amazonaws.com")
            && host.split('.').any(|label| INDIA_REGIONS.contains(&label));
        return if in_india {
            Ok(base.trim_end_matches('/').to_owned())
        } else {
            Err(format!(
                "BEDROCK_BASE_URL must be an https Bedrock endpoint in {} (patient data stays in India)",
                INDIA_REGIONS.join(" or ")
            ))
        };
    }
    let region = region
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .unwrap_or(INDIA_REGIONS[0]);
    if INDIA_REGIONS.contains(&region) {
        Ok(format!(
            "https://bedrock-runtime.{region}.amazonaws.com/openai/v1"
        ))
    } else {
        Err(format!(
            "BEDROCK_REGION={region} is outside India; use {} (patient data stays in India)",
            INDIA_REGIONS.join(" or ")
        ))
    }
}

/// The answer when text could not be made safe for a model: the AI call is
/// refused and nothing is sent. Fail closed, and say so — never fall back to
/// sending the text as it was.
#[must_use]
pub fn unsafe_to_send(err: &medbrains_core::ai_redact::RedactError) -> AppError {
    // The error names only the kind of identifier, never its value; the
    // response's warn log records the refusal.
    AppError::ServiceUnavailable(format!("{AI_UNSAFE} ({err})"))
}

/// What the user is told when an AI call was refused for safety.
pub const AI_UNSAFE: &str =
    "Couldn't run the AI safely, so nothing was sent to it. Carry on without it, or try again.";

/// Redact free text for a one-off model call with no patient in scope.
///
/// # Errors
/// [`unsafe_to_send`] when the text cannot be made safe.
pub fn redact_standalone(text: &str) -> Result<Redacted, AppError> {
    medbrains_core::ai_redact::Redactor::new(
        medbrains_core::ai_redact::PseudonymMap::default(),
        &medbrains_core::ai_redact::KnownIdentifiers::default(),
        chrono::Utc::now().date_naive(),
    )
    .redact(text)
    .map_err(|e| unsafe_to_send(&e))
}

/// Redact text about a subject, not a person (a course topic): identifiers
/// still go, but naming a clinical class (HIV, mental health) is allowed —
/// it is the subject. Never for text taken from a patient's record.
///
/// # Errors
/// [`unsafe_to_send`] when the text cannot be made safe.
pub fn redact_topic(text: &str) -> Result<Redacted, AppError> {
    medbrains_core::ai_redact::Redactor::new(
        medbrains_core::ai_redact::PseudonymMap::default(),
        &medbrains_core::ai_redact::KnownIdentifiers::default(),
        chrono::Utc::now().date_naive(),
    )
    .allowing_clinical_topics()
    .redact(text)
    .map_err(|e| unsafe_to_send(&e))
}

/// Run a structured extraction with the tenant's configured AI provider.
///
/// `T` is the schema the model must return; it is extracted type-safely via
/// rig. Both texts are [`Redacted`]: nothing reaches the model unredacted.
/// Returns a `BadRequest` if the provider/key is unconfigured or the model
/// call fails.
pub async fn extract<T>(
    state: &AppState,
    tenant_id: &Uuid,
    preamble: &Redacted,
    prompt: &Redacted,
) -> Result<T, AppError>
where
    T: schemars::JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static,
{
    let cfg = resolve_config(state, tenant_id).await?;
    let extractor = rig_agent::extractor::ExtractorBuilder::<T>::new(completion_model(&cfg)?)
        .append_preamble(preamble.for_model())
        .max_tokens(u64::from(medbrains_core::ai_guard::MAX_ANSWER_TOKENS))
        .build();
    extractor
        .extract(prompt.for_model())
        .await
        .map(|typed| typed.output)
        .map_err(|e| AppError::BadRequest(format!("AI generation failed: {e}")))
}

/// The one place a model is built. Every provider type stays in this module
/// (and [`anthropic`]): callers get a provider-neutral model and hand it only
/// [`Redacted`] text.
///
/// - `anthropic`: federated bearer, Anthropic's host only, cached prefix.
/// - `bedrock`: the OpenAI-compatible endpoint, refused outside India.
/// - `openrouter`, `ollama`: dev/local.
///
/// # Errors
/// `ServiceUnavailable` for a Bedrock region outside India; `BadRequest` for
/// an unknown provider.
pub fn completion_model(cfg: &AiConfig) -> Result<DynModel<Completion>, AppError> {
    use rig::providers::{ollama::OllamaConfig, openai::OpenAIConfig, openrouter};
    let model = cfg.model.as_str();
    Ok(match cfg.provider.as_str() {
        "anthropic" => anthropic::model(&cfg.api_key, model)?.into(),
        // Bedrock's OpenAI-compatible endpoint speaks Chat Completions (gpt-oss).
        "bedrock" => OpenAIConfig::new(cfg.api_key.clone())
            .with_base_url(bedrock_base_url()?)
            .client()
            .chat(model)
            .into(),
        "openrouter" => openrouter::new(cfg.api_key.clone())
            .completion(model)
            .into(),
        "ollama" => {
            let base = std::env::var("OLLAMA_API_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_owned());
            OllamaConfig::new()
                .with_base_url(base)
                .client()
                .completion(model)
                .into()
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "AI provider '{other}' is not supported by this build"
            )));
        }
    })
}

#[cfg(test)]
mod tests {
    use super::bedrock_url_from;

    #[test]
    fn bedrock_defaults_to_mumbai() {
        assert_eq!(
            bedrock_url_from(None, None).as_deref(),
            Ok("https://bedrock-runtime.ap-south-1.amazonaws.com/openai/v1")
        );
        assert!(bedrock_url_from(Some("ap-south-2"), None).is_ok_and(|u| u.contains("ap-south-2")));
    }

    #[test]
    fn bedrock_refuses_regions_outside_india() {
        assert!(bedrock_url_from(Some("us-east-1"), None).is_err());
        assert!(bedrock_url_from(Some("eu-west-1"), None).is_err());
        let us = "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1";
        assert!(bedrock_url_from(Some("ap-south-1"), Some(us)).is_err());
        assert!(bedrock_url_from(None, Some("https://ap-south-1.evil.example/v1")).is_err());
        assert!(
            bedrock_url_from(
                None,
                Some("http://bedrock-runtime.ap-south-1.amazonaws.com")
            )
            .is_err()
        );
        let vpce = "https://vpce-1.bedrock-runtime.ap-south-1.vpce.amazonaws.com/openai/v1/";
        assert_eq!(
            bedrock_url_from(None, Some(vpce)).as_deref(),
            Ok(vpce.trim_end_matches('/'))
        );
    }
}

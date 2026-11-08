//! Where dictation runs: the hospital's speech-to-text server, its local
//! model, and the cloud transcription service that is off unless an admin
//! turns it on (`tenant_settings` category `dictation`, key `config`).

use axum::Json;
use axum::extract::{Extension, State};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims, Tx};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::address::is_local_url;

/// whisper.cpp's `whisper-server`, started on this port by the setup guide.
const DEFAULT_STT_URL: &str = "http://127.0.0.1:8178";
/// Ollama's default address on the same machine.
const DEFAULT_LLM_URL: &str = "http://127.0.0.1:11434";
const DEFAULT_LLM_MODEL: &str = "llama3.2";
const MAX_FIELD_CHARS: usize = 200;
const MAX_SECRET_NAME_CHARS: usize = 40;

/// The tenant's dictation services. Every field has a default, so a hospital
/// that never opened the settings dictates against its own machine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DictationConfig {
    #[serde(default = "default_stt_url")]
    pub stt_url: String,
    #[serde(default = "default_llm_url")]
    pub llm_url: String,
    #[serde(default = "default_llm_model")]
    pub llm_model: String,
    /// Off unless an admin turns it on: recordings would leave the hospital.
    #[serde(default)]
    pub cloud_enabled: bool,
    /// An OpenAI-compatible `/v1/audio/transcriptions` base, https only.
    #[serde(default)]
    pub cloud_url: Option<String>,
    #[serde(default)]
    pub cloud_model: Option<String>,
    /// A short name (`stt-key`) for the secret holding the cloud key, never
    /// the key itself. It is always read from this tenant's own dictation
    /// namespace ([`cloud_secret_path`]), so it cannot name another secret.
    #[serde(default)]
    pub cloud_api_key_secret: Option<String>,
}

/// serde default for [`DictationConfig::stt_url`].
fn default_stt_url() -> String {
    DEFAULT_STT_URL.to_owned()
}

/// serde default for [`DictationConfig::llm_url`].
fn default_llm_url() -> String {
    DEFAULT_LLM_URL.to_owned()
}

/// serde default for [`DictationConfig::llm_model`].
fn default_llm_model() -> String {
    DEFAULT_LLM_MODEL.to_owned()
}

impl Default for DictationConfig {
    /// The local-only configuration a new hospital starts with.
    fn default() -> Self {
        Self {
            stt_url: default_stt_url(),
            llm_url: default_llm_url(),
            llm_model: default_llm_model(),
            cloud_enabled: false,
            cloud_url: None,
            cloud_model: None,
            cloud_api_key_secret: None,
        }
    }
}

impl DictationConfig {
    /// Refuse a configuration that could not work or would send recordings
    /// somewhere unencrypted.
    ///
    /// # Errors
    /// `BadRequest` naming the field to fix.
    pub fn validate(&self) -> Result<(), AppError> {
        require_local("Speech-to-text address", &self.stt_url)?;
        require_local("Model address", &self.llm_url)?;
        require_name("Model", &self.llm_model)?;
        if let Some(name) = self.cloud_api_key_secret.as_deref() {
            require_secret_name(name)?;
        }
        if self.cloud_enabled {
            let url = self.cloud_url.as_deref().unwrap_or_default();
            require_url("Cloud transcription address", url, true)?;
            if self.cloud_api_key_secret.is_none() {
                return Err(AppError::BadRequest(
                    "Name the cloud key's secret".to_owned(),
                ));
            }
        }
        Ok(())
    }
}

/// Where a tenant's cloud key lives in the secret store: its own dictation
/// namespace, the same shape the payment keys use. Whatever an admin types,
/// only `medbrains/<env>/<tenant>/dictation-<name>` is ever read, so the
/// setting cannot point at the server's own secrets (`DATABASE_URL`, the JWT
/// key) and send them to a host the admin chose.
#[must_use]
pub fn cloud_secret_path(tenant_id: Uuid, name: &str) -> String {
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    format!("medbrains/{env}/{tenant_id}/dictation-{name}")
}

/// A secret's short name: lowercase letters, digits and `-`, nothing that
/// could reach outside the namespace.
fn require_secret_name(name: &str) -> Result<(), AppError> {
    let ok = (1..=MAX_SECRET_NAME_CHARS).contains(&name.len())
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if ok {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "Cloud key secret is a short name (lowercase letters, digits, -), read from this hospital's own dictation secrets".to_owned(),
        ))
    }
}

/// A service on this machine or the hospital's own network.
fn require_local(label: &str, url: &str) -> Result<(), AppError> {
    if url.len() <= MAX_FIELD_CHARS && is_local_url(url) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "{label} must be on this machine or the hospital's own network: an http:// address with a loopback or private IP, or localhost"
        )))
    }
}

/// An http(s) address with a host; `https_only` for anything off the premises.
fn require_url(label: &str, url: &str, https_only: bool) -> Result<(), AppError> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://").filter(|_| !https_only));
    let has_host = rest.is_some_and(|r| !r.split(['/', ':']).next().unwrap_or_default().is_empty());
    if has_host && url.len() <= MAX_FIELD_CHARS {
        return Ok(());
    }
    let scheme = if https_only {
        "https://"
    } else {
        "http:// or https://"
    };
    Err(AppError::BadRequest(format!(
        "{label} must be an {scheme} address"
    )))
}

/// A model or secret name: short, and nothing that could smuggle a path.
fn require_name(label: &str, name: &str) -> Result<(), AppError> {
    let ok = !name.is_empty()
        && name.len() <= MAX_FIELD_CHARS
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':' | '/'));
    if ok {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "{label} is required (letters, digits, . - _ : /)"
        )))
    }
}

/// The tenant's configuration, or the local defaults when none is stored.
///
/// A stored value that does not parse or does not pass [`DictationConfig::validate`]
/// (written past the dictation screen, or by an older version) fails closed:
/// the local defaults, cloud off, and a warning in the log. It never sends a
/// recording to an address that was not checked.
///
/// # Errors
/// The database read.
pub async fn load(tx: &mut Tx) -> Result<DictationConfig, AppError> {
    let stored = match medbrains_kernel::config::get(tx, "dictation/config").await? {
        None | Some(serde_json::Value::Null) => return Ok(DictationConfig::default()),
        Some(value) => serde_json::from_value::<DictationConfig>(value),
    };
    match stored {
        Ok(config) if config.validate().is_ok() => Ok(config),
        _ => {
            tracing::warn!(
                tenant_id = %tx.actor().tenant_id,
                "dictation settings invalid; using the local defaults with the cloud off"
            );
            Ok(DictationConfig::default())
        }
    }
}

/// `GET /api/admin/dictation/settings` — the configuration admins edit.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DictationConfig>, AppError> {
    medbrains_kernel::require_permission(&claims, permissions::admin::settings::dictation::MANAGE)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let config = load(&mut tx).await?;
    tx.commit().await?;
    Ok(Json(config))
}

/// `PUT /api/admin/dictation/settings` — save the configuration, audited
/// (turning the cloud service on is a privacy decision someone owns).
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DictationConfig>,
) -> Result<Json<DictationConfig>, AppError> {
    medbrains_kernel::require_permission(&claims, permissions::admin::settings::dictation::MANAGE)?;
    body.validate()?;
    let value = serde_json::to_value(&body).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let before = serde_json::to_value(load(&mut tx).await?).ok();
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'dictation', 'config', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, value = EXCLUDED.value",
        claims.tenant_id,
        value,
    )
    .execute(&mut *tx)
    .await?;
    let entry = medbrains_kernel::audit::AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action: "dictation_settings_saved",
        entity_type: "tenant_settings",
        entity_id: None,
        old_values: before.as_ref(),
        new_values: Some(&value),
        ip_address: None,
    };
    medbrains_kernel::audit(&mut tx, &entry).await?;
    tx.commit().await?;
    Ok(Json(body))
}

#[cfg(test)]
mod tests {
    use super::DictationConfig;

    #[test]
    fn defaults_are_local_and_cloud_is_off() {
        let parsed: Result<DictationConfig, _> = serde_json::from_value(serde_json::json!({}));
        assert_eq!(parsed.ok(), Some(DictationConfig::default()));
        let config = DictationConfig::default();
        assert!(!config.cloud_enabled);
        assert!(config.stt_url.starts_with("http://127.0.0.1"));
        assert!(config.validate().is_ok());
    }

    #[test]
    fn a_secret_name_cannot_reach_outside_the_namespace() {
        for name in ["JWT_PRIVATE_KEY_PEM", "DATABASE_URL", "../jwt", "a/b", ""] {
            let config = DictationConfig {
                cloud_api_key_secret: Some(name.to_owned()),
                ..DictationConfig::default()
            };
            assert!(config.validate().is_err(), "{name}");
        }
        let tenant = uuid::Uuid::nil();
        assert!(
            super::cloud_secret_path(tenant, "stt-key")
                .ends_with("/00000000-0000-0000-0000-000000000000/dictation-stt-key")
        );
    }

    #[test]
    fn local_services_must_be_local() {
        for url in [
            "http://stt.example.com",
            "http://169.254.169.254",
            "http://8.8.8.8:8178",
        ] {
            let config = DictationConfig {
                stt_url: url.to_owned(),
                ..DictationConfig::default()
            };
            assert!(config.validate().is_err(), "{url}");
        }
        let config = DictationConfig {
            llm_url: "http://10.0.0.7:11434".to_owned(),
            ..DictationConfig::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn cloud_needs_https_and_a_secret() {
        let mut config = DictationConfig {
            cloud_enabled: true,
            cloud_url: Some("http://stt.example.com".to_owned()),
            cloud_api_key_secret: Some("stt-key".to_owned()),
            ..DictationConfig::default()
        };
        assert!(
            config.validate().is_err(),
            "plain http leaves the hospital unencrypted"
        );
        config.cloud_url = Some("https://stt.example.com".to_owned());
        assert!(config.validate().is_ok());
        config.cloud_api_key_secret = None;
        assert!(config.validate().is_err());
    }

    #[test]
    fn local_addresses_need_a_host() {
        let config = DictationConfig {
            stt_url: "http://".to_owned(),
            ..DictationConfig::default()
        };
        assert!(config.validate().is_err());
    }
}

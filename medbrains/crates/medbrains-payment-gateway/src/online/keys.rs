//! A hospital's keys for an online provider, wherever they are kept.
//!
//! Looked up in order: the hospital's setting (`payments` /
//! `<provider>_config`, written by the online-payments settings screen), then
//! the secret store (`medbrains/{env}/{tenant}/<provider>-<field>`), and for
//! Razorpay alone the server's `RAZORPAY_*` environment (see
//! [`crate::razorpay::credentials`]). A secret is never sent back to a
//! screen: [`Keys`] prints redacted.

use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_server_core::error::AppError;
use serde_json::{Map, Value};
use uuid::Uuid;

use super::{OnlineProvider, ProviderError};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// One provider's keys for one hospital.
#[derive(Clone)]
pub struct Keys {
    values: Map<String, Value>,
    /// `tenant_settings`, `secrets` or `env`.
    pub source: &'static str,
}

impl std::fmt::Debug for Keys {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Keys")
            .field("fields", &self.values.keys().collect::<Vec<_>>())
            .field("source", &self.source)
            .finish_non_exhaustive()
    }
}

impl Keys {
    pub fn new(values: Map<String, Value>, source: &'static str) -> Self {
        Self { values, source }
    }

    pub fn set(&mut self, field: &str, value: &str) {
        self.values
            .insert(field.to_owned(), Value::String(value.to_owned()));
    }

    pub fn get(&self, field: &str) -> Option<&str> {
        self.values
            .get(field)
            .and_then(Value::as_str)
            .filter(|v| !v.is_empty())
    }

    /// A field the call cannot be made without.
    ///
    /// # Errors
    /// [`ProviderError::NotSetUp`] naming the field.
    pub fn need(&self, field: &str) -> Result<&str, ProviderError> {
        self.get(field).ok_or_else(|| {
            ProviderError::NotSetUp(format!("The payment provider's '{field}' is not set"))
        })
    }

    /// Live keys; anything else is the provider's test environment.
    pub fn live(&self) -> bool {
        self.get("mode") == Some("live")
    }

    /// The required fields that are not set.
    pub fn missing(&self, provider: &dyn OnlineProvider) -> Vec<&'static str> {
        provider
            .key_fields()
            .iter()
            .filter(|f| f.required && self.get(f.name).is_none())
            .map(|f| f.name)
            .collect()
    }
}

/// The stored `<provider>_config` setting, if any.
///
/// # Errors
/// A database fault.
pub async fn stored_config(
    tx: &mut Tx<'_>,
    tenant_id: &Uuid,
    code: &str,
) -> Result<Option<Map<String, Value>>, AppError> {
    let row = sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(format!("{code}_config"))
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.and_then(|v| match v {
        Value::Object(m) => Some(m),
        _ => None,
    }))
}

async fn secret(secrets: &dyn SecretResolver, key: &str) -> Result<Option<String>, AppError> {
    match secrets.get(key).await {
        Ok(v) if !v.is_empty() => Ok(Some(v)),
        Ok(_) | Err(SecretError::NotFound(_)) => Ok(None),
        Err(e) => Err(AppError::ServiceUnavailable(format!(
            "The payment keys could not be read: {e}"
        ))),
    }
}

/// The hospital's keys for `provider`, or `None` when none are set anywhere.
/// An unreadable secret store is an error, never "not set" — an outage must
/// not fall through to some other account's keys.
///
/// # Errors
/// A database fault or an unreadable secret store.
pub async fn keys_for(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    tenant_id: &Uuid,
    provider: &dyn OnlineProvider,
) -> Result<Option<Keys>, AppError> {
    if let Some(stored) = stored_config(tx, tenant_id, provider.code()).await? {
        return Ok(Some(super::razorpay::with_mode(Keys::new(
            stored,
            "tenant_settings",
        ))));
    }
    if provider.code() == "razorpay" {
        return Ok(crate::razorpay::credentials(tx, secrets, tenant_id)
            .await?
            .map(super::razorpay::keys_of));
    }
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let mut found = Map::new();
    for field in provider.key_fields() {
        let name = format!(
            "medbrains/{env}/{tenant_id}/{}-{}",
            provider.code(),
            field.name.replace('_', "-")
        );
        if let Some(v) = secret(secrets, &name).await? {
            found.insert(field.name.to_owned(), Value::String(v));
        }
    }
    Ok((!found.is_empty()).then(|| Keys::new(found, "secrets")))
}

/// Where the provider is: a stand-in when `<CODE>_API_BASE_OVERRIDE` is set
/// (a secret, so a stray environment variable cannot redirect production),
/// else its real host for these keys.
pub async fn api_base(
    secrets: &dyn SecretResolver,
    provider: &dyn OnlineProvider,
    keys: &Keys,
) -> String {
    let name = format!("{}_API_BASE_OVERRIDE", provider.code().to_ascii_uppercase());
    secrets
        .get(&name)
        .await
        .ok()
        .filter(|b| b.starts_with("http"))
        .map_or_else(
            || provider.api_base(keys.live()).to_owned(),
            |b| b.trim_end_matches('/').to_owned(),
        )
}

/// Whether the provider is a stand-in (its base is overridden).
pub async fn overridden(secrets: &dyn SecretResolver, provider: &dyn OnlineProvider) -> bool {
    let name = format!("{}_API_BASE_OVERRIDE", provider.code().to_ascii_uppercase());
    secrets
        .get(&name)
        .await
        .is_ok_and(|b| b.starts_with("http"))
}

#[cfg(test)]
mod tests {
    use super::Keys;
    use serde_json::json;

    #[test]
    fn keys_never_print_their_values() {
        let Some(map) = json!({ "client_secret": "s3cr3t", "mode": "live" })
            .as_object()
            .cloned()
        else {
            return;
        };
        let keys = Keys::new(map, "tenant_settings");
        assert!(!format!("{keys:?}").contains("s3cr3t"));
        assert!(keys.live());
        assert!(keys.need("client_id").is_err());
        assert_eq!(keys.get("client_secret"), Some("s3cr3t"));
    }
}

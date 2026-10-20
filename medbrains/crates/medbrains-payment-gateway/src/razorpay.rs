//! Razorpay: the one place its keys are found, and the calls checkout,
//! verification and refunds make to it.
//!
//! Endpoints and fields per Razorpay's API reference (`POST /v1/orders`,
//! `GET /v1/payments/{id}`, `POST /v1/payments/{id}/refund`) and its
//! signature rules (checkout: HMAC-SHA256 of `order_id|payment_id` keyed by
//! the key secret; webhook: HMAC-SHA256 of the raw body keyed by the webhook
//! secret, hex encoded).

use std::time::Duration;

use hmac::{Hmac, Mac};
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_server_core::error::AppError;
use serde::Deserialize;
use serde_json::Value;
use sha2::Sha256;
use uuid::Uuid;

/// A stand-in Razorpay for tests and rehearsals (a secret, so it never
/// leaks into production by a stray environment variable).
pub const API_BASE_OVERRIDE: &str = "RAZORPAY_API_BASE_OVERRIDE";
const API_BASE: &str = "https://api.razorpay.com/v1";
/// Inferred, not from Razorpay: long enough for a slow gateway, short enough
/// that a cashier is not left watching a spinner.
const CALL_TIMEOUT: Duration = Duration::from_secs(15);

/// The hospital's Razorpay keys and where they were found.
pub struct Credentials {
    pub key_id: String,
    pub key_secret: String,
    pub webhook_secret: Option<String>,
    /// `tenant_settings`, `secrets` or `env`.
    pub source: &'static str,
}

impl std::fmt::Debug for Credentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Credentials")
            .field("key_id", &crate::mask_key_id(&self.key_id))
            .field("key_secret", &"[redacted]")
            .field("source", &self.source)
            .finish_non_exhaustive()
    }
}

#[derive(Deserialize)]
struct StoredConfig {
    key_id: String,
    key_secret: String,
    #[serde(default)]
    webhook_secret: Option<String>,
}

/// One secret from the resolver: `None` when it is simply not there, an error
/// when the store could not be read — an outage must not fall through to
/// another account's keys.
async fn secret(secrets: &dyn SecretResolver, key: &str) -> Result<Option<String>, AppError> {
    match secrets.get(key).await {
        Ok(v) if !v.is_empty() => Ok(Some(v)),
        Ok(_) | Err(SecretError::NotFound(_)) => Ok(None),
        Err(e) => Err(AppError::ServiceUnavailable(format!(
            "The payment keys could not be read: {e}"
        ))),
    }
}

/// The hospital's Razorpay keys: its own setting, then the secret store
/// (`medbrains/{env}/{tenant}/razorpay-key-id` …), then the server's
/// `RAZORPAY_*` environment. Every caller — checkout, webhooks, refunds,
/// payment links run by the outbox worker — finds them here.
///
/// # Errors
/// A database fault, a stored setting that does not parse, or a secret
/// store that could not be read.
pub async fn credentials(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    secrets: &dyn SecretResolver,
    tenant_id: &Uuid,
) -> Result<Option<Credentials>, AppError> {
    let stored = sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'razorpay_config' \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(value) = stored {
        let c: StoredConfig = serde_json::from_value(value)
            .map_err(|e| AppError::Internal(format!("invalid razorpay_config: {e}")))?;
        return Ok(Some(Credentials {
            key_id: c.key_id,
            key_secret: c.key_secret,
            webhook_secret: c.webhook_secret.filter(|s| !s.is_empty()),
            source: "tenant_settings",
        }));
    }
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    let key = |name: &str| format!("medbrains/{env}/{tenant_id}/{name}");
    if let (Some(key_id), Some(key_secret)) = (
        secret(secrets, &key("razorpay-key-id")).await?,
        secret(secrets, &key("razorpay-key-secret")).await?,
    ) {
        return Ok(Some(Credentials {
            key_id,
            key_secret,
            webhook_secret: secret(secrets, &key("razorpay-webhook-secret")).await?,
            source: "secrets",
        }));
    }
    let var = |name: &str| std::env::var(name).ok().filter(|v| !v.is_empty());
    Ok(match (var("RAZORPAY_KEY_ID"), var("RAZORPAY_KEY_SECRET")) {
        (Some(key_id), Some(key_secret)) => Some(Credentials {
            key_id,
            key_secret,
            webhook_secret: var("RAZORPAY_WEBHOOK_SECRET"),
            source: "env",
        }),
        _ => None,
    })
}

/// Where Razorpay is: the real one unless a stand-in is configured.
pub async fn api_base(secrets: &dyn SecretResolver) -> String {
    secrets
        .get(API_BASE_OVERRIDE)
        .await
        .ok()
        .filter(|b| b.starts_with("http"))
        .map_or_else(
            || API_BASE.to_owned(),
            |b| b.trim_end_matches('/').to_owned(),
        )
}

/// What Razorpay said to a call.
#[derive(Debug)]
pub enum Answer {
    Ok(Value),
    /// A definite no, with Razorpay's reason.
    Refused(String),
    /// No answer, or a rate limit / outage: whether it acted is unknown.
    Unreachable(String),
}

/// Call Razorpay: `GET` when `body` is `None`, else `POST` it.
pub async fn call(
    secrets: &dyn SecretResolver,
    creds: &Credentials,
    path: &str,
    body: Option<&Value>,
) -> Answer {
    let client = match reqwest::Client::builder().timeout(CALL_TIMEOUT).build() {
        Ok(c) => c,
        Err(e) => return Answer::Unreachable(format!("http client: {e}")),
    };
    let url = format!("{}{path}", api_base(secrets).await);
    let request = match body {
        Some(b) => client.post(&url).json(b),
        None => client.get(&url),
    };
    let response = match request
        .basic_auth(&creds.key_id, Some(&creds.key_secret))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return Answer::Unreachable(format!("Razorpay did not answer: {e}")),
    };
    let status = response.status();
    let answer: Value = response.json().await.unwrap_or(Value::Null);
    if status.is_success() {
        return Answer::Ok(answer);
    }
    let why = answer["error"]["description"]
        .as_str()
        .map_or_else(|| status.to_string(), ToOwned::to_owned);
    if status.as_u16() == 429 || status.is_server_error() {
        Answer::Unreachable(format!("Razorpay is unavailable: {why}"))
    } else {
        Answer::Refused(why)
    }
}

/// Whether `signature_hex` is the HMAC-SHA256 of `message` under `secret`,
/// compared in constant time.
pub fn signature_matches(secret: &str, message: &[u8], signature_hex: &str) -> bool {
    let Ok(signature) = hex::decode(signature_hex.trim()) else {
        return false;
    };
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(message);
    mac.verify_slice(&signature).is_ok()
}

/// The `payment_mode` a gateway's payment method posts as. Razorpay's own
/// words (`card`, `upi`, `netbanking`, `wallet`, `emi`) and the other
/// providers' (`credit_card`, `net_banking`, `UPI_COLLECT`…). `None` for a
/// method with no honest mode (pay-later, cardless EMI): that payment goes to
/// finance instead of being posted as something it was not.
pub fn mode_for_method(method: &str) -> Option<&'static str> {
    let m = method
        .trim()
        .to_ascii_lowercase()
        .replace([' ', '-', '+'], "_");
    match m.as_str() {
        "card" | "credit_card" | "debit_card" | "prepaid_card" | "emi" | "card_emi" => Some("card"),
        "netbanking" | "net_banking" | "nb" | "bank_transfer" | "neft" | "imps" | "rtgs" => {
            Some("bank_transfer")
        }
        "wallet" => Some("wallet"),
        upi if upi.starts_with("upi") => Some("upi"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{Hmac, Mac, Sha256, mode_for_method, signature_matches};

    #[test]
    fn each_method_posts_as_the_mode_it_was_paid_by() {
        assert_eq!(mode_for_method("card"), Some("card"));
        assert_eq!(mode_for_method("emi"), Some("card"));
        assert_eq!(mode_for_method("Credit Card"), Some("card"));
        assert_eq!(mode_for_method("upi"), Some("upi"));
        assert_eq!(mode_for_method("UPI_COLLECT"), Some("upi"));
        assert_eq!(mode_for_method("netbanking"), Some("bank_transfer"));
        assert_eq!(mode_for_method("net_banking"), Some("bank_transfer"));
        assert_eq!(mode_for_method("wallet"), Some("wallet"));
        assert_eq!(mode_for_method("paylater"), None);
        assert_eq!(mode_for_method("cardless_emi"), None);
        assert_eq!(mode_for_method(""), None);
    }

    #[test]
    fn only_the_right_signature_matches() {
        let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(b"secret") else {
            return;
        };
        mac.update(b"order_1|pay_1");
        let good = hex::encode(mac.finalize().into_bytes());
        assert!(signature_matches("secret", b"order_1|pay_1", &good));
        assert!(!signature_matches("secret", b"order_1|pay_2", &good));
        assert!(!signature_matches("other", b"order_1|pay_1", &good));
        assert!(!signature_matches("secret", b"order_1|pay_1", "not-hex"));
        assert!(!signature_matches("secret", b"order_1|pay_1", ""));
    }
}

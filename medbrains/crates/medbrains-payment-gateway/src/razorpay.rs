//! Razorpay's keys when no settings-screen keys are stored (the secret
//! store, then the server's environment), and its HMAC signature check. The
//! calls themselves are [`crate::online::razorpay`].

use hmac::{Hmac, Mac};
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_server_core::error::AppError;
use serde::Deserialize;
use serde_json::Value;
use sha2::Sha256;
use uuid::Uuid;

/// A stand-in Razorpay for tests and rehearsals (a secret, so it never
/// leaks into production by a stray environment variable); the
/// `<CODE>_API_BASE_OVERRIDE` of [`crate::online::keys::api_base`].
pub const API_BASE_OVERRIDE: &str = "RAZORPAY_API_BASE_OVERRIDE";

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

//! Secret names a hospital may choose.
//!
//! Some settings let a hospital's administrator point at a secret instead of
//! typing it in (the SMTP password, an AI provider key). The resolver behind
//! them is not tenant-scoped: the `env` backend maps any name to a process
//! environment variable, and the `file` and `aws` backends read whatever they
//! are given. Letting a tenant hand the resolver a name of its own choosing
//! therefore lets it name the platform's secrets.
//!
//! So a hospital never supplies a resolver key. It supplies a **short name**,
//! `[a-z0-9-]{1,40}`, and the server builds the key inside that hospital's own
//! namespace: `medbrains/<env>/<tenant>/<purpose>-<name>`, the same shape as
//! the payment keys (`medbrains/<env>/<tenant>/razorpay-key-id`). A platform
//! secret can never be reached this way, whatever the backend.
//!
//! The check runs twice: when the setting is saved (so the admin is told) and
//! again when it is resolved (so a value stored before this rule existed, or
//! written around the screen, is refused and never sent).

use std::fmt;

use uuid::Uuid;

use super::{SecretError, SecretResolver};

/// Longest short name a hospital may give.
pub const MAX_SHORT_NAME_LEN: usize = 40;

/// What a hospital is told when a short name is refused.
pub const SHORT_NAME_RULE: &str = "A secret name may use only lowercase letters, digits and \
     hyphens, at most 40 characters (for example \"mailbox\"). It names a secret kept for this \
     hospital, never a server setting.";

/// A short name (or purpose) that does not match `[a-z0-9-]{1,40}`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvalidSecretName;

impl fmt::Display for InvalidSecretName {
    /// Prints [`SHORT_NAME_RULE`], never the refused name itself.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(SHORT_NAME_RULE)
    }
}

impl std::error::Error for InvalidSecretName {}

/// Why a hospital's secret could not be read.
#[derive(Debug)]
pub enum TenantSecretError {
    /// The stored name is not a short name: refused, nothing was looked up.
    Refused(InvalidSecretName),
    /// The secret store answered with an error (including not found).
    Store(SecretError),
}

impl fmt::Display for TenantSecretError {
    /// A message safe to show: it never repeats the stored name.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Refused(e) => write!(f, "refused stored secret name: {e}"),
            Self::Store(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for TenantSecretError {}

/// Whether `name` is a legal short name: 1 to 40 of `a-z`, `0-9`, `-`.
#[must_use]
pub fn is_short_name(name: &str) -> bool {
    (1..=MAX_SHORT_NAME_LEN).contains(&name.len())
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// Refuse anything that is not a short name.
///
/// # Errors
/// [`InvalidSecretName`] when `name` breaks the `[a-z0-9-]{1,40}` rule.
pub fn check_short_name(name: &str) -> Result<(), InvalidSecretName> {
    if is_short_name(name) {
        Ok(())
    } else {
        Err(InvalidSecretName)
    }
}

/// The deployment environment segment of every secret key (`MEDBRAINS_ENV`,
/// default `dev`), the same value the payment keys use.
#[must_use]
pub fn deploy_env() -> String {
    std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned())
}

/// The resolver key for a hospital's own secret:
/// `medbrains/<env>/<tenant>/<purpose>-<short>`.
///
/// `purpose` is the server's constant for the feature (`smtp`, `ai`); both it
/// and `short` must be short names, so the key cannot leave the namespace.
///
/// # Errors
/// [`InvalidSecretName`] when `purpose` or `short` is not a short name.
pub fn tenant_secret_name(
    env: &str,
    tenant_id: &Uuid,
    purpose: &str,
    short: &str,
) -> Result<String, InvalidSecretName> {
    check_short_name(purpose)?;
    check_short_name(short)?;
    Ok(format!("medbrains/{env}/{tenant_id}/{purpose}-{short}"))
}

/// Read a hospital's own secret named by a stored short name.
///
/// A stored value that is not a short name (a legacy `SMTP_PASSWORD`, a full path) is refused
/// before the resolver is asked, so it can never reach a platform secret.
///
/// # Errors
/// [`TenantSecretError::Refused`] for an illegal name, otherwise the store's
/// own error.
pub async fn resolve_tenant_secret(
    resolver: &dyn SecretResolver,
    tenant_id: &Uuid,
    purpose: &str,
    short: &str,
) -> Result<String, TenantSecretError> {
    let key = tenant_secret_name(&deploy_env(), tenant_id, purpose, short)
        .map_err(TenantSecretError::Refused)?;
    resolver.get(&key).await.map_err(TenantSecretError::Store)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Records every key it is asked for and answers with the key itself.
    #[derive(Debug, Default)]
    struct Recording(Mutex<Vec<String>>);

    #[async_trait::async_trait]
    impl SecretResolver for Recording {
        async fn get(&self, key: &str) -> Result<String, SecretError> {
            self.0.lock().unwrap().push(key.to_owned());
            Ok(format!("value-of:{key}"))
        }
    }

    const REFUSED: [&str; 10] = [
        "JWT_PRIVATE_KEY_PEM",
        "DATABASE_URL",
        "SMTP_PASSWORD",
        "../x",
        "medbrains/prod/00000000-0000-0000-0000-000000000000/smtp-x",
        "/etc/passwd",
        "",
        "has space",
        "dot.name",
        "under_score",
    ];

    #[test]
    fn a_short_name_builds_a_key_in_the_hospital_namespace() {
        let tenant = Uuid::nil();
        assert_eq!(
            tenant_secret_name("prod", &tenant, "smtp", "mailbox").unwrap(),
            format!("medbrains/prod/{tenant}/smtp-mailbox")
        );
        assert!(is_short_name("a"));
        assert!(is_short_name(&"a".repeat(MAX_SHORT_NAME_LEN)));
        assert!(is_short_name("main-2"));
    }

    #[test]
    fn platform_names_paths_and_oversize_names_are_refused() {
        for name in REFUSED {
            assert!(!is_short_name(name), "{name:?} must be refused");
            assert_eq!(
                tenant_secret_name("prod", &Uuid::nil(), "smtp", name),
                Err(InvalidSecretName)
            );
        }
        assert!(!is_short_name(&"a".repeat(MAX_SHORT_NAME_LEN + 1)));
        // The purpose is checked too, so a caller cannot widen the namespace.
        assert!(tenant_secret_name("prod", &Uuid::nil(), "../", "x").is_err());
    }

    #[test]
    fn the_refusal_message_never_repeats_the_name() {
        let msg = TenantSecretError::Refused(InvalidSecretName).to_string();
        assert!(!msg.contains("JWT"));
        assert!(msg.contains("lowercase letters"));
    }

    #[tokio::test]
    async fn a_refused_name_never_reaches_the_resolver() {
        let resolver = Recording::default();
        for name in REFUSED {
            let got = resolve_tenant_secret(&resolver, &Uuid::nil(), "smtp", name).await;
            assert!(
                matches!(got, Err(TenantSecretError::Refused(_))),
                "{name:?}"
            );
        }
        assert!(
            resolver.0.lock().unwrap().is_empty(),
            "nothing was looked up"
        );

        let value = resolve_tenant_secret(&resolver, &Uuid::nil(), "ai", "openrouter")
            .await
            .unwrap();
        let asked = resolver.0.lock().unwrap().clone();
        assert_eq!(asked.len(), 1);
        assert!(asked[0].starts_with("medbrains/"));
        assert!(asked[0].ends_with(&format!("/{}/ai-openrouter", Uuid::nil())));
        assert_eq!(value, format!("value-of:{}", asked[0]));
    }
}

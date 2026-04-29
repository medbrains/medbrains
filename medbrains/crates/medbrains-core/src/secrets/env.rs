//! Env-based `SecretResolver`. Used in dev + integration tests.
//!
//! Translates dotted/slashed secret keys into uppercase env var names,
//! e.g. `medbrains/dev/global/razorpay-hmac` →
//! `MEDBRAINS_DEV_GLOBAL_RAZORPAY_HMAC`.

use super::{SecretError, SecretResolver};
use async_trait::async_trait;
use std::env;

#[derive(Debug, Default, Clone)]
pub struct EnvSecretResolver;

impl EnvSecretResolver {
    pub fn new() -> Self {
        Self
    }

    fn env_key(secret_key: &str) -> String {
        secret_key
            .chars()
            .map(|c| match c {
                'a'..='z' | 'A'..='Z' | '0'..='9' => c.to_ascii_uppercase(),
                _ => '_',
            })
            .collect()
    }
}

#[async_trait]
impl SecretResolver for EnvSecretResolver {
    async fn get(&self, key: &str) -> Result<String, SecretError> {
        let env_key = Self::env_key(key);
        env::var(&env_key).map_err(|_| SecretError::NotFound(key.to_owned()))
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn translates_keys() {
        assert_eq!(
            EnvSecretResolver::env_key("medbrains/dev/global/razorpay-hmac"),
            "MEDBRAINS_DEV_GLOBAL_RAZORPAY_HMAC"
        );
        assert_eq!(
            EnvSecretResolver::env_key("foo.bar.baz"),
            "FOO_BAR_BAZ"
        );
    }

    #[tokio::test]
    async fn missing_returns_not_found() {
        let r = EnvSecretResolver;
        // Use a name extremely unlikely to be set in any environment.
        let err = r
            .get("medbrains/nope/this-secret-should-never-exist-zzz")
            .await
            .unwrap_err();
        assert!(matches!(err, SecretError::NotFound(_)));
    }
}

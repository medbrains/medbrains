//! Boot-time selection of the [`SecretResolver`] backend.
//!
//! The trait + the `env`/`file` impls live in `medbrains-core`; the AWS
//! Secrets Manager impl lives here (behind the `aws-secrets` feature) so the
//! AWS SDK stays out of the dependency-free core crate.
//!
//! Selection order:
//! 1. Explicit `MEDBRAINS_SECRETS_BACKEND` = `env` | `file` | `aws`.
//! 2. Otherwise derived from [`DeployMode`]: `onprem` → file, `saas`/`hybrid` → aws.
//!
//! Any unknown / unavailable choice falls back to the `env` backend so a
//! misconfigured node degrades to dev behaviour instead of failing to boot.

use std::sync::Arc;

use medbrains_core::deploy_mode::DeployMode;
use medbrains_core::secrets::{EnvSecretResolver, FileSecretResolver, SecretResolver};

/// Build the secret resolver for this node from the environment.
pub async fn build_secret_resolver() -> Arc<dyn SecretResolver> {
    let explicit = std::env::var("MEDBRAINS_SECRETS_BACKEND")
        .ok()
        .map(|s| s.trim().to_ascii_lowercase());

    let backend = match explicit.as_deref() {
        Some(value) => value.to_owned(),
        None => match DeployMode::from_env() {
            DeployMode::Onprem => "file".to_owned(),
            DeployMode::Saas | DeployMode::Hybrid => "aws".to_owned(),
        },
    };

    match backend.as_str() {
        "file" => {
            tracing::info!("secrets backend: file (/etc/medbrains/secrets)");
            Arc::new(FileSecretResolver::default_base())
        }
        "aws" | "aws-sm" | "aws_secrets_manager" => build_aws().await,
        "env" => {
            tracing::info!("secrets backend: env");
            Arc::new(EnvSecretResolver::new())
        }
        other => {
            tracing::warn!(backend = other, "unknown MEDBRAINS_SECRETS_BACKEND; using env");
            Arc::new(EnvSecretResolver::new())
        }
    }
}

#[cfg(feature = "aws-secrets")]
async fn build_aws() -> Arc<dyn SecretResolver> {
    match aws::AwsSecretsManagerResolver::new().await {
        Ok(resolver) => {
            tracing::info!("secrets backend: aws secrets manager");
            Arc::new(resolver)
        }
        Err(e) => {
            tracing::error!(error = %e, "aws secrets manager init failed; using env");
            Arc::new(EnvSecretResolver::new())
        }
    }
}

#[cfg(not(feature = "aws-secrets"))]
#[allow(clippy::unused_async)] // async to match the feature-on signature at the call site
async fn build_aws() -> Arc<dyn SecretResolver> {
    tracing::warn!("secrets backend 'aws' requested but built without the 'aws-secrets' feature; using env");
    Arc::new(EnvSecretResolver::new())
}

#[cfg(feature = "aws-secrets")]
mod aws {
    use async_trait::async_trait;
    use medbrains_core::secrets::{SecretError, SecretResolver};

    /// Resolves secrets from AWS Secrets Manager by name (`GetSecretValue`).
    /// Region + credentials come from the standard AWS environment chain.
    #[derive(Debug)]
    pub(crate) struct AwsSecretsManagerResolver {
        client: aws_sdk_secretsmanager::Client,
    }

    impl AwsSecretsManagerResolver {
        pub(crate) async fn new() -> Result<Self, SecretError> {
            let config = aws_config::load_from_env().await;
            Ok(Self {
                client: aws_sdk_secretsmanager::Client::new(&config),
            })
        }
    }

    #[async_trait]
    impl SecretResolver for AwsSecretsManagerResolver {
        async fn get(&self, key: &str) -> Result<String, SecretError> {
            let resp = self
                .client
                .get_secret_value()
                .secret_id(key)
                .send()
                .await
                .map_err(|e| SecretError::Backend(e.to_string()))?;
            resp.secret_string()
                .map(ToOwned::to_owned)
                .ok_or_else(|| SecretError::NotFound(key.to_owned()))
        }
    }
}

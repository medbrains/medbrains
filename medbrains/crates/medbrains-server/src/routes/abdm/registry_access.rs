//! Where HFR/HPR calls get their host and gateway session token.
//!
//! The session comes from the hospital's ABDM connection (`abha::connect`),
//! the same sealed keys and cached session the ABHA screens use.
//!
//! Keys, all read through `state.secret_resolver` (env in dev/tests):
//! - `ABDM_HFR_BASE_URL_OVERRIDE` / `ABDM_HPR_BASE_URL_OVERRIDE` — registry
//!   host; default is the sandbox or production host for the environment.
//! - `ABDM_GATEWAY_TOKEN_OVERRIDE` — a ready session token (tests, manual
//!   smoke runs). Otherwise the tenant's ABDM client id/secret mint one.
//!
//! `Ok(None)` means "no keys": the screens then record IDs unverified instead
//! of pretending a registry call happened. A secret-store or DB fault is an
//! error, never "no keys".

use medbrains_abdm::AbdmEnvironment;
use medbrains_core::secrets::{SecretError, SecretResolver};
use uuid::Uuid;

use super::abha::{abdm_configured, connect};
use crate::{error::AppError, state::AppState};

pub(crate) struct RegistryAccess {
    pub(crate) http: reqwest::Client,
    pub(crate) base_url: String,
    pub(crate) token: String,
}

#[derive(Clone, Copy, Debug)]
pub(crate) enum Registry {
    Hfr,
    Hpr,
}

pub(crate) async fn registry_access(
    state: &AppState,
    tenant_id: &Uuid,
    registry: Registry,
) -> Result<Option<RegistryAccess>, AppError> {
    let Some((environment, token)) = gateway_token(state, tenant_id).await? else {
        return Ok(None);
    };
    let (key, default) = match registry {
        Registry::Hfr => (
            "ABDM_HFR_BASE_URL_OVERRIDE",
            medbrains_abdm::registry::hfr_default_base(&environment),
        ),
        Registry::Hpr => (
            "ABDM_HPR_BASE_URL_OVERRIDE",
            medbrains_abdm::registry::hpr_default_base(&environment),
        ),
    };
    let base_url = secret(state, key)
        .await?
        .unwrap_or_else(|| default.to_owned());
    Ok(Some(RegistryAccess {
        http: reqwest::Client::new(),
        base_url,
        token,
    }))
}

/// Whether keys exist, without minting a session (for list screens).
pub(crate) async fn registry_configured(
    state: &AppState,
    tenant_id: &Uuid,
) -> Result<bool, AppError> {
    if secret(state, "ABDM_GATEWAY_TOKEN_OVERRIDE").await?.is_some() {
        return Ok(true);
    }
    abdm_configured(state, *tenant_id).await
}

/// The gateway session token and the environment it belongs to.
async fn gateway_token(
    state: &AppState,
    tenant_id: &Uuid,
) -> Result<Option<(AbdmEnvironment, String)>, AppError> {
    if let Some(token) = secret(state, "ABDM_GATEWAY_TOKEN_OVERRIDE").await? {
        let environment = if std::env::var("ABDM_ENVIRONMENT").as_deref() == Ok("production") {
            AbdmEnvironment::Production
        } else {
            AbdmEnvironment::Sandbox
        };
        return Ok(Some((environment, token)));
    }
    if !abdm_configured(state, *tenant_id).await? {
        return Ok(None);
    }
    let abdm = connect(state, *tenant_id).await?;
    Ok(Some((abdm.environment, abdm.session)))
}

async fn secret(state: &AppState, key: &str) -> Result<Option<String>, AppError> {
    match state.secret_resolver.get(key).await {
        Ok(v) if !v.trim().is_empty() => Ok(Some(v.trim().to_owned())),
        Ok(_) | Err(SecretError::NotFound(_)) => Ok(None),
        Err(e) => Err(AppError::Internal(format!("secret {key}: {e}"))),
    }
}

/// A registry that could not answer is an outage (503), never "not found".
pub(crate) fn registry_fault(error: medbrains_abdm::AbdmError) -> AppError {
    AppError::ServiceUnavailable(format!("ABDM registry unavailable: {error}"))
}

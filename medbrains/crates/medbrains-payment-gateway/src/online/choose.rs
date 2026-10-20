//! Which provider takes a payment: the counter's own, else the hospital's,
//! with the hospital's fallback offered — never switched to silently — when
//! the first does not answer.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::{Extension, Json};
use medbrains_core::permissions;
use medbrains_core::secrets::SecretResolver;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::keys::{api_base, keys_for};
use super::{Capabilities, Ctx, Keys, OnlineProvider, ProviderError, provider_for};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Hospitals set up before providers were chosen took Razorpay.
pub const DEFAULT_PROVIDER: &str = "razorpay";

/// A provider with the hospital's keys for it.
pub struct Chosen {
    pub provider: &'static dyn OnlineProvider,
    pub keys: Keys,
    pub base: String,
}

impl std::fmt::Debug for Chosen {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Chosen")
            .field("provider", &self.provider.code())
            .finish_non_exhaustive()
    }
}

impl Chosen {
    pub fn ctx(&self) -> Ctx<'_> {
        Ctx {
            keys: &self.keys,
            base: self.base.clone(),
        }
    }
}

/// A setting naming a provider, as text.
async fn setting(tx: &mut Tx<'_>, tenant_id: Uuid, key: &str) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await?
    .and_then(|v| v.as_str().map(ToOwned::to_owned))
    .filter(|s| !s.is_empty()))
}

/// The provider code in force: the counter's override, else the hospital's
/// `active_provider`, else Razorpay. May name a provider with no adapter.
///
/// # Errors
/// A database fault.
pub async fn active_code(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    station: Option<Uuid>,
) -> Result<(String, bool), AppError> {
    if let Some(station) = station {
        let own = sqlx::query_scalar::<_, Option<String>>(
            "SELECT payment_provider FROM stations \
             WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        )
        .bind(station)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .flatten();
        if let Some(code) = own {
            return Ok((code, true));
        }
    }
    let code = setting(tx, tenant_id, "active_provider").await?;
    Ok((code.unwrap_or_else(|| DEFAULT_PROVIDER.to_owned()), false))
}

/// The hospital's fallback provider, if it set one with an adapter.
///
/// # Errors
/// A database fault.
pub async fn fallback(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<Option<&'static dyn OnlineProvider>, AppError> {
    Ok(setting(tx, tenant_id, "fallback_provider")
        .await?
        .as_deref()
        .and_then(provider_for))
}

/// The provider with the hospital's keys, or `None` when they are not set.
///
/// # Errors
/// A database fault or an unreadable secret store.
pub async fn with_keys(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    provider: &'static dyn OnlineProvider,
) -> Result<Option<Chosen>, AppError> {
    let Some(keys) = keys_for(tx, secrets, &tenant_id, provider).await? else {
        return Ok(None);
    };
    let base = api_base(secrets, provider, &keys).await;
    Ok(Some(Chosen {
        provider,
        keys,
        base,
    }))
}

/// The provider for this counter, set up and able to do `capability`.
///
/// # Errors
/// 422 when it cannot do it, 503 when it is not set up, a database fault.
pub async fn require(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    station: Option<Uuid>,
    capability: &'static str,
) -> Result<Chosen, OnlineError> {
    let (code, _) = active_code(tx, tenant_id, station).await?;
    let provider = provider_for(&code).ok_or_else(|| {
        AppError::ServiceUnavailable(format!(
            "Payment provider '{code}' has no MedBrains adapter"
        ))
    })?;
    require_this(tx, secrets, tenant_id, provider, capability).await
}

/// This provider, set up and able to do `capability`.
///
/// # Errors
/// As [`require`].
pub async fn require_this(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    provider: &'static dyn OnlineProvider,
    capability: &'static str,
) -> Result<Chosen, OnlineError> {
    if !provider.capabilities().has(capability) {
        return Err(OnlineError::Unsupported {
            provider: provider.code(),
            capability,
        });
    }
    with_keys(tx, secrets, tenant_id, provider)
        .await?
        .ok_or_else(|| {
            OnlineError::App(AppError::ServiceUnavailable(format!(
                "{} is not set up for online payment at this hospital",
                provider.label()
            )))
        })
}

/// A provider the cashier may switch to.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct Fallback {
    pub provider: &'static str,
    pub label: &'static str,
}

/// Why an online payment could not start.
#[derive(Debug)]
pub enum OnlineError {
    App(AppError),
    /// The provider cannot do this at all: 422.
    Unsupported {
        provider: &'static str,
        capability: &'static str,
    },
    /// The provider did not answer: 503 with the fallback the cashier may
    /// choose. Nothing switches on its own mid-payment.
    Unavailable {
        provider: &'static str,
        detail: String,
        fallback: Option<Fallback>,
    },
}

impl From<AppError> for OnlineError {
    fn from(e: AppError) -> Self {
        Self::App(e)
    }
}

impl From<medbrains_db::pool::DbError> for OnlineError {
    fn from(e: medbrains_db::pool::DbError) -> Self {
        Self::App(e.into())
    }
}

impl From<sqlx::Error> for OnlineError {
    fn from(e: sqlx::Error) -> Self {
        Self::App(e.into())
    }
}

impl OnlineError {
    /// A provider's error. A definite refusal becomes `on_refusal`'s answer
    /// (the caller knows whether it is the request's fault or the setup's).
    pub fn of(
        provider: &'static dyn OnlineProvider,
        e: ProviderError,
        on_refusal: impl FnOnce(String) -> AppError,
        fallback: Option<Fallback>,
    ) -> Self {
        match e {
            ProviderError::Unsupported(capability) => Self::Unsupported {
                provider: provider.code(),
                capability,
            },
            ProviderError::Unavailable(detail) => Self::Unavailable {
                provider: provider.code(),
                detail,
                fallback: fallback.filter(|f| f.provider != provider.code()),
            },
            ProviderError::Refused(w) => Self::App(on_refusal(w)),
            ProviderError::NotSetUp(w) => Self::App(AppError::ServiceUnavailable(w)),
            ProviderError::BadSignature => {
                Self::App(AppError::BadRequest(ProviderError::BadSignature.words()))
            }
        }
    }
}

impl IntoResponse for OnlineError {
    fn into_response(self) -> Response {
        match self {
            Self::App(e) => e.into_response(),
            Self::Unsupported {
                provider,
                capability,
            } => {
                let label = provider_for(provider).map_or(provider, |p| p.label());
                let body = json!({
                    "error": "unsupported_capability", "provider": provider, "capability": capability,
                    "detail": format!("{label} cannot do this ({capability}) through MedBrains"),
                });
                (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
            }
            Self::Unavailable {
                provider,
                detail,
                fallback,
            } => {
                tracing::warn!(provider, %detail, "payment provider unavailable");
                let body = json!({
                    "error": "provider_unavailable", "provider": provider, "fallback": fallback,
                    "detail": format!("{detail}. Nothing was charged; take the payment another way \
                                       or try the other provider."),
                });
                (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
            }
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CapabilitiesQuery {
    pub station_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ProviderView {
    pub provider: &'static str,
    pub label: &'static str,
    /// Its keys are set (no secret is ever returned).
    pub configured: bool,
    /// `test` or `live` keys.
    pub mode: Option<String>,
    pub capabilities: Capabilities,
}

#[derive(Debug, Serialize)]
pub struct CapabilitiesView {
    /// `None` when the hospital's provider has no MedBrains adapter.
    pub active: Option<ProviderView>,
    /// The counter overrides the hospital's provider.
    pub station_override: bool,
    pub fallback: Option<ProviderView>,
}

async fn view(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    provider: &'static dyn OnlineProvider,
) -> Result<ProviderView, AppError> {
    let keys = keys_for(tx, secrets, &tenant_id, provider).await?;
    Ok(ProviderView {
        provider: provider.code(),
        label: provider.label(),
        configured: keys
            .as_ref()
            .is_some_and(|k| k.missing(provider).is_empty()),
        mode: keys
            .as_ref()
            .and_then(|k| k.get("mode"))
            .map(ToOwned::to_owned),
        capabilities: provider.capabilities(),
    })
}

/// `GET /api/payments/capabilities?station_id=` — what this counter's
/// provider can do, so a screen offers only that.
pub async fn get_capabilities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CapabilitiesQuery>,
) -> Result<Json<CapabilitiesView>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    let secrets = state.secret_resolver.as_ref();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (code, station_override) = active_code(&mut tx, claims.tenant_id, q.station_id).await?;
    let active = match provider_for(&code) {
        Some(p) => Some(view(&mut tx, secrets, claims.tenant_id, p).await?),
        None => None,
    };
    let fallback = match fallback(&mut tx, claims.tenant_id).await? {
        Some(p) if p.code() != code => Some(view(&mut tx, secrets, claims.tenant_id, p).await?),
        _ => None,
    };
    tx.commit().await?;
    Ok(Json(CapabilitiesView {
        active,
        station_override,
        fallback,
    }))
}

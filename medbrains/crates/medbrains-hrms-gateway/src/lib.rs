//! HRMS gateway (RFC-HRMS-INTEGRATIONS §9): pull HR master and workforce data
//! from the hospital's HRMS — **Humanex** first — into the `medbrains-hr`
//! tables.
//!
//! The provider is chosen the integration-hub way (RFC-INTEGRATION-WRAPPER
//! §3.3): `tenant_settings` (`integration`, `hrms`) holds a
//! [`RoutingConfig`], resolved by [`resolve_route`]; with no row the tenant
//! routes `single` to Humanex. Each provider keeps its own connection settings
//! (`hrms` / `humanex`: `{base_url, api_key, enabled, system_user_id}`;
//! `system_user_id` fills the NOT NULL `created_by` / `recorded_by` columns).
//! The key is never sent back to a screen.
//!
//! Humanex serves `/sync/v1/*` already shaped like our tables — `MedBrains`
//! column names, enum values and business codes — so each entity is one
//! upsert reading the document as `jsonb` ([`upserts`]). Rows carry
//! `external_source = 'humanex'` + `external_ref`. Each row runs in its own
//! savepoint: a bad row lands in `hrms_sync_exceptions` and the page goes on.
//! Cursors live in `hrms_sync_state`, so the 15-minute pass is incremental.
//!
//! ponytail: one adapter, so no `Connector` trait yet — the hub's P2 trait is
//! extracted from [`sync`] when the second HRMS (Frappe HR / Darwinbox) lands.
//! The api key sits in `tenant_settings` like the payment providers' keys
//! (`medbrains-payment-gateway::online::keys`); both move to the secret
//! resolver together.

pub mod routes;
pub mod sync;
pub mod upserts;

use std::time::Duration;

use axum::{
    Router,
    routing::{get, post},
};
use medbrains_integration_hub::{OpKind, ProviderCode, RoutingConfig, RoutingMode, resolve_route};
use medbrains_server_core::{error::AppError, state::AppState};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub use sync::{EntityOutcome, sync_tenant};

pub const HUMANEX: &str = "humanex";
const PASS_INTERVAL: Duration = Duration::from_mins(15);

type Tx<'a> = Transaction<'a, Postgres>;

/// Humanex connection settings (`tenant_settings` `hrms` / `humanex`).
#[derive(Clone, Serialize, Deserialize)]
pub struct HumanexConfig {
    pub base_url: String,
    pub api_key: String,
    #[serde(default)]
    pub enabled: bool,
    pub system_user_id: Uuid,
}

impl std::fmt::Debug for HumanexConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HumanexConfig")
            .field("base_url", &self.base_url)
            .field("enabled", &self.enabled)
            .finish_non_exhaustive()
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/hrms/humanex/config",
            get(routes::get_config).put(routes::put_config),
        )
        .route("/api/hrms/humanex/sync", post(routes::sync_now))
        .route("/api/hrms/humanex/status", get(routes::status))
}

/// The tenant's Humanex settings, if any.
///
/// # Errors
/// A database fault.
pub async fn load_config(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<Option<HumanexConfig>, AppError> {
    let v: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'hrms' AND key = 'humanex' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(v.and_then(|v| serde_json::from_value(v).ok()))
}

/// The HRMS providers to pull from, in order, per the tenant's routing.
///
/// # Errors
/// A database fault, or a routing setup missing a provider it names a slot for.
pub async fn providers(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Vec<ProviderCode>, AppError> {
    let v: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'integration' AND key = 'hrms' \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let cfg = v
        .and_then(|v| serde_json::from_value::<RoutingConfig>(v).ok())
        .unwrap_or_else(default_route);
    // A pull is a read: `read_write_split` picks its read side.
    resolve_route(&cfg, OpKind::Read)
        .map(|r| r.providers)
        .map_err(|e| AppError::BadRequest(format!("HRMS routing: {e}")))
}

fn default_route() -> RoutingConfig {
    RoutingConfig {
        mode: RoutingMode::Single,
        primary: Some(ProviderCode::new(HUMANEX)),
        secondary: None,
        read: None,
        write: None,
    }
}

/// Every 15 minutes, pull for every tenant with `hrms.humanex.enabled`.
/// `pool` is the worker pool, which reads across tenants.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match enabled_tenants(&pool).await {
                Ok(tenants) => {
                    for t in tenants {
                        if let Err(error) = sync_tenant(&pool, t).await {
                            tracing::error!(%error, tenant_id = %t, "hrms sync failed");
                        }
                    }
                }
                Err(error) => tracing::error!(%error, "hrms sync: tenant scan failed"),
            }
            tokio::time::sleep(PASS_INTERVAL).await;
        }
    });
}

async fn enabled_tenants(pool: &PgPool) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT tenant_id FROM tenant_settings \
         WHERE category = 'hrms' AND key = 'humanex' AND deleted_at IS NULL \
           AND coalesce((value->>'enabled')::boolean, false)",
    )
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::{HUMANEX, OpKind, default_route, resolve_route};

    #[test]
    fn with_no_routing_row_a_tenant_pulls_from_humanex_alone() {
        let codes: Vec<String> = resolve_route(&default_route(), OpKind::Read)
            .map(|r| r.providers.iter().map(|p| p.as_str().to_owned()).collect())
            .unwrap_or_default();
        assert_eq!(codes, vec![HUMANEX.to_owned()]);
    }
}

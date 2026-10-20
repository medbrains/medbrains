//! The online-payments settings screen's API: which provider the hospital
//! uses, its fallback, a counter's own provider, the keys (write-only — a
//! stored secret is never sent back) and a test that the keys work.

use axum::extract::{Path, State};
use axum::{Extension, Json};
use medbrains_core::permissions::billing::payments::CONFIGURE;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::choose::{DEFAULT_PROVIDER, with_keys};
use super::keys::{keys_for, overridden, stored_config};
use super::{Capabilities, KeyField, OnlineProvider, PROVIDERS, provider_for};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// The most counters listed for a per-counter provider.
const STATION_LIMIT: i64 = 300;

#[derive(Debug, Serialize)]
pub struct FieldView {
    pub name: &'static str,
    pub label: &'static str,
    pub secret: bool,
    pub required: bool,
    pub set: bool,
    /// Shown only for a field that is not secret (a key ID, a merchant key).
    pub value: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProviderSetup {
    pub provider: &'static str,
    pub label: &'static str,
    pub capabilities: Capabilities,
    pub configured: bool,
    pub missing: Vec<&'static str>,
    pub mode: Option<String>,
    /// Where the keys were found: `tenant_settings`, `secrets` or `env`.
    pub source: Option<&'static str>,
    pub fields: Vec<FieldView>,
    /// Calls go to a stand-in (tests and rehearsals), not the provider.
    pub stand_in: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StationProvider {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub station_type: String,
    pub payment_provider: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OnlineSettings {
    pub active_provider: String,
    pub fallback_provider: Option<String>,
    pub providers: Vec<ProviderSetup>,
    pub stations: Vec<StationProvider>,
}

async fn begin(state: &AppState, claims: &Claims) -> Result<Tx<'static>, AppError> {
    require_permission(claims, CONFIGURE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

async fn setup(
    tx: &mut Tx<'_>,
    state: &AppState,
    tenant: Uuid,
    p: &'static dyn OnlineProvider,
) -> Result<ProviderSetup, AppError> {
    let secrets = state.secret_resolver.as_ref();
    let keys = keys_for(tx, secrets, &tenant, p).await?;
    let field = |f: &KeyField| FieldView {
        name: f.name,
        label: f.label,
        secret: f.secret,
        required: f.required,
        set: keys.as_ref().is_some_and(|k| k.get(f.name).is_some()),
        value: (!f.secret)
            .then(|| {
                keys.as_ref()
                    .and_then(|k| k.get(f.name))
                    .map(ToOwned::to_owned)
            })
            .flatten(),
    };
    Ok(ProviderSetup {
        provider: p.code(),
        label: p.label(),
        capabilities: p.capabilities(),
        configured: keys.as_ref().is_some_and(|k| k.missing(p).is_empty()),
        missing: keys.as_ref().map_or_else(
            || {
                p.key_fields()
                    .iter()
                    .filter(|f| f.required)
                    .map(|f| f.name)
                    .collect()
            },
            |k| k.missing(p),
        ),
        mode: keys
            .as_ref()
            .and_then(|k| k.get("mode"))
            .map(ToOwned::to_owned),
        source: keys.as_ref().map(|k| k.source),
        fields: p.key_fields().iter().map(field).collect(),
        stand_in: overridden(secrets, p).await,
    })
}

async fn setting(tx: &mut Tx<'_>, tenant: Uuid, key: &str) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = $2 AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await?
    .and_then(|v| v.as_str().map(ToOwned::to_owned)))
}

async fn put_setting(
    tx: &mut Tx<'_>,
    tenant: Uuid,
    key: &str,
    value: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'payments', $2, $3) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, updated_at = now()",
    )
    .bind(tenant)
    .bind(key)
    .bind(value)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// `GET /api/payments/online-settings`.
pub async fn get_online_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OnlineSettings>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let tenant = claims.tenant_id;
    let mut providers = Vec::with_capacity(PROVIDERS.len());
    for p in PROVIDERS {
        providers.push(setup(&mut tx, &state, tenant, p).await?);
    }
    let stations = sqlx::query_as::<_, StationProvider>(
        "SELECT id, name, code, station_type, payment_provider FROM stations \
         WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL ORDER BY name LIMIT $2",
    )
    .bind(tenant)
    .bind(STATION_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let active_provider = setting(&mut tx, tenant, "active_provider")
        .await?
        .unwrap_or_else(|| DEFAULT_PROVIDER.to_owned());
    let fallback_provider = setting(&mut tx, tenant, "fallback_provider").await?;
    tx.commit().await?;
    Ok(Json(OnlineSettings {
        active_provider,
        fallback_provider,
        providers,
        stations,
    }))
}

/// A provider that may take payments: known and set up.
async fn usable(
    tx: &mut Tx<'_>,
    state: &AppState,
    tenant: Uuid,
    code: &str,
) -> Result<&'static dyn OnlineProvider, AppError> {
    let p = provider_for(code)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown payment provider '{code}'")))?;
    let keys = keys_for(tx, state.secret_resolver.as_ref(), &tenant, p).await?;
    match keys.map(|k| k.missing(p)) {
        Some(missing) if missing.is_empty() => Ok(p),
        _ => Err(AppError::Conflict(format!(
            "Set {}'s keys before choosing it",
            p.label()
        ))),
    }
}

#[derive(Debug, Deserialize)]
pub struct ChooseProviders {
    pub active_provider: String,
    pub fallback_provider: Option<String>,
}

/// `PUT /api/payments/online-settings` — the hospital's provider and fallback.
pub async fn put_online_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ChooseProviders>,
) -> Result<Json<Value>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let tenant = claims.tenant_id;
    let active = usable(&mut tx, &state, tenant, &body.active_provider).await?;
    let fallback = match body.fallback_provider.as_deref().filter(|c| !c.is_empty()) {
        Some(c) if c == active.code() => {
            return Err(AppError::BadRequest(
                "The fallback must be a different provider".to_owned(),
            ));
        }
        Some(c) => Some(usable(&mut tx, &state, tenant, c).await?.code()),
        None => None,
    };
    put_setting(&mut tx, tenant, "active_provider", &json!(active.code())).await?;
    put_setting(&mut tx, tenant, "fallback_provider", &json!(fallback)).await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "active_provider": active.code(), "fallback_provider": fallback }),
    ))
}

#[derive(Debug, Deserialize)]
pub struct SetKeys {
    /// Only the fields being changed; an empty value leaves a field as it is.
    #[serde(default)]
    pub values: Map<String, Value>,
    pub mode: Option<String>,
}

/// `PUT /api/payments/online-settings/keys/{provider}` — write-only keys.
pub async fn put_provider_keys(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(body): Json<SetKeys>,
) -> Result<Json<ProviderSetup>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let tenant = claims.tenant_id;
    let p = provider_for(&code)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown payment provider '{code}'")))?;
    let mut config = stored_config(&mut tx, &tenant, p.code())
        .await?
        .unwrap_or_default();
    for (name, value) in body.values {
        if !p.key_fields().iter().any(|f| f.name == name) {
            return Err(AppError::BadRequest(format!(
                "{} has no key '{name}'",
                p.label()
            )));
        }
        if let Some(v) = value.as_str().map(str::trim).filter(|v| !v.is_empty()) {
            config.insert(name, json!(v));
        }
    }
    match body.mode.as_deref() {
        Some(m @ ("test" | "live")) => {
            config.insert("mode".to_owned(), json!(m));
        }
        Some(other) => {
            return Err(AppError::BadRequest(format!(
                "Mode is test or live, not '{other}'"
            )));
        }
        None => {}
    }
    let missing: Vec<&str> = p
        .key_fields()
        .iter()
        .filter(|f| f.required && config.get(f.name).and_then(Value::as_str).is_none())
        .map(|f| f.label)
        .collect();
    if !missing.is_empty() {
        return Err(AppError::BadRequest(format!(
            "Also set: {}",
            missing.join(", ")
        )));
    }
    put_setting(
        &mut tx,
        tenant,
        &format!("{}_config", p.code()),
        &Value::Object(config),
    )
    .await?;
    let view = setup(&mut tx, &state, tenant, p).await?;
    tx.commit().await?;
    tracing::info!(provider = p.code(), by = %claims.sub, "payment provider keys changed");
    Ok(Json(view))
}

#[derive(Debug, Deserialize)]
pub struct StationChoice {
    pub payment_provider: Option<String>,
}

/// `PUT /api/payments/online-settings/stations/{id}` — a counter's own
/// provider; `null` follows the hospital.
pub async fn put_station_provider(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<StationChoice>,
) -> Result<Json<Value>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let code = match body.payment_provider.as_deref().filter(|c| !c.is_empty()) {
        Some(c) => Some(usable(&mut tx, &state, claims.tenant_id, c).await?.code()),
        None => None,
    };
    let done = sqlx::query(
        "UPDATE stations SET payment_provider = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(code)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(json!({ "id": id, "payment_provider": code })))
}

/// `POST /api/payments/online-settings/test/{provider}` — do the keys work?
pub async fn test_provider(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<Value>, AppError> {
    let mut tx = begin(&state, &claims).await?;
    let p = provider_for(&code)
        .ok_or_else(|| AppError::BadRequest(format!("Unknown payment provider '{code}'")))?;
    let secrets = state.secret_resolver.as_ref();
    let chosen = with_keys(&mut tx, secrets, claims.tenant_id, p).await?;
    tx.commit().await?;
    let Some(chosen) = chosen else {
        return Ok(Json(
            json!({ "ok": false, "message": format!("{}'s keys are not set", p.label()) }),
        ));
    };
    Ok(Json(match p.ping(&chosen.ctx()).await {
        Ok(()) => {
            json!({ "ok": true, "message": format!("{} answered and accepted the keys", p.label()) })
        }
        Err(e) => json!({ "ok": false, "message": e.words() }),
    }))
}

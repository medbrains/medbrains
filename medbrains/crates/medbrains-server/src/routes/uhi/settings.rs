//! Settings → UHI: how this hospital is registered on UHI.
//!
//! - `GET  /api/uhi/settings`      — what is set, the public key to register
//! - `PUT  /api/uhi/settings`      — services, campus, NHA's IDs, on/off
//! - `POST /api/uhi/settings/keys` — the signing key pair (`keys.rs`)
//!
//! NHA's onboarding order: choose the services → make the key pair → submit
//! the callback URL and public key → NHA issues the subscriber ID and key ID
//! → enter them → sandbox tests. So the callback URL is shown from the start
//! and never contains the subscriber ID: it is named by the hospital code.
//!
//! The key pair is generated here, or imported from NHA's header utility.
//! The private half is sealed before it is stored and no endpoint returns it.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::{permissions, secrets::SecretResolver};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::protocol::{GatewaySpec, PREVIEW_SERVICES, Service};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    routes::abdm::abha::secret_key, state::AppState,
};

pub(super) const KEY_CONTEXT: &[u8] = b"uhi-signing-key";
/// Our public address; inbound UHI calls arrive under it.
const PUBLIC_BASE_URL: &str = "MEDBRAINS_PUBLIC_BASE_URL";
/// Where inbound calls are served; the subscriber URL registered with NHA is
/// `{public base}{HSPA_PATH}/{hospital code}`.
pub const HSPA_PATH: &str = "/api/uhi/hspa";

const SUBSCRIPTION_COLUMNS: &str = "s.tenant_id, s.environment, s.subscriber_id, s.unique_key_id, \
    s.signing_public_key, s.signing_private_key_sealed, s.key_generated_at, s.services, \
    s.facility_id, f.hfr_facility_id, COALESCE(f.name, t.name) AS provider_name, s.city_code, \
    s.is_active, s.gateway_spec, lower(t.code) AS hospital_code";

/// One hospital's UHI subscription.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Subscription {
    pub tenant_id: Uuid,
    pub environment: String,
    /// Issued by NHA after registration; `None` until then.
    pub subscriber_id: Option<String>,
    pub unique_key_id: Option<String>,
    pub signing_public_key: Option<String>,
    signing_private_key_sealed: Option<String>,
    pub key_generated_at: Option<DateTime<Utc>>,
    pub services: Vec<String>,
    pub facility_id: Option<Uuid>,
    pub hfr_facility_id: Option<String>,
    pub provider_name: String,
    pub city_code: Option<String>,
    pub is_active: bool,
    pub gateway_spec: String,
    /// Names the hospital in its callback URL.
    pub hospital_code: String,
}

impl Subscription {
    /// Whether this hospital answers `service` — chosen in Settings, and a
    /// service UHI supports from a provider (or previews switched on).
    pub fn offers(&self, service: Service, preview: bool) -> bool {
        (service.is_live() || preview) && self.services.iter().any(|s| s == service.code())
    }

    pub fn spec(&self) -> GatewaySpec {
        GatewaySpec::from_code(&self.gateway_spec)
    }

    /// The subscriber ID NHA issued (empty before; such a subscription is
    /// never active, so never answers).
    pub fn subscriber(&self) -> &str {
        self.subscriber_id.as_deref().unwrap_or_default()
    }

    /// The provider ID patient apps see: the campus's HFR ID, else our
    /// subscriber ID.
    pub fn provider_id(&self) -> &str {
        self.hfr_facility_id
            .as_deref()
            .unwrap_or_else(|| self.subscriber())
    }

    /// The private signing key.
    ///
    /// # Errors
    /// 503 when there is none or it cannot be opened (the secret key changed).
    pub async fn private_key(&self, secrets: &dyn SecretResolver) -> Result<String, AppError> {
        let sealed = self.signing_private_key_sealed.as_deref().ok_or_else(|| {
            AppError::ServiceUnavailable("generate the UHI signing key first".to_owned())
        })?;
        medbrains_crypto::aead::decrypt_token(&secret_key(secrets).await?, KEY_CONTEXT, sealed)
            .map_err(|_| {
                AppError::ServiceUnavailable(
                    "the UHI signing key cannot be opened — generate a new one in Settings → UHI"
                        .to_owned(),
                )
            })
    }
}

/// This hospital's subscription, if it has one.
pub async fn load(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Option<Subscription>, AppError> {
    Ok(sqlx::query_as::<_, Subscription>(&format!(
        "SELECT {SUBSCRIPTION_COLUMNS} FROM uhi_subscriptions s \
           JOIN tenants t ON t.id = s.tenant_id \
           LEFT JOIN facilities f ON f.id = s.facility_id AND f.deleted_at IS NULL \
          WHERE s.tenant_id = $1 AND s.deleted_at IS NULL"
    ))
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// `{public base}/api/uhi/hspa/{hospital code}`, or `None` before the
/// public address is set.
pub async fn provider_uri(secrets: &dyn SecretResolver, hospital_code: &str) -> Option<String> {
    let base = secrets.get(PUBLIC_BASE_URL).await.ok()?;
    base.starts_with("http")
        .then(|| format!("{}{HSPA_PATH}/{hospital_code}", base.trim_end_matches('/')))
}

/// Whether services UHI does not support from a provider yet may be offered.
pub async fn preview_enabled(secrets: &dyn SecretResolver) -> bool {
    secrets
        .get(PREVIEW_SERVICES)
        .await
        .is_ok_and(|v| v.trim().eq_ignore_ascii_case("true"))
}

#[derive(Debug, Serialize)]
pub struct UhiSettingsView {
    pub configured: bool,
    pub environment: String,
    pub subscriber_id: Option<String>,
    pub unique_key_id: Option<String>,
    /// Register this with NHA. The private key is never sent.
    pub signing_public_key: Option<String>,
    pub key_generated_at: Option<DateTime<Utc>>,
    pub services: Vec<String>,
    pub facility_id: Option<Uuid>,
    pub hfr_facility_id: Option<String>,
    pub city_code: Option<String>,
    pub is_active: bool,
    /// `v2_0_2` or `s2` — the gateway contract this environment follows.
    pub gateway_spec: String,
    /// The services this hospital may offer as a UHI provider today.
    pub available_services: Vec<String>,
    /// The callback URL to submit to NHA; `None` until the public address is
    /// set. Known before NHA issues any ID.
    pub subscriber_url: Option<String>,
    /// Active doctors with an HPR ID — the ones consultation search offers.
    pub doctors_with_hpr: i64,
    /// Where quoted fees come from.
    pub fees: FeeSources,
    /// Whether a teleconsultation with a fee is paid online when booked
    /// (Razorpay is the active online provider) or at the hospital.
    pub online_payment: bool,
}

/// Where the fees patient apps are quoted come from.
#[derive(Debug, Serialize)]
pub struct FeeSources {
    /// Of the doctors with an HPR ID, those with their own consultation fee.
    pub doctors_with_fee: i64,
    /// The charge master's `TELECONSULT` rate, used when a doctor has none.
    pub teleconsult_charge: Option<rust_decimal::Decimal>,
    /// Lab tests the catalogue lets patients book from an app.
    pub patient_orderable_tests: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaveUhiSettings {
    pub environment: String,
    /// Empty until NHA issues them, after registration.
    #[serde(default)]
    pub subscriber_id: Option<String>,
    #[serde(default)]
    pub unique_key_id: Option<String>,
    #[serde(default)]
    pub gateway_spec: Option<String>,
    #[serde(default)]
    pub services: Vec<String>,
    pub facility_id: Option<Uuid>,
    pub city_code: Option<String>,
    #[serde(default)]
    pub is_active: bool,
}

pub(super) async fn view(state: &AppState, tenant_id: Uuid) -> Result<UhiSettingsView, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let secrets = state.secret_resolver.as_ref();
    let sub = load(&mut tx, tenant_id).await?;
    let (doctors_with_hpr, fees) = fee_sources(&mut tx, tenant_id).await?;
    let hospital_code: String = sqlx::query_scalar("SELECT lower(code) FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    let preview = preview_enabled(secrets).await;
    // Online payment exists only for teleconsultation, itself a preview.
    let online_payment = preview
        && medbrains_payment_gateway::payment_link::link_provider(&mut tx, secrets, tenant_id)
            .await?
            .is_some();
    tx.commit().await?;
    let subscriber_url = provider_uri(secrets, &hospital_code).await;
    let available_services = Service::ALL
        .into_iter()
        .filter(|s| s.is_live() || preview)
        .map(|s| s.code().to_owned())
        .collect();
    Ok(match sub {
        Some(s) => UhiSettingsView {
            configured: true,
            environment: s.environment,
            subscriber_id: s.subscriber_id,
            unique_key_id: s.unique_key_id,
            signing_public_key: s.signing_public_key,
            key_generated_at: s.key_generated_at,
            services: s.services,
            facility_id: s.facility_id,
            hfr_facility_id: s.hfr_facility_id,
            city_code: s.city_code,
            is_active: s.is_active,
            gateway_spec: s.gateway_spec,
            available_services,
            subscriber_url,
            doctors_with_hpr,
            fees,
            online_payment,
        },
        None => UhiSettingsView {
            configured: false,
            environment: "sandbox".to_owned(),
            subscriber_id: None,
            unique_key_id: None,
            signing_public_key: None,
            key_generated_at: None,
            services: Vec::new(),
            facility_id: None,
            hfr_facility_id: None,
            city_code: None,
            is_active: false,
            gateway_spec: "v2_0_2".to_owned(),
            available_services,
            subscriber_url,
            doctors_with_hpr,
            fees,
            online_payment,
        },
    })
}

/// Doctors with an HPR ID, and where their fees come from — one query.
async fn fee_sources(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<(i64, FeeSources), AppError> {
    let (with_hpr, doctors_with_fee, teleconsult_charge, patient_orderable_tests) =
        sqlx::query_as::<_, (i64, i64, Option<rust_decimal::Decimal>, i64)>(
            "SELECT count(*), count(*) FILTER (WHERE u.consultation_fee > 0), \
                    (SELECT base_price FROM charge_master WHERE tenant_id = $1 AND code = $2 \
                        AND is_active AND deleted_at IS NULL), \
                    (SELECT count(*) FROM lab_test_catalog WHERE tenant_id = $1 \
                        AND is_patient_orderable AND is_active AND deleted_at IS NULL) \
               FROM doctor_profiles dp JOIN users u ON u.id = dp.user_id \
              WHERE dp.tenant_id = $1 AND dp.is_active AND dp.deleted_at IS NULL \
                AND dp.hpr_id IS NOT NULL",
        )
        .bind(tenant_id)
        .bind(super::fees::TELECONSULT_CODE)
        .fetch_one(&mut **tx)
        .await?;
    Ok((
        with_hpr,
        FeeSources {
            doctors_with_fee,
            teleconsult_charge,
            patient_orderable_tests,
        },
    ))
}

/// `GET /api/uhi/settings`
///
/// # Errors
/// 403 without `uhi.configure`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UhiSettingsView>, AppError> {
    require_permission(&claims, permissions::uhi::CONFIGURE)?;
    Ok(Json(view(&state, claims.tenant_id).await?))
}

fn trimmed(v: Option<&String>) -> Option<&str> {
    v.map(|s| s.trim()).filter(|s| !s.is_empty())
}

fn validate(body: &SaveUhiSettings, preview: bool) -> Result<(), AppError> {
    let bad = |m: &str| Err(AppError::BadRequest(m.to_owned()));
    if !matches!(body.environment.as_str(), "sandbox" | "production") {
        return bad("environment must be sandbox or production");
    }
    if !matches!(body.gateway_spec.as_deref(), None | Some("v2_0_2" | "s2")) {
        return bad("the gateway contract must be v2_0_2 or s2");
    }
    let id = trimmed(body.subscriber_id.as_ref());
    if id.is_some_and(|id| {
        id.len() < 3
            || id.len() > 128
            || !id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
    }) {
        return bad("the subscriber ID is 3–128 letters, digits, dots, dashes or underscores");
    }
    if id.is_some() != trimmed(body.unique_key_id.as_ref()).is_some() {
        return bad("NHA issues the subscriber ID and the key ID together — enter both");
    }
    for code in &body.services {
        match Service::from_code(code) {
            None => return bad("unknown UHI service"),
            Some(s) if !s.is_live() && !preview => {
                return bad(
                    "UHI does not support teleconsultation or lab tests from a hospital yet — \
                     offer physical consultation, ambulance or blood availability",
                );
            }
            Some(_) => {}
        }
    }
    Ok(())
}

/// Why UHI cannot be switched on yet, if it cannot: NHA admits only
/// registered, HFR-credentialed facilities.
async fn activation_blocker(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    body: &SaveUhiSettings,
) -> Result<Option<&'static str>, AppError> {
    let has_key = load(tx, tenant_id)
        .await?
        .is_some_and(|s| s.signing_public_key.is_some());
    if !has_key {
        return Ok(Some("generate the signing key before switching UHI on"));
    }
    if trimmed(body.subscriber_id.as_ref()).is_none() {
        return Ok(Some(
            "enter the subscriber ID and key ID NHA issued before switching UHI on",
        ));
    }
    let hfr: Option<String> = match body.facility_id {
        Some(id) => sqlx::query_scalar(
            "SELECT hfr_facility_id FROM facilities WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .flatten(),
        None => None,
    };
    Ok(hfr
        .as_deref()
        .is_none_or(|h| h.trim().is_empty())
        .then_some(
            "choose a campus with an HFR facility ID — NHA admits only HFR-registered facilities",
        ))
}

/// `PUT /api/uhi/settings`
///
/// # Errors
/// 400 for an invalid subscriber or service, or switching on without a key;
/// 409 when another hospital holds the subscriber ID.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SaveUhiSettings>,
) -> Result<Json<UhiSettingsView>, AppError> {
    require_permission(&claims, permissions::uhi::CONFIGURE)?;
    validate(&body, preview_enabled(state.secret_resolver.as_ref()).await)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    if body.is_active
        && let Some(why) = activation_blocker(&mut tx, claims.tenant_id, &body).await?
    {
        return Err(AppError::BadRequest(why.to_owned()));
    }
    let city = body
        .city_code
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    // The proposed row is CHECKed before ON CONFLICT resolves, and a new row
    // has no key yet, so it goes in inactive; only the update sets the flag.
    sqlx::query(
        "INSERT INTO uhi_subscriptions (tenant_id, environment, subscriber_id, unique_key_id, \
            services, facility_id, city_code, is_active, updated_by, gateway_spec) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $9, $10) \
         ON CONFLICT (tenant_id) WHERE deleted_at IS NULL DO UPDATE SET \
            environment = EXCLUDED.environment, subscriber_id = EXCLUDED.subscriber_id, \
            unique_key_id = EXCLUDED.unique_key_id, services = EXCLUDED.services, \
            facility_id = EXCLUDED.facility_id, city_code = EXCLUDED.city_code, \
            is_active = $8, updated_by = EXCLUDED.updated_by, \
            gateway_spec = EXCLUDED.gateway_spec",
    )
    .bind(claims.tenant_id)
    .bind(&body.environment)
    .bind(trimmed(body.subscriber_id.as_ref()))
    .bind(trimmed(body.unique_key_id.as_ref()))
    .bind(&body.services)
    .bind(body.facility_id)
    .bind(city)
    .bind(body.is_active)
    .bind(claims.sub)
    .bind(body.gateway_spec.as_deref().unwrap_or("v2_0_2"))
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        let taken = e.as_database_error().and_then(|d| d.constraint())
            == Some("uq_uhi_subscriptions_subscriber");
        if taken {
            AppError::Conflict("another hospital is registered with this subscriber ID".to_owned())
        } else {
            AppError::from(e)
        }
    })?;
    tx.commit().await?;
    Ok(Json(view(&state, claims.tenant_id).await?))
}

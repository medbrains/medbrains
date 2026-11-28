use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Wizard progress tracker per tenant.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OnboardingProgress {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub current_step: i32,
    pub completed_steps: serde_json::Value,
    pub is_complete: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Key-value tenant settings with category grouping.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TenantSettings {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: String,
    pub key: String,
    pub value: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Per-tenant module enable/disable configuration.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ModuleConfig {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub status: ModuleStatus,
    pub config: serde_json::Value,
    pub depends_on: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// This brick's background jobs and whether this server runs them; not stored.
    #[sqlx(skip)]
    #[serde(default)]
    pub background_jobs: Vec<BackgroundJobStatus>,
    /// Whether the module check answers for it now (its own status and every brick it needs);
    /// not stored. An edition brick with no row or `available` is on, never set up.
    #[sqlx(skip)]
    #[serde(default)]
    pub on: bool,
}

/// One brick background job as the Modules screen shows it.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BackgroundJobStatus {
    pub id: String,
    pub label: String,
    pub running: bool,
}

/// Module activation status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "module_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ModuleStatus {
    Available,
    Enabled,
    Disabled,
    ComingSoon,
}

impl ModuleStatus {
    /// The stored `module_status` label, as the module check reads it.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::Enabled => "enabled",
            Self::Disabled => "disabled",
            Self::ComingSoon => "coming_soon",
        }
    }
}

/// Licensed add-ons: sold apart from the edition, so they are off until an
/// operator sets `enabled`. An absent row or `available` refuses them; for the
/// edition's own modules an absent row still means on.
///
/// Listed explicitly — a code missing here is treated as core (absent = on).
pub const ADD_ON_MODULES: &[&str] = &["companion"];

/// Whether `code` is a licensed add-on (see [`ADD_ON_MODULES`]).
#[must_use]
pub fn is_add_on_module(code: &str) -> bool {
    ADD_ON_MODULES.contains(&code)
}

/// Custom role with JSONB permissions.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CustomRole {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: serde_json::Value,
    pub field_access_defaults: serde_json::Value,
    pub widget_access_defaults: serde_json::Value,
    pub is_system: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Bed type with daily rate for IPD billing.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BedType {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub daily_rate: Decimal,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Tax applicability classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "tax_applicability", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TaxApplicability {
    Taxable,
    Exempt,
    ZeroRated,
}

/// Tax category (GST slabs, exemptions).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaxCategory {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub rate_percent: Decimal,
    pub applicability: TaxApplicability,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Accepted payment method for billing.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PaymentMethod {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

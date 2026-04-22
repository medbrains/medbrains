//! # Screen Masters
//!
//! Config-driven page layout system. Screens define full page configurations
//! (layout, forms, data tables, actions, sidecars) stored as JSONB in `PostgreSQL`.
//! Supports versioning, tenant overrides, and pipeline-triggered sidecars.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::form::FormStatus;

// ── Enums ──────────────────────────────────────────────────

/// The type of screen layout.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "screen_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ScreenType {
    /// Data entry page (patient registration, lab order).
    Form,
    /// Data table with filters (patient list, OPD queue).
    List,
    /// Single record view (patient profile).
    Detail,
    /// Mixed layout: form + table + stats (OPD consultation).
    Composite,
    /// Multi-step workflow (onboarding, discharge).
    Wizard,
    /// Widget grid (department dashboard).
    Dashboard,
    /// Schedule/appointment views.
    Calendar,
    /// Status board (lab pipeline, bed management).
    Kanban,
}

/// Event that triggers a screen sidecar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sidecar_trigger", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SidecarTrigger {
    ScreenLoad,
    ScreenExit,
    FormSubmit,
    FormValidate,
    FormSaveDraft,
    FieldChange,
    RowSelect,
    RowAction,
    Interval,
    StepEnter,
    StepLeave,
}

// ── Database Row Types ─────────────────────────────────────

/// A screen master definition — full page configuration.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenMaster {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub screen_type: ScreenType,
    pub module_code: Option<String>,
    pub status: FormStatus,
    pub version: i32,
    pub layout: serde_json::Value,
    pub config: serde_json::Value,
    pub route_path: Option<String>,
    pub icon: Option<String>,
    pub permission_code: Option<String>,
    pub is_system: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub published_at: Option<DateTime<Utc>>,
    pub published_by: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Links a screen to a form it references.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenFormRef {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub form_code: String,
    pub zone_key: String,
    pub created_at: DateTime<Utc>,
}

/// Per-tenant customization of a system screen.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TenantScreenOverride {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub screen_id: Uuid,
    pub layout_patch: serde_json::Value,
    pub config_patch: serde_json::Value,
    pub hidden_zones: serde_json::Value,
    pub extra_actions: serde_json::Value,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Immutable published version of a screen.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenVersionSnapshot {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub version: i32,
    pub name: String,
    pub screen_type: ScreenType,
    pub status: FormStatus,
    pub layout: serde_json::Value,
    pub config: serde_json::Value,
    pub form_refs: serde_json::Value,
    pub sidecars: serde_json::Value,
    pub change_summary: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Summary row for version listing (excludes heavy JSONB).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenVersionSummary {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub version: i32,
    pub name: String,
    pub screen_type: ScreenType,
    pub status: FormStatus,
    pub change_summary: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Pipeline trigger linked to a screen.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenSidecar {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub trigger_event: SidecarTrigger,
    pub trigger_config: serde_json::Value,
    pub pipeline_id: Option<Uuid>,
    pub inline_action: Option<serde_json::Value>,
    pub condition: Option<serde_json::Value>,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Audit log entry for screen changes.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenAuditEntry {
    pub id: Uuid,
    pub screen_id: Uuid,
    pub action: String,
    pub previous_state: Option<serde_json::Value>,
    pub new_state: serde_json::Value,
    pub changed_fields: Option<Vec<String>>,
    pub changed_by: Option<Uuid>,
    pub changed_at: DateTime<Utc>,
}

// ── API Response Types ─────────────────────────────────────

/// Summary for list views — excludes heavy layout JSONB.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScreenSummary {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub screen_type: ScreenType,
    pub module_code: Option<String>,
    pub status: FormStatus,
    pub version: i32,
    pub route_path: Option<String>,
    pub icon: Option<String>,
    pub permission_code: Option<String>,
    pub is_system: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Fully resolved screen merged with tenant overrides.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedScreen {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub screen_type: ScreenType,
    pub module_code: Option<String>,
    pub version: i32,
    pub layout: serde_json::Value,
    pub config: serde_json::Value,
    pub route_path: Option<String>,
    pub icon: Option<String>,
    pub permission_code: Option<String>,
    pub sidecars: Vec<ResolvedSidecar>,
}

/// Sidecar definition included in a resolved screen.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedSidecar {
    pub id: Uuid,
    pub name: String,
    pub trigger_event: SidecarTrigger,
    pub trigger_config: serde_json::Value,
    pub pipeline_id: Option<Uuid>,
    pub inline_action: Option<serde_json::Value>,
    pub condition: Option<serde_json::Value>,
}

// ── Module Sidecars ──────────────────────────────────────

/// Module-level sidecar: tied to a module + context rather than a specific screen.
/// Allows hardcoded clinical pages to participate in the pipeline/sidecar system.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ModuleSidecar {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub module_code: String,
    pub context_code: String,
    pub name: String,
    pub trigger_event: SidecarTrigger,
    pub pipeline_id: Option<Uuid>,
    pub inline_action: Option<serde_json::Value>,
    pub condition: Option<serde_json::Value>,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

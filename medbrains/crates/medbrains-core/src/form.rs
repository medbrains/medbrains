//! # Form Master / Field Master / Module Linker
//!
//! Configuration-driven form system where fields have regulatory body links,
//! forms are composed from fields, and requirement levels are computed per-tenant
//! based on which regulatory bodies the tenant has selected.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

/// Per-user/role access level for a specific field.
/// Determines whether a field is editable, read-only, masked, or hidden for a given user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum FieldAccessLevel {
    /// User can see and modify the field (default).
    #[default]
    Edit,
    /// User can see the field but cannot modify it (read-only).
    View,
    /// User can see a masked value but cannot modify or reveal the raw value.
    Mask,
    /// Field is completely hidden from the user.
    Hidden,
}

/// Data type for a field — drives Mantine component selection and Zod schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "field_data_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum FieldDataType {
    Text,
    Email,
    Phone,
    Date,
    Datetime,
    Time,
    Select,
    Multiselect,
    Checkbox,
    Radio,
    Textarea,
    Number,
    Decimal,
    File,
    Hidden,
    Computed,
    Boolean,
    UuidFk,
    Json,
}

/// How strongly a regulatory body requires a field.
/// Ordered: `Mandatory > Conditional > Recommended > Optional`.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, sqlx::Type,
)]
#[sqlx(type_name = "requirement_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RequirementLevel {
    /// Field has no specific regulatory requirement.
    Optional = 0,
    /// Regulatory body recommends capturing this field.
    Recommended = 1,
    /// Required only when a condition is met (e.g., patient is minor).
    Conditional = 2,
    /// Always required — cannot be left empty.
    Mandatory = 3,
}

/// Lifecycle status of a form definition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "form_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum FormStatus {
    Draft,
    Active,
    Deprecated,
}

// ── Database Row Types ─────────────────────────────────────

/// Central registry of all fields with metadata and regulatory links.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FieldMaster {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub data_type: FieldDataType,
    pub default_value: Option<String>,
    pub placeholder: Option<String>,
    pub validation: Option<serde_json::Value>,
    pub ui_component: Option<String>,
    pub ui_width: Option<String>,
    pub fhir_path: Option<String>,
    pub db_table: Option<String>,
    pub db_column: Option<String>,
    pub condition: Option<serde_json::Value>,
    pub data_source: Option<serde_json::Value>,
    pub actions: Option<serde_json::Value>,
    pub is_system: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Maps a field to a regulatory body with requirement level and clause reference.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FieldRegulatoryLink {
    pub id: Uuid,
    pub field_id: Uuid,
    pub regulatory_body_id: Uuid,
    pub requirement_level: RequirementLevel,
    pub clause_reference: Option<String>,
    pub clause_code: Option<String>,
    pub description: Option<String>,
    pub condition_override: Option<serde_json::Value>,
}

/// A form definition composed of sections and fields.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormMaster {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub version: i32,
    pub status: FormStatus,
    pub config: Option<serde_json::Value>,
    pub published_at: Option<DateTime<Utc>>,
    pub published_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A section within a form (visual grouping).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormSection {
    pub id: Uuid,
    pub form_id: Uuid,
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_collapsible: bool,
    pub is_default_open: bool,
    pub icon: Option<String>,
    pub color: Option<String>,
}

/// Links a field to a form within a specific section.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormField {
    pub id: Uuid,
    pub form_id: Uuid,
    pub section_id: Uuid,
    pub field_id: Uuid,
    pub sort_order: i32,
    pub label_override: Option<String>,
    pub is_quick_mode: bool,
    pub data_source_override: Option<serde_json::Value>,
    pub actions_override: Option<serde_json::Value>,
    pub icon: Option<String>,
    pub icon_position: Option<String>,
}

/// Links a form to a module with a usage context.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ModuleFormLink {
    pub module_code: String,
    pub form_id: Uuid,
    pub context: String,
}

/// Per-tenant customization of a field (can only upgrade, never downgrade).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TenantFieldOverride {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub field_id: Uuid,
    pub form_id: Option<Uuid>,
    pub label_override: Option<String>,
    pub requirement_override: Option<RequirementLevel>,
    pub is_hidden: bool,
    pub validation_override: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── API Response Types (not FromRow) ───────────────────────

/// Fully resolved form definition computed per-tenant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedFormDefinition {
    pub form_code: String,
    pub form_name: String,
    pub version: i32,
    pub config: Option<serde_json::Value>,
    pub sections: Vec<ResolvedSection>,
}

/// A resolved section containing its fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedSection {
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_collapsible: bool,
    pub is_default_open: bool,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub fields: Vec<ResolvedField>,
}

/// A fully resolved field with computed requirement level and regulatory hints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedField {
    pub field_code: String,
    pub label: String,
    pub description: Option<String>,
    pub data_type: FieldDataType,
    pub requirement_level: RequirementLevel,
    pub default_value: Option<String>,
    pub placeholder: Option<String>,
    pub validation: Option<serde_json::Value>,
    pub ui_component: Option<String>,
    pub ui_width: Option<String>,
    pub ui_hint: Option<String>,
    pub icon: Option<String>,
    pub icon_position: Option<String>,
    pub condition: Option<serde_json::Value>,
    pub is_quick_mode: bool,
    pub is_hidden: bool,
    pub access_level: FieldAccessLevel,
    pub regulatory_clauses: Vec<RegulatoryClauseRef>,
    pub data_source: Option<serde_json::Value>,
    pub actions: Option<serde_json::Value>,
}

/// A reference to a specific regulatory clause for UI tooltips.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegulatoryClauseRef {
    pub body_code: String,
    pub body_name: String,
    pub clause_code: Option<String>,
    pub clause_reference: Option<String>,
    pub requirement_level: RequirementLevel,
}

// ── Query Helper Types ─────────────────────────────────────

/// Joined row from the form + section + field + `field_master` query.
#[derive(Debug, sqlx::FromRow)]
pub struct FormFieldJoinRow {
    // form_fields
    pub ff_id: Uuid,
    pub ff_sort_order: i32,
    pub ff_label_override: Option<String>,
    pub ff_is_quick_mode: bool,
    // form_sections
    pub fs_code: String,
    pub fs_name: String,
    pub fs_sort_order: i32,
    pub fs_is_collapsible: bool,
    pub fs_is_default_open: bool,
    pub fs_icon: Option<String>,
    pub fs_color: Option<String>,
    // field_masters
    pub fm_code: String,
    pub fm_name: String,
    pub fm_description: Option<String>,
    pub fm_data_type: FieldDataType,
    pub fm_default_value: Option<String>,
    pub fm_placeholder: Option<String>,
    pub fm_validation: Option<serde_json::Value>,
    pub fm_ui_component: Option<String>,
    pub fm_ui_width: Option<String>,
    pub fm_condition: Option<serde_json::Value>,
    pub fm_data_source: Option<serde_json::Value>,
    pub fm_actions: Option<serde_json::Value>,
    pub ff_data_source_override: Option<serde_json::Value>,
    pub ff_actions_override: Option<serde_json::Value>,
    pub ff_icon: Option<String>,
    pub ff_icon_position: Option<String>,
}

/// Row returned from the regulatory links query.
#[derive(Debug, sqlx::FromRow)]
pub struct RegulatoryLinkRow {
    pub field_id: Uuid,
    pub requirement_level: RequirementLevel,
    pub clause_reference: Option<String>,
    pub clause_code: Option<String>,
    pub body_code: String,
    pub body_name: String,
}

/// Row for tenant field overrides.
#[derive(Debug, sqlx::FromRow)]
pub struct TenantOverrideRow {
    pub field_id: Uuid,
    pub label_override: Option<String>,
    pub requirement_override: Option<RequirementLevel>,
    pub is_hidden: bool,
    pub validation_override: Option<serde_json::Value>,
}

// ── Versioning Types ─────────────────────────────────────

/// A full version snapshot including the JSONB payload.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormVersionSnapshot {
    pub id: Uuid,
    pub form_id: Uuid,
    pub version: i32,
    pub name: String,
    pub status: FormStatus,
    pub config: Option<serde_json::Value>,
    pub snapshot: serde_json::Value,
    pub change_summary: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Summary row for version listing (excludes heavy snapshot JSONB).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FormVersionSummary {
    pub id: Uuid,
    pub form_id: Uuid,
    pub version: i32,
    pub name: String,
    pub status: FormStatus,
    pub config: Option<serde_json::Value>,
    pub change_summary: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Audit log entry for field master changes.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FieldMasterAuditEntry {
    pub id: Uuid,
    pub field_id: Uuid,
    pub action: String,
    pub previous_state: Option<serde_json::Value>,
    pub new_state: serde_json::Value,
    pub changed_fields: Option<Vec<String>>,
    pub changed_by: Option<Uuid>,
    pub changed_by_name: Option<String>,
    pub changed_at: DateTime<Utc>,
}

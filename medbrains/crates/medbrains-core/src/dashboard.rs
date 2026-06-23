//! Dashboard and widget types for the configurable dashboard system.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ──────────────────────────────────────────────
//  Enums
// ──────────────────────────────────────────────

/// Widget type — determines rendering and data resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "widget_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum WidgetType {
    StatCard,
    DataTable,
    List,
    Chart,
    QuickActions,
    ModuleEmbed,
    FormEmbed,
    SystemHealth,
    CustomHtml,
}

// ──────────────────────────────────────────────
//  Dashboard
// ──────────────────────────────────────────────

/// Full dashboard record.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Dashboard {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub role_codes: serde_json::Value,
    pub department_ids: serde_json::Value,
    pub group_ids: serde_json::Value,
    pub layout_config: serde_json::Value,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub cloned_from: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Summary for listing dashboards.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DashboardSummary {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub role_codes: serde_json::Value,
    pub department_ids: serde_json::Value,
    pub user_id: Option<Uuid>,
    pub is_active: bool,
    pub widget_count: i64,
    pub created_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Dashboard Widget
// ──────────────────────────────────────────────

/// A single widget placed on a dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DashboardWidget {
    pub id: Uuid,
    pub dashboard_id: Uuid,
    pub widget_type: WidgetType,
    pub title: String,
    pub subtitle: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub config: serde_json::Value,
    pub data_source: serde_json::Value,
    pub data_filters: serde_json::Value,
    /// Per-audience overrides (role/group/user) — see migration 0198.
    #[serde(default)]
    pub variants: serde_json::Value,
    pub position_x: i32,
    pub position_y: i32,
    pub width: i32,
    pub height: i32,
    pub min_width: i32,
    pub min_height: i32,
    pub refresh_interval: Option<i32>,
    pub is_visible: bool,
    pub permission_code: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Widget Template
// ──────────────────────────────────────────────

/// Reusable widget template (system or tenant-specific).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WidgetTemplate {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub widget_type: WidgetType,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub default_config: serde_json::Value,
    pub default_source: serde_json::Value,
    pub default_width: i32,
    pub default_height: i32,
    pub category: String,
    pub is_system: bool,
    pub required_permissions: serde_json::Value,
    pub required_departments: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Composite Responses
// ──────────────────────────────────────────────

/// Dashboard with all its widgets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardWithWidgets {
    pub dashboard: Dashboard,
    pub widgets: Vec<DashboardWidget>,
}

//! Audit trail domain types — centralized audit log, access log, statistics.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Audit Log ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditEntry {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub prev_hash: Option<String>,
    pub hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Full audit log entry with joined user name, for detail view.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLogEntry {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub user_name: Option<String>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub module: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Summary row for list views (no old/new values payload).
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLogSummary {
    pub id: Uuid,
    pub user_name: Option<String>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub module: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Access Log ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AccessLogEntry {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_name: Option<String>,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub action: String,
    pub ip_address: Option<String>,
    pub module: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Query Parameters ───────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AuditLogQuery {
    pub module: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub user_id: Option<String>,
    pub action: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    /// Export format: "csv" (default) or "json"
    pub format: Option<String>,
}

// ── Integrity Check ───────────────────────────────────────

/// Row used for hash chain verification.
#[derive(Debug, sqlx::FromRow)]
pub struct AuditHashRow {
    pub id: Uuid,
    pub prev_hash: Option<String>,
    pub hash: Option<String>,
}

/// Result of an audit log integrity verification.
#[derive(Debug, Serialize)]
pub struct IntegrityResult {
    pub valid: bool,
    pub total_checked: i64,
    pub broken_at: Option<Uuid>,
    pub expected_hash: Option<String>,
    pub actual_prev_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AccessLogQuery {
    pub patient_id: Option<String>,
    pub user_id: Option<String>,
    pub entity_type: Option<String>,
    pub module: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ── Statistics ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct AuditStats {
    pub total_entries: i64,
    pub today_entries: i64,
    pub top_modules: Vec<ModuleCount>,
    pub top_users: Vec<UserActionCount>,
    pub action_breakdown: Vec<ActionCount>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ModuleCount {
    pub module: Option<String>,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserActionCount {
    pub user_name: Option<String>,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ActionCount {
    pub action: String,
    pub count: i64,
}

// ── Distinct Value Row ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DistinctValue {
    pub value: Option<String>,
}

// ── Requests ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LogAccessRequest {
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub module: Option<String>,
}

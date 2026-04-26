//! Core types for the Orchestration Engine.
//!
//! Covers the event registry, connectors, job queue, scheduled jobs,
//! custom code snippets, and the event gate result used by lifecycle hooks.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Event Registry ──────────────────────────────────────────

/// A registered system or custom event in the event registry.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EventRegistryRow {
    pub id: Uuid,
    pub module: String,
    pub entity: String,
    pub action: String,
    pub event_code: String,
    pub description: Option<String>,
    pub payload_schema: serde_json::Value,
    pub is_system: bool,
    /// `"before"` or `"after"` — determines lifecycle phase.
    pub phase: String,
    pub is_blocking: bool,
    pub category: String,
    pub created_at: DateTime<Utc>,
}

// ── Connectors ──────────────────────────────────────────────

/// An external system connector (Razorpay, Twilio, SMTP, etc.).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConnectorRow {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub connector_type: String,
    pub name: String,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub status: String,
    pub health_check_url: Option<String>,
    pub last_health_check: Option<DateTime<Utc>>,
    pub is_healthy: Option<bool>,
    pub retry_config: serde_json::Value,
    pub rate_limit: serde_json::Value,
    pub stats: serde_json::Value,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Job Queue ───────────────────────────────────────────────

/// A job in the async processing queue.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct JobQueueRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub job_type: String,
    pub pipeline_id: Option<Uuid>,
    pub execution_id: Option<Uuid>,
    pub connector_id: Option<Uuid>,
    pub payload: serde_json::Value,
    pub status: String,
    pub priority: i32,
    pub max_retries: i32,
    pub retry_count: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub locked_by: Option<String>,
    pub locked_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub correlation_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ── Scheduled Jobs ──────────────────────────────────────────

/// A cron-triggered scheduled job definition.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScheduledJobRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pipeline_id: Uuid,
    pub name: String,
    pub cron_expression: String,
    pub timezone: String,
    pub input_data: serde_json::Value,
    pub next_run_at: DateTime<Utc>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub last_status: Option<String>,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Custom Code Snippets ────────────────────────────────────

/// A user-defined code snippet for custom pipeline logic.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CustomCodeSnippet {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub language: String,
    pub code: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
    pub is_active: bool,
    pub version: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Lifecycle Result ────────────────────────────────────────

/// Result of a before-event gate check.
///
/// If `allowed` is `false`, the calling module MUST abort the operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventGateResult {
    pub allowed: bool,
    pub reason: Option<String>,
    pub enrichments: Option<serde_json::Value>,
}

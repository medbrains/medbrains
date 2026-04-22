use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_channel", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommChannel {
    Sms,
    Whatsapp,
    Email,
    Push,
    Ivr,
    Portal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_message_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommMessageStatus {
    Queued,
    Sent,
    Delivered,
    Failed,
    Read,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_template_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommTemplateType {
    AppointmentReminder,
    LabResult,
    DischargeSummary,
    Billing,
    MedicationReminder,
    FollowUp,
    Generic,
    Marketing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_clinical_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommClinicalPriority {
    Routine,
    Urgent,
    Critical,
    Stat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_alert_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommAlertStatus {
    Triggered,
    Acknowledged,
    Escalated,
    Resolved,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_complaint_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommComplaintStatus {
    Open,
    Assigned,
    InProgress,
    PendingReview,
    Resolved,
    Closed,
    Reopened,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_complaint_source", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommComplaintSource {
    WalkIn,
    Phone,
    Email,
    Portal,
    Kiosk,
    SocialMedia,
    GoogleReview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "comm_feedback_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CommFeedbackType {
    Bedside,
    PostDischarge,
    Nps,
    Department,
    Kiosk,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub template_name: String,
    pub template_code: String,
    pub channel: CommChannel,
    pub template_type: CommTemplateType,
    pub subject: Option<String>,
    pub body_template: String,
    pub placeholders: Option<serde_json::Value>,
    pub language: Option<String>,
    pub is_active: bool,
    pub requires_approval: bool,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub external_template_id: Option<String>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommMessage {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub message_code: String,
    pub template_id: Option<Uuid>,
    pub channel: CommChannel,
    pub status: CommMessageStatus,
    pub recipient_type: Option<String>,
    pub recipient_id: Option<Uuid>,
    pub recipient_name: Option<String>,
    pub recipient_contact: String,
    pub subject: Option<String>,
    pub body: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub read_at: Option<DateTime<Utc>>,
    pub failed_at: Option<DateTime<Utc>>,
    pub failure_reason: Option<String>,
    pub external_message_id: Option<String>,
    pub context_type: Option<String>,
    pub context_id: Option<Uuid>,
    pub retry_count: Option<i32>,
    pub sent_by: Option<Uuid>,
    pub cost: Option<Decimal>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommClinicalMessage {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub message_code: String,
    pub sender_id: Uuid,
    pub recipient_id: Uuid,
    pub recipient_department_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub priority: CommClinicalPriority,
    pub message_type: String,
    pub subject: Option<String>,
    pub body: String,
    pub sbar_data: Option<serde_json::Value>,
    pub is_read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub is_urgent: bool,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub parent_message_id: Option<Uuid>,
    pub attachments: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommCriticalAlert {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub alert_code: String,
    pub alert_source: String,
    pub source_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub department_id: Option<Uuid>,
    pub priority: CommClinicalPriority,
    pub status: CommAlertStatus,
    pub title: String,
    pub description: String,
    pub alert_value: Option<String>,
    pub normal_range: Option<String>,
    pub triggered_at: DateTime<Utc>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub resolution_notes: Option<String>,
    pub escalation_level: Option<i32>,
    pub escalated_at: Option<DateTime<Utc>>,
    pub escalated_to: Option<Uuid>,
    pub notification_log: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommComplaint {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub complaint_code: String,
    pub source: CommComplaintSource,
    pub status: CommComplaintStatus,
    pub patient_id: Option<Uuid>,
    pub complainant_name: String,
    pub complainant_phone: Option<String>,
    pub complainant_email: Option<String>,
    pub department_id: Option<Uuid>,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub subject: String,
    pub description: String,
    pub severity: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub assigned_at: Option<DateTime<Utc>>,
    pub sla_hours: Option<i32>,
    pub sla_deadline: Option<DateTime<Utc>>,
    pub sla_breached: bool,
    pub sla_breached_at: Option<DateTime<Utc>>,
    pub resolution_notes: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by: Option<Uuid>,
    pub satisfaction_score: Option<i32>,
    pub service_recovery_action: Option<String>,
    pub service_recovery_cost: Option<Decimal>,
    pub escalation_level: Option<i32>,
    pub escalation_history: Option<serde_json::Value>,
    pub google_review_id: Option<String>,
    pub external_reference: Option<String>,
    pub attachments: Option<serde_json::Value>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommFeedbackSurvey {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub feedback_code: String,
    pub feedback_type: CommFeedbackType,
    pub patient_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub overall_rating: Option<i32>,
    pub nps_score: Option<i32>,
    pub wait_time_rating: Option<i32>,
    pub staff_rating: Option<i32>,
    pub cleanliness_rating: Option<i32>,
    pub food_rating: Option<i32>,
    pub communication_rating: Option<i32>,
    pub discharge_rating: Option<i32>,
    pub would_recommend: Option<bool>,
    pub comments: Option<String>,
    pub suggestions: Option<String>,
    pub is_anonymous: bool,
    pub channel: Option<String>,
    pub survey_data: Option<serde_json::Value>,
    pub submitted_at: DateTime<Utc>,
    pub waiting_time_minutes: Option<i32>,
    pub collection_point: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CommEscalationRule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub rule_name: String,
    pub rule_type: String,
    pub department_id: Option<Uuid>,
    pub is_active: bool,
    pub trigger_condition: serde_json::Value,
    pub escalation_chain: serde_json::Value,
    pub max_escalation_level: Option<i32>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

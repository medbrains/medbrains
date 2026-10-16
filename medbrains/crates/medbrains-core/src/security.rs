use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Enums ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sec_access_method", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SecAccessMethod {
    Card,
    Biometric,
    Pin,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sec_zone_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SecZoneLevel {
    Public,
    General,
    Restricted,
    HighSecurity,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sec_incident_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SecIncidentSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sec_incident_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SecIncidentStatus {
    Reported,
    Investigating,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sec_patient_tag_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SecPatientTagType {
    InfantRfid,
    WanderGuard,
    ElopementRisk,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "sec_tag_alert_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SecTagAlertStatus {
    Active,
    AlertTriggered,
    Resolved,
    Deactivated,
}

// ── Structs ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityZone {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub zone_code: String,
    pub level: SecZoneLevel,
    pub department_id: Option<Uuid>,
    pub description: Option<String>,
    pub allowed_methods: Option<serde_json::Value>,
    pub after_hours_restricted: bool,
    pub after_hours_start: Option<String>,
    pub after_hours_end: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityAccessLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub zone_id: Uuid,
    pub employee_id: Option<Uuid>,
    pub person_name: Option<String>,
    pub access_method: SecAccessMethod,
    pub card_number: Option<String>,
    pub direction: String,
    pub granted: bool,
    pub denied_reason: Option<String>,
    pub is_after_hours: bool,
    pub accessed_at: DateTime<Utc>,
    pub device_id: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityAccessCard {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub employee_id: Uuid,
    pub card_number: String,
    pub card_type: Option<String>,
    pub issued_date: NaiveDate,
    pub expiry_date: Option<NaiveDate>,
    pub allowed_zones: Option<serde_json::Value>,
    pub is_active: bool,
    pub deactivated_at: Option<DateTime<Utc>>,
    pub deactivation_reason: Option<String>,
    pub issued_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityCamera {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub camera_id: Option<String>,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub camera_type: Option<String>,
    pub resolution: Option<String>,
    pub is_recording: bool,
    pub retention_days: i32,
    pub ip_address: Option<String>,
    pub is_active: bool,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityIncident {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub incident_number: String,
    pub severity: SecIncidentSeverity,
    pub status: SecIncidentStatus,
    pub category: String,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub description: String,
    pub persons_involved: Option<serde_json::Value>,
    pub witnesses: Option<serde_json::Value>,
    pub camera_ids: Option<serde_json::Value>,
    pub video_timestamp_start: Option<String>,
    pub video_timestamp_end: Option<String>,
    pub police_notified: bool,
    pub police_report_number: Option<String>,
    pub investigation_notes: Option<String>,
    pub resolution: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub reported_by: Option<Uuid>,
    pub assigned_to: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // ── Breach register (migration 1069) ──
    /// When the incident was noticed — the start of every reporting clock.
    pub discovered_at: Option<DateTime<Utc>>,
    /// A CERT-In Annexure I incident: report within 6 hours of noticing.
    pub is_cert_in_reportable: bool,
    /// A DPDP personal-data breach: Board without delay, detailed report in
    /// 72 hours, and a notice to each affected Data Principal.
    pub is_personal_data_breach: bool,
    pub breach_data_categories: Vec<String>,
    pub principals_affected_estimate: Option<i32>,
    pub cert_in_reported: bool,
    pub cert_in_report_date: Option<DateTime<Utc>>,
    pub cert_in_reference: Option<String>,
    pub board_intimated_at: Option<DateTime<Utc>>,
    pub board_report_sent_at: Option<DateTime<Utc>>,
    pub board_reference: Option<String>,
    pub principals_notified_at: Option<DateTime<Utc>>,
    pub principals_notified_count: Option<i32>,
    /// `discovered_at` + 6 h, when CERT-In reportable. Filled by [`Self::with_deadlines`].
    #[sqlx(skip)]
    #[serde(default)]
    pub cert_in_due_at: Option<DateTime<Utc>>,
    /// `discovered_at` + 72 h, when a personal-data breach. Filled by [`Self::with_deadlines`].
    #[sqlx(skip)]
    #[serde(default)]
    pub board_due_at: Option<DateTime<Utc>>,
}

/// CERT-In Directions 2022, direction (ii): report within 6 hours of noticing.
pub const CERT_IN_REPORT_HOURS: i64 = 6;
/// DPDP Rules 2025, rule 7(2): detailed report to the Board within 72 hours.
pub const BOARD_REPORT_HOURS: i64 = 72;

impl SecurityIncident {
    /// Computes the reporting deadlines from `discovered_at` — one rule for
    /// the screen, the API and the escalation pass.
    #[must_use]
    pub fn with_deadlines(mut self) -> Self {
        let discovered = self.discovered_at;
        let due = |hours: i64, applies: bool| {
            discovered
                .filter(|_| applies)
                .map(|at| at + chrono::Duration::hours(hours))
        };
        self.cert_in_due_at = due(CERT_IN_REPORT_HOURS, self.is_cert_in_reportable);
        self.board_due_at = due(BOARD_REPORT_HOURS, self.is_personal_data_breach);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityPatientTag {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub tag_type: SecPatientTagType,
    pub tag_identifier: Option<String>,
    pub allowed_zone_id: Option<Uuid>,
    pub alert_status: SecTagAlertStatus,
    pub mother_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub activated_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
    pub activated_by: Option<Uuid>,
    pub deactivated_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityTagAlert {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub tag_id: Uuid,
    pub alert_type: String,
    pub triggered_at: DateTime<Utc>,
    pub zone_id: Option<Uuid>,
    pub location_description: Option<String>,
    pub is_resolved: bool,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub was_false_alarm: bool,
    pub resolution_notes: Option<String>,
    pub code_activation_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SecurityCodeDebrief {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code_activation_id: Uuid,
    pub debrief_date: NaiveDate,
    pub facilitator_id: Option<Uuid>,
    pub attendees: Option<serde_json::Value>,
    pub response_time_seconds: Option<i32>,
    pub total_duration_minutes: Option<i32>,
    pub what_went_well: Option<String>,
    pub what_went_wrong: Option<String>,
    pub root_cause: Option<String>,
    pub lessons_learned: Option<String>,
    pub action_items: Option<serde_json::Value>,
    pub equipment_issues: Option<String>,
    pub training_gaps: Option<String>,
    pub protocol_changes_recommended: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

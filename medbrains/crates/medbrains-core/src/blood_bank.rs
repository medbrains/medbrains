use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "donation_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum DonationType {
    WholeBlood,
    ApheresisPlatelets,
    ApheresisPlasma,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "blood_component_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BloodComponentType {
    WholeBlood,
    Prbc,
    Ffp,
    Platelets,
    Cryoprecipitate,
    Granulocytes,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "blood_bag_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BloodBagStatus {
    Collected,
    Processing,
    Tested,
    Available,
    Reserved,
    Crossmatched,
    Issued,
    Transfused,
    Returned,
    Expired,
    Discarded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "crossmatch_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CrossmatchStatus {
    Requested,
    Testing,
    Compatible,
    Incompatible,
    Issued,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "transfusion_reaction_severity", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TransfusionReactionSeverity {
    Mild,
    Moderate,
    Severe,
    Fatal,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BloodDonor {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub donor_number: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<String>,
    pub blood_group: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub id_type: Option<String>,
    pub id_number: Option<String>,
    pub is_active: bool,
    pub is_deferred: bool,
    pub deferral_reason: Option<String>,
    pub deferral_until: Option<NaiveDate>,
    pub last_donation: Option<DateTime<Utc>>,
    pub total_donations: i32,
    pub medical_history: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BloodDonation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub donor_id: Uuid,
    pub bag_number: String,
    pub donation_type: DonationType,
    pub volume_ml: i32,
    pub donated_at: DateTime<Utc>,
    pub collected_by: Option<Uuid>,
    pub camp_name: Option<String>,
    pub adverse_reaction: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BloodComponent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub donation_id: Uuid,
    pub component_type: BloodComponentType,
    pub bag_number: String,
    pub blood_group: String,
    pub volume_ml: i32,
    pub status: BloodBagStatus,
    pub collected_at: DateTime<Utc>,
    pub expiry_at: DateTime<Utc>,
    pub storage_location: Option<String>,
    pub storage_temperature: Option<String>,
    pub tti_status: Option<String>,
    pub tti_tested_at: Option<DateTime<Utc>>,
    pub issued_to_patient: Option<Uuid>,
    pub issued_at: Option<DateTime<Utc>>,
    pub issued_by: Option<Uuid>,
    pub discarded_at: Option<DateTime<Utc>>,
    pub discard_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CrossmatchRequest {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub component_id: Option<Uuid>,
    pub requested_by: Uuid,
    pub blood_group: String,
    pub component_type: BloodComponentType,
    pub units_requested: i32,
    pub clinical_indication: Option<String>,
    pub status: CrossmatchStatus,
    pub result: Option<String>,
    pub tested_by: Option<Uuid>,
    pub tested_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransfusionRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub patient_id: Uuid,
    pub component_id: Uuid,
    pub crossmatch_id: Option<Uuid>,
    pub administered_by: Uuid,
    pub verified_by: Option<Uuid>,
    pub patient_verified_by: Option<Uuid>,
    pub product_verified_by: Option<Uuid>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub volume_transfused_ml: Option<i32>,
    pub has_reaction: bool,
    pub reaction_type: Option<String>,
    pub reaction_severity: Option<TransfusionReactionSeverity>,
    pub reaction_details: Option<String>,
    pub reaction_reported_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Phase 2 Enums ──────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bb_return_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BbReturnStatus {
    Requested,
    Inspecting,
    Accepted,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bb_lookback_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BbLookbackStatus {
    Detected,
    Investigating,
    Notified,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bb_billing_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BbBillingStatus {
    Pending,
    Invoiced,
    Paid,
    Waived,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "bb_cold_chain_alert_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BbColdChainAlertLevel {
    Normal,
    Warning,
    Critical,
}

// ── Phase 2 Structs ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbRecruitmentCampaign {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub campaign_name: String,
    pub campaign_type: String,
    pub target_blood_groups: Option<serde_json::Value>,
    pub target_count: Option<i32>,
    pub actual_count: Option<i32>,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub status: String,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbColdChainDevice {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub device_name: String,
    pub device_serial: Option<String>,
    pub location: Option<String>,
    pub equipment_type: String,
    pub min_temp: Option<Decimal>,
    pub max_temp: Option<Decimal>,
    pub alert_threshold_minutes: Option<i32>,
    pub is_active: bool,
    pub last_reading_at: Option<DateTime<Utc>>,
    pub last_temp: Option<Decimal>,
    pub alert_level: Option<BbColdChainAlertLevel>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbColdChainReading {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub device_id: Uuid,
    pub temperature: Decimal,
    pub humidity: Option<Decimal>,
    pub alert_level: Option<BbColdChainAlertLevel>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbBloodReturn {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub component_id: Uuid,
    pub return_code: String,
    pub returned_by: Option<Uuid>,
    pub return_reason: Option<String>,
    pub temperature_at_return: Option<Decimal>,
    pub temperature_acceptable: Option<bool>,
    pub time_out_minutes: Option<i32>,
    pub status: BbReturnStatus,
    pub inspection_notes: Option<String>,
    pub inspected_by: Option<Uuid>,
    pub inspected_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbMsbosGuideline {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub procedure_name: String,
    pub procedure_code: String,
    pub blood_group: Option<String>,
    pub component_type: BloodComponentType,
    pub max_units: i32,
    pub crossmatch_to_transfusion_ratio: Option<Decimal>,
    pub is_active: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbLookbackEvent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub event_code: String,
    pub donation_id: Option<Uuid>,
    pub donor_id: Option<Uuid>,
    pub infection_type: String,
    pub detection_date: NaiveDate,
    pub status: BbLookbackStatus,
    pub affected_components: Option<serde_json::Value>,
    pub recipients_notified: Option<i32>,
    pub investigation_notes: Option<String>,
    pub reported_to: Option<String>,
    pub reported_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closed_by: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BbBillingItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub component_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub billing_code: String,
    pub component_type: Option<BloodComponentType>,
    pub blood_group: Option<String>,
    pub processing_fee: Option<Decimal>,
    pub component_cost: Option<Decimal>,
    pub cross_match_fee: Option<Decimal>,
    pub total_amount: Option<Decimal>,
    pub status: BbBillingStatus,
    pub invoice_id: Option<Uuid>,
    pub waiver_reason: Option<String>,
    pub billed_by: Option<Uuid>,
    pub billed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

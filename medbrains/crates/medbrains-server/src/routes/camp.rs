#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use medbrains_core::camp::{
    Camp, CampBillingRecord, CampFollowup, CampLabSample, CampRegistration, CampScreening,
    CampTeamMember,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Camps ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCampsQuery {
    pub status: Option<String>,
    pub camp_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CampPacketQuery {
    pub device_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampRequest {
    pub name: String,
    pub camp_type: String,
    pub organizing_department_id: Option<Uuid>,
    pub coordinator_id: Option<Uuid>,
    pub scheduled_date: NaiveDate,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub venue_city: Option<String>,
    pub venue_state: Option<String>,
    pub venue_pincode: Option<String>,
    pub venue_latitude: Option<f64>,
    pub venue_longitude: Option<f64>,
    pub expected_participants: Option<i32>,
    pub budget_allocated: Option<Decimal>,
    pub logistics_notes: Option<String>,
    pub equipment_list: Option<serde_json::Value>,
    pub is_free: Option<bool>,
    pub discount_percentage: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCampRequest {
    pub name: Option<String>,
    pub organizing_department_id: Option<Uuid>,
    pub coordinator_id: Option<Uuid>,
    pub scheduled_date: Option<NaiveDate>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub venue_city: Option<String>,
    pub venue_state: Option<String>,
    pub venue_pincode: Option<String>,
    pub venue_latitude: Option<f64>,
    pub venue_longitude: Option<f64>,
    pub expected_participants: Option<i32>,
    pub budget_allocated: Option<Decimal>,
    pub budget_spent: Option<Decimal>,
    pub logistics_notes: Option<String>,
    pub equipment_list: Option<serde_json::Value>,
    pub is_free: Option<bool>,
    pub discount_percentage: Option<Decimal>,
    pub summary_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CancelCampRequest {
    pub cancellation_reason: Option<String>,
}

// ── Remote Camp Operations / NABH Readiness ──────────────

#[derive(Debug, Deserialize)]
pub struct UpsertRemoteSetupRequest {
    pub village_name: Option<String>,
    pub block_name: Option<String>,
    pub district_name: Option<String>,
    pub site_landmark: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub expected_footfall: Option<i32>,
    pub site_contact_name: Option<String>,
    pub site_contact_phone: Option<String>,
    pub local_authority_name: Option<String>,
    pub local_authority_phone: Option<String>,
    pub referral_facility_name: Option<String>,
    pub referral_facility_phone: Option<String>,
    pub ambulance_contact_name: Option<String>,
    pub ambulance_contact_phone: Option<String>,
    pub emergency_route_notes: Option<String>,
    pub network_plan: Option<String>,
    pub power_plan: Option<String>,
    pub water_sanitation_plan: Option<String>,
    pub privacy_plan: Option<String>,
    pub crowd_control_plan: Option<String>,
    pub bmw_plan: Option<String>,
    pub infection_control_plan: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRemoteChecklistItemRequest {
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupplyItemRequest {
    pub category: String,
    pub item_name: String,
    pub unit: Option<String>,
    pub planned_qty: Option<Decimal>,
    pub packed_qty: Option<Decimal>,
    pub batch_no: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub is_critical: Option<bool>,
    pub shortage_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSupplyItemRequest {
    pub packed_qty: Option<Decimal>,
    pub consumed_qty: Option<Decimal>,
    pub returned_qty: Option<Decimal>,
    pub shortage_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampReferralRequest {
    pub registration_id: Option<Uuid>,
    pub referred_to_facility: String,
    pub referral_department: Option<String>,
    pub urgency: Option<String>,
    pub reason: String,
    pub transport_mode: Option<String>,
    pub ambulance_required: Option<bool>,
    pub attendant_name: Option<String>,
    pub attendant_phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCampReferralRequest {
    pub status: Option<String>,
    pub transport_mode: Option<String>,
    pub attendant_name: Option<String>,
    pub attendant_phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampIncidentRequest {
    pub registration_id: Option<Uuid>,
    pub incident_type: String,
    pub severity: Option<String>,
    pub description: String,
    pub immediate_action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCampIncidentRequest {
    pub status: Option<String>,
    pub immediate_action: Option<String>,
}

// ── Camp Offline Sync ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CampSyncInboundRequest {
    pub camp_id: Uuid,
    pub device_id: String,
    pub events: Vec<CampSyncInboundEvent>,
}

#[derive(Debug, Deserialize)]
pub struct CampSyncInboundEvent {
    pub idempotency_key: String,
    pub event_type: String,
    pub client_entity_id: Option<Uuid>,
    pub occurred_at: Option<DateTime<Utc>>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct UpdateChecklistSyncPayload {
    checklist_item_id: Option<Uuid>,
    code: Option<String>,
    status: String,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateSupplySyncPayload {
    supply_item_id: Uuid,
    packed_qty: Option<Decimal>,
    consumed_qty: Option<Decimal>,
    returned_qty: Option<Decimal>,
    shortage_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CampOpdEncounterSyncPayload {
    patient_id: Uuid,
    department_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    notes: Option<String>,
    registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct CampVitalSyncPayload {
    encounter_id: Option<Uuid>,
    registration_id: Option<Uuid>,
    patient_id: Option<Uuid>,
    temperature: Option<Decimal>,
    pulse: Option<i32>,
    systolic_bp: Option<i32>,
    diastolic_bp: Option<i32>,
    respiratory_rate: Option<i32>,
    spo2: Option<i32>,
    weight_kg: Option<Decimal>,
    height_cm: Option<Decimal>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CampLabOrderSyncPayload {
    patient_id: Option<Uuid>,
    encounter_id: Option<Uuid>,
    registration_id: Option<Uuid>,
    test_id: Uuid,
    priority: Option<String>,
    notes: Option<String>,
    sample_barcode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CampPrescriptionSyncPayload {
    encounter_id: Option<Uuid>,
    patient_id: Option<Uuid>,
    registration_id: Option<Uuid>,
    department_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    notes: Option<String>,
    items: Vec<CampPrescriptionItemSyncPayload>,
}

#[derive(Debug, Deserialize)]
struct CampPrescriptionItemSyncPayload {
    drug_name: String,
    dosage: String,
    frequency: String,
    duration: String,
    route: Option<String>,
    instructions: Option<String>,
    catalog_item_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct CampPharmacyDispenseSyncPayload {
    patient_id: Option<Uuid>,
    encounter_id: Option<Uuid>,
    registration_id: Option<Uuid>,
    prescription_id: Option<Uuid>,
    notes: Option<String>,
    restricted_approval_reason: Option<String>,
    items: Vec<CampPharmacyDispenseItemSyncPayload>,
}

#[derive(Debug, Deserialize)]
struct CampPharmacyDispenseItemSyncPayload {
    catalog_item_id: Option<Uuid>,
    drug_name: String,
    quantity: i32,
    unit_price: Decimal,
    batch_stock_id: Option<Uuid>,
    batch_number: Option<String>,
    expiry_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
struct CampBillingRecordSyncPayload {
    patient_id: Option<Uuid>,
    encounter_id: Option<Uuid>,
    registration_id: Option<Uuid>,
    service_description: String,
    charge_code: Option<String>,
    quantity: Option<i32>,
    unit_price: Decimal,
    tax_percent: Option<Decimal>,
    discount_amount: Option<Decimal>,
    notes: Option<String>,
}

// ── Team Members ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AddTeamMemberRequest {
    pub employee_id: Uuid,
    pub role_in_camp: String,
    pub is_confirmed: Option<bool>,
    pub notes: Option<String>,
}

// ── Registrations ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListRegistrationsQuery {
    pub camp_id: Uuid,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRegistrationRequest {
    pub camp_id: Uuid,
    pub person_name: String,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof_type: Option<String>,
    pub id_proof_number: Option<String>,
    pub patient_id: Option<Uuid>,
    pub clinical_department_id: Option<Uuid>,
    pub attending_doctor_id: Option<Uuid>,
    pub service_line: Option<String>,
    pub chief_complaint: Option<String>,
    pub is_walk_in: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegistrationRequest {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub clinical_department_id: Option<Uuid>,
    pub attending_doctor_id: Option<Uuid>,
    pub service_line: Option<String>,
    pub chief_complaint: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OpenCampRegistrationEncounterResponse {
    pub encounter_id: Uuid,
    pub queue_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub department_id: Uuid,
    pub doctor_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct OpenCampRegistrationEncounterRequest {
    pub department_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
}

// ── Screenings ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListScreeningsQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScreeningRequest {
    pub registration_id: Uuid,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature: Option<Decimal>,
    pub blood_sugar_random: Option<Decimal>,
    pub bmi: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub weight_kg: Option<Decimal>,
    pub visual_acuity_left: Option<String>,
    pub visual_acuity_right: Option<String>,
    pub findings: Option<String>,
    pub diagnosis: Option<String>,
    pub advice: Option<String>,
    pub referred_to_hospital: Option<bool>,
    pub referral_department: Option<String>,
    pub referral_urgency: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ScreeningRegistrationContext {
    camp_id: Uuid,
    patient_id: Option<Uuid>,
    organizing_department_id: Option<Uuid>,
}

#[derive(sqlx::FromRow)]
struct OpenEncounterRegistrationContext {
    camp_id: Uuid,
    camp_code: String,
    camp_name: String,
    organizing_department_id: Option<Uuid>,
    person_name: String,
    age: Option<i32>,
    gender: Option<String>,
    phone: Option<String>,
    address: Option<String>,
    id_proof_type: Option<String>,
    id_proof_number: Option<String>,
    patient_id: Option<Uuid>,
    clinical_department_id: Option<Uuid>,
    attending_doctor_id: Option<Uuid>,
    service_line: Option<String>,
    chief_complaint: Option<String>,
    is_walk_in: bool,
}

// ── Lab Samples ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListLabSamplesQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLabSampleRequest {
    pub registration_id: Uuid,
    pub sample_type: String,
    pub test_requested: Option<String>,
    pub barcode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LinkLabSampleRequest {
    pub lab_order_id: Uuid,
    pub result_summary: Option<String>,
}

// ── Billing ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListBillingQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBillingRequest {
    pub registration_id: Uuid,
    pub service_description: String,
    pub standard_amount: Decimal,
    pub discount_percentage: Option<Decimal>,
    pub charged_amount: Decimal,
    pub is_free: Option<bool>,
    pub payment_mode: Option<String>,
    pub payment_reference: Option<String>,
}

// ── Follow-ups ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListFollowupsQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFollowupRequest {
    pub registration_id: Uuid,
    pub followup_date: NaiveDate,
    pub followup_type: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFollowupRequest {
    pub status: Option<String>,
    pub notes: Option<String>,
    pub outcome: Option<String>,
    pub converted_to_patient: Option<bool>,
    pub converted_patient_id: Option<Uuid>,
    pub converted_department_id: Option<Uuid>,
}

// ── Stats ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CampStatsResponse {
    pub total_registrations: i64,
    pub screened: i64,
    pub referred: i64,
    pub converted: i64,
    pub lab_samples: i64,
    pub followups_scheduled: i64,
    pub followups_completed: i64,
    pub billing_total: Decimal,
}

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
struct SumRow {
    total: Option<Decimal>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketPatientSummary {
    pub patient_id: Uuid,
    pub uhid: String,
    pub display_name: String,
    pub gender: String,
    pub date_of_birth: Option<NaiveDate>,
    pub age_years: Option<i32>,
    pub phone_last4: Option<String>,
    pub blood_group: Option<String>,
    pub no_known_allergies: Option<bool>,
    pub last_visit_date: Option<NaiveDate>,
    pub is_vip: bool,
    pub is_medico_legal: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketAllergy {
    pub patient_id: Uuid,
    pub allergy_type: String,
    pub allergen_name: String,
    pub allergen_code: Option<String>,
    pub reaction: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketVital {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub bmi: Option<Decimal>,
    pub notes: Option<String>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketRegistrationHistory {
    pub patient_id: Option<Uuid>,
    pub registration_id: Uuid,
    pub camp_id: Uuid,
    pub camp_code: String,
    pub camp_name: String,
    pub registration_number: String,
    pub person_name: String,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub phone_last4: Option<String>,
    pub chief_complaint: Option<String>,
    pub status: String,
    pub venue_city: Option<String>,
    pub venue_state: Option<String>,
    pub registered_at: DateTime<Utc>,
    pub current_camp: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketVisitHistory {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub encounter_type: String,
    pub status: String,
    pub encounter_date: NaiveDate,
    pub department_name: Option<String>,
    pub doctor_name: Option<String>,
    pub notes: Option<String>,
    pub diagnosis_summary: Option<String>,
    pub prescription_summary: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketDiagnosisHistory {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub icd_code: Option<String>,
    pub description: String,
    pub is_primary: bool,
    pub severity: Option<String>,
    pub certainty: Option<String>,
    pub onset_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketMedicationHistory {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub prescription_id: Uuid,
    pub drug_name: String,
    pub dosage: String,
    pub frequency: String,
    pub duration: String,
    pub route: Option<String>,
    pub instructions: Option<String>,
    pub item_status: String,
    pub prescribed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketDepartmentRef {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub department_type: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketDoctorRef {
    pub id: Uuid,
    pub full_name: String,
    pub specialization: Option<String>,
    pub medical_registration_number: Option<String>,
    pub department_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketLabTestRef {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub department_id: Option<Uuid>,
    pub sample_type: Option<String>,
    pub price: Decimal,
    pub loinc_code: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampPacketPharmacyStockRef {
    pub catalog_item_id: Uuid,
    pub code: String,
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub base_price: Decimal,
    pub tax_percent: Decimal,
    pub current_stock: i32,
    pub drug_schedule: Option<String>,
    pub is_controlled: bool,
    pub is_lasa: bool,
    pub aware_category: Option<String>,
    pub prescription_only: Option<bool>,
    pub batch_id: Option<Uuid>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity_on_hand: Option<i32>,
    pub store_location_id: Option<Uuid>,
    pub selling_rate: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct CampPacketResponse {
    pub camp: Camp,
    pub team: Vec<CampTeamMember>,
    pub registrations: Vec<CampRegistration>,
    pub screenings: Vec<CampScreening>,
    pub lab_samples: Vec<CampLabSample>,
    pub remote_setup: Option<CampRemoteSetup>,
    pub remote_checklist: Vec<CampRemoteChecklistItem>,
    pub supplies: Vec<CampSupplyItem>,
    pub patient_summaries: Vec<CampPacketPatientSummary>,
    pub active_allergies: Vec<CampPacketAllergy>,
    pub recent_vitals: Vec<CampPacketVital>,
    pub registration_history: Vec<CampPacketRegistrationHistory>,
    pub visit_history: Vec<CampPacketVisitHistory>,
    pub diagnosis_history: Vec<CampPacketDiagnosisHistory>,
    pub medication_history: Vec<CampPacketMedicationHistory>,
    pub department_refs: Vec<CampPacketDepartmentRef>,
    pub doctor_refs: Vec<CampPacketDoctorRef>,
    pub lab_test_refs: Vec<CampPacketLabTestRef>,
    pub pharmacy_stock_refs: Vec<CampPacketPharmacyStockRef>,
    pub downloaded_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub packet_revision: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CampRemoteSetup {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub village_name: Option<String>,
    pub block_name: Option<String>,
    pub district_name: Option<String>,
    pub site_landmark: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub expected_footfall: Option<i32>,
    pub site_contact_name: Option<String>,
    pub site_contact_phone: Option<String>,
    pub local_authority_name: Option<String>,
    pub local_authority_phone: Option<String>,
    pub referral_facility_name: Option<String>,
    pub referral_facility_phone: Option<String>,
    pub ambulance_contact_name: Option<String>,
    pub ambulance_contact_phone: Option<String>,
    pub emergency_route_notes: Option<String>,
    pub network_plan: Option<String>,
    pub power_plan: Option<String>,
    pub water_sanitation_plan: Option<String>,
    pub privacy_plan: Option<String>,
    pub crowd_control_plan: Option<String>,
    pub bmw_plan: Option<String>,
    pub infection_control_plan: Option<String>,
    pub status: String,
    pub readiness_score: i32,
    pub completed_by: Option<Uuid>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CampRemoteChecklistItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub category: String,
    pub code: String,
    pub label: String,
    pub nabh_chapter: String,
    pub required: bool,
    pub status: String,
    pub notes: Option<String>,
    pub evidence_attachment_id: Option<Uuid>,
    pub checked_by: Option<Uuid>,
    pub checked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CampSupplyItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub category: String,
    pub item_name: String,
    pub unit: Option<String>,
    pub planned_qty: Decimal,
    pub packed_qty: Decimal,
    pub consumed_qty: Decimal,
    pub returned_qty: Decimal,
    pub batch_no: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub is_critical: bool,
    pub shortage_notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CampReferral {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub registration_id: Option<Uuid>,
    pub referred_to_facility: String,
    pub referral_department: Option<String>,
    pub urgency: String,
    pub reason: String,
    pub transport_mode: Option<String>,
    pub ambulance_required: bool,
    pub attendant_name: Option<String>,
    pub attendant_phone: Option<String>,
    pub status: String,
    pub referred_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CampIncident {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub registration_id: Option<Uuid>,
    pub incident_type: String,
    pub severity: String,
    pub description: String,
    pub immediate_action: Option<String>,
    pub status: String,
    pub reported_by: Option<Uuid>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampReadinessSummary {
    pub required_total: usize,
    pub required_done: usize,
    pub issue_count: usize,
    pub score: i32,
    pub ready: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampRemoteOperationsResponse {
    pub setup: CampRemoteSetup,
    pub checklist: Vec<CampRemoteChecklistItem>,
    pub supplies: Vec<CampSupplyItem>,
    pub referrals: Vec<CampReferral>,
    pub incidents: Vec<CampIncident>,
    pub readiness: CampReadinessSummary,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampSyncEventResult {
    pub idempotency_key: String,
    pub event_type: String,
    pub status: String,
    pub server_entity_type: Option<String>,
    pub server_entity_id: Option<Uuid>,
    pub server_entities: Option<serde_json::Value>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampSyncInboundResponse {
    pub camp_id: Uuid,
    pub device_id: String,
    pub accepted: usize,
    pub applied: usize,
    pub duplicates: usize,
    pub failed: usize,
    pub results: Vec<CampSyncEventResult>,
}

#[derive(Debug)]
struct AppliedSyncEvent {
    server_entity_type: String,
    server_entity_id: Uuid,
    server_entities: serde_json::Value,
}

#[derive(Debug, sqlx::FromRow)]
struct ExistingSyncEvent {
    event_type: String,
    status: String,
    server_entity_type: Option<String>,
    server_entity_id: Option<Uuid>,
    error: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct DefaultChecklistItem {
    category: &'static str,
    code: &'static str,
    label: &'static str,
    nabh_chapter: &'static str,
    required: bool,
}

const DEFAULT_REMOTE_CHECKLIST: &[DefaultChecklistItem] = &[
    DefaultChecklistItem {
        category: "coordination",
        code: "local_authority_contact",
        label: "Village leader / local authority contact and camp permission confirmed",
        nabh_chapter: "ROM/FMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "facility_safety",
        code: "safe_site_access",
        label: "Safe access route, patient flow, waiting area, and emergency exit identified",
        nabh_chapter: "FMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "facility_safety",
        code: "lighting_power_backup",
        label: "Lighting, charging points, and power backup arranged for devices and equipment",
        nabh_chapter: "FMS/IMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "facility_safety",
        code: "water_toilets_hand_hygiene",
        label: "Drinking water, toilets, and hand-hygiene station available",
        nabh_chapter: "FMS/IPC",
        required: true,
    },
    DefaultChecklistItem {
        category: "patient_rights",
        code: "privacy_screening_area",
        label: "Private screening / examination area available, especially for women and elderly patients",
        nabh_chapter: "PRE",
        required: true,
    },
    DefaultChecklistItem {
        category: "patient_rights",
        code: "rights_consent_language",
        label: "Patient rights, education, consent, and local-language instructions prepared",
        nabh_chapter: "PRE/IMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "infection_control",
        code: "ppe_disinfection",
        label: "PPE, surface disinfection, hand rub, masks, gloves, and spill response kit packed",
        nabh_chapter: "IPC",
        required: true,
    },
    DefaultChecklistItem {
        category: "infection_control",
        code: "sharps_bmw_bins",
        label: "Sharps container, colour-coded BMW bags/bins, and needle-stick response SOP available",
        nabh_chapter: "IPC",
        required: true,
    },
    DefaultChecklistItem {
        category: "infection_control",
        code: "bmw_handoff",
        label: "Biomedical waste collection, temporary storage, and authorised handoff plan confirmed",
        nabh_chapter: "IPC/FMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "clinical",
        code: "triage_referral_protocol",
        label: "Triage, red-flag criteria, referral protocol, and escalation owner briefed",
        nabh_chapter: "AAC/COP/PSQ",
        required: true,
    },
    DefaultChecklistItem {
        category: "clinical",
        code: "emergency_kit_transport",
        label: "Emergency kit, referral facility contact, ambulance/transport, and route notes confirmed",
        nabh_chapter: "AAC/COP/FMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "human_resources",
        code: "staff_roster_roles",
        label: "Doctor, nurse, lab tech, pharmacist/dispensing owner, volunteers, and crowd-control roles assigned",
        nabh_chapter: "HRM/ROM",
        required: true,
    },
    DefaultChecklistItem {
        category: "human_resources",
        code: "staff_briefing_sop",
        label: "Staff briefing completed for SOPs, patient safety, privacy, infection control, and incident reporting",
        nabh_chapter: "HRM/PSQ/IMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "it_offline",
        code: "packet_downloaded_devices_charged",
        label: "Offline packet downloaded, devices charged, backup power and paper fallback forms ready",
        nabh_chapter: "IMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "it_offline",
        code: "network_sync_plan",
        label: "Network plan documented: expected connectivity, sync window, and post-camp upload owner",
        nabh_chapter: "IMS/ROM",
        required: true,
    },
    DefaultChecklistItem {
        category: "quality",
        code: "incident_register_ready",
        label: "Incident, near-miss, referral, and corrective-action register ready",
        nabh_chapter: "PSQ",
        required: true,
    },
    DefaultChecklistItem {
        category: "supplies",
        code: "equipment_consumables_checked",
        label: "Equipment, consumables, medicines, test kits, labels, barcodes, and expiry checks completed",
        nabh_chapter: "MOM/FMS/IMS",
        required: true,
    },
    DefaultChecklistItem {
        category: "closure",
        code: "post_camp_closure_plan",
        label: "Post-camp sync, BMW handoff, referral reconciliation, incident review, and audit export owner assigned",
        nabh_chapter: "PSQ/IMS/ROM",
        required: true,
    },
];

fn readiness_summary(items: &[CampRemoteChecklistItem]) -> CampReadinessSummary {
    let required_total = items.iter().filter(|item| item.required).count();
    let required_done = items
        .iter()
        .filter(|item| item.required && matches!(item.status.as_str(), "ok" | "not_applicable"))
        .count();
    let issue_count = items
        .iter()
        .filter(|item| item.status.as_str() == "issue")
        .count();
    let score = if required_total == 0 {
        100
    } else {
        ((required_done as f64 / required_total as f64) * 100.0).round() as i32
    };

    CampReadinessSummary {
        required_total,
        required_done,
        issue_count,
        score,
        ready: required_total > 0 && required_done == required_total && issue_count == 0,
    }
}

async fn seed_default_remote_checklist(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
) -> Result<(), AppError> {
    for item in DEFAULT_REMOTE_CHECKLIST {
        sqlx::query(
            "INSERT INTO camp_remote_checklist_items \
             (tenant_id, camp_id, category, code, label, nabh_chapter, required) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             ON CONFLICT (tenant_id, camp_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(item.category)
        .bind(item.code)
        .bind(item.label)
        .bind(item.nabh_chapter)
        .bind(item.required)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

fn parse_sync_payload<T>(event: &CampSyncInboundEvent) -> Result<T, AppError>
where
    T: DeserializeOwned,
{
    serde_json::from_value(event.payload.clone()).map_err(|err| {
        AppError::BadRequest(format!("invalid payload for {}: {err}", event.event_type))
    })
}

async fn ensure_registration_belongs_to_camp(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    registration_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS ( \
           SELECT 1 FROM camp_registrations \
           WHERE id = $1 AND camp_id = $2 AND tenant_id = $3 \
         )",
    )
    .bind(registration_id)
    .bind(camp_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if exists {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "registration {registration_id} does not belong to camp {camp_id}"
        )))
    }
}

#[derive(Debug, sqlx::FromRow)]
struct CampSyncCampContext {
    camp_code: String,
    name: String,
    organizing_department_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
struct SequenceCodeResult {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct SequenceNumberResult {
    current_val: i64,
}

#[derive(Debug)]
struct CampEncounterLink {
    encounter_id: Uuid,
    queue_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
struct PharmacySafetyRow {
    current_stock: i32,
    drug_schedule: Option<String>,
    is_controlled: bool,
    prescription_only: Option<bool>,
    narcotic_class: Option<String>,
}

fn normalize_camp_gender(value: Option<&str>) -> String {
    match value.unwrap_or("unknown").trim().to_lowercase().as_str() {
        "m" | "male" => "male".to_owned(),
        "f" | "female" => "female".to_owned(),
        "other" | "o" => "other".to_owned(),
        _ => "unknown".to_owned(),
    }
}

fn split_person_name(person_name: &str) -> (String, String) {
    let parts: Vec<&str> = person_name.split_whitespace().collect();
    match parts.as_slice() {
        [] => ("Camp".to_owned(), "Patient".to_owned()),
        [first] => ((*first).to_owned(), "Patient".to_owned()),
        [first, rest @ ..] => ((*first).to_owned(), rest.join(" ")),
    }
}

fn estimated_dob_from_age(age: Option<i32>) -> Option<NaiveDate> {
    let years = age.filter(|value| (0..=125).contains(value))?;
    Utc::now()
        .date_naive()
        .checked_sub_signed(Duration::days(i64::from(years) * 365))
}

async fn generate_sequence_code(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    seq_type: &str,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SequenceCodeResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = $2 \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Internal(format!("{seq_type} sequence not configured")))?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

async fn generate_sequence_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    seq_type: &str,
) -> Result<i32, AppError> {
    let seq = sqlx::query_as::<_, SequenceNumberResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = $2 \
         RETURNING current_val",
    )
    .bind(tenant_id)
    .bind(seq_type)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Internal(format!("{seq_type} sequence not configured")))?;

    i32::try_from(seq.current_val)
        .map_err(|err| AppError::Internal(format!("sequence overflow: {err}")))
}

async fn camp_context(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
) -> Result<CampSyncCampContext, AppError> {
    sqlx::query_as::<_, CampSyncCampContext>(
        "SELECT camp_code, name, organizing_department_id \
         FROM camps \
         WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

async fn patient_for_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    registration_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT patient_id FROM camp_registrations \
         WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(registration_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten())
}

async fn resolve_camp_patient_id(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Option<Uuid>,
    registration_id: Option<Uuid>,
) -> Result<Uuid, AppError> {
    if let Some(id) = patient_id {
        return Ok(id);
    }
    if let Some(id) = registration_id {
        if let Some(pid) = patient_for_registration(tx, tenant_id, id).await? {
            return Ok(pid);
        }
    }
    Err(AppError::BadRequest(
        "camp sync event requires patient_id or a registration linked to a patient".to_owned(),
    ))
}

async fn create_or_link_patient_for_camp_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    camp_id: Uuid,
    camp: &CampSyncCampContext,
    body: &CreateRegistrationRequest,
) -> Result<Uuid, AppError> {
    if let Some(patient_id) = body.patient_id {
        return Ok(patient_id);
    }

    let (first_name, last_name) = split_person_name(&body.person_name);
    let phone = body.phone.clone().unwrap_or_default();

    if !phone.trim().is_empty() {
        if let Some(existing_id) = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM patients \
             WHERE tenant_id = $1 \
               AND is_active = true \
               AND phone = $2 \
               AND lower(first_name) = lower($3) \
               AND lower(last_name) = lower($4) \
             ORDER BY updated_at DESC \
             LIMIT 1",
        )
        .bind(claims.tenant_id)
        .bind(&phone)
        .bind(&first_name)
        .bind(&last_name)
        .fetch_optional(&mut **tx)
        .await?
        {
            return Ok(existing_id);
        }
    }

    let uhid = generate_sequence_code(tx, &claims.tenant_id, "UHID").await?;
    let gender = normalize_camp_gender(body.gender.as_deref());
    let dob = estimated_dob_from_age(body.age);
    let attributes = serde_json::json!({
        "registration_context": {
            "camp_id": camp_id,
            "camp_name": camp.name,
            "camp_code": camp.camp_code,
            "chief_complaint": body.chief_complaint,
            "source": "mobile_camp_sync"
        },
        "camp_registration": {
            "age_years": body.age,
            "id_proof_type": body.id_proof_type,
            "has_id_proof": body.id_proof_number.as_ref().is_some_and(|value| !value.trim().is_empty())
        }
    });
    let address = body.address.as_ref().map(|address| {
        serde_json::json!({
            "line1": address,
            "camp_id": camp_id,
            "camp_name": camp.name,
        })
    });

    let patient_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO patients \
         (tenant_id, uhid, first_name, last_name, date_of_birth, is_dob_estimated, gender, \
          phone, address, category, registration_type, registration_source, financial_class, \
          attributes, created_by, registered_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::gender, \
                 $8, $9, 'general'::patient_category, 'camp'::registration_type, \
                 'camp'::registration_source, 'self_pay'::financial_class, \
                 $10, $11, $11) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&uhid)
    .bind(&first_name)
    .bind(&last_name)
    .bind(dob)
    .bind(body.age.is_some())
    .bind(&gender)
    .bind(&phone)
    .bind(address)
    .bind(attributes)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    Ok(patient_id)
}

async fn find_or_create_camp_encounter(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    camp_id: Uuid,
    patient_id: Uuid,
    department_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    notes: Option<&str>,
) -> Result<CampEncounterLink, AppError> {
    if let Some(existing_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM encounters \
         WHERE tenant_id = $1 \
           AND patient_id = $2 \
           AND encounter_type = 'opd'::encounter_type \
           AND attributes->>'camp_id' = $3 \
           AND status = 'open'::encounter_status \
         ORDER BY created_at DESC \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(camp_id.to_string())
    .fetch_optional(&mut **tx)
    .await?
    {
        sqlx::query(
            "UPDATE encounters \
             SET department_id = COALESCE($3, department_id), \
                 doctor_id = COALESCE($4, doctor_id), \
                 updated_at = now() \
             WHERE tenant_id = $1 AND id = $2",
        )
        .bind(claims.tenant_id)
        .bind(existing_id)
        .bind(department_id)
        .bind(doctor_id)
        .execute(&mut **tx)
        .await?;
        let queue_id = sqlx::query_scalar::<_, Uuid>(
            "UPDATE opd_queues \
             SET department_id = COALESCE($3, department_id), \
                 doctor_id = COALESCE($4, doctor_id), \
                 updated_at = now() \
             WHERE tenant_id = $1 AND encounter_id = $2 \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(existing_id)
        .bind(department_id)
        .bind(doctor_id)
        .fetch_optional(&mut **tx)
        .await?;
        return Ok(CampEncounterLink {
            encounter_id: existing_id,
            queue_id,
        });
    }

    let department_id = department_id.ok_or_else(|| {
        AppError::BadRequest(
            "camp OPD encounter requires department_id or organizing department".to_owned(),
        )
    })?;
    let today = Utc::now().date_naive();
    let encounter_id = Uuid::new_v4();
    let attributes = serde_json::json!({
        "camp_id": camp_id,
        "source": "camp",
    });

    sqlx::query(
        "INSERT INTO encounters \
         (id, tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes, visit_type, created_by) \
         VALUES ($1, $2, $3, 'opd'::encounter_type, 'open'::encounter_status, \
                 $4, $5, $6, $7, $8, 'camp', $9)",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(department_id)
    .bind(doctor_id)
    .bind(today)
    .bind(notes)
    .bind(attributes)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;

    let token = generate_sequence_number(tx, &claims.tenant_id, "OPD_TOKEN").await?;
    let queue_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO opd_queues \
         (tenant_id, encounter_id, department_id, doctor_id, token_number, status, queue_date, created_by) \
         VALUES ($1, $2, $3, $4, $5, 'waiting'::queue_status, $6, $7) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(department_id)
    .bind(doctor_id)
    .bind(token)
    .bind(today)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    Ok(CampEncounterLink {
        encounter_id,
        queue_id: Some(queue_id),
    })
}

fn calculate_bmi(weight_kg: Option<Decimal>, height_cm: Option<Decimal>) -> Option<Decimal> {
    match (weight_kg, height_cm) {
        (Some(weight), Some(height)) if height > Decimal::ZERO => {
            let stature_metres = height / Decimal::from(100);
            Some(weight / (stature_metres * stature_metres))
        }
        _ => None,
    }
}

async fn apply_camp_sync_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    camp_id: Uuid,
    event: &CampSyncInboundEvent,
) -> Result<AppliedSyncEvent, AppError> {
    match event.event_type.as_str() {
        "camp.patient.upsert" => {
            require_permission(claims, permissions::patients::CREATE)?;
            let body: CreateRegistrationRequest = parse_sync_payload(event)?;
            if body.camp_id != camp_id {
                return Err(AppError::BadRequest(
                    "patient payload camp_id does not match sync camp_id".to_owned(),
                ));
            }
            let camp = camp_context(tx, claims.tenant_id, camp_id).await?;
            let patient_id =
                create_or_link_patient_for_camp_registration(tx, claims, camp_id, &camp, &body)
                    .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "patient".to_owned(),
                server_entity_id: patient_id,
                server_entities: serde_json::json!({ "patient_id": patient_id }),
            })
        }
        "camp.opd.encounter.create" => {
            require_permission(claims, permissions::opd::visit::CREATE)?;
            let body: CampOpdEncounterSyncPayload = parse_sync_payload(event)?;
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let camp = camp_context(tx, claims.tenant_id, camp_id).await?;
            let link = find_or_create_camp_encounter(
                tx,
                claims,
                camp_id,
                body.patient_id,
                body.department_id.or(camp.organizing_department_id),
                body.doctor_id,
                body.notes.as_deref(),
            )
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "opd_encounter".to_owned(),
                server_entity_id: link.encounter_id,
                server_entities: serde_json::json!({
                    "patient_id": body.patient_id,
                    "encounter_id": link.encounter_id,
                    "queue_id": link.queue_id,
                }),
            })
        }
        "camp.vitals.record" => {
            require_permission(claims, permissions::opd::visit::UPDATE)?;
            let body: CampVitalSyncPayload = parse_sync_payload(event)?;
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let encounter_id = if let Some(encounter_id) = body.encounter_id {
                encounter_id
            } else {
                let patient_id = resolve_camp_patient_id(
                    tx,
                    claims.tenant_id,
                    body.patient_id,
                    body.registration_id,
                )
                .await?;
                let camp = camp_context(tx, claims.tenant_id, camp_id).await?;
                find_or_create_camp_encounter(
                    tx,
                    claims,
                    camp_id,
                    patient_id,
                    camp.organizing_department_id,
                    None,
                    body.notes.as_deref(),
                )
                .await?
                .encounter_id
            };
            let bmi = calculate_bmi(body.weight_kg, body.height_cm);
            let vital_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO vitals \
                 (tenant_id, encounter_id, recorded_by, temperature, pulse, \
                  systolic_bp, diastolic_bp, respiratory_rate, spo2, \
                  weight_kg, height_cm, bmi, notes, recorded_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(encounter_id)
            .bind(claims.sub)
            .bind(body.temperature)
            .bind(body.pulse)
            .bind(body.systolic_bp)
            .bind(body.diastolic_bp)
            .bind(body.respiratory_rate)
            .bind(body.spo2)
            .bind(body.weight_kg)
            .bind(body.height_cm)
            .bind(bmi)
            .bind(body.notes)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "vital".to_owned(),
                server_entity_id: vital_id,
                server_entities: serde_json::json!({
                    "vital_id": vital_id,
                    "encounter_id": encounter_id,
                }),
            })
        }
        "camp.lab.order.create" | "camp.lab.sample.collect" => {
            require_permission(claims, permissions::lab::orders::CREATE)?;
            let body: CampLabOrderSyncPayload = parse_sync_payload(event)?;
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let patient_id = resolve_camp_patient_id(
                tx,
                claims.tenant_id,
                body.patient_id,
                body.registration_id,
            )
            .await?;
            let encounter_id = if let Some(encounter_id) = body.encounter_id {
                encounter_id
            } else {
                let camp = camp_context(tx, claims.tenant_id, camp_id).await?;
                find_or_create_camp_encounter(
                    tx,
                    claims,
                    camp_id,
                    patient_id,
                    camp.organizing_department_id,
                    None,
                    body.notes.as_deref(),
                )
                .await?
                .encounter_id
            };
            let priority = body.priority.unwrap_or_else(|| "routine".to_owned());
            let lab_order_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO lab_orders \
                 (tenant_id, encounter_id, patient_id, test_id, ordered_by, priority, notes, \
                  sample_barcode, camp_id, created_by) \
                 VALUES ($1, $2, $3, $4, $5, $6::lab_priority, $7, $8, $9, $5) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(encounter_id)
            .bind(patient_id)
            .bind(body.test_id)
            .bind(claims.sub)
            .bind(priority)
            .bind(body.notes)
            .bind(body.sample_barcode)
            .bind(camp_id)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "lab_order".to_owned(),
                server_entity_id: lab_order_id,
                server_entities: serde_json::json!({
                    "patient_id": patient_id,
                    "encounter_id": encounter_id,
                    "lab_order_id": lab_order_id,
                }),
            })
        }
        "camp.prescription.create" => {
            require_permission(claims, permissions::opd::visit::UPDATE)?;
            let body: CampPrescriptionSyncPayload = parse_sync_payload(event)?;
            if body.items.is_empty() {
                return Err(AppError::BadRequest(
                    "prescription sync requires at least one item".to_owned(),
                ));
            }
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let patient_id = resolve_camp_patient_id(
                tx,
                claims.tenant_id,
                body.patient_id,
                body.registration_id,
            )
            .await?;
            let encounter_id = if let Some(encounter_id) = body.encounter_id {
                encounter_id
            } else {
                let camp = camp_context(tx, claims.tenant_id, camp_id).await?;
                find_or_create_camp_encounter(
                    tx,
                    claims,
                    camp_id,
                    patient_id,
                    body.department_id.or(camp.organizing_department_id),
                    body.doctor_id,
                    body.notes.as_deref(),
                )
                .await?
                .encounter_id
            };
            let prescription_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, notes) \
                 VALUES ($1, $2, $3, $4) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(encounter_id)
            .bind(body.doctor_id.unwrap_or(claims.sub))
            .bind(&body.notes)
            .fetch_one(&mut **tx)
            .await?;

            for item in &body.items {
                sqlx::query(
                    "INSERT INTO prescription_items \
                     (tenant_id, prescription_id, drug_name, dosage, frequency, duration, \
                      route, instructions, catalog_item_id) \
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                )
                .bind(claims.tenant_id)
                .bind(prescription_id)
                .bind(&item.drug_name)
                .bind(&item.dosage)
                .bind(&item.frequency)
                .bind(&item.duration)
                .bind(&item.route)
                .bind(&item.instructions)
                .bind(item.catalog_item_id)
                .execute(&mut **tx)
                .await?;
            }

            let _ = sqlx::query(
                "INSERT INTO pharmacy_prescriptions \
                 (tenant_id, prescription_id, patient_id, encounter_id, doctor_id, source, status, priority) \
                 VALUES ($1, $2, $3, $4, $5, 'opd', 'pending_review', 'normal') \
                 ON CONFLICT DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(prescription_id)
            .bind(patient_id)
            .bind(encounter_id)
            .bind(body.doctor_id.unwrap_or(claims.sub))
            .execute(&mut **tx)
            .await;

            Ok(AppliedSyncEvent {
                server_entity_type: "prescription".to_owned(),
                server_entity_id: prescription_id,
                server_entities: serde_json::json!({
                    "patient_id": patient_id,
                    "encounter_id": encounter_id,
                    "prescription_id": prescription_id,
                }),
            })
        }
        "camp.pharmacy.dispense" => {
            require_permission(claims, permissions::pharmacy::dispensing::CREATE)?;
            let body: CampPharmacyDispenseSyncPayload = parse_sync_payload(event)?;
            if body.items.is_empty() {
                return Err(AppError::BadRequest(
                    "pharmacy dispense sync requires at least one item".to_owned(),
                ));
            }
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let patient_id = resolve_camp_patient_id(
                tx,
                claims.tenant_id,
                body.patient_id,
                body.registration_id,
            )
            .await?;
            let order_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO pharmacy_orders \
                 (tenant_id, prescription_id, patient_id, encounter_id, ordered_by, status, notes, \
                  dispensing_type, dispensed_by, dispensed_at, reviewed_at, review_notes) \
                 VALUES ($1, $2, $3, $4, $5, 'dispensed', $6, \
                         'prescription'::pharmacy_dispensing_type, $5, now(), now(), 'Camp offline sync') \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(body.prescription_id)
            .bind(patient_id)
            .bind(body.encounter_id)
            .bind(claims.sub)
            .bind(&body.notes)
            .fetch_one(&mut **tx)
            .await?;

            for item in &body.items {
                if item.quantity <= 0 {
                    return Err(AppError::BadRequest(
                        "dispense quantity must be greater than zero".to_owned(),
                    ));
                }
                if let Some(catalog_item_id) = item.catalog_item_id {
                    let safety = sqlx::query_as::<_, PharmacySafetyRow>(
                        "SELECT current_stock, drug_schedule, is_controlled, prescription_only, narcotic_class \
                         FROM pharmacy_catalog \
                         WHERE tenant_id = $1 AND id = $2 AND is_active = true",
                    )
                    .bind(claims.tenant_id)
                    .bind(catalog_item_id)
                    .fetch_optional(&mut **tx)
                    .await?
                    .ok_or(AppError::NotFound)?;

                    let schedule = safety.drug_schedule.as_deref().unwrap_or_default();
                    let restricted = safety.is_controlled
                        || safety.narcotic_class.is_some()
                        || matches!(schedule, "NDPS" | "X");
                    if restricted {
                        require_permission(claims, permissions::pharmacy::ndps::MANAGE)?;
                        if body
                            .restricted_approval_reason
                            .as_deref()
                            .unwrap_or("")
                            .trim()
                            .is_empty()
                        {
                            return Err(AppError::BadRequest(
                                "restricted camp pharmacy item requires approval reason".to_owned(),
                            ));
                        }
                    }
                    if safety.prescription_only.unwrap_or(false)
                        && body.prescription_id.is_none()
                        && matches!(schedule, "H" | "H1" | "X" | "NDPS")
                    {
                        return Err(AppError::BadRequest(
                            "prescription-only camp medicine requires prescription_id".to_owned(),
                        ));
                    }
                    if safety.current_stock < item.quantity {
                        return Err(AppError::BadRequest(format!(
                            "insufficient stock for {}",
                            item.drug_name
                        )));
                    }

                    if let Some(batch_id) = item.batch_stock_id {
                        let updated = sqlx::query_scalar::<_, Uuid>(
                            "UPDATE pharmacy_batches \
                             SET quantity_on_hand = quantity_on_hand - $3, \
                                 quantity_dispensed = quantity_dispensed + $3, \
                                 updated_at = now() \
                             WHERE tenant_id = $1 \
                               AND id = $2 \
                               AND catalog_item_id = $4 \
                               AND quantity_on_hand >= $3 \
                               AND expiry_date >= CURRENT_DATE \
                               AND quarantine_status = 'cleared' \
                             RETURNING id",
                        )
                        .bind(claims.tenant_id)
                        .bind(batch_id)
                        .bind(item.quantity)
                        .bind(catalog_item_id)
                        .fetch_optional(&mut **tx)
                        .await?;
                        if updated.is_none() {
                            return Err(AppError::BadRequest(format!(
                                "batch unavailable or expired for {}",
                                item.drug_name
                            )));
                        }
                    }

                    let updated = sqlx::query_scalar::<_, Uuid>(
                        "UPDATE pharmacy_catalog \
                         SET current_stock = current_stock - $3, updated_at = now() \
                         WHERE tenant_id = $1 AND id = $2 AND current_stock >= $3 \
                         RETURNING id",
                    )
                    .bind(claims.tenant_id)
                    .bind(catalog_item_id)
                    .bind(item.quantity)
                    .fetch_optional(&mut **tx)
                    .await?;
                    if updated.is_none() {
                        return Err(AppError::BadRequest(format!(
                            "insufficient stock for {}",
                            item.drug_name
                        )));
                    }
                }

                let total_price = item.unit_price * Decimal::from(item.quantity);
                sqlx::query(
                    "INSERT INTO pharmacy_order_items \
                     (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, \
                      total_price, batch_number, expiry_date, batch_stock_id) \
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                )
                .bind(claims.tenant_id)
                .bind(order_id)
                .bind(item.catalog_item_id)
                .bind(&item.drug_name)
                .bind(item.quantity)
                .bind(item.unit_price)
                .bind(total_price)
                .bind(&item.batch_number)
                .bind(item.expiry_date)
                .bind(item.batch_stock_id)
                .execute(&mut **tx)
                .await?;
            }

            Ok(AppliedSyncEvent {
                server_entity_type: "pharmacy_order".to_owned(),
                server_entity_id: order_id,
                server_entities: serde_json::json!({
                    "patient_id": patient_id,
                    "encounter_id": body.encounter_id,
                    "pharmacy_order_id": order_id,
                }),
            })
        }
        "camp.billing.record" => {
            require_permission(claims, permissions::billing::invoices::CREATE)?;
            let body: CampBillingRecordSyncPayload = parse_sync_payload(event)?;
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let patient_id = resolve_camp_patient_id(
                tx,
                claims.tenant_id,
                body.patient_id,
                body.registration_id,
            )
            .await?;
            let quantity = body.quantity.unwrap_or(1).max(1);
            let subtotal = body.unit_price * Decimal::from(quantity);
            let tax_percent = body.tax_percent.unwrap_or(Decimal::ZERO);
            let tax_amount = subtotal * tax_percent / Decimal::from(100);
            let discount_amount = body.discount_amount.unwrap_or(Decimal::ZERO);
            let total_amount = subtotal + tax_amount - discount_amount;
            let invoice_number = generate_sequence_code(tx, &claims.tenant_id, "INVOICE").await?;
            let invoice_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO invoices \
                 (tenant_id, invoice_number, patient_id, encounter_id, status, subtotal, \
                  tax_amount, discount_amount, total_amount, paid_amount, notes, issued_at, created_by) \
                 VALUES ($1, $2, $3, $4, 'issued'::invoice_status, $5, $6, $7, $8, 0, $9, now(), $10) \
                 RETURNING id",
            )
            .bind(claims.tenant_id)
            .bind(&invoice_number)
            .bind(patient_id)
            .bind(body.encounter_id)
            .bind(subtotal)
            .bind(tax_amount)
            .bind(discount_amount)
            .bind(total_amount)
            .bind(&body.notes)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            sqlx::query(
                "INSERT INTO invoice_items \
                 (tenant_id, invoice_id, charge_code, description, source, source_id, quantity, \
                  unit_price, tax_percent, total_price, source_module) \
                 VALUES ($1, $2, $3, $4, 'manual'::charge_source, $5, $6, $7, $8, $9, 'camp')",
            )
            .bind(claims.tenant_id)
            .bind(invoice_id)
            .bind(body.charge_code.unwrap_or_else(|| "CAMP".to_owned()))
            .bind(body.service_description)
            .bind(camp_id)
            .bind(quantity)
            .bind(body.unit_price)
            .bind(tax_percent)
            .bind(total_amount)
            .execute(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "invoice".to_owned(),
                server_entity_id: invoice_id,
                server_entities: serde_json::json!({
                    "patient_id": patient_id,
                    "encounter_id": body.encounter_id,
                    "invoice_id": invoice_id,
                    "invoice_number": invoice_number,
                }),
            })
        }
        "camp.registration.create" => {
            require_permission(claims, permissions::camp::registrations::CREATE)?;
            let body: CreateRegistrationRequest = parse_sync_payload(event)?;
            if body.camp_id != camp_id {
                return Err(AppError::BadRequest(
                    "registration payload camp_id does not match sync camp_id".to_owned(),
                ));
            }

            let camp =
                sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1 AND tenant_id = $2")
                    .bind(camp_id)
                    .bind(claims.tenant_id)
                    .fetch_optional(&mut **tx)
                    .await?
                    .ok_or(AppError::NotFound)?;
            let camp_ctx = CampSyncCampContext {
                camp_code: camp.camp_code.clone(),
                name: camp.name.clone(),
                organizing_department_id: camp.organizing_department_id,
            };
            let patient_id =
                create_or_link_patient_for_camp_registration(tx, claims, camp_id, &camp_ctx, &body)
                    .await?;

            let count_row = sqlx::query_as::<_, CountRow>(
                "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
            )
            .bind(camp_id)
            .fetch_one(&mut **tx)
            .await?;
            let seq = count_row.count.unwrap_or(0) + 1;
            let reg_number = format!("CR-{}-{seq:04}", camp.camp_code);
            let entity_id = event.client_entity_id.unwrap_or_else(Uuid::new_v4);

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO camp_registrations \
                 (id, tenant_id, camp_id, registration_number, person_name, age, gender, phone, \
                  address, id_proof_type, id_proof_number, patient_id, chief_complaint, \
                  is_walk_in, registered_by) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \
                         $9, $10, $11, $12, $13, \
                         COALESCE($14, true), $15) \
                 RETURNING id",
            )
            .bind(entity_id)
            .bind(claims.tenant_id)
            .bind(camp_id)
            .bind(&reg_number)
            .bind(&body.person_name)
            .bind(body.age)
            .bind(&body.gender)
            .bind(&body.phone)
            .bind(&body.address)
            .bind(&body.id_proof_type)
            .bind(&body.id_proof_number)
            .bind(patient_id)
            .bind(&body.chief_complaint)
            .bind(body.is_walk_in)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            let encounter_link = if camp_ctx.organizing_department_id.is_some() {
                Some(
                    find_or_create_camp_encounter(
                        tx,
                        claims,
                        camp_id,
                        patient_id,
                        camp_ctx.organizing_department_id,
                        camp.coordinator_id,
                        body.chief_complaint.as_deref(),
                    )
                    .await?,
                )
            } else {
                None
            };

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_registration".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({
                    "camp_registration_id": server_id,
                    "patient_id": patient_id,
                    "encounter_id": encounter_link.as_ref().map(|link| link.encounter_id),
                    "queue_id": encounter_link.as_ref().and_then(|link| link.queue_id),
                }),
            })
        }
        "camp.screening.create" => {
            require_permission(claims, permissions::camp::screenings::MANAGE)?;
            let body: CreateScreeningRequest = parse_sync_payload(event)?;
            ensure_registration_belongs_to_camp(
                tx,
                claims.tenant_id,
                camp_id,
                body.registration_id,
            )
            .await?;
            let entity_id = event.client_entity_id.unwrap_or_else(Uuid::new_v4);

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO camp_screenings \
                 (id, tenant_id, registration_id, bp_systolic, bp_diastolic, pulse_rate, spo2, \
                  temperature, blood_sugar_random, bmi, height_cm, weight_kg, \
                  visual_acuity_left, visual_acuity_right, findings, diagnosis, advice, \
                  referred_to_hospital, referral_department, referral_urgency, screened_by) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, \
                         $8, $9, $10, $11, $12, \
                         $13, $14, $15, $16, $17, \
                         COALESCE($18, false), $19, $20, $21) \
                 RETURNING id",
            )
            .bind(entity_id)
            .bind(claims.tenant_id)
            .bind(body.registration_id)
            .bind(body.bp_systolic)
            .bind(body.bp_diastolic)
            .bind(body.pulse_rate)
            .bind(body.spo2)
            .bind(body.temperature)
            .bind(body.blood_sugar_random)
            .bind(body.bmi)
            .bind(body.height_cm)
            .bind(body.weight_kg)
            .bind(body.visual_acuity_left)
            .bind(body.visual_acuity_right)
            .bind(&body.findings)
            .bind(&body.diagnosis)
            .bind(&body.advice)
            .bind(body.referred_to_hospital)
            .bind(body.referral_department)
            .bind(body.referral_urgency)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            sqlx::query(
                "UPDATE camp_registrations SET status = \
                 CASE WHEN COALESCE($2, false) THEN 'referred'::camp_registration_status \
                      ELSE 'screened'::camp_registration_status END \
                 WHERE id = $1 AND status IN ('registered', 'screened', 'referred')",
            )
            .bind(body.registration_id)
            .bind(body.referred_to_hospital)
            .execute(&mut **tx)
            .await?;

            let patient_id =
                patient_for_registration(tx, claims.tenant_id, body.registration_id).await?;
            let camp_ctx = camp_context(tx, claims.tenant_id, camp_id).await?;
            let encounter_link = if let (Some(pid), Some(department_id)) =
                (patient_id, camp_ctx.organizing_department_id)
            {
                Some(
                    find_or_create_camp_encounter(
                        tx,
                        claims,
                        camp_id,
                        pid,
                        Some(department_id),
                        None,
                        body.findings.as_deref(),
                    )
                    .await?,
                )
            } else {
                None
            };

            if let Some(link) = &encounter_link {
                let bmi = calculate_bmi(body.weight_kg, body.height_cm).or(body.bmi);
                sqlx::query(
                    "INSERT INTO vitals \
                     (tenant_id, encounter_id, recorded_by, temperature, pulse, \
                      systolic_bp, diastolic_bp, spo2, weight_kg, height_cm, bmi, notes, recorded_at) \
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())",
                )
                .bind(claims.tenant_id)
                .bind(link.encounter_id)
                .bind(claims.sub)
                .bind(body.temperature)
                .bind(body.pulse_rate)
                .bind(body.bp_systolic)
                .bind(body.bp_diastolic)
                .bind(body.spo2)
                .bind(body.weight_kg)
                .bind(body.height_cm)
                .bind(bmi)
                .bind(body.findings.as_deref().or(body.advice.as_deref()))
                .execute(&mut **tx)
                .await?;
            }

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_screening".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({
                    "camp_screening_id": server_id,
                    "patient_id": patient_id,
                    "encounter_id": encounter_link.as_ref().map(|link| link.encounter_id),
                }),
            })
        }
        "camp.lab_sample.create" => {
            require_permission(claims, permissions::camp::lab::MANAGE)?;
            let body: CreateLabSampleRequest = parse_sync_payload(event)?;
            ensure_registration_belongs_to_camp(
                tx,
                claims.tenant_id,
                camp_id,
                body.registration_id,
            )
            .await?;
            let entity_id = event.client_entity_id.unwrap_or_else(Uuid::new_v4);

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO camp_lab_samples \
                 (id, tenant_id, registration_id, sample_type, test_requested, barcode, \
                  collected_at, collected_by) \
                 VALUES ($1, $2, $3, $4, $5, $6, now(), $7) \
                 RETURNING id",
            )
            .bind(entity_id)
            .bind(claims.tenant_id)
            .bind(body.registration_id)
            .bind(body.sample_type)
            .bind(body.test_requested)
            .bind(body.barcode)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_lab_sample".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({ "camp_lab_sample_id": server_id }),
            })
        }
        "camp.referral.create" => {
            require_permission(claims, permissions::camp::screenings::MANAGE)?;
            let body: CreateCampReferralRequest = parse_sync_payload(event)?;
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let entity_id = event.client_entity_id.unwrap_or_else(Uuid::new_v4);

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO camp_referrals \
                 (id, tenant_id, camp_id, registration_id, referred_to_facility, \
                  referral_department, urgency, reason, transport_mode, ambulance_required, \
                  attendant_name, attendant_phone, referred_by) \
                 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'routine'), $8, $9, \
                         COALESCE($10, false), $11, $12, $13) \
                 RETURNING id",
            )
            .bind(entity_id)
            .bind(claims.tenant_id)
            .bind(camp_id)
            .bind(body.registration_id)
            .bind(body.referred_to_facility)
            .bind(body.referral_department)
            .bind(body.urgency)
            .bind(body.reason)
            .bind(body.transport_mode)
            .bind(body.ambulance_required)
            .bind(body.attendant_name)
            .bind(body.attendant_phone)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_referral".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({ "camp_referral_id": server_id }),
            })
        }
        "camp.incident.create" => {
            require_permission(claims, permissions::camp::LIST)?;
            let body: CreateCampIncidentRequest = parse_sync_payload(event)?;
            if let Some(registration_id) = body.registration_id {
                ensure_registration_belongs_to_camp(tx, claims.tenant_id, camp_id, registration_id)
                    .await?;
            }
            let entity_id = event.client_entity_id.unwrap_or_else(Uuid::new_v4);

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO camp_incidents \
                 (id, tenant_id, camp_id, registration_id, incident_type, severity, \
                  description, immediate_action, reported_by) \
                 VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'low'), $7, $8, $9) \
                 RETURNING id",
            )
            .bind(entity_id)
            .bind(claims.tenant_id)
            .bind(camp_id)
            .bind(body.registration_id)
            .bind(body.incident_type)
            .bind(body.severity)
            .bind(body.description)
            .bind(body.immediate_action)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_incident".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({ "camp_incident_id": server_id }),
            })
        }
        "camp.checklist.update" => {
            require_permission(claims, permissions::camp::UPDATE)?;
            let body: UpdateChecklistSyncPayload = parse_sync_payload(event)?;
            let checklist_id = body.checklist_item_id.or(event.client_entity_id);

            let item = if let Some(id) = checklist_id {
                sqlx::query_as::<_, CampRemoteChecklistItem>(
                    "UPDATE camp_remote_checklist_items SET \
                     status = $2, notes = COALESCE($3, notes), checked_by = $4, checked_at = now() \
                     WHERE id = $1 AND camp_id = $5 AND tenant_id = $6 \
                     RETURNING *",
                )
                .bind(id)
                .bind(body.status)
                .bind(body.notes)
                .bind(claims.sub)
                .bind(camp_id)
                .bind(claims.tenant_id)
                .fetch_optional(&mut **tx)
                .await?
            } else if let Some(code) = body.code {
                sqlx::query_as::<_, CampRemoteChecklistItem>(
                    "UPDATE camp_remote_checklist_items SET \
                     status = $3, notes = COALESCE($4, notes), checked_by = $5, checked_at = now() \
                     WHERE camp_id = $1 AND tenant_id = $2 AND code = $6 \
                     RETURNING *",
                )
                .bind(camp_id)
                .bind(claims.tenant_id)
                .bind(body.status)
                .bind(body.notes)
                .bind(claims.sub)
                .bind(code)
                .fetch_optional(&mut **tx)
                .await?
            } else {
                return Err(AppError::BadRequest(
                    "checklist sync requires checklist_item_id, client_entity_id, or code"
                        .to_owned(),
                ));
            }
            .ok_or(AppError::NotFound)?;

            let checklist = sqlx::query_as::<_, CampRemoteChecklistItem>(
                "SELECT * FROM camp_remote_checklist_items WHERE camp_id = $1 AND tenant_id = $2",
            )
            .bind(camp_id)
            .bind(claims.tenant_id)
            .fetch_all(&mut **tx)
            .await?;
            let readiness = readiness_summary(&checklist);
            sqlx::query(
                "UPDATE camp_remote_setups SET readiness_score = $3 \
                 WHERE camp_id = $1 AND tenant_id = $2",
            )
            .bind(camp_id)
            .bind(claims.tenant_id)
            .bind(readiness.score)
            .execute(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_remote_checklist_item".to_owned(),
                server_entity_id: item.id,
                server_entities: serde_json::json!({ "camp_checklist_item_id": item.id }),
            })
        }
        "camp.supply.create" => {
            require_permission(claims, permissions::camp::UPDATE)?;
            let body: CreateSupplyItemRequest = parse_sync_payload(event)?;
            let entity_id = event.client_entity_id.unwrap_or_else(Uuid::new_v4);

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO camp_supply_items \
                 (id, tenant_id, camp_id, category, item_name, unit, planned_qty, packed_qty, \
                  batch_no, expiry_date, is_critical, shortage_notes) \
                 VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0), COALESCE($8, 0), \
                         $9, $10, COALESCE($11, false), $12) \
                 RETURNING id",
            )
            .bind(entity_id)
            .bind(claims.tenant_id)
            .bind(camp_id)
            .bind(body.category)
            .bind(body.item_name)
            .bind(body.unit)
            .bind(body.planned_qty)
            .bind(body.packed_qty)
            .bind(body.batch_no)
            .bind(body.expiry_date)
            .bind(body.is_critical)
            .bind(body.shortage_notes)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_supply_item".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({ "camp_supply_item_id": server_id }),
            })
        }
        "camp.supply.update" | "camp.stock.adjust" => {
            require_permission(claims, permissions::camp::UPDATE)?;
            let body: UpdateSupplySyncPayload = parse_sync_payload(event)?;

            let server_id = sqlx::query_scalar::<_, Uuid>(
                "UPDATE camp_supply_items SET \
                 packed_qty = COALESCE($2, packed_qty), \
                 consumed_qty = COALESCE($3, consumed_qty), \
                 returned_qty = COALESCE($4, returned_qty), \
                 shortage_notes = COALESCE($5, shortage_notes) \
                 WHERE id = $1 AND camp_id = $6 AND tenant_id = $7 \
                 RETURNING id",
            )
            .bind(body.supply_item_id)
            .bind(body.packed_qty)
            .bind(body.consumed_qty)
            .bind(body.returned_qty)
            .bind(body.shortage_notes)
            .bind(camp_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(AppError::NotFound)?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_supply_item".to_owned(),
                server_entity_id: server_id,
                server_entities: serde_json::json!({ "camp_supply_item_id": server_id }),
            })
        }
        other => Err(AppError::BadRequest(format!(
            "unsupported camp sync event_type: {other}"
        ))),
    }
}

// ══════════════════════════════════════════════════════════
//  Handlers — Camps
// ══════════════════════════════════════════════════════════

pub async fn list_camps(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCampsQuery>,
) -> Result<Json<Vec<Camp>>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Camp>(
        "SELECT * FROM camps \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR camp_type::text = $2) \
         ORDER BY scheduled_date DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.camp_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_camp_packet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(params): Query<CampPacketQuery>,
) -> Result<Json<CampPacketResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;
    require_permission(&claims, permissions::camp::registrations::LIST)?;
    require_permission(&claims, permissions::camp::screenings::LIST)?;
    require_permission(&claims, permissions::camp::lab::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let team = sqlx::query_as::<_, CampTeamMember>(
        "SELECT * FROM camp_team_members WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY role_in_camp, created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let registrations = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let screenings = sqlx::query_as::<_, CampScreening>(
        "SELECT s.* FROM camp_screenings s \
         JOIN camp_registrations r ON r.id = s.registration_id \
         WHERE r.camp_id = $1 AND s.tenant_id = $2 \
         ORDER BY s.created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let lab_samples = sqlx::query_as::<_, CampLabSample>(
        "SELECT ls.* FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE r.camp_id = $1 AND ls.tenant_id = $2 \
         ORDER BY ls.created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let remote_setup = sqlx::query_as::<_, CampRemoteSetup>(
        "SELECT * FROM camp_remote_setups WHERE camp_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let remote_checklist = sqlx::query_as::<_, CampRemoteChecklistItem>(
        "SELECT * FROM camp_remote_checklist_items \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY category, code",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let supplies = sqlx::query_as::<_, CampSupplyItem>(
        "SELECT * FROM camp_supply_items \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY is_critical DESC, category, item_name",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let patient_summaries = sqlx::query_as::<_, CampPacketPatientSummary>(
        "SELECT DISTINCT \
            p.id AS patient_id, \
            p.uhid, \
            concat_ws(' ', p.first_name, NULLIF(p.middle_name, ''), p.last_name) AS display_name, \
            p.gender::text AS gender, \
            p.date_of_birth, \
            EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth))::int AS age_years, \
            CASE WHEN p.phone IS NULL THEN NULL ELSE right(p.phone, 4) END AS phone_last4, \
            p.blood_group::text AS blood_group, \
            p.no_known_allergies, \
            p.last_visit_date, \
            p.is_vip, \
            p.is_medico_legal, \
            p.updated_at \
         FROM patients p \
         JOIN camp_registrations r ON r.patient_id = p.id \
         WHERE r.camp_id = $1 AND p.tenant_id = $2 AND p.is_active = true \
         ORDER BY display_name",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let active_allergies = sqlx::query_as::<_, CampPacketAllergy>(
        "SELECT \
            pa.patient_id, \
            pa.allergy_type::text AS allergy_type, \
            pa.allergen_name, \
            pa.allergen_code, \
            pa.reaction, \
            pa.severity::text AS severity \
         FROM patient_allergies pa \
         WHERE pa.tenant_id = $2 \
           AND pa.is_active = true \
           AND pa.patient_id IN ( \
             SELECT DISTINCT patient_id FROM camp_registrations \
             WHERE camp_id = $1 AND tenant_id = $2 AND patient_id IS NOT NULL \
           ) \
         ORDER BY pa.patient_id, pa.severity DESC NULLS LAST, pa.allergen_name",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let recent_vitals = sqlx::query_as::<_, CampPacketVital>(
        "WITH ranked_vitals AS ( \
            SELECT \
                e.patient_id, \
                v.encounter_id, \
                v.temperature, \
                v.pulse, \
                v.systolic_bp, \
                v.diastolic_bp, \
                v.respiratory_rate, \
                v.spo2, \
                v.weight_kg, \
                v.height_cm, \
                v.bmi, \
                v.notes, \
                v.recorded_at, \
                row_number() OVER (PARTITION BY e.patient_id ORDER BY v.recorded_at DESC) AS rn \
            FROM vitals v \
            JOIN encounters e ON e.id = v.encounter_id \
            WHERE v.tenant_id = $2 \
              AND e.patient_id IN ( \
                SELECT DISTINCT patient_id FROM camp_registrations \
                WHERE camp_id = $1 AND tenant_id = $2 AND patient_id IS NOT NULL \
              ) \
         ) \
         SELECT patient_id, encounter_id, temperature, pulse, systolic_bp, diastolic_bp, \
                respiratory_rate, spo2, weight_kg, height_cm, bmi, notes, recorded_at \
         FROM ranked_vitals \
         WHERE rn <= 3 \
         ORDER BY patient_id, recorded_at DESC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let registration_history = sqlx::query_as::<_, CampPacketRegistrationHistory>(
        "WITH cohort AS ( \
            SELECT DISTINCT patient_id \
            FROM camp_registrations \
            WHERE camp_id = $1 AND tenant_id = $2 AND patient_id IS NOT NULL \
         ), ranked AS ( \
            SELECT \
                r.patient_id, \
                r.id AS registration_id, \
                c.id AS camp_id, \
                c.camp_code, \
                c.name AS camp_name, \
                r.registration_number, \
                r.person_name, \
                r.age, \
                r.gender, \
                CASE WHEN r.phone IS NULL THEN NULL ELSE right(r.phone, 4) END AS phone_last4, \
                r.chief_complaint, \
                r.status::text AS status, \
                c.venue_city, \
                c.venue_state, \
                r.created_at AS registered_at, \
                (r.camp_id = $1) AS current_camp, \
                row_number() OVER ( \
                    PARTITION BY COALESCE(r.patient_id, r.id) \
                    ORDER BY r.created_at DESC \
                ) AS rn \
            FROM camp_registrations r \
            JOIN camps c ON c.id = r.camp_id AND c.tenant_id = r.tenant_id \
            WHERE r.tenant_id = $2 \
              AND (r.camp_id = $1 OR r.patient_id IN (SELECT patient_id FROM cohort)) \
         ) \
         SELECT patient_id, registration_id, camp_id, camp_code, camp_name, registration_number, \
                person_name, age, gender, phone_last4, chief_complaint, status, venue_city, \
                venue_state, registered_at, current_camp \
         FROM ranked \
         WHERE current_camp = true OR rn <= 5 \
         ORDER BY current_camp DESC, registered_at DESC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let visit_history = sqlx::query_as::<_, CampPacketVisitHistory>(
        "WITH cohort AS ( \
            SELECT DISTINCT patient_id \
            FROM camp_registrations \
            WHERE camp_id = $1 AND tenant_id = $2 AND patient_id IS NOT NULL \
         ), ranked AS ( \
            SELECT \
                e.patient_id, \
                e.id AS encounter_id, \
                e.encounter_type::text AS encounter_type, \
                e.status::text AS status, \
                e.encounter_date, \
                d.name AS department_name, \
                u.full_name AS doctor_name, \
                e.notes, \
                ( \
                    SELECT string_agg( \
                        concat_ws(' ', NULLIF(dx.icd_code, ''), dx.description), \
                        '; ' ORDER BY dx.is_primary DESC, dx.created_at DESC \
                    ) \
                    FROM diagnoses dx \
                    WHERE dx.tenant_id = e.tenant_id AND dx.encounter_id = e.id \
                ) AS diagnosis_summary, \
                ( \
                    SELECT string_agg( \
                        concat_ws(' ', pi.drug_name, pi.dosage, pi.frequency), \
                        '; ' ORDER BY pi.created_at DESC \
                    ) \
                    FROM prescriptions pr \
                    JOIN prescription_items pi \
                      ON pi.prescription_id = pr.id AND pi.tenant_id = pr.tenant_id \
                    WHERE pr.tenant_id = e.tenant_id AND pr.encounter_id = e.id \
                ) AS prescription_summary, \
                row_number() OVER ( \
                    PARTITION BY e.patient_id ORDER BY e.encounter_date DESC, e.created_at DESC \
                ) AS rn \
            FROM encounters e \
            LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
            LEFT JOIN users u ON u.id = e.doctor_id AND u.tenant_id = e.tenant_id \
            WHERE e.tenant_id = $2 AND e.patient_id IN (SELECT patient_id FROM cohort) \
         ) \
         SELECT patient_id, encounter_id, encounter_type, status, encounter_date, \
                department_name, doctor_name, notes, diagnosis_summary, prescription_summary \
         FROM ranked \
         WHERE rn <= 5 \
         ORDER BY patient_id, encounter_date DESC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let diagnosis_history = sqlx::query_as::<_, CampPacketDiagnosisHistory>(
        "WITH cohort AS ( \
            SELECT DISTINCT patient_id \
            FROM camp_registrations \
            WHERE camp_id = $1 AND tenant_id = $2 AND patient_id IS NOT NULL \
         ), ranked AS ( \
            SELECT \
                e.patient_id, \
                dx.encounter_id, \
                dx.icd_code, \
                dx.description, \
                dx.is_primary, \
                dx.severity, \
                dx.certainty, \
                dx.onset_date, \
                dx.created_at, \
                row_number() OVER ( \
                    PARTITION BY e.patient_id ORDER BY dx.created_at DESC \
                ) AS rn \
            FROM diagnoses dx \
            JOIN encounters e ON e.id = dx.encounter_id AND e.tenant_id = dx.tenant_id \
            WHERE dx.tenant_id = $2 AND e.patient_id IN (SELECT patient_id FROM cohort) \
         ) \
         SELECT patient_id, encounter_id, icd_code, description, is_primary, severity, \
                certainty, onset_date, created_at \
         FROM ranked \
         WHERE rn <= 10 \
         ORDER BY patient_id, created_at DESC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let medication_history = sqlx::query_as::<_, CampPacketMedicationHistory>(
        "WITH cohort AS ( \
            SELECT DISTINCT patient_id \
            FROM camp_registrations \
            WHERE camp_id = $1 AND tenant_id = $2 AND patient_id IS NOT NULL \
         ), ranked AS ( \
            SELECT \
                e.patient_id, \
                e.id AS encounter_id, \
                pr.id AS prescription_id, \
                pi.drug_name, \
                pi.dosage, \
                pi.frequency, \
                pi.duration, \
                pi.route, \
                pi.instructions, \
                pi.item_status, \
                pr.created_at AS prescribed_at, \
                row_number() OVER ( \
                    PARTITION BY e.patient_id ORDER BY pr.created_at DESC, pi.created_at DESC \
                ) AS rn \
            FROM prescriptions pr \
            JOIN prescription_items pi \
              ON pi.prescription_id = pr.id AND pi.tenant_id = pr.tenant_id \
            JOIN encounters e ON e.id = pr.encounter_id AND e.tenant_id = pr.tenant_id \
            WHERE pr.tenant_id = $2 \
              AND e.patient_id IN (SELECT patient_id FROM cohort) \
              AND pi.item_status <> 'discontinued' \
         ) \
         SELECT patient_id, encounter_id, prescription_id, drug_name, dosage, frequency, \
                duration, route, instructions, item_status, prescribed_at \
         FROM ranked \
         WHERE rn <= 12 \
         ORDER BY patient_id, prescribed_at DESC",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let department_refs = sqlx::query_as::<_, CampPacketDepartmentRef>(
        "SELECT id, code, name, department_type::text AS department_type \
         FROM departments \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let doctor_refs = sqlx::query_as::<_, CampPacketDoctorRef>(
        "SELECT id, full_name, specialization, medical_registration_number, department_ids \
         FROM users \
         WHERE tenant_id = $1 \
           AND is_active = true \
           AND (role::text ILIKE '%doctor%' OR medical_registration_number IS NOT NULL) \
         ORDER BY full_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let lab_test_refs = sqlx::query_as::<_, CampPacketLabTestRef>(
        "SELECT id, code, name, department_id, sample_type, price, loinc_code \
         FROM lab_test_catalog \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let pharmacy_stock_refs = sqlx::query_as::<_, CampPacketPharmacyStockRef>(
        "SELECT \
            pc.id AS catalog_item_id, \
            pc.code, \
            pc.name, \
            pc.generic_name, \
            pc.category, \
            pc.unit, \
            pc.base_price, \
            pc.tax_percent, \
            pc.current_stock, \
            pc.drug_schedule, \
            pc.is_controlled, \
            pc.is_lasa, \
            pc.aware_category, \
            pc.prescription_only, \
            pb.id AS batch_id, \
            pb.batch_number, \
            pb.expiry_date, \
            pb.quantity_on_hand, \
            pb.store_location_id, \
            pb.selling_rate \
         FROM pharmacy_catalog pc \
         LEFT JOIN LATERAL ( \
            SELECT id, batch_number, expiry_date, quantity_on_hand, store_location_id, selling_rate \
            FROM pharmacy_batches \
            WHERE tenant_id = pc.tenant_id \
              AND catalog_item_id = pc.id \
              AND quantity_on_hand > 0 \
              AND expiry_date >= CURRENT_DATE \
              AND quarantine_status = 'cleared' \
            ORDER BY expiry_date ASC, created_at ASC \
            LIMIT 1 \
         ) pb ON true \
         WHERE pc.tenant_id = $1 \
           AND pc.is_active = true \
           AND pc.current_stock > 0 \
         ORDER BY pc.name \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let downloaded_at = Utc::now();
    let expires_naive = camp
        .scheduled_date
        .and_hms_opt(23, 59, 59)
        .ok_or_else(|| AppError::BadRequest("invalid camp scheduled_date".to_owned()))?
        + Duration::days(1);
    let expires_at = DateTime::<Utc>::from_naive_utc_and_offset(expires_naive, Utc);
    let packet_revision = format!("camp:{id}:{}", downloaded_at.timestamp_millis());

    sqlx::query(
        "INSERT INTO audit_log \
         (tenant_id, user_id, action, entity_type, entity_id, new_values, module, description) \
         VALUES ($1, $2, 'camp.packet.download', 'camp_sync_packet', $3, $4, 'camp', $5)",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(id)
    .bind(serde_json::json!({
        "camp_id": id,
        "device_id": params.device_id,
        "registration_count": registrations.len(),
        "screening_count": screenings.len(),
        "lab_sample_count": lab_samples.len(),
        "remote_checklist_count": remote_checklist.len(),
        "supply_count": supplies.len(),
        "linked_patient_count": patient_summaries.len(),
        "registration_history_count": registration_history.len(),
        "visit_history_count": visit_history.len(),
        "diagnosis_history_count": diagnosis_history.len(),
        "medication_history_count": medication_history.len(),
        "department_ref_count": department_refs.len(),
        "doctor_ref_count": doctor_refs.len(),
        "lab_test_ref_count": lab_test_refs.len(),
        "pharmacy_stock_ref_count": pharmacy_stock_refs.len(),
        "expires_at": expires_at,
    }))
    .bind("Camp offline packet downloaded")
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CampPacketResponse {
        camp,
        team,
        registrations,
        screenings,
        lab_samples,
        remote_setup,
        remote_checklist,
        supplies,
        patient_summaries,
        active_allergies,
        recent_vitals,
        registration_history,
        visit_history,
        diagnosis_history,
        medication_history,
        department_refs,
        doctor_refs,
        lab_test_refs,
        pharmacy_stock_refs,
        downloaded_at,
        expires_at,
        packet_revision,
    }))
}

pub async fn sync_camp_inbound(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CampSyncInboundRequest>,
) -> Result<Json<CampSyncInboundResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    if body.events.is_empty() {
        return Err(AppError::BadRequest(
            "sync batch must contain at least one event".to_owned(),
        ));
    }
    if body.events.len() > 200 {
        return Err(AppError::BadRequest(
            "sync batch cannot exceed 200 events".to_owned(),
        ));
    }
    if body.device_id.trim().is_empty() {
        return Err(AppError::BadRequest("device_id is required".to_owned()));
    }
    if body
        .events
        .iter()
        .any(|event| event.idempotency_key.trim().is_empty())
    {
        return Err(AppError::BadRequest(
            "every sync event requires an idempotency_key".to_owned(),
        ));
    }

    let mut camp_tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut camp_tx, &claims.tenant_id).await?;
    let camp_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM camps WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(body.camp_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *camp_tx)
    .await?;
    camp_tx.commit().await?;

    if !camp_exists {
        return Err(AppError::NotFound);
    }

    let mut results = Vec::with_capacity(body.events.len());
    let mut applied = 0usize;
    let mut duplicates = 0usize;
    let mut failed = 0usize;

    for event in &body.events {
        let mut tx = state.db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

        let existing = sqlx::query_as::<_, ExistingSyncEvent>(
            "SELECT event_type, status, server_entity_type, server_entity_id, error \
             FROM camp_sync_events \
             WHERE tenant_id = $1 AND idempotency_key = $2",
        )
        .bind(claims.tenant_id)
        .bind(&event.idempotency_key)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(existing) = existing {
            duplicates += 1;
            results.push(CampSyncEventResult {
                idempotency_key: event.idempotency_key.clone(),
                event_type: existing.event_type,
                status: "duplicate".to_owned(),
                server_entity_type: existing.server_entity_type,
                server_entity_id: existing.server_entity_id,
                server_entities: None,
                message: existing
                    .error
                    .or(Some(format!("already processed as {}", existing.status))),
            });
            tx.commit().await?;
            continue;
        }

        sqlx::query(
            "INSERT INTO camp_sync_events \
             (tenant_id, camp_id, device_id, idempotency_key, event_type, client_entity_id, \
              payload, occurred_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(claims.tenant_id)
        .bind(body.camp_id)
        .bind(&body.device_id)
        .bind(&event.idempotency_key)
        .bind(&event.event_type)
        .bind(event.client_entity_id)
        .bind(&event.payload)
        .bind(event.occurred_at)
        .execute(&mut *tx)
        .await?;

        match apply_camp_sync_event(&mut tx, &claims, body.camp_id, event).await {
            Ok(applied_event) => {
                let patient_grant_id = applied_event
                    .server_entities
                    .get("patient_id")
                    .and_then(serde_json::Value::as_str)
                    .and_then(|value| Uuid::parse_str(value).ok());
                sqlx::query(
                    "UPDATE camp_sync_events SET \
                     status = 'applied', server_entity_type = $3, server_entity_id = $4, \
                     applied_at = now() \
                     WHERE tenant_id = $1 AND idempotency_key = $2",
                )
                .bind(claims.tenant_id)
                .bind(&event.idempotency_key)
                .bind(&applied_event.server_entity_type)
                .bind(applied_event.server_entity_id)
                .execute(&mut *tx)
                .await?;

                applied += 1;
                tx.commit().await?;

                if let Some(patient_id) = patient_grant_id {
                    let authz_ctx = crate::middleware::authorization::authz_context(&claims);
                    if let Err(err) = state
                        .authz
                        .write_tuple(
                            &authz_ctx,
                            "patient",
                            patient_id,
                            medbrains_authz::Relation::Owner,
                            medbrains_authz::Subject::User(claims.sub),
                            None,
                            Some("camp_sync_patient_owner".to_owned()),
                        )
                        .await
                    {
                        tracing::warn!(
                            error = %err,
                            patient_id = %patient_id,
                            "camp sync patient authz grant failed"
                        );
                    }
                }

                results.push(CampSyncEventResult {
                    idempotency_key: event.idempotency_key.clone(),
                    event_type: event.event_type.clone(),
                    status: "applied".to_owned(),
                    server_entity_type: Some(applied_event.server_entity_type),
                    server_entity_id: Some(applied_event.server_entity_id),
                    server_entities: Some(applied_event.server_entities),
                    message: None,
                });
            }
            Err(err)
                if matches!(
                    &err,
                    AppError::BadRequest(_) | AppError::Conflict(_) | AppError::NotFound
                ) =>
            {
                let message = err.to_string();
                sqlx::query(
                    "UPDATE camp_sync_events SET status = 'failed', error = $3 \
                     WHERE tenant_id = $1 AND idempotency_key = $2",
                )
                .bind(claims.tenant_id)
                .bind(&event.idempotency_key)
                .bind(&message)
                .execute(&mut *tx)
                .await?;

                failed += 1;
                results.push(CampSyncEventResult {
                    idempotency_key: event.idempotency_key.clone(),
                    event_type: event.event_type.clone(),
                    status: "failed".to_owned(),
                    server_entity_type: None,
                    server_entity_id: None,
                    server_entities: None,
                    message: Some(message),
                });
                tx.commit().await?;
            }
            Err(err) => return Err(err),
        }
    }

    Ok(Json(CampSyncInboundResponse {
        camp_id: body.camp_id,
        device_id: body.device_id,
        accepted: results.len(),
        applied,
        duplicates,
        failed,
        results,
    }))
}

pub async fn get_remote_operations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<CampRemoteOperationsResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let _camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1 AND tenant_id = $2")
        .bind(camp_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    sqlx::query(
        "INSERT INTO camp_remote_setups (tenant_id, camp_id) \
         VALUES ($1, $2) \
         ON CONFLICT (tenant_id, camp_id) DO NOTHING",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .execute(&mut *tx)
    .await?;

    seed_default_remote_checklist(&mut tx, claims.tenant_id, camp_id).await?;

    let checklist = sqlx::query_as::<_, CampRemoteChecklistItem>(
        "SELECT * FROM camp_remote_checklist_items \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY category, code",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let readiness = readiness_summary(&checklist);
    let setup = sqlx::query_as::<_, CampRemoteSetup>(
        "UPDATE camp_remote_setups SET readiness_score = $3 \
         WHERE camp_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .bind(readiness.score)
    .fetch_one(&mut *tx)
    .await?;

    let supplies = sqlx::query_as::<_, CampSupplyItem>(
        "SELECT * FROM camp_supply_items \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY is_critical DESC, category, item_name",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let referrals = sqlx::query_as::<_, CampReferral>(
        "SELECT * FROM camp_referrals \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let incidents = sqlx::query_as::<_, CampIncident>(
        "SELECT * FROM camp_incidents \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CampRemoteOperationsResponse {
        setup,
        checklist,
        supplies,
        referrals,
        incidents,
        readiness,
    }))
}

pub async fn upsert_remote_setup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<UpsertRemoteSetupRequest>,
) -> Result<Json<CampRemoteSetup>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampRemoteSetup>(
        "INSERT INTO camp_remote_setups \
         (tenant_id, camp_id, village_name, block_name, district_name, site_landmark, \
          latitude, longitude, expected_footfall, site_contact_name, site_contact_phone, \
          local_authority_name, local_authority_phone, referral_facility_name, \
          referral_facility_phone, ambulance_contact_name, ambulance_contact_phone, \
          emergency_route_notes, network_plan, power_plan, water_sanitation_plan, \
          privacy_plan, crowd_control_plan, bmw_plan, infection_control_plan, status, \
          completed_by, completed_at) \
         VALUES \
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, \
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, COALESCE($26, 'draft'), \
          CASE WHEN COALESCE($26, 'draft') IN ('ready', 'closed') THEN $27 ELSE NULL END, \
          CASE WHEN COALESCE($26, 'draft') IN ('ready', 'closed') THEN now() ELSE NULL END) \
         ON CONFLICT (tenant_id, camp_id) DO UPDATE SET \
          village_name = COALESCE(EXCLUDED.village_name, camp_remote_setups.village_name), \
          block_name = COALESCE(EXCLUDED.block_name, camp_remote_setups.block_name), \
          district_name = COALESCE(EXCLUDED.district_name, camp_remote_setups.district_name), \
          site_landmark = COALESCE(EXCLUDED.site_landmark, camp_remote_setups.site_landmark), \
          latitude = COALESCE(EXCLUDED.latitude, camp_remote_setups.latitude), \
          longitude = COALESCE(EXCLUDED.longitude, camp_remote_setups.longitude), \
          expected_footfall = COALESCE(EXCLUDED.expected_footfall, camp_remote_setups.expected_footfall), \
          site_contact_name = COALESCE(EXCLUDED.site_contact_name, camp_remote_setups.site_contact_name), \
          site_contact_phone = COALESCE(EXCLUDED.site_contact_phone, camp_remote_setups.site_contact_phone), \
          local_authority_name = COALESCE(EXCLUDED.local_authority_name, camp_remote_setups.local_authority_name), \
          local_authority_phone = COALESCE(EXCLUDED.local_authority_phone, camp_remote_setups.local_authority_phone), \
          referral_facility_name = COALESCE(EXCLUDED.referral_facility_name, camp_remote_setups.referral_facility_name), \
          referral_facility_phone = COALESCE(EXCLUDED.referral_facility_phone, camp_remote_setups.referral_facility_phone), \
          ambulance_contact_name = COALESCE(EXCLUDED.ambulance_contact_name, camp_remote_setups.ambulance_contact_name), \
          ambulance_contact_phone = COALESCE(EXCLUDED.ambulance_contact_phone, camp_remote_setups.ambulance_contact_phone), \
          emergency_route_notes = COALESCE(EXCLUDED.emergency_route_notes, camp_remote_setups.emergency_route_notes), \
          network_plan = COALESCE(EXCLUDED.network_plan, camp_remote_setups.network_plan), \
          power_plan = COALESCE(EXCLUDED.power_plan, camp_remote_setups.power_plan), \
          water_sanitation_plan = COALESCE(EXCLUDED.water_sanitation_plan, camp_remote_setups.water_sanitation_plan), \
          privacy_plan = COALESCE(EXCLUDED.privacy_plan, camp_remote_setups.privacy_plan), \
          crowd_control_plan = COALESCE(EXCLUDED.crowd_control_plan, camp_remote_setups.crowd_control_plan), \
          bmw_plan = COALESCE(EXCLUDED.bmw_plan, camp_remote_setups.bmw_plan), \
          infection_control_plan = COALESCE(EXCLUDED.infection_control_plan, camp_remote_setups.infection_control_plan), \
          status = COALESCE(EXCLUDED.status, camp_remote_setups.status), \
          completed_by = CASE WHEN EXCLUDED.status IN ('ready', 'closed') THEN $27 ELSE camp_remote_setups.completed_by END, \
          completed_at = CASE WHEN EXCLUDED.status IN ('ready', 'closed') THEN now() ELSE camp_remote_setups.completed_at END \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.village_name)
    .bind(body.block_name)
    .bind(body.district_name)
    .bind(body.site_landmark)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.expected_footfall)
    .bind(body.site_contact_name)
    .bind(body.site_contact_phone)
    .bind(body.local_authority_name)
    .bind(body.local_authority_phone)
    .bind(body.referral_facility_name)
    .bind(body.referral_facility_phone)
    .bind(body.ambulance_contact_name)
    .bind(body.ambulance_contact_phone)
    .bind(body.emergency_route_notes)
    .bind(body.network_plan)
    .bind(body.power_plan)
    .bind(body.water_sanitation_plan)
    .bind(body.privacy_plan)
    .bind(body.crowd_control_plan)
    .bind(body.bmw_plan)
    .bind(body.infection_control_plan)
    .bind(body.status)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    seed_default_remote_checklist(&mut tx, claims.tenant_id, camp_id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_remote_checklist_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRemoteChecklistItemRequest>,
) -> Result<Json<CampRemoteChecklistItem>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let item = sqlx::query_as::<_, CampRemoteChecklistItem>(
        "UPDATE camp_remote_checklist_items SET \
         status = $2, notes = COALESCE($3, notes), checked_by = $4, checked_at = now() \
         WHERE id = $1 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.status)
    .bind(body.notes)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let checklist = sqlx::query_as::<_, CampRemoteChecklistItem>(
        "SELECT * FROM camp_remote_checklist_items WHERE camp_id = $1 AND tenant_id = $2",
    )
    .bind(item.camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let readiness = readiness_summary(&checklist);
    sqlx::query(
        "UPDATE camp_remote_setups SET readiness_score = $3 \
         WHERE camp_id = $1 AND tenant_id = $2",
    )
    .bind(item.camp_id)
    .bind(claims.tenant_id)
    .bind(readiness.score)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(item))
}

pub async fn create_supply_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<CreateSupplyItemRequest>,
) -> Result<Json<CampSupplyItem>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampSupplyItem>(
        "INSERT INTO camp_supply_items \
         (tenant_id, camp_id, category, item_name, unit, planned_qty, packed_qty, \
          batch_no, expiry_date, is_critical, shortage_notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, 0), $8, $9, COALESCE($10, false), $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.category)
    .bind(body.item_name)
    .bind(body.unit)
    .bind(body.planned_qty)
    .bind(body.packed_qty)
    .bind(body.batch_no)
    .bind(body.expiry_date)
    .bind(body.is_critical)
    .bind(body.shortage_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_supply_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSupplyItemRequest>,
) -> Result<Json<CampSupplyItem>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampSupplyItem>(
        "UPDATE camp_supply_items SET \
         packed_qty = COALESCE($2, packed_qty), \
         consumed_qty = COALESCE($3, consumed_qty), \
         returned_qty = COALESCE($4, returned_qty), \
         shortage_notes = COALESCE($5, shortage_notes) \
         WHERE id = $1 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.packed_qty)
    .bind(body.consumed_qty)
    .bind(body.returned_qty)
    .bind(body.shortage_notes)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_camp_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<CreateCampReferralRequest>,
) -> Result<Json<CampReferral>, AppError> {
    require_permission(&claims, permissions::camp::screenings::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampReferral>(
        "INSERT INTO camp_referrals \
         (tenant_id, camp_id, registration_id, referred_to_facility, referral_department, \
          urgency, reason, transport_mode, ambulance_required, attendant_name, attendant_phone, referred_by) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'routine'), $7, $8, COALESCE($9, false), $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.registration_id)
    .bind(body.referred_to_facility)
    .bind(body.referral_department)
    .bind(body.urgency)
    .bind(body.reason)
    .bind(body.transport_mode)
    .bind(body.ambulance_required)
    .bind(body.attendant_name)
    .bind(body.attendant_phone)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_camp_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCampReferralRequest>,
) -> Result<Json<CampReferral>, AppError> {
    require_permission(&claims, permissions::camp::screenings::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampReferral>(
        "UPDATE camp_referrals SET \
         status = COALESCE($2, status), \
         transport_mode = COALESCE($3, transport_mode), \
         attendant_name = COALESCE($4, attendant_name), \
         attendant_phone = COALESCE($5, attendant_phone) \
         WHERE id = $1 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.status)
    .bind(body.transport_mode)
    .bind(body.attendant_name)
    .bind(body.attendant_phone)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_camp_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<CreateCampIncidentRequest>,
) -> Result<Json<CampIncident>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampIncident>(
        "INSERT INTO camp_incidents \
         (tenant_id, camp_id, registration_id, incident_type, severity, description, immediate_action, reported_by) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 'low'), $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.registration_id)
    .bind(body.incident_type)
    .bind(body.severity)
    .bind(body.description)
    .bind(body.immediate_action)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_camp_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCampIncidentRequest>,
) -> Result<Json<CampIncident>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampIncident>(
        "UPDATE camp_incidents SET \
         status = COALESCE($2, status), \
         immediate_action = COALESCE($3, immediate_action), \
         resolved_by = CASE WHEN $2 = 'closed' THEN $4 ELSE resolved_by END, \
         resolved_at = CASE WHEN $2 = 'closed' THEN now() ELSE resolved_at END \
         WHERE id = $1 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.status)
    .bind(body.immediate_action)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCampRequest>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let camp_code = format!("CAMP-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, Camp>(
        "INSERT INTO camps \
         (tenant_id, camp_code, name, camp_type, organizing_department_id, coordinator_id, \
          scheduled_date, start_time, end_time, \
          venue_name, venue_address, venue_city, venue_state, venue_pincode, \
          venue_latitude, venue_longitude, \
          expected_participants, budget_allocated, logistics_notes, equipment_list, \
          is_free, discount_percentage, created_by) \
         VALUES ($1, $2, $3, $4::camp_type, $5, $6, \
                 $7, $8, $9, \
                 $10, $11, $12, $13, $14, \
                 $15, $16, \
                 $17, $18, $19, $20, \
                 COALESCE($21, true), $22, $23) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&camp_code)
    .bind(&body.name)
    .bind(&body.camp_type)
    .bind(body.organizing_department_id)
    .bind(body.coordinator_id)
    .bind(body.scheduled_date)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(&body.venue_name)
    .bind(&body.venue_address)
    .bind(&body.venue_city)
    .bind(&body.venue_state)
    .bind(&body.venue_pincode)
    .bind(body.venue_latitude)
    .bind(body.venue_longitude)
    .bind(body.expected_participants)
    .bind(body.budget_allocated)
    .bind(&body.logistics_notes)
    .bind(&body.equipment_list)
    .bind(body.is_free)
    .bind(body.discount_percentage)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCampRequest>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET \
         name = COALESCE($2, name), \
         organizing_department_id = COALESCE($3, organizing_department_id), \
         coordinator_id = COALESCE($4, coordinator_id), \
         scheduled_date = COALESCE($5, scheduled_date), \
         start_time = COALESCE($6, start_time), \
         end_time = COALESCE($7, end_time), \
         venue_name = COALESCE($8, venue_name), \
         venue_address = COALESCE($9, venue_address), \
         venue_city = COALESCE($10, venue_city), \
         venue_state = COALESCE($11, venue_state), \
         venue_pincode = COALESCE($12, venue_pincode), \
         venue_latitude = COALESCE($13, venue_latitude), \
         venue_longitude = COALESCE($14, venue_longitude), \
         expected_participants = COALESCE($15, expected_participants), \
         budget_allocated = COALESCE($16, budget_allocated), \
         budget_spent = COALESCE($17, budget_spent), \
         logistics_notes = COALESCE($18, logistics_notes), \
         equipment_list = COALESCE($19, equipment_list), \
         is_free = COALESCE($20, is_free), \
         discount_percentage = COALESCE($21, discount_percentage), \
         summary_notes = COALESCE($22, summary_notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.organizing_department_id)
    .bind(body.coordinator_id)
    .bind(body.scheduled_date)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(&body.venue_name)
    .bind(&body.venue_address)
    .bind(&body.venue_city)
    .bind(&body.venue_state)
    .bind(&body.venue_pincode)
    .bind(body.venue_latitude)
    .bind(body.venue_longitude)
    .bind(body.expected_participants)
    .bind(body.budget_allocated)
    .bind(body.budget_spent)
    .bind(&body.logistics_notes)
    .bind(&body.equipment_list)
    .bind(body.is_free)
    .bind(body.discount_percentage)
    .bind(&body.summary_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'approved', approved_by = $2, approved_at = now() \
         WHERE id = $1 AND status = 'planned' RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn activate_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'active' \
         WHERE id = $1 AND status IN ('approved', 'setup') RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Count actual participants
    let count_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let actual = i32::try_from(count_row.count.unwrap_or(0)).unwrap_or(0);

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'completed', actual_participants = $2, completed_at = now() \
         WHERE id = $1 AND status = 'active' RETURNING *",
    )
    .bind(id)
    .bind(actual)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn cancel_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelCampRequest>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'cancelled', cancellation_reason = $2 \
         WHERE id = $1 AND status NOT IN ('completed', 'cancelled') RETURNING *",
    )
    .bind(id)
    .bind(&body.cancellation_reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Team Members
// ══════════════════════════════════════════════════════════

pub async fn list_team_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<Vec<CampTeamMember>>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampTeamMember>(
        "SELECT * FROM camp_team_members WHERE camp_id = $1 ORDER BY created_at",
    )
    .bind(camp_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn add_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<AddTeamMemberRequest>,
) -> Result<Json<CampTeamMember>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampTeamMember>(
        "INSERT INTO camp_team_members \
         (tenant_id, camp_id, employee_id, role_in_camp, is_confirmed, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.employee_id)
    .bind(&body.role_in_camp)
    .bind(body.is_confirmed)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn remove_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_camp_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM camp_team_members WHERE id = $1")
        .bind(member_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Registrations
// ══════════════════════════════════════════════════════════

pub async fn list_registrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRegistrationsQuery>,
) -> Result<Json<Vec<CampRegistration>>, AppError> {
    require_permission(&claims, permissions::camp::registrations::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations \
         WHERE camp_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRegistrationRequest>,
) -> Result<Json<CampRegistration>, AppError> {
    require_permission(&claims, permissions::camp::registrations::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get camp_code for the registration number
    let camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1")
        .bind(body.camp_id)
        .fetch_one(&mut *tx)
        .await?;

    // Count existing registrations for sequence
    let count_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(body.camp_id)
    .fetch_one(&mut *tx)
    .await?;

    let seq = count_row.count.unwrap_or(0) + 1;
    let reg_number = format!("CR-{}-{seq:04}", camp.camp_code);

    let row = sqlx::query_as::<_, CampRegistration>(
        "INSERT INTO camp_registrations \
         (tenant_id, camp_id, registration_number, person_name, age, gender, phone, \
          address, id_proof_type, id_proof_number, patient_id, clinical_department_id, \
          attending_doctor_id, service_line, chief_complaint, \
          is_walk_in, registered_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
                 $8, $9, $10, $11, $12, \
                 $13, $14, $15, \
                 COALESCE($16, true), $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.camp_id)
    .bind(&reg_number)
    .bind(&body.person_name)
    .bind(body.age)
    .bind(&body.gender)
    .bind(&body.phone)
    .bind(&body.address)
    .bind(&body.id_proof_type)
    .bind(&body.id_proof_number)
    .bind(body.patient_id)
    .bind(body.clinical_department_id)
    .bind(body.attending_doctor_id)
    .bind(&body.service_line)
    .bind(&body.chief_complaint)
    .bind(body.is_walk_in)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRegistrationRequest>,
) -> Result<Json<CampRegistration>, AppError> {
    require_permission(&claims, permissions::camp::registrations::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampRegistration>(
        "UPDATE camp_registrations SET \
         status = COALESCE($2::camp_registration_status, status), \
         patient_id = COALESCE($3, patient_id), \
         clinical_department_id = COALESCE($4, clinical_department_id), \
         attending_doctor_id = COALESCE($5, attending_doctor_id), \
         service_line = COALESCE($6, service_line), \
         chief_complaint = COALESCE($7, chief_complaint), \
         updated_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(body.patient_id)
    .bind(body.clinical_department_id)
    .bind(body.attending_doctor_id)
    .bind(&body.service_line)
    .bind(&body.chief_complaint)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn open_registration_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<OpenCampRegistrationEncounterRequest>>,
) -> Result<Json<OpenCampRegistrationEncounterResponse>, AppError> {
    require_permission(&claims, permissions::camp::registrations::CREATE)?;
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let context = sqlx::query_as::<_, OpenEncounterRegistrationContext>(
        "SELECT r.camp_id, c.camp_code, c.name AS camp_name, \
                c.organizing_department_id, \
                r.person_name, r.age, r.gender, r.phone, r.address, \
                r.id_proof_type, r.id_proof_number, r.patient_id, \
                r.clinical_department_id, r.attending_doctor_id, r.service_line, \
                r.chief_complaint, r.is_walk_in \
         FROM camp_registrations r \
         JOIN camps c ON c.id = r.camp_id AND c.tenant_id = r.tenant_id \
         WHERE r.tenant_id = $1 AND r.id = $2",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let body = body.map_or(
        OpenCampRegistrationEncounterRequest {
            department_id: None,
            doctor_id: None,
        },
        |Json(body)| body,
    );
    let department_id = body
        .department_id
        .or(context.clinical_department_id)
        .or(context.organizing_department_id)
        .ok_or_else(|| {
            AppError::BadRequest(
                "camp OPD encounter requires a department for this clinical visit".to_owned(),
            )
        })?;
    let camp_context = CampSyncCampContext {
        camp_code: context.camp_code.clone(),
        name: context.camp_name.clone(),
        organizing_department_id: context.organizing_department_id,
    };
    let registration_payload = CreateRegistrationRequest {
        camp_id: context.camp_id,
        person_name: context.person_name.clone(),
        age: context.age,
        gender: context.gender.clone(),
        phone: context.phone.clone(),
        address: context.address.clone(),
        id_proof_type: context.id_proof_type.clone(),
        id_proof_number: context.id_proof_number.clone(),
        patient_id: context.patient_id,
        clinical_department_id: context.clinical_department_id,
        attending_doctor_id: context.attending_doctor_id,
        service_line: context.service_line.clone(),
        chief_complaint: context.chief_complaint.clone(),
        is_walk_in: Some(context.is_walk_in),
    };
    let patient_id = if let Some(patient_id) = context.patient_id {
        patient_id
    } else {
        let patient_id = create_or_link_patient_for_camp_registration(
            &mut tx,
            &claims,
            context.camp_id,
            &camp_context,
            &registration_payload,
        )
        .await?;
        sqlx::query(
            "UPDATE camp_registrations \
             SET patient_id = $3, updated_at = now() \
             WHERE tenant_id = $1 AND id = $2",
        )
        .bind(claims.tenant_id)
        .bind(id)
        .bind(patient_id)
        .execute(&mut *tx)
        .await?;
        patient_id
    };
    let doctor_id = body.doctor_id.or(context.attending_doctor_id);
    sqlx::query(
        "UPDATE camp_registrations \
         SET clinical_department_id = COALESCE($3, clinical_department_id), \
             attending_doctor_id = COALESCE($4, attending_doctor_id), \
             updated_at = now() \
         WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(Some(department_id))
    .bind(doctor_id)
    .execute(&mut *tx)
    .await?;

    let link = find_or_create_camp_encounter(
        &mut tx,
        &claims,
        context.camp_id,
        patient_id,
        Some(department_id),
        doctor_id,
        context.chief_complaint.as_deref(),
    )
    .await?;

    let (uhid, patient_name): (String, String) = sqlx::query_as(
        "SELECT uhid, trim(concat_ws(' ', first_name, last_name)) AS patient_name \
         FROM patients \
         WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(OpenCampRegistrationEncounterResponse {
        encounter_id: link.encounter_id,
        queue_id: link.queue_id,
        patient_id,
        patient_name,
        uhid,
        department_id,
        doctor_id,
    }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Screenings
// ══════════════════════════════════════════════════════════

pub async fn list_screenings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListScreeningsQuery>,
) -> Result<Json<Vec<CampScreening>>, AppError> {
    require_permission(&claims, permissions::camp::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampScreening>(
        "SELECT s.* FROM camp_screenings s \
         JOIN camp_registrations r ON r.id = s.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR s.registration_id = $2) \
         ORDER BY s.created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScreeningRequest>,
) -> Result<Json<CampScreening>, AppError> {
    require_permission(&claims, permissions::camp::screenings::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let registration_context = sqlx::query_as::<_, ScreeningRegistrationContext>(
        "SELECT r.camp_id, r.patient_id, c.organizing_department_id \
         FROM camp_registrations r \
         JOIN camps c ON c.id = r.camp_id AND c.tenant_id = r.tenant_id \
         WHERE r.tenant_id = $1 AND r.id = $2",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Camp registration not found".to_owned()))?;

    let row = sqlx::query_as::<_, CampScreening>(
        "INSERT INTO camp_screenings \
         (tenant_id, registration_id, bp_systolic, bp_diastolic, pulse_rate, spo2, \
          temperature, blood_sugar_random, bmi, height_cm, weight_kg, \
          visual_acuity_left, visual_acuity_right, \
          findings, diagnosis, advice, \
          referred_to_hospital, referral_department, referral_urgency, screened_by) \
         VALUES ($1, $2, $3, $4, $5, $6, \
                 $7, $8, $9, $10, $11, \
                 $12, $13, \
                 $14, $15, $16, \
                 COALESCE($17, false), $18, $19, $20) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(body.bp_systolic)
    .bind(body.bp_diastolic)
    .bind(body.pulse_rate)
    .bind(body.spo2)
    .bind(body.temperature)
    .bind(body.blood_sugar_random)
    .bind(body.bmi)
    .bind(body.height_cm)
    .bind(body.weight_kg)
    .bind(&body.visual_acuity_left)
    .bind(&body.visual_acuity_right)
    .bind(&body.findings)
    .bind(&body.diagnosis)
    .bind(&body.advice)
    .bind(body.referred_to_hospital)
    .bind(&body.referral_department)
    .bind(&body.referral_urgency)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-update registration status to screened
    sqlx::query(
        "UPDATE camp_registrations SET status = \
         CASE WHEN COALESCE($3, false) THEN 'referred'::camp_registration_status \
              ELSE 'screened'::camp_registration_status END \
         WHERE tenant_id = $1 AND id = $2 AND status IN ('registered', 'screened', 'referred')",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(body.referred_to_hospital)
    .execute(&mut *tx)
    .await?;

    if let (Some(patient_id), Some(department_id)) = (
        registration_context.patient_id,
        registration_context.organizing_department_id,
    ) {
        let mut note_parts: Vec<String> = Vec::new();
        if let Some(value) = body
            .findings
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            note_parts.push(format!("Camp findings: {value}"));
        }
        if let Some(value) = body
            .diagnosis
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            note_parts.push(format!("Camp diagnosis: {value}"));
        }
        if let Some(value) = body
            .advice
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            note_parts.push(format!("Camp advice: {value}"));
        }
        let notes = if note_parts.is_empty() {
            None
        } else {
            Some(note_parts.join("\n"))
        };
        let link = find_or_create_camp_encounter(
            &mut tx,
            &claims,
            registration_context.camp_id,
            patient_id,
            Some(department_id),
            None,
            notes.as_deref(),
        )
        .await?;
        let bmi = calculate_bmi(body.weight_kg, body.height_cm).or(body.bmi);
        sqlx::query(
            "INSERT INTO vitals \
             (tenant_id, encounter_id, recorded_by, temperature, pulse, \
              systolic_bp, diastolic_bp, spo2, weight_kg, height_cm, bmi, notes, recorded_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())",
        )
        .bind(claims.tenant_id)
        .bind(link.encounter_id)
        .bind(claims.sub)
        .bind(body.temperature)
        .bind(body.pulse_rate)
        .bind(body.bp_systolic)
        .bind(body.bp_diastolic)
        .bind(body.spo2)
        .bind(body.weight_kg)
        .bind(body.height_cm)
        .bind(bmi)
        .bind(notes)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Lab Samples
// ══════════════════════════════════════════════════════════

pub async fn list_lab_samples(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListLabSamplesQuery>,
) -> Result<Json<Vec<CampLabSample>>, AppError> {
    require_permission(&claims, permissions::camp::lab::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampLabSample>(
        "SELECT ls.* FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR ls.registration_id = $2) \
         ORDER BY ls.created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_lab_sample(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLabSampleRequest>,
) -> Result<Json<CampLabSample>, AppError> {
    require_permission(&claims, permissions::camp::lab::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampLabSample>(
        "INSERT INTO camp_lab_samples \
         (tenant_id, registration_id, sample_type, test_requested, barcode, \
          collected_at, collected_by) \
         VALUES ($1, $2, $3, $4, $5, now(), $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&body.sample_type)
    .bind(&body.test_requested)
    .bind(&body.barcode)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn link_lab_sample(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkLabSampleRequest>,
) -> Result<Json<CampLabSample>, AppError> {
    require_permission(&claims, permissions::camp::lab::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampLabSample>(
        "UPDATE camp_lab_samples SET \
         lab_order_id = $2, result_summary = $3, sent_to_lab = true \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.lab_order_id)
    .bind(&body.result_summary)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Billing
// ══════════════════════════════════════════════════════════

pub async fn list_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBillingQuery>,
) -> Result<Json<Vec<CampBillingRecord>>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampBillingRecord>(
        "SELECT b.* FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR b.registration_id = $2) \
         ORDER BY b.created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBillingRequest>,
) -> Result<Json<CampBillingRecord>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampBillingRecord>(
        "INSERT INTO camp_billing_records \
         (tenant_id, registration_id, service_description, standard_amount, \
          discount_percentage, charged_amount, is_free, payment_mode, payment_reference, \
          billed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&body.service_description)
    .bind(body.standard_amount)
    .bind(body.discount_percentage)
    .bind(body.charged_amount)
    .bind(body.is_free)
    .bind(&body.payment_mode)
    .bind(&body.payment_reference)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Follow-ups
// ══════════════════════════════════════════════════════════

pub async fn list_followups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFollowupsQuery>,
) -> Result<Json<Vec<CampFollowup>>, AppError> {
    require_permission(&claims, permissions::camp::followups::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampFollowup>(
        "SELECT f.* FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR f.registration_id = $2) \
         AND ($3::text IS NULL OR f.status::text = $3) \
         ORDER BY f.followup_date DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_followup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFollowupRequest>,
) -> Result<Json<CampFollowup>, AppError> {
    require_permission(&claims, permissions::camp::followups::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampFollowup>(
        "INSERT INTO camp_followups \
         (tenant_id, registration_id, followup_date, followup_type, notes, followed_up_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(body.followup_date)
    .bind(&body.followup_type)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_followup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFollowupRequest>,
) -> Result<Json<CampFollowup>, AppError> {
    require_permission(&claims, permissions::camp::followups::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampFollowup>(
        "UPDATE camp_followups SET \
         status = COALESCE($2::camp_followup_status, status), \
         notes = COALESCE($3, notes), \
         outcome = COALESCE($4, outcome), \
         converted_to_patient = COALESCE($5, converted_to_patient), \
         converted_patient_id = COALESCE($6, converted_patient_id), \
         converted_department_id = COALESCE($7, converted_department_id) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(&body.outcome)
    .bind(body.converted_to_patient)
    .bind(body.converted_patient_id)
    .bind(body.converted_department_id)
    .fetch_one(&mut *tx)
    .await?;

    // If converted, also update the registration status
    if body.converted_to_patient == Some(true) {
        sqlx::query(
            "UPDATE camp_registrations SET status = 'converted' \
             WHERE id = (SELECT registration_id FROM camp_followups WHERE id = $1)",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Stats
// ══════════════════════════════════════════════════════════

pub async fn camp_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CampStatsResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let screened = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE camp_id = $1 AND status IN ('screened', 'referred', 'converted')",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let referred = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE camp_id = $1 AND status IN ('referred', 'converted')",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let converted = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE camp_id = $1 AND status = 'converted'",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let lab_samples = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_scheduled = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_completed = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE r.camp_id = $1 AND f.status = 'completed'",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let billing_sum = sqlx::query_as::<_, SumRow>(
        "SELECT COALESCE(SUM(b.charged_amount), 0) AS total FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CampStatsResponse {
        total_registrations: total.count.unwrap_or(0),
        screened: screened.count.unwrap_or(0),
        referred: referred.count.unwrap_or(0),
        converted: converted.count.unwrap_or(0),
        lab_samples: lab_samples.count.unwrap_or(0),
        followups_scheduled: fu_scheduled.count.unwrap_or(0),
        followups_completed: fu_completed.count.unwrap_or(0),
        billing_total: billing_sum.total.unwrap_or_default(),
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/camp/analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct CampAnalyticsResponse {
    pub total_camps: i64,
    pub total_registrations: i64,
    pub total_screened: i64,
    pub total_referred: i64,
    pub total_converted: i64,
    pub conversion_rate_pct: f64,
    pub screening_yield_pct: f64,
    pub total_billing: Decimal,
    pub avg_cost_per_patient: Decimal,
    pub followup_scheduled: i64,
    pub followup_completed: i64,
    pub followup_compliance_pct: f64,
}

pub async fn camp_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CampAnalyticsResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camps_count = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camps WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let regs = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let screened = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(DISTINCT registration_id)::bigint AS count FROM camp_screenings \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let referred = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE tenant_id = $1 AND status = 'referred'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let converted = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE tenant_id = $1 AND status = 'converted'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let billing_total = sqlx::query_as::<_, SumRow>(
        "SELECT COALESCE(SUM(charged_amount), 0) AS total FROM camp_billing_records \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_scheduled = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_completed = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups \
         WHERE tenant_id = $1 AND status = 'completed'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_regs = regs.count.unwrap_or(0);
    let total_scr = screened.count.unwrap_or(0);
    let total_ref = referred.count.unwrap_or(0);
    let total_conv = converted.count.unwrap_or(0);
    let bill = billing_total.total.unwrap_or_default();
    let fu_sched = fu_scheduled.count.unwrap_or(0);
    let fu_comp = fu_completed.count.unwrap_or(0);

    let conversion_rate = if total_regs > 0 {
        (total_conv as f64 / total_regs as f64) * 100.0
    } else {
        0.0
    };
    let screening_yield = if total_scr > 0 {
        (total_ref as f64 / total_scr as f64) * 100.0
    } else {
        0.0
    };
    let avg_cost = if total_regs > 0 {
        bill / Decimal::from(total_regs)
    } else {
        Decimal::ZERO
    };
    let fu_compliance = if fu_sched > 0 {
        (fu_comp as f64 / fu_sched as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(CampAnalyticsResponse {
        total_camps: camps_count.count.unwrap_or(0),
        total_registrations: total_regs,
        total_screened: total_scr,
        total_referred: total_ref,
        total_converted: total_conv,
        conversion_rate_pct: conversion_rate,
        screening_yield_pct: screening_yield,
        total_billing: bill,
        avg_cost_per_patient: avg_cost,
        followup_scheduled: fu_sched,
        followup_completed: fu_comp,
        followup_compliance_pct: fu_compliance,
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/camp/camps/{id}/report
// ══════════════════════════════════════════════════════════

pub async fn camp_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let registrations = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let screenings = sqlx::query_as::<_, CampScreening>(
        "SELECT s.* FROM camp_screenings s \
         JOIN camp_registrations r ON r.id = s.registration_id \
         WHERE r.camp_id = $1 AND s.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let followups = sqlx::query_as::<_, CampFollowup>(
        "SELECT f.* FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE r.camp_id = $1 AND f.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let billing_total = sqlx::query_as::<_, SumRow>(
        "SELECT COALESCE(SUM(b.charged_amount), 0) AS total \
         FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_regs = registrations.len() as i64;
    let referred_count = registrations
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                medbrains_core::camp::CampRegistrationStatus::Referred
            )
        })
        .count() as i64;
    let converted_count = registrations
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                medbrains_core::camp::CampRegistrationStatus::Converted
            )
        })
        .count() as i64;
    let fu_completed = followups
        .iter()
        .filter(|f| {
            matches!(
                f.status,
                medbrains_core::camp::CampFollowupStatus::Completed
            )
        })
        .count() as i64;

    Ok(Json(serde_json::json!({
        "camp": {
            "id": camp.id,
            "name": camp.name,
            "camp_type": camp.camp_type,
            "scheduled_date": camp.scheduled_date,
            "venue_name": camp.venue_name,
            "status": camp.status,
        },
        "stats": {
            "total_registrations": total_regs,
            "total_screenings": screenings.len(),
            "referred": referred_count,
            "converted": converted_count,
            "followups_total": followups.len(),
            "followups_completed": fu_completed,
            "billing_total": billing_total.total.unwrap_or_default(),
        },
        "generated_at": Utc::now(),
        "generated_by": claims.sub,
    })))
}

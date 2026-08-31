#![allow(clippy::too_many_lines)]
//! Health camps — registrations, screenings, referrals.
//!
//! # Why create_registration takes no record check
//!
//! `camp_registrations.patient_id` is NULLABLE, and that is the point: a camp
//! coordinator registers whoever walks up to the tent, most of whom are not
//! patients of this hospital and some of whom never become one. The permission
//! is `camp.registrations.create`, held by `camp_coordinator`
//! (`crates/medbrains-core/src/access/roles.rs`).
//!
//! This is an establishing act. A care-relationship check would refuse
//! everybody at the moment before the relationship exists.
//!
//! **What retires this:** the registration path writing a relation the way
//! `opd::create_encounter` and `ipd::create_admission` do — they call
//! `grant_raw` and name the treating department, which is the honest way to
//! open a relationship rather than to assume one.
//!
//! # The other seven, and one redaction that actually fires
//!
//! `sync_camp_inbound`, `list_registrations`, `update_registration`,
//! `create_screening` and `link_lab_sample` emit no patient name at all —
//! they move registration rows, screening rows and lab-sample links around
//! the camp they belong to.
//!
//! `get_camp_packet` is the one that emits names and a UHID, and it is worth
//! reading beside `ipd::expected_discharges`, which looks identical and is
//! not.
//!
//! It requires **four** camp codes with AND, not a choice of one:
//! `camp.list`, `camp.registrations.list`, `camp.screenings.list` and
//! `camp.lab.list`. It carries `camp_id` in the WHERE, so the camp the caller
//! asked for is the scope. And it gates the patient-record fields on
//! `has_patient_record_view`, which resolves `patients.view`.
//!
//! **That gate fires.** Only `camp_coordinator` holds all four camp codes —
//! `audit_officer` has `camp.list` but not `camp.lab.list` — and
//! `camp_coordinator` does **not** hold `patients.view`
//! (`crates/medbrains-core/src/access/roles.rs`). So the only non-bypass role
//! that can reach this handler is the one whose patient fields come back
//! blanked, which is exactly right for somebody running a field camp.
//!
//! The contrast is the useful part. `ipd::expected_discharges` writes the same
//! kind of `CASE WHEN … ELSE NULL END` on `patients.view` and every role that
//! can reach it also holds that code, so the gate is true in the SQL and empty
//! in practice. Field redaction is only a control when somebody who can call
//! the handler lacks the code it tests. **Checking that is a separate step
//! from finding the redaction.**
//!
//! **What retires this one:** granting `camp.lab.list` to a clinical role, or
//! granting `patients.view` to `camp_coordinator`. Either turns a working
//! control into a decorative one without touching this file.
//!
//! # open_registration_encounter is an open question, not an exemption
//!
//! It grants `patient/Owner/User(claims.sub)` on `r.patient_id` off a
//! path-named camp registration — the caller becomes owner of a patient by
//! naming a registration. That may be correct for a camp, where the
//! registering clinician is the treating one, and it may not. It is recorded
//! here as an operator decision rather than settled quietly in a sweep.

// Structured camp-planning helpers staged in this file are scheduled for
// wiring into the route layer in a follow-up. Suppress dead_code so the
// in-progress scaffolding doesn't block CI.
#![allow(dead_code)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use medbrains_core::camp::{
    Camp, CampBillingRecord, CampFollowup, CampLabSample, CampRegistration, CampScreening,
    CampTeamMember,
};
use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use medbrains_core::privacy::{mask_identifier_keep_last, mask_name, mask_phone};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use std::{collections::HashMap, str::FromStr};
use uuid::Uuid;

use axum::routing::{delete, get, post, put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    is_bypass_role, require_any_permission, require_permission,
};
use medbrains_server_core::middleware::field_access;
use medbrains_server_core::state::AppState;

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
pub struct CampLookupQuery {
    pub search: Option<String>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampStaffOption {
    pub id: Uuid,
    pub employee_code: String,
    pub display_name: String,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub designation_name: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampMedicineOption {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub generic_name: Option<String>,
    pub unit: Option<String>,
    pub current_stock: i32,
    pub base_price: Decimal,
    pub tax_percent: Decimal,
    pub drug_schedule: Option<String>,
    pub is_controlled: bool,
    pub is_lasa: bool,
    pub batch_tracking_required: bool,
    pub formulary_status: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampTeamMemberWithEmployee {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub employee_id: Uuid,
    pub employee_code: Option<String>,
    pub employee_name: Option<String>,
    pub department_name: Option<String>,
    pub role_in_camp: String,
    pub is_confirmed: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub equipment_list: Option<Value>,
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
    pub equipment_list: Option<Value>,
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
    pub catalog_item_id: Option<Uuid>,
    pub batch_stock_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub item_name: String,
    pub unit: Option<String>,
    pub planned_qty: Option<Decimal>,
    pub packed_qty: Option<Decimal>,
    pub batch_no: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub charge_mode: Option<String>,
    pub unit_price: Option<Decimal>,
    pub tax_percent: Option<Decimal>,
    pub cost_amount: Option<Decimal>,
    pub sponsor_covered_amount: Option<Decimal>,
    pub concession_percentage: Option<Decimal>,
    pub approval_required: Option<bool>,
    pub is_critical: Option<bool>,
    pub shortage_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkCreateSupplyItemsRequest {
    pub items: Vec<CreateSupplyItemRequest>,
}

#[derive(Debug, Serialize)]
pub struct BulkCreateSupplyItemsResponse {
    pub count: usize,
    pub created: Vec<CampSupplyItem>,
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
    pub payload: Value,
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
    pub camp_id: Option<Uuid>,
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRegistrationRequest {
    pub camp_id: Uuid,
    /// A stable reference to whatever the device or extract calls this record
    /// — a paper form's scan id, a tablet's local row.
    ///
    /// Optional, and older clients do not send it. When present it is what a
    /// re-sync matches on, so corrections land on the patient the first sync
    /// created instead of forking a duplicate the moment a name is fixed.
    #[serde(default)]
    pub external_ref: Option<String>,
    pub person_name: String,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof_type: Option<String>,
    pub id_proof_number: Option<String>,
    pub father_spouse_name: Option<String>,
    pub marital_status: Option<String>,
    pub blood_group: Option<String>,
    pub insurance_details: Option<String>,
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

const CAMP_REGISTRATION_PERSON_NAME_FIELD: &str = "camp.registrations.person_name";
const CAMP_REGISTRATION_PHONE_FIELD: &str = "camp.registrations.phone";
const CAMP_REGISTRATION_ID_PROOF_FIELD: &str = "camp.registrations.id_proof_number";
const BILLING_AMOUNT_FIELD: &str = "billing.amount";
const CAMP_REGISTRATION_SELECTOR_PERMISSIONS: &[&str] = &[
    permissions::camp::registrations::LIST,
    permissions::camp::registrations::UPDATE,
    permissions::camp::screenings::MANAGE,
    permissions::camp::lab::MANAGE,
    permissions::camp::billing::CREATE,
    permissions::camp::followups::SCHEDULE,
];

async fn resolve_camp_registration_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn has_patient_record_view(claims: &Claims) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW)
}

fn claims_have_any_permission(claims: &Claims, permissions: &[&str]) -> bool {
    is_bypass_role(claims)
        || permissions.iter().any(|permission| {
            claims
                .permissions
                .iter()
                .any(|granted| granted == permission)
        })
}

fn can_view_full_camp_registration_queue(claims: &Claims) -> bool {
    claims_have_any_permission(claims, &[permissions::camp::registrations::LIST])
}

fn resolved_camp_registration_field_access(
    restricted: &HashMap<String, FieldAccessLevel>,
    field: &str,
) -> FieldAccessLevel {
    restricted
        .get(field)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn can_write_camp_registration_field(level: FieldAccessLevel) -> bool {
    level == FieldAccessLevel::Edit
}

fn should_hide_camp_registration_field(level: FieldAccessLevel) -> bool {
    level == FieldAccessLevel::Hidden
}

fn should_mask_camp_registration_field(level: FieldAccessLevel) -> bool {
    level == FieldAccessLevel::Mask
}

fn has_camp_registration_text(value: &Option<String>) -> bool {
    value.as_deref().is_some_and(|text| !text.trim().is_empty())
}

fn validate_camp_registration_write_access(
    body: &CreateRegistrationRequest,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    let mut violations = Vec::new();
    let name_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_PERSON_NAME_FIELD);
    let phone_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_PHONE_FIELD);
    let id_proof_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_ID_PROOF_FIELD);

    if !can_write_camp_registration_field(name_access) {
        violations.push("person_name");
    }
    if has_camp_registration_text(&body.phone) && !can_write_camp_registration_field(phone_access) {
        violations.push("phone");
    }
    if (has_camp_registration_text(&body.id_proof_type)
        || has_camp_registration_text(&body.id_proof_number))
        && !can_write_camp_registration_field(id_proof_access)
    {
        violations.push("id_proof");
    }

    if violations.is_empty() {
        return Ok(());
    }

    Err(AppError::BadRequest(format!(
        "Cannot write restricted camp registration fields: {}",
        violations.join(", ")
    )))
}

fn filter_camp_registration_response(
    mut row: CampRegistration,
    restricted: &HashMap<String, FieldAccessLevel>,
    can_view_patient_record: bool,
    can_view_full_queue: bool,
) -> CampRegistration {
    let name_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_PERSON_NAME_FIELD);
    let phone_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_PHONE_FIELD);
    let id_proof_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_ID_PROOF_FIELD);

    if should_hide_camp_registration_field(name_access) {
        row.person_name = "Restricted".to_owned();
    } else if should_mask_camp_registration_field(name_access) {
        row.person_name = mask_name(&row.person_name);
    }
    if should_hide_camp_registration_field(phone_access) {
        row.phone = None;
    } else if should_mask_camp_registration_field(phone_access) {
        row.phone = row.phone.map(|value| mask_phone(&value));
    }
    if should_hide_camp_registration_field(id_proof_access) {
        row.id_proof_type = None;
        row.id_proof_number = None;
    } else if should_mask_camp_registration_field(id_proof_access) {
        row.id_proof_number = row
            .id_proof_number
            .map(|value| mask_identifier_keep_last(&value, 4));
    }
    if !can_view_patient_record {
        row.patient_id = None;
    }
    if !can_view_full_queue {
        row.phone = None;
        row.address = None;
        row.id_proof_type = None;
        row.id_proof_number = None;
        row.patient_id = None;
        row.registered_by = None;
    }

    row
}

fn filter_camp_registration_history_response(
    mut row: CampPacketRegistrationHistory,
    restricted: &HashMap<String, FieldAccessLevel>,
    can_view_patient_record: bool,
) -> CampPacketRegistrationHistory {
    let name_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_PERSON_NAME_FIELD);
    let phone_access =
        resolved_camp_registration_field_access(restricted, CAMP_REGISTRATION_PHONE_FIELD);

    if should_hide_camp_registration_field(name_access) {
        row.person_name = "Restricted".to_owned();
    } else if should_mask_camp_registration_field(name_access) {
        row.person_name = mask_name(&row.person_name);
    }
    if should_hide_camp_registration_field(phone_access) {
        row.phone_last4 = None;
    }
    if !can_view_patient_record {
        row.patient_id = None;
    }

    row
}

fn filter_open_camp_encounter_response(
    mut row: OpenCampRegistrationEncounterResponse,
    can_view_patient_record: bool,
) -> OpenCampRegistrationEncounterResponse {
    if !can_view_patient_record {
        row.patient_name = "Restricted".to_owned();
        row.uhid = "Restricted".to_owned();
    }
    row
}

fn camp_billing_amount_access(restricted: &HashMap<String, FieldAccessLevel>) -> FieldAccessLevel {
    restricted
        .get(BILLING_AMOUNT_FIELD)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn should_scrub_camp_billing_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    matches!(
        camp_billing_amount_access(restricted),
        FieldAccessLevel::Mask | FieldAccessLevel::Hidden
    )
}

fn can_write_camp_billing_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    camp_billing_amount_access(restricted) == FieldAccessLevel::Edit
}

fn validate_camp_billing_amount_write_access(
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if can_write_camp_billing_amount(restricted) {
        return Ok(());
    }

    Err(AppError::BadRequest(
        "Cannot write restricted billing amount fields".to_owned(),
    ))
}

fn filter_camp_billing_amounts(
    mut row: CampBillingRecord,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> CampBillingRecord {
    if should_scrub_camp_billing_amount(restricted) {
        row.standard_amount = Decimal::ZERO;
        row.discount_percentage = Some(Decimal::ZERO);
        row.charged_amount = Decimal::ZERO;
        row.tax_percent = Decimal::ZERO;
        row.tax_amount = Decimal::ZERO;
        row.total_amount = Decimal::ZERO;
        row.sponsor_covered_amount = Decimal::ZERO;
    }
    row
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
    pub mh_diabetes: Option<bool>,
    pub mh_hypertension: Option<bool>,
    pub mh_asthma: Option<bool>,
    pub mh_heart_disease: Option<bool>,
    pub mh_thyroid_disorder: Option<bool>,
    pub mh_previous_surgeries: Option<bool>,
    pub mh_allergies: Option<bool>,
    pub mh_smoking_history: Option<bool>,
    pub mh_alcohol_use: Option<bool>,
    pub mh_family_history: Option<bool>,
    pub mh_others: Option<bool>,
    pub medical_history_notes: Option<String>,
    pub test_hba1c: Option<Decimal>,
    pub test_haemoglobin: Option<Decimal>,
    pub test_thyroid: Option<Decimal>,
    pub test_ecg: Option<String>,
    pub test_xray: Option<String>,
    pub test_bmd: Option<String>,
    pub test_biothesiometry: Option<String>,
    pub findings: Option<String>,
    pub diagnosis: Option<String>,
    pub advice: Option<String>,
    pub referred_to_hospital: Option<bool>,
    pub referral_department: Option<String>,
    pub referral_doctor_name: Option<String>,
    pub referral_urgency: Option<String>,
    #[serde(default)]
    pub icd_codes: Option<Vec<String>>,
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
    father_spouse_name: Option<String>,
    marital_status: Option<String>,
    blood_group: Option<String>,
    insurance_details: Option<String>,
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

#[derive(Debug)]
struct NormalizedCampLabSampleInput {
    sample_type: String,
    test_requested: String,
    barcode: Option<String>,
}

fn normalize_camp_lab_sample_input(
    body: &CreateLabSampleRequest,
) -> Result<NormalizedCampLabSampleInput, AppError> {
    let sample_type = body.sample_type.trim().to_ascii_lowercase();
    if !matches!(
        sample_type.as_str(),
        "blood" | "urine" | "sputum" | "swab" | "other"
    ) {
        return Err(AppError::BadRequest(
            "sample type must be blood, urine, sputum, swab, or other".to_owned(),
        ));
    }

    let test_requested = body
        .test_requested
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::BadRequest("test requested is required".to_owned()))?;
    if test_requested.chars().count() > 255 {
        return Err(AppError::BadRequest(
            "test requested cannot exceed 255 characters".to_owned(),
        ));
    }

    let barcode = body
        .barcode
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    if barcode
        .as_deref()
        .is_some_and(|value| value.chars().count() > 100)
    {
        return Err(AppError::BadRequest(
            "sample barcode cannot exceed 100 characters".to_owned(),
        ));
    }

    Ok(NormalizedCampLabSampleInput {
        sample_type,
        test_requested: test_requested.to_owned(),
        barcode,
    })
}

#[derive(Debug, sqlx::FromRow)]
struct CampLabSampleLinkContext {
    patient_id: Option<Uuid>,
    sent_to_lab: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct CampLabOrderLinkContext {
    patient_id: Uuid,
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
    pub tax_percent: Option<Decimal>,
    pub sponsor_covered_amount: Option<Decimal>,
    pub is_free: Option<bool>,
    pub payment_mode: Option<String>,
    pub payment_reference: Option<String>,
    pub source_module: Option<String>,
    pub source_entity_id: Option<Uuid>,
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
    pub catalog_item_id: Option<Uuid>,
    pub batch_stock_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub item_name: String,
    pub unit: Option<String>,
    pub planned_qty: Decimal,
    pub packed_qty: Decimal,
    pub consumed_qty: Decimal,
    pub returned_qty: Decimal,
    pub batch_no: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub charge_mode: String,
    pub unit_price: Decimal,
    pub tax_percent: Decimal,
    pub cost_amount: Decimal,
    pub sponsor_covered_amount: Decimal,
    pub concession_percentage: Decimal,
    pub approval_required: bool,
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
pub struct CampPlanningFinancials {
    pub planned_budget: Decimal,
    pub planned_patient_collection: Decimal,
    pub planned_sponsor_coverage: Decimal,
    pub planned_cost: Decimal,
    pub actual_patient_collection: Decimal,
    pub sponsor_receivable: Decimal,
    pub sponsor_collected: Decimal,
    pub actual_cost: Decimal,
    pub profit_loss: Decimal,
    pub margin_pct: f64,
    pub budget_variance: Decimal,
    pub budget_variance_pct: f64,
    pub cash_surplus: Decimal,
    pub free_issue_value: Decimal,
    pub paid_issue_value: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampPlanningStockSummary {
    pub total_items: i64,
    pub medicine_items: i64,
    pub approval_required_items: i64,
    pub shortage_items: i64,
    pub critical_shortage_items: i64,
    pub traceability_gap_items: i64,
    pub supply_return_pending_items: i64,
    pub asset_reservation_items: i64,
    pub asset_critical_unissued_items: i64,
    pub asset_return_pending_items: i64,
    pub asset_reconciliation_blocked_items: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampPlanningActionItem {
    pub code: String,
    pub label: String,
    pub severity: String,
    pub status: String,
    pub owner_module: String,
    pub evidence: String,
    pub blocks_activation: bool,
    pub blocks_closeout: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampPlanningSummary {
    pub camp_id: Uuid,
    pub camp_status: String,
    pub readiness: CampReadinessSummary,
    pub financials: CampPlanningFinancials,
    pub stock: CampPlanningStockSummary,
    pub action_items: Vec<CampPlanningActionItem>,
    pub activation_blocked: bool,
    pub closeout_blocked: bool,
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
    pub server_entities: Option<Value>,
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
    server_entities: Value,
}

#[derive(Debug, sqlx::FromRow)]
struct ExistingSyncEvent {
    event_type: String,
    status: String,
    server_entity_type: Option<String>,
    server_entity_id: Option<Uuid>,
    error: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct CampPlanningBillingTotals {
    patient_collected: Option<Decimal>,
    sponsor_receivable: Option<Decimal>,
    free_issue_value: Option<Decimal>,
    paid_issue_value: Option<Decimal>,
    billed_items: i64,
    free_items: i64,
    paid_items: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct CampPlanningSupplyTotals {
    total_items: i64,
    medicine_items: i64,
    approval_required_items: i64,
    shortage_items: i64,
    critical_shortage_items: i64,
    traceability_gap_items: i64,
    supply_return_pending_items: i64,
    asset_return_pending_items: i64,
    planned_supply_cost: Option<Decimal>,
    actual_supply_cost: Option<Decimal>,
    supply_free_issue_value: Option<Decimal>,
}

#[derive(Debug, sqlx::FromRow)]
struct CampPlanningAssetTotals {
    total_reservations: i64,
    critical_unissued_items: i64,
    return_pending_items: i64,
    compliance_blocked_items: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct CampTeamCountRow {
    total_team: i64,
    confirmed_team: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct CampStructuredPlanTotals {
    counter_items: i64,
    department_items: i64,
    doctor_items: i64,
    staff_items: i64,
    service_items: i64,
    medicine_items: i64,
    pending_approvals: i64,
    activation_blocking_approvals: i64,
    closeout_blocking_approvals: i64,
    site_open_items: i64,
    closure_open_items: i64,
    print_total_items: i64,
    print_ready_items: i64,
    planned_patient_collection: Option<Decimal>,
    planned_sponsor_coverage: Option<Decimal>,
    planned_cost: Option<Decimal>,
    sponsor_receivable: Option<Decimal>,
    sponsor_collected: Option<Decimal>,
}

#[derive(Debug, sqlx::FromRow)]
struct JsonDataRow {
    data: Value,
}

#[derive(Debug, sqlx::FromRow)]
struct IdRow {
    id: Uuid,
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

fn camp_status_code(status: medbrains_core::camp::CampStatus) -> &'static str {
    match status {
        medbrains_core::camp::CampStatus::Planned => "planned",
        medbrains_core::camp::CampStatus::Approved => "approved",
        medbrains_core::camp::CampStatus::Setup => "setup",
        medbrains_core::camp::CampStatus::Active => "active",
        medbrains_core::camp::CampStatus::Completed => "completed",
        medbrains_core::camp::CampStatus::Cancelled => "cancelled",
    }
}

fn json_decimal(value: Option<&Value>) -> Decimal {
    match value {
        Some(Value::Number(number)) => Decimal::from_str(&number.to_string()).unwrap_or_default(),
        Some(Value::String(text)) => Decimal::from_str(text.trim()).unwrap_or_default(),
        _ => Decimal::ZERO,
    }
}

fn json_array<'a>(value: &'a Value, key: &str) -> &'a [Value] {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn json_text(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(ToOwned::to_owned)
}

fn json_text_or(value: Option<&Value>, fallback: &str) -> String {
    json_text(value).unwrap_or_else(|| fallback.to_owned())
}

fn json_uuid(value: Option<&Value>) -> Option<Uuid> {
    json_text(value).and_then(|text| Uuid::parse_str(&text).ok())
}

fn json_i32(value: Option<&Value>) -> Option<i32> {
    match value {
        Some(Value::Number(number)) => number.as_i64().and_then(|raw| i32::try_from(raw).ok()),
        Some(Value::String(text)) => text.trim().parse::<i32>().ok(),
        _ => None,
    }
}

fn json_bool(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(flag)) => *flag,
        Some(Value::String(text)) => matches!(text.trim(), "true" | "1" | "yes"),
        _ => false,
    }
}

fn planned_component_sum(plan: &Value, key: &str) -> Decimal {
    json_array(plan, "budget_components")
        .iter()
        .map(|item| json_decimal(item.get(key)))
        .sum()
}

fn planned_service_patient_collection(plan: &Value) -> Decimal {
    json_array(plan, "service_offerings")
        .iter()
        .map(|item| {
            let mode = item
                .get("charge_mode")
                .and_then(Value::as_str)
                .unwrap_or("free");
            if matches!(mode, "free" | "sponsor_covered") {
                Decimal::ZERO
            } else {
                let qty = json_decimal(item.get("planned_qty"));
                let rate = json_decimal(item.get("patient_rate"));
                let concession = json_decimal(item.get("concession_percentage"));
                (qty * rate * (Decimal::from(100) - concession) / Decimal::from(100)).round_dp(2)
            }
        })
        .sum()
}

fn planned_doctor_patient_collection(plan: &Value) -> Decimal {
    json_array(plan, "doctor_engagements")
        .iter()
        .map(|item| {
            let mode = item
                .get("charge_mode")
                .and_then(Value::as_str)
                .unwrap_or("free");
            if matches!(mode, "free" | "sponsor_covered") {
                Decimal::ZERO
            } else {
                let qty = json_decimal(item.get("expected_consults"));
                let rate = json_decimal(item.get("consultation_fee"));
                let concession = json_decimal(item.get("concession_percentage"));
                (qty * rate * (Decimal::from(100) - concession) / Decimal::from(100)).round_dp(2)
            }
        })
        .sum()
}

fn planned_medicine_patient_collection(plan: &Value) -> Decimal {
    json_array(plan, "planned_medicine_refs")
        .iter()
        .map(|item| {
            let mode = item
                .get("charge_mode")
                .and_then(Value::as_str)
                .unwrap_or("free");
            if matches!(mode, "free" | "sponsor_covered") {
                Decimal::ZERO
            } else {
                let paid_qty = json_decimal(item.get("paid_qty"));
                let planned_qty = json_decimal(item.get("planned_qty"));
                let qty = if paid_qty > Decimal::ZERO {
                    paid_qty
                } else {
                    planned_qty
                };
                let rate = json_decimal(item.get("unit_price"));
                let concession = json_decimal(item.get("concession_percentage"));
                (qty * rate * (Decimal::from(100) - concession) / Decimal::from(100)).round_dp(2)
            }
        })
        .sum()
}

fn planned_service_cost(plan: &Value) -> Decimal {
    json_array(plan, "service_offerings")
        .iter()
        .map(|item| json_decimal(item.get("planned_qty")) * json_decimal(item.get("camp_cost")))
        .sum()
}

fn planned_doctor_cost(plan: &Value) -> Decimal {
    json_array(plan, "doctor_engagements")
        .iter()
        .map(|item| json_decimal(item.get("salary_amount")))
        .sum()
}

fn planned_medicine_cost(plan: &Value) -> Decimal {
    json_array(plan, "planned_medicine_refs")
        .iter()
        .map(|item| json_decimal(item.get("planned_qty")) * json_decimal(item.get("cost_amount")))
        .sum()
}

fn planned_sponsor_coverage(plan: &Value) -> Decimal {
    let budget = planned_component_sum(plan, "sponsor_covered_amount");
    let doctors: Decimal = json_array(plan, "doctor_engagements")
        .iter()
        .map(|item| json_decimal(item.get("sponsor_covered_amount")))
        .sum();
    let medicines: Decimal = json_array(plan, "planned_medicine_refs")
        .iter()
        .map(|item| json_decimal(item.get("sponsor_covered_amount")))
        .sum();
    budget + doctors + medicines
}

async fn soft_clear_materialized_camp_plan(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    for table in [
        "camp_sponsor_plans",
        "camp_target_populations",
        "camp_counters",
        "camp_department_counters",
        "camp_doctor_roster",
        "camp_staff_roster",
        "camp_service_pricing_rules",
        "camp_medicine_pricing_rules",
        "camp_approval_items",
        "camp_print_plan_items",
        "camp_closure_tasks",
    ] {
        let sql = format!(
            "UPDATE public.{table} SET \
             deleted_at = COALESCE(deleted_at, now()), \
             deleted_by = COALESCE(deleted_by, $3), \
             delete_reason = COALESCE(delete_reason, 'Superseded by camp planning save'), \
             updated_at = now() \
             WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL"
        );
        sqlx::query(&sql)
            .bind(tenant_id)
            .bind(camp_id)
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

struct CampApprovalItemUpsert<'a> {
    tenant_id: Uuid,
    camp_id: Uuid,
    source_key: &'a str,
    approval_type: &'a str,
    linked_entity_type: &'a str,
    linked_entity_id: Option<Uuid>,
    requested_by: Uuid,
    reason: &'a str,
    blocks_activation: bool,
    blocks_closeout: bool,
}

async fn upsert_camp_approval_item(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    item: CampApprovalItemUpsert<'_>,
) -> Result<(), AppError> {
    let CampApprovalItemUpsert {
        tenant_id,
        camp_id,
        source_key,
        approval_type,
        linked_entity_type,
        linked_entity_id,
        requested_by,
        reason,
        blocks_activation,
        blocks_closeout,
    } = item;
    sqlx::query(
        "INSERT INTO camp_approval_items \
         (tenant_id, camp_id, source_key, approval_type, linked_entity_type, linked_entity_id, \
          requested_by, reason, status, blocks_activation, blocks_closeout, deleted_at, deleted_by, delete_reason) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, NULL, NULL, NULL) \
         ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
          approval_type = EXCLUDED.approval_type, \
          linked_entity_type = EXCLUDED.linked_entity_type, \
          linked_entity_id = EXCLUDED.linked_entity_id, \
          requested_by = COALESCE(camp_approval_items.requested_by, EXCLUDED.requested_by), \
          reason = EXCLUDED.reason, \
          blocks_activation = EXCLUDED.blocks_activation, \
          blocks_closeout = EXCLUDED.blocks_closeout, \
          status = CASE WHEN camp_approval_items.status = 'approved' THEN 'approved' ELSE 'pending' END, \
          deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(source_key)
    .bind(approval_type)
    .bind(linked_entity_type)
    .bind(linked_entity_id)
    .bind(requested_by)
    .bind(reason)
    .bind(blocks_activation)
    .bind(blocks_closeout)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn approval_type_for_line(
    charge_mode: &str,
    approval_required: bool,
    medicine: bool,
) -> Option<&'static str> {
    if !approval_required && !matches!(charge_mode, "free" | "mixed" | "sponsor_covered") {
        return None;
    }
    if medicine && charge_mode == "mixed" {
        return Some("partial_free_medicine");
    }
    if medicine {
        return Some("free_medicine");
    }
    if charge_mode == "sponsor_covered" {
        return Some("sponsor_billing");
    }
    if approval_required {
        return Some("budget_overrun");
    }
    None
}

async fn materialize_default_camp_print_and_closure(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
) -> Result<(), AppError> {
    for (template_type, template_name) in [
        ("registration_slip", "Camp registration slip"),
        ("prescription", "Camp prescription"),
        ("referral_slip", "Referral slip"),
        ("lab_label", "Lab sample label"),
        ("medicine_issue_slip", "Medicine issue slip"),
        ("asset_handover", "Asset handover"),
        ("closure_summary", "Camp closure summary"),
        ("nabh_evidence_pack", "NABH evidence pack"),
    ] {
        let source_key = format!("print:{template_type}");
        sqlx::query(
            "INSERT INTO camp_print_plan_items \
             (tenant_id, camp_id, source_key, template_type, template_name, status, paper_size, copies, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, $5, 'planned', 'A4', 1, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              template_type = EXCLUDED.template_type, template_name = EXCLUDED.template_name, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(source_key)
        .bind(template_type)
        .bind(template_name)
        .execute(&mut **tx)
        .await?;
    }

    for (task_type, label) in [
        ("stock_return", "Return or reconcile all camp stock"),
        ("asset_return", "Return or reconcile all issued camp assets"),
        (
            "sponsor_settlement",
            "Close sponsor receivable and settlement notes",
        ),
        (
            "pending_referrals",
            "Review pending referrals and follow-up ageing",
        ),
        (
            "incidents",
            "Close incidents, near misses, and corrective actions",
        ),
        ("bmw_handoff", "Attach biomedical waste handoff proof"),
        (
            "report_signoff",
            "Sign off closure report and NABH evidence pack",
        ),
    ] {
        let source_key = format!("closure:{task_type}");
        sqlx::query(
            "INSERT INTO camp_closure_tasks \
             (tenant_id, camp_id, source_key, task_type, label, status, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, $5, 'pending', NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              task_type = EXCLUDED.task_type, label = EXCLUDED.label, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(source_key)
        .bind(task_type)
        .bind(label)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn materialize_camp_plan_from_value(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    plan: Option<&Value>,
    user_id: Uuid,
) -> Result<(), AppError> {
    let Some(plan) = plan else {
        return Ok(());
    };
    if !plan.is_object() {
        return Ok(());
    }

    soft_clear_materialized_camp_plan(tx, tenant_id, camp_id, user_id).await?;

    let sponsor_amount = (planned_sponsor_coverage(plan)
        + json_decimal(plan.get("sponsor_covered_amount")))
    .round_dp(2);
    if sponsor_amount > Decimal::ZERO {
        let covered_services = json_array(plan, "service_lines")
            .iter()
            .filter_map(|item| json_text(Some(item)))
            .collect::<Vec<_>>();
        let covered_medicines = json_array(plan, "planned_medicine_refs")
            .iter()
            .filter_map(|item| json_text(item.get("medicine_name")))
            .collect::<Vec<_>>();
        sqlx::query(
            "INSERT INTO camp_sponsor_plans \
             (tenant_id, camp_id, source_key, sponsor_name, covered_services, covered_medicines, \
              coverage_cap, receivable_amount, outstanding_amount, status, owner_id, notes, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, 'default', $3, $4, $5, $6, $6, $6, 'active', $7, $8, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              sponsor_name = EXCLUDED.sponsor_name, covered_services = EXCLUDED.covered_services, \
              covered_medicines = EXCLUDED.covered_medicines, coverage_cap = EXCLUDED.coverage_cap, \
              receivable_amount = EXCLUDED.receivable_amount, \
              outstanding_amount = GREATEST(EXCLUDED.receivable_amount - camp_sponsor_plans.collected_amount, 0), \
              owner_id = EXCLUDED.owner_id, notes = EXCLUDED.notes, status = 'active', \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(json_text(plan.get("sponsor_name")).unwrap_or_else(|| "Camp sponsor".to_owned()))
        .bind(covered_services)
        .bind(covered_medicines)
        .bind(sponsor_amount)
        .bind(user_id)
        .bind(json_text(plan.get("budget_notes")))
        .execute(&mut **tx)
        .await?;
    }

    for service_line in json_array(plan, "service_lines") {
        if let Some(service_key) = json_text(Some(service_line)) {
            let source_key = format!("counter:service:{service_key}");
            sqlx::query(
                "INSERT INTO camp_counters \
                 (tenant_id, camp_id, source_key, counter_type, counter_name, status, notes, deleted_at, deleted_by, delete_reason) \
                 VALUES ($1, $2, $3, 'service', $4, 'planned', $5, NULL, NULL, NULL) \
                 ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
                  counter_name = EXCLUDED.counter_name, notes = EXCLUDED.notes, \
                  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
            )
            .bind(tenant_id)
            .bind(camp_id)
            .bind(source_key)
            .bind(service_key.replace('_', " "))
            .bind(json_text(plan.get("service_policy_notes")))
            .execute(&mut **tx)
            .await?;
        }
    }

    for department_id in json_array(plan, "supporting_department_ids")
        .iter()
        .filter_map(|item| json_uuid(Some(item)))
    {
        let source_key = format!("department:{department_id}");
        sqlx::query(
            "INSERT INTO camp_department_counters \
             (tenant_id, camp_id, source_key, department_id, service_scope, opd_routing_enabled, status, notes, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, $5, true, 'planned', $6, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              department_id = EXCLUDED.department_id, service_scope = EXCLUDED.service_scope, \
              opd_routing_enabled = true, notes = EXCLUDED.notes, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(source_key)
        .bind(department_id)
        .bind(json_text(plan.get("service_policy_notes")))
        .bind("Materialized from camp department plan")
        .execute(&mut **tx)
        .await?;
    }

    let mut materialized_doctors = Vec::new();
    for (index, item) in json_array(plan, "doctor_engagements").iter().enumerate() {
        let Some(doctor_id) = json_uuid(item.get("doctor_id")) else {
            continue;
        };
        materialized_doctors.push(doctor_id);
        let source_key = format!("doctor:{doctor_id}");
        sqlx::query(
            "INSERT INTO camp_doctor_roster \
             (tenant_id, camp_id, source_key, doctor_id, expected_consults, charge_mode, patient_fee, \
              concession_percentage, sponsor_share_amount, honorarium_amount, status, owner_id, notes, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, $7, $8, $9, $10, 'planned', $11, $12, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              doctor_id = EXCLUDED.doctor_id, expected_consults = EXCLUDED.expected_consults, \
              charge_mode = EXCLUDED.charge_mode, patient_fee = EXCLUDED.patient_fee, \
              concession_percentage = EXCLUDED.concession_percentage, sponsor_share_amount = EXCLUDED.sponsor_share_amount, \
              honorarium_amount = EXCLUDED.honorarium_amount, owner_id = EXCLUDED.owner_id, notes = EXCLUDED.notes, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(if source_key.trim().is_empty() {
            format!("doctor:index:{index}")
        } else {
            source_key
        })
        .bind(doctor_id)
        .bind(json_i32(item.get("expected_consults")))
        .bind(json_text(item.get("charge_mode")).unwrap_or_else(|| "free".to_owned()))
        .bind(json_decimal(item.get("consultation_fee")))
        .bind(json_decimal(item.get("concession_percentage")))
        .bind(json_decimal(item.get("sponsor_covered_amount")))
        .bind(json_decimal(item.get("salary_amount")))
        .bind(user_id)
        .bind(json_text(item.get("notes")))
        .execute(&mut **tx)
        .await?;
    }
    for doctor_id in json_array(plan, "planned_doctor_ids")
        .iter()
        .filter_map(|item| json_uuid(Some(item)))
        .filter(|doctor_id| !materialized_doctors.contains(doctor_id))
    {
        let source_key = format!("doctor:{doctor_id}");
        sqlx::query(
            "INSERT INTO camp_doctor_roster \
             (tenant_id, camp_id, source_key, doctor_id, charge_mode, status, owner_id, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, $5, 'planned', $6, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              doctor_id = EXCLUDED.doctor_id, charge_mode = EXCLUDED.charge_mode, owner_id = EXCLUDED.owner_id, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(source_key)
        .bind(doctor_id)
        .bind(json_text(plan.get("doctor_charge_mode")).unwrap_or_else(|| "free".to_owned()))
        .bind(user_id)
        .execute(&mut **tx)
        .await?;
    }

    for employee_id in json_array(plan, "planned_staff_ids")
        .iter()
        .filter_map(|item| json_uuid(Some(item)))
    {
        let source_key = format!("staff:{employee_id}");
        sqlx::query(
            "INSERT INTO camp_staff_roster \
             (tenant_id, camp_id, source_key, employee_id, role_in_camp, status, owner_id, notes, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, 'camp_staff', 'planned', $5, 'Materialized from camp staff plan', NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              employee_id = EXCLUDED.employee_id, owner_id = EXCLUDED.owner_id, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(source_key)
        .bind(employee_id)
        .bind(user_id)
        .execute(&mut **tx)
        .await?;
    }

    for (index, item) in json_array(plan, "service_offerings").iter().enumerate() {
        let service_key =
            json_text(item.get("service_line")).unwrap_or_else(|| format!("service_{index}"));
        let charge_mode = json_text(item.get("charge_mode")).unwrap_or_else(|| "free".to_owned());
        let source_key = format!("service:{service_key}");
        let row = sqlx::query_as::<_, IdRow>(
            "INSERT INTO camp_service_pricing_rules \
             (tenant_id, camp_id, source_key, service_key, service_name, planned_qty, charge_mode, \
              standard_rate, patient_rate, concession_percentage, camp_cost, sponsor_share_amount, \
              approval_required, status, owner_id, notes, deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, 0, $11, 'planned', $12, $13, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              service_key = EXCLUDED.service_key, service_name = EXCLUDED.service_name, planned_qty = EXCLUDED.planned_qty, \
              charge_mode = EXCLUDED.charge_mode, standard_rate = EXCLUDED.standard_rate, patient_rate = EXCLUDED.patient_rate, \
              concession_percentage = EXCLUDED.concession_percentage, camp_cost = EXCLUDED.camp_cost, \
              approval_required = EXCLUDED.approval_required, owner_id = EXCLUDED.owner_id, notes = EXCLUDED.notes, \
              deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now() \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(&source_key)
        .bind(&service_key)
        .bind(json_text_or(item.get("label"), &service_key.replace('_', " ")))
        .bind(json_decimal(item.get("planned_qty")))
        .bind(&charge_mode)
        .bind(json_decimal(item.get("patient_rate")))
        .bind(json_decimal(item.get("concession_percentage")))
        .bind(json_decimal(item.get("camp_cost")))
        .bind(json_bool(item.get("approval_required")))
        .bind(user_id)
        .bind(json_text(item.get("notes")))
        .fetch_one(&mut **tx)
        .await?;
        if let Some(approval_type) = approval_type_for_line(
            &charge_mode,
            json_bool(item.get("approval_required")),
            false,
        ) {
            upsert_camp_approval_item(
                tx,
                CampApprovalItemUpsert {
                    tenant_id,
                    camp_id,
                    source_key: &format!("{source_key}:approval"),
                    approval_type,
                    linked_entity_type: "camp_service_pricing_rules",
                    linked_entity_id: Some(row.id),
                    requested_by: user_id,
                    reason: "Camp service pricing requires approval",
                    blocks_activation: true,
                    blocks_closeout: false,
                },
            )
            .await?;
        }
    }

    let free_medicine_approval_required = json_bool(plan.get("free_medicine_approval_required"));
    let mut materialized_medicines = Vec::new();
    for (index, item) in json_array(plan, "planned_medicine_refs").iter().enumerate() {
        let catalog_item_id = json_uuid(item.get("catalog_item_id"));
        if let Some(id) = catalog_item_id {
            materialized_medicines.push(id);
        }
        let source_key = catalog_item_id
            .map(|id| format!("medicine:{id}"))
            .unwrap_or_else(|| format!("medicine:index:{index}"));
        let charge_mode = json_text(item.get("charge_mode"))
            .or_else(|| json_text(plan.get("medicine_charge_mode")))
            .unwrap_or_else(|| "free".to_owned());
        let approval_required = json_bool(item.get("approval_required"))
            || (free_medicine_approval_required
                && matches!(charge_mode.as_str(), "free" | "mixed" | "sponsor_covered"));
        let row = sqlx::query_as::<_, IdRow>(
            "INSERT INTO camp_medicine_pricing_rules \
             (tenant_id, camp_id, source_key, catalog_item_id, medicine_name, generic_name, batch_stock_id, \
              batch_no, expiry_date, store_location_id, planned_qty, reserved_qty, issued_qty, free_qty, paid_qty, \
              consumed_qty, returned_qty, damaged_qty, patient_unit_price, tax_percent, camp_unit_cost, \
              sponsor_share_amount, concession_percentage, charge_mode, approval_required, status, owner_id, notes, \
              deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, \
              $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'planned', $26, $27, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              catalog_item_id = EXCLUDED.catalog_item_id, medicine_name = EXCLUDED.medicine_name, generic_name = EXCLUDED.generic_name, \
              batch_stock_id = EXCLUDED.batch_stock_id, batch_no = EXCLUDED.batch_no, expiry_date = EXCLUDED.expiry_date, \
              store_location_id = EXCLUDED.store_location_id, planned_qty = EXCLUDED.planned_qty, reserved_qty = EXCLUDED.reserved_qty, \
              issued_qty = EXCLUDED.issued_qty, free_qty = EXCLUDED.free_qty, paid_qty = EXCLUDED.paid_qty, consumed_qty = EXCLUDED.consumed_qty, \
              returned_qty = EXCLUDED.returned_qty, damaged_qty = EXCLUDED.damaged_qty, patient_unit_price = EXCLUDED.patient_unit_price, \
              tax_percent = EXCLUDED.tax_percent, camp_unit_cost = EXCLUDED.camp_unit_cost, sponsor_share_amount = EXCLUDED.sponsor_share_amount, \
              concession_percentage = EXCLUDED.concession_percentage, charge_mode = EXCLUDED.charge_mode, approval_required = EXCLUDED.approval_required, \
              owner_id = EXCLUDED.owner_id, notes = EXCLUDED.notes, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now() \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(&source_key)
        .bind(catalog_item_id)
        .bind(json_text_or(item.get("medicine_name"), "Camp medicine"))
        .bind(json_text(item.get("generic_name")))
        .bind(json_uuid(item.get("batch_id")))
        .bind(json_text(item.get("batch_number")))
        .bind(json_text(item.get("expiry_date")).and_then(|text| NaiveDate::parse_from_str(&text, "%Y-%m-%d").ok()))
        .bind(json_uuid(item.get("store_location_id")))
        .bind(json_decimal(item.get("planned_qty")))
        .bind(json_decimal(item.get("reserved_qty")))
        .bind(json_decimal(item.get("issue_qty")))
        .bind(json_decimal(item.get("free_qty")))
        .bind(json_decimal(item.get("paid_qty")))
        .bind(json_decimal(item.get("consumed_qty")))
        .bind(json_decimal(item.get("return_qty")))
        .bind(json_decimal(item.get("damaged_qty")))
        .bind(json_decimal(item.get("unit_price")))
        .bind(json_decimal(item.get("tax_percent")))
        .bind(json_decimal(item.get("cost_amount")))
        .bind(json_decimal(item.get("sponsor_covered_amount")))
        .bind(json_decimal(item.get("concession_percentage")))
        .bind(&charge_mode)
        .bind(approval_required)
        .bind(user_id)
        .bind(json_text(item.get("stock_source_notes")))
        .fetch_one(&mut **tx)
        .await?;
        if let Some(approval_type) = approval_type_for_line(&charge_mode, approval_required, true) {
            upsert_camp_approval_item(
                tx,
                CampApprovalItemUpsert {
                    tenant_id,
                    camp_id,
                    source_key: &format!("{source_key}:approval"),
                    approval_type,
                    linked_entity_type: "camp_medicine_pricing_rules",
                    linked_entity_id: Some(row.id),
                    requested_by: user_id,
                    reason: "Camp medicine pricing or free issue requires approval",
                    blocks_activation: true,
                    blocks_closeout: false,
                },
            )
            .await?;
        }
    }
    for catalog_item_id in json_array(plan, "planned_medicine_ids")
        .iter()
        .filter_map(|item| json_uuid(Some(item)))
        .filter(|catalog_item_id| !materialized_medicines.contains(catalog_item_id))
    {
        let source_key = format!("medicine:{catalog_item_id}");
        let charge_mode =
            json_text(plan.get("medicine_charge_mode")).unwrap_or_else(|| "free".to_owned());
        let row = sqlx::query_as::<_, IdRow>(
            "INSERT INTO camp_medicine_pricing_rules \
             (tenant_id, camp_id, source_key, catalog_item_id, medicine_name, charge_mode, approval_required, status, owner_id, \
              deleted_at, deleted_by, delete_reason) \
             VALUES ($1, $2, $3, $4, 'Camp medicine', $5, $6, 'planned', $7, NULL, NULL, NULL) \
             ON CONFLICT (tenant_id, camp_id, source_key) DO UPDATE SET \
              catalog_item_id = EXCLUDED.catalog_item_id, charge_mode = EXCLUDED.charge_mode, approval_required = EXCLUDED.approval_required, \
              owner_id = EXCLUDED.owner_id, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now() \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(&source_key)
        .bind(catalog_item_id)
        .bind(&charge_mode)
        .bind(free_medicine_approval_required)
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;
        if let Some(approval_type) =
            approval_type_for_line(&charge_mode, free_medicine_approval_required, true)
        {
            upsert_camp_approval_item(
                tx,
                CampApprovalItemUpsert {
                    tenant_id,
                    camp_id,
                    source_key: &format!("{source_key}:approval"),
                    approval_type,
                    linked_entity_type: "camp_medicine_pricing_rules",
                    linked_entity_id: Some(row.id),
                    requested_by: user_id,
                    reason: "Camp medicine issue requires approval",
                    blocks_activation: true,
                    blocks_closeout: false,
                },
            )
            .await?;
        }
    }

    materialize_default_camp_print_and_closure(tx, tenant_id, camp_id).await?;
    Ok(())
}

fn service_plan_has_service(plan: &Value) -> bool {
    json_array(plan, "service_lines").iter().any(|item| {
        item.as_str()
            .map(str::trim)
            .is_some_and(|value| !value.is_empty())
    }) || !json_array(plan, "service_offerings").is_empty()
        || !json_array(plan, "planned_medicine_refs").is_empty()
}

fn decimal_percent(numerator: Decimal, denominator: Decimal) -> f64 {
    if denominator <= Decimal::ZERO {
        return 0.0;
    }
    let pct = numerator * Decimal::from(100) / denominator;
    pct.to_string().parse::<f64>().unwrap_or(0.0)
}

#[allow(clippy::too_many_arguments)]
fn planning_action(
    code: &str,
    label: &str,
    severity: &str,
    status: &str,
    owner_module: &str,
    evidence: String,
    blocks_activation: bool,
    blocks_closeout: bool,
) -> CampPlanningActionItem {
    CampPlanningActionItem {
        code: code.to_owned(),
        label: label.to_owned(),
        severity: severity.to_owned(),
        status: status.to_owned(),
        owner_module: owner_module.to_owned(),
        evidence,
        blocks_activation,
        blocks_closeout,
    }
}

async fn build_camp_planning_summary(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
) -> Result<CampPlanningSummary, AppError> {
    let camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1 AND tenant_id = $2")
        .bind(camp_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let empty_plan = Value::Null;
    let plan = camp.equipment_list.as_ref().unwrap_or(&empty_plan);
    let budget_components = planned_component_sum(plan, "planned_amount");
    let planned_budget = match camp.budget_allocated {
        Some(amount) if amount > budget_components => amount,
        _ => budget_components,
    }
    .round_dp(2);

    let planned_patient_collection = (planned_component_sum(plan, "patient_pay_amount")
        + planned_service_patient_collection(plan)
        + planned_doctor_patient_collection(plan)
        + planned_medicine_patient_collection(plan))
    .round_dp(2);
    let planned_cost = (planned_budget
        + planned_service_cost(plan)
        + planned_doctor_cost(plan)
        + planned_medicine_cost(plan))
    .round_dp(2);
    let planned_sponsor_coverage = planned_sponsor_coverage(plan).round_dp(2);

    let checklist = sqlx::query_as::<_, CampRemoteChecklistItem>(
        "SELECT * FROM camp_remote_checklist_items \
         WHERE camp_id = $1 AND tenant_id = $2",
    )
    .bind(camp_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let readiness = readiness_summary(&checklist);

    let supply = sqlx::query_as::<_, CampPlanningSupplyTotals>(
        "SELECT \
           COUNT(*)::bigint AS total_items, \
           COUNT(*) FILTER (WHERE category = 'medicine')::bigint AS medicine_items, \
           COUNT(*) FILTER (WHERE approval_required)::bigint AS approval_required_items, \
           COUNT(*) FILTER (WHERE packed_qty < planned_qty OR NULLIF(trim(COALESCE(shortage_notes, '')), '') IS NOT NULL)::bigint AS shortage_items, \
           COUNT(*) FILTER (WHERE is_critical AND (packed_qty < planned_qty OR NULLIF(trim(COALESCE(shortage_notes, '')), '') IS NOT NULL))::bigint AS critical_shortage_items, \
           COUNT(*) FILTER (WHERE category = 'medicine' AND packed_qty > 0 AND (batch_no IS NULL OR expiry_date IS NULL))::bigint AS traceability_gap_items, \
           COUNT(*) FILTER (WHERE category <> 'equipment' AND packed_qty > (consumed_qty + returned_qty))::bigint AS supply_return_pending_items, \
           COUNT(*) FILTER (WHERE category = 'equipment' AND packed_qty > (consumed_qty + returned_qty))::bigint AS asset_return_pending_items, \
           COALESCE(SUM(planned_qty * cost_amount), 0) AS planned_supply_cost, \
           COALESCE(SUM(consumed_qty * cost_amount), 0) AS actual_supply_cost, \
           COALESCE(SUM(CASE WHEN charge_mode IN ('free', 'sponsor_covered') THEN planned_qty * unit_price ELSE 0 END), 0) AS supply_free_issue_value \
         FROM camp_supply_items \
         WHERE tenant_id = $1 AND camp_id = $2",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .fetch_one(&mut **tx)
    .await?;

    let asset_totals = sqlx::query_as::<_, CampPlanningAssetTotals>(
        "SELECT \
           COUNT(*)::bigint AS total_reservations, \
           COUNT(*) FILTER (WHERE is_critical AND status NOT IN ('issued', 'returned'))::bigint AS critical_unissued_items, \
           COUNT(*) FILTER (WHERE status = 'issued' OR (status IN ('damaged', 'lost') AND NULLIF(trim(COALESCE(reconciliation_notes, '')), '') IS NULL))::bigint AS return_pending_items, \
           COUNT(*) FILTER (WHERE status IN ('damaged', 'lost') AND NULLIF(trim(COALESCE(reconciliation_notes, '')), '') IS NULL)::bigint AS compliance_blocked_items \
         FROM camp_asset_reservations \
         WHERE tenant_id = $1 AND camp_id = $2",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .fetch_one(&mut **tx)
    .await?;

    let billing = sqlx::query_as::<_, CampPlanningBillingTotals>(
        "SELECT \
           COALESCE(SUM(b.total_amount), 0) AS patient_collected, \
           COALESCE(SUM(b.sponsor_covered_amount), 0) AS sponsor_receivable, \
           COALESCE(SUM(CASE WHEN b.is_free THEN b.standard_amount ELSE 0 END), 0) AS free_issue_value, \
           COALESCE(SUM(CASE WHEN NOT b.is_free THEN b.total_amount ELSE 0 END), 0) AS paid_issue_value, \
           COUNT(*)::bigint AS billed_items, \
           COUNT(*) FILTER (WHERE b.is_free)::bigint AS free_items, \
           COUNT(*) FILTER (WHERE NOT b.is_free)::bigint AS paid_items \
         FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE b.tenant_id = $1 AND r.camp_id = $2",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .fetch_one(&mut **tx)
    .await?;

    let team = sqlx::query_as::<_, CampTeamCountRow>(
        "SELECT \
           COUNT(*)::bigint AS total_team, \
           COUNT(*) FILTER (WHERE is_confirmed)::bigint AS confirmed_team \
         FROM camp_team_members \
         WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .fetch_one(&mut **tx)
    .await?;

    let structured = sqlx::query_as::<_, CampStructuredPlanTotals>(
        "SELECT \
          (SELECT COUNT(*)::bigint FROM camp_counters WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS counter_items, \
          (SELECT COUNT(*)::bigint FROM camp_department_counters WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS department_items, \
          (SELECT COUNT(*)::bigint FROM camp_doctor_roster WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS doctor_items, \
          (SELECT COUNT(*)::bigint FROM camp_staff_roster WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS staff_items, \
          (SELECT COUNT(*)::bigint FROM camp_service_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS service_items, \
          (SELECT COUNT(*)::bigint FROM camp_medicine_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS medicine_items, \
          (SELECT COUNT(*)::bigint FROM camp_approval_items WHERE tenant_id = $1 AND camp_id = $2 AND status = 'pending' AND deleted_at IS NULL) AS pending_approvals, \
          (SELECT COUNT(*)::bigint FROM camp_approval_items WHERE tenant_id = $1 AND camp_id = $2 AND status = 'pending' AND blocks_activation AND deleted_at IS NULL) AS activation_blocking_approvals, \
          (SELECT COUNT(*)::bigint FROM camp_approval_items WHERE tenant_id = $1 AND camp_id = $2 AND status = 'pending' AND blocks_closeout AND deleted_at IS NULL) AS closeout_blocking_approvals, \
          (SELECT COUNT(*)::bigint FROM camp_site_readiness_items WHERE tenant_id = $1 AND camp_id = $2 AND status IN ('pending', 'issue') AND deleted_at IS NULL) AS site_open_items, \
          (SELECT COUNT(*)::bigint FROM camp_closure_tasks WHERE tenant_id = $1 AND camp_id = $2 AND status IN ('pending', 'blocked') AND deleted_at IS NULL) AS closure_open_items, \
          (SELECT COUNT(*)::bigint FROM camp_print_plan_items WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS print_total_items, \
          (SELECT COUNT(*)::bigint FROM camp_print_plan_items WHERE tenant_id = $1 AND camp_id = $2 AND status IN ('ready', 'printed') AND deleted_at IS NULL) AS print_ready_items, \
          ((SELECT COALESCE(SUM(CASE WHEN charge_mode NOT IN ('free', 'sponsor_covered') THEN planned_qty * patient_rate * (100 - concession_percentage) / 100 ELSE 0 END), 0) FROM camp_service_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(CASE WHEN charge_mode NOT IN ('free', 'sponsor_covered') THEN expected_consults * patient_fee * (100 - concession_percentage) / 100 ELSE 0 END), 0) FROM camp_doctor_roster WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(CASE WHEN charge_mode NOT IN ('free', 'sponsor_covered') THEN (CASE WHEN paid_qty > 0 THEN paid_qty ELSE planned_qty END) * patient_unit_price * (100 - concession_percentage) / 100 ELSE 0 END), 0) FROM camp_medicine_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL)) AS planned_patient_collection, \
          ((SELECT COALESCE(SUM(sponsor_share_amount), 0) FROM camp_service_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(sponsor_share_amount), 0) FROM camp_doctor_roster WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(sponsor_share_amount), 0) FROM camp_medicine_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(receivable_amount), 0) FROM camp_sponsor_plans WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL)) AS planned_sponsor_coverage, \
          ((SELECT COALESCE(SUM(planned_qty * camp_cost), 0) FROM camp_service_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(honorarium_amount), 0) FROM camp_doctor_roster WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) + \
           (SELECT COALESCE(SUM(planned_qty * camp_unit_cost), 0) FROM camp_medicine_pricing_rules WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL)) AS planned_cost, \
          (SELECT COALESCE(SUM(receivable_amount), 0) FROM camp_sponsor_plans WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS sponsor_receivable, \
          (SELECT COALESCE(SUM(collected_amount), 0) FROM camp_sponsor_plans WHERE tenant_id = $1 AND camp_id = $2 AND deleted_at IS NULL) AS sponsor_collected",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .fetch_one(&mut **tx)
    .await?;

    let actual_patient_collection = billing.patient_collected.unwrap_or_default().round_dp(2);
    let sponsor_receivable = (billing.sponsor_receivable.unwrap_or_default()
        + structured.sponsor_receivable.unwrap_or_default())
    .round_dp(2);
    let sponsor_collected = structured.sponsor_collected.unwrap_or_default().round_dp(2);
    let actual_cost = (supply.actual_supply_cost.unwrap_or_default()
        + camp.budget_spent.unwrap_or_default())
    .round_dp(2);
    let accrual_revenue = actual_patient_collection + sponsor_receivable;
    let profit_loss = (accrual_revenue - actual_cost).round_dp(2);
    let budget_variance = (actual_cost - planned_budget).round_dp(2);
    let cash_surplus = (actual_patient_collection + sponsor_collected - actual_cost).round_dp(2);
    let margin_pct = decimal_percent(profit_loss, accrual_revenue);
    let budget_variance_pct = decimal_percent(budget_variance, planned_budget);

    let mut action_items = Vec::new();
    if camp.coordinator_id.is_none() {
        action_items.push(planning_action(
            "coordinator_missing",
            "Assign a camp coordinator",
            "warning",
            "pending",
            "camp",
            "No coordinator is linked to this camp".to_owned(),
            true,
            false,
        ));
    }
    let venue_present = camp
        .venue_name
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
        || camp
            .venue_address
            .as_deref()
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
    if !venue_present {
        action_items.push(planning_action(
            "venue_missing",
            "Capture venue and site address",
            "warning",
            "pending",
            "camp",
            "Venue name/address is not set".to_owned(),
            true,
            false,
        ));
    }
    if !service_plan_has_service(plan) && supply.total_items == 0 {
        action_items.push(planning_action(
            "service_plan_missing",
            "Define service, pharmacy, or supply plan",
            "danger",
            "blocked",
            "camp",
            "No service lines, service offerings, medicines, or supplies are planned".to_owned(),
            true,
            false,
        ));
    }
    if team.total_team == 0 {
        action_items.push(planning_action(
            "team_missing",
            "Add camp team members",
            "danger",
            "blocked",
            "camp",
            "No staff, doctor, nurse, pharmacist, volunteer, or coordinator rows are assigned"
                .to_owned(),
            true,
            false,
        ));
    } else if team.confirmed_team == 0 {
        action_items.push(planning_action(
            "team_unconfirmed",
            "Confirm at least one team member",
            "warning",
            "pending",
            "camp",
            format!("{} team rows exist, none are confirmed", team.total_team),
            true,
            false,
        ));
    }
    if !readiness.ready {
        action_items.push(planning_action(
            "readiness_incomplete",
            "Complete remote readiness checklist",
            "danger",
            "blocked",
            "camp",
            format!(
                "{} of {} required controls complete, {} open issues",
                readiness.required_done, readiness.required_total, readiness.issue_count
            ),
            true,
            false,
        ));
    }
    if supply.critical_shortage_items > 0 {
        action_items.push(planning_action(
            "critical_shortage",
            "Resolve critical supply or asset shortage",
            "danger",
            "blocked",
            "camp",
            format!(
                "{} critical item rows have shortage markers",
                supply.critical_shortage_items
            ),
            true,
            false,
        ));
    } else if supply.shortage_items > 0 {
        action_items.push(planning_action(
            "supply_shortage",
            "Resolve supply shortage before camp start",
            "warning",
            "pending",
            "camp",
            format!(
                "{} supply rows are short or have shortage notes",
                supply.shortage_items
            ),
            true,
            false,
        ));
    }
    if supply.traceability_gap_items > 0 {
        action_items.push(planning_action(
            "medicine_traceability_gap",
            "Add batch and expiry for packed medicines",
            "danger",
            "blocked",
            "pharmacy",
            format!(
                "{} packed medicine rows are missing batch or expiry",
                supply.traceability_gap_items
            ),
            true,
            false,
        ));
    }
    if asset_totals.critical_unissued_items > 0 {
        action_items.push(planning_action(
            "critical_asset_unissued",
            "Issue critical camp assets before start",
            "danger",
            "blocked",
            "assets",
            format!(
                "{} critical reserved assets are not issued yet",
                asset_totals.critical_unissued_items
            ),
            true,
            false,
        ));
    }
    if supply.approval_required_items > 0 && camp.approved_at.is_none() {
        action_items.push(planning_action(
            "approval_required",
            "Approve budget/free/sponsor-covered camp items",
            "warning",
            "pending",
            "approvals",
            format!(
                "{} stock/service rows require approval before issue",
                supply.approval_required_items
            ),
            true,
            false,
        ));
    }
    if sponsor_receivable > Decimal::ZERO {
        action_items.push(planning_action(
            "sponsor_receivable",
            "Track sponsor receivable settlement",
            "warning",
            "pending",
            "billing",
            format!(
                "Sponsor receivable {}, {} free issue rows, {} paid rows, {} billed rows",
                sponsor_receivable.round_dp(2),
                billing.free_items,
                billing.paid_items,
                billing.billed_items
            ),
            false,
            true,
        ));
    }
    if budget_variance > Decimal::ZERO && planned_budget > Decimal::ZERO {
        action_items.push(planning_action(
            "budget_overrun",
            "Review actual cost above approved budget",
            "warning",
            "pending",
            "billing",
            format!(
                "Actual cost exceeds plan by {}",
                budget_variance.round_dp(2)
            ),
            false,
            true,
        ));
    }
    if structured.closeout_blocking_approvals > 0 {
        action_items.push(planning_action(
            "closeout_approvals_pending",
            "Clear closeout approval checklist",
            "danger",
            "blocked",
            "approvals",
            format!(
                "{} approval items are blocking camp closeout",
                structured.closeout_blocking_approvals
            ),
            false,
            true,
        ));
    }
    if structured.closure_open_items > 0 {
        action_items.push(planning_action(
            "closure_checklist_open",
            "Complete camp closure checklist",
            "danger",
            "blocked",
            "camp",
            format!(
                "{} closure tasks remain open for retrospective handover, stock, assets, equipment, cash, waste, or incident closure",
                structured.closure_open_items
            ),
            false,
            true,
        ));
    }
    if supply.supply_return_pending_items > 0 {
        action_items.push(planning_action(
            "supply_return_pending",
            "Return or reconcile camp medicines and consumables",
            "danger",
            "blocked",
            "indent",
            format!(
                "{} medicine/consumable rows still have packed quantity not consumed or returned",
                supply.supply_return_pending_items
            ),
            false,
            true,
        ));
    }
    let asset_return_pending_items =
        supply.asset_return_pending_items + asset_totals.return_pending_items;
    if asset_return_pending_items > 0 {
        action_items.push(planning_action(
            "asset_return_pending",
            "Return or reconcile issued camp assets",
            "warning",
            "pending",
            "assets",
            format!(
                "{} asset/equipment rows are issued, damaged, lost, or not reconciled",
                asset_return_pending_items
            ),
            false,
            true,
        ));
    }
    if asset_totals.compliance_blocked_items > 0 {
        action_items.push(planning_action(
            "asset_reconciliation_blocked",
            "Reconcile damaged or lost camp assets",
            "danger",
            "blocked",
            "assets",
            format!(
                "{} damaged/lost assets require reconciliation notes",
                asset_totals.compliance_blocked_items
            ),
            false,
            true,
        ));
    }
    if action_items.is_empty() {
        action_items.push(planning_action(
            "operational_controls_clear",
            "Operational controls are clear",
            "success",
            "ok",
            "camp",
            "No blocking camp planning issues found".to_owned(),
            false,
            false,
        ));
    }

    let activation_blocked = action_items
        .iter()
        .any(|item| item.blocks_activation && item.status != "ok");
    let closeout_blocked = action_items
        .iter()
        .any(|item| item.blocks_closeout && item.status != "ok");
    let planned_supply_cost = supply.planned_supply_cost.unwrap_or_default().round_dp(2);
    let planned_cost = if planned_cost > planned_supply_cost {
        planned_cost
    } else {
        planned_supply_cost
    };

    Ok(CampPlanningSummary {
        camp_id,
        camp_status: camp_status_code(camp.status).to_owned(),
        readiness,
        financials: CampPlanningFinancials {
            planned_budget,
            planned_patient_collection,
            planned_sponsor_coverage,
            planned_cost,
            actual_patient_collection,
            sponsor_receivable,
            sponsor_collected,
            actual_cost,
            profit_loss,
            margin_pct,
            budget_variance,
            budget_variance_pct,
            cash_surplus,
            free_issue_value: (billing.free_issue_value.unwrap_or_default()
                + supply.supply_free_issue_value.unwrap_or_default())
            .round_dp(2),
            paid_issue_value: billing.paid_issue_value.unwrap_or_default().round_dp(2),
        },
        stock: CampPlanningStockSummary {
            total_items: supply.total_items,
            medicine_items: supply.medicine_items,
            approval_required_items: supply.approval_required_items,
            shortage_items: supply.shortage_items,
            critical_shortage_items: supply.critical_shortage_items,
            traceability_gap_items: supply.traceability_gap_items,
            supply_return_pending_items: supply.supply_return_pending_items,
            asset_reservation_items: asset_totals.total_reservations,
            asset_critical_unissued_items: asset_totals.critical_unissued_items,
            asset_return_pending_items,
            asset_reconciliation_blocked_items: asset_totals.compliance_blocked_items,
        },
        action_items,
        activation_blocked,
        closeout_blocked,
    })
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

async fn ensure_registration_belongs_to_tenant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    registration_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS ( \
           SELECT 1 FROM camp_registrations \
           WHERE id = $1 AND tenant_id = $2 \
         )",
    )
    .bind(registration_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if exists {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "registration {registration_id} is not available for this tenant"
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

/// A written name split into the two columns `patients` stores.
///
/// A one-word name gets an empty surname, not the word "Patient".
///
/// Mononyms are ordinary here — 104 of the first 364 camp records loaded were
/// a single name — and the old default turned every one of them into
/// "Monilca Patient" and "Sudha Patient". That is not a display quirk: the
/// fabricated surname is stored, so it is what appears on the ward list, in
/// search, on the printed prescription and on the discharge summary, and a
/// patient handed a prescription addressed to a surname they do not have has
/// been given someone else's document as far as they can tell.
///
/// `last_name` is NOT NULL, so absent is the empty string rather than NULL.
fn split_person_name(person_name: &str) -> (String, String) {
    let parts: Vec<&str> = person_name.split_whitespace().collect();
    match parts.as_slice() {
        // Nothing legible at all. This one keeps a marker, because a record
        // with two empty name columns is unsearchable and unfindable.
        [] => ("Camp".to_owned(), "Patient".to_owned()),
        [first] => ((*first).to_owned(), String::new()),
        [first, rest @ ..] => ((*first).to_owned(), rest.join(" ")),
    }
}

#[cfg(test)]
mod person_name_tests {
    use super::split_person_name;

    #[test]
    fn a_single_name_gets_no_invented_surname() {
        // Real camp records. Each of these used to become "<name> Patient".
        for name in ["Monilca", "Sudha", "Krishuavenin", "Henedina"] {
            let (first, last) = split_person_name(name);
            assert_eq!(first, name);
            assert_eq!(last, "", "{name} was given a surname it does not have");
        }
    }

    #[test]
    fn a_full_name_splits_on_the_first_space() {
        assert_eq!(
            split_person_name("Henry Baskar"),
            ("Henry".to_owned(), "Baskar".to_owned())
        );
        // Everything after the first token is the surname, so a three-part
        // name keeps all of it rather than dropping the tail.
        assert_eq!(
            split_person_name("R. Manikavasagam Pillai"),
            ("R.".to_owned(), "Manikavasagam Pillai".to_owned())
        );
    }

    #[test]
    fn an_empty_name_keeps_a_findable_marker() {
        // Two empty columns would make the record unsearchable; 35 camp forms
        // arrive with no legible name at all.
        assert_eq!(
            split_person_name("   "),
            ("Camp".to_owned(), "Patient".to_owned())
        );
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

    // A stable reference to the paper form this person came from, when the
    // caller has one.
    //
    // Camp records get corrected for weeks after the camp — a name is
    // re-read, a gender is filled in — and the correction has to land on the
    // patient the first pass created. Matching on name and phone cannot do
    // that: correcting the name means the corrected record no longer matches
    // and a duplicate patient appears, while correcting anything else matches
    // and is then thrown away, because this path only ever *found* a patient
    // and never updated one. Neither failure is visible from the outside; you
    // simply end up with two of some people and stale data on the rest.
    //
    // `external_ref` is the form's own identity, so it survives every
    // correction to the content, and a re-sync updates in place.
    if let Some(external_ref) = body.external_ref.as_deref().filter(|r| !r.trim().is_empty()) {
        if let Some(existing_id) = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM patients \
             WHERE tenant_id = $1 \
               AND is_active = true \
               AND attributes->'registration_context'->>'external_ref' = $2 \
             LIMIT 1",
        )
        .bind(claims.tenant_id)
        .bind(external_ref)
        .fetch_optional(&mut **tx)
        .await?
        {
            apply_camp_corrections(tx, claims, existing_id, body, &first_name, &last_name).await?;
            return Ok(existing_id);
        }
    }

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
            "external_ref": body.external_ref,
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

/// Fold a re-synced camp form's corrections into the patient it already made.
///
/// Camp forms are reviewed for weeks after the camp — 4,374 fields corrected
/// by hand on the last extract, across 645 forms — and every one of those is a
/// clinician saying the first pass was wrong. Without this the correction had
/// nowhere to go: the lookup above found the patient and returned, so a fixed
/// name, age or phone number stayed fixed only on paper.
///
/// `COALESCE` on every column, so a field the form no longer carries leaves
/// what is already stored alone. A correction that blanks a field is not
/// expressible here, and deliberately so: "the reviewer did not re-enter this"
/// and "the reviewer cleared this" arrive identically, and of the two,
/// silently erasing a recorded name is the worse thing to guess at.
async fn apply_camp_corrections(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    body: &CreateRegistrationRequest,
    first_name: &str,
    last_name: &str,
) -> Result<(), AppError> {
    let gender = normalize_camp_gender(body.gender.as_deref());
    sqlx::query(
        "UPDATE patients SET \
             first_name = COALESCE(NULLIF($3, ''), first_name), \
             last_name = COALESCE(NULLIF($4, ''), last_name), \
             gender = COALESCE($5::gender, gender), \
             phone = COALESCE(NULLIF($6, ''), phone), \
             date_of_birth = COALESCE($7, date_of_birth), \
             is_dob_estimated = CASE WHEN $7 IS NULL THEN is_dob_estimated ELSE true END, \
             updated_at = now() \
         WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(first_name)
    .bind(last_name)
    .bind(&gender)
    .bind(body.phone.as_deref().unwrap_or_default())
    .bind(estimated_dob_from_age(body.age))
    .execute(&mut **tx)
    .await?;
    Ok(())
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

    // The unified token, without which this camp visit is invisible.
    //
    // `opd_queues` above is the clinic's own row and no board reads it: the
    // waiting-room displays, the front-office console and the doctor's
    // worklist all read `tokens`, and the call announcement fires from
    // `tokens::transition`. OPD walk-in registration and appointment
    // check-in both issue one; this path — a camp participant sent into a
    // consultation — never did, so camp patients joined a queue nobody was
    // watching and were never called on the board or over the speaker.
    //
    // Camps are exactly where that hurts most: one afternoon, a room full of
    // people who travelled to get there, and a number on a slip that no
    // display will ever show.
    //
    // Joins the visit the patient already has today, so one person carries
    // one number through the camp, the lab and the pharmacy rather than
    // collecting a fresh one at each counter.
    let visit_id = medbrains_tokens::current_visit(tx, patient_id)
        .await?
        .or_else(|| Some(Uuid::new_v4()));
    medbrains_tokens::issue_token_in_tx(
        tx,
        claims.tenant_id,
        medbrains_tokens::IssueToken {
            visit_id,
            module: "opd",
            scope: "department",
            scope_id: Some(department_id),
            scope_label: None,
            priority: "normal",
            patient_id: Some(patient_id),
            patient_name: None,
            entity_type: Some("encounter"),
            entity_id: Some(encounter_id),
            issued_by: Some(claims.sub),
        },
    )
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

            // Camp prescriptions are captured offline where the full allergy record isn't
            // available; at sync the server has it, so flag any drug-allergy conflict for the
            // pharmacist to catch at review. Non-blocking: the drug was already given in the
            // field, so we record the prescription and surface the warning rather than reject
            // the sync (which would silently drop the field record).
            let allergens = sqlx::query_scalar::<_, String>(
                "SELECT allergen_name FROM patient_allergies \
                 WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true \
                   AND allergy_type = 'drug'",
            )
            .bind(claims.tenant_id)
            .bind(patient_id)
            .fetch_all(&mut **tx)
            .await?;
            let drug_names: Vec<String> = body
                .items
                .iter()
                .map(|item| item.drug_name.clone())
                .collect();
            let conflicts: Vec<String> =
                medbrains_core::allergy::find_conflicts(&drug_names, &allergens)
                    .into_iter()
                    .map(|c| format!("{} (allergy: {})", c.drug_name, c.allergen))
                    .collect();
            let allergy_review_note = (!conflicts.is_empty()).then(|| {
                format!(
                    "ALLERGY ALERT (camp sync): conflicts with documented drug allergy — {}. \
                     Verify before dispensing.",
                    conflicts.join("; ")
                )
            });

            let _ = sqlx::query(
                "INSERT INTO pharmacy_prescriptions \
                 (tenant_id, prescription_id, patient_id, encounter_id, doctor_id, source, status, priority, review_notes) \
                 VALUES ($1, $2, $3, $4, $5, 'opd', 'pending_review', 'normal', $6) \
                 ON CONFLICT DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(prescription_id)
            .bind(patient_id)
            .bind(encounter_id)
            .bind(body.doctor_id.unwrap_or(claims.sub))
            .bind(allergy_review_note)
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
                  is_walk_in, registered_by, \
                  father_spouse_name, marital_status, blood_group, insurance_details) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \
                         $9, $10, $11, $12, $13, \
                         COALESCE($14, true), $15, \
                         $16, $17, $18, $19) \
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
            .bind(&body.father_spouse_name)
            .bind(&body.marital_status)
            .bind(&body.blood_group)
            .bind(&body.insurance_details)
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
            if body.referred_to_hospital.unwrap_or(false) {
                require_permission(claims, permissions::camp::referrals::CREATE)?;
            }
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
                  referred_to_hospital, referral_department, referral_urgency, screened_by, \
                  mh_diabetes, mh_hypertension, mh_asthma, mh_heart_disease, mh_thyroid_disorder, \
                  mh_previous_surgeries, mh_allergies, mh_smoking_history, mh_alcohol_use, \
                  mh_family_history, mh_others, medical_history_notes, \
                  test_hba1c, test_haemoglobin, test_thyroid, test_ecg, test_xray, test_bmd, \
                  test_biothesiometry, referral_doctor_name, icd_codes) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, \
                         $8, $9, $10, $11, $12, \
                         $13, $14, $15, $16, $17, \
                         COALESCE($18, false), $19, $20, $21, \
                         $22, $23, $24, $25, $26, \
                         $27, $28, $29, $30, \
                         $31, $32, $33, \
                         $34, $35, $36, $37, $38, $39, \
                         $40, $41, $42) \
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
            .bind(body.mh_diabetes)
            .bind(body.mh_hypertension)
            .bind(body.mh_asthma)
            .bind(body.mh_heart_disease)
            .bind(body.mh_thyroid_disorder)
            .bind(body.mh_previous_surgeries)
            .bind(body.mh_allergies)
            .bind(body.mh_smoking_history)
            .bind(body.mh_alcohol_use)
            .bind(body.mh_family_history)
            .bind(body.mh_others)
            .bind(&body.medical_history_notes)
            .bind(body.test_hba1c)
            .bind(body.test_haemoglobin)
            .bind(body.test_thyroid)
            .bind(&body.test_ecg)
            .bind(&body.test_xray)
            .bind(&body.test_bmd)
            .bind(&body.test_biothesiometry)
            .bind(&body.referral_doctor_name)
            .bind(body.icd_codes.as_deref())
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
            let normalized = normalize_camp_lab_sample_input(&body)?;
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
            .bind(&normalized.sample_type)
            .bind(&normalized.test_requested)
            .bind(&normalized.barcode)
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
            require_permission(claims, permissions::camp::referrals::CREATE)?;
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
            require_permission(claims, permissions::camp::UPDATE)?;
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
    let can_list_all_camps = is_bypass_role(&claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission.as_str() == permissions::camp::LIST);
    if !can_list_all_camps {
        require_any_permission(
            &claims,
            &[permissions::patients::CREATE, permissions::patients::UPDATE],
        )?;
        if params.status.as_deref() != Some("active") {
            return Err(AppError::Forbidden);
        }
    }

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
    require_any_permission(
        &claims,
        &[
            permissions::camp::LIST,
            permissions::camp::UPDATE,
            permissions::camp::assets::MANAGE,
            permissions::camp::registrations::LIST,
            permissions::camp::registrations::CREATE,
            permissions::camp::registrations::UPDATE,
            permissions::camp::screenings::LIST,
            permissions::camp::screenings::MANAGE,
            permissions::camp::lab::LIST,
            permissions::camp::lab::MANAGE,
            permissions::camp::billing::LIST,
            permissions::camp::billing::CREATE,
            permissions::camp::followups::LIST,
            permissions::camp::followups::SCHEDULE,
            permissions::camp::followups::OUTCOME,
            permissions::camp::followups::CONVERT,
            permissions::camp::referrals::CREATE,
            permissions::camp::referrals::UPDATE,
            permissions::camp::referrals::STATUS,
        ],
    )?;

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

    let restricted_fields = resolve_camp_registration_restricted_fields(&state, &claims).await?;
    let can_view_patient_record = has_patient_record_view(&claims);

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
         ORDER BY role_in_camp, created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let registrations = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let screenings = sqlx::query_as::<_, CampScreening>(
        "SELECT s.* FROM camp_screenings s \
         JOIN camp_registrations r ON r.id = s.registration_id \
         WHERE r.camp_id = $1 AND s.tenant_id = $2 \
         ORDER BY s.created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let lab_samples = sqlx::query_as::<_, CampLabSample>(
        "SELECT ls.* FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE r.camp_id = $1 AND ls.tenant_id = $2 \
         ORDER BY ls.created_at LIMIT 5000",
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
         ORDER BY category, code LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let supplies = sqlx::query_as::<_, CampSupplyItem>(
        "SELECT * FROM camp_supply_items \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY is_critical DESC, category, item_name LIMIT 5000",
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
         ORDER BY display_name LIMIT 5000",
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
         ORDER BY pa.patient_id, pa.severity DESC NULLS LAST, pa.allergen_name LIMIT 5000",
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
         ORDER BY patient_id, recorded_at DESC LIMIT 5000",
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
         ORDER BY current_camp DESC, registered_at DESC LIMIT 5000",
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
         ORDER BY patient_id, encounter_date DESC LIMIT 5000",
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
         ORDER BY patient_id, created_at DESC LIMIT 5000",
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
         ORDER BY patient_id, prescribed_at DESC LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let department_refs = sqlx::query_as::<_, CampPacketDepartmentRef>(
        "SELECT id, code, name, department_type::text AS department_type \
         FROM departments \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name LIMIT 5000",
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
         ORDER BY full_name LIMIT 5000",
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

    let registrations = registrations
        .into_iter()
        .map(|row| {
            filter_camp_registration_response(
                row,
                &restricted_fields,
                can_view_patient_record,
                true,
            )
        })
        .collect::<Vec<_>>();
    let registration_history = registration_history
        .into_iter()
        .map(|row| {
            filter_camp_registration_history_response(
                row,
                &restricted_fields,
                can_view_patient_record,
            )
        })
        .collect::<Vec<_>>();
    let patient_summaries = if can_view_patient_record {
        patient_summaries
    } else {
        Vec::new()
    };
    let active_allergies = if can_view_patient_record {
        active_allergies
    } else {
        Vec::new()
    };
    let recent_vitals = if can_view_patient_record {
        recent_vitals
    } else {
        Vec::new()
    };
    let visit_history = if can_view_patient_record {
        visit_history
    } else {
        Vec::new()
    };
    let diagnosis_history = if can_view_patient_record {
        diagnosis_history
    } else {
        Vec::new()
    };
    let medication_history = if can_view_patient_record {
        medication_history
    } else {
        Vec::new()
    };

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

        // A previous attempt that FAILED is not a duplicate — it is work still
        // owed. An idempotency key exists to stop the same event being applied
        // twice, not to stop it being applied once.
        //
        // Treating a failure as a duplicate made the failure permanent: a camp
        // device retrying after a transient error got "duplicate", assumed the
        // record was safely on the server, and the clinical record was lost
        // with nothing reporting it. Retried instead, updating the existing row
        // rather than inserting a second with the same key.
        let retrying = existing
            .as_ref()
            .is_some_and(|previous| previous.status != "applied");

        if let Some(existing) = existing.filter(|_| !retrying) {
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

        // On a retry the row already exists under this key, so the insert
        // upserts rather than colliding with its own uniqueness constraint.
        //
        // `received` is the status for "accepted, not yet applied", and it is
        // one of the four the table's check constraint permits — `received`,
        // `applied`, `duplicate`, `failed`. Writing `pending` here instead
        // made every retry fail the constraint and return a 400 that named
        // the constraint rather than the cause, which is how a resumed camp
        // load died two batches in.
        sqlx::query(
            "INSERT INTO camp_sync_events \
             (tenant_id, camp_id, device_id, idempotency_key, event_type, client_entity_id, \
              payload, occurred_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET \
               event_type = EXCLUDED.event_type, \
               payload = EXCLUDED.payload, \
               occurred_at = EXCLUDED.occurred_at, \
               status = 'received', \
               error = NULL",
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
                // Owner on a patient is the strongest relation there is, and it
                // belongs only to the person whose registration CREATED that
                // patient. `camp.opd.encounter.create` echoes the device's own
                // `body.patient_id` back in server_entities, so reading the key
                // unconditionally let a caller holding camp.list and
                // opd.visit.create post one encounter event naming any patient
                // UUID in the tenant and come out as Owner of that record.
                // Take the id only from the branch that registered a patient.
                let patient_grant_id = (applied_event.server_entity_type == "patient")
                    .then(|| {
                        applied_event
                            .server_entities
                            .get("patient_id")
                            .and_then(Value::as_str)
                            .and_then(|value| Uuid::parse_str(value).ok())
                    })
                    .flatten();
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
                    let authz_ctx =
                        medbrains_server_core::middleware::authorization::authz_context(&claims);
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
         ORDER BY category, code LIMIT 5000",
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
         ORDER BY is_critical DESC, category, item_name LIMIT 5000",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let referrals = sqlx::query_as::<_, CampReferral>(
        "SELECT * FROM camp_referrals \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let incidents = sqlx::query_as::<_, CampIncident>(
        "SELECT * FROM camp_incidents \
         WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 5000",
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

pub async fn get_camp_planning_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<CampPlanningSummary>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let summary = build_camp_planning_summary(&mut tx, claims.tenant_id, camp_id).await?;
    tx.commit().await?;
    Ok(Json(summary))
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
          CASE WHEN COALESCE($26, 'draft') IN ('ready', 'closed') THEN $27::uuid ELSE NULL END, \
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

    let row = insert_supply_item(&mut tx, claims.tenant_id, camp_id, body).await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn bulk_create_supply_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<BulkCreateSupplyItemsRequest>,
) -> Result<Json<BulkCreateSupplyItemsResponse>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest(
            "at least one supply item is required".to_owned(),
        ));
    }
    if body.items.len() > 250 {
        return Err(AppError::BadRequest(
            "bulk camp supply intake is limited to 250 rows".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut created = Vec::with_capacity(body.items.len());
    for item in body.items {
        created.push(insert_supply_item(&mut tx, claims.tenant_id, camp_id, item).await?);
    }

    tx.commit().await?;
    Ok(Json(BulkCreateSupplyItemsResponse {
        count: created.len(),
        created,
    }))
}

async fn insert_supply_item(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    body: CreateSupplyItemRequest,
) -> Result<CampSupplyItem, AppError> {
    if body.item_name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "supply item name is required".to_owned(),
        ));
    }
    let charge_mode = normalized_camp_charge_mode(body.charge_mode.as_deref())?;
    let row = sqlx::query_as::<_, CampSupplyItem>(
        "INSERT INTO camp_supply_items \
         (tenant_id, camp_id, category, catalog_item_id, batch_stock_id, store_location_id, \
          item_name, unit, planned_qty, packed_qty, batch_no, expiry_date, charge_mode, \
          unit_price, tax_percent, cost_amount, sponsor_covered_amount, concession_percentage, \
          approval_required, is_critical, shortage_notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), COALESCE($10, 0), \
          $11, $12, $13, COALESCE($14, 0), COALESCE($15, 0), COALESCE($16, 0), \
          COALESCE($17, 0), COALESCE($18, 0), COALESCE($19, false), COALESCE($20, false), $21) \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(body.category)
    .bind(body.catalog_item_id)
    .bind(body.batch_stock_id)
    .bind(body.store_location_id)
    .bind(body.item_name.trim())
    .bind(body.unit)
    .bind(body.planned_qty)
    .bind(body.packed_qty)
    .bind(body.batch_no)
    .bind(body.expiry_date)
    .bind(charge_mode)
    .bind(body.unit_price)
    .bind(body.tax_percent)
    .bind(body.cost_amount)
    .bind(body.sponsor_covered_amount)
    .bind(body.concession_percentage)
    .bind(body.approval_required)
    .bind(body.is_critical)
    .bind(body.shortage_notes)
    .fetch_one(&mut **tx)
    .await?;

    Ok(row)
}

fn normalized_camp_charge_mode(value: Option<&str>) -> Result<&'static str, AppError> {
    match value.unwrap_or("free").trim() {
        "" | "free" => Ok("free"),
        "paid" => Ok("paid"),
        "mixed" => Ok("mixed"),
        "sponsor_covered" => Ok("sponsor_covered"),
        other => Err(AppError::BadRequest(format!(
            "invalid camp charge mode: {other}"
        ))),
    }
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
    require_permission(&claims, permissions::camp::referrals::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    if let Some(registration_id) = body.registration_id {
        ensure_registration_belongs_to_camp(&mut tx, claims.tenant_id, camp_id, registration_id)
            .await?;
    }

    let referred_to_facility = body.referred_to_facility.trim().to_owned();
    if referred_to_facility.is_empty() {
        return Err(AppError::BadRequest(
            "referral facility is required for camp referral".to_owned(),
        ));
    }
    let reason = body.reason.trim().to_owned();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "referral reason is required for camp referral".to_owned(),
        ));
    }

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
    .bind(referred_to_facility)
    .bind(body.referral_department)
    .bind(body.urgency)
    .bind(reason)
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

pub async fn list_camp_referrals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<Vec<CampReferral>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::camp::LIST,
            permissions::camp::referrals::CREATE,
            permissions::camp::referrals::UPDATE,
            permissions::camp::referrals::STATUS,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampReferral>(
        "SELECT * FROM camp_referrals \
         WHERE tenant_id = $1 AND camp_id = $2 \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn update_camp_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCampReferralRequest>,
) -> Result<Json<CampReferral>, AppError> {
    let status = if let Some(value) = body.status.as_deref() {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest(
                "camp referral status cannot be blank".to_owned(),
            ));
        }
        if !matches!(
            trimmed,
            "created" | "sent" | "accepted" | "completed" | "cancelled"
        ) {
            return Err(AppError::BadRequest(
                "invalid camp referral status transition".to_owned(),
            ));
        }
        Some(trimmed.to_owned())
    } else {
        None
    };
    let handoff_update_requested = body.transport_mode.is_some()
        || body.attendant_name.is_some()
        || body.attendant_phone.is_some();
    if handoff_update_requested {
        require_permission(&claims, permissions::camp::referrals::UPDATE)?;
    } else if status.is_some() {
        require_any_permission(
            &claims,
            &[
                permissions::camp::referrals::STATUS,
                permissions::camp::referrals::UPDATE,
            ],
        )?;
    } else {
        return Err(AppError::BadRequest(
            "camp referral update payload is empty".to_owned(),
        ));
    }

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
    .bind(status)
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
    require_permission(&claims, permissions::camp::UPDATE)?;

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

    let summary = build_camp_planning_summary(&mut tx, claims.tenant_id, id).await?;
    if summary.activation_blocked {
        let blockers = summary
            .action_items
            .iter()
            .filter(|item| item.blocks_activation && item.status != "ok")
            .map(|item| item.label.as_str())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(AppError::BadRequest(format!(
            "camp activation blocked: {blockers}"
        )));
    }

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'active' \
         WHERE id = $1 AND status IN ('approved', 'setup') RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let mut event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::CampStarted,
        row.id,
        claims.sub,
        serde_json::json!({
            "camp_id": row.id,
            "camp_code": &row.camp_code,
            "camp_type": row.camp_type,
            "scheduled_date": row.scheduled_date,
            "status": row.status,
            "organizing_department_id": row.organizing_department_id,
        }),
    );
    if let Some(department_id) = row.organizing_department_id {
        event = event.with_department(department_id);
    }
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

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

    let summary = build_camp_planning_summary(&mut tx, claims.tenant_id, id).await?;
    if summary.closeout_blocked {
        let blockers = summary
            .action_items
            .iter()
            .filter(|item| item.blocks_closeout && item.status != "ok")
            .map(|item| item.label.as_str())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(AppError::BadRequest(format!(
            "camp closeout blocked: {blockers}"
        )));
    }

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

pub async fn list_staff_options(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CampLookupQuery>,
) -> Result<Json<Vec<CampStaffOption>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::camp::LIST,
            permissions::camp::CREATE,
            permissions::camp::UPDATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let search = q.search.map(|value| format!("%{}%", value.trim()));
    let rows = sqlx::query_as::<_, CampStaffOption>(
        "SELECT \
            e.id, \
            e.employee_code, \
            trim(concat_ws(' ', e.first_name, e.last_name)) AS display_name, \
            e.department_id, \
            d.name AS department_name, \
            des.name AS designation_name, \
            e.status::text AS status \
         FROM employees e \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         LEFT JOIN designations des ON des.id = e.designation_id AND des.tenant_id = e.tenant_id \
         WHERE e.tenant_id = $1 \
           AND e.status = 'active'::employee_status \
           AND ($2::uuid IS NULL OR e.department_id = $2) \
           AND ( \
                $3::text IS NULL \
                OR e.employee_code ILIKE $3 \
                OR e.first_name ILIKE $3 \
                OR e.last_name ILIKE $3 \
                OR e.phone ILIKE $3 \
                OR e.email ILIKE $3 \
           ) \
         ORDER BY e.first_name, e.last_name \
         LIMIT 150",
    )
    .bind(claims.tenant_id)
    .bind(q.department_id)
    .bind(&search)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_medicine_options(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CampLookupQuery>,
) -> Result<Json<Vec<CampMedicineOption>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::camp::LIST,
            permissions::camp::CREATE,
            permissions::camp::UPDATE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let search = q.search.map(|value| format!("%{}%", value.trim()));
    let rows = sqlx::query_as::<_, CampMedicineOption>(
        "SELECT \
            id, code, name, generic_name, unit, current_stock, base_price, tax_percent, \
            drug_schedule::text AS drug_schedule, \
            is_controlled, is_lasa, batch_tracking_required, \
            formulary_status::text AS formulary_status \
         FROM pharmacy_catalog \
         WHERE tenant_id = $1 \
           AND is_active = true \
           AND ($2::text IS NULL OR name ILIKE $2 OR generic_name ILIKE $2 OR code ILIKE $2) \
         ORDER BY \
           CASE WHEN current_stock > 0 THEN 0 ELSE 1 END, \
           name \
         LIMIT 150",
    )
    .bind(claims.tenant_id)
    .bind(&search)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Team Members
// ══════════════════════════════════════════════════════════

pub async fn list_team_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<Vec<CampTeamMemberWithEmployee>>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::camp::LIST, permissions::camp::UPDATE],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampTeamMemberWithEmployee>(
        "SELECT \
            ctm.id, ctm.tenant_id, ctm.camp_id, ctm.employee_id, \
            e.employee_code, \
            trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name, \
            d.name AS department_name, \
            ctm.role_in_camp, ctm.is_confirmed, ctm.notes, ctm.created_at, ctm.updated_at \
         FROM camp_team_members ctm \
         LEFT JOIN employees e ON e.id = ctm.employee_id AND e.tenant_id = ctm.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         WHERE ctm.camp_id = $1 AND ctm.tenant_id = $2 AND ctm.deleted_at IS NULL \
         ORDER BY ctm.role_in_camp, e.first_name, e.last_name, ctm.created_at LIMIT 5000",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
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
    let role_in_camp = body.role_in_camp.trim();
    if role_in_camp.is_empty() {
        return Err(AppError::BadRequest("Camp role is required".to_owned()));
    }
    let notes = body
        .notes
        .as_ref()
        .map(|value| value.trim())
        .and_then(|value| {
            if value.is_empty() {
                None
            } else {
                Some(value.to_owned())
            }
        });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camp_status = sqlx::query_scalar::<_, String>(
        "SELECT status::text FROM camps WHERE id = $1 AND tenant_id = $2",
    )
    .bind(camp_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    if matches!(camp_status.as_str(), "completed" | "cancelled") {
        return Err(AppError::BadRequest(
            "Camp team cannot be changed after completion or cancellation".to_owned(),
        ));
    }

    let employee_is_active = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
            SELECT 1 FROM employees \
            WHERE id = $1 AND tenant_id = $2 AND status = 'active'::employee_status \
         )",
    )
    .bind(body.employee_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if !employee_is_active {
        return Err(AppError::BadRequest(
            "Select an active staff member from this tenant".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, CampTeamMember>(
        "INSERT INTO camp_team_members \
         (tenant_id, camp_id, employee_id, role_in_camp, is_confirmed, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), $6) \
         ON CONFLICT (tenant_id, camp_id, employee_id) DO UPDATE SET \
           role_in_camp = EXCLUDED.role_in_camp, \
           is_confirmed = EXCLUDED.is_confirmed, \
           notes = EXCLUDED.notes, \
           deleted_at = NULL, \
           deleted_by = NULL, \
           delete_reason = NULL, \
           updated_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.employee_id)
    .bind(role_in_camp)
    .bind(body.is_confirmed)
    .bind(&notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn remove_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((camp_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "UPDATE camp_team_members SET \
         deleted_at = COALESCE(deleted_at, now()), \
         deleted_by = COALESCE(deleted_by, $3), \
         delete_reason = COALESCE(delete_reason, 'Removed from camp team'), \
         is_confirmed = false, \
         updated_at = now() \
         WHERE id = $1 AND camp_id = $2 AND tenant_id = $4 AND deleted_at IS NULL",
    )
    .bind(member_id)
    .bind(camp_id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "deleted": false,
        "archived": result.rows_affected() > 0
    })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Registrations
// ══════════════════════════════════════════════════════════

pub async fn list_registrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRegistrationsQuery>,
) -> Result<Json<Vec<CampRegistration>>, AppError> {
    require_any_permission(&claims, CAMP_REGISTRATION_SELECTOR_PERMISSIONS)?;

    let restricted_fields = resolve_camp_registration_restricted_fields(&state, &claims).await?;
    let can_view_patient_record = has_patient_record_view(&claims);
    let can_view_full_queue = can_view_full_camp_registration_queue(&claims);
    if params.camp_id.is_none() && params.patient_id.is_none() {
        return Err(AppError::BadRequest(
            "camp_id or patient_id is required to list camp registrations".to_owned(),
        ));
    }
    if params.camp_id.is_none() && !can_view_patient_record {
        return Err(AppError::Forbidden);
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations \
         WHERE ($1::uuid IS NULL OR camp_id = $1) \
         AND tenant_id = $2 \
         AND ($3::text IS NULL OR status::text = $3) \
         AND ($4::uuid IS NULL OR patient_id = $4) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(claims.tenant_id)
    .bind(&params.status)
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let rows = rows
        .into_iter()
        .map(|row| {
            filter_camp_registration_response(
                row,
                &restricted_fields,
                can_view_patient_record,
                can_view_full_queue,
            )
        })
        .collect();
    Ok(Json(rows))
}

pub async fn create_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRegistrationRequest>,
) -> Result<Json<CampRegistration>, AppError> {
    require_permission(&claims, permissions::camp::registrations::CREATE)?;
    if body.patient_id.is_some() && !has_patient_record_view(&claims) {
        return Err(AppError::Forbidden);
    }

    let restricted_fields = resolve_camp_registration_restricted_fields(&state, &claims).await?;
    validate_camp_registration_write_access(&body, &restricted_fields)?;
    let can_view_patient_record = has_patient_record_view(&claims);
    let can_view_full_queue = can_view_full_camp_registration_queue(&claims);

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

    // All camp participants see a doctor first; investigations follow only on
    // the doctor's advice. Default service_line to 'consultation' so the
    // registration form doesn't need to ask which service is needed.
    let service_line = body
        .service_line
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "consultation".to_owned());

    let row = sqlx::query_as::<_, CampRegistration>(
        "INSERT INTO camp_registrations \
         (tenant_id, camp_id, registration_number, person_name, age, gender, phone, \
          address, id_proof_type, id_proof_number, patient_id, clinical_department_id, \
          attending_doctor_id, service_line, chief_complaint, \
          is_walk_in, registered_by, \
          father_spouse_name, marital_status, blood_group, insurance_details) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
                 $8, $9, $10, $11, $12, \
                 $13, $14, $15, \
                 COALESCE($16, true), $17, \
                 $18, $19, $20, $21) \
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
    .bind(&service_line)
    .bind(&body.chief_complaint)
    .bind(body.is_walk_in)
    .bind(claims.sub)
    .bind(&body.father_spouse_name)
    .bind(&body.marital_status)
    .bind(&body.blood_group)
    .bind(&body.insurance_details)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(patient_id) = row.patient_id {
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::CampRegistrationCreated,
            row.id,
            claims.sub,
            serde_json::json!({
                "registration_id": row.id,
                "camp_id": row.camp_id,
                "patient_id": patient_id,
                "registration_number": &row.registration_number,
                "service_line": &row.service_line,
                "is_walk_in": row.is_walk_in,
                "clinical_department_id": row.clinical_department_id,
                "attending_doctor_id": row.attending_doctor_id,
                "created_at": row.created_at,
            }),
        )
        .with_patient(patient_id);
        if let Some(department_id) = row.clinical_department_id {
            event = event.with_department(department_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    tx.commit().await?;
    Ok(Json(filter_camp_registration_response(
        row,
        &restricted_fields,
        can_view_patient_record,
        can_view_full_queue,
    )))
}

pub async fn update_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRegistrationRequest>,
) -> Result<Json<CampRegistration>, AppError> {
    require_permission(&claims, permissions::camp::registrations::UPDATE)?;
    if body.patient_id.is_some() && !has_patient_record_view(&claims) {
        return Err(AppError::Forbidden);
    }

    let restricted_fields = resolve_camp_registration_restricted_fields(&state, &claims).await?;
    let can_view_patient_record = has_patient_record_view(&claims);
    let can_view_full_queue = can_view_full_camp_registration_queue(&claims);

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
    Ok(Json(filter_camp_registration_response(
        row,
        &restricted_fields,
        can_view_patient_record,
        can_view_full_queue,
    )))
}

pub async fn open_registration_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<OpenCampRegistrationEncounterRequest>>,
) -> Result<Json<OpenCampRegistrationEncounterResponse>, AppError> {
    require_permission(&claims, permissions::camp::registrations::UPDATE)?;
    require_permission(&claims, permissions::opd::visit::CREATE)?;
    let can_view_patient_record = has_patient_record_view(&claims);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let context = sqlx::query_as::<_, OpenEncounterRegistrationContext>(
        "SELECT r.camp_id, c.camp_code, c.name AS camp_name, \
                c.organizing_department_id, \
                r.person_name, r.age, r.gender, r.phone, r.address, \
                r.id_proof_type, r.id_proof_number, \
                r.father_spouse_name, r.marital_status, r.blood_group, r.insurance_details, \
                r.patient_id, \
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
    if context.patient_id.is_none() {
        require_permission(&claims, permissions::patients::CREATE)?;
    }

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
        // This path already holds the registration it is promoting, so it has
        // no separate external record to reconcile against.
        external_ref: None,
        person_name: context.person_name.clone(),
        age: context.age,
        gender: context.gender.clone(),
        phone: context.phone.clone(),
        address: context.address.clone(),
        id_proof_type: context.id_proof_type.clone(),
        id_proof_number: context.id_proof_number.clone(),
        father_spouse_name: context.father_spouse_name.clone(),
        marital_status: context.marital_status.clone(),
        blood_group: context.blood_group.clone(),
        insurance_details: context.insurance_details.clone(),
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

    // Wire the camp registration into the ReBAC access-control system, exactly
    // like a normal OPD registration + encounter (RFC-ACCESS-RESOLUTION-GRAPH):
    // a newly-created camp patient gets its owner grant, and the camp encounter
    // gets its care-team link (department + attending). Without this, camp-
    // originated encounters are invisible to the treating team under per-
    // encounter enforcement.
    let authz_ctx = medbrains_server_core::middleware::authorization::authz_context(&claims);
    if context.patient_id.is_none() {
        state
            .authz
            .write_tuple(
                &authz_ctx,
                "patient",
                patient_id,
                medbrains_authz::Relation::Owner,
                medbrains_authz::Subject::User(claims.sub),
                None,
                Some("camp_registration".to_owned()),
            )
            .await
            .map_err(|e| AppError::Internal(format!("camp patient authz grant failed: {e}")))?;
    }
    state
        .authz
        .grant_raw(
            &authz_ctx,
            "encounter",
            link.encounter_id,
            "dept_member",
            medbrains_authz::Subject::Department(department_id),
            None,
            Some("camp_encounter_department".to_owned()),
        )
        .await
        .map_err(|e| AppError::Internal(format!("camp encounter dept authz grant failed: {e}")))?;
    if let Some(doctor) = doctor_id {
        state
            .authz
            .write_tuple(
                &authz_ctx,
                "encounter",
                link.encounter_id,
                medbrains_authz::Relation::AttendingPhysician,
                medbrains_authz::Subject::User(doctor),
                None,
                Some("camp_encounter_attending".to_owned()),
            )
            .await
            .map_err(|e| {
                AppError::Internal(format!("camp encounter attending authz grant failed: {e}"))
            })?;
    }

    let response = OpenCampRegistrationEncounterResponse {
        encounter_id: link.encounter_id,
        queue_id: link.queue_id,
        patient_id,
        patient_name,
        uhid,
        department_id,
        doctor_id,
    };
    Ok(Json(filter_open_camp_encounter_response(
        response,
        can_view_patient_record,
    )))
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
    if body.referred_to_hospital.unwrap_or(false) {
        require_permission(&claims, permissions::camp::referrals::CREATE)?;
    }

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
          referred_to_hospital, referral_department, referral_urgency, screened_by, \
          mh_diabetes, mh_hypertension, mh_asthma, mh_heart_disease, mh_thyroid_disorder, \
          mh_previous_surgeries, mh_allergies, mh_smoking_history, mh_alcohol_use, \
          mh_family_history, mh_others, medical_history_notes, \
          test_hba1c, test_haemoglobin, test_thyroid, test_ecg, test_xray, test_bmd, \
          test_biothesiometry, referral_doctor_name, icd_codes) \
         VALUES ($1, $2, $3, $4, $5, $6, \
                 $7, $8, $9, $10, $11, \
                 $12, $13, \
                 $14, $15, $16, \
                 COALESCE($17, false), $18, $19, $20, \
                 $21, $22, $23, $24, $25, \
                 $26, $27, $28, $29, \
                 $30, $31, $32, \
                 $33, $34, $35, $36, $37, $38, \
                 $39, $40, $41) \
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
    .bind(body.mh_diabetes)
    .bind(body.mh_hypertension)
    .bind(body.mh_asthma)
    .bind(body.mh_heart_disease)
    .bind(body.mh_thyroid_disorder)
    .bind(body.mh_previous_surgeries)
    .bind(body.mh_allergies)
    .bind(body.mh_smoking_history)
    .bind(body.mh_alcohol_use)
    .bind(body.mh_family_history)
    .bind(body.mh_others)
    .bind(&body.medical_history_notes)
    .bind(body.test_hba1c)
    .bind(body.test_haemoglobin)
    .bind(body.test_thyroid)
    .bind(&body.test_ecg)
    .bind(&body.test_xray)
    .bind(&body.test_bmd)
    .bind(&body.test_biothesiometry)
    .bind(&body.referral_doctor_name)
    .bind(body.icd_codes.as_deref())
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

    if let Some(patient_id) = registration_context.patient_id {
        let mut event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::CampScreeningCompleted,
            row.id,
            claims.sub,
            serde_json::json!({
                "screening_id": row.id,
                "registration_id": row.registration_id,
                "camp_id": registration_context.camp_id,
                "patient_id": patient_id,
                "referred_to_hospital": row.referred_to_hospital,
                "referral_department": &row.referral_department,
                "referral_urgency": &row.referral_urgency,
                "screened_at": row.created_at,
            }),
        )
        .with_patient(patient_id);
        if let Some(department_id) = registration_context.organizing_department_id {
            event = event.with_department(department_id);
        }
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
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
    let normalized = normalize_camp_lab_sample_input(&body)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_registration_belongs_to_tenant(&mut tx, claims.tenant_id, body.registration_id).await?;

    let row = sqlx::query_as::<_, CampLabSample>(
        "INSERT INTO camp_lab_samples \
         (tenant_id, registration_id, sample_type, test_requested, barcode, \
          collected_at, collected_by) \
         VALUES ($1, $2, $3, $4, $5, now(), $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&normalized.sample_type)
    .bind(&normalized.test_requested)
    .bind(&normalized.barcode)
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
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sample_context = sqlx::query_as::<_, CampLabSampleLinkContext>(
        "SELECT r.patient_id, ls.sent_to_lab \
         FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE ls.id = $1 AND ls.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("camp lab sample not found".to_owned()))?;

    if sample_context.sent_to_lab {
        return Err(AppError::BadRequest(
            "camp lab sample is already linked to a lab order".to_owned(),
        ));
    }

    let lab_order_context = sqlx::query_as::<_, CampLabOrderLinkContext>(
        "SELECT patient_id \
         FROM lab_orders \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.lab_order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("lab order not found".to_owned()))?;

    let registration_patient_id = sample_context.patient_id.ok_or_else(|| {
        AppError::BadRequest(
            "camp registration must be linked to a patient before sending samples to lab"
                .to_owned(),
        )
    })?;
    if registration_patient_id != lab_order_context.patient_id {
        return Err(AppError::BadRequest(
            "lab order patient does not match the camp registration patient".to_owned(),
        ));
    }

    let result_summary = body
        .result_summary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let row = sqlx::query_as::<_, CampLabSample>(
        "UPDATE camp_lab_samples SET \
         lab_order_id = $2, result_summary = $3, sent_to_lab = true \
         WHERE id = $1 AND tenant_id = $4 RETURNING *",
    )
    .bind(id)
    .bind(body.lab_order_id)
    .bind(&result_summary)
    .bind(claims.tenant_id)
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
    require_permission(&claims, permissions::camp::billing::LIST)?;
    let restricted_fields = resolve_camp_registration_restricted_fields(&state, &claims).await?;

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
    let rows = rows
        .into_iter()
        .map(|row| filter_camp_billing_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn create_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBillingRequest>,
) -> Result<Json<CampBillingRecord>, AppError> {
    require_permission(&claims, permissions::camp::billing::CREATE)?;
    let restricted_fields = resolve_camp_registration_restricted_fields(&state, &claims).await?;
    validate_camp_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    ensure_registration_belongs_to_tenant(&mut tx, claims.tenant_id, body.registration_id).await?;

    let service_description = body.service_description.trim().to_owned();
    if service_description.is_empty() {
        return Err(AppError::BadRequest(
            "service description is required for camp billing".to_owned(),
        ));
    }

    let discount_percentage = body.discount_percentage.unwrap_or(Decimal::ZERO);
    let tax_percent = body.tax_percent.unwrap_or(Decimal::ZERO);
    let sponsor_covered_amount = body.sponsor_covered_amount.unwrap_or(Decimal::ZERO);
    let is_free = body.is_free.unwrap_or(false);
    if body.standard_amount < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "standard amount cannot be negative".to_owned(),
        ));
    }
    if body.charged_amount < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "charged amount cannot be negative".to_owned(),
        ));
    }
    if discount_percentage < Decimal::ZERO || discount_percentage > Decimal::from(100) {
        return Err(AppError::BadRequest(
            "discount percentage must be between 0 and 100".to_owned(),
        ));
    }
    if tax_percent < Decimal::ZERO || tax_percent > Decimal::from(100) {
        return Err(AppError::BadRequest(
            "tax percent must be between 0 and 100".to_owned(),
        ));
    }
    if sponsor_covered_amount < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "sponsor covered amount cannot be negative".to_owned(),
        ));
    }
    if is_free && body.charged_amount != Decimal::ZERO {
        return Err(AppError::BadRequest(
            "free camp billing items must charge zero to the patient".to_owned(),
        ));
    }
    let max_charge =
        body.standard_amount - (body.standard_amount * discount_percentage / Decimal::from(100));
    if body.charged_amount > max_charge {
        return Err(AppError::BadRequest(
            "charged amount cannot exceed standard amount after concession".to_owned(),
        ));
    }
    if body.charged_amount + sponsor_covered_amount > max_charge {
        return Err(AppError::BadRequest(
            "patient charge plus sponsor coverage cannot exceed standard amount after concession"
                .to_owned(),
        ));
    }
    let tax_amount = (body.charged_amount * tax_percent / Decimal::from(100)).round_dp(2);
    let total_amount = (body.charged_amount + tax_amount).round_dp(2);
    let payment_mode = body
        .payment_mode
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if !is_free && total_amount > Decimal::ZERO && payment_mode.is_none() {
        return Err(AppError::BadRequest(
            "payment mode is required for paid camp billing items".to_owned(),
        ));
    }
    let payment_reference = body
        .payment_reference
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let source_module = body
        .source_module
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let row = sqlx::query_as::<_, CampBillingRecord>(
        "INSERT INTO camp_billing_records \
         (tenant_id, registration_id, service_description, standard_amount, \
          discount_percentage, charged_amount, tax_percent, tax_amount, total_amount, \
          sponsor_covered_amount, is_free, payment_mode, payment_reference, source_module, \
          source_entity_id, billed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, true), $12, $13, \
          $14, $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&service_description)
    .bind(body.standard_amount)
    .bind(discount_percentage)
    .bind(body.charged_amount)
    .bind(tax_percent)
    .bind(tax_amount)
    .bind(total_amount)
    .bind(sponsor_covered_amount)
    .bind(is_free)
    .bind(payment_mode)
    .bind(payment_reference)
    .bind(source_module)
    .bind(body.source_entity_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    mirror_camp_billing_to_common_billing_in_tx(
        &mut tx,
        &claims,
        &row,
        discount_percentage,
        tax_percent,
        payment_mode,
        payment_reference,
    )
    .await?;

    tx.commit().await?;
    Ok(Json(filter_camp_billing_amounts(row, &restricted_fields)))
}

async fn mirror_camp_billing_to_common_billing_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    row: &CampBillingRecord,
    discount_percentage: Decimal,
    tax_percent: Decimal,
    payment_mode: Option<&str>,
    payment_reference: Option<&str>,
) -> Result<(), AppError> {
    if !medbrains_server_services::billing::is_auto_billing_enabled(tx, &claims.tenant_id, "camp")
        .await?
    {
        return Ok(());
    }

    #[derive(sqlx::FromRow)]
    struct CampBillingRegistrationContext {
        patient_id: Option<Uuid>,
        camp_id: Uuid,
        camp_code: String,
        camp_name: String,
        registration_number: String,
    }

    let context = sqlx::query_as::<_, CampBillingRegistrationContext>(
        "SELECT r.patient_id, r.camp_id, c.camp_code, c.name AS camp_name, r.registration_number \
         FROM camp_registrations r \
         JOIN camps c ON c.id = r.camp_id AND c.tenant_id = r.tenant_id \
         WHERE r.id = $1 AND r.tenant_id = $2",
    )
    .bind(row.registration_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let Some(patient_id) = context.patient_id else {
        return Err(AppError::BadRequest(
            "Camp billing requires a linked central patient registration".to_owned(),
        ));
    };

    let charge_code = format!("CAMP-{}", context.camp_code);
    let description = format!(
        "{} · {} · {}",
        row.service_description, context.camp_name, context.registration_number
    );
    let charge = medbrains_server_services::billing::auto_charge(
        tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id,
            encounter_id: None,
            charge_code,
            source: "manual".to_owned(),
            source_id: row.id,
            quantity: 1,
            description_override: Some(description),
            unit_price_override: Some(row.charged_amount),
            tax_percent_override: Some(tax_percent),
        },
    )
    .await?;

    sqlx::query(
        "UPDATE invoice_items \
         SET source_module = 'camp' \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(charge.item_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;

    let concession_amount = (row.standard_amount - row.charged_amount).round_dp(2);
    if !charge.skipped_duplicate && concession_amount > Decimal::ZERO {
        sqlx::query(
            "INSERT INTO billing_concessions \
             (tenant_id, invoice_id, invoice_item_id, patient_id, concession_type, \
              original_amount, concession_percent, concession_amount, final_amount, \
              reason, status, requested_by, approved_by, approved_at, auto_rule, \
              source_module, source_entity_id) \
             VALUES ($1, $2, $3, $4, 'camp_coverage', \
                     $5, $6, $7, $8, \
                     $9, 'auto_applied'::concession_status, $10, $10, now(), 'camp_plan', \
                     'camp', $11)",
        )
        .bind(claims.tenant_id)
        .bind(charge.invoice_id)
        .bind(charge.item_id)
        .bind(patient_id)
        .bind(row.standard_amount)
        .bind(discount_percentage)
        .bind(concession_amount)
        .bind(row.charged_amount)
        .bind(format!("Camp coverage: {}", context.camp_name))
        .bind(claims.sub)
        .bind(row.id)
        .execute(&mut **tx)
        .await?;
    }

    if !charge.skipped_duplicate && row.total_amount > Decimal::ZERO {
        let mode = payment_mode.ok_or_else(|| {
            AppError::BadRequest("payment mode is required for paid camp billing".to_owned())
        })?;
        sqlx::query(
            "INSERT INTO payments \
             (tenant_id, invoice_id, amount, mode, reference_number, received_by, notes, paid_at) \
             VALUES ($1, $2, $3, $4::payment_mode, $5, $6, $7, now())",
        )
        .bind(claims.tenant_id)
        .bind(charge.invoice_id)
        .bind(row.total_amount)
        .bind(mode)
        .bind(payment_reference)
        .bind(claims.sub)
        .bind(format!(
            "Camp collection for {}",
            context.registration_number
        ))
        .execute(&mut **tx)
        .await?;
    }

    sqlx::query(
        "UPDATE invoices \
         SET paid_amount = COALESCE(( \
               SELECT SUM(amount) FROM payments \
               WHERE invoice_id = $1 AND tenant_id = $2 \
             ), 0), \
             status = CASE \
               WHEN total_amount <= COALESCE(( \
                 SELECT SUM(amount) FROM payments \
                 WHERE invoice_id = $1 AND tenant_id = $2 \
               ), 0) THEN 'paid'::invoice_status \
               WHEN COALESCE(( \
                 SELECT SUM(amount) FROM payments \
                 WHERE invoice_id = $1 AND tenant_id = $2 \
               ), 0) > 0 THEN 'partially_paid'::invoice_status \
               ELSE 'issued'::invoice_status \
             END, \
             notes = COALESCE(notes, '') || ' | Camp: ' || $3, \
             updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(charge.invoice_id)
    .bind(claims.tenant_id)
    .bind(context.camp_id.to_string())
    .execute(&mut **tx)
    .await?;

    Ok(())
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
         WHERE f.tenant_id = $4 AND r.tenant_id = $4 \
         AND ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR f.registration_id = $2) \
         AND ($3::text IS NULL OR f.status::text = $3) \
         ORDER BY f.followup_date DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .bind(&params.status)
    .bind(claims.tenant_id)
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
    require_permission(&claims, permissions::camp::followups::SCHEDULE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampFollowup>(
        "INSERT INTO camp_followups \
         (tenant_id, registration_id, followup_date, followup_type, notes, followed_up_by) \
         SELECT $1, r.id, $3, $4, $5, $6 \
         FROM camp_registrations r \
         WHERE r.id = $2 AND r.tenant_id = $1 \
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
    let records_outcome = body.status.is_some() || body.notes.is_some() || body.outcome.is_some();
    let records_conversion = body.converted_to_patient.is_some()
        || body.converted_patient_id.is_some()
        || body.converted_department_id.is_some();

    if records_outcome {
        require_permission(&claims, permissions::camp::followups::OUTCOME)?;
    }
    if records_conversion {
        require_permission(&claims, permissions::camp::followups::CONVERT)?;
    }
    if !records_outcome && !records_conversion {
        return Err(AppError::BadRequest(
            "follow-up update must include outcome or conversion fields".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampFollowup>(
        "UPDATE camp_followups SET \
         status = CASE \
           WHEN $5 = true AND $2::camp_followup_status IS NULL \
             THEN 'completed'::camp_followup_status \
           ELSE COALESCE($2::camp_followup_status, status) \
         END, \
         notes = COALESCE($3, notes), \
         outcome = COALESCE($4, outcome), \
         converted_to_patient = COALESCE($5, converted_to_patient), \
         converted_patient_id = COALESCE($6, converted_patient_id), \
         converted_department_id = COALESCE($7, converted_department_id) \
         WHERE id = $1 AND tenant_id = $8 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(&body.outcome)
    .bind(body.converted_to_patient)
    .bind(body.converted_patient_id)
    .bind(body.converted_department_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // If converted, also update the registration status
    if body.converted_to_patient == Some(true) {
        sqlx::query(
            "UPDATE camp_registrations SET status = 'converted' \
             WHERE tenant_id = $2 \
             AND id = (SELECT registration_id FROM camp_followups WHERE id = $1 AND tenant_id = $2)",
        )
        .bind(id)
        .bind(claims.tenant_id)
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
) -> Result<Json<Value>, AppError> {
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
         ORDER BY created_at LIMIT 5000",
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

/// Medical camp management (camps, registrations, screening, referrals, follow-up) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/camp/camps", get(list_camps).post(create_camp))
        .route("/api/camp/camps/{id}", get(get_camp).put(update_camp))
        .route("/api/camp/camps/{id}/packet", get(get_camp_packet))
        .route(
            "/api/camp/camps/{id}/planning-summary",
            get(get_camp_planning_summary),
        )
        .route("/api/camp/sync/inbound", post(sync_camp_inbound))
        .route("/api/camp/lookups/staff", get(list_staff_options))
        .route("/api/camp/lookups/medicines", get(list_medicine_options))
        .route(
            "/api/camp/camps/{camp_id}/remote-operations",
            get(get_remote_operations),
        )
        .route(
            "/api/camp/camps/{camp_id}/remote-setup",
            put(upsert_remote_setup),
        )
        .route(
            "/api/camp/remote-checklist/{id}",
            put(update_remote_checklist_item),
        )
        .route(
            "/api/camp/camps/{camp_id}/supplies",
            post(create_supply_item),
        )
        .route(
            "/api/camp/camps/{camp_id}/supplies/bulk",
            post(bulk_create_supply_items),
        )
        .route("/api/camp/supplies/{id}", put(update_supply_item))
        .route(
            "/api/camp/camps/{camp_id}/referrals",
            get(list_camp_referrals).post(create_camp_referral),
        )
        .route("/api/camp/referrals/{id}", put(update_camp_referral))
        .route(
            "/api/camp/camps/{camp_id}/incidents",
            post(create_camp_incident),
        )
        .route("/api/camp/incidents/{id}", put(update_camp_incident))
        .route("/api/camp/camps/{id}/approve", put(approve_camp))
        .route("/api/camp/camps/{id}/activate", put(activate_camp))
        .route("/api/camp/camps/{id}/complete", put(complete_camp))
        .route("/api/camp/camps/{id}/cancel", put(cancel_camp))
        .route(
            "/api/camp/camps/{camp_id}/team",
            get(list_team_members).post(add_team_member),
        )
        .route(
            "/api/camp/camps/{camp_id}/team/{id}",
            delete(remove_team_member),
        )
        .route(
            "/api/camp/registrations",
            get(list_registrations).post(create_registration),
        )
        .route("/api/camp/registrations/{id}", put(update_registration))
        .route(
            "/api/camp/registrations/{id}/open-encounter",
            post(open_registration_encounter),
        )
        .route(
            "/api/camp/screenings",
            get(list_screenings).post(create_screening),
        )
        .route(
            "/api/camp/lab-samples",
            get(list_lab_samples).post(create_lab_sample),
        )
        .route("/api/camp/lab-samples/{id}/link", put(link_lab_sample))
        .route("/api/camp/billing", get(list_billing).post(create_billing))
        .route(
            "/api/camp/followups",
            get(list_followups).post(create_followup),
        )
        .route("/api/camp/followups/{id}", put(update_followup))
        .route("/api/camp/camps/{id}/stats", get(camp_stats))
        .route("/api/camp/analytics", get(camp_analytics))
        .route("/api/camp/camps/{id}/report", get(camp_report))
}

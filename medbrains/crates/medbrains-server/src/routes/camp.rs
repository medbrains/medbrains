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
    pub chief_complaint: Option<String>,
    pub is_walk_in: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegistrationRequest {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub chief_complaint: Option<String>,
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

async fn apply_camp_sync_event(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    camp_id: Uuid,
    event: &CampSyncInboundEvent,
) -> Result<AppliedSyncEvent, AppError> {
    match event.event_type.as_str() {
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
            .bind(body.person_name)
            .bind(body.age)
            .bind(body.gender)
            .bind(body.phone)
            .bind(body.address)
            .bind(body.id_proof_type)
            .bind(body.id_proof_number)
            .bind(body.patient_id)
            .bind(body.chief_complaint)
            .bind(body.is_walk_in)
            .bind(claims.sub)
            .fetch_one(&mut **tx)
            .await?;

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_registration".to_owned(),
                server_entity_id: server_id,
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
            .bind(body.findings)
            .bind(body.diagnosis)
            .bind(body.advice)
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

            Ok(AppliedSyncEvent {
                server_entity_type: "camp_screening".to_owned(),
                server_entity_id: server_id,
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
            })
        }
        "camp.supply.update" => {
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
                results.push(CampSyncEventResult {
                    idempotency_key: event.idempotency_key.clone(),
                    event_type: event.event_type.clone(),
                    status: "applied".to_owned(),
                    server_entity_type: Some(applied_event.server_entity_type),
                    server_entity_id: Some(applied_event.server_entity_id),
                    message: None,
                });
                tx.commit().await?;
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
          address, id_proof_type, id_proof_number, patient_id, chief_complaint, \
          is_walk_in, registered_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
                 $8, $9, $10, $11, $12, \
                 COALESCE($13, true), $14) \
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
         chief_complaint = COALESCE($4, chief_complaint) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(body.patient_id)
    .bind(&body.chief_complaint)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
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
        "UPDATE camp_registrations SET status = 'screened' \
         WHERE id = $1 AND status = 'registered'",
    )
    .bind(body.registration_id)
    .execute(&mut *tx)
    .await?;

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

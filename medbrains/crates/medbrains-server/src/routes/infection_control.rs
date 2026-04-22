#![allow(clippy::too_many_lines)]

use axum::{Extension, Json, extract::{Path, Query, State}};
use chrono::NaiveDate;
use medbrains_core::infection_control::{
    AntibioticConsumptionRecord, AntibioticStewardshipRequest,
    BiowasteRecord, CultureSurveillance, HandHygieneAudit, InfectionDeviceDay,
    InfectionSurveillanceEvent, NeedleStickIncident, OutbreakContact,
    OutbreakEvent, OutbreakStatus, WasteCategory, HaiType, InfectionStatus,
    AntibioticRequestStatus,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListSurveillanceQuery {
    pub hai_type: Option<String>,
    pub infection_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSurveillanceEventRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub hai_type: HaiType,
    pub infection_status: Option<InfectionStatus>,
    pub organism: Option<String>,
    pub susceptibility_pattern: Option<Value>,
    pub device_type: Option<String>,
    pub insertion_date: Option<String>,
    pub infection_date: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub nhsn_criteria: Option<String>,
    pub contributing_factors: Option<Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListDeviceDaysQuery {
    pub location_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct RecordDeviceDaysRequest {
    pub location_id: Uuid,
    pub department_id: Option<Uuid>,
    pub record_date: String,
    pub patient_days: i32,
    pub central_line_days: i32,
    pub urinary_catheter_days: i32,
    pub ventilator_days: i32,
}

#[derive(Debug, Deserialize)]
pub struct ListStewardshipQuery {
    pub request_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStewardshipRequestBody {
    pub patient_id: Uuid,
    pub antibiotic_name: String,
    pub dose: Option<String>,
    pub route: Option<String>,
    pub frequency: Option<String>,
    pub duration_days: Option<i32>,
    pub indication: String,
    pub culture_sent: Option<bool>,
    pub culture_result: Option<String>,
    pub escalation_reason: Option<String>,
    pub auto_stop_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewStewardshipRequestBody {
    pub request_status: AntibioticRequestStatus,
    pub review_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListConsumptionQuery {
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConsumptionRecordRequest {
    pub department_id: Option<Uuid>,
    pub antibiotic_name: String,
    pub atc_code: Option<String>,
    pub record_month: String,
    pub quantity_used: Decimal,
    pub ddd: Option<Decimal>,
    pub patient_days: i32,
    pub ddd_per_1000_patient_days: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct ListBiowasteQuery {
    pub waste_category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBiowasteRecordRequest {
    pub department_id: Uuid,
    pub waste_category: WasteCategory,
    pub weight_kg: Decimal,
    pub record_date: String,
    pub container_count: Option<i32>,
    pub disposal_vendor: Option<String>,
    pub manifest_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListNeedleStickQuery {
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNeedleStickRequest {
    pub staff_id: Uuid,
    pub incident_date: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub device_type: String,
    pub procedure_during: Option<String>,
    pub body_part: Option<String>,
    pub depth: Option<String>,
    pub source_patient_id: Option<Uuid>,
    pub hiv_status: Option<String>,
    pub hbv_status: Option<String>,
    pub hcv_status: Option<String>,
    pub pep_initiated: Option<bool>,
    pub pep_details: Option<String>,
    pub follow_up_schedule: Option<Value>,
    pub outcome: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListHygieneQuery {
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHygieneAuditRequest {
    pub audit_date: String,
    pub location_id: Option<Uuid>,
    pub department_id: Uuid,
    pub observations: i32,
    pub compliant: i32,
    pub non_compliant: i32,
    pub moment_breakdown: Option<Value>,
    pub staff_category: Option<String>,
    pub findings: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListCultureQuery {
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCultureRequest {
    pub culture_type: String,
    pub sample_site: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub collection_date: String,
    pub result: Option<String>,
    pub organism: Option<String>,
    pub colony_count: Option<i32>,
    pub acceptable: Option<bool>,
    pub action_taken: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListOutbreaksQuery {
    pub outbreak_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOutbreakRequest {
    pub organism: String,
    pub outbreak_status: Option<OutbreakStatus>,
    pub detected_date: String,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub initial_cases: Option<i32>,
    pub total_cases: Option<i32>,
    pub description: Option<String>,
    pub control_measures: Option<Value>,
    pub hicc_notified: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOutbreakRequest {
    pub outbreak_status: Option<OutbreakStatus>,
    pub total_cases: Option<i32>,
    pub description: Option<String>,
    pub control_measures: Option<Value>,
    pub hicc_notified: Option<bool>,
    pub containment_date: Option<String>,
    pub closure_date: Option<String>,
    pub root_cause: Option<String>,
    pub lessons_learned: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOutbreakContactRequest {
    pub patient_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
    pub contact_type: String,
    pub exposure_date: Option<String>,
    pub screening_date: Option<String>,
    pub screening_result: Option<String>,
    pub quarantine_required: Option<bool>,
    pub quarantine_start: Option<String>,
    pub quarantine_end: Option<String>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════

fn parse_date(s: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest(format!("invalid date: {s}")))
}

// ══════════════════════════════════════════════════════════
//  1. HAI Surveillance handlers
// ══════════════════════════════════════════════════════════

pub async fn list_surveillance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListSurveillanceQuery>,
) -> Result<Json<Vec<InfectionSurveillanceEvent>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref hai) = params.hai_type {
        sqlx::query_as::<_, InfectionSurveillanceEvent>(
            "SELECT * FROM infection_surveillance_events \
             WHERE tenant_id = $1 AND hai_type = $2::hai_type \
             ORDER BY infection_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(hai)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(ref status) = params.infection_status {
        sqlx::query_as::<_, InfectionSurveillanceEvent>(
            "SELECT * FROM infection_surveillance_events \
             WHERE tenant_id = $1 AND infection_status = $2::infection_status \
             ORDER BY infection_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, InfectionSurveillanceEvent>(
            "SELECT * FROM infection_surveillance_events \
             WHERE tenant_id = $1 \
             ORDER BY infection_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_surveillance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSurveillanceEventRequest>,
) -> Result<Json<InfectionSurveillanceEvent>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status_str = body.infection_status.and_then(|s| {
        serde_json::to_value(s).ok().and_then(|v| v.as_str().map(String::from))
    });

    let row = sqlx::query_as::<_, InfectionSurveillanceEvent>(
        "INSERT INTO infection_surveillance_events \
         (tenant_id, patient_id, admission_id, hai_type, \
          infection_status, organism, susceptibility_pattern, device_type, \
          insertion_date, infection_date, location_id, department_id, \
          nhsn_criteria, contributing_factors, notes, reported_by) \
         VALUES ($1,$2,$3,$4::hai_type, \
                 COALESCE($5::infection_status,'suspected'::infection_status), \
                 $6,$7,$8,$9::timestamptz,$10::timestamptz,$11,$12,$13,$14,$15,$16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(serde_json::to_value(body.hai_type).ok().and_then(|v| v.as_str().map(String::from)))
    .bind(status_str)
    .bind(&body.organism)
    .bind(&body.susceptibility_pattern)
    .bind(&body.device_type)
    .bind(&body.insertion_date)
    .bind(&body.infection_date)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.nhsn_criteria)
    .bind(&body.contributing_factors)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Device Days ──────────────────────────────────────────

pub async fn list_device_days(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDeviceDaysQuery>,
) -> Result<Json<Vec<InfectionDeviceDay>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(loc) = params.location_id {
        sqlx::query_as::<_, InfectionDeviceDay>(
            "SELECT * FROM infection_device_days \
             WHERE tenant_id = $1 AND location_id = $2 \
             ORDER BY record_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(loc)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, InfectionDeviceDay>(
            "SELECT * FROM infection_device_days \
             WHERE tenant_id = $1 \
             ORDER BY record_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn record_device_days(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RecordDeviceDaysRequest>,
) -> Result<Json<InfectionDeviceDay>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::CREATE)?;

    let record_date = parse_date(&body.record_date)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InfectionDeviceDay>(
        "INSERT INTO infection_device_days \
         (tenant_id, location_id, department_id, record_date, \
          patient_days, central_line_days, urinary_catheter_days, \
          ventilator_days, recorded_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) \
         ON CONFLICT (tenant_id, location_id, record_date) DO UPDATE SET \
           patient_days = EXCLUDED.patient_days, \
           central_line_days = EXCLUDED.central_line_days, \
           urinary_catheter_days = EXCLUDED.urinary_catheter_days, \
           ventilator_days = EXCLUDED.ventilator_days \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(record_date)
    .bind(body.patient_days)
    .bind(body.central_line_days)
    .bind(body.urinary_catheter_days)
    .bind(body.ventilator_days)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  2. Antibiotic Stewardship handlers
// ══════════════════════════════════════════════════════════

pub async fn list_stewardship(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListStewardshipQuery>,
) -> Result<Json<Vec<AntibioticStewardshipRequest>>, AppError> {
    require_permission(&claims, permissions::infection_control::stewardship::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.request_status {
        sqlx::query_as::<_, AntibioticStewardshipRequest>(
            "SELECT * FROM antibiotic_stewardship_requests \
             WHERE tenant_id = $1 AND request_status = $2::antibiotic_request_status \
             ORDER BY requested_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, AntibioticStewardshipRequest>(
            "SELECT * FROM antibiotic_stewardship_requests \
             WHERE tenant_id = $1 \
             ORDER BY requested_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_stewardship(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStewardshipRequestBody>,
) -> Result<Json<AntibioticStewardshipRequest>, AppError> {
    require_permission(&claims, permissions::infection_control::stewardship::CREATE)?;

    let auto_stop = body.auto_stop_date.as_deref().map(parse_date).transpose()?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AntibioticStewardshipRequest>(
        "INSERT INTO antibiotic_stewardship_requests \
         (tenant_id, patient_id, antibiotic_name, dose, route, frequency, \
          duration_days, indication, culture_sent, culture_result, \
          escalation_reason, auto_stop_date, requested_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,false),$10,$11,$12,$13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.antibiotic_name)
    .bind(&body.dose)
    .bind(&body.route)
    .bind(&body.frequency)
    .bind(body.duration_days)
    .bind(&body.indication)
    .bind(body.culture_sent)
    .bind(&body.culture_result)
    .bind(&body.escalation_reason)
    .bind(auto_stop)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn review_stewardship(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewStewardshipRequestBody>,
) -> Result<Json<AntibioticStewardshipRequest>, AppError> {
    require_permission(&claims, permissions::infection_control::stewardship::CREATE)?;

    let status_str = serde_json::to_value(body.request_status)
        .ok()
        .and_then(|v| v.as_str().map(String::from));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AntibioticStewardshipRequest>(
        "UPDATE antibiotic_stewardship_requests SET \
         request_status = COALESCE($3::antibiotic_request_status, request_status), \
         review_notes = COALESCE($4, review_notes), \
         reviewed_by = $5, reviewed_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(status_str)
    .bind(&body.review_notes)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Consumption ──────────────────────────────────────────

pub async fn list_consumption(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListConsumptionQuery>,
) -> Result<Json<Vec<AntibioticConsumptionRecord>>, AppError> {
    require_permission(&claims, permissions::infection_control::stewardship::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept) = params.department_id {
        sqlx::query_as::<_, AntibioticConsumptionRecord>(
            "SELECT * FROM antibiotic_consumption_records \
             WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY record_month DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(dept)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, AntibioticConsumptionRecord>(
            "SELECT * FROM antibiotic_consumption_records \
             WHERE tenant_id = $1 \
             ORDER BY record_month DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn record_consumption(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConsumptionRecordRequest>,
) -> Result<Json<AntibioticConsumptionRecord>, AppError> {
    require_permission(&claims, permissions::infection_control::stewardship::CREATE)?;

    let record_month = parse_date(&body.record_month)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AntibioticConsumptionRecord>(
        "INSERT INTO antibiotic_consumption_records \
         (tenant_id, department_id, antibiotic_name, atc_code, record_month, \
          quantity_used, ddd, patient_days, ddd_per_1000_patient_days) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) \
         ON CONFLICT (tenant_id, department_id, antibiotic_name, record_month) DO UPDATE SET \
           quantity_used = EXCLUDED.quantity_used, \
           ddd = EXCLUDED.ddd, \
           patient_days = EXCLUDED.patient_days, \
           ddd_per_1000_patient_days = EXCLUDED.ddd_per_1000_patient_days \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(&body.antibiotic_name)
    .bind(&body.atc_code)
    .bind(record_month)
    .bind(body.quantity_used)
    .bind(body.ddd)
    .bind(body.patient_days)
    .bind(body.ddd_per_1000_patient_days)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  3. Bio-waste handlers
// ══════════════════════════════════════════════════════════

pub async fn list_biowaste(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBiowasteQuery>,
) -> Result<Json<Vec<BiowasteRecord>>, AppError> {
    require_permission(&claims, permissions::infection_control::biowaste::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref cat) = params.waste_category {
        sqlx::query_as::<_, BiowasteRecord>(
            "SELECT * FROM biowaste_records \
             WHERE tenant_id = $1 AND waste_category = $2::waste_category \
             ORDER BY record_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(cat)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BiowasteRecord>(
            "SELECT * FROM biowaste_records \
             WHERE tenant_id = $1 \
             ORDER BY record_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_biowaste(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBiowasteRecordRequest>,
) -> Result<Json<BiowasteRecord>, AppError> {
    require_permission(&claims, permissions::infection_control::biowaste::CREATE)?;

    let record_date = parse_date(&body.record_date)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BiowasteRecord>(
        "INSERT INTO biowaste_records \
         (tenant_id, department_id, waste_category, weight_kg, record_date, \
          container_count, disposal_vendor, manifest_number, notes, recorded_by) \
         VALUES ($1,$2,$3::waste_category,$4,$5,COALESCE($6,1),$7,$8,$9,$10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(serde_json::to_value(body.waste_category).ok().and_then(|v| v.as_str().map(String::from)))
    .bind(body.weight_kg)
    .bind(record_date)
    .bind(body.container_count)
    .bind(&body.disposal_vendor)
    .bind(&body.manifest_number)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Needle-stick ─────────────────────────────────────────

pub async fn list_needle_stick(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListNeedleStickQuery>,
) -> Result<Json<Vec<NeedleStickIncident>>, AppError> {
    require_permission(&claims, permissions::infection_control::biowaste::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept) = params.department_id {
        sqlx::query_as::<_, NeedleStickIncident>(
            "SELECT * FROM needle_stick_incidents \
             WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY incident_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(dept)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, NeedleStickIncident>(
            "SELECT * FROM needle_stick_incidents \
             WHERE tenant_id = $1 \
             ORDER BY incident_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_needle_stick(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateNeedleStickRequest>,
) -> Result<Json<NeedleStickIncident>, AppError> {
    require_permission(&claims, permissions::infection_control::biowaste::CREATE)?;

    let incident_number = format!("NSI-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, NeedleStickIncident>(
        "INSERT INTO needle_stick_incidents \
         (tenant_id, incident_number, staff_id, incident_date, location_id, \
          department_id, device_type, procedure_during, body_part, depth, \
          source_patient_id, hiv_status, hbv_status, hcv_status, \
          pep_initiated, pep_details, follow_up_schedule, outcome, reported_by) \
         VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, \
                 COALESCE($15,false),$16,$17,$18,$19) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&incident_number)
    .bind(body.staff_id)
    .bind(&body.incident_date)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.device_type)
    .bind(&body.procedure_during)
    .bind(&body.body_part)
    .bind(&body.depth)
    .bind(body.source_patient_id)
    .bind(&body.hiv_status)
    .bind(&body.hbv_status)
    .bind(&body.hcv_status)
    .bind(body.pep_initiated)
    .bind(&body.pep_details)
    .bind(&body.follow_up_schedule)
    .bind(&body.outcome)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  4. Hand Hygiene & Culture handlers
// ══════════════════════════════════════════════════════════

pub async fn list_hygiene_audits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListHygieneQuery>,
) -> Result<Json<Vec<HandHygieneAudit>>, AppError> {
    require_permission(&claims, permissions::infection_control::hygiene::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept) = params.department_id {
        sqlx::query_as::<_, HandHygieneAudit>(
            "SELECT * FROM hand_hygiene_audits \
             WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY audit_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(dept)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, HandHygieneAudit>(
            "SELECT * FROM hand_hygiene_audits \
             WHERE tenant_id = $1 \
             ORDER BY audit_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_hygiene_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateHygieneAuditRequest>,
) -> Result<Json<HandHygieneAudit>, AppError> {
    require_permission(&claims, permissions::infection_control::hygiene::CREATE)?;

    let compliance_rate = if body.observations > 0 {
        Some(Decimal::from(body.compliant * 100) / Decimal::from(body.observations))
    } else {
        None
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, HandHygieneAudit>(
        "INSERT INTO hand_hygiene_audits \
         (tenant_id, audit_date, location_id, department_id, auditor_id, \
          observations, compliant, non_compliant, compliance_rate, \
          moment_breakdown, staff_category, findings) \
         VALUES ($1,$2::timestamptz,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.audit_date)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(claims.sub)
    .bind(body.observations)
    .bind(body.compliant)
    .bind(body.non_compliant)
    .bind(compliance_rate)
    .bind(&body.moment_breakdown)
    .bind(&body.staff_category)
    .bind(&body.findings)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_cultures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCultureQuery>,
) -> Result<Json<Vec<CultureSurveillance>>, AppError> {
    require_permission(&claims, permissions::infection_control::hygiene::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(dept) = params.department_id {
        sqlx::query_as::<_, CultureSurveillance>(
            "SELECT * FROM culture_surveillance \
             WHERE tenant_id = $1 AND department_id = $2 \
             ORDER BY collection_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(dept)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, CultureSurveillance>(
            "SELECT * FROM culture_surveillance \
             WHERE tenant_id = $1 \
             ORDER BY collection_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_culture(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCultureRequest>,
) -> Result<Json<CultureSurveillance>, AppError> {
    require_permission(&claims, permissions::infection_control::hygiene::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CultureSurveillance>(
        "INSERT INTO culture_surveillance \
         (tenant_id, culture_type, sample_site, location_id, department_id, \
          collection_date, result, organism, colony_count, acceptable, \
          action_taken, collected_by) \
         VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,$10,$11,$12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.culture_type)
    .bind(&body.sample_site)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.collection_date)
    .bind(&body.result)
    .bind(&body.organism)
    .bind(body.colony_count)
    .bind(body.acceptable)
    .bind(&body.action_taken)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  5. Outbreak Management handlers
// ══════════════════════════════════════════════════════════

pub async fn list_outbreaks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOutbreaksQuery>,
) -> Result<Json<Vec<OutbreakEvent>>, AppError> {
    require_permission(&claims, permissions::infection_control::outbreak::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.outbreak_status {
        sqlx::query_as::<_, OutbreakEvent>(
            "SELECT * FROM outbreak_events \
             WHERE tenant_id = $1 AND outbreak_status = $2::outbreak_status \
             ORDER BY detected_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OutbreakEvent>(
            "SELECT * FROM outbreak_events \
             WHERE tenant_id = $1 \
             ORDER BY detected_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_outbreak(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOutbreakRequest>,
) -> Result<Json<OutbreakEvent>, AppError> {
    require_permission(&claims, permissions::infection_control::outbreak::CREATE)?;

    let status_str = body.outbreak_status.and_then(|s| {
        serde_json::to_value(s).ok().and_then(|v| v.as_str().map(String::from))
    });

    let outbreak_number = format!("OB-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OutbreakEvent>(
        "INSERT INTO outbreak_events \
         (tenant_id, outbreak_number, organism, outbreak_status, \
          detected_date, location_id, department_id, initial_cases, \
          total_cases, description, control_measures, hicc_notified, \
          reported_by) \
         VALUES ($1,$2,$3,COALESCE($4::outbreak_status,'suspected'::outbreak_status), \
                 $5::timestamptz,$6,$7,COALESCE($8,1),COALESCE($9,1), \
                 $10,$11,COALESCE($12,false),$13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&outbreak_number)
    .bind(&body.organism)
    .bind(status_str)
    .bind(&body.detected_date)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(body.initial_cases)
    .bind(body.total_cases)
    .bind(&body.description)
    .bind(&body.control_measures)
    .bind(body.hicc_notified)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_outbreak(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOutbreakRequest>,
) -> Result<Json<OutbreakEvent>, AppError> {
    require_permission(&claims, permissions::infection_control::outbreak::UPDATE)?;

    let status_str = body.outbreak_status.and_then(|s| {
        serde_json::to_value(s).ok().and_then(|v| v.as_str().map(String::from))
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OutbreakEvent>(
        "UPDATE outbreak_events SET \
         outbreak_status = COALESCE($3::outbreak_status, outbreak_status), \
         total_cases = COALESCE($4, total_cases), \
         description = COALESCE($5, description), \
         control_measures = COALESCE($6, control_measures), \
         hicc_notified = COALESCE($7, hicc_notified), \
         containment_date = COALESCE($8::timestamptz, containment_date), \
         closure_date = COALESCE($9::timestamptz, closure_date), \
         root_cause = COALESCE($10, root_cause), \
         lessons_learned = COALESCE($11, lessons_learned) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(status_str)
    .bind(body.total_cases)
    .bind(&body.description)
    .bind(&body.control_measures)
    .bind(body.hicc_notified)
    .bind(&body.containment_date)
    .bind(&body.closure_date)
    .bind(&body.root_cause)
    .bind(&body.lessons_learned)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_outbreak_contacts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(outbreak_id): Path<Uuid>,
) -> Result<Json<Vec<OutbreakContact>>, AppError> {
    require_permission(&claims, permissions::infection_control::outbreak::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OutbreakContact>(
        "SELECT * FROM outbreak_contacts \
         WHERE tenant_id = $1 AND outbreak_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(outbreak_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn add_outbreak_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(outbreak_id): Path<Uuid>,
    Json(body): Json<CreateOutbreakContactRequest>,
) -> Result<Json<OutbreakContact>, AppError> {
    require_permission(&claims, permissions::infection_control::outbreak::CREATE)?;

    let quarantine_start = body.quarantine_start.as_deref().map(parse_date).transpose()?;
    let quarantine_end = body.quarantine_end.as_deref().map(parse_date).transpose()?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OutbreakContact>(
        "INSERT INTO outbreak_contacts \
         (tenant_id, outbreak_id, patient_id, staff_id, contact_type, \
          exposure_date, screening_date, screening_result, \
          quarantine_required, quarantine_start, quarantine_end, notes) \
         VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8, \
                 COALESCE($9,false),$10,$11,$12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(outbreak_id)
    .bind(body.patient_id)
    .bind(body.staff_id)
    .bind(&body.contact_type)
    .bind(&body.exposure_date)
    .bind(&body.screening_date)
    .bind(&body.screening_result)
    .bind(body.quarantine_required)
    .bind(quarantine_start)
    .bind(quarantine_end)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  6. Analytics & Reporting handlers
// ══════════════════════════════════════════════════════════

// ── Request / Query types for analytics ──────────────────

#[derive(Debug, Deserialize)]
pub struct AnalyticsDateRangeQuery {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExposureRequest {
    pub patient_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
    pub exposure_type: String,
    pub exposure_date: String,
    pub source_description: Option<String>,
    pub location_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub organism: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListIcMeetingsQuery {
    pub committee_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIcMeetingRequest {
    pub committee_id: Uuid,
    pub scheduled_date: String,
    pub venue: Option<String>,
    pub agenda: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOutbreakRcaRequest {
    pub rca_method: Option<String>,
    pub root_causes: Option<Value>,
    pub contributing_factors: Option<Value>,
    pub corrective_actions: Option<Value>,
    pub preventive_actions: Option<Value>,
    pub rca_completed_by: Option<Uuid>,
    pub rca_notes: Option<String>,
}

// ── Response row types ───────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HaiRateRow {
    pub hai_type: String,
    pub event_count: i64,
    pub total_patient_days: Option<i64>,
    pub rate_per_1000: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeviceUtilizationRow {
    pub location_id: Uuid,
    pub total_patient_days: i64,
    pub total_central_line_days: i64,
    pub total_urinary_catheter_days: i64,
    pub total_ventilator_days: i64,
    pub central_line_ratio: Option<f64>,
    pub urinary_catheter_ratio: Option<f64>,
    pub ventilator_ratio: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AntimicrobialConsumptionRow {
    pub antibiotic_name: String,
    pub atc_code: Option<String>,
    pub total_ddd: Option<Decimal>,
    pub total_patient_days: i64,
    pub avg_ddd_per_1000: Option<Decimal>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SurgicalProphylaxisRow {
    pub department_id: Option<Uuid>,
    pub total_ssi_events: i64,
    pub total_surgical_admissions: i64,
    pub ssi_rate: Option<f64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CultureSensitivityRow {
    pub organism: Option<String>,
    pub culture_type: String,
    pub total_samples: i64,
    pub positive_count: i64,
    pub acceptable_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MdroTrackingRow {
    pub organism: Option<String>,
    pub sample_count: i64,
    pub earliest_detection: Option<chrono::DateTime<chrono::Utc>>,
    pub latest_detection: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IcMeetingRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub committee_id: Uuid,
    pub scheduled_date: chrono::DateTime<chrono::Utc>,
    pub venue: Option<String>,
    pub agenda: Option<Value>,
    pub actual_date: Option<chrono::DateTime<chrono::Utc>>,
    pub minutes: Option<String>,
    pub attendees: Option<Value>,
    pub decisions: Option<Value>,
    pub status: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ── 6a. HAI Rates ────────────────────────────────────────

pub async fn hai_rates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<HaiRateRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    let rows = sqlx::query_as::<_, HaiRateRow>(
        "WITH events AS ( \
           SELECT hai_type::text, COUNT(*) AS event_count \
           FROM infection_surveillance_events \
           WHERE tenant_id = $1 \
             AND ($2::date IS NULL OR infection_date >= $2::date) \
             AND ($3::date IS NULL OR infection_date <= $3::date) \
           GROUP BY hai_type \
         ), \
         pdays AS ( \
           SELECT COALESCE(SUM(patient_days), 0) AS total_patient_days \
           FROM infection_device_days \
           WHERE tenant_id = $1 \
             AND ($2::date IS NULL OR record_date >= $2::date) \
             AND ($3::date IS NULL OR record_date <= $3::date) \
         ) \
         SELECT e.hai_type, e.event_count, \
                p.total_patient_days, \
                CASE WHEN p.total_patient_days > 0 \
                  THEN (e.event_count::float8 / p.total_patient_days::float8) * 1000.0 \
                  ELSE NULL END AS rate_per_1000 \
         FROM events e, pdays p \
         ORDER BY e.event_count DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6b. Device Utilization ───────────────────────────────

pub async fn device_utilization(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<DeviceUtilizationRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    let rows = sqlx::query_as::<_, DeviceUtilizationRow>(
        "SELECT location_id, \
                SUM(patient_days)::bigint AS total_patient_days, \
                SUM(central_line_days)::bigint AS total_central_line_days, \
                SUM(urinary_catheter_days)::bigint AS total_urinary_catheter_days, \
                SUM(ventilator_days)::bigint AS total_ventilator_days, \
                CASE WHEN SUM(patient_days) > 0 \
                  THEN SUM(central_line_days)::float8 / SUM(patient_days)::float8 \
                  ELSE NULL END AS central_line_ratio, \
                CASE WHEN SUM(patient_days) > 0 \
                  THEN SUM(urinary_catheter_days)::float8 / SUM(patient_days)::float8 \
                  ELSE NULL END AS urinary_catheter_ratio, \
                CASE WHEN SUM(patient_days) > 0 \
                  THEN SUM(ventilator_days)::float8 / SUM(patient_days)::float8 \
                  ELSE NULL END AS ventilator_ratio \
         FROM infection_device_days \
         WHERE tenant_id = $1 \
           AND ($2::date IS NULL OR record_date >= $2::date) \
           AND ($3::date IS NULL OR record_date <= $3::date) \
         GROUP BY location_id \
         ORDER BY total_patient_days DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6c. Antimicrobial Consumption (DDD/1000 patient-days) ─

pub async fn antimicrobial_consumption(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<AntimicrobialConsumptionRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::stewardship::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    let rows = sqlx::query_as::<_, AntimicrobialConsumptionRow>(
        "SELECT antibiotic_name, \
                MAX(atc_code) AS atc_code, \
                SUM(ddd) AS total_ddd, \
                SUM(patient_days)::bigint AS total_patient_days, \
                CASE WHEN SUM(patient_days) > 0 \
                  THEN (SUM(ddd) / SUM(patient_days)) * 1000 \
                  ELSE NULL END AS avg_ddd_per_1000 \
         FROM antibiotic_consumption_records \
         WHERE tenant_id = $1 \
           AND ($2::date IS NULL OR record_month >= $2::date) \
           AND ($3::date IS NULL OR record_month <= $3::date) \
           AND ($4::uuid IS NULL OR department_id = $4) \
         GROUP BY antibiotic_name \
         ORDER BY total_ddd DESC NULLS LAST \
         LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6d. Surgical Prophylaxis Compliance ──────────────────

pub async fn surgical_prophylaxis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<SurgicalProphylaxisRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    let rows = sqlx::query_as::<_, SurgicalProphylaxisRow>(
        "WITH ssi AS ( \
           SELECT department_id, COUNT(*) AS total_ssi_events \
           FROM infection_surveillance_events \
           WHERE tenant_id = $1 AND hai_type = 'ssi' \
             AND ($2::date IS NULL OR infection_date >= $2::date) \
             AND ($3::date IS NULL OR infection_date <= $3::date) \
           GROUP BY department_id \
         ), \
         admissions AS ( \
           SELECT department_id, COUNT(*) AS total_surgical_admissions \
           FROM ip_admissions \
           WHERE tenant_id = $1 AND admission_type = 'surgical' \
             AND ($2::date IS NULL OR admitted_at >= $2::timestamptz) \
             AND ($3::date IS NULL OR admitted_at <= $3::timestamptz) \
           GROUP BY department_id \
         ) \
         SELECT COALESCE(s.department_id, a.department_id) AS department_id, \
                COALESCE(s.total_ssi_events, 0) AS total_ssi_events, \
                COALESCE(a.total_surgical_admissions, 0) AS total_surgical_admissions, \
                CASE WHEN COALESCE(a.total_surgical_admissions, 0) > 0 \
                  THEN (COALESCE(s.total_ssi_events, 0)::float8 / a.total_surgical_admissions::float8) * 100.0 \
                  ELSE NULL END AS ssi_rate \
         FROM ssi s FULL OUTER JOIN admissions a ON s.department_id = a.department_id \
         ORDER BY total_ssi_events DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6e. Culture & Sensitivity Report ─────────────────────

pub async fn culture_sensitivity_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<CultureSensitivityRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::hygiene::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    let rows = sqlx::query_as::<_, CultureSensitivityRow>(
        "SELECT organism, culture_type, \
                COUNT(*) AS total_samples, \
                COUNT(*) FILTER (WHERE result = 'positive') AS positive_count, \
                COUNT(*) FILTER (WHERE acceptable = true) AS acceptable_count \
         FROM culture_surveillance \
         WHERE tenant_id = $1 \
           AND ($2::date IS NULL OR collection_date >= $2::timestamptz) \
           AND ($3::date IS NULL OR collection_date <= $3::timestamptz) \
           AND ($4::uuid IS NULL OR department_id = $4) \
         GROUP BY organism, culture_type \
         ORDER BY total_samples DESC \
         LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6f. MDRO Tracking ───────────────────────────────────

pub async fn mdro_tracking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Vec<MdroTrackingRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    let rows = sqlx::query_as::<_, MdroTrackingRow>(
        "SELECT organism, \
                COUNT(*) AS sample_count, \
                MIN(collection_date) AS earliest_detection, \
                MAX(collection_date) AS latest_detection \
         FROM culture_surveillance \
         WHERE tenant_id = $1 \
           AND ($2::date IS NULL OR collection_date >= $2::timestamptz) \
           AND ($3::date IS NULL OR collection_date <= $3::timestamptz) \
           AND (UPPER(organism) LIKE '%MRSA%' \
                OR UPPER(organism) LIKE '%VRE%' \
                OR UPPER(organism) LIKE '%ESBL%' \
                OR UPPER(organism) LIKE '%CRE%' \
                OR UPPER(organism) LIKE '%MDRO%' \
                OR UPPER(organism) LIKE '%MDR%') \
         GROUP BY organism \
         ORDER BY sample_count DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── 6g. Create Exposure Event ────────────────────────────

pub async fn create_exposure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateExposureRequest>,
) -> Result<Json<InfectionSurveillanceEvent>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InfectionSurveillanceEvent>(
        "INSERT INTO infection_surveillance_events \
         (tenant_id, patient_id, hai_type, infection_status, \
          organism, device_type, infection_date, \
          location_id, department_id, nhsn_criteria, notes, reported_by) \
         VALUES ($1, $2, 'other'::hai_type, 'suspected'::infection_status, \
                 $3, $4, $5::timestamptz, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.organism)
    .bind(&body.exposure_type)
    .bind(&body.exposure_date)
    .bind(body.location_id)
    .bind(body.department_id)
    .bind(&body.source_description)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── 6h. IC Committee Meetings ────────────────────────────

pub async fn list_ic_meetings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListIcMeetingsQuery>,
) -> Result<Json<Vec<IcMeetingRow>>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref ctype) = params.committee_type {
        sqlx::query_as::<_, IcMeetingRow>(
            "SELECT m.* FROM quality_committee_meetings m \
             JOIN quality_committees c ON c.id = m.committee_id AND c.tenant_id = m.tenant_id \
             WHERE m.tenant_id = $1 AND c.committee_type = $2 \
             ORDER BY m.scheduled_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .bind(ctype)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, IcMeetingRow>(
            "SELECT m.* FROM quality_committee_meetings m \
             JOIN quality_committees c ON c.id = m.committee_id AND c.tenant_id = m.tenant_id \
             WHERE m.tenant_id = $1 \
             AND (c.committee_type = 'infection_control' \
                  OR LOWER(c.name) LIKE '%infection%' \
                  OR LOWER(c.name) LIKE '%hicc%') \
             ORDER BY m.scheduled_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_ic_meeting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIcMeetingRequest>,
) -> Result<Json<IcMeetingRow>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::CREATE)?;

    let scheduled_date = chrono::DateTime::parse_from_rfc3339(&body.scheduled_date)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .or_else(|_| {
            NaiveDate::parse_from_str(&body.scheduled_date, "%Y-%m-%d")
                .map(|d| {
                    d.and_hms_opt(0, 0, 0).map_or_else(chrono::Utc::now, |ndt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc))
                })
        })
        .map_err(|_| AppError::BadRequest("Invalid scheduled_date format".into()))?;

    let agenda = body.agenda.clone().unwrap_or(serde_json::json!([]));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IcMeetingRow>(
        "INSERT INTO quality_committee_meetings \
         (tenant_id, committee_id, scheduled_date, venue, agenda) \
         VALUES ($1,$2,$3,$4,$5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.committee_id)
    .bind(scheduled_date)
    .bind(&body.venue)
    .bind(&agenda)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── 6i. Monthly Surveillance Report ──────────────────────

pub async fn monthly_surveillance_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateRangeQuery>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::infection_control::surveillance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from_date.as_deref().map(parse_date).transpose()?;
    let to = params.to_date.as_deref().map(parse_date).transpose()?;

    // HAI event counts
    let hai_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM infection_surveillance_events \
         WHERE tenant_id = $1 \
         AND ($2::date IS NULL OR infection_date >= $2::timestamptz) \
         AND ($3::date IS NULL OR infection_date <= $3::timestamptz)",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    // Hand hygiene compliance average
    let hygiene_compliance: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(compliance_rate)::float8 FROM hand_hygiene_audits \
         WHERE tenant_id = $1 \
         AND ($2::date IS NULL OR audit_date >= $2::timestamptz) \
         AND ($3::date IS NULL OR audit_date <= $3::timestamptz)",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    // Bio-waste total kg
    let biowaste_kg: Option<Decimal> = sqlx::query_scalar(
        "SELECT SUM(weight_kg) FROM biowaste_records \
         WHERE tenant_id = $1 \
         AND ($2::date IS NULL OR record_date >= $2::date) \
         AND ($3::date IS NULL OR record_date <= $3::date)",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    // Culture surveillance count
    let culture_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM culture_surveillance \
         WHERE tenant_id = $1 \
         AND ($2::date IS NULL OR collection_date >= $2::timestamptz) \
         AND ($3::date IS NULL OR collection_date <= $3::timestamptz)",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    // Active outbreaks
    let active_outbreaks: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM outbreak_events \
         WHERE tenant_id = $1 \
         AND outbreak_status IN ('suspected', 'confirmed')",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    // Needle-stick incidents count
    let needle_stick_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM needle_stick_incidents \
         WHERE tenant_id = $1 \
         AND ($2::date IS NULL OR incident_date >= $2::timestamptz) \
         AND ($3::date IS NULL OR incident_date <= $3::timestamptz)",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "period": {
            "from": from,
            "to": to,
        },
        "hai_events": hai_count,
        "hand_hygiene_compliance_avg": hygiene_compliance,
        "biowaste_total_kg": biowaste_kg,
        "culture_samples": culture_count,
        "active_outbreaks": active_outbreaks,
        "needle_stick_incidents": needle_stick_count,
    })))
}

// ── 6j. Create Outbreak RCA ─────────────────────────────

pub async fn create_outbreak_rca(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateOutbreakRcaRequest>,
) -> Result<Json<OutbreakEvent>, AppError> {
    require_permission(&claims, permissions::infection_control::outbreak::UPDATE)?;

    let rca_data = serde_json::json!({
        "rca_method": body.rca_method,
        "root_causes": body.root_causes,
        "contributing_factors": body.contributing_factors,
        "corrective_actions": body.corrective_actions,
        "preventive_actions": body.preventive_actions,
        "completed_by": body.rca_completed_by,
        "completed_at": chrono::Utc::now().to_rfc3339(),
        "notes": body.rca_notes,
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OutbreakEvent>(
        "UPDATE outbreak_events SET \
         root_cause = COALESCE($3, root_cause), \
         lessons_learned = COALESCE($4, lessons_learned), \
         control_measures = COALESCE(control_measures, '{}') || $5::jsonb \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.rca_notes)
    .bind(body.rca_method.as_deref())
    .bind(&rca_data)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

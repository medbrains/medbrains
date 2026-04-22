#![allow(clippy::too_many_lines)]

use axum::{Extension, Json, extract::{Path, Query, State}};
use chrono::{NaiveDate, Utc};
use medbrains_core::blood_bank::{
    BbBillingItem, BbBloodReturn, BbColdChainDevice, BbColdChainReading, BbLookbackEvent,
    BbMsbosGuideline, BbRecruitmentCampaign, BloodComponent, BloodDonation, BloodDonor,
    CrossmatchRequest, TransfusionRecord,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListDonorsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub blood_group: Option<String>,
    pub is_deferred: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct DonorListResponse {
    pub donors: Vec<BloodDonor>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateDonorRequest {
    pub donor_number: String,
    pub first_name: String,
    pub last_name: String,
    pub blood_group: String,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub id_type: Option<String>,
    pub id_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDonationRequest {
    pub bag_number: String,
    pub donation_type: Option<String>,
    pub volume_ml: i32,
    pub camp_name: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDonationRequest {
    pub adverse_reaction: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateComponentRequest {
    pub donation_id: Uuid,
    pub component_type: String,
    pub bag_number: String,
    pub blood_group: String,
    pub volume_ml: i32,
    pub expiry_at: String,
    pub storage_location: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateComponentStatusRequest {
    pub status: String,
    pub discard_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListComponentsQuery {
    pub status: Option<String>,
    pub blood_group: Option<String>,
    pub component_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCrossmatchRequest {
    pub patient_id: Uuid,
    pub blood_group: String,
    pub component_type: Option<String>,
    pub units_requested: Option<i32>,
    pub clinical_indication: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCrossmatchRequest {
    pub status: Option<String>,
    pub result: Option<String>,
    pub component_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransfusionRequest {
    pub patient_id: Uuid,
    pub component_id: Uuid,
    pub crossmatch_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct RecordReactionRequest {
    pub reaction_type: String,
    pub reaction_severity: String,
    pub reaction_details: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Donors CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_donors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDonorsQuery>,
) -> Result<Json<DonorListResponse>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        string_val: Option<String>,
        bool_val: Option<bool>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref bg) = params.blood_group {
        conditions.push(format!("blood_group::text = ${bind_idx}"));
        binds.push(Bind { string_val: Some(bg.clone()), bool_val: None });
        bind_idx += 1;
    }
    if let Some(def) = params.is_deferred {
        conditions.push(format!("is_deferred = ${bind_idx}"));
        binds.push(Bind { string_val: None, bool_val: Some(def) });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM blood_donors WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(ref s) = b.string_val { cq = cq.bind(s.clone()); }
        if let Some(bv) = b.bool_val { cq = cq.bind(bv); }
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM blood_donors WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, BloodDonor>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(ref s) = b.string_val { dq = dq.bind(s.clone()); }
        if let Some(bv) = b.bool_val { dq = dq.bind(bv); }
    }
    let donors = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(DonorListResponse { donors, total, page, per_page }))
}

pub async fn create_donor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDonorRequest>,
) -> Result<Json<BloodDonor>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let donor = sqlx::query_as::<_, BloodDonor>(
        "INSERT INTO blood_donors \
         (tenant_id, donor_number, first_name, last_name, blood_group, \
          date_of_birth, gender, phone, email, address, id_type, id_number) \
         VALUES ($1, $2, $3, $4, $5::blood_group, \
                 $6::date, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.donor_number)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .bind(&body.blood_group)
    .bind(&body.date_of_birth)
    .bind(&body.gender)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.address)
    .bind(&body.id_type)
    .bind(&body.id_number)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(donor))
}

pub async fn get_donor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BloodDonor>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let donor = sqlx::query_as::<_, BloodDonor>(
        "SELECT * FROM blood_donors WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(donor))
}

// ══════════════════════════════════════════════════════════
//  Donations
// ══════════════════════════════════════════════════════════

pub async fn create_donation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donor_id): Path<Uuid>,
    Json(body): Json<CreateDonationRequest>,
) -> Result<Json<BloodDonation>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::CREATE)?;

    let dtype = body.donation_type.as_deref().unwrap_or("whole_blood");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let donation = sqlx::query_as::<_, BloodDonation>(
        "INSERT INTO blood_donations \
         (tenant_id, donor_id, bag_number, donation_type, volume_ml, \
          collected_by, camp_name, notes) \
         VALUES ($1, $2, $3, $4::donation_type, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(donor_id)
    .bind(&body.bag_number)
    .bind(dtype)
    .bind(body.volume_ml)
    .bind(claims.sub)
    .bind(&body.camp_name)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Update donor stats
    sqlx::query(
        "UPDATE blood_donors SET \
         total_donations = total_donations + 1, \
         last_donation = now(), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(donor_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(donation))
}

pub async fn list_donations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donor_id): Path<Uuid>,
) -> Result<Json<Vec<BloodDonation>>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let donations = sqlx::query_as::<_, BloodDonation>(
        "SELECT * FROM blood_donations WHERE donor_id = $1 AND tenant_id = $2 \
         ORDER BY donated_at DESC",
    )
    .bind(donor_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(donations))
}

pub async fn update_donation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donation_id): Path<Uuid>,
    Json(body): Json<UpdateDonationRequest>,
) -> Result<Json<BloodDonation>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let donation = sqlx::query_as::<_, BloodDonation>(
        "UPDATE blood_donations SET \
         adverse_reaction = COALESCE($1, adverse_reaction), \
         notes = COALESCE($2, notes) \
         WHERE id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(&body.adverse_reaction)
    .bind(&body.notes)
    .bind(donation_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(donation))
}

// ══════════════════════════════════════════════════════════
//  Blood Components / Inventory
// ══════════════════════════════════════════════════════════

pub async fn list_components(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListComponentsQuery>,
) -> Result<Json<Vec<BloodComponent>>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;
    let mut string_binds: Vec<String> = Vec::new();

    if let Some(ref s) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        string_binds.push(s.clone());
        bind_idx += 1;
    }
    if let Some(ref bg) = params.blood_group {
        conditions.push(format!("blood_group::text = ${bind_idx}"));
        string_binds.push(bg.clone());
        bind_idx += 1;
    }
    if let Some(ref ct) = params.component_type {
        conditions.push(format!("component_type::text = ${bind_idx}"));
        string_binds.push(ct.clone());
        bind_idx += 1;
    }
    let _ = bind_idx; // suppress unused warning

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT * FROM blood_components WHERE {where_clause} ORDER BY expiry_at ASC"
    );

    let mut q = sqlx::query_as::<_, BloodComponent>(&sql).bind(claims.tenant_id);
    for s in &string_binds {
        q = q.bind(s.clone());
    }
    let components = q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(components))
}

pub async fn create_component(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateComponentRequest>,
) -> Result<Json<BloodComponent>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let component = sqlx::query_as::<_, BloodComponent>(
        "INSERT INTO blood_components \
         (tenant_id, donation_id, component_type, bag_number, blood_group, \
          volume_ml, expiry_at, storage_location) \
         VALUES ($1, $2, $3::blood_component_type, $4, $5::blood_group, \
                 $6, $7::timestamptz, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.donation_id)
    .bind(&body.component_type)
    .bind(&body.bag_number)
    .bind(&body.blood_group)
    .bind(body.volume_ml)
    .bind(&body.expiry_at)
    .bind(&body.storage_location)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(component))
}

pub async fn update_component_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateComponentStatusRequest>,
) -> Result<Json<BloodComponent>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let discard_clause = if body.status == "discarded" {
        ", discarded_at = now(), discard_reason = $4"
    } else {
        ""
    };

    let sql = format!(
        "UPDATE blood_components SET \
         status = $1::blood_bag_status{discard_clause}, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *"
    );

    let mut q = sqlx::query_as::<_, BloodComponent>(&sql)
        .bind(&body.status)
        .bind(id)
        .bind(claims.tenant_id);

    if body.status == "discarded" {
        q = q.bind(&body.discard_reason);
    }

    let component = q.fetch_optional(&mut *tx).await?.ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(component))
}

// ══════════════════════════════════════════════════════════
//  Cross-match
// ══════════════════════════════════════════════════════════

pub async fn list_crossmatch_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CrossmatchRequest>>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let requests = sqlx::query_as::<_, CrossmatchRequest>(
        "SELECT * FROM crossmatch_requests WHERE tenant_id = $1 \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(requests))
}

pub async fn create_crossmatch_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCrossmatchRequest>,
) -> Result<Json<CrossmatchRequest>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::CREATE)?;

    let ct = body.component_type.as_deref().unwrap_or("prbc");
    let units = body.units_requested.unwrap_or(1);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let request = sqlx::query_as::<_, CrossmatchRequest>(
        "INSERT INTO crossmatch_requests \
         (tenant_id, patient_id, requested_by, blood_group, component_type, \
          units_requested, clinical_indication) \
         VALUES ($1, $2, $3, $4::blood_group, $5::blood_component_type, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(&body.blood_group)
    .bind(ct)
    .bind(units)
    .bind(&body.clinical_indication)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(request))
}

pub async fn update_crossmatch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCrossmatchRequest>,
) -> Result<Json<CrossmatchRequest>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let request = sqlx::query_as::<_, CrossmatchRequest>(
        "UPDATE crossmatch_requests SET \
         status = COALESCE($1::crossmatch_status, status), \
         result = COALESCE($2, result), \
         component_id = COALESCE($3, component_id), \
         tested_by = $4, tested_at = now(), updated_at = now() \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(&body.result)
    .bind(body.component_id)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(request))
}

// ══════════════════════════════════════════════════════════
//  Transfusion Records
// ══════════════════════════════════════════════════════════

pub async fn create_transfusion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTransfusionRequest>,
) -> Result<Json<TransfusionRecord>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // ABO/Rh compatibility check
    let patient_blood_group = sqlx::query_scalar::<_, Option<String>>(
        "SELECT attributes->>'blood_group' FROM patients WHERE id = $1",
    )
    .bind(body.patient_id)
    .fetch_one(&mut *tx)
    .await?;

    let component_blood_group = sqlx::query_scalar::<_, Option<String>>(
        "SELECT blood_group::text FROM blood_components WHERE id = $1",
    )
    .bind(body.component_id)
    .fetch_one(&mut *tx)
    .await?;

    if let (Some(patient_bg), Some(component_bg)) =
        (&patient_blood_group, &component_blood_group)
    {
        let compatible = match (patient_bg.as_str(), component_bg.as_str()) {
            (p, c) if p == c => true,
            ("AB+" | "ab_positive", _) => true,
            ("AB-" | "ab_negative", c) if !c.ends_with('+') && !c.contains("positive") => {
                true
            }
            (_, "O-" | "o_negative") => true,
            (p, "O+" | "o_positive")
                if p.ends_with('+') || p.contains("positive") =>
            {
                true
            }
            ("A+" | "a_positive", "A-" | "a_negative") => true,
            ("A-" | "a_negative", "A-" | "a_negative") => true,
            ("B+" | "b_positive", "B-" | "b_negative") => true,
            ("B-" | "b_negative", "B-" | "b_negative") => true,
            _ => false,
        };
        if !compatible {
            return Err(AppError::BadRequest(format!(
                "ABO/Rh incompatibility: patient {patient_bg} cannot receive component {component_bg}"
            )));
        }
    }

    let record = sqlx::query_as::<_, TransfusionRecord>(
        "INSERT INTO transfusion_records \
         (tenant_id, patient_id, component_id, crossmatch_id, administered_by) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.component_id)
    .bind(body.crossmatch_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Mark component as transfused
    sqlx::query(
        "UPDATE blood_components SET \
         status = 'transfused'::blood_bag_status, \
         issued_to_patient = $1, issued_at = now(), issued_by = $2, \
         updated_at = now() \
         WHERE id = $3 AND tenant_id = $4",
    )
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(body.component_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(record))
}

pub async fn record_reaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RecordReactionRequest>,
) -> Result<Json<TransfusionRecord>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let record = sqlx::query_as::<_, TransfusionRecord>(
        "UPDATE transfusion_records SET \
         has_reaction = true, \
         reaction_type = $1, \
         reaction_severity = $2::transfusion_reaction_severity, \
         reaction_details = $3, \
         reaction_reported_at = now(), \
         updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(&body.reaction_type)
    .bind(&body.reaction_severity)
    .bind(&body.reaction_details)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(record))
}

pub async fn list_transfusions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TransfusionRecord>>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let records = sqlx::query_as::<_, TransfusionRecord>(
        "SELECT * FROM transfusion_records WHERE tenant_id = $1 \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(records))
}

// ══════════════════════════════════════════════════════════
//  GET /api/blood-bank/tti-report — TTI screening report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TtiReportRow {
    pub tti_status: String,
    pub count: i64,
}

pub async fn get_tti_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TtiReportRow>(
        "SELECT COALESCE(tti_status::text, 'pending') AS tti_status, \
         COUNT(*)::bigint AS count \
         FROM blood_components WHERE tenant_id = $1 \
         GROUP BY tti_status ORDER BY count DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total: i64 = rows.iter().map(|r| r.count).sum();

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "total_components": total,
        "by_status": rows
    })))
}

// ══════════════════════════════════════════════════════════
//  GET /api/blood-bank/hemovigilance — Hemovigilance NACO report
// ══════════════════════════════════════════════════════════

pub async fn get_hemovigilance_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total_transfusions = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM transfusion_records \
         WHERE tenant_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '365 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let total_reactions = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM transfusion_records \
         WHERE tenant_id = $1 AND has_reaction = true \
         AND created_at >= CURRENT_DATE - INTERVAL '365 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let reaction_rate = if total_transfusions > 0 {
        total_reactions as f64 / total_transfusions as f64 * 100.0
    } else {
        0.0
    };

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "reporting_period": "last_365_days",
        "total_transfusions": total_transfusions,
        "total_reactions": total_reactions,
        "reaction_rate_percent": reaction_rate
    })))
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Request / Query types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListCampaignsQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampaignRequest {
    pub campaign_name: String,
    pub campaign_type: String,
    pub target_blood_groups: Option<serde_json::Value>,
    pub target_count: Option<i32>,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCampaignRequest {
    pub status: Option<String>,
    pub actual_count: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeviceRequest {
    pub device_name: String,
    pub device_serial: Option<String>,
    pub location: Option<String>,
    pub equipment_type: String,
    pub min_temp: Option<Decimal>,
    pub max_temp: Option<Decimal>,
    pub alert_threshold_minutes: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddReadingRequest {
    pub device_id: Uuid,
    pub temperature: Decimal,
    pub humidity: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct ListReadingsQuery {
    pub device_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CreateReturnRequest {
    pub component_id: Uuid,
    pub return_reason: Option<String>,
    pub temperature_at_return: Option<Decimal>,
    pub time_out_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct InspectReturnRequest {
    pub status: String,
    pub inspection_notes: Option<String>,
    pub temperature_acceptable: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMsbosRequest {
    pub procedure_name: String,
    pub procedure_code: String,
    pub blood_group: Option<String>,
    pub component_type: String,
    pub max_units: i32,
    pub crossmatch_to_transfusion_ratio: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLookbackRequest {
    pub donation_id: Option<Uuid>,
    pub donor_id: Option<Uuid>,
    pub infection_type: String,
    pub detection_date: NaiveDate,
    pub affected_components: Option<serde_json::Value>,
    pub investigation_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLookbackRequest {
    pub status: Option<String>,
    pub recipients_notified: Option<i32>,
    pub investigation_notes: Option<String>,
    pub reported_to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBillingRequest {
    pub component_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub component_type: Option<String>,
    pub blood_group: Option<String>,
    pub processing_fee: Option<Decimal>,
    pub component_cost: Option<Decimal>,
    pub cross_match_fee: Option<Decimal>,
    pub total_amount: Option<Decimal>,
}

// ══════════════════════════════════════════════════════════
//  Recruitment Campaigns
// ══════════════════════════════════════════════════════════

pub async fn list_campaigns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCampaignsQuery>,
) -> Result<Json<Vec<BbRecruitmentCampaign>>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, BbRecruitmentCampaign>(
            "SELECT * FROM bb_recruitment_campaigns \
             WHERE tenant_id = $1 AND status = $2 ORDER BY start_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, BbRecruitmentCampaign>(
            "SELECT * FROM bb_recruitment_campaigns \
             WHERE tenant_id = $1 ORDER BY start_date DESC",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_campaign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCampaignRequest>,
) -> Result<Json<BbRecruitmentCampaign>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbRecruitmentCampaign>(
        "INSERT INTO bb_recruitment_campaigns \
         (tenant_id, campaign_name, campaign_type, target_blood_groups, \
          target_count, start_date, end_date, status, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.campaign_name)
    .bind(&body.campaign_type)
    .bind(&body.target_blood_groups)
    .bind(body.target_count)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_campaign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCampaignRequest>,
) -> Result<Json<BbRecruitmentCampaign>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbRecruitmentCampaign>(
        "UPDATE bb_recruitment_campaigns SET \
         status = COALESCE($1, status), \
         actual_count = COALESCE($2, actual_count), \
         notes = COALESCE($3, notes), \
         updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(body.actual_count)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Cold Chain Devices & Readings
// ══════════════════════════════════════════════════════════

pub async fn list_devices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BbColdChainDevice>>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BbColdChainDevice>(
        "SELECT * FROM bb_cold_chain_devices \
         WHERE tenant_id = $1 ORDER BY device_name ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_device(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDeviceRequest>,
) -> Result<Json<BbColdChainDevice>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbColdChainDevice>(
        "INSERT INTO bb_cold_chain_devices \
         (tenant_id, device_name, device_serial, location, equipment_type, \
          min_temp, max_temp, alert_threshold_minutes, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.device_name)
    .bind(&body.device_serial)
    .bind(&body.location)
    .bind(&body.equipment_type)
    .bind(body.min_temp)
    .bind(body.max_temp)
    .bind(body.alert_threshold_minutes)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn add_reading(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddReadingRequest>,
) -> Result<Json<BbColdChainReading>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Determine alert level based on device thresholds
    let device = sqlx::query_as::<_, BbColdChainDevice>(
        "SELECT * FROM bb_cold_chain_devices \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.device_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let alert_level = match (device.min_temp, device.max_temp) {
        (Some(min), Some(max)) => {
            if body.temperature < min || body.temperature > max {
                "critical"
            } else {
                "normal"
            }
        }
        _ => "normal",
    };

    let row = sqlx::query_as::<_, BbColdChainReading>(
        "INSERT INTO bb_cold_chain_readings \
         (tenant_id, device_id, temperature, humidity, alert_level) \
         VALUES ($1, $2, $3, $4, $5::bb_cold_chain_alert_level) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.device_id)
    .bind(body.temperature)
    .bind(body.humidity)
    .bind(alert_level)
    .fetch_one(&mut *tx)
    .await?;

    // Update device last reading
    sqlx::query(
        "UPDATE bb_cold_chain_devices SET \
         last_reading_at = now(), last_temp = $1, \
         alert_level = $2::bb_cold_chain_alert_level, \
         updated_at = now() \
         WHERE id = $3 AND tenant_id = $4",
    )
    .bind(body.temperature)
    .bind(alert_level)
    .bind(body.device_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_readings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListReadingsQuery>,
) -> Result<Json<Vec<BbColdChainReading>>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BbColdChainReading>(
        "SELECT * FROM bb_cold_chain_readings \
         WHERE tenant_id = $1 AND device_id = $2 \
         ORDER BY recorded_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(params.device_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Blood Returns
// ══════════════════════════════════════════════════════════

pub async fn create_return(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReturnRequest>,
) -> Result<Json<BbBloodReturn>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let ts = Utc::now().format("%Y%m%d%H%M%S");
    let short_id = &Uuid::new_v4().to_string()[..8];
    let return_code = format!("RET-{ts}-{short_id}");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbBloodReturn>(
        "INSERT INTO bb_blood_returns \
         (tenant_id, component_id, return_code, returned_by, return_reason, \
          temperature_at_return, time_out_minutes, status) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested'::bb_return_status) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.component_id)
    .bind(&return_code)
    .bind(claims.sub)
    .bind(&body.return_reason)
    .bind(body.temperature_at_return)
    .bind(body.time_out_minutes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn inspect_return(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<InspectReturnRequest>,
) -> Result<Json<BbBloodReturn>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbBloodReturn>(
        "UPDATE bb_blood_returns SET \
         status = $1::bb_return_status, \
         inspection_notes = COALESCE($2, inspection_notes), \
         temperature_acceptable = COALESCE($3, temperature_acceptable), \
         inspected_by = $4, inspected_at = now(), updated_at = now() \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(&body.inspection_notes)
    .bind(body.temperature_acceptable)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // If accepted, mark the component available again
    if body.status == "accepted" {
        sqlx::query(
            "UPDATE blood_components SET status = 'available'::blood_bag_status, \
             updated_at = now() WHERE id = $1 AND tenant_id = $2",
        )
        .bind(row.component_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  MSBOS Guidelines
// ══════════════════════════════════════════════════════════

pub async fn list_msbos(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BbMsbosGuideline>>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BbMsbosGuideline>(
        "SELECT * FROM bb_msbos_guidelines \
         WHERE tenant_id = $1 ORDER BY procedure_name ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_msbos(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMsbosRequest>,
) -> Result<Json<BbMsbosGuideline>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbMsbosGuideline>(
        "INSERT INTO bb_msbos_guidelines \
         (tenant_id, procedure_name, procedure_code, blood_group, \
          component_type, max_units, crossmatch_to_transfusion_ratio, notes) \
         VALUES ($1, $2, $3, $4, $5::blood_component_type, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.procedure_name)
    .bind(&body.procedure_code)
    .bind(&body.blood_group)
    .bind(&body.component_type)
    .bind(body.max_units)
    .bind(body.crossmatch_to_transfusion_ratio)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Lookback Events
// ══════════════════════════════════════════════════════════

pub async fn list_lookback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BbLookbackEvent>>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BbLookbackEvent>(
        "SELECT * FROM bb_lookback_events \
         WHERE tenant_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_lookback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLookbackRequest>,
) -> Result<Json<BbLookbackEvent>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::CREATE)?;

    let ts = Utc::now().format("%Y%m%d%H%M%S");
    let short_id = &Uuid::new_v4().to_string()[..8];
    let event_code = format!("LB-{ts}-{short_id}");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbLookbackEvent>(
        "INSERT INTO bb_lookback_events \
         (tenant_id, event_code, donation_id, donor_id, infection_type, \
          detection_date, status, affected_components, investigation_notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, 'detected'::bb_lookback_status, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&event_code)
    .bind(body.donation_id)
    .bind(body.donor_id)
    .bind(&body.infection_type)
    .bind(body.detection_date)
    .bind(&body.affected_components)
    .bind(&body.investigation_notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_lookback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLookbackRequest>,
) -> Result<Json<BbLookbackEvent>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbLookbackEvent>(
        "UPDATE bb_lookback_events SET \
         status = COALESCE($1::bb_lookback_status, status), \
         recipients_notified = COALESCE($2, recipients_notified), \
         investigation_notes = COALESCE($3, investigation_notes), \
         reported_to = COALESCE($4, reported_to), \
         reported_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE reported_at END, \
         closed_at = CASE WHEN $1 = 'closed' THEN now() ELSE closed_at END, \
         closed_by = CASE WHEN $1 = 'closed' THEN $5 ELSE closed_by END, \
         updated_at = now() \
         WHERE id = $6 AND tenant_id = $7 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(body.recipients_notified)
    .bind(&body.investigation_notes)
    .bind(&body.reported_to)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Blood Bank Billing
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListBillingQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
}

pub async fn list_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBillingQuery>,
) -> Result<Json<Vec<BbBillingItem>>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;
    let mut string_binds: Vec<String> = Vec::new();
    let mut uuid_binds: Vec<Uuid> = Vec::new();

    if let Some(ref s) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        string_binds.push(s.clone());
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("patient_id = ${bind_idx}"));
        uuid_binds.push(pid);
        bind_idx += 1;
    }
    let _ = bind_idx;

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT * FROM bb_billing_items WHERE {where_clause} ORDER BY created_at DESC"
    );

    let mut q = sqlx::query_as::<_, BbBillingItem>(&sql).bind(claims.tenant_id);
    for s in &string_binds {
        q = q.bind(s.clone());
    }
    for u in &uuid_binds {
        q = q.bind(*u);
    }
    let rows = q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBillingRequest>,
) -> Result<Json<BbBillingItem>, AppError> {
    require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;

    let ts = Utc::now().format("%Y%m%d%H%M%S");
    let short_id = &Uuid::new_v4().to_string()[..8];
    let billing_code = format!("BB-{ts}-{short_id}");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BbBillingItem>(
        "INSERT INTO bb_billing_items \
         (tenant_id, component_id, patient_id, billing_code, component_type, \
          blood_group, processing_fee, component_cost, cross_match_fee, \
          total_amount, status, billed_by, billed_at) \
         VALUES ($1, $2, $3, $4, $5::blood_component_type, $6, $7, $8, $9, \
                 $10, 'pending'::bb_billing_status, $11, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.component_id)
    .bind(body.patient_id)
    .bind(&billing_code)
    .bind(&body.component_type)
    .bind(&body.blood_group)
    .bind(body.processing_fee)
    .bind(body.component_cost)
    .bind(body.cross_match_fee)
    .bind(body.total_amount)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  SBTC Compliance Report
// ══════════════════════════════════════════════════════════

pub async fn get_sbtc_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::blood_bank::transfusion::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let donation_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM blood_donations WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let component_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM blood_components WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let discard_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM blood_components \
         WHERE tenant_id = $1 AND status = 'discarded'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let reaction_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM transfusion_records \
         WHERE tenant_id = $1 AND has_reaction = true",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let lookback_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM bb_lookback_events WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "donation_count": donation_count,
        "component_count": component_count,
        "discard_count": discard_count,
        "reaction_count": reaction_count,
        "lookback_count": lookback_count
    })))
}

//! Multi-Hospital Management routes.
//!
//! Provides endpoints for:
//! - Hospital groups (chains)
//! - Regions
//! - Cross-hospital user assignments
//! - Inter-hospital transfers (patients, stock)
//! - Consolidated KPIs
//! - Doctor rotation schedules
//! - Group-level master data

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono::NaiveDate;
use medbrains_core::multi_hospital::{
    AssignHospitalToGroup, CreateDoctorRotation, CreateGroupTemplate, CreateHospitalGroup,
    CreateHospitalRegion, CreatePatientTransfer, CreateStockTransfer, CreateUserHospitalAssignment,
    DoctorRotationDisplay, DoctorRotationSchedule, GroupDashboard, GroupDrugMaster,
    GroupKpiSnapshot, GroupTariffMaster, GroupTemplate, GroupTestMaster, HospitalGroup,
    HospitalInGroup, HospitalKpiSummary, HospitalPriceOverride, HospitalRegion, PatientTransfer,
    PatientTransferDisplay, StockTransfer, StockTransferItem, UpdateHospitalGroup,
    UpdateTransferStatus, UserHospitalAssignment, UserWithAssignments,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

// ── Query Parameters ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct GroupIdQuery {
    pub group_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct DateRangeQuery {
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct PeriodQuery {
    pub period: Option<String>,
}

// ── Hospital Groups ───────────────────────────────────────────────────────────

/// List all active hospital groups. Global (cross-tenant) — platform admins only.
pub async fn list_groups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HospitalGroup>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, HospitalGroup>(
        "SELECT * FROM hospital_groups WHERE is_active = true ORDER BY name LIMIT 1000",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// Get a specific hospital group.
pub async fn get_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<HospitalGroup>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let row = sqlx::query_as::<_, HospitalGroup>("SELECT * FROM hospital_groups WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

/// Create a new hospital group.
pub async fn create_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateHospitalGroup>,
) -> Result<Json<HospitalGroup>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let row = sqlx::query_as::<_, HospitalGroup>(
        "INSERT INTO hospital_groups \
         (code, name, display_name, headquarters_address, phone, email, website, logo_url, \
          primary_color, default_currency, timezone) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '#228be6'), \
                 COALESCE($10, 'INR'), COALESCE($11, 'Asia/Kolkata')) RETURNING *",
    )
    .bind(&payload.code)
    .bind(&payload.name)
    .bind(&payload.display_name)
    .bind(&payload.headquarters_address)
    .bind(&payload.phone)
    .bind(&payload.email)
    .bind(&payload.website)
    .bind(&payload.logo_url)
    .bind(&payload.primary_color)
    .bind(&payload.default_currency)
    .bind(&payload.timezone)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

/// Update a hospital group.
pub async fn update_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateHospitalGroup>,
) -> Result<Json<HospitalGroup>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let row = sqlx::query_as::<_, HospitalGroup>(
        "UPDATE hospital_groups SET \
            name = COALESCE($2, name), display_name = COALESCE($3, display_name), \
            headquarters_address = COALESCE($4, headquarters_address), \
            phone = COALESCE($5, phone), email = COALESCE($6, email), \
            website = COALESCE($7, website), logo_url = COALESCE($8, logo_url), \
            primary_color = COALESCE($9, primary_color), \
            default_currency = COALESCE($10, default_currency), \
            timezone = COALESCE($11, timezone), is_active = COALESCE($12, is_active), \
            updated_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.display_name)
    .bind(&payload.headquarters_address)
    .bind(&payload.phone)
    .bind(&payload.email)
    .bind(&payload.website)
    .bind(&payload.logo_url)
    .bind(&payload.primary_color)
    .bind(&payload.default_currency)
    .bind(&payload.timezone)
    .bind(payload.is_active)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

/// Soft-delete a hospital group.
pub async fn delete_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    sqlx::query("UPDATE hospital_groups SET is_active = false, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Regions ───────────────────────────────────────────────────────────────────

/// List active regions for a group.
pub async fn list_regions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<GroupIdQuery>,
) -> Result<Json<Vec<HospitalRegion>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, HospitalRegion>(
        "SELECT * FROM hospital_regions WHERE group_id = $1 AND is_active = true ORDER BY name",
    )
    .bind(query.group_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// Get a specific region.
pub async fn get_region(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<HospitalRegion>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let row = sqlx::query_as::<_, HospitalRegion>("SELECT * FROM hospital_regions WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

/// Create a new region under a group.
pub async fn create_region(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateHospitalRegion>,
) -> Result<Json<HospitalRegion>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let row = sqlx::query_as::<_, HospitalRegion>(
        "INSERT INTO hospital_regions \
         (group_id, code, name, country, states, regional_head_name, \
          regional_head_email, regional_head_phone) \
         VALUES ($1, $2, $3, COALESCE($4, 'India'), $5, $6, $7, $8) RETURNING *",
    )
    .bind(payload.group_id)
    .bind(&payload.code)
    .bind(&payload.name)
    .bind(&payload.country)
    .bind(&payload.states)
    .bind(&payload.regional_head_name)
    .bind(&payload.regional_head_email)
    .bind(&payload.regional_head_phone)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

/// Soft-delete a region.
pub async fn delete_region(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    sqlx::query("UPDATE hospital_regions SET is_active = false, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Hospital Assignments ──────────────────────────────────────────────────────

/// List the hospitals (tenants) that belong to a group.
pub async fn list_hospitals_in_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<HospitalInGroup>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, HospitalInGroup>(
        "SELECT id, code, name, group_id, region_id, branch_code, \
                COALESCE(is_headquarters, false) AS is_headquarters, city, NULL::text AS state \
         FROM tenants WHERE group_id = $1 ORDER BY name",
    )
    .bind(group_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// Assign a hospital (tenant) to a group / region / branch.
pub async fn assign_hospital_to_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<AssignHospitalToGroup>,
) -> Result<Json<HospitalInGroup>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let row = sqlx::query_as::<_, HospitalInGroup>(
        "UPDATE tenants SET group_id = $2, region_id = $3, branch_code = $4, \
            is_headquarters = COALESCE($5, is_headquarters), updated_at = now() \
         WHERE id = $1 \
         RETURNING id, code, name, group_id, region_id, branch_code, \
                   COALESCE(is_headquarters, false) AS is_headquarters, city, NULL::text AS state",
    )
    .bind(payload.tenant_id)
    .bind(payload.group_id)
    .bind(payload.region_id)
    .bind(&payload.branch_code)
    .bind(payload.is_headquarters)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

/// Remove a hospital from its group (clears group / region / branch).
pub async fn remove_hospital_from_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(tenant_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    sqlx::query(
        "UPDATE tenants SET group_id = NULL, region_id = NULL, branch_code = NULL, \
            updated_at = now() WHERE id = $1",
    )
    .bind(tenant_id)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Cross-Hospital User Assignments ───────────────────────────────────────────

const ASSIGNMENT_COLS: &str = "id, user_id, tenant_id, role, permissions, is_primary, \
     is_active, valid_from, valid_to, created_at, updated_at";

/// List a user's hospital assignments across the chain.
pub async fn list_user_assignments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserWithAssignments>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let (username, full_name, email) = sqlx::query_as::<_, (String, String, String)>(
        "SELECT username, COALESCE(full_name, ''), COALESCE(email, '') FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    let assignments = sqlx::query_as::<_, UserHospitalAssignment>(&format!(
        "SELECT {ASSIGNMENT_COLS} FROM user_hospital_assignments \
         WHERE user_id = $1 AND deleted_at IS NULL ORDER BY is_primary DESC"
    ))
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(UserWithAssignments {
        user_id,
        username,
        full_name,
        email,
        assignments,
    }))
}

/// List all users who hold an assignment in any hospital of a group.
pub async fn list_multi_hospital_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<GroupIdQuery>,
) -> Result<Json<Vec<UserWithAssignments>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let assignments = sqlx::query_as::<_, UserHospitalAssignment>(
        "SELECT uha.id, uha.user_id, uha.tenant_id, uha.role, uha.permissions, uha.is_primary, \
                uha.is_active, uha.valid_from, uha.valid_to, uha.created_at, uha.updated_at \
         FROM user_hospital_assignments uha JOIN tenants t ON t.id = uha.tenant_id \
         WHERE t.group_id = $1 AND uha.deleted_at IS NULL ORDER BY uha.user_id",
    )
    .bind(query.group_id)
    .fetch_all(&state.db)
    .await?;

    let mut by_user: std::collections::HashMap<Uuid, Vec<UserHospitalAssignment>> =
        std::collections::HashMap::new();
    for a in assignments {
        by_user.entry(a.user_id).or_default().push(a);
    }
    if by_user.is_empty() {
        return Ok(Json(vec![]));
    }
    let user_ids: Vec<Uuid> = by_user.keys().copied().collect();
    let users = sqlx::query_as::<_, (Uuid, String, String, String)>(
        "SELECT id, username, COALESCE(full_name, ''), COALESCE(email, '') \
         FROM users WHERE id = ANY($1)",
    )
    .bind(&user_ids)
    .fetch_all(&state.db)
    .await?;
    let result = users
        .into_iter()
        .map(|(id, username, full_name, email)| UserWithAssignments {
            user_id: id,
            username,
            full_name,
            email,
            assignments: by_user.get(&id).cloned().unwrap_or_default(),
        })
        .collect();
    Ok(Json(result))
}

/// Assign a user to a hospital (grant chain access).
pub async fn create_user_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateUserHospitalAssignment>,
) -> Result<Json<UserHospitalAssignment>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let perms = serde_json::to_value(payload.permissions.unwrap_or_default())
        .unwrap_or_else(|_| serde_json::json!([]));
    let row = sqlx::query_as::<_, UserHospitalAssignment>(&format!(
        "INSERT INTO user_hospital_assignments \
         (user_id, tenant_id, role, permissions, is_primary, valid_from, valid_to) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), COALESCE($6, CURRENT_DATE), $7) \
         RETURNING {ASSIGNMENT_COLS}"
    ))
    .bind(payload.user_id)
    .bind(payload.tenant_id)
    .bind(&payload.role)
    .bind(perms)
    .bind(payload.is_primary)
    .bind(payload.valid_from)
    .bind(payload.valid_to)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

/// Revoke a user's hospital assignment (soft-delete).
pub async fn delete_user_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(assignment_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    sqlx::query(
        "UPDATE user_hospital_assignments \
         SET is_active = false, deleted_at = now(), deleted_by = $2 WHERE id = $1",
    )
    .bind(assignment_id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Patient Transfers ─────────────────────────────────────────────────────────

// The display join. patient_transfers + tenants are RLS-off (all rows); patients + users are
// RLS-on, so the patient/requester show only for OUTGOING (patient is in the caller's tenant) —
// incoming rows still carry source hospital + reason + clinical summary for the accept decision.
const TRANSFER_DISPLAY_SELECT: &str = "SELECT pt.id, s.name AS source_hospital_name, \
        d.name AS dest_hospital_name, \
        COALESCE(CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')), '') AS patient_name, \
        COALESCE(p.uhid, '') AS uhid, pt.transfer_type, pt.reason, pt.priority, pt.status, \
        pt.requested_at, COALESCE(u.full_name, '') AS requested_by_name \
     FROM patient_transfers pt \
     JOIN tenants s ON s.id = pt.source_tenant_id \
     JOIN tenants d ON d.id = pt.dest_tenant_id \
     LEFT JOIN patients p ON p.id = pt.patient_id \
     LEFT JOIN users u ON u.id = pt.requested_by";

async fn list_transfers_by_side(
    state: &AppState,
    claims: &Claims,
    query: &DateRangeQuery,
    side_column: &str,
) -> Result<Vec<PatientTransferDisplay>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PatientTransferDisplay>(&format!(
        "{TRANSFER_DISPLAY_SELECT} WHERE pt.{side_column} = $1 AND pt.deleted_at IS NULL \
         AND ($2::date IS NULL OR pt.requested_at::date >= $2) \
         AND ($3::date IS NULL OR pt.requested_at::date <= $3) \
         ORDER BY pt.requested_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// List transfers this hospital has sent out.
pub async fn list_outgoing_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<PatientTransferDisplay>>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    Ok(Json(
        list_transfers_by_side(&state, &claims, &query, "source_tenant_id").await?,
    ))
}

/// List transfers inbound to this hospital.
pub async fn list_incoming_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<PatientTransferDisplay>>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    Ok(Json(
        list_transfers_by_side(&state, &claims, &query, "dest_tenant_id").await?,
    ))
}

/// Get one transfer (caller must be the source or destination hospital).
pub async fn get_patient_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PatientTransfer>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    let t = sqlx::query_as::<_, PatientTransfer>(
        "SELECT * FROM patient_transfers WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    if t.source_tenant_id != claims.tenant_id && t.dest_tenant_id != claims.tenant_id {
        return Err(AppError::Forbidden);
    }
    Ok(Json(t))
}

/// Request a patient transfer to another hospital in the same group.
pub async fn create_patient_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePatientTransfer>,
) -> Result<Json<PatientTransfer>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    let same_group = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS ( \
            SELECT 1 FROM tenants s JOIN tenants d ON d.group_id = s.group_id \
            WHERE s.id = $1 AND d.id = $2 AND s.group_id IS NOT NULL)",
    )
    .bind(claims.tenant_id)
    .bind(payload.dest_tenant_id)
    .fetch_one(&state.db)
    .await?;
    if !same_group {
        return Err(AppError::BadRequest(
            "Destination hospital is not in the same group".to_owned(),
        ));
    }
    let row = sqlx::query_as::<_, PatientTransfer>(
        "INSERT INTO patient_transfers \
         (source_tenant_id, dest_tenant_id, patient_id, admission_id, transfer_type, reason, \
          clinical_summary, priority, status, requested_by, transport_mode) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 'clinical'), $6, $7, COALESCE($8, 'routine'), \
                 'requested', $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(payload.dest_tenant_id)
    .bind(payload.patient_id)
    .bind(payload.admission_id)
    .bind(&payload.transfer_type)
    .bind(&payload.reason)
    .bind(&payload.clinical_summary)
    .bind(&payload.priority)
    .bind(claims.sub)
    .bind(&payload.transport_mode)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

/// Advance a transfer through its lifecycle (accept / reject / depart / receive / cancel).
/// Guarded: the caller must be the correct side and the prior status must be valid.
pub async fn update_patient_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransferStatus>,
) -> Result<Json<PatientTransfer>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    let t = sqlx::query_as::<_, PatientTransfer>(
        "SELECT * FROM patient_transfers WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    use medbrains_core::multi_hospital::TransferStatus::{
        Approved, Cancelled, InTransit, Received, Rejected, Requested,
    };
    let is_source = t.source_tenant_id == claims.tenant_id;
    let is_dest = t.dest_tenant_id == claims.tenant_id;
    if !is_source && !is_dest {
        return Err(AppError::Forbidden);
    }
    let allowed = match payload.status {
        Approved | Rejected => is_dest && t.status == Requested,
        InTransit => is_source && t.status == Approved,
        Received => is_dest && t.status == InTransit,
        Cancelled => is_source && matches!(t.status, Requested | Approved),
        Requested => false,
    };
    if !allowed {
        return Err(AppError::BadRequest(
            "That transfer action isn't valid for your hospital at this stage".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, PatientTransfer>(
        "UPDATE patient_transfers SET status = $2, notes = COALESCE($3, notes), \
            approved_by = CASE WHEN $2 = 'approved'::transfer_status THEN $4 ELSE approved_by END, \
            approved_at = CASE WHEN $2 = 'approved'::transfer_status THEN now() ELSE approved_at END, \
            departed_at = CASE WHEN $2 = 'in_transit'::transfer_status THEN now() \
                               ELSE departed_at END, \
            received_by = CASE WHEN $2 = 'received'::transfer_status THEN $4 ELSE received_by END, \
            arrived_at = CASE WHEN $2 = 'received'::transfer_status THEN now() ELSE arrived_at END, \
            updated_at = now() \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(payload.status)
    .bind(&payload.notes)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

// ── Stock Transfers ───────────────────────────────────────────────────────────

async fn list_stock_transfers_by_side(
    state: &AppState,
    claims: &Claims,
    query: &DateRangeQuery,
    side_column: &str,
) -> Result<Vec<StockTransfer>, AppError> {
    let rows = sqlx::query_as::<_, StockTransfer>(&format!(
        "SELECT * FROM inter_hospital_stock_transfers \
         WHERE {side_column} = $1 AND deleted_at IS NULL \
           AND ($2::date IS NULL OR requested_at::date >= $2) \
           AND ($3::date IS NULL OR requested_at::date <= $3) \
         ORDER BY requested_at DESC LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_all(&state.db)
    .await?;
    Ok(rows)
}

/// List stock transfers this hospital has sent out.
pub async fn list_outgoing_stock_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<StockTransfer>>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    Ok(Json(
        list_stock_transfers_by_side(&state, &claims, &query, "source_tenant_id").await?,
    ))
}

/// List stock transfers inbound to this hospital.
pub async fn list_incoming_stock_transfers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<StockTransfer>>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    Ok(Json(
        list_stock_transfers_by_side(&state, &claims, &query, "dest_tenant_id").await?,
    ))
}

/// Get one stock transfer (caller must be source or destination).
pub async fn get_stock_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StockTransfer>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    let t = sqlx::query_as::<_, StockTransfer>(
        "SELECT * FROM inter_hospital_stock_transfers WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    if t.source_tenant_id != claims.tenant_id && t.dest_tenant_id != claims.tenant_id {
        return Err(AppError::Forbidden);
    }
    Ok(Json(t))
}

/// Get the line items of a stock transfer (numeric qty cast to float8 for the f64 model).
pub async fn get_stock_transfer_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfer_id): Path<Uuid>,
) -> Result<Json<Vec<StockTransferItem>>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    let items = sqlx::query_as::<_, StockTransferItem>(
        "SELECT i.id, i.transfer_id, i.item_id, i.item_type, i.item_code, i.item_name, \
                i.batch_number, i.expiry_date, i.requested_qty::float8 AS requested_qty, \
                i.approved_qty::float8 AS approved_qty, i.dispatched_qty::float8 AS dispatched_qty, \
                i.received_qty::float8 AS received_qty, i.unit, \
                i.unit_price::float8 AS unit_price, i.created_at \
         FROM inter_hospital_stock_transfer_items i \
         JOIN inter_hospital_stock_transfers t ON t.id = i.transfer_id \
         WHERE i.transfer_id = $1 AND i.deleted_at IS NULL \
           AND (t.source_tenant_id = $2 OR t.dest_tenant_id = $2)",
    )
    .bind(transfer_id)
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(items))
}

/// Request a stock transfer (with line items) to another hospital in the same group.
pub async fn create_stock_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateStockTransfer>,
) -> Result<Json<StockTransfer>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    if payload.items.is_empty() {
        return Err(AppError::BadRequest(
            "At least one item is required".to_owned(),
        ));
    }
    let same_group = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS ( \
            SELECT 1 FROM tenants s JOIN tenants d ON d.group_id = s.group_id \
            WHERE s.id = $1 AND d.id = $2 AND s.group_id IS NOT NULL)",
    )
    .bind(claims.tenant_id)
    .bind(payload.dest_tenant_id)
    .fetch_one(&state.db)
    .await?;
    if !same_group {
        return Err(AppError::BadRequest(
            "Destination hospital is not in the same group".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    let number = format!(
        "IHST-{}",
        Uuid::new_v4().simple().to_string()[..10].to_uppercase()
    );
    let header = sqlx::query_as::<_, StockTransfer>(
        "INSERT INTO inter_hospital_stock_transfers \
         (source_tenant_id, dest_tenant_id, transfer_number, status, priority, \
          request_reason, requested_by) \
         VALUES ($1, $2, $3, 'requested'::stock_transfer_status, COALESCE($4, 'routine'), $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(payload.dest_tenant_id)
    .bind(&number)
    .bind(&payload.priority)
    .bind(&payload.request_reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    for item in &payload.items {
        sqlx::query(
            "INSERT INTO inter_hospital_stock_transfer_items \
             (transfer_id, item_id, item_type, item_code, item_name, batch_number, expiry_date, \
              requested_qty, unit, unit_price) \
             VALUES ($1, $2, COALESCE($3, 'drug'), $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(header.id)
        .bind(item.item_id)
        .bind(&item.item_type)
        .bind(&item.item_code)
        .bind(&item.item_name)
        .bind(&item.batch_number)
        .bind(item.expiry_date)
        .bind(item.requested_qty)
        .bind(&item.unit)
        .bind(item.unit_price)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(Json(header))
}

/// Advance a stock transfer (accept / dispatch / receive / cancel), side + status guarded.
/// The handler signature reuses the patient `TransferStatus`, mapped onto the stock lifecycle.
pub async fn update_stock_transfer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransferStatus>,
) -> Result<Json<StockTransfer>, AppError> {
    require_permission(&claims, permissions::ipd::transfers::CREATE)?;
    let t = sqlx::query_as::<_, StockTransfer>(
        "SELECT * FROM inter_hospital_stock_transfers WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    use medbrains_core::multi_hospital::StockTransferStatus as S;
    use medbrains_core::multi_hospital::TransferStatus as P;
    let is_source = t.source_tenant_id == claims.tenant_id;
    let is_dest = t.dest_tenant_id == claims.tenant_id;
    if !is_source && !is_dest {
        return Err(AppError::Forbidden);
    }
    let (target, allowed) = match payload.status {
        P::Approved => (S::Approved, is_dest && t.status == S::Requested),
        P::InTransit => (S::Dispatched, is_source && t.status == S::Approved),
        P::Received => (
            S::Received,
            is_dest && matches!(t.status, S::Dispatched | S::InTransit),
        ),
        P::Cancelled => (
            S::Cancelled,
            is_source && matches!(t.status, S::Requested | S::Approved),
        ),
        P::Requested | P::Rejected => (S::Requested, false),
    };
    if !allowed {
        return Err(AppError::BadRequest(
            "That transfer action isn't valid for your hospital at this stage".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, StockTransfer>(
        "UPDATE inter_hospital_stock_transfers SET status = $2, notes = COALESCE($3, notes), \
            approved_by = CASE WHEN $2 = 'approved'::stock_transfer_status THEN $4 \
                               ELSE approved_by END, \
            approved_at = CASE WHEN $2 = 'approved'::stock_transfer_status THEN now() \
                               ELSE approved_at END, \
            dispatched_by = CASE WHEN $2 = 'dispatched'::stock_transfer_status THEN $4 \
                                 ELSE dispatched_by END, \
            dispatched_at = CASE WHEN $2 = 'dispatched'::stock_transfer_status THEN now() \
                                 ELSE dispatched_at END, \
            received_by = CASE WHEN $2 = 'received'::stock_transfer_status THEN $4 \
                               ELSE received_by END, \
            received_at = CASE WHEN $2 = 'received'::stock_transfer_status THEN now() \
                               ELSE received_at END, \
            updated_at = now() WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(target)
    .bind(&payload.notes)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

// ── Group KPIs & Dashboard ────────────────────────────────────────────────────

// Per-hospital KPI rollup over the date range. group_kpi_snapshots is RLS-on, so a caller only
// sees their own tenant's snapshots — other hospitals in the group roll up to zero until the
// cross-tenant read path lands (same deferral as the other cross-tenant reads).
const HOSPITAL_KPI_SELECT: &str = "SELECT t.id AS tenant_id, t.name AS hospital_name, \
        t.branch_code, r.name AS region_name, \
        COALESCE(MAX(s.total_beds), 0)::int AS total_beds, \
        COALESCE(MAX(s.occupied_beds), 0)::int AS occupied_beds, \
        COALESCE(AVG(s.occupancy_pct), 0)::float8 AS occupancy_pct, \
        COALESCE(SUM(s.opd_visits), 0)::int AS opd_visits, \
        COALESCE(SUM(s.admissions), 0)::int AS admissions, \
        COALESCE(SUM(s.gross_revenue), 0)::float8 AS revenue, \
        COALESCE(AVG(s.avg_los), 0)::float8 AS avg_los \
     FROM tenants t \
     LEFT JOIN hospital_regions r ON r.id = t.region_id \
     LEFT JOIN group_kpi_snapshots s ON s.tenant_id = t.id AND s.deleted_at IS NULL \
          AND ($2::date IS NULL OR s.snapshot_date >= $2) \
          AND ($3::date IS NULL OR s.snapshot_date <= $3)";

/// Consolidated group dashboard — per-hospital KPI rollups + group totals.
pub async fn get_group_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<GroupDashboard>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let group_name = sqlx::query_scalar::<_, String>("SELECT name FROM hospital_groups WHERE id = $1")
        .bind(group_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let hospitals = sqlx::query_as::<_, HospitalKpiSummary>(&format!(
        "{HOSPITAL_KPI_SELECT} WHERE t.group_id = $1 \
         GROUP BY t.id, t.name, t.branch_code, r.name ORDER BY t.name"
    ))
    .bind(group_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let total_beds: i32 = hospitals.iter().map(|h| h.total_beds).sum();
    let total_occupied: i32 = hospitals.iter().map(|h| h.occupied_beds).sum();
    let total_revenue: f64 = hospitals.iter().map(|h| h.revenue).sum();
    let overall_occupancy_pct = if total_beds > 0 {
        f64::from(total_occupied) / f64::from(total_beds) * 100.0
    } else {
        0.0
    };
    Ok(Json(GroupDashboard {
        group_id,
        group_name,
        total_opd_visits: hospitals.iter().map(|h| h.opd_visits).sum(),
        total_admissions: hospitals.iter().map(|h| h.admissions).sum(),
        hospitals,
        total_beds,
        total_occupied,
        overall_occupancy_pct,
        total_revenue,
        snapshot_date: chrono::Utc::now().date_naive(),
    }))
}

/// Get the raw KPI snapshots for a group over a date range.
pub async fn list_group_kpis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<GroupKpiSnapshot>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, GroupKpiSnapshot>(
        "SELECT id, group_id, tenant_id, snapshot_date, snapshot_type, total_beds, occupied_beds, \
                occupancy_pct::float8 AS occupancy_pct, opd_visits, new_patients, admissions, \
                discharges, gross_revenue::float8 AS gross_revenue, \
                net_revenue::float8 AS net_revenue, collections::float8 AS collections, \
                avg_los::float8 AS avg_los, mortality_rate::float8 AS mortality_rate, \
                readmission_rate::float8 AS readmission_rate, \
                infection_rate::float8 AS infection_rate, metrics, created_at \
         FROM group_kpi_snapshots WHERE group_id = $1 AND deleted_at IS NULL \
           AND ($2::date IS NULL OR snapshot_date >= $2) \
           AND ($3::date IS NULL OR snapshot_date <= $3) \
         ORDER BY snapshot_date DESC LIMIT 5000",
    )
    .bind(group_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Get one hospital's KPI summary over a date range.
pub async fn get_hospital_kpi(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(tenant_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<HospitalKpiSummary>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let summary = sqlx::query_as::<_, HospitalKpiSummary>(&format!(
        "{HOSPITAL_KPI_SELECT} WHERE t.id = $1 GROUP BY t.id, t.name, t.branch_code, r.name"
    ))
    .bind(tenant_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(summary))
}

// ── Doctor Rotation ───────────────────────────────────────────────────────────

/// List a group's doctor rotation roster (RLS-scoped to this hospital's entries).
pub async fn list_doctor_rotations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<DoctorRotationDisplay>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DoctorRotationDisplay>(
        "SELECT r.id, COALESCE(u.full_name, '') AS doctor_name, NULL::text AS doctor_specialty, \
                t.name AS hospital_name, d.name AS department_name, r.schedule_date, r.shift, \
                r.start_time, r.end_time, r.is_locum \
         FROM doctor_rotation_schedules r \
         JOIN tenants t ON t.id = r.tenant_id \
         LEFT JOIN users u ON u.id = r.doctor_id \
         LEFT JOIN departments d ON d.id = r.department_id \
         WHERE r.group_id = $1 AND r.deleted_at IS NULL \
           AND ($2::date IS NULL OR r.schedule_date >= $2) \
           AND ($3::date IS NULL OR r.schedule_date <= $3) \
         ORDER BY r.schedule_date, r.shift LIMIT 1000",
    )
    .bind(group_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Get a doctor's rotation entries (this hospital).
pub async fn get_doctor_rotation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doctor_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<DoctorRotationSchedule>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DoctorRotationSchedule>(
        "SELECT * FROM doctor_rotation_schedules \
         WHERE doctor_id = $1 AND deleted_at IS NULL \
           AND ($2::date IS NULL OR schedule_date >= $2) \
           AND ($3::date IS NULL OR schedule_date <= $3) \
         ORDER BY schedule_date LIMIT 1000",
    )
    .bind(doctor_id)
    .bind(query.from_date)
    .bind(query.to_date)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Create a doctor rotation entry for this hospital.
pub async fn create_doctor_rotation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<CreateDoctorRotation>,
) -> Result<Json<DoctorRotationSchedule>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, DoctorRotationSchedule>(
        "INSERT INTO doctor_rotation_schedules \
         (group_id, doctor_id, schedule_date, tenant_id, department_id, shift, start_time, \
          end_time, is_locum, notes) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'day'), $7, $8, COALESCE($9, false), $10) \
         RETURNING *",
    )
    .bind(group_id)
    .bind(payload.doctor_id)
    .bind(payload.schedule_date)
    .bind(claims.tenant_id)
    .bind(payload.department_id)
    .bind(&payload.shift)
    .bind(payload.start_time)
    .bind(payload.end_time)
    .bind(payload.is_locum)
    .bind(&payload.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Soft-delete a doctor rotation entry.
pub async fn delete_doctor_rotation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE doctor_rotation_schedules SET deleted_at = now(), deleted_by = $2 WHERE id = $1",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Group Masters ─────────────────────────────────────────────────────────────

/// List a group's standardized drug formulary.
pub async fn list_group_drugs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupDrugMaster>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, GroupDrugMaster>(
        "SELECT id, group_id, code, name, generic_name, manufacturer, drug_schedule, atc_code, \
                formulation, strength, unit, hsn_code, gst_rate::float8 AS gst_rate, \
                is_controlled, is_active, created_at, updated_at \
         FROM group_drug_master \
         WHERE group_id = $1 AND is_active = true AND deleted_at IS NULL ORDER BY name LIMIT 5000",
    )
    .bind(group_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// List a group's standardized test catalogue.
pub async fn list_group_tests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupTestMaster>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, GroupTestMaster>(
        "SELECT * FROM group_test_master \
         WHERE group_id = $1 AND is_active = true AND deleted_at IS NULL ORDER BY name LIMIT 5000",
    )
    .bind(group_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// List a group's standardized tariff (service price) master.
pub async fn list_group_tariffs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupTariffMaster>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, GroupTariffMaster>(
        "SELECT id, group_id, service_code, service_name, category, \
                base_price::float8 AS base_price, gst_applicable, gst_rate::float8 AS gst_rate, \
                is_active, created_at, updated_at \
         FROM group_tariff_master \
         WHERE group_id = $1 AND is_active = true AND deleted_at IS NULL \
         ORDER BY service_name LIMIT 5000",
    )
    .bind(group_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// List this hospital's price overrides on the group tariff.
pub async fn list_price_overrides(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HospitalPriceOverride>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HospitalPriceOverride>(
        "SELECT id, tenant_id, group_tariff_id, override_price::float8 AS override_price, \
                effective_from, effective_to, reason, approved_by, created_at \
         FROM hospital_price_overrides \
         WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── Group Templates ───────────────────────────────────────────────────────────

/// List a group's templates (optionally filter by template_type via the `period` query param).
pub async fn list_group_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<PeriodQuery>,
) -> Result<Json<Vec<GroupTemplate>>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let rows = sqlx::query_as::<_, GroupTemplate>(
        "SELECT * FROM group_templates \
         WHERE group_id = $1 AND is_active = true AND deleted_at IS NULL \
           AND ($2::text IS NULL OR template_type = $2) ORDER BY name LIMIT 5000",
    )
    .bind(group_id)
    .bind(query.period.as_deref())
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

/// Get a group template.
pub async fn get_group_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GroupTemplate>, AppError> {
    require_permission(&claims, permissions::admin::system_state::VIEW)?;
    let row = sqlx::query_as::<_, GroupTemplate>(
        "SELECT * FROM group_templates WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(row))
}

/// Create a group template.
pub async fn create_group_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<CreateGroupTemplate>,
) -> Result<Json<GroupTemplate>, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    let row = sqlx::query_as::<_, GroupTemplate>(
        "INSERT INTO group_templates \
         (group_id, template_type, code, name, content, version, is_active) \
         VALUES ($1, $2, $3, $4, $5, 1, true) RETURNING *",
    )
    .bind(group_id)
    .bind(&payload.template_type)
    .bind(&payload.code)
    .bind(&payload.name)
    .bind(&payload.content)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

/// Soft-delete a group template.
pub async fn delete_group_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_permission(&claims, permissions::admin::system_state::MANAGE)?;
    sqlx::query(
        "UPDATE group_templates SET is_active = false, deleted_at = now(), deleted_by = $2 \
         WHERE id = $1",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

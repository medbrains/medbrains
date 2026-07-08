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

/// List patient transfers (outgoing from current hospital)
pub async fn list_outgoing_transfers(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<PatientTransferDisplay>>, (StatusCode, String)> {
    // TODO: Query patient_transfers where source_tenant_id = current tenant
    let _ = query;
    Ok(Json(vec![]))
}

/// List incoming patient transfers
pub async fn list_incoming_transfers(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<PatientTransferDisplay>>, (StatusCode, String)> {
    // TODO: Query patient_transfers where dest_tenant_id = current tenant
    let _ = query;
    Ok(Json(vec![]))
}

/// Get transfer details
pub async fn get_patient_transfer(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PatientTransfer>, (StatusCode, String)> {
    // TODO: Query patient_transfer by ID
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Transfer not found".to_string()))
}

/// Request a patient transfer
pub async fn create_patient_transfer(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreatePatientTransfer>,
) -> Result<Json<PatientTransfer>, (StatusCode, String)> {
    // TODO: Insert patient_transfer with status=requested
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update transfer status (approve, reject, mark in-transit, receive)
pub async fn update_patient_transfer(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransferStatus>,
) -> Result<Json<PatientTransfer>, (StatusCode, String)> {
    // TODO: Update patient_transfer status
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Stock Transfers ───────────────────────────────────────────────────────────

/// List outgoing stock transfers
pub async fn list_outgoing_stock_transfers(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<StockTransfer>>, (StatusCode, String)> {
    // TODO: Query inter_hospital_stock_transfers where source_tenant_id = current
    let _ = query;
    Ok(Json(vec![]))
}

/// List incoming stock transfers
pub async fn list_incoming_stock_transfers(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<StockTransfer>>, (StatusCode, String)> {
    // TODO: Query inter_hospital_stock_transfers where dest_tenant_id = current
    let _ = query;
    Ok(Json(vec![]))
}

/// Get stock transfer details with items
pub async fn get_stock_transfer(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StockTransfer>, (StatusCode, String)> {
    // TODO: Query stock transfer by ID
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Transfer not found".to_string()))
}

/// Get stock transfer items
pub async fn get_stock_transfer_items(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(transfer_id): Path<Uuid>,
) -> Result<Json<Vec<StockTransferItem>>, (StatusCode, String)> {
    // TODO: Query stock transfer items
    let _ = transfer_id;
    Ok(Json(vec![]))
}

/// Request a stock transfer
pub async fn create_stock_transfer(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateStockTransfer>,
) -> Result<Json<StockTransfer>, (StatusCode, String)> {
    // TODO: Insert stock transfer and items
    let _ = payload;
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Update stock transfer status
pub async fn update_stock_transfer(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransferStatus>,
) -> Result<Json<StockTransfer>, (StatusCode, String)> {
    // TODO: Update stock transfer status
    let _ = (id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

// ── Group KPIs & Dashboard ────────────────────────────────────────────────────

/// Get consolidated group dashboard
pub async fn get_group_dashboard(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<GroupDashboard>, (StatusCode, String)> {
    // TODO: Aggregate KPIs across all hospitals in group
    let _ = (group_id, query);
    Err((StatusCode::NOT_FOUND, "Group not found".to_string()))
}

/// Get KPI snapshots for a group
pub async fn list_group_kpis(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<GroupKpiSnapshot>>, (StatusCode, String)> {
    // TODO: Query group_kpi_snapshots for date range
    let _ = (group_id, query);
    Ok(Json(vec![]))
}

/// Get hospital KPI summary
pub async fn get_hospital_kpi(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(tenant_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<HospitalKpiSummary>, (StatusCode, String)> {
    // TODO: Query KPI for specific hospital
    let _ = (tenant_id, query);
    Err((StatusCode::NOT_FOUND, "Hospital not found".to_string()))
}

// ── Doctor Rotation ───────────────────────────────────────────────────────────

/// List doctor rotation schedules for a group
pub async fn list_doctor_rotations(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<DoctorRotationDisplay>>, (StatusCode, String)> {
    // TODO: Query doctor_rotation_schedules for group
    let _ = (group_id, query);
    Ok(Json(vec![]))
}

/// Get rotation schedule for a specific doctor
pub async fn get_doctor_rotation(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(doctor_id): Path<Uuid>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<Vec<DoctorRotationSchedule>>, (StatusCode, String)> {
    // TODO: Query rotation schedule for doctor
    let _ = (doctor_id, query);
    Ok(Json(vec![]))
}

/// Create doctor rotation entry
pub async fn create_doctor_rotation(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<CreateDoctorRotation>,
) -> Result<Json<DoctorRotationSchedule>, (StatusCode, String)> {
    // TODO: Insert doctor_rotation_schedule
    let _ = (group_id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete rotation entry
pub async fn delete_doctor_rotation(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // TODO: Delete rotation entry
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

// ── Group Masters ─────────────────────────────────────────────────────────────

/// List group drug master
pub async fn list_group_drugs(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupDrugMaster>>, (StatusCode, String)> {
    // TODO: Query group_drug_master
    let _ = group_id;
    Ok(Json(vec![]))
}

/// List group test master
pub async fn list_group_tests(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupTestMaster>>, (StatusCode, String)> {
    // TODO: Query group_test_master
    let _ = group_id;
    Ok(Json(vec![]))
}

/// List group tariff master
pub async fn list_group_tariffs(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
) -> Result<Json<Vec<GroupTariffMaster>>, (StatusCode, String)> {
    // TODO: Query group_tariff_master
    let _ = group_id;
    Ok(Json(vec![]))
}

/// List hospital price overrides
pub async fn list_price_overrides(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<HospitalPriceOverride>>, (StatusCode, String)> {
    // TODO: Query hospital_price_overrides for current tenant
    Ok(Json(vec![]))
}

// ── Group Templates ───────────────────────────────────────────────────────────

/// List group templates
pub async fn list_group_templates(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Query(query): Query<PeriodQuery>,
) -> Result<Json<Vec<GroupTemplate>>, (StatusCode, String)> {
    // TODO: Query group_templates, optionally filter by template_type
    let _ = (group_id, query);
    Ok(Json(vec![]))
}

/// Get a group template
pub async fn get_group_template(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GroupTemplate>, (StatusCode, String)> {
    // TODO: Query group_templates by ID
    let _ = id;
    Err((StatusCode::NOT_FOUND, "Template not found".to_string()))
}

/// Create a group template
pub async fn create_group_template(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Json(payload): Json<CreateGroupTemplate>,
) -> Result<Json<GroupTemplate>, (StatusCode, String)> {
    // TODO: Insert group_template
    let _ = (group_id, payload);
    Err((StatusCode::NOT_IMPLEMENTED, "Not implemented".to_string()))
}

/// Delete a group template
pub async fn delete_group_template(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // TODO: Delete group_template
    let _ = id;
    Ok(StatusCode::NO_CONTENT)
}

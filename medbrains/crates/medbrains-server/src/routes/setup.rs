use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::{
    facility::Facility,
    onboarding::{CustomRole, ModuleConfig, TenantSettings},
    patient::{MasterInsuranceProvider, MasterOccupation, MasterRelation, MasterReligion},
    permissions,
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
    validation::{self, ValidationErrors},
};

// ── PUT /api/setup/tenant ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateTenantRequest {
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub pincode: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub registration_no: Option<String>,
    pub accreditation: Option<String>,
    pub timezone: Option<String>,
    pub locale: Option<String>,
    pub currency: Option<String>,
    pub fy_start_month: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TenantSummary {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub city: Option<String>,
    pub pincode: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub registration_no: Option<String>,
    pub accreditation: Option<String>,
    pub timezone: String,
    pub locale: String,
    pub currency: String,
    pub fy_start_month: i32,
}

pub async fn update_tenant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateTenantRequest>,
) -> Result<Json<TenantSummary>, AppError> {
    let mut errors = ValidationErrors::new();

    if let Some(ref email) = body.email {
        validation::validate_optional_email(&mut errors, "email", email);
    }
    if let Some(ref website) = body.website {
        validation::validate_optional_url(&mut errors, "website", website);
    }
    if let Some(ref pincode) = body.pincode {
        validation::validate_optional_pincode(&mut errors, "pincode", pincode);
    }
    if let Some(ref phone) = body.phone {
        validation::validate_optional_phone(&mut errors, "phone", phone);
    }
    if let Some(ref currency) = body.currency {
        if currency.len() != 3 {
            errors.add("currency", "Currency must be exactly 3 characters");
        }
    }
    if let Some(fy) = body.fy_start_month {
        if !(1..=12).contains(&fy) {
            errors.add("fy_start_month", "Month must be between 1 and 12");
        }
    }

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let tenant = sqlx::query_as::<_, TenantSummary>(
        "UPDATE tenants SET \
         address_line1 = COALESCE($1, address_line1), \
         address_line2 = COALESCE($2, address_line2), \
         city = COALESCE($3, city), \
         pincode = COALESCE($4, pincode), \
         phone = COALESCE($5, phone), \
         email = COALESCE($6, email), \
         website = COALESCE($7, website), \
         registration_no = COALESCE($8, registration_no), \
         accreditation = COALESCE($9, accreditation), \
         timezone = COALESCE($10, timezone), \
         locale = COALESCE($11, locale), \
         currency = COALESCE($12, currency), \
         fy_start_month = COALESCE($13, fy_start_month) \
         WHERE id = $14 \
         RETURNING id, code, name, address_line1, address_line2, city, pincode, \
         phone, email, website, registration_no, accreditation, timezone, locale, \
         currency, fy_start_month",
    )
    .bind(&body.address_line1)
    .bind(&body.address_line2)
    .bind(&body.city)
    .bind(&body.pincode)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(&body.website)
    .bind(&body.registration_no)
    .bind(&body.accreditation)
    .bind(&body.timezone)
    .bind(&body.locale)
    .bind(&body.currency)
    .bind(body.fy_start_month)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    tenant.map_or_else(|| Err(AppError::NotFound), |t| Ok(Json(t)))
}

// ── GET /api/setup/tenant ───────────────────────────────────

pub async fn get_tenant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TenantSummary>, AppError> {
    let tenant = sqlx::query_as::<_, TenantSummary>(
        "SELECT id, code, name, address_line1, address_line2, city, pincode, \
         phone, email, website, registration_no, accreditation, timezone, locale, \
         currency, fy_start_month \
         FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?;

    tenant.map_or_else(|| Err(AppError::NotFound), |t| Ok(Json(t)))
}

// ── PUT /api/setup/tenant/geo ───────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateTenantGeoRequest {
    pub country_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub district_id: Option<Uuid>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

// ── Compliance CRUD ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateComplianceRequest {
    pub facility_id: Uuid,
    pub regulatory_body_id: Uuid,
    pub license_number: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ComplianceRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub facility_id: Uuid,
    pub regulatory_body_id: Uuid,
    pub license_number: Option<String>,
    pub status: String,
}

pub async fn create_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateComplianceRequest>,
) -> Result<Json<ComplianceRow>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, ComplianceRow>(
        "INSERT INTO facility_regulatory_compliance \
         (tenant_id, facility_id, regulatory_body_id, license_number, status) \
         VALUES ($1, $2, $3, $4, COALESCE($5, 'pending')) \
         ON CONFLICT (tenant_id, facility_id, regulatory_body_id) \
         DO UPDATE SET license_number = EXCLUDED.license_number, status = EXCLUDED.status \
         RETURNING id, tenant_id, facility_id, regulatory_body_id, license_number, status",
    )
    .bind(claims.tenant_id)
    .bind(body.facility_id)
    .bind(body.regulatory_body_id)
    .bind(&body.license_number)
    .bind(&body.status)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ── Facilities CRUD ─────────────────────────────────────────

pub async fn list_facilities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Facility>>, AppError> {
    require_permission(&claims, permissions::admin::settings::facilities::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, Facility>(
        "SELECT * FROM facilities WHERE tenant_id = $1 ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateFacilityRequest {
    pub code: String,
    pub name: String,
    pub facility_type: String,
    pub parent_id: Option<Uuid>,
    pub address_line1: Option<String>,
    pub city: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub bed_count: Option<i32>,
    pub shared_billing: Option<bool>,
    pub shared_pharmacy: Option<bool>,
    pub shared_lab: Option<bool>,
    pub shared_hr: Option<bool>,
}

pub async fn create_facility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFacilityRequest>,
) -> Result<Json<Facility>, AppError> {
    require_permission(&claims, permissions::admin::settings::facilities::CREATE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if body.facility_type.is_empty() {
        errors.add("facility_type", "Facility type is required");
    }
    if let Some(ref email) = body.email {
        validation::validate_optional_email(&mut errors, "email", email);
    }
    if let Some(ref phone) = body.phone {
        validation::validate_optional_phone(&mut errors, "phone", phone);
    }
    if let Some(bed_count) = body.bed_count {
        if bed_count < 0 {
            errors.add("bed_count", "Bed count cannot be negative");
        }
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let code_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM facilities WHERE tenant_id = $1 AND code = $2)",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .fetch_one(&mut *tx)
    .await?;
    if code_exists {
        errors.add("code", "A facility with this code already exists");
        return Err(AppError::ValidationFailed(errors));
    }

    let facility = sqlx::query_as::<_, Facility>(
        "INSERT INTO facilities \
         (tenant_id, parent_id, code, name, facility_type, address_line1, city, \
          phone, email, bed_count, shared_billing, shared_pharmacy, shared_lab, shared_hr) \
         VALUES ($1, $2, $3, $4, $5::facility_type, $6, $7, $8, $9, \
                 COALESCE($10, 0), COALESCE($11, true), COALESCE($12, true), \
                 COALESCE($13, true), COALESCE($14, true)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.parent_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.facility_type)
    .bind(&body.address_line1)
    .bind(&body.city)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(body.bed_count)
    .bind(body.shared_billing)
    .bind(body.shared_pharmacy)
    .bind(body.shared_lab)
    .bind(body.shared_hr)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(facility))
}

pub async fn update_facility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateFacilityRequest>,
) -> Result<Json<Facility>, AppError> {
    require_permission(&claims, permissions::admin::settings::facilities::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let facility = sqlx::query_as::<_, Facility>(
        "UPDATE facilities SET \
         code = $1, name = $2, facility_type = $3::facility_type, parent_id = $4, \
         address_line1 = $5, city = $6, phone = $7, email = $8, \
         bed_count = COALESCE($9, bed_count), \
         shared_billing = COALESCE($10, shared_billing), \
         shared_pharmacy = COALESCE($11, shared_pharmacy), \
         shared_lab = COALESCE($12, shared_lab), \
         shared_hr = COALESCE($13, shared_hr) \
         WHERE id = $14 AND tenant_id = $15 \
         RETURNING *",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.facility_type)
    .bind(body.parent_id)
    .bind(&body.address_line1)
    .bind(&body.city)
    .bind(&body.phone)
    .bind(&body.email)
    .bind(body.bed_count)
    .bind(body.shared_billing)
    .bind(body.shared_pharmacy)
    .bind(body.shared_lab)
    .bind(body.shared_hr)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    facility.map_or_else(|| Err(AppError::NotFound), |f| Ok(Json(f)))
}

pub async fn delete_facility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::facilities::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM facilities WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Locations CRUD ──────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LocationRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub level: String,
    pub code: String,
    pub name: String,
    pub is_active: bool,
}

pub async fn list_locations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LocationRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, LocationRow>(
        "SELECT id, tenant_id, parent_id, level::text, code, name, is_active \
         FROM locations WHERE tenant_id = $1 ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateLocationRequest {
    pub parent_id: Option<Uuid>,
    pub level: String,
    pub code: String,
    pub name: String,
}

pub async fn create_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLocationRequest>,
) -> Result<Json<LocationRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::CREATE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);

    let valid_levels = ["campus", "building", "floor", "wing", "zone", "room", "bed"];
    if !valid_levels.contains(&body.level.as_str()) {
        errors.add("level", "Invalid location level");
    }

    // Non-campus locations require a parent
    if body.level != "campus" && body.parent_id.is_none() {
        errors.add("parent_id", "Non-campus locations require a parent");
    }

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let code_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM locations WHERE tenant_id = $1 AND code = $2)",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .fetch_one(&mut *tx)
    .await?;
    if code_exists {
        errors.add("code", "A location with this code already exists");
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, LocationRow>(
        "INSERT INTO locations (tenant_id, parent_id, level, code, name) \
         VALUES ($1, $2, $3::location_level, $4, $5) \
         RETURNING id, tenant_id, parent_id, level::text, code, name, is_active",
    )
    .bind(claims.tenant_id)
    .bind(body.parent_id)
    .bind(&body.level)
    .bind(&body.code)
    .bind(&body.name)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateLocationRequest>,
) -> Result<Json<LocationRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, LocationRow>(
        "UPDATE locations SET parent_id = $1, level = $2::location_level, code = $3, name = $4 \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING id, tenant_id, parent_id, level::text, code, name, is_active",
    )
    .bind(body.parent_id)
    .bind(&body.level)
    .bind(&body.code)
    .bind(&body.name)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_location(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM locations WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Departments CRUD ────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepartmentRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub department_type: String,
    pub working_hours: Value,
    pub is_active: bool,
}

pub async fn list_departments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DepartmentRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::departments::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, DepartmentRow>(
        "SELECT id, tenant_id, parent_id, code, name, department_type::text, working_hours, is_active \
         FROM departments WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateDepartmentRequest {
    pub code: String,
    pub name: String,
    pub department_type: String,
    pub parent_id: Option<Uuid>,
    pub working_hours: Option<Value>,
}

pub async fn create_department(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDepartmentRequest>,
) -> Result<Json<DepartmentRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::departments::CREATE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);

    let valid_types = [
        "clinical",
        "pre_clinical",
        "para_clinical",
        "administrative",
        "support",
        "academic",
    ];
    if !valid_types.contains(&body.department_type.as_str()) {
        errors.add("department_type", "Invalid department type");
    }

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let code_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM departments WHERE tenant_id = $1 AND code = $2)",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .fetch_one(&mut *tx)
    .await?;
    if code_exists {
        errors.add("code", "A department with this code already exists");
        return Err(AppError::ValidationFailed(errors));
    }

    let wh = body
        .working_hours
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));
    let row = sqlx::query_as::<_, DepartmentRow>(
        "INSERT INTO departments (tenant_id, parent_id, code, name, department_type, working_hours) \
         VALUES ($1, $2, $3, $4, $5::department_type, $6) \
         RETURNING id, tenant_id, parent_id, code, name, department_type::text, working_hours, is_active",
    )
    .bind(claims.tenant_id)
    .bind(body.parent_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.department_type)
    .bind(&wh)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_department(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateDepartmentRequest>,
) -> Result<Json<DepartmentRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::departments::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let wh = body
        .working_hours
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));
    let row = sqlx::query_as::<_, DepartmentRow>(
        "UPDATE departments SET code = $1, name = $2, department_type = $3::department_type, \
         parent_id = $4, working_hours = $5 \
         WHERE id = $6 AND tenant_id = $7 \
         RETURNING id, tenant_id, parent_id, code, name, department_type::text, working_hours, is_active",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.department_type)
    .bind(body.parent_id)
    .bind(&wh)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_department(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::departments::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM departments WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Roles CRUD ──────────────────────────────────────────────

pub async fn list_roles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CustomRole>>, AppError> {
    require_permission(&claims, permissions::admin::roles::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, CustomRole>(
        "SELECT * FROM roles WHERE tenant_id = $1 ORDER BY is_system DESC, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: Option<Value>,
}

pub async fn create_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRoleRequest>,
) -> Result<Json<CustomRole>, AppError> {
    require_permission(&claims, permissions::admin::roles::CREATE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CustomRole>(
        "INSERT INTO roles (tenant_id, code, name, description, permissions) \
         VALUES ($1, $2, $3, $4, COALESCE($5, '{}')) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.permissions)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ── Setup Users CRUD ────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SetupUserRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub username: String,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub specialization: Option<String>,
    pub medical_registration_number: Option<String>,
    pub qualification: Option<String>,
    pub consultation_fee: Option<rust_decimal::Decimal>,
    pub department_ids: Vec<Uuid>,
    pub is_active: bool,
    pub access_matrix: Value,
}

pub async fn list_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SetupUserRow>>, AppError> {
    require_permission(&claims, permissions::admin::users::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SetupUserRow>(
        "SELECT id, tenant_id, username, email, full_name, role::text, \
         specialization, medical_registration_number, qualification, \
         consultation_fee, department_ids, is_active, access_matrix \
         FROM users WHERE tenant_id = $1 ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

/// GET /api/setup/doctors — returns only users with role = 'doctor' and `is_active` = true
pub async fn list_doctors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SetupUserRow>>, AppError> {
    require_permission(&claims, permissions::admin::users::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SetupUserRow>(
        "SELECT id, tenant_id, username, email, full_name, role::text, \
         specialization, medical_registration_number, qualification, \
         consultation_fee, department_ids, is_active, access_matrix \
         FROM users WHERE tenant_id = $1 AND role = 'doctor' AND is_active = true \
         ORDER BY full_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub role: String,
    pub specialization: Option<String>,
    pub medical_registration_number: Option<String>,
    pub qualification: Option<String>,
    pub consultation_fee: Option<f64>,
    pub department_ids: Option<Vec<Uuid>>,
}

pub async fn create_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateUserRequest>,
) -> Result<Json<SetupUserRow>, AppError> {
    require_permission(&claims, permissions::admin::users::CREATE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_username(&mut errors, "username", &body.username);
    validation::validate_email(&mut errors, "email", &body.email);
    validation::validate_password(&mut errors, "password", &body.password);
    validation::validate_name(&mut errors, "full_name", &body.full_name);
    if body.role.is_empty() {
        errors.add("role", "Role is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
        .to_string();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let existing_username: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND username = $2)",
    )
    .bind(claims.tenant_id)
    .bind(&body.username)
    .fetch_one(&mut *tx)
    .await?;
    if existing_username {
        errors.add("username", "This username is already taken");
    }

    let existing_email: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND email = $2)",
    )
    .bind(claims.tenant_id)
    .bind(&body.email)
    .fetch_one(&mut *tx)
    .await?;
    if existing_email {
        errors.add("email", "This email is already in use");
    }

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let fee = body
        .consultation_fee
        .and_then(|f| rust_decimal::Decimal::try_from(f).ok());
    let dept_ids = body.department_ids.as_deref().unwrap_or(&[]);

    let row = sqlx::query_as::<_, SetupUserRow>(
        "INSERT INTO users \
         (tenant_id, username, email, password_hash, full_name, role, \
          specialization, medical_registration_number, qualification, \
          consultation_fee, department_ids) \
         VALUES ($1, $2, $3, $4, $5, $6::user_role, $7, $8, $9, $10, $11) \
         RETURNING id, tenant_id, username, email, full_name, role::text, \
         specialization, medical_registration_number, qualification, \
         consultation_fee, department_ids, is_active, access_matrix",
    )
    .bind(claims.tenant_id)
    .bind(&body.username)
    .bind(&body.email)
    .bind(&password_hash)
    .bind(&body.full_name)
    .bind(&body.role)
    .bind(&body.specialization)
    .bind(&body.medical_registration_number)
    .bind(&body.qualification)
    .bind(fee)
    .bind(dept_ids)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUserRequest>,
) -> Result<Json<SetupUserRow>, AppError> {
    require_permission(&claims, permissions::admin::users::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let fee = body
        .consultation_fee
        .and_then(|f| rust_decimal::Decimal::try_from(f).ok());
    let dept_ids = body.department_ids.as_deref().unwrap_or(&[]);

    let row = sqlx::query_as::<_, SetupUserRow>(
        "UPDATE users SET \
         full_name = COALESCE($1, full_name), email = COALESCE($2, email), \
         role = COALESCE($3::user_role, role), specialization = $4, \
         medical_registration_number = $5, qualification = $6, \
         consultation_fee = $7, department_ids = $8, \
         is_active = COALESCE($11, is_active), \
         perm_version = perm_version + 1 \
         WHERE id = $9 AND tenant_id = $10 \
         RETURNING id, tenant_id, username, email, full_name, role::text, \
         specialization, medical_registration_number, qualification, \
         consultation_fee, department_ids, is_active, access_matrix",
    )
    .bind(&body.full_name)
    .bind(&body.email)
    .bind(&body.role)
    .bind(&body.specialization)
    .bind(&body.medical_registration_number)
    .bind(&body.qualification)
    .bind(fee)
    .bind(dept_ids)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    pub specialization: Option<String>,
    pub medical_registration_number: Option<String>,
    pub qualification: Option<String>,
    pub consultation_fee: Option<f64>,
    pub department_ids: Option<Vec<Uuid>>,
    pub is_active: Option<bool>,
}

pub async fn delete_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::users::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

pub async fn update_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateRoleRequest>,
) -> Result<Json<CustomRole>, AppError> {
    require_permission(&claims, permissions::admin::roles::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, CustomRole>(
        "UPDATE roles SET code = $1, name = $2, description = $3, \
         permissions = COALESCE($4, permissions) \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.permissions)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::roles::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM roles WHERE id = $1 AND tenant_id = $2 AND is_system = false")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Role Permissions ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateRolePermissionsRequest {
    pub permissions: Vec<String>,
}

pub async fn update_role_permissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRolePermissionsRequest>,
) -> Result<Json<CustomRole>, AppError> {
    require_permission(&claims, permissions::admin::roles::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Store permissions as a JSON array
    let perms_json = Value::Array(
        body.permissions
            .iter()
            .map(|s| Value::String(s.clone()))
            .collect(),
    );

    let row = sqlx::query_as::<_, CustomRole>(
        "UPDATE roles SET permissions = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(&perms_json)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    // Bump perm_version for all users with this role
    if let Some(ref role) = row {
        sqlx::query(
            "UPDATE users SET perm_version = perm_version + 1 \
             WHERE tenant_id = $1 AND role::text = $2",
        )
        .bind(claims.tenant_id)
        .bind(&role.code)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ── User Access Matrix ─────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateUserAccessMatrixRequest {
    pub extra_permissions: Vec<String>,
    pub denied_permissions: Vec<String>,
    pub field_access: Option<std::collections::HashMap<String, String>>,
    /// Per-user widget access overrides: template UUID → "visible" | "hidden".
    pub widget_access: Option<std::collections::HashMap<String, String>>,
}

pub async fn update_user_access_matrix(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUserAccessMatrixRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::users::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut matrix = serde_json::json!({
        "extra": body.extra_permissions,
        "denied": body.denied_permissions,
    });

    if let Some(fa) = &body.field_access {
        matrix["field_access"] =
            serde_json::to_value(fa).unwrap_or_else(|_| Value::Object(serde_json::Map::new()));
    }

    if let Some(wa) = &body.widget_access {
        matrix["widget_access"] =
            serde_json::to_value(wa).unwrap_or_else(|_| Value::Object(serde_json::Map::new()));
    }

    sqlx::query(
        "UPDATE users SET access_matrix = $1, perm_version = perm_version + 1 \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(&matrix)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Role Field Access Defaults ──────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateRoleFieldAccessRequest {
    pub field_access: std::collections::HashMap<String, String>,
}

pub async fn update_role_field_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRoleFieldAccessRequest>,
) -> Result<Json<CustomRole>, AppError> {
    require_permission(&claims, permissions::admin::roles::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let fa_json = serde_json::to_value(&body.field_access)
        .unwrap_or_else(|_| Value::Object(serde_json::Map::new()));

    let row = sqlx::query_as::<_, CustomRole>(
        "UPDATE roles SET field_access_defaults = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(&fa_json)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    // Bump perm_version for all users with this role
    if let Some(ref role) = row {
        sqlx::query(
            "UPDATE users SET perm_version = perm_version + 1 \
             WHERE tenant_id = $1 AND role::text = $2",
        )
        .bind(claims.tenant_id)
        .bind(&role.code)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ── Role Widget Access Defaults ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateRoleWidgetAccessRequest {
    /// Map of widget template UUID → "visible" | "hidden".
    pub widget_access: std::collections::HashMap<String, String>,
}

pub async fn update_role_widget_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRoleWidgetAccessRequest>,
) -> Result<Json<CustomRole>, AppError> {
    require_permission(&claims, permissions::admin::roles::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let wa_json = serde_json::to_value(&body.widget_access)
        .unwrap_or_else(|_| Value::Object(serde_json::Map::new()));

    let row = sqlx::query_as::<_, CustomRole>(
        "UPDATE roles SET widget_access_defaults = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(&wa_json)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    // Bump perm_version for all users with this role
    if let Some(ref role) = row {
        sqlx::query(
            "UPDATE users SET perm_version = perm_version + 1 \
             WHERE tenant_id = $1 AND role::text = $2",
        )
        .bind(claims.tenant_id)
        .bind(&role.code)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ── Modules CRUD ────────────────────────────────────────────

pub async fn list_modules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ModuleConfig>>, AppError> {
    require_permission(&claims, permissions::admin::settings::modules::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, ModuleConfig>(
        "SELECT * FROM module_config WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateModuleRequest {
    pub status: String,
}

pub async fn update_module(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
    Json(body): Json<UpdateModuleRequest>,
) -> Result<Json<ModuleConfig>, AppError> {
    require_permission(&claims, permissions::admin::settings::modules::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, ModuleConfig>(
        "UPDATE module_config SET status = $1::module_status \
         WHERE tenant_id = $2 AND code = $3 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(claims.tenant_id)
    .bind(&code)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ── Sequences ───────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SequenceRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub seq_type: String,
    pub prefix: String,
    pub current_val: i64,
    pub pad_width: i32,
}

pub async fn list_sequences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SequenceRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::sequences::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, SequenceRow>(
        "SELECT id, tenant_id, seq_type, prefix, current_val, pad_width \
         FROM sequences WHERE tenant_id = $1 ORDER BY seq_type",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSequenceRequest {
    pub prefix: Option<String>,
    pub pad_width: Option<i32>,
}

pub async fn update_sequence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(seq_type): Path<String>,
    Json(body): Json<UpdateSequenceRequest>,
) -> Result<Json<SequenceRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::sequences::MANAGE)?;
    let mut errors = ValidationErrors::new();
    if let Some(ref prefix) = body.prefix {
        validation::validate_prefix(&mut errors, "prefix", prefix);
    }
    if let Some(pad_width) = body.pad_width {
        validation::validate_pad_width(&mut errors, "pad_width", pad_width);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SequenceRow>(
        "UPDATE sequences SET \
         prefix = COALESCE($1, prefix), pad_width = COALESCE($2, pad_width) \
         WHERE tenant_id = $3 AND seq_type = $4 \
         RETURNING id, tenant_id, seq_type, prefix, current_val, pad_width",
    )
    .bind(&body.prefix)
    .bind(body.pad_width)
    .bind(claims.tenant_id)
    .bind(&seq_type)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ── Branding ────────────────────────────────────────────────

pub async fn get_branding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TenantSettings>>, AppError> {
    require_permission(&claims, permissions::admin::settings::branding::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, TenantSettings>(
        "SELECT * FROM tenant_settings WHERE tenant_id = $1 AND category = 'branding' \
         ORDER BY key",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateBrandingRequest {
    pub key: String,
    pub value: Value,
}

pub async fn update_branding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateBrandingRequest>,
) -> Result<Json<TenantSettings>, AppError> {
    require_permission(&claims, permissions::admin::settings::branding::MANAGE)?;
    let mut errors = ValidationErrors::new();
    if body.key == "primary_color" || body.key == "secondary_color" {
        if let Some(color_str) = body.value.as_str() {
            validation::validate_hex_color(&mut errors, &body.key, color_str);
        }
    }
    if body.key == "logo_url" {
        if let Some(url_str) = body.value.as_str() {
            validation::validate_optional_url(&mut errors, "logo_url", url_str);
        }
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TenantSettings>(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'branding', $2, $3) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.key)
    .bind(&body.value)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ── Sequence create/delete ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateSequenceRequest {
    pub seq_type: String,
    pub prefix: String,
    pub pad_width: i32,
}

pub async fn create_sequence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSequenceRequest>,
) -> Result<Json<SequenceRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::sequences::MANAGE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_prefix(&mut errors, "prefix", &body.prefix);
    validation::validate_pad_width(&mut errors, "pad_width", body.pad_width);
    if body.seq_type.is_empty() {
        errors.add("seq_type", "Sequence type is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, SequenceRow>(
        "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
         VALUES ($1, $2, $3, 0, $4) \
         ON CONFLICT (tenant_id, seq_type) \
         DO UPDATE SET prefix = EXCLUDED.prefix, pad_width = EXCLUDED.pad_width \
         RETURNING id, tenant_id, seq_type, prefix, current_val, pad_width",
    )
    .bind(claims.tenant_id)
    .bind(&body.seq_type)
    .bind(&body.prefix)
    .bind(body.pad_width)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn delete_sequence(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(seq_type): Path<String>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::sequences::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM sequences WHERE tenant_id = $1 AND seq_type = $2")
        .bind(claims.tenant_id)
        .bind(&seq_type)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Services CRUD ────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ServiceRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub service_type: String,
    pub base_price: rust_decimal::Decimal,
    pub department_id: Option<Uuid>,
    pub description: Option<String>,
    pub is_active: bool,
}

pub async fn list_services(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ServiceRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::services::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, ServiceRow>(
        "SELECT id, tenant_id, code, name, service_type::text, base_price, department_id, description, is_active \
         FROM services WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateServiceRequest {
    pub code: String,
    pub name: String,
    pub service_type: String,
    pub base_price: Option<f64>,
    pub department_id: Option<Uuid>,
    pub description: Option<String>,
}

pub async fn create_service(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateServiceRequest>,
) -> Result<Json<ServiceRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::services::CREATE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let price = body
        .base_price
        .map(|f| rust_decimal::Decimal::try_from(f).unwrap_or_default())
        .unwrap_or_default();

    let row = sqlx::query_as::<_, ServiceRow>(
        "INSERT INTO services (tenant_id, code, name, service_type, base_price, department_id, description) \
         VALUES ($1, $2, $3, $4::service_type, $5, $6, $7) \
         RETURNING id, tenant_id, code, name, service_type::text, base_price, department_id, description, is_active",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.service_type)
    .bind(price)
    .bind(body.department_id)
    .bind(&body.description)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_service(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateServiceRequest>,
) -> Result<Json<ServiceRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::services::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let price = body
        .base_price
        .map(|f| rust_decimal::Decimal::try_from(f).unwrap_or_default())
        .unwrap_or_default();

    let row = sqlx::query_as::<_, ServiceRow>(
        "UPDATE services SET code = $1, name = $2, service_type = $3::service_type, \
         base_price = $4, department_id = $5, description = $6 \
         WHERE id = $7 AND tenant_id = $8 \
         RETURNING id, tenant_id, code, name, service_type::text, base_price, department_id, description, is_active",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.service_type)
    .bind(price)
    .bind(body.department_id)
    .bind(&body.description)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_service(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::services::DELETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM services WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Bed Types CRUD ───────────────────────────────────────────

use axum::extract::Query;
use medbrains_core::geo::GeoCountry;
use medbrains_core::onboarding::{BedType, PaymentMethod, TaxCategory};

pub async fn list_bed_types(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BedType>>, AppError> {
    require_permission(&claims, permissions::admin::settings::bed_types::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows =
        sqlx::query_as::<_, BedType>("SELECT * FROM bed_types WHERE tenant_id = $1 ORDER BY name")
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateBedTypeRequest {
    pub code: String,
    pub name: String,
    pub daily_rate: f64,
    pub description: Option<String>,
}

pub async fn create_bed_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBedTypeRequest>,
) -> Result<Json<BedType>, AppError> {
    require_permission(&claims, permissions::admin::settings::bed_types::MANAGE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let rate = rust_decimal::Decimal::try_from(body.daily_rate).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, BedType>(
        "INSERT INTO bed_types (tenant_id, code, name, daily_rate, description) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(rate)
    .bind(&body.description)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_bed_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateBedTypeRequest>,
) -> Result<Json<BedType>, AppError> {
    require_permission(&claims, permissions::admin::settings::bed_types::MANAGE)?;
    let rate = rust_decimal::Decimal::try_from(body.daily_rate).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, BedType>(
        "UPDATE bed_types SET code = $1, name = $2, daily_rate = $3, description = $4 \
         WHERE id = $5 AND tenant_id = $6 RETURNING *",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(rate)
    .bind(&body.description)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_bed_type(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::bed_types::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM bed_types WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Tax Categories CRUD ──────────────────────────────────────

pub async fn list_tax_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TaxCategory>>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, TaxCategory>(
        "SELECT * FROM tax_categories WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateTaxCategoryRequest {
    pub code: String,
    pub name: String,
    pub rate_percent: f64,
    pub applicability: String,
    pub description: Option<String>,
}

pub async fn create_tax_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTaxCategoryRequest>,
) -> Result<Json<TaxCategory>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let rate = rust_decimal::Decimal::try_from(body.rate_percent).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TaxCategory>(
        "INSERT INTO tax_categories (tenant_id, code, name, rate_percent, applicability, description) \
         VALUES ($1, $2, $3, $4, $5::tax_applicability, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(rate)
    .bind(&body.applicability)
    .bind(&body.description)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_tax_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateTaxCategoryRequest>,
) -> Result<Json<TaxCategory>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let rate = rust_decimal::Decimal::try_from(body.rate_percent).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TaxCategory>(
        "UPDATE tax_categories SET code = $1, name = $2, rate_percent = $3, \
         applicability = $4::tax_applicability, description = $5 \
         WHERE id = $6 AND tenant_id = $7 RETURNING *",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(rate)
    .bind(&body.applicability)
    .bind(&body.description)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_tax_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM tax_categories WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Payment Methods CRUD ─────────────────────────────────────

pub async fn list_payment_methods(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PaymentMethod>>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, PaymentMethod>(
        "SELECT * FROM payment_methods WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentMethodRequest {
    pub code: String,
    pub name: String,
    pub is_default: Option<bool>,
}

pub async fn create_payment_method(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePaymentMethodRequest>,
) -> Result<Json<PaymentMethod>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PaymentMethod>(
        "INSERT INTO payment_methods (tenant_id, code, name, is_default) \
         VALUES ($1, $2, $3, COALESCE($4, false)) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.is_default)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

pub async fn update_payment_method(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreatePaymentMethodRequest>,
) -> Result<Json<PaymentMethod>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, PaymentMethod>(
        "UPDATE payment_methods SET code = $1, name = $2, is_default = COALESCE($3, is_default) \
         WHERE id = $4 AND tenant_id = $5 RETURNING *",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(body.is_default)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_payment_method(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::billing_tax::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("DELETE FROM payment_methods WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Generic Tenant Settings ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SettingsQuery {
    pub category: String,
}

pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SettingsQuery>,
) -> Result<Json<Vec<TenantSettings>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, TenantSettings>(
        "SELECT * FROM tenant_settings WHERE tenant_id = $1 AND category = $2 \
         ORDER BY key",
    )
    .bind(claims.tenant_id)
    .bind(&params.category)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingRequest {
    pub category: String,
    pub key: String,
    pub value: Value,
}

pub async fn update_setting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateSettingRequest>,
) -> Result<Json<TenantSettings>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, TenantSettings>(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.category)
    .bind(&body.key)
    .bind(&body.value)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ── Secure Device / Integration Settings ────────────────────

const DEVICE_SETTINGS_CATEGORY: &str = "device_integrations";
const MASKED_SECRET_VALUE: &str = "********";
const DEVICE_SETTINGS_KEYS: &[&str] = &[
    "pacs_dicom",
    "lab_interface",
    "biometric",
    "printing",
    "queue_display",
];

#[derive(Debug, Serialize)]
pub struct SecureTenantSettingRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub category: String,
    pub key: String,
    pub value: Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub has_secrets: bool,
    pub masked_secret_fields: Vec<String>,
    pub is_configured: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSecureDeviceSettingRequest {
    pub key: String,
    pub value: Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct PacsDicomDeviceConfig {
    enabled: bool,
    host: String,
    port: Option<u16>,
    local_ae_title: String,
    remote_ae_title: String,
    username: String,
    password: String,
    worklist_enabled: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PacsDicomDeviceConfigInput {
    enabled: Option<bool>,
    host: Option<String>,
    port: Option<u16>,
    local_ae_title: Option<String>,
    remote_ae_title: Option<String>,
    username: Option<String>,
    password: Option<String>,
    worklist_enabled: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct LabInterfaceDeviceConfig {
    enabled: bool,
    protocol: String,
    host: String,
    port: Option<u16>,
    analyzer_code: String,
    username: String,
    password: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct LabInterfaceDeviceConfigInput {
    enabled: Option<bool>,
    protocol: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    analyzer_code: Option<String>,
    username: Option<String>,
    password: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct BiometricDeviceConfig {
    enabled: bool,
    vendor: String,
    service_url: String,
    device_id: String,
    api_key: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct BiometricDeviceConfigInput {
    enabled: Option<bool>,
    vendor: Option<String>,
    service_url: Option<String>,
    device_id: Option<String>,
    api_key: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct PrintingDeviceConfig {
    enabled: bool,
    agent_url: String,
    default_printer: String,
    label_printer: String,
    api_key: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct PrintingDeviceConfigInput {
    enabled: Option<bool>,
    agent_url: Option<String>,
    default_printer: Option<String>,
    label_printer: Option<String>,
    api_key: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
struct QueueDisplayDeviceConfig {
    enabled: bool,
    display_client_url: String,
    location_code: String,
    websocket_channel: String,
    api_key: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct QueueDisplayDeviceConfigInput {
    enabled: Option<bool>,
    display_client_url: Option<String>,
    location_code: Option<String>,
    websocket_channel: Option<String>,
    api_key: Option<String>,
}

pub async fn get_secure_device_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SecureTenantSettingRow>>, AppError> {
    require_permission(&claims, permissions::integration::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, TenantSettings>(
        "SELECT * FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 \
         ORDER BY key",
    )
    .bind(claims.tenant_id)
    .bind(DEVICE_SETTINGS_CATEGORY)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let filtered = rows
        .into_iter()
        .filter(|row| DEVICE_SETTINGS_KEYS.contains(&row.key.as_str()))
        .map(mask_secure_setting_row)
        .collect();

    Ok(Json(filtered))
}

pub async fn update_secure_device_setting(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateSecureDeviceSettingRequest>,
) -> Result<Json<SecureTenantSettingRow>, AppError> {
    require_permission(&claims, permissions::integration::UPDATE)?;

    let key = body.key.trim();
    if !DEVICE_SETTINGS_KEYS.contains(&key) {
        let mut errors = ValidationErrors::new();
        errors.add("key", "Unsupported secure device setting key");
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let existing = sqlx::query_as::<_, TenantSettings>(
        "SELECT * FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 AND key = $3",
    )
    .bind(claims.tenant_id)
    .bind(DEVICE_SETTINGS_CATEGORY)
    .bind(key)
    .fetch_optional(&mut *tx)
    .await?;

    let canonical_value =
        normalize_secure_device_setting(key, existing.as_ref().map(|row| &row.value), &body.value)?;

    let row = sqlx::query_as::<_, TenantSettings>(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value, updated_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(DEVICE_SETTINGS_CATEGORY)
    .bind(key)
    .bind(&canonical_value)
    .fetch_one(&mut *tx)
    .await?;

    let old_values = existing
        .as_ref()
        .map(|row| mask_value_for_key(key, &row.value).0);
    let new_values = mask_value_for_key(key, &canonical_value).0;
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "secure_device_setting_updated",
            entity_type: "tenant_setting",
            entity_id: Some(row.id),
            old_values: old_values.as_ref(),
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;

    Ok(Json(mask_secure_setting_row(row)))
}

fn parse_partial_config<T: DeserializeOwned>(
    value: &Value,
    field_name: &str,
) -> Result<T, AppError> {
    serde_json::from_value::<T>(value.clone()).map_err(|_| {
        let mut errors = ValidationErrors::new();
        errors.add(
            field_name,
            "Invalid configuration payload for this device connector",
        );
        AppError::ValidationFailed(errors)
    })
}

fn merge_secret(previous: &str, incoming: Option<String>) -> String {
    match incoming {
        Some(value) if value == MASKED_SECRET_VALUE => previous.to_owned(),
        Some(value) => value,
        None => previous.to_owned(),
    }
}

fn validate_plain_text(errors: &mut ValidationErrors, field: &str, value: &str, max_len: usize) {
    if value.len() > max_len {
        errors.add(field, format!("Must be at most {max_len} characters"));
    }
    validation::validate_no_html(errors, field, value);
}

fn validate_protocol(errors: &mut ValidationErrors, field: &str, value: &str) {
    let allowed = ["hl7", "astm", "file_drop"];
    if !value.is_empty() && !allowed.contains(&value) {
        errors.add(field, "Protocol must be one of hl7, astm, or file_drop");
    }
}

fn validate_configured_value(value: &Value) -> bool {
    value.as_object().is_some_and(|obj| {
        obj.values().any(|field| match field {
            Value::Bool(true) => true,
            Value::Number(_) => true,
            Value::String(text) => !text.is_empty() && text != MASKED_SECRET_VALUE,
            _ => false,
        })
    })
}

fn parse_existing_config<T>(existing: Option<&Value>) -> T
where
    T: Default + DeserializeOwned,
{
    existing
        .and_then(|value| serde_json::from_value::<T>(value.clone()).ok())
        .unwrap_or_default()
}

fn secret_fields_for_key(key: &str) -> &'static [&'static str] {
    match key {
        "pacs_dicom" | "lab_interface" => &["password"],
        "biometric" | "printing" | "queue_display" => &["api_key"],
        _ => &[],
    }
}

fn mask_value_for_key(key: &str, value: &Value) -> (Value, bool, Vec<String>) {
    let Some(obj) = value.as_object() else {
        return (value.clone(), false, Vec::new());
    };

    let mut masked = obj.clone();
    let mut masked_fields = Vec::new();

    for field in secret_fields_for_key(key) {
        if obj
            .get(*field)
            .and_then(Value::as_str)
            .is_some_and(|value| !value.is_empty())
        {
            masked.insert(
                (*field).to_owned(),
                Value::String(MASKED_SECRET_VALUE.to_owned()),
            );
            masked_fields.push((*field).to_owned());
        }
    }

    (
        Value::Object(masked),
        !masked_fields.is_empty(),
        masked_fields,
    )
}

fn mask_secure_setting_row(row: TenantSettings) -> SecureTenantSettingRow {
    let (masked_value, has_secrets, masked_secret_fields) =
        mask_value_for_key(&row.key, &row.value);

    SecureTenantSettingRow {
        id: row.id,
        tenant_id: row.tenant_id,
        category: row.category,
        key: row.key,
        value: masked_value.clone(),
        created_at: row.created_at,
        updated_at: row.updated_at,
        has_secrets,
        masked_secret_fields,
        is_configured: validate_configured_value(&masked_value),
    }
}

fn normalize_secure_device_setting(
    key: &str,
    existing: Option<&Value>,
    incoming: &Value,
) -> Result<Value, AppError> {
    let mut errors = ValidationErrors::new();

    let normalized = match key {
        "pacs_dicom" => {
            let input: PacsDicomDeviceConfigInput = parse_partial_config(incoming, "value")?;
            let previous: PacsDicomDeviceConfig = parse_existing_config(existing);
            let merged = PacsDicomDeviceConfig {
                enabled: input.enabled.unwrap_or(previous.enabled),
                host: input.host.unwrap_or(previous.host),
                port: input.port.or(previous.port),
                local_ae_title: input.local_ae_title.unwrap_or(previous.local_ae_title),
                remote_ae_title: input.remote_ae_title.unwrap_or(previous.remote_ae_title),
                username: input.username.unwrap_or(previous.username),
                password: merge_secret(&previous.password, input.password),
                worklist_enabled: input.worklist_enabled.unwrap_or(previous.worklist_enabled),
            };
            validate_plain_text(&mut errors, "host", &merged.host, 255);
            validate_plain_text(&mut errors, "local_ae_title", &merged.local_ae_title, 64);
            validate_plain_text(&mut errors, "remote_ae_title", &merged.remote_ae_title, 64);
            validate_plain_text(&mut errors, "username", &merged.username, 120);
            validate_plain_text(&mut errors, "password", &merged.password, 200);
            serde_json::to_value(merged)
                .map_err(|e| AppError::Internal(format!("serialize pacs_dicom config: {e}")))?
        }
        "lab_interface" => {
            let input: LabInterfaceDeviceConfigInput = parse_partial_config(incoming, "value")?;
            let previous: LabInterfaceDeviceConfig = parse_existing_config(existing);
            let merged = LabInterfaceDeviceConfig {
                enabled: input.enabled.unwrap_or(previous.enabled),
                protocol: input.protocol.unwrap_or(previous.protocol),
                host: input.host.unwrap_or(previous.host),
                port: input.port.or(previous.port),
                analyzer_code: input.analyzer_code.unwrap_or(previous.analyzer_code),
                username: input.username.unwrap_or(previous.username),
                password: merge_secret(&previous.password, input.password),
            };
            validate_protocol(&mut errors, "protocol", &merged.protocol);
            validate_plain_text(&mut errors, "host", &merged.host, 255);
            validate_plain_text(&mut errors, "analyzer_code", &merged.analyzer_code, 64);
            validate_plain_text(&mut errors, "username", &merged.username, 120);
            validate_plain_text(&mut errors, "password", &merged.password, 200);
            serde_json::to_value(merged)
                .map_err(|e| AppError::Internal(format!("serialize lab_interface config: {e}")))?
        }
        "biometric" => {
            let input: BiometricDeviceConfigInput = parse_partial_config(incoming, "value")?;
            let previous: BiometricDeviceConfig = parse_existing_config(existing);
            let merged = BiometricDeviceConfig {
                enabled: input.enabled.unwrap_or(previous.enabled),
                vendor: input.vendor.unwrap_or(previous.vendor),
                service_url: input.service_url.unwrap_or(previous.service_url),
                device_id: input.device_id.unwrap_or(previous.device_id),
                api_key: merge_secret(&previous.api_key, input.api_key),
            };
            validate_plain_text(&mut errors, "vendor", &merged.vendor, 120);
            validation::validate_optional_url(&mut errors, "service_url", &merged.service_url);
            validate_plain_text(&mut errors, "device_id", &merged.device_id, 120);
            validate_plain_text(&mut errors, "api_key", &merged.api_key, 200);
            serde_json::to_value(merged)
                .map_err(|e| AppError::Internal(format!("serialize biometric config: {e}")))?
        }
        "printing" => {
            let input: PrintingDeviceConfigInput = parse_partial_config(incoming, "value")?;
            let previous: PrintingDeviceConfig = parse_existing_config(existing);
            let merged = PrintingDeviceConfig {
                enabled: input.enabled.unwrap_or(previous.enabled),
                agent_url: input.agent_url.unwrap_or(previous.agent_url),
                default_printer: input.default_printer.unwrap_or(previous.default_printer),
                label_printer: input.label_printer.unwrap_or(previous.label_printer),
                api_key: merge_secret(&previous.api_key, input.api_key),
            };
            validation::validate_optional_url(&mut errors, "agent_url", &merged.agent_url);
            validate_plain_text(&mut errors, "default_printer", &merged.default_printer, 120);
            validate_plain_text(&mut errors, "label_printer", &merged.label_printer, 120);
            validate_plain_text(&mut errors, "api_key", &merged.api_key, 200);
            serde_json::to_value(merged)
                .map_err(|e| AppError::Internal(format!("serialize printing config: {e}")))?
        }
        "queue_display" => {
            let input: QueueDisplayDeviceConfigInput = parse_partial_config(incoming, "value")?;
            let previous: QueueDisplayDeviceConfig = parse_existing_config(existing);
            let merged = QueueDisplayDeviceConfig {
                enabled: input.enabled.unwrap_or(previous.enabled),
                display_client_url: input
                    .display_client_url
                    .unwrap_or(previous.display_client_url),
                location_code: input.location_code.unwrap_or(previous.location_code),
                websocket_channel: input
                    .websocket_channel
                    .unwrap_or(previous.websocket_channel),
                api_key: merge_secret(&previous.api_key, input.api_key),
            };
            validation::validate_optional_url(
                &mut errors,
                "display_client_url",
                &merged.display_client_url,
            );
            validate_plain_text(&mut errors, "location_code", &merged.location_code, 64);
            validate_plain_text(
                &mut errors,
                "websocket_channel",
                &merged.websocket_channel,
                120,
            );
            validate_plain_text(&mut errors, "api_key", &merged.api_key, 200);
            serde_json::to_value(merged)
                .map_err(|e| AppError::Internal(format!("serialize queue_display config: {e}")))?
        }
        _ => {
            errors.add("key", "Unsupported secure device setting key");
            Value::Null
        }
    };

    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    Ok(normalized)
}

// ── Helper: upsert a single tenant setting within a transaction ──

async fn upsert_setting_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    category: &str,
    key: &str,
    value: &str,
) -> Result<(), AppError> {
    let json_val = Value::String(value.to_owned());
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(tenant_id)
    .bind(category)
    .bind(key)
    .bind(&json_val)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

// ── PUT /api/setup/tenant/geo (enhanced — auto-populates defaults) ──

pub async fn update_tenant_geo_with_presets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateTenantGeoRequest>,
) -> Result<Json<Value>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Save geo IDs
    sqlx::query(
        "UPDATE tenants SET \
         country_id = $1, state_id = $2, district_id = $3, \
         latitude = $4, longitude = $5 \
         WHERE id = $6",
    )
    .bind(body.country_id)
    .bind(body.state_id)
    .bind(body.district_id)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // If country changed, auto-populate defaults from country presets
    let mut defaults_applied = false;
    if let Some(country_id) = body.country_id {
        let country = sqlx::query_as::<_, GeoCountry>("SELECT * FROM geo_countries WHERE id = $1")
            .bind(country_id)
            .fetch_optional(&mut *tx)
            .await?;

        if let Some(c) = country {
            // Update tenant-level fields
            sqlx::query(
                "UPDATE tenants SET \
                 timezone = $1, currency = COALESCE($2, currency), \
                 locale = $3 \
                 WHERE id = $4",
            )
            .bind(&c.default_timezone)
            .bind(&c.currency)
            .bind(&c.default_locale)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            // Determine units from measurement system
            let is_imperial = c.measurement_system == "imperial";
            let temp_unit = if is_imperial { "fahrenheit" } else { "celsius" };
            let weight_unit = if is_imperial { "lbs" } else { "kg" };
            let height_unit = if is_imperial { "in" } else { "cm" };

            // Upsert units settings
            upsert_setting_in_tx(
                &mut tx,
                claims.tenant_id,
                "units",
                "measurement_system",
                &c.measurement_system,
            )
            .await?;
            upsert_setting_in_tx(
                &mut tx,
                claims.tenant_id,
                "units",
                "temperature_unit",
                temp_unit,
            )
            .await?;
            upsert_setting_in_tx(
                &mut tx,
                claims.tenant_id,
                "units",
                "weight_unit",
                weight_unit,
            )
            .await?;
            upsert_setting_in_tx(
                &mut tx,
                claims.tenant_id,
                "units",
                "height_unit",
                height_unit,
            )
            .await?;

            // Upsert locale settings
            upsert_setting_in_tx(
                &mut tx,
                claims.tenant_id,
                "locale",
                "date_format",
                &c.date_format,
            )
            .await?;

            defaults_applied = true;
        }
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "defaults_applied": defaults_applied,
    })))
}

// ══════════════════════════════════════════════════════════
//  Clinical Masters CRUD
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateMasterItemRequest {
    pub code: String,
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMasterItemRequest {
    pub code: Option<String>,
    pub name: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

// ── Religions ─────────────────────────────────────────────

pub async fn list_master_religions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterReligion>>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::LIST,
    )?;
    let rows = sqlx::query_as::<_, MasterReligion>(
        "SELECT * FROM master_religions \
         WHERE (tenant_id = $1 OR tenant_id IS NULL) \
         ORDER BY sort_order, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_master_religion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMasterItemRequest>,
) -> Result<Json<MasterReligion>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::CREATE,
    )?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, MasterReligion>(
        "INSERT INTO master_religions (tenant_id, code, name, sort_order) \
         VALUES ($1, $2, $3, $4) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.code.trim())
    .bind(body.name.trim())
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_master_religion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMasterItemRequest>,
) -> Result<Json<MasterReligion>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::UPDATE,
    )?;
    let row = sqlx::query_as::<_, MasterReligion>(
        "UPDATE master_religions SET \
         code = COALESCE($1, code), \
         name = COALESCE($2, name), \
         sort_order = COALESCE($3, sort_order), \
         is_active = COALESCE($4, is_active) \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(body.code.as_deref().map(str::trim))
    .bind(body.name.as_deref().map(str::trim))
    .bind(body.sort_order)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_master_religion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::DELETE,
    )?;
    let result = sqlx::query("DELETE FROM master_religions WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Occupations ───────────────────────────────────────────

pub async fn list_master_occupations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterOccupation>>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::LIST,
    )?;
    let rows = sqlx::query_as::<_, MasterOccupation>(
        "SELECT * FROM master_occupations \
         WHERE (tenant_id = $1 OR tenant_id IS NULL) \
         ORDER BY sort_order, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_master_occupation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMasterItemRequest>,
) -> Result<Json<MasterOccupation>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::CREATE,
    )?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, MasterOccupation>(
        "INSERT INTO master_occupations (tenant_id, code, name, sort_order) \
         VALUES ($1, $2, $3, $4) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.code.trim())
    .bind(body.name.trim())
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_master_occupation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMasterItemRequest>,
) -> Result<Json<MasterOccupation>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::UPDATE,
    )?;
    let row = sqlx::query_as::<_, MasterOccupation>(
        "UPDATE master_occupations SET \
         code = COALESCE($1, code), \
         name = COALESCE($2, name), \
         sort_order = COALESCE($3, sort_order), \
         is_active = COALESCE($4, is_active) \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(body.code.as_deref().map(str::trim))
    .bind(body.name.as_deref().map(str::trim))
    .bind(body.sort_order)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_master_occupation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::DELETE,
    )?;
    let result = sqlx::query("DELETE FROM master_occupations WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Relations ─────────────────────────────────────────────

pub async fn list_master_relations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterRelation>>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::LIST,
    )?;
    let rows = sqlx::query_as::<_, MasterRelation>(
        "SELECT * FROM master_relations \
         WHERE (tenant_id = $1 OR tenant_id IS NULL) \
         ORDER BY sort_order, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

pub async fn create_master_relation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMasterItemRequest>,
) -> Result<Json<MasterRelation>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::CREATE,
    )?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, MasterRelation>(
        "INSERT INTO master_relations (tenant_id, code, name, sort_order) \
         VALUES ($1, $2, $3, $4) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.code.trim())
    .bind(body.name.trim())
    .bind(body.sort_order.unwrap_or(0))
    .fetch_one(&state.db)
    .await?;
    Ok(Json(row))
}

pub async fn update_master_relation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMasterItemRequest>,
) -> Result<Json<MasterRelation>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::UPDATE,
    )?;
    let row = sqlx::query_as::<_, MasterRelation>(
        "UPDATE master_relations SET \
         code = COALESCE($1, code), \
         name = COALESCE($2, name), \
         sort_order = COALESCE($3, sort_order), \
         is_active = COALESCE($4, is_active) \
         WHERE id = $5 AND tenant_id = $6 \
         RETURNING *",
    )
    .bind(body.code.as_deref().map(str::trim))
    .bind(body.name.as_deref().map(str::trim))
    .bind(body.sort_order)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound)?;
    Ok(Json(row))
}

pub async fn delete_master_relation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::DELETE,
    )?;
    let result = sqlx::query("DELETE FROM master_relations WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Insurance Providers ───────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateInsuranceProviderRequest {
    pub code: String,
    pub name: String,
    pub provider_type: String,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub website: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInsuranceProviderRequest {
    pub code: Option<String>,
    pub name: Option<String>,
    pub provider_type: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub website: Option<String>,
    pub is_active: Option<bool>,
}

pub async fn list_insurance_providers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterInsuranceProvider>>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::LIST,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, MasterInsuranceProvider>(
        "SELECT * FROM master_insurance_providers ORDER BY name",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_insurance_provider(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInsuranceProviderRequest>,
) -> Result<Json<MasterInsuranceProvider>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::CREATE,
    )?;
    let mut errors = ValidationErrors::new();
    validation::validate_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    validation::validate_name(&mut errors, "provider_type", &body.provider_type);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, MasterInsuranceProvider>(
        "INSERT INTO master_insurance_providers \
         (tenant_id, code, name, provider_type, contact_phone, contact_email, website) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.code.trim())
    .bind(body.name.trim())
    .bind(body.provider_type.trim())
    .bind(body.contact_phone.as_deref().map(str::trim))
    .bind(body.contact_email.as_deref().map(str::trim))
    .bind(body.website.as_deref().map(str::trim))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_insurance_provider(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInsuranceProviderRequest>,
) -> Result<Json<MasterInsuranceProvider>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::UPDATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let row = sqlx::query_as::<_, MasterInsuranceProvider>(
        "UPDATE master_insurance_providers SET \
         code = COALESCE($1, code), \
         name = COALESCE($2, name), \
         provider_type = COALESCE($3, provider_type), \
         contact_phone = COALESCE($4, contact_phone), \
         contact_email = COALESCE($5, contact_email), \
         website = COALESCE($6, website), \
         is_active = COALESCE($7, is_active) \
         WHERE id = $8 \
         RETURNING *",
    )
    .bind(body.code.as_deref().map(str::trim))
    .bind(body.name.as_deref().map(str::trim))
    .bind(body.provider_type.as_deref().map(str::trim))
    .bind(body.contact_phone.as_deref().map(str::trim))
    .bind(body.contact_email.as_deref().map(str::trim))
    .bind(body.website.as_deref().map(str::trim))
    .bind(body.is_active)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_insurance_provider(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(
        &claims,
        permissions::admin::settings::clinical_masters::DELETE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let result = sqlx::query("DELETE FROM master_insurance_providers WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── POST /api/setup/module-masters ──────────────────────────

#[derive(Debug, Deserialize)]
pub struct SeedModuleMastersRequest {
    pub module_code: String,
}

/// Seed default master data for a given module.
/// Each module has a predefined set of template data that gets inserted.
pub async fn seed_module_masters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SeedModuleMastersRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::modules::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut seeded: Vec<String> = Vec::new();

    match body.module_code.as_str() {
        "opd" => {
            let visit_types = [
                ("GENERAL", "General Consultation"),
                ("FOLLOWUP", "Follow-up Visit"),
                ("EMERGENCY", "Emergency Consultation"),
                ("REFERRAL", "Referral Consultation"),
                ("TELECONSULT", "Teleconsultation"),
                ("PREVENTIVE", "Preventive Health Check"),
            ];
            for (code, name) in &visit_types {
                sqlx::query(
                    "INSERT INTO services (id, tenant_id, code, name, service_type) \
                     VALUES ($1, $2, $3, $4, 'consultation') \
                     ON CONFLICT (tenant_id, code) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(name)
                .execute(&mut *tx)
                .await?;
            }
            seeded.push("visit_types".to_string());
        }
        "lab" => {
            let sample_types = [
                ("BLOOD", "Blood"),
                ("URINE", "Urine"),
                ("CSF", "Cerebrospinal Fluid"),
                ("STOOL", "Stool"),
                ("SPUTUM", "Sputum"),
                ("SWAB", "Swab"),
                ("TISSUE", "Tissue"),
                ("FLUID", "Body Fluid"),
            ];
            for (code, name) in &sample_types {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'lab_sample_types', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }

            let test_categories = [
                ("HEMATOLOGY", "Hematology"),
                ("BIOCHEMISTRY", "Biochemistry"),
                ("MICROBIOLOGY", "Microbiology"),
                ("SEROLOGY", "Serology"),
                ("HISTOPATHOLOGY", "Histopathology"),
                ("CYTOLOGY", "Cytology"),
                ("IMMUNOLOGY", "Immunology"),
                ("MOLECULAR", "Molecular Biology"),
            ];
            for (code, name) in &test_categories {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'lab_test_categories', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }
            seeded.push("sample_types".to_string());
            seeded.push("test_categories".to_string());
        }
        "pharmacy" => {
            let schedules = [
                ("H", "Schedule H — Prescription required"),
                ("H1", "Schedule H1 — Strict prescription control"),
                ("X", "Schedule X — Narcotic/psychotropic (NDPS)"),
                ("G", "Schedule G — Prescription recommended"),
                ("OTC", "Over-the-counter"),
            ];
            for (code, name) in &schedules {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'drug_schedules', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }

            let formulations = [
                ("TABLET", "Tablet"),
                ("CAPSULE", "Capsule"),
                ("SYRUP", "Syrup"),
                ("INJECTION", "Injection"),
                ("CREAM", "Cream/Ointment"),
                ("DROPS", "Drops"),
                ("INHALER", "Inhaler"),
                ("SUPPOSITORY", "Suppository"),
                ("PATCH", "Transdermal Patch"),
                ("POWDER", "Powder"),
            ];
            for (code, name) in &formulations {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'drug_formulations', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }
            seeded.push("drug_schedules".to_string());
            seeded.push("drug_formulations".to_string());
        }
        "ipd" => {
            let admission_types = [
                ("PLANNED", "Planned Admission"),
                ("EMERGENCY", "Emergency Admission"),
                ("TRANSFER", "Transfer from Another Facility"),
                ("DAYCARE", "Day Care Admission"),
            ];
            for (code, name) in &admission_types {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'admission_types', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }
            seeded.push("admission_types".to_string());
        }
        "billing" => {
            let invoice_categories = [
                ("CONSULTATION", "Consultation Charges"),
                ("PROCEDURE", "Procedure Charges"),
                ("PHARMACY", "Pharmacy Charges"),
                ("LAB", "Laboratory Charges"),
                ("RADIOLOGY", "Radiology Charges"),
                ("ROOM", "Room/Bed Charges"),
                ("NURSING", "Nursing Charges"),
                ("CONSUMABLE", "Consumable Charges"),
            ];
            for (code, name) in &invoice_categories {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'invoice_categories', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }

            let discount_types = [
                ("STAFF", "Staff Discount"),
                ("SENIOR", "Senior Citizen Discount"),
                ("BPL", "Below Poverty Line"),
                ("INSURANCE", "Insurance Co-pay Adjustment"),
                ("PACKAGE", "Package Discount"),
            ];
            for (code, name) in &discount_types {
                sqlx::query(
                    "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
                     VALUES ($1, $2, 'discount_types', $3, $4) \
                     ON CONFLICT (tenant_id, category, key) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(serde_json::json!({ "name": name }))
                .execute(&mut *tx)
                .await?;
            }
            seeded.push("invoice_categories".to_string());
            seeded.push("discount_types".to_string());
        }
        "radiology" => {
            let modalities = [
                ("XRAY", "X-Ray", "General radiography"),
                ("CT", "CT Scan", "Computed tomography"),
                ("MRI", "MRI", "Magnetic resonance imaging"),
                ("USG", "Ultrasound", "Ultrasonography"),
                ("MAMMO", "Mammography", "Breast imaging"),
                ("FLUORO", "Fluoroscopy", "Real-time imaging"),
                ("DEXA", "DEXA", "Bone density scan"),
            ];
            for (code, name, desc) in &modalities {
                sqlx::query(
                    "INSERT INTO radiology_modalities (id, tenant_id, code, name, description, is_active) \
                     VALUES ($1, $2, $3, $4, $5, true) \
                     ON CONFLICT (tenant_id, code) DO NOTHING",
                )
                .bind(Uuid::new_v4())
                .bind(claims.tenant_id)
                .bind(code)
                .bind(name)
                .bind(desc)
                .execute(&mut *tx)
                .await?;
            }
            seeded.push("modalities".to_string());
        }
        _ => {
            return Ok(Json(serde_json::json!({
                "status": "no_templates",
                "message": format!("No master data templates available for module '{}'", body.module_code),
                "seeded": []
            })));
        }
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "module": body.module_code,
        "seeded": seeded
    })))
}

// ── POST /api/setup/locations/import ────────────────────────

#[derive(Debug, Deserialize)]
pub struct CsvImportRow {
    pub values: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CsvImportRequest {
    pub headers: Vec<String>,
    pub rows: Vec<CsvImportRow>,
}

#[derive(Debug, Serialize)]
pub struct CsvImportResult {
    pub imported: i64,
    pub skipped: i64,
    pub errors: Vec<String>,
}

pub async fn import_locations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CsvImportRequest>,
) -> Result<Json<CsvImportResult>, AppError> {
    require_permission(&claims, permissions::admin::settings::locations::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let col_idx = |name: &str| -> Option<usize> {
        body.headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
    };

    let code_idx = col_idx("code")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'code' column".to_string()))?;
    let name_idx = col_idx("name")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'name' column".to_string()))?;
    let level_idx = col_idx("level")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'level' column".to_string()))?;
    let parent_code_idx = col_idx("parent_code");

    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for (i, row) in body.rows.iter().enumerate() {
        let row_num = i + 2; // 1-based, skip header
        if row.values.len() <= code_idx
            || row.values.len() <= name_idx
            || row.values.len() <= level_idx
        {
            errors.push(format!("Row {row_num}: insufficient columns"));
            skipped += 1;
            continue;
        }

        let code = row.values[code_idx].trim();
        let name = row.values[name_idx].trim();
        let level = row.values[level_idx].trim().to_lowercase();

        if code.is_empty() || name.is_empty() || level.is_empty() {
            errors.push(format!("Row {row_num}: code, name, and level are required"));
            skipped += 1;
            continue;
        }

        let valid_levels = ["campus", "building", "floor", "wing", "zone", "room", "bed"];
        if !valid_levels.contains(&level.as_str()) {
            errors.push(format!("Row {row_num}: invalid level '{level}'"));
            skipped += 1;
            continue;
        }

        // Resolve parent_id from parent_code
        let parent_id: Option<Uuid> = if let Some(pc_idx) = parent_code_idx {
            if let Some(parent_code) = row.values.get(pc_idx) {
                let pc = parent_code.trim();
                if pc.is_empty() {
                    None
                } else {
                    let maybe: Option<(Uuid,)> = sqlx::query_as(
                        "SELECT id FROM locations WHERE tenant_id = $1 AND code = $2",
                    )
                    .bind(claims.tenant_id)
                    .bind(pc)
                    .fetch_optional(&mut *tx)
                    .await?;
                    if maybe.is_none() {
                        errors.push(format!("Row {row_num}: parent_code '{pc}' not found"));
                        skipped += 1;
                        continue;
                    }
                    maybe.map(|r| r.0)
                }
            } else {
                None
            }
        } else {
            None
        };

        let result = sqlx::query(
            "INSERT INTO locations (id, tenant_id, code, name, level, parent_id) \
             VALUES ($1, $2, $3, $4, $5::location_level, $6) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(Uuid::new_v4())
        .bind(claims.tenant_id)
        .bind(code)
        .bind(name)
        .bind(&level)
        .bind(parent_id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() > 0 {
            imported += 1;
        } else {
            skipped += 1;
            errors.push(format!("Row {row_num}: duplicate code '{code}'"));
        }
    }

    tx.commit().await?;

    Ok(Json(CsvImportResult {
        imported,
        skipped,
        errors,
    }))
}

// ── POST /api/setup/departments/import ──────────────────────

pub async fn import_departments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CsvImportRequest>,
) -> Result<Json<CsvImportResult>, AppError> {
    require_permission(&claims, permissions::admin::settings::departments::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let col_idx = |name: &str| -> Option<usize> {
        body.headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
    };

    let code_idx = col_idx("code")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'code' column".to_string()))?;
    let name_idx = col_idx("name")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'name' column".to_string()))?;
    let type_idx = col_idx("type").or_else(|| col_idx("department_type"));
    let parent_code_idx = col_idx("parent_code");

    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for (i, row) in body.rows.iter().enumerate() {
        let row_num = i + 2;
        if row.values.len() <= code_idx || row.values.len() <= name_idx {
            errors.push(format!("Row {row_num}: insufficient columns"));
            skipped += 1;
            continue;
        }

        let code = row.values[code_idx].trim();
        let name = row.values[name_idx].trim();

        if code.is_empty() || name.is_empty() {
            errors.push(format!("Row {row_num}: code and name are required"));
            skipped += 1;
            continue;
        }

        let dept_type = type_idx
            .and_then(|idx| row.values.get(idx))
            .map_or_else(|| "clinical".to_string(), |v| v.trim().to_lowercase());

        let valid_types = [
            "clinical",
            "pre_clinical",
            "para_clinical",
            "administrative",
            "support",
            "academic",
        ];
        if !valid_types.contains(&dept_type.as_str()) {
            errors.push(format!("Row {row_num}: invalid type '{dept_type}'"));
            skipped += 1;
            continue;
        }

        let parent_id: Option<Uuid> = if let Some(pc_idx) = parent_code_idx {
            if let Some(parent_code) = row.values.get(pc_idx) {
                let pc = parent_code.trim();
                if pc.is_empty() {
                    None
                } else {
                    let maybe: Option<(Uuid,)> = sqlx::query_as(
                        "SELECT id FROM departments WHERE tenant_id = $1 AND code = $2",
                    )
                    .bind(claims.tenant_id)
                    .bind(pc)
                    .fetch_optional(&mut *tx)
                    .await?;
                    if maybe.is_none() {
                        errors.push(format!("Row {row_num}: parent_code '{pc}' not found"));
                        skipped += 1;
                        continue;
                    }
                    maybe.map(|r| r.0)
                }
            } else {
                None
            }
        } else {
            None
        };

        let result = sqlx::query(
            "INSERT INTO departments (id, tenant_id, code, name, department_type, parent_id) \
             VALUES ($1, $2, $3, $4, $5::department_type, $6) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(Uuid::new_v4())
        .bind(claims.tenant_id)
        .bind(code)
        .bind(name)
        .bind(&dept_type)
        .bind(parent_id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() > 0 {
            imported += 1;
        } else {
            skipped += 1;
            errors.push(format!("Row {row_num}: duplicate code '{code}'"));
        }
    }

    tx.commit().await?;

    Ok(Json(CsvImportResult {
        imported,
        skipped,
        errors,
    }))
}

// ── POST /api/setup/users/import ────────────────────────────

pub async fn import_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CsvImportRequest>,
) -> Result<Json<CsvImportResult>, AppError> {
    require_permission(&claims, permissions::admin::users::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let col_idx = |name: &str| -> Option<usize> {
        body.headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
    };

    let username_idx = col_idx("username")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'username' column".to_string()))?;
    let full_name_idx = col_idx("full_name")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'full_name' column".to_string()))?;
    let email_idx = col_idx("email")
        .ok_or_else(|| AppError::BadRequest("CSV must have an 'email' column".to_string()))?;
    let password_idx = col_idx("password");
    let role_idx = col_idx("role");

    let mut imported: i64 = 0;
    let mut skipped: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    let argon2 = Argon2::default();

    for (i, row) in body.rows.iter().enumerate() {
        let row_num = i + 2;
        if row.values.len() <= username_idx
            || row.values.len() <= full_name_idx
            || row.values.len() <= email_idx
        {
            errors.push(format!("Row {row_num}: insufficient columns"));
            skipped += 1;
            continue;
        }

        let username = row.values[username_idx].trim();
        let full_name = row.values[full_name_idx].trim();
        let email = row.values[email_idx].trim();

        if username.is_empty() || full_name.is_empty() || email.is_empty() {
            errors.push(format!(
                "Row {row_num}: username, full_name, and email are required"
            ));
            skipped += 1;
            continue;
        }

        let password = password_idx
            .and_then(|idx| row.values.get(idx))
            .map_or_else(
                || format!("Welcome@{}", &username),
                |v| v.trim().to_string(),
            );

        let role = role_idx
            .and_then(|idx| row.values.get(idx))
            .map_or_else(|| "receptionist".to_string(), |v| v.trim().to_string());

        // Hash password
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("Row {row_num}: password hash failed: {e}")))?
            .to_string();

        let result = sqlx::query(
            "INSERT INTO users (id, tenant_id, username, full_name, email, password_hash, role) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) \
             ON CONFLICT (tenant_id, username) DO NOTHING",
        )
        .bind(Uuid::new_v4())
        .bind(claims.tenant_id)
        .bind(username)
        .bind(full_name)
        .bind(email)
        .bind(&password_hash)
        .bind(&role)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() > 0 {
            imported += 1;
        } else {
            skipped += 1;
            errors.push(format!("Row {row_num}: duplicate username '{username}'"));
        }
    }

    tx.commit().await?;

    Ok(Json(CsvImportResult {
        imported,
        skipped,
        errors,
    }))
}

// ── Print Template CRUD ─────────────────────────────────────

/// Print templates stored in `tenant_settings`.
///
/// Keys: 'letterhead', '`prescription_pad`', 'invoice', '`lab_report`', '`discharge_summary`'.
/// Values: JSONB with `header_text`, `footer_text`, `logo_position`, font, margins, etc.

#[derive(Debug, Deserialize)]
pub struct PrintTemplateRequest {
    pub template_type: String,
    pub header_text: Option<String>,
    pub footer_text: Option<String>,
    pub logo_position: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<i32>,
    pub margin_top: Option<f64>,
    pub margin_bottom: Option<f64>,
    pub margin_left: Option<f64>,
    pub margin_right: Option<f64>,
    pub show_logo: Option<bool>,
    pub show_hospital_name: Option<bool>,
    pub show_hospital_address: Option<bool>,
    pub show_hospital_phone: Option<bool>,
    pub show_registration_no: Option<bool>,
    pub custom_css: Option<String>,
}

pub async fn get_print_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TenantSettings>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, TenantSettings>(
        "SELECT id, tenant_id, category, key, value, created_at, updated_at \
         FROM tenant_settings WHERE tenant_id = $1 AND category = 'print_templates' \
         ORDER BY key",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn upsert_print_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PrintTemplateRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::branding::MANAGE)?;

    let valid_types = [
        "letterhead",
        "prescription_pad",
        "invoice",
        "lab_report",
        "discharge_summary",
    ];
    if !valid_types.contains(&body.template_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid template type '{}'. Valid types: {}",
            body.template_type,
            valid_types.join(", ")
        )));
    }

    let value = serde_json::json!({
        "header_text": body.header_text,
        "footer_text": body.footer_text,
        "logo_position": body.logo_position.as_deref().unwrap_or("left"),
        "font_family": body.font_family.as_deref().unwrap_or("Arial"),
        "font_size": body.font_size.unwrap_or(12),
        "margin_top": body.margin_top.unwrap_or(20.0),
        "margin_bottom": body.margin_bottom.unwrap_or(20.0),
        "margin_left": body.margin_left.unwrap_or(15.0),
        "margin_right": body.margin_right.unwrap_or(15.0),
        "show_logo": body.show_logo.unwrap_or(true),
        "show_hospital_name": body.show_hospital_name.unwrap_or(true),
        "show_hospital_address": body.show_hospital_address.unwrap_or(true),
        "show_hospital_phone": body.show_hospital_phone.unwrap_or(true),
        "show_registration_no": body.show_registration_no.unwrap_or(false),
        "custom_css": body.custom_css,
    });

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(claims.tenant_id)
    .bind("print_templates")
    .bind(&body.template_type)
    .bind(&value)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "template_type": body.template_type,
        "value": value
    })))
}

// ── User-Facility Assignment ────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserFacilityAssignment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub facility_id: Uuid,
    pub is_primary: bool,
    pub assigned_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AssignUserFacilitiesRequest {
    pub facility_ids: Vec<Uuid>,
    pub primary_facility_id: Option<Uuid>,
}

/// GET /api/setup/users/{id}/facilities
pub async fn list_user_facilities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<UserFacilityAssignment>>, AppError> {
    require_permission(&claims, permissions::admin::users::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<_, UserFacilityAssignment>(
        "SELECT id, tenant_id, user_id, facility_id, is_primary, assigned_at \
         FROM user_facility_assignments \
         WHERE tenant_id = $1 AND user_id = $2 \
         ORDER BY is_primary DESC, assigned_at",
    )
    .bind(claims.tenant_id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// PUT /api/setup/users/{id}/facilities
///
/// Replaces all facility assignments for a user.
pub async fn assign_user_facilities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<AssignUserFacilitiesRequest>,
) -> Result<Json<Vec<UserFacilityAssignment>>, AppError> {
    require_permission(&claims, permissions::admin::users::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Verify user belongs to this tenant
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2)")
            .bind(user_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    if !exists {
        return Err(AppError::NotFound);
    }

    // Remove existing assignments
    sqlx::query("DELETE FROM user_facility_assignments WHERE tenant_id = $1 AND user_id = $2")
        .bind(claims.tenant_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Insert new assignments
    for fid in &body.facility_ids {
        let is_primary = body.primary_facility_id.as_ref() == Some(fid);
        sqlx::query(
            "INSERT INTO user_facility_assignments \
             (tenant_id, user_id, facility_id, is_primary) \
             VALUES ($1, $2, $3, $4)",
        )
        .bind(claims.tenant_id)
        .bind(user_id)
        .bind(fid)
        .bind(is_primary)
        .execute(&mut *tx)
        .await?;
    }

    // Fetch and return the new assignments
    let rows = sqlx::query_as::<_, UserFacilityAssignment>(
        "SELECT id, tenant_id, user_id, facility_id, is_primary, assigned_at \
         FROM user_facility_assignments \
         WHERE tenant_id = $1 AND user_id = $2 \
         ORDER BY is_primary DESC, assigned_at",
    )
    .bind(claims.tenant_id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/setup/facilities/{id}/auto-compliance
///
/// Auto-creates compliance checklist entries for a facility
/// based on the regulatory bodies mapped to the tenant.
pub async fn auto_create_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(facility_id): Path<Uuid>,
) -> Result<Json<Vec<ComplianceRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::facilities::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Verify facility belongs to this tenant
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM facilities WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(facility_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if !exists {
        return Err(AppError::NotFound);
    }

    // Get all regulatory bodies that are already mapped to ANY facility of this tenant
    // (i.e., bodies from facility_regulatory_compliance for this tenant)
    // PLUS any bodies linked by country/state matching the tenant's geo
    let body_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT DISTINCT rb.id FROM regulatory_bodies rb \
         LEFT JOIN facilities f ON f.tenant_id = $1 AND f.id = $2 \
         WHERE rb.is_active = true AND ( \
             rb.country_id = f.country_id \
             OR (rb.country_id IS NULL AND rb.level = 'international') \
             OR rb.state_id = f.state_id \
         ) \
         AND NOT EXISTS ( \
             SELECT 1 FROM facility_regulatory_compliance frc \
             WHERE frc.tenant_id = $1 AND frc.facility_id = $2 AND frc.regulatory_body_id = rb.id \
         )",
    )
    .bind(claims.tenant_id)
    .bind(facility_id)
    .fetch_all(&mut *tx)
    .await?;

    // Insert compliance records for each unlinked regulatory body
    for body_id in &body_ids {
        sqlx::query(
            "INSERT INTO facility_regulatory_compliance \
             (tenant_id, facility_id, regulatory_body_id, status) \
             VALUES ($1, $2, $3, 'pending') \
             ON CONFLICT (tenant_id, facility_id, regulatory_body_id) DO NOTHING",
        )
        .bind(claims.tenant_id)
        .bind(facility_id)
        .bind(body_id)
        .execute(&mut *tx)
        .await?;
    }

    // Return all compliance records for this facility
    let rows = sqlx::query_as::<_, ComplianceRow>(
        "SELECT id, tenant_id, facility_id, regulatory_body_id, license_number, status \
         FROM facility_regulatory_compliance \
         WHERE tenant_id = $1 AND facility_id = $2 \
         ORDER BY created_at",
    )
    .bind(claims.tenant_id)
    .bind(facility_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Bulk / template / health / config handlers
// ══════════════════════════════════════════════════════════

// ── POST /api/setup/users/bulk ──────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BulkCreateUsersRequest {
    pub users: Vec<CreateUserRequest>,
}

#[derive(Debug, Serialize)]
pub struct BulkCreateUsersResponse {
    pub created: i64,
    pub errors: Vec<String>,
}

pub async fn bulk_create_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BulkCreateUsersRequest>,
) -> Result<Json<BulkCreateUsersResponse>, AppError> {
    require_permission(&claims, permissions::admin::users::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut created: i64 = 0;
    let mut errors: Vec<String> = Vec::new();

    for (idx, user) in body.users.iter().enumerate() {
        let mut user_errors = ValidationErrors::new();
        validation::validate_username(&mut user_errors, "username", &user.username);
        validation::validate_email(&mut user_errors, "email", &user.email);
        validation::validate_password(&mut user_errors, "password", &user.password);
        validation::validate_name(&mut user_errors, "full_name", &user.full_name);
        if user.role.is_empty() {
            user_errors.add("role", "Role is required");
        }
        if user_errors.has_errors() {
            errors.push(format!("User {idx}: validation failed"));
            continue;
        }

        let username_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND username = $2)",
        )
        .bind(claims.tenant_id)
        .bind(&user.username)
        .fetch_one(&mut *tx)
        .await?;
        if username_exists {
            errors.push(format!(
                "User {idx}: username '{}' already exists",
                user.username
            ));
            continue;
        }

        let email_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND email = $2)",
        )
        .bind(claims.tenant_id)
        .bind(&user.email)
        .fetch_one(&mut *tx)
        .await?;
        if email_exists {
            errors.push(format!("User {idx}: email '{}' already in use", user.email));
            continue;
        }

        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(user.password.as_bytes(), &salt)
            .map_err(|e| AppError::Internal(format!("password hash error: {e}")))?
            .to_string();

        let fee = user
            .consultation_fee
            .and_then(|f| rust_decimal::Decimal::try_from(f).ok());
        let dept_ids = user.department_ids.as_deref().unwrap_or(&[]);

        sqlx::query(
            "INSERT INTO users \
             (tenant_id, username, email, password_hash, full_name, role, \
              specialization, medical_registration_number, qualification, \
              consultation_fee, department_ids) \
             VALUES ($1, $2, $3, $4, $5, $6::user_role, $7, $8, $9, $10, $11)",
        )
        .bind(claims.tenant_id)
        .bind(&user.username)
        .bind(&user.email)
        .bind(&password_hash)
        .bind(&user.full_name)
        .bind(&user.role)
        .bind(&user.specialization)
        .bind(&user.medical_registration_number)
        .bind(&user.qualification)
        .bind(fee)
        .bind(dept_ids)
        .execute(&mut *tx)
        .await?;

        created += 1;
    }

    tx.commit().await?;

    Ok(Json(BulkCreateUsersResponse { created, errors }))
}

// ── POST /api/setup/departments/template ────────────────────

#[derive(Debug, Serialize)]
pub struct SeedDepartmentTemplateResponse {
    pub created: i64,
    pub skipped: i64,
}

pub async fn seed_department_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SeedDepartmentTemplateResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::departments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let templates: Vec<(&str, &str, &str)> = vec![
        ("EMERGENCY", "Emergency", "clinical"),
        ("OPD", "Out-Patient Department", "clinical"),
        ("IPD", "In-Patient Department", "clinical"),
        ("ICU", "Intensive Care Unit", "clinical"),
        ("OT", "Operation Theatre", "clinical"),
        ("LAB", "Laboratory", "clinical"),
        ("PHARMACY", "Pharmacy", "clinical"),
        ("RADIOLOGY", "Radiology", "clinical"),
        ("BLOOD_BANK", "Blood Bank", "clinical"),
        ("PHYSIO", "Physiotherapy", "clinical"),
        ("DENTAL", "Dental", "clinical"),
        ("ENT", "ENT", "clinical"),
        ("OPHTHALMOLOGY", "Ophthalmology", "clinical"),
        ("DERMATOLOGY", "Dermatology", "clinical"),
        ("CARDIOLOGY", "Cardiology", "clinical"),
        ("NEUROLOGY", "Neurology", "clinical"),
        ("ORTHOPAEDICS", "Orthopaedics", "clinical"),
        ("PAEDIATRICS", "Paediatrics", "clinical"),
        ("OBSTETRICS", "Obstetrics & Gynaecology", "clinical"),
        ("PSYCHIATRY", "Psychiatry", "clinical"),
        ("ADMIN", "Administration", "administrative"),
        ("HR", "Human Resources", "administrative"),
        ("FINANCE", "Finance & Billing", "administrative"),
        ("IT", "Information Technology", "support"),
        ("CSSD", "Central Sterile Supply", "support"),
        ("DIET", "Diet & Kitchen", "support"),
        ("HOUSEKEEPING", "Housekeeping", "support"),
        ("BIOMEDICAL", "Biomedical Engineering", "support"),
        ("SECURITY", "Security", "support"),
        ("MRD", "Medical Records", "administrative"),
    ];

    let mut created: i64 = 0;
    let mut skipped: i64 = 0;

    for (code, name, dept_type) in &templates {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM departments WHERE tenant_id = $1 AND code = $2)",
        )
        .bind(claims.tenant_id)
        .bind(code)
        .fetch_one(&mut *tx)
        .await?;

        if exists {
            skipped += 1;
            continue;
        }

        sqlx::query(
            "INSERT INTO departments (tenant_id, code, name, department_type, working_hours) \
             VALUES ($1, $2, $3, $4::department_type, '{}'::jsonb)",
        )
        .bind(claims.tenant_id)
        .bind(code)
        .bind(name)
        .bind(dept_type)
        .execute(&mut *tx)
        .await?;

        created += 1;
    }

    tx.commit().await?;

    Ok(Json(SeedDepartmentTemplateResponse { created, skipped }))
}

// ── GET /api/setup/completeness ─────────────────────────────

pub async fn completeness_check(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let (dept_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM departments WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let (user_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let (role_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM roles WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let (service_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM services WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let (location_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM locations WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let (pharmacy_catalog_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pharmacy_catalog WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let (lab_test_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM lab_test_catalog WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "departments": dept_count,
        "users": user_count,
        "roles": role_count,
        "services": service_count,
        "locations": location_count,
        "pharmacy_catalog": pharmacy_catalog_count,
        "lab_test_catalog": lab_test_count,
    })))
}

// ── GET /api/setup/health ───────────────────────────────────

pub async fn system_health(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let (user_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let (dept_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM departments WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let (module_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM module_config WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    // Migration count from _sqlx_migrations (global table, no tenant scope)
    let (migration_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM _sqlx_migrations")
        .fetch_one(&state.db)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "users": user_count,
        "departments": dept_count,
        "modules": module_count,
        "migrations_applied": migration_count,
    })))
}

// ── GET /api/setup/config/export ────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportServiceRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub service_type: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ExportPaymentMethodRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub is_active: bool,
}

pub async fn export_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let departments = sqlx::query_as::<_, DepartmentRow>(
        "SELECT id, tenant_id, parent_id, code, name, department_type::text, \
         working_hours, is_active \
         FROM departments WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let roles = sqlx::query_as::<_, CustomRole>(
        "SELECT * FROM roles WHERE tenant_id = $1 ORDER BY is_system DESC, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let services = sqlx::query_as::<_, ExportServiceRow>(
        "SELECT id, code, name, service_type::text AS service_type, is_active \
         FROM services WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let payment_methods = sqlx::query_as::<_, ExportPaymentMethodRow>(
        "SELECT id, code, name, is_active \
         FROM payment_methods WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "departments": departments,
        "roles": roles,
        "services": services,
        "payment_methods": payment_methods,
    })))
}

// ── POST /api/setup/config/import ───────────────────────────

#[derive(Debug, Deserialize)]
pub struct ImportConfigRequest {
    pub departments: Option<Vec<CreateDepartmentRequest>>,
    pub roles: Option<Vec<CreateRoleRequest>>,
}

#[derive(Debug, Serialize)]
pub struct ImportConfigResponse {
    pub departments_created: i64,
    pub roles_created: i64,
}

pub async fn import_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ImportConfigRequest>,
) -> Result<Json<ImportConfigResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let mut departments_created: i64 = 0;
    let mut roles_created: i64 = 0;

    // Import departments
    if let Some(departments) = &body.departments {
        for dept in departments {
            let wh = dept
                .working_hours
                .clone()
                .unwrap_or_else(|| serde_json::json!({}));
            let result = sqlx::query(
                "INSERT INTO departments \
                 (tenant_id, parent_id, code, name, department_type, working_hours) \
                 VALUES ($1, $2, $3, $4, $5::department_type, $6) \
                 ON CONFLICT (tenant_id, code) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(dept.parent_id)
            .bind(&dept.code)
            .bind(&dept.name)
            .bind(&dept.department_type)
            .bind(&wh)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() > 0 {
                departments_created += 1;
            }
        }
    }

    // Import roles
    if let Some(roles) = &body.roles {
        for role in roles {
            let result = sqlx::query(
                "INSERT INTO roles (tenant_id, code, name, description, permissions) \
                 VALUES ($1, $2, $3, $4, COALESCE($5, '{}')) \
                 ON CONFLICT (tenant_id, code) DO NOTHING",
            )
            .bind(claims.tenant_id)
            .bind(&role.code)
            .bind(&role.name)
            .bind(&role.description)
            .bind(&role.permissions)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() > 0 {
                roles_created += 1;
            }
        }
    }

    tx.commit().await?;

    Ok(Json(ImportConfigResponse {
        departments_created,
        roles_created,
    }))
}

// ══════════════════════════════════════════════════════════
//  Brand Entities (multi-entity branding)
// ══════════════════════════════════════════════════════════

/// GET /api/setup/brand-entities
pub async fn list_brand_entities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Value>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            bool,
        ),
    >(
        "SELECT id, code, name, short_name, logo_url, registration_no, is_default, is_active \
         FROM brand_entities ORDER BY is_default DESC, name",
    )
    .fetch_all(&mut *tx)
    .await?;

    let result: Vec<Value> = rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.0, "code": r.1, "name": r.2, "short_name": r.3,
                "logo_url": r.4, "registration_no": r.5, "is_default": r.6, "is_active": r.7
            })
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

/// POST /api/setup/brand-entities
pub async fn create_brand_entity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO brand_entities (tenant_id, code, name, short_name, logo_url, address, phone, email, registration_no, is_default) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body["code"].as_str().unwrap_or("hospital"))
    .bind(body["name"].as_str().unwrap_or(""))
    .bind(body["short_name"].as_str())
    .bind(body["logo_url"].as_str())
    .bind(body["address"].as_str())
    .bind(body["phone"].as_str())
    .bind(body["email"].as_str())
    .bind(body["registration_no"].as_str())
    .bind(body["is_default"].as_bool().unwrap_or(false))
    .fetch_one(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"id": id, "status": "created"})))
}

/// PUT /api/setup/brand-entities/{id}
pub async fn update_brand_entity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query(
        "UPDATE brand_entities SET \
         name=COALESCE($2,name), short_name=COALESCE($3,short_name), \
         logo_url=COALESCE($4,logo_url), address=COALESCE($5,address), \
         phone=COALESCE($6,phone), email=COALESCE($7,email), \
         registration_no=COALESCE($8,registration_no), is_default=COALESCE($9,is_default) \
         WHERE id=$1",
    )
    .bind(id)
    .bind(body["name"].as_str())
    .bind(body["short_name"].as_str())
    .bind(body["logo_url"].as_str())
    .bind(body["address"].as_str())
    .bind(body["phone"].as_str())
    .bind(body["email"].as_str())
    .bind(body["registration_no"].as_str())
    .bind(body["is_default"].as_bool())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"id": id, "status": "updated"})))
}

/// DELETE /api/setup/brand-entities/{id}
pub async fn delete_brand_entity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    sqlx::query("UPDATE brand_entities SET is_active = false WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"status": "deactivated"})))
}

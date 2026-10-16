//! What the hospital already has, as workbook rows — the same columns the
//! upload reads, so a download, edit and upload round-trips unchanged.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{is_bypass_role, require_permission},
    },
    state::AppState,
};
use serde::Serialize;

use super::{beds, departments, staff, wards};

/// Values a cell must be one of, for the Instructions sheet.
#[derive(Debug, Serialize)]
pub struct Allowed {
    pub department_types: &'static [&'static str],
    pub ward_types: &'static [&'static str],
    pub genders: &'static [&'static str],
    pub roles: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
pub struct Workbook {
    pub hospital_name: String,
    pub hospital_code: String,
    pub allowed: Allowed,
    pub departments: Vec<departments::Row>,
    pub wards: Vec<wards::Row>,
    pub beds: Vec<beds::Row>,
    pub staff: Vec<staff::Row>,
}

/// `GET /api/setup/workbook`
pub async fn export_workbook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Workbook>, AppError> {
    require_permission(&claims, permissions::admin::workbook::IMPORT)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let tenant = claims.tenant_id;
    let (hospital_name, hospital_code): (String, String) =
        sqlx::query_as("SELECT name, code FROM tenants WHERE id = $1")
            .bind(tenant)
            .fetch_one(&mut *tx)
            .await?;
    let departments = sqlx::query_as::<_, departments::Row>(
        "SELECT d.code, d.name, d.department_type::text AS type, p.code AS parent_code \
           FROM departments d LEFT JOIN departments p ON p.id = d.parent_id \
          WHERE d.tenant_id = $1 AND d.deleted_at IS NULL ORDER BY d.code",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?;
    let wards = sqlx::query_as::<_, wards::Row>(
        "SELECT w.code, w.name, w.ward_type, w.gender_restriction AS gender, d.code AS department_code \
           FROM wards w LEFT JOIN departments d ON d.id = w.department_id \
          WHERE w.tenant_id = $1 AND w.deleted_at IS NULL ORDER BY w.code",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?;
    let beds = sqlx::query_as::<_, beds::Row>(
        "SELECT b.code, w.code AS ward_code, r.code AS room \
           FROM ward_bed_mappings m \
           JOIN locations b ON b.id = m.bed_location_id AND b.deleted_at IS NULL \
           JOIN wards w ON w.id = m.ward_id AND w.deleted_at IS NULL \
           LEFT JOIN locations r ON r.id = b.parent_id AND r.level = 'room' \
          WHERE m.tenant_id = $1 AND m.deleted_at IS NULL ORDER BY w.code, b.code",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?;
    // Administrators and machine accounts are managed on the Users screen.
    let staff = sqlx::query_as::<_, staff::Row>(
        "SELECT u.username, u.full_name, u.email, u.phone, u.role::text AS role, \
                (SELECT string_agg(d.code, ', ' ORDER BY array_position(u.department_ids, d.id)) \
                   FROM departments d WHERE d.id = ANY(u.department_ids)) AS departments, \
                u.designation, u.employee_code, u.medical_registration_number AS registration_number, \
                u.specialization, u.qualification, u.consultation_fee::text AS consultation_fee \
           FROM users u \
          WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.is_service_account = false \
            AND u.role::text NOT IN ('super_admin', 'hospital_admin', 'display_device', 'service_account') \
          ORDER BY u.username",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(Workbook {
        hospital_name,
        hospital_code,
        allowed: Allowed {
            department_types: departments::TYPES,
            ward_types: wards::WARD_TYPES,
            genders: wards::GENDERS,
            roles: staff::assignable_roles(is_bypass_role(&claims)),
        },
        departments,
        wards,
        beds,
        staff,
    }))
}

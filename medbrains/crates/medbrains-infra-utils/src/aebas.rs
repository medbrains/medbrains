//! AEBAS / BAS integration service boundary.
//!
//! The Government BAS/AEBAS integration has more operational surface than a
//! report: organization/unit config, devices, biometric administrators,
//! attendance import, and MIS summaries. This module starts with the stable
//! service contract and imports into existing AEBAS summary tables.

use axum::{Extension, Json, extract::State};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AebasDepartmentImport {
    pub department_name: String,
    pub total_employees: i32,
    pub average_present: i32,
    pub average_absent: i32,
    pub average_leave: i32,
    pub attendance_percentage: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AebasPeriodImportRequest {
    pub period: String,
    pub total_employees: i32,
    pub average_attendance_percentage: Option<Decimal>,
    pub total_working_days: i32,
    pub holidays: i32,
    pub departments: Vec<AebasDepartmentImport>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AebasStatusResponse {
    pub configured: bool,
    pub source: Option<String>,
    pub organization_id: Option<String>,
    pub unit_code: Option<String>,
    pub api_base_url: Option<String>,
    pub surfaces: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AebasImportResponse {
    pub period: String,
    pub department_rows: usize,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct StoredAebasConfig {
    organization_id: Option<String>,
    unit_code: Option<String>,
    api_base_url: Option<String>,
}

pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AebasStatusResponse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::hr::attendance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'aebas' AND key = 'config'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let parsed = row
        .map(serde_json::from_value::<StoredAebasConfig>)
        .transpose()
        .map_err(|err| AppError::Internal(format!("invalid aebas config: {err}")))?;
    let configured = parsed
        .as_ref()
        .and_then(|value| value.organization_id.as_ref())
        .is_some();

    Ok(Json(AebasStatusResponse {
        configured,
        source: configured.then(|| "tenant_settings".to_owned()),
        organization_id: parsed
            .as_ref()
            .and_then(|value| value.organization_id.clone()),
        unit_code: parsed.as_ref().and_then(|value| value.unit_code.clone()),
        api_base_url: parsed.and_then(|value| value.api_base_url),
        surfaces: vec![
            "organization_registration",
            "nodal_officer",
            "biometric_administrator",
            "device_inventory",
            "uidai_auth_response",
            "attendance_import",
            "mis_report",
        ],
    }))
}

pub async fn import_period_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AebasPeriodImportRequest>,
) -> Result<Json<AebasImportResponse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::hr::attendance::MANAGE)?;
    if body.period.trim().is_empty() {
        return Err(AppError::BadRequest("period is required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO aebas_period_summary \
         (tenant_id, period, total_employees, average_attendance_percentage, total_working_days, holidays) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (tenant_id, period) DO UPDATE SET \
         total_employees = EXCLUDED.total_employees, \
         average_attendance_percentage = EXCLUDED.average_attendance_percentage, \
         total_working_days = EXCLUDED.total_working_days, \
         holidays = EXCLUDED.holidays",
    )
    .bind(claims.tenant_id)
    .bind(body.period.trim())
    .bind(body.total_employees)
    .bind(body.average_attendance_percentage)
    .bind(body.total_working_days)
    .bind(body.holidays)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM aebas_department_attendance WHERE tenant_id = $1 AND period = $2")
        .bind(claims.tenant_id)
        .bind(body.period.trim())
        .execute(&mut *tx)
        .await?;

    for department in &body.departments {
        sqlx::query(
            "INSERT INTO aebas_department_attendance \
             (tenant_id, period, department_name, total_employees, average_present, average_absent, \
              average_leave, attendance_percentage) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(claims.tenant_id)
        .bind(body.period.trim())
        .bind(department.department_name.trim())
        .bind(department.total_employees)
        .bind(department.average_present)
        .bind(department.average_absent)
        .bind(department.average_leave)
        .bind(department.attendance_percentage)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(AebasImportResponse {
        period: body.period.trim().to_owned(),
        department_rows: body.departments.len(),
        status: "imported".to_owned(),
    }))
}

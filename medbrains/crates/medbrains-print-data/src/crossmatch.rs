//! The crossmatch report: one blood bank crossmatch request, on paper.
//!
//! Reads `crossmatch_requests` and the unit tied to it in `blood_components`,
//! the same records the theatre "blood arranged" gate checks (#5962).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_health_services::patient as gate;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{CrossmatchReportPrintData, CrossmatchUnit};
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

/// One request as the report prints it.
#[derive(Debug, sqlx::FromRow)]
pub struct CrossmatchReportRow {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<f64>,
    pub gender: String,
    pub blood_group: String,
    pub rh_type: String,
    pub request_date: chrono::DateTime<chrono::Utc>,
    pub request_number: String,
    pub ward: Option<String>,
    pub bed: Option<String>,
    pub diagnosis: Option<String>,
    pub requesting_doctor: Option<String>,
    pub units_requested: i32,
    pub component_type: String,
    pub status: String,
    pub result: Option<String>,
    pub tested_at: Option<chrono::DateTime<chrono::Utc>>,
    pub special_requirements: Option<String>,
    pub technician_name: Option<String>,
}

/// The crossmatch report for one request, keyed on `crossmatch_requests.id`.
///
/// Reads what the blood bank writes: the request, and the one unit the bank
/// tied to it in `blood_components`. The `blood_requests`, `crossmatch_results`
/// and `blood_units` tables this used to read have no writer (#5962), so the
/// report never printed; it now shows the same record the theatre gate checks.
pub async fn get_crossmatch_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<CrossmatchReportPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;
    gate::require_access_via(&state, &claims, gate::links::CROSSMATCH_REQUEST, request_id).await?;

    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;
    let row = crossmatch_report_row(&mut tx, claims.tenant_id, request_id).await?;
    let crossmatch_results = crossmatch_report_units(&mut tx, claims.tenant_id, request_id).await?;
    let h_name = crate::billing::hospital_name(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(print_data(row, crossmatch_results, tz, h_name)))
}

/// Shape the row for paper: dates in the tenant's zone, and an explicit line
/// when no unit is tied, so an empty unit list is not read as "none needed".
pub fn print_data(
    row: CrossmatchReportRow,
    crossmatch_results: Vec<CrossmatchUnit>,
    tz: chrono::FixedOffset,
    hospital_name: Option<String>,
) -> CrossmatchReportPrintData {
    let unit_allocation = crossmatch_results.first().map_or_else(
        || "No unit allocated yet".to_owned(),
        |u| format!("Bag {}", u.bag_number),
    );
    CrossmatchReportPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{a:.0} Y")),
        gender: row.gender,
        blood_group: row.blood_group,
        rh_type: row.rh_type,
        request_date: row
            .request_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        request_number: row.request_number,
        ward: row.ward,
        bed: row.bed,
        diagnosis: row.diagnosis,
        requesting_doctor: row.requesting_doctor,
        units_requested: row.units_requested,
        component_type: row.component_type,
        status: row.status,
        result: row.result,
        tested_at: row
            .tested_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        unit_allocation,
        crossmatch_results,
        special_requirements: row.special_requirements,
        technician_name: row.technician_name,
        hospital_name,
    }
}

/// The request, its patient and the ward they are in now.
pub async fn crossmatch_report_row(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<CrossmatchReportRow, AppError> {
    sqlx::query_as!(
        CrossmatchReportRow,
        r#"SELECT
             (p.first_name || ' ' || p.last_name) AS "patient_name!",
             p.uhid,
             EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age,
             p.gender::text AS "gender!",
             xm.blood_group::text AS "blood_group!",
             CASE WHEN xm.blood_group::text LIKE '%\_positive' THEN 'Positive'
                  WHEN xm.blood_group::text LIKE '%\_negative' THEN 'Negative'
                  ELSE 'Unknown' END AS "rh_type!",
             xm.created_at AS request_date,
             'XM-' || upper(left(xm.id::text, 8)) AS "request_number!",
             adm.ward AS "ward?",
             adm.bed AS "bed?",
             xm.clinical_indication AS diagnosis,
             doc.full_name AS "requesting_doctor?",
             xm.units_requested,
             xm.component_type::text AS "component_type!",
             xm.status::text AS "status!",
             xm.result,
             xm.tested_at,
             xm.notes AS special_requirements,
             tech.full_name AS "technician_name?"
           FROM crossmatch_requests xm
           JOIN patients p ON p.id = xm.patient_id AND p.tenant_id = xm.tenant_id
           LEFT JOIN LATERAL (
             SELECT w.name AS ward, b.bed_number AS bed
               FROM admissions a
               LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = a.tenant_id
               LEFT JOIN wards w ON w.id = COALESCE(a.ward_id, b.ward_id)
                 AND w.tenant_id = a.tenant_id
              WHERE a.patient_id = xm.patient_id AND a.tenant_id = xm.tenant_id
                AND a.discharged_at IS NULL
              ORDER BY a.admitted_at DESC
              LIMIT 1
           ) adm ON true
           LEFT JOIN users doc ON doc.id = xm.requested_by
           LEFT JOIN users tech ON tech.id = xm.tested_by
          WHERE xm.id = $1 AND xm.tenant_id = $2 AND xm.deleted_at IS NULL"#,
        request_id,
        tenant_id,
    )
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// The unit the bank tied to the request: none until it is crossmatched,
/// one after (`crossmatch_requests.component_id`).
pub async fn crossmatch_report_units(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    request_id: Uuid,
) -> Result<Vec<CrossmatchUnit>, AppError> {
    Ok(sqlx::query_as!(
        CrossmatchUnit,
        r#"SELECT
             bc.bag_number::text AS "bag_number!",
             bd.donated_at::date::text AS "donation_date!",
             bc.expiry_at::date::text AS "expiry_date!",
             bc.blood_group::text AS "donor_blood_group!",
             bc.volume_ml,
             COALESCE(xm.result, xm.status::text) AS "crossmatch_result!",
             bc.status::text AS "issue_status!"
           FROM crossmatch_requests xm
           JOIN blood_components bc ON bc.id = xm.component_id AND bc.tenant_id = xm.tenant_id
           JOIN blood_donations bd ON bd.id = bc.donation_id AND bd.tenant_id = bc.tenant_id
          WHERE xm.id = $1 AND xm.tenant_id = $2 AND xm.deleted_at IS NULL"#,
        request_id,
        tenant_id,
    )
    .fetch_all(&mut *conn)
    .await?)
}

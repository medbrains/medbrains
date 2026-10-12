//! Print data routes for BME (Biomedical Engineering) and Safety forms.
//!
//! Phase 5: AMC Contracts, Calibration, Breakdown, History, MGPS, Water, DG/UPS, Fire Inspection.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AmcContractPrintData, BatteryStatus, BreakdownEvent, CalibrationCertificatePrintData,
    CalibrationEvent, CalibrationParameter, DgUpsParameters, DgUpsRunLogPrintData,
    DrillObservation, EquipmentBreakdownReportPrintData, EquipmentCoverage,
    EquipmentHistoryCardPrintData, FireEquipmentInspectionPrintData, FireMockDrillReportPrintData,
    FuelStatus, MaintenanceEvent, MateriovigilanceReportPrintData, MgpsDailyLogPrintData,
    MgpsIncident, MgpsReading, WaterQualityTestPrintData, WaterTestParameter,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── AMC Contract Summary ──────────────────────────────────────────────────────

/// GET /print-data/amc-contract/{contract_id}
pub async fn get_amc_contract_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contract_id): Path<Uuid>,
) -> Result<Json<AmcContractPrintData>, AppError> {
    require_permission(&claims, permissions::bme::contracts::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ContractRow {
        contract_number: String,
        contract_type: String,
        vendor_name: Option<String>,
        vendor_contact: Option<String>,
        vendor_email: Option<String>,
        contract_start: chrono::NaiveDate,
        contract_end: chrono::NaiveDate,
        contract_value: Option<f64>,
        payment_terms: Option<String>,
        sla_response_hours: Option<i32>,
        sla_resolution_hours: Option<i32>,
        coverage_details: Option<String>,
        exclusions: Option<String>,
        renewal_date: chrono::NaiveDate,
        equipment_name: Option<String>,
        asset_tag: Option<String>,
        location: Option<String>,
        serial_number: Option<String>,
    }

    // A BME contract covers exactly one machine (`bme_contracts.equipment_id`).
    let contract = sqlx::query_as::<_, ContractRow>(
        r"
        SELECT
            c.contract_number,
            upper(c.contract_type::text) AS contract_type,
            v.name AS vendor_name,
            v.phone AS vendor_contact,
            v.email AS vendor_email,
            c.start_date AS contract_start,
            c.end_date AS contract_end,
            c.contract_value::float8 AS contract_value,
            c.payment_terms,
            c.sla_response_hours,
            c.sla_resolution_hours,
            c.coverage_details,
            c.exclusions,
            c.end_date - c.renewal_alert_days AS renewal_date,
            e.name AS equipment_name,
            e.asset_tag,
            e.location_description AS location,
            e.serial_number
        FROM bme_contracts c
        LEFT JOIN vendors v ON v.id = c.vendor_id AND v.deleted_at IS NULL
        LEFT JOIN bme_equipment e ON e.id = c.equipment_id AND e.deleted_at IS NULL
        WHERE c.id = $1 AND c.deleted_at IS NULL
        ",
    )
    .bind(contract_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // A contract covering nothing prints as covering nothing — never an
    // invented machine.
    let equipment_covered: Vec<EquipmentCoverage> = contract
        .equipment_name
        .map(|equipment_name| EquipmentCoverage {
            equipment_name,
            equipment_id: contract.asset_tag.unwrap_or_default(),
            location: contract.location.unwrap_or_default(),
            serial_number: contract.serial_number,
        })
        .into_iter()
        .collect();

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(AmcContractPrintData {
        contract_number: contract.contract_number,
        contract_type: contract.contract_type,
        vendor_name: contract.vendor_name.unwrap_or_default(),
        vendor_contact: contract.vendor_contact,
        vendor_email: contract.vendor_email,
        equipment_covered,
        contract_start: contract.contract_start.format("%d-%m-%Y").to_string(),
        contract_end: contract.contract_end.format("%d-%m-%Y").to_string(),
        contract_value: contract.contract_value,
        payment_terms: contract.payment_terms,
        response_time_sla: contract.sla_response_hours.map(|h| format!("{h} hours")),
        resolution_time_sla: contract.sla_resolution_hours.map(|h| format!("{h} hours")),
        // Coverage and exclusions are recorded as free text, one entry each.
        inclusions: contract.coverage_details.into_iter().collect(),
        exclusions: contract.exclusions.into_iter().collect(),
        // ponytail: escalation_contacts not recorded anywhere yet
        escalation_contacts: vec![],
        renewal_date: Some(contract.renewal_date.format("%d-%m-%Y").to_string()),
        hospital_name: hospital.name,
    }))
}

// ── Calibration Certificate ───────────────────────────────────────────────────

/// GET /print-data/calibration-certificate/{calibration_id}
pub async fn get_calibration_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(calibration_id): Path<Uuid>,
) -> Result<Json<CalibrationCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::bme::calibration::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct CalibRow {
        certificate_number: Option<String>,
        calibration_date: Option<chrono::NaiveDate>,
        next_due_date: Option<chrono::NaiveDate>,
        equipment_name: String,
        asset_tag: Option<String>,
        serial_number: Option<String>,
        manufacturer: Option<String>,
        model: Option<String>,
        location: Option<String>,
        agency_name: Option<String>,
        calibration_standard: Option<String>,
        is_in_tolerance: Option<bool>,
        calibrated_by: Option<String>,
        remarks: Option<String>,
    }

    // `bme_calibrations` is what the BME screen writes; the legacy
    // `calibrations` / `equipment` tables this used to read have no writer.
    let calib = sqlx::query_as::<_, CalibRow>(
        r"
        SELECT
            c.certificate_number,
            c.last_calibrated_date AS calibration_date,
            c.next_due_date,
            e.name AS equipment_name,
            e.asset_tag,
            e.serial_number,
            e.make AS manufacturer,
            e.model,
            e.location_description AS location,
            v.name AS agency_name,
            c.reference_standard AS calibration_standard,
            c.is_in_tolerance,
            c.calibrated_by,
            COALESCE(c.deviation_notes, c.notes) AS remarks
        FROM bme_calibrations c
        JOIN bme_equipment e ON e.id = c.equipment_id
        LEFT JOIN vendors v ON v.id = c.calibration_vendor_id AND v.deleted_at IS NULL
        WHERE c.id = $1 AND c.deleted_at IS NULL
        ",
    )
    .bind(calibration_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    // No parameter readings are printed, because none are recorded.
    //
    // This used to invent two: accuracy measured 0.3% against a ±0.5%
    // tolerance, linearity 0.8% against ±1.0%, both "Pass". Those are
    // metrology readings nobody took, on a certificate an inspector reads to
    // decide whether a machine attached to patients measures what it claims.
    // Nothing in this system stores per-parameter results — `bme_calibrations`
    // keeps a single in-tolerance flag — so the certificate carries the
    // overall result and leaves the table empty rather than filling it in.
    let parameters: Vec<CalibrationParameter> = Vec::new();

    let fmt_date = |d: Option<chrono::NaiveDate>| d.map(|d| d.format("%d-%m-%Y").to_string());

    Ok(Json(CalibrationCertificatePrintData {
        certificate_number: calib.certificate_number,
        calibration_date: fmt_date(calib.calibration_date),
        next_calibration_due: fmt_date(calib.next_due_date),
        equipment_name: calib.equipment_name,
        equipment_id: calib.asset_tag.unwrap_or_default(),
        serial_number: calib.serial_number,
        manufacturer: calib.manufacturer,
        model: calib.model,
        location: calib.location.unwrap_or_default(),
        calibration_agency: calib.agency_name.unwrap_or_default(),
        // ponytail: agency_accreditation and approved_by not recorded anywhere yet
        agency_accreditation: None,
        calibration_standard: calib.calibration_standard,
        parameters_calibrated: parameters,
        // The result is the recorded tolerance; an unrecorded one is not a pass.
        calibration_result: match calib.is_in_tolerance {
            Some(true) => "Pass".to_owned(),
            Some(false) => "Fail".to_owned(),
            None => "Not recorded".to_owned(),
        },
        calibrated_by: calib.calibrated_by.unwrap_or_default(),
        approved_by: None,
        remarks: calib.remarks,
        hospital_name: hospital.name,
    }))
}

// ── Equipment Breakdown Report ────────────────────────────────────────────────

/// GET /print-data/equipment-breakdown/{breakdown_id}
pub async fn get_equipment_breakdown_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(breakdown_id): Path<Uuid>,
) -> Result<Json<EquipmentBreakdownReportPrintData>, AppError> {
    require_permission(&claims, permissions::bme::breakdowns::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct BreakdownReportRow {
        report_date: chrono::DateTime<Utc>,
        equipment_name: String,
        asset_tag: Option<String>,
        serial_number: Option<String>,
        location: Option<String>,
        department_name: Option<String>,
        reported_at: chrono::DateTime<Utc>,
        reported_by: Option<String>,
        fault_description: String,
        repair_action: Option<String>,
        downtime_minutes: Option<f64>,
        repair_cost: Option<f64>,
        repaired_by: Option<String>,
        resolved_at: Option<chrono::DateTime<Utc>>,
        verified_by: Option<String>,
    }

    // The breakdown plus the latest work order raised against it: the repair
    // is what the breakdown's resolution notes say, else what the work order
    // records as done; verification is the supervisor's sign-off on it.
    let breakdown = sqlx::query_as::<_, BreakdownReportRow>(
        r"
        SELECT
            b.created_at AS report_date,
            e.name AS equipment_name,
            e.asset_tag,
            e.serial_number,
            e.location_description AS location,
            d.name AS department_name,
            b.reported_at,
            reporter.full_name AS reported_by,
            b.description AS fault_description,
            COALESCE(b.resolution_notes, wo.actions_taken) AS repair_action,
            COALESCE(
                b.downtime_minutes::float8,
                EXTRACT(EPOCH FROM (b.downtime_end - b.downtime_start))::float8 / 60.0
            ) AS downtime_minutes,
            b.total_repair_cost::float8 AS repair_cost,
            resolver.full_name AS repaired_by,
            b.resolved_at,
            verifier.full_name AS verified_by
        FROM bme_breakdowns b
        JOIN bme_equipment e ON e.id = b.equipment_id
        LEFT JOIN departments d ON d.id = COALESCE(b.department_id, e.department_id)
        LEFT JOIN users reporter ON reporter.id = b.reported_by
        LEFT JOIN users resolver ON resolver.id = b.resolved_by
        LEFT JOIN LATERAL (
            SELECT w.actions_taken, w.supervisor_sign_off_by
            FROM bme_work_orders w
            WHERE w.breakdown_id = b.id AND w.deleted_at IS NULL
            ORDER BY w.created_at DESC
            LIMIT 1
        ) wo ON true
        LEFT JOIN users verifier ON verifier.id = wo.supervisor_sign_off_by
        WHERE b.id = $1 AND b.deleted_at IS NULL
        ",
    )
    .bind(breakdown_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(EquipmentBreakdownReportPrintData {
        // ponytail: report_number, impact_assessment, immediate_action_taken,
        // root_cause, preventive_measures not recorded anywhere yet
        report_number: None,
        report_date: breakdown
            .report_date
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        equipment_name: breakdown.equipment_name,
        equipment_id: breakdown.asset_tag.unwrap_or_default(),
        serial_number: breakdown.serial_number,
        location: breakdown.location.unwrap_or_default(),
        department: breakdown.department_name.unwrap_or_default(),
        breakdown_datetime: breakdown
            .reported_at
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        reported_by: breakdown.reported_by.unwrap_or_default(),
        fault_description: breakdown.fault_description,
        impact_assessment: None,
        immediate_action_taken: None,
        root_cause: None,
        repair_action: breakdown.repair_action,
        // ponytail: spare parts are free text (`spare_parts_used`), not itemised
        parts_replaced: vec![],
        downtime_hours: breakdown.downtime_minutes.map(|m| m / 60.0),
        repair_cost: breakdown.repair_cost,
        repaired_by: breakdown.repaired_by,
        repair_completed_at: breakdown
            .resolved_at
            .map(|t| t.with_timezone(&tz).format("%d-%m-%Y %H:%M").to_string()),
        verified_by: breakdown.verified_by,
        preventive_measures: None,
        hospital_name: hospital.name,
    }))
}

// ── Equipment History Card ────────────────────────────────────────────────────

/// GET /print-data/equipment-history/{equipment_id}
#[derive(Debug, sqlx::FromRow)]
struct MaintenanceRow {
    completed_at: Option<chrono::DateTime<Utc>>,
    order_type: String,
    description: Option<String>,
    performed_by: Option<String>,
    total_cost: Option<rust_decimal::Decimal>,
}

#[derive(Debug, sqlx::FromRow)]
struct BreakdownRow {
    reported_at: chrono::DateTime<Utc>,
    description: Option<String>,
    downtime_minutes: Option<i32>,
    total_repair_cost: Option<rust_decimal::Decimal>,
}

#[derive(Debug, sqlx::FromRow)]
struct CalibrationRow {
    last_calibrated_date: Option<chrono::NaiveDate>,
    next_due_date: Option<chrono::NaiveDate>,
    is_in_tolerance: Option<bool>,
    certificate_number: Option<String>,
    agency: Option<String>,
}

pub async fn get_equipment_history_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(equipment_id): Path<Uuid>,
) -> Result<Json<EquipmentHistoryCardPrintData>, AppError> {
    require_permission(&claims, permissions::bme::equipment::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct EquipRow {
        equipment_name: String,
        asset_tag: Option<String>,
        serial_number: Option<String>,
        manufacturer: Option<String>,
        model: Option<String>,
        purchase_date: Option<chrono::NaiveDate>,
        installation_date: Option<chrono::NaiveDate>,
        warranty_expiry: Option<chrono::NaiveDate>,
        purchase_cost: Option<f64>,
        location: Option<String>,
        department_name: Option<String>,
        asset_category: Option<String>,
        status: String,
        updated_at: chrono::DateTime<Utc>,
        total_maintenance_cost: f64,
        total_downtime_hours: f64,
    }

    // Totals cover the machine's whole history, not just the 50 rows listed:
    // cost is what completed work orders cost; downtime is every breakdown's
    // recorded minutes, else its downtime window.
    let equip = sqlx::query_as::<_, EquipRow>(
        r"
        SELECT
            e.name AS equipment_name,
            e.asset_tag,
            e.serial_number,
            e.make AS manufacturer,
            e.model,
            e.purchase_date,
            e.installation_date,
            e.warranty_end_date AS warranty_expiry,
            e.purchase_cost::float8 AS purchase_cost,
            e.location_description AS location,
            d.name AS department_name,
            e.category AS asset_category,
            e.status::text AS status,
            e.updated_at,
            (SELECT COALESCE(SUM(w.total_cost), 0)::float8
               FROM bme_work_orders w
              WHERE w.equipment_id = e.id AND w.completed_at IS NOT NULL
                AND w.deleted_at IS NULL) AS total_maintenance_cost,
            (SELECT COALESCE(SUM(COALESCE(
                        b.downtime_minutes::float8,
                        EXTRACT(EPOCH FROM (b.downtime_end - b.downtime_start))::float8 / 60.0
                    )), 0) / 60.0
               FROM bme_breakdowns b
              WHERE b.equipment_id = e.id AND b.deleted_at IS NULL) AS total_downtime_hours
        FROM bme_equipment e
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.id = $1 AND e.deleted_at IS NULL
        ",
    )
    .bind(equipment_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // The service history this machine actually has.
    //
    // All three lists used to be invented: two preventive-maintenance visits
    // by "BME Team" and a "Vendor Engineer", a power-supply breakdown, and a
    // calibration reading "Pass" from "Calibration Services Ltd". An
    // equipment history card is what a hospital shows an inspector to prove a
    // machine attached to patients has been serviced and calibrated, so a
    // fabricated "Pass" is a fabricated compliance record on a medical device.
    // An empty card is a machine with no history on file, which is a finding.
    let maintenance_history = sqlx::query_as!(
        MaintenanceRow,
        "SELECT w.completed_at AS \"completed_at?\", w.order_type::text AS \"order_type!\", \
                w.description AS \"description?\", u.full_name AS \"performed_by?\", \
                w.total_cost AS \"total_cost?\" \
           FROM bme_work_orders w \
           LEFT JOIN users u ON u.id = w.technician_sign_off_by \
          WHERE w.equipment_id = $1 AND w.completed_at IS NOT NULL \
            AND w.deleted_at IS NULL \
          ORDER BY w.completed_at DESC \
          LIMIT 50",
        equipment_id,
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|row| MaintenanceEvent {
        date: row.completed_at.map_or_else(String::new, |d| {
            d.with_timezone(&tz).format("%d-%m-%Y").to_string()
        }),
        maintenance_type: row.order_type,
        description: row.description.unwrap_or_default(),
        performed_by: row
            .performed_by
            .unwrap_or_else(|| "Not recorded".to_owned()),
        cost: row.total_cost.and_then(|c| c.to_string().parse().ok()),
    })
    .collect::<Vec<_>>();

    let breakdown_history = sqlx::query_as!(
        BreakdownRow,
        "SELECT reported_at AS \"reported_at!\", description AS \"description?\", \
                downtime_minutes AS \"downtime_minutes?\", \
                total_repair_cost AS \"total_repair_cost?\" \
           FROM bme_breakdowns \
          WHERE equipment_id = $1 AND deleted_at IS NULL \
          ORDER BY reported_at DESC \
          LIMIT 50",
        equipment_id,
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|row| BreakdownEvent {
        date: row
            .reported_at
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        fault: row.description.unwrap_or_default(),
        downtime_hours: f64::from(row.downtime_minutes.unwrap_or(0)) / 60.0,
        repair_cost: row
            .total_repair_cost
            .and_then(|c| c.to_string().parse().ok()),
    })
    .collect::<Vec<_>>();

    let calibration_history = sqlx::query_as!(
        CalibrationRow,
        "SELECT c.last_calibrated_date AS \"last_calibrated_date?\", \
                c.next_due_date AS \"next_due_date?\", \
                c.is_in_tolerance AS \"is_in_tolerance?\", \
                c.certificate_number AS \"certificate_number?\", v.name AS \"agency?\" \
           FROM bme_calibrations c \
           LEFT JOIN vendors v ON v.id = c.calibration_vendor_id \
          WHERE c.equipment_id = $1 AND c.deleted_at IS NULL \
          ORDER BY c.last_calibrated_date DESC NULLS LAST \
          LIMIT 50",
        equipment_id,
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|row| CalibrationEvent {
        date: row
            .last_calibrated_date
            .map_or_else(String::new, |d| d.format("%d-%m-%Y").to_string()),
        agency: row
            .agency
            .or(row.certificate_number)
            .unwrap_or_else(|| "Not recorded".to_owned()),
        // Pass/fail comes from the recorded tolerance, and an unrecorded
        // tolerance is not a pass.
        result: match row.is_in_tolerance {
            Some(true) => "Pass".to_owned(),
            Some(false) => "Fail".to_owned(),
            None => "Not recorded".to_owned(),
        },
        next_due: row
            .next_due_date
            .map_or_else(String::new, |d| d.format("%d-%m-%Y").to_string()),
    })
    .collect::<Vec<_>>();

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(EquipmentHistoryCardPrintData {
        equipment_name: equip.equipment_name,
        equipment_id: equip.asset_tag.unwrap_or_default(),
        serial_number: equip.serial_number,
        manufacturer: equip.manufacturer,
        model: equip.model,
        purchase_date: equip
            .purchase_date
            .map(|d| d.format("%d-%m-%Y").to_string()),
        installation_date: equip
            .installation_date
            .map(|d| d.format("%d-%m-%Y").to_string()),
        warranty_expiry: equip
            .warranty_expiry
            .map(|d| d.format("%d-%m-%Y").to_string()),
        purchase_cost: equip.purchase_cost,
        location: equip.location.unwrap_or_default(),
        department: equip.department_name.unwrap_or_default(),
        asset_category: equip.asset_category,
        maintenance_history,
        breakdown_history,
        calibration_history,
        total_maintenance_cost: equip.total_maintenance_cost,
        total_downtime_hours: equip.total_downtime_hours,
        current_status: equip.status,
        last_updated: equip
            .updated_at
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        hospital_name: hospital.name,
    }))
}

// ── MGPS Daily Log ────────────────────────────────────────────────────────────

/// GET /print-data/mgps-log/{reading_id}
///
/// `fms_gas_readings` records readings with a time but no shift, so the log is
/// addressed by one reading and prints every gas reading on that reading's day.
pub async fn get_mgps_log_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(reading_id): Path<Uuid>,
) -> Result<Json<MgpsDailyLogPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::gas::LIST)?;

    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct GasRow {
        reading_at: chrono::DateTime<Utc>,
        gas_type: String,
        pressure_bar: Option<f64>,
        purity_percent: Option<f64>,
        flow_lpm: Option<f64>,
        is_alarm: bool,
        alarm_reason: Option<String>,
        notes: Option<String>,
        recorded_by: Option<String>,
    }

    let rows = sqlx::query_as::<_, GasRow>(
        r"
        SELECT
            g.reading_at,
            g.gas_type::text AS gas_type,
            g.pressure_bar::float8 AS pressure_bar,
            g.purity_percent::float8 AS purity_percent,
            g.flow_lpm::float8 AS flow_lpm,
            g.is_alarm,
            g.alarm_reason,
            g.notes,
            u.full_name AS recorded_by
        FROM fms_gas_readings a
        JOIN fms_gas_readings g
          ON g.reading_at::date = a.reading_at::date AND g.deleted_at IS NULL
        LEFT JOIN users u ON u.id = g.recorded_by
        WHERE a.id = $1 AND a.deleted_at IS NULL
        ORDER BY g.reading_at
        LIMIT 200
        ",
    )
    .bind(reading_id)
    .fetch_all(&mut *conn)
    .await?;

    let (Some(first), Some(last)) = (rows.first(), rows.last()) else {
        return Err(AppError::NotFound);
    };
    let log_date = first
        .reading_at
        .with_timezone(&tz)
        .format("%d-%m-%Y")
        .to_string();
    let operator_name = last.recorded_by.clone().unwrap_or_default();

    let incidents = rows
        .iter()
        .filter(|r| r.is_alarm)
        .map(|r| MgpsIncident {
            time: r.reading_at.with_timezone(&tz).format("%H:%M").to_string(),
            description: r.alarm_reason.clone().unwrap_or_default(),
            // ponytail: the action taken on an alarm is not recorded anywhere yet
            action_taken: String::new(),
        })
        .collect();
    let notes: Vec<&str> = rows.iter().filter_map(|r| r.notes.as_deref()).collect();
    let remarks = (!notes.is_empty()).then(|| notes.join("; "));

    let readings = rows
        .into_iter()
        .map(|r| MgpsReading {
            time: r.reading_at.with_timezone(&tz).format("%H:%M").to_string(),
            gas_type: r.gas_type,
            line_pressure: r.pressure_bar,
            purity_percent: r.purity_percent,
            flow_rate: r.flow_lpm,
            alarm_status: if r.is_alarm { "Alarm" } else { "No alarm" }.to_owned(),
        })
        .collect();

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(MgpsDailyLogPrintData {
        log_date,
        // ponytail: shift, consumption, cylinder banks, manifold status and
        // supervisor verification are not recorded anywhere yet
        shift: None,
        operator_name,
        readings,
        consumption: None,
        incidents,
        cylinder_status: vec![],
        manifold_status: String::new(),
        remarks,
        supervisor_verified: None,
        supervisor_name: None,
        hospital_name: hospital.name,
    }))
}

// ── Water Quality Test ────────────────────────────────────────────────────────

/// GET /print-data/water-quality/{test_id}
///
/// `fms_water_tests` stores one row per parameter. `test_id` is one of those
/// rows; the print gathers every parameter of the same test — same source,
/// test type, location, collection date and certificate.
pub async fn get_water_quality_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(test_id): Path<Uuid>,
) -> Result<Json<WaterQualityTestPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::water::LIST)?;

    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct WaterRow {
        sample_date: chrono::NaiveDate,
        certificate_number: Option<String>,
        sample_location: Option<String>,
        source_type: String,
        tested_by: Option<String>,
        lab_name: Option<String>,
        parameter_name: String,
        unit: Option<String>,
        result_value: Option<String>,
        acceptable_min: Option<String>,
        acceptable_max: Option<String>,
        is_within_limits: Option<bool>,
        corrective_action: Option<String>,
        notes: Option<String>,
    }

    let rows = sqlx::query_as::<_, WaterRow>(
        r"
        SELECT
            t.sample_date,
            t.certificate_number,
            l.name AS sample_location,
            t.source_type::text AS source_type,
            t.tested_by,
            t.lab_name,
            t.parameter_name,
            t.unit,
            t.result_value::text AS result_value,
            t.acceptable_min::text AS acceptable_min,
            t.acceptable_max::text AS acceptable_max,
            t.is_within_limits,
            t.corrective_action,
            t.notes
        FROM fms_water_tests a
        JOIN fms_water_tests t
          ON t.source_type = a.source_type
         AND t.test_type = a.test_type
         AND t.location_id IS NOT DISTINCT FROM a.location_id
         AND t.sample_date = a.sample_date
         AND t.certificate_number IS NOT DISTINCT FROM a.certificate_number
         AND t.deleted_at IS NULL
        LEFT JOIN locations l ON l.id = t.location_id AND l.deleted_at IS NULL
        WHERE a.id = $1 AND a.deleted_at IS NULL
        ORDER BY t.parameter_name
        LIMIT 100
        ",
    )
    .bind(test_id)
    .fetch_all(&mut *conn)
    .await?;

    let Some(first) = rows.first() else {
        return Err(AppError::NotFound);
    };

    // A limit verdict per parameter; an unrecorded verdict is not a pass, and
    // one failure fails the whole test.
    let verdict = |v: Option<bool>| match v {
        Some(true) => "Pass",
        Some(false) => "Fail",
        None => "Not recorded",
    };
    let overall_result = if rows.iter().any(|r| r.is_within_limits == Some(false)) {
        "Fail"
    } else if rows.iter().all(|r| r.is_within_limits == Some(true)) {
        "Pass"
    } else {
        "Not recorded"
    };

    let join_texts = |texts: Vec<&str>| (!texts.is_empty()).then(|| texts.join("; "));
    let action_required = join_texts(
        rows.iter()
            .filter_map(|r| r.corrective_action.as_deref())
            .collect(),
    );
    let remarks = join_texts(rows.iter().filter_map(|r| r.notes.as_deref()).collect());

    let test_date = first.sample_date.format("%d-%m-%Y").to_string();
    let sample_id = first.certificate_number.clone().unwrap_or_default();
    let sample_location = first.sample_location.clone().unwrap_or_default();
    let sample_type = first.source_type.clone();
    let tested_by = first
        .tested_by
        .clone()
        .or_else(|| first.lab_name.clone())
        .unwrap_or_default();

    let test_parameters = rows
        .iter()
        .map(|r| WaterTestParameter {
            parameter: r.parameter_name.clone(),
            unit: r.unit.clone().unwrap_or_default(),
            result: r.result_value.clone().unwrap_or_default(),
            acceptable_range: match (&r.acceptable_min, &r.acceptable_max) {
                (Some(min), Some(max)) => format!("{min} – {max}"),
                (Some(min), None) => format!("≥ {min}"),
                (None, Some(max)) => format!("≤ {max}"),
                (None, None) => String::new(),
            },
            status: verdict(r.is_within_limits).to_owned(),
        })
        .collect();

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(WaterQualityTestPrintData {
        test_date,
        sample_id,
        sample_location,
        sample_type,
        // ponytail: collector, microbiology breakdown and next-due are not
        // recorded on the test rows
        collected_by: None,
        tested_by,
        test_parameters,
        overall_result: overall_result.to_owned(),
        microbiological_results: None,
        action_required,
        next_test_due: None,
        remarks,
        hospital_name: hospital.name,
    }))
}

// ── DG/UPS Run Log ────────────────────────────────────────────────────────────

/// GET /print-data/dg-ups-log/{reading_id}
///
/// `fms_energy_readings` is the only record of a DG set or UPS, and a source
/// is identified there by its type, free-text equipment name and location —
/// there is no equipment id. So the log is addressed by one of its readings:
/// it prints every reading of that same source on that reading's day.
pub async fn get_dg_ups_log_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(reading_id): Path<Uuid>,
) -> Result<Json<DgUpsRunLogPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::energy::LIST)?;

    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ReadingRow {
        source_type: String,
        equipment_name: Option<String>,
        location: Option<String>,
        reading_at: chrono::DateTime<Utc>,
        frequency_hz: Option<f64>,
        power_kw: Option<f64>,
        runtime_hours: Option<f64>,
        fuel_level_percent: Option<f64>,
        battery_voltage: Option<f64>,
        battery_health_percent: Option<f64>,
        notes: Option<String>,
        alarm_reason: Option<String>,
        recorded_by: Option<String>,
    }

    let readings = sqlx::query_as::<_, ReadingRow>(
        r"
        SELECT
            r.source_type::text AS source_type,
            r.equipment_name,
            l.name AS location,
            r.reading_at,
            r.frequency_hz::float8 AS frequency_hz,
            r.power_kw::float8 AS power_kw,
            r.runtime_hours::float8 AS runtime_hours,
            r.fuel_level_percent::float8 AS fuel_level_percent,
            r.battery_voltage::float8 AS battery_voltage,
            r.battery_health_percent::float8 AS battery_health_percent,
            r.notes,
            r.alarm_reason,
            u.full_name AS recorded_by
        FROM fms_energy_readings a
        JOIN fms_energy_readings r
          ON r.source_type = a.source_type
         AND r.equipment_name IS NOT DISTINCT FROM a.equipment_name
         AND r.location_id IS NOT DISTINCT FROM a.location_id
         AND r.reading_at::date = a.reading_at::date
         AND r.deleted_at IS NULL
        LEFT JOIN locations l ON l.id = r.location_id AND l.deleted_at IS NULL
        LEFT JOIN users u ON u.id = r.recorded_by
        WHERE a.id = $1 AND a.deleted_at IS NULL
          AND a.source_type IN ('dg_set', 'ups')
        ORDER BY r.reading_at
        LIMIT 200
        ",
    )
    .bind(reading_id)
    .fetch_all(&mut *conn)
    .await?;

    let (Some(first), Some(last)) = (readings.first(), readings.last()) else {
        return Err(AppError::NotFound);
    };

    let remarks: Vec<&str> = readings
        .iter()
        .flat_map(|r| [r.alarm_reason.as_deref(), r.notes.as_deref()])
        .flatten()
        .collect();

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(DgUpsRunLogPrintData {
        log_date: first
            .reading_at
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        equipment_type: if first.source_type == "dg_set" {
            "DG"
        } else {
            "UPS"
        }
        .to_owned(),
        equipment_id: first.equipment_name.clone().unwrap_or_default(),
        location: first.location.clone().unwrap_or_default(),
        // ponytail: capacity, start/stop run events, fuel added/consumed,
        // battery current and charge are not recorded anywhere yet
        capacity: String::new(),
        run_events: vec![],
        // Fuel level is recorded as a percentage of tank on each reading.
        fuel_status: (first.fuel_level_percent.is_some() || last.fuel_level_percent.is_some())
            .then_some(FuelStatus {
                opening_level: first.fuel_level_percent,
                closing_level: last.fuel_level_percent,
                fuel_added: None,
                fuel_consumed: None,
            }),
        battery_status: (last.battery_voltage.is_some() || last.battery_health_percent.is_some())
            .then_some(BatteryStatus {
                voltage: last.battery_voltage,
                current: None,
                charge_percent: None,
                health_status: last
                    .battery_health_percent
                    .map(|h| format!("{h:.0}% health")),
            }),
        daily_parameters: DgUpsParameters {
            // Readings record one voltage, not R/Y/B phases.
            voltage_r: None,
            voltage_y: None,
            voltage_b: None,
            frequency: last.frequency_hz,
            load_kw: last.power_kw,
            runtime_hours: last.runtime_hours,
        },
        operator_name: last.recorded_by.clone().unwrap_or_default(),
        remarks: (!remarks.is_empty()).then(|| remarks.join("; ")),
        hospital_name: hospital.name,
    }))
}

// ── Fire Equipment Inspection ─────────────────────────────────────────────────

/// GET /print-data/fire-inspection/{inspection_id}
///
/// `inspection_id` is `fms_fire_inspections.id` — one inspection of one piece
/// of fire equipment.
pub async fn get_fire_inspection_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(inspection_id): Path<Uuid>,
) -> Result<Json<FireEquipmentInspectionPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::fire::LIST)?;

    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct InspectionRow {
        inspection_date: chrono::NaiveDate,
        is_functional: bool,
        findings: Option<String>,
        corrective_action: Option<String>,
        next_inspection_date: Option<chrono::NaiveDate>,
        inspector_name: Option<String>,
        inspector_designation: Option<String>,
        equipment_name: String,
        equipment_type: String,
        location: Option<String>,
    }

    let inspection = sqlx::query_as::<_, InspectionRow>(
        r"
        SELECT
            i.inspection_date,
            i.is_functional,
            i.findings,
            i.corrective_action,
            i.next_inspection_date,
            u.full_name AS inspector_name,
            COALESCE(des.name, u.designation) AS inspector_designation,
            e.name AS equipment_name,
            e.equipment_type::text AS equipment_type,
            l.name AS location
        FROM fms_fire_inspections i
        JOIN fms_fire_equipment e ON e.id = i.equipment_id
        LEFT JOIN locations l ON l.id = e.location_id AND l.deleted_at IS NULL
        LEFT JOIN users u ON u.id = i.inspected_by
        LEFT JOIN designations des ON des.id = u.designation_id
        WHERE i.id = $1 AND i.deleted_at IS NULL
        ",
    )
    .bind(inspection_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // The inspected item, named from its record: "<name> (<type>) — <location>".
    let item = format!(
        "{} ({})",
        inspection.equipment_name, inspection.equipment_type
    );
    let area_inspected = match inspection.location {
        Some(location) => format!("{item} — {location}"),
        None => item,
    };

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(FireEquipmentInspectionPrintData {
        inspection_date: inspection.inspection_date.format("%d-%m-%Y").to_string(),
        // ponytail: inspection_number, the per-item checklists and supervisor
        // verification are not recorded anywhere yet — an inspection records
        // only whether the item is functional
        inspection_number: None,
        inspector_name: inspection.inspector_name.unwrap_or_default(),
        inspector_designation: inspection.inspector_designation.unwrap_or_default(),
        area_inspected,
        fire_extinguishers: vec![],
        fire_alarms: vec![],
        fire_hydrants: vec![],
        emergency_exits: vec![],
        sprinkler_system: None,
        overall_status: if inspection.is_functional {
            "Functional"
        } else {
            "Not functional"
        }
        .to_owned(),
        deficiencies_found: inspection.findings.into_iter().collect(),
        corrective_actions: inspection.corrective_action.into_iter().collect(),
        next_inspection_due: inspection
            .next_inspection_date
            .map_or_else(String::new, |d| d.format("%d-%m-%Y").to_string()),
        supervisor_verified: None,
        hospital_name: hospital.name,
    }))
}

// ── Materiovigilance Report ───────────────────────────────────────────────────

/// GET /print-data/materiovigilance/{report_id}
pub async fn get_materiovigilance_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(report_id): Path<Uuid>,
) -> Result<Json<MateriovigilanceReportPrintData>, AppError> {
    // Device adverse-event reporting is a regulatory submission, so it is
    // guarded as one rather than as equipment maintenance.
    require_permission(&claims, permissions::regulatory::materiovigilance::LIST)?;
    // Optional parent: this record is only sometimes about a patient.
    medbrains_authz_gate::require_access_via_optional(
        &state,
        &claims,
        medbrains_authz_gate::links::MATERIOVIGILANCE_REPORT,
        report_id,
    )
    .await?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ReportRow {
        report_number: String,
        report_date: chrono::DateTime<Utc>,
        reporter_name: Option<String>,
        reporter_designation: Option<String>,
        reporter_department: Option<String>,
        device_name: String,
        device_manufacturer: Option<String>,
        device_model: Option<String>,
        device_batch: Option<String>,
        event_date: chrono::NaiveDate,
        event_description: String,
        patient_involved: bool,
        patient_outcome: Option<String>,
        device_action: Option<String>,
        investigation_findings: Option<String>,
        corrective_action: Option<String>,
        submitted_to_cdsco: bool,
        cdsco_reference: Option<String>,
        status: String,
    }

    let report = sqlx::query_as::<_, ReportRow>(
        r"
        SELECT
            m.report_number,
            m.created_at AS report_date,
            u.full_name AS reporter_name,
            COALESCE(des.name, u.designation) AS reporter_designation,
            d.name AS reporter_department,
            m.device_name,
            m.device_manufacturer,
            m.device_model,
            m.device_batch,
            m.event_date,
            m.event_description,
            (m.patient_id IS NOT NULL) AS patient_involved,
            m.patient_outcome,
            m.device_action,
            m.investigation_findings,
            m.corrective_action,
            m.submitted_to_cdsco,
            m.cdsco_reference,
            m.status::text AS status
        FROM materiovigilance_reports m
        LEFT JOIN users u ON u.id = m.reporter_id
        LEFT JOIN designations des ON des.id = u.designation_id
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE m.id = $1 AND m.deleted_at IS NULL
        ",
    )
    .bind(report_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(MateriovigilanceReportPrintData {
        report_number: report.report_number,
        report_date: report
            .report_date
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        reporter_name: report.reporter_name.unwrap_or_default(),
        reporter_designation: report.reporter_designation.unwrap_or_default(),
        reporter_department: report.reporter_department.unwrap_or_default(),
        equipment_name: report.device_name,
        // ponytail: the report names the device in free text; equipment_id,
        // serial_number and injury_type are not recorded anywhere yet
        equipment_id: String::new(),
        manufacturer: report.device_manufacturer,
        model: report.device_model,
        serial_number: None,
        lot_batch_number: report.device_batch,
        incident_date: report.event_date.format("%d-%m-%Y").to_string(),
        incident_description: report.event_description,
        patient_involved: report.patient_involved,
        patient_outcome: report.patient_outcome,
        injury_type: None,
        immediate_action: report.device_action,
        root_cause_analysis: report.investigation_findings,
        corrective_action: report.corrective_action,
        reported_to_cdsco: report.submitted_to_cdsco,
        cdsco_reference: report.cdsco_reference,
        status: report.status,
        hospital_name: hospital.name,
    }))
}

// ── Fire Mock Drill Report ────────────────────────────────────────────────────

/// GET /print-data/fire-mock-drill/{drill_id}
///
/// `drill_id` is `fms_fire_drills.id` — the drill the Facilities fire-safety
/// screen records (and mirrors into the NABH register).
pub async fn get_fire_mock_drill_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(drill_id): Path<Uuid>,
) -> Result<Json<FireMockDrillReportPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::fire::LIST)?;

    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct DrillRow {
        drill_type: String,
        drill_date: chrono::NaiveDate,
        start_time: Option<chrono::DateTime<Utc>>,
        facility_name: Option<String>,
        zones_covered: Option<String>,
        participants_count: Option<i32>,
        scenario_description: Option<String>,
        evacuation_time_seconds: Option<i32>,
        findings: Option<String>,
        improvement_actions: Option<String>,
        conducted_by: Option<String>,
        next_drill_due: Option<chrono::NaiveDate>,
    }

    let drill = sqlx::query_as::<_, DrillRow>(
        r"
        SELECT
            f.drill_type::text AS drill_type,
            f.drill_date,
            f.start_time,
            fac.name AS facility_name,
            array_to_string(f.zones_covered, ', ') AS zones_covered,
            f.participants_count,
            f.scenario_description,
            f.evacuation_time_seconds,
            f.findings,
            f.improvement_actions,
            u.full_name AS conducted_by,
            f.next_drill_due
        FROM fms_fire_drills f
        LEFT JOIN facilities fac ON fac.id = f.facility_id AND fac.deleted_at IS NULL
        LEFT JOIN users u ON u.id = f.conducted_by
        WHERE f.id = $1 AND f.deleted_at IS NULL
        ",
    )
    .bind(drill_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let area_covered = [drill.facility_name, drill.zones_covered]
        .into_iter()
        .flatten()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" — ");

    let hospital = get_hospital_info(&state.db, claims.tenant_id).await?;

    Ok(Json(FireMockDrillReportPrintData {
        // ponytail: drill_number, target time, observation category,
        // equipment used, first responders and rating not recorded anywhere yet
        drill_number: None,
        drill_date: drill.drill_date.format("%d-%m-%Y").to_string(),
        drill_time: drill.start_time.map_or_else(String::new, |t| {
            t.with_timezone(&tz).format("%H:%M").to_string()
        }),
        drill_type: drill.drill_type,
        scenario: drill.scenario_description.unwrap_or_default(),
        area_covered,
        participants_count: drill.participants_count,
        evacuation_time_minutes: drill.evacuation_time_seconds.map(|s| f64::from(s) / 60.0),
        target_time_minutes: None,
        // Findings are recorded as one free-text note, uncategorised.
        observations: drill
            .findings
            .map(|observation| DrillObservation {
                observation,
                category: None,
                action_required: None,
            })
            .into_iter()
            .collect(),
        equipment_used: vec![],
        first_responders: vec![],
        areas_for_improvement: vec![],
        recommendations: drill.improvement_actions.into_iter().collect(),
        drill_conductor: drill.conducted_by.unwrap_or_default(),
        fire_officer_name: None,
        overall_rating: String::new(),
        next_drill_scheduled: drill
            .next_drill_due
            .map(|d| d.format("%d-%m-%Y").to_string()),
        hospital_name: hospital.name,
    }))
}

// ── Helper Functions ──────────────────────────────────────────────────────────

struct HospitalInfo {
    name: String,
}

/// The requesting tenant's name. It used to take the first active tenant on
/// the server, so a multi-tenant host printed another hospital's letterhead.
async fn get_hospital_info(pool: &PgPool, tenant_id: Uuid) -> Result<HospitalInfo, AppError> {
    let name = sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
        .unwrap_or_default();

    Ok(HospitalInfo { name })
}

/// bme print-data routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/amc-contract/{contract_id}",
            get(get_amc_contract_print_data),
        )
        .route(
            "/api/print-data/calibration-certificate/{calibration_id}",
            get(get_calibration_certificate_print_data),
        )
        .route(
            "/api/print-data/equipment-breakdown/{breakdown_id}",
            get(get_equipment_breakdown_print_data),
        )
        .route(
            "/api/print-data/equipment-history/{equipment_id}",
            get(get_equipment_history_print_data),
        )
        .route(
            "/api/print-data/mgps-log/{reading_id}",
            get(get_mgps_log_print_data),
        )
        .route(
            "/api/print-data/water-quality/{test_id}",
            get(get_water_quality_print_data),
        )
        .route(
            "/api/print-data/dg-ups-log/{reading_id}",
            get(get_dg_ups_log_print_data),
        )
        .route(
            "/api/print-data/fire-inspection/{inspection_id}",
            get(get_fire_inspection_print_data),
        )
        .route(
            "/api/print-data/materiovigilance/{report_id}",
            get(get_materiovigilance_print_data),
        )
        .route(
            "/api/print-data/fire-mock-drill/{drill_id}",
            get(get_fire_mock_drill_print_data),
        )
}

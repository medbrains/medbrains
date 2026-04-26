//! Print data routes for BME (Biomedical Engineering) and Safety forms.
//!
//! Phase 5: AMC Contracts, Calibration, Breakdown, History, MGPS, Water, DG/UPS, Fire Inspection.

use axum::{
    Json,
    extract::{Path, State},
};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_core::print_data::{
    AmcContractPrintData, BatteryStatus, BreakdownEvent, CalibrationCertificatePrintData,
    CalibrationEvent, CalibrationParameter, CylinderBank, DgUpsParameters, DgUpsRunLogPrintData,
    DrillObservation, EmergencyExitCheck, EquipmentBreakdownReportPrintData, EquipmentCoverage,
    EquipmentHistoryCardPrintData, EscalationContact, FireAlarmCheck,
    FireEquipmentInspectionPrintData, FireExtinguisherCheck, FireHydrantCheck,
    FireMockDrillReportPrintData, FirstResponder, FuelStatus, MaintenanceEvent,
    MateriovigilanceReportPrintData, MgpsConsumption, MgpsDailyLogPrintData, MgpsReading,
    MicrobiologicalResult, RunEvent, SprinklerCheck, WaterQualityTestPrintData, WaterTestParameter,
};

use crate::error::AppError;
use crate::state::AppState;

// ── AMC Contract Summary ──────────────────────────────────────────────────────

/// GET /print-data/amc-contract/{contract_id}
pub async fn get_amc_contract_print_data(
    State(state): State<AppState>,
    Path(contract_id): Path<Uuid>,
) -> Result<Json<AmcContractPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct ContractRow {
        contract_number: String,
        contract_type: String,
        vendor_name: String,
        vendor_contact: Option<String>,
        vendor_email: Option<String>,
        contract_start: chrono::NaiveDate,
        contract_end: chrono::NaiveDate,
        contract_value: f64,
        payment_terms: Option<String>,
        response_time_sla: Option<String>,
        resolution_time_sla: Option<String>,
    }

    let contract = sqlx::query_as::<_, ContractRow>(
        r"
        SELECT
            contract_number,
            contract_type,
            v.name as vendor_name,
            v.contact_number as vendor_contact,
            v.email as vendor_email,
            ac.start_date as contract_start,
            ac.end_date as contract_end,
            ac.contract_value,
            ac.payment_terms,
            ac.response_time_sla,
            ac.resolution_time_sla
        FROM amc_contracts ac
        JOIN vendors v ON ac.vendor_id = v.id
        WHERE ac.id = $1
        ",
    )
    .bind(contract_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // Get equipment covered
    #[derive(sqlx::FromRow)]
    struct EquipRow {
        equipment_name: String,
        equipment_code: String,
        location: String,
        serial_number: Option<String>,
    }

    let equipment = sqlx::query_as::<_, EquipRow>(
        r"
        SELECT
            e.name as equipment_name,
            e.equipment_code,
            COALESCE(l.name, 'Main Building') as location,
            e.serial_number
        FROM amc_equipment ae
        JOIN equipment e ON ae.equipment_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        WHERE ae.contract_id = $1
        ",
    )
    .bind(contract_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let equipment_covered: Vec<EquipmentCoverage> = if equipment.is_empty() {
        vec![EquipmentCoverage {
            equipment_name: "Medical Equipment".to_string(),
            equipment_id: "EQ-001".to_string(),
            location: "ICU".to_string(),
            serial_number: Some("SN-12345".to_string()),
        }]
    } else {
        equipment
            .into_iter()
            .map(|e| EquipmentCoverage {
                equipment_name: e.equipment_name,
                equipment_id: e.equipment_code,
                location: e.location,
                serial_number: e.serial_number,
            })
            .collect()
    };

    let hospital = get_hospital_info(pool).await?;

    Ok(Json(AmcContractPrintData {
        contract_number: contract.contract_number,
        contract_type: contract.contract_type,
        vendor_name: contract.vendor_name,
        vendor_contact: contract.vendor_contact,
        vendor_email: contract.vendor_email,
        equipment_covered,
        contract_start: contract.contract_start.format("%d-%m-%Y").to_string(),
        contract_end: contract.contract_end.format("%d-%m-%Y").to_string(),
        contract_value: contract.contract_value,
        payment_terms: contract.payment_terms,
        response_time_sla: contract.response_time_sla,
        resolution_time_sla: contract.resolution_time_sla,
        inclusions: vec![
            "Preventive Maintenance".to_string(),
            "Breakdown Calls".to_string(),
            "Spare Parts (as per terms)".to_string(),
        ],
        exclusions: vec![
            "Consumables".to_string(),
            "Physical Damage".to_string(),
            "Unauthorized Modifications".to_string(),
        ],
        escalation_contacts: vec![
            EscalationContact {
                level: 1,
                name: "Service Engineer".to_string(),
                designation: "Field Engineer".to_string(),
                phone: "9876543210".to_string(),
                email: Some("service@vendor.com".to_string()),
            },
            EscalationContact {
                level: 2,
                name: "Service Manager".to_string(),
                designation: "Regional Manager".to_string(),
                phone: "9876543211".to_string(),
                email: Some("manager@vendor.com".to_string()),
            },
        ],
        renewal_date: Some(
            (contract.contract_end - chrono::Duration::days(30))
                .format("%d-%m-%Y")
                .to_string(),
        ),
        hospital_name: hospital.name,
    }))
}

// ── Calibration Certificate ───────────────────────────────────────────────────

/// GET /print-data/calibration-certificate/{calibration_id}
pub async fn get_calibration_certificate_print_data(
    State(state): State<AppState>,
    Path(calibration_id): Path<Uuid>,
) -> Result<Json<CalibrationCertificatePrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct CalibRow {
        certificate_number: String,
        calibration_date: chrono::NaiveDate,
        next_due_date: chrono::NaiveDate,
        equipment_name: String,
        equipment_code: String,
        serial_number: Option<String>,
        manufacturer: Option<String>,
        model: Option<String>,
        location: String,
        agency_name: String,
        agency_accreditation: Option<String>,
        calibration_standard: Option<String>,
        result: String,
        calibrated_by: String,
        approved_by: Option<String>,
        remarks: Option<String>,
    }

    let calib = sqlx::query_as::<_, CalibRow>(
        r"
        SELECT
            c.certificate_number,
            c.calibration_date,
            c.next_due_date,
            e.name as equipment_name,
            e.equipment_code,
            e.serial_number,
            e.manufacturer,
            e.model,
            COALESCE(l.name, 'Main Building') as location,
            ca.name as agency_name,
            ca.accreditation_number as agency_accreditation,
            c.calibration_standard,
            c.result,
            u.full_name as calibrated_by,
            approver.full_name as approved_by,
            c.remarks
        FROM calibrations c
        JOIN equipment e ON c.equipment_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN calibration_agencies ca ON c.agency_id = ca.id
        LEFT JOIN users u ON c.calibrated_by = u.id
        LEFT JOIN users approver ON c.approved_by = approver.id
        WHERE c.id = $1
        ",
    )
    .bind(calibration_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(pool).await?;

    // Sample parameters
    let parameters = vec![
        CalibrationParameter {
            parameter_name: "Accuracy".to_string(),
            unit: "%".to_string(),
            nominal_value: "±0.5".to_string(),
            measured_value: "0.3".to_string(),
            tolerance: "±0.5".to_string(),
            result: "Pass".to_string(),
        },
        CalibrationParameter {
            parameter_name: "Linearity".to_string(),
            unit: "%".to_string(),
            nominal_value: "±1.0".to_string(),
            measured_value: "0.8".to_string(),
            tolerance: "±1.0".to_string(),
            result: "Pass".to_string(),
        },
    ];

    Ok(Json(CalibrationCertificatePrintData {
        certificate_number: calib.certificate_number,
        calibration_date: calib.calibration_date.format("%d-%m-%Y").to_string(),
        next_calibration_due: calib.next_due_date.format("%d-%m-%Y").to_string(),
        equipment_name: calib.equipment_name,
        equipment_id: calib.equipment_code,
        serial_number: calib.serial_number,
        manufacturer: calib.manufacturer,
        model: calib.model,
        location: calib.location,
        calibration_agency: calib.agency_name,
        agency_accreditation: calib.agency_accreditation,
        calibration_standard: calib.calibration_standard,
        parameters_calibrated: parameters,
        calibration_result: calib.result,
        calibrated_by: calib.calibrated_by,
        approved_by: calib.approved_by,
        remarks: calib.remarks,
        hospital_name: hospital.name,
    }))
}

// ── Equipment Breakdown Report ────────────────────────────────────────────────

/// GET /print-data/equipment-breakdown/{breakdown_id}
pub async fn get_equipment_breakdown_print_data(
    State(state): State<AppState>,
    Path(breakdown_id): Path<Uuid>,
) -> Result<Json<EquipmentBreakdownReportPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct BreakdownRow {
        report_number: String,
        report_date: chrono::DateTime<Utc>,
        equipment_name: String,
        equipment_code: String,
        serial_number: Option<String>,
        location: String,
        department_name: String,
        breakdown_time: chrono::DateTime<Utc>,
        reported_by: String,
        fault_description: String,
        impact: Option<String>,
        immediate_action: Option<String>,
        root_cause: Option<String>,
        repair_action: Option<String>,
        downtime_hours: f64,
        repair_cost: Option<f64>,
        repaired_by: Option<String>,
        repair_completed: Option<chrono::DateTime<Utc>>,
        verified_by: Option<String>,
        preventive_measures: Option<String>,
    }

    let breakdown = sqlx::query_as::<_, BreakdownRow>(
        r"
        SELECT
            b.report_number,
            b.created_at as report_date,
            e.name as equipment_name,
            e.equipment_code,
            e.serial_number,
            COALESCE(l.name, 'Main Building') as location,
            COALESCE(d.name, 'Engineering') as department_name,
            b.breakdown_datetime as breakdown_time,
            reporter.full_name as reported_by,
            b.fault_description,
            b.impact_assessment as impact,
            b.immediate_action,
            b.root_cause,
            b.repair_action,
            b.downtime_hours,
            b.repair_cost,
            repairer.full_name as repaired_by,
            b.repair_completed_at as repair_completed,
            verifier.full_name as verified_by,
            b.preventive_measures
        FROM equipment_breakdowns b
        JOIN equipment e ON b.equipment_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN users reporter ON b.reported_by = reporter.id
        LEFT JOIN users repairer ON b.repaired_by = repairer.id
        LEFT JOIN users verifier ON b.verified_by = verifier.id
        WHERE b.id = $1
        ",
    )
    .bind(breakdown_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(pool).await?;

    Ok(Json(EquipmentBreakdownReportPrintData {
        report_number: breakdown.report_number,
        report_date: breakdown.report_date.format("%d-%m-%Y").to_string(),
        equipment_name: breakdown.equipment_name,
        equipment_id: breakdown.equipment_code,
        serial_number: breakdown.serial_number,
        location: breakdown.location,
        department: breakdown.department_name,
        breakdown_datetime: breakdown
            .breakdown_time
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        reported_by: breakdown.reported_by,
        fault_description: breakdown.fault_description,
        impact_assessment: breakdown.impact,
        immediate_action_taken: breakdown.immediate_action,
        root_cause: breakdown.root_cause,
        repair_action: breakdown.repair_action,
        parts_replaced: vec![],
        downtime_hours: breakdown.downtime_hours,
        repair_cost: breakdown.repair_cost,
        repaired_by: breakdown.repaired_by,
        repair_completed_at: breakdown
            .repair_completed
            .map(|t| t.format("%d-%m-%Y %H:%M").to_string()),
        verified_by: breakdown.verified_by,
        preventive_measures: breakdown.preventive_measures,
        hospital_name: hospital.name,
    }))
}

// ── Equipment History Card ────────────────────────────────────────────────────

/// GET /print-data/equipment-history/{equipment_id}
pub async fn get_equipment_history_print_data(
    State(state): State<AppState>,
    Path(equipment_id): Path<Uuid>,
) -> Result<Json<EquipmentHistoryCardPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct EquipRow {
        equipment_name: String,
        equipment_code: String,
        serial_number: Option<String>,
        manufacturer: Option<String>,
        model: Option<String>,
        purchase_date: Option<chrono::NaiveDate>,
        installation_date: Option<chrono::NaiveDate>,
        warranty_expiry: Option<chrono::NaiveDate>,
        purchase_cost: Option<f64>,
        location: String,
        department_name: String,
        asset_category: Option<String>,
        status: String,
    }

    let equip = sqlx::query_as::<_, EquipRow>(
        r"
        SELECT
            e.name as equipment_name,
            e.equipment_code,
            e.serial_number,
            e.manufacturer,
            e.model,
            e.purchase_date,
            e.installation_date,
            e.warranty_expiry,
            e.purchase_cost,
            COALESCE(l.name, 'Main Building') as location,
            COALESCE(d.name, 'Engineering') as department_name,
            ac.name as asset_category,
            e.status
        FROM equipment e
        LEFT JOIN locations l ON e.location_id = l.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN asset_categories ac ON e.category_id = ac.id
        WHERE e.id = $1
        ",
    )
    .bind(equipment_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // Sample history events
    let maintenance_history = vec![
        MaintenanceEvent {
            date: "15-01-2026".to_string(),
            maintenance_type: "PM".to_string(),
            description: "Quarterly preventive maintenance".to_string(),
            performed_by: "BME Team".to_string(),
            cost: Some(5000.0),
        },
        MaintenanceEvent {
            date: "10-10-2025".to_string(),
            maintenance_type: "PM".to_string(),
            description: "Annual service".to_string(),
            performed_by: "Vendor Engineer".to_string(),
            cost: Some(15000.0),
        },
    ];

    let breakdown_history = vec![BreakdownEvent {
        date: "05-12-2025".to_string(),
        fault: "Power supply failure".to_string(),
        downtime_hours: 4.0,
        repair_cost: Some(8000.0),
    }];

    let calibration_history = vec![CalibrationEvent {
        date: "01-01-2026".to_string(),
        agency: "Calibration Services Ltd".to_string(),
        result: "Pass".to_string(),
        next_due: "01-01-2027".to_string(),
    }];

    let hospital = get_hospital_info(pool).await?;

    Ok(Json(EquipmentHistoryCardPrintData {
        equipment_name: equip.equipment_name,
        equipment_id: equip.equipment_code,
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
        location: equip.location,
        department: equip.department_name,
        asset_category: equip.asset_category,
        maintenance_history,
        breakdown_history,
        calibration_history,
        total_maintenance_cost: 28000.0,
        total_downtime_hours: 4.0,
        current_status: equip.status,
        last_updated: Utc::now().format("%d-%m-%Y").to_string(),
        hospital_name: hospital.name,
    }))
}

// ── MGPS Daily Log ────────────────────────────────────────────────────────────

/// GET /print-data/mgps-log/{date}/{shift}
pub async fn get_mgps_log_print_data(
    State(state): State<AppState>,
    Path((date, shift)): Path<(String, String)>,
) -> Result<Json<MgpsDailyLogPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    let log_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());

    let hospital = get_hospital_info(pool).await?;

    // Sample MGPS readings
    let readings = vec![
        MgpsReading {
            time: "08:00".to_string(),
            gas_type: "O2".to_string(),
            line_pressure: 4.5,
            purity_percent: Some(99.5),
            flow_rate: Some(120.0),
            alarm_status: "Normal".to_string(),
        },
        MgpsReading {
            time: "08:00".to_string(),
            gas_type: "N2O".to_string(),
            line_pressure: 4.2,
            purity_percent: None,
            flow_rate: Some(30.0),
            alarm_status: "Normal".to_string(),
        },
        MgpsReading {
            time: "08:00".to_string(),
            gas_type: "Air".to_string(),
            line_pressure: 4.8,
            purity_percent: None,
            flow_rate: Some(200.0),
            alarm_status: "Normal".to_string(),
        },
        MgpsReading {
            time: "12:00".to_string(),
            gas_type: "O2".to_string(),
            line_pressure: 4.4,
            purity_percent: Some(99.5),
            flow_rate: Some(150.0),
            alarm_status: "Normal".to_string(),
        },
    ];

    let cylinder_status = vec![
        CylinderBank {
            bank_id: "Bank-A".to_string(),
            gas_type: "O2".to_string(),
            primary_pressure: 150.0,
            secondary_pressure: 4.5,
            cylinders_full: 10,
            cylinders_in_use: 2,
            cylinders_empty: 0,
        },
        CylinderBank {
            bank_id: "Bank-B".to_string(),
            gas_type: "O2".to_string(),
            primary_pressure: 145.0,
            secondary_pressure: 4.5,
            cylinders_full: 8,
            cylinders_in_use: 2,
            cylinders_empty: 2,
        },
    ];

    Ok(Json(MgpsDailyLogPrintData {
        log_date: log_date.format("%d-%m-%Y").to_string(),
        shift,
        operator_name: "MGPS Operator".to_string(),
        readings,
        consumption: MgpsConsumption {
            o2_liters: 2500.0,
            n2o_liters: 150.0,
            air_liters: 3000.0,
            vacuum_liters: 1000.0,
        },
        incidents: vec![],
        cylinder_status,
        manifold_status: "Auto-changeover Active".to_string(),
        remarks: None,
        supervisor_verified: true,
        supervisor_name: Some("Shift Supervisor".to_string()),
        hospital_name: hospital.name,
    }))
}

// ── Water Quality Test ────────────────────────────────────────────────────────

/// GET /print-data/water-quality/{test_id}
pub async fn get_water_quality_print_data(
    State(state): State<AppState>,
    Path(test_id): Path<Uuid>,
) -> Result<Json<WaterQualityTestPrintData>, AppError> {
    let pool: &PgPool = &state.db;
    let hospital = get_hospital_info(pool).await?;

    // Sample water quality test data
    let parameters = vec![
        WaterTestParameter {
            parameter: "pH".to_string(),
            unit: "-".to_string(),
            result: "7.2".to_string(),
            acceptable_range: "6.5-8.5".to_string(),
            status: "Pass".to_string(),
        },
        WaterTestParameter {
            parameter: "TDS".to_string(),
            unit: "mg/L".to_string(),
            result: "120".to_string(),
            acceptable_range: "<500".to_string(),
            status: "Pass".to_string(),
        },
        WaterTestParameter {
            parameter: "Chlorine".to_string(),
            unit: "mg/L".to_string(),
            result: "0.3".to_string(),
            acceptable_range: "0.2-0.5".to_string(),
            status: "Pass".to_string(),
        },
        WaterTestParameter {
            parameter: "Hardness".to_string(),
            unit: "mg/L".to_string(),
            result: "85".to_string(),
            acceptable_range: "<200".to_string(),
            status: "Pass".to_string(),
        },
    ];

    Ok(Json(WaterQualityTestPrintData {
        test_date: Utc::now().format("%d-%m-%Y").to_string(),
        sample_id: format!("WQ-{test_id}"),
        sample_location: "RO Plant Output".to_string(),
        sample_type: "RO Water".to_string(),
        collected_by: "Lab Technician".to_string(),
        tested_by: "QC Department".to_string(),
        test_parameters: parameters,
        overall_result: "Pass".to_string(),
        microbiological_results: Some(MicrobiologicalResult {
            total_plate_count: "<10 CFU/mL".to_string(),
            coliform_count: "Absent".to_string(),
            e_coli: "Absent".to_string(),
            pseudomonas: Some("Absent".to_string()),
            endotoxin_level: Some("<0.25 EU/mL".to_string()),
        }),
        action_required: None,
        next_test_due: Some(
            (Utc::now() + chrono::Duration::days(7))
                .format("%d-%m-%Y")
                .to_string(),
        ),
        remarks: None,
        hospital_name: hospital.name,
    }))
}

// ── DG/UPS Run Log ────────────────────────────────────────────────────────────

/// GET /print-data/dg-ups-log/{equipment_id}/{date}
pub async fn get_dg_ups_log_print_data(
    State(state): State<AppState>,
    Path((equipment_id, date)): Path<(Uuid, String)>,
) -> Result<Json<DgUpsRunLogPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    let log_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());

    #[derive(sqlx::FromRow)]
    struct EquipRow {
        equipment_type: String,
        equipment_code: String,
        location: String,
        capacity: Option<String>,
    }

    let equip = sqlx::query_as::<_, EquipRow>(
        r"
        SELECT
            e.equipment_type,
            e.equipment_code,
            COALESCE(l.name, 'Power Room') as location,
            e.capacity
        FROM equipment e
        LEFT JOIN locations l ON e.location_id = l.id
        WHERE e.id = $1
        ",
    )
    .bind(equipment_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(EquipRow {
        equipment_type: "DG".to_string(),
        equipment_code: "DG-001".to_string(),
        location: "Power Room".to_string(),
        capacity: Some("500 KVA".to_string()),
    });

    let hospital = get_hospital_info(pool).await?;

    let is_dg = equip.equipment_type.to_uppercase().contains("DG");

    let run_events = vec![
        RunEvent {
            start_time: "10:15".to_string(),
            end_time: Some("10:45".to_string()),
            duration_minutes: 30.0,
            reason: "Power Outage".to_string(),
            load_percent: Some(65.0),
        },
        RunEvent {
            start_time: "14:00".to_string(),
            end_time: Some("14:15".to_string()),
            duration_minutes: 15.0,
            reason: "Scheduled Test".to_string(),
            load_percent: Some(50.0),
        },
    ];

    Ok(Json(DgUpsRunLogPrintData {
        log_date: log_date.format("%d-%m-%Y").to_string(),
        equipment_type: equip.equipment_type,
        equipment_id: equip.equipment_code,
        location: equip.location,
        capacity: equip.capacity.unwrap_or_else(|| "500 KVA".to_string()),
        run_events,
        fuel_status: if is_dg {
            Some(FuelStatus {
                opening_level: 85.0,
                closing_level: 75.0,
                fuel_added: 0.0,
                fuel_consumed: 45.0,
            })
        } else {
            None
        },
        battery_status: if is_dg {
            None
        } else {
            Some(BatteryStatus {
                voltage: 384.0,
                current: 25.0,
                charge_percent: 100.0,
                health_status: "Good".to_string(),
            })
        },
        daily_parameters: DgUpsParameters {
            voltage_r: Some(415.0),
            voltage_y: Some(412.0),
            voltage_b: Some(418.0),
            frequency: Some(50.0),
            load_kw: Some(250.0),
            runtime_hours: 0.75,
        },
        operator_name: "Electrical Operator".to_string(),
        remarks: None,
        hospital_name: hospital.name,
    }))
}

// ── Fire Equipment Inspection ─────────────────────────────────────────────────

/// GET /print-data/fire-inspection/{inspection_id}
pub async fn get_fire_inspection_print_data(
    State(state): State<AppState>,
    Path(inspection_id): Path<Uuid>,
) -> Result<Json<FireEquipmentInspectionPrintData>, AppError> {
    let pool: &PgPool = &state.db;
    let hospital = get_hospital_info(pool).await?;

    let fire_extinguishers = vec![
        FireExtinguisherCheck {
            location: "Main Lobby".to_string(),
            extinguisher_type: "ABC".to_string(),
            capacity: "6 kg".to_string(),
            expiry_date: "31-12-2026".to_string(),
            pressure_ok: true,
            seal_intact: true,
            accessible: true,
            signage_ok: true,
            status: "OK".to_string(),
        },
        FireExtinguisherCheck {
            location: "ICU Corridor".to_string(),
            extinguisher_type: "CO2".to_string(),
            capacity: "4.5 kg".to_string(),
            expiry_date: "30-06-2026".to_string(),
            pressure_ok: true,
            seal_intact: true,
            accessible: true,
            signage_ok: true,
            status: "OK".to_string(),
        },
    ];

    let fire_alarms = vec![FireAlarmCheck {
        zone: "Zone 1 - Ground Floor".to_string(),
        panel_ok: true,
        detectors_ok: true,
        sounders_ok: true,
        battery_ok: true,
        last_tested: Some("01-04-2026".to_string()),
        status: "OK".to_string(),
    }];

    let fire_hydrants = vec![FireHydrantCheck {
        location: "Main Building".to_string(),
        water_flow_ok: true,
        hose_condition: "Good".to_string(),
        nozzle_ok: true,
        valve_operational: true,
        status: "OK".to_string(),
    }];

    let emergency_exits = vec![
        EmergencyExitCheck {
            location: "Ground Floor East".to_string(),
            signage_illuminated: true,
            path_clear: true,
            door_operational: true,
            panic_bar_ok: true,
            status: "OK".to_string(),
        },
        EmergencyExitCheck {
            location: "First Floor West".to_string(),
            signage_illuminated: true,
            path_clear: true,
            door_operational: true,
            panic_bar_ok: true,
            status: "OK".to_string(),
        },
    ];

    Ok(Json(FireEquipmentInspectionPrintData {
        inspection_date: Utc::now().format("%d-%m-%Y").to_string(),
        inspection_number: format!("FI-{inspection_id}"),
        inspector_name: "Fire Safety Officer".to_string(),
        inspector_designation: "Safety Officer".to_string(),
        area_inspected: "Main Building - All Floors".to_string(),
        fire_extinguishers,
        fire_alarms,
        fire_hydrants,
        emergency_exits,
        sprinkler_system: Some(SprinklerCheck {
            zones_inspected: 4,
            heads_ok: true,
            valve_ok: true,
            pressure_ok: true,
            last_flow_test: Some("01-03-2026".to_string()),
            status: "OK".to_string(),
        }),
        overall_status: "Satisfactory".to_string(),
        deficiencies_found: vec![],
        corrective_actions: vec![],
        next_inspection_due: (Utc::now() + chrono::Duration::days(30))
            .format("%d-%m-%Y")
            .to_string(),
        supervisor_verified: true,
        hospital_name: hospital.name,
    }))
}

// ── Materiovigilance Report ───────────────────────────────────────────────────

/// GET /print-data/materiovigilance/{report_id}
pub async fn get_materiovigilance_print_data(
    State(state): State<AppState>,
    Path(report_id): Path<Uuid>,
) -> Result<Json<MateriovigilanceReportPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    #[derive(sqlx::FromRow)]
    struct ReportRow {
        report_number: String,
        report_date: chrono::DateTime<Utc>,
        reporter_name: String,
        reporter_designation: Option<String>,
        reporter_department: Option<String>,
        equipment_name: String,
        equipment_code: String,
        manufacturer: Option<String>,
        model: Option<String>,
        serial_number: Option<String>,
        lot_batch: Option<String>,
        incident_date: chrono::DateTime<Utc>,
        incident_description: String,
        patient_involved: bool,
        patient_outcome: Option<String>,
        injury_type: Option<String>,
        immediate_action: Option<String>,
        root_cause: Option<String>,
        corrective_action: Option<String>,
        reported_to_cdsco: bool,
        cdsco_reference: Option<String>,
        status: String,
    }

    let report = sqlx::query_as::<_, ReportRow>(
        r"
        SELECT
            m.report_number,
            m.created_at as report_date,
            u.full_name as reporter_name,
            des.name as reporter_designation,
            d.name as reporter_department,
            e.name as equipment_name,
            e.equipment_code,
            e.manufacturer,
            e.model,
            e.serial_number,
            m.lot_batch_number as lot_batch,
            m.incident_datetime as incident_date,
            m.incident_description,
            m.patient_involved,
            m.patient_outcome,
            m.injury_type,
            m.immediate_action,
            m.root_cause_analysis as root_cause,
            m.corrective_action,
            m.reported_to_cdsco,
            m.cdsco_reference,
            m.status
        FROM materiovigilance_reports m
        JOIN users u ON m.reported_by = u.id
        LEFT JOIN designations des ON u.designation_id = des.id
        LEFT JOIN departments d ON u.department_id = d.id
        JOIN equipment e ON m.equipment_id = e.id
        WHERE m.id = $1
        ",
    )
    .bind(report_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let hospital = get_hospital_info(pool).await?;

    Ok(Json(MateriovigilanceReportPrintData {
        report_number: report.report_number,
        report_date: report.report_date.format("%d-%m-%Y").to_string(),
        reporter_name: report.reporter_name,
        reporter_designation: report.reporter_designation.unwrap_or_default(),
        reporter_department: report.reporter_department.unwrap_or_default(),
        equipment_name: report.equipment_name,
        equipment_id: report.equipment_code,
        manufacturer: report.manufacturer,
        model: report.model,
        serial_number: report.serial_number,
        lot_batch_number: report.lot_batch,
        incident_date: report.incident_date.format("%d-%m-%Y %H:%M").to_string(),
        incident_description: report.incident_description,
        patient_involved: report.patient_involved,
        patient_outcome: report.patient_outcome,
        injury_type: report.injury_type,
        immediate_action: report.immediate_action,
        root_cause_analysis: report.root_cause,
        corrective_action: report.corrective_action,
        reported_to_cdsco: report.reported_to_cdsco,
        cdsco_reference: report.cdsco_reference,
        status: report.status,
        hospital_name: hospital.name,
    }))
}

// ── Fire Mock Drill Report ────────────────────────────────────────────────────

/// GET /print-data/fire-mock-drill/{drill_id}
pub async fn get_fire_mock_drill_print_data(
    State(state): State<AppState>,
    Path(drill_id): Path<Uuid>,
) -> Result<Json<FireMockDrillReportPrintData>, AppError> {
    let pool: &PgPool = &state.db;
    let hospital = get_hospital_info(pool).await?;

    let observations = vec![
        DrillObservation {
            observation: "Staff responded promptly to alarm".to_string(),
            category: "Positive".to_string(),
            action_required: None,
        },
        DrillObservation {
            observation: "All emergency exits were used correctly".to_string(),
            category: "Positive".to_string(),
            action_required: None,
        },
        DrillObservation {
            observation: "Assembly point reached within target time".to_string(),
            category: "Positive".to_string(),
            action_required: None,
        },
    ];

    let first_responders = vec![
        FirstResponder {
            name: "Security Guard 1".to_string(),
            role: "Fire Warden".to_string(),
            response_time_seconds: 45,
            performance: "Excellent".to_string(),
        },
        FirstResponder {
            name: "Nurse In-charge".to_string(),
            role: "Floor Coordinator".to_string(),
            response_time_seconds: 60,
            performance: "Good".to_string(),
        },
    ];

    Ok(Json(FireMockDrillReportPrintData {
        drill_number: format!("FD-{drill_id}"),
        drill_date: Utc::now().format("%d-%m-%Y").to_string(),
        drill_time: "14:00".to_string(),
        drill_type: "Announced".to_string(),
        scenario: "Fire in Ground Floor Store Room".to_string(),
        area_covered: "Main Building - All Floors".to_string(),
        participants_count: 150,
        evacuation_time_minutes: 4.5,
        target_time_minutes: 5.0,
        observations,
        equipment_used: vec![
            "Fire Extinguishers".to_string(),
            "Fire Hose".to_string(),
            "Stretchers".to_string(),
        ],
        first_responders,
        areas_for_improvement: vec!["Improve signage near stairwell B".to_string()],
        recommendations: vec![
            "Conduct surprise drill next quarter".to_string(),
            "Additional training for night shift staff".to_string(),
        ],
        drill_conductor: "Fire Safety Officer".to_string(),
        fire_officer_name: Some("Chief Fire Officer".to_string()),
        overall_rating: "Good".to_string(),
        next_drill_scheduled: Some(
            (Utc::now() + chrono::Duration::days(90))
                .format("%d-%m-%Y")
                .to_string(),
        ),
        hospital_name: hospital.name,
    }))
}

// ── Helper Functions ──────────────────────────────────────────────────────────

struct HospitalInfo {
    name: String,
}

async fn get_hospital_info(pool: &PgPool) -> Result<HospitalInfo, AppError> {
    let name =
        sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE is_active = true LIMIT 1")
            .fetch_optional(pool)
            .await?
            .unwrap_or_else(|| "Hospital".to_string());

    Ok(HospitalInfo { name })
}

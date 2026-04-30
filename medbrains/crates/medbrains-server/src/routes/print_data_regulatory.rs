//! Print-data endpoints — regulatory compliance reports.
//!
//! These endpoints generate data for NABH, NMC, NABL, SPCB, PESO, PCPNDT,
//! and other regulatory compliance reports.

use axum::{
    Extension, Json,
    extract::{Path, State},
};

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AebasAttendanceReportPrintData, BirthRegisterEntry, BirthRegisterPrintData, BmwCategory,
    ComplianceSection, CriticalValueMetrics, CylinderStorage, DeathRegisterEntry,
    DeathRegisterPrintData, DepartmentAttendance, DisposalRecord, DrugInspection,
    DrugLicenseReportPrintData, DrugStockCategory, ExpiryAlert, FormFCompliance, GasIncident,
    MedicalGasSystem, MlcCaseTypeCount, MlcOutcomeCount, MlcRegisterSummaryEntry,
    MlcRegisterSummaryPrintData, NabhQualityReportPrintData, NablQualityReportPrintData,
    NarfCriterion, NarfSection, NmcComplianceReportPrintData, NmcNarfAssessmentPrintData,
    PcpndtEquipment, PcpndtInspection, PcpndtPersonnel, PcpndtProcedure, PcpndtReportPrintData,
    PesoComplianceReportPrintData, PtResult, QcMetric, QualityIndicator, QualitySummary,
    SafetyInspection, SpcbBmwReturnsPrintData, TatMetric,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── NABH Quality Indicators Report ────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct QualityIndicatorRow {
    indicator_code: String,
    indicator_name: String,
    category: String,
    numerator: i32,
    denominator: i32,
    rate: f64,
    benchmark: Option<f64>,
    status: String,
    trend: Option<String>,
}

pub async fn get_nabh_quality_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NabhQualityReportPrintData>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let indicators = sqlx::query_as::<_, QualityIndicatorRow>(
        "SELECT \
           qi.indicator_code, \
           qi.indicator_name, \
           qi.category, \
           qid.numerator, \
           qid.denominator, \
           qid.rate, \
           qi.benchmark, \
           qid.status, \
           qid.trend \
         FROM quality_indicator_data qid \
         JOIN quality_indicators qi ON qi.id = qid.indicator_id AND qi.tenant_id = qid.tenant_id \
         WHERE qid.period = $1 AND qid.tenant_id = $2 \
         ORDER BY qi.category, qi.display_order",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, nabh_certificate_number, nabh_valid_until FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let action_items: Vec<String> = sqlx::query_scalar(
        "SELECT action_item FROM quality_action_items \
         WHERE period = $1 AND tenant_id = $2 AND status = 'open' \
         ORDER BY priority",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    tx.commit().await?;

    let total = indicators.len() as i32;
    let met = indicators.iter().filter(|i| i.status == "met").count() as i32;
    let below = indicators.iter().filter(|i| i.status == "below").count() as i32;
    let na = total - met - below;

    Ok(Json(NabhQualityReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        nabh_certificate_number: tenant.2,
        accreditation_valid_until: tenant.3,
        indicators: indicators
            .into_iter()
            .map(|i| QualityIndicator {
                indicator_code: i.indicator_code,
                indicator_name: i.indicator_name,
                category: i.category,
                numerator: i.numerator,
                denominator: i.denominator,
                rate: i.rate,
                benchmark: i.benchmark,
                status: i.status,
                trend: i.trend,
            })
            .collect(),
        summary: QualitySummary {
            total_indicators: total,
            met_benchmark: met,
            below_benchmark: below,
            not_applicable: na,
        },
        action_items,
        prepared_by: None,
        reviewed_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── NMC Compliance Report ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ComplianceSectionRow {
    section_name: String,
    total_requirements: i32,
    compliant: i32,
    non_compliant: i32,
    compliance_percentage: f64,
}

pub async fn get_nmc_compliance_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NmcComplianceReportPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let sections = sqlx::query_as::<_, ComplianceSectionRow>(
        "SELECT \
           section_name, \
           total_requirements, \
           compliant_count AS compliant, \
           non_compliant_count AS non_compliant, \
           compliance_percentage \
         FROM nmc_compliance_sections \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY display_order",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let non_compliance_items: Vec<String> = sqlx::query_scalar(
        "SELECT item_description FROM nmc_non_compliance_items \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY severity DESC",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let corrective_actions: Vec<String> = sqlx::query_scalar(
        "SELECT action_description FROM nmc_corrective_actions \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY due_date",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, nmc_registration_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_req: i32 = sections.iter().map(|s| s.total_requirements).sum();
    let total_compliant: i32 = sections.iter().map(|s| s.compliant).sum();
    let overall_pct = if total_req > 0 {
        (f64::from(total_compliant) / f64::from(total_req)) * 100.0
    } else {
        0.0
    };

    Ok(Json(NmcComplianceReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        registration_number: tenant.2,
        compliance_sections: sections
            .into_iter()
            .map(|s| ComplianceSection {
                section_name: s.section_name,
                total_requirements: s.total_requirements,
                compliant: s.compliant,
                non_compliant: s.non_compliant,
                compliance_percentage: s.compliance_percentage,
            })
            .collect(),
        overall_compliance_percentage: overall_pct,
        non_compliance_items,
        corrective_actions,
        prepared_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── NABL Lab Quality Report ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct QcMetricRow {
    analyte: String,
    mean: f64,
    sd: f64,
    cv: f64,
    westgard_violations: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct PtResultRow {
    program_name: String,
    analyte: String,
    result: String,
    status: String,
}

#[derive(Debug, sqlx::FromRow)]
struct TatMetricRow {
    test_category: String,
    target_tat_hours: f64,
    actual_tat_hours: f64,
    compliance_percentage: f64,
}

pub async fn get_nabl_quality_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NablQualityReportPrintData>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let qc_metrics = sqlx::query_as::<_, QcMetricRow>(
        "SELECT analyte, mean, sd, cv, westgard_violations \
         FROM lab_qc_metrics \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY analyte",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let pt_results = sqlx::query_as::<_, PtResultRow>(
        "SELECT program_name, analyte, result, status \
         FROM lab_pt_results \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY program_name, analyte",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tat_metrics = sqlx::query_as::<_, TatMetricRow>(
        "SELECT test_category, target_tat_hours, actual_tat_hours, compliance_percentage \
         FROM lab_tat_metrics \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY test_category",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let critical_metrics = sqlx::query_as::<_, (i32, i32, f64)>(
        "SELECT total_critical_values, reported_within_target, average_reporting_time_minutes \
         FROM lab_critical_value_metrics \
         WHERE period = $1 AND tenant_id = $2",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((0, 0, 0.0));

    let (sample_rejection_rate, repeat_rate): (f64, f64) = sqlx::query_as(
        "SELECT sample_rejection_rate, repeat_rate \
         FROM lab_performance_metrics \
         WHERE period = $1 AND tenant_id = $2",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((0.0, 0.0));

    let scope: Vec<String> = sqlx::query_scalar(
        "SELECT scope_description FROM nabl_scope_of_accreditation \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY display_order",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, nabl_certificate_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(NablQualityReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        laboratory_name: tenant.0.clone(),
        nabl_certificate_number: tenant.2,
        scope_of_accreditation: scope,
        qc_metrics: qc_metrics
            .into_iter()
            .map(|m| QcMetric {
                analyte: m.analyte,
                mean: m.mean,
                sd: m.sd,
                cv: m.cv,
                westgard_violations: m.westgard_violations,
            })
            .collect(),
        proficiency_testing: pt_results
            .into_iter()
            .map(|p| PtResult {
                program_name: p.program_name,
                analyte: p.analyte,
                result: p.result,
                status: p.status,
            })
            .collect(),
        turnaround_times: tat_metrics
            .into_iter()
            .map(|t| TatMetric {
                test_category: t.test_category,
                target_tat_hours: t.target_tat_hours,
                actual_tat_hours: t.actual_tat_hours,
                compliance_percentage: t.compliance_percentage,
            })
            .collect(),
        critical_value_reporting: CriticalValueMetrics {
            total_critical_values: critical_metrics.0,
            reported_within_target: critical_metrics.1,
            average_reporting_time_minutes: critical_metrics.2,
        },
        sample_rejection_rate,
        repeat_rate,
        prepared_by: None,
        quality_manager: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── SPCB BMW Quarterly Returns ────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct BmwCategoryRow {
    category: String,
    color_code: String,
    description: String,
    quantity_kg: f64,
    disposal_method: String,
}

#[derive(Debug, sqlx::FromRow)]
struct DisposalRecordRow {
    disposal_date: chrono::NaiveDate,
    category: String,
    quantity_kg: f64,
    vehicle_number: Option<String>,
    manifest_number: Option<String>,
}

pub async fn get_spcb_bmw_returns_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(quarter): Path<String>,
) -> Result<Json<SpcbBmwReturnsPrintData>, AppError> {
    require_permission(&claims, permissions::infection_control::biowaste::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    // Parse quarter (e.g., "2024-Q1") to get year
    let year: i32 = quarter
        .split('-')
        .next()
        .and_then(|y| y.parse().ok())
        .unwrap_or(2024);

    let categories = sqlx::query_as::<_, BmwCategoryRow>(
        "SELECT category, color_code, description, quantity_kg, disposal_method \
         FROM bmw_quarterly_data \
         WHERE quarter = $1 AND tenant_id = $2 \
         ORDER BY category",
    )
    .bind(&quarter)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let disposal_records = sqlx::query_as::<_, DisposalRecordRow>(
        "SELECT disposal_date, category, quantity_kg, vehicle_number, manifest_number \
         FROM bmw_disposal_records \
         WHERE quarter = $1 AND tenant_id = $2 \
         ORDER BY disposal_date",
    )
    .bind(&quarter)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total_waste: f64 = categories.iter().map(|c| c.quantity_kg).sum();

    let (
        total_beds,
        average_occupancy,
        cbwtf_name,
        cbwtf_auth,
        auth_number,
        training,
        attendees,
        incidents,
    ) = sqlx::query_as::<
        _,
        (
            i32,
            f64,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            Option<i32>,
            i32,
        ),
    >(
        "SELECT total_beds, average_occupancy, cbwtf_name, cbwtf_authorization, \
                authorization_number, training_conducted, training_attendees, incidents_reported \
         FROM bmw_quarterly_summary \
         WHERE quarter = $1 AND tenant_id = $2",
    )
    .bind(&quarter)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((100, 70.0, None, None, None, false, None, 0));

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1 FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(SpcbBmwReturnsPrintData {
        quarter,
        year,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        authorization_number: auth_number,
        total_beds,
        average_occupancy,
        waste_categories: categories
            .into_iter()
            .map(|c| BmwCategory {
                category: c.category,
                color_code: c.color_code,
                description: c.description,
                quantity_kg: c.quantity_kg,
                disposal_method: c.disposal_method,
            })
            .collect(),
        total_waste_kg: total_waste,
        cbwtf_name,
        cbwtf_authorization: cbwtf_auth,
        disposal_records: disposal_records
            .into_iter()
            .map(|r| DisposalRecord {
                date: r.disposal_date.format("%d-%b-%Y").to_string(),
                category: r.category,
                quantity_kg: r.quantity_kg,
                vehicle_number: r.vehicle_number,
                manifest_number: r.manifest_number,
            })
            .collect(),
        training_conducted: training,
        training_attendees: attendees,
        incidents_reported: incidents,
        authorized_signatory: None,
        designation: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── PESO Compliance Report ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct MedicalGasSystemRow {
    gas_type: String,
    source_type: String,
    location: String,
    capacity: String,
    last_tested: Option<chrono::NaiveDate>,
    next_test_due: Option<chrono::NaiveDate>,
    status: String,
}

#[derive(Debug, sqlx::FromRow)]
struct SafetyInspectionRow {
    inspection_date: chrono::NaiveDate,
    inspector: String,
    findings: String,
    status: String,
}

#[derive(Debug, sqlx::FromRow)]
struct GasIncidentRow {
    incident_date: chrono::NaiveDate,
    gas_type: String,
    description: String,
    action_taken: String,
}

pub async fn get_peso_compliance_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(year): Path<i32>,
) -> Result<Json<PesoComplianceReportPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::gas::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let gas_systems = sqlx::query_as::<_, MedicalGasSystemRow>(
        "SELECT gas_type, source_type, location, capacity, last_tested, next_test_due, status \
         FROM medical_gas_systems \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY gas_type, location",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let cylinder_storage = sqlx::query_as::<_, (i32, i32, i32, i32, i32, bool)>(
        "SELECT total_capacity, oxygen_cylinders, nitrous_oxide_cylinders, co2_cylinders, \
                other_cylinders, storage_compliant \
         FROM cylinder_storage_summary \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((0, 0, 0, 0, 0, false));

    let inspections = sqlx::query_as::<_, SafetyInspectionRow>(
        "SELECT inspection_date, inspector, findings, status \
         FROM peso_inspections \
         WHERE tenant_id = $1 AND EXTRACT(YEAR FROM inspection_date) = $2 \
         ORDER BY inspection_date DESC",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .fetch_all(&mut *tx)
    .await?;

    let incidents = sqlx::query_as::<_, GasIncidentRow>(
        "SELECT incident_date, gas_type, description, action_taken \
         FROM gas_incidents \
         WHERE tenant_id = $1 AND EXTRACT(YEAR FROM incident_date) = $2 \
         ORDER BY incident_date DESC",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, peso_license_number, peso_valid_until FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let compliance_status = if inspections.iter().all(|i| i.status == "compliant") {
        "Compliant"
    } else {
        "Non-Compliant"
    };

    Ok(Json(PesoComplianceReportPrintData {
        report_year: year,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        peso_license_number: tenant.2,
        license_valid_until: tenant.3,
        medical_gas_systems: gas_systems
            .into_iter()
            .map(|s| MedicalGasSystem {
                gas_type: s.gas_type,
                source_type: s.source_type,
                location: s.location,
                capacity: s.capacity,
                last_tested: s.last_tested.map(|d| d.format("%d-%b-%Y").to_string()),
                next_test_due: s.next_test_due.map(|d| d.format("%d-%b-%Y").to_string()),
                status: s.status,
            })
            .collect(),
        cylinder_storage: CylinderStorage {
            total_capacity: cylinder_storage.0,
            oxygen_cylinders: cylinder_storage.1,
            nitrous_oxide_cylinders: cylinder_storage.2,
            co2_cylinders: cylinder_storage.3,
            other_cylinders: cylinder_storage.4,
            storage_compliant: cylinder_storage.5,
        },
        safety_inspections: inspections
            .into_iter()
            .map(|i| SafetyInspection {
                inspection_date: i.inspection_date.format("%d-%b-%Y").to_string(),
                inspector: i.inspector,
                findings: i.findings,
                status: i.status,
            })
            .collect(),
        incidents: incidents
            .into_iter()
            .map(|i| GasIncident {
                incident_date: i.incident_date.format("%d-%b-%Y").to_string(),
                gas_type: i.gas_type,
                description: i.description,
                action_taken: i.action_taken,
            })
            .collect(),
        compliance_status: compliance_status.to_string(),
        prepared_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── Drug License Report ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DrugInspectionRow {
    inspection_date: chrono::NaiveDate,
    inspector_name: String,
    findings: String,
    compliance_status: String,
}

#[derive(Debug, sqlx::FromRow)]
struct DrugStockRow {
    category: String,
    total_items: i32,
    total_value: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct ExpiryAlertRow {
    drug_name: String,
    batch_number: String,
    expiry_date: chrono::NaiveDate,
    quantity: i32,
    days_to_expiry: i32,
}

pub async fn get_drug_license_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(_license_id): Path<String>,
) -> Result<Json<DrugLicenseReportPrintData>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let inspections = sqlx::query_as::<_, DrugInspectionRow>(
        "SELECT inspection_date, inspector_name, findings, compliance_status \
         FROM drug_inspections \
         WHERE tenant_id = $1 \
         ORDER BY inspection_date DESC \
         LIMIT 5",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let stock_summary = sqlx::query_as::<_, DrugStockRow>(
        "SELECT category, COUNT(*)::int AS total_items, SUM(current_stock * unit_price)::float8 AS total_value \
         FROM pharmacy_inventory \
         WHERE tenant_id = $1 \
         GROUP BY category \
         ORDER BY category",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let expiry_alerts = sqlx::query_as::<_, ExpiryAlertRow>(
        "SELECT drug_name, batch_number, expiry_date, current_stock AS quantity, \
                (expiry_date - CURRENT_DATE)::int AS days_to_expiry \
         FROM pharmacy_inventory \
         WHERE tenant_id = $1 AND expiry_date <= CURRENT_DATE + INTERVAL '90 days' \
         ORDER BY expiry_date \
         LIMIT 20",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
        ),
    >(
        "SELECT name, logo_url, drug_license_number, drug_license_type, \
                drug_license_valid_from, drug_license_valid_until, \
                licensing_authority, registered_pharmacist, pharmacist_registration, \
                storage_conditions_compliant \
         FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let authorized_categories: Vec<String> = sqlx::query_scalar(
        "SELECT category FROM drug_license_categories WHERE tenant_id = $1 ORDER BY category",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let controlled_license: Option<String> = sqlx::query_scalar(
        "SELECT license_number FROM controlled_substance_licenses WHERE tenant_id = $1 AND is_active = true",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DrugLicenseReportPrintData {
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        drug_license_number: tenant.2,
        license_type: tenant.3,
        valid_from: tenant.4,
        valid_until: tenant.5,
        licensing_authority: tenant
            .6
            .unwrap_or_else(|| "State Drug Controller".to_string()),
        registered_pharmacist: tenant.7,
        registration_number: tenant.8,
        authorized_categories,
        controlled_substance_license: controlled_license,
        storage_conditions_compliant: tenant.9,
        inspection_history: inspections
            .into_iter()
            .map(|i| DrugInspection {
                inspection_date: i.inspection_date.format("%d-%b-%Y").to_string(),
                inspector_name: i.inspector_name,
                findings: i.findings,
                compliance_status: i.compliance_status,
            })
            .collect(),
        current_stock_summary: stock_summary
            .into_iter()
            .map(|s| DrugStockCategory {
                category: s.category,
                total_items: s.total_items,
                total_value: s.total_value,
            })
            .collect(),
        expiry_alerts: expiry_alerts
            .into_iter()
            .map(|e| ExpiryAlert {
                drug_name: e.drug_name,
                batch_number: e.batch_number,
                expiry_date: e.expiry_date.format("%d-%b-%Y").to_string(),
                quantity: e.quantity,
                days_to_expiry: e.days_to_expiry,
            })
            .collect(),
        hospital_logo_url: tenant.1,
    }))
}

// ── PCPNDT Compliance Report ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PcpndtEquipmentRow {
    equipment_name: String,
    registration_number: String,
    location: String,
}

#[derive(Debug, sqlx::FromRow)]
struct PcpndtPersonnelRow {
    name: String,
    qualification: String,
    registration_number: String,
    role: String,
}

#[derive(Debug, sqlx::FromRow)]
struct PcpndtProcedureRow {
    procedure_type: String,
    total_count: i32,
    male_fetus: i32,
    female_fetus: i32,
    indeterminate: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct PcpndtInspectionRow {
    inspection_date: chrono::NaiveDate,
    authority: String,
    findings: String,
    status: String,
}

pub async fn get_pcpndt_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<PcpndtReportPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let equipment = sqlx::query_as::<_, PcpndtEquipmentRow>(
        "SELECT equipment_name, registration_number, location \
         FROM pcpndt_equipment \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY equipment_name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let personnel = sqlx::query_as::<_, PcpndtPersonnelRow>(
        "SELECT name, qualification, registration_number, role \
         FROM pcpndt_qualified_personnel \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY role, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let procedures = sqlx::query_as::<_, PcpndtProcedureRow>(
        "SELECT procedure_type, total_count, male_fetus, female_fetus, indeterminate \
         FROM pcpndt_procedure_summary \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY procedure_type",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let form_f = sqlx::query_as::<_, (i32, i32, i32, f64)>(
        "SELECT total_forms, complete_forms, incomplete_forms, compliance_percentage \
         FROM pcpndt_form_f_compliance \
         WHERE period = $1 AND tenant_id = $2",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((0, 0, 0, 0.0));

    let inspections = sqlx::query_as::<_, PcpndtInspectionRow>(
        "SELECT inspection_date, authority, findings, status \
         FROM pcpndt_inspections \
         WHERE tenant_id = $1 \
         ORDER BY inspection_date DESC \
         LIMIT 5",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, String, String, String)>(
        "SELECT name, logo_url, pcpndt_registration_number, pcpndt_valid_until, pcpndt_authority \
         FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let declaration = "I hereby declare that all pre-natal diagnostic procedures conducted at this facility have been performed in strict compliance with the Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994 and Rules thereunder. No sex determination has been communicated to any person.".to_string();

    Ok(Json(PcpndtReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0.clone(),
        registration_number: tenant.2,
        registration_valid_until: tenant.3,
        appropriate_authority: tenant.4,
        registered_equipment: equipment
            .into_iter()
            .map(|e| PcpndtEquipment {
                equipment_name: e.equipment_name,
                registration_number: e.registration_number,
                location: e.location,
            })
            .collect(),
        qualified_personnel: personnel
            .into_iter()
            .map(|p| PcpndtPersonnel {
                name: p.name,
                qualification: p.qualification,
                registration_number: p.registration_number,
                role: p.role,
            })
            .collect(),
        procedures_performed: procedures
            .into_iter()
            .map(|p| PcpndtProcedure {
                procedure_type: p.procedure_type,
                total_count: p.total_count,
                male_fetus: p.male_fetus,
                female_fetus: p.female_fetus,
                indeterminate: p.indeterminate,
            })
            .collect(),
        form_f_compliance: FormFCompliance {
            total_forms: form_f.0,
            complete_forms: form_f.1,
            incomplete_forms: form_f.2,
            compliance_percentage: form_f.3,
        },
        inspections: inspections
            .into_iter()
            .map(|i| PcpndtInspection {
                date: i.inspection_date.format("%d-%b-%Y").to_string(),
                authority: i.authority,
                findings: i.findings,
                status: i.status,
            })
            .collect(),
        declaration_text: declaration,
        signatory_name: String::new(),
        signatory_designation: "Medical Superintendent".to_string(),
        hospital_logo_url: tenant.1,
    }))
}

// ── Birth Register ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct BirthRegisterEntryRow {
    serial_number: i32,
    registration_number: String,
    date_of_birth: chrono::NaiveDate,
    time_of_birth: chrono::NaiveTime,
    gender: String,
    birth_weight_grams: i32,
    birth_type: String,
    mother_name: String,
    mother_age: i32,
    father_name: String,
    address: String,
    delivery_type: String,
    attending_doctor: String,
}

pub async fn get_birth_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<BirthRegisterPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::birth_records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let entries = sqlx::query_as::<_, BirthRegisterEntryRow>(
        "SELECT \
           ROW_NUMBER() OVER (ORDER BY date_of_birth, time_of_birth)::int AS serial_number, \
           registration_number, \
           date_of_birth, \
           time_of_birth, \
           gender, \
           birth_weight_grams, \
           birth_type, \
           mother_name, \
           mother_age, \
           father_name, \
           address, \
           delivery_type, \
           attending_doctor \
         FROM birth_records \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY date_of_birth, time_of_birth",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let stats = sqlx::query_as::<_, (i32, i32, i32, i32, i32)>(
        "SELECT \
           COUNT(*)::int AS total, \
           COUNT(*) FILTER (WHERE gender = 'Male')::int AS male, \
           COUNT(*) FILTER (WHERE gender = 'Female')::int AS female, \
           COUNT(*) FILTER (WHERE birth_type = 'live')::int AS live, \
           COUNT(*) FILTER (WHERE birth_type = 'still')::int AS still \
         FROM birth_records \
         WHERE period = $1 AND tenant_id = $2",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or((0, 0, 0, 0, 0));

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, hospital_code, municipal_area FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(BirthRegisterPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        hospital_code: tenant.2,
        municipal_area: tenant.3,
        entries: entries
            .into_iter()
            .map(|e| BirthRegisterEntry {
                serial_number: e.serial_number,
                registration_number: e.registration_number,
                date_of_birth: e.date_of_birth.format("%d-%b-%Y").to_string(),
                time_of_birth: e.time_of_birth.format("%H:%M").to_string(),
                gender: e.gender,
                birth_weight_grams: e.birth_weight_grams,
                birth_type: e.birth_type,
                mother_name: e.mother_name,
                mother_age: e.mother_age,
                father_name: e.father_name,
                address: e.address,
                delivery_type: e.delivery_type,
                attending_doctor: e.attending_doctor,
            })
            .collect(),
        total_births: stats.0,
        male_births: stats.1,
        female_births: stats.2,
        live_births: stats.3,
        still_births: stats.4,
        prepared_by: None,
        verified_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── Death Register ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DeathRegisterEntryRow {
    serial_number: i32,
    registration_number: String,
    date_of_death: chrono::NaiveDate,
    time_of_death: chrono::NaiveTime,
    deceased_name: String,
    age: String,
    gender: String,
    address: String,
    cause_of_death: String,
    icd_code: Option<String>,
    certifying_doctor: String,
    mlc_case: bool,
}

pub async fn get_death_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<DeathRegisterPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let entries = sqlx::query_as::<_, DeathRegisterEntryRow>(
        "SELECT \
           ROW_NUMBER() OVER (ORDER BY date_of_death, time_of_death)::int AS serial_number, \
           registration_number, \
           date_of_death, \
           time_of_death, \
           deceased_name, \
           age_at_death AS age, \
           gender, \
           address, \
           cause_immediate AS cause_of_death, \
           icd_code_immediate AS icd_code, \
           certifying_doctor, \
           mlc_case \
         FROM death_records \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY date_of_death, time_of_death",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let stats = sqlx::query_as::<_, (i32, i32, i32, i32)>(
        "SELECT \
           COUNT(*)::int AS total, \
           COUNT(*) FILTER (WHERE gender = 'Male')::int AS male, \
           COUNT(*) FILTER (WHERE gender = 'Female')::int AS female, \
           COUNT(*) FILTER (WHERE mlc_case = true)::int AS mlc \
         FROM death_records \
         WHERE period = $1 AND tenant_id = $2",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or((0, 0, 0, 0));

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, hospital_code, municipal_area FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DeathRegisterPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        hospital_code: tenant.2,
        municipal_area: tenant.3,
        entries: entries
            .into_iter()
            .map(|e| DeathRegisterEntry {
                serial_number: e.serial_number,
                registration_number: e.registration_number,
                date_of_death: e.date_of_death.format("%d-%b-%Y").to_string(),
                time_of_death: e.time_of_death.format("%H:%M").to_string(),
                deceased_name: e.deceased_name,
                age: e.age,
                gender: e.gender,
                address: e.address,
                cause_of_death: e.cause_of_death,
                icd_code: e.icd_code,
                certifying_doctor: e.certifying_doctor,
                mlc_case: e.mlc_case,
            })
            .collect(),
        total_deaths: stats.0,
        male_deaths: stats.1,
        female_deaths: stats.2,
        mlc_cases: stats.3,
        prepared_by: None,
        verified_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── MLC Register Summary ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct MlcSummaryEntryRow {
    serial_number: i32,
    mlc_number: String,
    registration_date: chrono::NaiveDate,
    patient_name: String,
    age_gender: String,
    case_type: String,
    police_station: String,
    fir_number: Option<String>,
    outcome: String,
    current_status: String,
}

pub async fn get_mlc_register_summary_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<MlcRegisterSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let entries = sqlx::query_as::<_, MlcSummaryEntryRow>(
        "SELECT \
           ROW_NUMBER() OVER (ORDER BY registration_date)::int AS serial_number, \
           mlc_number, \
           registration_date, \
           patient_name, \
           (age || '/' || gender) AS age_gender, \
           case_type, \
           police_station, \
           fir_number, \
           outcome, \
           current_status \
         FROM mlc_cases \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY registration_date",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let by_case_type: Vec<(String, i32)> = sqlx::query_as(
        "SELECT case_type, COUNT(*)::int AS count \
         FROM mlc_cases \
         WHERE period = $1 AND tenant_id = $2 \
         GROUP BY case_type \
         ORDER BY count DESC",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let by_outcome: Vec<(String, i32)> = sqlx::query_as(
        "SELECT outcome, COUNT(*)::int AS count \
         FROM mlc_cases \
         WHERE period = $1 AND tenant_id = $2 \
         GROUP BY outcome \
         ORDER BY count DESC",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let pending: i32 = sqlx::query_scalar(
        "SELECT COUNT(*)::int FROM mlc_cases \
         WHERE period = $1 AND tenant_id = $2 AND current_status = 'pending'",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, logo_url FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total = entries.len() as i32;

    Ok(Json(MlcRegisterSummaryPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        entries: entries
            .into_iter()
            .map(|e| MlcRegisterSummaryEntry {
                serial_number: e.serial_number,
                mlc_number: e.mlc_number,
                registration_date: e.registration_date.format("%d-%b-%Y").to_string(),
                patient_name: e.patient_name,
                age_gender: e.age_gender,
                case_type: e.case_type,
                police_station: e.police_station,
                fir_number: e.fir_number,
                outcome: e.outcome,
                current_status: e.current_status,
            })
            .collect(),
        total_cases: total,
        by_case_type: by_case_type
            .into_iter()
            .map(|(t, c)| MlcCaseTypeCount {
                case_type: t,
                count: c,
            })
            .collect(),
        by_outcome: by_outcome
            .into_iter()
            .map(|(o, c)| MlcOutcomeCount {
                outcome: o,
                count: c,
            })
            .collect(),
        pending_cases: pending,
        prepared_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── AEBAS Attendance Report ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DepartmentAttendanceRow {
    department_name: String,
    total_employees: i32,
    average_present: f64,
    average_absent: f64,
    average_leave: f64,
    attendance_percentage: f64,
}

pub async fn get_aebas_attendance_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<AebasAttendanceReportPrintData>, AppError> {
    require_permission(&claims, permissions::hr::attendance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let departments = sqlx::query_as::<_, DepartmentAttendanceRow>(
        "SELECT \
           department_name, \
           total_employees, \
           average_present, \
           average_absent, \
           average_leave, \
           attendance_percentage \
         FROM aebas_department_attendance \
         WHERE period = $1 AND tenant_id = $2 \
         ORDER BY department_name",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let summary = sqlx::query_as::<_, (i32, f64, i32, i32)>(
        "SELECT total_employees, average_attendance_percentage, total_working_days, holidays \
         FROM aebas_period_summary \
         WHERE period = $1 AND tenant_id = $2",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((0, 0.0, 0, 0));

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, aebas_unit_code FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AebasAttendanceReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        aebas_unit_code: tenant.2,
        department_summary: departments
            .into_iter()
            .map(|d| DepartmentAttendance {
                department_name: d.department_name,
                total_employees: d.total_employees,
                average_present: d.average_present,
                average_absent: d.average_absent,
                average_leave: d.average_leave,
                attendance_percentage: d.attendance_percentage,
            })
            .collect(),
        total_employees: summary.0,
        average_attendance_percentage: summary.1,
        total_working_days: summary.2,
        holidays: summary.3,
        prepared_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── NMC NARF Self-Assessment ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct NarfSectionRow {
    section_name: String,
    max_score: f64,
    achieved_score: f64,
    percentage: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct NarfCriterionRow {
    section_name: String,
    criterion: String,
    max_marks: f64,
    achieved_marks: f64,
    evidence: Option<String>,
}

pub async fn get_nmc_narf_assessment_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(year): Path<i32>,
) -> Result<Json<NmcNarfAssessmentPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids).await?;

    let sections = sqlx::query_as::<_, NarfSectionRow>(
        "SELECT section_name, max_score, achieved_score, percentage \
         FROM narf_assessment_sections \
         WHERE assessment_year = $1 AND tenant_id = $2 \
         ORDER BY display_order",
    )
    .bind(year)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let criteria = sqlx::query_as::<_, NarfCriterionRow>(
        "SELECT section_name, criterion, max_marks, achieved_marks, evidence \
         FROM narf_assessment_criteria \
         WHERE assessment_year = $1 AND tenant_id = $2 \
         ORDER BY section_name, display_order",
    )
    .bind(year)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let summary = sqlx::query_as::<_, (f64, f64, f64, String)>(
        "SELECT overall_score, maximum_score, percentage, grade \
         FROM narf_assessment_summary \
         WHERE assessment_year = $1 AND tenant_id = $2",
    )
    .bind(year)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or((0.0, 100.0, 0.0, "N/A".to_string()));

    let strengths: Vec<String> = sqlx::query_scalar(
        "SELECT item FROM narf_strengths WHERE assessment_year = $1 AND tenant_id = $2 ORDER BY display_order",
    )
    .bind(year)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let improvements: Vec<String> = sqlx::query_scalar(
        "SELECT item FROM narf_improvements WHERE assessment_year = $1 AND tenant_id = $2 ORDER BY display_order",
    )
    .bind(year)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let action_plan: Vec<String> = sqlx::query_scalar(
        "SELECT item FROM narf_action_plan WHERE assessment_year = $1 AND tenant_id = $2 ORDER BY display_order",
    )
    .bind(year)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .unwrap_or_default();

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, nmc_registration_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Group criteria by section
    let mut section_criteria: std::collections::HashMap<String, Vec<NarfCriterion>> =
        std::collections::HashMap::new();
    for c in criteria {
        section_criteria
            .entry(c.section_name.clone())
            .or_default()
            .push(NarfCriterion {
                criterion: c.criterion,
                max_marks: c.max_marks,
                achieved_marks: c.achieved_marks,
                evidence: c.evidence,
            });
    }

    Ok(Json(NmcNarfAssessmentPrintData {
        assessment_year: year,
        report_date: chrono::Utc::now().format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        nmc_registration_number: tenant.2,
        assessment_sections: sections
            .into_iter()
            .map(|s| {
                let criteria = section_criteria.remove(&s.section_name).unwrap_or_default();
                NarfSection {
                    section_name: s.section_name,
                    max_score: s.max_score,
                    achieved_score: s.achieved_score,
                    percentage: s.percentage,
                    criteria,
                }
            })
            .collect(),
        overall_score: summary.0,
        maximum_score: summary.1,
        percentage: summary.2,
        grade: summary.3,
        strengths,
        areas_for_improvement: improvements,
        action_plan,
        assessed_by: None,
        verified_by: None,
        hospital_logo_url: tenant.1,
    }))
}

//! Print-data endpoints — regulatory compliance reports.
//!
//! These endpoints generate data for NABH, NMC, NABL, SPCB, PESO, PCPNDT,
//! and other regulatory compliance reports.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::Datelike;

use medbrains_core::permissions;
use crate::pcpndt_form_f::get_pcpndt_form_f_print_data;
use medbrains_core::print_data::{
    AebasAttendanceReportPrintData, BirthRegisterEntry, BirthRegisterPrintData, BmwCategory,
    ComplianceSection, CriticalValueMetrics, CylinderStorage, DeathRegisterEntry,
    DeathRegisterPrintData, DepartmentAttendance, DisposalRecord, DrugLicenseReportPrintData,
    DrugStockCategory, ExpiryAlert, FormFCompliance, GasIncident, MedicalGasSystem,
    MlcCaseTypeCount, MlcRegisterSummaryEntry, MlcRegisterSummaryPrintData, MlcStatusCount,
    NabhQualityReportPrintData, NablQualityReportPrintData, NmcComplianceReportPrintData,
    PcpndtPersonnel, PcpndtProcedure, PcpndtReportPrintData, PesoComplianceReportPrintData,
    PtResult, QcMetric, QualityIndicator, QualitySummary, SafetyInspection,
    SpcbBmwReturnsPrintData, TatMetric,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── NABH Quality Indicators Report ────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct QualityIndicatorRow {
    indicator_code: String,
    indicator_name: String,
    category: String,
    numerator: Option<i32>,
    denominator: Option<i32>,
    rate: f64,
    benchmark: Option<f64>,
    status: String,
}

/// Latest `quality_indicator_values` row per indicator inside the period. "Met"
/// follows the quality dashboard's rule: calculated value at or above target.
pub async fn get_nabh_quality_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NabhQualityReportPrintData>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let indicators = sqlx::query_as::<_, QualityIndicatorRow>(
        "SELECT indicator_code, indicator_name, category, numerator, denominator, rate, \
                benchmark, status \
         FROM ( \
           SELECT DISTINCT ON (qi.id) \
             COALESCE(qi.indicator_code, qi.code) AS indicator_code, \
             COALESCE(qi.indicator_name, qi.name) AS indicator_name, \
             qi.category, qi.display_order, \
             ROUND(v.numerator_value)::int AS numerator, \
             ROUND(v.denominator_value)::int AS denominator, \
             v.calculated_value::float8 AS rate, \
             COALESCE(qi.benchmark, qi.benchmark_national::float8) AS benchmark, \
             CASE WHEN qi.target_value IS NULL THEN 'not_applicable' \
                  WHEN v.calculated_value >= qi.target_value THEN 'met' \
                  ELSE 'below' END AS status \
           FROM quality_indicator_values v \
           JOIN quality_indicators qi ON qi.id = v.indicator_id \
             AND qi.tenant_id = v.tenant_id AND qi.deleted_at IS NULL \
           WHERE v.deleted_at IS NULL AND v.calculated_value IS NOT NULL \
             AND v.period_start >= $1 AND v.period_end < $2 AND v.tenant_id = $3 \
           ORDER BY qi.id, v.period_end DESC \
         ) latest \
         ORDER BY category, display_order, indicator_code LIMIT 1000",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, nabh_certificate_number, nabh_valid_until::text \
         FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let action_items: Vec<String> = sqlx::query_scalar(
        "SELECT description FROM quality_action_items \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND status <> 'closed' \
           AND completed_at IS NULL AND NULLIF(description, '') IS NOT NULL \
         ORDER BY due_date NULLS LAST, created_at LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let count = |s: &str| indicators.iter().filter(|i| i.status == s).count() as i32;
    let summary = QualitySummary {
        total_indicators: indicators.len() as i32,
        met_benchmark: count("met"),
        below_benchmark: count("below"),
        not_applicable: count("not_applicable"),
    };

    Ok(Json(NabhQualityReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
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
                trend: None,
            })
            .collect(),
        summary,
        action_items,
        prepared_by: None,
        reviewed_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── NMC Compliance Report ────────────────────────────────

/// Resolves a report period — `YYYY`, `YYYY-MM` or `YYYY-Qn` — to `[start, end)`.
fn period_bounds(period: &str) -> Result<(chrono::NaiveDate, chrono::NaiveDate), AppError> {
    let bad = || AppError::BadRequest(format!("expected YYYY, YYYY-MM or YYYY-Qn: {period}"));
    let (year, rest) = period
        .split_once('-')
        .map_or((period, None), |(y, r)| (y, Some(r)));
    let year: i32 = year.parse().map_err(|_| bad())?;
    let (start_month, months) = match rest {
        None => (1, 12),
        Some(r) => match r.strip_prefix('Q') {
            Some(q) => match q.parse::<u32>() {
                Ok(n @ 1..=4) => ((n - 1) * 3 + 1, 3),
                _ => return Err(bad()),
            },
            None => (r.parse::<u32>().map_err(|_| bad())?, 1),
        },
    };
    let start = chrono::NaiveDate::from_ymd_opt(year, start_month, 1).ok_or_else(bad)?;
    let end = start
        .checked_add_months(chrono::Months::new(months))
        .ok_or_else(bad)?;
    Ok((start, end))
}

#[derive(Debug, sqlx::FromRow)]
struct ComplianceSectionRow {
    section_name: String,
    total_requirements: i32,
    compliant: i32,
    non_compliant: i32,
    compliance_percentage: f64,
}

/// Every NMC checklist whose assessment period overlaps `[$1, $2)` is one section.
pub async fn get_nmc_compliance_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NmcComplianceReportPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::checklists::LIST)?;
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let sections = sqlx::query_as::<_, ComplianceSectionRow>(
        "SELECT \
           concat_ws(' - ', NULLIF(standard_code, ''), name) AS section_name, \
           total_items AS total_requirements, \
           compliant_items AS compliant, \
           non_compliant_items AS non_compliant, \
           COALESCE(compliance_score::float8, CASE WHEN total_items > 0 \
             THEN compliant_items * 100.0 / total_items ELSE 0 END)::float8 \
             AS compliance_percentage \
         FROM compliance_checklists \
         WHERE accreditation_body = 'nmc' AND deleted_at IS NULL \
           AND assessment_period_start < $2 AND assessment_period_end >= $1 \
           AND tenant_id = $3 \
         ORDER BY standard_code, name LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let non_compliance_items: Vec<String> = sqlx::query_scalar(
        "SELECT COALESCE(NULLIF(i.gap_description, ''), i.criterion) \
         FROM compliance_checklist_items i \
         JOIN compliance_checklists c ON c.id = i.checklist_id \
         WHERE c.accreditation_body = 'nmc' AND c.deleted_at IS NULL \
           AND c.assessment_period_start < $2 AND c.assessment_period_end >= $1 \
           AND c.tenant_id = $3 AND i.deleted_at IS NULL AND i.status = 'non_compliant' \
         ORDER BY c.standard_code, i.item_number LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let corrective_actions: Vec<String> = sqlx::query_scalar(
        "SELECT i.corrective_action \
         FROM compliance_checklist_items i \
         JOIN compliance_checklists c ON c.id = i.checklist_id \
         WHERE c.accreditation_body = 'nmc' AND c.deleted_at IS NULL \
           AND c.assessment_period_start < $2 AND c.assessment_period_end >= $1 \
           AND c.tenant_id = $3 AND i.deleted_at IS NULL \
           AND NULLIF(i.corrective_action, '') IS NOT NULL \
         ORDER BY i.target_date NULLS LAST, c.standard_code, i.item_number LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

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
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
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

/// Computed from the lab's own records for the period: `lab_qc_results`,
/// `lab_eqas_results`, `lab_orders`, `lab_critical_alerts`, `lab_sample_rejections`.
pub async fn get_nabl_quality_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<NablQualityReportPrintData>, AppError> {
    require_permission(&claims, permissions::lab::qc::LIST)?;
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let (total_orders, rejected): (i32, i32) = sqlx::query_as(
        "SELECT \
           (SELECT COUNT(*)::int FROM lab_orders WHERE deleted_at IS NULL AND NOT is_dummy \
              AND created_at >= $1 AND created_at < $2 AND tenant_id = $3), \
           (SELECT COUNT(*)::int FROM lab_sample_rejections WHERE deleted_at IS NULL \
              AND rejected_at >= $1 AND rejected_at < $2 AND tenant_id = $3)",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    // No lab activity in the period: there is nothing to report, not a 0% rate.
    if total_orders == 0 {
        return Err(AppError::NotFound);
    }

    let qc_metrics = sqlx::query_as::<_, QcMetricRow>(
        "SELECT t.name || ' (' || r.level || ')' AS analyte, \
                AVG(r.observed_value)::float8 AS mean, \
                STDDEV_SAMP(r.observed_value)::float8 AS sd, \
                (STDDEV_SAMP(r.observed_value) * 100 / AVG(r.observed_value))::float8 AS cv, \
                (COUNT(*) FILTER (WHERE cardinality(r.westgard_violations) > 0))::int \
                  AS westgard_violations \
         FROM lab_qc_results r \
         JOIN lab_test_catalog t ON t.id = r.test_id \
         WHERE r.deleted_at IS NULL AND COALESCE(r.run_date, r.run_time::date) >= $1 \
           AND COALESCE(r.run_date, r.run_time::date) < $2 AND r.tenant_id = $3 \
         GROUP BY t.name, r.level \
         HAVING COUNT(r.observed_value) >= 2 AND AVG(r.observed_value) <> 0 \
         ORDER BY t.name, r.level LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let pt_results = sqlx::query_as::<_, PtResultRow>(
        "SELECT e.program_name, t.name AS analyte, \
                COALESCE(e.reported_value::text, '') AS result, e.evaluation::text AS status \
         FROM lab_eqas_results e \
         JOIN lab_test_catalog t ON t.id = e.test_id \
         WHERE e.deleted_at IS NULL AND e.report_date >= $1 AND e.report_date < $2 \
           AND e.tenant_id = $3 \
         ORDER BY e.report_date, e.program_name LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tat_metrics = sqlx::query_as::<_, TatMetricRow>(
        "SELECT t.name AS test_category, t.tat_hours::float8 AS target_tat_hours, \
                AVG(EXTRACT(EPOCH FROM (o.completed_at - o.collected_at)) / 3600)::float8 \
                  AS actual_tat_hours, \
                (COUNT(*) FILTER (WHERE o.completed_at - o.collected_at \
                   <= make_interval(hours => t.tat_hours)) * 100.0 / COUNT(*))::float8 \
                  AS compliance_percentage \
         FROM lab_orders o \
         JOIN lab_test_catalog t ON t.id = o.test_id \
         WHERE o.deleted_at IS NULL AND NOT o.is_dummy AND t.tat_hours IS NOT NULL \
           AND o.collected_at IS NOT NULL AND o.completed_at IS NOT NULL \
           AND o.completed_at >= $1 AND o.completed_at < $2 AND o.tenant_id = $3 \
         GROUP BY t.name, t.tat_hours ORDER BY t.name LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // "Within target" = notified and never escalated by the critical-alert timer.
    let (critical_total, critical_on_time, critical_avg_minutes): (i32, i32, Option<f64>) =
        sqlx::query_as(
            "SELECT COUNT(*)::int, \
                    (COUNT(*) FILTER (WHERE notified_at IS NOT NULL \
                       AND escalated_at IS NULL))::int, \
                    AVG(EXTRACT(EPOCH FROM (notified_at - created_at)) / 60)::float8 \
             FROM lab_critical_alerts \
             WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2 \
               AND tenant_id = $3",
        )
        .bind(start)
        .bind(end)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, nabl_certificate_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(NablQualityReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        laboratory_name: tenant.0,
        nabl_certificate_number: tenant.2,
        // ponytail: NABL scope and repeat-test rate are not recorded anywhere yet.
        scope_of_accreditation: Vec::new(),
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
            total_critical_values: critical_total,
            reported_within_target: critical_on_time,
            average_reporting_time_minutes: critical_avg_minutes,
        },
        sample_rejection_rate: f64::from(rejected) * 100.0 / f64::from(total_orders),
        repeat_rate: None,
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
    manifest_number: Option<String>,
}

/// Quarter totals come from `nabh_bmw_disposal_log`, which mirrors every
/// `biowaste_records` row; the manifest number lives on the source record.
pub async fn get_spcb_bmw_returns_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(quarter): Path<String>,
) -> Result<Json<SpcbBmwReturnsPrintData>, AppError> {
    require_permission(&claims, permissions::infection_control::biowaste::LIST)?;
    let (start, end) = period_bounds(&quarter)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let categories = sqlx::query_as::<_, BmwCategoryRow>(
        "SELECT waste_category AS category, \
           CASE WHEN waste_category IN ('yellow', 'red', 'white', 'blue') \
             THEN waste_category ELSE '' END AS color_code, \
           COALESCE(string_agg(DISTINCT waste_subtype, ', '), '') AS description, \
           SUM(quantity_kg)::float8 AS quantity_kg, \
           string_agg(DISTINCT disposal_method, ', ') AS disposal_method \
         FROM nabh_bmw_disposal_log \
         WHERE deleted_at IS NULL AND disposal_date >= $1 AND disposal_date < $2 \
           AND tenant_id = $3 \
         GROUP BY waste_category ORDER BY waste_category LIMIT 50",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let disposal_records = sqlx::query_as::<_, DisposalRecordRow>(
        "SELECT l.disposal_date, l.waste_category AS category, \
                l.quantity_kg::float8 AS quantity_kg, b.manifest_number \
         FROM nabh_bmw_disposal_log l \
         LEFT JOIN biowaste_records b ON b.id = l.source_record_id \
           AND l.source_module = 'biowaste_records' AND b.deleted_at IS NULL \
         WHERE l.deleted_at IS NULL AND l.disposal_date >= $1 AND l.disposal_date < $2 \
           AND l.tenant_id = $3 \
         ORDER BY l.disposal_date LIMIT 5000",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total_waste: f64 = categories.iter().map(|c| c.quantity_kg).sum();

    // The latest hand-over in the quarter that names a real agency is the CBWTF.
    let cbwtf = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT disposal_agency, disposal_agency_licence \
         FROM nabh_bmw_disposal_log \
         WHERE deleted_at IS NULL AND disposal_date >= $1 AND disposal_date < $2 \
           AND tenant_id = $3 \
           AND (disposal_agency_licence IS NOT NULL OR received_by_agency IS NOT NULL) \
         ORDER BY disposal_date DESC LIMIT 1",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let (cbwtf_name, cbwtf_authorization) = cbwtf.map_or((None, None), |(n, l)| (Some(n), l));

    let total_beds: i32 = sqlx::query_scalar(
        "SELECT COUNT(*)::int FROM locations \
         WHERE level = 'bed' AND is_active AND deleted_at IS NULL AND tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1 FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(SpcbBmwReturnsPrintData {
        quarter,
        year: start.year(),
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        // ponytail: SPCB authorisation, occupancy history, training and BMW incidents
        // are not recorded anywhere yet.
        authorization_number: None,
        total_beds,
        average_occupancy: None,
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
        cbwtf_authorization,
        disposal_records: disposal_records
            .into_iter()
            .map(|r| DisposalRecord {
                date: r.disposal_date.format("%d-%b-%Y").to_string(),
                category: r.category,
                quantity_kg: r.quantity_kg,
                // ponytail: vehicle number not recorded anywhere yet
                vehicle_number: None,
                manifest_number: r.manifest_number,
            })
            .collect(),
        training_conducted: None,
        training_attendees: None,
        incidents_reported: None,
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
    cylinder_count: Option<i32>,
    last_tested: Option<chrono::NaiveDate>,
    next_test_due: Option<chrono::NaiveDate>,
    status: String,
}

#[derive(Debug, sqlx::FromRow)]
struct SafetyInspectionRow {
    inspection_date: chrono::NaiveDate,
    inspector: String,
    findings: String,
    status: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct GasIncidentRow {
    incident_date: chrono::NaiveDate,
    gas_type: String,
    description: String,
}

/// Built from the facilities module: the latest `fms_gas_readings` row per gas
/// source, gas alarms as incidents, and `fms_gas_compliance` for licence and
/// inspections.
pub async fn get_peso_compliance_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(year): Path<i32>,
) -> Result<Json<PesoComplianceReportPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::gas::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let gas_systems = sqlx::query_as::<_, MedicalGasSystemRow>(
        "SELECT DISTINCT ON (r.gas_type, r.source_type, r.location_id) \
           r.gas_type::text AS gas_type, r.source_type::text AS source_type, \
           COALESCE(l.name, '') AS location, r.cylinder_count, \
           c.last_inspection_date AS last_tested, c.next_inspection_date AS next_test_due, \
           CASE WHEN r.is_alarm THEN concat_ws(': ', 'alarm', r.alarm_reason) \
                ELSE 'normal' END AS status \
         FROM fms_gas_readings r \
         LEFT JOIN locations l ON l.id = r.location_id AND l.deleted_at IS NULL \
         LEFT JOIN LATERAL ( \
           SELECT last_inspection_date, next_inspection_date FROM fms_gas_compliance gc \
           WHERE gc.gas_type = r.gas_type AND gc.tenant_id = r.tenant_id \
             AND gc.deleted_at IS NULL \
           ORDER BY gc.updated_at DESC LIMIT 1 \
         ) c ON true \
         WHERE r.deleted_at IS NULL AND r.tenant_id = $1 \
           AND r.reading_at < make_date($2 + 1, 1, 1) \
         ORDER BY r.gas_type, r.source_type, r.location_id, r.reading_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .fetch_all(&mut *tx)
    .await?;

    let inspections = sqlx::query_as::<_, SafetyInspectionRow>(
        "SELECT last_inspection_date AS inspection_date, \
                COALESCE(inspector_name, '') AS inspector, COALESCE(notes, '') AS findings, \
                compliance_status AS status \
         FROM fms_gas_compliance \
         WHERE deleted_at IS NULL AND tenant_id = $1 \
           AND EXTRACT(YEAR FROM last_inspection_date) = $2 \
         ORDER BY last_inspection_date DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .fetch_all(&mut *tx)
    .await?;

    let incidents = sqlx::query_as::<_, GasIncidentRow>(
        "SELECT reading_at::date AS incident_date, gas_type::text AS gas_type, \
                COALESCE(alarm_reason, '') AS description \
         FROM fms_gas_readings \
         WHERE deleted_at IS NULL AND is_alarm AND tenant_id = $1 \
           AND EXTRACT(YEAR FROM reading_at) = $2 \
         ORDER BY reading_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .fetch_all(&mut *tx)
    .await?;

    // Every current gas compliance status, whatever year it was assessed in.
    let statuses: Vec<Option<String>> = sqlx::query_scalar(
        "SELECT compliance_status FROM fms_gas_compliance \
         WHERE deleted_at IS NULL AND tenant_id = $1 LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT t.name, t.logo_url, COALESCE(t.peso_license_number, c.peso_license_number), \
                COALESCE(t.peso_valid_until, c.peso_valid_to::text) \
         FROM tenants t \
         LEFT JOIN LATERAL ( \
           SELECT peso_license_number, peso_valid_to FROM fms_gas_compliance \
           WHERE tenant_id = t.id AND deleted_at IS NULL AND peso_license_number IS NOT NULL \
           ORDER BY peso_valid_to DESC NULLS LAST LIMIT 1 \
         ) c ON true \
         WHERE t.id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Compliant only when there are assessments and every one says so; an
    // unassessed gas leaves the status blank rather than implying compliance.
    let is_compliant = |s: &Option<String>| {
        s.as_deref()
            .is_some_and(|v| v.eq_ignore_ascii_case("compliant"))
    };
    let compliance_status = if statuses.iter().any(|s| s.is_some() && !is_compliant(s)) {
        "Non-Compliant".to_string()
    } else if !statuses.is_empty() && statuses.iter().all(is_compliant) {
        "Compliant".to_string()
    } else {
        String::new()
    };

    let cylinders = |gas: &str| -> i32 {
        gas_systems
            .iter()
            .filter(|s| s.source_type == "cylinder_manifold" && s.gas_type == gas)
            .filter_map(|s| s.cylinder_count)
            .sum()
    };
    let other_cylinders = gas_systems
        .iter()
        .filter(|s| {
            s.source_type == "cylinder_manifold"
                && !matches!(s.gas_type.as_str(), "oxygen" | "nitrous_oxide" | "co2")
        })
        .filter_map(|s| s.cylinder_count)
        .sum();
    let fmt = |d: Option<chrono::NaiveDate>| d.map(|d| d.format("%d-%b-%Y").to_string());

    Ok(Json(PesoComplianceReportPrintData {
        report_year: year,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        peso_license_number: tenant.2,
        license_valid_until: tenant.3,
        cylinder_storage: CylinderStorage {
            // ponytail: licensed storage capacity and storage audit are not recorded
            // anywhere yet.
            total_capacity: None,
            oxygen_cylinders: cylinders("oxygen"),
            nitrous_oxide_cylinders: cylinders("nitrous_oxide"),
            co2_cylinders: cylinders("co2"),
            other_cylinders,
            storage_compliant: None,
        },
        medical_gas_systems: gas_systems
            .into_iter()
            .map(|s| MedicalGasSystem {
                gas_type: s.gas_type,
                source_type: s.source_type,
                location: s.location,
                // ponytail: installed capacity not recorded anywhere yet
                capacity: String::new(),
                last_tested: fmt(s.last_tested),
                next_test_due: fmt(s.next_test_due),
                status: s.status,
            })
            .collect(),
        safety_inspections: inspections
            .into_iter()
            .map(|i| SafetyInspection {
                inspection_date: i.inspection_date.format("%d-%b-%Y").to_string(),
                inspector: i.inspector,
                findings: i.findings,
                status: i.status.unwrap_or_default(),
            })
            .collect(),
        incidents: incidents
            .into_iter()
            .map(|i| GasIncident {
                incident_date: i.incident_date.format("%d-%b-%Y").to_string(),
                gas_type: i.gas_type,
                description: i.description,
                // ponytail: action taken on a gas alarm is not recorded anywhere yet
                action_taken: String::new(),
            })
            .collect(),
        compliance_status,
        prepared_by: None,
        hospital_logo_url: tenant.1,
    }))
}

// ── Drug License Report ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DrugLicenceRow {
    license_type: String,
    license_number: Option<String>,
    valid_from: Option<chrono::NaiveDate>,
    valid_until: Option<chrono::NaiveDate>,
    licensing_authority: String,
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

/// `license_id` is a `facility_regulatory_compliance` row; stock is tenant-wide.
pub async fn get_drug_license_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(license_id): Path<uuid::Uuid>,
) -> Result<Json<DrugLicenseReportPrintData>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let licence = sqlx::query_as::<_, DrugLicenceRow>(
        "SELECT rb.code AS license_type, f.license_number, f.valid_from, f.valid_until, \
                rb.name AS licensing_authority \
         FROM facility_regulatory_compliance f \
         JOIN regulatory_bodies rb ON rb.id = f.regulatory_body_id \
         WHERE f.id = $1 AND f.tenant_id = $2 AND f.deleted_at IS NULL",
    )
    .bind(license_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let stock_summary = sqlx::query_as::<_, DrugStockRow>(
        "SELECT COALESCE(c.category, 'Uncategorised') AS category, \
                COUNT(DISTINCT c.id)::int AS total_items, \
                COALESCE(SUM(b.quantity_on_hand \
                  * COALESCE(b.purchase_rate, c.cost_price)), 0)::float8 AS total_value \
         FROM pharmacy_batches b \
         JOIN pharmacy_catalog c ON c.id = b.catalog_item_id \
         WHERE b.deleted_at IS NULL AND c.deleted_at IS NULL AND b.quantity_on_hand > 0 \
           AND b.tenant_id = $1 \
         GROUP BY 1 ORDER BY 1 LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let expiry_alerts = sqlx::query_as::<_, ExpiryAlertRow>(
        "SELECT c.name AS drug_name, b.batch_number, b.expiry_date, \
                b.quantity_on_hand AS quantity, \
                (b.expiry_date - CURRENT_DATE)::int AS days_to_expiry \
         FROM pharmacy_batches b \
         JOIN pharmacy_catalog c ON c.id = b.catalog_item_id \
         WHERE b.deleted_at IS NULL AND c.deleted_at IS NULL AND b.quantity_on_hand > 0 \
           AND b.expiry_date <= CURRENT_DATE + 90 AND b.tenant_id = $1 \
         ORDER BY b.expiry_date LIMIT 20",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, logo_url FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let fmt = |d: Option<chrono::NaiveDate>| d.map(|d| d.format("%d-%b-%Y").to_string());

    Ok(Json(DrugLicenseReportPrintData {
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        drug_license_number: licence.license_number.unwrap_or_default(),
        license_type: licence.license_type,
        // ponytail: pharmacist, licensed categories, controlled-substance licence,
        // storage audit and inspections are not recorded anywhere yet.
        valid_from: fmt(licence.valid_from),
        valid_until: fmt(licence.valid_until),
        licensing_authority: licence.licensing_authority,
        registered_pharmacist: None,
        registration_number: None,
        authorized_categories: Vec::new(),
        controlled_substance_license: None,
        storage_conditions_compliant: None,
        inspection_history: Vec::new(),
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
}

/// Built from the Form F register (`pcpndt_forms`) for the period. Fetal sex is
/// deliberately never recorded, so there is nothing to break counts down by.
pub async fn get_pcpndt_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<PcpndtReportPrintData>, AppError> {
    require_permission(&claims, permissions::regulatory::pcpndt::LIST)?;
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The doctors who performed the period's procedures are its qualified personnel.
    let personnel = sqlx::query_as::<_, PcpndtPersonnelRow>(
        "SELECT DISTINCT COALESCE(u.full_name, u.name, '') AS name, \
                COALESCE(u.qualification, '') AS qualification, \
                COALESCE(u.medical_registration_number, u.registration_number, '') \
                  AS registration_number, \
                COALESCE(u.designation, '') AS role \
         FROM pcpndt_forms f \
         JOIN users u ON u.id = f.performing_doctor_id \
         WHERE f.deleted_at IS NULL AND f.created_at >= $1 AND f.created_at < $2 \
           AND f.tenant_id = $3 \
         ORDER BY 1 LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let procedures = sqlx::query_as::<_, PcpndtProcedureRow>(
        "SELECT procedure_type, COUNT(*)::int AS total_count \
         FROM pcpndt_forms \
         WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2 AND tenant_id = $3 \
         GROUP BY procedure_type ORDER BY procedure_type LIMIT 500",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // A Form F is complete once it has been submitted (signed) or registered.
    let (total_forms, complete_forms): (i32, i32) = sqlx::query_as(
        "SELECT COUNT(*)::int, \
                (COUNT(*) FILTER (WHERE status IN ('submitted', 'registered')))::int \
         FROM pcpndt_forms \
         WHERE deleted_at IS NULL AND created_at >= $1 AND created_at < $2 AND tenant_id = $3",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<
        _,
        (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
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
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        registration_number: tenant.2.unwrap_or_default(),
        registration_valid_until: tenant.3.unwrap_or_default(),
        appropriate_authority: tenant.4.unwrap_or_default(),
        // ponytail: PNDT equipment registrations and authority inspections are not
        // recorded anywhere yet.
        registered_equipment: Vec::new(),
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
            })
            .collect(),
        form_f_compliance: FormFCompliance {
            total_forms,
            complete_forms,
            incomplete_forms: total_forms - complete_forms,
            // No forms → the rate is undefined, not 0%.
            compliance_percentage: (total_forms > 0)
                .then(|| f64::from(complete_forms) * 100.0 / f64::from(total_forms)),
        },
        inspections: Vec::new(),
        declaration_text: declaration,
        signatory_name: String::new(),
        signatory_designation: String::new(),
        hospital_logo_url: tenant.1,
    }))
}

// ── Birth Register ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct BirthRegisterEntryRow {
    serial_number: i32,
    registration_number: String,
    date_of_birth: chrono::NaiveDate,
    time_of_birth: Option<chrono::NaiveTime>,
    gender: String,
    birth_weight_grams: Option<i32>,
    mother_name: String,
    mother_age: Option<i32>,
    father_name: Option<String>,
    address: String,
    delivery_type: String,
    attending_doctor: Option<String>,
}

/// Reads `mrd_birth_register`, whose `patient_id` is the mother and whose
/// `birth_type` is the delivery mode (normal / cesarean / assisted ...).
pub async fn get_birth_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<BirthRegisterPrintData>, AppError> {
    require_permission(&claims, permissions::mrd::births::LIST)?;
    // Deliberately unfiltered: a statutory birth register lists every birth in
    // the period, like the death register below, so it stays permission-gated.
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let entries = sqlx::query_as::<_, BirthRegisterEntryRow>(
        "SELECT \
           ROW_NUMBER() OVER (ORDER BY b.birth_date, b.birth_time NULLS LAST, \
             b.register_number)::int AS serial_number, \
           b.register_number AS registration_number, \
           b.birth_date AS date_of_birth, \
           b.birth_time AS time_of_birth, \
           b.baby_gender AS gender, \
           b.baby_weight_grams AS birth_weight_grams, \
           concat_ws(' ', p.first_name, p.last_name) AS mother_name, \
           b.mother_age, \
           b.father_name, \
           concat_ws(', ', NULLIF(p.address->>'line1', ''), NULLIF(p.address->>'city', ''), \
                     NULLIF(p.address->>'postal_code', '')) AS address, \
           b.birth_type AS delivery_type, \
           COALESCE(u.full_name, u.name) AS attending_doctor \
         FROM mrd_birth_register b \
         JOIN patients p ON p.id = b.patient_id \
         LEFT JOIN users u ON u.id = b.attending_doctor_id \
         WHERE b.deleted_at IS NULL AND b.birth_date >= $1 AND b.birth_date < $2 \
           AND b.tenant_id = $3 \
         ORDER BY b.birth_date, b.birth_time NULLS LAST, b.register_number LIMIT 5000",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let (total, male, female) = sqlx::query_as::<_, (i32, i32, i32)>(
        "SELECT COUNT(*)::int, \
           (COUNT(*) FILTER (WHERE lower(baby_gender) = 'male'))::int, \
           (COUNT(*) FILTER (WHERE lower(baby_gender) = 'female'))::int \
         FROM mrd_birth_register \
         WHERE deleted_at IS NULL AND birth_date >= $1 AND birth_date < $2 AND tenant_id = $3",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, hospital_code, municipal_area FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(BirthRegisterPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        hospital_code: tenant.2,
        municipal_area: tenant.3,
        entries: entries
            .into_iter()
            .map(|e| BirthRegisterEntry {
                serial_number: e.serial_number,
                registration_number: e.registration_number,
                date_of_birth: e.date_of_birth.format("%d-%b-%Y").to_string(),
                time_of_birth: e
                    .time_of_birth
                    .map(|t| t.format("%H:%M").to_string())
                    .unwrap_or_default(),
                gender: e.gender,
                birth_weight_grams: e.birth_weight_grams,
                // ponytail: live/still birth not recorded on mrd_birth_register yet
                birth_type: String::new(),
                mother_name: e.mother_name,
                mother_age: e.mother_age,
                father_name: e.father_name.unwrap_or_default(),
                address: e.address,
                delivery_type: e.delivery_type,
                attending_doctor: e.attending_doctor.unwrap_or_default(),
            })
            .collect(),
        total_births: total,
        male_births: male,
        female_births: female,
        // ponytail: live/still split not recorded anywhere yet
        live_births: None,
        still_births: None,
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
    time_of_death: Option<chrono::NaiveTime>,
    deceased_name: String,
    age: String,
    gender: String,
    address: String,
    cause_of_death: String,
    certifying_doctor: String,
    mlc_case: bool,
}

/// Reads the MRD death register (`mrd_death_register`).
pub async fn get_death_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<DeathRegisterPrintData>, AppError> {
    require_permission(&claims, permissions::mrd::deaths::LIST)?;
    // Deliberately unfiltered: a statutory death register lists every death in
    // the period. Narrowing it to the caller's own patients would make the
    // document wrong as a register, so it stays permission-gated.
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let entries = sqlx::query_as::<_, DeathRegisterEntryRow>(
        "SELECT \
           ROW_NUMBER() OVER (ORDER BY dr.death_date, dr.death_time NULLS LAST, \
             dr.register_number)::int AS serial_number, \
           dr.register_number AS registration_number, \
           dr.death_date AS date_of_death, \
           dr.death_time AS time_of_death, \
           concat_ws(' ', p.first_name, p.last_name) AS deceased_name, \
           COALESCE(EXTRACT(YEAR FROM age(dr.death_date, p.date_of_birth))::int::text, '') \
             AS age, \
           p.gender::text AS gender, \
           concat_ws(', ', NULLIF(p.address->>'line1', ''), NULLIF(p.address->>'city', ''), \
                     NULLIF(p.address->>'postal_code', '')) AS address, \
           COALESCE(dr.immediate_cause, dr.cause_of_death, '') AS cause_of_death, \
           COALESCE(u.full_name, u.name, '') AS certifying_doctor, \
           dr.is_medico_legal AS mlc_case \
         FROM mrd_death_register dr \
         JOIN patients p ON p.id = dr.patient_id \
         LEFT JOIN users u ON u.id = dr.certifying_doctor_id \
         WHERE dr.deleted_at IS NULL AND dr.death_date >= $1 AND dr.death_date < $2 \
           AND dr.tenant_id = $3 \
         ORDER BY dr.death_date, dr.death_time NULLS LAST, dr.register_number LIMIT 5000",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let stats = sqlx::query_as::<_, (i32, i32, i32, i32)>(
        "SELECT \
           COUNT(*)::int, \
           (COUNT(*) FILTER (WHERE p.gender = 'male'))::int, \
           (COUNT(*) FILTER (WHERE p.gender = 'female'))::int, \
           (COUNT(*) FILTER (WHERE dr.is_medico_legal))::int \
         FROM mrd_death_register dr \
         JOIN patients p ON p.id = dr.patient_id \
         WHERE dr.deleted_at IS NULL AND dr.death_date >= $1 AND dr.death_date < $2 \
           AND dr.tenant_id = $3",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, hospital_code, municipal_area FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DeathRegisterPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        hospital_code: tenant.2,
        municipal_area: tenant.3,
        entries: entries
            .into_iter()
            .map(|e| DeathRegisterEntry {
                serial_number: e.serial_number,
                registration_number: e.registration_number,
                date_of_death: e.date_of_death.format("%d-%b-%Y").to_string(),
                time_of_death: e
                    .time_of_death
                    .map(|t| t.format("%H:%M").to_string())
                    .unwrap_or_default(),
                deceased_name: e.deceased_name,
                age: e.age,
                gender: e.gender,
                address: e.address,
                cause_of_death: e.cause_of_death,
                // ponytail: the MRD death register carries no ICD code yet
                icd_code: None,
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
    registration_date: String,
    patient_name: String,
    age_gender: String,
    case_type: Option<String>,
    police_station: Option<String>,
    fir_number: Option<String>,
    outcome: Option<String>,
    current_status: String,
}

/// The MLC register for a period (`YYYY`, `YYYY-MM` or `YYYY-Qn`), dated by the
/// register date the desk entered, else the moment the case was registered.
pub async fn get_mlc_register_summary_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<MlcRegisterSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    // Deliberately unfiltered, as the death register above: a medico-legal
    // register is a statutory summary of the period, not a per-patient read.
    let (start, end) = period_bounds(&period)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    // Before the queries: `registered_at::date` must be the hospital's date.
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let entries = sqlx::query_as::<_, MlcSummaryEntryRow>(
        "SELECT \
           ROW_NUMBER() OVER (ORDER BY COALESCE(m.registration_date, m.registered_at::date), \
             m.registered_at, m.mlc_number)::int AS serial_number, \
           m.mlc_number, \
           to_char(COALESCE(m.registration_date, m.registered_at::date), 'DD-Mon-YYYY') \
             AS registration_date, \
           concat_ws(' ', p.first_name, p.last_name) AS patient_name, \
           concat_ws('/', \
             EXTRACT(YEAR FROM age(m.registered_at::date, p.date_of_birth))::int::text, \
             p.gender::text) AS age_gender, \
           m.case_type, \
           m.police_station, \
           m.fir_number, \
           m.patient_condition_at_discharge AS outcome, \
           m.status::text AS current_status \
         FROM mlc_cases m \
         JOIN patients p ON p.id = m.patient_id \
         WHERE m.deleted_at IS NULL AND m.tenant_id = $3 \
           AND COALESCE(m.registration_date, m.registered_at::date) >= $1 \
           AND COALESCE(m.registration_date, m.registered_at::date) < $2 \
         ORDER BY serial_number LIMIT 5000",
    )
    .bind(start)
    .bind(end)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, logo_url FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Counted from the rows above rather than re-queried, so the totals can
    // never disagree with the register they summarise.
    let mut case_types: std::collections::BTreeMap<&str, i32> = std::collections::BTreeMap::new();
    let mut statuses: std::collections::BTreeMap<&str, i32> = std::collections::BTreeMap::new();
    for e in &entries {
        *case_types
            .entry(e.case_type.as_deref().unwrap_or("Not recorded"))
            .or_default() += 1;
        *statuses.entry(e.current_status.as_str()).or_default() += 1;
    }
    let mut by_case_type: Vec<MlcCaseTypeCount> = case_types
        .into_iter()
        .map(|(t, count)| MlcCaseTypeCount {
            case_type: t.to_owned(),
            count,
        })
        .collect();
    let mut by_status: Vec<MlcStatusCount> = statuses
        .into_iter()
        .map(|(st, count)| MlcStatusCount {
            status: st.to_owned(),
            count,
        })
        .collect();
    by_case_type.sort_by_key(|c| std::cmp::Reverse(c.count));
    by_status.sort_by_key(|c| std::cmp::Reverse(c.count));
    let pending = entries
        .iter()
        .filter(|e| e.current_status != "closed")
        .count() as i32;
    let total = entries.len() as i32;

    Ok(Json(MlcRegisterSummaryPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: tenant.0,
        entries: entries
            .into_iter()
            .map(|e| MlcRegisterSummaryEntry {
                serial_number: e.serial_number,
                mlc_number: e.mlc_number,
                registration_date: e.registration_date,
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
        by_case_type,
        by_status,
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
    attendance_percentage: Option<f64>,
}

/// Reads the AEBAS MIS import (`aebas_period_summary` + department rows). A
/// period that was never imported is 404, not a report of zeros.
pub async fn get_aebas_attendance_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<Json<AebasAttendanceReportPrintData>, AppError> {
    require_permission(&claims, permissions::hr::attendance::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let (total_employees, average_attendance, total_working_days, holidays) =
        sqlx::query_as::<_, (i32, Option<f64>, i32, i32)>(
            "SELECT total_employees, average_attendance_percentage::float8, \
                    total_working_days, holidays \
             FROM aebas_period_summary \
             WHERE period = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        )
        .bind(&period)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let departments = sqlx::query_as::<_, DepartmentAttendanceRow>(
        "SELECT \
           department_name, \
           total_employees, \
           average_present::float8 AS average_present, \
           average_absent::float8 AS average_absent, \
           average_leave::float8 AS average_leave, \
           attendance_percentage::float8 AS attendance_percentage \
         FROM aebas_department_attendance \
         WHERE period = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY department_name LIMIT 5000",
    )
    .bind(&period)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, aebas_unit_code FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AebasAttendanceReportPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
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
        total_employees,
        average_attendance_percentage: average_attendance,
        total_working_days,
        holidays,
        prepared_by: None,
        hospital_logo_url: tenant.1,
    }))
}

/// Print-data regulatory/compliance routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/nabh-quality-report/{period}",
            get(get_nabh_quality_report_print_data),
        )
        .route(
            "/api/print-data/nmc-compliance-report/{period}",
            get(get_nmc_compliance_report_print_data),
        )
        .route(
            "/api/print-data/nabl-quality-report/{period}",
            get(get_nabl_quality_report_print_data),
        )
        .route(
            "/api/print-data/spcb-bmw-returns/{quarter}",
            get(get_spcb_bmw_returns_print_data),
        )
        .route(
            "/api/print-data/peso-compliance/{year}",
            get(get_peso_compliance_print_data),
        )
        .route(
            "/api/print-data/drug-license-report/{license_id}",
            get(get_drug_license_report_print_data),
        )
        .route(
            "/api/print-data/pcpndt-report/{period}",
            get(get_pcpndt_report_print_data),
        )
        .route(
            "/api/print-data/pcpndt-form-f/{id}",
            get(get_pcpndt_form_f_print_data),
        )
        .route(
            "/api/print-data/birth-register/{period}",
            get(get_birth_register_print_data),
        )
        .route(
            "/api/print-data/death-register/{period}",
            get(get_death_register_print_data),
        )
        .route(
            "/api/print-data/mlc-register-summary/{period}",
            get(get_mlc_register_summary_print_data),
        )
        .route(
            "/api/print-data/aebas-attendance/{period}",
            get(get_aebas_attendance_print_data),
        )
}

#[cfg(test)]
mod tests {
    use super::period_bounds;

    fn d(y: i32, m: u32) -> Option<chrono::NaiveDate> {
        chrono::NaiveDate::from_ymd_opt(y, m, 1)
    }

    #[test]
    fn period_bounds_resolves_year_month_and_quarter() {
        assert_eq!(period_bounds("2024").ok(), d(2024, 1).zip(d(2025, 1)));
        assert_eq!(period_bounds("2024-12").ok(), d(2024, 12).zip(d(2025, 1)));
        assert_eq!(period_bounds("2024-Q2").ok(), d(2024, 4).zip(d(2024, 7)));
        assert!(period_bounds("2024-Q0").is_err());
        assert!(period_bounds("2024-Q5").is_err());
        assert!(period_bounds("2024-13").is_err());
        assert!(period_bounds("last-month").is_err());
    }
}

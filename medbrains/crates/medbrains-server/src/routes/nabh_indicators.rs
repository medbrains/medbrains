// NABH KPI dashboard rollup.
//
// Pulls aggregates from the modules we already have data for (lab,
// radiology, ipd, opd, emergency, pharmacy, post-discharge). Each
// indicator is a small SQL query returning a single number and a
// period; the dashboard pulls them all in one request.
//
// The official NABH 6th Edition 2025 KPI annexure is the baseline
// catalog. Extra MedBrains evidence indicators appear only when a live
// source query exists; no fixed total target is assumed.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Datelike, Utc};
use serde::Serialize;
use sqlx::Postgres;

use medbrains_core::permissions;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// A single quality-indicator computation. The frontend uses
/// `direction` to colour traffic-light tiles: 'higher_better' →
/// green when value >= target, 'lower_better' → green when value
/// <= target.
#[derive(Debug, Serialize)]
pub struct Indicator {
    pub code: String,
    pub label: String,
    pub category: String, // 'access' | 'clinical' | 'safety' | 'experience' | 'operations'
    pub direction: String, // 'higher_better' | 'lower_better'
    pub unit: String,     // 'minutes' | 'hours' | 'percent' | 'count' | 'days'
    pub target: Option<f64>,
    pub value_current_month: Option<f64>,
    pub value_prev_month: Option<f64>,
    pub denominator_label: Option<String>, // e.g. "per 1000 patient-days"
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NabhRollupResponse {
    pub generated_at: DateTime<Utc>,
    pub period_label: String,
    pub indicators: Vec<Indicator>,
    pub coverage: Coverage,
}

#[derive(Debug, Serialize)]
pub struct Coverage {
    pub total_indicators: u32,
    pub computed: u32,
    pub pending_data_capture: u32,
    pub note: String,
}

struct CatalogIndicator {
    code: &'static str,
    label: &'static str,
    category: &'static str,
    direction: &'static str,
    unit: &'static str,
    target: Option<f64>,
    denominator_label: Option<&'static str>,
    note: Option<&'static str>,
}

// Source: NABH Hospital Accreditation Standard 6th Edition, effective
// 2025-01-01, KPI annexure. The local reference PDF is kept at
// `RFCs/references/NABH-Hospital-Accreditation-Standard-6th-Edition-January-2025.pdf`.
// This catalog maps the official 50 KPI annexure entries. Additional
// MedBrains evidence indicators are returned only when backed by live
// source data in `get_indicators`.
const NABH_INDICATOR_CATALOG: &[CatalogIndicator] = &[
    CatalogIndicator {
        code: "NABH_KPI_01_INITIAL_ASSESSMENT_TAT",
        label: "Initial assessment TAT for indoor patients",
        category: "clinical",
        direction: "lower_better",
        unit: "minutes",
        target: Some(120.0),
        denominator_label: None,
        note: Some("NABH 6th Ed KPI annexure organisation-wide KPI 1"),
    },
    CatalogIndicator {
        code: "NABH_KPI_02_REPORTING_ERRORS",
        label: "Reporting errors per 1000 investigations",
        category: "clinical",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("per 1000 tests"),
        note: Some("Laboratory and radiology signed-report amendments"),
    },
    CatalogIndicator {
        code: "NABH_KPI_03_DIAGNOSTIC_SAFETY_ADHERENCE",
        label: "Diagnostic staff safety precautions adherence",
        category: "safety",
        direction: "higher_better",
        unit: "percent",
        target: Some(95.0),
        denominator_label: Some("audit sample"),
        note: Some("Monthly diagnostic safety audit"),
    },
    CatalogIndicator {
        code: "NABH_KPI_04_MEDICATION_ERRORS",
        label: "Medication error incidence",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(1.0),
        denominator_label: Some("of medication opportunities"),
        note: Some("Medication-error capture per NABH medication-error annexure"),
    },
    CatalogIndicator {
        code: "NABH_KPI_05_ADVERSE_DRUG_REACTIONS",
        label: "Inpatients developing adverse drug reactions",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(2.0),
        denominator_label: Some("of inpatients"),
        note: Some("ADR reporting / pharmacovigilance"),
    },
    CatalogIndicator {
        code: "NABH_KPI_06_UNPLANNED_RETURN_OT",
        label: "Unplanned return to OT",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(1.0),
        denominator_label: Some("of OT patients"),
        note: Some("30-day delayed capture"),
    },
    CatalogIndicator {
        code: "NABH_KPI_07_SURGICAL_SAFETY_ADHERENCE",
        label: "Surgical safety procedure adherence",
        category: "safety",
        direction: "higher_better",
        unit: "percent",
        target: Some(98.0),
        denominator_label: Some("audit sample"),
        note: Some("WHO safe surgery checklist / wrong-site prevention"),
    },
    CatalogIndicator {
        code: "SAFETY_TRANSFUSION_REACTIONS",
        label: "Blood transfusion reactions",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(0.0),
        denominator_label: Some("of units transfused"),
        note: Some("NABH 6th Ed KPI annexure organisation-wide KPI 8"),
    },
    CatalogIndicator {
        code: "NABH_KPI_09_ICU_SMR",
        label: "ICU standardized mortality ratio",
        category: "clinical",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("actual / predicted deaths"),
        note: Some("APACHE/SOFA/SAPS/MPM based expected deaths"),
    },
    CatalogIndicator {
        code: "NABH_KPI_10_RETURN_ICU_48H",
        label: "Return to ICU within 48 hours",
        category: "clinical",
        direction: "lower_better",
        unit: "percent",
        target: Some(2.0),
        denominator_label: Some("of ICU discharges/transfers"),
        note: Some("Excludes HDU"),
    },
    CatalogIndicator {
        code: "NABH_KPI_11_ER_RETURN_72H",
        label: "Return to emergency within 72 hours",
        category: "access",
        direction: "lower_better",
        unit: "percent",
        target: Some(3.0),
        denominator_label: Some("of emergency visits"),
        note: Some("Similar presenting complaints"),
    },
    CatalogIndicator {
        code: "SAFETY_PRESSURE_ULCER_HAI",
        label: "Hospital-acquired pressure ulcer rate",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(2.0),
        denominator_label: Some("of assessments"),
        note: Some("NABH 6th Ed KPI annexure organisation-wide KPI 12"),
    },
    CatalogIndicator {
        code: "NABH_KPI_13_CAUTI_RATE",
        label: "CAUTI rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("per 1000 urinary catheter-days"),
        note: Some("CDC/NHSN definition"),
    },
    CatalogIndicator {
        code: "NABH_KPI_14_VAP_RATE",
        label: "Ventilator-associated pneumonia rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("per 1000 ventilator-days"),
        note: Some("CDC/NHSN definition"),
    },
    CatalogIndicator {
        code: "NABH_KPI_15_CLABSI_RATE",
        label: "CLABSI rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("per 1000 central-line days"),
        note: Some("CDC/NHSN definition"),
    },
    CatalogIndicator {
        code: "NABH_KPI_16_SSI_RATE",
        label: "Surgical site infection rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("per 100 procedures"),
        note: Some("CDC/NHSN definition"),
    },
    CatalogIndicator {
        code: "NABH_KPI_17_HAND_HYGIENE",
        label: "Hand hygiene compliance",
        category: "safety",
        direction: "higher_better",
        unit: "percent",
        target: Some(90.0),
        denominator_label: Some("observed opportunities"),
        note: Some("WHO hand hygiene observation method"),
    },
    CatalogIndicator {
        code: "NABH_KPI_18_PROPHYLACTIC_ANTIBIOTIC",
        label: "Appropriate prophylactic antibiotic within timeframe",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(95.0),
        denominator_label: Some("of surgeries"),
        note: Some("Hospital antimicrobial policy"),
    },
    CatalogIndicator {
        code: "NABH_KPI_19_SURGERY_RESCHEDULE",
        label: "Surgery rescheduling rate",
        category: "operations",
        direction: "lower_better",
        unit: "percent",
        target: Some(5.0),
        denominator_label: Some("of planned surgeries"),
        note: Some("Cancellation/postponement beyond threshold"),
    },
    CatalogIndicator {
        code: "NABH_KPI_20_BLOOD_ISSUE_TAT",
        label: "Blood and component issue TAT",
        category: "clinical",
        direction: "lower_better",
        unit: "minutes",
        target: Some(30.0),
        denominator_label: Some("crossmatched/reserved units"),
        note: Some("Blood bank request to availability"),
    },
    CatalogIndicator {
        code: "NABH_KPI_21_NURSE_PATIENT_RATIO",
        label: "Nurse-patient ratio",
        category: "operations",
        direction: "higher_better",
        unit: "count",
        target: None,
        denominator_label: Some("per shift"),
        note: Some("Separate ICU/ward capture"),
    },
    CatalogIndicator {
        code: "ACCESS_OPD_WAIT",
        label: "Waiting time for outpatient consultation",
        category: "access",
        direction: "lower_better",
        unit: "minutes",
        target: Some(30.0),
        denominator_label: None,
        note: Some("NABH 6th Ed KPI annexure organisation-wide KPI 22"),
    },
    CatalogIndicator {
        code: "NABH_KPI_23_DIAGNOSTIC_WAIT",
        label: "Waiting time for diagnostics",
        category: "access",
        direction: "lower_better",
        unit: "minutes",
        target: Some(30.0),
        denominator_label: Some("outpatients"),
        note: Some("Laboratory and imaging waiting time"),
    },
    CatalogIndicator {
        code: "OPS_DISCHARGE_TAT",
        label: "Time taken for discharge",
        category: "operations",
        direction: "lower_better",
        unit: "minutes",
        target: Some(180.0),
        denominator_label: None,
        note: Some("NABH 6th Ed KPI annexure organisation-wide KPI 24"),
    },
    CatalogIndicator {
        code: "NABH_KPI_25_CONSENT_DEFECTS",
        label: "Incomplete or improper consent records",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(1.0),
        denominator_label: Some("of discharges and deaths"),
        note: Some("Consent audit"),
    },
    CatalogIndicator {
        code: "NABH_KPI_26_EMERGENCY_DRUG_STOCKOUT",
        label: "Emergency medication stock-outs",
        category: "operations",
        direction: "lower_better",
        unit: "count",
        target: Some(0.0),
        denominator_label: Some("monthly instances"),
        note: Some("Pharmacy/store/ward stock-out register"),
    },
    CatalogIndicator {
        code: "NABH_KPI_27_MOCK_DRILL_VARIATIONS",
        label: "Mock drill variations observed",
        category: "operations",
        direction: "lower_better",
        unit: "count",
        target: Some(0.0),
        denominator_label: Some("monthly variations"),
        note: Some("Fire/disaster/code-blue drill checklist"),
    },
    CatalogIndicator {
        code: "SAFETY_FALLS_RATE",
        label: "Patient fall rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(2.0),
        denominator_label: Some("per 1000 patient-days"),
        note: Some("NABH 6th Ed KPI annexure organisation-wide KPI 28"),
    },
    CatalogIndicator {
        code: "NABH_KPI_29_NEAR_MISSES",
        label: "Near misses as share of reported incidents",
        category: "safety",
        direction: "higher_better",
        unit: "percent",
        target: Some(20.0),
        denominator_label: Some("of incidents reported"),
        note: Some("Near-miss learning culture"),
    },
    CatalogIndicator {
        code: "NABH_KPI_30_NEEDLESTICK_RATE",
        label: "Needlestick injury rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(1.0),
        denominator_label: Some("per 1000 occupied beds"),
        note: Some("Cumulative monthly rate"),
    },
    CatalogIndicator {
        code: "NABH_KPI_31_SHIFT_HANDOVER",
        label: "Appropriate shift handovers",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(95.0),
        denominator_label: Some("handover opportunities"),
        note: Some("Doctor and nursing handover documentation"),
    },
    CatalogIndicator {
        code: "NABH_KPI_32_RATIONAL_PRESCRIPTION",
        label: "Safe and rational prescriptions",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(95.0),
        denominator_label: Some("prescription audit sample"),
        note: Some("OPD prescription audit"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_01_CHF_BETA_BLOCKER",
        label: "CHF reduced-EF beta-blocker at discharge",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(90.0),
        denominator_label: Some("eligible discharges"),
        note: Some("Cardiology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_02_AMI_DOOR_BALLOON",
        label: "AMI door-to-balloon within 90 minutes",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(90.0),
        denominator_label: Some("primary angioplasty cases"),
        note: Some("Cardiology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_03_HYPOGLYCEMIA_TARGET",
        label: "Hypoglycemia target achieved",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(95.0),
        denominator_label: Some("hypoglycemic events"),
        note: Some("Endocrinology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_04_PERINEAL_TEAR",
        label: "Spontaneous perineal tear rate",
        category: "clinical",
        direction: "lower_better",
        unit: "count",
        target: Some(5.0),
        denominator_label: Some("per 100 vaginal deliveries"),
        note: Some("Obstetrics KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_05_ENDOPHTHALMITIS",
        label: "Postoperative endophthalmitis rate",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(0.0),
        denominator_label: Some("per 100 ophthalmic surgeries"),
        note: Some("Ophthalmology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_06_COLONOSCOPY_SEDATION",
        label: "Colonoscopy cases with sedation",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(80.0),
        denominator_label: Some("colonoscopy patients"),
        note: Some("Gastroenterology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_07_BILE_DUCT_INJURY",
        label: "Lap chole bile-duct injury requiring intervention",
        category: "safety",
        direction: "lower_better",
        unit: "count",
        target: Some(0.0),
        denominator_label: Some("per 100 lap chole cases"),
        note: Some("Surgery KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_08_POCT_INTERVENTION",
        label: "POCT results leading to clinical intervention",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(90.0),
        denominator_label: Some("actionable POCT results"),
        note: Some("Biochemistry KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_09_REHAB_FUNCTIONAL_GAIN",
        label: "Functional gain following rehabilitation",
        category: "clinical",
        direction: "higher_better",
        unit: "count",
        target: Some(80.0),
        denominator_label: Some("per 100 neurorehab patients"),
        note: Some("Rehabilitation medicine KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_10_SEPSIS_HOUR1_BUNDLE",
        label: "Sepsis Hour-1 bundle compliance",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(90.0),
        denominator_label: Some("sepsis cases"),
        note: Some("Sepsis management KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_11_COPD_ACTION_PLAN",
        label: "COPD action plan at discharge",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(90.0),
        denominator_label: Some("COPD discharges"),
        note: Some("Respiratory medicine KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_12_STROKE_DTN",
        label: "Stroke door-to-needle within 60 minutes",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(80.0),
        denominator_label: Some("thrombolysis cases"),
        note: Some("Neurology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_13_BRONCHIOLITIS_INAPPROPRIATE",
        label: "Bronchiolitis inappropriate treatment rate",
        category: "clinical",
        direction: "lower_better",
        unit: "percent",
        target: Some(5.0),
        denominator_label: Some("bronchiolitis patients"),
        note: Some("Paediatrics KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_14_ONCOLOGY_TUMOR_BOARD",
        label: "Oncology treatment after tumor board",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(95.0),
        denominator_label: Some("new oncology cases"),
        note: Some("Oncology KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_15_RADIOPHARMA_ADR",
        label: "Radiopharmaceutical adverse reaction rate",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(0.0),
        denominator_label: Some("radiopharmaceutical administrations"),
        note: Some("Nuclear medicine KPI"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_16_CONTRAST_EXTRAVASATION",
        label: "IV contrast media extravasation",
        category: "safety",
        direction: "lower_better",
        unit: "percent",
        target: Some(1.0),
        denominator_label: Some("contrast administrations"),
        note: Some("Radiology KPI"),
    },
    CatalogIndicator {
        code: "ACCESS_ER_TRIAGE_TAT",
        label: "Emergency triage time",
        category: "access",
        direction: "lower_better",
        unit: "minutes",
        target: Some(10.0),
        denominator_label: None,
        note: Some("NABH 6th Ed KPI annexure department KPI 17"),
    },
    CatalogIndicator {
        code: "NABH_DEPT_18_DIALYSIS_HB_TARGET",
        label: "Dialysis patients achieving target hemoglobin",
        category: "clinical",
        direction: "higher_better",
        unit: "percent",
        target: Some(80.0),
        denominator_label: Some("dialysis patients"),
        note: Some("Nephrology KPI"),
    },
];

fn append_pending_catalog(indicators: &mut Vec<Indicator>) {
    for item in NABH_INDICATOR_CATALOG {
        if indicators
            .iter()
            .any(|indicator| indicator.code == item.code)
        {
            continue;
        }
        indicators.push(Indicator {
            code: item.code.to_owned(),
            label: item.label.to_owned(),
            category: item.category.to_owned(),
            direction: item.direction.to_owned(),
            unit: item.unit.to_owned(),
            target: item.target,
            value_current_month: None,
            value_prev_month: None,
            denominator_label: item.denominator_label.map(str::to_owned),
            note: item.note.map(str::to_owned),
        });
    }
}

/// GET /api/nabh/indicators — current-month rollup
pub async fn get_indicators(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<NabhRollupResponse>, AppError> {
    require_permission(&claims, permissions::quality::indicators::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let now = Utc::now();
    let period_label = format!("{:04}-{:02}", now.year(), now.month());

    let mut indicators: Vec<Indicator> = Vec::new();

    // ── Access / OPD waiting time (NABH 6) ─────────────────
    let opd_wait = scalar_minutes(
        &mut tx,
        "SELECT (EXTRACT(EPOCH FROM AVG(COALESCE(called_at, completed_at) - created_at))/60.0)::float8 \
         FROM opd_queues \
         WHERE tenant_id = $1 \
           AND COALESCE(called_at, completed_at) IS NOT NULL \
           AND COALESCE(called_at, completed_at) >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    let opd_wait_prev = scalar_minutes(
        &mut tx,
        "SELECT (EXTRACT(EPOCH FROM AVG(COALESCE(called_at, completed_at) - created_at))/60.0)::float8 \
         FROM opd_queues \
         WHERE tenant_id = $1 \
           AND COALESCE(called_at, completed_at) IS NOT NULL \
           AND COALESCE(called_at, completed_at) >= date_trunc('month', now() - interval '1 month') \
           AND COALESCE(called_at, completed_at) <  date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "ACCESS_OPD_WAIT".into(),
        label: "Average OPD waiting time".into(),
        category: "access".into(),
        direction: "lower_better".into(),
        unit: "minutes".into(),
        target: Some(30.0),
        value_current_month: opd_wait,
        value_prev_month: opd_wait_prev,
        denominator_label: None,
        note: None,
    });

    // ── Access / Appointment no-show rate ─────────────────
    let appointment_no_show_rate = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE status = 'no_show')::float8 \
                / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'no_show')), 0)::float8)::float8 \
         FROM appointments \
         WHERE tenant_id = $1 \
           AND appointment_date >= date_trunc('month', now())::date \
           AND appointment_date <= CURRENT_DATE",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "ACCESS_APPOINTMENT_NO_SHOW".into(),
        label: "Appointment no-show rate".into(),
        category: "access".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(5.0),
        value_current_month: appointment_no_show_rate,
        value_prev_month: None,
        denominator_label: Some("completed + marked no-show appointments".into()),
        note: Some(
            "Computed from appointment statuses; pending future appointments are excluded".into(),
        ),
    });

    // ── Access / Appointment cancellation rate ─────────────
    let appointment_cancel_rate = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE status = 'cancelled')::float8 \
                / NULLIF(COUNT(*), 0)::float8)::float8 \
         FROM appointments \
         WHERE tenant_id = $1 \
           AND appointment_date >= date_trunc('month', now())::date \
           AND appointment_date < (date_trunc('month', now()) + interval '1 month')::date",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "ACCESS_APPOINTMENT_CANCEL_RATE".into(),
        label: "Appointment cancellation rate".into(),
        category: "access".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(10.0),
        value_current_month: appointment_cancel_rate,
        value_prev_month: None,
        denominator_label: Some("of booked appointments in the month".into()),
        note: Some("Computed from appointment cancellation status".into()),
    });

    // ── Access / OPD queue no-show rate ────────────────────
    let opd_no_show_rate = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE status = 'no_show')::float8 \
                / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'no_show')), 0)::float8)::float8 \
         FROM opd_queues \
         WHERE tenant_id = $1 \
           AND queue_date >= date_trunc('month', now())::date \
           AND queue_date <= CURRENT_DATE",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "ACCESS_OPD_TOKEN_NO_SHOW".into(),
        label: "OPD token no-show rate".into(),
        category: "access".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(5.0),
        value_current_month: opd_no_show_rate,
        value_prev_month: None,
        denominator_label: Some("completed + marked no-show OPD tokens".into()),
        note: Some("Computed from live OPD queue statuses".into()),
    });

    // ── Access / Appointment check-in delay ────────────────
    let appointment_checkin_delay = scalar_minutes(
        &mut tx,
        "SELECT (EXTRACT(EPOCH FROM AVG( \
             checked_in_at - (appointment_date + slot_start) \
         )) / 60.0)::float8 \
         FROM appointments \
         WHERE tenant_id = $1 \
           AND checked_in_at IS NOT NULL \
           AND appointment_date >= date_trunc('month', now())::date \
           AND appointment_date < (date_trunc('month', now()) + interval '1 month')::date",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "ACCESS_APPOINTMENT_CHECKIN_DELAY".into(),
        label: "Appointment check-in delay".into(),
        category: "access".into(),
        direction: "lower_better".into(),
        unit: "minutes".into(),
        target: Some(15.0),
        value_current_month: appointment_checkin_delay,
        value_prev_month: None,
        denominator_label: Some("checked-in appointments".into()),
        note: Some("Average delay from scheduled slot start to check-in".into()),
    });

    // ── Access / ER triage TAT (NABH 3) ────────────────────
    let er_triage = scalar_minutes(
        &mut tx,
        "SELECT AVG(door_to_doctor_mins)::float8 \
         FROM er_visits \
         WHERE tenant_id = $1 \
           AND door_to_doctor_mins IS NOT NULL \
           AND arrival_time >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "ACCESS_ER_TRIAGE_TAT".into(),
        label: "Emergency triage TAT".into(),
        category: "access".into(),
        direction: "lower_better".into(),
        unit: "minutes".into(),
        target: Some(10.0),
        value_current_month: er_triage,
        value_prev_month: None,
        denominator_label: None,
        note: Some("From arrival to first triage assessment".into()),
    });

    // ── Operations / Average LOS (NABH 7) ──────────────────
    let alos = scalar_f64(
        &mut tx,
        "SELECT AVG(EXTRACT(EPOCH FROM (discharged_at - admitted_at)) / 86400.0)::float8 \
         FROM admissions \
         WHERE tenant_id = $1 AND discharged_at IS NOT NULL \
           AND discharged_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "OPS_ALOS".into(),
        label: "Average length of stay".into(),
        category: "operations".into(),
        direction: "lower_better".into(),
        unit: "days".into(),
        target: Some(4.0),
        value_current_month: alos,
        value_prev_month: None,
        denominator_label: None,
        note: None,
    });

    // ── Operations / Bed occupancy % ───────────────────────
    let occupancy = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE is_occupied)::float8 \
                / NULLIF(COUNT(*), 0)::float8)::float8 \
         FROM beds WHERE tenant_id = $1",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "OPS_BED_OCCUPANCY".into(),
        label: "Bed occupancy".into(),
        category: "operations".into(),
        direction: "higher_better".into(),
        unit: "percent".into(),
        target: Some(75.0),
        value_current_month: occupancy,
        value_prev_month: None,
        denominator_label: None,
        note: Some("Optimal: 75-85%".into()),
    });

    // ── Clinical / Lab TAT (NABH 8) ────────────────────────
    let lab_tat = scalar_minutes(
        &mut tx,
        "SELECT (EXTRACT(EPOCH FROM AVG(completed_at - created_at))/60.0)::float8 \
         FROM lab_orders \
         WHERE tenant_id = $1 AND completed_at IS NOT NULL \
           AND completed_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "CLIN_LAB_TAT".into(),
        label: "Lab report turnaround".into(),
        category: "clinical".into(),
        direction: "lower_better".into(),
        unit: "minutes".into(),
        target: Some(120.0),
        value_current_month: lab_tat,
        value_prev_month: None,
        denominator_label: None,
        note: Some("Routine investigations".into()),
    });

    // ── Clinical / Imaging TAT (NABH 11) ───────────────────
    let img_tat = scalar_minutes(
        &mut tx,
        "SELECT (EXTRACT(EPOCH FROM AVG( \
             COALESCE(rr.verified_at, rr.created_at, ro.completed_at) - ro.created_at \
         ))/60.0)::float8 \
         FROM radiology_orders ro \
         LEFT JOIN LATERAL ( \
             SELECT r.verified_at, r.created_at \
             FROM radiology_reports r \
             WHERE r.tenant_id = ro.tenant_id AND r.order_id = ro.id \
             ORDER BY COALESCE(r.verified_at, r.created_at) DESC \
             LIMIT 1 \
         ) rr ON true \
         WHERE ro.tenant_id = $1 \
           AND COALESCE(rr.verified_at, rr.created_at, ro.completed_at) IS NOT NULL \
           AND COALESCE(rr.verified_at, rr.created_at, ro.completed_at) >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "CLIN_IMAGING_TAT".into(),
        label: "Imaging report turnaround".into(),
        category: "clinical".into(),
        direction: "lower_better".into(),
        unit: "minutes".into(),
        target: Some(240.0),
        value_current_month: img_tat,
        value_prev_month: None,
        denominator_label: None,
        note: None,
    });

    // ── Safety / Inpatient mortality rate (NABH 50) ────────
    let mortality_pct = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE discharge_type::text IN ('deceased', 'death'))::float8 \
                / NULLIF(COUNT(*), 0)::float8)::float8 \
         FROM admissions \
         WHERE tenant_id = $1 AND discharged_at IS NOT NULL \
           AND discharged_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "SAFETY_MORTALITY".into(),
        label: "Inpatient mortality rate".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(2.0),
        value_current_month: mortality_pct,
        value_prev_month: None,
        denominator_label: Some("of monthly discharges".into()),
        note: None,
    });

    // ── Safety / 30-day readmission rate (NABH 52) ─────────
    let readmit = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE readmitted_within_30d)::float8 \
                / NULLIF(COUNT(*), 0)::float8)::float8 \
         FROM ipd_post_discharge_followups \
         WHERE tenant_id = $1 \
           AND created_at >= date_trunc('month', now() - interval '1 month') \
           AND created_at <  date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "SAFETY_READMISSION_30D".into(),
        label: "30-day readmission rate".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(8.0),
        value_current_month: readmit,
        value_prev_month: None,
        denominator_label: Some("of prior-month discharges".into()),
        note: Some("Computed from post-discharge follow-up table".into()),
    });

    // ── Operations / Discharge TAT (NABH 65) ───────────────
    let discharge_tat = scalar_minutes(
        &mut tx,
        "SELECT AVG(total_minutes)::float8 \
         FROM ipd_discharge_tat_logs \
         WHERE tenant_id = $1 AND total_minutes IS NOT NULL \
           AND patient_released_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "OPS_DISCHARGE_TAT".into(),
        label: "Discharge turnaround".into(),
        category: "operations".into(),
        direction: "lower_better".into(),
        unit: "minutes".into(),
        target: Some(180.0),
        value_current_month: discharge_tat,
        value_prev_month: None,
        denominator_label: None,
        note: Some("Discharge order to patient release".into()),
    });

    // ── Experience / Patient survey score (NABH 67) ───────
    let survey_avg = scalar_f64(
        &mut tx,
        "SELECT AVG(survey_score)::float8 \
         FROM ipd_post_discharge_followups \
         WHERE tenant_id = $1 AND survey_score IS NOT NULL \
           AND survey_responded_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "EXP_PATIENT_SURVEY".into(),
        label: "Patient experience score".into(),
        category: "experience".into(),
        direction: "higher_better".into(),
        unit: "count".into(),
        target: Some(8.5),
        value_current_month: survey_avg,
        value_prev_month: None,
        denominator_label: Some("scale 0-10 (NPS-like)".into()),
        note: None,
    });

    // ── Safety / Cancelled Rx (medication-error proxy) ─────
    let cancelled_rx = scalar_f64(
        &mut tx,
        "SELECT (100.0 * COUNT(*) FILTER (WHERE status = 'cancelled')::float8 \
                / NULLIF(COUNT(*), 0)::float8)::float8 \
         FROM pharmacy_orders \
         WHERE tenant_id = $1 \
           AND created_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "SAFETY_RX_CANCELLED".into(),
        label: "Cancelled Rx orders".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(5.0),
        value_current_month: cancelled_rx,
        value_prev_month: None,
        denominator_label: Some("of monthly orders".into()),
        note: Some(
            "Proxy for medication-error rate; refine when MAR error capture is wired".into(),
        ),
    });

    // ══════════════════════════════════════════════════════
    //  NABH Phase 2 captures (migration 0110) — counts go
    //  live as soon as data starts flowing in.
    // ══════════════════════════════════════════════════════

    // ── COP-12 / IPSG-6: Falls per 1000 patient-days ──
    let falls_count = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_falls_register \
         WHERE tenant_id = $1 \
           AND fall_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let patient_days = scalar_f64(
        &mut tx,
        "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ( \
             LEAST(COALESCE(discharged_at, now()), now()) \
             - GREATEST(admitted_at, date_trunc('month', now())) \
         )) / 86400.0), 0)::float8 \
         FROM admissions \
         WHERE tenant_id = $1 \
           AND admitted_at < now() \
           AND (discharged_at IS NULL OR discharged_at >= date_trunc('month', now()))",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let falls_rate = if patient_days > 0.0 {
        Some((falls_count * 1000.0 / patient_days * 10.0).round() / 10.0)
    } else if falls_count > 0.0 {
        Some(falls_count)
    } else {
        None
    };
    indicators.push(Indicator {
        code: "SAFETY_FALLS_RATE".into(),
        label: "Patient fall rate".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "count".into(),
        target: Some(2.0),
        value_current_month: falls_rate,
        value_prev_month: None,
        denominator_label: Some("per 1000 patient-days".into()),
        note: None,
    });

    // ── COP-11: Hospital-acquired pressure ulcer rate ──
    let pu_assessed = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_pressure_ulcer_assessments \
         WHERE tenant_id = $1 AND assessed_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let pu_hai = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_pressure_ulcer_assessments \
         WHERE tenant_id = $1 AND assessed_at >= date_trunc('month', now()) \
           AND injury_present = true AND injury_acquired = 'hospital_acquired'",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let pu_rate = if pu_assessed > 0.0 {
        Some((pu_hai / pu_assessed * 100.0 * 10.0).round() / 10.0)
    } else {
        None
    };
    indicators.push(Indicator {
        code: "SAFETY_PRESSURE_ULCER_HAI".into(),
        label: "Hospital-acquired pressure ulcer rate".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "percent".into(),
        target: Some(2.0),
        value_current_month: pu_rate,
        value_prev_month: None,
        denominator_label: Some("of assessments this month".into()),
        note: None,
    });

    // ── PSQ-3 / PSQ-6: Sentinel events — open count ──
    let sentinel_open = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_sentinel_event_register \
         WHERE tenant_id = $1 AND review_status <> 'closed'",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "SAFETY_SENTINEL_OPEN".into(),
        label: "Open sentinel events".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "count".into(),
        target: Some(0.0),
        value_current_month: sentinel_open,
        value_prev_month: None,
        denominator_label: Some("not yet closed".into()),
        note: None,
    });

    // ── MOM-7 / IPSG-3: Transfusion reactions per 100 transfusions ──
    let btr_count = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_blood_transfusion_reactions \
         WHERE tenant_id = $1 AND reaction_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let btr_value = if btr_count > 0.0 {
        Some(btr_count)
    } else {
        None
    };
    indicators.push(Indicator {
        code: "SAFETY_TRANSFUSION_REACTIONS".into(),
        label: "Blood transfusion reactions".into(),
        category: "safety".into(),
        direction: "lower_better".into(),
        unit: "count".into(),
        target: Some(0.0),
        value_current_month: btr_value,
        value_prev_month: None,
        denominator_label: Some("this month".into()),
        note: Some("Hemovigilance Programme of India reportable".into()),
    });

    // ── AOP-9: Code Blue activations + survival rate ──
    let cb_count = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_code_blue_activations \
         WHERE tenant_id = $1 AND activated_at >= date_trunc('month', now())",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let cb_survived = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_code_blue_activations \
         WHERE tenant_id = $1 AND activated_at >= date_trunc('month', now()) \
           AND outcome IN ('survived_intact', 'survived_with_disability', 'transferred_icu')",
        claims.tenant_id,
    )
    .await
    .unwrap_or(0.0);
    let cb_survival_rate = if cb_count > 0.0 {
        Some((cb_survived / cb_count * 100.0 * 10.0).round() / 10.0)
    } else {
        None
    };
    indicators.push(Indicator {
        code: "CLINICAL_CODE_BLUE_SURVIVAL".into(),
        label: "Code Blue survival rate".into(),
        category: "clinical".into(),
        direction: "higher_better".into(),
        unit: "percent".into(),
        target: Some(35.0),
        value_current_month: cb_survival_rate,
        value_prev_month: None,
        denominator_label: Some("of monthly activations".into()),
        note: None,
    });

    // ── HIC-7 / FMS: Equipment downtime — open count ──
    let downtime_open = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_equipment_downtime_log \
         WHERE tenant_id = $1 AND downtime_end IS NULL",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "OPS_EQUIPMENT_DOWN".into(),
        label: "Equipment currently down".into(),
        category: "operations".into(),
        direction: "lower_better".into(),
        unit: "count".into(),
        target: Some(0.0),
        value_current_month: downtime_open,
        value_prev_month: None,
        denominator_label: Some("right now".into()),
        note: None,
    });

    // ── FMS-2: Days since last fire drill ──
    let days_since_drill = scalar_f64(
        &mut tx,
        "SELECT COALESCE(EXTRACT(EPOCH FROM (now() - MAX(drill_at))) / 86400.0, NULL)::float8 \
         FROM nabh_fire_safety_drills \
         WHERE tenant_id = $1",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "FMS_FIRE_DRILL_INTERVAL".into(),
        label: "Days since last fire drill".into(),
        category: "operations".into(),
        direction: "lower_better".into(),
        unit: "days".into(),
        target: Some(180.0),
        value_current_month: days_since_drill,
        value_prev_month: None,
        denominator_label: Some("(target: ≤180 days)".into()),
        note: None,
    });

    // ── FMS-4 / BMW Rules 2016: 48-hour storage breach count ──
    let bmw_breaches = scalar_f64(
        &mut tx,
        "SELECT COUNT(*)::float8 FROM nabh_bmw_disposal_log \
         WHERE tenant_id = $1 \
           AND disposal_date >= date_trunc('month', now())::date \
           AND storage_hours > 48",
        claims.tenant_id,
    )
    .await;
    indicators.push(Indicator {
        code: "FMS_BMW_BREACH".into(),
        label: "BMW 48-hour storage breaches".into(),
        category: "operations".into(),
        direction: "lower_better".into(),
        unit: "count".into(),
        target: Some(0.0),
        value_current_month: bmw_breaches,
        value_prev_month: None,
        denominator_label: Some("this month".into()),
        note: Some("BMW Rules 2016 Schedule III".into()),
    });

    tx.commit().await?;

    let computed = indicators
        .iter()
        .filter(|i| i.value_current_month.is_some())
        .count() as u32;
    append_pending_catalog(&mut indicators);
    let total = indicators.len() as u32;
    let pending = total.saturating_sub(computed);

    let coverage = Coverage {
        total_indicators: total,
        computed,
        pending_data_capture: pending,
        note: format!(
            "{} live, {} pending. Baseline catalog is the NABH 6th Edition 2025 KPI annexure; \
             additional MedBrains evidence indicators appear when source data is wired. \
             Source PDF is stored in \
             RFCs/references/NABH-Hospital-Accreditation-Standard-6th-Edition-January-2025.pdf.",
            computed, pending
        ),
    };

    Ok(Json(NabhRollupResponse {
        generated_at: now,
        period_label,
        indicators,
        coverage,
    }))
}

async fn scalar_f64(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    sql: &str,
    tenant_id: uuid::Uuid,
) -> Option<f64> {
    match sqlx::query_scalar::<_, Option<f64>>(sql)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await
    {
        Ok(value) => value.flatten(),
        Err(error) => {
            tracing::warn!(%error, query = sql, "NABH indicator query failed");
            None
        }
    }
}

async fn scalar_minutes(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    sql: &str,
    tenant_id: uuid::Uuid,
) -> Option<f64> {
    scalar_f64(tx, sql, tenant_id)
        .await
        .map(|v| (v * 10.0).round() / 10.0)
}

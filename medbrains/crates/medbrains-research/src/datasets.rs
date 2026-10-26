//! The datasets a study may ask for, and how each is read.
//!
//! Every read takes only what [`super::deid`] needs: the patient's id (to
//! key and count, never released), birth date, sex and pincode, the event's
//! date, the dataset's coded fields, and one hidden text (a diagnosis, test
//! or drug name) that is checked for a restricted class but never released.
//! No name, contact, identifier or free text is selected, so none can leak
//! through a later change to the release.

use chrono::NaiveDate;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::deid::{Field, Kind, RawRow};

/// Rows read at most; a larger extract must narrow its period.
pub const MAX_ROWS: usize = 100_000;

const fn quasi(name: &'static str, description: &'static str) -> Field {
    Field {
        name,
        kind: Kind::Category,
        description,
        quasi: true,
    }
}

const fn band(
    name: &'static str,
    cuts: &'static [(f64, &'static str)],
    description: &'static str,
) -> Field {
    Field {
        name,
        kind: Kind::Band(cuts),
        description,
        quasi: false,
    }
}

const fn number(name: &'static str, description: &'static str) -> Field {
    Field {
        name,
        kind: Kind::Number,
        description,
        quasi: false,
    }
}

const fn cat(name: &'static str, description: &'static str) -> Field {
    Field::category(name, description)
}

const DEPARTMENT: Field = quasi(
    "department",
    "Department (a quasi-identifier: counted in k-anonymity)",
);

const VISITS: &[Field] = &[
    cat("encounter_type", "OPD, IPD, emergency or home health"),
    cat("visit_type", "New, follow-up and similar, as recorded"),
    DEPARTMENT,
];
const DIAGNOSES: &[Field] = &[
    cat(
        "icd10_code",
        "ICD-10 code, when the diagnosis was coded in ICD-10",
    ),
    cat(
        "icd11_code",
        "ICD-11 code, when the diagnosis was coded in ICD-11",
    ),
    cat("is_primary", "true when it was the primary diagnosis"),
    cat("encounter_type", "Setting of the encounter"),
    DEPARTMENT,
];
const ADMISSIONS: &[Field] = &[
    DEPARTMENT,
    cat("admission_source", "Where the patient came from"),
    cat("ip_type", "Inpatient category"),
    cat(
        "discharge_type",
        "How the stay ended (blank while admitted)",
    ),
    number(
        "length_of_stay_days",
        "Whole days from admission to discharge (blank while admitted)",
    ),
];
const LABS: &[Field] = &[
    cat("loinc_code", "LOINC code of the test, as catalogued"),
    cat("test", "Test name, as catalogued"),
    cat("parameter", "Result parameter"),
    number(
        "value",
        "Numeric result (blank when the result is not a number)",
    ),
    cat("unit", "Unit of the value"),
    cat("flag", "Normal, low, high or critical, as flagged"),
    DEPARTMENT,
];
/// Days of treatment, banded.
const DURATION: &[(f64, &str)] = &[
    (8.0, "1-7"),
    (31.0, "8-30"),
    (91.0, "31-90"),
    (f64::INFINITY, "91+"),
];
const MEDICINES: &[Field] = &[
    cat(
        "inn",
        "International non-proprietary name (WHO INN), or generic name",
    ),
    cat("atc_code", "WHO ATC code"),
    cat("route", "Route, as prescribed (blank when not recorded)"),
    band(
        "duration_days_band",
        DURATION,
        "Prescribed duration in days: 1-7, 8-30, 31-90, 91+",
    ),
    number("quantity", "Units dispensed"),
    cat("setting", "Dispensing setting (OPD, IPD, discharge, ...)"),
];
const SYSTOLIC: &[(f64, &str)] = &[
    (90.0, "<90"),
    (120.0, "90-119"),
    (140.0, "120-139"),
    (160.0, "140-159"),
    (f64::INFINITY, "160+"),
];
const DIASTOLIC: &[(f64, &str)] = &[
    (60.0, "<60"),
    (80.0, "60-79"),
    (90.0, "80-89"),
    (100.0, "90-99"),
    (f64::INFINITY, "100+"),
];
const PULSE: &[(f64, &str)] = &[
    (60.0, "<60"),
    (101.0, "60-100"),
    (121.0, "101-120"),
    (f64::INFINITY, "121+"),
];
const TEMPERATURE_C: &[(f64, &str)] = &[
    (36.0, "<36.0"),
    (37.5, "36.0-37.4"),
    (38.0, "37.5-37.9"),
    (39.0, "38.0-38.9"),
    (f64::INFINITY, "39.0+"),
];
const SPO2: &[(f64, &str)] = &[(90.0, "<90"), (95.0, "90-94"), (f64::INFINITY, "95+")];
const RESPIRATORY: &[(f64, &str)] = &[
    (12.0, "<12"),
    (21.0, "12-20"),
    (25.0, "21-24"),
    (f64::INFINITY, "25+"),
];
const BMI: &[(f64, &str)] = &[
    (18.5, "<18.5"),
    (23.0, "18.5-22.9"),
    (25.0, "23.0-24.9"),
    (30.0, "25.0-29.9"),
    (f64::INFINITY, "30+"),
];
const VITALS: &[Field] = &[
    band("systolic_bp_band", SYSTOLIC, "Systolic BP, mmHg, banded"),
    band("diastolic_bp_band", DIASTOLIC, "Diastolic BP, mmHg, banded"),
    band("pulse_band", PULSE, "Pulse, per minute, banded"),
    band(
        "temperature_c_band",
        TEMPERATURE_C,
        "Temperature, °C (°F converted), banded",
    ),
    band("spo2_band", SPO2, "SpO2, %, banded"),
    band(
        "respiratory_rate_band",
        RESPIRATORY,
        "Respiratory rate, per minute, banded",
    ),
    Field {
        name: "bmi_band",
        kind: Kind::Band(BMI),
        description: "BMI, kg/m², Asian cut-offs (a quasi-identifier: counted in k-anonymity)",
        quasi: true,
    },
];

/// The patient columns every dataset reads, joined as `p`.
const PATIENT: &str = "p.id, p.date_of_birth, p.gender::text, \
    COALESCE((SELECT pa.postal_code FROM patient_addresses pa \
              WHERE pa.patient_id = p.id AND pa.deleted_at IS NULL \
              ORDER BY pa.is_primary DESC NULLS LAST LIMIT 1), p.address->>'pincode')";

/// The datasets a study may ask for.
pub const NAMES: &[&str] = &[
    "visits",
    "diagnoses",
    "admissions",
    "labs",
    "medicines",
    "vitals",
];

/// A dataset's fields, or `None` for a name no study may ask for.
#[must_use]
pub fn fields(dataset: &str) -> Option<&'static [Field]> {
    match dataset {
        "visits" => Some(VISITS),
        "diagnoses" => Some(DIAGNOSES),
        "admissions" => Some(ADMISSIONS),
        "labs" => Some(LABS),
        "medicines" => Some(MEDICINES),
        "vitals" => Some(VITALS),
        _ => None,
    }
}

/// Columns after the patient's: the event date, the fields in order, then
/// the hidden text (or NULL).
fn sql(dataset: &str) -> Option<String> {
    let body = match dataset {
        "visits" => {
            "e.encounter_date, e.encounter_type::text, e.visit_type, dep.name, NULL::text \
            FROM encounters e JOIN patients p ON p.id = e.patient_id \
            LEFT JOIN departments dep ON dep.id = e.department_id \
            WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND NOT COALESCE(e.is_dummy, false) \
              AND e.encounter_date BETWEEN $2 AND $3"
        }
        "diagnoses" => {
            "e.encounter_date, \
              CASE WHEN d.icd_system ILIKE '%11%' THEN NULL ELSE d.icd_code END, \
              CASE WHEN d.icd_system ILIKE '%11%' THEN d.icd_code END, \
              d.is_primary::text, e.encounter_type::text, dep.name, \
              COALESCE(d.icd_display, d.description) \
            FROM diagnoses d JOIN encounters e ON e.id = d.encounter_id \
            JOIN patients p ON p.id = e.patient_id \
            LEFT JOIN departments dep ON dep.id = e.department_id \
            WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
              AND NOT COALESCE(e.is_dummy, false) AND e.encounter_date BETWEEN $2 AND $3"
        }
        "admissions" => {
            "a.admitted_at::date, dep.name, a.admission_source::text, a.ip_type::text, \
              a.discharge_type::text, (a.discharged_at::date - a.admitted_at::date)::text, \
              a.provisional_diagnosis \
            FROM admissions a JOIN patients p ON p.id = a.patient_id \
            LEFT JOIN departments dep ON dep.id = a.department_id \
            WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND NOT COALESCE(a.is_dummy, false) \
              AND a.mlc_case_id IS NULL AND a.admitted_at::date BETWEEN $2 AND $3"
        }
        "labs" => {
            "COALESCE(o.order_date, o.created_at)::date, t.loinc_code, t.name, r.parameter_name, \
              r.numeric_value::text, r.unit, r.flag::text, dep.name, \
              concat_ws(' ', t.name, r.parameter_name, r.result_value) \
            FROM lab_results r JOIN lab_orders o ON o.id = r.order_id \
            JOIN patients p ON p.id = o.patient_id \
            LEFT JOIN lab_test_catalog t ON t.id = o.test_id \
            LEFT JOIN departments dep ON dep.id = o.department_id \
            WHERE r.tenant_id = $1 AND r.deleted_at IS NULL \
              AND COALESCE(o.order_date, o.created_at)::date BETWEEN $2 AND $3"
        }
        "medicines" => {
            "COALESCE(o.dispensed_at, o.created_at)::date, \
              COALESCE(c.inn_name, c.generic_name), c.atc_code, rx.route, \
              (COALESCE(rx.end_date - o.created_at::date, \
                 substring(rx.duration from '(\\d+)')::int * \
                   CASE WHEN rx.duration ~* 'month' THEN 30 WHEN rx.duration ~* 'week' THEN 7 ELSE 1 END))::text, \
              COALESCE(i.quantity_dispensed, i.quantity)::text, o.dispensing_type::text, \
              concat_ws(' ', i.drug_name, c.generic_name, c.inn_name) \
            FROM pharmacy_order_items i JOIN pharmacy_orders o ON o.id = i.order_id \
            JOIN patients p ON p.id = o.patient_id \
            LEFT JOIN pharmacy_catalog c ON c.id = i.catalog_item_id \
            LEFT JOIN LATERAL (SELECT pi.route, pi.duration, pi.end_date FROM prescription_items pi \
                WHERE pi.prescription_id = o.prescription_id AND pi.deleted_at IS NULL \
                  AND (pi.catalog_item_id = i.catalog_item_id OR pi.drug_name = i.drug_name) \
                LIMIT 1) rx ON true \
            WHERE i.tenant_id = $1 AND i.deleted_at IS NULL AND o.deleted_at IS NULL \
              AND NOT COALESCE(o.is_dummy, false) AND i.removed_at IS NULL \
              AND COALESCE(o.dispensed_at, o.created_at)::date BETWEEN $2 AND $3"
        }
        "vitals" => {
            "v.recorded_at::date, COALESCE(v.systolic_bp, v.bp_systolic)::text, \
              COALESCE(v.diastolic_bp, v.bp_diastolic)::text, COALESCE(v.pulse, v.pulse_rate)::text, \
              (CASE WHEN v.temperature > 45 THEN (v.temperature - 32) * 5 / 9 ELSE v.temperature END)::text, \
              v.spo2::text, v.respiratory_rate::text, \
              COALESCE(v.bmi, v.weight_kg / NULLIF((v.height_cm / 100) ^ 2, 0))::text, NULL::text \
            FROM vitals v JOIN patients p ON p.id = v.patient_id \
            WHERE v.tenant_id = $1 AND v.deleted_at IS NULL AND v.recorded_at::date BETWEEN $2 AND $3"
        }
        _ => return None,
    };
    Some(format!(
        "SELECT {PATIENT}, {body} AND p.deleted_at IS NULL ORDER BY 1 LIMIT {}",
        MAX_ROWS + 1
    ))
}

/// The data dictionary: what each column means, the export's terms, and the
/// suppression report.
pub(crate) fn dictionary(row: &super::ExportRow, fields: &[Field], report: &Value) -> String {
    let mut lines: Vec<Vec<String>> = vec![
        vec![
            "export_ref".into(),
            "Reference of this export, on every row (a watermark)".into(),
        ],
        vec![
            "patient_key".into(),
            "Pseudonymous patient key, valid within this export only".into(),
        ],
        vec![
            "age_band".into(),
            "Age at the event in 5-year bands; 90+ grouped".into(),
        ],
        vec!["sex".into(), "Sex as recorded".into()],
        vec![
            "pincode_prefix".into(),
            "First three digits of the patient's pincode".into(),
        ],
        vec![
            "month".into(),
            "Month of the event (YYYY-MM); exact dates are not released".into(),
        ],
    ];
    lines.extend(
        fields
            .iter()
            .map(|f| vec![f.name.to_owned(), f.description.to_owned()]),
    );
    lines.push(vec!["terms".into(), format!(
        "Export {} of {} ({} to {}), IEC {}. De-identified for this study only: do not attempt to \
         re-identify anyone, do not link with other data, delete when the study ends.",
        row.id, row.dataset, row.period_from, row.period_to, row.iec_reference
    )]);
    lines.push(vec!["suppression_report".into(), report.to_string()]);
    super::deid::to_csv(&["column".into(), "meaning".into()], &lines)
}

/// Why an extract could not be read.
#[derive(Debug, thiserror::Error)]
pub enum ReadError {
    #[error("unknown dataset")]
    Unknown,
    #[error("more than {MAX_ROWS} rows — narrow the period")]
    TooMany,
    #[error("the export could not be written")]
    Unwritable,
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

/// The dataset's raw rows over `[from, to]` at the transaction's hospital.
///
/// # Errors
/// An unknown dataset, too many rows, or a database error.
pub async fn read(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    dataset: &str,
    (from, to): (NaiveDate, NaiveDate),
) -> Result<Vec<RawRow>, ReadError> {
    let n = fields(dataset).ok_or(ReadError::Unknown)?.len();
    let sql = sql(dataset).ok_or(ReadError::Unknown)?;
    let rows = sqlx::query(&sql)
        .bind(tenant)
        .bind(from)
        .bind(to)
        .fetch_all(&mut **tx)
        .await?;
    if rows.len() > MAX_ROWS {
        return Err(ReadError::TooMany);
    }
    rows.iter()
        .map(|r| {
            use sqlx::Row as _;
            Ok(RawRow {
                patient: r.try_get(0)?,
                birth: r.try_get(1)?,
                sex: r.try_get(2)?,
                pincode: r.try_get(3)?,
                on: r.try_get(4)?,
                values: (5..5 + n)
                    .map(|i| r.try_get::<Option<String>, _>(i))
                    .collect::<Result<_, _>>()?,
                hidden: r.try_get(5 + n)?,
            })
        })
        .collect::<Result<_, sqlx::Error>>()
        .map_err(ReadError::Db)
}

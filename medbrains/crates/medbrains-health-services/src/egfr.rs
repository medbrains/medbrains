//! Which lab result is "the patient's eGFR", for every check that doses or
//! screens from kidney function.
//!
//! It must be an eGFR (per 1.73 m² of body surface) and recent: within the
//! hospital's window for an inpatient or an outpatient
//! ([`KidneySettings`], default 7 and 30 days). A creatinine clearance in
//! mL/min, or an older value, is not one; with no qualifying result the
//! caller reports "not checked", never "normal".

use chrono::{DateTime, Duration, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::kidney_settings::KidneySettings;

/// LOINC codes for an estimated GFR per 1.73 m², any equation.
///
/// Source: the LOINC long common names, as served by the NLM Clinical Tables
/// LOINC API (`clinicaltables.nlm.nih.gov/api/loinc_items/v3`), read 2026-11-25. All are
/// "Glomerular filtration rate [Volume Rate/Area] ... /1.73 sq M".
/// Creatinine clearance (e.g. 33558-8) is deliberately absent.
const EGFR_LOINC: &[&str] = &[
    "98979-8", // CKD-EPI 2021, creatinine
    "62238-1", // CKD-EPI, creatinine
    "88293-6", // CKD-EPI, creatinine, black population
    "88294-4", // CKD-EPI, creatinine, non-black population
    "94677-2", // CKD-EPI, creatinine and cystatin C
    "50210-4", // cystatin C
    "33914-3", // MDRD, serum or plasma
    "77147-7", // MDRD
    "48642-3", // MDRD, non-black population
    "48643-1", // MDRD, black population
    "50044-7", // MDRD, female population
    "69405-9", // based on 1.73 sq M, equation unstated
];

/// An eGFR the renal check may dose from, with when it was measured.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EgfrReading {
    pub value: f64,
    pub measured_at: DateTime<Utc>,
}

/// The patient's eGFR, if one qualifies, and the rules it was chosen by.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EgfrLookup {
    pub reading: Option<EgfrReading>,
    /// How old a result could be for this patient, for "none in the last N days".
    pub window_days: i64,
    /// Whether the patient is admitted (the inpatient window applied).
    pub inpatient: bool,
    pub settings: KidneySettings,
}

/// One verified numeric result that may be an eGFR.
#[derive(Debug, sqlx::FromRow)]
struct EgfrCandidate {
    pub value: f64,
    pub unit: Option<String>,
    pub parameter_name: String,
    pub test_loinc: Option<String>,
    pub measured_at: DateTime<Utc>,
}

/// True for a unit per 1.73 m² ("mL/min/1.73m2", "mL/min/1.73 m²").
fn per_body_surface(unit: &str) -> bool {
    let compact: String = unit
        .chars()
        .filter(|c| !c.is_whitespace())
        .map(|c| if c == '²' { '2' } else { c })
        .collect::<String>()
        .to_lowercase();
    compact.starts_with("ml/min/1.73")
}

/// True when the result is an eGFR: its test carries an eGFR LOINC code, or
/// the analyte is named as one; a clearance never is.
fn names_egfr(c: &EgfrCandidate) -> bool {
    let name = c.parameter_name.to_lowercase();
    let coded = c
        .test_loinc
        .as_deref()
        .is_some_and(|l| EGFR_LOINC.contains(&l));
    let named = name.contains("gfr") || name.contains("glomerular");
    (coded || named) && !name.contains("clearance")
}

/// The newest candidate that is an eGFR, per 1.73 m², positive, measured in
/// the last `window_days` before `now`.
fn latest_egfr(
    candidates: &[EgfrCandidate],
    now: DateTime<Utc>,
    window_days: i64,
) -> Option<EgfrReading> {
    let oldest = now - Duration::days(window_days);
    candidates
        .iter()
        .filter(|c| names_egfr(c) && c.unit.as_deref().is_some_and(per_body_surface))
        .filter(|c| c.value > 0.0 && c.measured_at >= oldest && c.measured_at <= now)
        .max_by_key(|c| c.measured_at)
        .map(|c| EgfrReading {
            value: c.value,
            measured_at: c.measured_at,
        })
}

/// Whether the patient has an open admission (admitted or transferred, not
/// discharged): the inpatient window then applies.
async fn is_inpatient(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let open = sqlx::query_scalar!(
        "SELECT EXISTS (SELECT 1 FROM admissions WHERE tenant_id = $1 AND patient_id = $2 \
           AND status IN ('admitted', 'transferred') AND discharged_at IS NULL \
           AND deleted_at IS NULL) AS \"open!\"",
        tenant_id,
        patient_id
    )
    .fetch_one(conn)
    .await?;
    Ok(open)
}

/// The patient's latest qualifying eGFR (verified, per 1.73 m², within the
/// hospital's window for an inpatient or an outpatient).
///
/// One selector for every brick that reads kidney function (renal dosing,
/// contrast screening), so they never disagree on which result counts.
///
/// # Errors
/// A database read failed: the caller reports it, never "not checked".
pub async fn patient_latest_egfr(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<EgfrLookup, sqlx::Error> {
    let settings = KidneySettings::read(conn, tenant_id).await?;
    let inpatient = is_inpatient(conn, tenant_id, patient_id).await?;
    let window_days = settings.window_days(inpatient);
    let now = Utc::now();
    let candidates = sqlx::query_as::<_, EgfrCandidate>(
        // Verified only: an unverified value may be mid-correction. The time
        // window is applied here to bound the read and again in Rust.
        "SELECT lr.numeric_value::float8 AS value, lr.unit, lr.parameter_name, \
                ltc.loinc_code AS test_loinc, \
                COALESCE(lo.collected_at, lo.verified_at, lr.created_at) AS measured_at \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         LEFT JOIN lab_test_catalog ltc ON ltc.id = lo.test_id AND ltc.tenant_id = lo.tenant_id \
         WHERE lr.tenant_id = $1 AND lo.patient_id = $2 AND lr.numeric_value IS NOT NULL \
           AND lr.deleted_at IS NULL AND lo.status = 'verified'::lab_order_status \
           AND COALESCE(lo.collected_at, lo.verified_at, lr.created_at) >= $3 \
           AND (ltc.loinc_code = ANY($4) OR lower(lr.parameter_name) LIKE '%gfr%' \
                OR lower(lr.parameter_name) LIKE '%glomerular%') \
         ORDER BY measured_at DESC LIMIT 20",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(now - Duration::days(window_days))
    .bind(EGFR_LOINC)
    .fetch_all(conn)
    .await?;
    Ok(EgfrLookup {
        reading: latest_egfr(&candidates, now, window_days),
        window_days,
        inpatient,
        settings,
    })
}

#[cfg(test)]
mod egfr_tests;

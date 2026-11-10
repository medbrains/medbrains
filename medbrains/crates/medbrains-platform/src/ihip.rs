//! IDSP line lists for IHIP: the P-form (presumptive cases, reported by the
//! treating doctor) and the L-form (lab-confirmed cases), from the notifiable
//! worklist.
//!
//! IHIP publishes no upload format for private hospitals; a person enters the
//! cases on the portal. So the list follows the published IDSP forms: the
//! P-form's disease-wise case count over a Monday-Sunday week (or one day,
//! since IHIP reporting is daily), and the L-form's line list of positive
//! cases -- name, age, sex, address, test done, lab-confirmed diagnosis --
//! with the contact and dates the portal asks for. TB is not here: it goes to
//! Ni-kshay on its own form.
//!
//! Making a list is a disclosure, recorded in the audit chain; marking it
//! submitted records the portal's acknowledgement against every case on it.

use std::collections::BTreeMap;

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

use crate::disclosure::{self, Disclosure, form_date, sex_code};
use crate::facility_codes::{FACILITY_SQL, Facility};

const STATUTE: &str = "Integrated Disease Surveillance Programme, state notification of \
     notifiable diseases";
const RECIPIENT: &str = "IDSP/IHIP";
/// The longest period one list may cover: a reporting week is seven days,
/// and a missed month is the most anyone should be catching up on.
const MAX_DAYS: i64 = 31;

const COMMON: [&str; 8] = [
    "Sr No",
    "Patient name",
    "Age (yrs)",
    "Sex",
    "Mobile",
    "Address",
    "PIN",
    "Hospital reference (UHID)",
];
const P_COLUMNS: [&str; 7] = [
    "Presumptive diagnosis",
    "ICD-10",
    "ICD-11",
    "Date of detection",
    "Seen in",
    "Outcome",
    "Reporting doctor",
];
const L_COLUMNS: [&str; 8] = [
    "Test done",
    "Result",
    "Date of sample",
    "Date of result",
    "Lab-confirmed diagnosis",
    "ICD-10",
    "ICD-11",
    "Outcome",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
pub enum Form {
    P,
    L,
}

impl Form {
    const fn case_class(self) -> &'static str {
        match self {
            Self::P => "presumptive",
            Self::L => "confirmed",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct LineListQuery {
    pub form: Form,
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, sqlx::FromRow)]
struct Case {
    report_id: Uuid,
    patient_name: Option<String>,
    age: Option<i32>,
    gender: Option<String>,
    phone: Option<String>,
    address: Option<String>,
    pin: Option<String>,
    uhid: Option<String>,
    disease_name: String,
    icd10_code: String,
    icd11_code: Option<String>,
    detected_on: NaiveDate,
    source: Option<String>,
    deceased: bool,
    doctor: Option<String>,
    test_name: Option<String>,
    result: Option<String>,
    sampled_on: Option<NaiveDate>,
    resulted_on: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct DiseaseCount {
    pub disease_name: String,
    pub icd10_code: String,
    pub cases: usize,
}

#[derive(Debug, Serialize)]
pub struct LineList {
    pub form: Form,
    pub facility: Facility,
    pub period_from: NaiveDate,
    pub period_to: NaiveDate,
    pub columns: Vec<&'static str>,
    pub rows: Vec<Vec<String>>,
    /// The worklist row behind each line, in order: what "submitted" marks.
    pub report_ids: Vec<Uuid>,
    /// The P-form's disease-wise count.
    pub summary: Vec<DiseaseCount>,
}

/// Pending cases of one form in the period. The P-form's period is when the
/// case was detected; the L-form's, when the lab confirmed it.
const CASES_SQL: &str = concat!(
    "SELECT r.id AS report_id, \
            NULLIF(concat_ws(' ', p.first_name, p.middle_name, p.last_name), '') AS patient_name, \
            date_part('year', age(p.date_of_birth))::int AS age, p.gender::text AS gender, \
            p.phone, ",
    crate::patient_address_sql!(),
    ", p.uhid, r.disease_name, r.icd10_code, ref.icd11_code, \
            (r.detected_at AT TIME ZONE 'Asia/Kolkata')::date AS detected_on, r.source, \
            COALESCE(p.is_deceased, false) AS deceased, u.full_name AS doctor, \
            t.name AS test_name, res.value AS result, \
            (lo.collected_at AT TIME ZONE 'Asia/Kolkata')::date AS sampled_on, \
            (lo.verified_at AT TIME ZONE 'Asia/Kolkata')::date AS resulted_on \
       FROM notifiable_disease_reports r \
       JOIN patients p ON p.id = r.patient_id ",
    crate::patient_address_join!(),
    " LEFT JOIN cds_diagnosis_reference ref ON ref.icd10_code = r.icd10_code \
       LEFT JOIN users u ON u.id = r.detected_by \
       LEFT JOIN lab_orders lo ON lo.id = r.lab_order_id \
       LEFT JOIN lab_test_catalog t ON t.id = lo.test_id \
       LEFT JOIN LATERAL ( \
            SELECT string_agg(lr.parameter_name || ': ' || lr.value, '; ') AS value \
              FROM lab_results lr WHERE lr.order_id = lo.id AND lr.deleted_at IS NULL) res ON true \
      WHERE r.tenant_id = $1 AND r.status = 'pending' AND r.case_class = $2 AND NOT ",
    crate::is_tb_sql!(),
    " AND (CASE WHEN $2 = 'confirmed' THEN COALESCE(r.confirmed_at, r.detected_at) \
                 ELSE r.detected_at END AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $3 AND $4 \
      ORDER BY r.disease_name, r.detected_at LIMIT 2000"
);

fn seen_in(source: Option<&str>) -> &'static str {
    match source {
        Some("ipd_diagnosis" | "discharge_summary") => "IPD",
        Some("er_diagnosis") => "Emergency",
        Some("lab_result") => "Lab",
        _ => "OPD",
    }
}

fn line(form: Form, sr: usize, c: &Case) -> Vec<String> {
    let text = |v: &Option<String>| v.clone().unwrap_or_default();
    let outcome = if c.deceased { "Died" } else { "Alive" }.to_owned();
    let mut cells = vec![
        sr.to_string(),
        text(&c.patient_name),
        c.age.map(|a| a.to_string()).unwrap_or_default(),
        sex_code(c.gender.as_deref()).to_owned(),
        text(&c.phone),
        text(&c.address),
        text(&c.pin),
        text(&c.uhid),
    ];
    match form {
        Form::P => cells.extend([
            c.disease_name.clone(),
            c.icd10_code.clone(),
            text(&c.icd11_code),
            form_date(Some(c.detected_on)),
            seen_in(c.source.as_deref()).to_owned(),
            outcome,
            text(&c.doctor),
        ]),
        Form::L => cells.extend([
            text(&c.test_name),
            text(&c.result),
            form_date(c.sampled_on),
            form_date(c.resulted_on),
            c.disease_name.clone(),
            c.icd10_code.clone(),
            text(&c.icd11_code),
            outcome,
        ]),
    }
    cells
}

fn summary(cases: &[Case]) -> Vec<DiseaseCount> {
    let mut by: BTreeMap<(&str, &str), usize> = BTreeMap::new();
    for c in cases {
        *by.entry((&c.disease_name, &c.icd10_code)).or_default() += 1;
    }
    by.into_iter()
        .map(|((name, code), cases)| DiseaseCount {
            disease_name: name.to_owned(),
            icd10_code: code.to_owned(),
            cases,
        })
        .collect()
}

fn check_period(from: NaiveDate, to: NaiveDate) -> Result<(), AppError> {
    let days = (to - from).num_days();
    if days < 0 {
        return Err(AppError::BadRequest(
            "The period ends before it starts.".to_owned(),
        ));
    }
    if days >= MAX_DAYS {
        return Err(AppError::BadRequest(format!(
            "One list covers at most {MAX_DAYS} days."
        )));
    }
    Ok(())
}

/// GET /api/ckb/ihip/line-list — the P- or L-form line list for a period.
pub async fn line_list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<LineListQuery>,
) -> Result<Json<LineList>, AppError> {
    require_permission(&claims, permissions::ckb::reports::EXPORT)?;
    check_period(q.from, q.to)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let facility = sqlx::query_as::<_, Facility>(FACILITY_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    let cases = sqlx::query_as::<_, Case>(CASES_SQL)
        .bind(claims.tenant_id)
        .bind(q.form.case_class())
        .bind(q.from)
        .bind(q.to)
        .fetch_all(&mut *tx)
        .await?;
    let report_ids: Vec<Uuid> = cases.iter().map(|c| c.report_id).collect();
    if !report_ids.is_empty() {
        disclosure::record(
            &mut tx,
            &claims,
            &Disclosure {
                stage: "prepared",
                recipient: RECIPIENT,
                statute: STATUTE,
                entity_type: "notifiable_disease_reports",
                record_ids: &report_ids,
                reference: None,
            },
        )
        .await?;
    }
    tx.commit().await?;
    let columns = COMMON
        .iter()
        .chain(match q.form {
            Form::P => P_COLUMNS.as_slice(),
            Form::L => L_COLUMNS.as_slice(),
        })
        .copied()
        .collect();
    Ok(Json(LineList {
        form: q.form,
        facility,
        period_from: q.from,
        period_to: q.to,
        columns,
        rows: cases
            .iter()
            .enumerate()
            .map(|(i, c)| line(q.form, i + 1, c))
            .collect(),
        report_ids,
        summary: summary(&cases),
    }))
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub form: Form,
    pub report_ids: Vec<Uuid>,
    /// The portal's acknowledgement for this submission.
    pub acknowledgement: String,
}

#[derive(Debug, Serialize)]
pub struct SubmitResult {
    pub submitted: u64,
}

/// POST /api/ckb/ihip/submit — record a line list as entered on IHIP.
pub async fn submit_line_list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SubmitRequest>,
) -> Result<Json<SubmitResult>, AppError> {
    require_permission(&claims, permissions::ckb::reports::MANAGE)?;
    let ack = body.acknowledgement.trim();
    if ack.is_empty() {
        return Err(AppError::BadRequest(
            "Give the acknowledgement IHIP showed.".to_owned(),
        ));
    }
    if body.report_ids.is_empty() || body.report_ids.len() > 2000 {
        return Err(AppError::BadRequest(
            "Submit between 1 and 2000 cases at a time.".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Only cases still pending, of this form, and not TB; anything else on the
    // list changed since it was made, and the whole submission is refused.
    let done = sqlx::query(concat!(
        "UPDATE notifiable_disease_reports r \
            SET status = 'submitted', report_ref = $3, submitted_by = $4, \
                submitted_at = now(), updated_at = now() \
          WHERE r.tenant_id = $1 AND r.id = ANY($2) AND r.status = 'pending' \
            AND r.case_class = $5 AND NOT ",
        crate::is_tb_sql!()
    ))
    .bind(claims.tenant_id)
    .bind(&body.report_ids)
    .bind(ack)
    .bind(claims.sub)
    .bind(body.form.case_class())
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if usize::try_from(done).ok() != Some(body.report_ids.len()) {
        return Err(AppError::Conflict(
            "Some cases on this list were already submitted or changed. Make the list again."
                .to_owned(),
        ));
    }
    disclosure::record(
        &mut tx,
        &claims,
        &Disclosure {
            stage: "submitted",
            recipient: RECIPIENT,
            statute: STATUTE,
            entity_type: "notifiable_disease_reports",
            record_ids: &body.report_ids,
            reference: Some(ack),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(SubmitResult { submitted: done }))
}

#[cfg(test)]
mod tests {
    use super::{COMMON, Case, Form, L_COLUMNS, P_COLUMNS, check_period, line, summary};
    use chrono::NaiveDate;
    use uuid::Uuid;

    fn case(name: &str, code: &str) -> Case {
        Case {
            report_id: Uuid::nil(),
            patient_name: Some("Asha Rao".to_owned()),
            age: Some(30),
            gender: Some("female".to_owned()),
            phone: None,
            address: None,
            pin: None,
            uhid: None,
            disease_name: name.to_owned(),
            icd10_code: code.to_owned(),
            icd11_code: None,
            detected_on: NaiveDate::from_ymd_opt(2026, 10, 20).unwrap_or_default(),
            source: Some("er_diagnosis".to_owned()),
            deceased: false,
            doctor: None,
            test_name: Some("Dengue NS1".to_owned()),
            result: Some("NS1: Positive".to_owned()),
            sampled_on: None,
            resulted_on: None,
        }
    }

    #[test]
    fn each_form_fills_its_own_columns() {
        let c = case("Dengue fever", "A90");
        let p = line(Form::P, 1, &c);
        assert_eq!(p.len(), COMMON.len() + P_COLUMNS.len());
        assert_eq!(p[3], "F");
        assert_eq!(p[12], "Emergency");
        let l = line(Form::L, 1, &c);
        assert_eq!(l.len(), COMMON.len() + L_COLUMNS.len());
        assert_eq!(l[8], "Dengue NS1");
    }

    #[test]
    fn the_summary_counts_cases_per_disease() {
        let s = summary(&[
            case("Dengue fever", "A90"),
            case("Dengue fever", "A90"),
            case("Cholera", "A00"),
        ]);
        assert_eq!(s.len(), 2);
        assert_eq!(
            (s[1].disease_name.as_str(), s[1].cases),
            ("Dengue fever", 2)
        );
    }

    #[test]
    fn a_list_covers_a_real_period_of_at_most_a_month() {
        let d = |day| NaiveDate::from_ymd_opt(2026, 10, day).unwrap_or_default();
        assert!(check_period(d(19), d(25)).is_ok());
        assert!(check_period(d(25), d(19)).is_err());
        assert!(check_period(d(1), d(31)).is_ok(), "a whole month");
        let september = NaiveDate::from_ymd_opt(2026, 9, 20).unwrap_or_default();
        assert!(check_period(september, d(25)).is_err());
    }
}

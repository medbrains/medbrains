//! The registration brick's reads, shared by its screens and its typed actions
//! (`patients.find`, `patients.summary`; `docs/architecture/ACTIONS.md`).
//!
//! Each takes the caller's open connection, so the kernel broker can run it in
//! its unit of work and the HTTP handler in its own transaction, with one answer.

use chrono::NaiveDate;
use medbrains_core::patient::{Gender, Patient};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::field_access::restricted_fields_on;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{MatchResult, filter_match_result, filter_patient_response, find_matches, search};

/// The desk lookup: every patient in the tenant matching `query`.
///
/// Name, phone, UHID or Aadhaar; identity only, masked for the caller. Under
/// three characters it matches nothing: a lookup is for someone, not a browse.
pub async fn find(
    conn: &mut PgConnection,
    state: &AppState,
    claims: &Claims,
    query: &str,
) -> Result<Vec<MatchResult>, AppError> {
    let query = query.trim();
    if query.chars().count() < 3 {
        return Ok(Vec::new());
    }
    let Some(matcher) =
        search::PatientSearch::for_request(state, claims.tenant_id, Some(query)).await?
    else {
        return Ok(Vec::new());
    };
    let restricted = restricted_fields_on(conn, claims.tenant_id, claims.sub, &claims.role).await?;
    let rows = find_matches(conn, claims.tenant_id, &matcher).await?;
    Ok(rows
        .into_iter()
        .map(|m| filter_match_result(m, &restricted))
        .collect())
}

/// Who a patient is and when they were last seen: the chart header, no more.
#[derive(Debug, Serialize)]
pub struct PatientSummary {
    pub id: Uuid,
    pub uhid: String,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub gender: Gender,
    pub date_of_birth: Option<NaiveDate>,
    pub is_dob_estimated: bool,
    pub phone: String,
    pub is_deceased: bool,
    pub last_visit_date: Option<NaiveDate>,
    pub total_visits: i32,
}

impl From<Patient> for PatientSummary {
    /// Keeps the header fields of an already-masked patient.
    fn from(p: Patient) -> Self {
        Self {
            id: p.id,
            uhid: p.uhid,
            first_name: p.first_name,
            middle_name: p.middle_name,
            last_name: p.last_name,
            gender: p.gender,
            date_of_birth: p.date_of_birth,
            is_dob_estimated: p.is_dob_estimated,
            phone: p.phone,
            is_deceased: p.is_deceased,
            last_visit_date: p.last_visit_date,
            total_visits: p.total_visits,
        }
    }
}

/// One patient's summary, if the caller may see that patient.
///
/// The same record check and field masking as `GET /api/patients/{id}`.
/// `NotFound` for a patient who is absent or out of reach, so the answer is not
/// an oracle.
pub async fn summary(
    conn: &mut PgConnection,
    state: &AppState,
    claims: &Claims,
    patient_id: Uuid,
) -> Result<PatientSummary, AppError> {
    // ponytail: the record check takes its own connection beside this unit of
    // work; move it onto `conn` when the gate grows a connection variant.
    medbrains_health_services::patient::require_patient_access(state, claims, patient_id).await?;
    let restricted = restricted_fields_on(conn, claims.tenant_id, claims.sub, &claims.role).await?;
    let patient = crate::load_patient(conn, patient_id, claims.tenant_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(filter_patient_response(patient, &restricted).into())
}

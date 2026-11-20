//! The hospital OPD number at the desk, over HTTP.
//!
//! The policy screen, the previous and next number the registration form
//! shows, and the number registration gives. The rules live in `medbrains_server_services::opd_number`; this is HTTP.

use axum::extract::State;
use axum::routing::{get, put};
use axum::{Extension, Json};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_kernel::audit::AuditEntry;
use medbrains_kernel::authz::Outcome;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_services::opd_number::{self, Assigned, Entry, Policy, Target};
use serde::Serialize;
use uuid::Uuid;

/// The policy and the numbers the form shows beside the field.
#[derive(Debug, Serialize)]
pub struct OpdNumberView {
    #[serde(flatten)]
    pub policy: Policy,
    /// The last number used, formatted; `None` before the first.
    pub previous: Option<String>,
    /// The number to fill in, formatted.
    pub next: String,
}

/// The routes, merged into the patients router.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/registration/opd-number", get(get_opd_number))
        .route("/api/registration/opd-number/policy", put(update_policy))
        .merge(crate::search_settings::router())
}

/// Read the policy and the previous and next number in the caller's transaction.
async fn view(state: &AppState, permit: &kernel::Permit) -> Result<OpdNumberView, AppError> {
    let mut tx = kernel::actor_tx(&state.db, permit, None).await?;
    let policy = opd_number::read_policy(&mut tx, permit.tenant_id()).await?;
    let suggestion = opd_number::suggest(&mut tx, permit.tenant_id(), &policy).await?;
    tx.commit().await?;
    Ok(OpdNumberView {
        previous: suggestion.previous.map(|n| policy.format(n)),
        next: policy.format(suggestion.next),
        policy,
    })
}

/// `GET /api/registration/opd-number`: whoever registers a patient or starts a
/// visit sees the policy and the previous and next number. Numbers only.
pub async fn get_opd_number(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OpdNumberView>, AppError> {
    let permit = kernel::authz::permit_any(
        &claims,
        &[
            permissions::patients::CREATE,
            permissions::opd::visit::CREATE,
        ],
    )?;
    Ok(Json(view(&state, &permit).await?))
}

/// `PUT /api/registration/opd-number/policy`: the hospital's own setting.
pub async fn update_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(policy): Json<Policy>,
) -> Result<Json<OpdNumberView>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::general::MANAGE)?;
    let mut tx = kernel::actor_tx(&state.db, &permit, None).await?;
    opd_number::write_policy(&mut tx, claims.tenant_id, &policy).await?;
    tx.commit().await?;
    Ok(Json(view(&state, &permit).await?))
}

/// Whether the caller may give an OPD date before today. An unknown answer
/// is an error, never a quiet "no".
fn may_backdate(claims: &Claims) -> Result<bool, AppError> {
    match kernel::authz::permission_outcome(claims, permissions::patients::opd_number::BACKDATE) {
        Outcome::Allow => Ok(true),
        Outcome::Deny => Ok(false),
        Outcome::Unknown => Err(AppError::ServiceUnavailable(
            "permissions unavailable".into(),
        )),
    }
}

/// The audit row for a number given or corrected: old and new number and date.
async fn audit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    action: &'static str,
    (old, new): (&serde_json::Value, &Assigned),
) -> Result<(), AppError> {
    let (entity_type, entity_id) = match new.target {
        Target::Patient(id) => ("patient", id),
        Target::Visit(id) => ("encounter", id),
    };
    let new_values = serde_json::json!({ "opd_number": &new.number, "opd_date": new.opd_date });
    kernel::audit::append(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type,
            entity_id: Some(entity_id),
            old_values: Some(old),
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// A registered patient and the OPD number and date registration gave them,
/// so the desk sees an automatic number at once.
#[derive(Debug, Serialize)]
pub struct CreatedPatient {
    #[serde(flatten)]
    pub patient: medbrains_core::patient::Patient,
    pub opd_number: Option<String>,
    pub opd_date: Option<NaiveDate>,
}

/// Give a newly registered patient their OPD number and date when the hospital
/// keeps one per patient. A date the desk chose (an old paper record) is
/// audited; `created_at` is untouched and nothing else is created.
pub(crate) async fn assign_at_registration(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    body: &crate::CreatePatientRequest,
) -> Result<Option<Assigned>, AppError> {
    let entry = Entry {
        typed: body.opd_number.as_deref(),
        opd_date: body.opd_date,
        may_backdate: may_backdate(claims)?,
    };
    let ids = (patient_id, None);
    let assigned = opd_number::assign(tx, claims.tenant_id, ids, entry).await?;
    if let Some(new) = assigned.as_ref().filter(|_| body.opd_date.is_some()) {
        let none = serde_json::json!({ "opd_number": null, "opd_date": null });
        audit(tx, claims, "patients.opd_number.dated", (&none, new)).await?;
    }
    Ok(assigned)
}

/// The registration response: the patient as this user may see them, and the
/// number and date registration gave them.
pub(crate) fn created(
    patient: medbrains_core::patient::Patient,
    restricted: &std::collections::HashMap<String, medbrains_core::form::FieldAccessLevel>,
    assigned: Option<Assigned>,
) -> CreatedPatient {
    CreatedPatient {
        patient: crate::filter_patient_response(patient, restricted),
        opd_number: assigned.as_ref().map(|a| a.number.clone()),
        opd_date: assigned.and_then(|a| a.opd_date),
    }
}

/// A patient's OPD number and date as a screen shows them; empty for a
/// hospital that keeps none.
#[derive(Debug, Default, Serialize)]
pub struct OnRow {
    pub opd_number: Option<String>,
    pub opd_date: Option<NaiveDate>,
}

/// One patient's OPD number and date, for the patient header. An identifier
/// like the UHID: empty wherever the UHID is hidden from this user.
pub(crate) async fn of_patient(
    conn: &mut sqlx::PgConnection,
    (tenant_id, patient_id): (Uuid, Uuid),
    restricted: &std::collections::HashMap<String, medbrains_core::form::FieldAccessLevel>,
) -> Result<OnRow, AppError> {
    if crate::patient_field_is_hidden(restricted, crate::PATIENT_UHID_FIELD) {
        return Ok(OnRow::default());
    }
    let row = sqlx::query_as!(
        OnRow,
        "SELECT opd_number, opd_date FROM patients WHERE tenant_id = $1 AND id = $2",
        tenant_id,
        patient_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    Ok(row.unwrap_or_default())
}

//! Whose clinical detail an OPD worklist may show: one bulk check per list.
//!
//! The queue and the verbal-order register are read by roles whose work spans
//! departments: the desk calls every patient, a quality officer audits every
//! countersignature. The role decides who may open the list; this decides, per
//! row, whether the caller may read that visit's clinical content. That is the
//! visit's care team (its department, its doctor, whoever opened it) or a grant
//! on the patient, which is where a break-glass lands.
//!
//! A row the caller may not read stays on the list with its clinical fields
//! withheld, so the desk can still call the patient. A row the check could not
//! answer says so (`Unknown`), so an authorisation outage never reads as
//! "nothing recorded".

use medbrains_kernel as kernel;
use medbrains_kernel::authz::{Outcome, Relation, Resource, any};
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{QueueEntry, VerbalOrderEntry};

/// What the caller may see of one row's clinical content.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordAccess {
    #[default]
    Allowed,
    /// Refused: the visit is outside the caller's care.
    Withheld,
    /// The check could not be answered; withheld, and the screen says why.
    Unknown,
}

impl From<Outcome> for RecordAccess {
    /// `Allow` shows the row, `Deny` withholds it, `Unknown` withholds and says so.
    fn from(outcome: Outcome) -> Self {
        match outcome {
            Outcome::Allow => Self::Allowed,
            Outcome::Deny => Self::Withheld,
            Outcome::Unknown => Self::Unknown,
        }
    }
}

/// Bypass role or `patients.view`: may see who a row's patient is at all. Below
/// that, a worklist shows the token and the status, never the name.
pub fn sees_patient_identity(claims: &Claims) -> bool {
    kernel::authz::is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|granted| granted == medbrains_core::permissions::patients::VIEW)
}

/// Per row, in order: may the caller read the visit (or, with no visit, the
/// patient)? Either grant is enough. One backend round trip for the whole list.
pub async fn visit_access(
    state: &AppState,
    claims: &Claims,
    rows: &[(Option<Uuid>, Option<Uuid>)],
) -> Vec<RecordAccess> {
    let resources: Vec<Resource<'_>> = rows
        .iter()
        .flat_map(|&(visit, patient)| {
            let visit = visit.map(|id| Resource {
                kind: "encounter",
                id,
            });
            visit.into_iter().chain(patient.map(|id| Resource {
                kind: "patient",
                id,
            }))
        })
        .collect();
    let ctx = kernel::authz::authz_context(claims);
    let answers =
        kernel::authz::authorize_each(&*state.authz, &ctx, Relation::Viewer, &resources).await;
    let of = |kind: &str, id: Option<Uuid>| {
        id.map_or(Outcome::Deny, |id| {
            answers
                .get(&(kind.to_owned(), id))
                .copied()
                .unwrap_or(Outcome::Unknown)
        })
    };
    rows.iter()
        .map(|&(visit, patient)| any([of("encounter", visit), of("patient", patient)]).into())
        .collect()
}

/// The queue, with clinical fields only where the caller may read the visit.
///
/// The complaint, appointment reason and referral reason are withheld on the
/// others. `queue_rows` decides the rows; the desk still sees every patient it
/// has to call.
pub async fn withhold_queue(
    state: &AppState,
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    params: &crate::ListQueueQuery,
) -> Result<Vec<QueueEntry>, medbrains_server_core::error::AppError> {
    let mut rows = crate::queue_rows(conn, claims, params).await?;
    let keys: Vec<_> = rows
        .iter()
        .map(|r| (Some(r.encounter_id), Some(r.patient_id)))
        .collect();
    for (row, access) in rows
        .iter_mut()
        .zip(visit_access(state, claims, &keys).await)
    {
        row.access = access;
        if access != RecordAccess::Allowed {
            row.chief_complaint = None;
            row.appointment_reason = None;
            row.referral_reason = None;
        }
    }
    Ok(rows)
}

/// The verbal-order register, the patient and summary withheld outside the caller's care.
///
/// The compliance columns (who ordered, who read back, when it was
/// countersigned) stay, which is what the audit needs.
pub async fn withhold_verbal_orders(
    state: &AppState,
    claims: &Claims,
    rows: &mut [VerbalOrderEntry],
) {
    let keys: Vec<_> = rows
        .iter()
        .map(|r| (r.encounter_id, r.patient_id))
        .collect();
    for (row, access) in rows
        .iter_mut()
        .zip(visit_access(state, claims, &keys).await)
    {
        row.access = access;
        if access != RecordAccess::Allowed {
            row.patient_id = None;
            row.patient_name = Some("Restricted".to_owned());
            row.uhid = None;
            row.summary = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::RecordAccess;
    use medbrains_kernel::authz::Outcome;

    /// An outage is never shown as a refusal, and a refusal never as a grant.
    #[test]
    fn each_outcome_keeps_its_meaning_on_a_row() {
        assert_eq!(RecordAccess::from(Outcome::Allow), RecordAccess::Allowed);
        assert_eq!(RecordAccess::from(Outcome::Deny), RecordAccess::Withheld);
        assert_eq!(RecordAccess::from(Outcome::Unknown), RecordAccess::Unknown);
    }
}

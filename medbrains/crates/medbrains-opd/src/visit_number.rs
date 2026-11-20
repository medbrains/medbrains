//! The hospital OPD number a new OPD visit gets: its own per visit, or, per
//! patient, the patient's first one when they have none yet (registered
//! before the hospital turned it on), with its register date. The rules are
//! `medbrains_server_services::opd_number`'s.

use medbrains_core::encounter::Encounter;
use medbrains_core::permissions;
use medbrains_kernel::authz::{Outcome, permission_outcome};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_services::opd_number::{self, Assigned, Entry, Target};

use crate::CreateEncounterRequest;

/// Number the visit (or its patient) from what the desk entered, and show a
/// per-visit number on the returned visit.
///
/// # Errors
/// As `opd_number::assign`: a malformed or used number, a backdate refused;
/// 503 when whether this user may backdate cannot be told.
pub(crate) async fn apply(
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    encounter: &mut Encounter,
    body: &CreateEncounterRequest,
) -> Result<(), AppError> {
    let may_backdate = match permission_outcome(claims, permissions::patients::opd_number::BACKDATE)
    {
        Outcome::Allow => true,
        Outcome::Deny => false,
        Outcome::Unknown => {
            return Err(AppError::ServiceUnavailable(
                "permissions unavailable".into(),
            ));
        }
    };
    let entry = Entry {
        typed: body.opd_number.as_deref(),
        opd_date: body.opd_date,
        may_backdate,
    };
    let ids = (encounter.patient_id, Some(encounter.id));
    if let Some(Assigned {
        target: Target::Visit(_),
        number,
        ..
    }) = opd_number::assign(conn, claims.tenant_id, ids, entry).await?
    {
        encounter.encounter_number = Some(number);
    }
    Ok(())
}

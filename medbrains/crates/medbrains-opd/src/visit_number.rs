//! The hospital OPD number a new OPD visit gets: its own per visit, or, per
//! patient, the patient's first one when they have none yet (registered
//! before the hospital turned it on). The rules are
//! `medbrains_server_services::opd_number`'s.

use medbrains_core::encounter::Encounter;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_services::opd_number::{self, Assigned, Entry, Target};

use crate::CreateEncounterRequest;

/// Number the visit (or its patient) from what the desk typed, and show a
/// per-visit number on the returned visit.
///
/// # Errors
/// As `opd_number::assign`: a malformed or used number.
pub(crate) async fn apply(
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    encounter: &mut Encounter,
    body: &CreateEncounterRequest,
) -> Result<(), AppError> {
    let entry = Entry {
        typed: body.opd_number.as_deref(),
        ..Entry::default()
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

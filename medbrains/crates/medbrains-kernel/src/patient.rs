//! The patient spine: one identity every app refers to.
//!
//! **Gap:** no single resolver existed before K1 — `medbrains-patients` only
//! exposes HTTP handlers (`find_patients`, `merge_patients`). This follows the
//! merge pointer `merge_patients` writes (`is_merged`,
//! `merged_into_patient_id`) and nothing else; identifier types beyond UHID
//! (ABHA, MRN in `patient_identifiers`) are K3+ work.

use uuid::Uuid;

use crate::{AppError, Tx};

/// Merges chained deeper than this are a data fault, not a real history.
const MAX_MERGE_HOPS: i32 = 8;

/// How the caller names the patient.
#[derive(Debug, Clone, Copy)]
pub enum PatientRef<'a> {
    Id(Uuid),
    Uhid(&'a str),
}

/// The surviving patient id for `identifier` in the unit of work's tenant,
/// following merges to the record that was kept. `None` when no such patient
/// exists in this hospital.
pub async fn resolve(tx: &mut Tx, identifier: PatientRef<'_>) -> Result<Option<Uuid>, AppError> {
    let (id, uhid) = match identifier {
        PatientRef::Id(id) => (Some(id), None),
        PatientRef::Uhid(uhid) => (None, Some(uhid)),
    };
    let tenant_id = tx.actor().tenant_id;
    let survivor = sqlx::query_scalar::<_, Uuid>(
        "WITH RECURSIVE chain(id, next_id, hops) AS ( \
             SELECT p.id, CASE WHEN p.is_merged THEN p.merged_into_patient_id END, 0 \
               FROM patients p \
              WHERE p.tenant_id = $1 AND (p.id = $2 OR p.uhid = $3) \
             UNION ALL \
             SELECT p.id, CASE WHEN p.is_merged THEN p.merged_into_patient_id END, c.hops + 1 \
               FROM patients p JOIN chain c ON p.id = c.next_id \
              WHERE p.tenant_id = $1 AND c.hops < $4 \
         ) \
         SELECT id FROM chain WHERE next_id IS NULL ORDER BY hops DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(id)
    .bind(uhid)
    .bind(MAX_MERGE_HOPS)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(survivor)
}

//! Consent: may this purpose use this patient's data now?
//!
//! **Gap:** there is no single consent check today. Three stores answer
//! different questions — `patient_consents` and `procedure_consents`
//! (`medbrains-consent::verify_consent`, an HTTP handler) and the DPDP ledger
//! `dpdp_consents` (`medbrains-patients::dpdp_consent::read`). This wraps the
//! nearest one to "purpose": the DPDP ledger, whose newest row is the
//! patient's current answer for the purposes in [`PURPOSES`]. Care itself is a
//! legitimate use under DPDP s.7 and is not asked here.

use uuid::Uuid;

use crate::{Outcome, Tx};

/// The purposes the DPDP notice names — the only ones that can be agreed to.
/// `medbrains_patients::dpdp_consent` re-exports this.
pub const PURPOSES: [&str; 4] = [
    "abdm_linking",
    "insurance_claims",
    "health_reminders",
    "research",
];

/// Has the patient agreed to `purpose` in their newest DPDP decision?
///
/// `Deny` when they declined it, withdrew it, or were never asked. `Unknown`
/// when the purpose is not one the notice names (the question has no answer)
/// or the ledger could not be read.
pub async fn check(tx: &mut Tx, patient_id: Uuid, purpose: &str) -> Outcome {
    if !PURPOSES.contains(&purpose) {
        return Outcome::Unknown;
    }
    let tenant_id = tx.actor().tenant_id;
    let newest = sqlx::query_scalar::<_, bool>(
        "SELECT $3 = ANY(purposes) FROM dpdp_consents \
          WHERE patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .bind(purpose)
    .fetch_optional(&mut **tx)
    .await;
    outcome_of(newest)
}

/// Map the ledger read to an outcome. An error is `Unknown`, never `Deny`:
/// a database fault must not read as "the patient said no".
fn outcome_of(newest: Result<Option<bool>, sqlx::Error>) -> Outcome {
    match newest {
        Ok(Some(true)) => Outcome::Allow,
        Ok(Some(false) | None) => Outcome::Deny,
        Err(e) => {
            tracing::error!(target: "kernel", error = %e, "consent ledger unreadable — unknown, not refused");
            Outcome::Unknown
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Outcome, outcome_of};

    #[test]
    fn a_fault_is_unknown_not_a_refusal() {
        assert_eq!(outcome_of(Err(sqlx::Error::PoolClosed)), Outcome::Unknown);
    }

    #[test]
    fn agreed_declined_and_never_asked() {
        assert_eq!(outcome_of(Ok(Some(true))), Outcome::Allow);
        assert_eq!(outcome_of(Ok(Some(false))), Outcome::Deny);
        assert_eq!(outcome_of(Ok(None)), Outcome::Deny);
    }
}

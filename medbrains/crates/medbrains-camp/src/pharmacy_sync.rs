//! Which medicines a camp may dispense offline and sync later.
//!
//! A camp's dispense arrives after the fact, from a device that had no
//! witness check, no NDPS register and no retained duplicate. Schedule X,
//! NDPS and controlled drugs therefore never travel this path: the sync
//! refuses the line and names it, and the drug is dispensed at a hospital
//! pharmacy counter. Schedule H and H1 lines go through the hospital's own
//! gate (`medbrains_pharmacy::schedule_gate`) against the synced prescription.
//! A line with no catalogue item is refused: camp stock is the catalogue's.
//!
//! A camp H/H1 dispense that fails the gate at sync had already happened: it
//! is posted (the stock left the shelf) and filed as a refused
//! `CAMP_DISPENSE_EXCEPTION` on the order, which the pharmacy's Orders tab
//! lists under "Camp exceptions" for review, instead of failing the event
//! and leaving the device to retry it for ever.
//!
//! A prescription synced by the doctor who wrote it is signed at sync, by the
//! signing path (`medbrains_documents::signatures::sign_as_author_in_tx`),
//! when the sync carries a fresh step-up; one written for another doctor, or
//! synced by anyone else, stays unsigned for its doctor's sign-off inbox.

use medbrains_pharmacy::{rx_safety, schedule_gate};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The sync error for a line with no catalogue item.
pub(crate) fn free_text_line_refusal(drug_name: &str) -> String {
    format!(
        "{drug_name}: choose the drug from the catalogue; a camp dispense line needs its \
         catalogue item, because camp stock is the catalogue's"
    )
}

/// Signs a synced prescription as its author, or says why it was not.
///
/// Only the syncing doctor's own prescription (`doctor_id` absent or theirs),
/// and only under a fresh step-up; the signing path checks the rest (the
/// signing right, a registered doctor profile, a signing key). A refusal
/// leaves the prescription unsigned, inside a savepoint, and is returned as
/// the event's note; a fault aborts the event.
///
/// # Errors
/// A database or other server fault.
pub(crate) async fn sign_synced_prescription(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    (doctor_id, prescription_id): (Option<Uuid>, Uuid),
    stepped_up: bool,
) -> Result<Option<String>, AppError> {
    if doctor_id.is_some_and(|d| d != claims.sub) {
        return Ok(Some(
            "Prescription not signed: it names another doctor, who signs it from their \
             sign-off inbox"
                .to_owned(),
        ));
    }
    if !stepped_up {
        return Ok(Some(
            "Prescription not signed: confirm your password on the device before syncing, or \
             sign it from the sign-off inbox"
                .to_owned(),
        ));
    }
    let mut savepoint = sqlx::Connection::begin(&mut **tx).await?;
    let signed = medbrains_documents::signatures::sign_as_author_in_tx(
        state,
        &mut savepoint,
        claims,
        "prescription",
        prescription_id,
        "Signed by its author at camp sync",
    )
    .await;
    match signed {
        Ok(()) => {
            savepoint.commit().await?;
            Ok(None)
        }
        Err(
            refusal @ (AppError::Forbidden
            | AppError::ForbiddenReason(_)
            | AppError::BadRequest(_)
            | AppError::NotFound
            | AppError::Conflict(_)),
        ) => {
            savepoint.rollback().await?;
            let why = match refusal {
                AppError::ForbiddenReason(m) | AppError::BadRequest(m) | AppError::Conflict(m) => m,
                AppError::NotFound => "it is not yours to sign".to_owned(),
                _ => "you do not hold the doctor's signing right".to_owned(),
            };
            Ok(Some(format!(
                "Prescription not signed ({why}); sign it from the sign-off inbox"
            )))
        }
        Err(fault) => Err(fault),
    }
}

/// Runs the schedule gate on a camp dispense that already happened. A pass
/// is `None`; a refusal is filed on the order as a `CAMP_DISPENSE_EXCEPTION`
/// and returned as the event's note, and the dispense stands.
///
/// # Errors
/// A database fault, or a gate error that is not a refusal.
pub(crate) async fn gate_camp_dispense(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    subject: &rx_safety::Subject,
) -> Result<Option<String>, AppError> {
    let order_id = subject.record_id.ok_or(AppError::NotFound)?;
    let gate = schedule_gate::enforce_schedule_compliance(
        tx,
        claims.tenant_id,
        order_id,
        &schedule_gate::GateInput::default(),
    )
    .await;
    match gate {
        Ok(_) => Ok(None),
        Err(AppError::BadRequest(reason)) => {
            let note = format!("Dispensed at the camp; flagged for pharmacist review. {reason}");
            rx_safety::file_dispense_refusal_in_tx(
                tx,
                claims,
                subject,
                rx_safety::CAMP_DISPENSE_EXCEPTION,
                &AppError::BadRequest(note.clone()),
            )
            .await?;
            Ok(Some(note))
        }
        Err(fault) => Err(fault),
    }
}

/// The sync error for one line, when its drug may not be dispensed by a camp.
pub(crate) fn controlled_line_refusal(
    drug_name: &str,
    schedule: Option<&str>,
    is_controlled: bool,
    narcotic_class: Option<&str>,
) -> Option<String> {
    let kind = match schedule {
        Some("X") => "Schedule X",
        Some("NDPS") => "NDPS",
        _ if is_controlled || narcotic_class.is_some_and(|c| !c.trim().is_empty()) => "controlled",
        _ => return None,
    };
    Some(format!(
        "{drug_name}: a {kind} drug cannot be dispensed through camp offline sync; dispense it at \
         the hospital pharmacy counter with a witness"
    ))
}

#[cfg(test)]
mod tests {
    use super::{controlled_line_refusal, free_text_line_refusal};

    #[test]
    fn a_free_text_line_is_named_and_sent_to_the_catalogue() {
        let m = free_text_line_refusal("Amoxicillin 500");
        assert!(m.starts_with("Amoxicillin 500: choose the drug from the catalogue"));
    }

    #[test]
    fn only_schedule_x_ndps_and_controlled_lines_are_refused() {
        let x = controlled_line_refusal("Buprenorphine 2mg", Some("X"), true, None);
        assert!(x.is_some_and(|m| m.contains("Buprenorphine 2mg") && m.contains("Schedule X")));
        assert!(controlled_line_refusal("Morphine 10mg", Some("NDPS"), true, None).is_some());
        assert!(controlled_line_refusal("Tramadol", Some("H"), true, None).is_some());
        assert!(controlled_line_refusal("Codeine", None, false, Some("opioid")).is_some());
        assert!(controlled_line_refusal("Amoxicillin", Some("H"), false, None).is_none());
        assert!(controlled_line_refusal("Paracetamol", None, false, None).is_none());
    }
}

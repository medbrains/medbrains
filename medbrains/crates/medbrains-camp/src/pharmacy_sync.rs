//! Which medicines a camp may dispense offline and sync later.
//!
//! A camp's dispense arrives after the fact, from a device that had no
//! witness check, no NDPS register and no retained duplicate. Schedule X,
//! NDPS and controlled drugs therefore never travel this path: the sync
//! refuses the line and names it, and the drug is dispensed at a hospital
//! pharmacy counter. Schedule H and H1 lines go through the hospital's own
//! gate (`medbrains_pharmacy::schedule_gate`) against the synced prescription.
//! A line with no catalogue item is refused, as everywhere medicine is sold:
//! it is picked from the catalogue, or added to it first by a pharmacist.
//!
//! A camp H/H1 dispense that fails the gate at sync had already happened: it
//! is posted (the stock left the shelf) and filed as a refused
//! `CAMP_DISPENSE_EXCEPTION` on the order, which the pharmacy's Orders tab
//! lists under "Camp exceptions" for review, instead of failing the event
//! and leaving the device to retry it for ever.
//!
//! A synced prescription is never signed at sync: a signature is the
//! doctor's word that they reviewed the record, given on the review screen
//! under a fresh step-up. It stays unsigned for the doctor's sign-off inbox,
//! and a camp H/H1 dispense on it meanwhile is posted as an exception. Signing
//! it later does not clear that exception; the pharmacist closes it on review.
//! A synced prescription names its doctor (`doctor_id`), or is refused: the
//! syncing device's user is not assumed to be the prescriber.

use medbrains_pharmacy::{rx_safety, schedule_gate};
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use sqlx::{Postgres, Transaction};

/// The sync error for a line with no catalogue item.
pub(crate) fn free_text_line_refusal(drug_name: &str) -> String {
    format!("{drug_name}: {}", schedule_gate::PICK_FROM_CATALOGUE)
}

/// The sync error for a prescription that names no doctor.
pub(crate) const NO_PRESCRIBER: &str =
    "prescription sync requires doctor_id: a prescription names the doctor who wrote it";

/// The note on every synced prescription.
pub(crate) const UNSIGNED_NOTE: &str =
    "Prescription saved unsigned; its doctor signs it from the sign-off inbox";

/// Runs the schedule gate on a camp dispense that already happened. A pass
/// is `None`; a refusal is filed on the order as a `CAMP_DISPENSE_EXCEPTION`
/// and returned as the event's note, and the dispense stands.
///
/// Only an H/H1 refusal may be posted that way: the sync refuses Schedule X,
/// NDPS, controlled and free-text lines before the order exists, and this
/// checks that none reached it rather than post one as an exception.
///
/// # Errors
/// `Internal` when such a line reached the gate; a database fault, or a gate
/// error that is not a refusal.
pub(crate) async fn gate_camp_dispense(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    subject: &rx_safety::Subject,
) -> Result<Option<String>, AppError> {
    let order_id = subject.record_id.ok_or(AppError::NotFound)?;
    let strict: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pharmacy_order_items oi \
                          LEFT JOIN pharmacy_catalog c \
                            ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
                         WHERE oi.order_id = $1 AND oi.tenant_id = $2 AND oi.removed_at IS NULL \
                           AND (c.id IS NULL OR c.is_controlled \
                                OR c.drug_schedule::text IN ('X', 'NDPS') \
                                OR COALESCE(btrim(c.narcotic_class), '') <> ''))",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if strict {
        return Err(AppError::Internal(
            "a Schedule X, NDPS, controlled or free-text line reached the camp H/H1 gate"
                .to_owned(),
        ));
    }
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
    use medbrains_pharmacy::schedule_gate::PICK_FROM_CATALOGUE;

    use super::{controlled_line_refusal, free_text_line_refusal};

    #[test]
    fn a_free_text_line_is_named_and_sent_to_the_catalogue() {
        let m = free_text_line_refusal("Amoxicillin 500");
        assert_eq!(m, format!("Amoxicillin 500: {PICK_FROM_CATALOGUE}"));
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

//! The Schedule H/H1/X gate, run wherever a scheduled medicine leaves the
//! shelf for a patient: the counter dispense and the pick of a
//! pack-and-collect order.
//!
//! Drugs and Cosmetics Act 1940, Drugs Rules 65 and 65A, and the NDPS Act 1985:
//!
//! - Schedule H, H1 and X are sold only on a registered practitioner's
//!   prescription, and not beyond what it prescribes. Each scheduled line must
//!   be an item on the order's prescription, matched on the catalogue item the
//!   stock leaves from (by its id where the prescription line carries one, by
//!   the catalogue's own names otherwise, never by the order line's free text),
//!   and the order may not take the patient past the prescribed quantity once
//!   every earlier order on the same prescription is counted. Repeats the
//!   doctor allowed and the pharmacy issued add one fill each, except for
//!   Schedule X, which is never repeated.
//! - The prescription must be signed and in date (`valid_until`). An unsigned
//!   one, a verbal order not yet countersigned among them, backs nothing.
//! - Schedule X also needs a written prescription (never verbal or telephone),
//!   from a doctor allowed to prescribe it, a witness who is not that doctor,
//!   and the reference of the duplicate the pharmacy retains (Rule 65(11)).
//!
//! What else counts as a prescription: an uploaded one a pharmacist verified,
//! for H and H1 (its lines are read by the pharmacist, not here), and a recent
//! doctor-signed discharge summary that lists the drug (`discharge_rx`), for H
//! and H1. A visit or admission alone is never a prescription.

use std::collections::HashMap;

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::{countable_rx_quantity, discharge_rx};

/// What the dispense brings to the gate beyond the order itself.
#[derive(Debug, Clone, Copy, Default)]
pub struct GateInput<'a> {
    pub witnessed_by: Option<Uuid>,
    /// The retained Schedule X duplicate: a scan id or the serial on it.
    pub duplicate_ref: Option<&'a str>,
}

/// What a passed gate tells the dispense.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Passed {
    /// The order carries Schedule X: its duplicate reference is filed.
    pub has_schedule_x: bool,
}

/// The order's prescription as the gate reads it; every field `None` when the
/// order names none that is this patient's.
#[derive(Debug, sqlx::FromRow)]
struct RxRow {
    rx_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    is_signed: Option<bool>,
    valid_until: Option<NaiveDate>,
    order_mode: Option<String>,
    repeats_used: Option<i32>,
    verified_upload: bool,
    stored_duplicate_ref: Option<String>,
    today: NaiveDate,
}

/// One scheduled drug on the order, its lines summed.
#[derive(Debug, sqlx::FromRow)]
struct ScheduledLine {
    catalog_id: Uuid,
    name: String,
    generic_name: String,
    schedule: String,
    quantity: i64,
}

/// One live item on the prescription.
#[derive(Debug, sqlx::FromRow)]
struct RxItem {
    catalog_item_id: Option<Uuid>,
    drug_name: String,
    quantity: Option<i32>,
    dosage: String,
    frequency: String,
    duration: String,
}

/// How much of a drug a prescription prescribes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Prescribed {
    /// The drug is not an item on it.
    Absent,
    /// It is, with no stated quantity and a frequency that cannot be counted.
    Uncountable,
    Quantity(i64),
}

/// Refuses a release the Drugs and Cosmetics Act or the NDPS Act forbids.
///
/// The module comment lists the conditions; every failed one is named at
/// once. Runs inside the caller's transaction.
///
/// # Errors
/// `BadRequest` naming each failure; `NotFound` for an unknown order.
pub async fn enforce_schedule_compliance(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    input: &GateInput<'_>,
) -> Result<Passed, AppError> {
    let rx = read_prescription(tx, tenant_id, order_id).await?;
    let lines = scheduled_lines(tx, tenant_id, order_id).await?;
    let has_schedule_x = lines.iter().any(|l| l.schedule == "X");
    if lines.is_empty() {
        return Ok(Passed { has_schedule_x });
    }
    let mut blocks = Vec::new();
    match rx.rx_id {
        Some(rx_id) => {
            blocks.extend(prescription_problems(&rx));
            blocks.extend(quantity_problems(tx, (tenant_id, order_id, rx_id), &rx, &lines).await?);
        }
        None => blocks.extend(unprescribed_problems(tx, tenant_id, order_id, &rx, &lines).await?),
    }
    if has_schedule_x {
        blocks.extend(schedule_x_problems(tx, tenant_id, &rx, input).await?);
    }
    if blocks.is_empty() {
        Ok(Passed { has_schedule_x })
    } else {
        Err(AppError::BadRequest(format!(
            "Schedule H/H1/X gate failed: {}",
            blocks.join("; ")
        )))
    }
}

/// The order's prescription, when it is this patient's and not deleted.
async fn read_prescription(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<RxRow, AppError> {
    sqlx::query_as::<_, RxRow>(
        "SELECT rx.id AS rx_id, rx.doctor_id, rx.is_signed, rx.valid_until, rx.order_mode, \
                rx.repeats_used, \
                EXISTS (SELECT 1 FROM pharmacy_store_orders s \
                         WHERE s.tenant_id = o.tenant_id AND s.pharmacy_order_id = o.id \
                           AND s.rx_source = 'upload' AND s.verified_at IS NOT NULL \
                           AND s.deleted_at IS NULL) AS verified_upload, \
                o.schedule_x_duplicate_ref AS stored_duplicate_ref, \
                CURRENT_DATE AS today \
         FROM pharmacy_orders o \
         LEFT JOIN prescriptions rx ON rx.id = o.prescription_id AND rx.tenant_id = o.tenant_id \
              AND rx.deleted_at IS NULL \
              AND COALESCE(rx.patient_id, \
                    (SELECT e.patient_id FROM encounters e \
                      WHERE e.id = rx.encounter_id AND e.tenant_id = rx.tenant_id), \
                    (SELECT a.patient_id FROM admissions a \
                      WHERE a.id = rx.admission_id AND a.tenant_id = rx.tenant_id)) \
                  = o.patient_id \
         WHERE o.id = $1 AND o.tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// The order's Schedule H/H1/X drugs, by the catalogue's own names, each with
/// the quantity this order's live lines add up to.
async fn scheduled_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<Vec<ScheduledLine>, AppError> {
    Ok(sqlx::query_as::<_, ScheduledLine>(
        "SELECT c.id AS catalog_id, c.name, COALESCE(c.generic_name, '') AS generic_name, \
                c.drug_schedule::text AS schedule, SUM(oi.quantity)::bigint AS quantity \
         FROM pharmacy_order_items oi \
         JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
         WHERE oi.order_id = $1 AND oi.tenant_id = $2 AND oi.removed_at IS NULL \
           AND c.drug_schedule::text IN ('H', 'H1', 'X') \
         GROUP BY c.id, c.name, c.generic_name, c.drug_schedule \
         ORDER BY c.name",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// What is wrong with the prescription itself: unsigned, or out of date.
fn prescription_problems(rx: &RxRow) -> Vec<String> {
    let mut out = Vec::new();
    if rx.is_signed != Some(true) {
        out.push(
            "the prescription is not signed by the doctor (a verbal or telephone order counts \
             only once countersigned)"
                .to_owned(),
        );
    }
    if let Some(until) = rx.valid_until
        && until < rx.today
    {
        out.push(format!("the prescription expired on {until}"));
    }
    out
}

/// Each scheduled line must be on the prescription, and this order plus every
/// earlier one on it must stay within what it prescribes.
async fn quantity_problems(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, order_id, rx_id): (Uuid, Uuid, Uuid),
    rx: &RxRow,
    lines: &[ScheduledLine],
) -> Result<Vec<String>, AppError> {
    // Two dispenses against one prescription at once would each count the
    // other as not yet released.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended('rx:' || $1::text, 0))")
        .bind(rx_id)
        .execute(&mut **tx)
        .await?;
    let items = sqlx::query_as::<_, RxItem>(
        "SELECT catalog_item_id, drug_name, quantity, dosage, frequency, duration \
           FROM prescription_items \
          WHERE prescription_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND item_status NOT IN ('discontinued', 'held')",
    )
    .bind(rx_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let released = released_elsewhere(tx, (tenant_id, order_id, rx_id), lines).await?;
    let repeats = i64::from(rx.repeats_used.unwrap_or(0).max(0));
    Ok(lines
        .iter()
        .filter_map(|line| {
            let fills = if line.schedule == "X" { 1 } else { 1 + repeats };
            let before = released.get(&line.catalog_id).copied().unwrap_or(0);
            line_problem(line, prescribed(&items, line), fills, before)
        })
        .collect())
}

/// What earlier orders on the same prescription have already released, per
/// drug: dispensed at the counter, or taken from the shelf for a pack, less
/// what came back.
async fn released_elsewhere(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, order_id, rx_id): (Uuid, Uuid, Uuid),
    lines: &[ScheduledLine],
) -> Result<HashMap<Uuid, i64>, AppError> {
    let ids: Vec<Uuid> = lines.iter().map(|l| l.catalog_id).collect();
    let rows: Vec<(Uuid, i64)> = sqlx::query_as(
        "SELECT oi.catalog_item_id, \
                COALESCE(SUM(GREATEST(CASE WHEN o.status IN \
                     ('picking', 'packed', 'verified', 'ready', 'collected', 'released') \
                   THEN oi.quantity ELSE oi.quantity_dispensed END - oi.quantity_returned, 0)), \
                 0)::bigint \
           FROM pharmacy_order_items oi \
           JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
          WHERE o.tenant_id = $1 AND o.prescription_id = $2 AND o.id <> $3 \
            AND o.status <> 'cancelled' AND o.deleted_at IS NULL \
            AND oi.removed_at IS NULL AND oi.catalog_item_id = ANY($4) \
          GROUP BY oi.catalog_item_id",
    )
    .bind(tenant_id)
    .bind(rx_id)
    .bind(order_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().collect())
}

/// How much of this drug the prescription's items prescribe, summed over every
/// item that names it.
fn prescribed(items: &[RxItem], line: &ScheduledLine) -> Prescribed {
    let names = [line.name.as_str(), line.generic_name.as_str()];
    let mut total = 0_i64;
    let mut found = false;
    for item in items {
        if !discharge_rx::names_drug(
            item.catalog_item_id,
            Some(&item.drug_name),
            line.catalog_id,
            names,
        ) {
            continue;
        }
        found = true;
        let quantity = item
            .quantity
            .filter(|q| *q > 0)
            .or_else(|| countable_rx_quantity(&item.dosage, &item.frequency, &item.duration));
        match quantity {
            Some(q) => total += i64::from(q),
            None => return Prescribed::Uncountable,
        }
    }
    if found {
        Prescribed::Quantity(total)
    } else {
        Prescribed::Absent
    }
}

/// The refusal for one line, if it has one. Pure: the rule lives here.
fn line_problem(
    line: &ScheduledLine,
    prescribed: Prescribed,
    fills: i64,
    released_before: i64,
) -> Option<String> {
    let name = &line.name;
    let schedule = &line.schedule;
    match prescribed {
        Prescribed::Absent => Some(format!(
            "{name}: Schedule {schedule} drug that is not on the prescription"
        )),
        Prescribed::Uncountable => Some(format!(
            "{name}: Schedule {schedule} drug whose prescribed quantity cannot be read (no \
             quantity, and a frequency that cannot be counted); ask the doctor to state it"
        )),
        Prescribed::Quantity(q) => {
            let allowed = q.saturating_mul(fills);
            let left = allowed - released_before;
            (line.quantity > left).then(|| {
                format!(
                    "{name}: {} asked, but the prescription allows {allowed} and {released_before} \
                     already went out on it ({} left)",
                    line.quantity,
                    left.max(0)
                )
            })
        }
    }
}

/// With no prescription on the order: H and H1 may stand on a verified upload
/// or a discharge summary that lists them; Schedule X never does.
async fn unprescribed_problems(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    rx: &RxRow,
    lines: &[ScheduledLine],
) -> Result<Vec<String>, AppError> {
    let listed = if rx.verified_upload {
        None
    } else {
        discharge_rx::discharge_medicines(tx, tenant_id, order_id).await?
    };
    Ok(lines
        .iter()
        .filter(|line| {
            let names = [line.name.as_str(), line.generic_name.as_str()];
            let backed = rx.verified_upload
                || listed
                    .as_deref()
                    .is_some_and(|l| discharge_rx::lists(l, line.catalog_id, names));
            line.schedule == "X" || !backed
        })
        .map(|line| {
            format!(
                "{}: Schedule {} drug — no prescription for this patient on the order (a \
                 doctor's signed prescription{})",
                line.name,
                line.schedule,
                if line.schedule == "X" {
                    ""
                } else {
                    ", a verified upload, or a recent discharge summary, finalized or \
                     doctor-signed, that lists it"
                }
            )
        })
        .collect())
}

/// Schedule X's own conditions: written, an authorised prescriber, a witness
/// who is not that prescriber, and the retained duplicate's reference.
async fn schedule_x_problems(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    rx: &RxRow,
    input: &GateInput<'_>,
) -> Result<Vec<String>, AppError> {
    let mut out = Vec::new();
    if rx.order_mode.as_deref().is_some_and(|m| m != "written") {
        out.push(
            "Schedule X needs a written prescription, never a verbal or telephone order".to_owned(),
        );
    }
    match input.witnessed_by {
        None => out.push("Schedule X dispense requires a witness".to_owned()),
        Some(w) if Some(w) == rx.doctor_id => {
            out.push("Schedule X witness must differ from prescriber".to_owned());
        }
        Some(_) => {}
    }
    let duplicate = input
        .duplicate_ref
        .or(rx.stored_duplicate_ref.as_deref())
        .map(str::trim)
        .filter(|r| r.chars().count() >= 3);
    if duplicate.is_none() {
        out.push(
            "Schedule X needs the reference of the duplicate prescription the pharmacy keeps \
             (its scan id or serial)"
                .to_owned(),
        );
    }
    if let Some(prescriber) = rx.doctor_id {
        let authorised: Option<bool> = sqlx::query_scalar(
            "SELECT can_prescribe_schedule_x FROM doctor_profiles \
             WHERE user_id = $1 AND tenant_id = $2",
        )
        .bind(prescriber)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;
        match authorised {
            Some(true) => {}
            Some(false) => out.push(
                "Schedule X prescriber lacks `can_prescribe_schedule_x` authorisation".to_owned(),
            ),
            None => out.push(
                "Schedule X prescriber not registered as a doctor in this hospital".to_owned(),
            ),
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::{Prescribed, RxItem, ScheduledLine, Uuid, line_problem, prescribed};

    fn line(quantity: i64) -> ScheduledLine {
        ScheduledLine {
            catalog_id: Uuid::from_u128(7),
            name: "Alprax 0.25".to_owned(),
            generic_name: "alprazolam".to_owned(),
            schedule: "H".to_owned(),
            quantity,
        }
    }

    fn item(catalog: Option<u128>, name: &str, quantity: Option<i32>, frequency: &str) -> RxItem {
        RxItem {
            catalog_item_id: catalog.map(Uuid::from_u128),
            drug_name: name.to_owned(),
            quantity,
            dosage: "1 tab".to_owned(),
            frequency: frequency.to_owned(),
            duration: "5 days".to_owned(),
        }
    }

    #[test]
    fn a_line_is_on_the_prescription_by_its_id_or_the_catalogue_names() {
        let by_id = [item(Some(7), "anything", None, "BD")];
        assert_eq!(prescribed(&by_id, &line(1)), Prescribed::Quantity(10));
        let other_id = [item(Some(8), "Alprax 0.25", Some(10), "BD")];
        assert_eq!(prescribed(&other_id, &line(1)), Prescribed::Absent);
        let by_name = [item(None, "ALPRAZOLAM", Some(4), "SOS")];
        assert_eq!(prescribed(&by_name, &line(1)), Prescribed::Quantity(4));
        let as_needed = [item(Some(7), "Alprax", None, "SOS")];
        assert_eq!(prescribed(&as_needed, &line(1)), Prescribed::Uncountable);
    }

    #[test]
    fn the_cap_counts_earlier_orders_and_issued_repeats() {
        assert!(line_problem(&line(10), Prescribed::Quantity(10), 1, 0).is_none());
        assert!(line_problem(&line(11), Prescribed::Quantity(10), 1, 0).is_some());
        assert!(line_problem(&line(5), Prescribed::Quantity(10), 1, 6).is_some());
        assert!(line_problem(&line(10), Prescribed::Quantity(10), 2, 10).is_none());
        assert!(line_problem(&line(1), Prescribed::Absent, 1, 0).is_some());
        assert!(line_problem(&line(1), Prescribed::Uncountable, 1, 0).is_some());
    }
}

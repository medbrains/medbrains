//! The Schedule H/H1/X and NDPS gate.
//!
//! It runs wherever a scheduled or controlled medicine leaves the shelf for a
//! patient: the counter dispense, the pick of a pack-and-collect order, and a
//! camp's offline dispense at sync.
//!
//! Drugs and Cosmetics Act 1940, Drugs Rules 65 and 65A, and the NDPS Act 1985
//! and Rules. A line is gated when its drug is Schedule H, H1, X or NDPS, or
//! carries `is_controlled` (which X and NDPS always do, migration 1450):
//!
//! - It is sold only on a registered practitioner's prescription, and not
//!   beyond what it prescribes. Each gated line must be an item on the order's
//!   prescription, matched on the catalogue item the stock leaves from: by the
//!   prescription line's catalogue id where it carries one, otherwise by the
//!   catalogue's full name (which carries the strength), never by the generic
//!   name alone, and never by the order line's free text. A 0.25 mg
//!   prescription does not release 2 mg.
//! - The cap is per prescription item: one item's quantity is shared by every
//!   catalogue item it matches, across this order and every earlier order on
//!   the same prescription. Repeats the doctor allowed and the pharmacy issued
//!   add one fill each, except for X, NDPS and controlled drugs, which are
//!   never repeated, and for which the doctor must have stated the quantity
//!   (it is never derived from the frequency).
//! - The prescription must be signed and in date (`valid_until`). An unsigned
//!   one, a verbal order not yet countersigned among them, backs nothing.
//!   X, NDPS and controlled drugs are never dispensed on a verbal or telephone
//!   order.
//! - A line typed as free text, with no catalogue item, never carries a gated
//!   drug: its name is looked up, trimmed and case-insensitively, against the
//!   catalogue's names and generic names, and a match on any gated row
//!   refuses it (`refuse_gated_free_text`, shared with OTC and POS sales).
//! - Schedule X also needs a doctor allowed to prescribe it, a witness who is
//!   not that doctor, and the reference of the duplicate the pharmacy retains
//!   (Rule 65(11)).
//!
//! What else counts as a prescription, for H and H1 only: an uploaded one a
//! pharmacist verified (its lines are read by the pharmacist, not here; one
//! uploaded prescription backs one order per drug), and a recent doctor-signed
//! discharge summary that lists the drug (`discharge_rx`), capped at the
//! quantity it lists across every order on that summary. A visit or admission
//! alone is never a prescription.

use std::collections::HashSet;

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::{discharge_rx, rx_quantity::countable_rx_quantity};

mod cap;

use cap::{Allowance, Released, ScheduledLine, Source, cap_problems};

/// Shortest reference to the retained Schedule X duplicate the gate accepts.
pub const DUPLICATE_REF_MIN_CHARS: usize = 6;

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

/// The order's prescription as the gate reads it; every prescription field
/// `None` when the order names none that is this patient's.
#[derive(Debug, sqlx::FromRow)]
struct RxRow {
    rx_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    is_signed: Option<bool>,
    valid_until: Option<NaiveDate>,
    order_mode: Option<String>,
    repeats_used: Option<i32>,
    verified_upload: bool,
    upload_sha256: Option<String>,
    discharge_summary_id: Option<Uuid>,
    stored_duplicate_ref: Option<String>,
    today: NaiveDate,
}

/// One live item on the prescription.
#[derive(Debug, sqlx::FromRow)]
struct RxItemRow {
    catalog_item_id: Option<Uuid>,
    drug_name: String,
    quantity: Option<i32>,
    dosage: String,
    frequency: String,
    duration: String,
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
    let free_text: Vec<String> = sqlx::query_scalar(
        "SELECT drug_name FROM pharmacy_order_items \
          WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL \
            AND catalog_item_id IS NULL",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    refuse_gated_free_text(tx, tenant_id, &free_text).await?;
    let rx = read_prescription(tx, tenant_id, order_id).await?;
    let lines = scheduled_lines(tx, tenant_id, order_id).await?;
    let has_schedule_x = lines.iter().any(|l| l.schedule == "X");
    if lines.is_empty() {
        return Ok(Passed { has_schedule_x });
    }
    let mut blocks = Vec::new();
    match rx.rx_id {
        Some(rx_id) => {
            blocks.extend(prescription_problems(&rx, &lines));
            blocks
                .extend(prescribed_problems(tx, (tenant_id, order_id, rx_id), &rx, &lines).await?);
        }
        None => blocks.extend(unprescribed_problems(tx, (tenant_id, order_id), &rx, &lines).await?),
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

/// Refuses free-text lines that name a gated drug.
///
/// A line with no catalogue item is refused when its name, trimmed and
/// case-insensitively, is the name or generic name of any Schedule H, H1, X,
/// NDPS or controlled catalogue row: typed instead of picked, a gated drug
/// would pass every check keyed on the catalogue. The counter, OTC and POS
/// all call this one helper.
///
/// # Errors
/// `BadRequest` naming each such line; a database error as itself.
pub async fn refuse_gated_free_text(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    names: &[String],
) -> Result<(), AppError> {
    if names.is_empty() {
        return Ok(());
    }
    // ponytail: unindexed lower() scan of the tenant's catalogue; add an
    // expression index on lower(btrim(name)) if catalogues grow past ~50k rows.
    let gated: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT btrim(n.name) FROM unnest($2::text[]) AS n(name) \
          WHERE EXISTS (SELECT 1 FROM pharmacy_catalog c \
                         WHERE c.tenant_id = $1 \
                           AND (c.drug_schedule::text IN ('H', 'H1', 'X', 'NDPS') \
                                OR c.is_controlled) \
                           AND lower(btrim(n.name)) IN (lower(btrim(c.name)), \
                                                       lower(btrim(c.generic_name)))) \
          ORDER BY 1",
    )
    .bind(tenant_id)
    .bind(names)
    .fetch_all(&mut **tx)
    .await?;
    if gated.is_empty() {
        return Ok(());
    }
    Err(AppError::BadRequest(format!(
        "{}: Choose the drug from the catalogue. A Schedule H, H1, X, NDPS or controlled \
         drug cannot be dispensed on a line typed as free text",
        gated.join(", ")
    )))
}

/// The order's prescription, when it is this patient's and not deleted, and
/// what else could stand for one.
async fn read_prescription(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<RxRow, AppError> {
    sqlx::query_as::<_, RxRow>(
        "SELECT rx.id AS rx_id, rx.doctor_id, rx.is_signed, rx.valid_until, rx.order_mode, \
                rx.repeats_used, \
                up.id IS NOT NULL AS verified_upload, up.rx_document_sha256 AS upload_sha256, \
                o.discharge_summary_id, \
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
         LEFT JOIN LATERAL (SELECT s.id, s.rx_document_sha256 FROM pharmacy_store_orders s \
                             WHERE s.tenant_id = o.tenant_id AND s.pharmacy_order_id = o.id \
                               AND s.rx_source = 'upload' AND s.verified_at IS NOT NULL \
                               AND s.deleted_at IS NULL \
                             ORDER BY s.verified_at LIMIT 1) up ON true \
         WHERE o.id = $1 AND o.tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// The order's gated drugs, by the catalogue's own names, each with the
/// quantity this order's live lines add up to.
async fn scheduled_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<Vec<ScheduledLine>, AppError> {
    Ok(sqlx::query_as::<_, ScheduledLine>(
        "SELECT c.id AS catalog_id, c.name, \
                CASE WHEN c.drug_schedule::text IN ('H', 'H1', 'X', 'NDPS') \
                     THEN c.drug_schedule::text ELSE 'controlled' END AS schedule, \
                c.is_controlled, SUM(oi.quantity)::bigint AS quantity \
         FROM pharmacy_order_items oi \
         JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
         WHERE oi.order_id = $1 AND oi.tenant_id = $2 AND oi.removed_at IS NULL \
           AND (c.drug_schedule::text IN ('H', 'H1', 'X', 'NDPS') OR c.is_controlled) \
         GROUP BY c.id, c.name, c.drug_schedule, c.is_controlled \
         ORDER BY c.name",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// What is wrong with the prescription itself: unsigned, out of date, or a
/// verbal order behind an X, NDPS or controlled drug.
fn prescription_problems(rx: &RxRow, lines: &[ScheduledLine]) -> Vec<String> {
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
    if lines.iter().any(ScheduledLine::is_strict)
        && rx.order_mode.as_deref().is_some_and(|m| m != "written")
    {
        out.push(
            "Schedule X and NDPS drugs need a written prescription, never a verbal or telephone \
             order"
                .to_owned(),
        );
    }
    out
}

/// Takes the transaction-scoped lock that keeps two dispenses against one
/// prescription (or summary, or upload) from each counting the other as not
/// yet released.
async fn lock(tx: &mut Transaction<'_, Postgres>, key: &str) -> Result<(), AppError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(key)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Each gated line must be on the prescription, and this order plus every
/// earlier one on it must stay within what each item prescribes.
async fn prescribed_problems(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, order_id, rx_id): (Uuid, Uuid, Uuid),
    rx: &RxRow,
    lines: &[ScheduledLine],
) -> Result<Vec<String>, AppError> {
    lock(tx, &format!("rx:{rx_id}")).await?;
    let items = sqlx::query_as::<_, RxItemRow>(
        "SELECT catalog_item_id, drug_name, quantity, dosage, frequency, duration \
           FROM prescription_items \
          WHERE prescription_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND item_status NOT IN ('discontinued', 'held')",
    )
    .bind(rx_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let allowances: Vec<Allowance> = items
        .into_iter()
        .map(|i| Allowance {
            stated: i.quantity.filter(|q| *q > 0).map(i64::from),
            counted: countable_rx_quantity(&i.dosage, &i.frequency, &i.duration).map(i64::from),
            catalog_item_id: i.catalog_item_id,
            name: i.drug_name,
        })
        .collect();
    let released = released_elsewhere(tx, (tenant_id, order_id), "prescription_id", rx_id).await?;
    let source = Source {
        noun: "the prescription",
        repeats: i64::from(rx.repeats_used.unwrap_or(0).max(0)),
    };
    Ok(cap_problems(lines, &allowances, &released, source))
}

/// What earlier orders backed by the same paper (`column` = `backing`) have
/// already released, per catalogue item: dispensed at the counter, or taken
/// from the shelf for a pack, less what came back.
async fn released_elsewhere(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, order_id): (Uuid, Uuid),
    column: &'static str,
    backing: Uuid,
) -> Result<Vec<Released>, AppError> {
    let sql = format!(
        "SELECT oi.catalog_item_id AS catalog_id, c.name, \
                COALESCE(SUM(GREATEST(CASE WHEN o.status IN \
                     ('picking', 'packed', 'verified', 'ready', 'collected', 'released') \
                   THEN oi.quantity ELSE oi.quantity_dispensed END - oi.quantity_returned, 0)), \
                 0)::bigint AS quantity \
           FROM pharmacy_order_items oi \
           JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
           JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
          WHERE o.tenant_id = $1 AND o.{column} = $2 AND o.id <> $3 \
            AND o.status <> 'cancelled' AND o.deleted_at IS NULL AND oi.removed_at IS NULL \
          GROUP BY oi.catalog_item_id, c.name"
    );
    Ok(sqlx::query_as::<_, Released>(&sql)
        .bind(tenant_id)
        .bind(backing)
        .bind(order_id)
        .fetch_all(&mut **tx)
        .await?)
}

/// With no prescription on the order: H and H1 may stand on a verified upload
/// (once per drug) or a discharge summary that lists them (up to what it
/// lists); X, NDPS and controlled drugs never do.
async fn unprescribed_problems(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, order_id): (Uuid, Uuid),
    rx: &RxRow,
    lines: &[ScheduledLine],
) -> Result<Vec<String>, AppError> {
    let (strict, others): (Vec<&ScheduledLine>, Vec<&ScheduledLine>) =
        lines.iter().partition(|l| l.is_strict());
    let mut out: Vec<String> = strict
        .iter()
        .map(|l| {
            format!(
                "{}: {} drug — no prescription for this patient on the order (a doctor's signed \
                 written prescription)",
                l.name,
                l.kind()
            )
        })
        .collect();
    if others.is_empty() {
        return Ok(out);
    }
    if rx.verified_upload {
        out.extend(upload_problems(tx, (tenant_id, order_id), rx, &others).await?);
        return Ok(out);
    }
    let listed = discharge_rx::discharge_medicines(tx, tenant_id, order_id).await?;
    match (listed, rx.discharge_summary_id) {
        (Some(listed), Some(summary_id)) => {
            lock(tx, &format!("ds:{summary_id}")).await?;
            let allowances: Vec<Allowance> = listed
                .into_iter()
                .map(|m| Allowance {
                    catalog_item_id: m.catalog_item_id,
                    name: m.drug_name.unwrap_or_default(),
                    stated: m.quantity.filter(|q| *q > 0).map(i64::from),
                    counted: None,
                })
                .collect();
            let released = released_elsewhere(
                tx,
                (tenant_id, order_id),
                "discharge_summary_id",
                summary_id,
            )
            .await?;
            let source = Source {
                noun: "the discharge summary",
                repeats: 0,
            };
            out.extend(cap_problems(
                others.iter().copied(),
                &allowances,
                &released,
                source,
            ));
        }
        _ => out.extend(others.iter().map(|l| {
            format!(
                "{}: {} drug — no prescription for this patient on the order (a doctor's signed \
                 prescription, a verified upload, or a recent discharge summary, finalized or \
                 doctor-signed, that lists it)",
                l.name,
                l.kind()
            )
        })),
    }
    Ok(out)
}

/// A verified uploaded prescription backs one order per drug: the same file
/// (by its SHA-256) behind an earlier order that released the drug backs it
/// no more.
async fn upload_problems(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, order_id): (Uuid, Uuid),
    rx: &RxRow,
    lines: &[&ScheduledLine],
) -> Result<Vec<String>, AppError> {
    let Some(sha) = rx.upload_sha256.as_deref() else {
        // No hash to recognise it by: the upload is this order's alone.
        return Ok(Vec::new());
    };
    lock(tx, &format!("upload:{sha}")).await?;
    let ids: Vec<Uuid> = lines.iter().map(|l| l.catalog_id).collect();
    let used: HashSet<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT DISTINCT oi.catalog_item_id \
           FROM pharmacy_order_items oi \
           JOIN pharmacy_orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id \
           JOIN pharmacy_store_orders s ON s.pharmacy_order_id = o.id \
                AND s.tenant_id = o.tenant_id AND s.rx_source = 'upload' \
                AND s.verified_at IS NOT NULL AND s.deleted_at IS NULL \
          WHERE o.tenant_id = $1 AND o.id <> $2 AND s.rx_document_sha256 = $3 \
            AND o.status <> 'cancelled' AND o.deleted_at IS NULL AND oi.removed_at IS NULL \
            AND oi.catalog_item_id = ANY($4) \
            AND CASE WHEN o.status IN \
                     ('picking', 'packed', 'verified', 'ready', 'collected', 'released') \
                     THEN oi.quantity ELSE oi.quantity_dispensed END > oi.quantity_returned",
    )
    .bind(tenant_id)
    .bind(order_id)
    .bind(sha)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .collect();
    Ok(lines
        .iter()
        .filter(|l| used.contains(&l.catalog_id))
        .map(|l| {
            format!(
                "{}: the uploaded prescription already backed an earlier order for this drug; a \
                 fresh prescription is needed",
                l.name
            )
        })
        .collect())
}

/// Schedule X's own conditions: an authorised prescriber, a witness who is
/// not that prescriber, and the retained duplicate's reference.
async fn schedule_x_problems(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    rx: &RxRow,
    input: &GateInput<'_>,
) -> Result<Vec<String>, AppError> {
    let mut out = Vec::new();
    match input.witnessed_by {
        None => out.push("Schedule X dispense requires a witness".to_owned()),
        Some(w) if Some(w) == rx.doctor_id => {
            out.push("Schedule X witness must differ from prescriber".to_owned());
        }
        Some(_) => {}
    }
    if duplicate_ref(input.duplicate_ref, rx.stored_duplicate_ref.as_deref()).is_none() {
        out.push(format!(
            "Schedule X needs the reference of the duplicate prescription the pharmacy keeps \
             (its scan id or serial, at least {DUPLICATE_REF_MIN_CHARS} characters)"
        ));
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

/// The duplicate's reference the dispense goes on: what was typed, trimmed,
/// else what the order already holds; refused under the minimum length. A
/// blank field never hides the stored one.
pub fn duplicate_ref<'a>(typed: Option<&'a str>, stored: Option<&'a str>) -> Option<&'a str> {
    typed
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .or_else(|| stored.map(str::trim))
        .filter(|r| r.chars().count() >= DUPLICATE_REF_MIN_CHARS)
}

#[cfg(test)]
mod tests {
    use super::duplicate_ref;

    #[test]
    fn a_blank_duplicate_reference_falls_back_to_the_stored_one() {
        assert_eq!(
            duplicate_ref(Some("  "), Some(" SX-2026-01 ")),
            Some("SX-2026-01")
        );
        assert_eq!(duplicate_ref(Some(" SX-77-AB "), None), Some("SX-77-AB"));
        assert_eq!(duplicate_ref(Some("abc"), Some("SX-2026-01")), None);
        assert_eq!(duplicate_ref(None, Some("12345")), None);
        assert_eq!(duplicate_ref(None, None), None);
    }
}

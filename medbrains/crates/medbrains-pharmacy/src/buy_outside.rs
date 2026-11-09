//! The rules for "buy outside" lines that orders, review and the catalogue share.
//!
//! A buy-outside line is one the hospital does not stock, chosen on purpose
//! by the prescriber or confirmed by the reviewing pharmacist, never inferred
//! from a missing catalogue id (owner, 2026-11-09). It is never dispensed,
//! picked or billed; only a catalogue line is sold here
//! (`PharmacyOrderItem::is_sold_here`).

use medbrains_core::pharmacy::PharmacyOrderItem;
use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::{
    CatalogPriceRow, OrderItemInput, PrescriptionItemRow, ReviewPrescriptionItemInput, rx_quantity,
};

/// Refused when an order holds no line sold here: every line is bought
/// outside or typed, so there is nothing to dispense, pick or bill.
pub const NOTHING_SOLD_HERE: &str =
    "Nothing on this order is in the catalogue: every medicine is bought outside";

/// Refuses an order line not sold here that carries a price, or a
/// buy-outside line that names a catalogue item: a medicine bought outside is
/// never billed, and a stocked one is dispensed here.
///
/// # Errors
/// `BadRequest` naming the line.
pub(crate) fn check_unsold_lines_unpriced(items: &[OrderItemInput]) -> Result<(), AppError> {
    for item in items {
        if item.buy_outside && item.catalog_item_id.is_some() {
            return Err(AppError::BadRequest(format!(
                "\"{}\" is marked buy outside: leave the catalogue item empty",
                item.drug_name.trim()
            )));
        }
        if item.catalog_item_id.is_none() && item.unit_price != Decimal::ZERO {
            return Err(AppError::BadRequest(format!(
                "\"{}\" is not in the catalogue, so it is not sold here and carries no price",
                item.drug_name.trim()
            )));
        }
    }
    Ok(())
}

/// The schedules a catalogue item may carry (`pharmacy_catalog` CHECK).
const CATALOGUE_SCHEDULES: [&str; 6] = ["OTC", "G", "H", "H1", "X", "NDPS"];

/// Refuses a new catalogue item without a valid schedule: every gate at the
/// counter (OTC sale, Schedule H/H1/X, the NDPS register) reads it, so an
/// item with none would pass them all.
///
/// # Errors
/// `BadRequest` naming the schedules allowed.
pub(crate) fn check_catalogue_schedule(schedule: Option<&str>) -> Result<(), AppError> {
    if schedule.is_some_and(|s| CATALOGUE_SCHEDULES.contains(&s)) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Give the medicine's schedule: one of {}",
            CATALOGUE_SCHEDULES.join(", ")
        )))
    }
}

/// How the review settles one prescription line.
pub(crate) enum ReviewedLine {
    /// Dispensed here, from this catalogue item at this base price.
    Catalogue(CatalogPriceRow),
    /// Bought outside, chosen by this person (the prescriber, or the
    /// reviewing pharmacist who confirmed it).
    BuyOutside(Option<Uuid>),
}

/// What a line the reviewer has neither mapped nor confirmed is told.
fn map_or_mark(drug_name: &str) -> AppError {
    AppError::Conflict(format!(
        "Map \"{}\" to the catalogue, or mark it buy outside, before approving",
        drug_name.trim()
    ))
}

/// The active catalogue item `id` names, with its base price.
async fn active_catalogue_item(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<CatalogPriceRow>, AppError> {
    sqlx::query_as::<_, CatalogPriceRow>(
        "SELECT id, base_price FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND id = $2 AND is_active = true",
    )
    .bind(tenant_id)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::from)
}

/// Settles one line at review. A line the prescriber marked buy outside
/// stays so. A catalogue item the pharmacist names must be active (409
/// otherwise). An unmapped line needs a mapping or an explicit
/// `buy_outside: true`; a line is never taken as bought outside because its
/// catalogue id is missing (owner, 2026-11-09).
pub(crate) async fn settle_review_line(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    item: &PrescriptionItemRow,
    reviewed: Option<&ReviewPrescriptionItemInput>,
) -> Result<ReviewedLine, AppError> {
    if item.buy_outside {
        return Ok(ReviewedLine::BuyOutside(item.buy_outside_by));
    }
    if let Some(id) = reviewed.and_then(|r| r.catalog_item_id) {
        return active_catalogue_item(tx, claims.tenant_id, id)
            .await?
            .map(ReviewedLine::Catalogue)
            .ok_or_else(|| {
                AppError::Conflict(format!(
                    "The catalogue item chosen for \"{}\" is not active: pick another",
                    item.drug_name.trim()
                ))
            });
    }
    if reviewed.is_some_and(|r| r.buy_outside) {
        return Ok(ReviewedLine::BuyOutside(Some(claims.sub)));
    }
    if let Some(id) = item.catalog_item_id {
        return active_catalogue_item(tx, claims.tenant_id, id)
            .await?
            .map(ReviewedLine::Catalogue)
            .ok_or_else(|| map_or_mark(&item.drug_name));
    }
    // ponytail: an exact name match still maps a line written before the
    // marker existed; the review screen always sends a choice for every line.
    sqlx::query_as::<_, CatalogPriceRow>(
        "SELECT id, base_price FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND is_active = true \
           AND (lower(name) = lower($2) \
                OR (generic_name IS NOT NULL AND lower(generic_name) = lower($2))) \
         ORDER BY (lower(name) = lower($2)) DESC, name LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(item.drug_name.trim())
    .fetch_optional(&mut **tx)
    .await?
    .map(ReviewedLine::Catalogue)
    .ok_or_else(|| map_or_mark(&item.drug_name))
}

/// Puts a bought-outside line on the order: no catalogue item, no price,
/// never dispensed; `by` is who chose or confirmed it.
pub(crate) async fn insert_buy_outside_line(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    item: &PrescriptionItemRow,
    by: Option<Uuid>,
) -> Result<PharmacyOrderItem, AppError> {
    let quantity =
        rx_quantity::estimate_rx_dispense_quantity(&item.dosage, &item.frequency, &item.duration)
            .max(1);
    sqlx::query_as::<_, PharmacyOrderItem>(
        "INSERT INTO pharmacy_order_items \
         (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price, \
          quantity_prescribed, buy_outside, buy_outside_by) \
         VALUES ($1, $2, NULL, $3, $4, 0, 0, $4, true, $5) RETURNING *",
    )
    .bind(tenant_id)
    .bind(order_id)
    .bind(item.drug_name.trim())
    .bind(quantity)
    .bind(by)
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::from)
}

#[cfg(test)]
mod buy_outside_tests {
    use super::{check_catalogue_schedule, check_unsold_lines_unpriced};
    use crate::OrderItemInput;
    use rust_decimal::Decimal;
    use uuid::Uuid;

    /// One order line for the checks.
    fn line(catalog: Option<Uuid>, price: i64, buy_outside: bool) -> OrderItemInput {
        OrderItemInput {
            catalog_item_id: catalog,
            drug_name: "Zincovit".to_owned(),
            quantity: 1,
            unit_price: Decimal::new(price, 0),
            buy_outside,
        }
    }

    #[test]
    fn an_unsold_line_carries_no_price_and_names_no_catalogue_item() {
        let stocked = Some(Uuid::new_v4());
        assert!(check_unsold_lines_unpriced(&[line(stocked, 10, false)]).is_ok());
        assert!(check_unsold_lines_unpriced(&[line(None, 0, false)]).is_ok());
        assert!(check_unsold_lines_unpriced(&[line(None, 0, true)]).is_ok());
        assert!(check_unsold_lines_unpriced(&[line(None, 5, false)]).is_err());
        assert!(check_unsold_lines_unpriced(&[line(None, 5, true)]).is_err());
        assert!(check_unsold_lines_unpriced(&[line(stocked, 0, true)]).is_err());
    }

    #[test]
    fn a_catalogue_item_needs_a_known_schedule() {
        assert!(check_catalogue_schedule(None).is_err());
        assert!(check_catalogue_schedule(Some("")).is_err());
        assert!(check_catalogue_schedule(Some("h")).is_err());
        for s in ["OTC", "G", "H", "H1", "X", "NDPS"] {
            assert!(check_catalogue_schedule(Some(s)).is_ok(), "{s}");
        }
    }
}

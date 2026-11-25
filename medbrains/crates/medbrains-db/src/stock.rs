//! Batch-level stock movement between pharmacy store locations.
//!
//! Two flows move stock from one pharmacy to another — `pharmacy_transfer_requests`
//! and `pharmacy_store_indents` — and they are two halves of the same act: take
//! from the source oldest-expiry-first, hand over, credit the destination. The
//! transfer flow implemented it; the indent flow updated a status column and
//! left both stores' counts untouched. Rather than have a second copy drift
//! from the first, both call these.
//!
//! A movement is only ever half-done in the database sense, never in the
//! physical one: [`issue_fefo`] runs when the goods leave, [`receive_lines`]
//! when they arrive, and the batches taken are carried between the two as
//! [`StockLine`] so the destination re-creates exactly what the source gave up
//! — same batch number, same expiry, same cost. Anything else and a batch
//! recall stops at the loading bay.
//!
//! The stock moved is `pharmacy_batches` — what dispensing, the stock view and
//! FEFO selection read. These functions used to move `batch_stock`, the
//! general store's table, which no pharmacy flow fills: the transfer screen
//! showed stock the dispatch then called insufficient, and no pharmacy could
//! ever supply another. What may leave a store is what may be dispensed from
//! it: in date, cleared from quarantine, and with the hospital's minimum
//! shelf life left ([`MIN_ISSUE_SHELF_LIFE_KEY`]), so a ward is never sent a
//! batch that expires before it can be used.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Hospital setting (`tenant_settings`, category `operations`): days of shelf
/// life a batch must still have to leave a store. Seeded for every hospital by
/// migration 1491; unset or unreadable falls back to
/// [`DEFAULT_MIN_ISSUE_SHELF_LIFE_DAYS`].
pub const MIN_ISSUE_SHELF_LIFE_KEY: &str = "issue_min_shelf_life_days";
/// The storefront's floor for an online order
/// (`medbrains_core::pharmacy_storefront::DEFAULT_MIN_SHELF_LIFE_DAYS`, 90).
pub const DEFAULT_MIN_ISSUE_SHELF_LIFE_DAYS: i32 =
    medbrains_core::pharmacy_storefront::DEFAULT_MIN_SHELF_LIFE_DAYS;

/// Movement is refused rather than half-applied.
#[derive(Debug, thiserror::Error)]
pub enum StockError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),

    /// The source does not hold enough. Reported per item with the shortfall,
    /// because "insufficient stock" alone sends a storekeeper to count every
    /// line on the indent to find the one that failed.
    #[error(
        "insufficient stock at the source store for item {catalog_item_id} — short by {short_by}"
    )]
    Insufficient {
        catalog_item_id: Uuid,
        short_by: i32,
    },

    /// A line was written as free text with no catalogue linkage. Stock lives
    /// against a catalogue item, so there is nothing to decrement — this is
    /// caught here rather than silently skipping the line, which would issue an
    /// indent that moved less than it said it did.
    #[error(
        "indent line '{name}' has no catalogue item — pick it from the catalogue before issuing"
    )]
    Uncatalogued { name: String },

    /// The store holds the item, but not enough of it with the hospital's
    /// minimum shelf life left. Names the earliest expiry on hand, so the
    /// storekeeper sees what is on the shelf and why it may not go, instead
    /// of a short-dated batch leaving without a word.
    #[error(
        "{name}: not enough stock with {min_days} days of shelf life left. The earliest batch \
         on hand, {batch_number}, expires on {expiry}. Receive fresher stock, or change \
         \"Minimum shelf life to issue\" in Settings, Operations."
    )]
    ShortDated {
        name: String,
        min_days: i32,
        batch_number: String,
        expiry: chrono::NaiveDate,
    },
}

/// One line of a movement request: what, and how much.
#[derive(Debug, Clone, Copy)]
pub struct StockRequest {
    pub catalog_item_id: Uuid,
    pub quantity: i32,
}

/// One batch actually taken, and therefore one batch to credit on receipt.
///
/// A request for 50 can come out of three batches; each becomes its own line.
/// Field names match `pharmacy_transfer_requests.dispatched_lines` so rows
/// written before this module existed still deserialise.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockLine {
    pub catalog_item_id: Uuid,
    pub batch_number: String,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub unit_cost: Decimal,
    pub quantity: i32,
}

/// Take `items` from `from_location`, oldest expiry first, from batches with
/// at least the hospital's minimum shelf life left ([`min_issue_shelf_days`]).
///
/// All-or-nothing: the first item the source cannot cover aborts with
/// [`StockError::ShortDated`] when short-dated stock is what is left, else
/// [`StockError::Insufficient`]. The caller's transaction is what makes that
/// true — this function decrements as it goes and relies on the rollback, so it
/// must be called inside a transaction that the caller does not commit on error.
///
/// Rows are locked `FOR UPDATE` so two pickers cannot both be promised the last
/// strip in a batch.
pub async fn issue_fefo(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    from_location: Uuid,
    items: &[StockRequest],
) -> Result<Vec<StockLine>, StockError> {
    let min_days = min_issue_shelf_days(tx, tenant_id).await?;
    let mut taken: Vec<StockLine> = Vec::new();
    for item in items {
        if item.quantity <= 0 {
            continue;
        }
        let batches: Vec<(Uuid, String, Option<chrono::NaiveDate>, Decimal, i32)> = sqlx::query_as(
            "SELECT id, batch_number, expiry_date, COALESCE(purchase_rate, 0), quantity_on_hand \
               FROM pharmacy_batches \
              WHERE tenant_id = $1 AND store_location_id = $2 AND catalog_item_id = $3 \
                AND quantity_on_hand > 0 AND deleted_at IS NULL \
                AND expiry_date > CURRENT_DATE + $4 AND quarantine_status = 'cleared' \
              ORDER BY expiry_date ASC, created_at ASC, id ASC FOR UPDATE",
        )
        .bind(tenant_id)
        .bind(from_location)
        .bind(item.catalog_item_id)
        .bind(min_days)
        .fetch_all(&mut **tx)
        .await?;

        let mut remaining = item.quantity;
        for (batch_id, batch_number, expiry_date, unit_cost, available) in batches {
            if remaining <= 0 {
                break;
            }
            let take = remaining.min(available);
            sqlx::query(
                "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand - $1, \
                 updated_at = now() WHERE id = $2",
            )
            .bind(take)
            .bind(batch_id)
            .execute(&mut **tx)
            .await?;
            taken.push(StockLine {
                catalog_item_id: item.catalog_item_id,
                batch_number,
                expiry_date,
                unit_cost,
                quantity: take,
            });
            remaining -= take;
        }
        if remaining > 0 {
            return Err(
                shortfall(tx, tenant_id, from_location, item, (min_days, remaining)).await?,
            );
        }
    }
    Ok(taken)
}

/// Days of shelf life a batch must still have to leave a store: the
/// hospital's [`MIN_ISSUE_SHELF_LIFE_KEY`], else the default. Read once per
/// movement, not per line.
async fn min_issue_shelf_days(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<i32, StockError> {
    let days: Option<Option<i32>> = sqlx::query_scalar(
        "SELECT LEAST(GREATEST(floor((value #>> '{}')::numeric), 0), 36500)::int \
           FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'operations' AND key = $2 \
            AND deleted_at IS NULL AND jsonb_typeof(value) = 'number'",
    )
    .bind(tenant_id)
    .bind(MIN_ISSUE_SHELF_LIFE_KEY)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(days.flatten().unwrap_or(DEFAULT_MIN_ISSUE_SHELF_LIFE_DAYS))
}

/// Why `item` could not be covered: [`StockError::ShortDated`], naming the
/// earliest in-date batch on hand, when only short-dated stock is left;
/// [`StockError::Insufficient`] when the store simply does not hold enough.
async fn shortfall(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    from_location: Uuid,
    item: &StockRequest,
    (min_days, short_by): (i32, i32),
) -> Result<StockError, StockError> {
    let earliest: Option<(String, chrono::NaiveDate, String)> = sqlx::query_as(
        "SELECT b.batch_number, b.expiry_date, c.name \
           FROM pharmacy_batches b JOIN pharmacy_catalog c ON c.id = b.catalog_item_id \
          WHERE b.tenant_id = $1 AND b.store_location_id = $2 AND b.catalog_item_id = $3 \
            AND b.quantity_on_hand > 0 AND b.deleted_at IS NULL \
            AND b.quarantine_status = 'cleared' \
            AND b.expiry_date > CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + $4 \
          ORDER BY b.expiry_date ASC, b.created_at ASC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(from_location)
    .bind(item.catalog_item_id)
    .bind(min_days)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(match earliest {
        Some((batch_number, expiry, name)) => StockError::ShortDated {
            name,
            min_days,
            batch_number,
            expiry,
        },
        None => StockError::Insufficient {
            catalog_item_id: item.catalog_item_id,
            short_by,
        },
    })
}

/// Credit `lines` to `to_location`, preserving batch identity.
///
/// Updates the destination's matching batch if it already holds one, and
/// creates it otherwise. Matching on batch number rather than inserting blindly
/// keeps a store that receives the same batch twice on one row instead of two,
/// which is what every expiry and recall query assumes.
pub async fn receive_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    to_location: Uuid,
    lines: &[StockLine],
) -> Result<(), StockError> {
    for line in lines {
        let updated = sqlx::query(
            "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand + $1, \
             updated_at = now() \
             WHERE tenant_id = $2 AND store_location_id = $3 AND catalog_item_id = $4 \
               AND batch_number = $5 AND deleted_at IS NULL",
        )
        .bind(line.quantity)
        .bind(tenant_id)
        .bind(to_location)
        .bind(line.catalog_item_id)
        .bind(&line.batch_number)
        .execute(&mut **tx)
        .await?;

        if updated.rows_affected() == 0 {
            // Cleared at the source, so cleared here: the goods are the same,
            // and so is the MRP printed on them.
            sqlx::query(
                "INSERT INTO pharmacy_batches \
                 (tenant_id, catalog_item_id, store_location_id, batch_number, expiry_date, \
                  quantity_received, quantity_on_hand, purchase_rate, quarantine_status, mrp) \
                 VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'cleared', \
                         (SELECT max(mrp) FROM pharmacy_batches \
                           WHERE tenant_id = $1 AND catalog_item_id = $2 AND batch_number = $4 \
                             AND deleted_at IS NULL))",
            )
            .bind(tenant_id)
            .bind(line.catalog_item_id)
            .bind(to_location)
            .bind(&line.batch_number)
            .bind(line.expiry_date)
            .bind(line.quantity)
            .bind(line.unit_cost)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

/// Read movement lines out of a free-form `items` JSON array.
///
/// Indents store their lines as JSON written by a form, so the catalogue
/// linkage is optional there and absent lines have to be refused loudly —
/// see [`StockError::Uncatalogued`].
pub fn requests_from_json(items: &serde_json::Value) -> Result<Vec<StockRequest>, StockError> {
    let Some(array) = items.as_array() else {
        return Ok(Vec::new());
    };

    array
        .iter()
        .filter_map(|item| {
            let quantity = item
                .get("quantity")
                .and_then(serde_json::Value::as_i64)
                .and_then(|q| i32::try_from(q).ok())
                .unwrap_or(0);
            if quantity <= 0 {
                return None;
            }

            let parsed = item
                .get("item_id")
                .and_then(serde_json::Value::as_str)
                .and_then(|id| Uuid::parse_str(id).ok());

            Some(parsed.map_or_else(
                || {
                    Err(StockError::Uncatalogued {
                        name: item
                            .get("name")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("(unnamed)")
                            .to_owned(),
                    })
                },
                |catalog_item_id| {
                    Ok(StockRequest {
                        catalog_item_id,
                        quantity,
                    })
                },
            ))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    #![allow(
        clippy::expect_used,
        clippy::unwrap_used,
        clippy::panic,
        clippy::indexing_slicing
    )]

    use super::*;

    #[test]
    fn zero_and_negative_quantities_are_not_movements() {
        let items = serde_json::json!([
            { "item_id": "11111111-1111-1111-1111-111111111111", "quantity": 0 },
            { "item_id": "11111111-1111-1111-1111-111111111111", "quantity": -5 },
        ]);
        assert!(requests_from_json(&items).expect("no error").is_empty());
    }

    #[test]
    fn a_free_text_line_is_refused_rather_than_skipped() {
        // The failure mode this guards: dropping the line would issue an indent
        // that moved less than it said it did, and nothing would say so.
        let items = serde_json::json!([
            { "item_id": "11111111-1111-1111-1111-111111111111", "quantity": 10 },
            { "name": "Paracetamol 500mg", "quantity": 5 },
        ]);
        let err = requests_from_json(&items).expect_err("free-text line must be refused");
        assert!(
            matches!(err, StockError::Uncatalogued { ref name } if name == "Paracetamol 500mg")
        );
    }

    #[test]
    fn catalogued_lines_become_requests() {
        let items = serde_json::json!([
            { "item_id": "11111111-1111-1111-1111-111111111111", "name": "A", "quantity": 10 },
        ]);
        let reqs = requests_from_json(&items).expect("no error");
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0].quantity, 10);
    }

    #[test]
    fn stock_lines_match_the_dispatched_lines_shape_already_on_disk() {
        // pharmacy_transfer_requests.dispatched_lines rows predate this module.
        // If this stops deserialising, every in-flight transfer breaks on receipt.
        let existing = serde_json::json!({
            "catalog_item_id": "11111111-1111-1111-1111-111111111111",
            "batch_number": "B-42",
            "expiry_date": "2027-01-31",
            "unit_cost": "12.50",
            "quantity": 20
        });
        let line: StockLine = serde_json::from_value(existing).expect("must still deserialise");
        assert_eq!(line.batch_number, "B-42");
        assert_eq!(line.quantity, 20);
    }
}

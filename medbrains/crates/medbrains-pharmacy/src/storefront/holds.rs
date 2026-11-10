//! Holding stock for an online order (owner decision 1): at checkout, then
//! through pharmacist review, each for as long as the hospital's ladder says
//! given how much is left. A hold is taken only from what online may sell —
//! never below the online floor — so the counter and the wards are never
//! short for it; stock itself still moves only at dispense.
//!
//! Expiry needs no job: availability counts only holds whose time has not
//! run out, and a bounded sweep marks the lapsed ones released whenever
//! holds are written.

use std::collections::HashMap;

use medbrains_core::pharmacy_holds::{HoldTier, hold_minutes};
use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::stores::{Stock, available};

/// Lapsed holds marked released per sweep, at most.
const SWEEP_LIMIT: i64 = 200;

/// Mark lapsed holds released. Bounded: each write sweeps a little.
pub(crate) async fn sweep(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<u64, AppError> {
    Ok(sqlx::query(
        "UPDATE pharmacy_stock_holds SET released_at = now(), release_reason = 'expired' \
          WHERE id IN (SELECT id FROM pharmacy_stock_holds \
                        WHERE tenant_id = $1 AND released_at IS NULL AND deleted_at IS NULL \
                          AND expires_at <= now() \
                        ORDER BY expires_at LIMIT $2 FOR UPDATE SKIP LOCKED)",
    )
    .bind(tenant_id)
    .bind(SWEEP_LIMIT)
    .execute(&mut **tx)
    .await?
    .rows_affected())
}

/// Let go of an order's live holds.
pub(crate) async fn release(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    store_order_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE pharmacy_stock_holds SET released_at = now(), release_reason = $3 \
          WHERE tenant_id = $1 AND store_order_id = $2 AND released_at IS NULL \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(store_order_id)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// One line to hold: item, units, its online floor.
pub(crate) struct HoldLine {
    pub item: Uuid,
    pub name: String,
    pub quantity: i32,
    pub floor: i32,
}

/// When each line's hold ends.
pub(crate) type Expiries = HashMap<Uuid, chrono::DateTime<chrono::Utc>>;

/// What to hold: an order's lines at a store, as `checkout` or `review`.
pub(crate) struct HoldRequest<'a> {
    pub store_order_id: Uuid,
    pub store: Option<Uuid>,
    pub kind: &'a str,
    pub lines: &'a [HoldLine],
}

/// Hold the lines, replacing what the order held, timed by `tiers` against
/// what online has left. Refused, holding nothing, when a line is more than
/// online may sell there — the floor is never held into. `stock` must leave
/// this order's own holds out.
pub(crate) async fn place(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    req: &HoldRequest<'_>,
    stock: &Stock,
    tiers: &[HoldTier],
) -> Result<Expiries, AppError> {
    let HoldRequest {
        store_order_id,
        store,
        kind,
        lines,
    } = *req;
    sweep(tx, tenant_id).await?;
    let mut minutes = Vec::with_capacity(lines.len());
    for l in lines {
        let left = available(stock, store, l.item, l.floor);
        if left < l.quantity {
            return Err(AppError::Conflict(format!(
                "{} is out of stock for online orders",
                l.name
            )));
        }
        minutes.push(hold_minutes(tiers, left));
    }
    release(tx, tenant_id, store_order_id, "replaced").await?;
    let rows: Vec<(Uuid, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        "INSERT INTO pharmacy_stock_holds \
           (tenant_id, store_order_id, catalog_item_id, store_location_id, quantity, kind, \
            expires_at) \
         SELECT $1, $2, v.item, $3, v.qty, $4, now() + make_interval(mins => v.mins::int) \
           FROM unnest($5::uuid[], $6::int[], $7::bigint[]) AS v(item, qty, mins) \
         RETURNING catalog_item_id, expires_at",
    )
    .bind(tenant_id)
    .bind(store_order_id)
    .bind(store)
    .bind(kind)
    .bind(lines.iter().map(|l| l.item).collect::<Vec<_>>())
    .bind(lines.iter().map(|l| l.quantity).collect::<Vec<_>>())
    .bind(&minutes)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().collect())
}

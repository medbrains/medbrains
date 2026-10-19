//! Releasing a storefront order: its approved lines become an ordinary
//! pharmacy order in the fulfilment queue, billed like any other, and the
//! patient's delivery choice goes on to part 3. Stock moves at dispense.

use medbrains_core::pharmacy::{PharmacyOrder, PharmacyOrderItem};
use medbrains_core::pharmacy_storefront::taxable_unit_price;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Every line still in stock for online orders: shelf-life-fit batches above
/// the online floor. Stock isn't held before this; it moves at dispense.
// ponytail: no reservation between checkout and release — two orders can
// both pass for the last strip; add batch holds (research §3) if that bites.
async fn check_stock(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    lines: &[ApprovedLine],
) -> Result<(), AppError> {
    let settings = super::settings::load(tx, tenant_id).await?;
    let ids: Vec<Uuid> = lines.iter().map(|l| l.catalog_item_id).collect();
    let rows = super::catalog::rows_by_ids(tx, tenant_id, &ids, &settings).await?;
    match lines.iter().find(|l| {
        rows.get(&l.catalog_item_id)
            .is_none_or(|r| r.available < l.quantity)
    }) {
        Some(short) => Err(AppError::Conflict(format!(
            "{} is out of stock for online orders",
            short.drug_name
        ))),
        None => Ok(()),
    }
}

#[derive(sqlx::FromRow)]
struct ApprovedLine {
    catalog_item_id: Uuid,
    drug_name: String,
    quantity: i32,
    unit_price: Decimal,
    tax_percent: Decimal,
    sale_class: String,
}

/// Release store order `store_order_id`; `actor` is the verifying
/// pharmacist, or none when nothing needed verifying. Returns the pharmacy
/// order.
pub(crate) async fn release(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    store_order_id: Uuid,
    actor: Option<Uuid>,
) -> Result<Uuid, AppError> {
    let (patient_id, prescription_id): (Uuid, Option<Uuid>) = sqlx::query_as(
        "SELECT patient_id, prescription_id FROM pharmacy_store_orders \
              WHERE id = $1 AND tenant_id = $2 AND status = 'awaiting_verification' \
              FOR UPDATE",
    )
    .bind(store_order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let lines = sqlx::query_as::<_, ApprovedLine>(
        "SELECT l.catalog_item_id, l.drug_name, COALESCE(l.approved_quantity, l.quantity) AS quantity, \
                COALESCE(l.unit_price, 0) AS unit_price, c.tax_percent, l.sale_class \
           FROM pharmacy_store_order_lines l \
           JOIN pharmacy_catalog c ON c.id = l.catalog_item_id AND c.tenant_id = l.tenant_id \
          WHERE l.tenant_id = $1 AND l.store_order_id = $2 AND l.status = 'approved' \
            AND l.deleted_at IS NULL ORDER BY l.created_at",
    )
    .bind(tenant_id)
    .bind(store_order_id)
    .fetch_all(&mut **tx)
    .await?;
    let prescribed = lines.iter().any(|l| l.sale_class == "prescription");
    let order = sqlx::query_as::<_, PharmacyOrder>(
        "INSERT INTO pharmacy_orders \
           (tenant_id, patient_id, prescription_id, ordered_by, status, dispensing_type, \
            store_location_id, pharmacist_reviewed_by, reviewed_at, notes) \
         VALUES ($1, $2, $3, NULL, 'ordered', $4::pharmacy_dispensing_type, $5, $6, \
                 CASE WHEN $6::uuid IS NULL THEN NULL ELSE now() END, 'Ordered online') \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(prescription_id)
    .bind(if prescribed { "prescription" } else { "otc" })
    // ponytail: no store chosen — the order joins the fulfilment queue
    // unassigned, as a counter order does. Store selection by serviceable
    // pincode, stock, then distance over the hub/spoke stores is research §5.
    .bind(None::<Uuid>)
    .bind(actor)
    .fetch_one(&mut **tx)
    .await?;
    // The bill adds GST to the price before tax, so what is charged is never
    // more than MRP less the discount.
    let taxable: Vec<Decimal> = lines
        .iter()
        .map(|l| taxable_unit_price(l.unit_price, l.tax_percent))
        .collect();
    let items = sqlx::query_as::<_, PharmacyOrderItem>(
        "INSERT INTO pharmacy_order_items \
           (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price, \
            quantity_prescribed) \
         SELECT $1, $2, v.item, v.name, v.qty, v.price, v.price * v.qty, v.qty \
           FROM unnest($3::uuid[], $4::text[], $5::int[], $6::numeric[]) \
                AS v(item, name, qty, price) \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(order.id)
    .bind(lines.iter().map(|l| l.catalog_item_id).collect::<Vec<_>>())
    .bind(
        lines
            .iter()
            .map(|l| l.drug_name.clone())
            .collect::<Vec<_>>(),
    )
    .bind(lines.iter().map(|l| l.quantity).collect::<Vec<_>>())
    .bind(&taxable)
    .fetch_all(&mut **tx)
    .await?;
    check_stock(tx, tenant_id, &lines).await?;
    crate::ensure_pharmacy_billing_indent_for_order_in_tx(tx, &tenant_id, &order, &items).await?;
    sqlx::query(
        "UPDATE pharmacy_store_orders SET status = 'released', pharmacy_order_id = $3 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(store_order_id)
    .bind(tenant_id)
    .bind(order.id)
    .execute(&mut **tx)
    .await?;
    medbrains_pharmacy_delivery::release::on_store_order_released(
        tx,
        tenant_id,
        actor,
        store_order_id,
        order.id,
    )
    .await?;
    Ok(order.id)
}

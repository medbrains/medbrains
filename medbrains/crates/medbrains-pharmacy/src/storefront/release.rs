//! Releasing a storefront order: its approved lines — as substituted, where
//! the doctor and the patient agreed — become an ordinary pharmacy order at
//! the chosen store, in the fulfilment queue, on a GST tax invoice, and the
//! patient's delivery choice goes on to part 3. The holds end here; stock
//! moves at dispense.

use medbrains_core::pharmacy::{PharmacyOrder, PharmacyOrderItem};
use medbrains_core::pharmacy_storefront::taxable_unit_price;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Every line still in stock for online orders at the chosen store:
/// shelf-life-fit batches above the online floor, less other orders' holds.
async fn check_stock(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    store_order_id: Uuid,
    store: Option<Uuid>,
    lines: &[ApprovedLine],
) -> Result<(), AppError> {
    let settings = super::settings::load(tx, tenant_id).await?;
    let ids: Vec<Uuid> = lines.iter().map(|l| l.catalog_item_id).collect();
    let stock = super::stores::stock(
        tx,
        tenant_id,
        &ids,
        settings.min_shelf_life_days,
        Some(store_order_id),
    )
    .await?;
    match lines
        .iter()
        .find(|l| super::stores::available(&stock, store, l.catalog_item_id, l.floor) < l.quantity)
    {
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
    /// The item prescribed, when a substitute goes out instead.
    original_item_id: Option<Uuid>,
    substitution_request_id: Option<Uuid>,
    drug_name: String,
    quantity: i32,
    unit_price: Decimal,
    tax_percent: Decimal,
    sale_class: String,
    floor: i32,
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
    let (patient_id, prescription_id, store): (Uuid, Option<Uuid>, Option<Uuid>) = sqlx::query_as(
        "SELECT patient_id, prescription_id, store_location_id FROM pharmacy_store_orders \
              WHERE id = $1 AND tenant_id = $2 AND status = 'awaiting_verification' \
              FOR UPDATE",
    )
    .bind(store_order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let lines = sqlx::query_as::<_, ApprovedLine>(
        "SELECT c.id AS catalog_item_id, \
                CASE WHEN l.substitute_item_id IS NOT NULL THEN l.catalog_item_id END \
                  AS original_item_id, \
                l.substitution_request_id, COALESCE(l.substitute_name, l.drug_name) AS drug_name, \
                COALESCE(l.approved_quantity, l.quantity) AS quantity, \
                COALESCE(l.unit_price, 0) AS unit_price, c.tax_percent, l.sale_class, \
                GREATEST(COALESCE(c.online_reserve_floor, c.reorder_level, 0), 0) AS floor \
           FROM pharmacy_store_order_lines l \
           JOIN pharmacy_catalog c ON c.tenant_id = l.tenant_id \
                AND c.id = COALESCE(l.substitute_item_id, l.catalog_item_id) \
          WHERE l.tenant_id = $1 AND l.store_order_id = $2 AND l.status = 'approved' \
            AND l.deleted_at IS NULL ORDER BY l.created_at",
    )
    .bind(tenant_id)
    .bind(store_order_id)
    .fetch_all(&mut **tx)
    .await?;
    check_stock(tx, tenant_id, store_order_id, store, &lines).await?;
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
    .bind(store)
    .bind(actor)
    .fetch_one(&mut **tx)
    .await?;
    let items = insert_items(tx, tenant_id, order.id, &lines).await?;
    crate::bill_order_items_in_tx(tx, &tenant_id, &order, &items).await?;
    super::invoice::tax_lines(tx, tenant_id, order.id).await?;
    log_substitutions(tx, tenant_id, &lines, &items).await?;
    super::holds::release(tx, tenant_id, store_order_id, "released").await?;
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

/// The order's lines. The bill adds GST to the price before tax, so what
/// is charged is never more than MRP less the discount.
async fn insert_items(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    lines: &[ApprovedLine],
) -> Result<Vec<PharmacyOrderItem>, AppError> {
    let taxable: Vec<Decimal> = lines
        .iter()
        .map(|l| taxable_unit_price(l.unit_price, l.tax_percent))
        .collect();
    Ok(sqlx::query_as::<_, PharmacyOrderItem>(
        "INSERT INTO pharmacy_order_items \
           (tenant_id, order_id, catalog_item_id, drug_name, quantity, unit_price, total_price, \
            quantity_prescribed) \
         SELECT $1, $2, v.item, v.name, v.qty, v.price, v.price * v.qty, v.qty \
           FROM unnest($3::uuid[], $4::text[], $5::int[], $6::numeric[]) \
                AS v(item, name, qty, price) \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(order_id)
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
    .await?)
}

/// Each substitute that went out, in the existing substitution log with
/// both consents: the prescriber's (sign-off or phone) and the patient's.
async fn log_substitutions(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    lines: &[ApprovedLine],
    items: &[PharmacyOrderItem],
) -> Result<(), AppError> {
    let mut item_ids = Vec::new();
    let mut requests = Vec::new();
    for l in lines.iter().filter(|l| l.original_item_id.is_some()) {
        let (Some(request), Some(item)) = (
            l.substitution_request_id,
            items
                .iter()
                .find(|i| i.catalog_item_id == Some(l.catalog_item_id)),
        ) else {
            continue;
        };
        item_ids.push(item.id);
        requests.push(request);
    }
    if requests.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO pharmacy_substitutions \
           (tenant_id, pharmacy_order_item_id, original_drug_id, substituted_drug_id, reason, \
            inn_match, patient_consent_obtained, substituted_by, substitution_request_id, \
            prescriber_consent_method, prescriber_consent_by, prescriber_consent_at, \
            patient_consent_method) \
         SELECT r.tenant_id, v.item, r.original_item_id, r.substitute_item_id, r.reason, \
                true, true, r.requested_by, r.id, r.method, r.doctor_id, \
                COALESCE(r.doctor_decided_at, r.created_at), r.patient_consent_method \
           FROM unnest($2::uuid[], $3::uuid[]) AS v(item, request) \
           JOIN pharmacy_substitution_requests r ON r.id = v.request AND r.tenant_id = $1",
    )
    .bind(tenant_id)
    .bind(&item_ids)
    .bind(&requests)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

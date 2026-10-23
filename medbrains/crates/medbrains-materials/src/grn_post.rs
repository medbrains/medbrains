//! Posting a GRN: the one place received stock moves (#4861). A conditional
//! update claims `posted_at` first, so a GRN posts exactly once however many
//! times the button is pressed.

use std::collections::HashSet;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::procurement::{GoodsReceiptNote, GrnItem};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::grn::{self, CatalogueFacts};
use crate::grn_validate::{self as v, LineFacts};

fn facts_of(item: &GrnItem, cat: Option<&CatalogueFacts>) -> LineFacts {
    LineFacts {
        name: item.item_name.clone(),
        rate: item.unit_price,
        mrp: item.mrp,
        expiry: item.expiry_date,
        manufacture: item.manufacture_date,
        received: item.quantity_received,
        accepted: item.quantity_accepted,
        discount: item.discount_amount,
        gst_rate: item.gst_rate,
        hsn: item.hsn_code.clone(),
        catalogue_gst: cat.and_then(|f| Some((f.hsn_code.clone()?, f.gst_rate?))),
    }
}

/// Cost of one stocked unit: what was paid for the accepted units (before
/// GST) spread over billed plus free units. Free goods are never folded
/// into billed quantity, but they do lower the unit cost.
fn effective_unit_cost(item: &GrnItem) -> Decimal {
    let units = item.quantity_accepted + item.free_quantity;
    if units <= 0 || item.quantity_received <= 0 {
        return item.unit_price;
    }
    let discount_share = item.discount_amount * Decimal::from(item.quantity_accepted)
        / Decimal::from(item.quantity_received);
    let paid = Decimal::from(item.quantity_accepted) * item.unit_price - discount_share;
    (paid / Decimal::from(units)).round_dp(2)
}

async fn claim(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    grn_id: Uuid,
) -> Result<GoodsReceiptNote, AppError> {
    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "UPDATE goods_receipt_notes SET status = 'completed', inspected_by = $3, \
                inspected_at = now(), posted_at = now(), posted_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND posted_at IS NULL \
            AND status IN ('draft', 'inspecting', 'accepted', 'partially_accepted') \
          RETURNING *",
    )
    .bind(grn_id)
    .bind(tenant_id)
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(grn) = grn {
        return Ok(grn);
    }
    let posted: Option<bool> = sqlx::query_scalar(
        "SELECT posted_at IS NOT NULL FROM goods_receipt_notes \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(grn_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Err(match posted {
        None => AppError::NotFound,
        Some(true) => AppError::Conflict("This GRN is already posted to stock.".to_owned()),
        Some(false) => AppError::BadRequest("GRN cannot be posted in its current status".into()),
    })
}

async fn receive_po_lines(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    grn: &GoodsReceiptNote,
    items: &[GrnItem],
) -> Result<(), AppError> {
    let wanted: HashSet<Uuid> = items.iter().filter_map(|i| i.po_item_id).collect();
    let moved: Vec<Uuid> = sqlx::query_scalar(
        "WITH want AS ( \
             SELECT po_item_id, SUM(quantity_accepted) AS q FROM grn_items \
              WHERE grn_id = $1 AND tenant_id = $2 AND po_item_id IS NOT NULL \
                AND deleted_at IS NULL GROUP BY po_item_id) \
         UPDATE purchase_order_items p SET quantity_received = p.quantity_received + w.q \
           FROM want w \
          WHERE p.id = w.po_item_id AND p.tenant_id = $2 AND p.po_id = $3 \
            AND p.quantity_received + w.q <= p.quantity_ordered \
         RETURNING p.id",
    )
    .bind(grn.id)
    .bind(grn.tenant_id)
    .bind(grn.po_id)
    .fetch_all(&mut **tx)
    .await?;
    if moved.len() != wanted.len() {
        return Err(AppError::BadRequest(
            "A line on this GRN now exceeds the quantity still open on the purchase order \
             (another GRN was posted against it)."
                .to_owned(),
        ));
    }
    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM purchase_order_items \
          WHERE po_id = $1 AND tenant_id = $2 AND quantity_received < quantity_ordered",
    )
    .bind(grn.po_id)
    .bind(grn.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let status = if pending == 0 {
        "fully_received"
    } else {
        "partially_received"
    };
    sqlx::query(
        "UPDATE purchase_orders SET status = $3::po_status, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(grn.po_id)
    .bind(grn.tenant_id)
    .bind(status)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Stock one accepted line: its own `batch_stock` row, and its own pharmacy
/// batch when the item is a drug. The links are written by line id, so two
/// batches of one item on one bill each keep their own.
async fn stock_line(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    grn: &GoodsReceiptNote,
    item: &GrnItem,
    store_id: Uuid,
    pharmacy_id: Option<Uuid>,
) -> Result<(), AppError> {
    let qty = item.quantity_accepted + item.free_quantity;
    let cost = effective_unit_cost(item);
    let batch = item
        .batch_number
        .clone()
        .unwrap_or_else(|| "N/A".to_owned());
    let batch_stock_id: Uuid = sqlx::query_scalar(
        "INSERT INTO batch_stock (tenant_id, catalog_item_id, store_location_id, batch_number, \
             expiry_date, manufacture_date, quantity, unit_cost, grn_id, vendor_id) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    )
    .bind(grn.tenant_id)
    .bind(store_id)
    .bind(grn.store_location_id)
    .bind(&batch)
    .bind(item.expiry_date)
    .bind(item.manufacture_date)
    .bind(qty)
    .bind(cost)
    .bind(grn.id)
    .bind(grn.vendor_id)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock + $1, \
                last_receipt_date = now(), updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(qty)
    .bind(store_id)
    .bind(grn.tenant_id)
    .execute(&mut **tx)
    .await?;
    let pharmacy_batch_id = match pharmacy_id {
        Some(drug) => Some(stock_pharmacy(tx, grn, item, drug, qty).await?),
        None => None,
    };
    sqlx::query("UPDATE batch_stock SET pharmacy_batch_id = $2 WHERE id = $1")
        .bind(batch_stock_id)
        .bind(pharmacy_batch_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query(
        "UPDATE grn_items SET batch_stock_id = $2, pharmacy_batch_id = $3, \
                pharmacy_synced = ($3::uuid IS NOT NULL) \
          WHERE id = $1 AND tenant_id = $4",
    )
    .bind(item.id)
    .bind(batch_stock_id)
    .bind(pharmacy_batch_id)
    .bind(grn.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn stock_pharmacy(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    grn: &GoodsReceiptNote,
    item: &GrnItem,
    drug: Uuid,
    qty: i32,
) -> Result<Uuid, AppError> {
    let (Some(batch), Some(expiry)) = (item.batch_number.as_deref(), item.expiry_date) else {
        return Err(AppError::BadRequest(format!(
            "{}: a drug line needs its batch number and expiry date",
            item.item_name
        )));
    };
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date, \
             manufacture_date, quantity_received, quantity_on_hand, vendor_id, grn_id, \
             grn_item_id, purchase_order_id, purchase_rate, mrp, invoice_number, \
             store_location_id, last_purchase_date) \
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id",
    )
    .bind(grn.tenant_id)
    .bind(drug)
    .bind(batch)
    .bind(expiry)
    .bind(item.manufacture_date)
    .bind(qty)
    .bind(grn.vendor_id)
    .bind(grn.id)
    .bind(item.id)
    .bind(grn.po_id)
    .bind(effective_unit_cost(item))
    .bind(item.mrp)
    .bind(&grn.invoice_number)
    .bind(grn.store_location_id)
    .bind(grn.receipt_date)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE pharmacy_catalog SET current_stock = current_stock + $1 \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(qty)
    .bind(drug)
    .bind(grn.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

/// Post a draft GRN to stock, once. Re-checks the lines against today's
/// rules first: a batch that was fine at entry may be near expiry by now.
pub async fn post_grn(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    grn_id: Uuid,
) -> Result<GoodsReceiptNote, AppError> {
    let grn = claim(tx, tenant_id, user_id, grn_id).await?;
    let items = grn::load_items(tx, tenant_id, grn_id).await?;
    let ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    let facts = grn::catalogue_facts(tx, tenant_id, &ids).await?;
    let rules = grn::load_rules(tx, tenant_id).await?;
    let lines: Vec<LineFacts> = items
        .iter()
        .map(|i| facts_of(i, i.catalog_item_id.and_then(|id| facts.get(&id))))
        .collect();
    grn::split_issues(v::check_bill(&lines, grn.invoice_amount, &rules))?;
    receive_po_lines(tx, &grn, &items).await?;
    // ponytail: ~5 statements per line, bounded by MAX_GRN_LINES; set-based
    // CTE inserts if bills ever grow past that.
    for item in items.iter().filter(|i| i.quantity_accepted > 0) {
        let Some(store_id) = item.catalog_item_id else {
            continue;
        };
        let drug = facts.get(&store_id).and_then(|f| f.pharmacy_id);
        stock_line(tx, &grn, item, store_id, drug).await?;
    }
    Ok(grn)
}

/// `PUT /api/procurement/grns/{id}/complete` — post the GRN: stock moves now.
pub async fn complete_grn(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GoodsReceiptNote>, AppError> {
    require_permission(&claims, permissions::procurement::grn::POST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let grn = post_grn(&mut tx, claims.tenant_id, claims.sub, id).await?;
    tx.commit().await?;
    Ok(Json(grn))
}

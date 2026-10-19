//! Goods receipt entry (#4861). A GRN is written as a draft and checked; it
//! moves no stock. Posting (`grn_post`) is the one place stock moves.
//! Manual entry and scanned bills both come through `insert_draft`.

use std::collections::HashMap;

use axum::{Extension, Json, extract::State};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_core::procurement::{GoodsReceiptNote, GrnItem};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use medbrains_server_core::tenant_config::setting_i32;
use medbrains_server_core::validation::ValidationErrors;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::grn_validate::{self as v, Issue, LineFacts, Rules, Severity};

/// Lines on one bill. A distributor bill runs to a few dozen; this bounds
/// the per-line work at posting.
pub const MAX_GRN_LINES: usize = 200;

#[derive(Debug, Clone, Deserialize)]
pub struct CreateGrnRequest {
    pub po_id: Uuid,
    pub store_location_id: Option<Uuid>,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub invoice_amount: Option<Decimal>,
    pub irn: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<CreateGrnItemInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateGrnItemInput {
    pub po_item_id: Option<Uuid>,
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub quantity_received: i32,
    pub quantity_accepted: i32,
    pub quantity_rejected: Option<i32>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub manufacture_date: Option<NaiveDate>,
    pub unit_price: Decimal,
    pub mrp: Option<Decimal>,
    pub ptr: Option<Decimal>,
    pub free_quantity: Option<i32>,
    pub discount_amount: Option<Decimal>,
    pub gst_rate: Option<Decimal>,
    pub hsn_code: Option<String>,
    pub rejection_reason: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GrnDetailResponse {
    pub grn: GoodsReceiptNote,
    pub items: Vec<GrnItem>,
    /// Non-blocking findings (e.g. GST differing from the catalogue).
    pub warnings: Vec<Issue>,
}

/// What the catalogue says about a received store item.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CatalogueFacts {
    pub store_id: Uuid,
    /// The live pharmacy drug this store item stocks, following merges.
    pub pharmacy_id: Option<Uuid>,
    pub hsn_code: Option<String>,
    pub gst_rate: Option<Decimal>,
}

/// Catalogue facts for every item on a bill, in one round trip.
pub async fn catalogue_facts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    ids: &[Uuid],
) -> Result<HashMap<Uuid, CatalogueFacts>, AppError> {
    let rows = sqlx::query_as::<_, CatalogueFacts>(
        "SELECT sc.id AS store_id, pc.pharmacy_id, pc.hsn_code, pc.gst_rate \
           FROM store_catalog sc \
           LEFT JOIN LATERAL ( \
                SELECT COALESCE(p.merged_into_id, p.id) AS pharmacy_id, p.hsn_code, p.gst_rate \
                  FROM pharmacy_catalog p \
                 WHERE p.store_catalog_id = sc.id AND p.tenant_id = sc.tenant_id \
                   AND (p.deleted_at IS NULL OR p.merged_into_id IS NOT NULL) \
                 ORDER BY (p.deleted_at IS NULL) DESC, p.created_at LIMIT 1) pc ON true \
          WHERE sc.tenant_id = $1 AND sc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(|r| (r.store_id, r)).collect())
}

/// The hospital's receiving rules, read once per request.
pub async fn load_rules(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Rules, AppError> {
    let days = setting_i32(
        tx,
        &tenant_id,
        v::MIN_SHELF_LIFE_DAYS_KEY,
        v::MIN_SHELF_LIFE_DAYS_DEFAULT,
    )
    .await?;
    let tolerance = setting_i32(
        tx,
        &tenant_id,
        v::TOTAL_TOLERANCE_KEY,
        v::TOTAL_TOLERANCE_DEFAULT,
    )
    .await?;
    let today =
        medbrains_server_core::hospital_time::tenant_local_today(&mut **tx, tenant_id).await?;
    Ok(Rules {
        today,
        min_shelf_life_days: i64::from(days),
        total_tolerance: Decimal::from(tolerance),
    })
}

/// Checks a line, given what the catalogue says about its item.
pub fn line_facts(item: &CreateGrnItemInput, facts: Option<&CatalogueFacts>) -> LineFacts {
    LineFacts {
        name: item.item_name.clone(),
        rate: item.unit_price,
        mrp: item.mrp,
        expiry: item.expiry_date,
        manufacture: item.manufacture_date,
        received: item.quantity_received,
        accepted: item.quantity_accepted,
        discount: item.discount_amount.unwrap_or_default(),
        gst_rate: item.gst_rate,
        hsn: item.hsn_code.clone(),
        catalogue_gst: facts.and_then(|f| Some((f.hsn_code.clone()?, f.gst_rate?))),
    }
}

/// Blocking findings become a 422; warnings are returned.
pub fn split_issues(issues: Vec<Issue>) -> Result<Vec<Issue>, AppError> {
    let (blocks, warns): (Vec<_>, Vec<_>) = issues
        .into_iter()
        .partition(|i| i.severity == Severity::Block);
    if blocks.is_empty() {
        return Ok(warns);
    }
    let mut errors = ValidationErrors::new();
    for b in blocks {
        errors.add(&b.field, b.message);
    }
    Err(AppError::ValidationFailed(errors))
}

/// 409 naming the GRN that already holds this supplier invoice (or IRN).
pub async fn reject_duplicate_invoice(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    vendor_id: Uuid,
    body: &CreateGrnRequest,
) -> Result<(), AppError> {
    let existing: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT grn_number, invoice_number FROM goods_receipt_notes \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND NOT legacy_duplicate \
            AND ((vendor_id = $2 AND invoice_no_norm = grn_invoice_no_norm($3) \
                  AND invoice_date IS NOT DISTINCT FROM $4) \
                 OR ($5::text IS NOT NULL AND irn = $5)) \
          LIMIT 1",
    )
    .bind(tenant_id)
    .bind(vendor_id)
    .bind(body.invoice_number.as_deref())
    .bind(body.invoice_date)
    .bind(body.irn.as_deref())
    .fetch_optional(&mut **tx)
    .await?;
    match existing {
        Some((grn_number, invoice)) => Err(AppError::Conflict(format!(
            "This supplier invoice ({}) is already entered on GRN {grn_number}.",
            invoice.unwrap_or_default()
        ))),
        None => Ok(()),
    }
}

fn check_shape(body: &CreateGrnRequest) -> Result<(), AppError> {
    let mut errors = ValidationErrors::new();
    if body.items.is_empty() || body.items.len() > MAX_GRN_LINES {
        errors.add(
            "items",
            format!("A GRN has between 1 and {MAX_GRN_LINES} lines"),
        );
    }
    let has_invoice = body
        .invoice_number
        .as_deref()
        .is_some_and(|s| !s.trim().is_empty());
    if has_invoice && body.invoice_date.is_none() {
        errors.add("invoice_date", "Enter the invoice date printed on the bill");
    }
    for (i, item) in body.items.iter().enumerate() {
        let rejected = item.quantity_rejected.unwrap_or(0);
        if item.quantity_received <= 0
            || item.quantity_accepted < 0
            || rejected < 0
            || item.quantity_accepted + rejected > item.quantity_received
        {
            errors.add(
                &format!("items[{i}].quantity_accepted"),
                "Accepted and rejected cannot exceed received",
            );
        }
        if item.free_quantity.unwrap_or(0) < 0 || item.unit_price < Decimal::ZERO {
            errors.add(
                &format!("items[{i}].unit_price"),
                "Quantities and prices cannot be negative",
            );
        }
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }
    Ok(())
}

fn check_pharmacy_lines(
    body: &CreateGrnRequest,
    facts: &HashMap<Uuid, CatalogueFacts>,
) -> Result<(), AppError> {
    let mut errors = ValidationErrors::new();
    for (i, item) in body.items.iter().enumerate() {
        let is_drug = item
            .catalog_item_id
            .and_then(|id| facts.get(&id))
            .is_some_and(|f| f.pharmacy_id.is_some());
        if !is_drug || item.quantity_accepted == 0 {
            continue;
        }
        if item
            .batch_number
            .as_deref()
            .is_none_or(|b| b.trim().is_empty())
        {
            errors.add(
                &format!("items[{i}].batch_number"),
                "A drug line needs its batch number",
            );
        }
        if item.expiry_date.is_none() {
            errors.add(
                &format!("items[{i}].expiry_date"),
                "A drug line needs its expiry date",
            );
        }
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }
    Ok(())
}

/// PO lines named on the bill must belong to this PO and have room for what
/// is received (two batches of one PO line are summed).
async fn check_po_room(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    body: &CreateGrnRequest,
) -> Result<(), AppError> {
    let mut wanted: HashMap<Uuid, i64> = HashMap::new();
    for item in &body.items {
        if let Some(id) = item.po_item_id {
            *wanted.entry(id).or_default() += i64::from(item.quantity_accepted);
        }
    }
    let ids: Vec<Uuid> = wanted.keys().copied().collect();
    let room: HashMap<Uuid, i64> = sqlx::query_as::<_, (Uuid, i64)>(
        "SELECT id, (quantity_ordered - quantity_received)::bigint FROM purchase_order_items \
          WHERE tenant_id = $1 AND po_id = $2 AND id = ANY($3)",
    )
    .bind(tenant_id)
    .bind(body.po_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .collect();
    for (id, qty) in &wanted {
        if room.get(id).is_none_or(|left| qty > left) {
            return Err(AppError::BadRequest(
                "A GRN line exceeds the quantity still open on the purchase order, or names \
                 a line that is not on it."
                    .to_owned(),
            ));
        }
    }
    Ok(())
}

async fn require_store_choice(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    store: Option<Uuid>,
) -> Result<(), AppError> {
    if store.is_some() {
        return Ok(());
    }
    // Stock that belongs to no store can be neither issued nor moved.
    let has_stores: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM store_locations \
          WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if has_stores {
        let mut errors = ValidationErrors::new();
        errors.add("store_location_id", "Choose the store receiving this stock");
        return Err(AppError::ValidationFailed(errors));
    }
    Ok(())
}

/// Write a checked draft GRN. Moves no stock and no PO quantities.
pub async fn insert_draft(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateGrnRequest,
) -> Result<(GoodsReceiptNote, Vec<Issue>), AppError> {
    check_shape(body)?;
    let tenant_id = claims.tenant_id;
    let vendor_id: Uuid = sqlx::query_scalar(
        "SELECT vendor_id FROM purchase_orders WHERE id = $1 AND tenant_id = $2 \
           AND status IN ('sent_to_vendor', 'partially_received')",
    )
    .bind(body.po_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("PO not found or not in receivable status".into()))?;
    require_store_choice(tx, tenant_id, body.store_location_id).await?;
    reject_duplicate_invoice(tx, tenant_id, vendor_id, body).await?;
    check_po_room(tx, tenant_id, body).await?;

    let ids: Vec<Uuid> = body
        .items
        .iter()
        .filter_map(|i| i.catalog_item_id)
        .collect();
    let facts = catalogue_facts(tx, tenant_id, &ids).await?;
    check_pharmacy_lines(body, &facts)?;
    let rules = load_rules(tx, tenant_id).await?;
    let lines: Vec<LineFacts> = body
        .items
        .iter()
        .map(|i| line_facts(i, i.catalog_item_id.and_then(|id| facts.get(&id))))
        .collect();
    let warnings = split_issues(v::check_bill(&lines, body.invoice_amount, &rules))?;

    let grn_number = medbrains_db::sequence::next_sequence(tx, tenant_id, "GRN", "GRN-", 6).await?;
    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "INSERT INTO goods_receipt_notes \
         (tenant_id, grn_number, po_id, vendor_id, store_location_id, invoice_number, \
          invoice_date, invoice_amount, irn, notes, received_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
    )
    .bind(tenant_id)
    .bind(&grn_number)
    .bind(body.po_id)
    .bind(vendor_id)
    .bind(body.store_location_id)
    .bind(body.invoice_number.as_deref().map(str::trim))
    .bind(body.invoice_date)
    .bind(body.invoice_amount)
    .bind(body.irn.as_deref().map(str::to_lowercase))
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    crate::grn_lines::insert_lines(tx, tenant_id, grn.id, &body.items, &lines).await?;
    let grn = sqlx::query_as::<_, GoodsReceiptNote>(
        "UPDATE goods_receipt_notes SET total_amount = \
            (SELECT COALESCE(SUM(total_amount), 0) FROM grn_items \
              WHERE grn_id = $1 AND tenant_id = $2 AND deleted_at IS NULL) \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(grn.id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok((grn, warnings))
}

pub async fn load_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    grn_id: Uuid,
) -> Result<Vec<GrnItem>, AppError> {
    Ok(sqlx::query_as::<_, GrnItem>(
        "SELECT * FROM grn_items WHERE grn_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          ORDER BY created_at, id LIMIT 500",
    )
    .bind(grn_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// `POST /api/procurement/grns` — enter a GRN as a draft. Stock moves when
/// it is posted (`PUT …/{id}/complete`).
pub async fn create_grn(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGrnRequest>,
) -> Result<Json<GrnDetailResponse>, AppError> {
    require_permission(&claims, permissions::procurement::grn::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let (grn, warnings) = insert_draft(&mut tx, &claims, &body).await?;
    let items = load_items(&mut tx, claims.tenant_id, grn.id).await?;
    tx.commit().await?;
    Ok(Json(GrnDetailResponse {
        grn,
        items,
        warnings,
    }))
}

//! Print data routes for Admin & Procurement forms.
//!
//! Phase 4 implementation - 10 endpoints:
//! - Indent Form
//! - Purchase Order
//! - Goods Receipt Note (GRN)
//! - Material Issue Voucher
//! - Stock Transfer Note
//! - NDPS Controlled Substance Register
//! - Drug Expiry Alert List
//! - Equipment Condemnation Form
//! - Work Order Form
//! - Preventive Maintenance Checklist

use axum::Extension;
use axum::extract::{Path, State};
use axum::routing::get;
use medbrains_core::permissions;
use medbrains_core::print_data::{
    DispensingLabelPrintData, DrugExpiryAlertPrintData, EquipmentCondemnationPrintData,
    ExpiryDrugItem, GrnItem, GrnPrintData, IndentFormPrintData, IndentItem, IssueItem,
    MaterialIssueVoucherPrintData, NdpsBalance, NdpsRegisterPrintData, NdpsTransaction,
    PmChecklistItem, PmChecklistPrintData, PoItem, PurchaseOrderPrintData,
    StockTransferNotePrintData, TransferItem, WorkOrderPrintData,
};
use uuid::Uuid;

use medbrains_core::form::FieldAccessLevel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::middleware::field_access;
use medbrains_server_core::state::AppState;

// ══════════════════════════════════════════════════════════
// Indent Form — `indent_requisitions.id`
// ══════════════════════════════════════════════════════════

pub async fn get_indent_form_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(indent_id): Path<Uuid>,
) -> Result<axum::Json<IndentFormPrintData>, AppError> {
    require_permission(&claims, permissions::indent::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let indent = sqlx::query_as::<_, IndentHeaderRow>(
        r"
        SELECT
            ir.indent_number,
            ir.created_at::date::text AS indent_date,
            ir.indent_type,
            ir.priority,
            d.name AS requesting_department,
            u.full_name AS requested_by,
            ir.total_amount::float8 AS estimated_value,
            ir.notes AS justification,
            ua.full_name AS approved_by,
            ir.approved_at::text AS approved_at,
            ir.status,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM indent_requisitions ir
        JOIN departments d ON d.id = ir.department_id
        JOIN users u ON u.id = ir.requested_by
        LEFT JOIN users ua ON ua.id = ir.approved_by
        JOIN tenants t ON t.id = ir.tenant_id
        WHERE ir.id = $1 AND ir.deleted_at IS NULL
        ",
    )
    .bind(indent_id)
    .fetch_one(&mut *conn)
    .await?;

    // `quantity_approved` defaults to 0 before approval; printing that on an
    // unapproved indent would read as "approved: nil", so it is only shown
    // once the indent carries an approval.
    let items = sqlx::query_as::<_, IndentItemRow>(
        r"
        SELECT
            COALESCE(sc.code, '') AS item_code,
            ii.item_name,
            COALESCE(sc.unit, '') AS unit,
            ii.quantity_requested::float8 AS quantity_requested,
            CASE WHEN ir.approved_at IS NOT NULL THEN ii.quantity_approved::float8 END
                AS quantity_approved,
            sc.current_stock::float8 AS current_stock,
            ii.notes AS remarks
        FROM indent_items ii
        JOIN indent_requisitions ir ON ir.id = ii.requisition_id
        LEFT JOIN store_catalog sc ON sc.id = ii.catalog_item_id
        WHERE ii.requisition_id = $1 AND ii.deleted_at IS NULL
        ORDER BY ii.created_at, ii.id
        LIMIT 500
        ",
    )
    .bind(indent_id)
    .fetch_all(&mut *conn)
    .await?;

    let indent_items: Vec<IndentItem> = items
        .into_iter()
        .map(|r| IndentItem {
            item_code: r.item_code,
            item_name: r.item_name,
            // ponytail: specification not recorded on indent lines yet
            specification: None,
            unit: r.unit,
            quantity_requested: r.quantity_requested,
            quantity_approved: r.quantity_approved,
            current_stock: r.current_stock,
            remarks: r.remarks,
        })
        .collect();

    let total_items = i32::try_from(indent_items.len()).unwrap_or(0);

    Ok(axum::Json(IndentFormPrintData {
        indent_number: indent.indent_number,
        indent_date: indent.indent_date,
        indent_type: indent.indent_type,
        priority: indent.priority,
        requesting_department: indent.requesting_department,
        // ponytail: an indent names a department, not a store — nothing records one
        requesting_store: None,
        requested_by: indent.requested_by,
        items: indent_items,
        total_items,
        estimated_value: indent.estimated_value,
        justification: indent.justification,
        approved_by: indent.approved_by,
        approved_at: indent.approved_at,
        status: indent.status,
        hospital_name: indent.hospital_name,
        hospital_logo_url: indent.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct IndentHeaderRow {
    indent_number: String,
    indent_date: String,
    indent_type: String,
    priority: String,
    requesting_department: String,
    requested_by: String,
    estimated_value: Option<f64>,
    justification: Option<String>,
    approved_by: Option<String>,
    approved_at: Option<String>,
    status: String,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct IndentItemRow {
    item_code: String,
    item_name: String,
    unit: String,
    quantity_requested: f64,
    quantity_approved: Option<f64>,
    current_stock: Option<f64>,
    remarks: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Purchase Order — `purchase_orders.id`
// ══════════════════════════════════════════════════════════

pub async fn get_purchase_order_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(po_id): Path<Uuid>,
) -> Result<axum::Json<PurchaseOrderPrintData>, AppError> {
    require_permission(&claims, permissions::procurement::purchase_orders::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // The hospital's GSTIN and billing address live in `tenant_settings`
    // (billing/gst_number, billing/bill_address) — the same source the GST
    // invoice prints from — with the tenant's own address as the fallback.
    let po = sqlx::query_as::<_, PoHeaderRow>(
        r"
        SELECT
            po.po_number,
            COALESCE(po.po_date, po.order_date)::text AS po_date,
            v.name AS vendor_name,
            COALESCE(
                NULLIF(v.address, ''),
                NULLIF(concat_ws(', ', NULLIF(v.address_line1, ''), NULLIF(v.address_line2, ''),
                                 NULLIF(v.city, ''), NULLIF(v.state, ''), NULLIF(v.pincode, '')), '')
            ) AS vendor_address,
            v.gst_number AS vendor_gstin,
            v.phone AS vendor_contact,
            COALESCE(NULLIF(concat_ws(', ', sl.name, NULLIF(sl.address, '')), ''), '')
                AS delivery_address,
            po.expected_delivery::text AS delivery_date,
            po.payment_terms,
            po.delivery_terms,
            po.subtotal::float8 AS subtotal,
            po.discount_amount::float8 AS discount_amount,
            po.tax_amount::float8 AS tax_amount,
            po.total_amount::float8 AS total_amount,
            up.full_name AS prepared_by,
            ua.full_name AS approved_by,
            t.name AS hospital_name,
            COALESCE(
                NULLIF(addr.value #>> '{}', ''),
                NULLIF(concat_ws(', ', NULLIF(t.address_line1, ''), NULLIF(t.address_line2, ''),
                                 NULLIF(t.city, ''), NULLIF(t.pincode, '')), '')
            ) AS hospital_address,
            NULLIF(gst.value #>> '{}', '') AS hospital_gstin,
            t.logo_url AS hospital_logo_url
        FROM purchase_orders po
        JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN store_locations sl ON sl.id = po.store_location_id
        LEFT JOIN users up ON up.id = po.created_by
        LEFT JOIN users ua ON ua.id = po.approved_by
        JOIN tenants t ON t.id = po.tenant_id
        LEFT JOIN tenant_settings gst ON gst.tenant_id = po.tenant_id AND gst.category = 'billing'
             AND gst.key = 'gst_number' AND gst.deleted_at IS NULL
        LEFT JOIN tenant_settings addr ON addr.tenant_id = po.tenant_id AND addr.category = 'billing'
             AND addr.key = 'bill_address' AND addr.deleted_at IS NULL
        WHERE po.id = $1 AND po.deleted_at IS NULL
        ",
    )
    .bind(po_id)
    .fetch_one(&mut *conn)
    .await?;

    let items = sqlx::query_as::<_, PoItemRow>(
        r"
        SELECT
            COALESCE(poi.item_code, sc.code, pc.code, '') AS item_code,
            poi.item_name,
            COALESCE(sc.hsn_code, pc.hsn_code) AS hsn_code,
            poi.unit,
            poi.quantity_ordered::float8 AS quantity,
            poi.unit_price::float8 AS unit_price,
            poi.tax_percent::float8 AS tax_rate,
            poi.total_amount::float8 AS amount
        FROM purchase_order_items poi
        LEFT JOIN store_catalog sc ON sc.id = poi.catalog_item_id
        LEFT JOIN pharmacy_catalog pc ON pc.id = poi.pharmacy_catalog_id
        WHERE poi.po_id = $1 AND poi.deleted_at IS NULL
        ORDER BY poi.created_at, poi.id
        LIMIT 500
        ",
    )
    .bind(po_id)
    .fetch_all(&mut *conn)
    .await?;

    let po_items: Vec<PoItem> = items
        .into_iter()
        .map(|r| PoItem {
            item_code: r.item_code,
            item_name: r.item_name,
            // ponytail: specification not recorded on PO lines yet
            specification: None,
            hsn_code: r.hsn_code,
            unit: r.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
            tax_rate: r.tax_rate,
            amount: r.amount,
        })
        .collect();

    let amount_in_words = amount_to_words(po.total_amount);

    Ok(axum::Json(PurchaseOrderPrintData {
        po_number: po.po_number,
        po_date: po.po_date,
        vendor_name: po.vendor_name,
        vendor_address: po.vendor_address,
        vendor_gstin: po.vendor_gstin,
        vendor_contact: po.vendor_contact,
        delivery_address: po.delivery_address,
        delivery_date: po.delivery_date,
        payment_terms: po.payment_terms,
        items: po_items,
        subtotal: po.subtotal,
        // ponytail: PO header keeps only a discount amount; freight not recorded anywhere yet
        discount_percentage: None,
        discount_amount: po.discount_amount,
        tax_amount: po.tax_amount,
        freight_charges: None,
        total_amount: po.total_amount,
        amount_in_words,
        // The PO's delivery terms are the only term it records.
        terms_and_conditions: po.delivery_terms.into_iter().collect(),
        prepared_by: po.prepared_by,
        approved_by: po.approved_by,
        hospital_name: po.hospital_name,
        hospital_address: po.hospital_address,
        hospital_gstin: po.hospital_gstin,
        hospital_logo_url: po.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct PoHeaderRow {
    po_number: String,
    po_date: String,
    vendor_name: String,
    vendor_address: Option<String>,
    vendor_gstin: Option<String>,
    vendor_contact: Option<String>,
    delivery_address: String,
    delivery_date: Option<String>,
    payment_terms: Option<String>,
    delivery_terms: Option<String>,
    subtotal: f64,
    discount_amount: f64,
    tax_amount: f64,
    total_amount: f64,
    prepared_by: Option<String>,
    approved_by: Option<String>,
    hospital_name: String,
    hospital_address: Option<String>,
    hospital_gstin: Option<String>,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct PoItemRow {
    item_code: String,
    item_name: String,
    hsn_code: Option<String>,
    unit: String,
    quantity: f64,
    unit_price: f64,
    tax_rate: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// Goods Receipt Note (GRN) — `goods_receipt_notes.id`
// ══════════════════════════════════════════════════════════

pub async fn get_grn_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(grn_id): Path<Uuid>,
) -> Result<axum::Json<GrnPrintData>, AppError> {
    require_permission(&claims, permissions::procurement::grn::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // "Quality check done" is the GRN's recorded inspection (`inspected_at`),
    // never assumed.
    let grn = sqlx::query_as::<_, GrnHeaderRow>(
        r"
        SELECT
            g.grn_number,
            g.receipt_date::text AS grn_date,
            po.po_number,
            COALESCE(po.po_date, po.order_date)::text AS po_date,
            v.name AS vendor_name,
            g.invoice_number AS vendor_invoice_number,
            g.invoice_date::text AS vendor_invoice_date,
            COALESCE(sl.name, '') AS receiving_store,
            g.inspected_at IS NOT NULL AS quality_check_done,
            g.notes AS quality_remarks,
            u.full_name AS received_by,
            ui.full_name AS verified_by,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM goods_receipt_notes g
        LEFT JOIN purchase_orders po ON po.id = g.po_id
        JOIN vendors v ON v.id = g.vendor_id
        LEFT JOIN store_locations sl ON sl.id = g.store_location_id
        JOIN users u ON u.id = g.received_by
        LEFT JOIN users ui ON ui.id = g.inspected_by
        JOIN tenants t ON t.id = g.tenant_id
        WHERE g.id = $1 AND g.deleted_at IS NULL
        ",
    )
    .bind(grn_id)
    .fetch_one(&mut *conn)
    .await?;

    let items = sqlx::query_as::<_, GrnItemRow>(
        r"
        SELECT
            COALESCE(sc.code, poi.item_code, '') AS item_code,
            gi.item_name,
            gi.batch_number,
            gi.expiry_date::text AS expiry_date,
            gi.manufacture_date::text AS manufacturing_date,
            COALESCE(poi.unit, sc.unit, '') AS unit,
            poi.quantity_ordered::float8 AS quantity_ordered,
            gi.quantity_received::float8 AS quantity_received,
            gi.quantity_accepted::float8 AS quantity_accepted,
            gi.quantity_rejected::float8 AS quantity_rejected,
            gi.rejection_reason,
            gi.unit_price::float8 AS unit_price,
            gi.total_amount::float8 AS amount
        FROM grn_items gi
        LEFT JOIN purchase_order_items poi ON poi.id = gi.po_item_id
        LEFT JOIN store_catalog sc ON sc.id = gi.catalog_item_id
        WHERE gi.grn_id = $1 AND gi.deleted_at IS NULL
        ORDER BY gi.created_at, gi.id
        LIMIT 500
        ",
    )
    .bind(grn_id)
    .fetch_all(&mut *conn)
    .await?;

    let grn_items: Vec<GrnItem> = items
        .into_iter()
        .map(|r| GrnItem {
            item_code: r.item_code,
            item_name: r.item_name,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
            manufacturing_date: r.manufacturing_date,
            unit: r.unit,
            // A GRN line with no PO line has no ordered quantity.
            quantity_ordered: r.quantity_ordered,
            quantity_received: r.quantity_received,
            quantity_accepted: r.quantity_accepted,
            quantity_rejected: r.quantity_rejected,
            rejection_reason: r.rejection_reason,
            unit_price: r.unit_price,
            amount: r.amount,
        })
        .collect();

    let total_items = i32::try_from(grn_items.len()).unwrap_or(0);
    let total_quantity: f64 = grn_items.iter().map(|i| i.quantity_received).sum();
    let total_value: f64 = grn_items.iter().map(|i| i.amount).sum();

    Ok(axum::Json(GrnPrintData {
        grn_number: grn.grn_number,
        grn_date: grn.grn_date,
        po_number: grn.po_number,
        po_date: grn.po_date,
        vendor_name: grn.vendor_name,
        vendor_invoice_number: grn.vendor_invoice_number,
        vendor_invoice_date: grn.vendor_invoice_date,
        // ponytail: delivery challan number not recorded anywhere yet
        challan_number: None,
        receiving_store: grn.receiving_store,
        items: grn_items,
        total_items,
        total_quantity,
        total_value,
        quality_check_done: grn.quality_check_done,
        quality_remarks: grn.quality_remarks,
        received_by: grn.received_by,
        verified_by: grn.verified_by,
        hospital_name: grn.hospital_name,
        hospital_logo_url: grn.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct GrnHeaderRow {
    grn_number: String,
    grn_date: String,
    po_number: Option<String>,
    po_date: Option<String>,
    vendor_name: String,
    vendor_invoice_number: Option<String>,
    vendor_invoice_date: Option<String>,
    receiving_store: String,
    quality_check_done: bool,
    quality_remarks: Option<String>,
    received_by: String,
    verified_by: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct GrnItemRow {
    item_code: String,
    item_name: String,
    batch_number: Option<String>,
    expiry_date: Option<String>,
    manufacturing_date: Option<String>,
    unit: String,
    quantity_ordered: Option<f64>,
    quantity_received: f64,
    quantity_accepted: f64,
    quantity_rejected: f64,
    rejection_reason: Option<String>,
    unit_price: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// Material Issue Voucher — `indent_requisitions.id`
// ══════════════════════════════════════════════════════════

/// The store issues against an indent: `indent_items.quantity_issued` plus an
/// `issue` row in `store_stock_movements` (reference_type `indent`) per line.
/// There is no separate voucher table, so the indent *is* the voucher.
pub async fn get_material_issue_voucher_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(indent_id): Path<Uuid>,
) -> Result<axum::Json<MaterialIssueVoucherPrintData>, AppError> {
    require_permission(&claims, permissions::indent::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // Only an indent the store has actually issued against has a voucher.
    let voucher = sqlx::query_as::<_, IssueVoucherHeaderRow>(
        r"
        SELECT
            ir.indent_number AS voucher_number,
            last_issue.created_at::date::text AS voucher_date,
            ir.indent_type AS issue_type,
            d.name AS receiving_department,
            ur.full_name AS requested_by,
            ui.full_name AS issued_by,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM indent_requisitions ir
        JOIN departments d ON d.id = ir.department_id
        JOIN users ur ON ur.id = ir.requested_by
        JOIN tenants t ON t.id = ir.tenant_id
        LEFT JOIN LATERAL (
            SELECT m.created_at, m.created_by
            FROM store_stock_movements m
            WHERE m.reference_type = 'indent' AND m.reference_id = ir.id
              AND m.movement_type = 'issue' AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
            LIMIT 1
        ) last_issue ON true
        LEFT JOIN users ui ON ui.id = last_issue.created_by
        WHERE ir.id = $1 AND ir.deleted_at IS NULL
          AND ir.status IN ('issued', 'partially_issued')
        ",
    )
    .bind(indent_id)
    .fetch_one(&mut *conn)
    .await?;

    let items = sqlx::query_as::<_, IssueItemRow>(
        r"
        SELECT
            COALESCE(sc.code, '') AS item_code,
            ii.item_name,
            COALESCE(sc.unit, '') AS unit,
            ii.quantity_requested::float8 AS quantity_requested,
            ii.quantity_issued::float8 AS quantity_issued,
            ii.unit_price::float8 AS unit_price,
            (ii.quantity_issued * ii.unit_price)::float8 AS amount
        FROM indent_items ii
        LEFT JOIN store_catalog sc ON sc.id = ii.catalog_item_id
        WHERE ii.requisition_id = $1 AND ii.deleted_at IS NULL
          AND ii.quantity_issued > 0
        ORDER BY ii.created_at, ii.id
        LIMIT 500
        ",
    )
    .bind(indent_id)
    .fetch_all(&mut *conn)
    .await?;

    let issue_items: Vec<IssueItem> = items
        .into_iter()
        .map(|r| IssueItem {
            item_code: r.item_code,
            item_name: r.item_name,
            // ponytail: indent issue records no batch — batch/expiry not recorded yet
            batch_number: None,
            expiry_date: None,
            unit: r.unit,
            quantity_requested: r.quantity_requested,
            quantity_issued: r.quantity_issued,
            unit_price: r.unit_price,
            amount: r.amount,
        })
        .collect();

    let total_items = i32::try_from(issue_items.len()).unwrap_or(0);
    let total_value: f64 = issue_items.iter().map(|i| i.amount).sum();

    Ok(axum::Json(MaterialIssueVoucherPrintData {
        voucher_number: voucher.voucher_number,
        voucher_date: voucher.voucher_date.unwrap_or_default(),
        issue_type: voucher.issue_type,
        // ponytail: issuing store, cost centre, purpose, receipt not recorded on an issue yet
        issuing_store: None,
        receiving_department: voucher.receiving_department,
        receiving_cost_center: None,
        requested_by: voucher.requested_by,
        items: issue_items,
        total_items,
        total_value,
        purpose: None,
        issued_by: voucher.issued_by.unwrap_or_default(),
        received_by: None,
        received_at: None,
        hospital_name: voucher.hospital_name,
        hospital_logo_url: voucher.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct IssueVoucherHeaderRow {
    voucher_number: String,
    voucher_date: Option<String>,
    issue_type: String,
    receiving_department: String,
    requested_by: String,
    issued_by: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct IssueItemRow {
    item_code: String,
    item_name: String,
    unit: String,
    quantity_requested: f64,
    quantity_issued: f64,
    unit_price: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// Stock Transfer Note — `pharmacy_transfer_requests.id`
// ══════════════════════════════════════════════════════════

/// Field-level restrictions the pharmacy transfer API applies to the same lines.
const PRICE_FIELD: &str = "pharmacy.pricing.unit_price";
const BATCH_FIELD: &str = "pharmacy.batches.batch_number";

/// The only store-to-store transfer the product writes is the pharmacy one.
/// Lines are the dispatched lines once dispatched (batch, expiry, unit cost),
/// else the requested lines.
pub async fn get_stock_transfer_note_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfer_id): Path<Uuid>,
) -> Result<axum::Json<StockTransferNotePrintData>, AppError> {
    // The same gate the pharmacy transfer list uses.
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::stores::LIST,
            permissions::pharmacy::stores::MANAGE,
        ],
    )?;
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let is_open = |field: &str| {
        !matches!(
            restricted.get(field),
            Some(FieldAccessLevel::Mask | FieldAccessLevel::Hidden)
        )
    };
    let (show_price, show_batch) = (is_open(PRICE_FIELD), is_open(BATCH_FIELD));

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let transfer = sqlx::query_as::<_, TransferHeaderRow>(
        r"
        SELECT
            r.id::text AS transfer_number,
            r.created_at::date::text AS transfer_date,
            sf.name AS from_store,
            sto.name AS to_store,
            r.notes AS reason,
            ui.full_name AS initiated_by,
            ud.full_name AS dispatched_by,
            r.dispatched_at::text AS dispatched_at,
            ur.full_name AS received_by,
            r.received_at::text AS received_at,
            r.status,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM pharmacy_transfer_requests r
        JOIN store_locations sf ON sf.id = r.from_location_id
        JOIN store_locations sto ON sto.id = r.to_location_id
        JOIN users ui ON ui.id = r.requested_by
        LEFT JOIN users ud ON ud.id = r.dispatched_by
        LEFT JOIN users ur ON ur.id = r.received_by
        JOIN tenants t ON t.id = r.tenant_id
        WHERE r.id = $1 AND r.deleted_at IS NULL
        ",
    )
    .bind(transfer_id)
    .fetch_one(&mut *conn)
    .await?;

    let items = sqlx::query_as::<_, TransferItemRow>(
        r"
        SELECT
            COALESCE(pc.code, '') AS item_code,
            COALESCE(pc.name, '') AS item_name,
            l->>'batch_number' AS batch_number,
            l->>'expiry_date' AS expiry_date,
            COALESCE(pc.unit, '') AS unit,
            (l->>'quantity')::float8 AS quantity,
            (l->>'unit_cost')::float8 AS unit_price
        FROM pharmacy_transfer_requests r
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_array_length(r.dispatched_lines) > 0
                 THEN r.dispatched_lines ELSE r.items END
        ) WITH ORDINALITY AS x(l, n)
        LEFT JOIN pharmacy_catalog pc ON pc.id = (l->>'catalog_item_id')::uuid
        WHERE r.id = $1 AND r.deleted_at IS NULL
        ORDER BY n
        LIMIT 500
        ",
    )
    .bind(transfer_id)
    .fetch_all(&mut *conn)
    .await?;

    // No recorded (or a restricted) unit cost prints blank, not 0. The note's
    // total sums only the priced lines.
    let transfer_items: Vec<TransferItem> = items
        .into_iter()
        .map(|r| {
            let unit_price = r.unit_price.filter(|_| show_price);
            TransferItem {
                item_code: r.item_code,
                item_name: r.item_name,
                batch_number: r.batch_number.filter(|_| show_batch),
                expiry_date: r.expiry_date,
                unit: r.unit,
                quantity: r.quantity,
                unit_price,
                amount: unit_price.map(|p| r.quantity * p),
            }
        })
        .collect();

    let total_items = i32::try_from(transfer_items.len()).unwrap_or(0);
    let total_value: f64 = transfer_items.iter().filter_map(|i| i.amount).sum();

    Ok(axum::Json(StockTransferNotePrintData {
        transfer_number: transfer.transfer_number,
        transfer_date: transfer.transfer_date,
        from_store: transfer.from_store,
        to_store: transfer.to_store,
        // ponytail: transfer type not recorded on a pharmacy transfer
        transfer_type: None,
        items: transfer_items,
        total_items,
        total_value,
        reason: transfer.reason,
        initiated_by: transfer.initiated_by,
        dispatched_by: transfer.dispatched_by,
        dispatched_at: transfer.dispatched_at,
        received_by: transfer.received_by,
        received_at: transfer.received_at,
        status: transfer.status,
        hospital_name: transfer.hospital_name,
        hospital_logo_url: transfer.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct TransferHeaderRow {
    transfer_number: String,
    transfer_date: String,
    from_store: String,
    to_store: String,
    reason: Option<String>,
    initiated_by: String,
    dispatched_by: Option<String>,
    dispatched_at: Option<String>,
    received_by: Option<String>,
    received_at: Option<String>,
    status: String,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct TransferItemRow {
    item_code: String,
    item_name: String,
    batch_number: Option<String>,
    expiry_date: Option<String>,
    unit: String,
    quantity: f64,
    unit_price: Option<f64>,
}

// ══════════════════════════════════════════════════════════
// NDPS Controlled Substance Register — period `YYYY-MM`
// ══════════════════════════════════════════════════════════

/// Running balance of each NDPS drug as of `months` after the start of the
/// period: the `balance_after` of its last register entry before that instant.
/// `months = 0` is the opening balance, `months = 1` the closing balance.
const NDPS_BALANCE_SQL: &str = r"
    SELECT drug_name, schedule, unit, quantity FROM (
        SELECT DISTINCT ON (r.catalog_item_id)
            COALESCE(pc.inn_name, pc.generic_name, pc.name) AS drug_name,
            COALESCE(pc.drug_schedule, '') AS schedule,
            COALESCE(pc.unit, '') AS unit,
            r.balance_after::float8 AS quantity
        FROM pharmacy_ndps_register r
        JOIN pharmacy_catalog pc ON pc.id = r.catalog_item_id
        WHERE r.deleted_at IS NULL
          AND r.created_at < to_date($1, 'YYYY-MM') + make_interval(months => $2)
        ORDER BY r.catalog_item_id, r.created_at DESC, r.id DESC
    ) b
    ORDER BY drug_name
    LIMIT 1000
";

pub async fn get_ndps_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(period): Path<String>,
) -> Result<axum::Json<NdpsRegisterPrintData>, AppError> {
    // The NDPS register is a statutory narcotics record under the NDPS Act
    // 1985. Printing it is a controlled-substance disclosure.
    require_permission(&claims, permissions::pharmacy::ndps::LIST)?;

    // Validate before it reaches `to_date`, which would answer a bad month
    // with a 500 instead of a 400.
    if period.len() != 7
        || chrono::NaiveDate::parse_from_str(&format!("{period}-01"), "%Y-%m-%d").is_err()
    {
        return Err(AppError::BadRequest(
            "Invalid period format. Use YYYY-MM".to_string(),
        ));
    }

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let hospital = sqlx::query_as::<_, HospitalRow>(
        "SELECT name AS hospital_name, logo_url AS hospital_logo_url FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *conn)
    .await?;

    let opening_balance = sqlx::query_as::<_, NdpsBalanceRow>(NDPS_BALANCE_SQL)
        .bind(&period)
        .bind(0_i32)
        .fetch_all(&mut *conn)
        .await?;

    // The prescriber is the doctor on the prescription the entry dispensed
    // against; the witness is the second signatory recorded on the entry.
    let transactions = sqlx::query_as::<_, NdpsTransactionRow>(
        r"
        SELECT
            r.created_at::text AS transaction_date,
            COALESCE(pc.inn_name, pc.generic_name, pc.name) AS drug_name,
            r.action::text AS transaction_type,
            r.quantity::float8 AS quantity,
            r.balance_after::float8 AS balance_after,
            NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS patient_name,
            p.uhid AS patient_uhid,
            ud.full_name AS prescribing_doctor,
            uw.full_name AS witness_name,
            concat_ws(' / ', r.register_number, r.page_number) AS reference_number
        FROM pharmacy_ndps_register r
        JOIN pharmacy_catalog pc ON pc.id = r.catalog_item_id
        LEFT JOIN patients p ON p.id = r.patient_id
        LEFT JOIN prescriptions rx ON rx.id = r.prescription_id
        LEFT JOIN users ud ON ud.id = rx.doctor_id
        LEFT JOIN users uw ON uw.id = r.witnessed_by
        WHERE r.deleted_at IS NULL
          AND r.created_at >= to_date($1, 'YYYY-MM')
          AND r.created_at < to_date($1, 'YYYY-MM') + interval '1 month'
        ORDER BY r.created_at, r.id
        LIMIT 5000
        ",
    )
    .bind(&period)
    .fetch_all(&mut *conn)
    .await?;

    let closing_balance = sqlx::query_as::<_, NdpsBalanceRow>(NDPS_BALANCE_SQL)
        .bind(&period)
        .bind(1_i32)
        .fetch_all(&mut *conn)
        .await?;

    // ponytail: the register is kept per drug, not per batch — batch_number not recorded yet
    let to_balance = |r: NdpsBalanceRow| NdpsBalance {
        drug_name: r.drug_name,
        schedule: r.schedule,
        batch_number: None,
        unit: r.unit,
        quantity: r.quantity,
    };

    let txns: Vec<NdpsTransaction> = transactions
        .into_iter()
        .map(|r| NdpsTransaction {
            transaction_date: r.transaction_date,
            drug_name: r.drug_name,
            batch_number: None,
            transaction_type: r.transaction_type,
            quantity: r.quantity,
            balance_after: r.balance_after,
            patient_name: r.patient_name,
            patient_uhid: r.patient_uhid,
            prescribing_doctor: r.prescribing_doctor,
            witness_name: r.witness_name,
            reference_number: r.reference_number,
        })
        .collect();

    Ok(axum::Json(NdpsRegisterPrintData {
        report_period: period,
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%Y-%m-%d")
            .to_string(),
        // ponytail: NDPS store, licence and register officer not recorded anywhere yet
        store_name: None,
        license_number: None,
        license_valid_until: None,
        opening_balance: opening_balance.into_iter().map(to_balance).collect(),
        transactions: txns,
        closing_balance: closing_balance.into_iter().map(to_balance).collect(),
        physical_verification_date: None,
        discrepancies: vec![],
        register_maintained_by: None,
        verified_by: None,
        hospital_name: hospital.hospital_name,
        hospital_logo_url: hospital.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct HospitalRow {
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct NdpsBalanceRow {
    drug_name: String,
    schedule: String,
    unit: String,
    quantity: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct NdpsTransactionRow {
    transaction_date: String,
    drug_name: String,
    transaction_type: String,
    quantity: f64,
    balance_after: f64,
    patient_name: Option<String>,
    patient_uhid: Option<String>,
    prescribing_doctor: Option<String>,
    witness_name: Option<String>,
    reference_number: String,
}

// ══════════════════════════════════════════════════════════
// Drug Expiry Alert List — `store_locations.id`
// ══════════════════════════════════════════════════════════

/// Pharmacy batches with stock at one store whose days-to-expiry fall in
/// `[$2, $3]`. Value uses the batch purchase rate, else the catalogue cost.
const EXPIRY_BATCHES_SQL: &str = r"
    SELECT
        pc.code AS item_code,
        COALESCE(pc.inn_name, pc.generic_name, pc.name) AS drug_name,
        pb.batch_number,
        pb.expiry_date::text AS expiry_date,
        (pb.expiry_date - CURRENT_DATE) AS days_to_expiry,
        pb.quantity_on_hand::float8 AS quantity,
        COALESCE(pc.unit, '') AS unit,
        COALESCE(pb.purchase_rate, pc.cost_price, pc.purchase_price)::float8 AS unit_price,
        pc.manufacturer,
        v.name AS supplier,
        sl.name AS location
    FROM pharmacy_batches pb
    JOIN pharmacy_catalog pc ON pc.id = pb.catalog_item_id
    JOIN store_locations sl ON sl.id = pb.store_location_id
    LEFT JOIN vendors v ON v.id = pb.vendor_id
    WHERE pb.store_location_id = $1
      AND pb.deleted_at IS NULL
      AND pb.quantity_on_hand > 0
      AND (pb.expiry_date - CURRENT_DATE) BETWEEN $2 AND $3
    ORDER BY pb.expiry_date, pb.batch_number
    LIMIT 1000
";

pub async fn get_drug_expiry_alert_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(store_id): Path<Uuid>,
) -> Result<axum::Json<DrugExpiryAlertPrintData>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let store = sqlx::query_as::<_, StoreInfoRow>(
        r"
        SELECT
            sl.name AS store_name,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM store_locations sl
        JOIN tenants t ON t.id = sl.tenant_id
        WHERE sl.id = $1 AND sl.deleted_at IS NULL
        ",
    )
    .bind(store_id)
    .fetch_one(&mut *conn)
    .await?;

    let alert_threshold_days: i32 = 90;

    let expired = sqlx::query_as::<_, ExpiryDrugRow>(EXPIRY_BATCHES_SQL)
        .bind(store_id)
        .bind(i32::MIN)
        .bind(-1_i32)
        .fetch_all(&mut *conn)
        .await?;

    let expiring_soon = sqlx::query_as::<_, ExpiryDrugRow>(EXPIRY_BATCHES_SQL)
        .bind(store_id)
        .bind(0_i32)
        .bind(alert_threshold_days)
        .fetch_all(&mut *conn)
        .await?;

    let expired_drugs: Vec<ExpiryDrugItem> = expired.into_iter().map(expiry_item).collect();
    let expiring: Vec<ExpiryDrugItem> = expiring_soon.into_iter().map(expiry_item).collect();

    // Totals sum only the batches that carry a price.
    let total_expired_value: f64 = expired_drugs.iter().filter_map(|d| d.total_value).sum();
    let total_expiring_value: f64 = expiring.iter().filter_map(|d| d.total_value).sum();

    Ok(axum::Json(DrugExpiryAlertPrintData {
        report_date: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%Y-%m-%d")
            .to_string(),
        store_name: store.store_name,
        alert_threshold_days,
        expired_drugs,
        expiring_soon: expiring,
        total_expired_value,
        total_expiring_value,
        prepared_by: None,
        hospital_name: store.hospital_name,
        hospital_logo_url: store.hospital_logo_url,
    }))
}

/// A batch with no purchase rate or catalogue cost prints its value blank.
fn expiry_item(r: ExpiryDrugRow) -> ExpiryDrugItem {
    let unit_price = r.unit_price;
    ExpiryDrugItem {
        item_code: r.item_code,
        drug_name: r.drug_name,
        batch_number: r.batch_number,
        expiry_date: r.expiry_date,
        days_to_expiry: r.days_to_expiry,
        quantity: r.quantity,
        unit: r.unit,
        unit_price,
        total_value: unit_price.map(|p| r.quantity * p),
        manufacturer: r.manufacturer,
        supplier: r.supplier,
        location: r.location,
    }
}

#[derive(Debug, sqlx::FromRow)]
struct StoreInfoRow {
    store_name: String,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct ExpiryDrugRow {
    item_code: String,
    drug_name: String,
    batch_number: String,
    expiry_date: String,
    days_to_expiry: i32,
    quantity: f64,
    unit: String,
    unit_price: Option<f64>,
    manufacturer: Option<String>,
    supplier: Option<String>,
    location: String,
}

// ══════════════════════════════════════════════════════════
// Equipment Condemnation Form — `equipment_condemnations.id`
// ══════════════════════════════════════════════════════════

/// A condemnation names a `store_catalog` item, not a `bme_equipment` asset,
/// so the asset fields (serial, make, location …) have nothing to read.
pub async fn get_equipment_condemnation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(condemnation_id): Path<Uuid>,
) -> Result<axum::Json<EquipmentCondemnationPrintData>, AppError> {
    require_permission(&claims, permissions::indent::CONDEMNATION_LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let cond = sqlx::query_as::<_, CondemnationRow>(
        r"
        SELECT
            ec.condemnation_number,
            ec.created_at::date::text AS condemnation_date,
            sc.name AS equipment_name,
            sc.code AS equipment_code,
            ec.purchase_value::float8 AS purchase_value,
            ec.current_value::float8 AS current_book_value,
            ec.reason AS reason_for_condemnation,
            ec.committee_remarks,
            ec.disposal_method,
            ui.full_name AS initiated_by,
            ua.full_name AS approved_by,
            ec.approved_at::text AS approval_date,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM equipment_condemnations ec
        JOIN store_catalog sc ON sc.id = ec.catalog_item_id
        JOIN users ui ON ui.id = ec.initiated_by
        LEFT JOIN users ua ON ua.id = ec.approved_by
        JOIN tenants t ON t.id = ec.tenant_id
        WHERE ec.id = $1 AND ec.deleted_at IS NULL
        ",
    )
    .bind(condemnation_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(axum::Json(EquipmentCondemnationPrintData {
        condemnation_number: cond.condemnation_number,
        condemnation_date: cond.condemnation_date,
        equipment_name: cond.equipment_name,
        equipment_code: cond.equipment_code,
        // ponytail: asset identity, location, condition, inspection, repair history
        // not recorded on a condemnation yet
        serial_number: None,
        make: None,
        model: None,
        location: None,
        department: None,
        purchase_date: None,
        purchase_value: Some(cond.purchase_value),
        current_book_value: Some(cond.current_book_value),
        reason_for_condemnation: cond.reason_for_condemnation,
        condition_assessment: None,
        // The condemnation committee's remarks are its inspection finding.
        inspection_findings: cond.committee_remarks.unwrap_or_default(),
        repair_history: vec![],
        total_repair_cost: None,
        disposal_recommendation: cond.disposal_method.unwrap_or_default(),
        estimated_salvage_value: None,
        inspected_by: None,
        // The person who initiated the condemnation is the one recommending it.
        recommended_by: cond.initiated_by,
        approved_by: cond.approved_by,
        approval_date: cond.approval_date,
        hospital_name: cond.hospital_name,
        hospital_logo_url: cond.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct CondemnationRow {
    condemnation_number: String,
    condemnation_date: String,
    equipment_name: String,
    equipment_code: String,
    purchase_value: f64,
    current_book_value: f64,
    reason_for_condemnation: String,
    committee_remarks: Option<String>,
    disposal_method: Option<String>,
    initiated_by: String,
    approved_by: Option<String>,
    approval_date: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Work Order Form — `fms_work_orders.id`
// ══════════════════════════════════════════════════════════

pub async fn get_work_order_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(work_order_id): Path<Uuid>,
) -> Result<axum::Json<WorkOrderPrintData>, AppError> {
    require_permission(&claims, permissions::facilities::work_orders::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    let wo = sqlx::query_as::<_, WorkOrderRow>(
        r"
        SELECT
            wo.work_order_number,
            wo.requested_at::date::text AS work_order_date,
            wo.category AS work_type,
            wo.priority,
            ur.full_name AS requested_by,
            d.name AS requesting_department,
            l.name AS location,
            wo.description,
            ua.full_name AS assigned_to,
            wo.completed_at::text AS completion_date,
            (EXTRACT(EPOCH FROM (wo.completed_at - wo.started_at)) / 3600)::float8
                AS actual_hours,
            wo.total_cost::float8 AS actual_cost,
            wo.actions_taken AS work_done,
            wo.status::text AS status,
            uv.full_name AS verified_by,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM fms_work_orders wo
        LEFT JOIN users ur ON ur.id = wo.requested_by
        LEFT JOIN departments d ON d.id = wo.department_id
        LEFT JOIN locations l ON l.id = wo.location_id
        LEFT JOIN users ua ON ua.id = wo.assigned_to
        LEFT JOIN users uv ON uv.id = wo.sign_off_by
        JOIN tenants t ON t.id = wo.tenant_id
        WHERE wo.id = $1 AND wo.deleted_at IS NULL
        ",
    )
    .bind(work_order_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(axum::Json(WorkOrderPrintData {
        work_order_number: wo.work_order_number,
        work_order_date: wo.work_order_date,
        work_type: wo.work_type.unwrap_or_default(),
        priority: wo.priority,
        requested_by: wo.requested_by.unwrap_or_default(),
        requesting_department: wo.requesting_department.unwrap_or_default(),
        location: wo.location.unwrap_or_default(),
        description: wo.description,
        // ponytail: equipment, estimates, materials, team, schedule not recorded on an FMS order
        equipment_involved: None,
        equipment_code: None,
        estimated_hours: None,
        estimated_cost: None,
        materials_required: vec![],
        assigned_to: wo.assigned_to,
        assigned_team: None,
        scheduled_date: None,
        completion_date: wo.completion_date,
        actual_hours: wo.actual_hours,
        actual_cost: wo.actual_cost,
        work_done: wo.work_done,
        status: wo.status,
        verified_by: wo.verified_by,
        hospital_name: wo.hospital_name,
        hospital_logo_url: wo.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct WorkOrderRow {
    work_order_number: String,
    work_order_date: String,
    work_type: Option<String>,
    priority: String,
    requested_by: Option<String>,
    requesting_department: Option<String>,
    location: Option<String>,
    description: String,
    assigned_to: Option<String>,
    completion_date: Option<String>,
    actual_hours: Option<f64>,
    actual_cost: Option<f64>,
    work_done: Option<String>,
    status: String,
    verified_by: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Preventive Maintenance Checklist — `bme_work_orders.id` (preventive)
// ══════════════════════════════════════════════════════════

pub async fn get_pm_checklist_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(work_order_id): Path<Uuid>,
) -> Result<axum::Json<PmChecklistPrintData>, AppError> {
    require_permission(&claims, permissions::bme::pm::LIST)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // "Last PM" is the previous completed preventive work order on the same
    // machine — not the schedule's `last_completed_date`, which this very
    // order overwrites when it closes.
    let pm = sqlx::query_as::<_, PmRow>(
        r"
        SELECT
            w.work_order_number AS pm_number,
            COALESCE(w.completed_at::date, w.scheduled_date)::text AS pm_date,
            e.name AS equipment_name,
            COALESCE(e.asset_tag, '') AS equipment_code,
            e.serial_number,
            e.location_description AS location,
            d.name AS department,
            (SELECT max(p.completed_at)::date::text
               FROM bme_work_orders p
              WHERE p.equipment_id = w.equipment_id AND p.order_type = 'preventive'
                AND p.id <> w.id AND p.deleted_at IS NULL
                AND p.completed_at < COALESCE(w.completed_at, now())) AS last_pm_date,
            s.frequency::text AS pm_frequency,
            w.checklist_results,
            w.findings,
            w.actions_taken,
            s.next_due_date::text AS next_pm_due,
            ut.full_name AS performed_by,
            us.full_name AS verified_by,
            t.name AS hospital_name,
            t.logo_url AS hospital_logo_url
        FROM bme_work_orders w
        JOIN bme_equipment e ON e.id = w.equipment_id
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN bme_pm_schedules s ON s.id = w.pm_schedule_id AND s.deleted_at IS NULL
        LEFT JOIN users ut ON ut.id = w.technician_sign_off_by
        LEFT JOIN users us ON us.id = w.supervisor_sign_off_by
        JOIN tenants t ON t.id = w.tenant_id
        WHERE w.id = $1 AND w.order_type = 'preventive' AND w.deleted_at IS NULL
        ",
    )
    .bind(work_order_id)
    .fetch_one(&mut *conn)
    .await?;

    let checklist_items: Vec<PmChecklistItem> = pm
        .checklist_results
        .map(|c| serde_json::from_value(c).unwrap_or_default())
        .unwrap_or_default();

    let non_blank = |s: Option<String>| s.filter(|v| !v.trim().is_empty());

    Ok(axum::Json(PmChecklistPrintData {
        pm_number: pm.pm_number,
        pm_date: pm.pm_date.unwrap_or_default(),
        equipment_name: pm.equipment_name,
        equipment_code: pm.equipment_code,
        serial_number: pm.serial_number,
        location: pm.location.unwrap_or_default(),
        department: pm.department.unwrap_or_default(),
        last_pm_date: pm.last_pm_date,
        pm_frequency: pm.pm_frequency.unwrap_or_default(),
        checklist_items,
        // ponytail: overall condition, parts replaced, dept-head ack not recorded yet
        overall_condition: None,
        issues_found: non_blank(pm.findings).into_iter().collect(),
        corrective_actions: non_blank(pm.actions_taken).into_iter().collect(),
        parts_replaced: vec![],
        next_pm_due: pm.next_pm_due,
        performed_by: pm.performed_by.unwrap_or_default(),
        verified_by: pm.verified_by,
        department_head_acknowledgment: None,
        hospital_name: pm.hospital_name,
        hospital_logo_url: pm.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct PmRow {
    pm_number: String,
    pm_date: Option<String>,
    equipment_name: String,
    equipment_code: String,
    serial_number: Option<String>,
    location: Option<String>,
    department: Option<String>,
    last_pm_date: Option<String>,
    pm_frequency: Option<String>,
    checklist_results: Option<serde_json::Value>,
    findings: Option<String>,
    actions_taken: Option<String>,
    next_pm_due: Option<String>,
    performed_by: Option<String>,
    verified_by: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Helper Functions
// ══════════════════════════════════════════════════════════

/// Convert amount to words (Indian numbering system)
fn amount_to_words(amount: f64) -> String {
    let rupees = amount.trunc() as i64;
    let paise = ((amount.fract() * 100.0).round()) as i64;

    let rupee_words = number_to_words(rupees);

    if paise > 0 {
        let paise_words = number_to_words(paise);
        format!("Rupees {rupee_words} and {paise_words} Paise Only")
    } else {
        format!("Rupees {rupee_words} Only")
    }
}

fn number_to_words(n: i64) -> String {
    if n == 0 {
        return "Zero".to_string();
    }

    let ones = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];
    let tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    let mut num = n;
    let mut result = String::new();

    // Crores (1,00,00,000)
    if num >= 10_000_000 {
        let crores = num / 10_000_000;
        result.push_str(&format!(
            "{} Crore ",
            two_digit_to_words(crores, &ones, &tens)
        ));
        num %= 10_000_000;
    }

    // Lakhs (1,00,000)
    if num >= 100_000 {
        let lakhs = num / 100_000;
        result.push_str(&format!(
            "{} Lakh ",
            two_digit_to_words(lakhs, &ones, &tens)
        ));
        num %= 100_000;
    }

    // Thousands (1,000)
    if num >= 1000 {
        let thousands = num / 1000;
        result.push_str(&format!(
            "{} Thousand ",
            two_digit_to_words(thousands, &ones, &tens)
        ));
        num %= 1000;
    }

    // Hundreds
    if num >= 100 {
        let hundreds = num / 100;
        result.push_str(&format!("{} Hundred ", ones[hundreds as usize]));
        num %= 100;
    }

    // Remaining (tens and ones)
    if num > 0 {
        result.push_str(&two_digit_to_words(num, &ones, &tens));
    }

    result.trim().to_string()
}

fn two_digit_to_words(n: i64, ones: &[&str], tens: &[&str]) -> String {
    if n < 20 {
        ones[n as usize].to_string()
    } else {
        let t = tens[(n / 10) as usize];
        let o = ones[(n % 10) as usize];
        if o.is_empty() {
            t.to_string()
        } else {
            format!("{t} {o}")
        }
    }
}

// ── Dispensing label ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DispensingLabelRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: Option<String>,
    drug_name: String,
    generic_name: Option<String>,
    strength: Option<String>,
    dosage_form: Option<String>,
    quantity_dispensed: Option<rust_decimal::Decimal>,
    quantity: Option<rust_decimal::Decimal>,
    batch_number: Option<String>,
    expiry_date: Option<chrono::NaiveDate>,
    storage_conditions: Option<String>,
    black_box_warning: Option<String>,
    drug_schedule: Option<String>,
    is_controlled: Option<bool>,
    dosage: Option<String>,
    frequency: Option<String>,
    duration: Option<String>,
    route: Option<String>,
    instructions: Option<String>,
    dispensed_at: Option<chrono::DateTime<chrono::Utc>>,
    dispensed_by: Option<String>,
    prescriber_name: Option<String>,
}

/// The wording the Drugs and Cosmetics Act requires on the label, by schedule.
///
/// Printing the schedule letter alone means nothing to the person holding the
/// box; the sentence is what the Act asks for and what a patient can act on.
fn schedule_warning(schedule: Option<&str>) -> Option<String> {
    let s = schedule?.trim().to_ascii_uppercase();
    let s = s.trim_start_matches("SCHEDULE").trim().to_owned();
    match s.as_str() {
        "H" => Some(
            "Schedule H — To be sold by retail on the prescription of a registered medical \
             practitioner only."
                .to_owned(),
        ),
        "H1" => Some(
            "Schedule H1 — To be sold by retail on the prescription of a registered medical \
             practitioner only. Warning: taking this medicine without medical supervision may be \
             dangerous, and its misuse contributes to antimicrobial resistance."
                .to_owned(),
        ),
        "X" => Some(
            "Schedule X — To be sold by retail on the prescription of a registered medical \
             practitioner only. The prescription is retained by the pharmacy for two years."
                .to_owned(),
        ),
        "G" => Some(
            "Schedule G — Caution: this drug is to be taken under medical supervision only."
                .to_owned(),
        ),
        _ => None,
    }
}

/// How the directions read on the box.
///
/// The parts come from the prescription and any of them may be missing, so
/// this joins what exists rather than printing "None" at a patient. Nothing at
/// all returns nothing, and the label then says the directions are on the
/// prescription instead of pretending to carry them.
fn directions_line(
    dosage: Option<&str>,
    frequency: Option<&str>,
    route: Option<&str>,
    instructions: Option<&str>,
) -> Option<String> {
    let parts: Vec<&str> = [dosage, frequency, route, instructions]
        .into_iter()
        .flatten()
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();
    (!parts.is_empty()).then(|| parts.join(" · "))
}

/// `GET /api/print-data/dispensing-label/{order_item_id}`
///
/// One label per dispensed line. The struct for it did not exist and neither
/// did the endpoint, so medication left the counter in a bag with a receipt:
/// what was paid for, not what to take. The label is the only part of a
/// dispense the patient still has at home, which is why the directions, the
/// batch and expiry that make a recall possible, and the schedule warning all
/// belong on it.
pub async fn get_dispensing_label_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_item_id): Path<Uuid>,
) -> Result<axum::Json<DispensingLabelPrintData>, AppError> {
    require_permission(&claims, permissions::pharmacy::dispensing::CREATE)?;

    // The patient is two hops off the path id — item, order, patient — and
    // there is no single-column link for that, so resolve then authorize. A
    // label carries a name, a UHID and what somebody is taking.
    let patient_id = sqlx::query_scalar!(
        "SELECT o.patient_id AS \"patient_id!\" FROM pharmacy_order_items i \
           JOIN pharmacy_orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id \
          WHERE i.id = $1 AND i.tenant_id = $2 AND i.deleted_at IS NULL",
        order_item_id,
        claims.tenant_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as!(
        DispensingLabelRow,
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS \"patient_name!\", \
           p.uhid AS \"uhid!\", \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS \"age?\", \
           p.gender::text AS \"gender?\", \
           i.drug_name AS \"drug_name!\", \
           c.generic_name AS \"generic_name?\", \
           c.strength AS \"strength?\", \
           c.dosage_form AS \"dosage_form?\", \
           i.quantity_dispensed::numeric AS \"quantity_dispensed?\", \
           i.quantity::numeric AS \"quantity?\", \
           i.batch_number AS \"batch_number?\", \
           i.expiry_date AS \"expiry_date?\", \
           c.storage_conditions AS \"storage_conditions?\", \
           c.black_box_warning AS \"black_box_warning?\", \
           c.drug_schedule::text AS \"drug_schedule?\", \
           c.is_controlled AS \"is_controlled?\", \
           pi.dosage AS \"dosage?\", pi.frequency AS \"frequency?\", \
           pi.duration AS \"duration?\", pi.route AS \"route?\", \
           pi.instructions AS \"instructions?\", \
           o.dispensed_at AS \"dispensed_at?\", \
           disp.full_name AS \"dispensed_by?\", \
           presc.full_name AS \"prescriber_name?\" \
         FROM pharmacy_order_items i \
         JOIN pharmacy_orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id \
         JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
         LEFT JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
         LEFT JOIN prescription_items pi ON pi.prescription_id = o.prescription_id \
              AND pi.catalog_item_id = i.catalog_item_id AND pi.tenant_id = i.tenant_id \
              AND pi.deleted_at IS NULL \
         LEFT JOIN users disp ON disp.id = o.dispensed_by \
         LEFT JOIN users presc ON presc.id = o.ordered_by \
         WHERE i.id = $1 AND i.tenant_id = $2 AND i.deleted_at IS NULL \
         LIMIT 1",
        order_item_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let hospital_name =
        sqlx::query_scalar!("SELECT name FROM tenants WHERE id = $1", claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or_default();
    tx.commit().await?;

    // The dispensed quantity, falling back to what was ordered only when the
    // line has not recorded one — never silently zero, which on a label reads
    // as "none supplied".
    let quantity = row
        .quantity_dispensed
        .or(row.quantity)
        .map_or_else(|| "—".to_owned(), |q| q.normalize().to_string());

    Ok(axum::Json(DispensingLabelPrintData {
        hospital_name,
        patient_name: row.patient_name,
        uhid: row.uhid,
        patient_age_sex: match (row.age, row.gender.as_deref()) {
            (Some(a), Some(g)) => Some(format!("{}y {}", a as i64, g)),
            (Some(a), None) => Some(format!("{}y", a as i64)),
            (None, Some(g)) => Some(g.to_owned()),
            (None, None) => None,
        },
        drug_name: row.drug_name,
        generic_name: row.generic_name,
        strength: row.strength,
        dosage_form: row.dosage_form,
        quantity_dispensed: quantity,
        directions: directions_line(
            row.dosage.as_deref(),
            row.frequency.as_deref(),
            row.route.as_deref(),
            row.instructions.as_deref(),
        ),
        route: row.route,
        duration: row.duration,
        batch_number: row.batch_number,
        expiry_date: row.expiry_date.map(|d| d.format("%b %Y").to_string()),
        storage_conditions: row.storage_conditions,
        schedule_warning: schedule_warning(row.drug_schedule.as_deref()),
        black_box_warning: row.black_box_warning,
        // Unknown is printed as unknown: a label must never call a controlled
        // drug uncontrolled because the catalogue flag is missing.
        is_controlled: row.is_controlled,
        dispensed_on: row.dispensed_at.map_or_else(String::new, |d| {
            d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()
        }),
        dispensed_by: row.dispensed_by,
        prescriber_name: row.prescriber_name,
    }))
}

/// Print-data admin/materials routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/indent-form/{indent_id}",
            get(get_indent_form_print_data),
        )
        .route(
            "/api/print-data/purchase-order/{po_id}",
            get(get_purchase_order_print_data),
        )
        .route("/api/print-data/grn/{grn_id}", get(get_grn_print_data))
        .route(
            "/api/print-data/material-issue-voucher/{indent_id}",
            get(get_material_issue_voucher_print_data),
        )
        .route(
            "/api/print-data/stock-transfer-note/{transfer_id}",
            get(get_stock_transfer_note_print_data),
        )
        .route(
            "/api/print-data/ndps-register/{period}",
            get(get_ndps_register_print_data),
        )
        .route(
            "/api/print-data/dispensing-label/{order_item_id}",
            get(get_dispensing_label_print_data),
        )
        .route(
            "/api/print-data/drug-expiry-alert/{store_id}",
            get(get_drug_expiry_alert_print_data),
        )
        .route(
            "/api/print-data/equipment-condemnation/{condemnation_id}",
            get(get_equipment_condemnation_print_data),
        )
        .route(
            "/api/print-data/work-order/{work_order_id}",
            get(get_work_order_print_data),
        )
        .route(
            "/api/print-data/pm-checklist/{work_order_id}",
            get(get_pm_checklist_print_data),
        )
}

#[cfg(test)]
mod dispensing_label_tests {
    use super::{directions_line, schedule_warning};

    #[test]
    fn a_schedule_h_label_carries_the_act_wording_not_the_letter() {
        // "H" on a box means nothing to the person holding it.
        let h = schedule_warning(Some("H")).expect("schedule H has wording");
        assert!(h.contains("prescription of a registered medical practitioner"));
        assert!(
            schedule_warning(Some("Schedule H1"))
                .expect("H1")
                .contains("antimicrobial")
        );
        assert!(
            schedule_warning(Some("X"))
                .expect("X")
                .contains("two years")
        );
    }

    #[test]
    fn an_unscheduled_drug_gets_no_warning_invented_for_it() {
        assert!(schedule_warning(None).is_none());
        assert!(schedule_warning(Some("")).is_none());
        assert!(schedule_warning(Some("OTC")).is_none());
    }

    #[test]
    fn directions_join_what_exists_and_stay_empty_when_nothing_does() {
        assert_eq!(
            directions_line(
                Some("1 tablet"),
                Some("twice daily"),
                Some("oral"),
                Some("after food")
            ),
            Some("1 tablet · twice daily · oral · after food".to_owned())
        );
        // A prescription with only a frequency still says something useful.
        assert_eq!(
            directions_line(None, Some("twice daily"), None, None),
            Some("twice daily".to_owned())
        );
        // Nothing at all prints nothing, rather than "None" at a patient.
        assert_eq!(directions_line(None, None, None, None), None);
        assert_eq!(directions_line(Some("  "), None, None, None), None);
    }
}

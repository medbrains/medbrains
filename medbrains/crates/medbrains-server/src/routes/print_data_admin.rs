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

use axum::{
    Router,
    extract::{Path, State},
    routing::get,
};
use medbrains_core::print_data::{
    DrugExpiryAlertPrintData, EquipmentCondemnationPrintData, ExpiryDrugItem, GrnItem,
    GrnPrintData, IndentFormPrintData, IndentItem, IssueItem, MaterialIssueVoucherPrintData,
    NdpsBalance, NdpsRegisterPrintData, NdpsTransaction, PartReplaced, PmChecklistItem,
    PmChecklistPrintData, PoItem, PurchaseOrderPrintData, RepairHistoryEntry,
    StockTransferNotePrintData, TransferItem, WorkOrderMaterial, WorkOrderPrintData,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/print-data/indent-form/{indent_id}",
            get(get_indent_form_print_data),
        )
        .route(
            "/print-data/purchase-order/{po_id}",
            get(get_purchase_order_print_data),
        )
        .route("/print-data/grn/{grn_id}", get(get_grn_print_data))
        .route(
            "/print-data/material-issue-voucher/{voucher_id}",
            get(get_material_issue_voucher_print_data),
        )
        .route(
            "/print-data/stock-transfer-note/{transfer_id}",
            get(get_stock_transfer_note_print_data),
        )
        .route(
            "/print-data/ndps-register/{period}",
            get(get_ndps_register_print_data),
        )
        .route(
            "/print-data/drug-expiry-alert/{store_id}",
            get(get_drug_expiry_alert_print_data),
        )
        .route(
            "/print-data/equipment-condemnation/{condemnation_id}",
            get(get_equipment_condemnation_print_data),
        )
        .route(
            "/print-data/work-order/{work_order_id}",
            get(get_work_order_print_data),
        )
        .route(
            "/print-data/pm-checklist/{pm_id}",
            get(get_pm_checklist_print_data),
        )
}

// ══════════════════════════════════════════════════════════
// Indent Form
// ══════════════════════════════════════════════════════════

pub async fn get_indent_form_print_data(
    State(state): State<AppState>,
    Path(indent_id): Path<Uuid>,
) -> Result<axum::Json<IndentFormPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query indent header
    let indent = sqlx::query_as::<_, IndentHeaderRow>(
        r"
        SELECT
            i.indent_number,
            i.indent_date::TEXT as indent_date,
            i.indent_type,
            i.priority,
            d.name as requesting_department,
            s.name as requesting_store,
            u.full_name as requested_by,
            i.estimated_value,
            i.justification,
            ua.full_name as approved_by,
            i.approved_at::TEXT as approved_at,
            i.status,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM indents i
        JOIN departments d ON i.department_id = d.id
        LEFT JOIN stores s ON i.store_id = s.id
        JOIN users u ON i.requested_by = u.id
        LEFT JOIN users ua ON i.approved_by = ua.id
        JOIN tenants t ON i.tenant_id = t.id
        WHERE i.id = $1
        ",
    )
    .bind(indent_id)
    .fetch_one(pool)
    .await?;

    // Query indent items
    let items = sqlx::query_as::<_, IndentItemRow>(
        r"
        SELECT
            ic.item_code,
            ic.item_name,
            ic.specification,
            ic.unit,
            ii.quantity_requested,
            ii.quantity_approved,
            ii.current_stock,
            ii.remarks
        FROM indent_items ii
        JOIN inventory_catalog ic ON ii.item_id = ic.id
        WHERE ii.indent_id = $1
        ORDER BY ii.line_number
        ",
    )
    .bind(indent_id)
    .fetch_all(pool)
    .await?;

    let indent_items: Vec<IndentItem> = items
        .into_iter()
        .map(|r| IndentItem {
            item_code: r.item_code,
            item_name: r.item_name,
            specification: r.specification,
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
        requesting_store: indent.requesting_store,
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
    requesting_store: Option<String>,
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
    specification: Option<String>,
    unit: String,
    quantity_requested: f64,
    quantity_approved: Option<f64>,
    current_stock: Option<f64>,
    remarks: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Purchase Order
// ══════════════════════════════════════════════════════════

pub async fn get_purchase_order_print_data(
    State(state): State<AppState>,
    Path(po_id): Path<Uuid>,
) -> Result<axum::Json<PurchaseOrderPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query PO header
    let po = sqlx::query_as::<_, PoHeaderRow>(
        r"
        SELECT
            po.po_number,
            po.po_date::TEXT as po_date,
            v.name as vendor_name,
            v.address as vendor_address,
            v.gstin as vendor_gstin,
            v.contact_phone as vendor_contact,
            po.delivery_address,
            po.delivery_date::TEXT as delivery_date,
            po.payment_terms,
            po.subtotal,
            po.discount_percentage,
            po.discount_amount,
            po.tax_amount,
            po.freight_charges,
            po.total_amount,
            po.terms_and_conditions,
            up.full_name as prepared_by,
            ua.full_name as approved_by,
            t.name as hospital_name,
            t.address as hospital_address,
            t.gstin as hospital_gstin,
            t.logo_url as hospital_logo_url
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN users up ON po.prepared_by = up.id
        LEFT JOIN users ua ON po.approved_by = ua.id
        JOIN tenants t ON po.tenant_id = t.id
        WHERE po.id = $1
        ",
    )
    .bind(po_id)
    .fetch_one(pool)
    .await?;

    // Query PO items
    let items = sqlx::query_as::<_, PoItemRow>(
        r"
        SELECT
            ic.item_code,
            ic.item_name,
            ic.specification,
            ic.hsn_code,
            ic.unit,
            poi.quantity,
            poi.unit_price,
            poi.tax_rate,
            poi.amount
        FROM purchase_order_items poi
        JOIN inventory_catalog ic ON poi.item_id = ic.id
        WHERE poi.po_id = $1
        ORDER BY poi.line_number
        ",
    )
    .bind(po_id)
    .fetch_all(pool)
    .await?;

    let po_items: Vec<PoItem> = items
        .into_iter()
        .map(|r| PoItem {
            item_code: r.item_code,
            item_name: r.item_name,
            specification: r.specification,
            hsn_code: r.hsn_code,
            unit: r.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
            tax_rate: r.tax_rate,
            amount: r.amount,
        })
        .collect();

    let terms: Vec<String> = po
        .terms_and_conditions
        .map(|t| serde_json::from_value(t).unwrap_or_default())
        .unwrap_or_default();

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
        discount_percentage: po.discount_percentage,
        discount_amount: po.discount_amount,
        tax_amount: po.tax_amount,
        freight_charges: po.freight_charges,
        total_amount: po.total_amount,
        amount_in_words,
        terms_and_conditions: terms,
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
    subtotal: f64,
    discount_percentage: Option<f64>,
    discount_amount: f64,
    tax_amount: f64,
    freight_charges: f64,
    total_amount: f64,
    terms_and_conditions: Option<serde_json::Value>,
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
    specification: Option<String>,
    hsn_code: Option<String>,
    unit: String,
    quantity: f64,
    unit_price: f64,
    tax_rate: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// Goods Receipt Note (GRN)
// ══════════════════════════════════════════════════════════

pub async fn get_grn_print_data(
    State(state): State<AppState>,
    Path(grn_id): Path<Uuid>,
) -> Result<axum::Json<GrnPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query GRN header
    let grn = sqlx::query_as::<_, GrnHeaderRow>(
        r"
        SELECT
            g.grn_number,
            g.grn_date::TEXT as grn_date,
            po.po_number,
            po.po_date::TEXT as po_date,
            v.name as vendor_name,
            g.vendor_invoice_number,
            g.vendor_invoice_date::TEXT as vendor_invoice_date,
            g.challan_number,
            s.name as receiving_store,
            g.quality_check_done,
            g.quality_remarks,
            u.full_name as received_by,
            uv.full_name as verified_by,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM goods_receipts g
        LEFT JOIN purchase_orders po ON g.po_id = po.id
        JOIN vendors v ON g.vendor_id = v.id
        JOIN stores s ON g.store_id = s.id
        JOIN users u ON g.received_by = u.id
        LEFT JOIN users uv ON g.verified_by = uv.id
        JOIN tenants t ON g.tenant_id = t.id
        WHERE g.id = $1
        ",
    )
    .bind(grn_id)
    .fetch_one(pool)
    .await?;

    // Query GRN items
    let items = sqlx::query_as::<_, GrnItemRow>(
        r"
        SELECT
            ic.item_code,
            ic.item_name,
            gi.batch_number,
            gi.expiry_date::TEXT as expiry_date,
            gi.manufacturing_date::TEXT as manufacturing_date,
            ic.unit,
            gi.quantity_ordered,
            gi.quantity_received,
            gi.quantity_accepted,
            gi.quantity_rejected,
            gi.rejection_reason,
            gi.unit_price,
            gi.amount
        FROM goods_receipt_items gi
        JOIN inventory_catalog ic ON gi.item_id = ic.id
        WHERE gi.grn_id = $1
        ORDER BY gi.line_number
        ",
    )
    .bind(grn_id)
    .fetch_all(pool)
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
        challan_number: grn.challan_number,
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
    challan_number: Option<String>,
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
    quantity_ordered: f64,
    quantity_received: f64,
    quantity_accepted: f64,
    quantity_rejected: f64,
    rejection_reason: Option<String>,
    unit_price: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// Material Issue Voucher
// ══════════════════════════════════════════════════════════

pub async fn get_material_issue_voucher_print_data(
    State(state): State<AppState>,
    Path(voucher_id): Path<Uuid>,
) -> Result<axum::Json<MaterialIssueVoucherPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query voucher header
    let voucher = sqlx::query_as::<_, IssueVoucherHeaderRow>(
        r"
        SELECT
            iv.voucher_number,
            iv.voucher_date::TEXT as voucher_date,
            iv.issue_type,
            s.name as issuing_store,
            d.name as receiving_department,
            cc.name as receiving_cost_center,
            ur.full_name as requested_by,
            iv.purpose,
            ui.full_name as issued_by,
            urcv.name as received_by,
            iv.received_at::TEXT as received_at,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM material_issue_vouchers iv
        JOIN stores s ON iv.store_id = s.id
        JOIN departments d ON iv.department_id = d.id
        LEFT JOIN cost_centers cc ON iv.cost_center_id = cc.id
        JOIN users ur ON iv.requested_by = ur.id
        JOIN users ui ON iv.issued_by = ui.id
        LEFT JOIN users urcv ON iv.received_by = urcv.id
        JOIN tenants t ON iv.tenant_id = t.id
        WHERE iv.id = $1
        ",
    )
    .bind(voucher_id)
    .fetch_one(pool)
    .await?;

    // Query issue items
    let items = sqlx::query_as::<_, IssueItemRow>(
        r"
        SELECT
            ic.item_code,
            ic.item_name,
            ii.batch_number,
            ii.expiry_date::TEXT as expiry_date,
            ic.unit,
            ii.quantity_requested,
            ii.quantity_issued,
            ii.unit_price,
            ii.amount
        FROM material_issue_items ii
        JOIN inventory_catalog ic ON ii.item_id = ic.id
        WHERE ii.voucher_id = $1
        ORDER BY ii.line_number
        ",
    )
    .bind(voucher_id)
    .fetch_all(pool)
    .await?;

    let issue_items: Vec<IssueItem> = items
        .into_iter()
        .map(|r| IssueItem {
            item_code: r.item_code,
            item_name: r.item_name,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
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
        voucher_date: voucher.voucher_date,
        issue_type: voucher.issue_type,
        issuing_store: voucher.issuing_store,
        receiving_department: voucher.receiving_department,
        receiving_cost_center: voucher.receiving_cost_center,
        requested_by: voucher.requested_by,
        items: issue_items,
        total_items,
        total_value,
        purpose: voucher.purpose,
        issued_by: voucher.issued_by,
        received_by: voucher.received_by,
        received_at: voucher.received_at,
        hospital_name: voucher.hospital_name,
        hospital_logo_url: voucher.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct IssueVoucherHeaderRow {
    voucher_number: String,
    voucher_date: String,
    issue_type: String,
    issuing_store: String,
    receiving_department: String,
    receiving_cost_center: Option<String>,
    requested_by: String,
    purpose: Option<String>,
    issued_by: String,
    received_by: Option<String>,
    received_at: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct IssueItemRow {
    item_code: String,
    item_name: String,
    batch_number: Option<String>,
    expiry_date: Option<String>,
    unit: String,
    quantity_requested: f64,
    quantity_issued: f64,
    unit_price: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// Stock Transfer Note
// ══════════════════════════════════════════════════════════

pub async fn get_stock_transfer_note_print_data(
    State(state): State<AppState>,
    Path(transfer_id): Path<Uuid>,
) -> Result<axum::Json<StockTransferNotePrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query transfer header
    let transfer = sqlx::query_as::<_, TransferHeaderRow>(
        r"
        SELECT
            st.transfer_number,
            st.transfer_date::TEXT as transfer_date,
            sf.name as from_store,
            sto.name as to_store,
            st.transfer_type,
            st.reason,
            ui.full_name as initiated_by,
            ud.name as dispatched_by,
            st.dispatched_at::TEXT as dispatched_at,
            ur.full_name as received_by,
            st.received_at::TEXT as received_at,
            st.status,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM stock_transfers st
        JOIN stores sf ON st.from_store_id = sf.id
        JOIN stores sto ON st.to_store_id = sto.id
        JOIN users ui ON st.initiated_by = ui.id
        LEFT JOIN users ud ON st.dispatched_by = ud.id
        LEFT JOIN users ur ON st.received_by = ur.id
        JOIN tenants t ON st.tenant_id = t.id
        WHERE st.id = $1
        ",
    )
    .bind(transfer_id)
    .fetch_one(pool)
    .await?;

    // Query transfer items
    let items = sqlx::query_as::<_, TransferItemRow>(
        r"
        SELECT
            ic.item_code,
            ic.item_name,
            sti.batch_number,
            sti.expiry_date::TEXT as expiry_date,
            ic.unit,
            sti.quantity,
            sti.unit_price,
            sti.amount
        FROM stock_transfer_items sti
        JOIN inventory_catalog ic ON sti.item_id = ic.id
        WHERE sti.transfer_id = $1
        ORDER BY sti.line_number
        ",
    )
    .bind(transfer_id)
    .fetch_all(pool)
    .await?;

    let transfer_items: Vec<TransferItem> = items
        .into_iter()
        .map(|r| TransferItem {
            item_code: r.item_code,
            item_name: r.item_name,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
            unit: r.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
            amount: r.amount,
        })
        .collect();

    let total_items = i32::try_from(transfer_items.len()).unwrap_or(0);
    let total_value: f64 = transfer_items.iter().map(|i| i.amount).sum();

    Ok(axum::Json(StockTransferNotePrintData {
        transfer_number: transfer.transfer_number,
        transfer_date: transfer.transfer_date,
        from_store: transfer.from_store,
        to_store: transfer.to_store,
        transfer_type: transfer.transfer_type,
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
    transfer_type: String,
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
    unit_price: f64,
    amount: f64,
}

// ══════════════════════════════════════════════════════════
// NDPS Controlled Substance Register
// ══════════════════════════════════════════════════════════

pub async fn get_ndps_register_print_data(
    State(state): State<AppState>,
    Path(period): Path<String>,
) -> Result<axum::Json<NdpsRegisterPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Parse period (YYYY-MM format)
    let parts: Vec<&str> = period.split('-').collect();
    if parts.len() != 2 {
        return Err(AppError::BadRequest(
            "Invalid period format. Use YYYY-MM".to_string(),
        ));
    }

    // Query store and license info (first NDPS-licensed store)
    let store = sqlx::query_as::<_, NdpsStoreRow>(
        r"
        SELECT
            s.name as store_name,
            s.ndps_license_number as license_number,
            s.ndps_license_valid_until::TEXT as license_valid_until,
            u.full_name as register_maintained_by,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM stores s
        JOIN tenants t ON s.tenant_id = t.id
        LEFT JOIN users u ON s.ndps_register_officer = u.id
        WHERE s.is_ndps_store = true
        LIMIT 1
        ",
    )
    .fetch_one(pool)
    .await?;

    // Query opening balance (beginning of period)
    let opening_balance = sqlx::query_as::<_, NdpsBalanceRow>(
        r"
        SELECT
            dc.generic_name as drug_name,
            dc.drug_schedule as schedule,
            nb.batch_number,
            dc.dispensing_unit as unit,
            nb.opening_quantity as quantity
        FROM ndps_balances nb
        JOIN drug_catalog dc ON nb.drug_id = dc.id
        WHERE nb.period = $1 AND nb.balance_type = 'opening'
        ORDER BY dc.generic_name
        ",
    )
    .bind(&period)
    .fetch_all(pool)
    .await?;

    // Query transactions for the period
    let transactions = sqlx::query_as::<_, NdpsTransactionRow>(
        r"
        SELECT
            nt.transaction_date::TEXT as transaction_date,
            dc.generic_name as drug_name,
            nt.batch_number,
            nt.transaction_type,
            nt.quantity,
            nt.balance_after,
            (p.first_name || ' ' || p.last_name) as patient_name,
            p.uhid as patient_uhid,
            u.full_name as prescribing_doctor,
            nt.witness_name,
            nt.reference_number
        FROM ndps_transactions nt
        JOIN drug_catalog dc ON nt.drug_id = dc.id
        LEFT JOIN patients p ON nt.patient_id = p.id
        LEFT JOIN users u ON nt.prescribing_doctor_id = u.id
        WHERE nt.period = $1
        ORDER BY nt.transaction_date, nt.created_at
        ",
    )
    .bind(&period)
    .fetch_all(pool)
    .await?;

    // Query closing balance (end of period)
    let closing_balance = sqlx::query_as::<_, NdpsBalanceRow>(
        r"
        SELECT
            dc.generic_name as drug_name,
            dc.drug_schedule as schedule,
            nb.batch_number,
            dc.dispensing_unit as unit,
            nb.closing_quantity as quantity
        FROM ndps_balances nb
        JOIN drug_catalog dc ON nb.drug_id = dc.id
        WHERE nb.period = $1 AND nb.balance_type = 'closing'
        ORDER BY dc.generic_name
        ",
    )
    .bind(&period)
    .fetch_all(pool)
    .await?;

    let opening: Vec<NdpsBalance> = opening_balance
        .into_iter()
        .map(|r| NdpsBalance {
            drug_name: r.drug_name,
            schedule: r.schedule,
            batch_number: r.batch_number,
            unit: r.unit,
            quantity: r.quantity,
        })
        .collect();

    let txns: Vec<NdpsTransaction> = transactions
        .into_iter()
        .map(|r| NdpsTransaction {
            transaction_date: r.transaction_date,
            drug_name: r.drug_name,
            batch_number: r.batch_number,
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

    let closing: Vec<NdpsBalance> = closing_balance
        .into_iter()
        .map(|r| NdpsBalance {
            drug_name: r.drug_name,
            schedule: r.schedule,
            batch_number: r.batch_number,
            unit: r.unit,
            quantity: r.quantity,
        })
        .collect();

    Ok(axum::Json(NdpsRegisterPrintData {
        report_period: period,
        report_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        store_name: store.store_name,
        license_number: store.license_number.unwrap_or_default(),
        license_valid_until: store.license_valid_until.unwrap_or_default(),
        opening_balance: opening,
        transactions: txns,
        closing_balance: closing,
        physical_verification_date: None,
        discrepancies: vec![],
        register_maintained_by: store.register_maintained_by.unwrap_or_default(),
        verified_by: None,
        hospital_name: store.hospital_name,
        hospital_logo_url: store.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct NdpsStoreRow {
    store_name: String,
    license_number: Option<String>,
    license_valid_until: Option<String>,
    register_maintained_by: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct NdpsBalanceRow {
    drug_name: String,
    schedule: String,
    batch_number: String,
    unit: String,
    quantity: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct NdpsTransactionRow {
    transaction_date: String,
    drug_name: String,
    batch_number: String,
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
// Drug Expiry Alert List
// ══════════════════════════════════════════════════════════

pub async fn get_drug_expiry_alert_print_data(
    State(state): State<AppState>,
    Path(store_id): Path<Uuid>,
) -> Result<axum::Json<DrugExpiryAlertPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query store info
    let store = sqlx::query_as::<_, StoreInfoRow>(
        r"
        SELECT
            s.name as store_name,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM stores s
        JOIN tenants t ON s.tenant_id = t.id
        WHERE s.id = $1
        ",
    )
    .bind(store_id)
    .fetch_one(pool)
    .await?;

    let alert_threshold_days = 90; // Default 90 days

    // Query expired drugs
    let expired = sqlx::query_as::<_, ExpiryDrugRow>(
        r"
        SELECT
            dc.item_code,
            dc.generic_name as drug_name,
            sb.batch_number,
            sb.expiry_date::TEXT as expiry_date,
            (sb.expiry_date - CURRENT_DATE)::INT as days_to_expiry,
            sb.quantity,
            dc.dispensing_unit as unit,
            sb.unit_price,
            (sb.quantity * sb.unit_price) as total_value,
            dc.manufacturer,
            v.name as supplier,
            s.name as location
        FROM stock_batches sb
        JOIN drug_catalog dc ON sb.item_id = dc.id
        JOIN stores s ON sb.store_id = s.id
        LEFT JOIN vendors v ON sb.supplier_id = v.id
        WHERE sb.store_id = $1
          AND sb.expiry_date < CURRENT_DATE
          AND sb.quantity > 0
        ORDER BY sb.expiry_date
        ",
    )
    .bind(store_id)
    .fetch_all(pool)
    .await?;

    // Query expiring soon
    let expiring_soon = sqlx::query_as::<_, ExpiryDrugRow>(
        r"
        SELECT
            dc.item_code,
            dc.generic_name as drug_name,
            sb.batch_number,
            sb.expiry_date::TEXT as expiry_date,
            (sb.expiry_date - CURRENT_DATE)::INT as days_to_expiry,
            sb.quantity,
            dc.dispensing_unit as unit,
            sb.unit_price,
            (sb.quantity * sb.unit_price) as total_value,
            dc.manufacturer,
            v.name as supplier,
            s.name as location
        FROM stock_batches sb
        JOIN drug_catalog dc ON sb.item_id = dc.id
        JOIN stores s ON sb.store_id = s.id
        LEFT JOIN vendors v ON sb.supplier_id = v.id
        WHERE sb.store_id = $1
          AND sb.expiry_date >= CURRENT_DATE
          AND sb.expiry_date <= CURRENT_DATE + $2
          AND sb.quantity > 0
        ORDER BY sb.expiry_date
        ",
    )
    .bind(store_id)
    .bind(alert_threshold_days)
    .fetch_all(pool)
    .await?;

    let expired_drugs: Vec<ExpiryDrugItem> = expired
        .into_iter()
        .map(|r| ExpiryDrugItem {
            item_code: r.item_code,
            drug_name: r.drug_name,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
            days_to_expiry: r.days_to_expiry,
            quantity: r.quantity,
            unit: r.unit,
            unit_price: r.unit_price,
            total_value: r.total_value,
            manufacturer: r.manufacturer,
            supplier: r.supplier,
            location: r.location,
        })
        .collect();

    let expiring: Vec<ExpiryDrugItem> = expiring_soon
        .into_iter()
        .map(|r| ExpiryDrugItem {
            item_code: r.item_code,
            drug_name: r.drug_name,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
            days_to_expiry: r.days_to_expiry,
            quantity: r.quantity,
            unit: r.unit,
            unit_price: r.unit_price,
            total_value: r.total_value,
            manufacturer: r.manufacturer,
            supplier: r.supplier,
            location: r.location,
        })
        .collect();

    let total_expired_value: f64 = expired_drugs.iter().map(|d| d.total_value).sum();
    let total_expiring_value: f64 = expiring.iter().map(|d| d.total_value).sum();

    Ok(axum::Json(DrugExpiryAlertPrintData {
        report_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
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
    unit_price: f64,
    total_value: f64,
    manufacturer: Option<String>,
    supplier: Option<String>,
    location: String,
}

// ══════════════════════════════════════════════════════════
// Equipment Condemnation Form
// ══════════════════════════════════════════════════════════

pub async fn get_equipment_condemnation_print_data(
    State(state): State<AppState>,
    Path(condemnation_id): Path<Uuid>,
) -> Result<axum::Json<EquipmentCondemnationPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query condemnation record
    let cond = sqlx::query_as::<_, CondemnationRow>(
        r"
        SELECT
            ec.condemnation_number,
            ec.condemnation_date::TEXT as condemnation_date,
            e.name as equipment_name,
            e.equipment_code,
            e.serial_number,
            e.make,
            e.model,
            l.name as location,
            d.name as department,
            e.purchase_date::TEXT as purchase_date,
            e.purchase_value,
            e.current_book_value,
            ec.reason_for_condemnation,
            ec.condition_assessment,
            ec.inspection_findings,
            ec.repair_history,
            ec.total_repair_cost,
            ec.disposal_recommendation,
            ec.estimated_salvage_value,
            ui.full_name as inspected_by,
            ur.full_name as recommended_by,
            ua.full_name as approved_by,
            ec.approval_date::TEXT as approval_date,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM equipment_condemnations ec
        JOIN equipment e ON ec.equipment_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        JOIN departments d ON e.department_id = d.id
        JOIN users ui ON ec.inspected_by = ui.id
        JOIN users ur ON ec.recommended_by = ur.id
        LEFT JOIN users ua ON ec.approved_by = ua.id
        JOIN tenants t ON ec.tenant_id = t.id
        WHERE ec.id = $1
        ",
    )
    .bind(condemnation_id)
    .fetch_one(pool)
    .await?;

    let repair_history: Vec<RepairHistoryEntry> = cond
        .repair_history
        .map(|h| serde_json::from_value(h).unwrap_or_default())
        .unwrap_or_default();

    Ok(axum::Json(EquipmentCondemnationPrintData {
        condemnation_number: cond.condemnation_number,
        condemnation_date: cond.condemnation_date,
        equipment_name: cond.equipment_name,
        equipment_code: cond.equipment_code,
        serial_number: cond.serial_number,
        make: cond.make,
        model: cond.model,
        location: cond.location.unwrap_or_default(),
        department: cond.department,
        purchase_date: cond.purchase_date,
        purchase_value: cond.purchase_value,
        current_book_value: cond.current_book_value,
        reason_for_condemnation: cond.reason_for_condemnation,
        condition_assessment: cond.condition_assessment,
        inspection_findings: cond.inspection_findings,
        repair_history,
        total_repair_cost: cond.total_repair_cost,
        disposal_recommendation: cond.disposal_recommendation,
        estimated_salvage_value: cond.estimated_salvage_value,
        inspected_by: cond.inspected_by,
        recommended_by: cond.recommended_by,
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
    serial_number: Option<String>,
    make: Option<String>,
    model: Option<String>,
    location: Option<String>,
    department: String,
    purchase_date: Option<String>,
    purchase_value: Option<f64>,
    current_book_value: Option<f64>,
    reason_for_condemnation: String,
    condition_assessment: String,
    inspection_findings: String,
    repair_history: Option<serde_json::Value>,
    total_repair_cost: f64,
    disposal_recommendation: String,
    estimated_salvage_value: Option<f64>,
    inspected_by: String,
    recommended_by: String,
    approved_by: Option<String>,
    approval_date: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

// ══════════════════════════════════════════════════════════
// Work Order Form
// ══════════════════════════════════════════════════════════

pub async fn get_work_order_print_data(
    State(state): State<AppState>,
    Path(work_order_id): Path<Uuid>,
) -> Result<axum::Json<WorkOrderPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query work order
    let wo = sqlx::query_as::<_, WorkOrderRow>(
        r"
        SELECT
            wo.work_order_number,
            wo.work_order_date::TEXT as work_order_date,
            wo.work_type,
            wo.priority,
            ur.full_name as requested_by,
            d.name as requesting_department,
            l.name as location,
            wo.description,
            e.name as equipment_involved,
            e.equipment_code,
            wo.estimated_hours,
            wo.estimated_cost,
            wo.materials_required,
            ua.full_name as assigned_to,
            wo.assigned_team,
            wo.scheduled_date::TEXT as scheduled_date,
            wo.completion_date::TEXT as completion_date,
            wo.actual_hours,
            wo.actual_cost,
            wo.work_done,
            wo.status,
            uv.full_name as verified_by,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM work_orders wo
        JOIN users ur ON wo.requested_by = ur.id
        JOIN departments d ON wo.department_id = d.id
        LEFT JOIN locations l ON wo.location_id = l.id
        LEFT JOIN equipment e ON wo.equipment_id = e.id
        LEFT JOIN users ua ON wo.assigned_to = ua.id
        LEFT JOIN users uv ON wo.verified_by = uv.id
        JOIN tenants t ON wo.tenant_id = t.id
        WHERE wo.id = $1
        ",
    )
    .bind(work_order_id)
    .fetch_one(pool)
    .await?;

    let materials: Vec<WorkOrderMaterial> = wo
        .materials_required
        .map(|m| serde_json::from_value(m).unwrap_or_default())
        .unwrap_or_default();

    Ok(axum::Json(WorkOrderPrintData {
        work_order_number: wo.work_order_number,
        work_order_date: wo.work_order_date,
        work_type: wo.work_type,
        priority: wo.priority,
        requested_by: wo.requested_by,
        requesting_department: wo.requesting_department,
        location: wo.location.unwrap_or_default(),
        description: wo.description,
        equipment_involved: wo.equipment_involved,
        equipment_code: wo.equipment_code,
        estimated_hours: wo.estimated_hours,
        estimated_cost: wo.estimated_cost,
        materials_required: materials,
        assigned_to: wo.assigned_to,
        assigned_team: wo.assigned_team,
        scheduled_date: wo.scheduled_date,
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
    work_type: String,
    priority: String,
    requested_by: String,
    requesting_department: String,
    location: Option<String>,
    description: String,
    equipment_involved: Option<String>,
    equipment_code: Option<String>,
    estimated_hours: Option<f64>,
    estimated_cost: Option<f64>,
    materials_required: Option<serde_json::Value>,
    assigned_to: Option<String>,
    assigned_team: Option<String>,
    scheduled_date: Option<String>,
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
// Preventive Maintenance Checklist
// ══════════════════════════════════════════════════════════

pub async fn get_pm_checklist_print_data(
    State(state): State<AppState>,
    Path(pm_id): Path<Uuid>,
) -> Result<axum::Json<PmChecklistPrintData>, AppError> {
    let pool: &PgPool = &state.db;

    // Query PM record
    let pm = sqlx::query_as::<_, PmRow>(
        r"
        SELECT
            pm.pm_number,
            pm.pm_date::TEXT as pm_date,
            e.name as equipment_name,
            e.equipment_code,
            e.serial_number,
            l.name as location,
            d.name as department,
            pm.last_pm_date::TEXT as last_pm_date,
            pm.pm_frequency,
            pm.checklist_items,
            pm.overall_condition,
            pm.issues_found,
            pm.corrective_actions,
            pm.parts_replaced,
            pm.next_pm_due::TEXT as next_pm_due,
            up.full_name as performed_by,
            uv.full_name as verified_by,
            uda.full_name as department_head_acknowledgment,
            t.name as hospital_name,
            t.logo_url as hospital_logo_url
        FROM preventive_maintenance pm
        JOIN equipment e ON pm.equipment_id = e.id
        LEFT JOIN locations l ON e.location_id = l.id
        JOIN departments d ON e.department_id = d.id
        JOIN users up ON pm.performed_by = up.id
        LEFT JOIN users uv ON pm.verified_by = uv.id
        LEFT JOIN users uda ON pm.acknowledged_by = uda.id
        JOIN tenants t ON pm.tenant_id = t.id
        WHERE pm.id = $1
        ",
    )
    .bind(pm_id)
    .fetch_one(pool)
    .await?;

    let checklist_items: Vec<PmChecklistItem> = pm
        .checklist_items
        .map(|c| serde_json::from_value(c).unwrap_or_default())
        .unwrap_or_default();

    let issues_found: Vec<String> = pm
        .issues_found
        .map(|i| serde_json::from_value(i).unwrap_or_default())
        .unwrap_or_default();

    let corrective_actions: Vec<String> = pm
        .corrective_actions
        .map(|c| serde_json::from_value(c).unwrap_or_default())
        .unwrap_or_default();

    let parts_replaced: Vec<PartReplaced> = pm
        .parts_replaced
        .map(|p| serde_json::from_value(p).unwrap_or_default())
        .unwrap_or_default();

    Ok(axum::Json(PmChecklistPrintData {
        pm_number: pm.pm_number,
        pm_date: pm.pm_date,
        equipment_name: pm.equipment_name,
        equipment_code: pm.equipment_code,
        serial_number: pm.serial_number,
        location: pm.location.unwrap_or_default(),
        department: pm.department,
        last_pm_date: pm.last_pm_date,
        pm_frequency: pm.pm_frequency,
        checklist_items,
        overall_condition: pm.overall_condition,
        issues_found,
        corrective_actions,
        parts_replaced,
        next_pm_due: pm.next_pm_due,
        performed_by: pm.performed_by,
        verified_by: pm.verified_by,
        department_head_acknowledgment: pm.department_head_acknowledgment,
        hospital_name: pm.hospital_name,
        hospital_logo_url: pm.hospital_logo_url,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct PmRow {
    pm_number: String,
    pm_date: String,
    equipment_name: String,
    equipment_code: String,
    serial_number: Option<String>,
    location: Option<String>,
    department: String,
    last_pm_date: Option<String>,
    pm_frequency: String,
    checklist_items: Option<serde_json::Value>,
    overall_condition: String,
    issues_found: Option<serde_json::Value>,
    corrective_actions: Option<serde_json::Value>,
    parts_replaced: Option<serde_json::Value>,
    next_pm_due: Option<String>,
    performed_by: String,
    verified_by: Option<String>,
    department_head_acknowledgment: Option<String>,
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

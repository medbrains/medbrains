use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Row / Request types — Credit Notes
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyCreditNote {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub credit_note_number: String,
    pub note_type: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub vendor_id: Option<Uuid>,
    pub items: serde_json::Value,
    pub total_amount: Decimal,
    pub gst_amount: Decimal,
    pub net_amount: Decimal,
    pub status: String,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub settled_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCreditNoteRequest {
    pub note_type: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub vendor_id: Option<Uuid>,
    pub items: serde_json::Value,
    pub total_amount: Decimal,
    pub gst_amount: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListCreditNotesQuery {
    pub status: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Row / Request types — Store Indents
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyStoreIndent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub indent_number: String,
    pub from_store_id: Option<Uuid>,
    pub to_store_id: Option<Uuid>,
    pub status: String,
    pub items: serde_json::Value,
    pub total_items: i32,
    pub notes: Option<String>,
    pub requested_by: Option<Uuid>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub issued_by: Option<Uuid>,
    pub issued_at: Option<DateTime<Utc>>,
    pub received_by: Option<Uuid>,
    pub received_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoreIndentRequest {
    pub from_store_id: Option<Uuid>,
    pub to_store_id: Option<Uuid>,
    pub items: serde_json::Value,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Credit Note handlers
// ══════════════════════════════════════════════════════════

pub async fn list_credit_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCreditNotesQuery>,
) -> Result<Json<Vec<PharmacyCreditNote>>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyCreditNote>(
        "SELECT * FROM pharmacy_credit_notes \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditNoteRequest>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let credit_note_number = format!("CN-{ts}-{}", &uid.to_string()[..8]);

    let gst = body.gst_amount.unwrap_or(Decimal::ZERO);
    let net = body.total_amount + gst;

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "INSERT INTO pharmacy_credit_notes \
         (tenant_id, credit_note_number, note_type, reference_type, reference_id, \
          patient_id, vendor_id, items, total_amount, gst_amount, net_amount, \
          notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&credit_note_number)
    .bind(&body.note_type)
    .bind(&body.reference_type)
    .bind(body.reference_id)
    .bind(body.patient_id)
    .bind(body.vendor_id)
    .bind(&body.items)
    .bind(body.total_amount)
    .bind(gst)
    .bind(net)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "SELECT * FROM pharmacy_credit_notes WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "UPDATE pharmacy_credit_notes SET \
         status = 'approved', approved_by = $3, approved_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Auto-adjust billing: reduce current bill or add to credit balance
    let total = row.total_amount;

    if let Some(patient_id) = row.patient_id {
        // Check for outstanding invoices
        let outstanding_invoice: Option<(Uuid, Decimal)> = sqlx::query_as(
            "SELECT id, (total_amount - paid_amount) as balance FROM invoices \
             WHERE patient_id = $1 AND tenant_id = $2 AND status != 'cancelled' \
             AND total_amount > paid_amount ORDER BY created_at ASC LIMIT 1",
        )
        .bind(patient_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((invoice_id, _balance)) = outstanding_invoice {
            // Reduce the outstanding invoice
            sqlx::query(
                "UPDATE invoices SET paid_amount = paid_amount + $1 \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(total)
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            // Update credit note with adjustment info
            sqlx::query(
                "UPDATE pharmacy_credit_notes SET adjustment_type = 'reduce_bill', \
                 adjusted_invoice_id = $1 WHERE id = $2",
            )
            .bind(invoice_id)
            .bind(row.id)
            .execute(&mut *tx)
            .await?;
        } else {
            // No outstanding bill — add to credit balance
            sqlx::query(
                "INSERT INTO credit_patients \
                 (tenant_id, patient_id, current_balance, notes) \
                 VALUES ($1, $2, $3, $4) \
                 ON CONFLICT (tenant_id, patient_id) DO UPDATE SET \
                 current_balance = credit_patients.current_balance + $3",
            )
            .bind(claims.tenant_id)
            .bind(patient_id)
            .bind(total)
            .bind(format!("Credit note {}", row.credit_note_number))
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "UPDATE pharmacy_credit_notes SET adjustment_type = 'add_credit_balance' \
                 WHERE id = $1",
            )
            .bind(row.id)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn settle_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "UPDATE pharmacy_credit_notes SET \
         status = 'settled', settled_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'approved' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn cancel_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "UPDATE pharmacy_credit_notes SET \
         status = 'cancelled', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'approved') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Store Indent handlers
// ══════════════════════════════════════════════════════════

pub async fn list_store_indents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyStoreIndent>>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyStoreIndent>(
        "SELECT * FROM pharmacy_store_indents WHERE tenant_id = $1 ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_store_indent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStoreIndentRequest>,
) -> Result<Json<PharmacyStoreIndent>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let indent_number = format!("PSI-{ts}-{}", &uid.to_string()[..8]);

    let total_items = body
        .items
        .as_array()
        .map_or(0, |arr| i32::try_from(arr.len()).unwrap_or(0));

    let row = sqlx::query_as::<_, PharmacyStoreIndent>(
        "INSERT INTO pharmacy_store_indents \
         (tenant_id, indent_number, from_store_id, to_store_id, items, \
          total_items, notes, requested_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&indent_number)
    .bind(body.from_store_id)
    .bind(body.to_store_id)
    .bind(&body.items)
    .bind(total_items)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_store_indent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyStoreIndent>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyStoreIndent>(
        "UPDATE pharmacy_store_indents SET \
         status = 'approved', approved_by = $3, approved_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn issue_store_indent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyStoreIndent>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyStoreIndent>(
        "UPDATE pharmacy_store_indents SET \
         status = 'issued', issued_by = $3, issued_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'approved' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn receive_store_indent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyStoreIndent>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyStoreIndent>(
        "UPDATE pharmacy_store_indents SET \
         status = 'received', received_by = $3, received_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'issued' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Patient order lookup for credit note auto-fill
// ══════════════════════════════════════════════════════════

/// GET /api/pharmacy/patient-orders/{patient_id} — recent orders for credit note auto-fill
pub async fn list_patient_orders_for_return(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientOrderSummary>>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PatientOrderSummary>(
        "SELECT po.id AS order_id, po.created_at AS order_date, \
         po.status, \
         COALESCE(json_agg(json_build_object( \
           'item_id', poi.id, \
           'drug_name', poi.drug_name, \
           'catalog_item_id', poi.catalog_item_id, \
           'quantity', poi.quantity, \
           'unit_price', poi.unit_price, \
           'total_price', poi.total_price, \
           'batch_number', poi.batch_number \
         )) FILTER (WHERE poi.id IS NOT NULL), '[]') AS items \
         FROM pharmacy_orders po \
         LEFT JOIN pharmacy_order_items poi ON poi.order_id = po.id AND poi.tenant_id = po.tenant_id \
         WHERE po.patient_id = $1 AND po.tenant_id = $2 \
           AND po.status IN ('dispensed', 'ordered') \
         GROUP BY po.id, po.created_at, po.status \
         ORDER BY po.created_at DESC LIMIT 20",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientOrderSummary {
    pub order_id: Uuid,
    pub order_date: DateTime<Utc>,
    pub status: String,
    pub items: serde_json::Value,
}

// ══════════════════════════════════════════════════════════
//  POS sale lookup by receipt number
// ══════════════════════════════════════════════════════════

/// GET /api/pharmacy/pos/lookup?receipt={number} — find POS sale by receipt number for OTC return
pub async fn lookup_pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PosLookupQuery>,
) -> Result<Json<PosLookupResult>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sale = sqlx::query_as::<_, PosLookupResult>(
        "SELECT ps.id, ps.receipt_number, ps.total_amount, \
         ps.payment_mode::text AS payment_mode, \
         ps.status, ps.created_at, \
         COALESCE(json_agg(json_build_object( \
           'item_id', psi.id, \
           'catalog_item_id', psi.catalog_item_id, \
           'drug_name', psi.drug_name, \
           'quantity', psi.quantity, \
           'unit_price', psi.selling_price, \
           'total_price', psi.line_total, \
           'batch_id', psi.batch_id, \
           'is_cancelled', COALESCE(psi.is_cancelled, false) \
         )) FILTER (WHERE psi.id IS NOT NULL), '[]') AS items \
         FROM pharmacy_pos_sales ps \
         LEFT JOIN pharmacy_pos_sale_items psi \
           ON psi.pos_sale_id = ps.id AND psi.tenant_id = ps.tenant_id \
         WHERE ps.receipt_number = $1 AND ps.tenant_id = $2 \
         GROUP BY ps.id, ps.receipt_number, ps.total_amount, \
                  ps.payment_mode, ps.status, ps.created_at",
    )
    .bind(&q.receipt)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(sale))
}

#[derive(Debug, Deserialize)]
pub struct PosLookupQuery {
    pub receipt: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PosLookupResult {
    pub id: Uuid,
    pub receipt_number: Option<String>,
    pub total_amount: Decimal,
    pub payment_mode: Option<String>,
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
    pub items: serde_json::Value,
}

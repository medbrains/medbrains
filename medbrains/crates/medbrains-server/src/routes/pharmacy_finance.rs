use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::{form::FieldAccessLevel, permissions};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::authorization::{require_any_permission, require_permission},
    middleware::{auth::Claims, field_access},
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

const BILLING_AMOUNT_FIELD: &str = "billing.amount";

async fn resolve_pharmacy_finance_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn billing_amount_access(restricted: &HashMap<String, FieldAccessLevel>) -> FieldAccessLevel {
    restricted
        .get(BILLING_AMOUNT_FIELD)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
}

fn should_scrub_billing_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    matches!(
        billing_amount_access(restricted),
        FieldAccessLevel::Mask | FieldAccessLevel::Hidden
    )
}

fn can_write_billing_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    billing_amount_access(restricted) == FieldAccessLevel::Edit
}

fn validate_pharmacy_credit_amount_write_access(
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if can_write_billing_amount(restricted) {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted pharmacy credit amount fields".to_owned(),
    ))
}

fn scrub_credit_note_item_amounts(mut items: serde_json::Value) -> serde_json::Value {
    const AMOUNT_KEYS: &[&str] = &[
        "unit_price",
        "amount",
        "total_price",
        "taxable_amount",
        "tax_amount",
        "line_total",
        "selling_price",
    ];

    if let serde_json::Value::Array(rows) = &mut items {
        for row in rows {
            if let serde_json::Value::Object(map) = row {
                for key in AMOUNT_KEYS {
                    if map.contains_key(*key) {
                        map.insert((*key).to_owned(), serde_json::json!(0));
                    }
                }
            }
        }
    }

    items
}

fn filter_credit_note_amounts(
    mut row: PharmacyCreditNote,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PharmacyCreditNote {
    if should_scrub_billing_amount(restricted) {
        row.total_amount = Decimal::ZERO;
        row.gst_amount = Decimal::ZERO;
        row.net_amount = Decimal::ZERO;
        row.items = scrub_credit_note_item_amounts(row.items);
    }
    row
}

fn filter_patient_order_summary_amounts(
    mut row: PatientOrderSummary,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PatientOrderSummary {
    if should_scrub_billing_amount(restricted) {
        row.items = scrub_credit_note_item_amounts(row.items);
    }
    row
}

fn filter_pos_lookup_amounts(
    mut row: PosLookupResult,
    restricted: &HashMap<String, FieldAccessLevel>,
) -> PosLookupResult {
    if should_scrub_billing_amount(restricted) {
        row.total_amount = Decimal::ZERO;
        row.items = scrub_credit_note_item_amounts(row.items);
    }
    row
}

fn validate_credit_note_request(body: &CreateCreditNoteRequest) -> Result<(), AppError> {
    match body.note_type.as_str() {
        "customer_return" => {
            if body.patient_id.is_none() {
                return Err(AppError::BadRequest(
                    "Customer return credit notes require a patient".to_owned(),
                ));
            }
        }
        "supplier_return" => {
            if body.vendor_id.is_none() {
                return Err(AppError::BadRequest(
                    "Supplier return credit notes require a vendor".to_owned(),
                ));
            }
        }
        "expiry_write_off" | "damage" => {}
        _ => {
            return Err(AppError::BadRequest(format!(
                "Unsupported pharmacy credit note type: {}",
                body.note_type
            )));
        }
    }

    match (&body.reference_type, body.reference_id) {
        (Some(reference_type), None) => {
            return Err(AppError::BadRequest(format!(
                "Credit note reference id is required for reference type: {reference_type}"
            )));
        }
        (None, Some(_)) => {
            return Err(AppError::BadRequest(
                "Credit note reference type is required when reference id is provided".to_owned(),
            ));
        }
        (Some(reference_type), Some(_)) => match reference_type.as_str() {
            "pharmacy_order" | "pharmacy_return" | "grn" | "batch" => {}
            _ => {
                return Err(AppError::BadRequest(format!(
                    "Unsupported pharmacy credit note reference type: {reference_type}"
                )));
            }
        },
        (None, None) => {}
    }

    if body.items.as_array().is_none_or(Vec::is_empty) {
        return Err(AppError::BadRequest(
            "Credit note must include at least one item".to_owned(),
        ));
    }
    if body.total_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Credit note total amount must be greater than zero".to_owned(),
        ));
    }
    if body.gst_amount.unwrap_or(Decimal::ZERO) < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Credit note GST amount cannot be negative".to_owned(),
        ));
    }

    Ok(())
}

async fn ensure_patient_belongs_to_tenant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

async fn ensure_vendor_belongs_to_tenant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    vendor_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM vendors WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(vendor_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

fn ensure_credit_note_patient_reference(
    body: &CreateCreditNoteRequest,
    reference_patient_id: Option<Uuid>,
) -> Result<(), AppError> {
    if body.note_type != "customer_return" {
        return Ok(());
    }

    if reference_patient_id.is_none() || reference_patient_id != body.patient_id {
        return Err(AppError::BadRequest(
            "Credit note patient must match the referenced pharmacy transaction".to_owned(),
        ));
    }

    Ok(())
}

fn ensure_credit_note_vendor_reference(
    body: &CreateCreditNoteRequest,
    reference_vendor_id: Option<Uuid>,
) -> Result<(), AppError> {
    if body.note_type != "supplier_return" {
        return Ok(());
    }

    if reference_vendor_id.is_none() || reference_vendor_id != body.vendor_id {
        return Err(AppError::BadRequest(
            "Credit note vendor must match the referenced supplier transaction".to_owned(),
        ));
    }

    Ok(())
}

async fn validate_credit_note_entity_links(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    body: &CreateCreditNoteRequest,
) -> Result<(), AppError> {
    if let Some(patient_id) = body.patient_id {
        ensure_patient_belongs_to_tenant(tx, tenant_id, patient_id).await?;
    }
    if let Some(vendor_id) = body.vendor_id {
        ensure_vendor_belongs_to_tenant(tx, tenant_id, vendor_id).await?;
    }

    let Some(reference_type) = body.reference_type.as_deref() else {
        return Ok(());
    };
    let Some(reference_id) = body.reference_id else {
        return Ok(());
    };

    match reference_type {
        "pharmacy_order" => {
            let reference_patient_id = sqlx::query_scalar::<_, Option<Uuid>>(
                "SELECT patient_id FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2",
            )
            .bind(reference_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(AppError::NotFound)?;
            ensure_credit_note_patient_reference(body, reference_patient_id)?;
        }
        "pharmacy_return" => {
            let reference_patient_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT patient_id FROM pharmacy_returns WHERE id = $1 AND tenant_id = $2",
            )
            .bind(reference_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(AppError::NotFound)?;
            ensure_credit_note_patient_reference(body, Some(reference_patient_id))?;
        }
        "grn" => {
            let reference_vendor_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT vendor_id FROM goods_receipt_notes WHERE id = $1 AND tenant_id = $2",
            )
            .bind(reference_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(AppError::NotFound)?;
            ensure_credit_note_vendor_reference(body, Some(reference_vendor_id))?;
        }
        "batch" => {
            let reference_vendor_id = sqlx::query_scalar::<_, Option<Uuid>>(
                "SELECT vendor_id FROM pharmacy_batches WHERE id = $1 AND tenant_id = $2",
            )
            .bind(reference_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(AppError::NotFound)?;
            ensure_credit_note_vendor_reference(body, reference_vendor_id)?;
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Unsupported pharmacy credit note reference type: {reference_type}"
            )));
        }
    }

    Ok(())
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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::returns::LIST,
            permissions::pharmacy::returns::APPROVE,
            permissions::pharmacy::returns::REJECT,
        ],
    )?;

    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyCreditNote>(
        "SELECT * FROM pharmacy_credit_notes \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_credit_note_amounts(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditNoteRequest>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::REQUEST)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;
    validate_pharmacy_credit_amount_write_access(&restricted_fields)?;
    validate_credit_note_request(&body)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    validate_credit_note_entity_links(&mut tx, claims.tenant_id, &body).await?;

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
    Ok(Json(filter_credit_note_amounts(row, &restricted_fields)))
}

pub async fn get_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::LIST)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;

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
    Ok(Json(filter_credit_note_amounts(row, &restricted_fields)))
}

pub async fn approve_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::APPROVE)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;

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

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "SELECT * FROM pharmacy_credit_notes WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_note_amounts(row, &restricted_fields)))
}

pub async fn settle_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::APPROVE)?;
    require_permission(&claims, permissions::billing::credit::MANAGE)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;
    validate_pharmacy_credit_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut row = sqlx::query_as::<_, PharmacyCreditNote>(
        "SELECT * FROM pharmacy_credit_notes \
         WHERE id = $1 AND tenant_id = $2 AND status = 'approved' \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(patient_id) = row.patient_id {
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
            sqlx::query(
                "UPDATE invoices SET \
                 paid_amount = paid_amount + $1, \
                 status = CASE \
                   WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
                   ELSE 'partially_paid'::invoice_status \
                 END, \
                 updated_at = now() \
                 WHERE id = $2 AND tenant_id = $3",
            )
            .bind(row.total_amount)
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "UPDATE pharmacy_credit_notes SET adjustment_type = 'reduce_bill', \
                 adjusted_invoice_id = $1 WHERE id = $2",
            )
            .bind(invoice_id)
            .bind(row.id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                "INSERT INTO credit_patients \
                 (tenant_id, patient_id, current_balance, notes) \
                 VALUES ($1, $2, $3, $4) \
                 ON CONFLICT (tenant_id, patient_id) DO UPDATE SET \
                 current_balance = credit_patients.current_balance + $3",
            )
            .bind(claims.tenant_id)
            .bind(patient_id)
            .bind(row.total_amount)
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

    row = sqlx::query_as::<_, PharmacyCreditNote>(
        "UPDATE pharmacy_credit_notes SET \
         status = 'settled', settled_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(row.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_note_amounts(row, &restricted_fields)))
}

pub async fn cancel_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyCreditNote>, AppError> {
    require_permission(&claims, permissions::pharmacy::returns::REJECT)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status = sqlx::query_scalar::<_, String>(
        "SELECT status FROM pharmacy_credit_notes WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if status != "draft" {
        return Err(AppError::Conflict(
            "Only draft pharmacy credit notes can be cancelled; approved notes require reversal"
                .to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, PharmacyCreditNote>(
        "UPDATE pharmacy_credit_notes SET \
         status = 'cancelled', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(filter_credit_note_amounts(row, &restricted_fields)))
}

// ══════════════════════════════════════════════════════════
//  Store Indent handlers
// ══════════════════════════════════════════════════════════

pub async fn list_store_indents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PharmacyStoreIndent>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::stores::LIST,
            permissions::pharmacy::stores::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyStoreIndent>(
        "SELECT * FROM pharmacy_store_indents WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000",
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
    require_permission(&claims, permissions::pharmacy::returns::REQUEST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;

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
           'returned_quantity', COALESCE(return_totals.returned_quantity, 0), \
           'remaining_quantity', GREATEST(poi.quantity - COALESCE(return_totals.returned_quantity, 0), 0), \
           'unit_price', poi.unit_price, \
           'total_price', poi.total_price, \
           'batch_number', poi.batch_number \
         )) FILTER (WHERE poi.id IS NOT NULL), '[]') AS items \
         FROM pharmacy_orders po \
         LEFT JOIN pharmacy_order_items poi ON poi.order_id = po.id AND poi.tenant_id = po.tenant_id \
         LEFT JOIN LATERAL ( \
           SELECT COALESCE(SUM(pr.quantity_returned) FILTER (WHERE pr.status <> 'rejected'), 0)::integer \
             AS returned_quantity \
           FROM pharmacy_returns pr \
           WHERE pr.order_item_id = poi.id AND pr.tenant_id = poi.tenant_id \
         ) return_totals ON TRUE \
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
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_patient_order_summary_amounts(row, &restricted_fields))
            .collect(),
    ))
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
    require_permission(&claims, permissions::pharmacy::returns::REQUEST)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let sale = sqlx::query_as::<_, PosLookupResult>(
        "SELECT ps.id, ps.receipt_number, ps.patient_id, ps.total_amount, \
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
         GROUP BY ps.id, ps.receipt_number, ps.patient_id, ps.total_amount, \
                  ps.payment_mode, ps.status, ps.created_at",
    )
    .bind(&q.receipt)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(filter_pos_lookup_amounts(sale, &restricted_fields)))
}

#[derive(Debug, Deserialize)]
pub struct PosLookupQuery {
    pub receipt: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PosLookupResult {
    pub id: Uuid,
    pub receipt_number: Option<String>,
    pub patient_id: Option<Uuid>,
    pub total_amount: Decimal,
    pub payment_mode: Option<String>,
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
    pub items: serde_json::Value,
}

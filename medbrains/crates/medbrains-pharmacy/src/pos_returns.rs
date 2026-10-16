//! Counter returns and voids.
//!
//! A return is a GST credit note against the original sale (and its billing
//! invoice, when the sale was a registered patient's), refunded to the tenders
//! the sale was paid with. It is taken within the hospital's return window, on
//! an open counter day, for no more than was sold less what already came back
//! — the sale and its lines are locked for the length of the return, so two
//! cashiers cannot return the same strip twice. Good stock goes back to the
//! batch it came from; a batch that has expired takes it into the expiry bin
//! for the witnessed write-off, never back onto the shelf.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_core::pharmacy_phase3::PharmacyPosSale;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::pos_counter::{self, CounterShift};
use crate::return_rules::{
    self, DEFAULT_NON_RETURNABLE, DEFAULT_RETURN_WINDOW_DAYS, LineBlock, RefundPart, ReturnWindow,
    TenderBalance,
};
use crate::{filter_pharmacy_pos_sale_response, resolve_pharmacy_restricted_fields};

/// A reason short enough to say nothing is refused.
const REASON_MIN_CHARS: usize = 5;

// ── what the database knows about a sale ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct SaleHead {
    id: Uuid,
    sale_number: String,
    pharmacy_order_id: Option<Uuid>,
    patient_id: Option<Uuid>,
    billing_invoice_id: Option<Uuid>,
    payment_mode: String,
    total_amount: Decimal,
    refund_amount: Decimal,
    status: String,
    business_date: Option<NaiveDate>,
    sale_location_id: Option<Uuid>,
    sale_date: NaiveDate,
    today: NaiveDate,
    window_days: i32,
}

const SALE_HEAD_SQL: &str = "SELECT s.id, s.sale_number, s.pharmacy_order_id, s.patient_id, \
        s.billing_invoice_id, s.payment_mode::text AS payment_mode, s.total_amount, \
        COALESCE(s.refund_amount, 0) AS refund_amount, \
        COALESCE(s.status, 'completed') AS status, s.business_date, \
        dr.pharmacy_location_id AS sale_location_id, \
        tenant_local_date(s.tenant_id, s.created_at) AS sale_date, \
        tenant_local_date(s.tenant_id, now()) AS today, \
        COALESCE((SELECT (ts.value #>> '{}')::int FROM tenant_settings ts \
                   WHERE ts.tenant_id = s.tenant_id AND ts.category = 'pharmacy' \
                     AND ts.key = 'return_window_days' AND ts.deleted_at IS NULL), $3) \
          AS window_days \
   FROM pharmacy_pos_sales s \
   LEFT JOIN pharmacy_cash_drawers dr ON dr.id = s.cash_drawer_id AND dr.tenant_id = s.tenant_id \
  WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL";

/// One sold line with what the return rules need to know about it.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ReturnLineFacts {
    pub item_id: Uuid,
    pub drug_name: String,
    pub catalog_item_id: Option<Uuid>,
    pub batch_id: Option<Uuid>,
    pub batch_number: Option<String>,
    pub quantity: i32,
    pub returned_qty: i32,
    pub line_total: Decimal,
    pub line_gst: Decimal,
    pub cold_chain: bool,
    pub controlled: bool,
    pub expired: bool,
}

const LINES_SQL: &str = "SELECT i.id AS item_id, i.drug_name, i.catalog_item_id, i.batch_id, \
        i.batch_number, i.quantity, COALESCE(i.cancelled_qty, 0) AS returned_qty, \
        i.line_total, (i.cgst_amount + i.sgst_amount + i.igst_amount) AS line_gst, \
        COALESCE(c.needs_cold_chain, false) AS cold_chain, \
        (COALESCE(c.is_controlled, false) \
           OR COALESCE(c.drug_schedule::text IN ('X', 'NDPS'), false)) AS controlled, \
        (b.expiry_date IS NOT NULL AND b.expiry_date <= tenant_local_date(i.tenant_id, now())) \
          AS expired \
   FROM pharmacy_pos_sale_items i \
   LEFT JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
   LEFT JOIN pharmacy_batches b ON b.id = i.batch_id AND b.tenant_id = i.tenant_id \
  WHERE i.pos_sale_id = $1 AND i.tenant_id = $2 \
  ORDER BY i.created_at, i.id";

async fn sale_head(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    sale_id: Uuid,
    lock: bool,
) -> Result<SaleHead, AppError> {
    let sql = if lock {
        format!("{SALE_HEAD_SQL} FOR UPDATE OF s")
    } else {
        SALE_HEAD_SQL.to_owned()
    };
    sqlx::query_as::<_, SaleHead>(&sql)
        .bind(sale_id)
        .bind(tenant_id)
        .bind(DEFAULT_RETURN_WINDOW_DAYS)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

async fn sale_lines(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    sale_id: Uuid,
    lock: bool,
) -> Result<Vec<ReturnLineFacts>, AppError> {
    let sql = if lock {
        format!("{LINES_SQL} FOR UPDATE OF i")
    } else {
        LINES_SQL.to_owned()
    };
    Ok(sqlx::query_as::<_, ReturnLineFacts>(&sql)
        .bind(sale_id)
        .bind(tenant_id)
        .fetch_all(&mut **tx)
        .await?)
}

/// What each tender took and has given back. A sale from before split tender
/// has no tender rows; it was paid whole by its one payment mode.
async fn sale_tenders(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    head: &SaleHead,
) -> Result<Vec<TenderBalance>, AppError> {
    let rows = sqlx::query_as::<_, TenderBalance>(
        "SELECT payment_mode AS mode, \
                COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS paid, \
                COALESCE(-SUM(amount) FILTER (WHERE amount < 0), 0) AS refunded \
           FROM pharmacy_payment_transactions \
          WHERE tenant_id = $1 AND pos_sale_id = $2 AND deleted_at IS NULL \
          GROUP BY payment_mode ORDER BY payment_mode",
    )
    .bind(tenant_id)
    .bind(head.id)
    .fetch_all(&mut **tx)
    .await?;
    if rows.iter().any(|t| t.paid > Decimal::ZERO) {
        return Ok(rows);
    }
    let mode = if head.payment_mode == "mixed" {
        "cash"
    } else {
        head.payment_mode.as_str()
    };
    Ok(vec![TenderBalance {
        mode: mode.to_owned(),
        paid: head.total_amount,
        refunded: head.refund_amount,
    }])
}

async fn non_returnable_categories(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<String>, AppError> {
    let configured: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'pharmacy' AND key = 'non_returnable' \
            AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(configured
        .and_then(|v| serde_json::from_value::<Vec<String>>(v).ok())
        .unwrap_or_else(|| {
            DEFAULT_NON_RETURNABLE
                .iter()
                .map(|c| (*c).to_owned())
                .collect()
        }))
}

fn window_of(head: &SaleHead) -> ReturnWindow {
    return_rules::return_window(head.sale_date, head.today, head.window_days)
}

fn reason_text(reason: Option<&str>) -> Option<&str> {
    reason
        .map(str::trim)
        .filter(|r| r.chars().count() >= REASON_MIN_CHARS)
}

// ── reading: what may come back ─────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ReturnableLine {
    #[serde(flatten)]
    pub facts: ReturnLineFacts,
    pub returnable_qty: i32,
    /// Refund for one more unit, GST included.
    pub unit_refund: Decimal,
    pub block: Option<LineBlock>,
}

#[derive(Debug, Serialize)]
pub struct Returnable {
    pub sale_id: Uuid,
    pub sale_number: String,
    pub status: String,
    pub window: ReturnWindow,
    pub can_override_window: bool,
    pub can_take_controlled: bool,
    pub lines: Vec<ReturnableLine>,
    pub tenders: Vec<TenderBalance>,
}

/// `GET /api/pharmacy/pos/sales/{id}/returnable`
pub async fn get_returnable(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Returnable>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::RETURN,
            permissions::pharmacy::pos::CANCEL,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let head = sale_head(&mut tx, claims.tenant_id, id, false).await?;
    let facts = sale_lines(&mut tx, claims.tenant_id, id, false).await?;
    let tenders = sale_tenders(&mut tx, claims.tenant_id, &head).await?;
    let categories = non_returnable_categories(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    let lines = facts
        .into_iter()
        .map(|f| {
            let returnable_qty = (f.quantity - f.returned_qty).max(0);
            let (unit_refund, _) = return_rules::line_refund(
                f.line_total,
                f.line_gst,
                f.quantity,
                f.returned_qty,
                i32::from(returnable_qty > 0),
            );
            let block =
                return_rules::line_block(&f.drug_name, f.cold_chain, f.controlled, &categories);
            ReturnableLine {
                facts: f,
                returnable_qty,
                unit_refund,
                block,
            }
        })
        .collect();
    Ok(Json(Returnable {
        sale_id: head.id,
        sale_number: head.sale_number.clone(),
        status: head.status.clone(),
        window: window_of(&head),
        can_override_window: require_permission(
            &claims,
            permissions::pharmacy::returns::OVERRIDE_WINDOW,
        )
        .is_ok(),
        can_take_controlled: require_permission(
            &claims,
            permissions::pharmacy::returns::CONTROLLED,
        )
        .is_ok(),
        lines,
        tenders,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ReceiptLookupQuery {
    pub number: String,
}

/// `GET /api/pharmacy/pos/receipt-lookup?number=` — a sale by its printed
/// receipt or sale number, as a customer hands it across the counter.
pub async fn lookup_receipt(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ReceiptLookupQuery>,
) -> Result<Json<PharmacyPosSale>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::RETURN,
            permissions::pharmacy::pos::VIEW,
        ],
    )?;
    let number = q.number.trim();
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sale = sqlx::query_as::<_, PharmacyPosSale>(
        "SELECT * FROM pharmacy_pos_sales \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND (receipt_number = $2 OR sale_number = $2) \
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(number)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_pos_sale_response(
        sale,
        &restricted_fields,
    )))
}

// ── writing: the return ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ReturnPosItemsRequest {
    pub items: Vec<ReturnPosItem>,
    pub reason: Option<String>,
    /// How the money goes back. Absent, in proportion to how it was paid.
    pub refund_to: Option<Vec<RefundPart>>,
}

#[derive(Debug, Deserialize)]
pub struct ReturnPosItem {
    pub item_id: Uuid,
    pub return_qty: i32,
}

#[derive(Debug, Deserialize)]
pub struct CancelPosSaleRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReturnedLine {
    pub item_id: Uuid,
    pub drug_name: String,
    pub qty: i32,
    pub refund: Decimal,
    pub gst: Decimal,
    /// `stock` back to its batch, or `expiry_bin` when the batch has expired.
    pub destination: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ReturnResult {
    pub credit_note_id: Uuid,
    pub credit_note_number: String,
    pub refund_total: Decimal,
    pub gst_reversed: Decimal,
    pub refunds: Vec<RefundPart>,
    pub lines: Vec<ReturnedLine>,
    pub sale_status: String,
    pub business_date: NaiveDate,
}

struct ReturnRequest<'a> {
    sale_id: Uuid,
    /// `(item_id, qty)`; for a void, every line's remaining quantity.
    items: Vec<(Uuid, i32)>,
    reason: Option<&'a str>,
    refund_to: Option<&'a [RefundPart]>,
    void: bool,
}

/// `PUT /api/pharmacy/pos/sales/{id}/return-items`
pub async fn return_pos_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnPosItemsRequest>,
) -> Result<Json<ReturnResult>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::RETURN)?;
    let request = ReturnRequest {
        sale_id: id,
        items: body
            .items
            .iter()
            .map(|i| (i.item_id, i.return_qty))
            .collect(),
        reason: body.reason.as_deref(),
        refund_to: body.refund_to.as_deref(),
        void: false,
    };
    Ok(Json(take_return(&state, &claims, request).await?))
}

/// `PUT /api/pharmacy/pos/sales/{id}/cancel` — void the sale on the day it was
/// rung: every remaining line comes back, under the same rules as a return.
pub async fn cancel_pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelPosSaleRequest>,
) -> Result<Json<ReturnResult>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CANCEL)?;
    let request = ReturnRequest {
        sale_id: id,
        items: Vec::new(),
        reason: body.reason.as_deref(),
        refund_to: None,
        void: true,
    };
    Ok(Json(take_return(&state, &claims, request).await?))
}

async fn take_return(
    state: &AppState,
    claims: &Claims,
    request: ReturnRequest<'_>,
) -> Result<ReturnResult, AppError> {
    let reason = reason_text(request.reason);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // A return rung on a drawer counts to its counter and day; cash going back
    // must come out of one (checked once the refund is known).
    let shift = pos_counter::open_shift_in_tx(&mut tx, claims.tenant_id, claims.sub).await?;
    if let Some(shift) = &shift {
        pos_counter::require_counter_day_open_in_tx(&mut tx, claims.tenant_id, shift, false)
            .await?;
    }

    // The sale row is the lock: two returns of one sale run one after the other.
    let head = sale_head(&mut tx, claims.tenant_id, request.sale_id, true).await?;
    if matches!(head.status.as_str(), "cancelled" | "refunded") {
        return Err(AppError::Conflict(
            "Everything on this sale has already come back".to_owned(),
        ));
    }
    if request.void {
        require_same_counter_day(&head, shift.as_ref())?;
    }
    let window = window_of(&head);
    let override_reason = if window.locked && !request.void {
        require_permission(claims, permissions::pharmacy::returns::OVERRIDE_WINDOW).map_err(
            |_| {
                AppError::Conflict(format!(
                    "Returns for this sale closed on {} — {} days after the sale on {}",
                    window.locks_on, window.window_days, window.sale_date
                ))
            },
        )?;
        Some(reason.ok_or_else(|| {
            AppError::BadRequest("Give the reason for taking a return after the window".to_owned())
        })?)
    } else {
        None
    };

    let facts = sale_lines(&mut tx, claims.tenant_id, head.id, true).await?;
    let wanted = if request.void {
        facts
            .iter()
            .map(|f| (f.item_id, f.quantity - f.returned_qty))
            .filter(|(_, qty)| *qty > 0)
            .collect()
    } else {
        request.items.clone()
    };
    if wanted.is_empty() {
        return Err(AppError::BadRequest(
            "Choose what is coming back".to_owned(),
        ));
    }
    if request.void && reason.is_none() {
        return Err(AppError::BadRequest(
            "Give the reason for the void".to_owned(),
        ));
    }

    let categories = non_returnable_categories(&mut tx, claims.tenant_id).await?;
    let mut lines = Vec::with_capacity(wanted.len());
    for (item_id, qty) in &wanted {
        let Some(line) = facts.iter().find(|f| f.item_id == *item_id) else {
            return Err(AppError::BadRequest(
                "That line is not on this sale".to_owned(),
            ));
        };
        let remaining = line.quantity - line.returned_qty;
        if *qty <= 0 || *qty > remaining {
            return Err(AppError::Conflict(format!(
                "Only {remaining} of {} can come back: {} sold, {} already returned",
                line.drug_name, line.quantity, line.returned_qty
            )));
        }
        match return_rules::line_block(
            &line.drug_name,
            line.cold_chain,
            line.controlled,
            &categories,
        ) {
            Some(LineBlock::Refused(message)) => return Err(AppError::Conflict(message)),
            Some(LineBlock::NeedsControlledRight(message)) => {
                require_permission(claims, permissions::pharmacy::returns::CONTROLLED)
                    .map_err(|_| AppError::Conflict(message))?;
                if reason.is_none() {
                    return Err(AppError::BadRequest(
                        "Give the reason for taking back a controlled drug".to_owned(),
                    ));
                }
            }
            None => {}
        }
        let (refund, gst) = return_rules::line_refund(
            line.line_total,
            line.line_gst,
            line.quantity,
            line.returned_qty,
            *qty,
        );
        lines.push((line.clone(), *qty, refund, gst));
    }

    let refund_total: Decimal = lines.iter().map(|(_, _, r, _)| *r).sum();
    let gst_reversed: Decimal = lines.iter().map(|(_, _, _, g)| *g).sum();
    let tenders = sale_tenders(&mut tx, claims.tenant_id, &head).await?;
    let refunds = match request.refund_to {
        Some(chosen) => {
            return_rules::validate_chosen_refund(refund_total, &tenders, chosen)?;
            chosen.to_vec()
        }
        None => return_rules::allocate_refund(refund_total, &tenders)?,
    };
    if refunds
        .iter()
        .any(|p| matches!(p.mode.as_str(), "card" | "upi") && p.reference.is_none())
        && request.refund_to.is_none()
    {
        return Err(AppError::BadRequest(
            "Card and UPI refunds need their reference: choose how the money goes back".to_owned(),
        ));
    }

    if shift.is_none() && refunds.iter().any(|p| p.mode == "cash") {
        return Err(AppError::Conflict(
            "Open your cash drawer to pay cash back".to_owned(),
        ));
    }
    let business_date = shift.as_ref().map_or(head.today, |s| s.business_date);

    let number: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) + 1 FROM pharmacy_credit_notes \
          WHERE tenant_id = $1 AND original_pos_sale_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(head.id)
    .fetch_one(&mut *tx)
    .await?;
    let credit_note_number = format!("CN-{}-{number}", head.sale_number);

    let mut returned = Vec::with_capacity(lines.len());
    for (line, qty, refund, gst) in &lines {
        let destination = restock_line(&mut tx, claims, line, *qty, &credit_note_number).await?;
        returned.push(ReturnedLine {
            item_id: line.item_id,
            drug_name: line.drug_name.clone(),
            qty: *qty,
            refund: *refund,
            gst: *gst,
            destination,
        });
    }

    let money_back: Decimal = refunds
        .iter()
        .filter(|p| p.mode != "credit")
        .map(|p| p.amount)
        .sum();
    let credit_note_id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_credit_notes \
         (tenant_id, credit_note_number, note_type, patient_id, items, total_amount, gst_amount, \
          net_amount, status, approved_by, approved_at, settled_at, notes, created_by, \
          adjustment_type, adjusted_invoice_id, original_order_id, original_pos_sale_id, \
          cash_drawer_id, business_date, refund_tenders, window_override_reason, \
          window_override_by) \
         VALUES ($1, $2, 'customer_return', $3, $4, $5, $6, $5 - $6, 'settled', $7, now(), now(), \
                 $8, $7, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&credit_note_number)
    .bind(head.patient_id)
    .bind(json!(returned))
    .bind(refund_total)
    .bind(gst_reversed)
    .bind(claims.sub)
    .bind(reason)
    .bind(if money_back > Decimal::ZERO {
        "cash_refund"
    } else {
        "reduce_bill"
    })
    .bind(head.billing_invoice_id)
    .bind(head.pharmacy_order_id)
    .bind(head.id)
    .bind(shift.as_ref().map(|s| s.id))
    .bind(business_date)
    .bind(json!(refunds))
    .bind(override_reason)
    .bind(override_reason.map(|_| claims.sub))
    .fetch_one(&mut *tx)
    .await?;

    for part in &refunds {
        sqlx::query(
            "INSERT INTO pharmacy_payment_transactions \
             (tenant_id, pos_sale_id, payment_mode, amount, reference_number, shift_id, created_by) \
             VALUES ($1, $2, $3, -$4::numeric, $5, $6, $7)",
        )
        .bind(claims.tenant_id)
        .bind(head.id)
        .bind(&part.mode)
        .bind(part.amount)
        .bind(part.reference.as_deref().unwrap_or(&credit_note_number))
        .bind(shift.as_ref().map(|s| s.id.to_string()))
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }

    let sale_status: String = sqlx::query_scalar(
        "UPDATE pharmacy_pos_sales SET \
           refund_amount = COALESCE(refund_amount, 0) + $3, \
           status = CASE WHEN NOT EXISTS ( \
               SELECT 1 FROM pharmacy_pos_sale_items i \
                WHERE i.pos_sale_id = $1 AND i.tenant_id = $2 \
                  AND COALESCE(i.cancelled_qty, 0) < i.quantity) \
             THEN 'cancelled' ELSE 'partially_cancelled' END, \
           cancelled_at = CASE WHEN $4 THEN now() ELSE cancelled_at END, \
           cancelled_by = CASE WHEN $4 THEN $5 ELSE cancelled_by END, \
           cancel_reason = CASE WHEN $4 THEN $6 ELSE cancel_reason END, \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING status",
    )
    .bind(head.id)
    .bind(claims.tenant_id)
    .bind(refund_total)
    .bind(request.void)
    .bind(claims.sub)
    .bind(reason)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(invoice_id) = head.billing_invoice_id {
        let reversal = InvoiceReversal {
            invoice_id,
            patient_id: head.patient_id,
            credit_note_number: &credit_note_number,
            refund_total,
            refunds: &refunds,
            reason: reason.unwrap_or("Counter return"),
        };
        reverse_on_invoice(&mut tx, claims, &reversal).await?;
    }

    tx.commit().await?;
    Ok(ReturnResult {
        credit_note_id,
        credit_note_number,
        refund_total,
        gst_reversed,
        refunds,
        lines: returned,
        sale_status,
        business_date,
    })
}

/// A void undoes a sale on its own day at its own counter; afterwards it is a
/// return, with a credit note dated to the day it happens.
fn require_same_counter_day(head: &SaleHead, shift: Option<&CounterShift>) -> Result<(), AppError> {
    let today = shift.map_or(head.today, |s| s.business_date);
    let same_day = head.business_date == Some(today);
    let same_counter = match (head.sale_location_id, shift) {
        (Some(location), Some(shift)) => location == shift.pharmacy_location_id,
        _ => true,
    };
    if same_day && same_counter {
        return Ok(());
    }
    Err(AppError::Conflict(
        "A sale can be voided only on its own day at its own counter; take a return instead"
            .to_owned(),
    ))
}

/// Back to the batch it came from, and the catalogue count with it. A batch
/// past its date is the expiry bin: FEFO never issues from it and the
/// witnessed write-off takes it away.
async fn restock_line(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    line: &ReturnLineFacts,
    qty: i32,
    credit_note_number: &str,
) -> Result<&'static str, AppError> {
    sqlx::query(
        "UPDATE pharmacy_pos_sale_items SET \
           cancelled_qty = COALESCE(cancelled_qty, 0) + $3, \
           is_cancelled = COALESCE(cancelled_qty, 0) + $3 >= quantity \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(line.item_id)
    .bind(claims.tenant_id)
    .bind(qty)
    .execute(&mut **tx)
    .await?;
    let destination = if line.expired { "expiry_bin" } else { "stock" };
    let Some(catalog_id) = line.catalog_item_id else {
        return Ok(destination);
    };
    sqlx::query(
        "UPDATE pharmacy_catalog SET current_stock = current_stock + $1, updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(qty)
    .bind(catalog_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    if let Some(batch_id) = line.batch_id {
        sqlx::query(
            "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand + $1, \
                    quantity_dispensed = GREATEST(quantity_dispensed - $1, 0), updated_at = now() \
              WHERE id = $2 AND tenant_id = $3",
        )
        .bind(qty)
        .bind(batch_id)
        .bind(claims.tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    let note = if line.expired {
        format!("Counter return {credit_note_number}: batch expired, held for write-off")
    } else {
        format!("Counter return {credit_note_number}")
    };
    sqlx::query(
        "INSERT INTO pharmacy_stock_transactions \
         (tenant_id, catalog_item_id, transaction_type, quantity, reference_id, notes, created_by) \
         VALUES ($1, $2, 'return', $3, $4, $5, $6)",
    )
    .bind(claims.tenant_id)
    .bind(catalog_id)
    .bind(qty)
    .bind(line.batch_id.unwrap_or(line.item_id))
    .bind(note)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    Ok(destination)
}

/// On the patient's invoice: the credit note reduces what the bill is worth,
/// and each refund takes back what was paid. Credit refunded nothing, so what
/// the patient owes falls by that much.
#[derive(Clone, Copy)]
struct InvoiceReversal<'a> {
    invoice_id: Uuid,
    patient_id: Option<Uuid>,
    credit_note_number: &'a str,
    refund_total: Decimal,
    refunds: &'a [RefundPart],
    reason: &'a str,
}

async fn reverse_on_invoice(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    reversal: &InvoiceReversal<'_>,
) -> Result<(), AppError> {
    let InvoiceReversal {
        invoice_id,
        patient_id,
        credit_note_number,
        refund_total,
        refunds,
        reason,
    } = *reversal;
    sqlx::query(
        "INSERT INTO credit_notes \
         (tenant_id, credit_note_number, invoice_id, amount, reason, status, \
          used_against_invoice_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, 'used', $3, $6)",
    )
    .bind(claims.tenant_id)
    .bind(credit_note_number)
    .bind(invoice_id)
    .bind(refund_total)
    .bind(format!("Pharmacy counter return: {reason}"))
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    let mut money_back = Decimal::ZERO;
    for part in refunds.iter().filter(|p| p.mode != "credit") {
        money_back += part.amount;
        sqlx::query(
            "INSERT INTO refunds \
             (tenant_id, invoice_id, refund_number, amount, reason, mode, reference_number, \
              refunded_by, patient_id, refund_date) \
             VALUES ($1, $2, $3, $4, $5, $6::payment_mode, $7, $8, $9, now())",
        )
        .bind(claims.tenant_id)
        .bind(invoice_id)
        .bind(format!("{credit_note_number}-{}", part.mode.to_uppercase()))
        .bind(part.amount)
        .bind(format!("Pharmacy counter return {credit_note_number}"))
        .bind(&part.mode)
        .bind(&part.reference)
        .bind(claims.sub)
        .bind(patient_id)
        .execute(&mut **tx)
        .await?;
    }
    sqlx::query(
        "UPDATE invoices SET \
           paid_amount = paid_amount + $1, \
           status = CASE WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
                         ELSE 'partially_paid'::invoice_status END, \
           updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(refund_total - money_back)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// A counter credit note, for its print.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CounterCreditNote {
    pub id: Uuid,
    pub credit_note_number: String,
    pub sale_number: String,
    pub invoice_number: Option<String>,
    pub items: serde_json::Value,
    pub total_amount: Decimal,
    pub gst_amount: Decimal,
    pub net_amount: Decimal,
    pub refund_tenders: serde_json::Value,
    pub notes: Option<String>,
    pub window_override_reason: Option<String>,
    pub business_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/pharmacy/pos/credit-notes/{id}`
pub async fn get_counter_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CounterCreditNote>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::RETURN,
            permissions::pharmacy::pos::VIEW,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let note = sqlx::query_as::<_, CounterCreditNote>(
        "SELECT cn.id, cn.credit_note_number, s.sale_number, inv.invoice_number, cn.items, \
                cn.total_amount, cn.gst_amount, cn.net_amount, cn.refund_tenders, cn.notes, \
                cn.window_override_reason, cn.business_date, cn.created_at \
           FROM pharmacy_credit_notes cn \
           JOIN pharmacy_pos_sales s ON s.id = cn.original_pos_sale_id AND s.tenant_id = cn.tenant_id \
           LEFT JOIN invoices inv ON inv.id = cn.adjusted_invoice_id AND inv.tenant_id = cn.tenant_id \
          WHERE cn.id = $1 AND cn.tenant_id = $2 AND cn.deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(note))
}

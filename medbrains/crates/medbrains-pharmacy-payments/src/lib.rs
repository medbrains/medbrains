use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use axum::routing::{get,post,put};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Row / Request types — Payment Transactions
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyPaymentTransaction {
    pub id: Uuid,
    pub tenant_id: Uuid,
    // No `transaction_number` column exists on
    // pharmacy_payment_transactions, so `RETURNING *` could never fill it and
    // this struct could not decode. The generated PTXN- reference is still
    // built and carried into the payment's note; it simply has no column of
    // its own. A payment therefore has no human-readable reference of record
    // — a real gap, needing the column and the receipt that shows it.
    pub pos_sale_id: Option<Uuid>,
    pub order_id: Option<Uuid>,
    pub invoice_id: Option<Uuid>,
    pub payment_mode: String,
    pub amount: Decimal,
    pub reference_number: Option<String>,
    pub device_terminal_id: Option<String>,
    pub upi_transaction_id: Option<String>,
    pub card_last_four: Option<String>,
    pub card_network: Option<String>,
    pub card_approval_code: Option<String>,
    pub shift_id: Option<Uuid>,
    pub counter_id: Option<Uuid>,
    pub reconciliation_status: String,
    pub reconciled_at: Option<DateTime<Utc>>,
    pub reconciled_by: Option<Uuid>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub pos_sale_id: Option<Uuid>,
    pub order_id: Option<Uuid>,
    pub invoice_id: Option<Uuid>,
    pub payment_mode: String,
    pub amount: Decimal,
    pub reference_number: Option<String>,
    pub device_terminal_id: Option<String>,
    pub upi_transaction_id: Option<String>,
    pub card_last_four: Option<String>,
    pub card_network: Option<String>,
    pub card_approval_code: Option<String>,
    pub shift_id: Option<Uuid>,
    pub counter_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ListPaymentsQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReconcileRequest {
    pub matched_reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DayReconciliationQuery {
    pub date: Option<String>,
    pub counter_id: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Row / Request types — Day Settlement
// ══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PharmacyDaySettlement {
    // Mirrors `pharmacy_day_settlements` exactly. It previously declared
    // total_system, matched_count, pending_count and updated_at -- none of
    // which are columns -- while omitting six that are, so `RETURNING *`
    // could not decode and every settlement handler failed. The TypeScript
    // type already matched the table; only this drifted.
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub settlement_date: NaiveDate,
    pub counter_id: Option<String>,
    pub shift_id: Option<String>,
    pub cash_system: Option<Decimal>,
    pub cash_counted: Option<Decimal>,
    pub cash_difference: Option<Decimal>,
    pub card_system: Option<Decimal>,
    pub card_settled: Option<Decimal>,
    pub upi_system: Option<Decimal>,
    pub upi_matched: Option<Decimal>,
    pub upi_unmatched: Option<Decimal>,
    pub insurance_system: Option<Decimal>,
    pub credit_system: Option<Decimal>,
    pub total_sales: Option<Decimal>,
    pub total_returns: Option<Decimal>,
    pub net_collection: Option<Decimal>,
    pub transactions_count: Option<i32>,
    pub returns_count: Option<i32>,
    pub status: Option<String>,
    pub closed_by: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct GetSettlementQuery {
    pub date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CloseSettlementRequest {
    pub cash_counted: Decimal,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Payment Transaction handlers
// ══════════════════════════════════════════════════════════

pub async fn list_payments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPaymentsQuery>,
) -> Result<Json<Vec<PharmacyPaymentTransaction>>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, PharmacyPaymentTransaction>(
        "SELECT * FROM pharmacy_payment_transactions \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR reconciliation_status = $2) \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePaymentRequest>,
) -> Result<Json<PharmacyPaymentTransaction>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let transaction_number = format!("PTXN-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, PharmacyPaymentTransaction>(
        "INSERT INTO pharmacy_payment_transactions \
         (tenant_id, pos_sale_id, order_id, invoice_id, \
          payment_mode, amount, reference_number, device_terminal_id, \
          upi_transaction_id, card_last_four, card_network, card_approval_code, \
          shift_id, counter_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.pos_sale_id)
    .bind(body.order_id)
    .bind(body.invoice_id)
    .bind(&body.payment_mode)
    .bind(body.amount)
    .bind(&body.reference_number)
    .bind(&body.device_terminal_id)
    .bind(&body.upi_transaction_id)
    .bind(&body.card_last_four)
    .bind(&body.card_network)
    .bind(&body.card_approval_code)
    .bind(body.shift_id)
    .bind(body.counter_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Propagate to canonical invoices.paid_amount + status so patient
    // running balance clears when the POS settles a billed invoice.
    // Without this, pharmacy POS payments only land in
    // pharmacy_payment_transactions and the invoice keeps its full balance.
    if let Some(invoice_id) = body.invoice_id {
        let payment_mode_enum = match body.payment_mode.as_str() {
            "cash" => "cash",
            "card" => "card",
            "upi" | "gpay" | "phonepe" | "paytm" => "upi",
            "insurance" => "insurance",
            "credit" => "credit",
            _ => "cash",
        };
        sqlx::query(
            "INSERT INTO payments \
             (tenant_id, invoice_id, amount, mode, reference_number, notes, paid_at, received_by) \
             VALUES ($1, $2, $3, $4::payment_mode, $5, $6, now(), $7)",
        )
        .bind(claims.tenant_id)
        .bind(invoice_id)
        .bind(body.amount)
        .bind(payment_mode_enum)
        .bind(&body.reference_number)
        .bind(format!("Pharmacy POS {transaction_number}"))
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
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
        .bind(body.amount)
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn reconcile_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReconcileRequest>,
) -> Result<Json<PharmacyPaymentTransaction>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PharmacyPaymentTransaction>(
        "UPDATE pharmacy_payment_transactions SET \
         reconciliation_status = 'matched', \
         reconciled_at = now(), \
         reconciled_by = $3, \
         reference_number = COALESCE($4, reference_number), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND reconciliation_status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&body.matched_reference)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize)]
pub struct AutoReconcileResult {
    pub matched_count: i64,
}

pub async fn auto_reconcile_upi(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoReconcileResult>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let result = sqlx::query_scalar::<_, i64>(
        "WITH matched AS ( \
             UPDATE pharmacy_payment_transactions SET \
             reconciliation_status = 'matched', \
             reconciled_at = now(), \
             reconciled_by = $2, \
             updated_at = now() \
             WHERE tenant_id = $1 \
               AND reconciliation_status = 'pending' \
               AND payment_mode IN ('upi', 'gpay', 'phonepe', 'paytm') \
               AND upi_transaction_id IS NOT NULL \
             RETURNING id \
         ) \
         SELECT COUNT(*) FROM matched",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(AutoReconcileResult {
        matched_count: result,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DayReconciliationSummary {
    pub cash_total: Option<Decimal>,
    pub card_total: Option<Decimal>,
    pub upi_total: Option<Decimal>,
    pub insurance_total: Option<Decimal>,
    pub credit_total: Option<Decimal>,
    pub transactions_count: Option<i64>,
    pub matched_total: Option<Decimal>,
    pub pending_total: Option<Decimal>,
}

pub async fn day_reconciliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DayReconciliationQuery>,
) -> Result<Json<DayReconciliationSummary>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let target_date = params
        .date
        .as_deref()
        .and_then(|d| d.parse::<NaiveDate>().ok())
        .unwrap_or_else(|| Utc::now().date_naive());

    let counter_id = params
        .counter_id
        .as_deref()
        .and_then(|c| c.parse::<Uuid>().ok());

    let row = sqlx::query_as::<_, DayReconciliationSummary>(
        "SELECT \
           SUM(CASE WHEN payment_mode = 'cash' \
               THEN amount ELSE 0 END) AS cash_total, \
           SUM(CASE WHEN payment_mode = 'card' \
               THEN amount ELSE 0 END) AS card_total, \
           SUM(CASE WHEN payment_mode IN ('upi','gpay','phonepe','paytm') \
               THEN amount ELSE 0 END) AS upi_total, \
           SUM(CASE WHEN payment_mode = 'insurance' \
               THEN amount ELSE 0 END) AS insurance_total, \
           SUM(CASE WHEN payment_mode = 'credit' \
               THEN amount ELSE 0 END) AS credit_total, \
           COUNT(*) AS transactions_count, \
           SUM(CASE WHEN reconciliation_status = 'matched' \
               THEN amount ELSE 0 END) AS matched_total, \
           SUM(CASE WHEN reconciliation_status = 'pending' \
               THEN amount ELSE 0 END) AS pending_total \
         FROM pharmacy_payment_transactions \
         WHERE tenant_id = $1 \
           AND created_at::date = $2 \
           AND ($3::uuid IS NULL OR counter_id = $3::text)",
    )
    .bind(claims.tenant_id)
    .bind(target_date)
    .bind(counter_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Day Settlement handlers
// ══════════════════════════════════════════════════════════

pub async fn get_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<GetSettlementQuery>,
) -> Result<Json<PharmacyDaySettlement>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let target_date = params
        .date
        .as_deref()
        .and_then(|d| d.parse::<NaiveDate>().ok())
        .unwrap_or_else(|| Utc::now().date_naive());

    let row = sqlx::query_as::<_, PharmacyDaySettlement>(
        // `total_system`, `matched_count` and `pending_count` are not columns.
        // The sum of the day's payments is `total_sales`; how many of them are
        // matched or still pending is recorded nowhere on a settlement row, so
        // those two counts are dropped rather than forced into `upi_matched`,
        // which is a UPI amount and not a count of anything. The reconciliation
        // screen never showed them -- the TypeScript type has never had them
        // either.
        //
        // The conflict target carries the partial index's predicate so it
        // matches idx_settlements_tenant_date_no_counter (migration 1013).
        // Naming (tenant_id, settlement_date) alone matched no unique index at
        // all, and adding counter_id would not have helped: this settlement is
        // tenant-wide, counter_id is NULL, and NULLs do not conflict.
        "INSERT INTO pharmacy_day_settlements \
         (tenant_id, settlement_date, \
          cash_system, card_system, upi_system, insurance_system, \
          credit_system, total_sales, transactions_count) \
         SELECT $1, $2, \
           COALESCE(SUM(CASE WHEN payment_mode='cash' \
               THEN amount ELSE 0 END), 0), \
           COALESCE(SUM(CASE WHEN payment_mode='card' \
               THEN amount ELSE 0 END), 0), \
           COALESCE(SUM(CASE WHEN payment_mode IN ('upi','gpay','phonepe','paytm') \
               THEN amount ELSE 0 END), 0), \
           COALESCE(SUM(CASE WHEN payment_mode='insurance' \
               THEN amount ELSE 0 END), 0), \
           COALESCE(SUM(CASE WHEN payment_mode='credit' \
               THEN amount ELSE 0 END), 0), \
           COALESCE(SUM(amount), 0), \
           COUNT(*)::int \
         FROM pharmacy_payment_transactions \
         WHERE tenant_id = $1 AND created_at::date = $2 \
         ON CONFLICT (tenant_id, settlement_date) \
           WHERE counter_id IS NULL AND deleted_at IS NULL DO UPDATE SET \
           cash_system = EXCLUDED.cash_system, \
           card_system = EXCLUDED.card_system, \
           upi_system = EXCLUDED.upi_system, \
           insurance_system = EXCLUDED.insurance_system, \
           credit_system = EXCLUDED.credit_system, \
           total_sales = EXCLUDED.total_sales, \
           transactions_count = EXCLUDED.transactions_count \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(target_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn close_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CloseSettlementRequest>,
) -> Result<Json<PharmacyDaySettlement>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PharmacyDaySettlement>(
        "UPDATE pharmacy_day_settlements SET \
         cash_counted = $3, \
         cash_difference = $3 - cash_system, \
         status = 'closed', \
         closed_by = $4, \
         closed_at = now(), \
         notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.cash_counted)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn verify_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyDaySettlement>, AppError> {
    require_permission(&claims, permissions::pharmacy::reconciliation::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = sqlx::query_as::<_, PharmacyDaySettlement>(
        "UPDATE pharmacy_day_settlements SET \
         status = 'verified', \
         verified_by = $3, \
         verified_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'closed' \
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

/// pharmacy_payments routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/pharmacy/payments",
            get(list_payments).post(create_payment),
        )
        .route(
            "/api/pharmacy/payments/{id}/reconcile",
            put(reconcile_payment),
        )
        .route(
            "/api/pharmacy/payments/auto-reconcile",
            post(auto_reconcile_upi),
        )
        .route(
            "/api/pharmacy/payments/day-reconciliation",
            get(day_reconciliation),
        )
        .route(
            "/api/pharmacy/settlements",
            get(get_settlement),
        )
        .route(
            "/api/pharmacy/settlements/{id}/close",
            put(close_settlement),
        )
        .route(
            "/api/pharmacy/settlements/{id}/verify",
            put(verify_settlement),
        )
}

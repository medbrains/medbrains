use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
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
    pub transaction_number: String,
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
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub settlement_date: NaiveDate,
    pub cash_system: Decimal,
    pub card_system: Decimal,
    pub upi_system: Decimal,
    pub insurance_system: Decimal,
    pub credit_system: Decimal,
    pub total_system: Decimal,
    pub cash_counted: Option<Decimal>,
    pub cash_difference: Option<Decimal>,
    pub transactions_count: i32,
    pub matched_count: i32,
    pub pending_count: i32,
    pub status: String,
    pub closed_by: Option<Uuid>,
    pub closed_at: Option<DateTime<Utc>>,
    pub verified_by: Option<Uuid>,
    pub verified_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PharmacyPaymentTransaction>(
        "SELECT * FROM pharmacy_payment_transactions \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR reconciliation_status = $2) \
         ORDER BY created_at DESC",
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let transaction_number = format!("PTXN-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, PharmacyPaymentTransaction>(
        "INSERT INTO pharmacy_payment_transactions \
         (tenant_id, transaction_number, pos_sale_id, order_id, invoice_id, \
          payment_mode, amount, reference_number, device_terminal_id, \
          upi_transaction_id, card_last_four, card_network, card_approval_code, \
          shift_id, counter_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&transaction_number)
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let target_date = params
        .date
        .as_deref()
        .and_then(|d| d.parse::<NaiveDate>().ok())
        .unwrap_or_else(|| Utc::now().date_naive());

    let row = sqlx::query_as::<_, PharmacyDaySettlement>(
        "INSERT INTO pharmacy_day_settlements \
         (tenant_id, settlement_date, \
          cash_system, card_system, upi_system, insurance_system, \
          credit_system, total_system, transactions_count, \
          matched_count, pending_count) \
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
           COUNT(*)::int, \
           COUNT(*) FILTER (WHERE reconciliation_status='matched')::int, \
           COUNT(*) FILTER (WHERE reconciliation_status='pending')::int \
         FROM pharmacy_payment_transactions \
         WHERE tenant_id = $1 AND created_at::date = $2 \
         ON CONFLICT (tenant_id, settlement_date) DO UPDATE SET \
           cash_system = EXCLUDED.cash_system, \
           card_system = EXCLUDED.card_system, \
           upi_system = EXCLUDED.upi_system, \
           insurance_system = EXCLUDED.insurance_system, \
           credit_system = EXCLUDED.credit_system, \
           total_system = EXCLUDED.total_system, \
           transactions_count = EXCLUDED.transactions_count, \
           matched_count = EXCLUDED.matched_count, \
           pending_count = EXCLUDED.pending_count, \
           updated_at = now() \
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyDaySettlement>(
        "UPDATE pharmacy_day_settlements SET \
         cash_counted = $3, \
         cash_difference = $3 - cash_system, \
         status = 'closed', \
         closed_by = $4, \
         closed_at = now(), \
         notes = COALESCE($5, notes), \
         updated_at = now() \
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PharmacyDaySettlement>(
        "UPDATE pharmacy_day_settlements SET \
         status = 'verified', \
         verified_by = $3, \
         verified_at = now(), \
         updated_at = now() \
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

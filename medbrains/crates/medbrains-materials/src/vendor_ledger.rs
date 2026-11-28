//! A supplier's ledger: posted GRNs (we owe them), payments and supplier
//! returns (paid down), in date order with a running balance.
//!
//! The balance and the totals are computed in SQL over every entry, and only
//! the latest [`MAX_ENTRIES`] are listed, with the balance brought forward
//! from the ones before as the opening balance. Summing in Rust over the
//! first 5,000 rows (the old way) made the closing balance and the totals
//! wrong, and the newest entries vanish, once a supplier had more. Entries
//! on the same instant, of the same type and reference are ordered by row id,
//! so the running balance and the listed window never depend on scan order.

use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{PgConnection, Postgres, Transaction};
use uuid::Uuid;

/// Entries listed at most; earlier ones are counted in `earlier_entries`.
pub const MAX_ENTRIES: i64 = 5000;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VendorLedgerEntry {
    pub txn_date: chrono::DateTime<chrono::Utc>,
    pub txn_type: String, // 'grn' | 'payment' | 'return'
    pub reference_number: Option<String>,
    pub debit: Decimal,           // money owed BY vendor (returns, overpayments)
    pub credit: Decimal,          // money owed TO vendor (received goods)
    pub running_balance: Decimal, // negative = vendor owes us
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VendorLedgerResponse {
    pub vendor_id: Uuid,
    /// The balance brought forward from `earlier_entries`; zero when all are listed.
    pub opening_balance: Decimal,
    pub closing_balance: Decimal,
    pub total_purchases: Decimal,
    pub total_payments: Decimal,
    pub total_returns: Decimal,
    /// Entries before the first one listed, not shown but in every number.
    pub earlier_entries: i64,
    pub entries: Vec<VendorLedgerEntry>,
}

/// One listed entry with the whole ledger's figures beside it.
#[derive(Debug, sqlx::FromRow)]
struct Row {
    #[sqlx(flatten)]
    entry: VendorLedgerEntry,
    total_count: i64,
    total_purchases: Decimal,
    total_payments: Decimal,
    total_returns: Decimal,
    closing: Decimal,
}

const LEDGER_SQL: &str = "WITH t AS ( \
       SELECT id, posted_at AS txn_date, 'grn'::text AS txn_type, grn_number AS reference_number, \
              0::numeric(14,2) AS debit, total_amount AS credit, \
              COALESCE(invoice_number, notes) AS note \
         FROM goods_receipt_notes \
        WHERE vendor_id = $1 AND tenant_id = $2 AND posted_at IS NOT NULL AND deleted_at IS NULL \
       UNION ALL \
       SELECT id, COALESCE(payment_date::timestamptz, created_at), 'payment', payment_number, \
              paid_amount, 0::numeric(14,2), notes \
         FROM supplier_payments \
        WHERE vendor_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
       UNION ALL \
       SELECT id, created_at, 'return', credit_note_number, total_amount, 0::numeric(14,2), notes \
         FROM pharmacy_credit_notes \
        WHERE vendor_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          AND note_type = 'supplier_return' AND status <> 'cancelled'), \
     w AS ( \
       SELECT t.*, \
              SUM(credit - debit) OVER (ORDER BY txn_date, txn_type, reference_number, id \
                                        ROWS UNBOUNDED PRECEDING) AS running_balance, \
              ROW_NUMBER() OVER (ORDER BY txn_date DESC, txn_type DESC, \
                                          reference_number DESC, id DESC) AS from_end, \
              COUNT(*) OVER () AS total_count, \
              SUM(CASE WHEN txn_type = 'grn' THEN credit ELSE 0 END) OVER () AS total_purchases, \
              SUM(CASE WHEN txn_type = 'payment' THEN debit ELSE 0 END) OVER () AS total_payments, \
              SUM(CASE WHEN txn_type = 'return' THEN debit ELSE 0 END) OVER () AS total_returns, \
              SUM(credit - debit) OVER () AS closing \
         FROM t) \
     SELECT txn_date, txn_type, reference_number, debit, credit, running_balance, note, \
            total_count, total_purchases, total_payments, total_returns, closing \
       FROM w WHERE from_end <= $3 \
      ORDER BY txn_date, txn_type, reference_number, id";

/// The ledger of `vendor_id`, its latest `MAX_ENTRIES` entries listed.
///
/// # Errors
/// A database error.
pub async fn ledger(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    vendor_id: Uuid,
) -> Result<VendorLedgerResponse, AppError> {
    ledger_listing(tx, tenant_id, vendor_id, MAX_ENTRIES).await
}

/// [`ledger`], listing at most `limit` entries (a parameter for the tests),
/// on the caller's connection (inside its transaction, when it has one).
///
/// # Errors
/// A database error.
pub async fn ledger_listing(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    vendor_id: Uuid,
    limit: i64,
) -> Result<VendorLedgerResponse, AppError> {
    let rows: Vec<Row> = sqlx::query_as(LEDGER_SQL)
        .bind(vendor_id)
        .bind(tenant_id)
        .bind(limit)
        .fetch_all(&mut *conn)
        .await?;
    let Some(first) = rows.first() else {
        return Ok(empty(vendor_id));
    };
    let shown = i64::try_from(rows.len()).unwrap_or(i64::MAX);
    Ok(VendorLedgerResponse {
        vendor_id,
        opening_balance: first.entry.running_balance - (first.entry.credit - first.entry.debit),
        closing_balance: first.closing,
        total_purchases: first.total_purchases,
        total_payments: first.total_payments,
        total_returns: first.total_returns,
        earlier_entries: first.total_count - shown,
        entries: rows.into_iter().map(|r| r.entry).collect(),
    })
}

/// A ledger with nothing in it.
const fn empty(vendor_id: Uuid) -> VendorLedgerResponse {
    VendorLedgerResponse {
        vendor_id,
        opening_balance: Decimal::ZERO,
        closing_balance: Decimal::ZERO,
        total_purchases: Decimal::ZERO,
        total_payments: Decimal::ZERO,
        total_returns: Decimal::ZERO,
        earlier_entries: 0,
        entries: Vec::new(),
    }
}

#[cfg(test)]
#[path = "vendor_ledger_tests.rs"]
mod tests;

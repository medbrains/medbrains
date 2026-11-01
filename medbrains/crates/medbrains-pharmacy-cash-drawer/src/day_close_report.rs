//! The Z-report: what one counter took on one business day, read from the
//! drawers that day's sales and returns were rung on.

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_kernel::AppError;
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

/// A counter seldom runs more than a few shifts a day; this bounds the list.
const MAX_DRAWERS: i64 = 200;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DrawerLine {
    pub id: Uuid,
    pub cashier_name: Option<String>,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub status: String,
    pub opening_float: Decimal,
    pub expected_cash: Decimal,
    pub actual_close_amount: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TenderTotal {
    pub mode: String,
    pub collected: Decimal,
    pub refunded: Decimal,
    pub net: Decimal,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DaySummary {
    pub sales_count: i64,
    pub sales_total: Decimal,
    pub discount_total: Decimal,
    pub gst_total: Decimal,
    pub returns_count: i64,
    pub returns_total: Decimal,
    pub petty_cash_total: Decimal,
    pub expected_cash: Decimal,
    /// Card/UPI sales rung with no drawer open: no counter can claim them.
    pub sales_without_drawer: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZReport {
    pub pharmacy_location_id: Uuid,
    pub business_date: NaiveDate,
    pub drawers: Vec<DrawerLine>,
    pub open_drawers: usize,
    pub tenders: Vec<TenderTotal>,
    pub summary: DaySummary,
}

const DRAWERS_SQL: &str = "\
    SELECT d.id, u.full_name AS cashier_name, d.opened_at, d.closed_at, d.status, \
           d.opening_float, pharmacy_drawer_expected_cash(d.id) AS expected_cash, \
           d.actual_close_amount \
      FROM pharmacy_cash_drawers d \
      LEFT JOIN users u ON u.id = d.cashier_user_id AND u.tenant_id = d.tenant_id \
     WHERE d.tenant_id = $1 AND d.pharmacy_location_id = $2 AND d.business_date = $3 \
       AND d.deleted_at IS NULL \
     ORDER BY d.opened_at LIMIT $4";

const TENDERS_SQL: &str = "\
    SELECT t.payment_mode AS mode, \
           COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) AS collected, \
           COALESCE(-SUM(t.amount) FILTER (WHERE t.amount < 0), 0) AS refunded, \
           COALESCE(SUM(t.amount), 0) AS net \
      FROM pharmacy_payment_transactions t \
      JOIN pharmacy_cash_drawers d ON d.id::text = t.shift_id AND d.tenant_id = t.tenant_id \
     WHERE d.tenant_id = $1 AND d.pharmacy_location_id = $2 AND d.business_date = $3 \
       AND d.deleted_at IS NULL AND t.deleted_at IS NULL \
     GROUP BY t.payment_mode ORDER BY t.payment_mode";

const SUMMARY_SQL: &str = "\
    WITH dr AS (SELECT id FROM pharmacy_cash_drawers \
                 WHERE tenant_id = $1 AND pharmacy_location_id = $2 AND business_date = $3 \
                   AND deleted_at IS NULL) \
    SELECT (SELECT COUNT(*) FROM pharmacy_pos_sales s \
             WHERE s.tenant_id = $1 AND s.cash_drawer_id IN (SELECT id FROM dr) \
               AND s.deleted_at IS NULL) AS sales_count, \
           (SELECT COALESCE(SUM(s.total_amount), 0) FROM pharmacy_pos_sales s \
             WHERE s.tenant_id = $1 AND s.cash_drawer_id IN (SELECT id FROM dr) \
               AND s.deleted_at IS NULL) AS sales_total, \
           (SELECT COALESCE(SUM(s.discount_amount), 0) FROM pharmacy_pos_sales s \
             WHERE s.tenant_id = $1 AND s.cash_drawer_id IN (SELECT id FROM dr) \
               AND s.deleted_at IS NULL) AS discount_total, \
           (SELECT COALESCE(SUM(s.gst_amount), 0) FROM pharmacy_pos_sales s \
             WHERE s.tenant_id = $1 AND s.cash_drawer_id IN (SELECT id FROM dr) \
               AND s.deleted_at IS NULL) AS gst_total, \
           (SELECT COUNT(*) FROM pharmacy_credit_notes cn \
             WHERE cn.tenant_id = $1 AND cn.cash_drawer_id IN (SELECT id FROM dr) \
               AND cn.deleted_at IS NULL) AS returns_count, \
           (SELECT COALESCE(SUM(cn.net_amount), 0) FROM pharmacy_credit_notes cn \
             WHERE cn.tenant_id = $1 AND cn.cash_drawer_id IN (SELECT id FROM dr) \
               AND cn.deleted_at IS NULL) AS returns_total, \
           (SELECT COALESCE(SUM(v.amount), 0) FROM pharmacy_petty_cash_vouchers v \
             WHERE v.tenant_id = $1 AND v.cash_drawer_id IN (SELECT id FROM dr) \
               AND v.status IN ('approved', 'reimbursed') AND v.deleted_at IS NULL) \
             AS petty_cash_total, \
           (SELECT COALESCE(SUM(pharmacy_drawer_expected_cash(id)), 0) FROM dr) \
             AS expected_cash, \
           (SELECT COUNT(*) FROM pharmacy_pos_sales s \
             WHERE s.tenant_id = $1 AND s.business_date = $3 AND s.cash_drawer_id IS NULL \
               AND (s.store_location_id = $2 OR s.store_location_id IS NULL) \
               AND s.deleted_at IS NULL) AS sales_without_drawer";

pub async fn z_report_in_tx(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    location: Uuid,
    date: NaiveDate,
) -> Result<ZReport, AppError> {
    let drawers = sqlx::query_as::<_, DrawerLine>(DRAWERS_SQL)
        .bind(tenant_id)
        .bind(location)
        .bind(date)
        .bind(MAX_DRAWERS)
        .fetch_all(&mut **tx)
        .await?;
    let tenders = sqlx::query_as::<_, TenderTotal>(TENDERS_SQL)
        .bind(tenant_id)
        .bind(location)
        .bind(date)
        .fetch_all(&mut **tx)
        .await?;
    let summary = sqlx::query_as::<_, DaySummary>(SUMMARY_SQL)
        .bind(tenant_id)
        .bind(location)
        .bind(date)
        .fetch_one(&mut **tx)
        .await?;
    let open_drawers = drawers.iter().filter(|d| d.status == "open").count();
    Ok(ZReport {
        pharmacy_location_id: location,
        business_date: date,
        drawers,
        open_drawers,
        tenders,
        summary,
    })
}

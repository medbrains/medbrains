//! The pharmacy counter: what a line costs, how a bill is paid, when a
//! discount needs a second pair of eyes, and who the customer is.
//!
//! Prices and GST come from the server, never the browser. The counter used to
//! charge the catalogue base price at a flat 5% GST, whatever stock intake had
//! recorded as the strip's MRP and whatever the drug's own GST rate was.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_core::pharmacy_phase3::{PharmacyPaymentMode, PharmacyPosSale};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;
use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{filter_pharmacy_pos_sale_response, resolve_pharmacy_restricted_fields};

/// The most patients one counter search returns.
const PATIENT_SEARCH_LIMIT: i64 = 10;
/// Shortest query that searches; two letters match half the register.
const PATIENT_SEARCH_MIN_CHARS: usize = 3;
/// The most lines priced in one call; a counter basket is a handful.
const PRICE_LOOKUP_LIMIT: usize = 100;
/// A discount reason short enough to be meaningless is refused.
const DISCOUNT_REASON_MIN_CHARS: usize = 5;

/// What one catalogue line sells for at the counter right now.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PosLinePrice {
    pub catalog_item_id: Uuid,
    /// MRP of the batch FEFO will issue; the catalogue base price when no
    /// batch carries one. `None` when neither is known.
    pub mrp: Option<Decimal>,
    pub gst_rate: Decimal,
    pub hsn_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PosPricesResponse {
    pub lines: Vec<PosLinePrice>,
    /// Discount off MRP the counter may give without an approver.
    pub discount_limit_percent: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct PosPricesQuery {
    /// Comma-separated catalogue ids.
    pub ids: String,
}

/// One query for the whole basket: catalogue joined to the batch FEFO issues.
pub(crate) async fn line_prices_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    catalog_ids: &[Uuid],
) -> Result<HashMap<Uuid, PosLinePrice>, AppError> {
    if catalog_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, PosLinePrice>(
        "SELECT c.id AS catalog_item_id, COALESCE(b.selling_rate, NULLIF(c.base_price, 0)) AS mrp, \
                c.tax_percent AS gst_rate, c.hsn_code \
           FROM pharmacy_catalog c \
           LEFT JOIN LATERAL ( \
                SELECT pb.selling_rate FROM pharmacy_batches pb \
                 WHERE pb.tenant_id = c.tenant_id AND pb.catalog_item_id = c.id \
                   AND pb.deleted_at IS NULL AND pb.quantity_on_hand > 0 \
                   AND pb.expiry_date > CURRENT_DATE AND pb.quarantine_status = 'cleared' \
                 ORDER BY pb.expiry_date, pb.created_at, pb.id LIMIT 1) b ON true \
          WHERE c.tenant_id = $1 AND c.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(catalog_ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(|r| (r.catalog_item_id, r)).collect())
}

/// `pharmacy.pos_discount_limit_percent`; 0 when unset, so every discount is
/// approved until the hospital says otherwise.
pub(crate) async fn discount_limit_percent_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Decimal, AppError> {
    let limit: Option<Decimal> = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT (value #>> '{}')::numeric FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'pharmacy' \
            AND key = 'pos_discount_limit_percent' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    Ok(limit.unwrap_or(Decimal::ZERO))
}

/// `GET /api/pharmacy/pos/prices?ids=` — MRP, GST and HSN for a basket.
pub async fn pos_prices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PosPricesQuery>,
) -> Result<Json<PosPricesResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::pos::CREATE)?;
    let ids = q
        .ids
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| Uuid::parse_str(s.trim()))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::BadRequest("ids must be catalogue ids".to_owned()))?;
    if ids.len() > PRICE_LOOKUP_LIMIT {
        return Err(AppError::BadRequest(format!(
            "Price at most {PRICE_LOOKUP_LIMIT} lines at a time"
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let prices = line_prices_in_tx(&mut tx, claims.tenant_id, &ids).await?;
    let discount_limit_percent = discount_limit_percent_in_tx(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(PosPricesResponse {
        lines: prices.into_values().collect(),
        discount_limit_percent,
    }))
}

// ── tenders ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct PosTenderInput {
    /// cash | card | upi | credit
    pub mode: String,
    pub amount: Decimal,
    /// UTR for UPI, approval code for card.
    pub reference: Option<String>,
    /// The approved card-machine (or gateway) payment this tender is, so
    /// one approval pays for one sale only.
    #[serde(default)]
    pub gateway_transaction_id: Option<Uuid>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TenderMode {
    Cash,
    Card,
    Upi,
    Credit,
}

impl TenderMode {
    pub(crate) fn parse(mode: &str) -> Result<Self, AppError> {
        match mode {
            "cash" => Ok(Self::Cash),
            "card" => Ok(Self::Card),
            "upi" => Ok(Self::Upi),
            "credit" => Ok(Self::Credit),
            other => Err(AppError::BadRequest(format!(
                "'{other}' is not a counter tender; use cash, card, UPI or credit"
            ))),
        }
    }

    /// The value in `pharmacy_payment_transactions.payment_mode` and `payments.mode`.
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Cash => "cash",
            Self::Card => "card",
            Self::Upi => "upi",
            Self::Credit => "credit",
        }
    }

    const fn sale_mode(self) -> PharmacyPaymentMode {
        match self {
            Self::Cash => PharmacyPaymentMode::Cash,
            Self::Card => PharmacyPaymentMode::Card,
            Self::Upi => PharmacyPaymentMode::Upi,
            Self::Credit => PharmacyPaymentMode::Credit,
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Tender {
    pub mode: TenderMode,
    /// For cash, what the drawer keeps — the change has already gone back.
    pub amount: Decimal,
    pub reference: Option<String>,
    pub gateway_transaction_id: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub(crate) struct Settlement {
    pub tenders: Vec<Tender>,
    /// Everything handed over, cash before change.
    pub amount_received: Decimal,
    pub change_due: Decimal,
    pub mode: PharmacyPaymentMode,
    /// Left on the patient's account.
    pub credit: Decimal,
    /// Settled at the counter: total less credit.
    pub paid: Decimal,
}

/// How a bill of `total` is settled by `inputs`, or why it is not.
///
/// Card, UPI and credit are exact and may not exceed what is owed; cash pays
/// what is left and may be more, the difference going back as change.
pub(crate) fn settle(total: Decimal, inputs: &[PosTenderInput]) -> Result<Settlement, AppError> {
    if inputs.is_empty() {
        return Err(AppError::BadRequest("Add how the bill was paid".to_owned()));
    }
    let mut cash_given = Decimal::ZERO;
    let mut exact = Decimal::ZERO;
    let mut credit = Decimal::ZERO;
    let mut tenders = Vec::with_capacity(inputs.len());
    for input in inputs {
        let mode = TenderMode::parse(input.mode.trim())?;
        if input.amount <= Decimal::ZERO {
            return Err(AppError::BadRequest(
                "Each payment must be more than zero".to_owned(),
            ));
        }
        let reference = input
            .reference
            .as_deref()
            .map(str::trim)
            .filter(|r| !r.is_empty())
            .map(str::to_owned);
        match mode {
            TenderMode::Cash => cash_given += input.amount,
            TenderMode::Card | TenderMode::Upi => {
                if reference.is_none() {
                    return Err(AppError::BadRequest(format!(
                        "A {} payment needs its reference",
                        mode.as_str()
                    )));
                }
                exact += input.amount;
                tenders.push(Tender {
                    mode,
                    amount: input.amount,
                    reference,
                    gateway_transaction_id: input.gateway_transaction_id,
                });
            }
            TenderMode::Credit => {
                credit += input.amount;
                exact += input.amount;
                tenders.push(Tender {
                    mode,
                    amount: input.amount,
                    reference,
                    gateway_transaction_id: None,
                });
            }
        }
    }
    if exact > total {
        return Err(AppError::BadRequest(
            "Card, UPI and credit together cannot exceed the bill".to_owned(),
        ));
    }
    let cash_due = total - exact;
    if cash_given < cash_due {
        return Err(AppError::BadRequest(format!(
            "The bill is short by {}",
            cash_due - cash_given
        )));
    }
    if cash_given > Decimal::ZERO && cash_due == Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Nothing is left to pay in cash".to_owned(),
        ));
    }
    if cash_given > Decimal::ZERO {
        tenders.insert(
            0,
            Tender {
                mode: TenderMode::Cash,
                amount: cash_due,
                reference: None,
                gateway_transaction_id: None,
            },
        );
    }
    let mode = match tenders.first() {
        Some(first) if tenders.iter().all(|t| t.mode == first.mode) => first.mode.sale_mode(),
        _ => PharmacyPaymentMode::Mixed,
    };
    Ok(Settlement {
        amount_received: cash_given + exact - credit,
        change_due: cash_given - cash_due,
        mode,
        credit,
        paid: total - credit,
        tenders,
    })
}

/// A counter total, rounded up to the paisa: the counter never collects a
/// fraction of a paisa less than the bill.
pub(crate) fn round_up_to_paisa(value: Decimal) -> Decimal {
    value.round_dp_with_strategy(2, RoundingStrategy::AwayFromZero)
}

/// The cashier's open drawer: which counter they are at, and which business
/// day their sales and returns count to.
#[derive(Debug, Clone, sqlx::FromRow)]
pub(crate) struct CounterShift {
    pub id: Uuid,
    pub pharmacy_location_id: Uuid,
    pub business_date: NaiveDate,
}

/// Default hours past midnight a counter may keep selling before the previous
/// day must be closed (`pharmacy.day_close_grace_hours`).
const DEFAULT_DAY_CLOSE_GRACE_HOURS: i32 = 12;

pub(crate) async fn open_shift_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    cashier: Uuid,
) -> Result<Option<CounterShift>, AppError> {
    Ok(sqlx::query_as::<_, CounterShift>(
        "SELECT id, pharmacy_location_id, business_date FROM pharmacy_cash_drawers \
          WHERE tenant_id = $1 AND cashier_user_id = $2 AND status = 'open' \
            AND deleted_at IS NULL \
          ORDER BY opened_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(cashier)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Whether a counter's business day has been closed.
pub(crate) async fn is_day_closed_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    pharmacy_location_id: Uuid,
    business_date: NaiveDate,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pharmacy_day_closes \
                         WHERE tenant_id = $1 AND pharmacy_location_id = $2 \
                           AND business_date = $3 AND status = 'closed' \
                           AND deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .bind(pharmacy_location_id)
    .bind(business_date)
    .fetch_one(&mut **tx)
    .await?)
}

/// The earliest earlier day this counter worked and never closed, and whether
/// its grace has run out.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct UnclosedDay {
    pub business_date: NaiveDate,
    pub sales_refused_after: DateTime<Utc>,
    pub overdue: bool,
}

pub(crate) async fn earliest_unclosed_day_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    pharmacy_location_id: Uuid,
    before: NaiveDate,
) -> Result<Option<UnclosedDay>, AppError> {
    Ok(sqlx::query_as::<_, UnclosedDay>(
        "WITH g AS ( \
           SELECT COALESCE((SELECT (value #>> '{}')::int FROM tenant_settings \
                             WHERE tenant_id = $1 AND category = 'pharmacy' \
                               AND key = 'day_close_grace_hours' AND deleted_at IS NULL), $4) \
                    AS hours, \
                  COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC') AS tz), \
         d AS ( \
           SELECT DISTINCT dr.business_date FROM pharmacy_cash_drawers dr \
            WHERE dr.tenant_id = $1 AND dr.pharmacy_location_id = $2 \
              AND dr.business_date < $3 AND dr.deleted_at IS NULL \
              AND NOT EXISTS (SELECT 1 FROM pharmacy_day_closes c \
                               WHERE c.tenant_id = $1 AND c.pharmacy_location_id = $2 \
                                 AND c.business_date = dr.business_date \
                                 AND c.status = 'closed' AND c.deleted_at IS NULL) \
            ORDER BY dr.business_date LIMIT 1) \
         SELECT d.business_date, \
                (((d.business_date + 1)::timestamp + make_interval(hours => g.hours)) \
                   AT TIME ZONE g.tz) AS sales_refused_after, \
                now() > (((d.business_date + 1)::timestamp + make_interval(hours => g.hours)) \
                   AT TIME ZONE g.tz) AS overdue \
           FROM d, g",
    )
    .bind(tenant_id)
    .bind(pharmacy_location_id)
    .bind(before)
    .bind(DEFAULT_DAY_CLOSE_GRACE_HOURS)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Nothing is dated to a closed day. A counter whose previous day is still
/// open past its grace gets a warning to show the cashier.
pub(crate) async fn require_counter_day_open_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    shift: &CounterShift,
    for_sale: bool,
) -> Result<Option<String>, AppError> {
    if is_day_closed_in_tx(
        tx,
        tenant_id,
        shift.pharmacy_location_id,
        shift.business_date,
    )
    .await?
    {
        return Err(AppError::Conflict(format!(
            "The {} day at this counter is closed; a supervisor must reopen it",
            shift.business_date
        )));
    }
    if !for_sale {
        return Ok(None);
    }
    let unclosed = earliest_unclosed_day_in_tx(
        tx,
        tenant_id,
        shift.pharmacy_location_id,
        shift.business_date,
    )
    .await?;
    // A warning, not a refusal: an uncounted yesterday must never stop a
    // counter dispensing medicine today. The cashier sees it on every sale
    // and the Day close screen lists the day until someone closes it.
    Ok(unclosed.filter(|d| d.overdue).map(|day| {
        format!(
            "The {} day at this counter has not been closed",
            day.business_date
        )
    }))
}

/// Credit at the counter is for a registered patient the hospital has set up
/// for credit, within their limit counting what they already owe.
pub(crate) async fn require_credit_room_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Option<Uuid>,
    credit: Decimal,
) -> Result<(), AppError> {
    let Some(patient_id) = patient_id else {
        return Err(AppError::BadRequest(
            "Credit needs a registered patient on the sale".to_owned(),
        ));
    };
    let room: Option<(Decimal, Decimal)> = sqlx::query_as(
        "SELECT cp.credit_limit, \
                COALESCE((SELECT SUM(i.total_amount - i.paid_amount) FROM invoices i \
                           WHERE i.tenant_id = cp.tenant_id AND i.patient_id = cp.patient_id \
                             AND i.status IN ('issued', 'partially_paid') \
                             AND i.deleted_at IS NULL), 0) \
           FROM credit_patients cp \
          WHERE cp.tenant_id = $1 AND cp.patient_id = $2 AND cp.status = 'active' \
            AND cp.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((limit, outstanding)) = room else {
        return Err(AppError::BadRequest(
            "This patient is not set up for credit; ask billing".to_owned(),
        ));
    };
    if outstanding + credit > limit {
        return Err(AppError::BadRequest(format!(
            "Credit limit {limit} would be exceeded: {outstanding} is already owed"
        )));
    }
    Ok(())
}

/// Discount above the limit: a reason, and an approver holding the right.
/// Returns the reason to record, or `None` when no approval was needed.
pub(crate) fn require_discount_approval<'a>(
    claims: &Claims,
    off_mrp_percent: Decimal,
    limit_percent: Decimal,
    reason: Option<&'a str>,
) -> Result<Option<&'a str>, AppError> {
    if off_mrp_percent <= limit_percent {
        return Ok(None);
    }
    let reason = reason
        .map(str::trim)
        .filter(|r| r.chars().count() >= DISCOUNT_REASON_MIN_CHARS);
    let Some(reason) = reason else {
        return Err(AppError::BadRequest(format!(
            "A discount of {off_mrp_percent}% is over the {limit_percent}% limit; give a reason"
        )));
    };
    require_permission(claims, permissions::pharmacy::pos::DISCOUNT_APPROVE)?;
    Ok(Some(reason))
}

// ── the customer ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CounterPatientQuery {
    pub q: String,
}

/// A patient as the counter sees them: enough to pick the right person.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CounterPatient {
    pub id: Uuid,
    pub uhid: String,
    pub full_name: String,
    pub age_years: Option<i32>,
    pub gender: Option<String>,
}

/// `GET /api/pharmacy/patients/search?q=` — name, UHID or phone to a patient.
pub async fn search_counter_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<CounterPatientQuery>,
) -> Result<Json<Vec<CounterPatient>>, AppError> {
    require_permission(&claims, permissions::pharmacy::patients::SEARCH)?;
    let q = query.q.trim();
    if q.chars().count() < PATIENT_SEARCH_MIN_CHARS {
        return Ok(Json(Vec::new()));
    }
    let pattern = format!(
        "%{}%",
        q.replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    );
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, CounterPatient>(
        "SELECT p.id, p.uhid, btrim(concat_ws(' ', p.first_name, p.last_name)) AS full_name, \
                CASE WHEN p.date_of_birth IS NULL THEN NULL \
                     ELSE date_part('year', age(p.date_of_birth))::int END AS age_years, \
                p.gender::text AS gender \
           FROM patients p \
          WHERE p.tenant_id = $1 AND p.deleted_at IS NULL \
            AND (p.uhid ILIKE $2 OR p.phone LIKE $2 \
                 OR concat_ws(' ', p.first_name, p.last_name) ILIKE $2) \
          ORDER BY p.created_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(&pattern)
    .bind(PATIENT_SEARCH_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/pharmacy/pos/sales/{id}` — one counter sale, for its receipt.
pub async fn get_pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PharmacyPosSale>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::VIEW,
            permissions::pharmacy::pos::CREATE,
            permissions::pharmacy::pos::RETURN,
        ],
    )?;
    let restricted_fields = resolve_pharmacy_restricted_fields(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sale = sqlx::query_as::<_, PharmacyPosSale>(
        "SELECT * FROM pharmacy_pos_sales \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(filter_pharmacy_pos_sale_response(
        sale,
        &restricted_fields,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tender(mode: &str, amount: i64, reference: Option<&str>) -> PosTenderInput {
        PosTenderInput {
            mode: mode.to_owned(),
            amount: Decimal::from(amount),
            reference: reference.map(str::to_owned),
            gateway_transaction_id: None,
        }
    }

    #[test]
    fn cash_over_the_bill_gives_change_and_keeps_only_the_bill() -> Result<(), AppError> {
        let s = settle(Decimal::from(38), &[tender("cash", 50, None)])?;
        assert_eq!(s.change_due, Decimal::from(12));
        assert_eq!(s.tenders.len(), 1);
        assert_eq!(s.tenders[0].amount, Decimal::from(38));
        assert_eq!(s.mode, PharmacyPaymentMode::Cash);
        Ok(())
    }

    #[test]
    fn split_card_and_cash_is_mixed() -> Result<(), AppError> {
        let s = settle(
            Decimal::from(100),
            &[tender("card", 60, Some("AP123")), tender("cash", 50, None)],
        )?;
        assert_eq!(s.mode, PharmacyPaymentMode::Mixed);
        assert_eq!(s.change_due, Decimal::from(10));
        assert_eq!(s.paid, Decimal::from(100));
        Ok(())
    }

    #[test]
    fn short_bills_and_overpaid_cards_are_refused() {
        assert!(settle(Decimal::from(100), &[tender("cash", 90, None)]).is_err());
        assert!(settle(Decimal::from(100), &[tender("upi", 120, Some("UTR1"))]).is_err());
        assert!(settle(Decimal::from(100), &[tender("card", 100, None)]).is_err());
        assert!(settle(Decimal::from(100), &[tender("insurance", 100, None)]).is_err());
    }

    #[test]
    fn credit_leaves_a_balance_not_a_payment() -> Result<(), AppError> {
        let s = settle(
            Decimal::from(100),
            &[tender("credit", 70, None), tender("upi", 30, Some("UTR9"))],
        )?;
        assert_eq!(s.credit, Decimal::from(70));
        assert_eq!(s.paid, Decimal::from(30));
        assert_eq!(s.amount_received, Decimal::from(30));
        Ok(())
    }

    #[test]
    fn totals_round_up_to_the_paisa() {
        assert_eq!(
            round_up_to_paisa(Decimal::new(34965, 4)),
            Decimal::new(350, 2)
        );
        assert_eq!(
            round_up_to_paisa(Decimal::new(1050, 2)),
            Decimal::new(1050, 2)
        );
    }
}

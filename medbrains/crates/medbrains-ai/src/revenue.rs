//! Revenue over any range up to [`MAX_DAYS`], grouped by day, week or month
//! from the range's length, with exact totals — "what did we bill in the last
//! 12 months?" answered from the invoices, never estimated.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use chrono::NaiveDate;
use medbrains_authz_gate::visible_patient_ids;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::{error::AppError, state::AppState};
use rust_decimal::Decimal;
use serde_json::{Value, json};

/// The metric's name in the aggregate catalogue.
pub(super) const METRIC: &str = "revenue_by_period";
/// Longest range one request covers (two years and a day).
const MAX_DAYS: i64 = 732;
/// Ranges up to this many days are grouped by day.
const DAILY_UP_TO: i64 = 31;
/// Ranges up to this many days are grouped by week (about six months).
const WEEKLY_UP_TO: i64 = 186;

/// `day`, `week` or `month`, from how long the range is.
pub(super) const fn grain(days: i64) -> &'static str {
    if days <= DAILY_UP_TO {
        "day"
    } else if days <= WEEKLY_UP_TO {
        "week"
    } else {
        "month"
    }
}

/// Billed, collected and invoices per period over `[from, to]`, counted over
/// the invoices of the patients the user may see, with every period present
/// (zero when empty) and exact totals.
///
/// # Errors
/// `BadRequest` for a reversed or over-long range; `ServiceUnavailable` when
/// the access set cannot be read; a database error.
pub(super) async fn by_period(
    state: &AppState,
    claims: &Claims,
    (from, to): (NaiveDate, NaiveDate),
) -> Result<Value, AppError> {
    let days = (to - from).num_days() + 1;
    if !(1..=MAX_DAYS).contains(&days) {
        return Err(AppError::BadRequest(format!(
            "the range must run forwards and cover at most {MAX_DAYS} days"
        )));
    }
    let grain = grain(days);
    let visible = visible_patient_ids(state, claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, (String, Decimal, Decimal, i64)>(
        "WITH periods AS ( \
           SELECT generate_series(date_trunc($5, $2::date::timestamp), $3::date::timestamp, \
             ('1 ' || $5)::interval)::date AS p \
         ), inv AS ( \
           SELECT id, created_at, total_amount FROM invoices \
           WHERE tenant_id = $1 AND status != 'cancelled'::invoice_status AND deleted_at IS NULL \
             AND ($4::uuid[] IS NULL OR patient_id = ANY($4)) \
         ), billed AS ( \
           SELECT date_trunc($5, created_at)::date AS p, SUM(total_amount) AS billed, COUNT(*) AS n \
           FROM inv WHERE created_at >= $2::date AND created_at < ($3::date + 1) GROUP BY 1 \
         ), paid AS ( \
           SELECT date_trunc($5, pay.paid_at)::date AS p, SUM(pay.amount) AS collected \
           FROM payments pay JOIN inv ON inv.id = pay.invoice_id \
           WHERE pay.tenant_id = $1 AND pay.deleted_at IS NULL \
             AND pay.paid_at >= $2::date AND pay.paid_at < ($3::date + 1) GROUP BY 1 \
         ) \
         SELECT periods.p::text, COALESCE(b.billed, 0), COALESCE(c.collected, 0), \
                COALESCE(b.n, 0)::bigint \
         FROM periods LEFT JOIN billed b ON b.p = periods.p LEFT JOIN paid c ON c.p = periods.p \
         ORDER BY periods.p",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .bind(visible.as_deref())
    .bind(grain)
    .fetch_all(&mut *tx)
    .await?;
    drop(tx);
    Ok(shape(grain, (from, to), &rows))
}

/// The result as the model and the widget see it; months are `YYYY-MM`.
fn shape(
    grain: &str,
    (from, to): (NaiveDate, NaiveDate),
    rows: &[(String, Decimal, Decimal, i64)],
) -> Value {
    let label = |p: &str| {
        if grain == "month" {
            p.get(..7).unwrap_or(p).to_owned()
        } else {
            p.to_owned()
        }
    };
    let (mut billed, mut collected, mut invoices) = (Decimal::ZERO, Decimal::ZERO, 0_i64);
    let with_data: Vec<String> = rows
        .iter()
        .filter(|r| r.3 > 0)
        .map(|r| label(&r.0))
        .collect();
    let periods: Vec<Value> = rows
        .iter()
        .map(|(p, b, c, n)| {
            billed += *b;
            collected += *c;
            invoices += *n;
            let mut row = serde_json::Map::new();
            row.insert(grain.to_owned(), json!(label(p)));
            row.insert("billed".to_owned(), json!(b.round_dp(2).to_string()));
            row.insert("collected".to_owned(), json!(c.round_dp(2).to_string()));
            row.insert("invoices".to_owned(), json!(n));
            Value::Object(row)
        })
        .collect();
    json!({
        "metric": METRIC,
        "from": from.to_string(),
        "to": to.to_string(),
        "grouped_by": grain,
        "rows": periods,
        "periods_with_invoices": with_data,
        "total": {
            "billed": billed.round_dp(2).to_string(),
            "collected": collected.round_dp(2).to_string(),
            "invoices": invoices,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::{grain, shape};
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use serde_json::json;

    #[test]
    fn the_grouping_follows_the_range() {
        assert_eq!(grain(7), "day");
        assert_eq!(grain(31), "day");
        assert_eq!(grain(90), "week");
        assert_eq!(grain(365), "month");
    }

    #[test]
    fn totals_are_exact_and_months_without_invoices_are_named() {
        let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default();
        let rows = vec![
            (
                "2026-09-01".to_owned(),
                Decimal::new(123_920_592, 2),
                Decimal::new(1_000, 2),
                543,
            ),
            (
                "2026-10-01".to_owned(),
                Decimal::new(99_871_820, 2),
                Decimal::new(44_995_484, 2),
                233,
            ),
            ("2026-11-01".to_owned(), Decimal::ZERO, Decimal::ZERO, 0),
        ];
        let v = shape("month", (d("2026-09-01"), d("2026-11-30")), &rows);
        assert_eq!(
            v["total"],
            json!({"billed": "2237924.12", "collected": "449964.84", "invoices": 776})
        );
        assert_eq!(v["rows"][1]["month"], "2026-10");
        assert_eq!(v["periods_with_invoices"], json!(["2026-09", "2026-10"]));
    }
}

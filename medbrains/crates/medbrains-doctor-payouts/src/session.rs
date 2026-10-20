//! The per-session minimum guarantee for sessional (day / visiting) doctors.

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::{Tx, agreements, engine};

/// Top a sessional doctor's day up to the agreed minimum — idempotent: it
/// appends only the difference from any top-up already in the ledger.
pub async fn apply_session_minimum(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    doctor: Uuid,
    day: NaiveDate,
) -> Result<Decimal, AppError> {
    let Some(agreement) = agreements::covering(tx, doctor, day).await? else {
        return Ok(Decimal::ZERO);
    };
    let Some(minimum) = agreement.session_minimum.filter(|m| *m > Decimal::ZERO) else {
        return Ok(Decimal::ZERO);
    };
    let (earned, topped) = sqlx::query_as::<_, (Decimal, Decimal)>(
        "SELECT COALESCE(SUM(amount) FILTER (WHERE event <> 'session_minimum'), 0), \
                COALESCE(SUM(amount) FILTER (WHERE event = 'session_minimum'), 0) \
           FROM doctor_payout_accruals \
          WHERE tenant_id = $1 AND doctor_id = $2 AND service_date = $3 AND deleted_at IS NULL \
            AND event <> 'adjustment'",
    )
    .bind(tenant_id)
    .bind(doctor)
    .bind(day)
    .fetch_one(&mut **tx)
    .await?;
    let delta = engine::money(engine::session_topup(minimum, earned) - topped);
    if delta != Decimal::ZERO {
        sqlx::query(
            "INSERT INTO doctor_payout_accruals (tenant_id, doctor_id, agreement_id, event, service_date, \
             share_amount, amount, reason) VALUES ($1, $2, $3, 'session_minimum', $4, $5, $6, $7)",
        )
        .bind(tenant_id)
        .bind(doctor)
        .bind(agreement.id)
        .bind(day)
        .bind(minimum)
        .bind(delta)
        .bind(format!("Session minimum guarantee of Rs {minimum}"))
        .execute(&mut **tx)
        .await?;
    }
    Ok(engine::session_topup(minimum, earned))
}

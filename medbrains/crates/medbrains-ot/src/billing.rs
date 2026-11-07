//! What an OT completion bills: the surgery, the anaesthetist when one was
//! assigned, theatre time by the hour, and every consumable used. Each line
//! goes through `charge_or_queue`, so a line that cannot be posted waits on
//! the billing desk's attention queue instead of vanishing.

use medbrains_core::ot::OtBooking;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_services::billing::{
    AutoChargeInput, ChargeRequest, charge_or_queue_all, encounter_id_for_admission_in_tx,
};
use rust_decimal::Decimal;
use uuid::Uuid;

/// Charge (or queue) every line of a completed booking under one read of
/// the `auto_charge_ot` setting.
pub(crate) async fn charge_completion(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    row: &OtBooking,
) -> Result<(), AppError> {
    let encounter_id =
        encounter_id_for_admission_in_tx(tx, &claims.tenant_id, row.admission_id).await?;
    let base = AutoChargeInput {
        patient_id: row.patient_id,
        encounter_id,
        source: "ot".to_owned(),
        quantity: 1,
        ..Default::default()
    };
    let mut lines = vec![AutoChargeInput {
        charge_code: "OT_SURGERY".to_owned(),
        source_id: row.id,
        ..base.clone()
    }];
    // Distinct source ids: the booking id would collide with the surgery
    // charge under auto_charge's (source, source_id) idempotency.
    if row.anesthetist_id.is_some() {
        lines.push(AutoChargeInput {
            charge_code: "ANAES_OT".to_owned(),
            source_id: Uuid::new_v5(&row.id, b"ot-anaesthesia"),
            ..base.clone()
        });
    }
    if let Some(hours) = theatre_hours(row) {
        lines.push(AutoChargeInput {
            charge_code: "OT_TIME".to_owned(),
            source_id: Uuid::new_v5(&row.id, b"ot-time"),
            quantity: hours,
            ..base.clone()
        });
    }
    let concessions = lines.len();
    lines.extend(consumables(tx, claims, row, &base).await?);
    let reqs: Vec<ChargeRequest<'_>> = lines
        .into_iter()
        .enumerate()
        .map(|(i, charge)| ChargeRequest {
            tenant_id: claims.tenant_id,
            requested_by: claims.sub,
            setting_module: "ot",
            charge,
            // Procedure lines take concessions as they always have; consumables
            // bill at their recorded price.
            apply_concessions: i < concessions,
        })
        .collect();
    charge_or_queue_all(tx, &reqs).await
}

/// Hours of actual theatre occupancy, rounded up; `None` when the times are
/// missing or not positive.
fn theatre_hours(row: &OtBooking) -> Option<i32> {
    let (start, end) = (row.actual_start?, row.actual_end?);
    let minutes = (end - start).num_minutes();
    (minutes > 0).then(|| i32::try_from((minutes + 59) / 60).unwrap_or(1).max(1))
}

/// One line per consumable used, at its recorded unit price. Idempotent per
/// usage row.
async fn consumables(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    row: &OtBooking,
    base: &AutoChargeInput,
) -> Result<Vec<AutoChargeInput>, AppError> {
    let used: Vec<(Uuid, String, i32, Option<Decimal>)> = sqlx::query_as(
        "SELECT id, item_name, GREATEST(ROUND(quantity)::int, 1) AS qty, unit_price \
         FROM ot_consumable_usage WHERE tenant_id = $1 AND booking_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(row.id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(used
        .into_iter()
        .map(|(usage_id, item_name, qty, unit_price)| AutoChargeInput {
            charge_code: "OT_CONSUMABLE".to_owned(),
            source_id: usage_id,
            quantity: qty,
            description_override: Some(item_name),
            unit_price_override: unit_price,
            ..base.clone()
        })
        .collect())
}

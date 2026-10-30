//! The hospital's limits on an online order beyond what a medicine allows:
//! delivery slots and their daily capacity, the cash-on-delivery cap, and
//! the repeat-order flag. A flag holds the order for the pharmacist; it
//! never refuses it (research brief §8: allow, deny, unknown — never an
//! automatic refusal on a guess).

use medbrains_core::pharmacy_delivery::PAY_ON_DELIVERY;
use medbrains_pharmacy_delivery::choice::DeliveryChoice;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::rules::OrderRules;

/// The flag on an order repeating a medicine sooner than its supply runs out.
pub(crate) const REPEAT_ORDER: &str = "repeat_order";

/// A delivery the hospital's rules allow: an enabled slot with room today,
/// and cash on delivery only up to the cap.
pub(crate) async fn check_delivery(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    rules: &OrderRules,
    choice: &DeliveryChoice,
    total: Decimal,
) -> Result<(), AppError> {
    if choice.payment == PAY_ON_DELIVERY && total > rules.cod_max_amount {
        return Err(AppError::BadRequest(format!(
            "Cash on delivery is for orders up to ₹{}: pay online for this one",
            rules.cod_max_amount
        )));
    }
    let Some(slot) = choice
        .preferred_slot
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return Ok(());
    };
    let capacity = rules
        .delivery_slots
        .iter()
        .find(|s| s.slot == slot)
        .map(|s| s.capacity)
        .ok_or_else(|| {
            AppError::BadRequest("That delivery slot isn't offered: choose another".to_owned())
        })?;
    let taken: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_store_orders \
          WHERE tenant_id = $1 AND delivery_slot = $2 AND fulfilment = 'delivery' \
            AND status NOT IN ('cart', 'cancelled', 'rejected') AND deleted_at IS NULL \
            AND placed_at >= date_trunc('day', now())",
    )
    .bind(tenant_id)
    .bind(slot)
    .fetch_one(&mut **tx)
    .await?;
    if taken >= i64::from(capacity) {
        return Err(AppError::Conflict(format!(
            "Today's {slot} deliveries are full: choose another slot"
        )));
    }
    Ok(())
}

/// Whether cash on delivery is within the cap for this total.
pub(crate) fn cod_allowed(rules: &OrderRules, total: Decimal) -> bool {
    total <= rules.cod_max_amount
}

/// Flags for the pharmacist: a medicine this patient already ordered online
/// within the hospital's repeat window.
pub(crate) async fn repeat_flags(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    order: Uuid,
    items: &[Uuid],
    rules: &OrderRules,
) -> Result<Vec<String>, AppError> {
    if rules.repeat_flag_days <= 0 {
        return Ok(Vec::new());
    }
    let repeat: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pharmacy_store_orders o \
           JOIN pharmacy_store_order_lines l ON l.store_order_id = o.id AND l.tenant_id = o.tenant_id \
          WHERE o.tenant_id = $1 AND o.patient_id = $2 AND o.id <> $3 \
            AND o.status IN ('awaiting_verification', 'released') AND o.deleted_at IS NULL \
            AND l.deleted_at IS NULL AND l.status <> 'rejected' \
            AND COALESCE(l.substitute_item_id, l.catalog_item_id) = ANY($4) \
            AND o.placed_at > now() - make_interval(days => $5))",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(order)
    .bind(items)
    .bind(i32::try_from(rules.repeat_flag_days).unwrap_or(i32::MAX))
    .fetch_one(&mut **tx)
    .await?;
    Ok(if repeat {
        vec![REPEAT_ORDER.to_owned()]
    } else {
        Vec::new()
    })
}

/// The pincode on the patient's record, for choosing the nearer pharmacy.
pub(crate) async fn patient_pincode(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    store_order_id: Uuid,
) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT NULLIF(p.address->>'postal_code', '') FROM pharmacy_store_orders o \
           JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
          WHERE o.id = $1 AND o.tenant_id = $2",
    )
    .bind(store_order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten())
}

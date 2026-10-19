//! What a delivery decision reads: the order's lines, the patient's address
//! and delivery record, the hospital's delivery settings, and what is still
//! owed on the order's bill.

use medbrains_core::pharmacy_delivery::{DEFAULT_COD_MIN_DELIVERIES, History, LineFacts};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// How far back a patient's delivery record counts.
const HISTORY_DAYS: i32 = 365;

#[derive(Debug)]
pub struct OrderFacts {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub status: String,
    pub lines: Vec<LineFacts>,
}

pub async fn order_facts(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<OrderFacts, AppError> {
    let (patient_id, encounter_id, status): (Uuid, Option<Uuid>, String) = sqlx::query_as(
        "SELECT patient_id, encounter_id, status FROM pharmacy_orders \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let rows: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT i.drug_name, \
                COALESCE(c.is_controlled OR c.drug_schedule IN ('X', 'H1', 'NDPS'), false), \
                COALESCE(c.needs_cold_chain, false) \
           FROM pharmacy_order_items i \
           LEFT JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
          WHERE i.order_id = $1 AND i.tenant_id = $2 \
          ORDER BY i.created_at",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let lines = rows
        .into_iter()
        .map(|(name, controlled, needs_cold_chain)| LineFacts {
            name,
            controlled,
            needs_cold_chain,
        })
        .collect();
    Ok(OrderFacts {
        patient_id,
        encounter_id,
        status,
        lines,
    })
}

/// The patient's address as one line, and their phone, to prefill.
pub async fn patient_contact(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(String, Option<String>, String), AppError> {
    let (address, pincode, phone): (Option<String>, Option<String>, String) = sqlx::query_as(
        "SELECT NULLIF(concat_ws(', ', NULLIF(COALESCE(address->>'line1', address_line1), ''), \
                    NULLIF(address->>'line2', ''), NULLIF(address->>'city', ''), \
                    NULLIF(address->>'district', ''), NULLIF(address->>'state', '')), ''), \
                NULLIF(address->>'postal_code', ''), phone \
           FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    Ok((address.unwrap_or_default(), pincode, phone))
}

pub async fn history(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<History, AppError> {
    let (delivered, failed, short_paid): (i64, i64, i64) = sqlx::query_as(
        "SELECT COUNT(*) FILTER (WHERE status = 'delivered' \
                    AND (payment = 'prepaid' OR cash_collected >= amount_due)), \
                COUNT(*) FILTER (WHERE status = 'failed'), \
                COUNT(*) FILTER (WHERE status = 'delivered' AND payment = 'cash_on_delivery' \
                    AND COALESCE(cash_collected, 0) < amount_due) \
           FROM pharmacy_deliveries \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
            AND created_at > now() - make_interval(days => $3)",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(HISTORY_DAYS)
    .fetch_one(&mut **tx)
    .await?;
    Ok(History {
        delivered,
        failed,
        short_paid,
    })
}

async fn setting(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    key: &str,
) -> Result<Option<serde_json::Value>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'pharmacy' AND key = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The hospital's delivery fee and how many paid deliveries earn cash on
/// delivery (`pharmacy.delivery_fee`, `pharmacy.cod_min_deliveries`).
pub async fn settings(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<(Decimal, i64), AppError> {
    let fee = setting(tx, tenant_id, "delivery_fee")
        .await?
        .and_then(|v| {
            v.as_f64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .and_then(|f| Decimal::try_from(f).ok())
        .unwrap_or(Decimal::ZERO)
        .round_dp(2);
    let min = setting(tx, tenant_id, "cod_min_deliveries")
        .await?
        .and_then(|v| v.as_i64())
        .unwrap_or(DEFAULT_COD_MIN_DELIVERIES);
    Ok((fee, min))
}

/// What is still owed on the bill this order is charged to; nothing when it
/// isn't billed (a free or camp dispense).
pub async fn bill_balance(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<Decimal, AppError> {
    let balance: Option<Decimal> = sqlx::query_scalar(
        "SELECT i.total_amount - i.paid_amount FROM invoices i \
          WHERE i.tenant_id = $1 AND i.id = ( \
            SELECT ii.invoice_id FROM invoice_items ii \
             WHERE ii.tenant_id = $1 AND ii.pharmacy_order_id = $2 \
               AND ii.reversal_of_id IS NULL AND ii.is_reversal = false \
             ORDER BY ii.created_at DESC LIMIT 1)",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(balance.unwrap_or(Decimal::ZERO).max(Decimal::ZERO))
}

/// Whether patients may ask for home delivery themselves
/// (`pharmacy.home_delivery_enabled`); off until the hospital turns it on.
pub async fn home_delivery_enabled(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    Ok(setting(tx, tenant_id, "home_delivery_enabled")
        .await?
        .and_then(|v| v.as_bool())
        .unwrap_or(false))
}

/// Whether the hospital can take a payment online by link. Razorpay is the
/// one provider whose payment links are wired, so: Razorpay active (the
/// gateway's default) and its keys set, in `payments.*` or the environment —
/// the same reading the payment gateway makes.
pub async fn online_payment_ready(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    let (active, configured): (bool, bool) = sqlx::query_as(
        "SELECT COALESCE((SELECT value #>> '{}' FROM tenant_settings \
                           WHERE tenant_id = $1 AND category = 'payments' \
                             AND key = 'active_provider' AND deleted_at IS NULL), \
                         'razorpay') = 'razorpay', \
                EXISTS (SELECT 1 FROM tenant_settings \
                         WHERE tenant_id = $1 AND category = 'payments' \
                           AND key = 'razorpay_config' AND deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let env =
        std::env::var("RAZORPAY_KEY_ID").is_ok() && std::env::var("RAZORPAY_KEY_SECRET").is_ok();
    Ok(active && (configured || env))
}

/// The bill an order is charged to, if it is billed.
pub async fn order_invoice(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT invoice_id FROM invoice_items \
          WHERE tenant_id = $1 AND pharmacy_order_id = $2 \
            AND reversal_of_id IS NULL AND is_reversal = false \
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_optional(&mut **tx)
    .await?)
}

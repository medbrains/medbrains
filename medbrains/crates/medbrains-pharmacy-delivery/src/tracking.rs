//! A patient following their own deliveries: where each stands, when it
//! moved, who is bringing it (a runner's first name, or the courier and its
//! tracking reference — never a phone number), the code to hand over at the
//! door, and the payment link while one is owed.

use chrono::{DateTime, Utc};
use medbrains_core::pharmacy_delivery::{PAY_NOW, PAY_ON_DELIVERY, PatientStage, Status};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// How many delivery requests the patient's list shows.
const LIST_LIMIT: i64 = 20;
/// Medicines named per request.
const DRUG_LIMIT: i64 = 10;
/// Shown when the payment link could not be made.
const LINK_FAILED: &str = "Online payment couldn't be set up. Ask the pharmacy how to pay.";

#[derive(sqlx::FromRow)]
struct Row {
    id: Uuid,
    prescription_id: Option<Uuid>,
    drugs: Vec<String>,
    request_status: String,
    requested_at: DateTime<Utc>,
    address: Option<String>,
    preferred_slot: Option<String>,
    payment: Option<String>,
    delivery_note: Option<String>,
    delivery_status: Option<String>,
    prepared_at: Option<DateTime<Utc>>,
    dispatched_at: Option<DateTime<Utc>>,
    delivered_at: Option<DateTime<Utc>>,
    failure_reason: Option<String>,
    runner_first_name: Option<String>,
    courier_name: Option<String>,
    tracking_ref: Option<String>,
    amount_due: Option<Decimal>,
    patient_code: Option<String>,
    payment_status: Option<String>,
    payment_url: Option<String>,
    payment_amount: Option<Decimal>,
}

/// One delivery the patient asked for, as they see it.
#[derive(Debug, Serialize)]
pub struct PatientDelivery {
    /// The refill request's id, or the storefront order's: it exists from
    /// the moment they ask.
    pub id: Uuid,
    /// The prescription refilled; none for a storefront order.
    pub prescription_id: Option<Uuid>,
    pub drugs: Vec<String>,
    /// requested, `awaiting_payment`, `being_prepared`, `out_for_delivery`,
    /// delivered, failed, cancelled, declined or `not_deliverable`.
    pub stage: &'static str,
    pub address: Option<String>,
    pub preferred_slot: Option<String>,
    pub payment: Option<String>,
    pub requested_at: DateTime<Utc>,
    pub prepared_at: Option<DateTime<Utc>>,
    pub dispatched_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    /// Why it failed, or why the pharmacy couldn't send it.
    pub note: Option<String>,
    /// The runner's first name, or the courier's name.
    pub carrier: Option<String>,
    pub tracking_ref: Option<String>,
    /// To pay at the door.
    pub amount_due: Option<Decimal>,
    /// To pay now, with the link to pay it.
    pub pay_amount: Option<Decimal>,
    pub payment_url: Option<String>,
    /// The code to give the runner — only while it is on its way.
    pub handover_code: Option<String>,
}

fn present(row: Row) -> PatientDelivery {
    let delivery = row.delivery_status.as_deref().and_then(Status::parse);
    let owes = row.payment.as_deref() == Some(PAY_NOW)
        && row
            .payment_status
            .as_deref()
            .is_some_and(|s| s != "captured");
    let stage = PatientStage::of(
        &row.request_status,
        delivery,
        row.delivery_note.is_some(),
        owes,
    );
    let on_the_way = stage == PatientStage::OutForDelivery;
    let awaiting = stage == PatientStage::AwaitingPayment;
    let at_the_door = row.payment.as_deref() == Some(PAY_ON_DELIVERY);
    PatientDelivery {
        id: row.id,
        prescription_id: row.prescription_id,
        drugs: row.drugs,
        stage: stage.as_str(),
        address: row.address,
        preferred_slot: row.preferred_slot,
        requested_at: row.requested_at,
        prepared_at: row.prepared_at,
        dispatched_at: row.dispatched_at,
        delivered_at: row.delivered_at,
        note: row.failure_reason.or(row.delivery_note).or_else(|| {
            (awaiting && row.payment_status.as_deref() == Some("failed"))
                .then(|| LINK_FAILED.to_owned())
        }),
        carrier: row.courier_name.or(row.runner_first_name),
        tracking_ref: row.tracking_ref,
        amount_due: row.amount_due.filter(|_| at_the_door),
        pay_amount: row.payment_amount.filter(|_| awaiting),
        payment_url: row.payment_url.filter(|_| awaiting),
        handover_code: row.patient_code.filter(|_| on_the_way),
        payment: row.payment,
    }
}

/// What follows a delivery the patient chose: the latest delivery made for
/// it, who is bringing it, and its pay-now payment. `{key}` names the source.
const FOLLOW: &str = "d.status AS delivery_status, d.created_at AS prepared_at, d.dispatched_at, \
        d.delivered_at, d.failure_reason, \
        NULLIF(split_part(u.full_name, ' ', 1), '') AS runner_first_name, \
        d.courier_name, d.tracking_ref, d.amount_due, d.patient_code, \
        t.status AS payment_status, t.notes->>'payment_link' AS payment_url, \
        t.amount AS payment_amount";

/// Refill requests and storefront orders the patient chose delivery for.
/// A storefront order waiting for its prescription to be verified reads as
/// requested; one the pharmacist rejected is on the orders list, not here.
static PATIENT_DELIVERIES: std::sync::LazyLock<String> = std::sync::LazyLock::new(|| {
    format!(
        "SELECT * FROM ( \
         SELECT r.id, r.prescription_id, \
                ARRAY(SELECT i.drug_name FROM prescription_items i \
                       WHERE i.tenant_id = r.tenant_id AND i.prescription_id = r.prescription_id \
                         AND i.item_status = 'active' ORDER BY i.created_at LIMIT $4) AS drugs, \
                r.status AS request_status, r.created_at AS requested_at, \
                r.delivery_address AS address, r.delivery_slot AS preferred_slot, \
                r.delivery_payment AS payment, r.delivery_note, {FOLLOW} \
           FROM prescription_refill_requests r \
           LEFT JOIN LATERAL (SELECT * FROM pharmacy_deliveries d \
                 WHERE d.tenant_id = r.tenant_id AND d.refill_request_id = r.id \
                   AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 1) d ON true \
           LEFT JOIN users u ON u.id = d.runner_id AND u.tenant_id = r.tenant_id \
           LEFT JOIN payment_gateway_transactions t \
                  ON t.id = r.payment_txn_id AND t.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND r.patient_id = $2 AND r.fulfilment = 'delivery' \
            AND r.deleted_at IS NULL AND ($3::uuid IS NULL OR r.id = $3) \
         UNION ALL \
         SELECT s.id, NULL::uuid, \
                ARRAY(SELECT l.drug_name FROM pharmacy_store_order_lines l \
                       WHERE l.tenant_id = s.tenant_id AND l.store_order_id = s.id \
                         AND l.status <> 'rejected' AND l.deleted_at IS NULL \
                       ORDER BY l.created_at LIMIT $4), \
                'sent_to_pharmacy', COALESCE(s.placed_at, s.created_at), \
                s.delivery_address, s.delivery_slot, s.delivery_payment, s.delivery_note, {FOLLOW} \
           FROM pharmacy_store_orders s \
           LEFT JOIN LATERAL (SELECT * FROM pharmacy_deliveries d \
                 WHERE d.tenant_id = s.tenant_id AND d.store_order_id = s.id \
                   AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 1) d ON true \
           LEFT JOIN users u ON u.id = d.runner_id AND u.tenant_id = s.tenant_id \
           LEFT JOIN payment_gateway_transactions t \
                  ON t.id = s.payment_txn_id AND t.tenant_id = s.tenant_id \
          WHERE s.tenant_id = $1 AND s.patient_id = $2 AND s.fulfilment = 'delivery' \
            AND s.status IN ('awaiting_verification', 'released') \
            AND s.deleted_at IS NULL AND ($3::uuid IS NULL OR s.id = $3) \
         ) x ORDER BY requested_at DESC LIMIT $5"
    )
});

/// The patient's own delivery requests, newest first; `only` narrows to one.
/// Another patient's request is simply not among them.
pub async fn patient_deliveries(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    only: Option<Uuid>,
) -> Result<Vec<PatientDelivery>, AppError> {
    let rows = sqlx::query_as::<_, Row>(PATIENT_DELIVERIES.as_str())
        .bind(tenant_id)
        .bind(patient_id)
        .bind(only)
        .bind(DRUG_LIMIT)
        .bind(LIST_LIMIT)
        .fetch_all(&mut **tx)
        .await?;
    Ok(rows.into_iter().map(present).collect())
}

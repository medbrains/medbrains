//! A patient's choice, when they ask for a refill, of pickup or home
//! delivery: what they are offered, recording it on the request, and turning
//! it into a delivery once the pharmacist approves the refill — at once when
//! they pay at the door, after the payment link is paid when they pay now
//! (`crate::pay`).

use medbrains_core::pharmacy_delivery::{
    DELIVERY_SLOTS, LineFacts, PAY_ON_DELIVERY, cash_on_delivery, patient_offer,
};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::arrange::charge_fee;
use crate::facts::{
    bill_balance, history, home_delivery_enabled, online_payment_ready, order_facts, order_invoice,
    patient_contact, settings,
};
use crate::pay::payment_link;

/// Saved addresses offered besides the one on the patient's record.
const SAVED_ADDRESS_LIMIT: i64 = 5;
/// A phone number's digits, at least and at most.
const PHONE_DIGITS: std::ops::RangeInclusive<usize> = 10..=15;

#[derive(Debug, Serialize)]
pub struct SavedAddress {
    pub label: String,
    pub address: String,
    pub pincode: Option<String>,
}

/// What the patient may choose for this prescription's refill.
#[derive(Debug, Serialize)]
pub struct DeliveryOffer {
    pub available: bool,
    /// Why home delivery isn't offered, in the patient's words.
    pub reason: Option<String>,
    /// `cash_on_delivery` and/or `prepaid`.
    pub payments: Vec<&'static str>,
    pub addresses: Vec<SavedAddress>,
    pub contact_phone: String,
    pub delivery_fee: Decimal,
    pub slots: [&'static str; 3],
}

/// The patient's delivery choice, as sent.
#[derive(Debug, Deserialize)]
pub struct DeliveryChoice {
    pub address: String,
    pub landmark: Option<String>,
    pub pincode: Option<String>,
    pub contact_phone: String,
    pub preferred_slot: Option<String>,
    pub payment: String,
}

fn text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// The prescription's active lines as delivery sees them; not found unless
/// it is this patient's, and not an inpatient order.
async fn prescription_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    prescription_id: Uuid,
) -> Result<Vec<LineFacts>, AppError> {
    let theirs: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM prescriptions p \
           LEFT JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
          WHERE p.tenant_id = $1 AND p.id = $2 AND COALESCE(p.patient_id, e.patient_id) = $3 \
            AND p.deleted_at IS NULL AND p.admission_id IS NULL)",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if !theirs {
        return Err(AppError::NotFound);
    }
    let rows: Vec<(String, bool, bool)> = sqlx::query_as(
        "SELECT i.drug_name, \
                COALESCE(c.is_controlled OR c.drug_schedule IN ('X', 'H1', 'NDPS'), false), \
                COALESCE(c.needs_cold_chain, false) \
           FROM prescription_items i \
           LEFT JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
          WHERE i.tenant_id = $1 AND i.prescription_id = $2 AND i.item_status = 'active' \
          ORDER BY i.created_at",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(name, controlled, needs_cold_chain)| LineFacts {
            name,
            controlled,
            needs_cold_chain,
        })
        .collect())
}

/// The address on the patient's record, then their other saved addresses.
async fn saved_addresses(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    record: (String, Option<String>),
    patient_id: Uuid,
) -> Result<Vec<SavedAddress>, AppError> {
    let rows: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT initcap(address_type::text), \
                concat_ws(', ', NULLIF(address_line1, ''), NULLIF(address_line2, ''), \
                          NULLIF(village_town, ''), NULLIF(city, '')), \
                NULLIF(postal_code, '') \
           FROM patient_addresses \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
          ORDER BY is_primary DESC, created_at LIMIT $3",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(SAVED_ADDRESS_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let mut out: Vec<SavedAddress> = Vec::with_capacity(rows.len() + 1);
    if !record.0.is_empty() {
        out.push(SavedAddress {
            label: "Home".to_owned(),
            address: record.0,
            pincode: record.1,
        });
    }
    for (label, address, pincode) in rows {
        if !address.is_empty() && !out.iter().any(|a| a.address == address) {
            out.push(SavedAddress {
                label,
                address,
                pincode,
            });
        }
    }
    Ok(out)
}

/// What a patient may choose for a refill of this prescription.
pub async fn offer(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    prescription_id: Uuid,
) -> Result<DeliveryOffer, AppError> {
    let lines = prescription_lines(tx, tenant_id, patient_id, prescription_id).await?;
    let enabled = home_delivery_enabled(tx, tenant_id).await?;
    let (fee, cod_min) = settings(tx, tenant_id).await?;
    let record = history(tx, tenant_id, patient_id).await?;
    let online = online_payment_ready(tx, tenant_id).await?;
    let offer = patient_offer(
        enabled,
        &lines,
        cash_on_delivery(record, cod_min).is_ok(),
        online,
    );
    let (address, pincode, phone) = patient_contact(tx, tenant_id, patient_id).await?;
    let addresses = saved_addresses(tx, tenant_id, (address, pincode), patient_id).await?;
    Ok(DeliveryOffer {
        available: offer.available,
        reason: offer.reason,
        payments: offer.payments,
        addresses,
        contact_phone: phone,
        delivery_fee: fee,
        slots: DELIVERY_SLOTS,
    })
}

/// A choice that has been checked against the offer.
#[derive(Debug)]
pub struct CheckedChoice {
    address: String,
    landmark: Option<String>,
    pincode: Option<String>,
    phone: String,
    slot: Option<String>,
    payment: &'static str,
}

/// Check a delivery choice against what this patient is offered; refused
/// with the reason when delivery isn't offered or the choice is incomplete.
pub async fn check_choice(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    prescription_id: Uuid,
    choice: &DeliveryChoice,
) -> Result<CheckedChoice, AppError> {
    let offered = offer(tx, tenant_id, patient_id, prescription_id).await?;
    if !offered.available {
        return Err(AppError::BadRequest(offered.reason.unwrap_or_default()));
    }
    let payment = offered
        .payments
        .iter()
        .copied()
        .find(|p| *p == choice.payment)
        .ok_or_else(|| AppError::BadRequest("Choose one of the ways to pay shown".to_owned()))?;
    let address = text(Some(&choice.address))
        .ok_or_else(|| AppError::BadRequest("Enter the address to deliver to".to_owned()))?;
    let phone = text(Some(&choice.contact_phone))
        .filter(|p| PHONE_DIGITS.contains(&p.chars().filter(char::is_ascii_digit).count()))
        .ok_or_else(|| AppError::BadRequest("Enter a phone number for the delivery".to_owned()))?;
    let slot = text(choice.preferred_slot.as_deref());
    if slot
        .as_deref()
        .is_some_and(|s| !DELIVERY_SLOTS.contains(&s))
    {
        return Err(AppError::BadRequest(
            "Choose morning, afternoon or evening".to_owned(),
        ));
    }
    Ok(CheckedChoice {
        address,
        landmark: text(choice.landmark.as_deref()),
        pincode: text(choice.pincode.as_deref()),
        phone,
        slot,
        payment,
    })
}

/// Put the checked choice on the patient's refill request.
pub async fn record_choice(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    request_id: Uuid,
    choice: &CheckedChoice,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE prescription_refill_requests \
            SET fulfilment = 'delivery', delivery_address = $3, delivery_landmark = $4, \
                delivery_pincode = $5, delivery_phone = $6, delivery_slot = $7, \
                delivery_payment = $8 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(request_id)
    .bind(tenant_id)
    .bind(&choice.address)
    .bind(&choice.landmark)
    .bind(&choice.pincode)
    .bind(&choice.phone)
    .bind(&choice.slot)
    .bind(choice.payment)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Open the delivery the patient chose, as it stood on their request. The
/// pharmacy then gives it to a runner or a courier. Once per order.
pub(crate) async fn open_delivery(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    request_id: Uuid,
    order_id: Uuid,
    fee: Decimal,
    due: Decimal,
    arranged_by: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO pharmacy_deliveries \
           (tenant_id, order_id, patient_id, mode, address, landmark, pincode, contact_phone, \
            payment, delivery_fee, amount_due, arranged_by, refill_request_id, preferred_slot) \
         SELECT r.tenant_id, $3, r.patient_id, 'runner', r.delivery_address, r.delivery_landmark, \
                r.delivery_pincode, r.delivery_phone, r.delivery_payment, $4, $5, $6, r.id, \
                r.delivery_slot \
           FROM prescription_refill_requests r \
          WHERE r.id = $2 AND r.tenant_id = $1 AND r.fulfilment = 'delivery' \
         ON CONFLICT (tenant_id, order_id) \
            WHERE status IN ('arranged', 'out_for_delivery', 'delivered') AND deleted_at IS NULL \
         DO NOTHING",
    )
    .bind(tenant_id)
    .bind(request_id)
    .bind(order_id)
    .bind(fee)
    .bind(due)
    .bind(arranged_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct Chosen {
    id: Uuid,
    delivery_payment: Option<String>,
    delivery_phone: Option<String>,
}

/// The pharmacist approved a refill and its order was made. If the patient
/// chose delivery, bill the fee and either open the delivery (they pay at
/// the door, or nothing is owed) or send them a payment link.
pub async fn on_order_approved(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    actor: Uuid,
    rx_queue_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    let Some(chosen) = sqlx::query_as::<_, Chosen>(
        "SELECT id, delivery_payment, delivery_phone FROM prescription_refill_requests \
          WHERE tenant_id = $1 AND rx_queue_id = $2 AND fulfilment = 'delivery' \
            AND deleted_at IS NULL \
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(rx_queue_id)
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(());
    };
    let order = order_facts(tx, tenant_id, order_id).await?;
    // The order is what goes, as the pharmacist mapped it — checked again.
    if let Some(reason) = patient_offer(true, &order.lines, true, true).reason {
        sqlx::query(
            "UPDATE prescription_refill_requests SET delivery_note = $3 \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(chosen.id)
        .bind(tenant_id)
        .bind(reason)
        .execute(&mut **tx)
        .await?;
        return Ok(());
    }
    let (fee, _) = settings(tx, tenant_id).await?;
    // Read before the fee is billed, so it isn't counted twice.
    let due = bill_balance(tx, tenant_id, order_id).await? + fee;
    let fee_invoice = if fee > Decimal::ZERO {
        Some(charge_fee(tx, tenant_id, &order, chosen.id, fee).await?)
    } else {
        None
    };
    // Paid at the door, or nothing to pay: it goes on to the pharmacy now.
    if chosen.delivery_payment.as_deref() == Some(PAY_ON_DELIVERY) || due <= Decimal::ZERO {
        return open_delivery(tx, tenant_id, chosen.id, order_id, fee, due, Some(actor)).await;
    }
    let invoice = order_invoice(tx, tenant_id, order_id)
        .await?
        .or(fee_invoice);
    let txn = payment_link(
        tx,
        tenant_id,
        invoice,
        due,
        chosen.delivery_phone.as_deref(),
        chosen.id,
    )
    .await?;
    sqlx::query(
        "UPDATE prescription_refill_requests SET payment_txn_id = $3 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(chosen.id)
    .bind(tenant_id)
    .bind(txn)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

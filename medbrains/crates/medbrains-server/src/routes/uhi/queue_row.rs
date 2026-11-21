//! One row of the UHI requests screen: the columns the queue reads and the
//! view the staff screen gets, with its one-line summary of the order.

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use super::{labs, requests::pickup_address};

pub(super) const COLUMNS: &str = "id, service, state, customer_name, customer_phone, customer_abha, \
    order_details, appointment_id, ambulance_trip_id, decline_reason, confirmed_at, \
    responded_at, updated_at, payment_type, payment_status, amount, hold_expires_at, \
    lab_order_ids, slot_held_until, doctor_no_show_at, (pin_hash IS NOT NULL) AS has_pin, \
    pin_verified_at, pin_failed_attempts";

#[derive(Debug, sqlx::FromRow)]
pub(super) struct Row {
    pub(super) id: Uuid,
    pub(super) service: String,
    pub(super) state: String,
    pub(super) customer_name: Option<String>,
    pub(super) customer_phone: Option<String>,
    pub(super) customer_abha: Option<String>,
    pub(super) order_details: Option<Value>,
    pub(super) appointment_id: Option<Uuid>,
    pub(super) ambulance_trip_id: Option<Uuid>,
    pub(super) decline_reason: Option<String>,
    pub(super) confirmed_at: Option<DateTime<Utc>>,
    pub(super) responded_at: Option<DateTime<Utc>>,
    pub(super) updated_at: DateTime<Utc>,
    pub(super) payment_type: Option<String>,
    pub(super) payment_status: Option<String>,
    pub(super) amount: Option<rust_decimal::Decimal>,
    pub(super) hold_expires_at: Option<DateTime<Utc>>,
    pub(super) lab_order_ids: Vec<Uuid>,
    pub(super) slot_held_until: Option<DateTime<Utc>>,
    pub(super) doctor_no_show_at: Option<DateTime<Utc>>,
    pub(super) has_pin: bool,
    pub(super) pin_verified_at: Option<DateTime<Utc>>,
    pub(super) pin_failed_attempts: i32,
}

#[derive(Debug, Serialize)]
pub struct UhiRequest {
    pub id: Uuid,
    pub service: String,
    pub state: String,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub customer_abha: Option<String>,
    /// What was asked for, in a line: the doctor and time, the blood, the pickup.
    pub summary: String,
    pub appointment_id: Option<Uuid>,
    pub ambulance_trip_id: Option<Uuid>,
    pub decline_reason: Option<String>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub responded_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    /// `ON-ORDER` (paid online) or `ON-FULFILLMENT` (at the hospital).
    pub payment_type: Option<String>,
    /// `PAID` or `NOT-PAID`; paid on a cancelled or expired booking means a
    /// refund is due.
    pub payment_status: Option<String>,
    pub amount: Option<rust_decimal::Decimal>,
    /// A held booking lets go of its slot at this time unless paid.
    pub hold_expires_at: Option<DateTime<Utc>>,
    /// The lab orders an accepted lab request became.
    pub lab_order_ids: Vec<Uuid>,
    /// A lab request for a home collection (accepting it books one).
    pub home_collection: bool,
    /// A visit's slot is held for the patient until this time (`init`); the
    /// hold lapses by itself unless the app confirms.
    pub slot_held_until: Option<DateTime<Utc>>,
    /// The patient's app reported that the doctor did not see them.
    pub doctor_no_show_at: Option<DateTime<Utc>>,
    /// The booking has a PIN for the desk to check (never the PIN itself).
    pub has_pin: bool,
    /// When the desk checked the PIN and it matched.
    pub pin_verified_at: Option<DateTime<Utc>>,
    /// Wrong PINs tried so far; five lock the check.
    pub pin_failed_attempts: i32,
}

/// One line for the desk queue saying what was booked, read from the Beckn order.
fn summary(service: &str, order: &Value) -> String {
    let s = |p: &str| order.pointer(p).and_then(Value::as_str).unwrap_or_default();
    match service {
        "teleconsultation" | "physical_consultation" => format!(
            "{} at {}",
            s("/fulfillment/agent/name"),
            s("/fulfillment/start/time/timestamp").replace('T', " ")
        ),
        "ambulance" => format!(
            "Pickup: {}",
            pickup_address(order).unwrap_or_else(|| "not given".to_owned())
        ),
        "lab_tests" => labs::summary(order),
        _ => order
            .get("items")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|i| {
                        let count = i.pointer("/quantity/count").and_then(Value::as_i64);
                        let name = i.pointer("/descriptor/name").and_then(Value::as_str);
                        format!("{} × {}", count.unwrap_or(1), name.unwrap_or("blood"))
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default(),
    }
}

impl From<Row> for UhiRequest {
    fn from(r: Row) -> Self {
        let summary = r
            .order_details
            .as_ref()
            .map(|o| summary(&r.service, o))
            .unwrap_or_default();
        let home_collection =
            r.service == "lab_tests" && r.order_details.as_ref().is_some_and(labs::is_home);
        Self {
            id: r.id,
            service: r.service,
            state: r.state,
            customer_name: r.customer_name,
            customer_phone: r.customer_phone,
            customer_abha: r.customer_abha,
            summary,
            appointment_id: r.appointment_id,
            ambulance_trip_id: r.ambulance_trip_id,
            decline_reason: r.decline_reason,
            confirmed_at: r.confirmed_at,
            responded_at: r.responded_at,
            updated_at: r.updated_at,
            payment_type: r.payment_type,
            payment_status: r.payment_status,
            amount: r.amount,
            hold_expires_at: r.hold_expires_at,
            lab_order_ids: r.lab_order_ids,
            home_collection,
            slot_held_until: r.slot_held_until,
            doctor_no_show_at: r.doctor_no_show_at,
            has_pin: r.has_pin,
            pin_verified_at: r.pin_verified_at,
            pin_failed_attempts: r.pin_failed_attempts,
        }
    }
}

//! Teleconsultation over UHI: find a doctor's open slots, quote one, book
//! it, report on it, cancel it.
//!
//! A booking is a real appointment, made by the same function the public
//! booking page uses (`appointments::book_online`), with its video session
//! the way the telemedicine screen opens one. It appears in the day's
//! appointments like any other. Confirm is idempotent per transaction: a
//! repeated confirm answers with the booking already made.

use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    inbound::{Reply, Txn, set_state},
    protocol::{Context, STATE_CANCELLED, STATE_CONFIRMED},
    settings::Subscription,
    slots::{self, Filter, Slot},
};
use crate::{
    error::AppError,
    routes::appointments::{OnlineBooking, PublicBookingRequest, book_online},
};

/// Where the video link rides in the fulfilment — **inferred**; UHI
/// publishes no field for it.
const TAG_TELECONF_URL: &str = "@abdm/gov.in/teleconf_url";
const REASON: &str = "Teleconsultation booked through UHI";

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

fn text<'a>(v: &'a Value, pointer: &str) -> Option<&'a str> {
    v.pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// The slot an order names: its item or its fulfilment.
fn slot_id(body: &Value) -> Option<&str> {
    text(body, "/message/order/items/0/id")
        .or_else(|| text(body, "/message/order/item/id"))
        .or_else(|| text(body, "/message/order/fulfillment/id"))
}

/// # Errors
/// A database fault.
pub async fn answer(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    ctx: &Context,
    body: &Value,
    txn: &Txn,
) -> Result<Option<Reply>, AppError> {
    match ctx.action.as_str() {
        "search" => search(tx, sub, body).await,
        "select" | "init" => quote(tx, sub, ctx, body).await.map(Some),
        "confirm" => confirm(tx, sub, body, txn).await.map(Some),
        "cancel" => cancel(tx, txn).await.map(Some),
        "status" | "update" => Ok(Some(current(txn))),
        _ => Ok(None),
    }
}

async fn search(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    body: &Value,
) -> Result<Option<Reply>, AppError> {
    let intent = body.pointer("/message/intent").unwrap_or(&Value::Null);
    let filter = Filter {
        from: text(intent, "/fulfillment/start/time/timestamp").and_then(slots::parse_timestamp),
        to: text(intent, "/fulfillment/end/time/timestamp").and_then(slots::parse_timestamp),
        doctor_name: text(intent, "/fulfillment/agent/name").map(str::to_owned),
        hpr_id: text(intent, "/fulfillment/agent/tags/@abdm~1gov.in~1hpr_id").map(str::to_owned),
        doctor_id: None,
    };
    let open = slots::open_slots(tx, sub.tenant_id, &filter).await?;
    if open.is_empty() {
        return Ok(None);
    }
    Ok(Some(Reply::message(
        json!({ "catalog": catalog(sub, &open) }),
    )))
}

fn catalog(sub: &Subscription, open: &[Slot]) -> Value {
    let mut categories: Vec<Value> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for s in open {
        if seen.insert(s.department_id) {
            categories.push(json!({ "id": s.department_id,
                "descriptor": { "name": s.department, "code": s.department } }));
        }
    }
    json!({
        "descriptor": { "name": sub.provider_name },
        "providers": [{
            "id": sub.provider_id(),
            "descriptor": { "name": sub.provider_name },
            "categories": categories,
            "fulfillments": open.iter().map(Slot::fulfillment).collect::<Vec<_>>(),
            "items": open.iter().map(Slot::item).collect::<Vec<_>>(),
        }],
    })
}

fn order(sub: &Subscription, slot: &Slot, body: &Value) -> Value {
    let given = body.pointer("/message/order").unwrap_or(&Value::Null);
    let mut order = json!({
        "provider": { "id": sub.provider_id() },
        "item": slot.item(),
        "fulfillment": slot.fulfillment(),
        "quote": {
            "price": { "currency": "INR", "value": "0.0" },
            "breakup": [{ "title": "Consultation", "price": { "currency": "INR", "value": "0.0" } }],
        },
    });
    for key in ["customer", "billing"] {
        if let Some(v) = given.get(key) {
            order[key] = v.clone();
        }
    }
    order
}

async fn quote(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    ctx: &Context,
    body: &Value,
) -> Result<Reply, AppError> {
    let Some(id) = slot_id(body) else {
        return Ok(Reply::failed("the order names no slot"));
    };
    let Some(slot) = slots::find_slot(tx, sub.tenant_id, id).await? else {
        return Ok(Reply::failed("that slot is no longer available"));
    };
    let mut order = order(sub, &slot, body);
    if ctx.action == "init" {
        // Paid at the hospital — UHI's ON-ORDER payment is not offered yet.
        order["payment"] = json!({ "type": "ON-FULFILLMENT", "status": "NOT-PAID" });
    }
    Ok(Reply::message(json!({ "order": order })))
}

struct Patient<'a> {
    abha: Option<&'a str>,
    name: Option<&'a str>,
    phone: Option<&'a str>,
}

fn patient(body: &Value) -> Patient<'_> {
    let o = "/message/order";
    Patient {
        abha: text(body, &format!("{o}/customer/id")),
        name: text(body, &format!("{o}/billing/name"))
            .or_else(|| text(body, &format!("{o}/customer/person/name"))),
        phone: text(body, &format!("{o}/billing/phone"))
            .or_else(|| text(body, &format!("{o}/customer/contact/phone"))),
    }
}

async fn confirm(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    body: &Value,
    txn: &Txn,
) -> Result<Reply, AppError> {
    if txn.appointment_id.is_some() {
        return Ok(current(txn));
    }
    let p = patient(body);
    let (Some(name), Some(phone)) = (p.name, p.phone) else {
        return Ok(Reply::failed(
            "the patient's name and phone are needed to book",
        ));
    };
    let Some(slot) = slot_id(body) else {
        return Ok(Reply::failed("the order names no slot"));
    };
    let Some(slot) = slots::find_slot(tx, sub.tenant_id, slot).await? else {
        return Ok(Reply::failed("that slot is no longer available"));
    };
    let known = match p.abha {
        Some(abha) => patient_by_abha(tx, sub.tenant_id, abha).await?,
        None => None,
    };
    if let Some((_, true)) = known {
        return Ok(Reply::failed("this hospital cannot book for that patient"));
    }
    let request = PublicBookingRequest {
        tenant_code: String::new(),
        doctor_id: slot.doctor_id,
        department_id: slot.department_id,
        appointment_date: slot.date,
        slot_start: slot.start,
        slot_end: slot.end,
        patient_name: name.to_owned(),
        patient_phone: phone.to_owned(),
        patient_dob: None,
        reason: Some(REASON.to_owned()),
        otp: None,
        campaign_code: None,
    };
    let booking = OnlineBooking {
        request: &request,
        patient_id: known.map(|(id, _)| id),
        registration_source: "telemedicine",
        booking_source: "uhi",
    };
    let appointment = match book_online(tx, sub.tenant_id, booking).await {
        Ok(a) => a,
        Err(AppError::Conflict(_)) => return Ok(Reply::failed("that slot has just been taken")),
        Err(e) => return Err(e),
    };
    let (tele_id, url) = open_video_session(tx, sub.tenant_id, &appointment, &slot).await?;
    let mut order = order(sub, &slot, body);
    order["id"] = json!(txn.id);
    order["state"] = json!(STATE_CONFIRMED);
    order["fulfillment"]["tags"] = json!({ TAG_TELECONF_URL: url });
    order["payment"] = json!({ "type": "ON-FULFILLMENT", "status": "NOT-PAID" });
    sqlx::query(
        "UPDATE uhi_transactions SET appointment_id = $2, tele_consultation_id = $3, \
                customer_name = $4, customer_phone = $5, customer_abha = $6 WHERE id = $1",
    )
    .bind(txn.id)
    .bind(appointment.id)
    .bind(tele_id)
    .bind(name)
    .bind(phone)
    .bind(p.abha)
    .execute(&mut **tx)
    .await?;
    set_state(tx, txn.id, "confirmed", &order).await?;
    Ok(Reply::message(json!({ "order": order })))
}

/// The patient whose verified ABHA address this is, and whether they are
/// recorded as deceased.
async fn patient_by_abha(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    abha_address: &str,
) -> Result<Option<(Uuid, bool)>, AppError> {
    Ok(sqlx::query_as::<_, (Uuid, bool)>(
        "SELECT p.id, COALESCE(p.is_deceased, false) FROM patient_abha_links l \
           JOIN patients p ON p.id = l.patient_id \
          WHERE l.tenant_id = $1 AND lower(l.abha_address) = lower($2) \
            AND l.verified_at IS NOT NULL AND l.unlinked_at IS NULL AND l.deleted_at IS NULL \
          ORDER BY l.verified_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(abha_address)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The appointment's video session, opened as the telemedicine screen opens
/// a self-hosted one; returns its id and join link.
async fn open_video_session(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    appointment: &medbrains_core::appointment::Appointment,
    slot: &Slot,
) -> Result<(Uuid, String), AppError> {
    let base = medbrains_telehealth::telemedicine::resolve_video_base(tx, &tenant_id).await?;
    let room = format!("medbrains-{}", Uuid::new_v4());
    let url = format!("{}/{room}", base.trim_end_matches('/'));
    let scheduled = slot.date.and_time(slot.start);
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO tele_consultations (tenant_id, appointment_id, patient_id, doctor_id, \
            room_id, provider, meeting_url, status, scheduled_at) \
         VALUES ($1, $2, $3, $4, $5, 'jitsi', $6, 'scheduled', \
                 ($7::timestamp AT TIME ZONE 'Asia/Kolkata')) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(appointment.id)
    .bind(appointment.patient_id)
    .bind(appointment.doctor_id)
    .bind(&room)
    .bind(&url)
    .bind(scheduled)
    .fetch_one(&mut **tx)
    .await?;
    Ok((id, url))
}

/// The order as last sent, or a failure when nothing was ordered yet.
pub fn current(txn: &Txn) -> Reply {
    txn.order_details.as_ref().map_or_else(
        || Reply::failed("no order has been confirmed in this transaction"),
        |order| Reply::message(json!({ "order": order })),
    )
}

async fn cancel(tx: &mut Tx<'_>, txn: &Txn) -> Result<Reply, AppError> {
    let Some(mut order) = txn.order_details.clone() else {
        return Ok(Reply::failed(
            "no order has been confirmed in this transaction",
        ));
    };
    if let Some(appointment) = txn.appointment_id {
        let moved = sqlx::query(
            "UPDATE appointments SET status = 'cancelled', cancelled_at = now(), \
                    cancel_reason = 'Cancelled by the patient through UHI' \
              WHERE id = $1 AND status IN ('scheduled', 'confirmed')",
        )
        .bind(appointment)
        .execute(&mut **tx)
        .await?;
        if moved.rows_affected() == 0 && txn.state != "cancelled" {
            return Ok(Reply::failed("the consultation has already started"));
        }
        sqlx::query(
            "UPDATE tele_consultations SET status = 'cancelled', \
                    cancel_reason = 'Cancelled by the patient through UHI' \
              WHERE appointment_id = $1 AND status = 'scheduled'",
        )
        .bind(appointment)
        .execute(&mut **tx)
        .await?;
    }
    order["state"] = json!(STATE_CANCELLED);
    set_state(tx, txn.id, "cancelled", &order).await?;
    Ok(Reply::message(json!({ "order": order })))
}

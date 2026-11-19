//! Consultations over UHI — online (teleconsultation) or at the hospital
//! (physical): find a doctor's open slots, quote one with its fee, book it,
//! report on it, cancel it.
//!
//! A booking is a real appointment, made by the same function the public
//! booking page uses (`appointments::book_online`); a teleconsultation also
//! gets its video session the way the telemedicine screen opens one, a
//! physical one gets none. It appears in the day's appointments like any
//! other. Confirm is idempotent per transaction: a repeated confirm answers
//! with the booking already made.
//!
//! Search is two-stage: a search through the gateway lists the doctors; the
//! app's direct search for one of them lists that doctor's slots, each named
//! by a stable UUID. A physical consultation follows NHA's order contract
//! (`consultation`): `init` holds the slot for 15 minutes and offers five
//! terms; `confirm` needs them agreed and answers with the patient's PIN.
//!
//! A teleconsultation with a fee, at a hospital that takes payment online,
//! is paid `ON-ORDER`: the booking is held until the payment comes in
//! (`payment`). Everything else is paid at the hospital (`ON-FULFILLMENT`);
//! a physical visit always is, at the desk where OPD bills it.

use medbrains_core::secrets::SecretResolver;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    consult_search,
    consultation::{self, Holder},
    fees,
    inbound::{Reply, Txn, set_state},
    payment,
    protocol::{Context, STATE_CANCELLED, STATE_CONFIRMED, Service, TAG_SLOT_ID},
    settings::Subscription,
    slots::{self, Slot},
};
use crate::{
    error::AppError,
    routes::appointments::{OnlineBooking, book_online},
};

/// Where the video link rides in the fulfilment — **inferred**; UHI
/// publishes no field for it.
const TAG_TELECONF_URL: &str = "@abdm/gov.in/teleconf_url";
const REASON: &str = "Teleconsultation booked through UHI";
const REASON_PHYSICAL: &str = "Consultation booked through UHI";

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

pub(super) fn text<'a>(v: &'a Value, pointer: &str) -> Option<&'a str> {
    v.pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// The slot UUID an order names: the slot tag, the fulfilment, the item's
/// fulfilment — never the item id, which NHA's app sends as `"0"`.
fn slot_id(body: &Value) -> Option<&str> {
    let o = "/message/order";
    let slot_tag = TAG_SLOT_ID.replace('/', "~1");
    text(body, &format!("{o}/fulfillment/tags/{slot_tag}"))
        .or_else(|| text(body, &format!("{o}/fulfillment/id")))
        .or_else(|| text(body, &format!("{o}/item/fulfillment_id")))
        .or_else(|| text(body, &format!("{o}/items/0/fulfillment_id")))
        .or_else(|| text(body, &format!("{o}/items/0/id")))
}

/// One consultation call as it arrived.
#[derive(Debug, Clone, Copy)]
pub struct Call<'a> {
    pub ctx: &'a Context,
    pub body: &'a Value,
    pub txn: &'a Txn,
    /// A search the gateway fanned out (it lists doctors, not slots).
    pub from_gateway: bool,
}

/// Answer one consultation call: the `message` of its `on_*`, or `None`
/// when nothing is sent back (an empty search, an EUA's own callback).
///
/// # Errors
/// A database fault.
#[tracing::instrument(skip_all, fields(tenant_id = %sub.tenant_id))]
pub async fn answer(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    call: Call<'_>,
) -> Result<Option<Reply>, AppError> {
    let Call { ctx, body, txn, .. } = call;
    let physical = txn.service == Service::PhysicalConsultation.code();
    match ctx.action.as_str() {
        "search" => consult_search::search(tx, sub, body, physical, call.from_gateway).await,
        "init" => quote(tx, secrets, sub, call, physical).await.map(Some),
        "confirm" => confirm(tx, secrets, sub, call, physical).await,
        "cancel" => cancel(tx, txn).await.map(Some),
        "status" | "update" => Ok(Some(current(txn))),
        "on_update" => consultation::record_update(tx, txn.id, body)
            .await
            .map(|()| None),
        _ => Ok(None),
    }
}

fn order(sub: &Subscription, slot: &Slot, body: &Value) -> Value {
    let given = body.pointer("/message/order").unwrap_or(&Value::Null);
    let mut order = json!({
        "provider": { "id": sub.provider_id() },
        "item": slot.item(),
        "fulfillment": slot.fulfillment(),
        "quote": fees::quote("Consultation", slot.fee.as_ref()),
    });
    for key in ["customer", "billing"] {
        if let Some(v) = given.get(key) {
            order[key] = v.clone();
        }
    }
    order
}

/// `on_init`: the order with its quote and payment. A physical consultation
/// also gets its order id and the five terms, and its slot is held.
async fn quote(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    call: Call<'_>,
    physical: bool,
) -> Result<Reply, AppError> {
    let Some(id) = slot_id(call.body) else {
        return Ok(Reply::failed("the order names no slot"));
    };
    let Some(slot) = slots::find_slot(tx, sub.tenant_id, id, physical, call.txn.id).await? else {
        return Ok(Reply::failed("that slot is no longer available"));
    };
    let mut order = order(sub, &slot, call.body);
    let online = payment::pays_online(tx, secrets, sub.tenant_id, &slot).await?;
    order["payment"] = fees::payment(online, slot.fee.as_ref());
    if physical {
        order["id"] = json!(call.txn.id);
        order["terms"] = consultation::terms(&slot);
        let p = patient(call.body);
        let who = Holder {
            name: p.name,
            phone: p.phone,
            abha: p.abha,
        };
        consultation::hold(tx, call.txn.id, (&slot, &order), who).await?;
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

/// Book the slot (once per transaction); `on_confirm`, or `None` while a
/// paid-online booking waits for its payment link.
async fn confirm(
    tx: &mut Tx<'_>,
    secrets: &dyn SecretResolver,
    sub: &Subscription,
    call: Call<'_>,
    physical: bool,
) -> Result<Option<Reply>, AppError> {
    let Call { body, txn, .. } = call;
    if txn.appointment_id.is_some() {
        // Booked already; a held booking answers once its payment link is out.
        // The stored order carries no PIN: the first on_confirm delivered it.
        return Ok(txn.order_details.is_some().then(|| current(txn)));
    }
    let failed = |m: &str| Ok(Some(Reply::failed(m)));
    if let Some(why) = physical
        .then(|| consultation::refuse_order(body, txn.id))
        .flatten()
    {
        return failed(&why);
    }
    let p = patient(body);
    let (Some(name), Some(phone)) = (p.name, p.phone) else {
        return failed("the patient's name and phone are needed to book");
    };
    let Some(slot) = slot_id(body) else {
        return failed("the order names no slot");
    };
    let Some(slot) = slots::find_slot(tx, sub.tenant_id, slot, physical, txn.id).await? else {
        return failed("that slot is no longer available");
    };
    let known = match p.abha {
        Some(abha) => patient_by_abha(tx, sub.tenant_id, abha).await?,
        None => None,
    };
    if let Some((_, true)) = known {
        return failed("this hospital cannot book for that patient");
    }
    let reason = if physical { REASON_PHYSICAL } else { REASON };
    let request = slot.booking_request((name, phone), reason);
    let booking = OnlineBooking {
        request: &request,
        patient_id: known.map(|(id, _)| id),
        registration_source: if physical {
            "mobile_app"
        } else {
            "telemedicine"
        },
        booking_source: "uhi",
    };
    let appointment = match book_online(tx, sub.tenant_id, booking).await {
        Ok(a) => a,
        Err(AppError::Conflict(_)) => return failed("that slot has just been taken"),
        Err(e) => return Err(e),
    };
    let mut order = order(sub, &slot, body);
    order["id"] = json!(txn.id);
    let tele_id = if physical {
        None
    } else {
        let (id, url) = open_video_session(tx, sub.tenant_id, &appointment, &slot).await?;
        order["fulfillment"]["tags"] = json!({ TAG_TELECONF_URL: url });
        Some(id)
    };
    let online = !physical && payment::pays_online(tx, secrets, sub.tenant_id, &slot).await?;
    order["payment"] = fees::payment(online, slot.fee.as_ref());
    sqlx::query(
        "UPDATE uhi_transactions SET appointment_id = $2, tele_consultation_id = $3, \
                customer_name = $4, customer_phone = $5, customer_abha = $6, \
                payment_type = $7, payment_status = 'NOT-PAID', amount = $8 WHERE id = $1",
    )
    .bind(txn.id)
    .bind(appointment.id)
    .bind(tele_id)
    .bind(name)
    .bind(phone)
    .bind(p.abha)
    .bind(order["payment"]["type"].as_str())
    .bind(slot.fee.as_ref().map(fees::Fee::total))
    .execute(&mut **tx)
    .await?;
    if let (true, Some(fee)) = (online, slot.fee) {
        let hold = payment::Hold {
            txn_id: txn.id,
            appointment_id: appointment.id,
            fee,
            name,
            phone,
        };
        payment::hold(tx, sub.tenant_id, &hold, &mut order).await?;
        return Ok(None);
    }
    order["state"] = json!(STATE_CONFIRMED);
    if physical {
        return confirm_visit(tx, sub, (txn, &slot, body), order).await;
    }
    set_state(tx, txn.id, "confirmed", &order).await?;
    Ok(Some(Reply::message(json!({ "order": order }))))
}

/// A booked visit's `on_confirm`: the agreed terms, the slot, messaging and
/// helpline tags, and the PIN. The stored order has no token; only the answer
/// to the app carries it.
async fn confirm_visit(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    (txn, slot, body): (&Txn, &Slot, &Value),
    mut order: Value,
) -> Result<Option<Reply>, AppError> {
    let given = body.pointer("/message/order/terms").cloned();
    order["terms"] = given.unwrap_or_else(|| consultation::terms(slot));
    let helpline = consultation::helpline(tx, sub.tenant_id, sub.facility_id).await?;
    order["fulfillment"]["tags"] = consultation::confirm_tags(slot, helpline.as_deref());
    order["authorization"] = consultation::authorization(None, slot.date);
    set_state(tx, txn.id, "confirmed", &order).await?;
    let pin = consultation::issue_pin(tx, txn.id).await?;
    order["authorization"] = consultation::authorization(Some(&pin), slot.date);
    Ok(Some(Reply::message(json!({ "order": order }))))
}

/// The patient whose verified ABHA address this is, and whether they are
/// recorded as deceased.
pub(super) async fn patient_by_abha(
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
        if moved.rows_affected() == 0 && !matches!(txn.state.as_str(), "cancelled" | "expired") {
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
    if let Some(paying) = txn.payment_transaction_id {
        payment::release(tx, paying).await?;
    }
    order["state"] = json!(STATE_CANCELLED);
    set_state(tx, txn.id, "cancelled", &order).await?;
    Ok(Reply::message(json!({ "order": order })))
}

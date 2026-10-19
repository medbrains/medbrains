//! Blood availability and ambulances over UHI.
//!
//! Search answers from real stock: blood units by group and component that
//! are released and in date (counts only — no donor, no bag number), and
//! ambulances standing available by type. Mortuary vans are not offered.
//!
//! A confirmed order is a *request*, held `pending` until staff accept or
//! decline it on the UHI requests screen:
//! - an ambulance is sent by a dispatcher who knows where the fleet is;
//!   accepting creates the trip in the ambulance module.
//! - blood is never issued on a remote order. Issue follows a cross-match
//!   on the patient's own sample at the bank (D&C Rules, Part XII-B), and
//!   reserving scarce units against an unverified request would lock them
//!   away from patients here. Accepting tells the patient the bank can help
//!   and to bring the sample and requisition; nothing is reserved.

use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    inbound::{Reply, Txn, set_state},
    protocol::{Context, STATE_CANCELLED, STATE_PENDING, Service},
    settings::Subscription,
    teleconsult::current,
};
use crate::error::AppError;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Blood groups as UHI's blood-bank example names them (`O+Ve`).
const GROUPS: [(&str, &str); 8] = [
    ("a_positive", "A+Ve"),
    ("a_negative", "A-Ve"),
    ("b_positive", "B+Ve"),
    ("b_negative", "B-Ve"),
    ("ab_positive", "AB+Ve"),
    ("ab_negative", "AB-Ve"),
    ("o_positive", "O+Ve"),
    ("o_negative", "O-Ve"),
];
/// Components — names **inferred** (NHA's mock uses e-RaktKosh codes it does
/// not define); the code is ours.
const COMPONENTS: [(&str, &str); 6] = [
    ("whole_blood", "WholeBlood"),
    ("prbc", "Packed red blood cells"),
    ("ffp", "Fresh frozen plasma"),
    ("platelets", "Platelets"),
    ("cryoprecipitate", "Cryoprecipitate"),
    ("granulocytes", "Granulocytes"),
];
const AMBULANCES: [(&str, &str); 4] = [
    ("bls", "Basic life support ambulance"),
    ("als", "Advanced life support ambulance"),
    ("patient_transport", "Patient transport ambulance"),
    ("neonatal", "Neonatal ambulance"),
];

fn label<'a>(table: &[(&'a str, &'a str)], code: &str) -> Option<&'a str> {
    table.iter().find(|(c, _)| *c == code).map(|(_, l)| *l)
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
    let Some(service) = Service::from_code(&txn.service) else {
        return Ok(None);
    };
    match ctx.action.as_str() {
        "search" => search(tx, sub, service, body).await,
        "select" | "init" => Ok(Some(quote(sub, ctx, body))),
        "confirm" => confirm(tx, sub, service, body, txn).await.map(Some),
        "cancel" => cancel(tx, txn).await.map(Some),
        "status" | "update" => Ok(Some(current(txn))),
        _ => Ok(None),
    }
}

async fn search(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    service: Service,
    body: &Value,
) -> Result<Option<Reply>, AppError> {
    let wanted = body
        .pointer("/message/intent/item/descriptor/name")
        .and_then(Value::as_str)
        .map(str::trim);
    let items: Vec<Value> = if service == Service::BloodBank {
        let rows = sqlx::query_as::<_, (String, String, i64)>(
            "SELECT blood_group::text, component_type::text, count(*) FROM blood_components \
              WHERE tenant_id = $1 AND status = 'available' AND expiry_at > now() \
                AND deleted_at IS NULL \
              GROUP BY 1, 2 ORDER BY 1, 2",
        )
        .bind(sub.tenant_id)
        .fetch_all(&mut **tx)
        .await?;
        rows.into_iter()
            .filter_map(|(group, component, count)| {
                let name = label(&GROUPS, &group)?;
                let category = label(&COMPONENTS, &component)?;
                wanted
                    .is_none_or(|w| w.eq_ignore_ascii_case(name))
                    .then(|| {
                        json!({ "id": format!("{component}:{group}"),
                            "descriptor": { "name": name, "code": group },
                            "quantity": { "count": count, "measure": { "unit": "Units" } },
                            "category_id": component, "fulfillment_id": "available",
                            "tags": { "component": category } })
                    })
            })
            .collect()
    } else {
        sqlx::query_as::<_, (String, i64)>(
            "SELECT ambulance_type::text, count(*) FROM ambulances \
              WHERE tenant_id = $1 AND status = 'available' AND deleted_at IS NULL \
                AND ambulance_type <> 'mortuary' \
              GROUP BY 1 ORDER BY 1",
        )
        .bind(sub.tenant_id)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .filter_map(|(kind, count)| {
            let name = label(&AMBULANCES, &kind)?;
            Some(
                json!({ "id": kind, "descriptor": { "name": name, "code": kind },
                         "quantity": { "count": count }, "fulfillment_id": "available" }),
            )
        })
        .collect()
    };
    if items.is_empty() {
        return Ok(None);
    }
    let categories: Vec<Value> = if service == Service::BloodBank {
        COMPONENTS
            .iter()
            .map(|(code, name)| json!({ "id": code, "descriptor": { "name": name, "code": code } }))
            .collect()
    } else {
        Vec::new()
    };
    Ok(Some(Reply::message(json!({ "catalog": {
        "descriptor": { "name": sub.provider_name },
        "providers": [{
            "id": sub.provider_id(),
            "descriptor": { "name": sub.provider_name },
            "categories": categories,
            "fulfillments": [{ "id": "available", "type": "Available" }],
            "items": items,
        }],
    }}))))
}

/// The order as asked, with us as provider; the price is set by the
/// hospital when it accepts.
fn quote(sub: &Subscription, ctx: &Context, body: &Value) -> Reply {
    let mut order = body
        .pointer("/message/order")
        .cloned()
        .unwrap_or_else(|| json!({}));
    order["provider"] = json!({ "id": sub.provider_id() });
    // No price yet — never ₹0: the hospital prices it when it accepts.
    order["quote"] = json!({ "price": { "currency": "INR" } });
    if ctx.action == "init" {
        order["payment"] = json!({ "type": "ON-FULFILLMENT", "status": "NOT-PAID" });
    }
    Reply::message(json!({ "order": order }))
}

fn text<'a>(v: &'a Value, pointer: &str) -> Option<&'a str> {
    v.pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// Where the ambulance is to go: `fulfillment.start.location.address`, as
/// text or as Beckn's address object.
pub fn pickup_address(order: &Value) -> Option<String> {
    let address = order.pointer("/fulfillment/start/location/address")?;
    if let Some(s) = address.as_str() {
        return Some(s.trim().to_owned()).filter(|s| !s.is_empty());
    }
    let parts: Vec<&str> = [
        "door",
        "name",
        "building",
        "street",
        "locality",
        "city",
        "state",
        "area_code",
    ]
    .iter()
    .filter_map(|k| address.get(*k).and_then(Value::as_str))
    .filter(|s| !s.trim().is_empty())
    .collect();
    (!parts.is_empty()).then(|| parts.join(", "))
}

async fn confirm(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    service: Service,
    body: &Value,
    txn: &Txn,
) -> Result<Reply, AppError> {
    if txn.order_details.is_some() {
        return Ok(current(txn));
    }
    let given = body.pointer("/message/order").unwrap_or(&Value::Null);
    let o = "/message/order";
    let name = text(body, &format!("{o}/billing/name"))
        .or_else(|| text(body, &format!("{o}/customer/person/name")));
    let phone = text(body, &format!("{o}/billing/phone"))
        .or_else(|| text(body, &format!("{o}/customer/contact/phone")));
    let (Some(name), Some(phone)) = (name, phone) else {
        return Ok(Reply::failed("the patient's name and phone are needed"));
    };
    if service == Service::Ambulance && pickup_address(given).is_none() {
        return Ok(Reply::failed("the pickup address is needed"));
    }
    let mut order = given.clone();
    order["id"] = json!(txn.id);
    order["state"] = json!(STATE_PENDING);
    order["provider"] = json!({ "id": sub.provider_id() });
    sqlx::query(
        "UPDATE uhi_transactions SET customer_name = $2, customer_phone = $3, customer_abha = $4 \
          WHERE id = $1",
    )
    .bind(txn.id)
    .bind(name)
    .bind(phone)
    .bind(text(body, &format!("{o}/customer/id")))
    .execute(&mut **tx)
    .await?;
    set_state(tx, txn.id, "pending", &order).await?;
    Ok(Reply::message(json!({ "order": order })))
}

async fn cancel(tx: &mut Tx<'_>, txn: &Txn) -> Result<Reply, AppError> {
    let Some(mut order) = txn.order_details.clone() else {
        return Ok(Reply::failed(
            "no order has been confirmed in this transaction",
        ));
    };
    let trip: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT t.id, t.status::text FROM uhi_transactions u \
           JOIN ambulance_trips t ON t.id = u.ambulance_trip_id WHERE u.id = $1",
    )
    .bind(txn.id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some((trip_id, status)) = trip {
        if status != "requested" && status != "cancelled" {
            return Ok(Reply::failed(
                "the ambulance is already on its way — call the hospital to stop it",
            ));
        }
        sqlx::query(
            "UPDATE ambulance_trips SET status = 'cancelled', cancelled_at = now(), \
                    cancellation_reason = 'Cancelled by the patient through UHI' \
              WHERE id = $1 AND status = 'requested'",
        )
        .bind(trip_id)
        .execute(&mut **tx)
        .await?;
    }
    order["state"] = json!(STATE_CANCELLED);
    set_state(tx, txn.id, "cancelled", &order).await?;
    Ok(Reply::message(json!({ "order": order })))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::pickup_address;
    use serde_json::json;

    #[test]
    fn the_pickup_address_reads_as_text_or_object() {
        let text =
            json!({ "fulfillment": { "start": { "location": { "address": " 12 MG Road " } } } });
        assert_eq!(pickup_address(&text).as_deref(), Some("12 MG Road"));
        let object = json!({ "fulfillment": { "start": { "location": { "address":
            { "door": "12", "street": "MG Road", "city": "Bengaluru", "area_code": "560001" } } } } });
        assert_eq!(
            pickup_address(&object).as_deref(),
            Some("12, MG Road, Bengaluru, 560001")
        );
        assert_eq!(pickup_address(&json!({})), None);
    }
}

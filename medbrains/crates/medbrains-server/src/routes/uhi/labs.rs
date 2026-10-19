//! Lab tests over UHI.
//!
//! Search answers from the lab catalogue — only the tests the lab has marked
//! orderable by patients (`lab_test_catalog.is_patient_orderable`, set on the
//! lab catalogue screen), with their prices. A confirmed order is a
//! *request* — a home collection or a walk-in at the lab — held `pending`
//! until lab staff accept or decline it on the UHI requests screen, as for
//! an ambulance. Accepting places the real lab orders through the lab's own
//! walk-in path (self-referred, billed as every walk-in is) and books the
//! home collection. No clinical order exists until a person accepts.
//!
//! The wire shapes are **inferred**: NHA publishes no lab-test UHI flow.
//! Items are tests (`id` = our test ID); the fulfilment type is
//! `HomeCollection` or `WalkIn`; the address rides where an ambulance's
//! pickup does, the preferred time in `fulfillment.start.time.timestamp`.

use medbrains_core::permissions;
use medbrains_lab::direct::{DirectOrderRequest, Referral, place_direct_orders};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    fees::{Fee, item_price, money},
    inbound::{Reply, Txn, set_state},
    protocol::{
        FULFILMENT_HOME_COLLECTION, FULFILMENT_WALK_IN, PAYMENT_NOT_PAID, PAYMENT_ON_FULFILMENT,
        STATE_CANCELLED, STATE_PENDING,
    },
    requests::pickup_address,
    settings::Subscription,
    slots::{now_local, parse_timestamp},
    teleconsult::{current, patient_by_abha, text},
};
use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    routes::appointments::{Caller, find_or_register},
};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// The most tests one search answers with.
const MAX_RESULTS: i64 = 50;
/// The most tests one request may ask for (the walk-in path's own cap).
const MAX_ORDER_TESTS: usize = 30;
const HISTORY: &str = "Requested by the patient from a patient app (UHI)";

#[derive(Debug, sqlx::FromRow)]
struct Test {
    id: Uuid,
    code: String,
    name: String,
    price: Decimal,
    sample_type: Option<String>,
    fasting_required: bool,
}

impl Test {
    /// The test's price; `None` when the catalogue has none (priced at the
    /// lab). Lab tests carry no GST, as the lab bills them.
    fn fee(&self) -> Option<Fee> {
        (self.price > Decimal::ZERO).then_some(Fee {
            amount: self.price,
            tax_percent: Decimal::ZERO,
        })
    }

    fn item(&self) -> Value {
        json!({ "id": self.id, "descriptor": { "name": self.name, "code": self.code },
            "price": item_price(self.fee().as_ref()),
            "tags": { "sample_type": self.sample_type, "fasting_required": self.fasting_required } })
    }
}

const TEST_COLUMNS: &str = "id, code, name, price, sample_type, fasting_required";

/// # Errors
/// A database fault.
pub async fn answer(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    ctx: &super::protocol::Context,
    body: &Value,
    txn: &Txn,
) -> Result<Option<Reply>, AppError> {
    match ctx.action.as_str() {
        "search" => search(tx, sub, body).await,
        "select" | "init" => quote(tx, sub, body).await.map(|(r, _)| Some(r)),
        "confirm" => confirm(tx, sub, body, txn).await.map(Some),
        "cancel" => cancel(tx, txn).await.map(Some),
        "status" | "update" => Ok(Some(current(txn))),
        _ => Ok(None),
    }
}

fn fulfillments() -> Value {
    json!([{ "id": "home", "type": FULFILMENT_HOME_COLLECTION },
           { "id": "walk-in", "type": FULFILMENT_WALK_IN }])
}

async fn search(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    body: &Value,
) -> Result<Option<Reply>, AppError> {
    let wanted = text(body, "/message/intent/item/descriptor/name");
    let tests = sqlx::query_as::<_, Test>(&format!(
        "SELECT {TEST_COLUMNS} FROM lab_test_catalog \
          WHERE tenant_id = $1 AND is_patient_orderable AND is_active AND deleted_at IS NULL \
            AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR code ILIKE $2 \
                 OR lower($2) = ANY(SELECT lower(s) FROM unnest(synonyms) s)) \
          ORDER BY name LIMIT $3"
    ))
    .bind(sub.tenant_id)
    .bind(wanted)
    .bind(MAX_RESULTS)
    .fetch_all(&mut **tx)
    .await?;
    if tests.is_empty() {
        return Ok(None);
    }
    Ok(Some(Reply::message(json!({ "catalog": {
        "descriptor": { "name": sub.provider_name },
        "providers": [{
            "id": sub.provider_id(),
            "descriptor": { "name": sub.provider_name },
            "fulfillments": fulfillments(),
            "items": tests.iter().map(Test::item).collect::<Vec<_>>(),
        }],
    }}))))
}

/// The tests an order names, priced from the catalogue — `None` when one is
/// unknown or not orderable by patients.
async fn ordered(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    body: &Value,
) -> Result<Option<Vec<Test>>, AppError> {
    let ids: Vec<Uuid> = body
        .pointer("/message/order/items")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|i| i["id"].as_str().and_then(|s| Uuid::parse_str(s).ok()))
                .collect()
        })
        .unwrap_or_default();
    if ids.is_empty() || ids.len() > MAX_ORDER_TESTS {
        return Ok(None);
    }
    let tests = sqlx::query_as::<_, Test>(&format!(
        "SELECT {TEST_COLUMNS} FROM lab_test_catalog \
          WHERE tenant_id = $1 AND id = ANY($2) AND is_patient_orderable AND is_active \
            AND deleted_at IS NULL ORDER BY name"
    ))
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let distinct: std::collections::HashSet<Uuid> = ids.into_iter().collect();
    Ok((tests.len() == distinct.len()).then_some(tests))
}

/// The order with its tests and their prices; `None` total when a test has
/// no price (it is priced at the lab).
async fn quote(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    body: &Value,
) -> Result<(Reply, Option<Decimal>), AppError> {
    let Some(tests) = ordered(tx, sub.tenant_id, body).await? else {
        return Ok((
            Reply::failed("a test asked for is not offered to patient apps"),
            None,
        ));
    };
    let priced = tests.iter().all(|t| t.price > Decimal::ZERO);
    let total: Decimal = tests.iter().map(|t| t.price).sum();
    let mut order = body
        .pointer("/message/order")
        .cloned()
        .unwrap_or_else(|| json!({}));
    order["provider"] = json!({ "id": sub.provider_id() });
    order["items"] = json!(tests.iter().map(Test::item).collect::<Vec<_>>());
    let breakup: Vec<Value> = tests
        .iter()
        .map(|t| json!({ "title": t.name, "price": item_price(t.fee().as_ref()) }))
        .collect();
    let mut price = json!({ "currency": "INR" });
    let mut params = json!({ "currency": "INR" });
    if priced {
        price["value"] = json!(money(total));
        params["amount"] = json!(money(total));
    }
    order["quote"] = json!({ "price": price, "breakup": breakup });
    // Paid at the lab: at the counter, or to the phlebotomist on collection.
    order["payment"] =
        json!({ "type": PAYMENT_ON_FULFILMENT, "status": PAYMENT_NOT_PAID, "params": params });
    Ok((
        Reply::message(json!({ "order": order })),
        priced.then_some(total),
    ))
}

/// Whether the order is for a home collection.
pub fn is_home(order: &Value) -> bool {
    order.pointer("/fulfillment/type").and_then(Value::as_str) == Some(FULFILMENT_HOME_COLLECTION)
}

async fn confirm(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    body: &Value,
    txn: &Txn,
) -> Result<Reply, AppError> {
    if txn.order_details.is_some() {
        return Ok(current(txn));
    }
    let o = "/message/order";
    let name = text(body, &format!("{o}/billing/name"))
        .or_else(|| text(body, &format!("{o}/customer/person/name")));
    let phone = text(body, &format!("{o}/billing/phone"))
        .or_else(|| text(body, &format!("{o}/customer/contact/phone")));
    let (Some(name), Some(phone)) = (name, phone) else {
        return Ok(Reply::failed("the patient's name and phone are needed"));
    };
    let given = body.pointer(o).unwrap_or(&Value::Null);
    if is_home(given) && pickup_address(given).is_none() {
        return Ok(Reply::failed(
            "the address for the home collection is needed",
        ));
    }
    let (reply, amount) = quote(tx, sub, body).await?;
    if reply.error.is_some() {
        return Ok(reply);
    }
    let mut order = reply.message["order"].clone();
    order["id"] = json!(txn.id);
    order["state"] = json!(STATE_PENDING);
    sqlx::query(
        "UPDATE uhi_transactions SET customer_name = $2, customer_phone = $3, \
                customer_abha = $4, payment_type = $5, payment_status = 'NOT-PAID', \
                amount = $6 WHERE id = $1",
    )
    .bind(txn.id)
    .bind(name)
    .bind(phone)
    .bind(text(body, &format!("{o}/customer/id")))
    .bind(PAYMENT_ON_FULFILMENT)
    .bind(amount)
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
    if txn.state == "confirmed" {
        return Ok(Reply::failed(
            "the lab has already booked the tests — call the lab to cancel",
        ));
    }
    order["state"] = json!(STATE_CANCELLED);
    set_state(tx, txn.id, "cancelled", &order).await?;
    Ok(Reply::message(json!({ "order": order })))
}

/// "CBC, Lipid profile · home collection: 12 MG Road"
pub fn summary(order: &Value) -> String {
    let tests: Vec<&str> = order["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|i| i.pointer("/descriptor/name").and_then(Value::as_str))
                .collect()
        })
        .unwrap_or_default();
    let how = if is_home(order) {
        format!(
            "home collection: {}",
            pickup_address(order).unwrap_or_else(|| "address not given".to_owned())
        )
    } else {
        "at the lab".to_owned()
    };
    format!("{} · {how}", tests.join(", "))
}

/// What the patient is told once the lab accepts.
pub fn instructions(order: &Value) -> &'static str {
    if is_home(order) {
        "The lab will call to confirm the collection time. Pay the phlebotomist on collection."
    } else {
        "Come to the lab counter with this booking; payment is taken there."
    }
}

/// A pending lab request, as staff accept it.
#[derive(Debug, Clone, Copy)]
pub struct Request<'a> {
    pub id: Uuid,
    pub order: &'a Value,
    pub name: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub abha: Option<&'a str>,
}

/// Accept a lab request: the patient (by ABHA address, else phone and first
/// name, else registered), the walk-in lab orders, and the home collection.
/// Returns the orders placed; the caller grants access to them once it
/// commits.
///
/// # Errors
/// 403 without `lab.orders.direct` (and `lab.samples.manage` for a home
/// collection); 409 for a patient recorded as deceased; 400 when a test is
/// no longer in the catalogue.
pub async fn accept(
    tx: &mut Tx<'_>,
    claims: &Claims,
    request: Request<'_>,
) -> Result<Vec<Uuid>, AppError> {
    require_permission(claims, permissions::lab::orders::DIRECT)?;
    let home = is_home(request.order);
    if home {
        require_permission(claims, permissions::lab::samples::MANAGE)?;
    }
    let test_ids: Vec<Uuid> = request.order["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|i| i["id"].as_str().and_then(|s| Uuid::parse_str(s).ok()))
                .collect()
        })
        .unwrap_or_default();
    let patient_id = patient(tx, claims.tenant_id, &request).await?;
    let placed = place_direct_orders(
        tx,
        claims,
        &DirectOrderRequest {
            patient_id,
            test_ids,
            priority: None,
            clinical_history: Some(HISTORY.to_owned()),
            referral: Referral::SelfReferred,
        },
    )
    .await?;
    let order_ids: Vec<Uuid> = placed.orders.iter().map(|o| o.id).collect();
    if home {
        book_collection(tx, claims.tenant_id, patient_id, &order_ids, &request).await?;
    }
    sqlx::query("UPDATE uhi_transactions SET lab_order_ids = $2 WHERE id = $1")
        .bind(request.id)
        .bind(&order_ids)
        .execute(&mut **tx)
        .await?;
    Ok(order_ids)
}

async fn patient(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    request: &Request<'_>,
) -> Result<Uuid, AppError> {
    if let Some(abha) = request.abha {
        match patient_by_abha(tx, tenant_id, abha).await? {
            Some((_, true)) => {
                return Err(AppError::Conflict(
                    "this patient is recorded as deceased — decline the request".to_owned(),
                ));
            }
            Some((id, false)) => return Ok(id),
            None => {}
        }
    }
    let (Some(name), Some(phone)) = (request.name, request.phone) else {
        return Err(AppError::BadRequest(
            "the request has no patient name and phone".to_owned(),
        ));
    };
    let caller = Caller {
        name,
        phone,
        dob: None,
        registration_source: "mobile_app",
    };
    Ok(find_or_register(tx, tenant_id, &caller).await?.0)
}

/// One home collection per order, on the day the patient asked for (today
/// when that is gone or not given), at the address they gave.
async fn book_collection(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    order_ids: &[Uuid],
    request: &Request<'_>,
) -> Result<(), AppError> {
    let today = now_local().date();
    let asked = text(request.order, "/fulfillment/start/time/timestamp").and_then(parse_timestamp);
    let date = asked.map_or(today, |at| at.date().max(today));
    let slot = asked.map(|at| at.format("%H:%M").to_string());
    let address = pickup_address(request.order).unwrap_or_default();
    sqlx::query(
        "INSERT INTO lab_home_collections (tenant_id, order_id, patient_id, scheduled_date, \
            scheduled_time_slot, address_line, contact_phone, special_instructions) \
         SELECT $1, o, $2, $3, $4, $5, $6, 'Booked by the patient through UHI' \
           FROM unnest($7::uuid[]) o",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(date)
    .bind(slot)
    .bind(&address)
    .bind(request.phone)
    .bind(order_ids)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{instructions, summary};
    use serde_json::json;

    #[test]
    fn the_summary_names_the_tests_and_where_the_sample_is_taken() {
        let home = json!({ "items": [{ "descriptor": { "name": "CBC" } },
                                     { "descriptor": { "name": "HbA1c" } }],
            "fulfillment": { "type": "HomeCollection",
                             "start": { "location": { "address": "12 MG Road" } } } });
        assert_eq!(summary(&home), "CBC, HbA1c · home collection: 12 MG Road");
        assert!(instructions(&home).contains("phlebotomist"));
        let walk_in = json!({ "items": [{ "descriptor": { "name": "TSH" } }],
                              "fulfillment": { "type": "WalkIn" } });
        assert_eq!(summary(&walk_in), "TSH · at the lab");
    }
}

//! Consultation search, in two stages (NHA's consultation docs).
//!
//! A search the gateway fans out is answered with the doctors who have open slots,
//! one fulfilment each, named by their HPR ID; the app's direct search for
//! one of them is answered with that doctor's open slots, each named by its
//! stable UUID (`slot_ids::assign_ids`).

use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    inbound::Reply,
    settings::Subscription,
    slot_ids,
    slots::{self, Filter, Slot},
    teleconsult::text,
};
use crate::error::AppError;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

const TAG_SPECIALITY: &str = "@abdm~1gov.in~1speciality";

/// What a search intent narrows to. The speciality comes from the
/// category (NHA's app sends `intent.category.descriptor.name`) or the
/// doctor's speciality tag — both verified in NHA's code; a category ID is
/// one of our own departments, as our catalogue names them.
///
/// The direct search names the doctor in `provider.fulfillments[0]` (NHA's
/// app) or `fulfillment`; their agent id is the HPR ID this hospital listed.
fn filter(intent: &Value, physical: bool) -> Filter {
    let f = |p: &str| {
        text(intent, &format!("/fulfillment{p}"))
            .or_else(|| text(intent, &format!("/provider/fulfillments/0{p}")))
    };
    Filter {
        from: f("/start/time/timestamp").and_then(slots::parse_timestamp),
        to: f("/end/time/timestamp").and_then(slots::parse_timestamp),
        doctor_name: f("/agent/name").map(str::to_owned),
        hpr_id: f("/agent/tags/@abdm~1gov.in~1hpr_id")
            .or_else(|| f("/agent/id"))
            .map(str::to_owned),
        doctor_id: None,
        holder: None,
        physical,
        speciality: text(intent, "/category/descriptor/name")
            .or_else(|| text(intent, "/category/descriptor/code"))
            .or_else(|| text(intent, &format!("/fulfillment/agent/tags/{TAG_SPECIALITY}")))
            .map(str::to_owned),
        department_id: text(intent, "/category/id").and_then(|id| Uuid::parse_str(id).ok()),
    }
}

/// Two-stage search: through the gateway, the doctors with open slots;
/// asked directly, the open slots themselves, each given its UUID.
/// # Errors
/// A database fault.
pub(super) async fn search(
    tx: &mut Tx<'_>,
    sub: &Subscription,
    body: &Value,
    physical: bool,
    from_gateway: bool,
) -> Result<Option<Reply>, AppError> {
    let intent = body.pointer("/message/intent").unwrap_or(&Value::Null);
    let filter = filter(intent, physical);
    let mut open = slots::open_slots(tx, sub.tenant_id, &filter).await?;
    if open.is_empty() {
        return Ok(None);
    }
    let catalog = if from_gateway {
        let doctors: Vec<Slot> = slots::first_per_doctor(&open)
            .into_iter()
            .cloned()
            .collect();
        catalog(sub, &doctors, Slot::doctor_fulfillment, |s| {
            let mut item = s.item();
            item["id"] = json!(s.hpr_id);
            item["fulfillment_id"] = json!(s.hpr_id);
            item
        })
    } else {
        slot_ids::assign_ids(tx, sub.tenant_id, &mut open).await?;
        catalog(sub, &open, Slot::fulfillment, Slot::item)
    };
    Ok(Some(Reply::message(json!({ "catalog": catalog }))))
}

/// The catalogue of `open`, each entry drawn by `fulfillment` and `item`.
fn catalog(
    sub: &Subscription,
    open: &[Slot],
    fulfillment: impl Fn(&Slot) -> Value,
    item: impl Fn(&Slot) -> Value,
) -> Value {
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
            "fulfillments": open.iter().map(fulfillment).collect::<Vec<_>>(),
            "items": open.iter().map(item).collect::<Vec<_>>(),
        }],
    })
}

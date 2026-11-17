//! Discharge take-home medicines: bagging them into a pharmacy order when
//! the `rx_dispensed` step is stamped, and refusing the step when that fails
//! (#5953). Split from `lib.rs` to keep it inside its size budget.

// The workspace denies `unreachable_pub`, which wants these `pub(crate)`;
// clippy's nursery `redundant_pub_crate` asks for the opposite.
#![allow(clippy::redundant_pub_crate)]

use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

/// Bags the discharge medicines and hands the order to the pharmacy, the way
/// an order raised at its counter is, so its staff can open it. Routing runs
/// before the step commits: a routing failure after commit would leave the
/// step done and the order unreachable with nothing left to retry. Here it
/// refuses the step like any other failure, and a retry repeats both (the
/// hand-off is idempotent; an existing order is routed again, which also
/// heals one bagged before routing existed).
pub(crate) async fn bag_and_route(
    state: &AppState,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    admission_id: Uuid,
) -> Result<(), AppError> {
    if let Some(order_id) = autobag_discharge_meds(tx, claims, admission_id).await? {
        medbrains_pharmacy::hand_order_to_pharmacy(state, claims, order_id).await?;
    }
    Ok(())
}

/// Sorts an autobag error into its kind, for the log (never the message,
/// which can name a drug), and the reason staff can act on, or `None` for a
/// fault. `NotFound` (the visit on the summary is gone) is a refusal: as a
/// bare 404 on the step the nurse would read the admission as missing.
fn classify_bag_error(err: &AppError) -> (&'static str, Option<String>) {
    match err {
        AppError::BadRequest(m) => ("bad_request", Some(m.clone())),
        AppError::Conflict(m) => ("conflict", Some(m.clone())),
        AppError::ForbiddenReason(m) => ("forbidden", Some(m.clone())),
        AppError::NotFound => (
            "not_found",
            Some("A record the order needs, such as the visit, was not found.".to_owned()),
        ),
        AppError::Database(_) => ("database", None),
        _ => ("other", None),
    }
}

/// The answer when the take-home medicines could not become a pharmacy
/// order (#5953). The step is refused, not stamped: "meds dispensed" ticked
/// with no order behind it is how a patient went home without them. The
/// request's transaction is already dropped, so no half-made order stays.
/// The failure is logged by id and the pharmacy is told through its inbox;
/// the nurse gets the reason and whether pharmacy was reached.
pub(crate) async fn refuse_unbagged_step(
    state: &AppState,
    claims: &Claims,
    admission_id: Uuid,
    err: AppError,
) -> AppError {
    let (kind, refusal) = classify_bag_error(&err);
    tracing::error!(
        tenant_id = %claims.tenant_id,
        admission_id = %admission_id,
        user_id = %claims.sub,
        error_kind = kind,
        "discharge medicines could not become a pharmacy order; rx_dispensed refused"
    );
    let reason = refusal
        .clone()
        .unwrap_or_else(|| "The system could not create the order.".to_owned());
    let told = match tell_pharmacy_unbagged(state, claims, admission_id, &reason).await {
        Ok(told) => told,
        Err(notify_err) => {
            tracing::error!(
                tenant_id = %claims.tenant_id,
                admission_id = %admission_id,
                error_kind = classify_bag_error(&notify_err).0,
                "could not notify pharmacy of a discharge order that was not made"
            );
            0
        }
    };
    // Administrators always hold the permission, so `told` can count only
    // them: say who, not "pharmacy staff".
    let who = if told > 0 {
        format!(
            "Notified {told} of the staff who can raise pharmacy orders (administrators included)."
        )
    } else {
        "Nobody who can raise pharmacy orders could be notified: call the pharmacy.".to_owned()
    };
    let message = format!(
        "No pharmacy order was made for the take-home medicines, so this step is not marked. \
         {reason} {who}"
    );
    // A fault stays a fault (500), never dressed up as a refusal.
    if refusal.is_some() {
        AppError::Conflict(message)
    } else {
        err
    }
}

/// Puts the unbagged discharge in the inbox of everyone who can raise a
/// pharmacy order, in its own transaction since the request's rolled back.
/// Returns how many were told.
async fn tell_pharmacy_unbagged(
    state: &AppState,
    claims: &Claims,
    admission_id: Uuid,
    reason: &str,
) -> Result<usize, AppError> {
    let mut tx =
        medbrains_kernel::begin(&state.db, medbrains_kernel::Actor::from_claims(claims)).await?;
    let told = medbrains_notifications::notify_permission_holders(
        &mut tx,
        claims.tenant_id,
        permissions::pharmacy::dispensing::CREATE,
        claims.sub,
        |user_id| medbrains_notifications::NewNotification {
            user_id,
            kind: "warning",
            title: "Discharge medicines have no pharmacy order",
            body: Some(reason),
            category: Some("Pharmacy"),
            entity_type: Some("admission"),
            entity_id: Some(admission_id),
            action_url: Some("/pharmacy"),
        },
    )
    .await?;
    tx.commit().await?;
    Ok(told)
}

#[derive(serde::Deserialize)]
struct DischargeMedItem {
    drug_name: Option<String>,
    catalog_item_id: Option<Uuid>,
    quantity: Option<i32>,
    unit_price: Option<rust_decimal::Decimal>,
    #[serde(default)]
    buy_outside: bool,
}

/// Builds the discharge pharmacy order from the summary's medicines list.
/// `Ok(Some(order))` when it made one or one already exists for the
/// summary, `Ok(None)` when there was nothing to make (no summary, nothing
/// sold here).
async fn autobag_discharge_meds(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    admission_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let summary: Option<(Uuid, Option<Uuid>, serde_json::Value)> = sqlx::query_as(
        "SELECT ds.id, a.encounter_id, ds.medications_on_discharge \
         FROM ipd_discharge_summaries ds \
         JOIN admissions a ON a.id = ds.admission_id \
         WHERE ds.admission_id = $1 AND ds.tenant_id = $2 \
         ORDER BY ds.created_at DESC LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let Some((summary_id, encounter_id, meds_json)) = summary else {
        return Ok(None); // no discharge summary — nothing to bag
    };

    // Idempotency: skip if a discharge order already exists for this summary.
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM pharmacy_orders \
         WHERE discharge_summary_id = $1 AND tenant_id = $2 LIMIT 1",
    )
    .bind(summary_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if existing.is_some() {
        return Ok(existing); // routed again by the caller; the hand-off is idempotent
    }

    let items = order_items(meds_json)?;
    // Nothing to bag when nothing on the list is sold here.
    if !items.iter().any(|i| i.catalog_item_id.is_some()) {
        return Ok(None);
    }

    let req = medbrains_pharmacy::CreateOrderRequest {
        prescription_id: None,
        patient_id: claims.tenant_id, // overridden below from admission
        encounter_id,
        notes: Some("Auto-generated from discharge summary".to_owned()),
        items,
        dispensing_type: Some("discharge".to_owned()),
        discharge_summary_id: Some(summary_id),
        billing_package_id: None,
        store_location_id: None,
        safety_override_reason: None,
        allergy_override_reason: None,
        is_dummy: None,
    };

    // Resolve patient_id from the admission since we didn't carry it
    // through the summary join.
    let patient_id: Option<Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(admission_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut **tx)
            .await?;

    let Some(patient_id) = patient_id else {
        return Ok(None);
    };

    let req = medbrains_pharmacy::CreateOrderRequest { patient_id, ..req };

    let made = medbrains_pharmacy::create_order_in_tx(tx, claims, &req).await?;
    Ok(Some(made.order.id))
}

/// Reads the summary's medicines list into order lines. A medicine bought
/// outside, or typed without a catalogue item, carries no price.
fn order_items(
    meds_json: serde_json::Value,
) -> Result<Vec<medbrains_pharmacy::OrderItemInput>, AppError> {
    // An unreadable list is a failure, not "nothing to bag": reading it as
    // empty sent patients home with no order and no word (#5953).
    let meds: Vec<DischargeMedItem> = if meds_json.is_null() {
        Vec::new()
    } else {
        serde_json::from_value(meds_json).map_err(|_| {
            AppError::BadRequest(
                "The medicines list on the discharge summary could not be read.".to_owned(),
            )
        })?
    };
    // A medicine bought outside goes on the bag's order as such: listed for
    // the counter, never dispensed, never priced. A typed line carries no
    // price either: nothing here sells it (owner, 2026-11-09).
    Ok(meds
        .into_iter()
        .filter_map(|m| {
            let sold_here = m.catalog_item_id.is_some() && !m.buy_outside;
            Some(medbrains_pharmacy::OrderItemInput {
                catalog_item_id: m.catalog_item_id.filter(|_| sold_here),
                drug_name: m.drug_name?,
                quantity: m.quantity.unwrap_or(1).max(1),
                unit_price: m
                    .unit_price
                    .filter(|_| sold_here)
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                buy_outside: m.buy_outside,
            })
        })
        .collect())
}

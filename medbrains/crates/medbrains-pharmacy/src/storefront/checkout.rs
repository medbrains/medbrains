//! Checkout: the cart becomes an order. Nothing needing a prescription goes
//! straight to fulfilment; anything that does waits for a pharmacist to
//! verify each line against the hospital prescription or the upload.
//! Schedule X, NDPS and controlled drugs never get this far. The order goes
//! to the store that can fill it and is held there (`hold_cart`) through
//! review; stock is checked again at release and moves only at dispense.
//! Delivery is offered as part 3 offers it, within the hospital's slots and
//! cash-on-delivery cap; a repeat of the same medicine too soon is held for
//! the pharmacist.

use medbrains_core::pharmacy_delivery::PAY_ON_DELIVERY;
use medbrains_core::pharmacy_storefront::{
    CartLine as RuleLine, Release, RxSource, SaleClass, checkout as rule_checkout,
};
use medbrains_pharmacy_delivery::choice::{
    DeliveryChoice, DeliveryOffer, check_choice_for_lines, offer_for_lines, record_choice,
};
use medbrains_pharmacy_delivery::source::Source;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::Deserialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::cart::{check_line, orderable, stored_lines};
use super::catalog::{ItemRow, rows_by_ids};
use super::hold_cart::{Ctx, StorePick, Target, hold, hold_lines};
use super::orders::{StoreOrderView, patient_order};
use super::settings::StoreSettings;

#[derive(Debug, Deserialize)]
pub struct CheckoutRequest {
    /// `none`, `hospital` or `upload`.
    pub prescription_source: String,
    /// With `hospital`: one of the patient's own prescriptions.
    pub prescription_id: Option<Uuid>,
    /// Home delivery; absent for pickup at the pharmacy.
    pub delivery: Option<DeliveryChoice>,
    /// For pickup: the pharmacy the patient chose; the nearest that has
    /// everything when absent.
    pub pickup_store_id: Option<Uuid>,
}

pub(super) struct Line {
    pub(super) id: Uuid,
    pub(super) row: ItemRow,
    pub(super) quantity: i32,
    /// A prescription line out of stock online: it goes to the pharmacist,
    /// unheld, for a doctor-approved substitute or the outside-pharmacy print.
    pub(super) short: bool,
}

/// The flag on an order with a prescription line out of stock.
pub(super) const OUT_OF_STOCK: &str = "out_of_stock";

/// The cart's lines with their catalogue rows, each still orderable and
/// within its limit. Over-the-counter lines must be in stock; a prescription
/// line out of stock may still be ordered (owner decision 4).
pub(super) async fn cart_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    cart: Uuid,
    settings: &StoreSettings,
) -> Result<Vec<Line>, AppError> {
    let stored = stored_lines(tx, tenant_id, cart).await?;
    let ids: Vec<Uuid> = stored.iter().map(|l| l.catalog_item_id).collect();
    let mut rows = rows_by_ids(tx, tenant_id, &ids, settings, Some(cart)).await?;
    stored
        .into_iter()
        .map(|l| {
            let row = rows.remove(&l.catalog_item_id).ok_or(AppError::NotFound)?;
            if !orderable(&row, l.via_prescription) {
                return Err(AppError::Conflict(format!(
                    "{} can't be ordered online: take it out of your cart",
                    row.name
                )));
            }
            check_line(&row, l.quantity, settings, l.prescribed_quantity)?;
            let short = row.available < l.quantity;
            if short && row.class() != SaleClass::Prescription {
                return Err(AppError::Conflict(format!(
                    "{} is out of stock for online orders",
                    row.name
                )));
            }
            Ok(Line {
                id: l.id,
                row,
                quantity: l.quantity,
                short,
            })
        })
        .collect()
}

fn rx_source(raw: &str) -> Result<RxSource, AppError> {
    match raw {
        "none" => Ok(RxSource::None),
        "hospital" => Ok(RxSource::Hospital),
        "upload" => Ok(RxSource::Upload),
        _ => Err(AppError::BadRequest(
            "Choose a prescription from this hospital, upload one, or none".to_owned(),
        )),
    }
}

/// A hospital prescription must be the patient's own, an outpatient one,
/// unexpired, and name every line that needs it.
async fn check_hospital_rx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    prescription_id: Uuid,
    needing: &[Uuid],
) -> Result<(), AppError> {
    let valid: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM prescriptions p \
           LEFT JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
          WHERE p.tenant_id = $1 AND p.id = $2 AND COALESCE(p.patient_id, e.patient_id) = $3 \
            AND p.deleted_at IS NULL AND p.admission_id IS NULL \
            AND (p.valid_until IS NULL OR p.valid_until >= CURRENT_DATE))",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if !valid {
        return Err(AppError::BadRequest(
            "Choose one of your own prescriptions that hasn't expired".to_owned(),
        ));
    }
    let missing: Vec<String> = sqlx::query_scalar(
        "SELECT c.name FROM pharmacy_catalog c \
          WHERE c.tenant_id = $1 AND c.id = ANY($3) \
            AND NOT EXISTS (SELECT 1 FROM prescription_items i \
                 WHERE i.tenant_id = $1 AND i.prescription_id = $2 AND i.item_status = 'active' \
                   AND (i.catalog_item_id = c.id \
                        OR lower(i.drug_name) IN (lower(c.name), lower(COALESCE(c.generic_name, '')), \
                                                  lower(COALESCE(c.inn_name, ''))))) \
          ORDER BY c.name",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .bind(needing)
    .fetch_all(&mut **tx)
    .await?;
    if missing.is_empty() {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "{} isn't on that prescription: upload the prescription for it",
            missing.join(", ")
        )))
    }
}

/// What delivery would be offered for the cart now (part 3's offer), less
/// cash on delivery above the hospital's cap.
pub async fn delivery_options(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<DeliveryOffer, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let lines = match super::cart_id(tx, tenant_id, patient_id).await? {
        Some(cart) => cart_lines(tx, tenant_id, cart, &settings).await?,
        None => Vec::new(),
    };
    let facts: Vec<_> = lines.iter().map(|l| l.row.line_facts()).collect();
    let mut offer = offer_for_lines(tx, tenant_id, patient_id, &facts).await?;
    let rules = super::rules::load(tx, tenant_id).await?;
    if !super::limits::cod_allowed(&rules, cart_total(&lines, &settings)) {
        offer.payments.retain(|p| *p != PAY_ON_DELIVERY);
        if offer.available && offer.payments.is_empty() {
            offer.available = false;
            offer.reason = Some(format!(
                "Cash on delivery is for orders up to ₹{}: collect this one at the pharmacy",
                rules.cod_max_amount
            ));
        }
    }
    Ok(offer)
}

/// Place the patient's cart as an order. Returns the order as they see it.
pub async fn checkout(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    request: &CheckoutRequest,
) -> Result<StoreOrderView, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let cart = super::cart_id(tx, tenant_id, patient_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Your cart is empty".to_owned()))?;
    let lines = cart_lines(tx, tenant_id, cart, &settings).await?;
    let mut rx = rx_source(&request.prescription_source)?;
    let rule_lines: Vec<RuleLine> = lines
        .iter()
        .map(|l| RuleLine {
            name: l.row.name.clone(),
            class: l.row.class(),
        })
        .collect();
    let release = rule_checkout(&rule_lines, rx).map_err(AppError::BadRequest)?;
    let needing: Vec<Uuid> = lines
        .iter()
        .filter(|l| l.row.class() == SaleClass::Prescription)
        .map(|l| l.row.id)
        .collect();
    if needing.is_empty() {
        rx = RxSource::None;
    }
    let prescription_id = match rx {
        RxSource::Hospital => {
            let id = request.prescription_id.ok_or_else(|| {
                AppError::BadRequest("Choose which of your prescriptions".to_owned())
            })?;
            check_hospital_rx(tx, tenant_id, patient_id, id, &needing).await?;
            Some(id)
        }
        _ => None,
    };
    if rx == RxSource::Upload {
        let uploaded: bool = sqlx::query_scalar(
            "SELECT rx_document_key IS NOT NULL FROM pharmacy_store_orders WHERE id = $1",
        )
        .bind(cart)
        .fetch_one(&mut **tx)
        .await?;
        if !uploaded {
            return Err(AppError::BadRequest(
                "Upload the prescription first".to_owned(),
            ));
        }
    }
    let rules = super::rules::load(tx, tenant_id).await?;
    if let Some(choice) = &request.delivery {
        super::limits::check_delivery(tx, tenant_id, &rules, choice, cart_total(&lines, &settings))
            .await?;
        let facts: Vec<_> = lines.iter().map(|l| l.row.line_facts()).collect();
        let checked = check_choice_for_lines(tx, tenant_id, patient_id, &facts, choice).await?;
        record_choice(tx, tenant_id, Source::Store(cart), &checked).await?;
    }
    let pick = StorePick {
        delivery_pincode: request.delivery.as_ref().and_then(|d| d.pincode.as_deref()),
        pickup_store: request.pickup_store_id,
    };
    let ctx = Ctx {
        settings: &settings,
        rules: &rules,
    };
    let store = hold(tx, tenant_id, cart, &lines, &ctx, &pick).await?;
    fix_prices(tx, tenant_id, &lines, &settings).await?;
    let ids: Vec<Uuid> = lines.iter().map(|l| l.row.id).collect();
    let mut flags =
        super::limits::repeat_flags(tx, tenant_id, patient_id, cart, &ids, &rules).await?;
    if lines.iter().any(|l| l.short) {
        flags.push(OUT_OF_STOCK.to_owned());
    }
    // Placed. Release moves it on at once when no pharmacist need read it.
    sqlx::query(
        "UPDATE pharmacy_store_orders \
            SET status = 'awaiting_verification', rx_source = $3, prescription_id = $4, \
                placed_at = now(), store_location_id = $5, flags = $6 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(cart)
    .bind(tenant_id)
    .bind(rx.as_str())
    .bind(prescription_id)
    .bind(store)
    .bind(&flags)
    .execute(&mut **tx)
    .await?;
    if release == Release::Now && flags.is_empty() {
        super::release::release(tx, tenant_id, cart, None).await?;
    } else {
        // Held through the pharmacist's review, on the hospital's review ladder.
        let target = Target {
            cart,
            store,
            kind: "review",
            lines: &lines,
        };
        hold_lines(tx, tenant_id, &target, &ctx).await?;
    }
    patient_order(tx, tenant_id, patient_id, cart).await
}

/// The cart's total at today's prices.
pub(super) fn cart_total(lines: &[Line], settings: &StoreSettings) -> Decimal {
    lines
        .iter()
        .filter_map(|l| l.row.price(settings).map(|p| p * Decimal::from(l.quantity)))
        .sum()
}

/// Fix each line's price as it stands now, and approve what needs no
/// pharmacist; prescription lines wait for their verdict.
async fn fix_prices(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    lines: &[Line],
    settings: &StoreSettings,
) -> Result<(), AppError> {
    let mut ids = Vec::with_capacity(lines.len());
    let mut prices: Vec<Decimal> = Vec::with_capacity(lines.len());
    let mut classes = Vec::with_capacity(lines.len());
    let mut statuses = Vec::with_capacity(lines.len());
    for l in lines {
        let price = l.row.price(settings).ok_or_else(|| {
            AppError::Conflict(format!("The pharmacy hasn't priced {} yet", l.row.name))
        })?;
        let class = l.row.class();
        ids.push(l.id);
        prices.push(price);
        classes.push(class.as_str());
        statuses.push(if class == SaleClass::Prescription {
            "pending"
        } else {
            "approved"
        });
    }
    sqlx::query(
        "UPDATE pharmacy_store_order_lines l \
            SET unit_price = v.price, sale_class = v.class, status = v.status \
           FROM unnest($2::uuid[], $3::numeric[], $4::text[], $5::text[]) \
                AS v(id, price, class, status) \
          WHERE l.id = v.id AND l.tenant_id = $1",
    )
    .bind(tenant_id)
    .bind(&ids)
    .bind(&prices)
    .bind(&classes)
    .bind(&statuses)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

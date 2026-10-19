//! Checkout: the cart becomes an order. Nothing needing a prescription goes
//! straight to fulfilment; anything that does waits for a pharmacist to
//! verify each line against the hospital prescription or the upload.
//! Schedule X, NDPS and controlled drugs never get this far. Stock is
//! checked here and again at release, and moves only at dispense. Delivery
//! is offered exactly as part 3 offers it.

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
}

struct Line {
    id: Uuid,
    row: ItemRow,
}

/// The cart's lines with their catalogue rows, each still orderable, within
/// its limit and in stock online.
async fn cart_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    cart: Uuid,
    settings: &StoreSettings,
) -> Result<Vec<Line>, AppError> {
    let stored = stored_lines(tx, tenant_id, cart).await?;
    let ids: Vec<Uuid> = stored.iter().map(|l| l.catalog_item_id).collect();
    let mut rows = rows_by_ids(tx, tenant_id, &ids, settings).await?;
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
            if row.available < l.quantity {
                return Err(AppError::Conflict(format!(
                    "{} is out of stock for online orders",
                    row.name
                )));
            }
            Ok(Line { id: l.id, row })
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

/// What delivery would be offered for the cart now (part 3's offer).
pub async fn delivery_options(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<DeliveryOffer, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let facts = match super::cart_id(tx, tenant_id, patient_id).await? {
        Some(cart) => cart_lines(tx, tenant_id, cart, &settings)
            .await?
            .iter()
            .map(|l| l.row.line_facts())
            .collect(),
        None => Vec::new(),
    };
    offer_for_lines(tx, tenant_id, patient_id, &facts).await
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
    if let Some(choice) = &request.delivery {
        let facts: Vec<_> = lines.iter().map(|l| l.row.line_facts()).collect();
        let checked = check_choice_for_lines(tx, tenant_id, patient_id, &facts, choice).await?;
        record_choice(tx, tenant_id, Source::Store(cart), &checked).await?;
    }
    fix_prices(tx, tenant_id, &lines, &settings).await?;
    // Placed. Release moves it on at once when no pharmacist need read it.
    sqlx::query(
        "UPDATE pharmacy_store_orders \
            SET status = 'awaiting_verification', rx_source = $3, prescription_id = $4, \
                placed_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(cart)
    .bind(tenant_id)
    .bind(rx.as_str())
    .bind(prescription_id)
    .execute(&mut **tx)
    .await?;
    if release == Release::Now {
        super::release::release(tx, tenant_id, cart, None).await?;
    }
    patient_order(tx, tenant_id, patient_id, cart).await
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

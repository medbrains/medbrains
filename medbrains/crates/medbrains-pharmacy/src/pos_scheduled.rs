//! A counter sale of a Schedule H or H1 drug against the prescription the
//! customer brings (Drugs Rules, Rule 65(9)): the patient is named — a
//! light pharmacy-customer record when they are not registered, matched by
//! their mobile, never duplicated — and for H1 the prescriber and the
//! patient's address are recorded for the H1 register. Schedule X, NDPS and
//! controlled drugs are never sold here: they are dispensed against the
//! register on the prescription path.

use medbrains_core::pharmacy_storefront::h1_record_problem;
use medbrains_server_core::error::AppError;
use medbrains_server_services::pharmacy_customer::{
    Channel, NewCustomer, create, people_with_phone,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::CreatePosSaleRequest;

fn text(v: Option<&str>) -> Option<&str> {
    v.map(str::trim).filter(|s| !s.is_empty())
}

/// Refuse what the counter may not sell; for H/H1, name the patient on the
/// sale. Returns whether any line is H or H1.
pub(crate) async fn check_scheduled_sale(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    body: &mut CreatePosSaleRequest,
) -> Result<bool, AppError> {
    let ids: Vec<Uuid> = body
        .items
        .iter()
        .filter_map(|i| i.catalog_item_id)
        .collect();
    let rows: Vec<(String, Option<String>, bool)> = sqlx::query_as(
        "SELECT name, drug_schedule, is_controlled FROM pharmacy_catalog \
          WHERE tenant_id = $1 AND id = ANY($2) \
            AND (is_controlled OR drug_schedule IN ('H', 'H1', 'X', 'NDPS'))",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    if let Some((name, _, _)) = rows
        .iter()
        .find(|(_, s, c)| *c || matches!(s.as_deref(), Some("X" | "NDPS")))
    {
        return Err(AppError::BadRequest(format!(
            "'{name}' is a controlled drug and can't be sold at the counter — dispense it \
             against a prescription so the NDPS register and dual-lock are recorded."
        )));
    }
    if rows.is_empty() {
        return Ok(false);
    }
    let h1 = rows.iter().any(|(_, s, _)| s.as_deref() == Some("H1"));
    if h1 {
        h1_record_problem(
            body.prescriber_name.as_deref(),
            body.prescriber_registration.as_deref(),
            body.patient_address.as_deref(),
        )
        .map_err(AppError::BadRequest)?;
    }
    if body.patient_id.is_some() {
        return Ok(true);
    }
    let (Some(name), Some(phone)) = (
        text(body.patient_name.as_deref()),
        text(body.patient_phone.as_deref()),
    ) else {
        return Err(AppError::BadRequest(
            "Schedule H/H1: enter the patient's name and mobile from the prescription".to_owned(),
        ));
    };
    // A family often shares one mobile: the patient is the one of them with
    // this first name, or someone new — never whoever had the number first.
    let first = name
        .split_whitespace()
        .next()
        .unwrap_or(name)
        .to_lowercase();
    let people = people_with_phone(tx, tenant_id, phone).await?;
    let same: Vec<Uuid> = people
        .iter()
        .filter(|p| {
            p.name
                .split_whitespace()
                .next()
                .is_some_and(|f| f.to_lowercase() == first)
        })
        .map(|p| p.id)
        .collect();
    body.patient_id = Some(match same.as_slice() {
        [one] => *one,
        [] => {
            let details = NewCustomer {
                name: name.to_owned(),
                address: body.patient_address.clone(),
                ..NewCustomer::default()
            };
            create(tx, tenant_id, phone, &details, Channel::Counter).await?
        }
        _ => {
            return Err(AppError::BadRequest(
                "Two people with this name share this mobile: find the patient by name".to_owned(),
            ));
        }
    });
    Ok(true)
}

/// The prescription behind an H/H1 counter sale, on the sale.
pub(crate) async fn record_scheduled_sale(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    sale_id: Uuid,
    body: &CreatePosSaleRequest,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE pharmacy_pos_sales \
            SET rx_prescriber_name = $3, rx_prescriber_registration = $4, \
                rx_patient_address = $5 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(sale_id)
    .bind(tenant_id)
    .bind(text(body.prescriber_name.as_deref()))
    .bind(text(body.prescriber_registration.as_deref()))
    .bind(text(body.patient_address.as_deref()))
    .execute(&mut **tx)
    .await?;
    Ok(())
}

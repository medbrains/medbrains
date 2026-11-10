//! Lab orders with their reported results, and pharmacy dispenses.
//!
//! History is what happened, so a historical critical value raises no alert,
//! a historical dispense moves no stock and writes no NDPS register entry, and
//! neither raises a bill (bills come in as their own records).

use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::ctx::{Ctx, Ref};

const FLAGS: &[&str] = &[
    "normal",
    "low",
    "high",
    "critical_low",
    "critical_high",
    "abnormal",
];
const PRIORITIES: &[&str] = &["routine", "urgent", "stat"];
const DISPENSING: &[&str] = &["prescription", "otc", "discharge", "package", "emergency"];

#[derive(Debug, Deserialize)]
pub(crate) struct ResultRec {
    pub(crate) parameter_name: String,
    pub(crate) value: String,
    pub(crate) unit: Option<String>,
    pub(crate) normal_range: Option<String>,
    pub(crate) flag: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LabRec {
    pub(crate) external_id: String,
    pub(crate) patient: String,
    pub(crate) visit: Option<String>,
    pub(crate) admission: Option<String>,
    pub(crate) test: String,
    pub(crate) priority: Option<String>,
    pub(crate) ordered_at: DateTime<Utc>,
    pub(crate) collected_at: DateTime<Utc>,
    pub(crate) reported_at: DateTime<Utc>,
    pub(crate) results: Vec<ResultRec>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DispenseItem {
    pub(crate) drug: String,
    pub(crate) quantity: i32,
    pub(crate) unit_price: rust_decimal::Decimal,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DispenseRec {
    pub(crate) external_id: String,
    pub(crate) patient: String,
    pub(crate) visit: Option<String>,
    pub(crate) admission: Option<String>,
    pub(crate) dispensed_at: DateTime<Utc>,
    pub(crate) dispensing_type: Option<String>,
    pub(crate) items: Vec<DispenseItem>,
}

async fn doctor_of(ctx: &mut Ctx<'_>, encounter: Uuid) -> Result<Option<Uuid>, AppError> {
    Ok(
        sqlx::query_scalar("SELECT doctor_id FROM encounters WHERE id = $1")
            .bind(encounter)
            .fetch_one(&mut *ctx.tx)
            .await?,
    )
}

/// The patient, the episode (same patient) and that the event falls after the episode began.
fn episode_for(
    ctx: &mut Ctx<'_>,
    patient: &str,
    visit: Option<&String>,
    admission: Option<&String>,
    at: DateTime<Utc>,
) -> Option<Ref> {
    let (patient, _) = ctx.patient(patient)?;
    let episode = ctx.episode(visit, admission, patient)?;
    ctx.in_order("ordered_at / dispensed_at", episode.at, at)
        .then_some(episode)
}

pub(crate) async fn lab_order(ctx: &mut Ctx<'_>, r: &LabRec) -> Result<Option<Ref>, AppError> {
    let test = ctx.lab_tests.get(&r.test.trim().to_uppercase()).cloned();
    if test.is_none() {
        ctx.problem(
            "test",
            format!("No active lab test has the code {}", r.test),
        );
    }
    let priority = r.priority.as_deref().unwrap_or("routine").to_lowercase();
    if !PRIORITIES.contains(&priority.as_str()) {
        ctx.problem("priority", format!("Use one of: {}", PRIORITIES.join(", ")));
    }
    let dated = ctx.past("reported_at", r.reported_at)
        & ctx.in_order("collected_at", r.ordered_at, r.collected_at)
        & ctx.in_order("reported_at", r.collected_at, r.reported_at);
    if r.results.is_empty() {
        ctx.problem("results", "A reported lab order needs at least one result");
    }
    for res in &r.results {
        if res.parameter_name.trim().is_empty() || res.value.trim().is_empty() {
            ctx.problem("results", "Every result needs its parameter name and value");
        }
        if let Some(flag) = res.flag.as_deref().filter(|f| !FLAGS.contains(f)) {
            ctx.problem(
                "results.flag",
                format!(
                    "{flag} is not a result flag; use one of: {}",
                    FLAGS.join(", ")
                ),
            );
        }
    }
    let episode = episode_for(
        ctx,
        &r.patient,
        r.visit.as_ref(),
        r.admission.as_ref(),
        r.ordered_at,
    );
    let (Some((test_id, _)), Some(episode), true) = (test, episode, dated) else {
        return Ok(None);
    };
    let Some(encounter) = episode.encounter else {
        return Ok(None);
    };
    let ordered_by = doctor_of(ctx, encounter).await?.unwrap_or(ctx.user);
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, ordering_doctor_id, status, \
            priority, collected_at, verified_at, completed_at, report_status, report_date, order_date, collection_date, \
            notes, created_at, updated_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $5, 'verified', $6::lab_priority, $7, $8, $8, 'final', $8, $9, $7, \
            'Historical import', $9, $8, $10) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(encounter)
    .bind(episode.patient)
    .bind(test_id)
    .bind(ordered_by)
    .bind(&priority)
    .bind(r.collected_at)
    .bind(r.reported_at)
    .bind(r.ordered_at)
    .bind(ctx.user)
    .fetch_one(&mut *ctx.tx)
    .await?;
    for (i, res) in r.results.iter().enumerate() {
        let flag = res.flag.as_deref().unwrap_or("normal");
        sqlx::query(
            "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, normal_range, flag, \
                is_abnormal, is_critical, display_order, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7::lab_result_flag, $8, $9, $10, $11, $11)",
        )
        .bind(ctx.tenant)
        .bind(order)
        .bind(res.parameter_name.trim())
        .bind(res.value.trim())
        .bind(&res.unit)
        .bind(&res.normal_range)
        .bind(flag)
        .bind(flag != "normal")
        .bind(flag.starts_with("critical"))
        .bind(i32::try_from(i).unwrap_or(i32::MAX))
        .bind(r.reported_at)
        .execute(&mut *ctx.tx)
        .await?;
    }
    ctx.record_provenance("lab_orders", order, r.ordered_at)
        .await?;
    Ok(Some(Ref {
        id: order,
        patient: episode.patient,
        encounter: Some(encounter),
        admission: episode.admission,
        at: r.ordered_at,
    }))
}

pub(crate) async fn dispense(ctx: &mut Ctx<'_>, r: &DispenseRec) -> Result<Option<Ref>, AppError> {
    let kind = r
        .dispensing_type
        .as_deref()
        .unwrap_or("prescription")
        .to_lowercase();
    if !DISPENSING.contains(&kind.as_str()) {
        ctx.problem(
            "dispensing_type",
            format!("Use one of: {}", DISPENSING.join(", ")),
        );
    }
    if r.items.is_empty() {
        ctx.problem("items", "A dispense needs at least one item");
    }
    let mut lines = Vec::with_capacity(r.items.len());
    for item in &r.items {
        match ctx.drugs.get(&item.drug.trim().to_uppercase()).cloned() {
            None => ctx.problem(
                "items.drug",
                format!("No active drug has the code {}", item.drug),
            ),
            Some(_) if item.quantity <= 0 || item.unit_price.is_sign_negative() => {
                ctx.problem("items", "Quantity must be positive and price not negative");
            }
            Some((id, name)) => lines.push((id, name, item)),
        }
    }
    let dated = ctx.past("dispensed_at", r.dispensed_at);
    let episode = episode_for(
        ctx,
        &r.patient,
        r.visit.as_ref(),
        r.admission.as_ref(),
        r.dispensed_at,
    );
    let (Some(episode), true) = (episode, dated) else {
        return Ok(None);
    };
    let ordered_by = match episode.encounter {
        Some(e) => doctor_of(ctx, e).await?,
        None => None,
    };
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_orders (tenant_id, patient_id, encounter_id, ordered_by, status, dispensing_type, \
            dispensed_at, notes, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, 'dispensed', $5::pharmacy_dispensing_type, $6, 'Historical import', $6, $6) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(episode.patient)
    .bind(episode.encounter)
    .bind(ordered_by)
    .bind(&kind)
    .bind(r.dispensed_at)
    .fetch_one(&mut *ctx.tx)
    .await?;
    for (drug, name, item) in lines {
        sqlx::query(
            "INSERT INTO pharmacy_order_items (tenant_id, order_id, catalog_item_id, drug_name, quantity, \
                quantity_prescribed, quantity_dispensed, unit_price, total_price, created_at) \
             VALUES ($1, $2, $3, $4, $5, $5, $5, $6, $6 * $5, $7)",
        )
        .bind(ctx.tenant)
        .bind(order)
        .bind(drug)
        .bind(name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(r.dispensed_at)
        .execute(&mut *ctx.tx)
        .await?;
    }
    ctx.record_provenance("pharmacy_orders", order, r.dispensed_at)
        .await?;
    Ok(Some(Ref {
        id: order,
        patient: episode.patient,
        encounter: episode.encounter,
        admission: episode.admission,
        at: r.dispensed_at,
    }))
}

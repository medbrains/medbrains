//! A nurse uses ward stock, on a patient or on the ward.
//!
//! Every use is a `ward_stock_consumptions` row (migration 1421). It records,
//! at the moment of use, whether the use is billable: used on a named patient
//! and the drug marked `is_patient_billable`. Turning the flag on later never
//! bills old uses. A billable use is charged through `charge_or_queue`
//! (setting `auto_charge_ward_stock`): posted to the admission's bill, or
//! queued for the desk when it cannot be posted. One a billing package on the
//! patient's bill already includes is not charged. The use itself always
//! saves, even when the billing lookups fail: the daily check raises it then.

use axum::Json;
use axum::extract::{Extension, State};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_services::billing::{
    AutoChargeInput, ChargeOutcome, ChargeRequest, charge_or_queue, require_live_patient,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

/// The setting that governs ward-stock charges: `auto_charge_ward_stock`.
pub const SETTING_MODULE: &str = "ward_stock";

#[derive(Debug, Deserialize)]
pub struct WardStockConsumeRequest {
    pub department_id: Uuid,
    pub catalog_item_id: Uuid,
    pub quantity: i32,
    /// Who it was used on; none for ward use.
    pub patient_id: Option<Uuid>,
}

/// What happened to the patient's charge, for the nurse's confirmation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConsumeCharge {
    /// No patient named: ward use.
    WardUse,
    /// The item is overhead (not marked billable) or in the patient's package.
    NotBillable,
    /// On the patient's bill.
    Posted,
    /// Could not post; on the billing desk's queue.
    Queued,
    /// The hospital has ward-stock billing switched off.
    Disabled,
    /// The charge could not be worked out now; the daily check will raise it.
    Deferred,
}

#[derive(Debug, Serialize)]
pub struct WardStockConsumeResponse {
    pub consumption_id: Uuid,
    pub remaining: i32,
    pub charge: ConsumeCharge,
}

/// The drug's billing identity.
#[derive(Debug, sqlx::FromRow)]
struct Item {
    code: String,
    name: String,
    base_price: Decimal,
    tax_percent: Decimal,
}

/// `POST /api/pharmacy/ward-stock/consume` — record a use of ward stock and,
/// when used on a patient, charge it if the item is billable.
pub async fn consume_ward_stock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<WardStockConsumeRequest>,
) -> Result<Json<WardStockConsumeResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::stores::MANAGE)?;
    if body.quantity <= 0 {
        return Err(AppError::BadRequest("quantity must be positive".to_owned()));
    }
    // Using stock on somebody puts a record and a charge on them.
    if let Some(patient_id) = body.patient_id {
        medbrains_health_services::patient::require_patient_access(&state, &claims, patient_id)
            .await?;
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let admission = match body.patient_id {
        Some(p) => {
            require_live_patient(&mut tx, claims.tenant_id, p).await?;
            active_admission(&mut tx, claims.tenant_id, p).await?
        }
        None => None,
    };
    let remaining = take_from_ward(&mut tx, claims.tenant_id, &body).await?;
    let (consumption_id, is_billable) = record_use(&mut tx, &claims, &body, admission).await?;
    let charge = match body.patient_id {
        None => ConsumeCharge::WardUse,
        Some(_) if !is_billable => ConsumeCharge::NotBillable,
        Some(patient_id) => {
            let use_ = Use {
                id: consumption_id,
                patient_id,
                admission,
                quantity: body.quantity,
            };
            charge_use(&mut tx, &claims, body.catalog_item_id, use_).await?
        }
    };
    tx.commit().await?;
    Ok(Json(WardStockConsumeResponse {
        consumption_id,
        remaining,
        charge,
    }))
}

/// Take the quantity off the ward's count; 400 when the ward has too few.
async fn take_from_ward(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    body: &WardStockConsumeRequest,
) -> Result<i32, AppError> {
    let remaining: Option<i32> = sqlx::query_scalar(
        "UPDATE ward_stock SET quantity = quantity - $1, updated_at = now() \
         WHERE tenant_id = $2 AND department_id = $3 AND catalog_item_id = $4 \
           AND quantity >= $1 RETURNING quantity",
    )
    .bind(body.quantity)
    .bind(tenant_id)
    .bind(body.department_id)
    .bind(body.catalog_item_id)
    .fetch_optional(&mut *conn)
    .await?;
    remaining
        .ok_or_else(|| AppError::BadRequest("Insufficient ward stock for this item".to_owned()))
}

/// The patient's current admission and its encounter, so the charge lands on
/// the bill the discharge desk settles. `None` for a patient not admitted.
async fn active_admission(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<(Uuid, Uuid)>, AppError> {
    Ok(sqlx::query_as(
        "SELECT id, encounter_id FROM admissions \
          WHERE tenant_id = $1 AND patient_id = $2 AND status = 'admitted' \
          ORDER BY admitted_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut *conn)
    .await?)
}

/// Write the use: the record the charge, the detector and the shrinkage
/// check all read. Snapshots, now, whether it is billable. Returns its id
/// and that answer.
async fn record_use(
    conn: &mut PgConnection,
    claims: &Claims,
    body: &WardStockConsumeRequest,
    admission: Option<(Uuid, Uuid)>,
) -> Result<(Uuid, bool), AppError> {
    Ok(sqlx::query_as(
        "INSERT INTO ward_stock_consumptions (tenant_id, department_id, catalog_item_id, \
           quantity, patient_id, encounter_id, admission_id, consumed_by, is_billable) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \
           $5::uuid IS NOT NULL AND COALESCE((SELECT c.is_patient_billable \
             FROM pharmacy_catalog c WHERE c.id = $3 AND c.tenant_id = $1), false)) \
         RETURNING id, is_billable",
    )
    .bind(claims.tenant_id)
    .bind(body.department_id)
    .bind(body.catalog_item_id)
    .bind(body.quantity)
    .bind(body.patient_id)
    .bind(admission.map(|a| a.1))
    .bind(admission.map(|a| a.0))
    .bind(claims.sub)
    .fetch_one(&mut *conn)
    .await?)
}

/// One billable use on a patient, as the charge needs it.
#[derive(Debug, Clone, Copy)]
struct Use {
    id: Uuid,
    patient_id: Uuid,
    /// (admission, its encounter)
    admission: Option<(Uuid, Uuid)>,
    quantity: i32,
}

/// Charge a billable use through `charge_or_queue`, unless a package on the
/// admission's bill includes it. Every billing step runs in one savepoint: a
/// failed lookup rolls back only the charge, never the nurse's use.
async fn charge_use(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    catalog_item_id: Uuid,
    use_: Use,
) -> Result<ConsumeCharge, AppError> {
    let encounter_id = use_.admission.map(|a| a.1);
    let mut savepoint = sqlx::Acquire::begin(&mut **tx).await?;
    let lookup = price_use(
        &mut savepoint,
        claims.tenant_id,
        catalog_item_id,
        encounter_id,
    )
    .await;
    let item = match lookup {
        Ok(Some(item)) => item,
        Ok(None) => {
            savepoint.commit().await?;
            return Ok(ConsumeCharge::NotBillable);
        }
        Err(error) => {
            savepoint.rollback().await?;
            tracing::warn!(%error, consumption = %use_.id, "ward-stock charge deferred to the daily check");
            return Ok(ConsumeCharge::Deferred);
        }
    };
    let req = ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: SETTING_MODULE,
        charge: AutoChargeInput {
            patient_id: use_.patient_id,
            encounter_id,
            charge_code: item.code,
            source: "consumable".to_owned(),
            source_id: use_.id,
            quantity: use_.quantity,
            description_override: Some(item.name),
            // A ₹0 catalogue price is "not set": let the tariff price it.
            unit_price_override: (!item.base_price.is_zero()).then_some(item.base_price),
            tax_percent_override: (!item.base_price.is_zero()).then_some(item.tax_percent),
        },
        apply_concessions: true,
    };
    let outcome = charge_or_queue(&mut savepoint, req).await?;
    savepoint.commit().await?;
    Ok(match outcome {
        ChargeOutcome::Posted(posted) => {
            if let Some((admission_id, _)) = use_.admission {
                stamp_admission(tx, claims.tenant_id, posted.invoice_id, admission_id).await?;
            }
            ConsumeCharge::Posted
        }
        ChargeOutcome::Queued => ConsumeCharge::Queued,
        ChargeOutcome::Disabled => ConsumeCharge::Disabled,
    })
}

/// The item to charge, or `None` when a package on the bill includes it.
async fn price_use(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    catalog_item_id: Uuid,
    encounter_id: Option<Uuid>,
) -> Result<Option<Item>, AppError> {
    let item = item(conn, tenant_id, catalog_item_id).await?;
    if in_package(conn, tenant_id, encounter_id, &item.code).await? {
        return Ok(None);
    }
    Ok(Some(item))
}

/// The drug's billing identity.
async fn item(conn: &mut PgConnection, tenant_id: Uuid, id: Uuid) -> Result<Item, AppError> {
    sqlx::query_as(
        "SELECT code, name, base_price, tax_percent \
           FROM pharmacy_catalog WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// Whether a billing package on the encounter's bill lists the item's code
/// (the leakage detector's package rule, `leakage::sql`).
async fn in_package(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Option<Uuid>,
    code: &str,
) -> Result<bool, AppError> {
    let Some(encounter_id) = encounter_id else {
        return Ok(false);
    };
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM invoices i \
           JOIN invoice_items ii ON ii.invoice_id = i.id AND ii.tenant_id = i.tenant_id \
                AND ii.deleted_at IS NULL \
           JOIN billing_packages bp ON bp.tenant_id = i.tenant_id AND bp.code = ii.charge_code \
                AND bp.deleted_at IS NULL \
           JOIN billing_package_items bpi ON bpi.package_id = bp.id \
                AND bpi.tenant_id = bp.tenant_id AND bpi.charge_code = $3 \
                AND bpi.deleted_at IS NULL \
          WHERE i.tenant_id = $1 AND i.encounter_id = $2 \
            AND i.deleted_at IS NULL AND i.status <> 'cancelled')",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(code)
    .fetch_one(&mut *conn)
    .await?)
}

/// Tie the bill to the admission so the line rolls up onto the discharge bill.
async fn stamp_admission(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    invoice_id: Uuid,
    admission_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE invoices SET admission_id = COALESCE(admission_id, $1), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(admission_id)
    .bind(invoice_id)
    .bind(tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

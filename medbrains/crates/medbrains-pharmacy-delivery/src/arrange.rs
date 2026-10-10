//! Arranging a delivery: what an order may go out as, sending it, and the
//! list the pharmacy and the runners work from.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::pharmacy_delivery::{Mode, blockers, cash_on_delivery};
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    middleware::field_access::resolve_restricted_fields,
    state::AppState,
};
use medbrains_server_services::billing::{AutoChargeInput, auto_charge};
use medbrains_server_services::patient_identity::{PatientIdentity, patient_identities};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Delivery;
use crate::facts::{bill_balance, history, order_facts, patient_contact, settings};

/// The charge-master code a delivery fee is billed under.
const DELIVERY_CHARGE_CODE: &str = "PHARM-DELIVERY";
/// The longest list one page returns.
const LIST_LIMIT: i64 = 200;

#[derive(Debug, Serialize)]
pub struct DeliveryOptions {
    pub address: String,
    pub pincode: Option<String>,
    pub contact_phone: String,
    /// Why the order can't go with a runner / by courier; empty when it can.
    pub runner_blockers: Vec<String>,
    pub courier_blockers: Vec<String>,
    pub cash_on_delivery: bool,
    /// Why not, when it isn't offered.
    pub cash_on_delivery_reason: Option<String>,
    pub delivery_fee: Decimal,
    /// Still owed on the order's bill, before the fee.
    pub bill_balance: Decimal,
}

/// `GET /api/pharmacy/orders/{id}/delivery-options`
pub async fn delivery_options(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<DeliveryOptions>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::ARRANGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let order = order_facts(&mut tx, claims.tenant_id, order_id).await?;
    let (address, pincode, contact_phone) =
        patient_contact(&mut tx, claims.tenant_id, order.patient_id).await?;
    let (fee, cod_min) = settings(&mut tx, claims.tenant_id).await?;
    let record = history(&mut tx, claims.tenant_id, order.patient_id).await?;
    let balance = bill_balance(&mut tx, claims.tenant_id, order_id).await?;
    tx.commit().await?;
    let cod = cash_on_delivery(record, cod_min);
    Ok(Json(DeliveryOptions {
        address,
        pincode,
        contact_phone,
        runner_blockers: blockers(&order.lines, Mode::Runner),
        courier_blockers: blockers(&order.lines, Mode::Courier),
        cash_on_delivery: cod.is_ok(),
        cash_on_delivery_reason: cod.err(),
        delivery_fee: fee,
        bill_balance: balance,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ArrangeRequest {
    pub order_id: Uuid,
    pub mode: String,
    pub address: String,
    pub landmark: Option<String>,
    pub pincode: Option<String>,
    pub contact_phone: String,
    pub runner_id: Option<Uuid>,
    pub courier_name: Option<String>,
    pub tracking_ref: Option<String>,
    /// `prepaid` or `cash_on_delivery`.
    pub payment: String,
}

fn text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// `POST /api/pharmacy/deliveries` — send an order out for delivery.
pub async fn arrange(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ArrangeRequest>,
) -> Result<Json<Delivery>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::ARRANGE)?;
    let mode = Mode::parse(&body.mode)
        .ok_or_else(|| AppError::BadRequest("Send it with a runner or by courier".to_owned()))?;
    let address = text(Some(&body.address))
        .ok_or_else(|| AppError::BadRequest("Where should it go? Enter the address".to_owned()))?;
    let phone = text(Some(&body.contact_phone))
        .ok_or_else(|| AppError::BadRequest("A phone number for the delivery".to_owned()))?;
    let courier = text(body.courier_name.as_deref());
    if mode == Mode::Courier && courier.is_none() {
        return Err(AppError::BadRequest("Name the courier".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let order = order_facts(&mut tx, claims.tenant_id, body.order_id).await?;
    if matches!(order.status.as_str(), "cancelled" | "returned") {
        return Err(AppError::Conflict("This order was cancelled".to_owned()));
    }
    let refused = blockers(&order.lines, mode);
    if !refused.is_empty() {
        return Err(AppError::Conflict(refused.join(". ")));
    }
    let payment = match body.payment.as_str() {
        "prepaid" => "prepaid",
        "cash_on_delivery" => {
            let (_, cod_min) = settings(&mut tx, claims.tenant_id).await?;
            let record = history(&mut tx, claims.tenant_id, order.patient_id).await?;
            cash_on_delivery(record, cod_min).map_err(AppError::Conflict)?;
            "cash_on_delivery"
        }
        _ => {
            return Err(AppError::BadRequest(
                "Prepaid or cash on delivery".to_owned(),
            ));
        }
    };
    if let Some(runner) = body.runner_id {
        check_runner(&mut tx, claims.tenant_id, runner).await?;
    }
    let id = Uuid::new_v4();
    let (fee, _) = settings(&mut tx, claims.tenant_id).await?;
    // At the door: what the order still owes, plus the fee — read before the
    // fee is billed, so it isn't counted twice.
    let due = bill_balance(&mut tx, claims.tenant_id, body.order_id).await? + fee;
    if fee > Decimal::ZERO {
        charge_fee(&mut tx, claims.tenant_id, &order, id, fee).await?;
    }
    let delivery = sqlx::query_as::<_, Delivery>(
        "INSERT INTO pharmacy_deliveries \
           (id, tenant_id, order_id, patient_id, mode, address, landmark, pincode, contact_phone, \
            runner_id, courier_name, tracking_ref, payment, delivery_fee, amount_due, arranged_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.order_id)
    .bind(order.patient_id)
    .bind(body.mode.as_str())
    .bind(address)
    .bind(text(body.landmark.as_deref()))
    .bind(text(body.pincode.as_deref()))
    .bind(phone)
    .bind(body.runner_id.filter(|_| mode == Mode::Runner))
    .bind(courier.filter(|_| mode == Mode::Courier))
    .bind(text(body.tracking_ref.as_deref()))
    .bind(payment)
    .bind(fee)
    .bind(if payment == "cash_on_delivery" {
        due
    } else {
        Decimal::ZERO
    })
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(db) if db.is_unique_violation() => {
            AppError::Conflict("This order is already out for delivery".to_owned())
        }
        other => other.into(),
    })?;
    tx.commit().await?;
    Ok(Json(delivery))
}

/// Bill the delivery fee with the order's visit, once per delivery.
async fn charge_fee(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    order: &crate::facts::OrderFacts,
    delivery_id: Uuid,
    fee: Decimal,
) -> Result<(), AppError> {
    auto_charge(
        tx,
        &tenant_id,
        AutoChargeInput {
            patient_id: order.patient_id,
            encounter_id: order.encounter_id,
            charge_code: DELIVERY_CHARGE_CODE.to_owned(),
            source: "pharmacy".to_owned(),
            source_id: delivery_id,
            quantity: 1,
            description_override: Some("Home delivery of medicines".to_owned()),
            unit_price_override: Some(fee),
            tax_percent_override: Some(Decimal::ZERO),
        },
    )
    .await?;
    Ok(())
}

/// Refuse anyone but one of the hospital's active delivery runners.
async fn check_runner(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    runner: Uuid,
) -> Result<(), AppError> {
    let is_runner: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 \
            AND role::text = 'delivery_runner' AND is_active)",
    )
    .bind(runner)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if is_runner {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "Pick one of the hospital's delivery runners".to_owned(),
        ))
    }
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeliveryList {
    pub deliveries: Vec<Delivery>,
    pub patients: Vec<PatientIdentity>,
}

/// `GET /api/pharmacy/deliveries` — the pharmacy sees every delivery; a
/// runner sees the ones assigned to them.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<DeliveryList>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::VIEW)?;
    let sees_all = is_bypass_role(&claims)
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::pharmacy::deliveries::ARRANGE);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let deliveries = sqlx::query_as::<_, Delivery>(
        "SELECT * FROM pharmacy_deliveries \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND ($2::text IS NULL OR status = $2) \
            AND ($3 OR runner_id = $4) \
          ORDER BY created_at DESC LIMIT $5",
    )
    .bind(claims.tenant_id)
    .bind(query.status.as_deref())
    .bind(sees_all)
    .bind(claims.sub)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let restricted =
        resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role).await?;
    let ids: Vec<Uuid> = deliveries.iter().map(|d| d.patient_id).collect();
    let patients = patient_identities(&mut tx, claims.tenant_id, &ids, &restricted).await?;
    tx.commit().await?;
    Ok(Json(DeliveryList {
        deliveries,
        patients,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Runner {
    pub id: Uuid,
    pub full_name: String,
}

/// `GET /api/pharmacy/delivery-runners` — who a delivery can be given to.
pub async fn runners(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Runner>>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::ARRANGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Runner>(
        "SELECT id, full_name FROM users \
          WHERE tenant_id = $1 AND role::text = 'delivery_runner' AND is_active \
          ORDER BY full_name LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

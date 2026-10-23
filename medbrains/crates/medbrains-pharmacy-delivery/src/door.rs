//! A delivery on the road.
//!
//! Dispatch texts the patient a one-time code; at the door the runner hands
//! over against it. A failed attempt is recorded and the parcel comes back; an
//! arranged delivery can still be called off.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_core::pharmacy_delivery::{MAX_OTP_ATTEMPTS, Mode, Status};
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::Delivery;
use crate::facts::bill_balance;

/// Orders whose medicines have left the shelf, ready to travel.
const SENDABLE_ORDER_STATES: [&str; 3] = ["dispensed", "partially_dispensed", "ready"];

fn hash_code(code: &str) -> String {
    hex::encode(Sha256::digest(code.trim().as_bytes()))
}

fn holds(claims: &Claims, permission: &str) -> bool {
    is_bypass_role(claims) || claims.permissions.iter().any(|p| p == permission)
}

/// The delivery, locked, refused unless it may move to `to`.
async fn locked(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    id: Uuid,
    to: Status,
) -> Result<Delivery, AppError> {
    let delivery = sqlx::query_as::<_, Delivery>(
        "SELECT * FROM pharmacy_deliveries \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let from = Status::parse(&delivery.status).ok_or(AppError::NotFound)?;
    if !from.may_move_to(to) {
        return Err(AppError::Conflict(format!(
            "This delivery is {}",
            delivery.status.replace('_', " ")
        )));
    }
    Ok(delivery)
}

/// `POST /api/pharmacy/deliveries/{id}/dispatch` — it leaves the pharmacy.
pub async fn dispatch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Delivery>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::ARRANGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let delivery = locked(&mut tx, claims.tenant_id, id, Status::OutForDelivery).await?;
    let order_status: String =
        sqlx::query_scalar("SELECT status FROM pharmacy_orders WHERE id = $1 AND tenant_id = $2")
            .bind(delivery.order_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;
    if !SENDABLE_ORDER_STATES.contains(&order_status.as_str()) {
        return Err(AppError::Conflict(
            "Dispense the order before it goes out".to_owned(),
        ));
    }
    if delivery.mode == "runner" && delivery.runner_id.is_none() {
        return Err(AppError::Conflict("Give it to a runner first".to_owned()));
    }
    if delivery.payment == "prepaid" {
        let owed = bill_balance(&mut tx, claims.tenant_id, delivery.order_id).await?;
        if owed > Decimal::ZERO {
            return Err(AppError::Conflict(format!(
                "₹{owed} is still owed on the bill: take payment before it goes out"
            )));
        }
    }

    let mut buf = [0u8; 4];
    getrandom::fill(&mut buf).map_err(|e| AppError::Internal(format!("code generation: {e}")))?;
    let code = format!("{:06}", u32::from_le_bytes(buf) % 1_000_000);
    let body = match Mode::parse(&delivery.mode) {
        Some(Mode::Courier) => format!(
            "Your medicines are on the way by {}{}. Your delivery code is {code}.",
            delivery.courier_name.as_deref().unwrap_or("courier"),
            delivery
                .tracking_ref
                .as_deref()
                .map(|t| format!(", tracking {t}"))
                .unwrap_or_default()
        ),
        _ => format!(
            "Your medicines are on the way. Give this code to the hospital's runner at the door: {code}. Do not share it otherwise."
        ),
    };
    let out = sqlx::query_as::<_, Delivery>(
        "UPDATE pharmacy_deliveries SET status = 'out_for_delivery', dispatched_at = now(), \
                otp_hash = $3, otp_attempts = 0, patient_code = $4 \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(hash_code(&code))
    .bind(&code)
    .fetch_one(&mut *tx)
    .await?;
    medbrains_outbox::queue::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "pharmacy_delivery",
            aggregate_id: Some(id),
            event_type: "sms.pharmacy_delivery_code",
            payload: serde_json::json!({ "to": out.contact_phone, "body": body }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("failed to queue the delivery code: {e}")))?;
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct CompleteRequest {
    /// The patient's one-time code; required for a runner's delivery.
    pub code: Option<String>,
    /// Cash taken at the door, for cash on delivery.
    pub cash_collected: Option<Decimal>,
}

/// `POST /api/pharmacy/deliveries/{id}/complete` — handed over.
pub async fn complete(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteRequest>,
) -> Result<Json<Delivery>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::COMPLETE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let delivery = locked(&mut tx, claims.tenant_id, id, Status::Delivered).await?;
    let pharmacy = holds(&claims, permissions::pharmacy::deliveries::ARRANGE);
    // A runner completes their own deliveries; a courier's is confirmed by the pharmacy.
    if !pharmacy && delivery.runner_id != Some(claims.sub) {
        return Err(AppError::NotFound);
    }
    if delivery.mode == "runner" {
        if delivery.otp_attempts >= MAX_OTP_ATTEMPTS {
            return Err(AppError::Conflict(
                "Too many wrong codes. Bring it back to the pharmacy".to_owned(),
            ));
        }
        let given = body.code.as_deref().map(hash_code);
        if given.is_none() || given != delivery.otp_hash {
            sqlx::query(
                "UPDATE pharmacy_deliveries SET otp_attempts = otp_attempts + 1 WHERE id = $1",
            )
            .bind(id)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            return Err(AppError::BadRequest(
                "That code doesn't match. Ask the patient for the code in their text".to_owned(),
            ));
        }
    }
    let cash = if delivery.payment == "cash_on_delivery" {
        Some(
            body.cash_collected
                .filter(|c| *c >= Decimal::ZERO)
                .ok_or_else(|| {
                    AppError::BadRequest(format!(
                        "Enter the cash taken (₹{} due)",
                        delivery.amount_due
                    ))
                })?,
        )
    } else {
        None
    };
    let done = sqlx::query_as::<_, Delivery>(
        "UPDATE pharmacy_deliveries SET status = 'delivered', delivered_at = now(), \
                delivered_by = $3, cash_collected = $4, patient_code = NULL \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(cash)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(done))
}

#[derive(Debug, Deserialize)]
pub struct FailRequest {
    pub reason: String,
}

/// `POST /api/pharmacy/deliveries/{id}/fail` — not handed over; it comes back.
pub async fn fail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<FailRequest>,
) -> Result<Json<Delivery>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::COMPLETE)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Say why it wasn't delivered".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let delivery = locked(&mut tx, claims.tenant_id, id, Status::Failed).await?;
    if !holds(&claims, permissions::pharmacy::deliveries::ARRANGE)
        && delivery.runner_id != Some(claims.sub)
    {
        return Err(AppError::NotFound);
    }
    let failed = sqlx::query_as::<_, Delivery>(
        "UPDATE pharmacy_deliveries SET status = 'failed', failure_reason = $3, \
                patient_code = NULL \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(failed))
}

/// `POST /api/pharmacy/deliveries/{id}/cancel` — called off before it left.
pub async fn cancel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Delivery>, AppError> {
    require_permission(&claims, permissions::pharmacy::deliveries::ARRANGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    locked(&mut tx, claims.tenant_id, id, Status::Cancelled).await?;
    let cancelled = sqlx::query_as::<_, Delivery>(
        "UPDATE pharmacy_deliveries SET status = 'cancelled' \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(cancelled))
}

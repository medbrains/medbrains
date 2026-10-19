//! The UHI requests screen: what patient apps booked or asked for — with
//! payment state and held or expired bookings — and the staff answer to
//! ambulance, blood and lab requests.
//!
//! - `GET  /api/uhi/requests`              — orders, newest first (bounded)
//! - `POST /api/uhi/requests/{id}/accept`  — ambulance: the trip is created;
//!   lab tests: the real lab orders (and home collection) are placed
//! - `POST /api/uhi/requests/{id}/decline` — with the reason the patient sees
//!
//! Either answer is sent to the patient's app as a signed `on_status`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{
    inbound::set_state,
    labs,
    outbox::{self, Tell},
    payment,
    protocol::{STATE_CANCELLED, STATE_CONFIRMED},
    requests::pickup_address,
    settings,
};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// The most rows one page of the queue shows.
const PAGE: i64 = 200;
const COLUMNS: &str = "id, service, state, customer_name, customer_phone, customer_abha, \
    order_details, appointment_id, ambulance_trip_id, decline_reason, confirmed_at, \
    responded_at, updated_at, payment_type, payment_status, amount, hold_expires_at, \
    lab_order_ids";

#[derive(Debug, sqlx::FromRow)]
struct Row {
    id: Uuid,
    service: String,
    state: String,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    customer_abha: Option<String>,
    order_details: Option<Value>,
    appointment_id: Option<Uuid>,
    ambulance_trip_id: Option<Uuid>,
    decline_reason: Option<String>,
    confirmed_at: Option<DateTime<Utc>>,
    responded_at: Option<DateTime<Utc>>,
    updated_at: DateTime<Utc>,
    payment_type: Option<String>,
    payment_status: Option<String>,
    amount: Option<rust_decimal::Decimal>,
    hold_expires_at: Option<DateTime<Utc>>,
    lab_order_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct UhiRequest {
    pub id: Uuid,
    pub service: String,
    pub state: String,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub customer_abha: Option<String>,
    /// What was asked for, in a line: the doctor and time, the blood, the pickup.
    pub summary: String,
    pub appointment_id: Option<Uuid>,
    pub ambulance_trip_id: Option<Uuid>,
    pub decline_reason: Option<String>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub responded_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    /// `ON-ORDER` (paid online) or `ON-FULFILLMENT` (at the hospital).
    pub payment_type: Option<String>,
    /// `PAID` or `NOT-PAID`; paid on a cancelled or expired booking means a
    /// refund is due.
    pub payment_status: Option<String>,
    pub amount: Option<rust_decimal::Decimal>,
    /// A held booking lets go of its slot at this time unless paid.
    pub hold_expires_at: Option<DateTime<Utc>>,
    /// The lab orders an accepted lab request became.
    pub lab_order_ids: Vec<Uuid>,
    /// A lab request for a home collection (accepting it books one).
    pub home_collection: bool,
}

fn summary(service: &str, order: &Value) -> String {
    let s = |p: &str| order.pointer(p).and_then(Value::as_str).unwrap_or_default();
    match service {
        "teleconsultation" | "physical_consultation" => format!(
            "{} at {}",
            s("/fulfillment/agent/name"),
            s("/fulfillment/start/time/timestamp").replace('T', " ")
        ),
        "ambulance" => format!(
            "Pickup: {}",
            pickup_address(order).unwrap_or_else(|| "not given".to_owned())
        ),
        "lab_tests" => labs::summary(order),
        _ => order
            .get("items")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|i| {
                        let count = i.pointer("/quantity/count").and_then(Value::as_i64);
                        let name = i.pointer("/descriptor/name").and_then(Value::as_str);
                        format!("{} × {}", count.unwrap_or(1), name.unwrap_or("blood"))
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default(),
    }
}

impl From<Row> for UhiRequest {
    fn from(r: Row) -> Self {
        let summary = r
            .order_details
            .as_ref()
            .map(|o| summary(&r.service, o))
            .unwrap_or_default();
        let home_collection =
            r.service == "lab_tests" && r.order_details.as_ref().is_some_and(labs::is_home);
        Self {
            id: r.id,
            service: r.service,
            state: r.state,
            customer_name: r.customer_name,
            customer_phone: r.customer_phone,
            customer_abha: r.customer_abha,
            summary,
            appointment_id: r.appointment_id,
            ambulance_trip_id: r.ambulance_trip_id,
            decline_reason: r.decline_reason,
            confirmed_at: r.confirmed_at,
            responded_at: r.responded_at,
            updated_at: r.updated_at,
            payment_type: r.payment_type,
            payment_status: r.payment_status,
            amount: r.amount,
            hold_expires_at: r.hold_expires_at,
            lab_order_ids: r.lab_order_ids,
            home_collection,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    /// `pending` for those waiting on staff; anything else lists every order.
    pub state: Option<String>,
}

/// `GET /api/uhi/requests`
///
/// # Errors
/// 403 without `uhi.requests.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<UhiRequest>>, AppError> {
    require_permission(&claims, permissions::uhi::requests::VIEW)?;
    let only_pending = q.state.as_deref() == Some("pending");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // The screen never shows a hold that has already run out as held.
    if let Some(sub) = settings::load(&mut tx, claims.tenant_id).await? {
        payment::expire_holds(&mut tx, state.secret_resolver.as_ref(), &sub).await?;
    }
    let rows = sqlx::query_as::<_, Row>(&format!(
        "SELECT {COLUMNS} FROM uhi_transactions \
          WHERE tenant_id = $1 AND deleted_at IS NULL \
            AND state IN ('awaiting_payment', 'pending', 'confirmed', 'declined', 'cancelled', \
                          'expired') \
            AND (NOT $2 OR state = 'pending') \
          ORDER BY updated_at DESC LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(only_pending)
    .bind(PAGE)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows.into_iter().map(UhiRequest::from).collect()))
}

#[derive(Debug, Deserialize)]
pub struct DeclineRequest {
    pub reason: String,
}

/// The pending request `id`, locked, with the context it arrived in.
async fn pending(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<(Row, Value), AppError> {
    let row = sqlx::query_as::<_, Row>(&format!(
        "SELECT {COLUMNS} FROM uhi_transactions \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if row.state != "pending"
        || matches!(
            row.service.as_str(),
            "teleconsultation" | "physical_consultation"
        )
    {
        return Err(AppError::Conflict(format!(
            "this request is {} and cannot be answered",
            row.state
        )));
    }
    let payload: Value = sqlx::query_scalar("SELECT payload FROM uhi_transactions WHERE id = $1")
        .bind(id)
        .fetch_one(&mut **tx)
        .await?;
    Ok((row, payload))
}

/// Tell the patient's app with an `on_status` carrying `order`.
async fn notify(
    state: &AppState,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    (row, payload): (&Row, &Value),
    order: Value,
) -> Result<(), AppError> {
    let sub = settings::load(tx, tenant_id)
        .await?
        .ok_or_else(|| AppError::ServiceUnavailable("UHI is not set up".to_owned()))?;
    let idempotency_key = format!(
        "staff|{}|{}",
        row.id,
        order["state"].as_str().unwrap_or_default()
    );
    outbox::tell(
        tx,
        state.secret_resolver.as_ref(),
        &sub,
        Tell {
            transaction_row: row.id,
            request: payload,
            action: "status",
            order,
            idempotency_key,
        },
    )
    .await
}

/// `POST /api/uhi/requests/{id}/accept`
///
/// # Errors
/// 403 without `uhi.requests.respond` — and `ambulance.trips.create` for an
/// ambulance, `blood_bank.inventory.manage` for blood, `lab.orders.direct`
/// for lab tests (and `lab.samples.manage` for a home collection); 409 when
/// it is not pending.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn accept(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<UhiRequest>, AppError> {
    require_permission(&claims, permissions::uhi::requests::RESPOND)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (row, payload) = pending(&mut tx, claims.tenant_id, id).await?;
    let mut order = row.order_details.clone().unwrap_or_else(|| json!({}));
    let mut placed = Vec::new();
    let trip = if row.service == "ambulance" {
        require_permission(&claims, permissions::ambulance::trips::CREATE)?;
        Some(create_trip(&mut tx, &claims, &row, &order).await?)
    } else if row.service == "lab_tests" {
        placed = labs::accept(
            &mut tx,
            &claims,
            labs::Request {
                id,
                order: &order,
                name: row.customer_name.as_deref(),
                phone: row.customer_phone.as_deref(),
                abha: row.customer_abha.as_deref(),
            },
        )
        .await?;
        order["fulfillment"]["tags"] = json!({ "instructions": labs::instructions(&order) });
        None
    } else {
        require_permission(&claims, permissions::blood_bank::inventory::MANAGE)?;
        order["fulfillment"]["tags"] = json!({ "instructions":
            "Bring the patient's blood sample and the doctor's requisition to the blood bank \
             for cross-matching. Blood is issued after the cross-match." });
        None
    };
    order["state"] = json!(STATE_CONFIRMED);
    respond(&mut tx, &claims, id, trip, None).await?;
    set_state(&mut tx, id, "confirmed", &order).await?;
    notify(&state, &mut tx, claims.tenant_id, (&row, &payload), order).await?;
    let view = reload(&mut tx, id).await?;
    tx.commit().await?;
    for order_id in placed {
        medbrains_lab::grant_lab_order_access(&state, &claims, order_id, "uhi_lab_request").await?;
    }
    Ok(Json(view))
}

/// `POST /api/uhi/requests/{id}/decline`
///
/// # Errors
/// 400 without a reason; 403 without `uhi.requests.respond`; 409 when it is
/// not pending.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn decline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DeclineRequest>,
) -> Result<Json<UhiRequest>, AppError> {
    require_permission(&claims, permissions::uhi::requests::RESPOND)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "say why, so the patient can look elsewhere".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (row, payload) = pending(&mut tx, claims.tenant_id, id).await?;
    let mut order = row.order_details.clone().unwrap_or_else(|| json!({}));
    order["state"] = json!(STATE_CANCELLED);
    order["cancellation"] = json!({ "reason": { "descriptor": { "name": reason } } });
    respond(&mut tx, &claims, id, None, Some(reason)).await?;
    set_state(&mut tx, id, "declined", &order).await?;
    notify(&state, &mut tx, claims.tenant_id, (&row, &payload), order).await?;
    let view = reload(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(view))
}

async fn respond(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
    trip: Option<Uuid>,
    reason: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE uhi_transactions SET responded_by = $2, responded_at = now(), \
                ambulance_trip_id = COALESCE($3, ambulance_trip_id), decline_reason = $4 \
          WHERE id = $1",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(trip)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The ambulance module's own trip, waiting for a vehicle: the dispatcher
/// assigns one on the ambulance screen, as for a phoned-in request.
async fn create_trip(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    row: &Row,
    order: &Value,
) -> Result<Uuid, AppError> {
    let now = Utc::now();
    let trip_code = format!(
        "TRIP-{}-{}",
        now.format("%Y%m%d%H%M%S"),
        &Uuid::new_v4().simple().to_string()[..8]
    );
    let pickup = pickup_address(order).unwrap_or_else(|| "Address not given".to_owned());
    // A request from a patient's app is triaged by the dispatcher; it starts
    // urgent, and the dispatcher raises it to critical on the call-back.
    Ok(sqlx::query_scalar(
        "INSERT INTO ambulance_trips (tenant_id, trip_code, trip_type, priority, patient_name, \
            patient_phone, pickup_address, clinical_notes, requested_by) \
         VALUES ($1, $2, 'emergency', 'urgent', $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&trip_code)
    .bind(&row.customer_name)
    .bind(&row.customer_phone)
    .bind(&pickup)
    .bind("Requested through UHI (patient app)")
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?)
}

async fn reload(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: Uuid,
) -> Result<UhiRequest, AppError> {
    let row = sqlx::query_as::<_, Row>(&format!(
        "SELECT {COLUMNS} FROM uhi_transactions WHERE id = $1"
    ))
    .bind(id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(row.into())
}

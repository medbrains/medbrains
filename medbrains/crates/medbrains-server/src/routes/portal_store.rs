//! The storefront for a signed-in patient (or pharmacy customer): their
//! cart, an uploaded prescription, checkout, and their orders. The work is
//! `medbrains_pharmacy::storefront`; these handlers bind it to the patient
//! in the token, so there is no id to tamper with and another patient's
//! order is simply not found.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_pharmacy::storefront::{
    cart::{self, Cart, PrescriptionUpload, SetQuantity},
    checkout::{self, CheckoutRequest},
    hold_cart::{self, HeldCart, StorePick},
    orders::{self, StoreOrderView},
    outside::{self, OutsidePrint, OutsidePrintRequest},
    prescription::{OrderedPrescription, order_prescription},
    returns::{self, ReturnRequest, ReturnTicket},
    stores::{self, Serviceability},
    substitution_decide,
};
use medbrains_pharmacy_delivery::choice::DeliveryOffer;
use medbrains_server_core::{error::AppError, state::AppState};
use serde::Deserialize;
use uuid::Uuid;

use super::portal::PatientClaims;

/// `GET /api/portal/store/cart`
#[tracing::instrument(skip_all)]
pub async fn store_cart(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Cart>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let cart = cart::view(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(cart))
}

/// `PUT /api/portal/store/cart/items/{catalog_item_id}` — 0 takes it out.
#[tracing::instrument(skip_all)]
pub async fn store_set_quantity(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(item): Path<Uuid>,
    Json(body): Json<SetQuantity>,
) -> Result<Json<Cart>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    cart::set_quantity(&mut tx, claims.tenant_id, claims.pid, item, body.quantity).await?;
    let cart = cart::view(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(cart))
}

/// `PUT /api/portal/store/cart/prescription` — a photo or PDF, base64.
#[tracing::instrument(skip_all)]
pub async fn store_upload_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<PrescriptionUpload>,
) -> Result<Json<Cart>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    cart::attach_prescription(
        &mut tx,
        state.documents_store.as_ref(),
        claims.tenant_id,
        claims.pid,
        &body,
    )
    .await?;
    let cart = cart::view(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(cart))
}

/// `GET /api/portal/store/delivery-options` — home delivery for this cart,
/// as part 3 offers it.
#[tracing::instrument(skip_all)]
pub async fn store_delivery_options(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<DeliveryOffer>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let offer = checkout::delivery_options(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(offer))
}

/// `POST /api/portal/store/checkout`
#[tracing::instrument(skip_all)]
pub async fn store_checkout(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<CheckoutRequest>,
) -> Result<Json<StoreOrderView>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let order = checkout::checkout(&mut tx, claims.tenant_id, claims.pid, &body).await?;
    tx.commit().await?;
    Ok(Json(order))
}

/// `GET /api/portal/store/orders`
#[tracing::instrument(skip_all)]
pub async fn store_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
) -> Result<Json<Vec<StoreOrderView>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = orders::patient_orders(&mut tx, claims.tenant_id, claims.pid).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/portal/store/orders/{id}` — one of theirs; anyone else's is 404.
#[tracing::instrument(skip_all)]
pub async fn store_order(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StoreOrderView>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = orders::patient_order(&mut tx, claims.tenant_id, claims.pid, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/portal/store/prescriptions/{id}/order` — "order my
/// prescription": the cart filled from one of their own prescriptions.
#[tracing::instrument(skip_all)]
pub async fn store_order_prescription(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderedPrescription>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let ordered = order_prescription(&mut tx, claims.tenant_id, claims.pid, id).await?;
    tx.commit().await?;
    Ok(Json(ordered))
}

#[derive(Debug, Deserialize)]
pub struct HoldBody {
    /// Delivering to this pincode; absent for pickup.
    pub pincode: Option<String>,
    /// For pickup, the pharmacy chosen.
    pub pickup_store_id: Option<Uuid>,
}

/// `POST /api/portal/store/cart/hold` — the patient opened checkout: the
/// cart is held at the pharmacy that will fill it.
#[tracing::instrument(skip_all)]
pub async fn store_hold_cart(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Json(body): Json<HoldBody>,
) -> Result<Json<HeldCart>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let pick = StorePick {
        delivery_pincode: body.pincode.as_deref(),
        pickup_store: body.pickup_store_id,
    };
    let held = hold_cart::hold_cart(&mut tx, claims.tenant_id, claims.pid, &pick).await?;
    tx.commit().await?;
    Ok(Json(held))
}

#[derive(Debug, Deserialize)]
pub struct PincodeQuery {
    pub pincode: Option<String>,
}

/// `GET /api/portal/store/serviceability?pincode=` — whether it is
/// delivered there, and where it can be collected.
#[tracing::instrument(skip_all)]
pub async fn store_serviceability(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Query(q): Query<PincodeQuery>,
) -> Result<Json<Serviceability>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let answer = stores::serviceability(&mut tx, claims.tenant_id, q.pincode.as_deref()).await?;
    tx.commit().await?;
    Ok(Json(answer))
}

/// `POST /api/portal/store/orders/{id}/cancel` — before it is dispensed.
#[tracing::instrument(skip_all)]
pub async fn store_cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StoreOrderView>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    returns::cancel(&mut tx, claims.tenant_id, claims.pid, id).await?;
    let order = orders::patient_order(&mut tx, claims.tenant_id, claims.pid, id).await?;
    tx.commit().await?;
    Ok(Json(order))
}

/// `POST /api/portal/store/orders/{id}/returns` — ask to return medicines.
#[tracing::instrument(skip_all)]
pub async fn store_request_return(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnRequest>,
) -> Result<Json<ReturnTicket>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let ticket = returns::request_return(&mut tx, claims.tenant_id, claims.pid, id, &body).await?;
    tx.commit().await?;
    Ok(Json(ticket))
}

#[derive(Debug, Deserialize)]
pub struct ConsentBody {
    pub accept: bool,
}

/// `POST /api/portal/store/orders/{id}/substitutions/{sid}/consent` — the
/// patient accepts or declines a substitute.
#[tracing::instrument(skip_all)]
pub async fn store_substitution_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path((id, sid)): Path<(Uuid, Uuid)>,
    Json(body): Json<ConsentBody>,
) -> Result<Json<StoreOrderView>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    substitution_decide::patient_consent(&mut tx, claims.tenant_id, claims.pid, sid, body.accept)
        .await?;
    let order = orders::patient_order(&mut tx, claims.tenant_id, claims.pid, id).await?;
    tx.commit().await?;
    Ok(Json(order))
}

/// `POST /api/portal/store/orders/{id}/outside-print` — the patient takes
/// the prescription for these lines to a pharmacy of their choice.
#[tracing::instrument(skip_all)]
pub async fn store_outside_print(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(id): Path<Uuid>,
    Json(body): Json<OutsidePrintRequest>,
) -> Result<Json<OutsidePrint>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let printed = outside::print(
        &mut tx,
        claims.tenant_id,
        id,
        (Some(claims.pid), None),
        &body,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(printed))
}

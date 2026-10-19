//! The storefront for a signed-in patient (or pharmacy customer): their
//! cart, an uploaded prescription, checkout, and their orders. The work is
//! `medbrains_pharmacy::storefront`; these handlers bind it to the patient
//! in the token, so there is no id to tamper with and another patient's
//! order is simply not found.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_pharmacy::storefront::{
    cart::{self, Cart, PrescriptionUpload, SetQuantity},
    checkout::{self, CheckoutRequest},
    orders::{self, StoreOrderView},
    prescription::{OrderedPrescription, order_prescription},
};
use medbrains_pharmacy_delivery::choice::DeliveryOffer;
use medbrains_server_core::{error::AppError, state::AppState};
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

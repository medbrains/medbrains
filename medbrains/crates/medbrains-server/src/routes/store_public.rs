//! The storefront before sign-in: anyone may browse what the hospital's
//! pharmacy sells online — names, INN, prices, schedule badges, stock as a
//! word — and sign in with their mobile to order. Somebody new gets a light
//! pharmacy-customer record (`medbrains_server_services::pharmacy_customer`);
//! a returning patient is matched by their mobile, never duplicated.
//! Rate-limited per IP (`storefront_rate_limit_middleware`) and, for codes,
//! per mobile.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use medbrains_pharmacy::storefront::catalog::{
    ItemPage, SearchQuery, SearchResult, item_page, search,
};
use medbrains_pharmacy::storefront::settings::{About, about, require_open};
use medbrains_server_core::{error::AppError, state::AppState};
use medbrains_server_services::pharmacy_customer::{
    Channel, Found, NewCustomer, Person, resolve, valid_phone,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::portal::{PortalSession, check_code, issue_code, issue_session, spend_code};

async fn tenant(state: &AppState, code: &str) -> Result<Uuid, AppError> {
    sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active = true")
        .bind(code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)
}

/// `GET /api/store/{tenant_code}/items?q=&category=`
#[tracing::instrument(skip_all)]
pub async fn store_items(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResult>, AppError> {
    let tenant_id = tenant(&state, &code).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let result = search(&mut tx, tenant_id, &query).await?;
    tx.commit().await?;
    Ok(Json(result))
}

/// `GET /api/store/{tenant_code}/items/{id}`
#[tracing::instrument(skip_all)]
pub async fn store_item(
    State(state): State<AppState>,
    Path((code, id)): Path<(String, Uuid)>,
) -> Result<Json<ItemPage>, AppError> {
    let tenant_id = tenant(&state, &code).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let page = item_page(&mut tx, tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(page))
}

#[derive(Debug, Deserialize)]
pub struct CodeRequest {
    pub phone: String,
}

/// `POST /api/store/{tenant_code}/otp` — a sign-in code for any mobile: the
/// storefront serves people who are not patients yet. Answers the same
/// whatever happens.
#[tracing::instrument(skip_all)]
pub async fn store_request_code(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Json(body): Json<CodeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ack =
        Json(serde_json::json!({ "status": "ok", "message": "A sign-in code has been sent." }));
    let phone = body.phone.trim();
    if !valid_phone(phone) {
        return Err(AppError::BadRequest(
            "Enter a 10-digit mobile number".to_owned(),
        ));
    }
    let Ok(tenant_id) = tenant(&state, &code).await else {
        return Ok(ack);
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    require_open(&mut tx, tenant_id).await?;
    issue_code(&mut tx, tenant_id, phone).await?;
    tx.commit().await?;
    Ok(ack)
}

#[derive(Debug, Deserialize)]
pub struct StoreSignInRequest {
    pub phone: String,
    pub code: String,
    /// Which of the people sharing this mobile, once asked.
    pub patient_id: Option<Uuid>,
    /// Needed only when nobody has this mobile yet.
    pub customer: Option<NewCustomer>,
}

#[derive(Debug, Default, Serialize)]
pub struct StoreSignIn {
    pub session: Option<PortalSession>,
    /// The code was right but nobody has this mobile: send it again with
    /// the customer's name and address.
    pub needs_details: bool,
    /// Several people share this mobile: send it again with the one ordering.
    pub choose: Vec<Person>,
}

/// `POST /api/store/{tenant_code}/sign-in` — the code stays good across the
/// follow-up steps (who it is, or their details) and is spent on sign-in.
#[tracing::instrument(skip_all)]
pub async fn store_sign_in(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Json(body): Json<StoreSignInRequest>,
) -> Result<Json<StoreSignIn>, AppError> {
    let phone = body.phone.trim();
    let tenant_id = tenant(&state, &code)
        .await
        .map_err(|_| AppError::Unauthorized)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    require_open(&mut tx, tenant_id).await?;
    let Some(otp_id) = check_code(&mut tx, tenant_id, phone, &body.code).await? else {
        tx.commit().await?;
        return Err(AppError::Unauthorized);
    };
    let found = resolve(
        &mut tx,
        tenant_id,
        phone,
        body.patient_id,
        body.customer.as_ref(),
        Channel::Online,
    )
    .await?;
    let patient_id = match found {
        Found::Patient(id) => id,
        Found::Choose(people) => {
            tx.commit().await?;
            return Ok(Json(StoreSignIn {
                choose: people,
                ..StoreSignIn::default()
            }));
        }
        Found::NeedsDetails => {
            tx.commit().await?;
            return Ok(Json(StoreSignIn {
                needs_details: true,
                ..StoreSignIn::default()
            }));
        }
    };
    spend_code(&mut tx, otp_id).await?;
    tx.commit().await?;
    Ok(Json(StoreSignIn {
        session: Some(issue_session(&state, tenant_id, patient_id)?),
        ..StoreSignIn::default()
    }))
}

/// `GET /api/store/{tenant_code}/about` — the legal footer: the pharmacy,
/// its licences, the pharmacist in charge, the grievance officer, and
/// whether it takes orders online.
#[tracing::instrument(skip_all)]
pub async fn store_about(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<About>, AppError> {
    let tenant_id = tenant(&state, &code).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let about = about(&mut tx, tenant_id).await?;
    tx.commit().await?;
    Ok(Json(about))
}

//! The desk's payment-link endpoints. Making, resending and cancelling a
//! link is collecting: the caller needs the `billing.collect.*` lane of
//! every bill on it (#4885). Reading one needs a collect lane or
//! `billing.invoices.view`.
//!
//! - `POST /api/payments/links` — make one, or send the live one again
//! - `GET  /api/payments/links?patient_id=…|invoice_id=…`
//! - `GET  /api/payments/links/{id}`
//! - `POST /api/payments/links/{id}/resend`
//! - `POST /api/payments/links/{id}/cancel`

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_billing::collect::{
    bills::open_bills,
    lanes::{ANY_COLLECT, is_lane, may_collect_bill},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_any_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use super::issue::{LinkSpec, issue};
use super::message::Channel;
use super::provider::{begin, cancel_at, ctx_for};
use super::{LIVE_SQL, PaymentLinkView, VIEW_SELECT, bills_due, close_parent, view};
use crate::online::OnlineError;

/// A patient has this many links listed at most, newest first.
const MAX_LISTED: i64 = 50;

#[derive(Debug, Deserialize)]
pub struct CreateLinkRequest {
    pub patient_id: Uuid,
    /// `department` (this desk's `lane`) or `all`.
    pub scope: String,
    #[serde(default)]
    pub lane: Option<String>,
    /// Narrow the scope to these bills.
    #[serde(default)]
    pub invoice_ids: Option<Vec<Uuid>>,
    /// A part of the due; everything due when absent.
    #[serde(default)]
    pub amount: Option<Decimal>,
    /// `sms` | `whatsapp` | `copy`.
    pub channel: String,
    /// The counter sending it: its own provider, if it has one.
    #[serde(default)]
    pub station_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ResendLinkRequest {
    pub channel: String,
    #[serde(default)]
    pub station_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct LinksQuery {
    pub patient_id: Option<Uuid>,
    pub invoice_id: Option<Uuid>,
}

fn require_read(claims: &Claims) -> Result<(), AppError> {
    let mut allowed = ANY_COLLECT.to_vec();
    allowed.push(permissions::billing::invoices::VIEW);
    require_any_permission(claims, &allowed)
}

async fn require_write(
    state: &AppState,
    claims: &Claims,
    patient_id: Uuid,
) -> Result<(), AppError> {
    require_any_permission(claims, &ANY_COLLECT)?;
    medbrains_billing::require_amount_write(state, claims).await?;
    medbrains_authz_gate::require_patient_billing_access(state, claims, patient_id).await
}

/// The patient's open bills among `wanted`, every one in the caller's lanes.
async fn collectable(
    state: &AppState,
    claims: &Claims,
    patient_id: Uuid,
    wanted: impl Fn(&medbrains_billing::collect::bills::OpenBill) -> bool,
) -> Result<Vec<Uuid>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let open = open_bills(&mut tx, claims.tenant_id, patient_id).await?;
    tx.commit().await?;
    let scoped: Vec<_> = open.into_iter().filter(|b| wanted(b)).collect();
    // A denial covers the whole link: never a link for part of what was asked.
    if scoped.iter().any(|b| !may_collect_bill(claims, &b.lanes)) {
        return Err(AppError::Forbidden);
    }
    if scoped.is_empty() {
        return Err(AppError::BadRequest(
            "Nothing is due on these bills".to_owned(),
        ));
    }
    Ok(scoped.into_iter().map(|b| b.invoice_id).collect())
}

pub async fn create_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLinkRequest>,
) -> Result<Json<PaymentLinkView>, OnlineError> {
    let channel = Channel::for_desk(&body.channel)?;
    let lane = body.lane.as_deref().filter(|l| is_lane(l));
    if body.scope != "all" && !(body.scope == "department" && lane.is_some()) {
        return Err(AppError::BadRequest(
            "Send a link for one department's lane or for all dues".to_owned(),
        )
        .into());
    }
    require_write(&state, &claims, body.patient_id).await?;
    let ids = collectable(&state, &claims, body.patient_id, |b| {
        match &body.invoice_ids {
            Some(ids) => ids.contains(&b.invoice_id),
            None => body.scope == "all" || b.lanes.iter().any(|l| Some(l.as_str()) == lane),
        }
    })
    .await?;
    if body
        .invoice_ids
        .as_ref()
        .is_some_and(|asked| asked.len() != ids.len())
    {
        return Err(
            AppError::BadRequest("A bill named is not open for this patient".to_owned()).into(),
        );
    }
    let spec = LinkSpec {
        tenant_id: claims.tenant_id,
        actor: Some(claims.sub),
        patient_id: body.patient_id,
        scope: body.scope.clone(),
        lane: lane.map(str::to_owned),
        invoice_ids: ids,
        amount: body.amount,
        channel,
        replaces: None,
        station_id: body.station_id,
    };
    Ok(Json(
        issue(&ctx_for(&state, claims.tenant_id, Some(claims.sub)), &spec).await?,
    ))
}

async fn scrubbed(
    state: &AppState,
    claims: &Claims,
    mut rows: Vec<PaymentLinkView>,
) -> Result<Vec<PaymentLinkView>, AppError> {
    if medbrains_billing::amounts_hidden(state, claims).await? {
        for r in &mut rows {
            r.amount = Decimal::ZERO;
            r.amount_paid = Decimal::ZERO;
            r.min_part_amount = None;
        }
    }
    Ok(rows)
}

pub async fn list_links(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<LinksQuery>,
) -> Result<Json<Vec<PaymentLinkView>>, AppError> {
    require_read(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let patient_id = match (q.patient_id, q.invoice_id) {
        (Some(p), None) => p,
        (None, Some(inv)) => sqlx::query_scalar(
            "SELECT patient_id FROM invoices WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL",
        )
        .bind(claims.tenant_id)
        .bind(inv)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?,
        _ => {
            return Err(AppError::BadRequest(
                "Name a patient or a bill, not both".to_owned(),
            ));
        }
    };
    tx.commit().await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PaymentLinkView>(&format!(
        "{VIEW_SELECT} WHERE l.tenant_id = $1 AND l.patient_id = $2 AND l.deleted_at IS NULL \
           AND ($3::uuid IS NULL OR $3 = ANY(l.invoice_ids)) \
         ORDER BY l.created_at DESC LIMIT $4"
    ))
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(q.invoice_id)
    .bind(MAX_LISTED)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(scrubbed(&state, &claims, rows).await?))
}

async fn load(state: &AppState, claims: &Claims, id: Uuid) -> Result<PaymentLinkView, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let link = view(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    medbrains_authz_gate::require_patient_billing_access(state, claims, link.patient_id).await?;
    Ok(link)
}

pub async fn get_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentLinkView>, AppError> {
    require_read(&claims)?;
    let link = load(&state, &claims, id).await?;
    let mut rows = scrubbed(&state, &claims, vec![link]).await?;
    rows.pop().map(Json).ok_or(AppError::NotFound)
}

/// Send it again: the same link if it still asks for what is owed, else a
/// link for what is owed now (the old one is cancelled first).
pub async fn resend_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResendLinkRequest>,
) -> Result<Json<PaymentLinkView>, OnlineError> {
    require_any_permission(&claims, &ANY_COLLECT)?;
    let channel = Channel::for_desk(&body.channel)?;
    let link = load(&state, &claims, id).await?;
    require_write(&state, &claims, link.patient_id).await?;
    let ids = collectable(&state, &claims, link.patient_id, |b| {
        link.invoice_ids.contains(&b.invoice_id)
    })
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let due = bills_due(&mut tx, claims.tenant_id, &ids).await?;
    tx.commit().await?;
    let outstanding = link.amount - link.amount_paid;
    let spec = LinkSpec {
        tenant_id: claims.tenant_id,
        actor: Some(claims.sub),
        patient_id: link.patient_id,
        scope: link.scope.clone(),
        lane: link.lane.clone(),
        invoice_ids: ids,
        amount: (outstanding > Decimal::ZERO && outstanding <= due).then_some(outstanding),
        channel,
        replaces: None,
        station_id: body.station_id,
    };
    Ok(Json(
        issue(&ctx_for(&state, claims.tenant_id, Some(claims.sub)), &spec).await?,
    ))
}

/// Stop a link at the provider, then here. Only a link the provider has
/// confirmed closed is marked cancelled.
pub async fn cancel_balance_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentLinkView>, AppError> {
    require_any_permission(&claims, &ANY_COLLECT)?;
    let link = load(&state, &claims, id).await?;
    require_write(&state, &claims, link.patient_id).await?;
    if !matches!(link.status.as_str(), "created" | "partially_paid") {
        return Err(AppError::Conflict("This link is already closed".to_owned()));
    }
    let ctx = ctx_for(&state, claims.tenant_id, Some(claims.sub));
    let mut tx = begin(&ctx).await?;
    let provider_id: Option<String> =
        sqlx::query_scalar("SELECT provider_link_id FROM payment_links WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    if let Some(provider_id) = provider_id {
        cancel_at(&ctx, &link.provider, &provider_id).await?;
    }
    let mut tx = begin(&ctx).await?;
    let parent: Option<Option<Uuid>> = sqlx::query_scalar(&format!(
        "UPDATE payment_links SET status = 'cancelled', end_reason = 'cancelled_by_staff' \
          WHERE id = $1 AND status IN {LIVE_SQL} RETURNING payment_transaction_id"
    ))
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    close_parent(&mut tx, parent.flatten(), "cancelled_by_staff").await?;
    let link = view(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(link))
}

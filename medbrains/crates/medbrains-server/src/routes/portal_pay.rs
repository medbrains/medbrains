//! `POST /api/portal/bills/{id}/pay` — the patient pays their own bill, in
//! full or in part, through a balance link (#4871). The link replaces any
//! live link on the bill, so only one can be paid; the rest of the bill can
//! still be paid at the counter.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_payment_gateway::balance_link::{
    PaymentLinkView,
    issue::{LinkSpec, ctx_for, issue},
    message::Channel,
};
use medbrains_server_core::{error::AppError, state::AppState};
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use super::portal::PatientClaims;

#[derive(Debug, Deserialize)]
pub struct PortalPayRequest {
    /// A part of the balance; the whole balance when absent.
    #[serde(default)]
    pub amount: Option<Decimal>,
}

pub async fn portal_pay_bill(
    State(state): State<AppState>,
    Extension(claims): Extension<PatientClaims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<PortalPayRequest>,
) -> Result<Json<PaymentLinkView>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // The patient's own bill, or nothing: another patient's bill is a 404.
    let own: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM invoices WHERE tenant_id = $1 AND id = $2 AND patient_id = $3 \
            AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(claims.pid)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    own.ok_or(AppError::NotFound)?;
    let spec = LinkSpec {
        tenant_id: claims.tenant_id,
        actor: None,
        patient_id: claims.pid,
        scope: "bills".to_owned(),
        lane: None,
        invoice_ids: vec![invoice_id],
        amount: body.amount,
        channel: Channel::Portal,
        replaces: None,
    };
    Ok(Json(issue(&ctx_for(&state, claims.tenant_id, None), &spec).await?))
}

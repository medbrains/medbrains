//! A collection's checks on money already on a bill, and its payment events.

use std::collections::HashMap;

use medbrains_core::billing::Payment;
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use uuid::Uuid;

use super::lanes::may_collect_bill;
use crate::PaymentBill;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, sqlx::FromRow)]
struct BillContext {
    id: Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    admission_id: Option<Uuid>,
    lanes: Vec<String>,
}

async fn contexts(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_ids: &[Uuid],
) -> Result<HashMap<Uuid, BillContext>, AppError> {
    let rows = sqlx::query_as::<_, BillContext>(
        "SELECT i.id, i.patient_id, i.encounter_id, i.admission_id, \
                COALESCE( \
                  NULLIF(array_agg(DISTINCT public.billing_item_lane(it.source::text, i.admission_id)) \
                         FILTER (WHERE it.id IS NOT NULL), '{}'), \
                  ARRAY[public.billing_item_lane('manual', i.admission_id)]) AS lanes \
           FROM invoices i \
           LEFT JOIN invoice_items it \
             ON it.invoice_id = i.id AND it.tenant_id = i.tenant_id AND it.deleted_at IS NULL \
          WHERE i.tenant_id = $1 AND i.id = ANY($2) \
          GROUP BY i.id",
    )
    .bind(tenant_id)
    .bind(invoice_ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(|r| (r.id, r)).collect())
}

/// Gateway or card-machine money already on a bill joins a collection only
/// if the caller could have collected that bill.
///
/// # Errors
/// `Forbidden` for a bill outside the caller's lanes; a database fault.
pub(crate) async fn require_linked_lanes(
    tx: &mut Tx<'_>,
    claims: &Claims,
    linked: &[(Uuid, Uuid)],
) -> Result<(), AppError> {
    if linked.is_empty() {
        return Ok(());
    }
    let ids: Vec<Uuid> = linked.iter().map(|(_, invoice)| *invoice).collect();
    let bills = contexts(tx, claims.tenant_id, &ids).await?;
    if bills.values().any(|b| !may_collect_bill(claims, &b.lanes)) {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

/// Queue the payment-received event for each newly posted payment, in the
/// collection's transaction; each with its bill, for announcing after commit.
///
/// # Errors
/// A database fault.
pub(crate) async fn queue(
    tx: &mut Tx<'_>,
    claims: &Claims,
    payments: Vec<Payment>,
) -> Result<Vec<(PaymentBill, Payment)>, AppError> {
    let ids: Vec<Uuid> = payments.iter().map(|p| p.invoice_id).collect();
    let ctx = contexts(tx, claims.tenant_id, &ids).await?;
    let mut out = Vec::with_capacity(payments.len());
    for p in payments {
        let c = ctx.get(&p.invoice_id).ok_or(AppError::NotFound)?;
        let bill = PaymentBill {
            invoice_id: p.invoice_id,
            patient_id: c.patient_id,
            encounter_id: c.encounter_id,
            admission_id: c.admission_id,
        };
        crate::queue_payment_received(tx, claims, &bill, &p).await?;
        out.push((bill, p));
    }
    Ok(out)
}

/// After commit: tell the counter boards and the workflow engine.
pub(crate) async fn announce(state: &AppState, claims: &Claims, paid: &[(PaymentBill, Payment)]) {
    for (bill, payment) in paid {
        crate::announce_payment_received(state, claims, bill, payment).await;
    }
}

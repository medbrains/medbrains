//! Reversing an approved insurer settlement: what it put on the bill comes
//! back off, and the bill owes again. Nothing is edited or hard-deleted — the
//! payment and write-off are soft-deleted with the reason, the posting keeps
//! who reversed it and why, and the audit trigger keeps every row's history.

use medbrains_core::billing::AuditAction;
use rust_decimal::Decimal;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims};

use crate::claim_settlement_post::{Locked, settle_claim};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

pub(crate) async fn reverse(
    tx: &mut Tx<'_>,
    claims: &Claims,
    id: Uuid,
    p: &Locked,
    why: &str,
) -> Result<(), AppError> {
    let reason = format!("Settlement reversed: {why}");
    let paid = p.posted_amount.unwrap_or_default();
    if let Some(payment_id) = p.payment_id {
        sqlx::query(
            "UPDATE payments SET deleted_at = now(), deleted_by = $1, delete_reason = $2 \
              WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL",
        )
        .bind(claims.sub)
        .bind(&reason)
        .bind(payment_id)
        .bind(claims.tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    let written_off = match p.write_off_id {
        Some(wo) => sqlx::query_scalar::<_, Decimal>(
            "UPDATE bad_debt_write_offs SET deleted_at = now(), deleted_by = $1, \
                    delete_reason = $2 \
              WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL RETURNING amount",
        )
        .bind(claims.sub)
        .bind(&reason)
        .bind(wo)
        .bind(claims.tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .unwrap_or_default(),
        None => Decimal::ZERO,
    };
    sqlx::query(
        "UPDATE invoices SET paid_amount = GREATEST(paid_amount - $1 - $2, 0), \
                written_off_amount = GREATEST(written_off_amount - $2, 0), \
                status = CASE \
                  WHEN status IN ('cancelled', 'refunded', 'draft') THEN status \
                  WHEN paid_amount - $1 - $2 <= 0 THEN 'issued'::invoice_status \
                  WHEN paid_amount - $1 - $2 >= total_amount THEN 'paid'::invoice_status \
                  ELSE 'partially_paid'::invoice_status END, \
                updated_at = now() \
          WHERE id = $3 AND tenant_id = $4",
    )
    .bind(paid)
    .bind(written_off)
    .bind(p.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    if p.claim_applied {
        settle_claim(
            tx,
            claims.tenant_id,
            p.insurance_claim_id,
            -p.settled_amount,
        )
        .await?;
    }
    sqlx::query(
        "UPDATE claim_settlement_postings SET status = 'reversed', reversed_by = $1, \
                reversed_at = now(), reversal_reason = $2 WHERE id = $3 AND tenant_id = $4",
    )
    .bind(claims.sub)
    .bind(why)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    crate::log_billing_audit(
        tx,
        claims.tenant_id,
        AuditAction::PaymentVoided,
        "claim_settlement",
        id,
        Some(p.invoice_id),
        Some(p.patient_id),
        Some(paid + written_off),
        Some(serde_json::json!({ "reason": why })),
        claims.sub,
    )
    .await;
    Ok(())
}

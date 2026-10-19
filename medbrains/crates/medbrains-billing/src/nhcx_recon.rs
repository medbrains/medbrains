//! Bank-statement auto-match for money a payer already reported through
//! NHCX. A payment notice settles its claims when it arrives; when the bank
//! credit with the same UTR shows up on the statement it is matched to those
//! claims — and the claims are not settled a second time.

use std::collections::{HashMap, HashSet};

use rust_decimal::Decimal;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, middleware::auth::Claims};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// What the NHCX pass matched, so the claim-number pass skips it.
#[derive(Debug, Default)]
pub(crate) struct NhcxMatched {
    pub(crate) transactions: HashSet<Uuid>,
    pub(crate) variance_flagged: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct Hit {
    transaction_id: Uuid,
    credit_amount: Decimal,
    allocation_id: Uuid,
    claim_id: Uuid,
    net_amount: Decimal,
}

/// Match unmatched credits whose reference (or description) carries the UTR
/// of a posted NHCX payment: one query for the whole statement.
pub(crate) async fn match_nhcx_credits(
    tx: &mut Tx<'_>,
    claims: &Claims,
    transaction_ids: &[Uuid],
) -> Result<NhcxMatched, AppError> {
    let hits = sqlx::query_as::<_, Hit>(
        "SELECT bt.id AS transaction_id, bt.credit_amount, a.id AS allocation_id, \
                a.insurance_claim_id AS claim_id, a.net_amount \
           FROM bank_transactions bt \
           JOIN nhcx_payment_notices n ON n.tenant_id = bt.tenant_id AND n.deleted_at IS NULL \
                AND n.payment_reference IS NOT NULL \
                AND (bt.reference_number = n.payment_reference \
                     OR strpos(COALESCE(bt.description, ''), n.payment_reference) > 0) \
           JOIN nhcx_payment_allocations a ON a.notice_id = n.id AND a.tenant_id = n.tenant_id \
                AND a.status = 'posted' AND a.bank_transaction_id IS NULL AND a.deleted_at IS NULL \
          WHERE bt.tenant_id = $1 AND bt.id = ANY($2) \
          ORDER BY bt.id, a.created_at",
    )
    .bind(claims.tenant_id)
    .bind(transaction_ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_txn: HashMap<Uuid, Vec<&Hit>> = HashMap::new();
    for h in &hits {
        by_txn.entry(h.transaction_id).or_default().push(h);
    }
    let mut out = NhcxMatched::default();
    for (txn, parts) in by_txn {
        let expected: Decimal = parts.iter().map(|h| h.net_amount).sum();
        let credit = parts.first().map_or(Decimal::ZERO, |h| h.credit_amount);
        let variance = expected - credit;
        let status = if variance.abs() < Decimal::ONE {
            "matched"
        } else {
            out.variance_flagged += 1;
            "discrepancy"
        };
        record(tx, claims, (txn, status, variance), &parts).await?;
        out.transactions.insert(txn);
    }
    Ok(out)
}

async fn record(
    tx: &mut Tx<'_>,
    claims: &Claims,
    (txn, status, variance): (Uuid, &str, Decimal),
    parts: &[&Hit],
) -> Result<(), AppError> {
    let claim_ids: Vec<Uuid> = parts.iter().map(|h| h.claim_id).collect();
    let amounts: Vec<Decimal> = parts.iter().map(|h| h.net_amount).collect();
    let allocation_ids: Vec<Uuid> = parts.iter().map(|h| h.allocation_id).collect();
    sqlx::query(
        "UPDATE bank_transactions SET matched_claim_id = $1, recon_status = $2::recon_status, \
                variance_amount = $3, matched_at = now(), matched_by = $4, auto_match_score = 1.0, \
                notes = COALESCE(notes || ' · ', '') || 'NHCX payment notice' \
          WHERE id = $5 AND tenant_id = $6",
    )
    .bind(claim_ids.first())
    .bind(status)
    .bind(variance)
    .bind(claims.sub)
    .bind(txn)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO bank_transaction_claim_allocations \
             (tenant_id, bank_transaction_id, claim_id, allocated_amount, notes, created_by) \
         SELECT $1, $2, c, amt, 'NHCX payment notice', $3 \
           FROM unnest($4::uuid[], $5::numeric[]) AS u(c, amt) \
         ON CONFLICT (bank_transaction_id, claim_id) DO NOTHING",
    )
    .bind(claims.tenant_id)
    .bind(txn)
    .bind(claims.sub)
    .bind(&claim_ids)
    .bind(&amounts)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        "UPDATE nhcx_payment_allocations SET bank_transaction_id = $1 \
          WHERE id = ANY($2) AND tenant_id = $3",
    )
    .bind(txn)
    .bind(&allocation_ids)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

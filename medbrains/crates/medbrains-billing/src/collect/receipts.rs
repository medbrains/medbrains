//! One receipt per legal entity per collection, numbered from that entity's
//! own series for the financial year: `<prefix>/<YY-YY>/<000001>`.
//!
//! The series lives in `sequences` under `RECEIPT:<entity>:<FY start year>`,
//! created on first use and bumped with `UPDATE … RETURNING` inside the
//! collection's transaction, so it is gapless: a rolled-back collection
//! takes no number.

use medbrains_server_core::error::AppError;
use medbrains_server_services::billing::SeqResult;
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// A collection's receipt for one legal entity.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CollectionReceipt {
    pub id: Uuid,
    pub receipt_number: String,
    pub legal_entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub amount: Decimal,
    /// The first payment it covers; prints the receipt.
    pub payment_id: Uuid,
    pub invoice_id: Uuid,
}

#[derive(Debug, sqlx::FromRow)]
struct EntityTotal {
    entity_id: Uuid,
    receipt_prefix: String,
    amount: Decimal,
    payment_id: Uuid,
    invoice_id: Uuid,
}

/// The next number in an entity's receipt series for this financial year
/// (April to March, in the hospital's time zone).
async fn next_number(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    entity_id: Uuid,
    prefix: &str,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "WITH fy AS (SELECT CASE WHEN EXTRACT(MONTH FROM current_date) >= 4 \
                                 THEN EXTRACT(YEAR FROM current_date)::int \
                                 ELSE EXTRACT(YEAR FROM current_date)::int - 1 END AS y) \
         INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
         SELECT $1, 'RECEIPT:' || $2::text || ':' || fy.y, \
                $3 || '/' || lpad((fy.y % 100)::text, 2, '0') || '-' \
                   || lpad(((fy.y + 1) % 100)::text, 2, '0') || '/', 1, 6 \
           FROM fy \
         ON CONFLICT (tenant_id, seq_type) \
         DO UPDATE SET current_val = sequences.current_val + 1, updated_at = now(), \
                       deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .bind(entity_id)
    .bind(prefix)
    .fetch_one(&mut **tx)
    .await?;
    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

/// Issue the collection's receipts: one per legal entity whose bills it paid.
///
/// # Errors
/// A database fault.
pub async fn issue(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    collection_id: Uuid,
) -> Result<Vec<CollectionReceipt>, AppError> {
    let totals = sqlx::query_as::<_, EntityTotal>(
        "SELECT e.id AS entity_id, e.receipt_prefix, SUM(p.amount) AS amount, \
                (array_agg(p.id ORDER BY p.created_at, p.id))[1] AS payment_id, \
                (array_agg(p.invoice_id ORDER BY p.created_at, p.id))[1] AS invoice_id \
           FROM payments p \
           JOIN invoices i ON i.id = p.invoice_id \
           JOIN billing_entities e ON e.id = i.legal_entity_id \
          WHERE p.tenant_id = $1 AND p.collection_id = $2 AND p.deleted_at IS NULL \
          GROUP BY e.id, e.receipt_prefix \
          ORDER BY e.receipt_prefix",
    )
    .bind(tenant_id)
    .bind(collection_id)
    .fetch_all(&mut **tx)
    .await?;
    // ponytail: one round trip per entity; a collection spans one or two.
    for t in &totals {
        let number = next_number(tx, tenant_id, t.entity_id, &t.receipt_prefix).await?;
        sqlx::query(
            "INSERT INTO receipts (tenant_id, receipt_number, invoice_id, payment_id, amount, \
                                   receipt_date, collection_id, legal_entity_id) \
             VALUES ($1, $2, $3, $4, $5, now(), $6, $7)",
        )
        .bind(tenant_id)
        .bind(&number)
        .bind(t.invoice_id)
        .bind(t.payment_id)
        .bind(t.amount)
        .bind(collection_id)
        .bind(t.entity_id)
        .execute(&mut **tx)
        .await?;
    }
    of_collection(tx, tenant_id, collection_id).await
}

/// A collection's receipts.
///
/// # Errors
/// A database fault.
pub async fn of_collection(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    collection_id: Uuid,
) -> Result<Vec<CollectionReceipt>, AppError> {
    Ok(sqlx::query_as::<_, CollectionReceipt>(
        "SELECT r.id, r.receipt_number, r.legal_entity_id, e.name AS entity_name, r.amount, \
                r.payment_id, r.invoice_id \
           FROM receipts r LEFT JOIN billing_entities e ON e.id = r.legal_entity_id \
          WHERE r.tenant_id = $1 AND r.collection_id = $2 AND r.deleted_at IS NULL \
          ORDER BY r.receipt_number",
    )
    .bind(tenant_id)
    .bind(collection_id)
    .fetch_all(&mut **tx)
    .await?)
}

/// The collection receipt that already covers `payment_id`, if it was taken
/// in a collection — so reprinting one leg of a split never mints a second
/// receipt for money a receipt already covers.
///
/// # Errors
/// A database fault.
pub async fn covering(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    payment_id: Uuid,
) -> Result<Option<medbrains_core::billing::Receipt>, AppError> {
    Ok(sqlx::query_as::<_, medbrains_core::billing::Receipt>(
        "SELECT r.* FROM payments p \
           JOIN invoices i ON i.id = p.invoice_id \
           JOIN receipts r ON r.collection_id = p.collection_id \
                          AND r.legal_entity_id = i.legal_entity_id AND r.deleted_at IS NULL \
          WHERE p.id = $1 AND p.tenant_id = $2",
    )
    .bind(payment_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

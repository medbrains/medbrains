//! One numbering path for every pharmacy credit or debit note: the legal
//! entity's own series for the financial year — the entity on the bill, else
//! the hospital's default, else one hospital-wide series — at most 16
//! characters (CGST Act s.34; CGST Rules 2017, Rules 46(b) and 53(1A)).
//!
//! The counter, the online returns desk and the credit-notes screen all
//! draw from here, so a customer credit note is unique in its entity's year
//! whichever screen raised it.

use medbrains_core::pharmacy_returns::note_number;
use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Prefix of the hospital-wide series, when no legal entity is set up.
const DEFAULT_PREFIX: &str = "CN";

/// The next number in series `letter` (see `note_series_letter`) for a note
/// against `invoice_id`.
pub async fn next_number(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Option<Uuid>,
    letter: char,
) -> Result<String, AppError> {
    let entity: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT e.id, e.receipt_prefix FROM billing_entities e \
          WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND e.is_active \
            AND (e.id = (SELECT legal_entity_id FROM invoices WHERE id = $2 AND tenant_id = $1) \
                 OR e.is_default) \
          ORDER BY e.id = (SELECT legal_entity_id FROM invoices WHERE id = $2 AND tenant_id = $1) \
                   IS TRUE DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .fetch_optional(&mut **tx)
    .await?;
    let (key, prefix) = entity.map_or_else(
        || ("tenant".to_owned(), DEFAULT_PREFIX.to_owned()),
        |(id, prefix)| (id.to_string(), prefix),
    );
    let (fy, seq): (i32, i64) = sqlx::query_as(
        "WITH fy AS (SELECT CASE WHEN EXTRACT(MONTH FROM current_date) >= 4 \
                                 THEN EXTRACT(YEAR FROM current_date)::int \
                                 ELSE EXTRACT(YEAR FROM current_date)::int - 1 END AS y) \
         INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
         SELECT $1, $4 || $2 || ':' || fy.y, $3, 1, 5 FROM fy \
         ON CONFLICT (tenant_id, seq_type) \
         DO UPDATE SET current_val = sequences.current_val + 1, updated_at = now(), \
                       deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
         RETURNING (SELECT y FROM fy), current_val::bigint",
    )
    .bind(tenant_id)
    .bind(key)
    .bind(&prefix)
    .bind(series_key(letter))
    .fetch_one(&mut **tx)
    .await?;
    Ok(note_number(&prefix, letter, fy, seq))
}

/// The `sequences.seq_type` stem for series `letter`. `C` keeps the stem the
/// counter has always used, so numbers already issued carry on unbroken.
fn series_key(letter: char) -> String {
    if letter == 'C' {
        "CREDIT_NOTE:".to_owned()
    } else {
        format!("PHARMACY_NOTE_{letter}:")
    }
}

#[cfg(test)]
mod tests {
    use super::series_key;

    #[test]
    fn customer_credit_notes_share_the_counter_series() {
        assert_eq!(series_key('C'), "CREDIT_NOTE:");
        assert_eq!(series_key('D'), "PHARMACY_NOTE_D:");
    }
}

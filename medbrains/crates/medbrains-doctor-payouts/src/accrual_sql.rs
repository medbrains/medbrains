//! The accrual engine's queries: one per bill, never one per line.

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::Tx;

pub const BILL_SQL: &str = "SELECT i.status::text AS status, i.total_amount, i.paid_amount, \
       COALESCE(i.discount_amount, 0) AS discount_amount, \
       COALESCE(c.claim_amount, NULLIF(c.total_bill_amount, 0)) AS claim_amount, c.settled_amount, \
       c.status AS claim_status, c.scheme_type::text AS scheme, \
       CASE WHEN e.visit_type = 'follow_up' THEN 'follow_up' WHEN e.id IS NOT NULL THEN 'first' END AS visit_kind \
  FROM invoices i \
  LEFT JOIN encounters e ON e.id = i.encounter_id \
  LEFT JOIN LATERAL (SELECT ic.claim_amount, ic.total_bill_amount, ic.settled_amount, ic.status, ic.scheme_type \
                       FROM insurance_claims ic \
                      WHERE ic.invoice_id = i.id AND ic.deleted_at IS NULL AND NOT COALESCE(ic.is_secondary, false) \
                        AND ic.status NOT IN ('claim_rejected', 'pre_auth_rejected') \
                      ORDER BY ic.created_at DESC LIMIT 1) c ON true \
 WHERE i.id = $1 AND i.tenant_id = $2 \
   FOR UPDATE OF i";

pub const LINES_SQL: &str = "SELECT ii.id, ii.charge_code, \
       lower(COALESCE(NULLIF(ii.category, ''), cm.category, ii.source::text)) AS category, \
       ii.source::text AS source, ii.department_id, ii.performing_doctor_id, ii.quantity, \
       (ii.unit_price * ii.quantity)::numeric(14,2) AS gross, \
       COALESCE(ii.discount_amount, 0)::numeric(14,2) AS discount, \
       COALESCE(rv.reversed, 0)::numeric(14,2) AS reversed, \
       ii.created_at::date AS service_date, b.anesthetist_id, \
       ARRAY(SELECT (x #>> '{}')::uuid \
               FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.assistant_surgeons) = 'array' \
                                              THEN b.assistant_surgeons ELSE '[]'::jsonb END) x \
              WHERE jsonb_typeof(x) = 'string' \
                AND (x #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AS assistants \
  FROM invoice_items ii \
  LEFT JOIN LATERAL (SELECT m.category FROM charge_master m WHERE m.tenant_id = ii.tenant_id \
                        AND m.code = ii.charge_code AND m.deleted_at IS NULL LIMIT 1) cm ON true \
  LEFT JOIN LATERAL (SELECT SUM(r.unit_price * r.quantity) AS reversed FROM invoice_items r \
                      WHERE r.reversal_of_id = ii.id AND r.deleted_at IS NULL) rv ON true \
  LEFT JOIN ot_bookings b ON ii.source = 'ot' AND b.id = ii.source_id \
 WHERE ii.invoice_id = $1 AND ii.tenant_id = $2 AND ii.reversal_of_id IS NULL \
   AND NOT ii.is_reversal AND ii.deleted_at IS NULL \
 LIMIT 2000";

pub const HELD_SQL: &str = "SELECT invoice_item_id, doctor_id, role, \
       (array_agg(rule_id ORDER BY created_at, id))[1] AS rule_id, \
       (array_agg(agreement_id ORDER BY created_at, id))[1] AS agreement_id, \
       (array_agg(line_amount ORDER BY created_at, id))[1] AS line_amount, \
       (array_agg(base_amount ORDER BY created_at, id))[1] AS base_amount, \
       (array_agg(share_amount ORDER BY created_at, id))[1] AS share_amount, \
       SUM(amount) AS earned, \
       (array_agg(id ORDER BY created_at DESC, id DESC))[1] AS last_id \
  FROM doctor_payout_accruals \
 WHERE tenant_id = $1 AND invoice_id = $2 AND invoice_item_id IS NOT NULL \
   AND doctor_id IS NOT NULL AND deleted_at IS NULL \
 GROUP BY invoice_item_id, doctor_id, role";

pub const INSERT_SQL: &str = "INSERT INTO doctor_payout_accruals (tenant_id, doctor_id, agreement_id, \
       invoice_id, invoice_item_id, role, rule_id, event, basis, payer_class, service_date, line_amount, \
       base_amount, share_amount, fraction, amount, reversal_of_id, reason) \
SELECT $1, t.doctor_id, t.agreement_id, $2, t.item_id, t.role, t.rule_id, t.event, t.basis, $3, \
       t.day, t.line_amount, t.base, t.share, t.fraction, t.amount, t.reversal_of, t.reason \
  FROM UNNEST($4::uuid[], $5::uuid[], $6::uuid[], $7::text[], $8::uuid[], $9::text[], $10::text[], \
              $11::date[], $12::numeric[], $13::numeric[], $14::numeric[], $15::numeric[], \
              $16::numeric[], $17::uuid[], $18::text[]) \
    AS t(doctor_id, agreement_id, item_id, role, rule_id, event, basis, day, line_amount, base, \
         share, fraction, amount, reversal_of, reason)";

/// New ledger rows, column-wise, for one batched insert.
#[derive(Debug, Default)]
pub struct Rows {
    pub doctor: Vec<Uuid>,
    pub agreement: Vec<Uuid>,
    pub item: Vec<Uuid>,
    pub role: Vec<String>,
    pub rule: Vec<Option<Uuid>>,
    pub event: Vec<String>,
    pub basis: Vec<String>,
    pub day: Vec<NaiveDate>,
    pub line_amount: Vec<Decimal>,
    pub base: Vec<Decimal>,
    pub share: Vec<Decimal>,
    pub fraction: Vec<Decimal>,
    pub amount: Vec<Decimal>,
    pub reversal_of: Vec<Option<Uuid>>,
    pub reason: Vec<Option<String>>,
}

pub async fn insert_rows(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
    payer: &str,
    r: &Rows,
) -> Result<(), AppError> {
    sqlx::query(INSERT_SQL)
        .bind(tenant_id)
        .bind(invoice_id)
        .bind(payer)
        .bind(&r.doctor)
        .bind(&r.agreement)
        .bind(&r.item)
        .bind(&r.role)
        .bind(&r.rule)
        .bind(&r.event)
        .bind(&r.basis)
        .bind(&r.day)
        .bind(&r.line_amount)
        .bind(&r.base)
        .bind(&r.share)
        .bind(&r.fraction)
        .bind(&r.amount)
        .bind(&r.reversal_of)
        .bind(&r.reason)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

//! A patient's open bills, with the lanes each one carries — what both the
//! dues screen and a collection read.

use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// A patient has this many open bills at most before the rest are cut off.
/// A real patient has a handful; the cap bounds a runaway account.
pub const MAX_OPEN_BILLS: i64 = 200;

/// An open bill (draft, issued or part-paid) with something still due.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct OpenBill {
    pub invoice_id: Uuid,
    pub invoice_number: String,
    pub status: String,
    pub legal_entity_id: Option<Uuid>,
    pub entity_name: Option<String>,
    pub bill_group_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub total_amount: Decimal,
    pub paid_amount: Decimal,
    pub balance: Decimal,
    /// The lanes of its charges; collecting it needs every one.
    pub lanes: Vec<String>,
}

/// The patient's open bills, oldest first.
///
/// # Errors
/// A database fault.
pub async fn open_bills(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<OpenBill>, AppError> {
    Ok(sqlx::query_as::<_, OpenBill>(
        "SELECT i.id AS invoice_id, i.invoice_number, i.status::text AS status, \
                i.legal_entity_id, e.name AS entity_name, i.bill_group_id, \
                i.encounter_id, i.admission_id, i.total_amount, i.paid_amount, \
                (i.total_amount - i.paid_amount) AS balance, \
                COALESCE( \
                  NULLIF(array_agg(DISTINCT public.billing_item_lane(it.source::text, i.admission_id)) \
                         FILTER (WHERE it.id IS NOT NULL), '{}'), \
                  ARRAY[public.billing_item_lane('manual', i.admission_id)]) AS lanes \
           FROM invoices i \
           LEFT JOIN invoice_items it \
             ON it.invoice_id = i.id AND it.tenant_id = i.tenant_id AND it.deleted_at IS NULL \
           LEFT JOIN billing_entities e ON e.id = i.legal_entity_id \
          WHERE i.tenant_id = $1 AND i.patient_id = $2 AND i.deleted_at IS NULL \
            AND i.status IN ('draft', 'issued', 'partially_paid') \
            AND i.total_amount > i.paid_amount \
          GROUP BY i.id, e.name \
          ORDER BY COALESCE(i.issued_at, i.created_at), i.id \
          LIMIT $3",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(MAX_OPEN_BILLS)
    .fetch_all(&mut **tx)
    .await?)
}

/// Charged amounts on open bills, by the department that earned them.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DepartmentCharge {
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub lane: String,
    pub charged: Decimal,
}

/// What each department charged on the patient's open bills.
///
/// # Errors
/// A database fault.
pub async fn department_charges(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_ids: &[Uuid],
) -> Result<Vec<DepartmentCharge>, AppError> {
    Ok(sqlx::query_as::<_, DepartmentCharge>(
        "SELECT it.department_id, d.name AS department_name, \
                public.billing_item_lane(it.source::text, i.admission_id) AS lane, \
                SUM(it.total_price) AS charged \
           FROM invoice_items it \
           JOIN invoices i ON i.id = it.invoice_id AND i.tenant_id = it.tenant_id \
           LEFT JOIN departments d ON d.id = it.department_id \
          WHERE it.tenant_id = $1 AND it.invoice_id = ANY($2) AND it.deleted_at IS NULL \
          GROUP BY it.department_id, d.name, 3 \
          ORDER BY 4 DESC",
    )
    .bind(tenant_id)
    .bind(invoice_ids)
    .fetch_all(&mut **tx)
    .await?)
}

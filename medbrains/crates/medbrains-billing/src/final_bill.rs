//! The discharge bill checklist (#292): before an admission's final bill goes
//! out, every department's charges are on it, every pharmacy return has been
//! decided, every concession has been decided, and the desk can see what the
//! advance leaves to collect or refund.
//!
//! The same blockers gate `issue_invoice`, so the final bill cannot be issued
//! from any screen while one is open.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// An order the hospital performed that is not on the bill.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UnbilledOrder {
    pub module: String,
    pub order_id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepartmentCharges {
    pub department: String,
    pub amount: Decimal,
    pub lines: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FinalInvoice {
    pub id: Uuid,
    pub invoice_number: String,
    pub status: String,
    pub total_amount: Decimal,
    pub paid_amount: Decimal,
}

/// An advance with money left on it, to apply to the bill or refund.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OpenAdvance {
    pub id: Uuid,
    pub advance_number: String,
    pub balance: Decimal,
}

#[derive(Debug, Serialize)]
pub struct FinalBillChecklist {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    /// The admission's running (non-interim) bill, draft until issued.
    pub invoice: Option<FinalInvoice>,
    pub departments: Vec<DepartmentCharges>,
    pub unbilled_orders: Vec<UnbilledOrder>,
    pub pending_returns: i64,
    pub pending_concessions: i64,
    /// Still owed on interim bills already issued for this stay.
    pub interim_outstanding: Decimal,
    pub advance_balance: Decimal,
    pub advances: Vec<OpenAdvance>,
    /// What the patient pays at discharge; negative means a refund is due.
    pub net_payable: Decimal,
    /// Everything that stops the final bill, in the clerk's words.
    pub blockers: Vec<String>,
}

#[derive(sqlx::FromRow)]
struct Admission {
    patient_id: Uuid,
    encounter_id: Uuid,
}

async fn admission(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    id: Uuid,
) -> Result<Admission, AppError> {
    sqlx::query_as::<_, Admission>(
        "SELECT patient_id, encounter_id FROM admissions \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(tenant)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Lab and imaging orders for the stay with no live charge line.
async fn unbilled_orders(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    encounter: Uuid,
) -> Result<Vec<UnbilledOrder>, AppError> {
    Ok(sqlx::query_as::<_, UnbilledOrder>(
        "SELECT 'lab' AS module, lo.id AS order_id, t.name AS name \
           FROM lab_orders lo JOIN lab_test_catalog t ON t.id = lo.test_id \
          WHERE lo.tenant_id = $1 AND lo.encounter_id = $2 AND lo.deleted_at IS NULL \
            AND lo.status::text <> 'cancelled' \
            AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.tenant_id = lo.tenant_id \
                 AND ii.source = 'lab' AND ii.source_id = lo.id) \
         UNION ALL \
         SELECT 'radiology', ro.id, m.name || COALESCE(' — ' || ro.body_part, '') \
           FROM radiology_orders ro JOIN radiology_modalities m ON m.id = ro.modality_id \
          WHERE ro.tenant_id = $1 AND ro.encounter_id = $2 AND ro.deleted_at IS NULL \
            AND ro.status::text <> 'cancelled' \
            AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.tenant_id = ro.tenant_id \
                 AND ii.source = 'radiology' AND ii.source_id = ro.id) \
          LIMIT 200",
    )
    .bind(tenant)
    .bind(encounter)
    .fetch_all(&mut **tx)
    .await?)
}

/// What stops the final bill; empty means it may be issued.
fn blockers(c: &FinalBillChecklist) -> Vec<String> {
    let mut out = Vec::new();
    if !c.unbilled_orders.is_empty() {
        out.push(format!(
            "{} order(s) done for this stay are not on the bill",
            c.unbilled_orders.len()
        ));
    }
    if c.pending_returns > 0 {
        out.push(format!(
            "{} pharmacy return(s) are waiting for a decision",
            c.pending_returns
        ));
    }
    if c.pending_concessions > 0 {
        out.push(format!(
            "{} concession(s) are waiting for approval",
            c.pending_concessions
        ));
    }
    out
}

/// The checklist for one admission.
pub async fn checklist(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    admission_id: Uuid,
) -> Result<FinalBillChecklist, AppError> {
    let a = admission(tx, tenant, admission_id).await?;
    let invoice = sqlx::query_as::<_, FinalInvoice>(
        "SELECT id, invoice_number, status::text AS status, total_amount, paid_amount \
           FROM invoices \
          WHERE tenant_id = $1 AND (admission_id = $2 OR encounter_id = $3) \
            AND NOT is_interim AND deleted_at IS NULL AND status::text NOT IN ('cancelled', 'void') \
          ORDER BY (status::text = 'draft') DESC, created_at DESC LIMIT 1",
    )
    .bind(tenant)
    .bind(admission_id)
    .bind(a.encounter_id)
    .fetch_optional(&mut **tx)
    .await?;
    let departments =
        match &invoice {
            Some(inv) => sqlx::query_as::<_, DepartmentCharges>(
                "SELECT COALESCE(d.name, 'Other') AS department, SUM(ii.total_price) AS amount, \
                        COUNT(*) AS lines \
                   FROM invoice_items ii LEFT JOIN departments d ON d.id = ii.department_id \
                  WHERE ii.tenant_id = $1 AND ii.invoice_id = $2 \
                  GROUP BY 1 ORDER BY 2 DESC",
            )
            .bind(tenant)
            .bind(inv.id)
            .fetch_all(&mut **tx)
            .await?,
            None => Vec::new(),
        };
    let (pending_returns, pending_concessions, interim_outstanding, advance_balance): (
        i64,
        i64,
        Decimal,
        Decimal,
    ) = sqlx::query_as(
        "SELECT \
           (SELECT COUNT(*) FROM pharmacy_returns WHERE tenant_id = $1 AND patient_id = $2 \
              AND status::text = 'requested' AND deleted_at IS NULL), \
           (SELECT COUNT(*) FROM billing_concessions c JOIN invoices i ON i.id = c.invoice_id \
             WHERE c.tenant_id = $1 AND c.status::text = 'pending' AND c.deleted_at IS NULL \
               AND (i.admission_id = $3 OR i.encounter_id = $4)), \
           (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices \
             WHERE tenant_id = $1 AND is_interim AND (admission_id = $3 OR encounter_id = $4) \
               AND deleted_at IS NULL AND status::text NOT IN ('cancelled', 'void')), \
           (SELECT COALESCE(SUM(balance), 0) FROM patient_advances WHERE tenant_id = $1 \
              AND patient_id = $2 AND status::text IN ('active', 'partially_used') \
              AND deleted_at IS NULL)",
    )
    .bind(tenant)
    .bind(a.patient_id)
    .bind(admission_id)
    .bind(a.encounter_id)
    .fetch_one(&mut **tx)
    .await?;
    let due_on_bill = invoice
        .as_ref()
        .map_or(Decimal::ZERO, |i| i.total_amount - i.paid_amount);
    let advances = sqlx::query_as::<_, OpenAdvance>(
        "SELECT id, advance_number, balance FROM patient_advances WHERE tenant_id = $1 \
            AND patient_id = $2 AND status::text IN ('active', 'partially_used') AND balance > 0 \
            AND deleted_at IS NULL ORDER BY created_at LIMIT 50",
    )
    .bind(tenant)
    .bind(a.patient_id)
    .fetch_all(&mut **tx)
    .await?;
    let mut c = FinalBillChecklist {
        admission_id,
        patient_id: a.patient_id,
        invoice,
        departments,
        unbilled_orders: unbilled_orders(tx, tenant, a.encounter_id).await?,
        pending_returns,
        pending_concessions,
        interim_outstanding,
        advance_balance,
        advances,
        net_payable: due_on_bill + interim_outstanding - advance_balance,
        blockers: Vec::new(),
    };
    c.blockers = blockers(&c);
    Ok(c)
}

/// Refuse to issue an admission's final bill while the checklist is open.
/// Interim bills and bills outside an admission are not affected.
pub async fn ensure_final_bill_ready(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    let admission: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT COALESCE(i.admission_id, a.id) FROM invoices i \
           LEFT JOIN admissions a ON a.encounter_id = i.encounter_id AND a.tenant_id = i.tenant_id \
          WHERE i.id = $1 AND i.tenant_id = $2 AND NOT i.is_interim AND i.status::text = 'draft'",
    )
    .bind(invoice_id)
    .bind(tenant)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(Some(admission_id)) = admission else {
        return Ok(());
    };
    let open = checklist(tx, tenant, admission_id).await?.blockers;
    if open.is_empty() {
        Ok(())
    } else {
        Err(AppError::Conflict(format!(
            "The final bill can't be issued yet: {}.",
            open.join("; ")
        )))
    }
}

/// `GET /api/billing/admissions/{id}/final-bill-checklist`
pub async fn get_final_bill_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FinalBillChecklist>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let c = checklist(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, c.patient_id).await?;
    Ok(Json(c))
}

#[cfg(test)]
mod tests {
    use rust_decimal::Decimal;
    use uuid::Uuid;

    use super::{FinalBillChecklist, UnbilledOrder, blockers};

    fn empty() -> FinalBillChecklist {
        FinalBillChecklist {
            admission_id: Uuid::nil(),
            patient_id: Uuid::nil(),
            invoice: None,
            departments: Vec::new(),
            unbilled_orders: Vec::new(),
            pending_returns: 0,
            pending_concessions: 0,
            interim_outstanding: Decimal::ZERO,
            advance_balance: Decimal::ZERO,
            advances: Vec::new(),
            net_payable: Decimal::ZERO,
            blockers: Vec::new(),
        }
    }

    #[test]
    fn a_clean_stay_has_nothing_blocking() {
        assert!(blockers(&empty()).is_empty());
    }

    #[test]
    fn each_open_item_is_named() {
        let mut c = empty();
        c.unbilled_orders.push(UnbilledOrder {
            module: "lab".to_owned(),
            order_id: Uuid::nil(),
            name: "CBC".to_owned(),
        });
        c.pending_returns = 2;
        c.pending_concessions = 1;
        let b = blockers(&c);
        assert_eq!(b.len(), 3);
        assert!(b[1].contains("2 pharmacy return"));
    }
}

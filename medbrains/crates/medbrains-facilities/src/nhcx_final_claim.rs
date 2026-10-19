//! What a final claim (`Claim.use = claim`) carries beyond a
//! pre-authorisation: the final bill line by line, the bill's split between
//! payer and patient, the discharge summary, and the payer's authorisation
//! number for the stay.

use base64::Engine;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::nhcx_bundle::{DocumentRef, ItemLine};
use crate::nhcx_common::Tx;

/// A live bill line: reversed lines and their reversals cancel out.
#[derive(Debug, FromRow)]
struct BillLine {
    code: String,
    description: String,
    quantity: i32,
    unit_price: Decimal,
    total_price: Decimal,
}

/// The bill's money, as the payer's adjudicator reads it.
#[derive(Debug, FromRow)]
struct BillMoney {
    total_amount: Decimal,
    discount_amount: Decimal,
    claim_amount: Option<Decimal>,
}

/// What the final claim adds to the bundle.
pub(crate) struct FinalClaim {
    pub(crate) items: Vec<ItemLine>,
    pub(crate) total: Decimal,
    pub(crate) notes: Vec<String>,
    pub(crate) documents: Vec<DocumentRef>,
    pub(crate) pre_auth_ref: Option<String>,
}

impl FinalClaim {
    /// The lines as sent, for reading the payer's adjudication back by
    /// sequence.
    pub(crate) fn sent_items(&self) -> Value {
        Value::Array(
            self.items
                .iter()
                .enumerate()
                .map(|(i, l)| {
                    json!({ "sequence": i + 1, "code": l.code, "description": l.description,
                            "quantity": l.quantity, "net": l.net })
                })
                .collect(),
        )
    }
}

/// The claim the final bundle is built for.
pub(crate) struct ClaimRef {
    pub(crate) id: Uuid,
    pub(crate) invoice_id: Uuid,
    pub(crate) admission_id: Option<Uuid>,
    pub(crate) pre_auth_ref: Option<String>,
}

/// Assemble the final claim from the bill.
///
/// # Errors
/// 400 when the bill has no lines, or the stay's discharge summary is not
/// finalised — a final claim without it is only queried back.
pub(crate) async fn load(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    claim: &ClaimRef,
) -> Result<FinalClaim, AppError> {
    let lines = sqlx::query_as::<_, BillLine>(
        "SELECT COALESCE(NULLIF(ii.service_code, ''), ii.charge_code) AS code, ii.description, \
                ii.quantity, ii.unit_price, ii.total_price \
           FROM invoice_items ii \
          WHERE ii.invoice_id = $1 AND ii.tenant_id = $2 AND ii.deleted_at IS NULL \
            AND NOT ii.is_reversal \
            AND NOT EXISTS (SELECT 1 FROM invoice_items r \
                             WHERE r.reversal_of_id = ii.id AND r.deleted_at IS NULL) \
          ORDER BY ii.created_at LIMIT 500",
    )
    .bind(claim.invoice_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    if lines.is_empty() {
        return Err(AppError::BadRequest(
            "the bill has no lines to claim — finalise the bill first".into(),
        ));
    }
    let money = sqlx::query_as::<_, BillMoney>(
        "SELECT i.total_amount, i.discount_amount, c.claim_amount \
           FROM invoices i JOIN insurance_claims c ON c.invoice_id = i.id AND c.tenant_id = i.tenant_id \
          WHERE c.id = $1 AND c.tenant_id = $2",
    )
    .bind(claim.id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let total = money.claim_amount.unwrap_or(money.total_amount);
    let documents = discharge_summary(tx, tenant_id, claim.admission_id).await?;
    let pre_auth_ref = match claim.pre_auth_ref.clone() {
        Some(r) => Some(r),
        None => preauth_number(tx, tenant_id, claim).await?,
    };
    let items = lines
        .into_iter()
        .map(|l| ItemLine {
            code: Some(l.code),
            description: l.description,
            quantity: Some(l.quantity),
            unit_price: Some(l.unit_price),
            net: Some(l.total_price),
        })
        .collect();
    Ok(FinalClaim {
        items,
        total,
        notes: vec![bill_note(&money, total)],
        documents,
        pre_auth_ref,
    })
}

/// The bill's split in words — the Claim resource has no field for the
/// patient's share or a bill-level discount.
fn bill_note(money: &BillMoney, claimed: Decimal) -> String {
    let patient = (money.total_amount - claimed).max(Decimal::ZERO);
    format!(
        "Bill total INR {}; discount INR {}; patient's share INR {} \
         (co-pay, deductible and non-payable items); claimed from the payer INR {}.",
        money.total_amount.round_dp(2),
        money.discount_amount.round_dp(2),
        patient.round_dp(2),
        claimed.round_dp(2),
    )
}

#[derive(Debug, FromRow)]
struct SummaryRow {
    final_diagnosis: Option<String>,
    course_in_hospital: Option<String>,
    treatment_given: Option<String>,
    procedures: Option<String>,
    condition_at_discharge: Option<String>,
    follow_up_instructions: Option<String>,
    legacy: Option<String>,
    finalized_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// The stay's discharge summary as a text attachment. An OPD claim has no
/// stay and needs none.
async fn discharge_summary(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    admission_id: Option<Uuid>,
) -> Result<Vec<DocumentRef>, AppError> {
    let Some(admission_id) = admission_id else {
        return Ok(Vec::new());
    };
    let row = sqlx::query_as::<_, SummaryRow>(
        "SELECT s.final_diagnosis, s.course_in_hospital, s.treatment_given, \
                s.procedures_performed::text AS procedures, s.condition_at_discharge, \
                s.follow_up_instructions, NULLIF(btrim(a.discharge_summary), '') AS legacy, \
                CASE WHEN s.status = 'finalized' THEN COALESCE(s.finalized_at, s.updated_at) \
                     WHEN NULLIF(btrim(a.discharge_summary), '') IS NOT NULL THEN a.updated_at END \
                     AS finalized_at \
           FROM admissions a \
           LEFT JOIN ipd_discharge_summaries s ON s.admission_id = a.id \
                AND s.tenant_id = a.tenant_id AND s.deleted_at IS NULL \
          WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((row, at)) = row.and_then(|r| r.finalized_at.map(|at| (r, at))) else {
        return Err(AppError::BadRequest(
            "finalise the discharge summary before sending the final claim".into(),
        ));
    };
    let text = summary_text(&row);
    Ok(vec![DocumentRef {
        document_type: "Discharge summary".to_owned(),
        file_name: Some("discharge-summary.txt".to_owned()),
        file_path: None,
        mime_type: Some("text/plain".to_owned()),
        created_at: at,
        data: Some(base64::engine::general_purpose::STANDARD.encode(text)),
    }])
}

fn summary_text(r: &SummaryRow) -> String {
    let sections = [
        ("Final diagnosis", &r.final_diagnosis),
        ("Course in hospital", &r.course_in_hospital),
        ("Treatment given", &r.treatment_given),
        ("Procedures performed", &r.procedures),
        ("Condition at discharge", &r.condition_at_discharge),
        ("Follow-up", &r.follow_up_instructions),
        ("Discharge summary", &r.legacy),
    ];
    sections
        .iter()
        .filter_map(|(label, v)| {
            v.as_deref()
                .filter(|t| !t.trim().is_empty() && *t != "[]")
                .map(|t| format!("{label}: {t}"))
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// The payer's authorisation number from a pre-authorisation approved for
/// this claim, its bill or its stay.
async fn preauth_number(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    claim: &ClaimRef,
) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT pa.auth_number FROM prior_auth_requests pa \
          WHERE pa.tenant_id = $1 AND pa.deleted_at IS NULL AND pa.auth_number IS NOT NULL \
            AND pa.status IN ('approved', 'partially_approved') \
            AND (pa.insurance_claim_id = $2 OR pa.invoice_id = $3 \
                 OR pa.encounter_id = (SELECT encounter_id FROM admissions \
                                        WHERE id = $4 AND tenant_id = $1)) \
          ORDER BY pa.responded_at DESC NULLS LAST LIMIT 1",
    )
    .bind(tenant_id)
    .bind(claim.id)
    .bind(claim.invoice_id)
    .bind(claim.admission_id)
    .fetch_optional(&mut **tx)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_bill_note_names_the_patients_share_as_the_unclaimed_rest() {
        let money = BillMoney {
            total_amount: Decimal::new(100_000, 0),
            discount_amount: Decimal::new(2_000, 0),
            claim_amount: Some(Decimal::new(85_000, 0)),
        };
        let note = bill_note(&money, Decimal::new(85_000, 0));
        assert!(note.contains("patient's share INR 15000"), "{note}");
        assert!(note.contains("discount INR 2000"), "{note}");
        assert!(note.contains("claimed from the payer INR 85000"), "{note}");
    }
}

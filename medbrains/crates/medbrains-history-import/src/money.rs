//! Bills with their lines and payments, and insurance claims against them.
//!
//! The totals are computed here from the lines, the way a live bill is, so an
//! imported bill always adds up; payments may not exceed it and are never
//! dated before it. No receipt SMS or payment-link side effect fires.

use chrono::{DateTime, Utc};
use rust_decimal::{Decimal, RoundingStrategy};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::{
    Kind,
    ctx::{Ctx, Ref},
};

const SOURCES: &[&str] = &[
    "opd",
    "ipd",
    "lab",
    "pharmacy",
    "procedure",
    "manual",
    "radiology",
    "ot",
    "emergency",
    "diet",
    "cssd",
    "ambulance",
    "consumable",
    "dental",
    "registration",
];
const MODES: &[&str] = &[
    "cash",
    "card",
    "upi",
    "bank_transfer",
    "cheque",
    "insurance",
    "credit",
    "wallet",
];
const CLAIM_STATUSES: &[&str] = &[
    "initiated",
    "claim_submitted",
    "claim_approved",
    "claim_rejected",
    "settled",
    "partially_settled",
    "cancelled",
];
const SCHEMES: &[&str] = &["private", "cghs", "echs", "pmjay", "esis", "state_scheme"];

#[derive(Debug, Deserialize)]
pub(crate) struct LineRec {
    pub(crate) charge_code: String,
    pub(crate) description: String,
    pub(crate) source: String,
    pub(crate) quantity: i32,
    pub(crate) unit_price: Decimal,
    #[serde(default)]
    pub(crate) tax_percent: Decimal,
}

#[derive(Debug, Deserialize)]
pub(crate) struct PaymentRec {
    pub(crate) amount: Decimal,
    pub(crate) mode: String,
    pub(crate) paid_at: DateTime<Utc>,
    pub(crate) reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct InvoiceRec {
    pub(crate) external_id: String,
    pub(crate) patient: String,
    pub(crate) visit: Option<String>,
    pub(crate) admission: Option<String>,
    pub(crate) invoiced_at: DateTime<Utc>,
    /// The bill number the old system printed; a new one is issued when absent.
    pub(crate) invoice_number: Option<String>,
    pub(crate) items: Vec<LineRec>,
    #[serde(default)]
    pub(crate) discount: Decimal,
    #[serde(default)]
    pub(crate) payments: Vec<PaymentRec>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ClaimRec {
    pub(crate) external_id: String,
    /// External id of the imported bill the claim is made against.
    pub(crate) invoice: String,
    pub(crate) insurance_provider: String,
    pub(crate) policy_number: Option<String>,
    pub(crate) tpa_name: Option<String>,
    pub(crate) claim_type: String,
    pub(crate) scheme_type: Option<String>,
    pub(crate) status: String,
    pub(crate) claim_amount: Decimal,
    pub(crate) approved_amount: Option<Decimal>,
    pub(crate) settled_amount: Option<Decimal>,
    pub(crate) submitted_at: DateTime<Utc>,
    pub(crate) settled_at: Option<DateTime<Utc>>,
}

fn money(d: Decimal) -> Decimal {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

/// Subtotal, tax, total — and a problem for any line that cannot be priced.
fn price(ctx: &mut Ctx<'_>, r: &InvoiceRec) -> (Decimal, Decimal, Decimal) {
    let (mut subtotal, mut tax) = (Decimal::ZERO, Decimal::ZERO);
    if r.items.is_empty() {
        ctx.problem("items", "A bill needs at least one line");
    }
    for line in &r.items {
        if !SOURCES.contains(&line.source.as_str()) {
            ctx.problem(
                "items.source",
                format!("Use one of: {}", SOURCES.join(", ")),
            );
        }
        if line.charge_code.trim().is_empty() || line.description.trim().is_empty() {
            ctx.problem("items", "Every line needs a charge code and a description");
        }
        if line.quantity <= 0
            || line.unit_price.is_sign_negative()
            || line.tax_percent.is_sign_negative()
        {
            ctx.problem(
                "items",
                "Quantity must be positive; price and tax not negative",
            );
        }
        let amount = line.unit_price * Decimal::from(line.quantity);
        subtotal += amount;
        tax += money(amount * line.tax_percent / Decimal::ONE_HUNDRED);
    }
    let total = money(subtotal + tax - r.discount);
    if r.discount.is_sign_negative() || total.is_sign_negative() {
        ctx.problem(
            "discount",
            "The discount cannot be negative or exceed the bill",
        );
    }
    (money(subtotal), tax, total)
}

fn check_payments(ctx: &mut Ctx<'_>, r: &InvoiceRec, total: Decimal) -> Decimal {
    let mut paid = Decimal::ZERO;
    for p in &r.payments {
        if !MODES.contains(&p.mode.as_str()) {
            ctx.problem("payments.mode", format!("Use one of: {}", MODES.join(", ")));
        }
        if p.amount <= Decimal::ZERO {
            ctx.problem("payments.amount", "A payment must be more than zero");
        }
        ctx.past("payments.paid_at", p.paid_at);
        ctx.in_order("payments.paid_at", r.invoiced_at, p.paid_at);
        paid += p.amount;
    }
    if paid > total {
        ctx.problem(
            "payments",
            format!("Payments of {paid} exceed the bill total of {total}"),
        );
    }
    paid
}

pub(crate) async fn invoice(ctx: &mut Ctx<'_>, r: &InvoiceRec) -> Result<Option<Ref>, AppError> {
    let (subtotal, tax, total) = price(ctx, r);
    let paid = check_payments(ctx, r, total);
    let dated = ctx.past("invoiced_at", r.invoiced_at);
    let Some((patient, _)) = ctx.patient(&r.patient) else {
        return Ok(None);
    };
    let episode = if r.visit.is_none() && r.admission.is_none() {
        None
    } else {
        match ctx.episode(r.visit.as_ref(), r.admission.as_ref(), patient) {
            Some(e) => Some(e),
            None => return Ok(None),
        }
    };
    if let Some(e) = episode {
        ctx.in_order("invoiced_at", e.at, r.invoiced_at);
    }
    if !dated {
        return Ok(None);
    }
    // The old system's bill number, or its own HIS- series: never the live invoice
    // sequence, whose row lock would stall live billing for the whole import.
    let number = r
        .invoice_number
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .map_or_else(|| format!("HIS-{}", r.external_id.trim()), str::to_owned);
    let status = if paid.is_zero() {
        "issued"
    } else if paid == total {
        "paid"
    } else {
        "partially_paid"
    };
    let half = money(tax / Decimal::TWO);
    let invoice: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, admission_id, status, subtotal, \
            tax_amount, discount_amount, total_amount, paid_amount, cgst_amount, sgst_amount, notes, issued_at, \
            invoice_date, created_at, updated_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6::invoice_status, $7, $8, $9, $10, $11, $12, $13, 'Historical import', \
            $14, $14, $14, $14, $15) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(&number)
    .bind(patient)
    .bind(episode.and_then(|e| e.encounter))
    .bind(episode.and_then(|e| e.admission))
    .bind(status)
    .bind(subtotal)
    .bind(tax)
    .bind(money(r.discount))
    .bind(total)
    .bind(paid)
    .bind(half)
    .bind(tax - half)
    .bind(r.invoiced_at)
    .bind(ctx.user)
    .fetch_one(&mut *ctx.tx)
    .await?;
    insert_lines(ctx, invoice, r).await?;
    insert_payments(ctx, invoice, r, episode.and_then(|e| e.admission)).await?;
    ctx.record_provenance("invoices", invoice, r.invoiced_at)
        .await?;
    Ok(Some(Ref {
        id: invoice,
        patient,
        encounter: episode.and_then(|e| e.encounter),
        admission: episode.and_then(|e| e.admission),
        at: r.invoiced_at,
    }))
}

async fn insert_lines(ctx: &mut Ctx<'_>, invoice: Uuid, r: &InvoiceRec) -> Result<(), AppError> {
    for line in &r.items {
        let amount = line.unit_price * Decimal::from(line.quantity);
        let line_tax = money(amount * line.tax_percent / Decimal::ONE_HUNDRED);
        let line_half = money(line_tax / Decimal::TWO);
        sqlx::query(
            "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, source, quantity, unit_price, \
                tax_percent, total_price, gst_rate, cgst_amount, sgst_amount, source_module, created_at) \
             VALUES ($1, $2, $3, $4, $5::charge_source, $6, $7, $8, $9, $8, $10, $11, 'historical_import', $12)",
        )
        .bind(ctx.tenant)
        .bind(invoice)
        .bind(line.charge_code.trim())
        .bind(line.description.trim())
        .bind(&line.source)
        .bind(line.quantity)
        .bind(line.unit_price)
        .bind(line.tax_percent)
        .bind(money(amount + line_tax))
        .bind(line_half)
        .bind(line_tax - line_half)
        .bind(r.invoiced_at)
        .execute(&mut *ctx.tx)
        .await?;
    }
    Ok(())
}

async fn insert_payments(
    ctx: &mut Ctx<'_>,
    invoice: Uuid,
    r: &InvoiceRec,
    admission: Option<Uuid>,
) -> Result<(), AppError> {
    for p in &r.payments {
        sqlx::query(
            "INSERT INTO payments (tenant_id, invoice_id, amount, mode, reference_number, received_by, notes, paid_at, \
                created_at, updated_at, admission_id) \
             VALUES ($1, $2, $3, $4::payment_mode, $5, $6, 'Historical import', $7, $7, $7, $8)",
        )
        .bind(ctx.tenant)
        .bind(invoice)
        .bind(money(p.amount))
        .bind(&p.mode)
        .bind(&p.reference)
        .bind(ctx.user)
        .bind(p.paid_at)
        .bind(admission)
        .execute(&mut *ctx.tx)
        .await?;
    }
    Ok(())
}

pub(crate) async fn claim(ctx: &mut Ctx<'_>, r: &ClaimRec) -> Result<Option<Ref>, AppError> {
    let bill = ctx.refs.get(&(Kind::Invoice, r.invoice.clone())).copied();
    if bill.is_none() {
        ctx.problem(
            "invoice",
            format!("No imported bill has the id {}", r.invoice),
        );
    }
    if !CLAIM_STATUSES.contains(&r.status.as_str()) {
        ctx.problem(
            "status",
            format!("Use one of: {}", CLAIM_STATUSES.join(", ")),
        );
    }
    if !["cashless", "reimbursement"].contains(&r.claim_type.as_str()) {
        ctx.problem("claim_type", "Use cashless or reimbursement");
    }
    if let Some(s) = r.scheme_type.as_deref().filter(|s| !SCHEMES.contains(s)) {
        ctx.problem(
            "scheme_type",
            format!("{s} is not a scheme; use one of: {}", SCHEMES.join(", ")),
        );
    }
    if r.insurance_provider.trim().is_empty() {
        ctx.problem("insurance_provider", "Name the insurer");
    }
    let approved = r.approved_amount.unwrap_or_default();
    let settled = r.settled_amount.unwrap_or_default();
    if r.claim_amount <= Decimal::ZERO
        || approved > r.claim_amount
        || settled > approved.max(r.claim_amount)
    {
        ctx.problem(
            "amounts",
            "The claim must be positive, and approval and settlement cannot exceed it",
        );
    }
    let mut dated = ctx.past("submitted_at", r.submitted_at);
    if let Some(s) = r.settled_at {
        dated &= ctx.past("settled_at", s) & ctx.in_order("settled_at", r.submitted_at, s);
    }
    let Some(bill) = bill else { return Ok(None) };
    dated &= ctx.in_order("submitted_at", bill.at, r.submitted_at);
    if !dated {
        return Ok(None);
    }
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO insurance_claims (tenant_id, invoice_id, patient_id, insurance_provider, policy_number, tpa_name, \
            claim_type, scheme_type, status, claim_amount, approved_amount, settled_amount, submitted_at, settled_at, \
            notes, created_by, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::insurance_scheme_type, $9, $10, $11, $12, $13, $14, \
            'Historical import', $15, $13, COALESCE($14, $13)) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(bill.id)
    .bind(bill.patient)
    .bind(r.insurance_provider.trim())
    .bind(&r.policy_number)
    .bind(&r.tpa_name)
    .bind(&r.claim_type)
    .bind(&r.scheme_type)
    .bind(&r.status)
    .bind(money(r.claim_amount))
    .bind(r.approved_amount.map(money))
    .bind(r.settled_amount.map(money))
    .bind(r.submitted_at)
    .bind(r.settled_at)
    .bind(ctx.user)
    .fetch_one(&mut *ctx.tx)
    .await?;
    ctx.record_provenance("insurance_claims", id, r.submitted_at)
        .await?;
    Ok(Some(Ref {
        id,
        patient: bill.patient,
        encounter: bill.encounter,
        admission: bill.admission,
        at: r.submitted_at,
    }))
}

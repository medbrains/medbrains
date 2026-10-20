//! The ways a collection is paid, and the gateway and card-machine money a
//! collection takes over rather than posting again.

use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// A collection takes at most this many tenders.
pub const MAX_TENDERS: usize = 10;

/// The `payment_mode` values a desk takes by hand.
const MANUAL_MODES: [&str; 6] = ["cash", "card", "upi", "bank_transfer", "cheque", "wallet"];

/// One way the patient paid.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenderInput {
    pub mode: String,
    /// What this tender pays. Taken from the provider for a gateway or
    /// card-machine payment.
    #[serde(default)]
    pub amount: Option<Decimal>,
    /// UTR, cheque number, card approval code.
    #[serde(default)]
    pub reference: Option<String>,
    /// An approved gateway, UPI QR or card-machine payment.
    #[serde(default, alias = "terminal_sale_id")]
    pub gateway_transaction_id: Option<Uuid>,
}

/// A tender, resolved.
#[derive(Debug, Clone)]
pub enum Tender {
    /// Money to post now across the bills in scope.
    Post {
        mode: String,
        amount: Decimal,
        reference: Option<String>,
        /// An approved payment that was not on any bill yet; it now is.
        gateway_txn: Option<Uuid>,
    },
    /// Money the gateway or machine already posted on a bill: the collection
    /// takes the payment row over; nothing is posted twice.
    Linked {
        payment_id: Uuid,
        invoice_id: Uuid,
        amount: Decimal,
    },
}

impl Tender {
    #[must_use]
    pub const fn amount(&self) -> Decimal {
        match self {
            Self::Post { amount, .. } | Self::Linked { amount, .. } => *amount,
        }
    }
}

fn manual(input: &TenderInput) -> Result<Tender, AppError> {
    let mode = input.mode.trim();
    if !MANUAL_MODES.contains(&mode) {
        return Err(AppError::BadRequest(format!(
            "'{mode}' is not a way to pay at the desk"
        )));
    }
    let amount = input.amount.unwrap_or_default().round_dp(2);
    if amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Each payment must be more than zero".to_owned(),
        ));
    }
    let reference = input
        .reference
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .map(str::to_owned);
    if mode != "cash" && reference.is_none() {
        return Err(AppError::BadRequest(format!(
            "A {mode} payment needs its reference"
        )));
    }
    Ok(Tender::Post {
        mode: mode.to_owned(),
        amount,
        reference,
        gateway_txn: None,
    })
}

#[derive(Debug, sqlx::FromRow)]
struct GatewayRow {
    invoice_id: Option<Uuid>,
    patient_id: Option<Uuid>,
    status: String,
    held: bool,
    claimed: bool,
    pos_sale: bool,
    approved: Decimal,
    gateway_payment_id: Option<String>,
    payment_method: Option<String>,
    on_machine: bool,
}

/// The payment mode a provider's method word posts as.
fn mode_of(row: &GatewayRow) -> Option<&'static str> {
    if row.on_machine {
        return Some("card");
    }
    match row.payment_method.as_deref() {
        Some("card") => Some("card"),
        Some("upi") => Some("upi"),
        Some("wallet") => Some("wallet"),
        Some("netbanking") => Some("bank_transfer"),
        _ => None,
    }
}

fn conflict(why: &str) -> AppError {
    AppError::Conflict(why.to_owned())
}

async fn gateway(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    txn_id: Uuid,
) -> Result<Tender, AppError> {
    let row = sqlx::query_as::<_, GatewayRow>(
        "SELECT g.invoice_id, i.patient_id, g.status, \
                COALESCE((g.notes->>'held_for_finance')::boolean, false) AS held, \
                g.notes ? 'collection_id' AS claimed, \
                g.pharmacy_pos_sale_id IS NOT NULL AS pos_sale, \
                COALESCE((g.notes->>'approved_amount')::numeric, g.amount) AS approved, \
                g.gateway_payment_id, g.payment_method, g.terminal_id IS NOT NULL AS on_machine \
           FROM payment_gateway_transactions g \
           LEFT JOIN invoices i ON i.id = g.invoice_id \
          WHERE g.id = $1 AND g.tenant_id = $2 \
          FOR UPDATE OF g",
    )
    .bind(txn_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if row.status != "captured" {
        return Err(conflict("That payment is not approved yet"));
    }
    if row.held || row.pos_sale || row.claimed {
        return Err(conflict(
            "That payment is held for finance or already paid something else",
        ));
    }
    match row.invoice_id {
        Some(invoice_id) => linked(tx, tenant_id, patient_id, invoice_id, &row).await,
        None => Ok(Tender::Post {
            mode: mode_of(&row)
                .ok_or_else(|| conflict("That payment's method has no payment mode"))?
                .to_owned(),
            amount: row.approved.round_dp(2),
            reference: row.gateway_payment_id,
            gateway_txn: Some(txn_id),
        }),
    }
}

async fn linked(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    invoice_id: Uuid,
    row: &GatewayRow,
) -> Result<Tender, AppError> {
    if row.patient_id != Some(patient_id) {
        return Err(conflict("That payment is on another patient's bill"));
    }
    let payment: Option<(Uuid, Decimal)> = sqlx::query_as(
        "SELECT id, amount FROM payments \
          WHERE tenant_id = $1 AND invoice_id = $2 AND reference_number = $3 \
            AND deleted_at IS NULL AND collection_id IS NULL \
          ORDER BY created_at LIMIT 1 FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(row.gateway_payment_id.as_deref())
    .fetch_optional(&mut **tx)
    .await?;
    let (payment_id, amount) = payment
        .ok_or_else(|| conflict("That payment is not on the bill, or is already counted"))?;
    Ok(Tender::Linked {
        payment_id,
        invoice_id,
        amount,
    })
}

/// Resolve every tender, or refuse the collection.
///
/// # Errors
/// A tender that is not a desk mode, has no amount or reference, or names a
/// gateway payment that is not approved or already used; a database fault.
pub async fn resolve(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    inputs: &[TenderInput],
) -> Result<Vec<Tender>, AppError> {
    if inputs.is_empty() || inputs.len() > MAX_TENDERS {
        return Err(AppError::BadRequest(format!(
            "Add between 1 and {MAX_TENDERS} ways of paying"
        )));
    }
    let mut seen: Vec<Uuid> = Vec::with_capacity(inputs.len());
    let mut tenders = Vec::with_capacity(inputs.len());
    for input in inputs {
        if let Some(txn) = input.gateway_transaction_id {
            if seen.contains(&txn) {
                return Err(AppError::BadRequest(
                    "The same approved payment is listed twice".to_owned(),
                ));
            }
            seen.push(txn);
        }
        tenders.push(match input.gateway_transaction_id {
            Some(txn) => gateway(tx, tenant_id, patient_id, txn).await?,
            None => manual(input)?,
        });
    }
    Ok(tenders)
}

/// Bind a gateway payment that was on no bill to the first bill it paid, so
/// it is never taken by another collection or sale.
///
/// # Errors
/// A database fault.
pub async fn bind_gateway(
    tx: &mut Tx<'_>,
    txn_id: Uuid,
    invoice_id: Uuid,
    collection_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE payment_gateway_transactions \
            SET invoice_id = $2, \
                notes = notes || jsonb_build_object('collection_id', $3::text), \
                updated_at = now() \
          WHERE id = $1 AND invoice_id IS NULL",
    )
    .bind(txn_id)
    .bind(invoice_id)
    .bind(collection_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(mode: &str, amount: i64, reference: Option<&str>) -> TenderInput {
        TenderInput {
            mode: mode.to_owned(),
            amount: Some(Decimal::from(amount)),
            reference: reference.map(str::to_owned),
            gateway_transaction_id: None,
        }
    }

    #[test]
    fn cash_needs_no_reference_but_upi_does() {
        assert!(manual(&input("cash", 100, None)).is_ok());
        assert!(manual(&input("upi", 100, None)).is_err());
        assert!(manual(&input("upi", 100, Some("UTR1"))).is_ok());
    }

    #[test]
    fn credit_and_zero_amounts_are_not_desk_payments() {
        assert!(manual(&input("credit", 100, None)).is_err());
        assert!(manual(&input("cash", 0, None)).is_err());
    }
}

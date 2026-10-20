//! A card sale as the counter shows it: one stage word and a plain sentence.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

#[derive(Debug, Serialize)]
pub struct PosSaleView {
    pub transaction_id: Uuid,
    pub terminal_id: Uuid,
    pub terminal_label: String,
    pub invoice_id: Option<Uuid>,
    pub amount: Decimal,
    /// What the card covered, once approved (less than `amount` when partial).
    pub approved_amount: Option<Decimal>,
    /// sent | waiting | cancelling | approved | declined | timed_out | cancelled | failed | refunded
    pub stage: &'static str,
    pub message: String,
    pub is_final: bool,
    pub reference: Option<String>,
    pub card_last4: Option<String>,
    pub auth_code: Option<String>,
    /// Approved, but the bill could not take it; finance has it.
    pub held_for_finance: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct Row {
    id: Uuid,
    terminal_id: Uuid,
    terminal_label: String,
    invoice_id: Option<Uuid>,
    amount: Decimal,
    status: String,
    error_code: Option<String>,
    error_description: Option<String>,
    notes: Value,
    gateway_payment_id: Option<String>,
    card_last4: Option<String>,
    card_auth_code: Option<String>,
    created_at: DateTime<Utc>,
}

/// The stage and the sentence the counter shows for a sale row.
pub fn stage_of(
    status: &str,
    error_code: Option<&str>,
    notes: &Value,
) -> (&'static str, &'static str) {
    match (status, error_code) {
        ("captured", _) => ("approved", "Approved"),
        ("refunded", _) => ("refunded", "Refunded to the card"),
        ("expired", _) => ("timed_out", "Timed out — no money was taken"),
        ("failed", Some("declined")) => ("declined", "Declined — no money was taken"),
        ("failed", Some("cancelled")) => ("cancelled", "Cancelled — no money was taken"),
        ("failed", Some("offline")) => (
            "failed",
            "The card machine could not be reached — nothing was charged",
        ),
        ("failed", _) => (
            "failed",
            "The card machine's provider refused it — nothing was charged",
        ),
        _ if notes["cancel_requested"] == Value::Bool(true) => {
            ("cancelling", "Cancelling on the machine…")
        }
        ("created", _) if notes["stage"] == "waiting" => (
            "waiting",
            "Waiting for the card — ask the patient to tap, insert or swipe",
        ),
        _ => ("sent", "Sending to the card machine…"),
    }
}

fn message(
    row: &Row,
    stage: &'static str,
    base: &str,
    approved: Option<Decimal>,
    held: bool,
) -> String {
    let detail = row.error_description.as_deref().filter(|d| !d.is_empty());
    match stage {
        "approved" if held => {
            "Approved on the card, but the bill could not take it — finance has the payment"
                .to_owned()
        }
        "approved" => match approved {
            Some(a) if a < row.amount => format!(
                "Approved ₹{a} of ₹{} — take the remaining ₹{} another way",
                row.amount,
                row.amount - a
            ),
            _ => format!("Approved — ₹{} paid by card", row.amount),
        },
        "declined" | "failed" => detail.map_or_else(|| base.to_owned(), |d| format!("{base}. {d}")),
        "timed_out" => detail.unwrap_or(base).to_owned(),
        _ => base.to_owned(),
    }
}

/// The counter's view of one sale.
pub async fn view(db: &PgPool, tenant_id: Uuid, id: Uuid) -> Result<PosSaleView, AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let row = sqlx::query_as::<_, Row>(
        "SELECT g.id, g.terminal_id, t.label AS terminal_label, g.invoice_id, g.amount, g.status, \
                g.error_code, g.error_description, g.notes, g.gateway_payment_id, g.card_last4, \
                g.card_auth_code, g.created_at \
           FROM payment_gateway_transactions g JOIN payment_terminals t ON t.id = g.terminal_id \
          WHERE g.id = $1 AND g.tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    let (stage, base) = stage_of(&row.status, row.error_code.as_deref(), &row.notes);
    let approved = row.notes["approved_amount"]
        .as_str()
        .and_then(|a| a.parse().ok())
        .or((stage == "approved").then_some(row.amount));
    let held = row.notes["held_for_finance"] == Value::Bool(true);
    Ok(PosSaleView {
        message: message(&row, stage, base, approved, held),
        transaction_id: row.id,
        terminal_id: row.terminal_id,
        terminal_label: row.terminal_label,
        invoice_id: row.invoice_id,
        amount: row.amount,
        approved_amount: if stage == "approved" { approved } else { None },
        stage,
        is_final: !matches!(stage, "sent" | "waiting" | "cancelling"),
        reference: row.gateway_payment_id,
        card_last4: row.card_last4,
        auth_code: row.card_auth_code,
        held_for_finance: held,
        created_at: row.created_at,
    })
}

#[cfg(test)]
mod tests {
    use super::stage_of;
    use serde_json::json;

    #[test]
    fn each_row_state_reads_as_one_plain_stage() {
        let none = json!({});
        assert_eq!(stage_of("pending_gateway", None, &none).0, "sent");
        assert_eq!(
            stage_of("created", None, &json!({ "stage": "waiting" })).0,
            "waiting"
        );
        assert_eq!(
            stage_of("created", None, &json!({ "cancel_requested": true })).0,
            "cancelling"
        );
        assert_eq!(stage_of("captured", None, &none).0, "approved");
        assert_eq!(stage_of("failed", Some("declined"), &none).0, "declined");
        assert_eq!(stage_of("failed", Some("cancelled"), &none).0, "cancelled");
        assert_eq!(stage_of("expired", None, &none).0, "timed_out");
        assert_eq!(stage_of("failed", Some("offline"), &none).0, "failed");
    }
}

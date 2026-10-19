//! Bill verification — what the QR on a printed bill resolves to.
//!
//! An insurer, an employer reimbursing a claim, or the patient themselves can
//! check that a bill is one the hospital really issued and that its total has
//! not been altered. The link carries the invoice number and the bill's own
//! code; the number alone would let anyone walk the sequence. The answer
//! carries no patient detail — the holder already has the paper.

use axum::{
    Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};

use medbrains_server_core::{error::AppError, state::AppState};

#[derive(Debug, Deserialize)]
pub struct VerifyBillQuery {
    /// Invoice number, as printed.
    pub n: String,
    /// The bill's verification code, as in its QR.
    pub c: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VerifiedBill {
    pub hospital_name: String,
    pub invoice_number: String,
    pub invoice_date: chrono::NaiveDate,
    pub total_amount: rust_decimal::Decimal,
    pub paid_amount: rust_decimal::Decimal,
    pub status: String,
}

/// `GET /api/public/bills/verify?n=INV-…&c=…` — 404 for any mismatch, so a
/// wrong code and an unknown number answer the same.
pub async fn verify_bill(
    State(state): State<AppState>,
    Query(q): Query<VerifyBillQuery>,
) -> Result<Json<VerifiedBill>, AppError> {
    sqlx::query_as::<_, VerifiedBill>("SELECT * FROM app_verify_invoice($1, $2)")
        .bind(q.n.trim())
        .bind(q.c.trim())
        .fetch_optional(&state.db)
        .await?
        .map(Json)
        .ok_or(AppError::NotFound)
}

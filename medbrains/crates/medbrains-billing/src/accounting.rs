//! Double-entry accounting for billing: chart of accounts, journal entries,
//! bank reconciliation, TDS, GST returns, the HSN summary, the financial MIS
//! and the ERP export.
//!
//! Split out of `lib.rs` (a 9,217-line file) as a pure move — no behaviour
//! change. This is a genuinely separate concern from raising and settling an
//! invoice: the ledger is what the finance team reconciles and files returns
//! from, on its own permissions, long after the patient has gone home.
//!
//! Like `reports.rs`, nothing here carries a record check: these read
//! `invoices` and `invoice_items` to sum them, never to show one, so the
//! ledger's PHI flag is the linked-table heuristic rather than a gap.
//! `export_to_erp` is the one to watch — the only handler here that sends
//! anything outward. It must stay restricted to invoice totals and tax codes;
//! the moment it carries a patient identifier it needs a per-record decision,
//! not a module-level permission.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::{
    AuditAction, BankTransaction, ErpExportLog, GlAccount, GstReturnSummary, JournalEntry,
    JournalEntryLine, TdsDeduction,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{require_any_permission, require_permission},
    },
    state::AppState,
};
use medbrains_server_services::billing::SeqResult;

// Shared with the invoicing side of the crate: the audit trail every billing
// write appends to, and the GST row shape the print path also builds.
use crate::{HsnSummaryRow, log_billing_audit};

// ══════════════════════════════════════════════════════════
//  Phase 3 — GL Accounts (Chart of Accounts)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct GlAccountQuery {
    pub account_type: Option<String>,
}

pub async fn list_gl_accounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<GlAccountQuery>,
) -> Result<Json<Vec<GlAccount>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::journal::LIST,
            permissions::billing::journal::CREATE,
            permissions::billing::journal::POST,
        ],
    )?;

    let mut tx =
        medbrains_kernel::begin(&state.db, medbrains_kernel::Actor::from_claims(&claims)).await?;

    let rows = sqlx::query_as::<_, GlAccount>(
        "SELECT * FROM gl_accounts WHERE tenant_id = $1 AND deleted_at IS NULL \
         AND ($2::text IS NULL OR account_type = $2) \
         ORDER BY code LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.account_type.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateGlAccountRequest {
    pub code: String,
    pub name: String,
    pub account_type: String,
    pub parent_id: Option<Uuid>,
    pub description: Option<String>,
}

pub async fn create_gl_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGlAccountRequest>,
) -> Result<Json<GlAccount>, AppError> {
    require_permission(&claims, permissions::billing::journal::CREATE)?;

    let mut tx =
        medbrains_kernel::begin(&state.db, medbrains_kernel::Actor::from_claims(&claims)).await?;

    let row = sqlx::query_as::<_, GlAccount>(
        "INSERT INTO gl_accounts \
         (tenant_id, code, name, account_type, parent_id, description) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.account_type)
    .bind(body.parent_id)
    .bind(body.description.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateGlAccountRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

pub async fn update_gl_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateGlAccountRequest>,
) -> Result<Json<GlAccount>, AppError> {
    require_permission(&claims, permissions::billing::journal::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, GlAccount>(
        "UPDATE gl_accounts SET \
         name = COALESCE($3, name), \
         description = COALESCE($4, description), \
         is_active = COALESCE($5, is_active) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.as_deref())
    .bind(body.description.as_deref())
    .bind(body.is_active)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Journal Entries (Double-Entry Accounting)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct JournalEntryQuery {
    pub status: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn list_journal_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<JournalEntryQuery>,
) -> Result<Json<Vec<JournalEntry>>, AppError> {
    require_permission(&claims, permissions::billing::journal::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE tenant_id = $1 AND deleted_at IS NULL \
         AND ($2::text IS NULL OR status::text = $2) \
         AND ($3::date IS NULL OR entry_date >= $3) \
         AND ($4::date IS NULL OR entry_date <= $4) \
         ORDER BY entry_date DESC, created_at DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(params.status.as_deref())
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct JournalEntryDetail {
    pub entry: JournalEntry,
    pub lines: Vec<JournalEntryLine>,
}

pub async fn get_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntryDetail>, AppError> {
    require_permission(&claims, permissions::billing::journal::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines \
         WHERE journal_entry_id = $1 AND tenant_id = $2 ORDER BY created_at LIMIT 5000",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(JournalEntryDetail { entry, lines }))
}

#[derive(Debug, Deserialize)]
pub struct JournalLineInput {
    pub account_id: Uuid,
    pub department_id: Option<Uuid>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub narration: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJournalEntryRequest {
    pub entry_date: NaiveDate,
    pub description: Option<String>,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub lines: Vec<JournalLineInput>,
}

/// Record a manual journal entry as a draft, once its lines are one-sided, positive and
/// balanced (`journal_rules`).
pub async fn create_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateJournalEntryRequest>,
) -> Result<Json<JournalEntryDetail>, AppError> {
    require_permission(&claims, permissions::billing::journal::CREATE)?;

    let sides: Vec<(Decimal, Decimal)> = body
        .lines
        .iter()
        .map(|l| (l.debit_amount, l.credit_amount))
        .collect();
    let total = crate::journal_rules::check_journal_lines(&sides)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    let (total_debit, total_credit) = (total, total);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry_number = generate_je_number(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, JournalEntry>(
        "INSERT INTO journal_entries \
         (tenant_id, entry_number, entry_date, entry_type, status, \
          total_debit, total_credit, description, reference_type, reference_id, created_by) \
         VALUES ($1, $2, $3, 'manual', 'draft', $4, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&entry_number)
    .bind(body.entry_date)
    .bind(total_debit)
    .bind(total_credit)
    .bind(body.description.as_deref())
    .bind(body.reference_type.as_deref())
    .bind(body.reference_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let mut lines = Vec::with_capacity(body.lines.len());
    for line in &body.lines {
        let l = sqlx::query_as::<_, JournalEntryLine>(
            "INSERT INTO journal_entry_lines \
             (tenant_id, journal_entry_id, account_id, department_id, \
              debit_amount, credit_amount, narration) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(entry.id)
        .bind(line.account_id)
        .bind(line.department_id)
        .bind(line.debit_amount)
        .bind(line.credit_amount)
        .bind(line.narration.as_deref())
        .fetch_one(&mut *tx)
        .await?;
        lines.push(l);
    }

    tx.commit().await?;
    Ok(Json(JournalEntryDetail { entry, lines }))
}

async fn generate_je_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'JOURNAL_ENTRY' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let seq =
        seq.ok_or_else(|| AppError::Internal("JOURNAL_ENTRY sequence not configured".to_owned()))?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

pub async fn post_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntry>, AppError> {
    require_permission(&claims, permissions::billing::journal::POST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, JournalEntry>(
        "UPDATE journal_entries SET \
         status = 'posted', posted_by = $3, posted_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Audit log
    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::JournalEntryPosted,
        "journal_entry",
        entry.id,
        None,
        None,
        Some(entry.total_debit),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(entry))
}

pub async fn reverse_journal_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<JournalEntryDetail>, AppError> {
    require_permission(&claims, permissions::billing::journal::POST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Mark original as reversed
    let updated = sqlx::query(
        "UPDATE journal_entries SET status = 'reversed' \
         WHERE id = $1 AND tenant_id = $2 AND status = 'posted'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Get original lines
    let original_lines = sqlx::query_as::<_, JournalEntryLine>(
        "SELECT * FROM journal_entry_lines \
         WHERE journal_entry_id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total_debit: Decimal = original_lines.iter().map(|l| l.credit_amount).sum();
    let total_credit: Decimal = original_lines.iter().map(|l| l.debit_amount).sum();

    let entry_number = generate_je_number(&mut tx, &claims.tenant_id).await?;

    // Create reversal entry (swap debits/credits)
    let reversal = sqlx::query_as::<_, JournalEntry>(
        "INSERT INTO journal_entries \
         (tenant_id, entry_number, entry_date, entry_type, status, \
          total_debit, total_credit, description, reversal_of_id, \
          posted_by, posted_at, created_by) \
         VALUES ($1, $2, CURRENT_DATE, 'manual', 'posted', $3, $4, \
          $5, $6, $7, now(), $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&entry_number)
    .bind(total_debit)
    .bind(total_credit)
    .bind(format!("Reversal of JE {id}"))
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let mut rev_lines = Vec::with_capacity(original_lines.len());
    for line in &original_lines {
        let l = sqlx::query_as::<_, JournalEntryLine>(
            "INSERT INTO journal_entry_lines \
             (tenant_id, journal_entry_id, account_id, department_id, \
              debit_amount, credit_amount, narration) \
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(reversal.id)
        .bind(line.account_id)
        .bind(line.department_id)
        .bind(line.credit_amount) // swap
        .bind(line.debit_amount) // swap
        .bind(line.narration.as_deref())
        .fetch_one(&mut *tx)
        .await?;
        rev_lines.push(l);
    }

    tx.commit().await?;
    Ok(Json(JournalEntryDetail {
        entry: reversal,
        lines: rev_lines,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Bank Reconciliation
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct BankTransactionQuery {
    pub recon_status: Option<String>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn list_bank_transactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<BankTransactionQuery>,
) -> Result<Json<Vec<BankTransaction>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::bank_recon::LIST,
            permissions::billing::bank_recon::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BankTransaction>(
        "SELECT * FROM bank_transactions WHERE tenant_id = $1 AND deleted_at IS NULL \
         AND ($2::text IS NULL OR recon_status::text = $2) \
         AND ($3::date IS NULL OR transaction_date >= $3) \
         AND ($4::date IS NULL OR transaction_date <= $4) \
         ORDER BY transaction_date DESC LIMIT 1000",
    )
    .bind(claims.tenant_id)
    .bind(params.recon_status.as_deref())
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct ImportBankTransactionRow {
    pub bank_name: String,
    pub account_number: String,
    pub transaction_date: NaiveDate,
    pub value_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub running_balance: Option<Decimal>,
    pub reference_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ImportBankTransactionsRequest {
    pub transactions: Vec<ImportBankTransactionRow>,
    pub import_batch: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportBankTransactionsResponse {
    pub imported: i32,
    pub import_batch: String,
}

/// A statement line is money in or money out, never both, never neither, never negative; an
/// empty import is refused rather than recorded as a batch of nothing.
///
/// # Errors
/// 400 naming the first bad line (1-based, as on the statement).
fn validate_statement_lines(rows: &[ImportBankTransactionRow]) -> Result<(), AppError> {
    if rows.is_empty() {
        return Err(AppError::BadRequest(
            "The statement has no lines.".to_owned(),
        ));
    }
    for (index, row) in rows.iter().enumerate() {
        let (debit, credit) = (row.debit_amount, row.credit_amount);
        let one_sided = (debit > Decimal::ZERO) != (credit > Decimal::ZERO);
        if debit < Decimal::ZERO || credit < Decimal::ZERO || !one_sided {
            return Err(AppError::BadRequest(format!(
                "Line {}: give either a debit or a credit, as a positive amount.",
                index + 1
            )));
        }
    }
    Ok(())
}

/// Load a bank statement's lines as one import batch, all or none, each line unmatched.
pub async fn import_bank_transactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ImportBankTransactionsRequest>,
) -> Result<Json<ImportBankTransactionsResponse>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;
    validate_statement_lines(&body.transactions)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batch = body
        .import_batch
        .unwrap_or_else(|| format!("IMPORT-{}", chrono::Utc::now().format("%Y%m%d%H%M%S")));

    let mut count = 0i32;
    for row in &body.transactions {
        sqlx::query(
            "INSERT INTO bank_transactions \
             (tenant_id, bank_name, account_number, transaction_date, value_date, \
              description, debit_amount, credit_amount, running_balance, \
              reference_number, import_batch) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        )
        .bind(claims.tenant_id)
        .bind(&row.bank_name)
        .bind(&row.account_number)
        .bind(row.transaction_date)
        .bind(row.value_date)
        .bind(row.description.as_deref())
        .bind(row.debit_amount)
        .bind(row.credit_amount)
        .bind(row.running_balance)
        .bind(row.reference_number.as_deref())
        .bind(&batch)
        .execute(&mut *tx)
        .await?;
        count += 1;
    }

    tx.commit().await?;
    Ok(Json(ImportBankTransactionsResponse {
        imported: count,
        import_batch: batch,
    }))
}

#[derive(Debug, Deserialize)]
pub struct MatchBankTransactionRequest {
    pub payment_id: Option<Uuid>,
    pub refund_id: Option<Uuid>,
    pub notes: Option<String>,
}

/// Serialise reconciliation for one tenant inside the caller's transaction, so a manual match
/// and an auto-reconcile run cannot both claim the same payment.
async fn lock_reconciliation(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext('bank_recon:' || $1::text))")
        .bind(tenant_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// What a bank line is matched to: money in matches a payment, money out a refund.
enum ReconTarget {
    Payment(Uuid),
    Refund(Uuid),
}

impl ReconTarget {
    /// Exactly one of `payment_id` and `refund_id`.
    fn from_request(body: &MatchBankTransactionRequest) -> Result<Self, AppError> {
        match (body.payment_id, body.refund_id) {
            (Some(id), None) => Ok(Self::Payment(id)),
            (None, Some(id)) => Ok(Self::Refund(id)),
            _ => Err(AppError::BadRequest(
                "Match a bank line to one payment or one refund.".to_owned(),
            )),
        }
    }
}

/// The amount of the completed payment or refund `target`, if it exists and no other live bank
/// line already holds it.
///
/// # Errors
/// 400 when it is not a live completed payment or refund of this tenant; 409 when another bank
/// line is already matched to it.
async fn target_amount(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    line_id: Uuid,
    target: &ReconTarget,
) -> Result<Decimal, AppError> {
    let (amount, taken) = match target {
        ReconTarget::Payment(id) => {
            let amount = sqlx::query_scalar::<_, Decimal>(
                "SELECT amount FROM payments WHERE id = $1 AND tenant_id = $2 \
                 AND deleted_at IS NULL AND status = 'completed'",
            )
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
            let taken = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM bank_transactions WHERE tenant_id = $1 \
                 AND matched_payment_id = $2 AND id <> $3 AND deleted_at IS NULL)",
            )
            .bind(tenant_id)
            .bind(id)
            .bind(line_id)
            .fetch_one(&mut **tx)
            .await?;
            (amount, taken)
        }
        ReconTarget::Refund(id) => {
            let amount = sqlx::query_scalar::<_, Decimal>(
                "SELECT amount FROM refunds WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
            )
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
            let taken = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM bank_transactions WHERE tenant_id = $1 \
                 AND matched_refund_id = $2 AND id <> $3 AND deleted_at IS NULL)",
            )
            .bind(tenant_id)
            .bind(id)
            .bind(line_id)
            .fetch_one(&mut **tx)
            .await?;
            (amount, taken)
        }
    };
    let amount = amount.ok_or_else(|| {
        AppError::BadRequest(
            "That is not a completed payment or refund of this hospital.".to_owned(),
        )
    })?;
    if taken {
        return Err(AppError::Conflict(
            "Another bank line is already matched to that payment or refund.".to_owned(),
        ));
    }
    Ok(amount)
}

/// Match one statement line to one payment (money in) or one refund (money out) by hand.
///
/// A line is matched once; a payment or refund backs one line. A difference between the bank
/// amount and the receipt (card fees, short credit) is kept as `variance_amount` and the line
/// is marked `discrepancy` for review, never `matched`.
pub async fn match_bank_transaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<MatchBankTransactionRequest>,
) -> Result<Json<BankTransaction>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;
    let target = ReconTarget::from_request(&body)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    lock_reconciliation(&mut tx, claims.tenant_id).await?;

    let (status, credit, debit) = sqlx::query_as::<_, (String, Decimal, Decimal)>(
        "SELECT recon_status::text, credit_amount, debit_amount FROM bank_transactions \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if status != "unmatched" {
        return Err(AppError::Conflict(format!(
            "This bank line is already {status}; it cannot be matched again."
        )));
    }
    let bank_amount = match target {
        ReconTarget::Payment(_) if credit > Decimal::ZERO => credit,
        ReconTarget::Refund(_) if debit > Decimal::ZERO => debit,
        ReconTarget::Payment(_) => {
            return Err(AppError::BadRequest(
                "A payment matches money received; this line is money paid out.".to_owned(),
            ));
        }
        ReconTarget::Refund(_) => {
            return Err(AppError::BadRequest(
                "A refund matches money paid out; this line is money received.".to_owned(),
            ));
        }
    };
    let variance = bank_amount - target_amount(&mut tx, claims.tenant_id, id, &target).await?;

    let row = sqlx::query_as::<_, BankTransaction>(
        "UPDATE bank_transactions SET \
         recon_status = CASE WHEN $7 = 0 THEN 'matched' ELSE 'discrepancy' END::recon_status, \
         matched_payment_id = $3, matched_refund_id = $4, \
         matched_by = $5, matched_at = now(), variance_amount = $7, \
         notes = COALESCE($6, notes) \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.payment_id)
    .bind(body.refund_id)
    .bind(claims.sub)
    .bind(body.notes.as_deref())
    .bind(variance)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize)]
pub struct AutoReconcileResponse {
    pub matched_count: i32,
    pub unmatched_count: i64,
}

/// Match unmatched bank credits to completed payments one-to-one and report what is left.
pub async fn auto_reconcile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoReconcileResponse>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    lock_reconciliation(&mut tx, claims.tenant_id).await?;

    // Match bank credits to completed payments of the same amount within a day, by reference
    // when the bank gives one. One-to-one: each line takes its best payment and each payment its
    // best line; a pair is matched only when both agree, so two equal credits never claim the
    // same receipt. Ambiguous lines stay unmatched for a person (or the next run) to decide.
    let matched = sqlx::query_scalar::<_, Uuid>(
        "WITH candidates AS ( \
           SELECT bt.id AS bt_id, p.id AS pay_id, \
             ROW_NUMBER() OVER (PARTITION BY bt.id \
               ORDER BY ABS(p.paid_at::date - bt.transaction_date), p.paid_at, p.id) AS bt_rank, \
             ROW_NUMBER() OVER (PARTITION BY p.id \
               ORDER BY ABS(p.paid_at::date - bt.transaction_date), bt.transaction_date, bt.id) \
               AS pay_rank \
           FROM bank_transactions bt \
           JOIN payments p ON p.tenant_id = bt.tenant_id \
             AND p.amount = bt.credit_amount \
             AND p.deleted_at IS NULL AND p.status = 'completed' \
             AND ABS(p.paid_at::date - bt.transaction_date) <= 1 \
             AND (bt.reference_number IS NULL OR p.reference_number = bt.reference_number) \
           WHERE bt.tenant_id = $1 AND bt.recon_status = 'unmatched' \
             AND bt.deleted_at IS NULL AND bt.credit_amount > 0 \
             AND NOT EXISTS (SELECT 1 FROM bank_transactions o \
                             WHERE o.tenant_id = $1 AND o.matched_payment_id = p.id \
                               AND o.deleted_at IS NULL) \
         ) \
         UPDATE bank_transactions SET \
           recon_status = 'matched', matched_payment_id = m.pay_id, variance_amount = 0, \
           matched_by = $2, matched_at = now() \
         FROM candidates m \
         WHERE bank_transactions.id = m.bt_id AND m.bt_rank = 1 AND m.pay_rank = 1 \
         RETURNING bank_transactions.id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?
    .len();

    let unmatched = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM bank_transactions \
         WHERE tenant_id = $1 AND recon_status = 'unmatched' AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AutoReconcileResponse {
        matched_count: i32::try_from(matched).unwrap_or(0),
        unmatched_count: unmatched,
    }))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — TDS Management
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct TdsQuery {
    pub financial_year: Option<String>,
    pub quarter: Option<String>,
    pub status: Option<String>,
}

pub async fn list_tds_deductions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TdsQuery>,
) -> Result<Json<Vec<TdsDeduction>>, AppError> {
    require_permission(&claims, permissions::billing::tds::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TdsDeduction>(
        "SELECT * FROM tds_deductions WHERE tenant_id = $1 AND deleted_at IS NULL \
         AND ($2::text IS NULL OR financial_year = $2) \
         AND ($3::text IS NULL OR quarter = $3) \
         AND ($4::text IS NULL OR status::text = $4) \
         ORDER BY deducted_date DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.financial_year.as_deref())
    .bind(params.quarter.as_deref())
    .bind(params.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateTdsRequest {
    pub invoice_id: Option<Uuid>,
    pub deductee_name: String,
    pub deductee_pan: String,
    pub tds_section: String,
    pub tds_rate: Decimal,
    pub base_amount: Decimal,
    pub deducted_date: NaiveDate,
    pub financial_year: String,
    pub quarter: String,
}

/// The Indian financial year (`2026-27`) and TDS quarter (`Q1` April–June … `Q4` January–March)
/// a deduction on `date` belongs to: the return (24Q/26Q) it is reported in.
fn tds_period_of(date: NaiveDate) -> (String, &'static str) {
    use chrono::Datelike;
    let (start, quarter) = match date.month() {
        4..=6 => (date.year(), "Q1"),
        7..=9 => (date.year(), "Q2"),
        10..=12 => (date.year(), "Q3"),
        _ => (date.year() - 1, "Q4"),
    };
    (format!("{start}-{:02}", (start + 1) % 100), quarter)
}

/// A PAN is five letters, four digits and a letter (`ABCDE1234F`).
fn is_pan(pan: &str) -> bool {
    let b = pan.as_bytes();
    b.len() == 10
        && b[..5].iter().all(u8::is_ascii_uppercase)
        && b[5..9].iter().all(u8::is_ascii_digit)
        && b[9].is_ascii_uppercase()
}

/// Refuse a deduction that would misstate the TDS return: a malformed PAN, a base amount or
/// rate that is not positive (or a rate over 100%), or a financial year and quarter that are
/// not the ones the deduction date falls in.
///
/// # Errors
/// 400 saying which.
fn validate_tds_request(body: &CreateTdsRequest, pan: &str) -> Result<(), AppError> {
    let bad = |msg: &str| Err(AppError::BadRequest(msg.to_owned()));
    if body.deductee_name.trim().is_empty() {
        return bad("The deductee's name is required.");
    }
    if !is_pan(pan) {
        return bad("The PAN must be five letters, four digits and a letter (ABCDE1234F).");
    }
    if body.base_amount <= Decimal::ZERO {
        return bad("The amount paid must be more than zero.");
    }
    if body.tds_rate <= Decimal::ZERO || body.tds_rate > Decimal::from(100) {
        return bad("The TDS rate is a percentage above 0 and at most 100.");
    }
    let (year, quarter) = tds_period_of(body.deducted_date);
    if body.financial_year != year || body.quarter != quarter {
        return Err(AppError::BadRequest(format!(
            "A deduction on {} belongs to {year} {quarter}.",
            body.deducted_date
        )));
    }
    Ok(())
}

/// Record tax deducted at source on a payment, as the deductor, for the quarter's TDS return.
pub async fn create_tds_deduction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTdsRequest>,
) -> Result<Json<TdsDeduction>, AppError> {
    require_permission(&claims, permissions::billing::tds::MANAGE)?;
    let pan = body.deductee_pan.trim().to_ascii_uppercase();
    validate_tds_request(&body, &pan)?;

    let tds_amount = (body.base_amount * body.tds_rate / Decimal::from(100)).round_dp(2);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TdsDeduction>(
        "INSERT INTO tds_deductions \
         (tenant_id, invoice_id, deductee_name, deductee_pan, tds_section, \
          tds_rate, base_amount, tds_amount, deducted_date, financial_year, quarter, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.deductee_name.trim())
    .bind(&pan)
    .bind(&body.tds_section)
    .bind(body.tds_rate)
    .bind(body.base_amount)
    .bind(tds_amount)
    .bind(body.deducted_date)
    .bind(&body.financial_year)
    .bind(&body.quarter)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct DepositTdsRequest {
    pub challan_number: String,
    pub challan_date: NaiveDate,
}

/// A deduction's status and deduction date, locked for the change about to be made.
///
/// # Errors
/// 404 when there is no live deduction with this id.
async fn tds_state(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<(String, NaiveDate), AppError> {
    sqlx::query_as::<_, (String, NaiveDate)>(
        "SELECT status::text, deducted_date FROM tds_deductions \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// Record the challan that deposited a deduction with the government.
pub async fn deposit_tds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DepositTdsRequest>,
) -> Result<Json<TdsDeduction>, AppError> {
    require_permission(&claims, permissions::billing::tds::MANAGE)?;
    let challan = body.challan_number.trim();
    if challan.is_empty() {
        return Err(AppError::BadRequest(
            "The challan number is required.".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (status, deducted) = tds_state(&mut tx, claims.tenant_id, id).await?;
    if status != "deducted" {
        return Err(AppError::Conflict(format!(
            "This deduction is already {status}; its challan cannot change."
        )));
    }
    if body.challan_date < deducted {
        return Err(AppError::BadRequest(
            "Tax cannot be deposited before it was deducted.".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, TdsDeduction>(
        "UPDATE tds_deductions SET \
         status = 'deposited', challan_number = $3, challan_date = $4 \
         WHERE id = $1 AND tenant_id = $2 AND status = 'deducted' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(challan)
    .bind(body.challan_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct IssueTdsCertRequest {
    pub certificate_number: String,
    pub certificate_date: NaiveDate,
}

/// Record the Form 16A certificate given to the deductee for a deposited deduction.
pub async fn issue_tds_certificate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IssueTdsCertRequest>,
) -> Result<Json<TdsDeduction>, AppError> {
    require_permission(&claims, permissions::billing::tds::MANAGE)?;
    if body.certificate_number.trim().is_empty() {
        return Err(AppError::BadRequest(
            "The certificate number is required.".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (status, _) = tds_state(&mut tx, claims.tenant_id, id).await?;
    if status != "deposited" {
        return Err(AppError::Conflict(format!(
            "A certificate (Form 16A) is issued only once the tax is deposited; this deduction \
             is {status}."
        )));
    }

    let row = sqlx::query_as::<_, TdsDeduction>(
        "UPDATE tds_deductions SET \
         status = 'certificate_issued', \
         certificate_number = $3, certificate_date = $4 \
         WHERE id = $1 AND tenant_id = $2 AND status = 'deposited' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.certificate_number)
    .bind(body.certificate_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — GST Return Summaries
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct GenerateGstrRequest {
    pub return_type: String,
    pub period: String,
}

/// Refuse a return this hospital cannot compute from its own sales: a return type other than
/// GSTR-1 or GSTR-3B (GSTR-2B is the portal's statement of input tax credit on purchases; it is
/// downloaded, never built from sales invoices), or a period that is not a real `YYYY-MM`.
///
/// # Errors
/// 400 saying which.
fn validate_gstr_request(body: &GenerateGstrRequest) -> Result<(), AppError> {
    if !matches!(body.return_type.as_str(), "GSTR-1" | "GSTR-3B") {
        return Err(AppError::BadRequest(
            "Only GSTR-1 and GSTR-3B are prepared from the hospital's invoices; GSTR-2B is \
             downloaded from the GST portal."
                .to_owned(),
        ));
    }
    let is_month = body.period.len() == 7
        && NaiveDate::parse_from_str(&format!("{}-01", body.period), "%Y-%m-%d").is_ok();
    if !is_month {
        return Err(AppError::BadRequest(
            "The period is a month, written YYYY-MM.".to_owned(),
        ));
    }
    Ok(())
}

/// Prepare (or re-prepare) a draft GSTR-1 / GSTR-3B summary for one month from issued invoices.
///
/// A return already filed or accepted is the record of what was declared to the government and
/// is never recomputed: changes after filing go in a later period's amendment, so a second
/// generate for that month answers 409 and leaves the filed figures as they were.
pub async fn generate_gstr_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateGstrRequest>,
) -> Result<Json<GstReturnSummary>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::MANAGE)?;
    validate_gstr_request(&body)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Aggregate from invoices for the period (YYYY-MM format)
    let totals = sqlx::query_as::<_, GstTotals>(
        "SELECT \
         COALESCE(SUM(subtotal), 0) AS total_taxable, \
         COALESCE(SUM(cgst_amount), 0) AS total_cgst, \
         COALESCE(SUM(sgst_amount), 0) AS total_sgst, \
         COALESCE(SUM(igst_amount), 0) AS total_igst, \
         COALESCE(SUM(cess_amount), 0) AS total_cess, \
         COALESCE(SUM(tax_amount), 0) AS total_tax, \
         COUNT(*)::int AS invoice_count \
         FROM invoices WHERE tenant_id = $1 \
         AND status IN ('issued', 'partially_paid', 'paid') \
         AND TO_CHAR(issued_at, 'YYYY-MM') = $2",
    )
    .bind(claims.tenant_id)
    .bind(&body.period)
    .fetch_one(&mut *tx)
    .await?;

    // HSN summary as JSONB
    let hsn = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(row_to_json(h)), '[]'::json)::jsonb FROM ( \
           SELECT COALESCE(ii.hsn_sac_code, 'N/A') AS hsn_code, \
           SUM(ii.unit_price * ii.quantity) AS taxable, \
           SUM(ii.cgst_amount) AS cgst, SUM(ii.sgst_amount) AS sgst, \
           SUM(ii.igst_amount) AS igst, COUNT(*) AS items \
           FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
           WHERE ii.tenant_id = $1 \
           AND i.status IN ('issued', 'partially_paid', 'paid') \
           AND TO_CHAR(i.issued_at, 'YYYY-MM') = $2 \
           GROUP BY ii.hsn_sac_code \
         ) h",
    )
    .bind(claims.tenant_id)
    .bind(&body.period)
    .fetch_one(&mut *tx)
    .await?;

    // Upsert summary
    let row = sqlx::query_as::<_, GstReturnSummary>(
        "INSERT INTO gst_return_summaries \
         (tenant_id, return_type, period, total_taxable, total_cgst, total_sgst, \
          total_igst, total_cess, total_tax, hsn_summary, invoice_count) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         ON CONFLICT (tenant_id, return_type, period) DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
         total_taxable = EXCLUDED.total_taxable, \
         total_cgst = EXCLUDED.total_cgst, \
         total_sgst = EXCLUDED.total_sgst, \
         total_igst = EXCLUDED.total_igst, \
         total_cess = EXCLUDED.total_cess, \
         total_tax = EXCLUDED.total_tax, \
         hsn_summary = EXCLUDED.hsn_summary, \
         invoice_count = EXCLUDED.invoice_count, \
         filing_status = 'draft' \
         WHERE gst_return_summaries.filing_status NOT IN ('filed', 'accepted') \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.return_type)
    .bind(&body.period)
    .bind(totals.total_taxable)
    .bind(totals.total_cgst)
    .bind(totals.total_sgst)
    .bind(totals.total_igst)
    .bind(totals.total_cess)
    .bind(totals.total_tax)
    .bind(&hsn)
    .bind(totals.invoice_count)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict(format!(
            "The {} for {} is already filed; record later changes as amendments in a later \
             period's return.",
            body.return_type, body.period
        ))
    })?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, sqlx::FromRow)]
struct GstTotals {
    total_taxable: Decimal,
    total_cgst: Decimal,
    total_sgst: Decimal,
    total_igst: Decimal,
    total_cess: Decimal,
    total_tax: Decimal,
    invoice_count: i32,
}

pub async fn list_gstr_summaries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<GstReturnSummary>>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, GstReturnSummary>(
        "SELECT * FROM gst_return_summaries WHERE tenant_id = $1 AND deleted_at IS NULL \
         ORDER BY period DESC, return_type LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Mark a draft or validated summary as filed, by whom and when.
///
/// # Errors
/// 404 when there is no such summary; 409 when it is already filed or accepted.
pub async fn file_gstr(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GstReturnSummary>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, GstReturnSummary>(
        "UPDATE gst_return_summaries SET \
         filing_status = 'filed', filed_by = $3, filed_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND filing_status IN ('draft', 'validated') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(row) = row else {
        let status = sqlx::query_scalar::<_, String>(
            "SELECT filing_status::text FROM gst_return_summaries \
             WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
        return Err(AppError::Conflict(format!(
            "This return is {status}; only a draft or validated return can be filed."
        )));
    };

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — HSN Summary Report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct HsnReportQuery {
    pub period: String,
}

pub async fn report_hsn_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<HsnReportQuery>,
) -> Result<Json<Vec<HsnSummaryRow>>, AppError> {
    require_permission(&claims, permissions::billing::gst_returns::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, HsnSummaryRow>(
        "SELECT COALESCE(ii.hsn_sac_code, 'N/A') AS hsn_code, \
         COALESCE(SUM(ii.unit_price * ii.quantity), 0) AS taxable_amount, \
         COALESCE(SUM(ii.cgst_amount), 0) AS cgst_amount, \
         COALESCE(SUM(ii.sgst_amount), 0) AS sgst_amount, \
         COALESCE(SUM(ii.igst_amount), 0) AS igst_amount, \
         COALESCE(SUM(ii.cgst_amount + ii.sgst_amount + ii.igst_amount), 0) AS total_tax, \
         COUNT(*) AS item_count \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         WHERE ii.tenant_id = $1 \
         AND i.status IN ('issued', 'partially_paid', 'paid') \
         AND TO_CHAR(i.issued_at, 'YYYY-MM') = $2 \
         GROUP BY ii.hsn_sac_code ORDER BY hsn_code LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(&params.period)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Financial MIS & P&L
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct FinancialReportQuery {
    pub date_from: NaiveDate,
    pub date_to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct FinancialMisReport {
    pub total_revenue: Decimal,
    pub total_collections: Decimal,
    pub total_outstanding: Decimal,
    pub total_refunds: Decimal,
    pub total_write_offs: Decimal,
    pub total_advances: Decimal,
    pub collection_rate: Decimal,
    pub period_from: NaiveDate,
    pub period_to: NaiveDate,
}

pub async fn report_financial_mis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<FinancialReportQuery>,
) -> Result<Json<FinancialMisReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let revenue = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM invoices \
         WHERE tenant_id = $1 AND status != 'cancelled' \
         AND issued_at::date >= $2 AND issued_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let collections = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM payments \
         WHERE tenant_id = $1 AND paid_at::date >= $2 AND paid_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let refunds = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM refunds \
         WHERE tenant_id = $1 AND refunded_at::date >= $2 AND refunded_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let write_offs = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM bad_debt_write_offs \
         WHERE tenant_id = $1 AND status = 'approved' \
         AND created_at::date >= $2 AND created_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let advances = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0) FROM patient_advances \
         WHERE tenant_id = $1 AND created_at::date >= $2 AND created_at::date <= $3",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_one(&mut *tx)
    .await?;

    let outstanding = revenue - collections;
    let collection_rate = if revenue > Decimal::ZERO {
        collections * Decimal::from(100) / revenue
    } else {
        Decimal::ZERO
    };

    tx.commit().await?;

    Ok(Json(FinancialMisReport {
        total_revenue: revenue,
        total_collections: collections,
        total_outstanding: outstanding,
        total_refunds: refunds,
        total_write_offs: write_offs,
        total_advances: advances,
        collection_rate,
        period_from: params.date_from,
        period_to: params.date_to,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProfitLossDeptRow {
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    pub revenue: Decimal,
    pub expenses: Decimal,
    pub profit: Decimal,
}

pub async fn report_profit_loss(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<FinancialReportQuery>,
) -> Result<Json<Vec<ProfitLossDeptRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ProfitLossDeptRow>(
        "WITH dept_revenue AS ( \
           SELECT ii.department_id, COALESCE(SUM(ii.total_price), 0) AS revenue \
           FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
           WHERE ii.tenant_id = $1 AND i.status != 'cancelled' \
           AND i.issued_at::date >= $2 AND i.issued_at::date <= $3 \
           GROUP BY ii.department_id \
         ), \
         dept_expense AS ( \
           SELECT jl.department_id, \
           COALESCE(SUM(jl.debit_amount), 0) AS expenses \
           FROM journal_entry_lines jl \
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.tenant_id = jl.tenant_id \
           JOIN gl_accounts ga ON ga.id = jl.account_id AND ga.tenant_id = jl.tenant_id \
           WHERE jl.tenant_id = $1 AND je.status = 'posted' \
           AND je.entry_date >= $2 AND je.entry_date <= $3 \
           AND ga.account_type = 'expense' \
           GROUP BY jl.department_id \
         ) \
         SELECT COALESCE(r.department_id, e.department_id) AS department_id, \
           d.name AS department_name, \
           COALESCE(r.revenue, 0) AS revenue, \
           COALESCE(e.expenses, 0) AS expenses, \
           COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) AS profit \
         FROM dept_revenue r \
         FULL OUTER JOIN dept_expense e ON r.department_id = e.department_id \
         LEFT JOIN departments d ON d.id = COALESCE(r.department_id, e.department_id) \
         ORDER BY profit DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.date_from)
    .bind(params.date_to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — ERP Export
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ErpExportRequest {
    pub target_system: String,
    pub export_type: String,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub async fn export_to_erp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ErpExportRequest>,
) -> Result<Json<ErpExportLog>, AppError> {
    require_permission(&claims, permissions::billing::erp::EXPORT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Collect invoice IDs for the period
    let invoice_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoices WHERE tenant_id = $1 \
         AND status IN ('issued', 'partially_paid', 'paid') \
         AND ($2::date IS NULL OR issued_at::date >= $2) \
         AND ($3::date IS NULL OR issued_at::date <= $3)",
    )
    .bind(claims.tenant_id)
    .bind(body.date_from)
    .bind(body.date_to)
    .fetch_all(&mut *tx)
    .await?;

    // Build export payload stub (actual ERP API integration deferred)
    let payload = serde_json::json!({
        "target": body.target_system,
        "type": body.export_type,
        "invoice_count": invoice_ids.len(),
        "date_from": body.date_from,
        "date_to": body.date_to,
        "format_version": "1.0",
        "note": "ERP API integration pending — data formatted for export",
    });

    let row = sqlx::query_as::<_, ErpExportLog>(
        "INSERT INTO erp_export_log \
         (tenant_id, target_system, export_type, record_ids, date_from, date_to, \
          status, payload, exported_by) \
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.target_system)
    .bind(&body.export_type)
    .bind(&invoice_ids)
    .bind(body.date_from)
    .bind(body.date_to)
    .bind(&payload)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_erp_exports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ErpExportLog>>, AppError> {
    require_permission(&claims, permissions::billing::erp::EXPORT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ErpExportLog>(
        "SELECT * FROM erp_export_log WHERE tenant_id = $1 AND deleted_at IS NULL \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tds_period_tests {
    use super::{is_pan, tds_period_of};
    use chrono::NaiveDate;

    /// The date of `y-m-d`, for tests.
    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap_or_default()
    }

    #[test]
    fn quarters_follow_the_april_financial_year() {
        assert_eq!(tds_period_of(day(2026, 4, 1)), ("2026-27".to_owned(), "Q1"));
        assert_eq!(
            tds_period_of(day(2026, 9, 30)),
            ("2026-27".to_owned(), "Q2")
        );
        assert_eq!(
            tds_period_of(day(2026, 12, 31)),
            ("2026-27".to_owned(), "Q3")
        );
        assert_eq!(
            tds_period_of(day(2027, 3, 31)),
            ("2026-27".to_owned(), "Q4")
        );
        assert_eq!(tds_period_of(day(2099, 1, 5)), ("2098-99".to_owned(), "Q4"));
        assert_eq!(tds_period_of(day(2099, 4, 5)), ("2099-00".to_owned(), "Q1"));
    }

    #[test]
    fn a_pan_is_five_letters_four_digits_a_letter() {
        assert!(is_pan("ABCDE1234F"));
        for bad in [
            "ABCDE1234",
            "abcde1234f",
            "ABCD11234F",
            "ABCDE12345",
            "ABCDE1234FF",
        ] {
            assert!(!is_pan(bad), "{bad}");
        }
    }
}

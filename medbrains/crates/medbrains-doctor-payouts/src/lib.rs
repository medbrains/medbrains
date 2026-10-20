//! Doctor payouts (#4886): how visiting, day and fee-for-service doctors are
//! paid. An agreement says how, a versioned rate card says how much, an
//! append-only ledger records what was earned as bills are issued, paid or
//! settled, a statement gathers it, finance approves it (maker-checker) and a
//! payout pays it with TDS. Plan: `docs/plans/doctor-payouts.md`.

pub mod accrual;
pub mod accrual_sql;
pub mod agreements;
pub mod day;
pub mod engine;
pub mod ledger;
pub mod me;
pub mod payout_ops;
pub mod payouts;
pub mod provider;
pub mod rate_cards;
pub mod referral;
pub mod reports;
pub mod session;
pub mod settings;
pub mod statement_ops;
pub mod statements;

pub use accrual::sync_invoice;
use axum::routing::{delete, get, post, put};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};

/// The transaction every handler runs in.
pub type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// A transaction with the caller's tenant set for row-level security.
pub async fn begin<'a>(state: &'a AppState, claims: &Claims) -> Result<Tx<'a>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// "R*** K***" — enough for a doctor to recognise their own patient on a
/// statement, not enough to identify a stranger's.
pub const PATIENT_MASK_SQL: &str = "CONCAT(LEFT(p.first_name, 1), '*** ', LEFT(COALESCE(p.last_name, ''), 1), \
     '*** (', RIGHT(p.uhid, 4), ')')";

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/doctor-payouts/settings",
            get(settings::get_settings).put(settings::update_settings),
        )
        .route(
            "/api/doctor-payouts/settings/referral",
            post(settings::set_referral_switch),
        )
        .route(
            "/api/doctor-payouts/agreements",
            get(agreements::list_agreements).post(agreements::create_agreement),
        )
        .route(
            "/api/doctor-payouts/agreements/{id}",
            put(agreements::update_agreement),
        )
        .route(
            "/api/doctor-payouts/rate-cards",
            get(rate_cards::list_rate_cards).post(rate_cards::create_rate_card),
        )
        .route(
            "/api/doctor-payouts/rate-cards/{id}/versions",
            post(rate_cards::new_version),
        )
        .route(
            "/api/doctor-payouts/rate-cards/{id}/rules",
            get(rate_cards::list_rules).post(rate_cards::add_rule),
        )
        .route(
            "/api/doctor-payouts/rate-cards/{id}/rules/{rule_id}",
            delete(rate_cards::remove_rule),
        )
        .route(
            "/api/doctor-payouts/rate-cards/{id}/calculate",
            post(rate_cards::calculate),
        )
        .route("/api/doctor-payouts/ledger", get(ledger::list_ledger))
        .route(
            "/api/doctor-payouts/statements",
            get(statements::list_statements).post(statements::prepare_statement),
        )
        .route(
            "/api/doctor-payouts/statements/{id}",
            get(statements::get_statement),
        )
        .route(
            "/api/doctor-payouts/statements/{id}/adjust",
            post(statements::adjust_statement),
        )
        .route(
            "/api/doctor-payouts/statements/{id}/dispute",
            post(statements::dispute_statement),
        )
        .route(
            "/api/doctor-payouts/statements/{id}/approve",
            post(statements::approve_statement),
        )
        .route(
            "/api/doctor-payouts/payouts",
            get(payouts::list_payouts).post(payouts::run_payouts),
        )
        .route(
            "/api/doctor-payouts/payouts/{id}/paid",
            post(payouts::mark_paid),
        )
        .route(
            "/api/doctor-payouts/payouts/{id}/failed",
            post(payouts::mark_failed),
        )
        .route(
            "/api/doctor-payouts/runs/{run_id}/bank-file",
            get(payouts::bank_file),
        )
        .route("/api/doctor-payouts/day", get(day::day_summary))
        .route("/api/doctor-payouts/day/settle", post(day::settle_day))
        .route(
            "/api/doctor-payouts/referral-statements",
            post(referral::create_referral_statement_handler),
        )
        .route("/api/doctor-payouts/reports/summary", get(reports::summary))
        .route(
            "/api/doctor-payouts/reports/tds",
            get(reports::tds_register),
        )
        .route(
            "/api/doctor-payouts/reports/referral-compliance",
            get(reports::referral_compliance),
        )
        .route("/api/doctor-payouts/me/ledger", get(me::my_ledger))
        .route("/api/doctor-payouts/me/statements", get(me::my_statements))
        .route(
            "/api/doctor-payouts/me/statements/{id}/dispute",
            post(me::dispute_my_statement),
        )
}

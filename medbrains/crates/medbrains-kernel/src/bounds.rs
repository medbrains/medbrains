//! Bounds: a read that cannot hold the database hostage.
//!
//! A report, a dashboard tile or an analytics query shares the database with
//! the interactive screens. Unbounded, one heavy query slows all of them. [`read_only`] puts
//! three transaction-local limits on a connection in one round trip: a
//! statement timeout, an idle-in-transaction timeout, and read-only mode, so a
//! read path can never write either.
//!
//! The limits are `SET LOCAL` (`set_config(…, true)`): they end with the
//! transaction, so a pooled connection carries nothing into the next request.

use std::time::Duration;

use sqlx::PgConnection;

use crate::KernelError;

/// The limits one bounded read runs under.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReadBounds {
    /// Longest any one statement may run before Postgres cancels it (57014).
    pub statement_timeout: Duration,
    /// Longest the transaction may sit idle before Postgres ends the session.
    pub idle_timeout: Duration,
}

/// Apply `bounds` and read-only mode to the open transaction on `conn`.
///
/// Must run inside a transaction: outside one, `SET LOCAL` has no effect.
#[inline]
pub async fn read_only(conn: &mut PgConnection, bounds: ReadBounds) -> Result<(), KernelError> {
    sqlx::query(
        "SELECT set_config('statement_timeout', $1, true), \
                set_config('idle_in_transaction_session_timeout', $2, true), \
                set_config('transaction_read_only', 'on', true)",
    )
    .bind(millis(bounds.statement_timeout))
    .bind(millis(bounds.idle_timeout))
    .execute(conn)
    .await?;
    Ok(())
}

/// A duration as the `…ms` text Postgres reads for a time setting; at least
/// 1 ms, because 0 would mean "no limit".
fn millis(duration: Duration) -> String {
    format!("{}ms", duration.as_millis().max(1))
}

#[cfg(test)]
mod tests {
    use super::millis;
    use std::time::Duration;

    #[test]
    fn zero_never_reads_as_no_limit() {
        assert_eq!(millis(Duration::ZERO), "1ms");
        assert_eq!(millis(Duration::from_secs(15)), "15000ms");
    }
}

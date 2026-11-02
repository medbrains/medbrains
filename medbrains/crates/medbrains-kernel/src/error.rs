//! The kernel's error type. It says what went wrong and nothing about HTTP.
//!
//! The HTTP status and body of each variant are decided above the kernel, by
//! `From<KernelError> for AppError` in `medbrains-server-core`. The display
//! strings match `AppError`'s because they reach logs and stored pipeline
//! failures.

use medbrains_db::pool::DbError;

/// Why a kernel call failed.
#[derive(Debug, thiserror::Error)]
pub enum KernelError {
    #[error("database error: {0}")]
    Database(#[from] DbError),

    /// The caller may not do this.
    #[error("forbidden")]
    Forbidden,

    /// The record is absent, or the caller may not know it exists.
    #[error("not found")]
    NotFound,

    #[error("bad request: {0}")]
    BadRequest(String),

    /// A decision could not be made; retryable, and never reported as absence.
    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for KernelError {
    /// Wrap a driver error the way `AppError` does, so `RowNotFound` keeps its
    /// meaning across the conversion.
    fn from(err: sqlx::Error) -> Self {
        Self::Database(DbError::Sqlx(err))
    }
}

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::validation::ValidationErrors;

/// Unified error type for the HTTP layer.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] medbrains_db::pool::DbError),

    #[error("configuration error: {0}")]
    Config(#[from] crate::config::ConfigError),

    #[error("unauthorized")]
    Unauthorized,

    #[error("forbidden")]
    Forbidden,

    /// A 403 that says why.
    ///
    /// `Forbidden` answers "no" and nothing else, which is right when the
    /// reason is that the caller lacks a permission — spelling that out tells
    /// them what to go and acquire. It is wrong when the route is refusing a
    /// *kind* of caller, because the request will never succeed however the
    /// permissions are changed, and an integration author reading a bare
    /// "forbidden" has no way to learn that.
    #[error("forbidden: {0}")]
    ForbiddenReason(String),

    #[error("step-up required")]
    StepUpRequired,

    #[error("not found")]
    NotFound,

    /// The route exists and its data source does not.
    ///
    /// Twenty print-data handlers were returning hardcoded sample documents —
    /// "Student Name", invented assessment marks, a fabricated fire-inspection
    /// record — on live routes, which a print template renders onto hospital
    /// letterhead. A document that is wrong is worse than a document that is
    /// missing, and 404 would have been a lie of a different kind: the route
    /// is there, the implementation is not.
    #[error("not implemented")]
    NotImplemented,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("validation failed")]
    ValidationFailed(ValidationErrors),

    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        // Handle validation errors specially — return 422 with field-level errors
        if let Self::ValidationFailed(errors) = self {
            tracing::warn!("validation failed");
            let body = serde_json::json!({
                "error": "validation_failed",
                "fields": errors.into_fields(),
            });
            return (StatusCode::UNPROCESSABLE_ENTITY, axum::Json(body)).into_response();
        }

        let (status, message, detail) = match &self {
            // RowNotFound from `fetch_one` is the most common DB-error case — it
            // means the queried record doesn't exist, which is a 404, not 500.
            Self::Database(medbrains_db::pool::DbError::Sqlx(sqlx::Error::RowNotFound)) => {
                tracing::debug!("database row not found");
                (
                    StatusCode::NOT_FOUND,
                    "not found",
                    "Record not found".to_owned(),
                )
            }
            Self::Database(db_err) => {
                let (status, message) = match db_err {
                    // Constraint violations map to client-side errors, not 500.
                    medbrains_db::pool::DbError::Sqlx(sqlx::Error::Database(e)) => {
                        db_error_status(e.code().as_deref())
                    }
                    _ => (StatusCode::INTERNAL_SERVER_ERROR, "database error"),
                };
                if status.is_server_error() {
                    tracing::error!(error = %self, "database error");
                } else {
                    tracing::warn!(error = %self, status = %status, "client db error");
                }
                let detail = extract_db_detail(db_err);
                (status, message, detail)
            }
            Self::Config(_) => {
                tracing::error!(error = %self, "configuration error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "configuration error",
                    "configuration error".to_owned(),
                )
            }
            Self::Unauthorized => {
                tracing::warn!("unauthorized request");
                (
                    StatusCode::UNAUTHORIZED,
                    "unauthorized",
                    "unauthorized".to_owned(),
                )
            }
            Self::Forbidden => {
                tracing::warn!("forbidden request");
                (StatusCode::FORBIDDEN, "forbidden", "forbidden".to_owned())
            }
            Self::ForbiddenReason(msg) => {
                tracing::warn!(%msg, "forbidden request");
                (StatusCode::FORBIDDEN, "forbidden", msg.clone())
            }
            Self::StepUpRequired => {
                tracing::debug!("step-up required");
                (
                    StatusCode::FORBIDDEN,
                    "step_up_required",
                    "Re-authenticate to continue.".to_owned(),
                )
            }
            Self::NotFound => (StatusCode::NOT_FOUND, "not found", "not found".to_owned()),
            Self::NotImplemented => (
                StatusCode::NOT_IMPLEMENTED,
                "not implemented",
                "this document has no data source yet".to_owned(),
            ),
            Self::BadRequest(msg) => {
                tracing::warn!(detail = %msg, "bad request");
                (StatusCode::BAD_REQUEST, "bad request", msg.clone())
            }
            Self::Conflict(msg) => {
                tracing::warn!(detail = %msg, "conflict");
                (StatusCode::CONFLICT, "conflict", msg.clone())
            }
            Self::ServiceUnavailable(msg) => {
                tracing::warn!(detail = %msg, "service unavailable");
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "service unavailable",
                    msg.clone(),
                )
            }
            Self::Internal(msg) => {
                tracing::error!(detail = %msg, "internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal error",
                    msg.clone(),
                )
            }
            Self::ValidationFailed(_) => unreachable!(),
        };

        let body = serde_json::json!({
            "error": message,
            "detail": detail,
        });

        (status, axum::Json(body)).into_response()
    }
}

/// Map a Postgres SQLSTATE to the HTTP status it deserves.
///
/// Constraint violations and malformed input are the *client's* fault, so they
/// must not surface as 500s — a 500 tells the caller (and the AI simulator's
/// defect scoring) that the server broke when it actually rejected bad input.
fn db_error_status(code: Option<&str>) -> (StatusCode, &'static str) {
    match code {
        // Foreign key violation — referenced row doesn't exist.
        Some("23503") => (StatusCode::NOT_FOUND, "not found"),
        // Unique constraint violation — duplicate.
        Some("23505") => (StatusCode::CONFLICT, "conflict"),
        // Check constraint, not-null — bad input.
        Some("23514" | "23502") => (StatusCode::BAD_REQUEST, "bad request"),
        // Data exceptions — the request carried a value Postgres can't even
        // parse into the column type. 22P02 is the big one: every list filter
        // that binds a free-text `status`/`type` query param into a `$N::<enum>`
        // cast raises it for an unknown value (`?status=bogus`), which used to
        // 500. Numeric overflow and unparseable dates are the same class.
        Some("22P02" | "22003" | "22007" | "22008") => {
            (StatusCode::BAD_REQUEST, "bad request")
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "database error"),
    }
}

/// Extract a user-friendly detail message from a database error.
/// Keeps stack traces in logs only — returns sanitized messages to the client.
fn extract_db_detail(db_err: &medbrains_db::pool::DbError) -> String {
    match db_err {
        medbrains_db::pool::DbError::Sqlx(sqlx::Error::Database(e)) => {
            let msg = e.message();
            // Unique constraint violation
            if e.code().as_deref() == Some("23505") {
                if let Some(constraint) = e.constraint() {
                    return format!("Duplicate entry: violates unique constraint \"{constraint}\"");
                }
                return format!("Duplicate entry: {msg}");
            }
            // Foreign key violation
            if e.code().as_deref() == Some("23503") {
                if let Some(constraint) = e.constraint() {
                    return format!(
                        "Referenced record not found: violates foreign key \"{constraint}\""
                    );
                }
                return format!("Referenced record not found: {msg}");
            }
            // Check constraint violation
            if e.code().as_deref() == Some("23514") {
                if let Some(constraint) = e.constraint() {
                    return format!("Check constraint failed: \"{constraint}\"");
                }
                return format!("Check constraint failed: {msg}");
            }
            // Not-null violation
            if e.code().as_deref() == Some("23502") {
                return format!("Required field missing: {msg}");
            }
            // Data exception — e.g. `invalid input value for enum foo_status: "bogus"`.
            // The PG message names the offending value, which is exactly what the
            // caller needs to fix the request.
            if matches!(e.code().as_deref(), Some("22P02" | "22003" | "22007" | "22008")) {
                return format!("Invalid value: {msg}");
            }
            // Other database errors — return the PG message directly
            msg.to_owned()
        }
        medbrains_db::pool::DbError::Sqlx(sqlx::Error::RowNotFound) => {
            "Record not found".to_owned()
        }
        _ => "Database error".to_owned(),
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        Self::Database(medbrains_db::pool::DbError::Sqlx(err))
    }
}

/// A refused stock movement is the caller's problem, not the server's.
///
/// "Short by 12" and "this line was never linked to the catalogue" are both
/// things the storekeeper can act on, so they come back as 400 with the detail
/// intact rather than collapsing into a 500 that says `database error`.
impl From<medbrains_db::stock::StockError> for AppError {
    fn from(err: medbrains_db::stock::StockError) -> Self {
        match err {
            medbrains_db::stock::StockError::Sqlx(e) => Self::from(e),
            other => Self::BadRequest(other.to_string()),
        }
    }
}

impl From<argon2::password_hash::Error> for AppError {
    fn from(_: argon2::password_hash::Error) -> Self {
        Self::Internal("password hashing error".to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::{StatusCode, db_error_status};

    #[test]
    fn constraint_violations_are_client_errors() {
        assert_eq!(db_error_status(Some("23503")).0, StatusCode::NOT_FOUND);
        assert_eq!(db_error_status(Some("23505")).0, StatusCode::CONFLICT);
        assert_eq!(db_error_status(Some("23514")).0, StatusCode::BAD_REQUEST);
        assert_eq!(db_error_status(Some("23502")).0, StatusCode::BAD_REQUEST);
    }

    /// Regression: every list endpoint that binds a free-text `status`/`type`
    /// query param into a `$N::<pg_enum>` cast (~28 sites across quality,
    /// infection-control, hr, materials, iam, indent, occ-health…) raises 22P02
    /// for an unknown value. That is a malformed request, not a server fault —
    /// it must be a 400, or `?status=bogus` reads as a defect.
    #[test]
    fn data_exceptions_are_bad_request_not_500() {
        for code in ["22P02", "22003", "22007", "22008"] {
            let (status, _) = db_error_status(Some(code));
            assert_eq!(status, StatusCode::BAD_REQUEST, "SQLSTATE {code} must be a 400");
        }
    }

    #[test]
    fn unknown_sqlstate_stays_a_server_error() {
        assert_eq!(
            db_error_status(Some("XX000")).0,
            StatusCode::INTERNAL_SERVER_ERROR
        );
        assert_eq!(db_error_status(None).0, StatusCode::INTERNAL_SERVER_ERROR);
    }
}

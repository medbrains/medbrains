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

    #[error("YottaDB error: {0}")]
    YottaDb(#[from] medbrains_yottadb::client::YottaDbError),

    #[error("configuration error: {0}")]
    Config(#[from] crate::config::ConfigError),

    #[error("unauthorized")]
    Unauthorized,

    #[error("forbidden")]
    Forbidden,

    #[error("not found")]
    NotFound,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("conflict: {0}")]
    Conflict(String),

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
            Self::Database(db_err) => {
                tracing::error!(error = %self, "database error");
                let detail = extract_db_detail(db_err);
                (StatusCode::INTERNAL_SERVER_ERROR, "database error", detail)
            }
            Self::YottaDb(_) => {
                tracing::error!(error = %self, "yottadb error");
                (StatusCode::BAD_GATEWAY, "yottadb error", "yottadb error".to_owned())
            }
            Self::Config(_) => {
                tracing::error!(error = %self, "configuration error");
                (StatusCode::INTERNAL_SERVER_ERROR, "configuration error", "configuration error".to_owned())
            }
            Self::Unauthorized => {
                tracing::warn!("unauthorized request");
                (StatusCode::UNAUTHORIZED, "unauthorized", "unauthorized".to_owned())
            }
            Self::Forbidden => {
                tracing::warn!("forbidden request");
                (StatusCode::FORBIDDEN, "forbidden", "forbidden".to_owned())
            }
            Self::NotFound => {
                (StatusCode::NOT_FOUND, "not found", "not found".to_owned())
            }
            Self::BadRequest(msg) => {
                tracing::warn!(detail = %msg, "bad request");
                (StatusCode::BAD_REQUEST, "bad request", msg.clone())
            }
            Self::Conflict(msg) => {
                tracing::warn!(detail = %msg, "conflict");
                (StatusCode::CONFLICT, "conflict", msg.clone())
            }
            Self::Internal(msg) => {
                tracing::error!(detail = %msg, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error", msg.clone())
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

impl From<argon2::password_hash::Error> for AppError {
    fn from(_: argon2::password_hash::Error) -> Self {
        Self::Internal("password hashing error".to_owned())
    }
}

//! Which hospital a sign-in is for.
//!
//! Usernames are unique within a hospital, not across a deployment that
//! serves several. Looking one up across every hospital and taking the first
//! row signed people into — or reset the password of — somebody else's
//! account whenever two hospitals chose the same name. The hospital is
//! named by the app or page (`hospital_code`), else by the hospital's own
//! domain the request came to; when neither names one and the username is
//! used in more than one hospital, the caller is asked to choose.

use axum::http::HeaderMap;
use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// The hospital a sign-in names, if it names one.
///
/// A code that matches no active hospital is refused outright, with the same
/// answer as a wrong password: it names a hospital, just not a real one.
pub(crate) async fn login_tenant(
    db: &PgPool,
    hospital_code: Option<&str>,
    headers: &HeaderMap,
) -> Result<Option<Uuid>, AppError> {
    if let Some(code) = hospital_code.map(str::trim).filter(|c| !c.is_empty()) {
        return sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM tenants WHERE upper(code) = upper($1) AND is_active = true",
        )
        .bind(code)
        .fetch_optional(db)
        .await?
        .map(Some)
        .ok_or(AppError::Unauthorized);
    }
    let Some(host) = request_host(headers) else {
        return Ok(None);
    };
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE lower(custom_domain) = $1 AND is_active = true",
    )
    .bind(host)
    .fetch_optional(db)
    .await?)
}

/// The host the browser asked for, as the proxy forwards it; no port.
fn request_host(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-host")
        .or_else(|| headers.get(axum::http::header::HOST))
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.split(':').next())
        .map(|h| h.trim().to_lowercase())
        .filter(|h| !h.is_empty())
}

/// What a username names once the hospital (if any) is applied.
pub(crate) enum Account<T> {
    None,
    One(T),
    /// The name is used in more than one hospital: ask which.
    Ambiguous,
}

/// Classify the rows of a username lookup fetched with `LIMIT 2`.
pub(crate) fn account<T>(mut rows: Vec<T>) -> Account<T> {
    match rows.len() {
        0 => Account::None,
        1 => Account::One(rows.remove(0)),
        _ => Account::Ambiguous,
    }
}

/// The answer that asks the page or app to name the hospital.
pub(crate) fn hospital_required() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "hospital_required": true }))
}

#[cfg(test)]
mod tests {
    use super::{Account, account};

    #[test]
    fn two_accounts_with_one_name_are_never_resolved_by_picking_one() {
        assert!(matches!(account(vec![1, 2]), Account::Ambiguous));
        assert!(matches!(account(vec![1]), Account::One(1)));
        assert!(matches!(account(Vec::<i32>::new()), Account::None));
    }
}

//! Pieces of `GET /api/auth/me` that need no SQL of their own: closing the
//! switched-off module list over brick dependencies, and resolving the
//! user's locale profile through the country crate.

use medbrains_server_core::{error::AppError, middleware::auth::Claims};

/// A brick that needs a switched-off brick is off too, as the server's module
/// check has it: add every dependent of a code in `disabled`, once.
pub(crate) fn with_dependents(mut disabled: Vec<String>) -> Vec<String> {
    let implied: Vec<&str> = disabled
        .iter()
        .flat_map(|code| medbrains_core::bricks::dependents(code))
        .collect();
    for code in implied {
        if !disabled.iter().any(|c| c == code) {
            disabled.push(code.to_owned());
        }
    }
    disabled
}

/// The user's resolved locale profile, or `None` when the pack registry
/// failed to load (a fault the client shows, not a value). A database error
/// still fails the request like every other read here.
pub(crate) async fn locale_profile_for(
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
) -> Result<Option<medbrains_country::LocaleProfile>, AppError> {
    match medbrains_country::for_user(tx, claims.tenant_id, claims.sub).await {
        Ok(profile) => Ok(Some(profile)),
        Err(medbrains_country::CountryError::Db(e)) => Err(e.into()),
        Err(medbrains_country::CountryError::Pack(e)) => {
            tracing::error!(error = %e, "country packs did not load; locale profile unavailable");
            Ok(None)
        }
    }
}

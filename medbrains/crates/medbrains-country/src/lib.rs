//! Country packs and the tenant locale profile (RFCs/RFC-WORLD-READY.md).
//!
//! The core assumes no country. A hospital picks one; its pack supplies the
//! defaults and rules, and the profile at `locale/*` in the kernel's
//! configuration tree says how that hospital formats money, dates, times and
//! numbers. Every surface reads the same resolved profile.
//!
//! - [`pack`]: packs compiled in from `medbrains/packs/*/pack.toml`, parsed
//!   once and refused unless they meet the floor.
//! - [`floor`]: the security and compliance floor, code a pack can only add to.
//! - [`profile`]: the fields, their scopes and pure resolution.
//! - [`for_user`] / [`for_scope`]: resolution against the database, one
//!   round trip (the user's facility is found inside the same query).

use medbrains_kernel::config;
use sqlx::PgConnection;
use uuid::Uuid;

pub mod floor;
pub mod pack;
pub mod profile;
pub mod validate;

pub use medbrains_kernel::config::Scopes;
pub use profile::{Field, LocaleProfile};

/// Why a profile could not be resolved. Either is a fault: the caller shows
/// the neutral rendering and says so, never a guessed country.
#[derive(Debug, thiserror::Error)]
pub enum CountryError {
    #[error(transparent)]
    Db(#[from] sqlx::Error),
    #[error(transparent)]
    Pack(&'static pack::PackError),
}

/// The profile for one set of scopes (a facility's print, a job, a user).
///
/// # Errors
/// [`CountryError`]: the database or the pack registry failed.
pub async fn for_scope(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    scopes: Scopes,
) -> Result<LocaleProfile, CountryError> {
    let categories = [profile::CATEGORY, profile::UNITS];
    let rows = config::categories_in(conn, tenant_id, &categories, scopes).await?;
    profile::resolve(&rows).map_err(CountryError::Pack)
}

/// The profile `user` sees: their own display choices over their facility's
/// over the hospital's over the pack's.
///
/// # Errors
/// As [`for_scope`].
pub async fn for_user(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<LocaleProfile, CountryError> {
    let scopes = Scopes {
        user: Some(user_id),
        facility: None,
        facility_of_user: true,
    };
    for_scope(conn, tenant_id, scopes).await
}

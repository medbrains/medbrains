//! `medbrains-kernel` — the one interface apps use for the trusted core.
//!
//! RFC-HOSPITAL-OS §3. Phase K1 is a **facade over code that already exists**:
//! every call here is a thin wrapper around the function that already does the
//! job (named in each module's docs), so moving an app onto the kernel changes
//! where it imports from, not what it does.
//!
//! ```ignore
//! kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
//!     let rows = sqlx::query("…").fetch_all(&mut **tx).await?;
//!     kernel::audit(tx, &entry).await?;
//!     Ok(rows)
//! })
//! .await
//! ```
//!
//! Three rules hold across every module:
//!
//! - authorisation and consent answer `Allow`, `Deny` or `Unknown` — never a
//!   boolean, so an outage cannot read as a refusal or a grant;
//! - every call is scoped to the tenant of the [`Tx`] it is given, never to a
//!   tenant the caller passes alongside it;
//! - missing context is `Unknown`, never `Allow`.

pub mod audit;
pub mod authz;
pub mod config;
pub mod consent;
pub mod events;
pub mod health;
pub mod patient;
pub mod seq;
pub mod store;

use std::ops::{Deref, DerefMut};

use sqlx::{PgConnection, PgPool, Postgres, Transaction};
use uuid::Uuid;

pub use audit::audit;
pub use authz::{Outcome, authorize, require_any_permission, require_permission};
pub use medbrains_server_core::error::AppError;
pub use medbrains_server_core::middleware::auth::Claims;

/// Who is acting, and for which hospital.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Actor {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
}

impl Actor {
    /// The signed-in user (or API key's service account) behind a request.
    pub const fn from_claims(claims: &Claims) -> Self {
        Self {
            tenant_id: claims.tenant_id,
            user_id: claims.sub,
        }
    }
}

/// One unit of work: a transaction with the tenant's RLS context and the
/// actor already set. Derefs to the connection, so `&mut **tx` / `&mut *tx`
/// run queries exactly as on a plain `sqlx` transaction.
#[derive(Debug)]
pub struct Tx {
    inner: Transaction<'static, Postgres>,
    pool: PgPool,
    actor: Actor,
}

impl Tx {
    /// The actor this unit of work runs as.
    #[inline]
    pub const fn actor(&self) -> Actor {
        self.actor
    }

    /// The underlying transaction, for the existing helpers the kernel wraps.
    #[inline]
    pub(crate) const fn transaction(&mut self) -> &mut Transaction<'static, Postgres> {
        &mut self.inner
    }

    /// Make the work permanent.
    #[inline]
    pub async fn commit(self) -> Result<(), AppError> {
        Ok(self.inner.commit().await?)
    }
}

impl Deref for Tx {
    type Target = PgConnection;
    #[inline]
    fn deref(&self) -> &PgConnection {
        &self.inner
    }
}

impl DerefMut for Tx {
    #[inline]
    fn deref_mut(&mut self) -> &mut PgConnection {
        &mut self.inner
    }
}

/// Open a unit of work: begin, set `app.tenant_id` (RLS + the hospital's
/// timezone) and `app.user_id` (audit-trigger attribution) in one round trip.
///
/// Wraps `medbrains_db::pool::set_audit_context`. Dropping the [`Tx`] without
/// [`Tx::commit`] rolls it back.
#[inline]
pub async fn begin(pool: &PgPool, actor: Actor) -> Result<Tx, AppError> {
    let mut inner = pool.begin().await?;
    medbrains_db::pool::set_audit_context(&mut inner, &actor.tenant_id, &actor.user_id, None)
        .await?;
    Ok(Tx {
        inner,
        pool: pool.clone(),
        actor,
    })
}

/// Run `f` as one unit of work: commit when it returns `Ok`, roll back when it
/// returns `Err` (by dropping the transaction, so the original error is the
/// one the caller sees).
#[inline]
pub async fn work<T, F>(pool: &PgPool, actor: Actor, f: F) -> Result<T, AppError>
where
    F: AsyncFnOnce(&mut Tx) -> Result<T, AppError>,
{
    let mut tx = begin(pool, actor).await?;
    let value = f(&mut tx).await?;
    tx.commit().await?;
    Ok(value)
}

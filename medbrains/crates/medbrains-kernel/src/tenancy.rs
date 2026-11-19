//! Tenancy for code that still holds a plain `sqlx` transaction, behind a decision.
//!
//! [`crate::begin`] / [`crate::work`] are the destination: a [`crate::Tx`] that
//! carries its actor. Most app code predates them and passes a
//! `Transaction<'_, Postgres>` through helpers, so moving it onto the kernel in
//! one step means keeping that type. These open one with exactly the context the
//! call site set before (`medbrains_db::pool`'s setters, named on each), so the
//! migration changes where the context comes from and nothing else: same
//! settings, same round trips, same errors.
//!
//! Every opener takes a [`Permit`], and a `Permit` only comes out of an
//! authorisation decision ([`crate::authz::permit`], [`crate::authz::permit_any`],
//! [`crate::authz::permit_outcome`]) or a named unattended pass
//! ([`Permit::unattended`]). So no code reaches a tenant's rows through these
//! without a decision having been made first: the compiler refuses it.
//!
//! `scripts/kernel_codemod.py` rewrites the direct calls into these.

use sqlx::pool::PoolConnection;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::KernelError;

/// A plain transaction on the tenant's row-level-security context.
pub type TenantTx = Transaction<'static, Postgres>;

/// Proof that the work about to start was allowed: whose tenant, who asked.
///
/// No public constructor except [`Permit::unattended`]; requests get one from the
/// decision functions in [`crate::authz`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Permit {
    tenant_id: Uuid,
    user_id: Uuid,
    unattended: Option<&'static str>,
}

impl Permit {
    /// Granted to the signed-in caller after a decision allowed them.
    pub(crate) const fn granted(tenant_id: Uuid, user_id: Uuid) -> Self {
        Self {
            tenant_id,
            user_id,
            unattended: None,
        }
    }

    /// No caller: a scheduled or background pass for the tenant itself. `why`
    /// says what runs unattended; `check_kernel_authz.py` lists every use, so a
    /// request path cannot hide behind one.
    pub const fn unattended(tenant_id: Uuid, why: &'static str) -> Self {
        Self {
            tenant_id,
            user_id: Uuid::nil(),
            unattended: Some(why),
        }
    }

    /// The tenant the decision was made for.
    pub const fn tenant_id(&self) -> Uuid {
        self.tenant_id
    }

    /// Who was allowed; nil for an unattended pass.
    pub const fn user_id(&self) -> Uuid {
        self.user_id
    }

    /// Why this runs with no caller, when it does.
    pub const fn unattended_reason(&self) -> Option<&'static str> {
        self.unattended
    }
}

/// Begin, then set `app.tenant_id` and the tenant's time zone
/// (`set_tenant_context`). No user: audit triggers attribute nobody, as before.
#[inline]
pub async fn tenant_tx(pool: &PgPool, permit: &Permit) -> Result<TenantTx, KernelError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &permit.tenant_id).await?;
    Ok(tx)
}

/// Begin with the tenant and the caller's department scope for
/// department-scoped policies (`set_full_context`); an empty slice is no
/// department restriction.
#[inline]
pub async fn scoped_tx(
    pool: &PgPool,
    permit: &Permit,
    department_ids: &[Uuid],
) -> Result<TenantTx, KernelError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &permit.tenant_id, department_ids).await?;
    Ok(tx)
}

/// Begin with the tenant and the permitted user for audit attribution
/// (`set_audit_context`). An unattended permit attributes the nil user, "the system".
#[inline]
pub async fn actor_tx(
    pool: &PgPool,
    permit: &Permit,
    ip_address: Option<&str>,
) -> Result<TenantTx, KernelError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_audit_context(&mut tx, &permit.tenant_id, &permit.user_id, ip_address)
        .await?;
    Ok(tx)
}

/// Put an already-open transaction on the tenant's context
/// (`set_tenant_context`), for a site that begins elsewhere.
#[inline]
pub async fn enter_tenant(
    tx: &mut Transaction<'_, Postgres>,
    permit: &Permit,
) -> Result<(), KernelError> {
    Ok(medbrains_db::pool::set_tenant_context(tx, &permit.tenant_id).await?)
}

/// Put an already-open transaction on the tenant and department scope
/// (`set_full_context`).
#[inline]
pub async fn enter_scope(
    tx: &mut Transaction<'_, Postgres>,
    permit: &Permit,
    department_ids: &[Uuid],
) -> Result<(), KernelError> {
    Ok(medbrains_db::pool::set_full_context(tx, &permit.tenant_id, department_ids).await?)
}

/// A pooled connection scoped to the tenant for a read outside any transaction
/// (`tenant_conn`): session-level, reset when the pool takes it back.
#[inline]
pub async fn tenant_session(
    pool: &PgPool,
    permit: &Permit,
) -> Result<PoolConnection<Postgres>, KernelError> {
    Ok(medbrains_db::pool::tenant_conn(pool, &permit.tenant_id).await?)
}

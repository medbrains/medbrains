//! What the operator's Kernel page shows: is the trusted core doing its job?

use medbrains_authz::AuthzBackend;
use serde::Serialize;

use crate::audit::{ChainVerdict, last_verification};
use crate::{AppError, Tx};

/// Crates and whether they reach the kernel only through this facade,
/// computed from their manifests at build time (see `build.rs`).
const FACADE_CRATES: &[(&str, &str)] = include!(concat!(env!("OUT_DIR"), "/facade_crates.rs"));

/// The database role requests run as, and whether row level security binds it.
#[derive(Debug, Clone, Serialize)]
pub struct RlsMode {
    pub role: String,
    /// False when the role is a superuser, has `BYPASSRLS` or owns tables —
    /// tenant isolation then rests on each query's own `WHERE`.
    pub enforced: bool,
}

/// One crate and how far it has moved onto the facade:
/// `on_facade`, `partial` or `not_yet`.
#[derive(Debug, Clone, Serialize)]
pub struct FacadeCrate {
    pub name: String,
    pub status: String,
}

/// Kernel health for one hospital.
#[derive(Debug, Clone, Serialize)]
pub struct KernelHealth {
    /// The nightly job's last verdict; `None` when never verified.
    pub audit_chain: Option<ChainVerdict>,
    pub rls: RlsMode,
    /// `postgres` or `spicedb`.
    pub authz_backend: String,
    /// Scopes the config resolver reads today, most specific first.
    pub config_scopes: Vec<String>,
    pub crates: Vec<FacadeCrate>,
}

/// Whether the connection's role is subject to row level security. The same
/// test the server's start-up preflight makes (`db.request_role`).
pub async fn rls_mode<'e, E: sqlx::PgExecutor<'e>>(db: E) -> Result<RlsMode, sqlx::Error> {
    let (role, exempt) = sqlx::query_as::<_, (String, bool)>(
        "SELECT current_user::text, r.rolsuper OR r.rolbypassrls OR \
                EXISTS (SELECT 1 FROM pg_tables t \
                        WHERE t.schemaname = 'public' AND t.tableowner = current_user) \
         FROM pg_roles r WHERE r.rolname = current_user",
    )
    .fetch_one(db)
    .await?;
    Ok(RlsMode {
        role,
        enforced: !exempt,
    })
}

/// Gather the report. Any part that cannot be read fails the whole report, so
/// the page shows an error rather than a partial picture that looks healthy.
pub async fn report(tx: &mut Tx, authz: &dyn AuthzBackend) -> Result<KernelHealth, AppError> {
    Ok(KernelHealth {
        audit_chain: last_verification(tx).await?,
        rls: rls_mode(&mut **tx).await?,
        authz_backend: authz.backend_name().to_owned(),
        config_scopes: crate::config::RESOLVED_SCOPES.map(str::to_owned).to_vec(),
        crates: FACADE_CRATES
            .iter()
            .map(|(name, status)| FacadeCrate {
                name: (*name).to_owned(),
                status: (*status).to_owned(),
            })
            .collect(),
    })
}

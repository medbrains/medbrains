//! What the operator's Kernel page shows: is the trusted core doing its job?

use medbrains_authz::AuthzBackend;
use serde::Serialize;

use crate::audit::{ChainVerdict, last_verification};
use crate::{KernelError, Tx};

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

/// Kernel health for one tenant.
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

/// Which crates reach the kernel only through this facade, from `boundary.txt`.
///
/// That file is the baseline `scripts/check_kernel_boundary.py` computes from the
/// code and CI holds to. The caller embeds it, so the page shows exactly what CI
/// enforces, from one source, and an edit to the baseline rebuilds that caller
/// rather than everything above the kernel.
pub fn facade_crates(baseline: &str) -> Result<Vec<FacadeCrate>, KernelError> {
    baseline
        .lines()
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|line| {
            let mut cols = line.split_whitespace();
            match (cols.next(), cols.next()) {
                (Some(name), Some(status)) => Ok(FacadeCrate {
                    name: name.to_owned(),
                    status: status.to_owned(),
                }),
                _ => Err(KernelError::Internal(format!(
                    "boundary baseline: malformed line '{line}'"
                ))),
            }
        })
        .collect()
}

/// Gather the report; `baseline` is the text of `boundary.txt`. Any part that
/// cannot be read fails the whole report, so the page shows an error rather than
/// a partial picture that looks healthy.
pub async fn report(
    tx: &mut Tx,
    authz: &dyn AuthzBackend,
    baseline: &str,
) -> Result<KernelHealth, KernelError> {
    Ok(KernelHealth {
        audit_chain: last_verification(tx).await?,
        rls: rls_mode(&mut **tx).await?,
        authz_backend: authz.backend_name().to_owned(),
        config_scopes: crate::config::RESOLVED_SCOPES.map(str::to_owned).to_vec(),
        crates: facade_crates(baseline)?,
    })
}

#[cfg(test)]
mod tests {
    use super::facade_crates;

    #[test]
    fn reads_rows_and_skips_comments() {
        let crates = facade_crates("# header\n\na on_facade 0 -\nb not_yet 3 x,y\n");
        let rows = crates.map(|c| {
            c.into_iter()
                .map(|f| (f.name, f.status))
                .collect::<Vec<_>>()
        });
        assert_eq!(
            rows.ok(),
            Some(vec![
                ("a".to_owned(), "on_facade".to_owned()),
                ("b".to_owned(), "not_yet".to_owned()),
            ])
        );
    }

    #[test]
    fn a_malformed_line_fails_rather_than_shrinking_the_list() {
        assert!(facade_crates("a on_facade 0 -\nbroken\n").is_err());
    }
}

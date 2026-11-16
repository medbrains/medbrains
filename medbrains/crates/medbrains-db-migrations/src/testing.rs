//! Fast, isolated databases for tests, on a real PostgreSQL 17.
//!
//! ```ignore
//! let db = medbrains_db_migrations::testing::fresh_db().await.expect("test database");
//! let app = db.connect(testing::APP_ROLE).await.expect("app pool");
//! ```
//!
//! The migrations run once per migration set, into a template database named
//! by their fingerprint (`mb_tpl_<hash>`). Every test then gets its own copy
//! (`CREATE DATABASE … TEMPLATE`): about a second, where migrating takes six
//! seconds on the tuned test cluster and minutes on a stock one. The copy is dropped when the [`TestDb`] is
//! dropped, panics included; copies a crashed run left behind are swept by a
//! later one.
//!
//! Tests connect as the roles production uses — [`APP_ROLE`] is not a
//! superuser and does not bypass row level security — so a tenant wall the
//! test exercises is the wall the server runs behind.
//!
//! The server comes from `MEDBRAINS_TEST_PG`, else the machine's test cluster
//! (`make test-db`). An unreachable server is an error, never a skip: a skipped
//! safety test reports the same as a passing one.
//!
//! Database names are generated here from digits and hex only, which is why
//! the DDL below can be formatted into `raw_sql`: `CREATE DATABASE` takes no
//! bind parameters.

use std::hash::{DefaultHasher, Hash, Hasher};
use std::str::FromStr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::MIGRATOR;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::types::Uuid;
use sqlx::{ConnectOptions, Connection, Executor, PgConnection, PgPool};

/// Environment variable naming the server's admin URL (a superuser).
pub const SERVER_ENV: &str = "MEDBRAINS_TEST_PG";
/// The cluster `scripts/test_db.sh` starts.
pub const DEFAULT_SERVER: &str = "postgres://medbrains@127.0.0.1:54317/postgres";
/// The request role: row level security applies to it (migration 0981).
pub const APP_ROLE: &str = "medbrains_app";
/// The background worker's role, which bypasses row level security (0984).
pub const WORKER_ROLE: &str = "medbrains_outbox_worker";

/// Templates kept for other worktrees' migration sets; older ones are dropped.
const KEEP_TEMPLATES: usize = 3;
/// A copy older than this belongs to a run that died; no test runs an hour.
const STALE_COPY_SECS: u64 = 3600;
/// Serialises template builds across tests, processes and worktrees. Advisory
/// locks are per database, and every caller takes it on the server's own one.
const BUILD_LOCK: &str = "SELECT pg_advisory_lock(7_262_840_558_645)";
const BUILD_UNLOCK: &str = "SELECT pg_advisory_unlock(7_262_840_558_645)";

static COPY_SEQ: AtomicU32 = AtomicU32::new(0);

/// Why a test database could not be had. `Debug` prints the plain message, so
/// `.expect()` in a test shows the remedy rather than an escaped string.
pub struct TestDbError(String);

impl std::fmt::Debug for TestDbError {
    /// The message as written, so the remedy reads cleanly in a test failure.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::fmt::Display for TestDbError {
    /// Same as `Debug`: there is only one way to say it.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for TestDbError {}

/// Wrap a database error with what was being attempted.
fn fail(doing: &str) -> impl FnOnce(sqlx::Error) -> TestDbError + '_ {
    move |e| TestDbError(format!("test database: {doing}: {e}"))
}

/// One test's private database, dropped with this value.
#[derive(Debug)]
pub struct TestDb {
    server: PgConnectOptions,
    name: String,
}

impl TestDb {
    /// The copy's name, for messages.
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    /// A URL for this database as `role` — for code that builds its own pool,
    /// such as `medbrains_db::pool::create_pool_with_config`.
    #[must_use]
    pub fn url(&self, role: &str) -> String {
        self.options(role).to_url_lossy().to_string()
    }

    /// A small pool on this database as `role`.
    ///
    /// # Errors
    /// The role cannot log in (it is created by the migrations).
    pub async fn connect(&self, role: &str) -> Result<PgPool, TestDbError> {
        PgPoolOptions::new()
            .max_connections(4)
            .connect_with(self.options(role))
            .await
            .map_err(fail("connect to the copy"))
    }

    /// A pool as the server's admin, which owns the schema — for fixtures
    /// that production writes through migrations or an operator.
    ///
    /// # Errors
    /// As [`TestDb::connect`].
    pub async fn owner(&self) -> Result<PgPool, TestDbError> {
        let owner = self.server.get_username().to_owned();
        self.connect(&owner).await
    }

    /// Connect options for `role` on this copy.
    fn options(&self, role: &str) -> PgConnectOptions {
        self.server.clone().username(role).database(&self.name)
    }
}

/// A hospital, inserted as the owner. A fresh copy has none: the migrations'
/// seeds wait for a tenant, and this one fires the per-tenant seed triggers
/// (settings, sequences) as a real onboarding does.
///
/// # Errors
/// The insert failed — usually a `code` already used in this copy.
pub async fn add_tenant(owner: &PgPool, code: &str) -> Result<Uuid, TestDbError> {
    sqlx::query_scalar!(
        "INSERT INTO tenants (code, name, hospital_type)
         VALUES ($1, $1, 'multi_specialty') RETURNING id",
        code
    )
    .fetch_one(owner)
    .await
    .map_err(fail("insert a tenant"))
}

/// A patient of `tenant` with the fewest fields the schema demands.
///
/// # Errors
/// The insert failed — usually a `uhid` already used by that tenant.
pub async fn add_patient(owner: &PgPool, tenant: Uuid, uhid: &str) -> Result<Uuid, TestDbError> {
    sqlx::query_scalar!(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone)
         VALUES ($1, $2, 'Test', 'Patient', 'unknown', '0000000000') RETURNING id",
        tenant,
        uhid
    )
    .fetch_one(owner)
    .await
    .map_err(fail("insert a patient"))
}

impl Drop for TestDb {
    /// Drop the copy, on a thread of its own: `Drop` cannot await, and the
    /// test's runtime may be the one unwinding. `FORCE` ends the test's pools.
    fn drop(&mut self) {
        let server = self.server.clone();
        let sql = format!("DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)", self.name);
        let _ = std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()?;
            rt.block_on(async {
                let mut admin = PgConnection::connect_with(&server).await?;
                admin.execute(sqlx::raw_sql(&sql)).await?;
                admin.close().await
            })
            .map_err(std::io::Error::other)
        })
        .join();
        // ponytail: a failed drop is left to the stale sweep, not reported —
        // Drop has nowhere to send it, and a leftover copy harms nothing.
    }
}

/// A private, migrated database for one test.
///
/// # Errors
/// The server is unreachable (run `make test-db`), or the migrations failed.
pub async fn fresh_db() -> Result<TestDb, TestDbError> {
    let url = std::env::var(SERVER_ENV).unwrap_or_else(|_| DEFAULT_SERVER.to_owned());
    let server = PgConnectOptions::from_str(&url)
        .map_err(|e| TestDbError(format!("{SERVER_ENV}={url} is not a URL: {e}")))?;
    let mut admin = PgConnection::connect_with(&server).await.map_err(|e| {
        TestDbError(format!(
            "no test PostgreSQL at {url}: {e}\n\
             Run `make test-db` (from medbrains/), or set {SERVER_ENV}."
        ))
    })?;

    let template = ensure_template(&mut admin, &server).await?;
    sweep_stale_copies(&mut admin).await?;

    let name = copy_name();
    admin
        .execute(sqlx::raw_sql(&format!(
            // FILE_COPY: a third faster than the default WAL_LOG with eight
            // tests copying at once (measured 3.4 s against 5.1 s, 88 MB).
            "CREATE DATABASE \"{name}\" TEMPLATE \"{template}\" STRATEGY FILE_COPY"
        )))
        .await
        .map_err(fail("copy the template"))?;
    admin.close().await.map_err(fail("close"))?;
    Ok(TestDb { server, name })
}

/// `mb_tpl_<hash of every embedded migration's version and checksum>`: what
/// actually runs, so an edited migration changes the name as surely as a new one.
fn template_name() -> String {
    let mut h = DefaultHasher::new();
    for m in MIGRATOR.iter() {
        (m.version, &*m.checksum).hash(&mut h);
    }
    // ponytail: DefaultHasher may change between Rust releases; that costs one
    // rebuild of the template on a toolchain bump, nothing more.
    format!("mb_tpl_{:016x}", h.finish())
}

/// `mb_t_<unix seconds>_<pid>_<n>`: unique on the machine, and the age is in
/// the name because `pg_database` records no creation time.
fn copy_name() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let n = COPY_SEQ.fetch_add(1, Ordering::Relaxed);
    format!("mb_t_{secs}_{}_{n}", std::process::id())
}

/// Whether a database of this name exists.
async fn db_exists(admin: &mut PgConnection, name: &str) -> Result<bool, TestDbError> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS "e!""#,
        name
    )
    .fetch_one(admin)
    .await
    .map_err(fail("look up a database"))
}

/// The template for the current migrations, built once under the lock.
///
/// Built as `mb_build_<hash>` and renamed only when every migration has
/// applied, so a name that exists is a template that is complete — a build
/// that died half way leaves only a `mb_build_` for the next builder to drop.
async fn ensure_template(
    admin: &mut PgConnection,
    server: &PgConnectOptions,
) -> Result<String, TestDbError> {
    let name = template_name();
    if db_exists(admin, &name).await? {
        return Ok(name);
    }
    admin
        .execute(sqlx::raw_sql(BUILD_LOCK))
        .await
        .map_err(fail("take the build lock"))?;
    let built = if db_exists(admin, &name).await? {
        Ok(())
    } else {
        build_template(admin, server, &name).await
    };
    admin
        .execute(sqlx::raw_sql(BUILD_UNLOCK))
        .await
        .map_err(fail("release the build lock"))?;
    built?;
    trim_templates(admin).await?;
    Ok(name)
}

/// Create the build database, migrate it as the admin (as production's
/// migrations run as the owner), then rename it into place.
async fn build_template(
    admin: &mut PgConnection,
    server: &PgConnectOptions,
    name: &str,
) -> Result<(), TestDbError> {
    let build = name.replacen("mb_tpl_", "mb_build_", 1);
    // Two calls: a multi-statement string is one implicit transaction, and
    // neither statement may run inside one.
    for sql in [
        format!("DROP DATABASE IF EXISTS \"{build}\" WITH (FORCE)"),
        format!("CREATE DATABASE \"{build}\""),
    ] {
        admin
            .execute(sqlx::raw_sql(&sql))
            .await
            .map_err(fail("create the build database"))?;
    }
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect_with(server.clone().database(&build))
        .await
        .map_err(fail("connect to the build database"))?;
    let migrated = MIGRATOR.run(&pool).await;
    pool.close().await;
    migrated.map_err(|e| TestDbError(format!("test database: migrations failed: {e}")))?;
    admin
        .execute(sqlx::raw_sql(&format!(
            "ALTER DATABASE \"{build}\" RENAME TO \"{name}\""
        )))
        .await
        .map_err(fail("rename the template into place"))?;
    Ok(())
}

/// Drop templates beyond the newest few (by OID, which only grows).
///
/// Not `FORCE`: a template another run is copying right now makes the drop
/// wait or fail, and failing is fine — it goes next time.
async fn trim_templates(admin: &mut PgConnection) -> Result<(), TestDbError> {
    let old = sqlx::query_scalar!(
        r#"SELECT datname::text AS "n!" FROM pg_database
            WHERE datname LIKE 'mb\_tpl\_%' ORDER BY oid DESC OFFSET $1"#,
        i64::try_from(KEEP_TEMPLATES).unwrap_or(i64::MAX)
    )
    .fetch_all(&mut *admin)
    .await
    .map_err(fail("list templates"))?;
    for name in old {
        let _ = admin
            .execute(sqlx::raw_sql(&format!(
                "DROP DATABASE IF EXISTS \"{name}\""
            )))
            .await;
    }
    Ok(())
}

/// Drop copies a crashed run left behind. Not `FORCE`, so a copy somebody is
/// still connected to survives however old its name says it is.
async fn sweep_stale_copies(admin: &mut PgConnection) -> Result<(), TestDbError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let copies = sqlx::query_scalar!(
        r#"SELECT datname::text AS "n!" FROM pg_database WHERE datname LIKE 'mb\_t\_%'"#
    )
    .fetch_all(&mut *admin)
    .await
    .map_err(fail("list copies"))?;
    for name in copies.into_iter().filter(|n| is_stale(n, now)) {
        let _ = admin
            .execute(sqlx::raw_sql(&format!(
                "DROP DATABASE IF EXISTS \"{name}\""
            )))
            .await;
    }
    Ok(())
}

/// Whether a copy's name says it is older than [`STALE_COPY_SECS`]. A name
/// that does not parse is not ours to judge, so it is left alone.
fn is_stale(name: &str, now: u64) -> bool {
    name.strip_prefix("mb_t_")
        .and_then(|rest| rest.split('_').next())
        .and_then(|secs| secs.parse::<u64>().ok())
        .is_some_and(|secs| now.saturating_sub(secs) > STALE_COPY_SECS)
}

#[cfg(test)]
mod tests {
    use super::is_stale;

    #[test]
    fn only_an_old_parseable_copy_is_stale() {
        assert!(is_stale("mb_t_1000_42_0", 1000 + 3601));
        assert!(!is_stale("mb_t_1000_42_0", 1000 + 60));
        assert!(!is_stale("mb_t_notanumber_1_0", u64::MAX));
        assert!(!is_stale("mb_tpl_abc", u64::MAX));
    }
}

//! Fast, isolated databases for tests, on a real PostgreSQL 17.
//!
//! ```ignore
//! let db = medbrains_db_migrations::testing::fresh_db().await.expect("test database");
//! let app = db.connect(testing::APP_ROLE).await.expect("app pool");
//! ```
//!
//! The migrations run once per migration set, into a template database named
//! by their fingerprint (`mb_tpl_<hash>`). Every test then gets its own copy
//! (`CREATE DATABASE … TEMPLATE`): about a second, where migrating takes four
//! seconds on the tuned test cluster and minutes on a stock one. The copy is
//! dropped when the [`TestDb`] is dropped, panics included; copies a crashed
//! run left behind are swept by a later one.
//!
//! Tests connect as the roles production uses — [`APP_ROLE`] is not a
//! superuser and does not bypass row level security — so a tenant wall the
//! test exercises is the wall the server runs behind.
//!
//! The server comes from `MEDBRAINS_TEST_PG`, else the machine's test cluster
//! (`make test-db`). An unreachable server is an error, never a skip: a skipped
//! safety test reports the same as a passing one. A server that is not a test
//! cluster is refused (see [`refuse_unsafe_server`]): this creates, migrates
//! and drops databases, and must never do that to the dev or a live cluster.
//!
//! A suite whose tests share one hospital (the server's integration tests)
//! takes [`slot_db`] instead: one copy per parallel slot of the test runner,
//! found again by every test process that lands in that slot.
//!
//! Database names are generated here from digits, `a-z` and `_` only, and
//! names read back from the server are checked against that ([`cleanup::is_ours`])
//! before use, which is why the DDL below can be formatted into `raw_sql`:
//! `CREATE DATABASE` takes no bind parameters.

use std::hash::{DefaultHasher, Hash, Hasher};
use std::str::FromStr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::MIGRATOR;
use cleanup::{sweep_stale_copies, trim_templates};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::types::Uuid;
use sqlx::{ConnectOptions, Connection, Executor, PgConnection, PgPool};

/// Environment variable naming the server's admin URL (a superuser).
pub const SERVER_ENV: &str = "MEDBRAINS_TEST_PG";
/// The cluster `scripts/test_db.sh` starts.
pub const DEFAULT_SERVER: &str = "postgres://medbrains:medbrains_test@127.0.0.1:54317/postgres";
/// Set to `1` to use a server [`refuse_unsafe_server`] would refuse.
pub const ALLOW_ANY_ENV: &str = "MEDBRAINS_TEST_PG_ALLOW_ANY";
/// The database that marks a server as a test cluster. `scripts/test_db.sh`
/// and `scripts/ci_postgres.sh` create it; no dev or live cluster has it.
pub const MARKER_DB: &str = "medbrains_test_cluster";
/// The dev database's port (docker-compose); never a test target.
const DEV_PORT: u16 = 5435;
/// The request role: row level security applies to it (migration 0981).
pub const APP_ROLE: &str = "medbrains_app";
/// The background worker's role, which bypasses row level security (0984).
pub const WORKER_ROLE: &str = "medbrains_outbox_worker";

/// Serialises template builds across tests, processes and worktrees. Advisory
/// locks are per database, and every caller takes it on the server's own one.
const BUILD_LOCK: &str = "SELECT pg_advisory_lock(7_262_840_558_645)";
const BUILD_UNLOCK: &str = "SELECT pg_advisory_unlock(7_262_840_558_645)";

mod cleanup;
mod slot;

pub use slot::slot_db;

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

/// One test's private database, dropped with this value — or one runner
/// slot's shared database ([`slot_db`]), which is kept.
#[derive(Debug)]
pub struct TestDb {
    server: PgConnectOptions,
    name: String,
    /// A slot's database only: an open connection, so the stale sweep (which
    /// never forces) cannot drop the database under the process using it.
    hold: Option<PgConnection>,
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

    /// A URL for this database as the server's admin, which owns the schema —
    /// for a harness that migrates and seeds through its own pool.
    #[must_use]
    pub fn owner_url(&self) -> String {
        self.url(self.server.get_username())
    }

    /// A small pool on this database as `role`. For [`APP_ROLE`] and
    /// [`WORKER_ROLE`] it first proves the role is what production relies on:
    /// roles are cluster-wide, so one test, agent or operator altering them
    /// would otherwise turn every RLS test into a superuser's.
    ///
    /// # Errors
    /// The role cannot log in (it is created by the migrations), or it is a
    /// superuser, or its row level security bypass is not as expected.
    pub async fn connect(&self, role: &str) -> Result<PgPool, TestDbError> {
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .connect_with(self.options(role))
            .await
            .map_err(fail("connect to the copy"))?;
        if role == APP_ROLE || role == WORKER_ROLE {
            let r = sqlx::query!(
                r#"SELECT rolsuper AS "superuser!", rolbypassrls AS "bypass!"
                     FROM pg_roles WHERE rolname = current_user"#
            )
            .fetch_one(&pool)
            .await
            .map_err(fail("read the role"))?;
            if r.superuser || r.bypass != (role == WORKER_ROLE) {
                return Err(TestDbError(format!(
                    "test database: {role} has superuser={} bypassrls={}; \
                     the migrations make it NOSUPERUSER and {}",
                    r.superuser,
                    r.bypass,
                    if role == WORKER_ROLE {
                        "BYPASSRLS"
                    } else {
                        "NOBYPASSRLS"
                    }
                )));
            }
        }
        Ok(pool)
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
    /// A slot's database is left for the next test in the slot.
    fn drop(&mut self) {
        if self.hold.is_some() {
            return;
        }
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
    let (server, mut admin) = admin().await?;
    sweep_stale_copies(&mut admin).await?;
    let name = copy_name(&format!("{}_{}", std::process::id(), next_seq()));
    copy_template(&mut admin, &server, &name).await?;
    admin.close().await.map_err(fail("close"))?;
    Ok(TestDb {
        server,
        name,
        hold: None,
    })
}

/// An admin connection to the test server, after every check that it is one.
///
/// # Errors
/// The server is unreachable, or is not a test cluster.
async fn admin() -> Result<(PgConnectOptions, PgConnection), TestDbError> {
    let url = std::env::var(SERVER_ENV).unwrap_or_else(|_| DEFAULT_SERVER.to_owned());
    let server = PgConnectOptions::from_str(&url)
        .map_err(|e| TestDbError(format!("{SERVER_ENV}={url} is not a URL: {e}")))?;
    refuse_unsafe_server(&server)?;
    let mut admin = PgConnection::connect_with(&server).await.map_err(|e| {
        TestDbError(format!(
            "no test PostgreSQL at {}:{}: {e}\n\
             Run `make test-db` (from medbrains/), or set {SERVER_ENV}.",
            server.get_host(),
            server.get_port()
        ))
    })?;
    if !allow_any() && !db_exists(&mut admin, MARKER_DB).await? {
        return Err(TestDbError(format!(
            "refusing {}:{}: it has no `{MARKER_DB}` database, so it is not a \
             test cluster. Run `make test-db`, or set {ALLOW_ANY_ENV}=1.",
            server.get_host(),
            server.get_port()
        )));
    }
    Ok((server, admin))
}

/// Copy the current migrations' template to a database called `name`.
async fn copy_template(
    admin: &mut PgConnection,
    server: &PgConnectOptions,
    name: &str,
) -> Result<(), TestDbError> {
    // Twice at most: a template can be trimmed by another worktree between
    // the check and the copy, and the second pass rebuilds it.
    let mut copied = Err(TestDbError(String::new()));
    for _ in 0..2 {
        let template = ensure_template(admin, server).await?;
        copied = admin
            .execute(sqlx::raw_sql(&format!(
                // FILE_COPY: a third faster than the default WAL_LOG with eight
                // tests copying at once (measured 3.4 s against 5.1 s, 88 MB).
                "CREATE DATABASE \"{name}\" TEMPLATE \"{template}\" STRATEGY FILE_COPY"
            )))
            .await
            .map(drop)
            .map_err(fail("copy the template"));
        if copied.is_ok() {
            break;
        }
    }
    copied
}

/// Whether the operator has asked for the safety checks to be skipped.
fn allow_any() -> bool {
    std::env::var(ALLOW_ANY_ENV).is_ok_and(|v| v == "1")
}

/// Refuse a server that is not on loopback, or is the dev database's port,
/// before connecting. The marker database is checked after connecting.
///
/// # Errors
/// The server could be somebody's dev or live cluster.
pub fn refuse_unsafe_server(server: &PgConnectOptions) -> Result<(), TestDbError> {
    let host = server.get_host();
    let loopback = matches!(host, "127.0.0.1" | "localhost" | "::1");
    if allow_any() || (loopback && server.get_port() != DEV_PORT) {
        return Ok(());
    }
    Err(TestDbError(format!(
        "refusing {host}:{}: test databases go only to a loopback test cluster, \
         never the dev port {DEV_PORT} or another host. Set {ALLOW_ANY_ENV}=1 \
         to override.",
        server.get_port()
    )))
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

/// `mb_t_<unix seconds>_<rest>`: the age is in the name because `pg_database`
/// records no creation time. `rest` is `<pid>_<n>` for a test's own copy
/// (unique on the machine) and `<run>_s<slot>` for a slot's.
fn copy_name(rest: &str) -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    format!("mb_t_{secs}_{rest}")
}

/// The next number for this process's own copies.
fn next_seq() -> u32 {
    COPY_SEQ.fetch_add(1, Ordering::Relaxed)
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

#[cfg(test)]
mod tests {
    use super::cleanup::{is_ours, is_stale};
    use super::refuse_unsafe_server;
    use sqlx::postgres::PgConnectOptions;
    use std::str::FromStr;

    #[test]
    fn only_generated_names_are_ours() {
        assert!(is_ours("mb_t_1794801574_16854_0"));
        assert!(is_ours("mb_tpl_b208f42319df739e"));
        assert!(!is_ours("mb_t_"));
        assert!(!is_ours("mb_t_x\"; DROP DATABASE medbrains; --"));
        assert!(!is_ours("mb_t_ABC"));
        assert!(!is_ours("medbrains"));
        assert!(!is_ours("mb_build_abc"));
    }

    #[test]
    fn a_slot_copy_is_named_and_swept_like_any_copy() {
        let name = super::copy_name("0a1b2c3d4e5f_s3");
        assert!(is_ours(&name), "{name}");
        assert!(name.ends_with("_0a1b2c3d4e5f_s3"));
        assert!(!name.ends_with("_0a1b2c3d4e5f_s13"));
        assert!(is_stale("mb_t_1000_0a1b2c3d4e5f_s3", 1000 + 3601));
        assert!(!is_stale("mb_t_1000_0a1b2c3d4e5f_s3", 1000 + 60));
    }

    #[test]
    fn only_a_loopback_non_dev_server_is_accepted() {
        let ok = |url: &str| {
            PgConnectOptions::from_str(url).is_ok_and(|o| refuse_unsafe_server(&o).is_ok())
        };
        assert!(ok("postgres://u@127.0.0.1:54317/postgres"));
        assert!(ok("postgres://u@localhost:5432/postgres"));
        assert!(
            !ok("postgres://u@localhost:5435/postgres"),
            "the dev database"
        );
        assert!(
            !ok("postgres://u@db.example.org:5432/postgres"),
            "another host"
        );
        assert!(!ok("postgres://u@10.0.0.5:54317/postgres"), "another host");
    }

    #[test]
    fn only_an_old_parseable_copy_is_stale() {
        assert!(is_stale("mb_t_1000_42_0", 1000 + 3601));
        assert!(!is_stale("mb_t_1000_42_0", 1000 + 60));
        assert!(!is_stale("mb_t_notanumber_1_0", u64::MAX));
        assert!(!is_stale("mb_tpl_abc", u64::MAX));
    }
}

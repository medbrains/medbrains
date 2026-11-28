//! One database per parallel slot of a test run, for a suite whose tests share
//! one hospital and so cannot each have a copy of their own.

use sqlx::postgres::PgConnectOptions;
use sqlx::{Connection, Executor, PgConnection};

use super::cleanup::{list_copies, sweep_stale_copies};
use super::{TestDb, TestDbError, admin, copy_name, copy_template, fail};

/// Serialises slot creation, so two processes that both find their slot's
/// database missing make one. Held with the build lock inside it, never the
/// other way round.
const SLOT_LOCK: &str = "SELECT pg_advisory_lock(7_262_840_558_646)";
const SLOT_UNLOCK: &str = "SELECT pg_advisory_unlock(7_262_840_558_646)";

/// The database of one parallel slot of one test run.
///
/// Made on first use and found again by every later caller with the same
/// `run` and `slot`, other processes included. For a suite whose tests share
/// one hospital: tests in a slot run one after another on its database, and
/// slots never meet.
///
/// `run` and `slot` come from the test runner (cargo-nextest's
/// `NEXTEST_RUN_ID` and `NEXTEST_TEST_GLOBAL_SLOT`). The database is not
/// dropped with the value: it is named like any copy, so the stale sweep of a
/// later run removes it once nobody is connected.
///
/// # Errors
/// As [`super::fresh_db`]; or `run` holds no hex digit to name the database by.
pub async fn slot_db(run: &str, slot: u32) -> Result<TestDb, TestDbError> {
    let run: String = run
        .chars()
        .filter(char::is_ascii_hexdigit)
        .map(|c| c.to_ascii_lowercase())
        .take(12)
        .collect();
    if run.is_empty() {
        return Err(TestDbError(
            "test database: the run id has no hex digit".to_owned(),
        ));
    }
    let suffix = format!("_{run}_s{slot}");
    let (server, mut admin) = admin().await?;
    // Thrice at most: the sweep of another run can drop a slot nobody is
    // connected to between finding it and connecting, and the next pass
    // makes it again.
    let mut last = TestDbError(String::new());
    for _ in 0..3 {
        let name = ensure_slot(&mut admin, &server, &suffix).await?;
        match PgConnection::connect_with(&server.clone().database(&name)).await {
            Ok(hold) => {
                admin.close().await.map_err(fail("close"))?;
                return Ok(TestDb {
                    server,
                    name,
                    hold: Some(hold),
                });
            }
            Err(e) => last = fail("connect to the slot's database")(e),
        }
    }
    Err(last)
}

/// The name of the slot database ending in `suffix`, copied from the template
/// under the slot lock if no process has made it yet.
async fn ensure_slot(
    admin: &mut PgConnection,
    server: &PgConnectOptions,
    suffix: &str,
) -> Result<String, TestDbError> {
    if let Some(name) = find_slot(admin, suffix).await? {
        return Ok(name);
    }
    admin
        .execute(sqlx::raw_sql(SLOT_LOCK))
        .await
        .map_err(fail("take the slot lock"))?;
    let made = match find_slot(admin, suffix).await {
        Ok(Some(name)) => Ok(name),
        Ok(None) => {
            let name = copy_name(suffix.trim_start_matches('_'));
            let swept = sweep_stale_copies(admin).await;
            let copied = copy_template(admin, server, &name).await;
            swept.and(copied).map(|()| name)
        }
        Err(e) => Err(e),
    };
    admin
        .execute(sqlx::raw_sql(SLOT_UNLOCK))
        .await
        .map_err(fail("release the slot lock"))?;
    made
}

/// The existing copy whose name ends in `suffix`, if any.
async fn find_slot(admin: &mut PgConnection, suffix: &str) -> Result<Option<String>, TestDbError> {
    Ok(list_copies(admin)
        .await?
        .into_iter()
        .find(|n| n.ends_with(suffix)))
}

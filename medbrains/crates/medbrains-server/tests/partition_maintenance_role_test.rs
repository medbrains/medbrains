//! The daily background passes work when the server connects as
//! `medbrains_app` (migration 1209): partition maintenance runs as the owner,
//! and nobody but the owner can steer it.

use crate::common;

use uuid::Uuid;

/// Given a table registered for monthly partitions, When the app role runs
/// the daily job, Then the months are made, protected by RLS.
#[tokio::test]
async fn the_app_role_makes_partitions() {
    let app = common::spawn_app_as_request_role().await;
    let t = format!("zz_partrole_{}", &Uuid::new_v4().simple().to_string()[..8]);
    sqlx::raw_sql(&format!(
        "CREATE TABLE {t} (id uuid, tenant_id uuid NOT NULL, created_at timestamptz NOT NULL) \
           PARTITION BY RANGE (created_at); \
         ALTER TABLE {t} ENABLE ROW LEVEL SECURITY; \
         INSERT INTO partition_config (table_name, partition_column, premake) VALUES ('{t}', 'created_at', 2);"
    ))
    .execute(&app.db)
    .await
    .expect("setup");

    for role in ["medbrains_app", "medbrains_outbox_worker"] {
        let pool = medbrains_db::pool::create_pool(&common::role_url(role))
            .await
            .expect("role pool");
        sqlx::query("SELECT ensure_partitions_with_rls()")
            .execute(&pool)
            .await
            .unwrap_or_else(|e| panic!("{role}: {e}"));
    }

    let unprotected: Vec<(String, bool)> = sqlx::query_as(
        "SELECT c.relname::text, c.relrowsecurity FROM pg_inherits i \
           JOIN pg_class c ON c.oid = i.inhrelid WHERE i.inhparent = $1::regclass ORDER BY 1",
    )
    .bind(&t)
    .fetch_all(&app.db)
    .await
    .expect("partitions");
    // This month, two ahead, and the default.
    assert_eq!(unprotected.len(), 4, "{unprotected:?}");
    assert!(unprotected.iter().all(|(_, rls)| *rls), "{unprotected:?}");

    sqlx::raw_sql(&format!(
        "DELETE FROM partition_config WHERE table_name = '{t}'; DROP TABLE {t};"
    ))
    .execute(&app.db)
    .await
    .expect("cleanup");
}

/// The owner's job is only the login roles' to call, and neither can change
/// what it does: a row they could add would have the owner drop a table.
#[tokio::test]
async fn only_the_owner_can_steer_the_job() {
    let app = common::spawn_app().await;
    let public: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a \
          WHERE p.proname = 'ensure_partitions_with_rls' AND a.grantee = 0)",
    )
    .fetch_one(&app.db)
    .await
    .expect("acl");
    assert!(!public, "PUBLIC may not run the owner's job");
    for role in ["medbrains_app", "medbrains_outbox_worker"] {
        let (run, write): (bool, bool) = sqlx::query_as(
            "SELECT has_function_privilege($1, 'public.ensure_partitions_with_rls()', 'EXECUTE'), \
                    has_table_privilege($1, 'public.partition_config', 'INSERT, UPDATE, DELETE, TRUNCATE')",
        )
        .bind(role)
        .fetch_one(&app.db)
        .await
        .expect("privilege");
        assert!(run && !write, "{role}: execute {run}, write {write}");
    }
}

/// The retention and queue-rollover passes complete as the app role.
#[tokio::test]
async fn the_background_passes_run_as_the_app_role() {
    let _app = common::spawn_app_as_request_role().await;
    let pool = medbrains_db::pool::create_pool(&common::role_url("medbrains_app"))
        .await
        .expect("app pool");
    medbrains_server::services::retention::run_retention_pass(&pool)
        .await
        .expect("retention pass");
    medbrains_server::services::queue_rollover::run_rollover_pass(&pool)
        .await
        .expect("rollover pass");
}

//! What a run reads and writes, against a real Postgres.
//!
//! These need the docker-compose dev database, so they are ignored by default:
//!
//!   cargo test -p medbrains-automation-store -- --ignored
//!
//! Real Postgres rather than a fake, because the property under test is row
//! level security. A mock would agree with whatever the code asked it, and the
//! question is whether the *database* refuses one hospital a look at another's
//! watermarks.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use medbrains_automation::TenantStores;
use medbrains_automation::prelude::BinaryMeta;
use medbrains_automation_store::runtime::Stores;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains".to_owned()
    });
    PgPool::connect(&url)
        .await
        .expect("needs the docker-compose dev database")
}

/// Two tenants that really exist.
///
/// The second is created if the dev database only has one, because an
/// isolation test against a tenant that owns nothing passes whatever the code
/// does. The whole question is whether one hospital's row is withheld from
/// another hospital that is genuinely there.
async fn two_tenants(pool: &PgPool) -> (Uuid, Uuid) {
    // Explicitly not the probe: these tests run in parallel, and picking "the
    // first tenant" would sometimes pick the one another test just created.
    let first: Uuid = sqlx::query_scalar(
        "SELECT id FROM tenants WHERE code <> 'RLS-PROBE' ORDER BY created_at LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .expect("dev database has no tenants to test against");

    let second: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type)
         VALUES ('RLS-PROBE', 'Isolation probe',
                 (SELECT hospital_type FROM tenants WHERE code <> 'RLS-PROBE' LIMIT 1))
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id",
    )
    .fetch_one(pool)
    .await
    .expect("create a second tenant");

    assert_ne!(first, second, "the two tenants must be different");
    (first, second)
}

/// Write a setup row with the tenant claimed.
///
/// Harmless as a superuser, required as the application role: an insert on the
/// bare pool carries no tenant, so row level security refuses it with
/// `new row violates row-level security policy`. A fixture that cannot write
/// its own preconditions fails before the test has said anything.
async fn as_tenant(pool: &PgPool, tenant: Uuid) -> sqlx::pool::PoolConnection<sqlx::Postgres> {
    let mut conn = pool.acquire().await.expect("a connection");
    sqlx::query("SELECT set_config('app.tenant_id', $1, false)")
        .bind(tenant.to_string())
        .execute(&mut *conn)
        .await
        .expect("claim the tenant");
    conn
}

/// A workflow row, because state is keyed by one.
async fn a_workflow(pool: &PgPool, tenant: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO public.automation_workflows (id, tenant_id, name, nodes, connections)
         VALUES ($1, $2, 'test', '[]'::jsonb, '[]'::jsonb)",
    )
    .bind(id)
    .bind(tenant)
    .execute(&mut *as_tenant(pool, tenant).await)
    .await
    .expect("insert a workflow");
    id
}

// =================================================================== state

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_watermark_written_by_one_run_is_read_by_the_next() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;
    let workflow = a_workflow(&pool, tenant).await;

    let stores = Stores::new(pool.clone());
    let state = stores.state(tenant);

    state
        .commit(
            &workflow.to_string(),
            [("lastSync".to_owned(), json!("2026-08-20T02:00:00Z"))]
                .into_iter()
                .collect(),
        )
        .await
        .expect("commit");

    let read = state.load(&workflow.to_string()).await.expect("load");

    assert_eq!(read["lastSync"], json!("2026-08-20T02:00:00Z"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn one_hospital_cannot_read_another_s_watermark() {
    // The failure this guards: two hospitals sharing a watermark, each
    // silently skipping the other's records.
    let pool = pool().await;
    let (first, second) = two_tenants(&pool).await;
    let workflow = a_workflow(&pool, first).await;

    let stores = Stores::new(pool.clone());
    stores
        .state(first)
        .commit(
            &workflow.to_string(),
            [("lastSync".to_owned(), json!("first-hospital"))]
                .into_iter()
                .collect(),
        )
        .await
        .expect("commit");

    // Same workflow id, different tenant. The id is not a secret; the
    // isolation cannot depend on nobody guessing it.
    let seen = stores
        .state(second)
        .load(&workflow.to_string())
        .await
        .expect("load");

    assert!(seen.is_empty(), "read another tenant's watermark: {seen:?}");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn remembering_the_same_key_twice_replaces_it() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;
    let workflow = a_workflow(&pool, tenant).await;
    let state = Stores::new(pool.clone()).state(tenant);

    for value in ["first", "second"] {
        state
            .commit(
                &workflow.to_string(),
                [("lastSync".to_owned(), json!(value))].into_iter().collect(),
            )
            .await
            .expect("commit");
    }

    let read = state.load(&workflow.to_string()).await.expect("load");
    assert_eq!(read["lastSync"], json!("second"));
    assert_eq!(read.len(), 1, "a second row was written instead of an update");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_workflow_that_has_never_run_remembers_nothing() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;
    let workflow = a_workflow(&pool, tenant).await;

    let read = Stores::new(pool.clone())
        .state(tenant)
        .load(&workflow.to_string())
        .await
        .expect("load");

    // Empty rather than an error: the first run of an incremental sync asks
    // for everything, and that is not a failure.
    assert!(read.is_empty());
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn deleting_a_workflow_forgets_what_it_remembered() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;
    let workflow = a_workflow(&pool, tenant).await;
    let state = Stores::new(pool.clone()).state(tenant);

    state
        .commit(
            &workflow.to_string(),
            [("lastSync".to_owned(), json!("x"))].into_iter().collect(),
        )
        .await
        .expect("commit");

    sqlx::query("DELETE FROM public.automation_workflows WHERE id = $1")
        .bind(workflow)
        .execute(&pool)
        .await
        .expect("delete");

    let orphans: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM public.automation_state WHERE workflow_id = $1",
    )
    .bind(workflow)
    .fetch_one(&pool)
    .await
    .expect("count");

    assert_eq!(orphans, 0, "state outlived the workflow it belonged to");
}

// =============================================================== variables

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_deployment_reads_the_variables_it_was_given() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;

    sqlx::query(
        "INSERT INTO public.automation_variables (tenant_id, key, value)
         VALUES ($1, 'FHIR_BASE_URL', $2)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2",
    )
    .bind(tenant)
    .bind(json!("https://hims.example.org"))
    .execute(&mut *as_tenant(&pool, tenant).await)
    .await
    .expect("insert");

    let values = Stores::new(pool.clone()).variables(tenant).await.all();

    assert_eq!(values["FHIR_BASE_URL"], json!("https://hims.example.org"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn one_hospital_is_not_pointed_at_another_s_server() {
    let pool = pool().await;
    let (first, second) = two_tenants(&pool).await;

    sqlx::query(
        "INSERT INTO public.automation_variables (tenant_id, key, value)
         VALUES ($1, 'FHIR_BASE_URL', $2)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2",
    )
    .bind(first)
    .bind(json!("https://first.example.org"))
    .execute(&mut *as_tenant(&pool, first).await)
    .await
    .expect("insert");

    let values = Stores::new(pool.clone()).variables(second).await.all();

    assert!(
        values.get("FHIR_BASE_URL") != Some(&json!("https://first.example.org")),
        "read another tenant's server address"
    );
}

// ================================================================ binaries

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_stored_file_comes_back_byte_for_byte() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;
    let binaries = Stores::new(pool.clone()).binaries(tenant);
    let execution = Uuid::new_v4();

    // Not valid UTF-8: a store that round-trips through a string would ruin it.
    let bytes = vec![0x89, b'P', b'N', b'G', 0x00, 0xFF, 0xFE];
    let stored = binaries
        .put(
            &execution.to_string(),
            &BinaryMeta {
                file_name: Some("scan.png".to_owned()),
                mime_type: "image/png".to_owned(),
            },
            bytes.clone(),
        )
        .await
        .expect("put");

    assert_eq!(binaries.get(&stored.id).await.expect("get"), bytes);
    assert_eq!(stored.file_name.as_deref(), Some("scan.png"));
    assert_eq!(stored.size, 7);
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn one_hospital_cannot_read_another_s_scan() {
    // The file in question is usually a scanned discharge summary.
    let pool = pool().await;
    let (first, second) = two_tenants(&pool).await;
    let stores = Stores::new(pool.clone());

    let stored = stores
        .binaries(first)
        .put(
            &Uuid::new_v4().to_string(),
            &BinaryMeta::default(),
            b"a discharge summary".to_vec(),
        )
        .await
        .expect("put");

    let attempt = stores.binaries(second).get(&stored.id).await;

    assert!(attempt.is_err(), "read another tenant's file");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn forgetting_a_run_takes_every_file_it_produced_and_no_others() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;
    let binaries = Stores::new(pool.clone()).binaries(tenant);

    let doomed = Uuid::new_v4().to_string();
    let kept = Uuid::new_v4().to_string();
    for _ in 0..3 {
        binaries
            .put(&doomed, &BinaryMeta::default(), b"x".to_vec())
            .await
            .expect("put");
    }
    let survivor = binaries
        .put(&kept, &BinaryMeta::default(), b"y".to_vec())
        .await
        .expect("put");

    assert_eq!(binaries.forget(&doomed).await.expect("forget"), 3);
    assert!(binaries.get(&survivor.id).await.is_ok());
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_file_that_is_gone_says_the_run_may_have_been_pruned() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;

    let error = Stores::new(pool.clone())
        .binaries(tenant)
        .get(&Uuid::new_v4().to_string())
        .await
        .expect_err("should not find it");

    assert!(error.to_string().contains("pruned"), "{error}");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn an_identifier_that_is_not_one_is_refused_rather_than_matching_nothing() {
    let pool = pool().await;
    let (tenant, _) = two_tenants(&pool).await;

    let error = Stores::new(pool.clone())
        .binaries(tenant)
        .get("../../etc/passwd")
        .await
        .expect_err("should refuse");

    assert!(error.to_string().contains("not a MedBrains identifier"), "{error}");
}

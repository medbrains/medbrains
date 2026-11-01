//! The kernel's promises, against real Postgres where the promise is about
//! what the database does.
//!
//! ```text
//! cargo test -p medbrains-kernel                 # the no-database ones
//! DATABASE_URL=… cargo test -p medbrains-kernel -- --ignored
//! ```
//!
//! `DATABASE_URL` must name a migrated database and a role that may
//! `SET ROLE medbrains_app` (the owner does), so row level security applies.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::print_stderr
)]

use medbrains_authz::backend_pg::PgAuthzBackend;
use medbrains_authz::{AuthzContext, Relation};
use medbrains_kernel::authz::Resource;
use medbrains_kernel::{Actor, AppError, Outcome, audit::AuditEntry};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

fn clinician(tenant_id: Uuid) -> AuthzContext {
    AuthzContext {
        tenant_id,
        user_id: Uuid::new_v4(),
        role: "doctor".to_owned(),
        department_ids: Vec::new(),
        is_bypass: false,
    }
}

/// An authorisation engine that cannot be reached answers `Unknown`, so the
/// boundary says "unavailable" (503), never "no such record" (404).
#[tokio::test]
async fn an_unreachable_backend_is_unknown_not_deny() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://nobody@127.0.0.1:1/none")
        .expect("lazy pool");
    pool.close().await;
    let backend = PgAuthzBackend::new(pool);
    let patient = Resource {
        kind: "patient",
        id: Uuid::new_v4(),
    };

    let outcome = medbrains_kernel::authorize(
        &backend,
        &clinician(Uuid::new_v4()),
        Relation::Viewer,
        patient,
    )
    .await;
    assert_eq!(outcome, Outcome::Unknown);
    assert!(matches!(
        medbrains_kernel::authz::collapse(outcome),
        Err(AppError::ServiceUnavailable(_))
    ));

    // A list is never rendered from an outage: every row is Unknown, none dropped.
    let ids = [Uuid::new_v4(), Uuid::new_v4()];
    let rows = medbrains_kernel::authz::authorize_many(
        &backend,
        &clinician(Uuid::new_v4()),
        Relation::Viewer,
        "patient",
        &ids,
    )
    .await;
    assert_eq!(rows.len(), 2);
    assert!(rows.values().all(|o| *o == Outcome::Unknown));
}

/// A caller that lost its tenant gets `Unknown` before the backend is asked.
#[tokio::test]
async fn a_caller_without_a_tenant_is_unknown() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://nobody@127.0.0.1:1/none")
        .expect("lazy pool");
    let backend = PgAuthzBackend::new(pool);
    let patient = Resource {
        kind: "patient",
        id: Uuid::new_v4(),
    };
    let outcome =
        medbrains_kernel::authorize(&backend, &clinician(Uuid::nil()), Relation::Viewer, patient)
            .await;
    assert_eq!(outcome, Outcome::Unknown);
}

async fn app_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(2)
        .after_connect(|conn, _| {
            Box::pin(async move {
                sqlx::query("SET ROLE medbrains_app").execute(conn).await?;
                Ok(())
            })
        })
        .connect(&url)
        .await
        .expect("database")
}

async fn owner_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .expect("database")
}

/// Two hospitals and a user in the first.
async fn fixture(owner: &PgPool) -> (Actor, Actor) {
    let mut ids = Vec::new();
    for _ in 0..2 {
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO tenants (id, code, name, hospital_type) VALUES ($1, $2, 'Kernel test', 'medical_college')")
            .bind(id)
            .bind(format!("KT{}", id.simple().to_string()[..8].to_uppercase()))
            .execute(owner)
            .await
            .expect("tenant");
        ids.push(id);
    }
    let user: Uuid = sqlx::query_scalar("SELECT id FROM users ORDER BY created_at LIMIT 1")
        .fetch_one(owner)
        .await
        .expect("a seeded user");
    (
        Actor {
            tenant_id: ids[0],
            user_id: user,
        },
        Actor {
            tenant_id: ids[1],
            user_id: user,
        },
    )
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn work_scopes_reads_to_its_tenant() {
    let owner = owner_pool().await;
    let (a, b) = fixture(&owner).await;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'kernel_test', 'flag', 'true')",
    )
    .bind(a.tenant_id)
    .execute(&owner)
    .await
    .expect("setting");

    let app = app_pool().await;
    let unfiltered = async |tx: &mut medbrains_kernel::Tx| {
        Ok(sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM tenant_settings WHERE category = 'kernel_test'",
        )
        .fetch_one(&mut **tx)
        .await?)
    };
    assert_eq!(
        medbrains_kernel::work(&app, a, &unfiltered).await.unwrap(),
        1
    );
    assert_eq!(
        medbrains_kernel::work(&app, b, &unfiltered).await.unwrap(),
        0
    );

    let seen = medbrains_kernel::work(&app, a, async |tx: &mut medbrains_kernel::Tx| {
        medbrains_kernel::config::get(tx, "kernel_test/flag").await
    })
    .await
    .unwrap();
    assert_eq!(seen, Some(serde_json::Value::Bool(true)));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn audit_appends_a_chained_row() {
    let owner = owner_pool().await;
    let (a, _) = fixture(&owner).await;
    let app = app_pool().await;
    for action in ["kernel_test_one", "kernel_test_two"] {
        medbrains_kernel::work(&app, a, async |tx: &mut medbrains_kernel::Tx| {
            let entry = AuditEntry {
                tenant_id: a.tenant_id,
                user_id: Some(a.user_id),
                action,
                entity_type: "kernel_test",
                entity_id: None,
                old_values: None,
                new_values: None,
                ip_address: None,
            };
            medbrains_kernel::audit(tx, &entry).await
        })
        .await
        .unwrap();
    }

    // Creating a hospital seeds masters, which audit too; look at ours.
    let rows: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT hash, prev_hash FROM audit_log \
          WHERE tenant_id = $1 AND entity_type = 'kernel_test' ORDER BY created_at",
    )
    .bind(a.tenant_id)
    .fetch_all(&owner)
    .await
    .unwrap();
    assert_eq!(rows.len(), 2);
    assert!(
        rows[0].1.is_some(),
        "the first row links to the hospital's chain"
    );
    assert_eq!(
        rows[1].1.as_deref(),
        Some(rows[0].0.as_str()),
        "the second links to the first"
    );

    let verdict = medbrains_db::audit::AuditLogger::verify_chain_for_tenant(&owner, a.tenant_id)
        .await
        .unwrap();
    assert!(verdict.valid);

    // An entry naming another hospital is refused, not written.
    let refused = medbrains_kernel::work(&app, a, async |tx: &mut medbrains_kernel::Tx| {
        let entry = AuditEntry {
            tenant_id: Uuid::new_v4(),
            user_id: None,
            action: "kernel_test_forged",
            entity_type: "kernel_test",
            entity_id: None,
            old_values: None,
            new_values: None,
            ip_address: None,
        };
        medbrains_kernel::audit(tx, &entry).await
    })
    .await;
    assert!(matches!(refused, Err(AppError::Forbidden)));
}

/// What the facade costs over calling the wrapped functions directly:
/// begin + context, one authorisation check, one audit append, commit.
/// Budget (RFC-HOSPITAL-OS §8i): < 0.2 ms overhead per unit of work.
#[tokio::test]
#[ignore = "needs-pg"]
async fn facade_overhead_is_within_budget() {
    use medbrains_authz::backend_test::InMemoryBackend;
    use std::time::Instant;
    const RUNS: u32 = 300;

    let owner = owner_pool().await;
    let (a, _) = fixture(&owner).await;
    let app = app_pool().await;
    let backend = InMemoryBackend::new();
    let ctx = clinician(a.tenant_id);
    let patient = Resource {
        kind: "patient",
        id: Uuid::new_v4(),
    };
    let entry = AuditEntry {
        tenant_id: a.tenant_id,
        user_id: Some(a.user_id),
        action: "kernel_bench",
        entity_type: "kernel_test",
        entity_id: None,
        old_values: None,
        new_values: None,
        ip_address: None,
    };

    let direct = async || {
        let mut tx = app.begin().await.unwrap();
        medbrains_db::pool::set_audit_context(&mut tx, &a.tenant_id, &a.user_id, None)
            .await
            .unwrap();
        let answer = medbrains_authz::AuthzBackend::check(
            &backend,
            &ctx,
            Relation::Viewer,
            "patient",
            patient.id,
        )
        .await;
        let _ = medbrains_server_core::middleware::authorization::outcome_of(answer, "patient");
        medbrains_db::audit::AuditLogger::log(&mut tx, &entry)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    };
    let kernel = async || {
        medbrains_kernel::work(&app, a, async |tx: &mut medbrains_kernel::Tx| {
            let _ = medbrains_kernel::authorize(&backend, &ctx, Relation::Viewer, patient).await;
            medbrains_kernel::audit(tx, &entry).await
        })
        .await
        .unwrap();
    };

    // Warm the pool and caches, then interleave so drift hits both equally.
    for _ in 0..20 {
        direct().await;
        kernel().await;
    }
    let (mut t_direct, mut t_kernel) = (0u128, 0u128);
    for _ in 0..RUNS {
        let start = Instant::now();
        direct().await;
        t_direct += start.elapsed().as_nanos();
        let start = Instant::now();
        kernel().await;
        t_kernel += start.elapsed().as_nanos();
    }
    let per = |t: u128| t as f64 / f64::from(RUNS) / 1_000_000.0;
    let overhead = per(t_kernel) - per(t_direct);
    eprintln!(
        "kernel bench: direct {:.4} ms, kernel {:.4} ms, overhead {:.4} ms per unit of work ({RUNS} runs)",
        per(t_direct),
        per(t_kernel),
        overhead
    );
    assert!(
        overhead < 0.2,
        "facade overhead {overhead:.4} ms exceeds the 0.2 ms budget"
    );
}

/// An after-event rides the unit of work: rolled-back work queues nothing,
/// committed work queues exactly one job.
#[tokio::test]
#[ignore = "needs-pg"]
async fn after_events_commit_and_roll_back_with_the_work() {
    let owner = owner_pool().await;
    let (a, _) = fixture(&owner).await;
    let app = app_pool().await;
    let jobs = async |code: &str| -> i64 {
        sqlx::query_scalar(
            "SELECT count(*) FROM job_queue \
              WHERE tenant_id = $1 AND job_type = 'pipeline_event' \
                AND payload->>'event_code' = $2",
        )
        .bind(a.tenant_id)
        .bind(code)
        .fetch_one(&owner)
        .await
        .unwrap()
    };

    let refused = medbrains_kernel::work(&app, a, async |tx: &mut medbrains_kernel::Tx| {
        medbrains_kernel::events::after(tx, "kernel_test.rolled_back", serde_json::json!({}))
            .await?;
        Err::<(), _>(AppError::BadRequest("the work failed".to_owned()))
    })
    .await;
    assert!(refused.is_err());
    assert_eq!(
        jobs("kernel_test.rolled_back").await,
        0,
        "rollback leaked an event"
    );

    medbrains_kernel::work(&app, a, async |tx: &mut medbrains_kernel::Tx| {
        medbrains_kernel::events::after(tx, "kernel_test.committed", serde_json::json!({})).await
    })
    .await
    .unwrap();
    assert_eq!(jobs("kernel_test.committed").await, 1);
}

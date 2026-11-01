//! Security intelligence against real Postgres.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-security-intel -- --include-ignored
//! ```
//!
//! `DATABASE_URL` must name a migrated database as a role that may
//! `SET ROLE medbrains_app` (the owner does): the "request" pool here runs as
//! `medbrains_app`, so row level security applies to it as it does in production.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use chrono::Utc;
use medbrains_security_intel::honeytokens::{BAIT_CATEGORY, BAIT_KEY, Honeytokens};
use medbrains_security_intel::posture::Posture;
use medbrains_security_intel::runner::record;
use medbrains_security_intel::watchers::Watchers;
use medbrains_security_intel::{Check, CheckError, Ctx, Found, Report, Runner, Severity};
use serde_json::json;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

async fn pools() -> (PgPool, PgPool) {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let owner = PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .expect("owner pool");
    let app = PgPoolOptions::new()
        .max_connections(4)
        .after_connect(|conn, _| {
            Box::pin(async move {
                sqlx::query("SET ROLE medbrains_app").execute(conn).await?;
                Ok(())
            })
        })
        .connect(&url)
        .await
        .expect("app pool");
    (owner, app)
}

async fn tenant(owner: &PgPool) -> (Uuid, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, $1, (enum_range(NULL::hospital_type))[1]) RETURNING id",
    )
    .bind(&code)
    .fetch_one(owner)
    .await
    .expect("tenant");
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $2 || '@example.com', 'Night Reader', 'doctor') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("reader_{}", code.to_lowercase()))
    .fetch_one(owner)
    .await
    .expect("user");
    (tenant, user)
}

fn finding(key: &str) -> Found {
    Found {
        asset: "crates.io demo@1.0.0".into(),
        key: key.into(),
        title: "demo".into(),
        severity: Severity::High,
        evidence: json!({}),
        how_to_fix: "upgrade".into(),
        cve_id: None,
    }
}

async fn row(owner: &PgPool, tenant: Uuid, key: &str) -> (String, i32, i32) {
    sqlx::query_as(
        "SELECT remediation_status, occurrences, reopened_count FROM vulnerabilities \
          WHERE tenant_id = $1 AND finding_key = $2",
    )
    .bind(tenant)
    .bind(key)
    .fetch_one(owner)
    .await
    .expect("finding row")
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn findings_merge_reopen_and_resolve_only_after_a_good_run() {
    let (owner, _) = pools().await;
    let (t, _) = tenant(&owner).await;
    let found = Ok(Report::found(vec![finding("RUSTSEC-1")], json!({})));
    record(&owner, t, "dependencies", Utc::now(), &found)
        .await
        .unwrap();
    record(&owner, t, "dependencies", Utc::now(), &found)
        .await
        .unwrap();
    assert_eq!(
        row(&owner, t, "RUSTSEC-1").await,
        ("open".into(), 2, 0),
        "seen twice is one row"
    );

    sqlx::query("UPDATE vulnerabilities SET remediation_status = 'resolved' WHERE tenant_id = $1")
        .bind(t)
        .execute(&owner)
        .await
        .unwrap();
    record(&owner, t, "dependencies", Utc::now(), &found)
        .await
        .unwrap();
    assert_eq!(
        row(&owner, t, "RUSTSEC-1").await,
        ("open".into(), 3, 1),
        "a resolved finding re-opens"
    );

    let failed: Result<Report, CheckError> = Err(CheckError("could not check".into()));
    record(&owner, t, "dependencies", Utc::now(), &failed)
        .await
        .unwrap();
    assert_eq!(
        row(&owner, t, "RUSTSEC-1").await.0,
        "open",
        "an error resolves nothing"
    );

    record(
        &owner,
        t,
        "dependencies",
        Utc::now(),
        &Ok(Report::found(vec![], json!({}))),
    )
    .await
    .unwrap();
    assert_eq!(
        row(&owner, t, "RUSTSEC-1").await.0,
        "resolved",
        "gone from a good run resolves it"
    );
}

struct Broken;

#[async_trait::async_trait]
impl Check for Broken {
    fn key(&self) -> &'static str {
        medbrains_security_intel::POSTURE
    }
    fn per_tenant(&self) -> bool {
        true
    }
    async fn run(&self, _: &Ctx, _: Option<Uuid>) -> Result<Report, CheckError> {
        Err(CheckError("could not check: boom".into()))
    }
}

async fn watcher_findings(ctx: &Ctx, t: Uuid) -> Vec<Found> {
    Watchers { since: Utc::now() }
        .run(ctx, Some(t))
        .await
        .expect("watchers")
        .findings
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_failing_check_leaves_an_error_heartbeat_the_watchers_flag() {
    let (owner, app) = pools().await;
    let (t, _) = tenant(&owner).await;
    let ctx = Ctx {
        request: app,
        worker: owner.clone(),
    };
    Runner::new(ctx.clone(), vec![]).run_one(&Broken).await;

    let (outcome, error): (String, Option<String>) = sqlx::query_as(
        "SELECT outcome, error FROM security_check_runs WHERE tenant_id = $1 AND check_key = 'posture'",
    )
    .bind(t)
    .fetch_one(&owner)
    .await
    .unwrap();
    assert_eq!(
        (outcome.as_str(), error.as_deref()),
        ("error", Some("could not check: boom"))
    );

    let found = watcher_findings(&ctx, t).await;
    assert!(
        found
            .iter()
            .any(|f| f.key == "failing" && f.asset.contains("Security posture")),
        "{found:?}"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_check_that_missed_its_interval_is_flagged() {
    let (owner, app) = pools().await;
    let (t, _) = tenant(&owner).await;
    sqlx::query(
        "INSERT INTO security_check_runs (tenant_id, check_key, started_at, finished_at, outcome) \
         VALUES ($1, 'audit_chain', now() - interval '3 hours', now() - interval '3 hours', 'ok')",
    )
    .bind(t)
    .execute(&owner)
    .await
    .unwrap();
    let found = watcher_findings(
        &Ctx {
            request: app,
            worker: owner,
        },
        t,
    )
    .await;
    let missed = found
        .iter()
        .find(|f| f.key == "missed")
        .expect("missed finding");
    assert!(missed.asset.contains("Audit chain"));
    assert_eq!(missed.severity, Severity::High);
}

async fn decoys(owner: &PgPool, t: Uuid) -> Vec<(Uuid, String)> {
    sqlx::query_as(
        "SELECT p.id, p.first_name FROM security_honeytokens h JOIN patients p ON p.id = h.patient_id \
          WHERE h.tenant_id = $1 AND h.deleted_at IS NULL",
    )
    .bind(t)
    .fetch_all(owner)
    .await
    .unwrap()
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn decoy_patients_never_show_in_lists_search_or_counts() {
    let (owner, app) = pools().await;
    let (t, _) = tenant(&owner).await;
    sqlx::query(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'REAL-1', 'Real', 'Patient', 'female', '9000000000')",
    )
    .bind(t)
    .execute(&owner)
    .await
    .unwrap();
    let ctx = Ctx {
        request: app.clone(),
        worker: owner.clone(),
    };
    Honeytokens.run(&ctx, Some(t)).await.expect("seeded");
    let decoys = decoys(&owner, t).await;
    assert_eq!(decoys.len(), 3);

    let mut tx = app.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(t.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM patients")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    assert_eq!(count, 1, "the patient count is real patients only");
    let ids: Vec<Uuid> = decoys.iter().map(|d| d.0).collect();
    let names: Vec<String> = decoys.iter().map(|d| d.1.clone()).collect();
    let listed: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM (SELECT id FROM patients ORDER BY created_at DESC LIMIT 50) l WHERE id = ANY($1)",
    )
    .bind(&ids)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let searched: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patients WHERE first_name ILIKE ANY($1) OR id = ANY($2)",
    )
    .bind(&names)
    .bind(&ids)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    assert_eq!(
        (listed, searched),
        (0, 0),
        "no list or search reaches a decoy"
    );
    let registry = sqlx::query("SELECT 1 FROM security_honeytokens")
        .fetch_optional(&mut *tx)
        .await;
    assert!(
        registry.is_err(),
        "the app role cannot read which records are decoys"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn reading_a_decoy_or_using_the_decoy_key_is_critical_at_once() {
    let (owner, app) = pools().await;
    let (t, reader) = tenant(&owner).await;
    Honeytokens
        .run(
            &Ctx {
                request: app.clone(),
                worker: owner.clone(),
            },
            Some(t),
        )
        .await
        .expect("seeded");
    let decoy = decoys(&owner, t).await[0].0;

    // A read logged by any writer of access_log, as the app role.
    let mut tx = app.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(t.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO access_log (tenant_id, user_id, entity_type, entity_id, patient_id) \
         VALUES ($1, $2, 'patients', $3, $3)",
    )
    .bind(t)
    .bind(reader)
    .bind(decoy)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();

    let (severity, title): (String, String) = sqlx::query_as(
        "SELECT severity, title FROM vulnerabilities WHERE tenant_id = $1 AND check_key = 'honeytoken.access' \
            AND finding_key = 'user:' || $2::text",
    )
    .bind(t)
    .bind(reader)
    .fetch_one(&owner)
    .await
    .expect("decoy read raised a finding");
    assert_eq!(severity, "critical");
    assert!(title.contains("Decoy patient record opened"), "{title}");

    // The refused direct read (the decoy is hidden, so it 404s) raises it too.
    let hit = medbrains_server_core::middleware::access_log::probe_honeytoken(
        &app,
        t,
        decoy,
        reader,
        "/api/patients/x",
    )
    .await
    .unwrap();
    assert!(hit);

    let bait: serde_json::Value = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = $2 AND key = $3",
    )
    .bind(t)
    .bind(BAIT_CATEGORY)
    .bind(BAIT_KEY)
    .fetch_one(&owner)
    .await
    .unwrap();
    let secret = bait["api_key"].as_str().unwrap();
    let used: bool = sqlx::query_scalar("SELECT public.app_honeytoken_key_hit($1)")
        .bind(medbrains_api_keys::fingerprint(secret))
        .fetch_one(&app)
        .await
        .unwrap();
    assert!(used);
    let key_severity: String = sqlx::query_scalar(
        "SELECT severity FROM vulnerabilities WHERE tenant_id = $1 AND affected_component = 'Decoy API key'",
    )
    .bind(t)
    .fetch_one(&owner)
    .await
    .unwrap();
    assert_eq!(key_severity, "critical");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn posture_catches_the_app_connecting_as_the_owner() {
    let (owner, app) = pools().await;
    let (t, _) = tenant(&owner).await;
    let as_owner = Ctx {
        request: owner.clone(),
        worker: owner.clone(),
    };
    let report = Posture.run(&as_owner, Some(t)).await.expect("posture");
    let role = report
        .findings
        .iter()
        .find(|f| f.key == "db.request_role")
        .expect("role finding");
    assert_eq!(role.severity, Severity::Critical);

    let as_app = Ctx {
        request: app,
        worker: owner.clone(),
    };
    let report = Posture.run(&as_app, Some(t)).await.expect("posture");
    assert!(report.findings.iter().all(|f| f.key != "db.request_role"));

    // And decoys are not seeded while isolation is off.
    let paused = Honeytokens.run(&as_owner, Some(t)).await;
    assert!(matches!(paused, Err(CheckError(m)) if m.starts_with("paused")));
}

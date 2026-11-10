//! Reports cannot slow the wards: every report read is bounded, read-only, on
//! the reader pool, capped per tenant, and a failure is an error, never an
//! empty report.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-reports --test report_safety -- --ignored
//! ```
//!
//! `DATABASE_URL` must name a migrated database with at least one tenant.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;
use std::time::Duration;

use axum::Extension;
use axum::extract::State;
use axum::response::IntoResponse;
use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_core::permissions;
use medbrains_kernel::Claims;
use medbrains_server_core::error::AppError;
use medbrains_server_core::report_runner::{
    BUSY_MESSAGE, ReportGate, ReportLimits, begin_report, begin_tile,
};
use medbrains_server_core::state::{AppState, CookieConfig};
use sqlx::PgPool;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use uuid::Uuid;

/// The primary pool, from `DATABASE_URL`.
async fn primary() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .expect("connect")
}

/// A second pool on the same database, named so a test can tell which pool
/// a query ran on — the stand-in for a replica.
async fn replica() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let options: PgConnectOptions = url.parse().expect("url");
    PgPoolOptions::new()
        .max_connections(2)
        .connect_with(options.application_name("reports-replica"))
        .await
        .expect("connect replica")
}

/// An app whose reports read from `reader`, under `limits`.
fn state(db: PgPool, reader: PgPool, limits: ReportLimits) -> AppState {
    let key = [7u8; 32];
    let resolver: Arc<dyn medbrains_db_topology::TopologyResolver> = Arc::new(
        medbrains_db_topology::PostgresTopologyResolver::new(db.clone()),
    );
    AppState {
        db: db.clone(),
        jwt_encoding_key: EncodingKey::from_secret(&key),
        jwt_decoding_key: DecodingKey::from_secret(&key),
        cookie_config: CookieConfig {
            domain: None,
            secure: false,
            cors_origin: String::new(),
        },
        queue_broadcaster: medbrains_server_core::queue_broadcast::QueueBroadcaster::new(),
        notifications: medbrains_server_core::notification_hub::NotificationHub::new(),
        trusted_proxies: Arc::new(vec![]),
        system_state_cache: medbrains_server_core::middleware::system_state::SystemStateCache::new(
        ),
        outbox: Arc::new(medbrains_outbox::Registry::new()),
        topology: Arc::new(medbrains_db_topology::TopologyRouter::new(
            db, reader, resolver,
        )),
        authz: Arc::new(medbrains_authz::backend_test::InMemoryBackend::new()),
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("report-safety-test-docs"),
        )),
        reports: ReportGate::new(limits),
    }
}

/// An analyst at an existing hospital.
async fn analyst(db: &PgPool) -> Claims {
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a tenant");
    Claims {
        sub: Uuid::new_v4(),
        tenant_id,
        role: "analyst".to_owned(),
        permissions: vec![permissions::analytics::VIEW.to_owned()],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

/// The status and JSON body a client would receive for `err`.
async fn answer(err: AppError) -> (u16, serde_json::Value) {
    let response = err.into_response();
    let status = response.status().as_u16();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body");
    (status, serde_json::from_slice(&bytes).expect("json"))
}

/// The SQLSTATE of a database error.
fn sqlstate(err: &sqlx::Error) -> Option<String> {
    err.as_database_error()
        .and_then(|e| e.code())
        .map(|c| c.into_owned())
}

/// Given a report that finishes inside its limit, when it runs, then its rows
/// come back, and it ran read-only under the 15 s default.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_report_under_the_limit_returns_its_rows() {
    let db = primary().await;
    let app = state(db.clone(), db.clone(), ReportLimits::default());
    let claims = analyst(&db).await;

    let (mut tx, run) = begin_report(&app, &claims, "test").await.expect("begin");
    let rows: Vec<i32> = sqlx::query_scalar("SELECT generate_series(1, 3)")
        .fetch_all(&mut *tx)
        .await
        .expect("rows");
    let (timeout, read_only): (String, String) = sqlx::query_as(
        "SELECT current_setting('statement_timeout'), current_setting('transaction_read_only')",
    )
    .fetch_one(&mut *tx)
    .await
    .expect("settings");
    run.finish(tx, rows.len()).await.expect("finish");

    assert_eq!(rows, vec![1, 2, 3]);
    assert_eq!(timeout, "15s");
    assert_eq!(read_only, "on");
}

/// Given a report that runs past its timeout, when it runs, then the reader
/// gets 503 `report_timeout` saying to narrow the date range — never rows.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_report_over_the_limit_is_a_clear_error_not_empty_data() {
    let db = primary().await;
    let limits = ReportLimits {
        default_timeout: Duration::from_millis(100),
        ..ReportLimits::default()
    };
    let app = state(db.clone(), db.clone(), limits);
    let claims = analyst(&db).await;

    let (mut tx, _run) = begin_report(&app, &claims, "test").await.expect("begin");
    let err = sqlx::query("SELECT pg_sleep(1)")
        .execute(&mut *tx)
        .await
        .expect_err("cancelled by statement_timeout");
    assert_eq!(sqlstate(&err).as_deref(), Some("57014"));

    let (status, body) = answer(AppError::from(err)).await;
    assert_eq!(status, 503);
    assert_eq!(body["error"], "report_timeout");
    let detail = body["detail"].as_str().expect("detail");
    assert!(detail.contains("Narrow the date range"), "{detail}");
}

/// Given a tenant that set `reports/statement_timeout_ms`, when its report
/// runs, then that timeout applies (clamped to the floor and ceiling).
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_tenant_setting_sets_the_timeout() {
    let db = primary().await;
    let app = state(db.clone(), db.clone(), ReportLimits::default());
    let claims = analyst(&db).await;
    let setting: Uuid = sqlx::query_scalar(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'reports', 'statement_timeout_ms', '2500'::jsonb) RETURNING id",
    )
    .bind(claims.tenant_id)
    .fetch_one(&db)
    .await
    .expect("setting");

    let (mut tx, run) = begin_report(&app, &claims, "test").await.expect("begin");
    let timeout: String = sqlx::query_scalar("SELECT current_setting('statement_timeout')")
        .fetch_one(&mut *tx)
        .await
        .expect("timeout");
    run.finish(tx, 1).await.expect("finish");
    sqlx::query("DELETE FROM tenant_settings WHERE id = $1")
        .bind(setting)
        .execute(&db)
        .await
        .expect("clean up");

    assert_eq!(timeout, "2500ms");
}

/// Given a report path, when it tries to write, then Postgres refuses (25006).
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_read_only_setting_refuses_writes() {
    let db = primary().await;
    let app = state(db.clone(), db.clone(), ReportLimits::default());
    let claims = analyst(&db).await;

    for (mut tx, _run) in [
        begin_report(&app, &claims, "test").await.expect("report"),
        begin_tile(&app, &claims, "test").await.expect("tile"),
    ] {
        let err = sqlx::query("CREATE TEMP TABLE report_write_probe (i int)")
            .execute(&mut *tx)
            .await
            .expect_err("a write in a report transaction");
        assert_eq!(sqlstate(&err).as_deref(), Some("25006"));
    }
}

/// Given `REPORTS_DATABASE_URL` (the topology's reader), when a report runs,
/// then it runs on that pool, not on the primary.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_replica_is_used_when_configured() {
    let db = primary().await;
    let app = state(db.clone(), replica().await, ReportLimits::default());
    let claims = analyst(&db).await;

    let (mut tx, run) = begin_report(&app, &claims, "test").await.expect("begin");
    let name: String = sqlx::query_scalar("SELECT current_setting('application_name')")
        .fetch_one(&mut *tx)
        .await
        .expect("name");
    run.finish(tx, 1).await.expect("finish");

    assert_eq!(name, "reports-replica");
}

/// Given a tenant already running its cap of heavy reports, when another
/// starts — through the runner or a real report handler — then it gets 429
/// with a plain message; another tenant and dashboard tiles are unaffected,
/// and the slot comes back when the first report ends.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn the_concurrency_cap_answers_429() {
    let db = primary().await;
    let limits = ReportLimits {
        per_tenant: 1,
        slot_wait: Duration::from_millis(50),
        ..ReportLimits::default()
    };
    let app = state(db.clone(), db.clone(), limits);
    let claims = analyst(&db).await;

    let held = begin_report(&app, &claims, "first").await.expect("first");

    let err = begin_report(&app, &claims, "second")
        .await
        .expect_err("second heavy report for the tenant");
    let (status, body) = answer(err).await;
    assert_eq!(status, 429);
    assert_eq!(body["detail"], BUSY_MESSAGE);

    let handler =
        medbrains_reports::analytics::bed_occupancy(State(app.clone()), Extension(claims.clone()))
            .await
            .expect_err("the report handler goes through the runner");
    assert_eq!(answer(handler).await.0, 429);

    let other = Claims {
        tenant_id: Uuid::new_v4(),
        ..claims.clone()
    };
    assert!(
        app.reports.slot(other.tenant_id).await.is_ok(),
        "other tenant unaffected"
    );
    let (tile, tile_run) = begin_tile(&app, &claims, "tile")
        .await
        .expect("tiles take no slot");
    tile_run.finish(tile, 0).await.expect("tile");

    let (tx, run) = held;
    run.finish(tx, 0).await.expect("finish first");
    let (tx, run) = begin_report(&app, &claims, "third")
        .await
        .expect("slot is back");
    run.finish(tx, 0).await.expect("finish third");
}

/// Given the report database is unreachable, when a report is asked for, then
/// the answer is an error — never an empty, healthy-looking report.
#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_outage_shows_as_an_error() {
    let db = primary().await;
    let gone = PgPoolOptions::new()
        .acquire_timeout(Duration::from_millis(200))
        .connect_lazy("postgres://nobody@127.0.0.1:1/none")
        .expect("lazy pool");
    let app = state(db.clone(), gone, ReportLimits::default());
    let claims = analyst(&db).await;

    let err = medbrains_reports::analytics::bed_occupancy(State(app), Extension(claims))
        .await
        .expect_err("an unreachable report database is an error");
    let (status, _) = answer(err).await;
    assert!(status >= 500, "an outage is a server error, got {status}");
}

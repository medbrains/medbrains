//! Health intelligence against a real, migrated database: the recompute
//! flags a dengue spike and not three malaria cases, the screen suppresses
//! small counts, notices are tagged by condition and region, and a caller
//! without `health.intel.view` is refused.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-health-intel -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use axum::Extension;
use axum::extract::State;
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::backend_test::InMemoryBackend;
use medbrains_core::permissions;
use medbrains_kernel::{AppError, Claims};
use medbrains_server_core::state::{AppState, CookieConfig};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

fn state(db: PgPool) -> AppState {
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
            db.clone(),
            db,
            resolver,
        )),
        authz: Arc::new(InMemoryBackend::new()),
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("health-intel-test-docs"),
        )),
    }
}

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .expect("connect")
}

/// A hospital with 12 dengue cases in the last 7 days over a steady ~4 a
/// week, and 3 malaria cases this week only.
async fn fixture(db: &PgPool) -> Claims {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Health intel test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("HI{code}"))
    .fetch_one(db)
    .await
    .expect("tenant");
    let mut tx = db.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(t.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let now = Utc::now();
    let mut rows: Vec<(&str, &str, chrono::DateTime<Utc>)> = Vec::new();
    for week in 1..=10 {
        for n in 0..4 {
            rows.push((
                "Dengue",
                "A90",
                now - Duration::days(7 * week + 1) - Duration::hours(n),
            ));
        }
    }
    for n in 0..12 {
        rows.push(("Dengue", "A90", now - Duration::hours(2 + n * 5)));
    }
    for n in 0..3 {
        rows.push(("Malaria", "B54", now - Duration::hours(3 + n)));
    }
    for (disease, icd, at) in rows {
        sqlx::query(
            "INSERT INTO notifiable_disease_reports (tenant_id, icd10_code, disease_name, detected_at) \
             VALUES ($1, $2, $3, $4)",
        )
        .bind(t)
        .bind(icd)
        .bind(disease)
        .bind(at)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    tx.commit().await.unwrap();
    Claims {
        sub: Uuid::new_v4(),
        tenant_id: t,
        role: "doctor".to_owned(),
        permissions: vec![permissions::health::intel::VIEW.to_owned()],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_dengue_spike_is_flagged_and_three_cases_are_suppressed_not_flagged() {
    let db = pool().await;
    let claims = fixture(&db).await;
    let n = medbrains_health_intel::job::recompute_conditions(&db, claims.tenant_id, Utc::now())
        .await
        .expect("recompute");
    assert_eq!(n, 2);
    // Idempotent: a second pass replaces, never duplicates.
    medbrains_health_intel::job::recompute_conditions(&db, claims.tenant_id, Utc::now())
        .await
        .expect("recompute again");

    let intel = medbrains_health_intel::routes::get_health_intel(
        State(state(db.clone())),
        Extension(claims.clone()),
    )
    .await
    .expect("intel")
    .0;
    assert_eq!(intel.conditions.len(), 2);
    let dengue = intel
        .conditions
        .iter()
        .find(|c| c.condition == "Dengue")
        .unwrap();
    assert_eq!(dengue.this_week, Some(12));
    assert_eq!(
        dengue.usual, None,
        "usual 4 is under 5, so it is suppressed too"
    );
    assert_ne!(dengue.level, "usual");
    let malaria = intel
        .conditions
        .iter()
        .find(|c| c.condition == "Malaria")
        .unwrap();
    assert_eq!(malaria.this_week, None, "3 cases show as fewer than 5");
    assert_eq!(malaria.level, "usual");
    assert!(malaria.series.iter().all(|w| w.is_none() || *w == Some(0)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_permission_the_screen_is_refused() {
    let db = pool().await;
    let mut claims = fixture(&db).await;
    claims.permissions.clear();
    let refused = medbrains_health_intel::routes::get_health_intel(
        State(state(db.clone())),
        Extension(claims.clone()),
    )
    .await;
    assert!(matches!(refused, Err(AppError::Forbidden)));
    let env =
        medbrains_health_intel::routes::get_health_environment(State(state(db)), Extension(claims))
            .await;
    assert!(matches!(env, Err(AppError::Forbidden)));
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_article_about_dengue_in_kerala_is_tagged_with_both() {
    let db = pool().await;
    let url = format!("https://example.test/{}", Uuid::new_v4());
    sqlx::query(
        "INSERT INTO news_feed_articles (topic, source, title, summary, url, published_at) \
         VALUES ('Health headlines', 'example.test', \
                 'Dengue cases rise in Kerala after early monsoon', \
                 'District health officers report more admissions.', $1, now())",
    )
    .bind(&url)
    .execute(&db)
    .await
    .unwrap();
    medbrains_health_intel::job::tag_articles(&db)
        .await
        .expect("tag");
    let (conditions, regions): (Vec<String>, Vec<String>) =
        sqlx::query_as("SELECT conditions, regions FROM news_feed_articles WHERE url = $1")
            .bind(&url)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(conditions, vec!["Dengue".to_owned()]);
    assert_eq!(regions, vec!["Kerala".to_owned()]);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_failed_job_keeps_its_last_success_and_shows_as_failing() {
    let db = pool().await;
    let name = medbrains_health_intel::status::JOB_TAGGING;
    medbrains_health_intel::job::record(&db, name, Ok(()))
        .await
        .unwrap();
    medbrains_health_intel::job::record(&db, name, Err("boom".to_owned()))
        .await
        .unwrap();
    let (ok, attempt, error): (Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>, Option<String>) =
        sqlx::query_as(
            "SELECT last_ok_at, last_attempt_at, last_error FROM health_intel_heartbeats WHERE name = $1",
        )
        .bind(name)
        .fetch_one(&db)
        .await
        .unwrap();
    assert!(ok.is_some());
    assert!(attempt > ok);
    assert_eq!(error.as_deref(), Some("boom"));
}

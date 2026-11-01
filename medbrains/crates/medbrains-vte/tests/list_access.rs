//! A patient's VTE assessments reach only callers who may see that patient,
//! and an authorisation outage is an error — never an empty, healthy list.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-vte -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use axum::Extension;
use axum::extract::{Path, State};
use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::backend_test::InMemoryBackend;
use medbrains_authz::{AuthzBackend, Relation, Subject};
use medbrains_core::permissions;
use medbrains_kernel::{AppError, Claims};
use medbrains_server_core::middleware::authorization::authz_context;
use medbrains_server_core::state::{AppState, CookieConfig};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

fn state(db: PgPool, authz: Arc<dyn AuthzBackend>) -> AppState {
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
        authz,
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("vte-test-docs"),
        )),
    }
}

async fn id(db: &PgPool, tenant: Uuid, sql: &str) -> Uuid {
    let mut tx = db.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let id = sqlx::query_scalar(sql)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"));
    tx.commit().await.unwrap();
    id
}

/// A hospital, a nurse, and two patients who each have one VTE assessment.
async fn fixture(db: &PgPool) -> (Claims, Uuid, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'VTE test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("VTE{code}"))
    .fetch_one(db)
    .await
    .expect("tenant");
    let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
    let nurse = id(
        db,
        t,
        &format!(
            "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ('{t}', 'u{n}', '{n}@vte.test', 'Test nurse', 'nurse') RETURNING id"
        ),
    )
    .await;
    let mut patients = Vec::new();
    for name in ["Mine", "Theirs"] {
        let p = id(
            db,
            t,
            &format!(
                "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
             VALUES ('{t}', 'VTE-{name}-{n}', 'Pat', '{name}', 'female', '9000000000') RETURNING id"
            ),
        )
        .await;
        id(
            db,
            t,
            &format!(
                "INSERT INTO vte_risk_assessments (tenant_id, patient_id, score, high_risk, prophylaxis_recommended) \
             VALUES ('{t}', '{p}', 4, true, true) RETURNING id"
            ),
        )
        .await;
        patients.push(p);
    }
    let claims = Claims {
        sub: nurse,
        tenant_id: t,
        role: "nurse".to_owned(),
        permissions: vec![permissions::ipd::nursing_assessment::LIST.to_owned()],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    };
    (claims, patients[0], patients[1])
}

async fn list(state: &AppState, claims: &Claims, patient: Uuid) -> Result<usize, AppError> {
    medbrains_vte::list_vte_assessments(
        State(state.clone()),
        Extension(claims.clone()),
        Path(patient),
    )
    .await
    .map(|rows| rows.0.len())
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn assessments_reach_only_patients_the_caller_may_see() {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let db = PgPool::connect(&url).await.expect("database");
    let (claims, mine, theirs) = fixture(&db).await;

    let authz = Arc::new(InMemoryBackend::new());
    authz
        .write_tuple(
            &authz_context(&claims),
            "patient",
            mine,
            Relation::Viewer,
            Subject::User(claims.sub),
            None,
            Some("test: under this nurse's care".to_owned()),
        )
        .await
        .expect("grant");
    let app = state(db.clone(), authz);

    assert_eq!(list(&app, &claims, mine).await.unwrap(), 1);
    assert!(
        matches!(list(&app, &claims, theirs).await, Err(AppError::NotFound)),
        "a patient the nurse may not see must answer 404, not their assessments"
    );

    // An unreachable authorisation engine is an outage (503), never `[]`.
    let gone = PgPoolOptions::new()
        .connect_lazy("postgres://nobody@127.0.0.1:1/none")
        .expect("lazy pool");
    gone.close().await;
    let broken = state(
        db,
        Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(gone)),
    );
    assert!(
        matches!(
            list(&broken, &claims, mine).await,
            Err(AppError::ServiceUnavailable(_))
        ),
        "an authorisation fault was rendered as a list"
    );
}

//! Shared fixtures for the billing crate's database tests: an `AppState`
//! over a real pool, a hospital with a billing user and a patient, and a
//! transaction scoped to a tenant the way the request path scopes it.

#![allow(clippy::expect_used, clippy::unwrap_used, dead_code)]

use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::backend_test::InMemoryBackend;
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::{AppState, CookieConfig};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

pub(crate) mod implants;
pub(crate) mod inpatient;
pub(crate) mod orders;
pub(crate) mod stock;

pub(crate) type Tx = sqlx::Transaction<'static, sqlx::Postgres>;

pub(crate) fn state(db: PgPool) -> AppState {
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
        reports: medbrains_server_core::report_runner::ReportGate::default(),
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("charge-attention-test-docs"),
        )),
    }
}

pub(crate) async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(6)
        .connect(&url)
        .await
        .expect("connect")
}

/// A hospital, a billing user and a patient. Returns the user's claims and
/// the patient.
pub(crate) async fn fixture(db: &PgPool) -> (Claims, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Charge attention test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("CA{}", code.to_uppercase()))
    .fetch_one(db)
    .await
    .expect("tenant");
    let mut tx = scoped(db, t).await;
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, 'Desk Clerk', 'billing_clerk') RETURNING id",
    )
    .bind(t)
    .bind(format!("ca{code}"))
    .bind(format!("ca{code}@charge.test"))
    .fetch_one(&mut *tx)
    .await
    .expect("user");
    let patient = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    let claims = Claims {
        sub: user,
        tenant_id: t,
        role: "super_admin".to_owned(),
        permissions: vec![
            permissions::billing::charge_attention::VIEW.to_owned(),
            permissions::billing::charge_attention::RESOLVE.to_owned(),
        ],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    };
    (claims, patient)
}

/// A transaction under the tenant, set the way the request path sets it.
pub(crate) async fn scoped(db: &PgPool, tenant: Uuid) -> Tx {
    let mut tx = db.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    tx
}

pub(crate) async fn insert_patient(tx: &mut Tx, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Test', 'Patient', 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CA-{}", Uuid::new_v4().simple()))
    .fetch_one(&mut **tx)
    .await
    .expect("patient")
}

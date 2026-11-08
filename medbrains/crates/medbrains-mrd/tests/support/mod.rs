//! A hospital with an OPD, a records room and a patient with a shelved file,
//! against a real, migrated database. Shared by the file request tests.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::redundant_pub_crate,
    dead_code
)]

use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::backend_test::InMemoryBackend;
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::{AppState, CookieConfig};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

pub(crate) type Tx = sqlx::Transaction<'static, sqlx::Postgres>;

/// The app state the handlers take, over `db`.
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
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("mrd-file-request-test-docs"),
        )),
    }
}

/// The migrated test database.
pub(crate) async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let db = PgPoolOptions::new()
        .max_connections(6)
        .connect(&url)
        .await
        .expect("connect");
    medbrains_db_migrations::run(&db).await.expect("migrate");
    db
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

/// One hospital's world.
pub(crate) struct World {
    pub claims: Claims,
    pub patient: Uuid,
    pub record: Uuid,
    pub record_number: String,
    pub department: Uuid,
    pub other_department: Uuid,
}

/// Claims for `user` holding exactly `perms`, as a non-bypass role.
pub(crate) fn claims_with(base: &Claims, perms: &[&str]) -> Claims {
    Claims {
        role: "mrd_officer".to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        ..base.clone()
    }
}

/// A hospital, its administrator (a supervisor by bypass), two OPDs, a
/// patient and the patient's file on Rack 3, Shelf B, Bin 7.
pub(crate) async fn world(db: &PgPool) -> World {
    let code = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'MRD file wait test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("MF{}", code.to_uppercase()))
    .fetch_one(db)
    .await
    .expect("tenant");
    let mut tx = scoped(db, t).await;
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, 'Records Supervisor', 'hospital_admin') RETURNING id",
    )
    .bind(t)
    .bind(format!("mf{code}"))
    .bind(format!("mf{code}@mrd.test"))
    .fetch_one(&mut *tx)
    .await
    .expect("user");
    let cardiology = department(&mut tx, t, "CARD", "Cardiology OPD").await;
    let other_department = department(&mut tx, t, "ORTH", "Orthopaedics OPD").await;
    let patient = insert_patient(&mut tx, t).await;
    sqlx::query(
        "INSERT INTO mrd_storage_locations (tenant_id, code, name, room, rack, shelf, bin) \
         VALUES ($1, 'R3-B7', 'Rack 3 B7', 'Records', '3', 'B', '7')",
    )
    .bind(t)
    .execute(&mut *tx)
    .await
    .expect("shelf");
    let record_number = format!("MRD-{code}");
    let record = insert_file(&mut tx, t, patient, &record_number, "active").await;
    tx.commit().await.unwrap();
    let claims = Claims {
        sub: user,
        tenant_id: t,
        role: "super_admin".to_owned(),
        permissions: vec![
            permissions::mrd::file_request::VIEW.to_owned(),
            permissions::mrd::file_request::FULFIL.to_owned(),
            permissions::mrd::file_request::STATUS.to_owned(),
        ],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    };
    World {
        claims,
        patient,
        record,
        record_number,
        department: cardiology,
        other_department,
    }
}

/// A clinical department.
pub(crate) async fn department(tx: &mut Tx, tenant: Uuid, code: &str, name: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(code)
    .bind(name)
    .fetch_one(&mut **tx)
    .await
    .expect("department")
}

/// A registered patient.
pub(crate) async fn insert_patient(tx: &mut Tx, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Lakshmi', 'Devi', 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("MF-{}", Uuid::new_v4().simple()))
    .fetch_one(&mut **tx)
    .await
    .expect("patient")
}

/// The patient's paper file, shelved at R3-B7.
pub(crate) async fn insert_file(
    tx: &mut Tx,
    tenant: Uuid,
    patient: Uuid,
    number: &str,
    status: &str,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO mrd_medical_records (tenant_id, patient_id, record_number, shelf_location, status) \
         VALUES ($1, $2, $3, 'R3-B7', $4::mrd_record_status) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(number)
    .bind(status)
    .fetch_one(&mut **tx)
    .await
    .expect("file")
}

/// An OPD visit, created the way registration creates one; the trigger asks
/// for the file in the same transaction.
pub(crate) async fn visit(db: &PgPool, w: &World, patient: Uuid, date_offset_days: i32) -> Uuid {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id, \
                                 encounter_date, visit_type, created_by) \
         VALUES ($1, $2, 'opd', 'open', $3, CURRENT_DATE + $4, 'walk_in', $5) RETURNING id",
    )
    .bind(w.claims.tenant_id)
    .bind(patient)
    .bind(w.department)
    .bind(date_offset_days)
    .bind(w.claims.sub)
    .fetch_one(&mut *tx)
    .await
    .expect("visit");
    tx.commit().await.unwrap();
    id
}

/// The visit's file requests: `(id, status, source, due in minutes)`.
pub(crate) async fn requests_for(
    db: &PgPool,
    w: &World,
    encounter: Uuid,
) -> Vec<(Uuid, String, String, i64)> {
    let mut tx = scoped(db, w.claims.tenant_id).await;
    let rows = sqlx::query_as(
        "SELECT id, status, source, \
                round(EXTRACT(EPOCH FROM due_at - requested_at) / 60)::int8 \
           FROM mrd_file_requests WHERE tenant_id = $1 AND encounter_id = $2 ORDER BY created_at",
    )
    .bind(w.claims.tenant_id)
    .bind(encounter)
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    rows
}

//! A tenant with admitted patients, an app state, and the people a discharge
//! flow involves. Each test builds its own tenant, so tests run in parallel.

#![allow(
    dead_code,
    clippy::redundant_pub_crate,
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic
)]

use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::{AppState, CookieConfig};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub(crate) async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5438/medbrains".to_owned()
    });
    PgPool::connect(&url)
        .await
        .expect("needs a migrated database")
}

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
            db.clone(),
            resolver,
        )),
        authz: Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(db)),
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("sop-flows-test-docs"),
        )),
    }
}

pub(crate) fn claims(tenant: Uuid, user: Uuid, role: &str, perms: &[&str]) -> Claims {
    Claims {
        sub: user,
        tenant_id: tenant,
        role: role.to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

pub(crate) struct World {
    pub(crate) state: AppState,
    pub(crate) tenant: Uuid,
    pub(crate) users: Vec<(String, Uuid)>,
    pub(crate) doctor: Uuid,
}

impl World {
    pub(crate) fn user(&self, role: &str, nth: usize) -> Uuid {
        self.users
            .iter()
            .filter(|(r, _)| r == role)
            .nth(nth)
            .expect("user")
            .1
    }
    /// A ward user who can see and discharge every admission (a bypass role).
    pub(crate) fn ward(&self) -> Claims {
        claims(self.tenant, self.doctor, "super_admin", &[])
    }
    pub(crate) async fn sql(&self, sql: &str) {
        let mut tx = self.state.db.begin().await.unwrap();
        set_tenant(&mut tx, self.tenant).await;
        sqlx::query(sql)
            .execute(&mut *tx)
            .await
            .unwrap_or_else(|e| panic!("{sql}: {e}"));
        tx.commit().await.unwrap();
    }
    pub(crate) async fn scalar(&self, sql: &str) -> Value {
        let mut tx = self.state.db.begin().await.unwrap();
        set_tenant(&mut tx, self.tenant).await;
        sqlx::query_scalar(sql)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or_else(|e| panic!("{sql}: {e}"))
    }
    /// An admitted patient; `insurance` gives the stay a live pre-authorisation.
    pub(crate) async fn admit(&self, insurance: bool) -> Uuid {
        let t = self.tenant;
        let n = Uuid::new_v4().simple().to_string();
        let mut tx = self.state.db.begin().await.unwrap();
        set_tenant(&mut tx, t).await;
        let patient = id(&mut tx, &format!(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) VALUES \
             ('{t}', 'SOP-{n}', 'Pat', '{}', 'female', '9000000000') RETURNING id", &n[..6])).await;
        let enc = id(&mut tx, &format!(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES ('{t}', '{patient}', 'ipd') RETURNING id")).await;
        let adm = id(&mut tx, &format!(
            "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, admission_number) \
             VALUES ('{t}', '{enc}', '{patient}', '{}', 'ADM-{n}') RETURNING id", self.doctor)).await;
        if insurance {
            id(&mut tx, &format!(
                "INSERT INTO pre_authorization_requests (tenant_id, patient_id, encounter_id, insurance_provider, \
                 submitted_by, status) VALUES ('{t}', '{patient}', '{enc}', 'Star Health', '{}', 'submitted') RETURNING id",
                self.doctor)).await;
        }
        tx.commit().await.unwrap();
        adm
    }
    /// Record every clearance up to billing, as the ward, pharmacy and desk would.
    pub(crate) async fn clear_to_billing(&self, adm: Uuid) {
        let t = self.tenant;
        self.sql(&format!(
            "INSERT INTO ipd_discharge_summaries (tenant_id, admission_id, status, finalized_at) \
             VALUES ('{t}', '{adm}', 'finalized', now())"
        ))
        .await;
        self.sql(&format!(
            "UPDATE ipd_discharge_checklists SET status = 'completed', completed_at = now() \
              WHERE admission_id = '{adm}' AND item_code NOT IN ('discharge_summary', 'accounts_cleared')")).await;
        self.sql(&format!(
            "UPDATE ipd_discharge_tat_log SET doctor_cleared_at = now(), nursing_cleared_at = now(), \
             pharmacy_cleared_at = now() WHERE admission_id = '{adm}'")).await;
    }
    /// The built-in roles with their permissions, as tenant setup seeds them.
    pub(crate) async fn seed_roles(&self) {
        let mut tx = self.state.db.begin().await.unwrap();
        set_tenant(&mut tx, self.tenant).await;
        for r in medbrains_core::access::roles::BUILT_IN_ROLES {
            sqlx::query(
                "INSERT INTO roles (tenant_id, code, name, permissions, is_system) \
                 VALUES ($1, $2, $3, $4, true)",
            )
            .bind(self.tenant)
            .bind(r.code)
            .bind(r.name)
            .bind(serde_json::json!(r.permissions))
            .execute(&mut *tx)
            .await
            .unwrap();
        }
        tx.commit().await.unwrap();
    }
    pub(crate) async fn clear_billing(&self, adm: Uuid) {
        self.sql(&format!("UPDATE ipd_discharge_tat_log SET billing_cleared_at = now() WHERE admission_id = '{adm}'")).await;
    }
}

pub(crate) async fn set_tenant(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, tenant: Uuid) {
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut **tx)
        .await
        .unwrap();
}

pub(crate) async fn id(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, sql: &str) -> Uuid {
    sqlx::query_scalar(sql)
        .fetch_one(&mut **tx)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"))
}

pub(crate) async fn world() -> World {
    let db = pool().await;
    let mut tx = db.begin().await.unwrap();
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant = id(&mut tx, &format!(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ('SOP{code}', 'Flow test', 'multi_specialty') RETURNING id")).await;
    set_tenant(&mut tx, tenant).await;
    let mut users = Vec::new();
    for role in [
        "doctor",
        "quality_officer",
        "quality_officer",
        "medical_superintendent",
        "hospital_admin",
    ] {
        let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
        let u = id(
            &mut tx,
            &format!(
                "INSERT INTO users (tenant_id, username, email, full_name, role) VALUES \
             ('{tenant}', 'u{n}', '{n}@sop.test', 'Test {role}', '{role}') RETURNING id"
            ),
        )
        .await;
        users.push((role.to_owned(), u));
    }
    tx.commit().await.unwrap();
    let doctor = users[0].1;
    World {
        state: state(db),
        tenant,
        users,
        doctor,
    }
}

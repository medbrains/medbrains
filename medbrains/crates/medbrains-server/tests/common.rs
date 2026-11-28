#![allow(dead_code, unreachable_pub)]

//! Integration test harness — spawns Axum server on a random port.
//!
//! Under `cargo test` every test shares the database `DATABASE_URL` names (the
//! dev database by default), one test at a time (`RUST_TEST_THREADS=1`).
//!
//! Under cargo-nextest each test is a process, and each parallel slot of the
//! run gets a database of its own on the test cluster (`make test-db`), with
//! its own hospital in it: see [`slot_database`]. Tests in one slot follow one
//! another on its database as they do under `cargo test`; slots never meet.

use std::net::SocketAddr;
use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};
use reqwest::{Client, StatusCode};
use tokio::net::TcpListener;

use medbrains_server::{
    middleware::system_state::SystemStateCache,
    routes,
    state::{AppState, CookieConfig},
};

/// A running test server with an HTTP client.
pub struct TestApp {
    pub addr: SocketAddr,
    pub client: Client,
    /// The same pool the server uses — for tests that need to set up state
    /// (e.g. mark a patient deceased) that no public endpoint exposes.
    pub db: sqlx::PgPool,
    /// The server's own state — for tests that drive in-process paths (the
    /// AI assistant's tools) that mint tokens with the server's key.
    pub state: AppState,
}

impl std::fmt::Debug for TestApp {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TestApp")
            .field("addr", &self.addr)
            .finish_non_exhaustive()
    }
}

impl TestApp {
    /// Base URL for this test server.
    pub fn url(&self, path: &str) -> String {
        format!("http://{}{}", self.addr, path)
    }

    /// Login as admin using the shared client (cookies auto-stored).
    /// Returns the CSRF token for mutation requests.
    pub async fn login_admin(&self) -> String {
        let resp = self
            .client
            .post(self.url("/api/auth/login"))
            .json(&serde_json::json!({
                "username": "admin",
                "password": "admin123"
            }))
            .send()
            .await
            .expect("login request");

        assert_eq!(resp.status(), StatusCode::OK, "login failed");

        let body: serde_json::Value = resp.json().await.expect("login json");
        body["csrf_token"].as_str().unwrap_or("").to_owned()
    }

    /// Re-enter `password` on `client`'s session: the five-minute step-up a
    /// signature needs. The cookie lands in the client's store.
    pub async fn step_up(&self, client: &Client, csrf: &str, password: &str) {
        let resp = client
            .post(self.url("/api/auth/step-up"))
            .header("x-csrf-token", csrf)
            .json(&serde_json::json!({ "password": password }))
            .send()
            .await
            .expect("step-up request");
        assert_eq!(resp.status(), StatusCode::OK, "step-up failed");
    }

    /// POST JSON to an endpoint with the given client.
    pub async fn post_json(
        &self,
        client: &Client,
        path: &str,
        body: &serde_json::Value,
    ) -> reqwest::Response {
        client
            .post(self.url(path))
            .json(body)
            .send()
            .await
            .expect("request failed")
    }

    /// GET an endpoint with the given client.
    pub async fn get(&self, client: &Client, path: &str) -> reqwest::Response {
        client
            .get(self.url(path))
            .send()
            .await
            .expect("request failed")
    }

    /// Mark a patient deceased directly in the DB — no public endpoint sets this
    /// (death flows through IPD discharge / death summary), so tests that need
    /// to exercise the deceased-patient guards set it here. Tenant context is
    /// set so RLS permits the update.
    /// Outbox rows of one event type whose payload mentions `needle` (an id)
    /// — the emit half of a pipeline, asserted without the worker, which
    /// `spawn_app` never starts.
    pub async fn outbox_rows(&self, event_type: &str, needle: &str) -> Vec<serde_json::Value> {
        sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT payload FROM outbox_events \
              WHERE event_type = $1 AND payload::text LIKE '%' || $2 || '%' \
              ORDER BY created_at",
        )
        .bind(event_type)
        .bind(needle)
        .fetch_all(&self.db)
        .await
        .expect("outbox query")
    }

    /// The consume half: run the built-in pipelines for one event, exactly
    /// as the outbox fallback handler would. Deterministic, so a test can
    /// call it twice and prove idempotency.
    pub async fn dispatch(
        &self,
        tenant_id: uuid::Uuid,
        event_type: &str,
        payload: &serde_json::Value,
    ) {
        medbrains_workflow::events::dispatch_to_pipelines(
            &self.db,
            tenant_id,
            uuid::Uuid::nil(),
            event_type,
            payload,
        )
        .await
        .expect("dispatch");
    }

    pub async fn mark_patient_deceased(&self, patient_id: uuid::Uuid, tenant_id: uuid::Uuid) {
        let mut tx = self.db.begin().await.expect("begin tx");
        medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id)
            .await
            .expect("tenant ctx");
        sqlx::query("UPDATE patients SET is_deceased = true, deceased_date = NOW() WHERE id = $1")
            .bind(patient_id)
            .execute(&mut *tx)
            .await
            .expect("mark deceased");
        tx.commit().await.expect("commit");
    }
}

/// Secrets a test sets for its own server — a mock's base URL, a token —
/// without touching the process env other tests share. Any key it does not
/// hold falls back to `EnvSecretResolver`, as `spawn_app` always did.
#[derive(Debug, Default, Clone)]
pub struct TestSecrets(pub std::collections::HashMap<String, String>);

impl TestSecrets {
    pub fn with(mut self, key: &str, value: impl Into<String>) -> Self {
        self.0.insert(key.to_owned(), value.into());
        self
    }
}

#[async_trait::async_trait]
impl medbrains_core::secrets::SecretResolver for TestSecrets {
    async fn get(&self, key: &str) -> Result<String, medbrains_core::secrets::SecretError> {
        match self.0.get(key) {
            Some(value) => Ok(value.clone()),
            None => {
                let env = medbrains_core::secrets::EnvSecretResolver::new();
                medbrains_core::secrets::SecretResolver::get(&env, key).await
            }
        }
    }
}

/// Spawn a test server on a random port.
/// Uses the dev database (DATABASE_URL from .env or env var).
pub async fn spawn_app() -> TestApp {
    spawn_app_with_secrets(TestSecrets::default()).await
}

/// `spawn_app`, with `secrets` answering the server's secret lookups first.
pub async fn spawn_app_with_secrets(secrets: TestSecrets) -> TestApp {
    // The variable names the shared database; a slot has its own, so there it
    // only says "as the request role".
    let request_url = std::env::var("TEST_APP_DATABASE_URL")
        .ok()
        .map(|url| slot_database().map_or(url, |_| role_url("medbrains_app")));
    spawn(secrets, request_url).await
}

/// A server whose request pool is `medbrains_app`, the role production
/// requests use, which row level security applies to. Migrations, seeding and
/// `TestApp::db` stay on the owner. No password needed: the owner (a superuser
/// in dev and CI) switches role at connection start.
pub async fn spawn_app_as_request_role() -> TestApp {
    spawn(TestSecrets::default(), Some(role_url("medbrains_app"))).await
}

/// The test database, connecting as `role` (the owner switches at start).
pub fn role_url(role: &str) -> String {
    let sep = if database_url().contains('?') {
        '&'
    } else {
        '?'
    };
    format!("{}{sep}options=-c%20role%3D{role}", database_url())
}

/// The most connections one pool opens on a slot's database. The suite's
/// requests are one at a time; the few tests that fire a burst wait their turn.
/// Worst case per slot: two pools (owner and request role) and the connection
/// that holds the database, 2 x 10 + 1 = 21; four slots, 84 of PostgreSQL's
/// default 100.
const SLOT_POOL_MAX: u32 = 10;

/// This process's slot database under cargo-nextest, as the owner; `None`
/// under `cargo test`.
///
/// nextest gives every running test a slot number no other running test has
/// (`NEXTEST_TEST_GLOBAL_SLOT`, from 0) and every run an id (`NEXTEST_RUN_ID`).
/// The first test to land in a slot copies the migrated template; the tests
/// that follow it there find that copy by name.
fn slot_database() -> Option<&'static str> {
    static SLOT: std::sync::OnceLock<Option<(String, medbrains_db_migrations::testing::TestDb)>> =
        std::sync::OnceLock::new();
    SLOT.get_or_init(|| {
        let slot = std::env::var("NEXTEST_TEST_GLOBAL_SLOT").ok()?;
        let slot: u32 = slot.parse().expect("NEXTEST_TEST_GLOBAL_SLOT is a number");
        let run = std::env::var("NEXTEST_RUN_ID").unwrap_or_else(|_| "0".to_owned());
        // On a thread with a runtime of its own: callers are sync, and most
        // are already inside the test's runtime, which cannot block on this.
        let db = std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("runtime")
                .block_on(medbrains_db_migrations::testing::slot_db(&run, slot))
        })
        .join()
        .expect("slot database thread")
        .expect("slot database");
        Some((db.owner_url(), db))
    })
    .as_ref()
    .map(|(url, _)| url.as_str())
}

/// The test database: this slot's under cargo-nextest; else `DATABASE_URL`,
/// or the dev database.
pub fn database_url() -> String {
    // First, and in a slot too: tests read other settings `.env` carries.
    let _ = dotenvy::dotenv();
    if let Some(url) = slot_database() {
        return url.to_owned();
    }
    std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains".to_owned()
    })
}

/// A pool like production's, except that it waits for a connection, and on a
/// slot's database is capped at [`SLOT_POOL_MAX`].
///
/// Production fails after 2 seconds so a saturated server sheds load, and no test
/// asserts that. On a busy machine it turned a slow connection into a 500, which
/// read as a failure of whatever the test was checking (1 run in 100 of the camp
/// numbering test, on an unchanged `main`).
async fn test_pool(url: &str) -> Result<sqlx::PgPool, medbrains_db::pool::DbError> {
    let mut config = medbrains_db::pool::PoolConfig {
        acquire_timeout: std::time::Duration::from_secs(30),
        ..medbrains_db::pool::PoolConfig::default()
    };
    if slot_database().is_some() {
        // Several slots share one small PostgreSQL: no idle spares, a low cap.
        config.max_connections = SLOT_POOL_MAX;
        config.min_connections = 1;
    }
    medbrains_db::pool::create_pool_with_config(url, &config).await
}

/// `request_url` names the role the server's requests run as
/// (`TEST_APP_DATABASE_URL` for a whole run); the owner otherwise.
async fn spawn(secrets: TestSecrets, request_url: Option<String>) -> TestApp {
    crate::query_count::install();
    // Connect to DB
    let db = test_pool(&database_url())
        .await
        .expect("DB connection failed — is PostgreSQL running?");

    // Run migrations + seed
    medbrains_db_migrations::run(&db)
        .await
        .expect("migrations failed");
    medbrains_seed::run_seed(&db).await.expect("seed failed");
    let owner = db.clone();
    let db = match request_url {
        Some(url) => test_pool(&url)
            .await
            .expect("request-role connection failed"),
        None => db,
    };

    // Generate ephemeral Ed25519 keypair for JWT (same as config.rs)
    let mut seed = [0u8; 32];
    getrandom::fill(&mut seed).expect("getrandom");
    let signing_key = ed25519_dalek::SigningKey::from_bytes(&seed);
    let verifying_key = signing_key.verifying_key();

    // PKCS#8 DER format for Ed25519
    let pkcs8_prefix: [u8; 16] = [
        0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04,
        0x20,
    ];
    let mut pkcs8_der = Vec::with_capacity(48);
    pkcs8_der.extend_from_slice(&pkcs8_prefix);
    pkcs8_der.extend_from_slice(&seed);

    let encoding_key = EncodingKey::from_ed_der(&pkcs8_der);
    let decoding_key = DecodingKey::from_ed_der(verifying_key.as_bytes());

    // Topology router — tests use shared pool for both writer + reader.
    let topology_resolver: Arc<dyn medbrains_db_topology::TopologyResolver> = Arc::new(
        medbrains_db_topology::PostgresTopologyResolver::new(db.clone()),
    );
    let topology_router: Arc<dyn medbrains_db_topology::TopologyDispatcher> = Arc::new(
        medbrains_db_topology::TopologyRouter::new(db.clone(), db.clone(), topology_resolver),
    );

    let outbox_registry = Arc::new(medbrains_outbox::Registry::new());

    // Postgres-native ReBAC backend keeps tests self-contained (no SpiceDB
    // sidecar). Mirrors `main.rs` test/dev default.
    let authz: Arc<dyn medbrains_authz::AuthzBackend> =
        Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(db.clone()));

    // A test that needs PDFs points GOTENBERG_URL at its own stand-in.
    let gotenberg = secrets
        .0
        .get("GOTENBERG_URL")
        .map(|url| medbrains_print::gotenberg::GotenbergClient::new(url, Client::new()));
    let secret_resolver: Arc<dyn medbrains_core::secrets::SecretResolver> = Arc::new(secrets);

    let state = AppState {
        db: db.clone(),
        jwt_encoding_key: encoding_key,
        jwt_decoding_key: decoding_key,
        cookie_config: CookieConfig {
            domain: None, // no domain restriction for tests
            secure: false,
            cors_origin: "https://medbrains.localhost".to_owned(),
        },
        queue_broadcaster: routes::ws::QueueBroadcaster::new(),
        notifications: medbrains_server::services::notification_hub::NotificationHub::new(),
        trusted_proxies: Arc::new(vec!["127.0.0.1/32".parse().expect("loopback network")]),
        system_state_cache: SystemStateCache::new(),
        outbox: outbox_registry,
        topology: topology_router,
        authz,
        secret_resolver,
        s3: None,
        gotenberg,
        reports: medbrains_server_core::report_runner::ReportGate::default(),
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-test-docs"),
        )),
    };

    let app = routes::build_router(state.clone());

    // Bind to port 0 = OS picks a random available port
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind failed");
    let addr = listener.local_addr().expect("local_addr");

    // Spawn server in background
    tokio::spawn(async move {
        // Hundreds of tests sign in from loopback, so each request gets its own address to stay
        // clear of per-address limits. A test that sets its own header keeps it.
        let app = app
            .layer(axum::middleware::from_fn(give_each_request_an_address))
            .layer(axum::middleware::from_fn(crate::query_count::count_queries));
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .expect("server crashed");
    });

    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");

    TestApp {
        addr,
        client,
        db: owner,
        state,
    }
}

/// A ward of its own with one vacant bed on it. The seed's beds belong to no
/// ward, and a shared bed is taken by whichever run admitted to it last.
pub async fn vacant_ward_bed(app: &TestApp, tenant_id: uuid::Uuid) -> (uuid::Uuid, uuid::Uuid) {
    // Upper case: location codes are A-Z, 0-9 and hyphens.
    let suffix = uuid::Uuid::new_v4().simple().to_string().to_uppercase();
    let ward_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO wards (tenant_id, code, name, total_beds) VALUES ($1, $2, $3, 1) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("LAA-{}", &suffix[..10]))
    .bind(format!("Linkage ward {}", &suffix[..6]))
    .fetch_one(&app.db)
    .await
    .expect("insert ward");
    let bed_id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO locations (tenant_id, level, code, name) \
         VALUES ($1, 'bed', $2, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("LAA-BED-{}", &suffix[..10]))
    .bind(format!("Bed {}", &suffix[..4]))
    .fetch_one(&app.db)
    .await
    .expect("insert bed location");
    sqlx::query(
        "INSERT INTO ward_bed_mappings (tenant_id, ward_id, bed_location_id) VALUES ($1, $2, $3)",
    )
    .bind(tenant_id)
    .bind(ward_id)
    .bind(bed_id)
    .execute(&app.db)
    .await
    .expect("map bed to ward");
    // A bed location gets its state row by trigger; give it the ward.
    sqlx::query(
        "INSERT INTO bed_states (tenant_id, location_id, ward_id) VALUES ($1, $2, $3) \
         ON CONFLICT (tenant_id, location_id) DO UPDATE SET ward_id = EXCLUDED.ward_id",
    )
    .bind(tenant_id)
    .bind(bed_id)
    .bind(ward_id)
    .execute(&app.db)
    .await
    .expect("bed state");
    (ward_id, bed_id)
}

/// A signed-in user of `role`, with its own cookie jar.
#[derive(Debug)]
pub struct Staff {
    pub client: Client,
    pub csrf: String,
    pub user_id: uuid::Uuid,
    /// For the step-up a signature needs.
    pub password: String,
}

/// Provision a user of `role` through the admin API (the way a hospital
/// would), subtract `denied` from the role's permissions, and sign them in.
pub async fn provision_staff(
    app: &TestApp,
    admin_csrf: &str,
    role: &str,
    denied: &[&str],
) -> Staff {
    provision_staff_with(app, admin_csrf, role, &[], denied).await
}

/// As [`provision_staff`], also granting `extra` on top of the role.
pub async fn provision_staff_with(
    app: &TestApp,
    admin_csrf: &str,
    role: &str,
    extra: &[&str],
    denied: &[&str],
) -> Staff {
    let tag = &uuid::Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("t{role}_{tag}"), format!("Staff#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&serde_json::json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Test {role}"),
            "role": role,
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let user_id: uuid::Uuid = sqlx::query_scalar(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', $3::jsonb, 'denied', $2::jsonb), \
                perm_version = perm_version + 1 \
          WHERE username = $1 RETURNING id",
    )
    .bind(&username)
    .bind(serde_json::json!(denied))
    .bind(serde_json::json!(extra))
    .fetch_one(&app.db)
    .await
    .expect("user");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: serde_json::Value = client
        .post(app.url("/api/auth/login"))
        .json(&serde_json::json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    Staff {
        client,
        csrf,
        user_id,
        password,
    }
}

/// Adds a unique `X-Forwarded-For` from the benchmark range unless the test set one.
async fn give_each_request_an_address(
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    static NEXT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);
    if !request.headers().contains_key("x-forwarded-for") {
        let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let address = format!("198.18.{}.{}", (n >> 8) & 0xFF, n & 0xFF);
        if let Ok(value) = address.parse() {
            request.headers_mut().insert("x-forwarded-for", value);
        }
    }
    next.run(request).await
}

/// A handler context for driving one outbox handler directly, with `secrets`
/// as the tenant's credentials (empty = nothing configured).
pub fn handler_ctx(
    app: &TestApp,
    tenant_id: uuid::Uuid,
    event_type: &str,
    secrets: TestSecrets,
) -> medbrains_outbox::handler::HandlerCtx {
    medbrains_outbox::handler::HandlerCtx {
        pool: app.db.clone(),
        tenant_id,
        event_id: uuid::Uuid::new_v4(),
        event_type: event_type.to_owned(),
        actor_user_id: None,
        attempts: 1,
        secret_resolver: Arc::new(secrets),
        http_client: Client::new(),
        object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-handler-tests"),
        )),
    }
}

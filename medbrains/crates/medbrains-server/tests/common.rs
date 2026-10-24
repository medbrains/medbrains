#![allow(dead_code, unreachable_pub)]

//! Integration test harness — spawns Axum server on a random port.
//!
//! Requires PostgreSQL running (same as dev: `docker compose up -d postgres`).
//! Uses a separate test database to avoid polluting dev data.

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
#[derive(Debug)]
pub struct TestApp {
    pub addr: SocketAddr,
    pub client: Client,
    /// The same pool the server uses — for tests that need to set up state
    /// (e.g. mark a patient deceased) that no public endpoint exposes.
    pub db: sqlx::PgPool,
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
    spawn(secrets, std::env::var("TEST_APP_DATABASE_URL").ok()).await
}

/// A server whose request pool is `medbrains_app`, the role production
/// requests use, which row level security applies to. Migrations, seeding and
/// `TestApp::db` stay on the owner. No password needed: the owner (a superuser
/// in dev and CI) switches role at connection start.
pub async fn spawn_app_as_request_role() -> TestApp {
    let sep = if database_url().contains('?') {
        '&'
    } else {
        '?'
    };
    let url = format!("{}{sep}options=-c%20role%3Dmedbrains_app", database_url());
    spawn(TestSecrets::default(), Some(url)).await
}

fn database_url() -> String {
    let _ = dotenvy::dotenv();
    std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains".to_owned()
    })
}

/// `request_url` names the role the server's requests run as
/// (`TEST_APP_DATABASE_URL` for a whole run); the owner otherwise.
async fn spawn(secrets: TestSecrets, request_url: Option<String>) -> TestApp {
    // Connect to DB
    let db = medbrains_db::pool::create_pool(&database_url())
        .await
        .expect("DB connection failed — is PostgreSQL running?");

    // Run migrations + seed
    medbrains_db_migrations::run(&db)
        .await
        .expect("migrations failed");
    medbrains_seed::run_seed(&db).await.expect("seed failed");
    let owner = db.clone();
    let db = match request_url {
        Some(url) => medbrains_db::pool::create_pool(&url)
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
        trusted_proxies: Arc::new(vec![]),
        system_state_cache: SystemStateCache::new(),
        outbox: outbox_registry,
        topology: topology_router,
        authz,
        secret_resolver,
        s3: None,
        gotenberg,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("medbrains-test-docs"),
        )),
    };

    let app = routes::build_router(state);

    // Bind to port 0 = OS picks a random available port
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind failed");
    let addr = listener.local_addr().expect("local_addr");

    // Spawn server in background
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("server crashed");
    });

    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");

    TestApp {
        addr,
        client,
        db: owner,
    }
}

/// A signed-in user of `role`, with its own cookie jar.
#[derive(Debug)]
pub struct Staff {
    pub client: Client,
    pub csrf: String,
    pub user_id: uuid::Uuid,
}

/// Provision a user of `role` through the admin API (the way a hospital
/// would), subtract `denied` from the role's permissions, and sign them in.
pub async fn provision_staff(
    app: &TestApp,
    admin_csrf: &str,
    role: &str,
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
        "UPDATE users SET access_matrix = jsonb_build_object('extra', '[]'::jsonb, 'denied', $2::jsonb), \
                perm_version = perm_version + 1 \
          WHERE username = $1 RETURNING id",
    )
    .bind(&username)
    .bind(serde_json::json!(denied))
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
    }
}

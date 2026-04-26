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
    routes, seed,
    state::{AppState, CookieConfig},
};

/// A running test server with an HTTP client.
pub struct TestApp {
    pub addr: SocketAddr,
    pub client: Client,
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
}

/// Spawn a test server on a random port.
/// Uses the dev database (DATABASE_URL from .env or env var).
pub async fn spawn_app() -> TestApp {
    // Load .env
    let _ = dotenvy::dotenv();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains".to_owned()
    });

    // Connect to DB
    let db = medbrains_db::pool::create_pool(&database_url)
        .await
        .expect("DB connection failed — is PostgreSQL running?");

    // Run migrations + seed
    medbrains_db::pool::run_migrations(&db)
        .await
        .expect("migrations failed");
    seed::run_seed(&db).await.expect("seed failed");

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

    let state = AppState {
        db: db.clone(),
        yottadb: None,
        jwt_encoding_key: encoding_key,
        jwt_decoding_key: decoding_key,
        cookie_config: CookieConfig {
            domain: None, // no domain restriction for tests
            secure: false,
            cors_origin: "http://localhost:5173".to_owned(),
        },
        queue_broadcaster: routes::ws::QueueBroadcaster::new(),
        trusted_proxies: Arc::new(vec![]),
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

    TestApp { addr, client, db }
}

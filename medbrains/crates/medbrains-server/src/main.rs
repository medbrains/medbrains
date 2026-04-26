use std::sync::Arc;
use std::{net::SocketAddr, time::Duration};

use axum::{
    Router,
    http::{HeaderName, HeaderValue, Method, header::CONTENT_TYPE},
};
use jsonwebtoken::{DecodingKey, EncodingKey};
use tower_http::{
    cors::CorsLayer, request_id::SetRequestIdLayer, set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use medbrains_server::{
    config::AppConfig,
    middleware::request_id::{MakeRequestUuid, request_id_header},
    orchestration, routes, seed,
    state::{AppState, CookieConfig},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file (ignore if missing — production uses real env vars)
    let _ = dotenvy::dotenv();

    // Initialize structured logging
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "medbrains_server=debug,tower_http=debug"
                .parse()
                .unwrap_or_default()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = AppConfig::from_env()?;
    tracing::info!(bind = %config.bind_addr(), "starting MedBrains server");

    // Connect to PostgreSQL
    let pool_config = medbrains_db::pool::PoolConfig {
        max_connections: config.db_pool_max_connections,
        min_connections: config.db_pool_min_connections,
        acquire_timeout: Duration::from_secs(config.db_pool_acquire_timeout_secs),
        idle_timeout: Duration::from_secs(config.db_pool_idle_timeout_secs),
        max_lifetime: Duration::from_secs(config.db_pool_max_lifetime_secs),
        statement_cache_capacity: config.db_statement_cache_capacity,
        slow_statement_threshold: Duration::from_millis(config.db_slow_query_ms),
    };
    let db_pool =
        medbrains_db::pool::create_pool_with_config(&config.database_url, &pool_config).await?;

    // Run migrations
    medbrains_db::pool::run_migrations(&db_pool).await?;

    // Create YottaDB client (optional in Phase 1)
    let yottadb = config.yottadb_url.as_ref().map(|url| {
        tracing::info!(%url, "YottaDB client configured");
        medbrains_yottadb::client::YottaDbClient::new(url)
    });
    if yottadb.is_none() {
        tracing::info!("YottaDB not configured — deferred to Phase 2");
    }

    // Build JWT keys from Ed25519 PEM/base64
    let encoding_key = EncodingKey::from_ed_der(&decode_b64_or_pem(&config.jwt_private_key_pem)?);
    let decoding_key = DecodingKey::from_ed_der(&decode_b64_or_pem(&config.jwt_public_key_pem)?);

    // Cookie configuration
    let cookie_config = CookieConfig {
        domain: config.cookie_domain.clone(),
        secure: config.secure_cookies,
        cors_origin: config.cors_origin.clone(),
    };

    // Build shared state
    let state = AppState {
        db: db_pool.clone(),
        yottadb,
        jwt_encoding_key: encoding_key,
        jwt_decoding_key: decoding_key,
        cookie_config,
        queue_broadcaster: routes::ws::QueueBroadcaster::new(),
        trusted_proxies: Arc::new(config.trusted_proxies.clone()),
    };

    // Run seed (insert default tenant + super_admin if not exists)
    seed::run_seed(&db_pool).await?;

    // CORS — specific origin with credentials support
    let origin: HeaderValue = config
        .cors_origin
        .parse()
        .map_err(|e| format!("Invalid CORS_ORIGIN: {e}"))?;

    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers([
            CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true);

    // Security response headers
    let hsts = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("strict-transport-security"),
        HeaderValue::from_static("max-age=31536000; includeSubDomains; preload"),
    );
    let no_frame = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("SAMEORIGIN"),
    );
    let xss_filter = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("x-xss-protection"),
        HeaderValue::from_static("1; mode=block"),
    );
    let no_sniff = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    let no_cache = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("cache-control"),
        HeaderValue::from_static("no-store, no-cache, must-revalidate"),
    );
    let csp = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("content-security-policy"),
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; \
             img-src 'self' data: blob:; connect-src 'self'; \
             frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
        ),
    );

    // Static file serving — SPA fallback for frontend dist
    let static_dir = config
        .static_dir
        .clone()
        .unwrap_or_else(|| "/var/www/medbrains".to_owned());
    let spa_fallback = tower_http::services::ServeDir::new(&static_dir).not_found_service(
        tower_http::services::ServeFile::new(format!("{static_dir}/index.html")),
    );

    // Build router with all routes + static file fallback
    let app: Router = routes::build_router(state)
        .fallback_service(spa_fallback)
        .layer(hsts)
        .layer(no_frame)
        .layer(xss_filter)
        .layer(no_sniff)
        .layer(no_cache)
        .layer(csp)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(SetRequestIdLayer::new(request_id_header(), MakeRequestUuid));

    // Start orchestration background tasks
    orchestration::jobs::start_job_worker(db_pool.clone());
    orchestration::scheduler::start_scheduler(db_pool);

    // Start server
    let addr: SocketAddr = config.bind_addr().parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "listening");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Decode a base64-encoded or raw PEM key into DER bytes.
fn decode_b64_or_pem(input: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;

    // Try base64 decode first
    let trimmed = input.trim();
    if let Ok(bytes) = STANDARD.decode(trimmed) {
        return Ok(bytes);
    }

    // Fall back to treating as PEM — extract base64 content between headers
    let b64_content: String = trimmed
        .lines()
        .filter(|line| !line.starts_with("-----"))
        .collect();

    Ok(STANDARD.decode(b64_content)?)
}

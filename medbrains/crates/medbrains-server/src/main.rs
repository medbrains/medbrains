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
    middleware::{
        request_id::{MakeRequestUuid, request_id_header},
        system_state::SystemStateCache,
    },
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

    // Sub-commands run via the same binary so we share code/config:
    //   medbrains-server audit verify-chain [--tenant=<uuid>|--all]
    // RFC-INFRA-2026-002 Phase 2 deliverable.
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 3 && args[1] == "audit" && args[2] == "verify-chain" {
        return run_verify_chain(&config, &args[3..]).await;
    }
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

    // Sprint A.8 — assemble outbox handler registry. The pipeline_fallback
    // wraps the existing events::dispatch_to_pipelines so unregistered
    // event_types continue to route through user-defined pipelines.
    let outbox_registry = build_outbox_registry();

    // Build shared state
    let state = AppState {
        db: db_pool.clone(),
        yottadb,
        jwt_encoding_key: encoding_key,
        jwt_decoding_key: decoding_key,
        cookie_config,
        queue_broadcaster: routes::ws::QueueBroadcaster::new(),
        trusted_proxies: Arc::new(config.trusted_proxies.clone()),
        system_state_cache: SystemStateCache::new(),
        outbox: outbox_registry.clone(),
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
    orchestration::scheduler::start_scheduler(db_pool.clone());

    // Sprint A.8 — start outbox worker. In production the worker should
    // connect with the BYPASSRLS `medbrains_outbox_worker` role; for local
    // dev we reuse the main pool. assert_bypass_rls() panics if the role
    // does not have BYPASSRLS — opted out in dev via env var.
    if std::env::var("MEDBRAINS_DISABLE_OUTBOX_WORKER").ok().as_deref() != Some("true") {
        let outbox_worker = medbrains_outbox::Worker::new(
            db_pool.clone(),
            outbox_registry,
            medbrains_outbox::WorkerConfig::default(),
        );
        let _shutdown_tx = outbox_worker.spawn();
        tracing::info!("outbox worker spawned");
    } else {
        tracing::warn!("MEDBRAINS_DISABLE_OUTBOX_WORKER=true — outbox worker NOT spawned");
    }

    // Start server
    let addr: SocketAddr = config.bind_addr().parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "listening");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Sprint A.8 — assemble the outbox Handler Registry.
///
/// Registers typed handlers for known event_types and a pipeline_fallback
/// that delegates to `events::dispatch_to_pipelines` for everything else.
fn build_outbox_registry() -> Arc<medbrains_outbox::Registry> {
    use medbrains_outbox::handlers::{
        abdm_stub, email_stub, hl7_stub, pipeline_fallback, razorpay, tpa_stub, twilio,
    };
    use medbrains_outbox::Registry;

    let mut registry = Registry::new();

    // Typed real-money handlers
    registry.register(razorpay::CreateOrderHandler);
    registry.register(razorpay::RefundHandler);

    // Twilio per-event-type — distinct registrations for each sms.* code
    // so the registry's panic-on-duplicate catches accidental re-binds.
    registry.register(twilio::SmsSendHandler::new("sms.appointment_confirmation"));
    registry.register(twilio::SmsSendHandler::new("sms.appointment_reminder_24h"));
    registry.register(twilio::SmsSendHandler::new("sms.appointment_reminder_2h"));
    registry.register(twilio::SmsSendHandler::new("sms.discharge_summary"));
    registry.register(twilio::SmsSendHandler::new("sms.vaccination_reminder"));
    registry.register(twilio::SmsSendHandler::new("sms.cds_critical_interaction"));
    registry.register(twilio::SmsSendHandler::new("sms.payment_failed"));

    // SMTP / ABDM / TPA / HL7 stubs (Phase 1 — log only, return Ok)
    registry.register(email_stub::SmtpSendHandler::new("email.discharge_summary"));
    registry.register(email_stub::SmtpSendHandler::new("email.mis_daily_export"));
    registry.register(abdm_stub::VerifyAbhaHandler);
    registry.register(abdm_stub::HieBundlePushHandler);
    registry.register(tpa_stub::PreauthSubmitHandler);
    registry.register(hl7_stub::CriticalValueHandler);

    // Fallback: route any unregistered event_type to user-defined pipelines.
    let dispatcher = Arc::new(EventsPipelineDispatcher);
    registry.set_fallback(pipeline_fallback::PipelineFallbackHandler::new(dispatcher));

    Arc::new(registry)
}

/// Adapter — implements the outbox `PipelineDispatcher` trait by delegating
/// to the existing `events::dispatch_to_pipelines` function.
#[derive(Debug)]
struct EventsPipelineDispatcher;

#[async_trait::async_trait]
impl medbrains_outbox::handlers::pipeline_fallback::PipelineDispatcher
    for EventsPipelineDispatcher
{
    async fn dispatch(
        &self,
        pool: &sqlx::PgPool,
        tenant_id: uuid::Uuid,
        user_id: uuid::Uuid,
        event_type: &str,
        payload: &serde_json::Value,
    ) -> Result<(), String> {
        medbrains_server::events::dispatch_to_pipelines(
            pool, tenant_id, user_id, event_type, payload,
        )
        .await
        .map_err(|e| e.to_string())
    }
}

/// `medbrains-server audit verify-chain` subcommand.
/// Walks the audit_log hash chain for one or all tenants and writes a row
/// to `audit_chain_verifications` with the result. Exits non-zero if any
/// chain breaks — the K8s CronJob alerts on non-zero exit.
async fn run_verify_chain(
    config: &AppConfig,
    args: &[String],
) -> Result<(), Box<dyn std::error::Error>> {
    use medbrains_db::audit::AuditLogger;

    let pool_config = medbrains_db::pool::PoolConfig {
        max_connections: 4,
        min_connections: 1,
        acquire_timeout: Duration::from_secs(config.db_pool_acquire_timeout_secs),
        idle_timeout: Duration::from_secs(config.db_pool_idle_timeout_secs),
        max_lifetime: Duration::from_secs(config.db_pool_max_lifetime_secs),
        statement_cache_capacity: config.db_statement_cache_capacity,
        slow_statement_threshold: Duration::from_millis(config.db_slow_query_ms),
    };
    let pool =
        medbrains_db::pool::create_pool_with_config(&config.database_url, &pool_config).await?;

    // Resolve target tenants
    let tenant_filter = args.iter().find_map(|a| a.strip_prefix("--tenant="));
    let tenants: Vec<uuid::Uuid> = if let Some(t) = tenant_filter {
        vec![uuid::Uuid::parse_str(t)?]
    } else {
        AuditLogger::tenants_with_audit_log(&pool).await?
    };

    let mut any_invalid = false;
    for tenant in tenants {
        let started = std::time::Instant::now();
        let result = AuditLogger::verify_chain_for_tenant(&pool, tenant).await?;
        let duration_ms: i32 = i32::try_from(started.elapsed().as_millis()).unwrap_or(i32::MAX);

        // Persist the verification result
        // allow-raw-sql: cron job container, pre-Phase-3 typed helper not yet in medbrains-db
        sqlx::query(
            "INSERT INTO audit_chain_verifications ( \
                 tenant_id, completed_at, rows_checked, head_hash, broken_at, \
                 valid, duration_ms, triggered_by \
             ) VALUES ($1, now(), $2, $3, $4, $5, $6, 'cron')",
        )
        .bind(result.tenant_id)
        .bind(result.rows_checked)
        .bind(result.head_hash.as_deref())
        .bind(result.broken_at)
        .bind(result.valid)
        .bind(duration_ms)
        .execute(&pool)
        .await?;

        if result.valid {
            tracing::info!(
                tenant_id = %tenant,
                rows_checked = result.rows_checked,
                rows_legacy_skipped = result.rows_legacy_skipped,
                duration_ms,
                "audit chain verified OK"
            );
        } else {
            any_invalid = true;
            tracing::error!(
                tenant_id = %tenant,
                rows_checked = result.rows_checked,
                rows_legacy_skipped = result.rows_legacy_skipped,
                broken_at = ?result.broken_at,
                "audit chain BROKEN — alert triggered"
            );
        }
    }

    if any_invalid {
        std::process::exit(2);
    }
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

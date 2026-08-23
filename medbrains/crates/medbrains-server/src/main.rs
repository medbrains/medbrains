use std::sync::Arc;
use std::{net::SocketAddr, time::Duration};

use axum::{
    Router,
    http::{HeaderName, HeaderValue, Method, header::CONTENT_TYPE},
};
use jsonwebtoken::{DecodingKey, EncodingKey};
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    request_id::SetRequestIdLayer,
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use medbrains_server::{
    config::AppConfig,
    middleware::{
        authz_write_guard::authz_write_guard,
        payload_size_log::payload_size_log,
        request_id::{MakeRequestUuid, request_id_header},
        system_state::SystemStateCache,
    },
    orchestration, routes,
    s3_presign::S3PresignClient,
    state::{AppState, CookieConfig},
};

// jemalloc as the global allocator: lower fragmentation + better multithreaded
// heap behaviour than the system allocator under concurrent request load.
#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file (ignore if missing — production uses real env vars)
    let _ = dotenvy::dotenv();

    // Initialize structured logging.
    //
    // Colour follows the terminal rather than being assumed: escape codes
    // written to a redirected log follow the line into the file and have to be
    // stripped before anything can read it.
    let colour = medbrains_server_core::http_trace::terminal_supports_colour();
    medbrains_server_core::http_trace::init_colour(colour);

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "medbrains_server=debug,tower_http=debug"
                .parse()
                .unwrap_or_default()
        }))
        .with(tracing_subscriber::fmt::layer().with_ansi(colour))
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

    // Run migrations on a connection that is allowed to change the schema.
    //
    // The application role deliberately cannot: it has USAGE on the schema and
    // DML on the tables, and nothing else. That is the point — an application
    // that can drop a policy can switch off its own isolation. It also means
    // the application cannot migrate, and `run_migrations` on the request pool
    // fails at boot with "permission denied for schema public".
    //
    // `MIGRATION_DATABASE_URL` names the owner. Unset, this is the request
    // pool, which is right while everything connects as one role and wrong the
    // moment they do not.
    // Held until seeding is done, then closed: nothing serving requests should
    // keep a connection that can alter the schema.
    let bootstrap_pool = match std::env::var("MIGRATION_DATABASE_URL") {
        Ok(url) if !url.trim().is_empty() => {
            let owner =
                medbrains_db::pool::create_pool_with_config(&url, &pool_config).await?;
            medbrains_db::pool::run_migrations(&owner).await?;
            tracing::info!("migrations ran on the owner connection");
            owner
        }
        _ => {
            medbrains_db::pool::run_migrations(&db_pool).await?;
            db_pool.clone()
        }
    };

    // A second pool for the background workers.
    //
    // They are the one part of the server with no request to take a tenant
    // from: the outbox drains one queue for every hospital, and the escalation
    // passes have to find overdue work wherever it is before they can act on
    // it per tenant. Under row level security a discovery query on the request
    // pool finds nothing — not an error, an empty list, so the pass runs,
    // reports success and escalates nobody.
    //
    // `WORKER_DATABASE_URL` should name a role that bypasses row level
    // security; migration 0984 creates `medbrains_outbox_worker` for exactly
    // this. Unset, this is the request pool, which is right for a development
    // machine and wrong the moment the application stops being a superuser.
    let worker_pool = match std::env::var("WORKER_DATABASE_URL") {
        Ok(url) if !url.trim().is_empty() => {
            let pool = medbrains_db::pool::create_pool_with_config(&url, &pool_config).await?;
            tracing::info!("background workers have their own pool");
            pool
        }
        _ => {
            tracing::warn!(
                "WORKER_DATABASE_URL unset — background workers share the request pool. \
                 Set it to a BYPASSRLS role (see migration 0984) before the application \
                 stops connecting as a superuser, or every background pass will quietly \
                 find nothing to do."
            );
            db_pool.clone()
        }
    };

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

    // Sprint B.4.4 — TopologyRouter. Aurora-default tenants reuse the
    // shared db_pool for both writer + reader. Tenants opted into
    // Patroni get lazily-built pools resolved per request via
    // tenant_db_topology lookups.
    let topology_resolver: Arc<dyn medbrains_db_topology::TopologyResolver> = Arc::new(
        medbrains_db_topology::PostgresTopologyResolver::new(db_pool.clone()),
    );
    let topology_router: Arc<dyn medbrains_db_topology::TopologyDispatcher> =
        Arc::new(medbrains_db_topology::TopologyRouter::new(
            db_pool.clone(),
            db_pool.clone(),
            topology_resolver,
        ));

    // ── ReBAC backend (SpiceDB sidecar; falls back to Postgres-native) ──
    //
    // SPICEDB_ENDPOINT and SPICEDB_TOKEN come from .env / k8s config.
    // If unset (or connection fails), we silently fall back to the
    // Postgres-native AuthzPgBackend so dev environments without
    // SpiceDB running still boot. Production deploys always set these.
    tracing::info!(
        endpoint = ?std::env::var("SPICEDB_ENDPOINT").ok(),
        "spicedb endpoint config"
    );
    // SpiceDB connect outcome — used to decide whether the Watch consumer
    // should also be spawned (a Postgres fallback has nothing to watch).
    let mut spicedb_live: Option<(String, String)> = None;
    let mut spicedb_outbox_client = None;
    let authz: Arc<dyn medbrains_authz::AuthzBackend> = if let Ok(endpoint) =
        std::env::var("SPICEDB_ENDPOINT")
    {
        let token = std::env::var("SPICEDB_TOKEN").unwrap_or_else(|_| "devsecret".to_owned());
        match medbrains_authz::backend_spicedb::SpiceDbBackend::connect(&endpoint, &token).await {
            Ok(client) => {
                tracing::info!(endpoint = %endpoint, "rebac: connected to SpiceDB sidecar");
                spicedb_live = Some((endpoint, token));
                spicedb_outbox_client = Some(client.clone());
                Arc::new(
                    medbrains_authz::backend_durable_spicedb::DurableSpiceDbBackend::new(
                        db_pool.clone(),
                        client,
                    ),
                )
            }
            Err(e) => {
                tracing::warn!(error = %e, endpoint = %endpoint,
                    "rebac: SpiceDB connect failed, falling back to Postgres backend");
                Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(
                    db_pool.clone(),
                ))
            }
        }
    } else {
        tracing::warn!("rebac: SPICEDB_ENDPOINT unset, using Postgres-native authz backend");
        Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(
            db_pool.clone(),
        ))
    };

    // ── SpiceDB Watch consumer — bumps users.perm_version when tuples change ──
    // Without this, revoking a permission only takes effect at JWT expiry.
    // With it, the change propagates within ~1 s of the SpiceDB write.
    // Only spawn when SpiceDB actually connected — a dead endpoint produces a
    // 5-second reconnect loop that floods the logs (no SpiceDB → no tuples →
    // nothing to watch).
    if let Some((spicedb_endpoint, watch_token)) = spicedb_live {
        let watch_db = db_pool.clone();
        tokio::spawn(async move {
            medbrains_authz::watch::run_user_watcher(
                spicedb_endpoint,
                watch_token,
                move |user_ids| {
                    let db = watch_db.clone();
                    async move {
                        let res = sqlx::query(
                            "UPDATE users \
                             SET perm_version = perm_version + 1, updated_at = now() \
                             WHERE id = ANY($1::uuid[])",
                        )
                        .bind(&user_ids)
                        .execute(&db)
                        .await;
                        match res {
                            Ok(r) => tracing::debug!(
                                bumped = r.rows_affected(),
                                "watch: bumped perm_version"
                            ),
                            Err(e) => tracing::warn!(
                                error = %e,
                                "watch: perm_version bump failed"
                            ),
                        }
                    }
                },
            )
            .await;
        });
        tracing::info!("watch consumer spawned");
    } else {
        tracing::info!("watch consumer not spawned because authz is using Postgres fallback");
    }

    if let Some(spicedb) = spicedb_outbox_client {
        let outbox_db = db_pool.clone();
        tokio::spawn(async move {
            medbrains_authz::backend_durable_spicedb::run_spicedb_outbox_worker(outbox_db, spicedb)
                .await;
        });
        tracing::info!("rebac: SpiceDB outbox worker spawned");
    }

    // Build shared state
    let state_secret_resolver = medbrains_server::secret_backend::build_secret_resolver().await;

    let s3_client = S3PresignClient::from_config(&config).await.map(Arc::new);

    // Generated-document storage: MEDBRAINS_OBJECTS_HOT (deploy kit
    // convention) else a dev-local directory.
    let documents_root =
        std::env::var("MEDBRAINS_OBJECTS_HOT").unwrap_or_else(|_| "./data/objects".to_owned());
    let documents_store: Arc<dyn medbrains_core::object_store::ObjectStore> = Arc::new(
        medbrains_core::object_store::LocalFsObjectStore::new(&documents_root),
    );
    tracing::info!(root = %documents_root, "documents object store (local fs)");

    let gotenberg_client = config.gotenberg_url.as_deref().map(|url| {
        tracing::info!(%url, "gotenberg PDF renderer configured");
        medbrains_print::gotenberg::GotenbergClient::new(url, reqwest::Client::new())
    });
    if gotenberg_client.is_none() {
        tracing::info!("GOTENBERG_URL unset — document PDF rendering disabled");
    }
    if s3_client.is_none() {
        tracing::info!("S3_BUCKET not configured — presigned upload/download endpoints disabled");
    }

    let state = AppState {
        db: db_pool.clone(),
        jwt_encoding_key: encoding_key,
        jwt_decoding_key: decoding_key,
        cookie_config,
        queue_broadcaster: routes::ws::QueueBroadcaster::new(),
        notifications: medbrains_server::services::notification_hub::NotificationHub::new(),
        trusted_proxies: Arc::new(config.trusted_proxies.clone()),
        system_state_cache: SystemStateCache::new(),
        outbox: Arc::clone(&outbox_registry),
        topology: topology_router,
        authz,
        secret_resolver: state_secret_resolver,
        s3: s3_client,
        gotenberg: gotenberg_client,
        documents_store: Arc::clone(&documents_store),
    };

    // Seeding runs on the bootstrap connection, not the request pool.
    //
    // It writes the things a hospital has before it has anybody: the default
    // tenant, the first administrator, the built-in roles, and the global
    // widget catalogue whose rows have no tenant at all. Row level security
    // refuses a tenantless write from the application role — deliberately, so
    // a request cannot mint a global row by leaving the tenant off — which
    // makes seeding schema-adjacent work that belongs beside migrations.
    medbrains_seed::run_seed(&bootstrap_pool).await?;

    // Rebuild the code-owned role definitions for every tenant, not just
    // DEFAULT. Cheap, idempotent, and the only thing that repairs a tenant
    // whose roles table was never populated — or was emptied.
    medbrains_seed::reconcile_built_in_roles(&bootstrap_pool).await?;

    if !bootstrap_pool.is_closed() && std::env::var("MIGRATION_DATABASE_URL").is_ok() {
        bootstrap_pool.close().await;
    }

    // Provision SSO from the local creds file (sso.local.json) if present — turnkey
    // federation without manual /admin/sso setup.
    routes::sso::seed_from_config(&state).await?;

    // CORS — explicit HTTPS allow-list with credentials support.
    // Do not use wildcard CORS or generic localhost origins for HMS traffic.
    let cors_origins = config
        .cors_origin
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(|origin| {
            if origin == "*" {
                return Err("CORS_ORIGIN must not contain wildcard origins".to_owned());
            }
            if !origin.starts_with("https://") {
                return Err(format!(
                    "CORS_ORIGIN must use HTTPS MedBrains-controlled origins only: {origin}"
                ));
            }
            origin
                .parse::<HeaderValue>()
                .map_err(|e| format!("Invalid CORS_ORIGIN value {origin}: {e}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    if cors_origins.is_empty() {
        return Err("CORS_ORIGIN must contain at least one origin".into());
    }

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(cors_origins))
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
            HeaderName::from_static("x-medbrains-client"),
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
    // Tightened CSP — blocks plugins, iframes, web workers from CDNs,
    // forces HTTPS for any nested loads. Same allow-list as before
    // for the frontend SPA.
    let csp = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("content-security-policy"),
        HeaderValue::from_static(
            // No 'unsafe-inline' on script-src — Vite emits all JS as
            // external bundles. Inline styles still allowed (Mantine
            // generates them at runtime). 'wasm-unsafe-eval' permits
            // Loro CRDT wasm without enabling JS eval.
            "default-src 'self'; \
             script-src 'self' 'wasm-unsafe-eval' https://*.razorpay.com; \
             script-src-elem 'self' https://*.razorpay.com; \
             style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \
             style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; \
             img-src 'self' data: blob: https:; \
             font-src 'self' data: https://fonts.gstatic.com; \
             connect-src 'self' https://*.razorpay.com wss:; \
             worker-src 'self' blob:; \
             manifest-src 'self'; \
             object-src 'none'; \
             frame-src https://*.razorpay.com; \
             frame-ancestors 'none'; \
             base-uri 'self'; \
             form-action 'self'; \
             upgrade-insecure-requests",
        ),
    );

    // Referrer-Policy — never leak full URL paths to third parties.
    let referrer_policy = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    // Permissions-Policy — disable powerful browser APIs the app doesn't use.
    let permissions_policy = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static(
            "camera=(), microphone=(), geolocation=(), payment=(), \
             usb=(), magnetometer=(), accelerometer=(), gyroscope=(), \
             interest-cohort=()",
        ),
    );

    // Cross-Origin-Opener-Policy — isolates the browsing context so
    // window.opener attacks from popups can't reach back into our app.
    let coop = SetResponseHeaderLayer::overriding(
        HeaderName::from_static("cross-origin-opener-policy"),
        HeaderValue::from_static("same-origin"),
    );

    // Static file serving — SPA fallback for frontend dist
    let static_dir = config
        .static_dir
        .clone()
        .unwrap_or_else(|| "/var/www/medbrains".to_owned());
    // Serve build-time precompressed bundles (.br/.gz emitted by Vite) when the
    // client accepts them — max ratio computed once, zero per-request CPU. Falls
    // back to the original (which the global CompressionLayer compresses live).
    let spa_fallback = tower_http::services::ServeDir::new(&static_dir)
        .precompressed_br()
        .precompressed_gzip()
        .not_found_service(tower_http::services::ServeFile::new(format!(
            "{static_dir}/index.html"
        )));

    // Real-time notification bridge: LISTEN on the `notification_created`
    // channel (migration 0285 trigger) and republish committed rows to the
    // NotificationHub for WebSocket fan-out. Clone the hub before `state` is
    // moved into the router.
    medbrains_server::services::notification_listener::spawn(db_pool.clone(), state.notifications.clone());

    // Clone state for the simulator scheduler before `state` is moved into
    // the router below — the scheduler needs AppState (AI config) to run
    // agent simulations.
    let scheduler_state = state.clone();

    // Build router with all routes + static file fallback
    let app: Router = routes::build_router(state)
        .fallback_service(spa_fallback)
        // Dev-only (opt-in via MEDBRAINS_LOG_PAYLOAD_SIZES): logs the
        // uncompressed response size and flags large GET payloads as
        // field-projection candidates. Innermost layer → reads the handler's
        // Content-Length before the CompressionLayer rewrites it.
        .layer(axum::middleware::from_fn(payload_size_log))
        // Authz write guard self-scopes to /api/admin/{roles,users},
        // /api/setup/{roles,users}, /api/sharing/* — denies mutations
        // when the bridge marks the tunnel as offline.
        .layer(axum::middleware::from_fn(authz_write_guard))
        .layer(hsts)
        .layer(no_frame)
        .layer(xss_filter)
        .layer(no_sniff)
        .layer(no_cache)
        .layer(csp)
        .layer(referrer_policy)
        .layer(permissions_policy)
        .layer(coop)
        .layer(cors)
        // Negotiated response compression (brotli / zstd / gzip / deflate).
        // JSON API payloads are highly repetitive → typically 70–90% smaller
        // on the wire. Picks the best algorithm from the request's
        // Accept-Encoding; passes through when the client offers none.
        .layer(CompressionLayer::new())
        // Responses are logged at a level that matches their status, so a 5xx
        // arrives in aggregation as an ERROR rather than as another INFO line
        // among thousands.
        .layer(
            TraceLayer::new_for_http()
                .on_response(medbrains_server_core::http_trace::on_response),
        )
        .layer(SetRequestIdLayer::new(request_id_header(), MakeRequestUuid));

    // Make the finalized router available to the AI assistant's in-process read
    // tool (call_api), so it dispatches GETs through the real middleware stack.
    let _ = medbrains_ai::AI_ROUTER.set(app.clone());

    // Start orchestration background tasks
    orchestration::jobs::start_job_worker(worker_pool.clone());
    orchestration::scheduler::start_scheduler(worker_pool.clone());

    // Sprint A.8 — start outbox worker. In production the worker should
    // connect with the BYPASSRLS `medbrains_outbox_worker` role; for local
    // dev we reuse the main pool. assert_bypass_rls() panics if the role
    // does not have BYPASSRLS — opted out in dev via env var.
    //
    // Real handlers (Razorpay) need a SecretResolver + a shared
    // reqwest::Client threaded through HandlerCtx. The backend is chosen by
    // `secret_backend::build_secret_resolver` (MEDBRAINS_SECRETS_BACKEND or
    // DeployMode): env in dev, file on-prem, AWS Secrets Manager in cloud.
    if std::env::var("MEDBRAINS_DISABLE_OUTBOX_WORKER")
        .ok()
        .as_deref()
        == Some("true")
    {
        tracing::warn!("MEDBRAINS_DISABLE_OUTBOX_WORKER=true — outbox worker NOT spawned");
    } else {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent(concat!("medbrains-outbox/", env!("CARGO_PKG_VERSION")))
            .build()?;

        let secret_resolver = medbrains_server::secret_backend::build_secret_resolver().await;

        let worker_config = medbrains_outbox::WorkerConfig::with_substrate(
            secret_resolver,
            http_client,
            Arc::clone(&documents_store),
        );

        let outbox_worker =
            medbrains_outbox::Worker::new(worker_pool.clone(), outbox_registry, worker_config);
        let _shutdown_tx = outbox_worker.spawn();
        tracing::info!("outbox worker spawned");
    }

    // Simulator cron scheduler — fires enabled simulator_schedules with
    // a cron expression every 30 seconds. Disabled via env var if needed.
    if std::env::var("MEDBRAINS_DISABLE_SIMULATOR_SCHEDULER").as_deref() == Ok("true") {
        tracing::warn!("MEDBRAINS_DISABLE_SIMULATOR_SCHEDULER=true — scheduler NOT spawned");
    } else {
        medbrains_server::services::simulator::scheduler::spawn(scheduler_state);
    }

    // Room-rent auto-billing — hourly idempotent pass posting one
    // bed charge per occupied admission per hospital-local day.
    medbrains_server::services::room_rent::spawn(worker_pool.clone());

    // Appointment reminders — 5-min pass enqueuing outbox SMS events
    // for appointments entering their reminder windows.
    medbrains_server::services::appointment_reminders::spawn(worker_pool.clone());

    // Critical-value escalation — unacknowledged lab alerts escalate
    // to the doctor's supervisor after the tenant's ack window.
    medbrains_server::services::critical_alert_escalation::spawn(worker_pool.clone());

    // Verbal/telephone order countersignature escalation — overdue orders
    // notify the prescriber + supervisor (NABH medication safety).
    medbrains_server::services::verbal_order_escalation::spawn(worker_pool.clone());

    // Retention enforcement — daily housekeeping purges + MRD
    // destruction-due flagging (MEDBRAINS_RETENTION_DRY_RUN=true to preview).
    medbrains_server::services::retention::spawn(db_pool.clone());

    // Start server
    let addr: SocketAddr = config.bind_addr().parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "listening");

    // Graceful shutdown: stop accepting new connections on SIGTERM/SIGINT
    // and let in-flight requests (and their transactions) finish instead
    // of aborting mid-write on every deploy restart.
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("shutdown complete — all in-flight requests drained");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install ctrl-c handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sigterm) => {
                sigterm.recv().await;
            }
            Err(error) => tracing::error!(%error, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => tracing::info!("SIGINT received — draining"),
        () = terminate => tracing::info!("SIGTERM received — draining"),
    }
}

/// Sprint A.8 — assemble the outbox Handler Registry.
///
/// Registers typed handlers for known `event_types` and a `pipeline_fallback`
/// that delegates to `events::dispatch_to_pipelines` for everything else.
fn build_outbox_registry() -> Arc<medbrains_outbox::Registry> {
    use medbrains_outbox::Registry;
    use medbrains_outbox::handlers::{
        abdm_stub, cashfree, email_stub, google_meet, hl7_stub, pinelabs, pipeline_fallback,
        razorpay, razorpayx, teams, tpa_stub, twilio, whatsapp, zoom,
    };

    let mut registry = Registry::new();

    // Typed real-money handlers (Phase 1.1: real HTTPS via reqwest)
    registry.register(razorpay::CreateOrderHandler::new());
    registry.register(razorpay::RefundHandler::new());
    // Cashfree — additive 2nd online provider (runs only for payment.cashfree.*)
    registry.register(cashfree::CashfreeCreateOrderHandler::new());
    registry.register(cashfree::CashfreeRefundHandler::new());
    // Pine Labs Plutus — POS card machine (push+poll, runs only for payment.pinelabs.*)
    registry.register(pinelabs::PineLabsPosSaleHandler::new());
    // RazorpayX Smart Collect — bank virtual account (runs only for payment.razorpayx.*)
    registry.register(razorpayx::VirtualAccountCreateHandler::new());
    // Telemedicine meeting create — one handler per API provider.
    registry.register(zoom::ZoomCreateMeetingHandler::new());
    registry.register(google_meet::GoogleMeetCreateHandler::new());
    registry.register(teams::TeamsCreateMeetingHandler::new());

    // Twilio per-event-type — distinct registrations for each sms.* code
    // so the registry's panic-on-duplicate catches accidental re-binds.
    registry.register(twilio::SmsSendHandler::new("sms.appointment_confirmation"));
    registry.register(twilio::SmsSendHandler::new("sms.appointment_reminder_24h"));
    registry.register(twilio::SmsSendHandler::new("sms.appointment_reminder_2h"));
    registry.register(twilio::SmsSendHandler::new("sms.discharge_summary"));
    registry.register(twilio::SmsSendHandler::new("sms.vaccination_reminder"));
    registry.register(twilio::SmsSendHandler::new("sms.cds_critical_interaction"));
    registry.register(twilio::SmsSendHandler::new("sms.payment_failed"));
    registry.register(twilio::SmsSendHandler::new("sms.password_reset_otp"));
    registry.register(twilio::SmsSendHandler::new("sms.public_booking_otp"));
    // SMS counterparts for WhatsApp fallback targets that had none.
    registry.register(twilio::SmsSendHandler::new("sms.lab_report_ready"));
    registry.register(twilio::SmsSendHandler::new("sms.payment_link"));

    // Email — real SendGrid HTTP API (falls back to stub if creds unset).
    registry.register(email_stub::SmtpSendHandler::new("email.discharge_summary"));
    registry.register(email_stub::SmtpSendHandler::new("email.mis_daily_export"));
    registry.register(email_stub::SmtpSendHandler::new(
        "email.appointment_confirmation",
    ));
    registry.register(email_stub::SmtpSendHandler::new("email.invoice_receipt"));
    registry.register(email_stub::SmtpSendHandler::new("email.lab_report"));
    registry.register(email_stub::SmtpSendHandler::new(
        "email.refund_notification",
    ));
    registry.register(email_stub::SmtpSendHandler::new("email.dunning_notice"));
    registry.register(email_stub::SmtpSendHandler::new("email.verify_email"));
    registry.register(email_stub::SmtpSendHandler::new("email.invite"));
    registry.register(email_stub::SmtpSendHandler::new("email.test"));

    // WhatsApp — Meta Cloud API (falls back to stub if creds unset).
    registry.register(whatsapp::WhatsAppSendHandler::new(
        "whatsapp.appointment_confirmation",
    ));
    registry.register(whatsapp::WhatsAppSendHandler::new(
        "whatsapp.appointment_reminder_24h",
    ));
    registry.register(whatsapp::WhatsAppSendHandler::new(
        "whatsapp.appointment_reminder_2h",
    ));
    registry.register(whatsapp::WhatsAppSendHandler::new(
        "whatsapp.discharge_summary",
    ));
    registry.register(whatsapp::WhatsAppSendHandler::new(
        "whatsapp.lab_report_ready",
    ));
    registry.register(whatsapp::WhatsAppSendHandler::new("whatsapp.payment_link"));
    registry.register(whatsapp::WhatsAppSendHandler::new(
        "whatsapp.vaccination_reminder",
    ));
    registry.register(abdm_stub::VerifyAbhaHandler);
    registry.register(abdm_stub::HieBundlePushHandler);
    registry.register(tpa_stub::PreauthSubmitHandler);
    registry.register(tpa_stub::ClaimSubmitHandler);
    registry.register(tpa_stub::CoverageEligibilityHandler);
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
/// Walks the `audit_log` hash chain for one or all tenants and writes a row
/// to `audit_chain_verifications` with the result. Exits non-zero if any
/// chain breaks — the K8s `CronJob` alerts on non-zero exit.
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

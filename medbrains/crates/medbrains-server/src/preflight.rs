//! Startup checks: the server inspects its own environment and database before
//! it serves anyone, and reports everything it finds at once — not the first
//! problem, then the next one after a redeploy.
//!
//! A `Fail` stops a production boot; development logs it and carries on. The
//! same checks run without starting the server as `medbrains-server preflight`
//! (exit 1 on a failure), so an install or deploy can check a host first. The
//! findings are kept for the infrastructure screen
//! (`medbrains_infra_settings::preflight`).

use argon2::{Argon2, PasswordHash, PasswordVerifier};
use medbrains_core::secrets::SecretResolver;
use medbrains_infra_settings::preflight::{Finding, Level};
use medbrains_server_core::config::AppConfig;
use sqlx::PgPool;

/// Keys whose development fallback is a value in the source.
const REQUIRED_KEYS: [&str; 2] = ["MEDBRAINS_IDENTIFIER_HMAC_KEY", "MEDBRAINS_ABDM_SECRET_KEY"];
const MIN_KEY_LEN: usize = 32;
/// PostgreSQL 16: declarative partitioning and the RLS features the schema uses.
const MIN_PG_VERSION: i32 = 160_000;
const DEFAULT_ADMIN_PASSWORD: &str = "admin123";

/// The databases the checks look at: the request pool (row level security
/// applies to it) and the owner, which can see every tenant.
pub struct Pools<'a> {
    pub request: &'a PgPool,
    pub owner: &'a PgPool,
}

/// Every check, environment first.
pub async fn run(config: &AppConfig, secrets: &dyn SecretResolver, pools: &Pools<'_>) -> Vec<Finding> {
    let production = config.environment == "production";
    let mut found = env_checks(config, production);
    for key in REQUIRED_KEYS {
        found.push(key_check(secrets, key, production).await);
    }
    found.push(pg_version(pools.owner, production).await);
    found.push(migrations(pools.owner).await);
    found.push(request_role(pools.request).await);
    found.push(note_types(pools.owner).await);
    found.push(default_admin(pools.owner).await);
    found
}

/// Production refuses to serve when any check failed.
#[must_use]
pub fn blocks_boot(config: &AppConfig, found: &[Finding]) -> bool {
    config.environment == "production" && found.iter().any(|f| f.level == Level::Fail)
}

/// One log line per finding; failures and warnings at their own level.
pub fn log(found: &[Finding]) {
    for f in found {
        match f.level {
            Level::Ok => tracing::info!(check = f.check, "{}", f.detail),
            Level::Warn => tracing::warn!(check = f.check, fix = f.fix, "{}", f.detail),
            Level::Fail => tracing::error!(check = f.check, fix = f.fix, "{}", f.detail),
        }
    }
}

/// The failures, as one message for the error a production boot exits with.
#[must_use]
pub fn failure_summary(found: &[Finding]) -> String {
    let lines: Vec<String> = found
        .iter()
        .filter(|f| f.level == Level::Fail)
        .map(|f| format!("  {}: {} — {}", f.check, f.detail, f.fix.unwrap_or("")))
        .collect();
    format!(
        "refusing to start: {} startup check(s) failed with MEDBRAINS_ENV=production\n{}",
        lines.len(),
        lines.join("\n")
    )
}

/// A production-only hazard: `Fail` in production, `Ok` elsewhere.
fn hazard(check: &'static str, bad: bool, production: bool, what: &str, fix: &'static str) -> Finding {
    match (bad, production) {
        (true, true) => Finding::fail(check, what.to_owned(), fix),
        (true, false) => Finding::ok(check, format!("{what} (allowed off production)")),
        (false, _) => Finding::ok(check, "ok"),
    }
}

fn env_checks(config: &AppConfig, production: bool) -> Vec<Finding> {
    let mode = if matches!(config.environment.as_str(), "development" | "production") {
        Finding::ok("env.mode", format!("MEDBRAINS_ENV={}", config.environment))
    } else {
        Finding::fail(
            "env.mode",
            format!("MEDBRAINS_ENV={} is not a known mode, so every production protection is off", config.environment),
            "Set MEDBRAINS_ENV to production or development",
        )
    };
    let pos_simulator = std::env::var(medbrains_payment_gateway::pos::simulator::ENV_FLAG)
        .is_ok_and(|v| v == "true");
    let cors = &config.cors_origin;
    let loose_cors = cors.contains('*') || cors.contains("localhost") || cors.contains("127.0.0.1");
    vec![
        mode,
        hazard(
            "env.message_simulator",
            medbrains_outbox::simulator::enabled(),
            production,
            "the message simulator is on: SMS, WhatsApp and email are stored, never sent",
            "Unset the message simulator flag",
        ),
        hazard(
            "env.card_simulator",
            pos_simulator,
            production,
            "the card machine simulator is on: it marks bills paid that no card paid",
            "Unset MEDBRAINS_POS_SIMULATOR",
        ),
        hazard(
            "env.secure_cookies",
            !config.secure_cookies,
            production,
            "SECURE_COOKIES is off: the session cookie would travel over plain HTTP",
            "Set SECURE_COOKIES=true",
        ),
        hazard(
            "env.cors_origin",
            loose_cors,
            production,
            &format!("CORS_ORIGIN={cors} lets a page outside the hospital call the API"),
            "Set CORS_ORIGIN to the hospital's https origin",
        ),
        static_dir(config),
    ]
}

fn static_dir(config: &AppConfig) -> Finding {
    match config.static_dir.as_deref() {
        None => Finding::ok("env.static_dir", "not set: the web app is served elsewhere"),
        Some(dir) if std::path::Path::new(dir).join("index.html").is_file() => {
            Finding::ok("env.static_dir", format!("{dir} has the web app"))
        }
        Some(dir) => Finding::warn(
            "env.static_dir",
            format!("{dir} has no index.html: the web app would load blank"),
            "Copy the built apps/web/dist into STATIC_DIR",
        ),
    }
}

async fn key_check(secrets: &dyn SecretResolver, key: &'static str, production: bool) -> Finding {
    let check = match key {
        "MEDBRAINS_IDENTIFIER_HMAC_KEY" => "secret.identifier_key",
        _ => "secret.abdm_key",
    };
    match secrets.get(key).await {
        Ok(v) if v.len() >= MIN_KEY_LEN => Finding::ok(check, format!("{key} is set")),
        Ok(_) => hazard(check, true, production, &format!("{key} is shorter than {MIN_KEY_LEN} characters, so the development key in the source is used"), "Set it: openssl rand -base64 48"),
        Err(e) => hazard(check, true, production, &format!("{key} could not be read ({e}), so the development key in the source is used"), "Set it: openssl rand -base64 48"),
    }
}

async fn pg_version(pool: &PgPool, production: bool) -> Finding {
    match sqlx::query_scalar::<_, String>("SHOW server_version_num").fetch_one(pool).await {
        Ok(v) => match v.parse::<i32>() {
            Ok(n) if n >= MIN_PG_VERSION => Finding::ok("db.version", format!("PostgreSQL {n}")),
            _ => hazard("db.version", true, production, &format!("PostgreSQL {v} is older than 16"), "Upgrade PostgreSQL to 16 or later"),
        },
        Err(e) => Finding::fail("db.version", format!("the database did not answer: {e}"), "Check DATABASE_URL and that PostgreSQL is running"),
    }
}

async fn migrations(pool: &PgPool) -> Finding {
    match medbrains_db_migrations::pending(pool).await {
        Ok(0) => Finding::ok("db.migrations", "every migration is applied"),
        Ok(n) => Finding::warn("db.migrations", format!("{n} migration(s) not applied yet"), "The server applies them at start on the owner connection (MIGRATION_DATABASE_URL)"),
        Err(e) => Finding::warn("db.migrations", format!("could not read the migration history: {e}"), "Check the owner connection"),
    }
}

async fn request_role(pool: &PgPool) -> Finding {
    let row = sqlx::query_as::<_, (String, bool, bool, bool)>(
        "SELECT current_user::text, r.rolsuper, r.rolbypassrls, \
                EXISTS (SELECT 1 FROM pg_tables t \
                        WHERE t.schemaname = 'public' AND t.tableowner = current_user) \
         FROM pg_roles r WHERE r.rolname = current_user",
    )
    .fetch_one(pool)
    .await;
    match row {
        Ok((role, su, bypass, owns)) if su || bypass || owns => Finding::warn(
            "db.request_role",
            format!("DATABASE_URL connects as {role}, which row level security does not apply to: tenant isolation rests on each query's own WHERE"),
            "Point DATABASE_URL at medbrains_app (docs/ops/DB-ROLES.md)",
        ),
        Ok((role, ..)) => Finding::ok("db.request_role", format!("{role} is subject to row level security")),
        Err(e) => Finding::warn("db.request_role", format!("could not check the request role: {e}"), "Check DATABASE_URL"),
    }
}

async fn note_types(pool: &PgPool) -> Finding {
    let missing = sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM tenants t WHERE t.deleted_at IS NULL AND t.is_active \
           AND NOT EXISTS (SELECT 1 FROM note_types n WHERE n.tenant_id = t.id AND n.deleted_at IS NULL)",
    )
    .fetch_one(pool)
    .await;
    match missing {
        Ok(0) => Finding::ok("tenants.note_types", "every hospital has clinical note types"),
        Ok(n) => Finding::warn("tenants.note_types", format!("{n} hospital(s) have no clinical note types: no clinician there can write a note"), "Run SELECT seed_default_note_types(id) FROM tenants on the owner connection"),
        Err(e) => Finding::warn("tenants.note_types", format!("could not count note types: {e}"), "Check the owner connection"),
    }
}

async fn default_admin(pool: &PgPool) -> Finding {
    // ponytail: Argon2 verify is ~50 ms; the administrators are a handful, capped at 20.
    let hashes = sqlx::query_as::<_, (String, String)>(
        "SELECT username, password_hash FROM users \
          WHERE deleted_at IS NULL AND is_active \
            AND password_hash IS NOT NULL \
            AND role::text IN ('super_admin', 'hospital_admin') LIMIT 20",
    )
    .fetch_all(pool)
    .await;
    let rows = match hashes {
        Ok(rows) => rows,
        Err(e) => return Finding::warn("auth.default_admin", format!("could not check administrator passwords: {e}"), "Check the owner connection"),
    };
    let weak: Vec<&str> = rows
        .iter()
        .filter(|(_, hash)| {
            PasswordHash::new(hash).is_ok_and(|h| {
                Argon2::default().verify_password(DEFAULT_ADMIN_PASSWORD.as_bytes(), &h).is_ok()
            })
        })
        .map(|(user, _)| user.as_str())
        .collect();
    if weak.is_empty() {
        Finding::ok("auth.default_admin", "no administrator uses the default password")
    } else {
        Finding::warn(
            "auth.default_admin",
            format!(
                "{} still {} in with the default password",
                weak.join(", "),
                if weak.len() == 1 { "signs" } else { "sign" }
            ),
            "Sign in as each one and change the password now",
        )
    }
}

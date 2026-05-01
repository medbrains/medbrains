//! `medbrains-archive` — one-shot storage tier sweeper for systemd
//! timers / cron / manual ops.
//!
//! Runs `sweep_all_tenants` once and exits. For long-lived
//! background sweeping, the main `medbrains-server` binary spawns
//! `spawn_archive_loop` instead.

use medbrains_core::object_store::{ColdLocalObjectStore, LocalFsObjectStore, ObjectStore};
use medbrains_server::storage_archive::{sweep_all_tenants, StoreSet};
use sqlx::postgres::PgPoolOptions;
use std::path::PathBuf;
use std::sync::Arc;

fn read_env(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_owned())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL is required"))?;
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&database_url)
        .await?;

    // Tier roots — operator overrides via env. Defaults match the
    // standalone deploy kit's directory layout.
    let hot_root = PathBuf::from(read_env(
        "MEDBRAINS_OBJECTS_HOT",
        "/var/lib/medbrains/objects",
    ));
    let cold_root = PathBuf::from(read_env(
        "MEDBRAINS_OBJECTS_COLD",
        "/var/lib/medbrains/cold",
    ));
    let archive_root = PathBuf::from(read_env(
        "MEDBRAINS_OBJECTS_ARCHIVE",
        "/var/lib/medbrains/archive",
    ));

    let stores = StoreSet {
        hot: Arc::new(LocalFsObjectStore::new(hot_root)) as Arc<dyn ObjectStore>,
        cold: Arc::new(ColdLocalObjectStore::new(cold_root)) as Arc<dyn ObjectStore>,
        archive: Arc::new(ColdLocalObjectStore::new(archive_root)) as Arc<dyn ObjectStore>,
    };

    let report = sweep_all_tenants(&pool, &stores).await?;
    tracing::info!(
        hot_to_cold = report.hot_to_cold,
        cold_to_archive = report.cold_to_archive,
        archive_to_deleted = report.archive_to_deleted,
        failures = report.failures,
        "sweep complete"
    );
    Ok(())
}

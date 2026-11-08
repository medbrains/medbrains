//! The paperless meter: how paperless a hospital is, measured, by department
//! and day (RFCs/modules/RFC-MODULE-paperless-meter.md).
//!
//! Three shares, each from counts the screen also shows:
//! - **digital**: clinical documents made in the system, over those plus
//!   paper case sheets scanned in;
//! - **signed**: of the documents made in the system, those signed digitally
//!   (the record still links a live primary signature, which an edit
//!   clears; a clinical note's own signature);
//! - **legally signed**: those carrying an IT Act s.3A/s.5 signature (DSC or
//!   Aadhaar eSign). No such provider exists yet, so it is 0% of a known
//!   count and the screen says why, rather than hiding it.
//!
//! The counts live in `paperless_daily` (migration 1424), rebuilt for a window
//! of days in one unit of work (`rebuild`): nightly at [`NIGHTLY_HOUR`]:00
//! hospital time for the last [`DAILY_DAYS`] days, and on demand. A document
//! signed within that week is counted on its own day; one signed later, or a
//! signature taken off by an edit later, changes its day only when someone
//! recounts further back. The rebuild deletes and rewrites the window, so it
//! is idempotent. A day never rebuilt is unknown, never 0%.

use std::collections::HashMap;
use std::hash::BuildHasher;

use axum::extract::{Query, State};
use axum::{Extension, Json};
use chrono::{Duration, NaiveDate};
use medbrains_core::permissions;
use medbrains_documents::signable::SIGNABLE;
use medbrains_kernel::{Actor, Tx, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

mod read;
mod rebuild;
mod route;
mod sources;
pub mod summary;

pub use read::{PaperlessReport, report};

/// Days the nightly pass rebuilds, ending today.
pub const DAILY_DAYS: i64 = 7;
/// Most days one rebuild may cover: a backfill of three months.
pub const MAX_REBUILD_DAYS: i64 = 90;
/// The hospital-local hour the nightly recount runs in: off-peak.
pub const NIGHTLY_HOUR: i32 = 2;
/// The audit action every rebuild writes.
const REBUILD_ACTION: &str = "analytics.paperless.rebuild";

/// What one rebuild counted.
#[derive(Debug, Serialize)]
pub struct Rebuilt {
    pub from: NaiveDate,
    pub to: NaiveDate,
    /// Rows written to `paperless_daily`.
    pub rows: u64,
    /// Sources not counted, each "label: why"; the screen lists them.
    pub skipped: Vec<String>,
}

/// The hospital's time zone and today's date on its clock.
async fn clock(tx: &mut Tx, tenant_id: Uuid) -> Result<(String, NaiveDate), AppError> {
    Ok(sqlx::query_as(
        "SELECT z, timezone(z, now())::date FROM ( \
           SELECT COALESCE(timezone, 'UTC') AS z FROM tenants WHERE id = $1) t",
    )
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?)
}

/// The columns the routing looks for on the signable tables, their parents
/// and the ER visit, read from the catalogue in one query.
async fn columns(tx: &mut Tx) -> Result<route::Columns, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT table_name::text, column_name::text FROM information_schema.columns \
          WHERE table_schema = 'public' AND table_name = ANY($1) AND column_name = ANY($2)",
    )
    .bind(route::tables_to_read(SIGNABLE))
    .bind(route::columns_to_read(SIGNABLE))
    .fetch_all(&mut **tx)
    .await?;
    let mut map = route::Columns::new();
    for (table, column) in rows {
        map.entry(table).or_default().insert(column);
    }
    Ok(map)
}

/// Rebuild the last `days` days (1..=[`MAX_REBUILD_DAYS`]) of `actor`'s
/// hospital in one audited unit of work.
pub async fn run_for(pool: &PgPool, actor: Actor, days: i64) -> Result<Rebuilt, AppError> {
    let days = days.clamp(1, MAX_REBUILD_DAYS);
    let mut tx = medbrains_kernel::begin(pool, actor).await?;
    let (_, today) = clock(&mut tx, actor.tenant_id).await?;
    let from = today - Duration::days(days - 1);
    let done = rebuild::rebuild(&mut tx, actor.tenant_id, from, today).await?;
    let detail = serde_json::json!({ "from": done.from, "to": done.to, "rows": done.rows });
    let run_by = (!actor.user_id.is_nil()).then_some(actor.user_id);
    medbrains_kernel::audit(
        &mut tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: actor.tenant_id,
            user_id: run_by,
            action: REBUILD_ACTION,
            entity_type: "paperless_daily",
            entity_id: None,
            old_values: None,
            new_values: Some(&detail),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(done)
}

/// Hospitals whose clock is in [`NIGHTLY_HOUR`] now, with their local date.
async fn due(pool: &PgPool) -> Result<Vec<(Uuid, NaiveDate)>, AppError> {
    Ok(sqlx::query_as(
        "SELECT id, timezone(COALESCE(timezone, 'UTC'), now())::date FROM tenants \
          WHERE is_active AND deleted_at IS NULL \
            AND extract(hour FROM timezone(COALESCE(timezone, 'UTC'), now()))::int = $1 \
          ORDER BY id LIMIT 10000",
    )
    .bind(NIGHTLY_HOUR)
    .fetch_all(pool)
    .await?)
}

/// The nightly pass, called every quarter hour.
///
/// Recounts each hospital in its [`NIGHTLY_HOUR`] not yet recounted on its
/// local date (`done`, kept by the caller), one unit of work each. A hospital
/// that fails is logged and the rest still run. Returns how many were
/// recounted.
pub async fn run_nightly<S: BuildHasher + Send>(
    pool: &PgPool,
    done: &mut HashMap<Uuid, NaiveDate, S>,
) -> Result<usize, AppError> {
    let mut counted = 0;
    for (tenant_id, local_date) in due(pool).await? {
        if done.get(&tenant_id) == Some(&local_date) {
            continue;
        }
        done.insert(tenant_id, local_date);
        match run_for(pool, Actor::system(tenant_id), DAILY_DAYS).await {
            Ok(_) => counted += 1,
            Err(error) => tracing::error!(%error, %tenant_id, "paperless meter rebuild failed"),
        }
    }
    Ok(counted)
}

/// Query of `GET /api/analytics/paperless`.
#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    /// Days ending `to` when `from` is absent; 30 by default.
    pub days: Option<i64>,
}

/// The meter for `q`'s days, for a caller holding the view permission.
///
/// # Errors
/// `Forbidden` without `analytics.paperless.view`; a database fault as
/// itself, never as an empty meter.
pub async fn view(
    pool: &PgPool,
    claims: &Claims,
    q: &ReportQuery,
) -> Result<PaperlessReport, AppError> {
    require_permission(claims, permissions::analytics::paperless::VIEW)?;
    report(pool, Actor::from_claims(claims), q).await
}

/// Recount the caller's hospital's last `days` days, for a caller holding the
/// refresh permission.
///
/// # Errors
/// `Forbidden` without `analytics.paperless.refresh`, before anything runs.
pub async fn refresh(
    pool: &PgPool,
    claims: &Claims,
    days: Option<i64>,
) -> Result<Rebuilt, AppError> {
    require_permission(claims, permissions::analytics::paperless::REFRESH)?;
    run_for(pool, Actor::from_claims(claims), days.unwrap_or(DAILY_DAYS)).await
}

/// `GET /api/analytics/paperless` — the meter for a range of days.
pub async fn get_paperless(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ReportQuery>,
) -> Result<Json<PaperlessReport>, AppError> {
    Ok(Json(view(&state.db, &claims, &q).await?))
}

/// Body of `POST /api/analytics/paperless/refresh`.
#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    /// Days to recount, ending today; [`DAILY_DAYS`] when absent.
    pub days: Option<i64>,
}

/// `POST /api/analytics/paperless/refresh` — recount recent days now.
pub async fn refresh_paperless(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<Rebuilt>, AppError> {
    Ok(Json(refresh(&state.db, &claims, body.days).await?))
}

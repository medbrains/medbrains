//! Physical marketing runs, and what came back from them.
//!
//! # The question
//!
//! "We gave ten thousand pamphlets in Gandhipuram. How many became patients?"
//!
//! It had no object to attach to. A touchpoint recorded where an enquiry came
//! *from*; nothing recorded what the hospital had *sent* — the quantity, the
//! date, the cost, or the expectation it was bought against. A pamphlet run
//! could be judged only by whether the month felt busier.
//!
//! # Attribution is a correlation, and the report says so
//!
//! A pamphlet carries no identifier and nobody hands one back at reception. An
//! enquiry is credited to a run when it arrives from that area, after that
//! run's date, inside its response window. That is a reasonable inference and
//! not a proof, so two things are surfaced rather than hidden:
//!
//! - **Overlapping runs are marked, not divided.** Two runs covering one area
//!   at once cannot be told apart, and splitting the enquiries between them by
//!   a rule nobody chose turns one honest ambiguity into two confident wrong
//!   numbers.
//! - **The area's baseline is shown beside the result.** Enquiries arrive from
//!   a locality with no run at all — word of mouth, the hospital being nearby
//!   — so a run's response rate is an upper bound, and a run that "produced"
//!   forty enquiries in an area that produces thirty anyway produced ten.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Areas ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Area {
    pub id: Uuid,
    pub name: String,
    pub latitude: Option<rust_decimal::Decimal>,
    pub longitude: Option<rust_decimal::Decimal>,
    pub pincode: Option<String>,
    pub population: Option<i32>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpsertAreaRequest {
    pub name: String,
    pub latitude: Option<rust_decimal::Decimal>,
    pub longitude: Option<rust_decimal::Decimal>,
    pub pincode: Option<String>,
    pub population: Option<i32>,
}

const AREA_COLUMNS: &str = "id, name, latitude, longitude, pincode, population, is_active";

/// `GET /api/marketing/areas`
///
/// # Errors
/// Returns 403 without `marketing.campaigns.view`.
pub async fn list_areas(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Area>>, AppError> {
    require_permission(&claims, permissions::marketing::campaigns::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Area>(&format!(
        "SELECT {AREA_COLUMNS} FROM mkt_areas WHERE tenant_id = $1 ORDER BY name"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/areas`
///
/// Defines a locality the hospital buys against. Upserts on the name, because
/// the same ward typed twice is one place and a duplicate would silently split
/// its results in half.
///
/// # Errors
/// Returns 403 without `marketing.campaigns.manage`, 400 on an empty name.
pub async fn upsert_area(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertAreaRequest>,
) -> Result<Json<Area>, AppError> {
    require_permission(&claims, permissions::marketing::campaigns::MANAGE)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("a locality needs a name".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Area>(&format!(
        "INSERT INTO mkt_areas (tenant_id, name, latitude, longitude, pincode, population) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (tenant_id, lower(name)) DO UPDATE SET \
             latitude   = COALESCE(EXCLUDED.latitude, mkt_areas.latitude), \
             longitude  = COALESCE(EXCLUDED.longitude, mkt_areas.longitude), \
             pincode    = COALESCE(EXCLUDED.pincode, mkt_areas.pincode), \
             population = COALESCE(EXCLUDED.population, mkt_areas.population) \
         RETURNING {AREA_COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(name)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.pincode.as_deref().map(str::trim))
    .bind(body.population)
    .fetch_one(&mut *tx)
    .await?;

    // Adopt any touchpoint that already named this locality in free text, so
    // history joins to the master rather than starting from today.
    sqlx::query(
        "UPDATE mkt_touchpoints SET area_id = $1 \
         WHERE tenant_id = $2 AND area_id IS NULL AND lower(area_label) = lower($3)",
    )
    .bind(row.id)
    .bind(claims.tenant_id)
    .bind(name)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Runs ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateDistributionRequest {
    pub campaign_id: Option<Uuid>,
    pub area_id: Uuid,
    pub channel: String,
    pub quantity: i32,
    pub distributed_on: chrono::NaiveDate,
    pub cost_minor: Option<i64>,
    pub response_window_days: Option<i32>,
    pub expected_enquiries: Option<i32>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DistributionResult {
    pub id: Uuid,
    pub area_id: Uuid,
    pub area_name: String,
    pub latitude: Option<rust_decimal::Decimal>,
    pub longitude: Option<rust_decimal::Decimal>,
    pub campaign_name: Option<String>,
    pub channel: String,
    pub quantity: i32,
    pub distributed_on: chrono::NaiveDate,
    pub cost_minor: i64,
    pub response_window_days: i32,
    pub expected_enquiries: Option<i32>,
    /// Enquiries from this area inside the window.
    pub enquiries: i64,
    /// Of those, the ones that became registered patients.
    pub converted: i64,
    /// Enquiries from the same area in the equivalent stretch of time BEFORE
    /// the run. What the locality produces anyway — so the run's contribution
    /// is the difference, not the total.
    pub baseline_enquiries: i64,
    /// Another run covered this area inside this one's window, so the two
    /// cannot be told apart. Reported rather than resolved.
    pub overlapping_runs: i64,
}

/// `POST /api/marketing/distributions`
///
/// # Errors
/// Returns 403 without `marketing.campaigns.manage`, 400 on a bad quantity,
/// 404 if the area is not in this tenant.
pub async fn create_distribution(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDistributionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::marketing::campaigns::MANAGE)?;

    if body.quantity <= 0 {
        return Err(AppError::BadRequest(
            "a run needs a quantity — one hoarding is 1".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let area: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mkt_areas WHERE id = $1 AND tenant_id = $2")
            .bind(body.area_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if area.is_none() {
        return Err(AppError::NotFound);
    }

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_distributions \
            (tenant_id, campaign_id, area_id, channel, quantity, distributed_on, \
             cost_minor, response_window_days, expected_enquiries, note, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0), COALESCE($8, 90), $9, $10, $11) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.campaign_id)
    .bind(body.area_id)
    .bind(body.channel.trim())
    .bind(body.quantity)
    .bind(body.distributed_on)
    .bind(body.cost_minor)
    .bind(body.response_window_days)
    .bind(body.expected_enquiries)
    .bind(body.note.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

#[derive(Debug, Deserialize)]
pub struct DistributionQuery {
    pub campaign_id: Option<Uuid>,
}

/// `GET /api/marketing/distributions`
///
/// Every run, with what came back from it.
///
/// One query. The per-run counts are lateral subqueries rather than a join
/// over touchpoints, because each run has its own window — a single join
/// cannot express "within 90 days of this row's date" for every row at once
/// without producing a cross product first and filtering after.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn list_distributions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DistributionQuery>,
) -> Result<Json<Vec<DistributionResult>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DistributionResult>(
        "SELECT d.id, d.area_id, a.name AS area_name, a.latitude, a.longitude, \
                cam.name AS campaign_name, d.channel, d.quantity, d.distributed_on, \
                d.cost_minor, d.response_window_days, d.expected_enquiries, \
                COALESCE(r.enquiries, 0)::bigint AS enquiries, \
                COALESCE(r.converted, 0)::bigint AS converted, \
                COALESCE(b.enquiries, 0)::bigint AS baseline_enquiries, \
                COALESCE(o.n, 0)::bigint AS overlapping_runs \
         FROM mkt_distributions d \
         JOIN mkt_areas a ON a.id = d.area_id AND a.tenant_id = d.tenant_id \
         LEFT JOIN mkt_campaigns cam \
                ON cam.id = d.campaign_id AND cam.tenant_id = d.tenant_id \
         LEFT JOIN LATERAL ( \
             SELECT count(DISTINCT t.contact_id) AS enquiries, \
                    count(DISTINCT t.contact_id) \
                        FILTER (WHERE c.patient_id IS NOT NULL) AS converted \
             FROM mkt_touchpoints t \
             JOIN mkt_contacts c ON c.id = t.contact_id AND c.tenant_id = t.tenant_id \
             WHERE t.tenant_id = d.tenant_id AND t.area_id = d.area_id \
               AND t.occurred_at >= d.distributed_on \
               AND t.occurred_at < d.distributed_on \
                                 + make_interval(days => d.response_window_days) \
         ) r ON true \
         LEFT JOIN LATERAL ( \
             SELECT count(DISTINCT t.contact_id) AS enquiries \
             FROM mkt_touchpoints t \
             WHERE t.tenant_id = d.tenant_id AND t.area_id = d.area_id \
               AND t.occurred_at < d.distributed_on \
               AND t.occurred_at >= d.distributed_on \
                                  - make_interval(days => d.response_window_days) \
         ) b ON true \
         LEFT JOIN LATERAL ( \
             SELECT count(*) AS n FROM mkt_distributions d2 \
             WHERE d2.tenant_id = d.tenant_id AND d2.area_id = d.area_id \
               AND d2.id <> d.id \
               AND d2.distributed_on < d.distributed_on \
                                       + make_interval(days => d.response_window_days) \
               AND d2.distributed_on \
                   + make_interval(days => d2.response_window_days) > d.distributed_on \
         ) o ON true \
         WHERE d.tenant_id = $1 \
           AND ($2::uuid IS NULL OR d.campaign_id = $2) \
         ORDER BY d.distributed_on DESC \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.campaign_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

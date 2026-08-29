//! Campaigns and the attribution half of the funnel.
//!
//! A hospital already knows what it spent on Google and Meta. What it cannot
//! see is which of that spend produced a consultation, because the enquiry and
//! the outcome live in different systems. A campaign row is the join: spend on
//! one side, the contacts that carry `campaign_id` on the other.
//!
//! The report below deliberately reports **revenue per enquiry**, not cost per
//! lead. Cost per lead rewards the campaign that produces the most phone
//! calls, which is how a hospital ends up paying for volume it cannot answer.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Campaign {
    pub id: Uuid,
    pub name: String,
    pub channel: String,
    pub source: String,
    pub external_ref: Option<String>,
    pub spend_minor: i64,
    pub currency: String,
    pub started_on: Option<chrono::NaiveDate>,
    pub ended_on: Option<chrono::NaiveDate>,
    pub is_active: bool,
    /// The localities this spend is aimed at.
    ///
    /// Without it the area report's spend column reads zero for every
    /// locality, because nothing ever said which areas a campaign was buying.
    pub target_areas: Vec<String>,
    /// What the campaign physically was. `channel` is coarse — 'print' does
    /// not distinguish ten thousand pamphlets in one ward from a full-page
    /// insert in a daily.
    pub medium: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertCampaignRequest {
    pub name: String,
    pub channel: String,
    pub source: String,
    pub external_ref: Option<String>,
    /// Minor units — paise, not rupees. Money in a float is how a reconciliation
    /// report stops reconciling.
    pub spend_minor: Option<i64>,
    pub started_on: Option<chrono::NaiveDate>,
    pub ended_on: Option<chrono::NaiveDate>,
    /// Locality names. Matched against `mkt_areas.name` by the area report,
    /// and free text so a campaign can name a ward before somebody defines it.
    pub target_areas: Option<Vec<String>>,
    pub medium: Option<String>,
}

/// One row of the funnel, per campaign.
///
/// `won` counts contacts sitting on a stage flagged `is_won`, which is how the
/// pipeline stays configurable: a clinic that renames "Procedure" does not
/// break its own attribution.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampaignFunnelRow {
    pub campaign_id: Uuid,
    pub campaign_name: String,
    pub source: String,
    pub spend_minor: i64,
    pub enquiries: i64,
    pub contacted: i64,
    pub won: i64,
}

/// `GET /api/marketing/campaigns`
///
/// # Errors
/// Returns 403 without `marketing.campaigns.view`.
pub async fn list_campaigns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Campaign>>, AppError> {
    require_permission(&claims, permissions::marketing::campaigns::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Campaign>(
        "SELECT id, name, channel, source, external_ref, spend_minor, currency, target_areas, medium, \
                started_on, ended_on, is_active \
         FROM mkt_campaigns WHERE tenant_id = $1 \
         ORDER BY is_active DESC, started_on DESC NULLS LAST, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/campaigns`
///
/// # Errors
/// Returns 403 without `marketing.campaigns.manage`, 400 on an empty name.
pub async fn create_campaign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertCampaignRequest>,
) -> Result<Json<Campaign>, AppError> {
    require_permission(&claims, permissions::marketing::campaigns::MANAGE)?;

    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("campaign name is required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Campaign>(
        "INSERT INTO mkt_campaigns \
            (tenant_id, name, channel, source, external_ref, spend_minor, \
             started_on, ended_on, created_by, target_areas, medium) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), $7, $8, $9, \
                 COALESCE($10, '{}'), $11) \
         RETURNING id, name, channel, source, external_ref, spend_minor, currency, target_areas, medium, \
                   started_on, ended_on, is_active",
    )
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.channel)
    .bind(&body.source)
    .bind(body.external_ref.as_deref())
    .bind(body.spend_minor)
    .bind(body.started_on)
    .bind(body.ended_on)
    .bind(claims.sub)
    .bind(body.target_areas.as_deref())
    .bind(body.medium.as_deref().map(str::trim))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/marketing/campaigns/{id}`
///
/// # Errors
/// Returns 403 without `marketing.campaigns.manage`, 404 if the campaign is
/// not in this tenant.
pub async fn update_campaign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertCampaignRequest>,
) -> Result<Json<Campaign>, AppError> {
    require_permission(&claims, permissions::marketing::campaigns::MANAGE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Campaign>(
        "UPDATE mkt_campaigns SET \
            name = $3, channel = $4, source = $5, external_ref = $6, \
            spend_minor = COALESCE($7, spend_minor), \
            started_on = $8, ended_on = $9, \
            target_areas = COALESCE($10, target_areas), \
            medium = $11, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, name, channel, source, external_ref, spend_minor, currency, target_areas, medium, \
                   started_on, ended_on, is_active",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(&body.channel)
    .bind(&body.source)
    .bind(body.external_ref.as_deref())
    .bind(body.spend_minor)
    .bind(body.started_on)
    .bind(body.ended_on)
    .bind(body.target_areas.as_deref())
    .bind(body.medium.as_deref().map(str::trim))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/marketing/reports/campaign-funnel`
///
/// Enquiries, contacted and won per campaign, in one statement. The counts are
/// LEFT-joined so a campaign that produced nothing still appears — a campaign
/// missing from the report reads as an unmeasured campaign, and the whole
/// point is to be able to stop paying for the ones that do not convert.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn campaign_funnel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CampaignFunnelRow>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;
    // Aggregate. No patient name is selected and none can be — this counts
    // enquiries, and an enquiry is not a chart.

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampaignFunnelRow>(
        "SELECT cam.id AS campaign_id, cam.name AS campaign_name, cam.source, \
                cam.spend_minor, \
                count(c.id)::bigint AS enquiries, \
                count(c.id) FILTER (WHERE c.last_contacted_at IS NOT NULL)::bigint \
                  AS contacted, \
                count(c.id) FILTER (WHERE st.is_won)::bigint AS won \
         FROM mkt_campaigns cam \
         LEFT JOIN mkt_contacts c \
                ON c.campaign_id = cam.id AND c.tenant_id = cam.tenant_id \
         LEFT JOIN mkt_pipeline_stages st \
                ON st.id = c.stage_id AND st.tenant_id = c.tenant_id \
         WHERE cam.tenant_id = $1 \
         GROUP BY cam.id, cam.name, cam.source, cam.spend_minor \
         ORDER BY won DESC, enquiries DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

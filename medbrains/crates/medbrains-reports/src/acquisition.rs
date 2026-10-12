//! Where patients come from, and what each source brings.
//!
//! A patient's campaign is `patient_acquisition` (set at registration, by a
//! campaign link, by an enquiry's conversion, or corrected later); their
//! source is `patients.registration_source`. These reports count the
//! patients registered in the range and follow them: visits, admissions,
//! what was billed and collected, against what the campaign cost.

use axum::Json;
use chrono::{Duration, Utc};
use medbrains_core::analytics::DateRangeQuery;
use medbrains_core::permissions;
use medbrains_core::reports::{
    ReportDataResponse, ReportExportMode, ReportPriority, ReportReadiness,
};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_any_permission,
    state::AppState,
};
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::reports::{
    ReportDataKind, ReportFamilySeed, STANDARD_EXPORTS, family, live_response, report,
};

/// Days a report covers when no range is given: a quarter, since a campaign
/// runs for weeks and its patients keep coming back after it ends.
const DEFAULT_DAYS: i64 = 90;

/// The Reports section's "Patient acquisition" family.
pub(crate) fn family_seed() -> ReportFamilySeed {
    let readers = &[
        permissions::marketing::campaigns::VIEW,
        permissions::analytics::VIEW,
    ];
    family(
        "acquisition",
        "Patient Acquisition",
        "Growth",
        "Where new patients come from — campaigns, camps, referrals and walk-ins — and what they bring.",
        vec![
            report(
                "campaign-attribution",
                "Campaign attribution",
                "Patients each campaign brought, their visits and admissions, billed and collected, against spend.",
                &[
                    "patient_acquisition",
                    "mkt_campaigns",
                    "encounters",
                    "admissions",
                    "invoices",
                ],
                readers,
                ReportPriority::P1,
                ReportReadiness::LiveApi,
                &["bar", "table"],
                "comparison",
                "Daily",
                STANDARD_EXPORTS,
                ReportExportMode::Standard,
                &["campaign", "channel"],
                ReportDataKind::CampaignAttribution,
            ),
            report(
                "patient-intake-by-source",
                "Patient intake by source",
                "New patients each month by how they came — campaign, camp, referral, online, phone, walk-in — with what they were billed.",
                &["patients", "patient_acquisition", "invoices"],
                readers,
                ReportPriority::P1,
                ReportReadiness::LiveApi,
                &["stacked bar", "table"],
                "trend",
                "Daily",
                STANDARD_EXPORTS,
                ReportExportMode::Standard,
                &["source", "month"],
                ReportDataKind::IntakeBySource,
            ),
            report(
                "campaign-by-department",
                "Campaigns by department",
                "Which departments each campaign's patients were seen in.",
                &[
                    "patient_acquisition",
                    "mkt_campaigns",
                    "encounters",
                    "departments",
                ],
                readers,
                ReportPriority::P2,
                ReportReadiness::LiveApi,
                &["bar", "table"],
                "comparison",
                "Daily",
                STANDARD_EXPORTS,
                ReportExportMode::Standard,
                &["campaign", "department"],
                ReportDataKind::CampaignByDepartment,
            ),
        ],
    )
}

/// The range a report covers, defaulting to the last quarter.
fn range_of(range: &DateRangeQuery) -> (String, String) {
    let today = Utc::now().date_naive();
    let to = range.to.clone().unwrap_or_else(|| today.to_string());
    let from = range
        .from
        .clone()
        .unwrap_or_else(|| (today - Duration::days(DEFAULT_DAYS)).to_string());
    (from, to)
}

/// One of this family's reports, as the Reports section reads it.
pub(crate) async fn data(
    state: &AppState,
    claims: &Claims,
    report_id: &str,
    kind: ReportDataKind,
    range: &DateRangeQuery,
) -> Result<Json<ReportDataResponse>, AppError> {
    require_reader(claims)?;
    let (from, to) = range_of(range);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let response = match kind {
        ReportDataKind::CampaignAttribution => live_response(
            report_id,
            "acquisition.campaigns",
            campaign_attribution(&mut tx, claims.tenant_id, &from, &to).await?,
        ),
        ReportDataKind::IntakeBySource => live_response(
            report_id,
            "acquisition.sources",
            intake_by_source(&mut tx, claims.tenant_id, &from, &to).await?,
        ),
        _ => live_response(
            report_id,
            "acquisition.departments",
            campaign_by_department(&mut tx, claims.tenant_id, &from, &to).await?,
        ),
    };
    tx.commit().await?;
    response
}

/// Bills that count: not cancelled, voided or refunded.
const LIVE_BILL: &str =
    "i.deleted_at IS NULL AND i.status::text NOT IN ('cancelled', 'void', 'refunded')";

/// Who may read acquisition: marketing, and management reading the hospital.
pub fn require_reader(claims: &Claims) -> Result<(), AppError> {
    require_any_permission(
        claims,
        &[
            permissions::marketing::campaigns::VIEW,
            permissions::analytics::VIEW,
        ],
    )
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampaignAttributionRow {
    pub campaign: String,
    pub channel: String,
    pub new_patients: i64,
    /// Of them, how many have been seen in OPD.
    pub patients_seen: i64,
    pub opd_visits: i64,
    pub admissions: i64,
    pub billed: f64,
    pub collected: f64,
    pub spend: f64,
    /// Spend per new patient; null with no patients.
    #[sqlx(skip)]
    pub cost_per_patient: Option<f64>,
    /// Collected per rupee spent; null with no spend.
    #[sqlx(skip)]
    pub return_on_spend: Option<f64>,
}

/// Per campaign: the patients it brought in the range, and what followed.
pub async fn campaign_attribution(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    from: &str,
    to: &str,
) -> Result<Vec<CampaignAttributionRow>, AppError> {
    let sql = format!(
        "WITH acquired AS ( \
           SELECT p.id AS patient_id, pa.campaign_id \
             FROM patients p \
             JOIN patient_acquisition pa ON pa.patient_id = p.id AND pa.deleted_at IS NULL \
            WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND pa.campaign_id IS NOT NULL \
              AND p.created_at::date BETWEEN $2::date AND $3::date), \
         visits AS ( \
           SELECT a.campaign_id, COUNT(e.id) AS opd_visits, \
                  COUNT(DISTINCT e.patient_id) AS patients_seen \
             FROM acquired a \
             JOIN encounters e ON e.patient_id = a.patient_id AND e.tenant_id = $1 \
              AND e.deleted_at IS NULL AND e.encounter_type = 'opd' \
            GROUP BY a.campaign_id), \
         stays AS ( \
           SELECT a.campaign_id, COUNT(ad.id) AS admissions \
             FROM acquired a \
             JOIN admissions ad ON ad.patient_id = a.patient_id AND ad.tenant_id = $1 \
              AND ad.deleted_at IS NULL \
            GROUP BY a.campaign_id), \
         money AS ( \
           SELECT a.campaign_id, SUM(i.total_amount) AS billed, SUM(i.paid_amount) AS collected \
             FROM acquired a \
             JOIN invoices i ON i.patient_id = a.patient_id AND i.tenant_id = $1 AND {LIVE_BILL} \
            GROUP BY a.campaign_id) \
         SELECT c.name AS campaign, c.channel, COUNT(a.patient_id)::bigint AS new_patients, \
                COALESCE(MAX(v.patients_seen), 0)::bigint AS patients_seen, \
                COALESCE(MAX(v.opd_visits), 0)::bigint AS opd_visits, \
                COALESCE(MAX(s.admissions), 0)::bigint AS admissions, \
                COALESCE(MAX(m.billed), 0)::float8 AS billed, \
                COALESCE(MAX(m.collected), 0)::float8 AS collected, \
                (c.spend_minor / 100.0)::float8 AS spend \
           FROM mkt_campaigns c \
           LEFT JOIN acquired a ON a.campaign_id = c.id \
           LEFT JOIN visits v ON v.campaign_id = c.id \
           LEFT JOIN stays s ON s.campaign_id = c.id \
           LEFT JOIN money m ON m.campaign_id = c.id \
          WHERE c.tenant_id = $1 \
          GROUP BY c.id, c.name, c.channel, c.spend_minor, c.is_active \
         HAVING COUNT(a.patient_id) > 0 OR c.is_active \
          ORDER BY new_patients DESC, c.name LIMIT 200"
    );
    let mut rows = sqlx::query_as::<_, CampaignAttributionRow>(&sql)
        .bind(tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut **tx)
        .await?;
    for row in &mut rows {
        row.cost_per_patient = per(row.spend, row.new_patients);
        row.return_on_spend = (row.spend > 0.0).then(|| row.collected / row.spend);
    }
    Ok(rows)
}

/// Spend divided over patients, rounded to the rupee; none with no patients.
fn per(spend: f64, patients: i64) -> Option<f64> {
    #[allow(clippy::cast_precision_loss)]
    let n = patients as f64;
    (patients > 0).then(|| (spend / n).round())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct IntakeBySourceRow {
    /// The month, as its first day (YYYY-MM-DD), so the chart reads a trend.
    pub month: String,
    pub source: String,
    pub patients: i64,
    pub revenue: f64,
}

/// New patients per month by how they came, with what they were billed —
/// drawn as stacked bars.
pub async fn intake_by_source(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    from: &str,
    to: &str,
) -> Result<Vec<IntakeBySourceRow>, AppError> {
    let sql = format!(
        "SELECT date_trunc('month', p.created_at)::date::text AS month, \
                CASE WHEN pa.campaign_id IS NOT NULL THEN 'Campaign' \
                     WHEN p.registration_source::text = 'camp' THEN 'Camp' \
                     WHEN p.registration_source::text = 'referral' THEN 'Referral' \
                     WHEN p.registration_source::text IN ('online_portal', 'mobile_app', 'telemedicine') \
                       THEN 'Online' \
                     WHEN p.registration_source::text = 'phone' THEN 'Phone' \
                     WHEN p.registration_source::text IN ('walk_in', 'kiosk') THEN 'Walk-in' \
                     WHEN p.registration_source::text = 'ambulance' THEN 'Emergency' \
                     ELSE 'Not recorded' END AS source, \
                COUNT(*)::bigint AS patients, \
                COALESCE(SUM(b.billed), 0)::float8 AS revenue \
           FROM patients p \
           LEFT JOIN patient_acquisition pa ON pa.patient_id = p.id AND pa.deleted_at IS NULL \
           LEFT JOIN LATERAL ( \
             SELECT SUM(i.total_amount) AS billed FROM invoices i \
              WHERE i.patient_id = p.id AND i.tenant_id = $1 AND {LIVE_BILL}) b ON true \
          WHERE p.tenant_id = $1 AND p.deleted_at IS NULL \
            AND p.created_at::date BETWEEN $2::date AND $3::date \
          GROUP BY 1, 2 ORDER BY 1, 2 LIMIT 500"
    );
    Ok(sqlx::query_as::<_, IntakeBySourceRow>(&sql)
        .bind(tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut **tx)
        .await?)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampaignDepartmentRow {
    pub campaign: String,
    pub department: String,
    pub patients: i64,
    pub visits: i64,
}

/// Where each campaign's patients were seen.
pub async fn campaign_by_department(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    from: &str,
    to: &str,
) -> Result<Vec<CampaignDepartmentRow>, AppError> {
    Ok(sqlx::query_as::<_, CampaignDepartmentRow>(
        "SELECT c.name AS campaign, COALESCE(d.name, 'Unassigned') AS department, \
                COUNT(DISTINCT e.patient_id)::bigint AS patients, COUNT(e.id)::bigint AS visits \
           FROM patients p \
           JOIN patient_acquisition pa ON pa.patient_id = p.id AND pa.deleted_at IS NULL \
           JOIN mkt_campaigns c ON c.id = pa.campaign_id AND c.tenant_id = p.tenant_id \
           JOIN encounters e ON e.patient_id = p.id AND e.tenant_id = p.tenant_id \
            AND e.deleted_at IS NULL \
           LEFT JOIN departments d ON d.id = e.department_id \
          WHERE p.tenant_id = $1 AND p.deleted_at IS NULL \
            AND p.created_at::date BETWEEN $2::date AND $3::date \
          GROUP BY c.name, d.name ORDER BY patients DESC LIMIT 500",
    )
    .bind(tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut **tx)
    .await?)
}

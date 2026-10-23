//! ABDM management dashboard: how far ABDM has reached the hospital in a
//! month, and the six months up to it. DHIS comes from `dhis`, HFR from
//! `hfr`, HPR from `hpr` and failed links from `hip::records`, so each figure
//! has one definition wherever it is shown.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{Months, NaiveDate};
use medbrains_core::permissions;
use serde::Serialize;
use uuid::Uuid;

use super::{
    abha::abdm_configured,
    dhis::{self, DhisEstimate, DhisMonth},
    hfr::{self, FacilityHfr},
    hip::records::{AbdmSharingFailure, SummaryQuery, month_start, open_failures},
    hpr,
};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// The trend covers the chosen month and the five before it.
const TREND_MONTHS: u32 = 6;

/// One month's ABDM activity, by IST month.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AbdmActivity {
    pub month: NaiveDate,
    pub opd_visits: i64,
    /// Visits by a patient whose ABHA was verified on or before the visit day.
    pub opd_with_abha: i64,
    /// Distinct patients seen with a verified ABHA, and those KYC-verified.
    pub abha_patients: i64,
    pub kyc_patients: i64,
    pub abhas_created: i64,
    pub shares: i64,
    /// Shares the desk turned into a linked or registered patient.
    pub shares_completed: i64,
    /// Shares nobody acted on before the token expired.
    pub shares_expired: i64,
    pub hip_consents_granted: i64,
    pub hip_consents_denied: i64,
    pub hip_consents_revoked: i64,
    pub hiu_consents_granted: i64,
    pub hiu_consents_denied: i64,
    pub hiu_consents_revoked: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AbdmDashboardMonth {
    #[serde(flatten)]
    pub activity: AbdmActivity,
    pub dhis: DhisMonth,
    pub estimate: DhisEstimate,
}

#[derive(Debug, Serialize)]
pub struct AbdmHprCoverage {
    pub active_doctors: i64,
    pub with_hpr_id: i64,
    pub verified: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AbdmFailureReason {
    pub reason: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct AbdmDashboard {
    pub month: NaiveDate,
    pub configured: bool,
    /// The chosen month: the last entry of `trend`.
    pub current: AbdmDashboardMonth,
    /// Oldest first, ending with the chosen month.
    pub trend: Vec<AbdmDashboardMonth>,
    pub hpr: AbdmHprCoverage,
    pub facilities: Vec<FacilityHfr>,
    /// Open failures (not the month's): a failure stays until it is retried.
    pub failures_open: i64,
    pub failure_reasons: Vec<AbdmFailureReason>,
    pub failures: Vec<AbdmSharingFailure>,
}

const ACTIVITY_SQL: &str = "WITH months AS ( \
       SELECT generate_series($2::date, $3::date, interval '1 month')::date AS month), \
     visits AS ( \
       SELECT date_trunc('month', e.encounter_date)::date AS month, e.patient_id, \
              l.id IS NOT NULL AS has_abha, coalesce(l.kyc_verified, false) AS kyc \
         FROM encounters e \
         LEFT JOIN patient_abha_links l ON l.tenant_id = e.tenant_id AND l.patient_id = e.patient_id \
              AND l.deleted_at IS NULL AND l.verified_at IS NOT NULL \
              AND timezone('Asia/Kolkata', l.verified_at)::date <= e.encounter_date \
        WHERE e.tenant_id = $1 AND e.encounter_type = 'opd' AND e.deleted_at IS NULL \
          AND e.encounter_date >= $2 AND e.encounter_date < ($3::date + interval '1 month')), \
     opd AS ( \
       SELECT month, count(*) AS opd_visits, count(*) FILTER (WHERE has_abha) AS opd_with_abha, \
              count(DISTINCT patient_id) FILTER (WHERE has_abha) AS abha_patients, \
              count(DISTINCT patient_id) FILTER (WHERE kyc) AS kyc_patients \
         FROM visits GROUP BY month), \
     created AS ( \
       SELECT date_trunc('month', timezone('Asia/Kolkata', verified_at))::date AS month, \
              count(*) AS abhas_created \
         FROM abha_verifications \
        WHERE tenant_id = $1 AND created_here AND stage = 'verified' AND deleted_at IS NULL \
          AND date_trunc('month', timezone('Asia/Kolkata', verified_at))::date BETWEEN $2 AND $3 \
        GROUP BY 1), \
     shares AS ( \
       SELECT date_trunc('month', timezone('Asia/Kolkata', created_at))::date AS month, \
              count(*) AS shares, \
              count(*) FILTER (WHERE status IN ('linked', 'registered')) AS shares_completed, \
              count(*) FILTER (WHERE status = 'expired' \
                                  OR (status = 'waiting' AND expires_at < now())) AS shares_expired \
         FROM abdm_profile_shares \
        WHERE tenant_id = $1 AND deleted_at IS NULL \
          AND date_trunc('month', timezone('Asia/Kolkata', created_at))::date BETWEEN $2 AND $3 \
        GROUP BY 1), \
     hip AS ( \
       SELECT date_trunc('month', timezone('Asia/Kolkata', notified_at))::date AS month, \
              count(*) FILTER (WHERE status = 'GRANTED') AS granted, \
              count(*) FILTER (WHERE status = 'DENIED') AS denied, \
              count(*) FILTER (WHERE status = 'REVOKED') AS revoked \
         FROM abdm_consent_artefacts \
        WHERE tenant_id = $1 AND role = 'hip' \
          AND (deleted_at IS NULL OR delete_reason = $4) \
          AND date_trunc('month', timezone('Asia/Kolkata', notified_at))::date BETWEEN $2 AND $3 \
        GROUP BY 1), \
     hiu AS ( \
       SELECT date_trunc('month', timezone('Asia/Kolkata', requested_at))::date AS month, \
              count(*) FILTER (WHERE status = 'granted') AS granted, \
              count(*) FILTER (WHERE status = 'denied') AS denied, \
              count(*) FILTER (WHERE status = 'revoked') AS revoked \
         FROM abdm_consent_requests \
        WHERE tenant_id = $1 AND deleted_at IS NULL \
          AND date_trunc('month', timezone('Asia/Kolkata', requested_at))::date BETWEEN $2 AND $3 \
        GROUP BY 1) \
     SELECT m.month, \
            coalesce(o.opd_visits, 0) AS opd_visits, coalesce(o.opd_with_abha, 0) AS opd_with_abha, \
            coalesce(o.abha_patients, 0) AS abha_patients, coalesce(o.kyc_patients, 0) AS kyc_patients, \
            coalesce(c.abhas_created, 0) AS abhas_created, \
            coalesce(s.shares, 0) AS shares, coalesce(s.shares_completed, 0) AS shares_completed, \
            coalesce(s.shares_expired, 0) AS shares_expired, \
            coalesce(hp.granted, 0) AS hip_consents_granted, \
            coalesce(hp.denied, 0) AS hip_consents_denied, \
            coalesce(hp.revoked, 0) AS hip_consents_revoked, \
            coalesce(hu.granted, 0) AS hiu_consents_granted, \
            coalesce(hu.denied, 0) AS hiu_consents_denied, \
            coalesce(hu.revoked, 0) AS hiu_consents_revoked \
       FROM months m \
       LEFT JOIN opd o ON o.month = m.month \
       LEFT JOIN created c ON c.month = m.month \
       LEFT JOIN shares s ON s.month = m.month \
       LEFT JOIN hip hp ON hp.month = m.month \
       LEFT JOIN hiu hu ON hu.month = m.month \
      ORDER BY m.month";

/// Open failures by reason, most common first.
const REASONS_SQL: &str = "SELECT coalesce(nullif(btrim(last_error), ''), 'No reason recorded') AS reason, \
            count(*) AS count \
       FROM abdm_care_contexts \
      WHERE tenant_id = $1 AND deleted_at IS NULL \
        AND (link_status = 'failed' OR (link_status = 'not_linked' AND last_error IS NOT NULL)) \
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 5";

/// Pair each month's activity with its DHIS counts; both queries return the
/// same zero-filled months in the same order.
fn zip_months(activity: Vec<AbdmActivity>, dhis: Vec<DhisMonth>) -> Vec<AbdmDashboardMonth> {
    activity
        .into_iter()
        .zip(dhis)
        .map(|(activity, dhis)| AbdmDashboardMonth {
            estimate: dhis.estimate(),
            activity,
            dhis,
        })
        .collect()
}

async fn activity(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<Vec<AbdmActivity>, sqlx::Error> {
    sqlx::query_as::<_, AbdmActivity>(ACTIVITY_SQL)
        .bind(tenant_id)
        .bind(from)
        .bind(to)
        // Revoked/expired artefacts are deleted (spec) but still counted.
        .bind(super::hip::consent::ARTEFACT_ENDED)
        .fetch_all(&mut **tx)
        .await
}

/// `GET /api/abdm/dashboard?month=YYYY-MM` — the month's ABDM KPIs and the
/// six months up to it.
///
/// # Errors
/// 403 without `abdm.dashboard.view`; 400 for a malformed month.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<SummaryQuery>,
) -> Result<Json<AbdmDashboard>, AppError> {
    require_permission(&claims, permissions::abdm::dashboard::VIEW)?;
    let month = month_start(q.month.as_deref())?;
    let from = month
        .checked_sub_months(Months::new(TREND_MONTHS - 1))
        .ok_or_else(|| AppError::BadRequest("month is out of range".to_owned()))?;
    let configured = abdm_configured(&state, claims.tenant_id).await?;
    let tenant = claims.tenant_id;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant).await?;
    let activity = activity(&mut tx, tenant, from, month).await?;
    let dhis = dhis::months(&mut tx, tenant, from, month).await?;
    let (active_doctors, with_hpr_id, verified) = hpr::counts(&mut tx, tenant).await?;
    let facilities = hfr::facilities(&mut tx, tenant).await?;
    let failure_reasons = sqlx::query_as::<_, AbdmFailureReason>(REASONS_SQL)
        .bind(tenant)
        .fetch_all(&mut *tx)
        .await?;
    let failures_open: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM abdm_care_contexts WHERE tenant_id = $1 AND deleted_at IS NULL \
           AND (link_status = 'failed' OR (link_status = 'not_linked' AND last_error IS NOT NULL))",
    )
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await?;
    let failures = open_failures(&mut tx, tenant).await?;
    tx.commit().await?;
    let trend = zip_months(activity, dhis);
    let current = trend
        .last()
        .cloned()
        .ok_or_else(|| AppError::Internal("no row for the month".to_owned()))?;
    Ok(Json(AbdmDashboard {
        month,
        configured,
        current,
        trend,
        hpr: AbdmHprCoverage {
            active_doctors,
            with_hpr_id,
            verified,
        },
        facilities,
        failures_open,
        failure_reasons,
        failures,
    }))
}

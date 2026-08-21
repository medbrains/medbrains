//! The enquiry audit.
//!
//! This is the report a hospital buys before it buys the software: how many
//! enquiry calls went unanswered, how long the desk took to respond, and when
//! the phone actually rings. Every number comes from `mkt_interactions` and
//! `mkt_tasks` — no new schema, and nothing here needs the rest of the module
//! to be adopted first.
//!
//! # Two definitions worth arguing about
//!
//! **Response latency starts when the enquiry arrives and stops when a human
//! responds.** If the inbound call was answered, the response was the call —
//! latency is zero, not "unmeasured". Treating an answered call as having no
//! response time would flatter the median by dropping every enquiry the desk
//! handled well.
//!
//! **An enquiry nobody ever called back is not a slow response.** It is
//! reported separately as `never_responded` rather than folded in with a large
//! number, because a median computed over enquiries that were never answered
//! is not a latency at all. Averaging in a placeholder is how a report ends up
//! saying the desk responds in four hours when the truth is that a fifth of
//! callers never heard back.
//!
//! # What this report deliberately does not have
//!
//! A doctor dimension. The data would support it and the specification (§10.4)
//! flags it as a decision to take before it exists, not after — surfacing
//! consultant-level conversion badly can end a deployment. `marketing.reports
//! .view` does not carry it and this handler does not compute it.

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

/// The five-minute mark. Conversion falls roughly fourfold past it, which is
/// why it is the SLA on the first pipeline stage and the headline of this
/// report rather than a configurable nicety.
const FIVE_MINUTES_SECS: i64 = 300;

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    /// Window in days. Clamped to a year — a wider window is a data-warehouse
    /// question, not a report a hospital reads in a meeting.
    pub days: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct CallVolume {
    inbound_total: i64,
    unanswered: i64,
    callbacks_open: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct Latency {
    measured: i64,
    never_responded: i64,
    median_secs: i64,
    p90_secs: i64,
    within_five_minutes: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HourlyVolume {
    pub hour_of_day: i32,
    pub inbound: i64,
    pub unanswered: i64,
}

#[derive(Debug, Serialize)]
pub struct EnquiryAudit {
    pub window_days: i32,
    /// Inbound calls in the window.
    pub inbound_calls: i64,
    pub unanswered_calls: i64,
    /// The headline. Null rather than zero when there were no calls at all —
    /// a hospital with no data should not be told it has a perfect record.
    pub missed_call_rate_pct: Option<f64>,
    pub callbacks_open: i64,
    /// Enquiries where somebody responded, and where nobody ever did.
    pub responses_measured: i64,
    pub never_responded: i64,
    pub median_response_secs: i64,
    pub p90_response_secs: i64,
    pub responded_within_five_minutes: i64,
    pub within_five_minutes_pct: Option<f64>,
    /// For staffing: when the phone actually rings, and when it rings out.
    pub by_hour: Vec<HourlyVolume>,
}

/// Percentage, or `None` when the denominator is zero.
///
/// Returning 0.0 for "no data" would report a perfect missed-call rate to a
/// hospital that has not sent a single call yet, which is the most flattering
/// possible lie and the easiest one to tell by accident.
fn pct(numerator: i64, denominator: i64) -> Option<f64> {
    if denominator == 0 {
        return None;
    }
    #[allow(clippy::cast_precision_loss)]
    Some((numerator as f64 / denominator as f64) * 100.0)
}

/// `GET /api/marketing/reports/enquiry-audit`
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn enquiry_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AuditQuery>,
) -> Result<Json<EnquiryAudit>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;
    // Aggregate throughout. No patient name is selected anywhere in this
    // handler and none can be — it counts calls, and a call is not a chart.

    let days = params.days.unwrap_or(30).clamp(1, 365);

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let volume = sqlx::query_as::<_, CallVolume>(
        "SELECT \
           count(*) FILTER (WHERE direction = 'inbound')::bigint AS inbound_total, \
           count(*) FILTER (WHERE direction = 'inbound' AND answered IS NOT TRUE)::bigint \
             AS unanswered, \
           (SELECT count(*) FROM mkt_tasks t \
             WHERE t.tenant_id = $1 AND t.status = 'open')::bigint AS callbacks_open \
         FROM mkt_interactions \
         WHERE tenant_id = $1 AND kind = 'call' \
           AND occurred_at >= now() - make_interval(days => $2)",
    )
    .bind(claims.tenant_id)
    .bind(days)
    .fetch_one(&mut *tx)
    .await?;

    // An answered inbound call IS the response, so its latency is zero. The
    // LEFT JOIN leaves `secs` null for an enquiry nobody ever called back, and
    // those are counted separately rather than averaged in.
    let latency = sqlx::query_as::<_, Latency>(
        "WITH first_inbound AS ( \
            SELECT contact_id, min(occurred_at) AS at, \
                   (array_agg(answered ORDER BY occurred_at))[1] AS first_answered \
            FROM mkt_interactions \
            WHERE tenant_id = $1 AND direction = 'inbound' \
              AND occurred_at >= now() - make_interval(days => $2) \
            GROUP BY contact_id \
         ), \
         responded AS ( \
            SELECT f.contact_id, \
                   CASE WHEN f.first_answered THEN 0 \
                        ELSE EXTRACT(EPOCH FROM (min(o.occurred_at) - f.at)) END AS secs \
            FROM first_inbound f \
            LEFT JOIN mkt_interactions o \
                   ON o.tenant_id = $1 AND o.contact_id = f.contact_id \
                  AND o.direction = 'outbound' AND o.occurred_at > f.at \
            GROUP BY f.contact_id, f.first_answered, f.at \
         ) \
         SELECT count(*) FILTER (WHERE secs IS NOT NULL)::bigint AS measured, \
                count(*) FILTER (WHERE secs IS NULL)::bigint AS never_responded, \
                COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY secs), 0)::bigint \
                  AS median_secs, \
                COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY secs), 0)::bigint \
                  AS p90_secs, \
                count(*) FILTER (WHERE secs IS NOT NULL AND secs <= $3)::bigint \
                  AS within_five_minutes \
         FROM responded",
    )
    .bind(claims.tenant_id)
    .bind(days)
    .bind(FIVE_MINUTES_SECS)
    .fetch_one(&mut *tx)
    .await?;

    let by_hour = sqlx::query_as::<_, HourlyVolume>(
        "SELECT EXTRACT(HOUR FROM occurred_at)::int AS hour_of_day, \
                count(*)::bigint AS inbound, \
                count(*) FILTER (WHERE answered IS NOT TRUE)::bigint AS unanswered \
         FROM mkt_interactions \
         WHERE tenant_id = $1 AND kind = 'call' AND direction = 'inbound' \
           AND occurred_at >= now() - make_interval(days => $2) \
         GROUP BY 1 ORDER BY 1",
    )
    .bind(claims.tenant_id)
    .bind(days)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(EnquiryAudit {
        window_days: days,
        inbound_calls: volume.inbound_total,
        unanswered_calls: volume.unanswered,
        missed_call_rate_pct: pct(volume.unanswered, volume.inbound_total),
        callbacks_open: volume.callbacks_open,
        responses_measured: latency.measured,
        never_responded: latency.never_responded,
        median_response_secs: latency.median_secs,
        p90_response_secs: latency.p90_secs,
        responded_within_five_minutes: latency.within_five_minutes,
        within_five_minutes_pct: pct(latency.within_five_minutes, latency.measured),
        by_hour,
    }))
}

#[cfg(test)]
mod tests {
    use super::pct;

    #[test]
    fn no_data_is_none_rather_than_a_perfect_score() {
        // Zero over zero reported as 0.0% tells a hospital that has sent no
        // calls that it misses none of them. That is the most flattering
        // possible lie and the easiest to tell by accident.
        assert_eq!(pct(0, 0), None);
        assert_eq!(pct(5, 0), None);
    }

    #[test]
    fn a_rate_is_a_percentage_of_the_denominator() {
        assert_eq!(pct(1, 4), Some(25.0));
        assert_eq!(pct(0, 4), Some(0.0));
        assert_eq!(pct(4, 4), Some(100.0));
    }
}

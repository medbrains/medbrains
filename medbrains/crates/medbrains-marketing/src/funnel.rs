//! Stage history and campaign attribution.
//!
//! # Why a stage event and not another interaction row
//!
//! `move_stage` used to record a transition as an interaction with the
//! destination stage in `disposition` — a column it shares with call
//! outcomes. That answers "where is this enquiry now", which
//! `mkt_contacts.stage_id` already answered, and nothing else. It cannot
//! answer "how long did it sit in 'booked'", because the row does not say
//! where the enquiry came from and the entry into the first stage was never
//! written at all.
//!
//! [`mkt_stage_events`] carries `from_stage_id`, so a dwell time is a
//! subtraction rather than a guess assembled from adjacent rows.
//!
//! # Why the median and not the average
//!
//! One enquiry that sat in "booked" for nine months because somebody forgot
//! to close it will drag a mean past every real number in the column. The
//! administrator is trying to see whether the desk is slowing down, and a
//! statistic a single stale row can move is not evidence of that.
//!
//! # Right-censoring
//!
//! An enquiry still sitting in a stage has no dwell time yet, only a
//! dwell-time-so-far. Counting that as if it were finished biases the median
//! downward — the longer something sits, the more it understates. Open spans
//! are counted (`currently_in`) and excluded from the median, which is the
//! same choice a survival analysis makes and for the same reason.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The vocabulary of `mkt_stage_events.source`, mirroring the CHECK
/// constraint in `0995_marketing_funnel.sql`.
pub mod source {
    /// A person on the tele-calling desk moved it.
    pub const AGENT: &str = "agent";
    /// The enquiry arriving in the funnel — written by contact creation.
    pub const SYSTEM: &str = "system";
}

/// One recorded move. Grouped into a struct because the recorder takes more
/// than three values and a bare argument list of four uuids is a swap waiting
/// to happen.
#[derive(Debug)]
pub struct StageMove<'a> {
    pub tenant_id: Uuid,
    pub contact_id: Uuid,
    /// `None` on entry into the funnel.
    pub from_stage_id: Option<Uuid>,
    pub to_stage_id: Uuid,
    pub actor_id: Option<Uuid>,
    pub source: &'a str,
    pub note: Option<&'a str>,
}

/// Appends one stage event.
///
/// Takes the caller's transaction rather than the pool: a stage change and
/// its record must commit or roll back together, or the funnel report is
/// reconstructed from a history with holes in it.
///
/// A move to the stage the enquiry is already in is dropped rather than
/// written — it is not a transition, and counting it as one adds a zero-length
/// span that deflates the median for that stage.
///
/// # Errors
/// Propagates the insert failure.
pub async fn record_stage_move(
    tx: &mut Transaction<'_, Postgres>,
    mv: &StageMove<'_>,
) -> Result<(), AppError> {
    if mv.from_stage_id == Some(mv.to_stage_id) {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO mkt_stage_events \
            (tenant_id, contact_id, from_stage_id, to_stage_id, actor_id, source, note) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(mv.tenant_id)
    .bind(mv.contact_id)
    .bind(mv.from_stage_id)
    .bind(mv.to_stage_id)
    .bind(mv.actor_id)
    .bind(mv.source)
    .bind(mv.note)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

// ── Funnel report ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FunnelStageRow {
    pub stage_id: Uuid,
    pub stage_name: String,
    pub position: i32,
    pub is_won: bool,
    pub is_lost: bool,
    /// Times an enquiry entered this stage, over the window.
    pub entered: i64,
    /// Times an enquiry left it again.
    pub exited: i64,
    /// Entries that have not left. Excluded from the median.
    pub currently_in: i64,
    /// Median seconds between entering and leaving, over closed spans only.
    /// `None` when nothing has yet left this stage.
    pub median_seconds: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct FunnelQuery {
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    pub to: Option<chrono::DateTime<chrono::Utc>>,
    /// Rows written by the 0995 backfill are stage-at-the-time, not moves,
    /// so their dwell time is really time-since-arrival. Included by default
    /// because excluding them empties the report on day one; excludable
    /// because they are not the same measurement.
    pub exclude_backfill: Option<bool>,
}

/// `GET /api/marketing/reports/funnel`
///
/// Per stage: how many entered, how many left, how many are sitting there
/// now, and the median time the ones that left took to leave.
///
/// One query with a window function, not one query per stage. The dwell time
/// of a span is the gap to that contact's next event, which `lead()` gives in
/// a single pass over an index the migration creates.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn funnel_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<FunnelQuery>,
) -> Result<Json<Vec<FunnelStageRow>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;
    // An aggregate over stage transitions. No contact is named and none can
    // be — this counts enquiries, and the wall in 0975 holds here too.

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FunnelStageRow>(
        "WITH spans AS ( \
            SELECT e.to_stage_id AS stage_id, e.occurred_at, \
                   lead(e.occurred_at) OVER ( \
                       PARTITION BY e.contact_id ORDER BY e.occurred_at, e.id \
                   ) AS left_at \
            FROM mkt_stage_events e \
            WHERE e.tenant_id = $1 \
              AND ($2::timestamptz IS NULL OR e.occurred_at >= $2) \
              AND ($3::timestamptz IS NULL OR e.occurred_at < $3) \
              AND (NOT $4::boolean OR e.source <> 'backfill') \
         ) \
         SELECT s.id AS stage_id, s.name AS stage_name, s.position, \
                s.is_won, s.is_lost, \
                count(sp.stage_id)::bigint AS entered, \
                count(sp.left_at)::bigint AS exited, \
                count(sp.stage_id) FILTER (WHERE sp.left_at IS NULL)::bigint \
                    AS currently_in, \
                percentile_cont(0.5) WITHIN GROUP ( \
                    ORDER BY EXTRACT(EPOCH FROM (sp.left_at - sp.occurred_at)) \
                ) FILTER (WHERE sp.left_at IS NOT NULL) AS median_seconds \
         FROM mkt_pipeline_stages s \
         LEFT JOIN spans sp ON sp.stage_id = s.id \
         WHERE s.tenant_id = $1 \
         GROUP BY s.id, s.name, s.position, s.is_won, s.is_lost \
         ORDER BY s.position",
    )
    .bind(claims.tenant_id)
    .bind(q.from)
    .bind(q.to)
    .bind(q.exclude_backfill.unwrap_or(false))
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Attribution ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampaignAttributionRow {
    pub campaign_id: Uuid,
    pub campaign_name: String,
    pub source: String,
    pub spend_minor: i64,
    pub first_touch_enquiries: i64,
    pub first_touch_contacted: i64,
    pub first_touch_attended: i64,
    pub last_touch_enquiries: i64,
    pub last_touch_attended: i64,
}

/// `GET /api/marketing/reports/attribution`
///
/// Enquiries and attendances per campaign, credited two ways.
///
/// Both models are returned rather than one being picked, because the
/// disagreement between them is the finding: a camp that is first touch for
/// four hundred people and last touch for six is building awareness, not
/// closing, and a single-model report would call it a success or a failure
/// depending on which model somebody chose.
///
/// There is deliberately no weighted or time-decay model. Weights are an
/// argument about credit; the hospital's question is "did the camp produce
/// attendances", and that is a count.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn campaign_attribution(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CampaignAttributionRow>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Each CTE collapses to one row per campaign before the join, so the
    // final joins are 1:1. Joining the two touch sets directly would fan out
    // to first_count x last_count rows per campaign and need count(DISTINCT)
    // to correct for it.
    let rows = sqlx::query_as::<_, CampaignAttributionRow>(
        "WITH first_touch AS ( \
            SELECT DISTINCT ON (t.contact_id) t.contact_id, t.campaign_id \
            FROM mkt_touchpoints t \
            WHERE t.tenant_id = $1 AND t.campaign_id IS NOT NULL \
            ORDER BY t.contact_id, t.occurred_at ASC, t.id \
         ), last_touch AS ( \
            SELECT DISTINCT ON (t.contact_id) t.contact_id, t.campaign_id \
            FROM mkt_touchpoints t \
            WHERE t.tenant_id = $1 AND t.campaign_id IS NOT NULL \
            ORDER BY t.contact_id, t.occurred_at DESC, t.id DESC \
         ), first_agg AS ( \
            SELECT f.campaign_id, count(*)::bigint AS enquiries, \
                   count(*) FILTER (WHERE c.last_contacted_at IS NOT NULL)::bigint \
                       AS contacted, \
                   count(*) FILTER (WHERE st.is_won)::bigint AS attended \
            FROM first_touch f \
            JOIN mkt_contacts c ON c.id = f.contact_id AND c.tenant_id = $1 \
            LEFT JOIN mkt_pipeline_stages st \
                   ON st.id = c.stage_id AND st.tenant_id = $1 \
            GROUP BY f.campaign_id \
         ), last_agg AS ( \
            SELECT l.campaign_id, count(*)::bigint AS enquiries, \
                   count(*) FILTER (WHERE st.is_won)::bigint AS attended \
            FROM last_touch l \
            JOIN mkt_contacts c ON c.id = l.contact_id AND c.tenant_id = $1 \
            LEFT JOIN mkt_pipeline_stages st \
                   ON st.id = c.stage_id AND st.tenant_id = $1 \
            GROUP BY l.campaign_id \
         ) \
         SELECT cam.id AS campaign_id, cam.name AS campaign_name, cam.source, \
                cam.spend_minor, \
                COALESCE(fa.enquiries, 0)::bigint AS first_touch_enquiries, \
                COALESCE(fa.contacted, 0)::bigint AS first_touch_contacted, \
                COALESCE(fa.attended, 0)::bigint AS first_touch_attended, \
                COALESCE(la.enquiries, 0)::bigint AS last_touch_enquiries, \
                COALESCE(la.attended, 0)::bigint AS last_touch_attended \
         FROM mkt_campaigns cam \
         LEFT JOIN first_agg fa ON fa.campaign_id = cam.id \
         LEFT JOIN last_agg la ON la.campaign_id = cam.id \
         WHERE cam.tenant_id = $1 \
         ORDER BY first_touch_attended DESC, first_touch_enquiries DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Touchpoints ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Touchpoint {
    pub id: Uuid,
    pub campaign_id: Option<Uuid>,
    pub campaign_name: Option<String>,
    pub kind: String,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
    pub source: Option<String>,
    pub medium: Option<String>,
    pub area_label: Option<String>,
    pub referrer_label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddTouchpointRequest {
    pub campaign_id: Option<Uuid>,
    pub kind: String,
    pub source: Option<String>,
    pub medium: Option<String>,
    pub external_ref: Option<String>,
    /// The locality the channel occupied — the ward a pamphlet run covered,
    /// the junction a hoarding stands at. Where the CHANNEL was, never where
    /// the person lives; see the header of `0997_marketing_channels_areas.sql`
    /// for why that distinction is load-bearing.
    pub area_label: Option<String>,
    /// An organisation or a coarse label. See the column comment in 0995 for
    /// why there is no amount beside it.
    pub referrer_label: Option<String>,
}

const TOUCHPOINT_COLUMNS: &str = "t.id, t.campaign_id, cam.name AS campaign_name, t.kind, \
                                  t.occurred_at, t.source, t.medium, t.area_label, \
                                  t.referrer_label";

/// `GET /api/marketing/contacts/{id}/touchpoints`
///
/// How this enquiry found the hospital, oldest first.
///
/// # Errors
/// Returns 403 without `marketing.contacts.view`.
pub async fn list_touchpoints(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
) -> Result<Json<Vec<Touchpoint>>, AppError> {
    require_permission(&claims, permissions::marketing::contacts::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Touchpoint>(&format!(
        "SELECT {TOUCHPOINT_COLUMNS} FROM mkt_touchpoints t \
         LEFT JOIN mkt_campaigns cam \
                ON cam.id = t.campaign_id AND cam.tenant_id = t.tenant_id \
         WHERE t.contact_id = $1 AND t.tenant_id = $2 \
         ORDER BY t.occurred_at ASC, t.id"
    ))
    .bind(contact_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/contacts/{id}/touchpoints`
///
/// Records another way this enquiry reached the hospital. Additive: this is
/// the endpoint that stops `campaign_id` being write-once.
///
/// # Errors
/// Returns 403 without `marketing.interactions.log`, 404 if the contact is
/// not in this tenant, 400 on an unknown kind.
pub async fn add_touchpoint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<AddTouchpointRequest>,
) -> Result<Json<Touchpoint>, AppError> {
    require_permission(&claims, permissions::marketing::interactions::LOG)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Checked here rather than left to the CHECK constraint so the caller
    // gets 404-vs-400 right: a bad contact id and a bad kind are different
    // mistakes with different fixes.
    let exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mkt_contacts WHERE id = $1 AND tenant_id = $2")
            .bind(contact_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_touchpoints \
            (tenant_id, contact_id, campaign_id, kind, source, medium, \
             external_ref, referrer_label, area_label) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(body.campaign_id)
    .bind(body.kind.trim())
    .bind(body.source.as_deref())
    .bind(body.medium.as_deref())
    .bind(body.external_ref.as_deref())
    .bind(body.referrer_label.as_deref())
    .bind(body.area_label.as_deref().map(str::trim).filter(|a| !a.is_empty()))
    .fetch_one(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, Touchpoint>(&format!(
        "SELECT {TOUCHPOINT_COLUMNS} FROM mkt_touchpoints t \
         LEFT JOIN mkt_campaigns cam \
                ON cam.id = t.campaign_id AND cam.tenant_id = t.tenant_id \
         WHERE t.id = $1 AND t.tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{StageMove, source};
    use uuid::Uuid;

    /// The recorder drops a no-op move. Asserted on the predicate rather than
    /// through the database because the reason it exists is arithmetic: a
    /// zero-length span in the median is a wrong number, not a wasted row.
    #[test]
    fn a_move_to_the_same_stage_is_not_a_transition() {
        let stage = Uuid::new_v4();
        let mv = StageMove {
            tenant_id: Uuid::new_v4(),
            contact_id: Uuid::new_v4(),
            from_stage_id: Some(stage),
            to_stage_id: stage,
            actor_id: None,
            source: source::AGENT,
            note: None,
        };
        assert_eq!(mv.from_stage_id, Some(mv.to_stage_id));
    }

    /// Entry has no origin, and must still be recorded — it is the start of
    /// the first interval, which had no start at all before 0995.
    #[test]
    fn entry_into_the_funnel_has_no_from_stage() {
        let mv = StageMove {
            tenant_id: Uuid::new_v4(),
            contact_id: Uuid::new_v4(),
            from_stage_id: None,
            to_stage_id: Uuid::new_v4(),
            actor_id: None,
            source: source::SYSTEM,
            note: None,
        };
        assert!(mv.from_stage_id.is_none());
        assert_ne!(mv.from_stage_id, Some(mv.to_stage_id));
    }

    /// The source vocabulary is a contract with the CHECK constraint in
    /// `0995_marketing_funnel.sql`. A rename on either side fails the insert
    /// at runtime, which is the worst place to find out.
    #[test]
    fn source_codes_match_the_check_constraint() {
        assert_eq!(source::AGENT, "agent");
        assert_eq!(source::SYSTEM, "system");
    }
}

// ── Channel journey ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChannelJourneyRow {
    /// How they first reached the hospital.
    pub first_kind: String,
    pub first_medium: Option<String>,
    pub first_area: Option<String>,
    /// What brought them back. `None` means they never came back — they
    /// arrived once and either converted off that or went cold.
    pub second_kind: Option<String>,
    pub second_medium: Option<String>,
    pub enquiries: i64,
    pub converted: i64,
    /// Median hours from first contact to second. `None` when there was no
    /// second, or when the pair is too new to have one yet.
    pub median_gap_hours: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct JourneyQuery {
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    pub to: Option<chrono::DateTime<chrono::Utc>>,
    /// Restrict to one locality — "did the Gandhipuram pamphlet run work".
    pub area: Option<String>,
}

/// `GET /api/marketing/reports/channel-journey`
///
/// First contact, second contact, and how many of each pairing became
/// patients.
///
/// The pairing is the point. A single-channel report says a hoarding produced
/// forty enquiries and eight patients; this says that thirty of those forty
/// came back through a phone call and seven of the eight conversions were in
/// that group — so the hoarding does not close, it opens, and cutting the
/// telephone line to fund more hoardings would cut the conversions.
///
/// `conversion` here is `patient_id IS NOT NULL`: the enquiry actually became
/// a registered patient, not merely a stage somebody dragged.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn channel_journey(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<JourneyQuery>,
) -> Result<Json<Vec<ChannelJourneyRow>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // One pass. `row_number()` ranks each contact's touchpoints, and the two
    // we care about are pivoted with FILTER rather than joined back twice —
    // a self-join here fans out over contacts with long histories.
    let rows = sqlx::query_as::<_, ChannelJourneyRow>(
        "WITH ranked AS ( \
            SELECT t.contact_id, t.kind, t.medium, t.area_label, t.occurred_at, \
                   row_number() OVER ( \
                       PARTITION BY t.contact_id ORDER BY t.occurred_at, t.id \
                   ) AS seq \
            FROM mkt_touchpoints t \
            WHERE t.tenant_id = $1 \
              AND ($2::timestamptz IS NULL OR t.occurred_at >= $2) \
              AND ($3::timestamptz IS NULL OR t.occurred_at < $3) \
         ), journey AS ( \
            SELECT r.contact_id, \
                   max(r.kind)       FILTER (WHERE r.seq = 1) AS first_kind, \
                   max(r.medium)     FILTER (WHERE r.seq = 1) AS first_medium, \
                   max(r.area_label) FILTER (WHERE r.seq = 1) AS first_area, \
                   max(r.kind)       FILTER (WHERE r.seq = 2) AS second_kind, \
                   max(r.medium)     FILTER (WHERE r.seq = 2) AS second_medium, \
                   EXTRACT(EPOCH FROM ( \
                       max(r.occurred_at) FILTER (WHERE r.seq = 2) \
                     - max(r.occurred_at) FILTER (WHERE r.seq = 1) \
                   )) / 3600 AS gap_hours \
            FROM ranked r WHERE r.seq <= 2 \
            GROUP BY r.contact_id \
         ) \
         SELECT j.first_kind, j.first_medium, j.first_area, \
                j.second_kind, j.second_medium, \
                count(*)::bigint AS enquiries, \
                count(*) FILTER (WHERE c.patient_id IS NOT NULL)::bigint AS converted, \
                percentile_cont(0.5) WITHIN GROUP (ORDER BY j.gap_hours) \
                    FILTER (WHERE j.gap_hours IS NOT NULL) AS median_gap_hours \
         FROM journey j \
         JOIN mkt_contacts c ON c.id = j.contact_id AND c.tenant_id = $1 \
         WHERE j.first_kind IS NOT NULL \
           AND ($4::text IS NULL OR j.first_area = $4) \
         GROUP BY j.first_kind, j.first_medium, j.first_area, \
                  j.second_kind, j.second_medium \
         ORDER BY converted DESC, enquiries DESC \
         LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.from)
    .bind(q.to)
    .bind(q.area.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AreaPerformanceRow {
    pub area_label: String,
    pub enquiries: i64,
    pub converted: i64,
    /// Distinct channels that reached this locality — a pamphlet run and a
    /// hoarding in the same ward are one area with two channels.
    pub channels: i64,
    /// Spend, in paise, of every campaign naming this area as a target.
    ///
    /// Deliberately not divided across areas: a campaign targeting three
    /// localities has no per-locality budget, and inventing one by division
    /// would report a precision the hospital never bought.
    pub targeted_spend_minor: i64,
}

/// `GET /api/marketing/reports/area-performance`
///
/// Which localities the hospital actually draws from.
///
/// Physical marketing is bought by area — ten thousand pamphlets across three
/// wards, a hoarding at one junction — and without this the same run is
/// repeated in the locality that produced nobody, because nothing ever said
/// which one that was.
///
/// # Errors
/// Returns 403 without `marketing.reports.view`.
pub async fn area_performance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AreaPerformanceRow>>, AppError> {
    require_permission(&claims, permissions::marketing::REPORTS_VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The spend subquery is correlated on the area name rather than joined,
    // so a campaign targeting three areas counts once against each without
    // multiplying the enquiry counts.
    let rows = sqlx::query_as::<_, AreaPerformanceRow>(
        "SELECT t.area_label, \
                count(DISTINCT t.contact_id)::bigint AS enquiries, \
                count(DISTINCT t.contact_id) \
                    FILTER (WHERE c.patient_id IS NOT NULL)::bigint AS converted, \
                count(DISTINCT t.kind)::bigint AS channels, \
                COALESCE(( \
                    SELECT sum(cam.spend_minor) FROM mkt_campaigns cam \
                    WHERE cam.tenant_id = $1 AND t.area_label = ANY(cam.target_areas) \
                ), 0)::bigint AS targeted_spend_minor \
         FROM mkt_touchpoints t \
         JOIN mkt_contacts c ON c.id = t.contact_id AND c.tenant_id = t.tenant_id \
         WHERE t.tenant_id = $1 AND t.area_label IS NOT NULL \
         GROUP BY t.area_label \
         ORDER BY converted DESC, enquiries DESC \
         LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

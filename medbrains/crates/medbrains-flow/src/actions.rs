//! Alerts and recommendations: raised and cleared by the aggregator, decided
//! by a supervisor. Both are advisory. Accepting a recommendation records who
//! accepted it and when; it opens nothing by itself.

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions::flow;
use medbrains_notifications::{NewNotification, notify_permission_holders};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    Tx, begin, gate,
    model::{
        DEFAULT_TARGET_WAIT_MINUTES, RESOLVE_RATIO, ZoneMinute, alert_level, recommend_counters,
        service_minutes,
    },
    queries::ZoneSetup,
};

/// After a decision, the same advice is not raised again for this long, so an
/// accepted "open a counter" is given time to work. [inferred]
const DECIDED_COOLDOWN_MINUTES: i32 = 15;
const DEFAULT_SNOOZE_MINUTES: i32 = 30;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FlowAlert {
    pub id: Uuid,
    pub location_id: Uuid,
    pub level: String,
    pub people_est: i32,
    pub limit_value: i32,
    pub raised_at: DateTime<Utc>,
    pub acked_at: Option<DateTime<Utc>>,
    pub resolved_at: Option<DateTime<Utc>>,
}

pub const ALERT_COLUMNS: &str =
    "id, location_id, level, people_est, limit_value, raised_at, acked_at, resolved_at";

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FlowRecommendation {
    pub id: Uuid,
    pub location_id: Uuid,
    pub action: String,
    pub counters_open: i32,
    pub counters_suggested: i32,
    pub waiting: i32,
    pub wait_before_minutes: f64,
    pub wait_after_minutes: f64,
    pub target_minutes: i32,
    pub decision: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub snoozed_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

pub const RECOMMENDATION_COLUMNS: &str = "id, location_id, action, counters_open, \
     counters_suggested, waiting, wait_before_minutes::float8 AS wait_before_minutes, \
     wait_after_minutes::float8 AS wait_after_minutes, target_minutes, decision, decided_at, \
     snoozed_until, created_at";

/// Clear alerts the crowd has fallen away from, raise the ones it has passed,
/// and tell the supervisors once per alert. Returns how many were raised.
pub async fn sync_alerts(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zones: &[ZoneSetup],
    minutes: &HashMap<Uuid, ZoneMinute>,
) -> Result<usize, AppError> {
    // Unknown counts neither raise nor clear: an outage is not a quiet hall.
    let known: Vec<(&ZoneSetup, i32)> = zones
        .iter()
        .filter_map(|z| minutes.get(&z.location_id)?.people_est.map(|p| (z, p)))
        .collect();
    let ids: Vec<Uuid> = known.iter().map(|(z, _)| z.location_id).collect();
    let people: Vec<i32> = known.iter().map(|(_, p)| *p).collect();
    sqlx::query(
        "UPDATE flow_alerts a SET resolved_at = now() \
           FROM UNNEST($2::uuid[], $3::int[]) AS z(loc, people) \
          WHERE a.tenant_id = $1 AND a.location_id = z.loc AND a.resolved_at IS NULL \
            AND a.deleted_at IS NULL AND z.people < a.limit_value * $4",
    )
    .bind(tenant_id)
    .bind(&ids)
    .bind(&people)
    .bind(RESOLVE_RATIO)
    .execute(&mut **tx)
    .await?;

    let mut raised = 0;
    for (zone, people) in known {
        let Some((level, limit)) = alert_level(people, zone.comfort_limit, zone.capacity) else {
            continue;
        };
        let inserted: Option<Uuid> = sqlx::query_scalar(
            "INSERT INTO flow_alerts (tenant_id, location_id, level, people_est, limit_value) \
             VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (tenant_id, location_id, level) \
                 WHERE resolved_at IS NULL AND deleted_at IS NULL DO NOTHING \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(zone.location_id)
        .bind(level)
        .bind(people)
        .bind(limit)
        .fetch_optional(&mut **tx)
        .await?;
        if inserted.is_some() {
            notify_supervisors(tx, tenant_id, zone, (level, people, limit)).await?;
            raised += 1;
        }
    }
    Ok(raised)
}

/// Capacity is a crowd-safety limit, so it takes the urgent sound; comfort
/// takes the attention sound (`packages/alert-sounds/alert-sounds.json`).
async fn notify_supervisors(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zone: &ZoneSetup,
    (level, people, limit): (&str, i32, i32),
) -> Result<(), AppError> {
    let (kind, what) = if level == "capacity" {
        ("critical", "capacity")
    } else {
        ("warning", "comfort limit")
    };
    let title = format!("{} is over its {what}", zone.name);
    let body = format!(
        "About {people} people (estimated from queues, check-ins, visitor passes and rosters), \
         over the limit of {limit}. Open MedBrains Flow to see why."
    );
    notify_permission_holders(tx, tenant_id, flow::alerts::ACK, Uuid::nil(), |user_id| {
        NewNotification {
            user_id,
            kind,
            title: &title,
            body: Some(&body),
            category: Some("flow"),
            entity_type: Some("flow_zone"),
            entity_id: Some(zone.location_id),
            action_url: Some("/flow"),
        }
    })
    .await?;
    Ok(())
}

/// Raise or refresh "open another counter" where a queue is past target, and
/// expire advice whose queue has recovered. Returns how many were new.
pub async fn sync_recommendations(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    zones: &[ZoneSetup],
    minutes: &HashMap<Uuid, ZoneMinute>,
) -> Result<usize, AppError> {
    let mut recovered = Vec::new();
    let mut created = 0;
    for zone in zones {
        let Some(m) = minutes.get(&zone.location_id) else {
            continue;
        };
        let (Some(waiting), Some(served), Some(open)) = (m.waiting, m.served_30m, m.open_counters)
        else {
            continue;
        };
        let target = zone
            .goal_wait_minutes
            .unwrap_or(DEFAULT_TARGET_WAIT_MINUTES);
        let service = service_minutes(i64::from(served), i64::from(open));
        let Some(advice) = recommend_counters(i64::from(waiting), service, i64::from(open), target)
        else {
            recovered.push(zone.location_id);
            continue;
        };
        let inserted: Option<bool> = sqlx::query_scalar(
            "INSERT INTO flow_recommendations (tenant_id, location_id, action, counters_open, \
                 counters_suggested, waiting, wait_before_minutes, wait_after_minutes, \
                 target_minutes) \
             SELECT $1, $2, 'open_counter', $3, $4, $5, $6::numeric(6,1), $7::numeric(6,1), $8 \
              WHERE NOT EXISTS (SELECT 1 FROM flow_recommendations r \
                     WHERE r.tenant_id = $1 AND r.location_id = $2 \
                       AND r.action = 'open_counter' AND r.deleted_at IS NULL \
                       AND ((r.decision = 'snoozed' AND r.snoozed_until > now()) \
                         OR (r.decision IN ('accepted', 'dismissed') \
                             AND r.decided_at > now() - make_interval(mins => $9)))) \
             ON CONFLICT (tenant_id, location_id, action) \
                 WHERE decision IS NULL AND expired_at IS NULL AND deleted_at IS NULL \
             DO UPDATE SET counters_open = EXCLUDED.counters_open, \
                 counters_suggested = EXCLUDED.counters_suggested, waiting = EXCLUDED.waiting, \
                 wait_before_minutes = EXCLUDED.wait_before_minutes, \
                 wait_after_minutes = EXCLUDED.wait_after_minutes, \
                 target_minutes = EXCLUDED.target_minutes \
             RETURNING (xmax = 0)",
        )
        .bind(tenant_id)
        .bind(zone.location_id)
        .bind(advice.counters_open as i32)
        .bind(advice.counters_suggested as i32)
        .bind(waiting)
        .bind(advice.wait_before.min(9999.0))
        .bind(advice.wait_after.min(9999.0))
        .bind(advice.target)
        .bind(DECIDED_COOLDOWN_MINUTES)
        .fetch_optional(&mut **tx)
        .await?;
        created += usize::from(inserted == Some(true));
    }
    sqlx::query(
        "UPDATE flow_recommendations SET expired_at = now() \
          WHERE tenant_id = $1 AND location_id = ANY($2) AND decision IS NULL \
            AND expired_at IS NULL AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(&recovered)
    .execute(&mut **tx)
    .await?;
    Ok(created)
}

#[derive(Debug, Deserialize)]
pub struct DecideInput {
    pub decision: String,
    pub snooze_minutes: Option<i32>,
}

/// `POST /api/flow/recommendations/{id}/decide` — record a supervisor's
/// accept, snooze or dismiss. Changes nothing but the recommendation.
pub async fn decide_recommendation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecideInput>,
) -> Result<Json<FlowRecommendation>, AppError> {
    gate(&state, &claims, flow::recommendations::ACT).await?;
    if !["accepted", "snoozed", "dismissed"].contains(&body.decision.as_str()) {
        return Err(AppError::BadRequest(
            "decision must be accepted, snoozed or dismissed".to_owned(),
        ));
    }
    let snooze = body
        .snooze_minutes
        .unwrap_or(DEFAULT_SNOOZE_MINUTES)
        .clamp(5, 240);
    let mut tx = begin(&state, &claims).await?;
    let row = sqlx::query_as::<_, FlowRecommendation>(&format!(
        "UPDATE flow_recommendations SET decision = $3, decided_by = $4, decided_at = now(), \
             snoozed_until = CASE WHEN $3 = 'snoozed' THEN now() + make_interval(mins => $5) END \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
            AND decision IS NULL AND expired_at IS NULL \
          RETURNING {RECOMMENDATION_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.decision)
    .bind(claims.sub)
    .bind(snooze)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(row) = row else {
        return Err(
            closed_or_missing(&mut tx, "flow_recommendations", claims.tenant_id, id).await?,
        );
    };
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/flow/alerts/{id}/ack` — a supervisor has seen it.
pub async fn ack_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FlowAlert>, AppError> {
    gate(&state, &claims, flow::alerts::ACK).await?;
    let mut tx = begin(&state, &claims).await?;
    let row = sqlx::query_as::<_, FlowAlert>(&format!(
        "UPDATE flow_alerts SET acked_by = $3, acked_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND acked_at IS NULL \
          RETURNING {ALERT_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(row) = row else {
        return Err(closed_or_missing(&mut tx, "flow_alerts", claims.tenant_id, id).await?);
    };
    tx.commit().await?;
    Ok(Json(row))
}

/// 409 when the row exists but was already decided, 404 when it does not.
async fn closed_or_missing(
    tx: &mut Tx<'_>,
    table: &str,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<AppError, AppError> {
    let exists: bool = sqlx::query_scalar(&format!(
        "SELECT EXISTS(SELECT 1 FROM {table} WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL)"
    ))
    .bind(tenant_id)
    .bind(id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(if exists {
        AppError::Conflict("Someone has already acted on this.".to_owned())
    } else {
        AppError::NotFound
    })
}

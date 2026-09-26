//! Admin → Queues: set up, change, pause and close queues (P1a).

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use std::collections::HashMap;

use crate::queues::QueueConfig;
use crate::sessions::{self, QueueSession};

#[derive(Debug, Serialize)]
pub struct QueueRow {
    #[serde(flatten)]
    pub queue: QueueConfig,
    /// Tokens issued in the current numbering period (today's, when closed).
    pub issued: i64,
    /// Why the queue takes no token right now, in the desk's words.
    pub closed_reason: Option<String>,
}

/// A place a queue can serve, from the `token_scopes` registry.
#[derive(Debug, Serialize)]
pub struct QueuePlace {
    pub scope: String,
    pub scope_id: Uuid,
    pub label: String,
    pub kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct QueueInput {
    pub name: String,
    pub module: String,
    pub scope: String,
    pub scope_id: Option<Uuid>,
    pub prefix: String,
    pub start_at: i32,
    pub pad_width: i16,
    pub reset_rule: String,
    pub max_tokens_per_period: Option<i32>,
    pub lifecycle: String,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub status: String,
    /// Absent from callers written before hours existed: an hour's lead.
    #[serde(default = "default_early_issue_minutes")]
    pub early_issue_minutes: i16,
    #[serde(default = "default_board_shows")]
    pub board_shows: String,
    #[serde(default = "default_voice_languages")]
    pub voice_languages: Vec<String>,
    #[serde(default = "default_announce_repeat")]
    pub announce_repeat: i16,
}

const fn default_early_issue_minutes() -> i16 {
    60
}

fn default_board_shows() -> String {
    "number".to_owned()
}

fn default_voice_languages() -> Vec<String> {
    vec!["en".to_owned()]
}

const fn default_announce_repeat() -> i16 {
    1
}

/// Languages the board can speak today.
const VOICE_LANGUAGES: [&str; 3] = ["en", "hi", "ta"];

impl QueueInput {
    /// The admin's mistakes, in words they can act on. The table's checks
    /// refuse the same things; this names them.
    fn validate(&mut self) -> Result<(), AppError> {
        self.prefix = self.prefix.trim().to_uppercase();
        let bad = |msg: &str| Err(AppError::BadRequest(msg.to_owned()));
        if self.name.trim().is_empty() {
            return bad("Give the queue a name");
        }
        if !(1..=6).contains(&self.prefix.len())
            || !self.prefix.chars().all(|c| c.is_ascii_alphanumeric())
        {
            return bad("The prefix is 1 to 6 letters or digits, like GEN or C1");
        }
        if self.lifecycle == "temporary"
            && (self.valid_from.is_none() || self.valid_until.is_none())
        {
            return bad("A temporary queue needs its first and last day");
        }
        if matches!((self.valid_from, self.valid_until), (Some(from), Some(until)) if until < from)
        {
            return bad("The last day is before the first");
        }
        if !matches!(self.board_shows.as_str(), "number" | "initials") {
            return bad("A board shows the number, or the number and initials");
        }
        let known = self
            .voice_languages
            .iter()
            .all(|l| VOICE_LANGUAGES.contains(&l.as_str()));
        if self.voice_languages.is_empty() || self.voice_languages.len() > 3 || !known {
            return bad("Choose one to three of English, Hindi and Tamil for the voice");
        }
        if !(1..=3).contains(&self.announce_repeat) {
            return bad("Each call is spoken one to three times");
        }
        if !(0..=240).contains(&self.early_issue_minutes) {
            return bad("Tokens can start at most 4 hours before a session opens");
        }
        Ok(())
    }
}

/// `GET /api/queues`
pub async fn list_queues(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QueueRow>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let queues = sqlx::query_as!(
        QueueConfig,
        "SELECT id, name, module, scope, scope_id, scope_label, prefix, start_at, pad_width, \
                reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status, \
                early_issue_minutes, board_shows, voice_languages, announce_repeat \
           FROM queues WHERE tenant_id = $1 ORDER BY (status = 'closed'), name",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    let clock = sessions::local_clock(&mut tx, claims.tenant_id).await?;
    let ids: Vec<Uuid> = queues.iter().map(|q| q.id).collect();
    // One query for every queue's hours and one for its counts — not one per row.
    let mut hours: HashMap<Uuid, Vec<QueueSession>> = HashMap::new();
    for row in sqlx::query!(
        r#"SELECT queue_id, label, days AS "days!", opens, closes, prefix
             FROM queue_sessions WHERE queue_id = ANY($1) ORDER BY opens"#,
        &ids,
    )
    .fetch_all(&mut *tx)
    .await?
    {
        hours.entry(row.queue_id).or_default().push(QueueSession {
            label: row.label,
            days: row.days,
            opens: row.opens,
            closes: row.closes,
            prefix: row.prefix,
        });
    }
    let today = clock.date.to_string();
    let counts: HashMap<(Uuid, String), i64> = sqlx::query!(
        r#"SELECT queue_id AS "queue_id!", period_key AS "period_key!", COUNT(*) AS "n!"
             FROM tokens
            WHERE queue_id = ANY($1) AND (period_key = 'all' OR period_key LIKE $2 || '%')
            GROUP BY 1, 2"#,
        &ids,
        today,
    )
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|r| ((r.queue_id, r.period_key), r.n))
    .collect();
    tx.commit().await?;

    Ok(Json(
        queues
            .into_iter()
            .map(|queue| {
                let admitted = queue.closed_reason(clock.date).map_or_else(
                    || {
                        sessions::admit(
                            &queue,
                            hours.get(&queue.id).map_or(&[], Vec::as_slice),
                            clock,
                        )
                    },
                    Err,
                );
                let issued = match &admitted {
                    Ok(a) => counts
                        .get(&(queue.id, a.period_key.clone()))
                        .copied()
                        .unwrap_or(0),
                    // Closed: what today held, so an admin after hours still sees the day.
                    Err(_) => counts
                        .iter()
                        .filter(|((id, _), _)| *id == queue.id)
                        .map(|(_, n)| n)
                        .sum(),
                };
                QueueRow {
                    issued,
                    closed_reason: admitted.err(),
                    queue,
                }
            })
            .collect(),
    ))
}

/// `GET /api/queues/places` — departments, rooms, counters and stations a
/// queue can serve.
pub async fn list_places(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<QueuePlace>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let places = sqlx::query_as!(
        QueuePlace,
        r#"SELECT scope AS "scope!", scope_id AS "scope_id!", label AS "label!", kind
             FROM token_scopes
            WHERE tenant_id = $1 AND is_active
            ORDER BY scope, label
            LIMIT 1000"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(places))
}

/// `POST /api/queues`
pub async fn create_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(mut body): Json<QueueInput>,
) -> Result<Json<QueueConfig>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let label = crate::resolve_scope(&mut tx, &body.scope, body.scope_id, None).await?;
    let queue = sqlx::query_as!(
        QueueConfig,
        "INSERT INTO queues (tenant_id, name, module, scope, scope_id, scope_label, prefix, \
           start_at, pad_width, reset_rule, max_tokens_per_period, lifecycle, valid_from, \
           valid_until, status, created_by, early_issue_minutes, board_shows, voice_languages, \
           announce_repeat) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, \
           $18, $19, $20) \
         RETURNING id, name, module, scope, scope_id, scope_label, prefix, start_at, pad_width, \
           reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status, \
           early_issue_minutes, board_shows, voice_languages, announce_repeat",
        claims.tenant_id,
        body.name.trim(),
        body.module,
        body.scope,
        body.scope_id,
        label,
        body.prefix,
        body.start_at,
        body.pad_width,
        body.reset_rule,
        body.max_tokens_per_period,
        body.lifecycle,
        body.valid_from,
        body.valid_until,
        body.status,
        claims.sub,
        body.early_issue_minutes,
        body.board_shows,
        &body.voice_languages,
        body.announce_repeat,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(one_live_queue_per_place)?;
    tx.commit().await?;
    Ok(Json(queue))
}

/// `PUT /api/queues/{id}` — edit, pause, resume or close.
pub async fn update_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(mut body): Json<QueueInput>,
) -> Result<Json<QueueConfig>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    body.validate()?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Restarting numbers each session is only safe with a prefix per session.
    let mut hours = sessions::read_sessions(&mut tx, id).await?;
    sessions::validate_sessions(&body.reset_rule, &mut hours)?;
    // The place is fixed once tokens exist: moving a queue would re-home every
    // token already issued in it.
    let queue = sqlx::query_as!(
        QueueConfig,
        "UPDATE queues SET name = $3, prefix = $4, start_at = $5, pad_width = $6, \
           reset_rule = $7, max_tokens_per_period = $8, lifecycle = $9, valid_from = $10, \
           valid_until = $11, status = $12, early_issue_minutes = $13, board_shows = $14, \
           voice_languages = $15, announce_repeat = $16 \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, name, module, scope, scope_id, scope_label, prefix, start_at, pad_width, \
           reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status, \
           early_issue_minutes, board_shows, voice_languages, announce_repeat",
        id,
        claims.tenant_id,
        body.name.trim(),
        body.prefix,
        body.start_at,
        body.pad_width,
        body.reset_rule,
        body.max_tokens_per_period,
        body.lifecycle,
        body.valid_from,
        body.valid_until,
        body.status,
        body.early_issue_minutes,
        body.board_shows,
        &body.voice_languages,
        body.announce_repeat,
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(one_live_queue_per_place)?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(queue))
}

/// Only one live queue per module and place: two would number the same room
/// twice.
fn one_live_queue_per_place(err: sqlx::Error) -> AppError {
    match err {
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505") => AppError::Conflict(
            "This place already has a live queue for that module — close it first".to_owned(),
        ),
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23514") => AppError::BadRequest(
            format!("The queue settings are not valid: {}", db.message()),
        ),
        other => other.into(),
    }
}

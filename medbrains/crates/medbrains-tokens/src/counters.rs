//! Which counters serve a queue, and who may call at each
//! (RFCs/modules/RFC-MODULE-token-queues.md, P2).
//!
//! A counter is a `stations` row. A queue with no counters calls exactly as
//! before. With counters, every call names one of them — the board then says
//! which window to go to — and a counter with a staff list takes calls only
//! from those people.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A counter serving a queue, as Admin → Queues → Counters shows it.
#[derive(Debug, Clone, Serialize)]
pub struct QueueCounter {
    pub station_id: Uuid,
    pub name: String,
    /// Empty: anyone who may work the queue calls here.
    pub staff_user_ids: Vec<Uuid>,
    pub staff_names: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct QueueCounterInput {
    pub station_id: Uuid,
    #[serde(default)]
    pub staff_user_ids: Vec<Uuid>,
}

/// The counter a call goes to, or why the caller cannot call there.
pub fn choose_counter(
    queue_name: &str,
    counters: &[QueueCounter],
    label: Option<&str>,
    caller: Uuid,
) -> Result<Option<String>, AppError> {
    if counters.is_empty() {
        return Ok(label.map(str::to_owned));
    }
    let names = || {
        counters
            .iter()
            .map(|c| c.name.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    };
    let Some(label) = label.filter(|l| !l.trim().is_empty()) else {
        return Err(AppError::BadRequest(format!(
            "Choose your counter — {queue_name} is served at {}",
            names()
        )));
    };
    let counter = counters.iter().find(|c| c.name == label).ok_or_else(|| {
        AppError::BadRequest(format!(
            "{label} does not serve {queue_name} — choose {}",
            names()
        ))
    })?;
    if !counter.staff_user_ids.is_empty() && !counter.staff_user_ids.contains(&caller) {
        return Err(AppError::ForbiddenReason(format!(
            "Only {} may call at {label}",
            counter.staff_names.join(", ")
        )));
    }
    Ok(Some(counter.name.clone()))
}

/// The counter a call to this token names — checked against its queue's
/// counters. Tokens outside a configured queue keep the label they were given.
pub async fn counter_for_call(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue_id: Option<Uuid>,
    label: Option<String>,
    caller: Uuid,
) -> Result<Option<String>, AppError> {
    let Some(queue_id) = queue_id else {
        return Ok(label);
    };
    let counters = read_counters(tx, queue_id).await?;
    if counters.is_empty() {
        return Ok(label);
    }
    let queue_name = sqlx::query_scalar!("SELECT name FROM queues WHERE id = $1", queue_id)
        .fetch_one(&mut **tx)
        .await?;
    choose_counter(&queue_name, &counters, label.as_deref(), caller)
}

async fn read_counters(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue_id: Uuid,
) -> Result<Vec<QueueCounter>, AppError> {
    Ok(sqlx::query_as!(
        QueueCounter,
        r#"SELECT c.station_id, s.name AS "name!", c.staff_user_ids AS "staff_user_ids!",
                  COALESCE(ARRAY(SELECT u.full_name FROM users u
                                  WHERE u.id = ANY(c.staff_user_ids) ORDER BY u.full_name),
                           '{}') AS "staff_names!"
             FROM queue_counters c JOIN stations s ON s.id = c.station_id
            WHERE c.queue_id = $1
            ORDER BY s.name"#,
        queue_id,
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// `GET /api/queues/{id}/counters`
pub async fn list_counters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<QueueCounter>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let counters = read_counters(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(counters))
}

/// `PUT /api/queues/{id}/counters` — replace the queue's counters. An empty
/// list lets the queue call without naming a counter again.
pub async fn replace_counters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(counters): Json<Vec<QueueCounterInput>>,
) -> Result<Json<Vec<QueueCounter>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    if counters.len() > 50 {
        return Err(AppError::BadRequest(
            "A queue can have at most 50 counters".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query_scalar!(
        "SELECT id FROM queues WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let station_ids: Vec<Uuid> = counters.iter().map(|c| c.station_id).collect();
    // One query checks every station: in this hospital, live, and — because a
    // call names its counter — no two with the same name.
    let names: Vec<String> = sqlx::query_scalar!(
        r#"SELECT name AS "name!" FROM stations
            WHERE id = ANY($1) AND tenant_id = $2 AND deleted_at IS NULL AND is_active"#,
        &station_ids,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    let distinct: std::collections::HashSet<&String> = names.iter().collect();
    if names.len() != counters.len() || distinct.len() != names.len() {
        return Err(AppError::BadRequest(
            "Each counter must be an active counter of this hospital, listed once, with its own name"
                .to_owned(),
        ));
    }
    sqlx::query!(
        "DELETE FROM queue_counters WHERE queue_id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&mut *tx)
    .await?;
    // A staff id that is not a user of this hospital would be dropped, and a
    // counter kept for one doctor would quietly open to everybody. Refuse it.
    let staff: Vec<Uuid> = counters
        .iter()
        .flat_map(|c| c.staff_user_ids.iter().copied())
        .collect();
    let known = sqlx::query_scalar!(
        r#"SELECT COUNT(DISTINCT id) AS "n!" FROM users
            WHERE tenant_id = $1 AND id = ANY($2) AND is_active"#,
        claims.tenant_id,
        &staff,
    )
    .fetch_one(&mut *tx)
    .await?;
    let wanted: std::collections::HashSet<&Uuid> = staff.iter().collect();
    if usize::try_from(known).unwrap_or(0) != wanted.len() {
        return Err(AppError::BadRequest(
            "A counter's staff must be active users of this hospital".to_owned(),
        ));
    }
    for c in &counters {
        sqlx::query!(
            "INSERT INTO queue_counters (tenant_id, queue_id, station_id, staff_user_ids) \
             VALUES ($1, $2, $3, $4)",
            claims.tenant_id,
            id,
            c.station_id,
            &c.staff_user_ids,
        )
        .execute(&mut *tx)
        .await?;
    }
    let saved = read_counters(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(saved))
}

#[cfg(test)]
mod tests {
    use super::{QueueCounter, choose_counter};
    use medbrains_server_core::error::AppError;
    use uuid::Uuid;

    fn counter(name: &str, staff: &[Uuid]) -> QueueCounter {
        QueueCounter {
            station_id: Uuid::new_v4(),
            name: name.to_owned(),
            staff_user_ids: staff.to_vec(),
            staff_names: staff.iter().map(|_| "Dr Rao".to_owned()).collect(),
        }
    }

    #[test]
    fn a_queue_without_counters_calls_as_before() {
        let me = Uuid::new_v4();
        assert_eq!(
            choose_counter("Pharmacy", &[], Some("Anything"), me)
                .ok()
                .flatten()
                .as_deref(),
            Some("Anything")
        );
        assert!(matches!(
            choose_counter("Pharmacy", &[], None, me),
            Ok(None)
        ));
    }

    #[test]
    fn with_counters_every_call_names_one_of_them() {
        let me = Uuid::new_v4();
        let windows = [counter("Window 1", &[]), counter("Window 2", &[])];
        assert!(matches!(
            choose_counter("Pharmacy", &windows, None, me),
            Err(AppError::BadRequest(m)) if m == "Choose your counter — Pharmacy is served at Window 1, Window 2"
        ));
        assert!(matches!(
            choose_counter("Pharmacy", &windows, Some("Room 9"), me),
            Err(AppError::BadRequest(m)) if m.starts_with("Room 9 does not serve Pharmacy")
        ));
        assert!(
            matches!(choose_counter("Pharmacy", &windows, Some("Window 2"), me), Ok(Some(n)) if n == "Window 2")
        );
    }

    /// Scenario 11 — a counter kept for Dr Rao takes calls from Dr Rao only.
    #[test]
    fn a_counter_with_staff_takes_calls_from_them_only() {
        let (rao, other) = (Uuid::new_v4(), Uuid::new_v4());
        let rooms = [counter("Room 3", &[rao])];
        assert!(choose_counter("OPD", &rooms, Some("Room 3"), rao).is_ok());
        assert!(matches!(
            choose_counter("OPD", &rooms, Some("Room 3"), other),
            Err(AppError::ForbiddenReason(m)) if m == "Only Dr Rao may call at Room 3"
        ));
    }
}

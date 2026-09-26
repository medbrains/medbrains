//! A camp patient's route through the stations
//! (RFCs/modules/RFC-MODULE-token-queues.md, P4a).
//!
//! Completing a patient at one camp station puts them in the queue of the next
//! station on the route, with the same number: one slip, registration to
//! pharmacy.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::{IssueToken, Token, issue_token_in_tx};

/// The camp station after this counter on its camp's route, if any.
async fn next_station(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    counter_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar!(
        "SELECT next.id FROM camp_counters here \
           JOIN camp_counters next ON next.camp_id = here.camp_id \
          WHERE here.id = $1 AND here.flow_position IS NOT NULL \
            AND next.flow_position > here.flow_position AND next.deleted_at IS NULL \
          ORDER BY next.flow_position LIMIT 1",
        counter_id,
    )
    .fetch_optional(&mut **tx)
    .await?)
}

/// After a camp station completes a token, queue the patient at the next
/// station. Returns the next station, or `None` at the end of the route (or
/// for any token that is not a camp station's).
pub async fn send_to_next_station(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    issued_by: Uuid,
    token: &Token,
) -> Result<Option<Uuid>, AppError> {
    let (true, Some(counter_id)) = (
        token.module == "camp" && token.scope == "counter",
        token.scope_id,
    ) else {
        return Ok(None);
    };
    let Some(next) = next_station(tx, counter_id).await? else {
        return Ok(None);
    };
    // Same visit, so the next station numbers it with the same number.
    issue_token_in_tx(
        tx,
        tenant_id,
        IssueToken {
            visit_id: token.visit_id,
            module: "camp",
            scope: "counter",
            scope_id: Some(next),
            scope_label: None,
            priority: &token.priority,
            patient_id: token.patient_id,
            patient_name: token.patient_name.as_deref(),
            entity_type: token.entity_type.as_deref(),
            entity_id: token.entity_id,
            issued_by: Some(issued_by),
        },
    )
    .await?;
    Ok(Some(next))
}

/// Who is entering a camp's route, and from which registration.
#[derive(Debug)]
pub struct RouteEntry<'a> {
    pub camp_id: Uuid,
    pub registration_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub patient_name: &'a str,
    pub issued_by: Uuid,
}

/// Queue a just-registered camp patient at the station after registration.
///
/// The token starts a visit of its own, so every later station numbers it the
/// same. `None` when the camp has no route (fewer than two stations).
pub async fn enter_camp_route_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    entry: RouteEntry<'_>,
) -> Result<Option<String>, AppError> {
    // Registration is the first station; the patient now waits for the second.
    let Some(first_queue) = sqlx::query_scalar!(
        "SELECT id FROM camp_counters \
          WHERE camp_id = $1 AND flow_position IS NOT NULL AND deleted_at IS NULL \
          ORDER BY flow_position OFFSET 1 LIMIT 1",
        entry.camp_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(None);
    };
    issue_token_in_tx(
        tx,
        tenant_id,
        IssueToken {
            visit_id: Some(Uuid::new_v4()),
            module: "camp",
            scope: "counter",
            scope_id: Some(first_queue),
            scope_label: None,
            priority: "normal",
            patient_id: entry.patient_id,
            patient_name: Some(entry.patient_name),
            entity_type: Some("camp_registration"),
            entity_id: Some(entry.registration_id),
            issued_by: Some(entry.issued_by),
        },
    )
    .await
}

/// A camp station a desk can work, for the console's station picker.
#[derive(Debug, serde::Serialize)]
pub struct CampStation {
    pub counter_id: Uuid,
    pub camp_name: String,
    pub name: String,
    pub flow_position: i16,
}

/// `GET /api/tokens/camp-stations` — the stations of camps still running, in
/// route order, for whoever calls patients through them.
pub async fn list_camp_stations(
    axum::extract::State(state): axum::extract::State<medbrains_server_core::state::AppState>,
    axum::Extension(claims): axum::Extension<medbrains_server_core::middleware::auth::Claims>,
) -> Result<axum::Json<Vec<CampStation>>, AppError> {
    medbrains_server_core::middleware::authorization::require_permission(
        &claims,
        medbrains_core::permissions::camp::queue::MANAGE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let stations = sqlx::query_as!(
        CampStation,
        r#"SELECT c.id AS counter_id, k.name AS camp_name, c.counter_name AS name,
                  c.flow_position AS "flow_position!"
             FROM camp_counters c JOIN camps k ON k.id = c.camp_id
            WHERE c.flow_position IS NOT NULL AND c.deleted_at IS NULL
              AND k.status::text NOT IN ('completed', 'cancelled')
            ORDER BY k.scheduled_date DESC, k.name, c.flow_position
            LIMIT 200"#,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(axum::Json(stations))
}

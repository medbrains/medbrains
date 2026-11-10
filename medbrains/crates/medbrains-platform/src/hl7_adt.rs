//! Settings → HL7 ADT feeds: where the hospital's ADT messages go (MLLP host
//! and port), which triggers each destination wants, and what was sent.
//! The messages are queued by the database (migration 1355) and sent by
//! the outbox (`hl7.adt.send`).

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// The triggers a destination may subscribe to.
pub const EVENTS: [&str; 7] = ["A01", "A02", "A03", "A04", "A08", "A11", "A13"];
/// Deliveries shown, newest first.
const DELIVERY_LIMIT: i64 = 100;

#[derive(Debug, Serialize, FromRow)]
pub struct AdtDestination {
    pub id: Uuid,
    pub name: String,
    pub host: String,
    pub port: i32,
    pub events: Vec<String>,
    pub sending_facility: Option<String>,
    pub receiving_application: String,
    pub receiving_facility: String,
    pub is_active: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AdtDestinationInput {
    pub name: String,
    pub host: String,
    pub port: i32,
    pub events: Vec<String>,
    pub sending_facility: Option<String>,
    #[serde(default)]
    pub receiving_application: String,
    #[serde(default)]
    pub receiving_facility: String,
    #[serde(default = "yes")]
    pub is_active: bool,
}

const fn yes() -> bool {
    true
}

/// One ADT message, as the outbox holds it.
#[derive(Debug, Serialize, FromRow)]
pub struct AdtDelivery {
    pub id: Uuid,
    pub destination: Option<String>,
    pub event: Option<String>,
    pub status: String,
    pub attempts: i32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
}

const COLUMNS: &str = "id, name, host, port, events, sending_facility, receiving_application, \
     receiving_facility, is_active, updated_at";

/// Refuse what the database would, in words the settings screen can show.
fn validate(input: &AdtDestinationInput) -> Result<(), AppError> {
    let bad = |m: &str| Err(AppError::BadRequest(m.to_owned()));
    if input.name.trim().chars().count() < 2 {
        return bad("Give the destination a name");
    }
    let host = input.host.trim();
    if host.is_empty() || host.contains(['/', ':', ' ']) {
        return bad("The host is a name or IP address only, like pacs.hospital.local or 10.0.4.20");
    }
    if !(1..=65_535).contains(&input.port) {
        return bad("The port is a number from 1 to 65535");
    }
    if input.events.is_empty() || input.events.iter().any(|e| !EVENTS.contains(&e.as_str())) {
        return bad("Choose at least one of A01, A02, A03, A04, A08, A11, A13");
    }
    Ok(())
}

/// `GET /api/integrations/hl7-adt/destinations`.
///
/// # Errors
/// 403 without `integration.hl7_adt.view`.
pub async fn list_destinations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AdtDestination>>, AppError> {
    require_permission(&claims, permissions::integration::hl7_adt::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, AdtDestination>(&format!(
        "SELECT {COLUMNS} FROM hl7_adt_destinations \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/integrations/hl7-adt/destinations`.
///
/// # Errors
/// 403 without `integration.hl7_adt.manage`; 400 for an invalid address or
/// trigger list.
pub async fn create_destination(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AdtDestinationInput>,
) -> Result<Json<AdtDestination>, AppError> {
    require_permission(&claims, permissions::integration::hl7_adt::MANAGE)?;
    validate(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AdtDestination>(&format!(
        "INSERT INTO hl7_adt_destinations \
           (tenant_id, name, host, port, events, sending_facility, receiving_application, \
            receiving_facility, is_active, created_by) \
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10) RETURNING {COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(body.host.trim())
    .bind(body.port)
    .bind(&body.events)
    .bind(body.sending_facility.as_deref().map(str::trim))
    .bind(body.receiving_application.trim())
    .bind(body.receiving_facility.trim())
    .bind(body.is_active)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/integrations/hl7-adt/destinations/{id}` — edit, or turn off.
///
/// # Errors
/// As create; 404 for a destination of another hospital.
pub async fn update_destination(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdtDestinationInput>,
) -> Result<Json<AdtDestination>, AppError> {
    require_permission(&claims, permissions::integration::hl7_adt::MANAGE)?;
    validate(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, AdtDestination>(&format!(
        "UPDATE hl7_adt_destinations SET name = $3, host = $4, port = $5, events = $6, \
                sending_facility = NULLIF($7, ''), receiving_application = $8, \
                receiving_facility = $9, is_active = $10 \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING {COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.name.trim())
    .bind(body.host.trim())
    .bind(body.port)
    .bind(&body.events)
    .bind(body.sending_facility.as_deref().map(str::trim))
    .bind(body.receiving_application.trim())
    .bind(body.receiving_facility.trim())
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/integrations/hl7-adt/destinations/{id}` — stop the feed;
/// the row stays (soft delete) with what it sent.
///
/// # Errors
/// 403 without `integration.hl7_adt.manage`; 404 for an unknown one.
pub async fn delete_destination(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::integration::hl7_adt::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE hl7_adt_destinations SET deleted_at = now(), deleted_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": id })))
}

/// `GET /api/integrations/hl7-adt/deliveries` — the last messages queued,
/// with whether each was acknowledged and why not.
///
/// # Errors
/// 403 without `integration.hl7_adt.view`.
pub async fn list_deliveries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AdtDelivery>>, AppError> {
    require_permission(&claims, permissions::integration::hl7_adt::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, AdtDelivery>(
        "SELECT o.id, d.name AS destination, o.payload->>'event' AS event, o.status, o.attempts, \
                o.last_error, o.created_at, o.sent_at \
           FROM outbox_events o \
           LEFT JOIN hl7_adt_destinations d ON d.id = o.aggregate_id AND d.tenant_id = o.tenant_id \
          WHERE o.tenant_id = $1 AND o.event_type = 'hl7.adt.send' AND o.deleted_at IS NULL \
          ORDER BY o.created_at DESC LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(DELIVERY_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::{AdtDestinationInput, validate};

    fn input(host: &str, port: i32, events: &[&str]) -> AdtDestinationInput {
        AdtDestinationInput {
            name: "PACS".to_owned(),
            host: host.to_owned(),
            port,
            events: events.iter().map(|e| (*e).to_owned()).collect(),
            sending_facility: None,
            receiving_application: String::new(),
            receiving_facility: String::new(),
            is_active: true,
        }
    }

    #[test]
    fn a_destination_names_a_host_a_port_and_known_triggers() {
        assert!(validate(&input("10.0.4.20", 2575, &["A01", "A03"])).is_ok());
        assert!(
            validate(&input("http://pacs", 2575, &["A01"])).is_err(),
            "a URL is not a host"
        );
        assert!(validate(&input("pacs.local", 0, &["A01"])).is_err());
        assert!(validate(&input("pacs.local", 2575, &[])).is_err());
        assert!(
            validate(&input("pacs.local", 2575, &["A05"])).is_err(),
            "not a trigger we send"
        );
    }
}

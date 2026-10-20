//! Customer display routes (#4883).
//!
//! - `GET  /api/device/counter-display` — the paired display: its counter,
//!   the hospital's name and logo, and the snapshot (also the polling
//!   fallback when the socket is down).
//! - `GET  /ws/counter-display?token=` — the same display, live.
//! - `POST /api/counter-display/{station_id}/events` — the cashier's drawer.
//! - `GET  /api/counter-display/{station_id}/status` — "display connected?".
//!
//! A display is a paired device approved for one counter, acting as the
//! hospital's display account — never a staff login. Which counter it shows
//! comes from its pairing row, never from the URL or the client.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use futures::{SinkExt, StreamExt};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::{Claims, decode_and_validate};
use medbrains_server_core::middleware::authorization::{require_board_read, require_permission};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use std::time::Duration;
use uuid::Uuid;

use crate::counter_display::{self, DisplayEvent, DisplayState, visible};

/// How often an open socket re-checks its device and re-sends the snapshot.
/// The re-send is the heartbeat the display watches to know it is live; the
/// re-check cuts off a display revoked while connected.
const HEARTBEAT: Duration = Duration::from_secs(20);

#[derive(Debug, sqlx::FromRow)]
struct BoundCounter {
    station_id: Uuid,
    station_name: String,
    station_type: String,
    label: String,
    hospital_name: String,
    logo_url: Option<String>,
}

/// The counter this device is approved to show, if it is a live customer
/// display. A revoked, deleted or non-display device has none.
async fn bound_counter(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    device_id: Uuid,
) -> Result<Option<BoundCounter>, AppError> {
    Ok(sqlx::query_as::<_, BoundCounter>(
        "SELECT s.id AS station_id, s.name AS station_name, s.station_type, p.label, \
                t.name AS hospital_name, t.logo_url \
           FROM paired_devices p \
           JOIN stations s ON s.id = p.station_id AND s.deleted_at IS NULL \
           JOIN tenants t ON t.id = p.tenant_id \
          WHERE p.id = $1 AND p.tenant_id = $2 AND p.board_module = 'counter_display' \
            AND p.revoked_at IS NULL AND p.deleted_at IS NULL \
            AND (p.app_variant = 'display' OR p.app_variant LIKE 'tv%')",
    )
    .bind(device_id)
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?)
}

/// Last seen, for the settings list. At most once a minute per display.
async fn touch(conn: &mut PgConnection, device_id: Uuid) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE paired_devices SET last_seen_at = now() \
          WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '1 minute')",
    )
    .bind(device_id)
    .execute(conn)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct CounterDisplayView {
    pub label: String,
    pub station_id: Uuid,
    pub station_name: String,
    pub station_type: String,
    pub hospital_name: String,
    pub logo_url: Option<String>,
    pub state: DisplayState,
}

/// `GET /api/device/counter-display`
pub async fn get_counter_display(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CounterDisplayView>, AppError> {
    require_board_read(&claims)?;
    let device = claims.paired_device_id.ok_or(AppError::NotFound)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let counter = bound_counter(&mut tx, claims.tenant_id, device)
        .await?
        .ok_or(AppError::NotFound)?;
    touch(&mut tx, device).await?;
    tx.commit().await?;
    Ok(Json(CounterDisplayView {
        state: counter_display::poll(claims.tenant_id, counter.station_id),
        label: counter.label,
        station_id: counter.station_id,
        station_name: counter.station_name,
        station_type: counter.station_type,
        hospital_name: counter.hospital_name,
        logo_url: counter.logo_url,
    }))
}

#[derive(Debug, Serialize)]
pub struct PublishAck {
    pub seq: u64,
    pub connected: bool,
}

/// `POST /api/counter-display/{station_id}/events`
pub async fn publish_event(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(station_id): Path<Uuid>,
    Json(event): Json<DisplayEvent>,
) -> Result<Json<PublishAck>, AppError> {
    require_permission(&claims, permissions::billing::counter_display::PUBLISH)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let is_counter: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM stations WHERE id = $1 AND tenant_id = $2 \
           AND is_active AND deleted_at IS NULL \
           AND station_type IN ('billing_counter', 'pharmacy_counter'))",
    )
    .bind(station_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *conn)
    .await?;
    if !is_counter {
        return Err(AppError::NotFound);
    }
    let (seq, connected) = counter_display::publish(claims.tenant_id, station_id, event)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    Ok(Json(PublishAck { seq, connected }))
}

#[derive(Debug, Serialize)]
pub struct DisplayStatus {
    /// A live display is paired to this counter.
    pub paired: bool,
    /// One is reading it now.
    pub connected: bool,
}

/// `GET /api/counter-display/{station_id}/status`
pub async fn display_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(station_id): Path<Uuid>,
) -> Result<Json<DisplayStatus>, AppError> {
    require_permission(&claims, permissions::billing::counter_display::PUBLISH)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let paired: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM paired_devices WHERE tenant_id = $1 AND station_id = $2 \
           AND board_module = 'counter_display' AND revoked_at IS NULL AND deleted_at IS NULL)",
    )
    .bind(claims.tenant_id)
    .bind(station_id)
    .fetch_one(&mut *conn)
    .await?;
    Ok(Json(DisplayStatus {
        paired,
        connected: paired && counter_display::is_connected(claims.tenant_id, station_id),
    }))
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    /// The display's device token. A kiosk browser has no cookie session.
    pub token: Option<String>,
}

/// `GET /ws/counter-display?token=` — public route; authenticates itself.
pub async fn counter_display_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(q): Query<WsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let token = q.token.ok_or(AppError::Unauthorized)?;
    let claims = decode_and_validate(&token, &state.jwt_decoding_key)?;
    let device = claims.paired_device_id.ok_or(AppError::Unauthorized)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let counter = bound_counter(&mut conn, claims.tenant_id, device)
        .await?
        .ok_or(AppError::Unauthorized)?;
    touch(&mut conn, device).await?;
    drop(conn);
    let tenant = claims.tenant_id;
    Ok(ws.on_upgrade(move |socket| run_socket(socket, state, tenant, device, counter.station_id)))
}

/// Whether the device may keep its socket. A database fault closes it too:
/// the display then shows "Reconnecting…" and asks again, which is the
/// honest answer — never a frozen screen that looks live.
async fn still_bound(state: &AppState, tenant: Uuid, device: Uuid) -> bool {
    let Ok(mut conn) = medbrains_db::pool::tenant_conn(&state.db, &tenant).await else {
        return false;
    };
    match bound_counter(&mut conn, tenant, device).await {
        Ok(Some(_)) => true,
        Ok(None) | Err(_) => false,
    }
}

async fn run_socket(socket: WebSocket, state: AppState, tenant: Uuid, device: Uuid, station: Uuid) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = counter_display::subscribe(tenant, station);
    let mut heartbeat = tokio::time::interval(HEARTBEAT);
    loop {
        let alive = tokio::select! {
            changed = rx.changed() => changed.is_ok(),
            _ = heartbeat.tick() => still_bound(&state, tenant, device).await,
            inbound = receiver.next() => {
                matches!(inbound, Some(Ok(message)) if !matches!(message, Message::Close(_)))
            }
        };
        if !alive {
            break;
        }
        let frame = {
            let stamped = rx.borrow_and_update();
            visible(&stamped.state, stamped.at.elapsed())
        };
        let Ok(json) = serde_json::to_string(&frame) else {
            break;
        };
        if sender.send(Message::Text(json.into())).await.is_err() {
            break;
        }
    }
}

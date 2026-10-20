//! The payment devices at each counter: register, bind to the counter's
//! station, test that a card machine answers, retire.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::payment::PaymentTerminal;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use uuid::Uuid;

use crate::pos::{self, BRIDGE_ADAPTERS, CLOUD_PROVIDERS, Ctx, simulator};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

const TERMINAL_KINDS: &[&str] = &["online", "pos", "qr"];
const TERMINAL_MODES: &[&str] = &["sandbox", "live"];
/// The longest list a hospital's counters need.
const MAX_TERMINALS: i64 = 500;

/// Every terminal read: its station's name, and `status` — a bridge machine
/// is online only while its bridge keeps reporting it (the bridge polls every
/// few seconds; 90 s of silence is offline), a cloud machine by its last ping
/// or sale, `unknown` when it has never answered.
pub(crate) const TERMINAL_SELECT: &str = "SELECT t.id, t.tenant_id, t.provider, t.kind, \
    t.terminal_code, t.acquiring_bank, t.station_id, s.name AS station_name, t.location_id, \
    t.label, t.mode, t.connection, t.adapter, t.device_address, t.last_seen_at, \
    CASE WHEN t.connection = 'bridge' \
              THEN CASE WHEN t.last_status = 'online' \
                         AND t.last_seen_at > now() - make_interval(secs => 90) \
                        THEN 'online' ELSE 'offline' END \
         ELSE COALESCE(t.last_status, 'unknown') END AS status, \
    t.last_error, t.is_active, t.retired_at, t.created_by, t.created_at, t.updated_at \
    FROM payment_terminals t LEFT JOIN stations s ON s.id = t.station_id";

pub(crate) async fn load(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<PaymentTerminal>, AppError> {
    Ok(sqlx::query_as::<_, PaymentTerminal>(&format!(
        "{TERMINAL_SELECT} WHERE t.id = $1 AND t.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Record what a machine just said about itself.
pub(crate) async fn note_health(
    tx: &mut Tx<'_>,
    id: Uuid,
    answered: Result<(), String>,
) -> Result<(), AppError> {
    let (online, error) = match answered {
        Ok(()) => (true, None),
        Err(e) => (false, Some(e)),
    };
    sqlx::query(
        "UPDATE payment_terminals SET last_status = CASE WHEN $2 THEN 'online' ELSE 'offline' END, \
         last_error = $3, last_seen_at = CASE WHEN $2 THEN now() ELSE last_seen_at END \
         WHERE id = $1",
    )
    .bind(id)
    .bind(online)
    .bind(error)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ListTerminalsQuery {
    /// The counter the cashier is working at.
    station_id: Option<Uuid>,
    active_only: Option<bool>,
}

/// `GET /api/payments/terminals` — the devices, optionally at one counter.
pub async fn list_payment_terminals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListTerminalsQuery>,
) -> Result<Json<Vec<PaymentTerminal>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::payments::CREATE,
            permissions::pharmacy::pos::CREATE,
            permissions::billing::terminals::MANAGE,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PaymentTerminal>(&format!(
        "{TERMINAL_SELECT} WHERE t.tenant_id = $1 \
           AND ($2::uuid IS NULL OR t.station_id = $2) \
           AND ($3::bool IS NOT TRUE OR t.is_active) \
         ORDER BY t.is_active DESC, s.name NULLS LAST, t.label LIMIT $4"
    ))
    .bind(claims.tenant_id)
    .bind(q.station_id)
    .bind(q.active_only)
    .bind(MAX_TERMINALS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct TerminalInput {
    pub provider: Option<String>,
    pub kind: Option<String>,
    pub label: Option<String>,
    pub terminal_code: Option<String>,
    pub acquiring_bank: Option<String>,
    pub station_id: Option<Uuid>,
    pub mode: Option<String>,
    pub connection: Option<String>,
    pub adapter: Option<String>,
    pub device_address: Option<String>,
    pub is_active: Option<bool>,
}

fn text(v: Option<&String>) -> Option<&str> {
    v.map(|s| s.trim()).filter(|s| !s.is_empty())
}

fn one_of(value: &str, allowed: &[&str], what: &str) -> Result<(), AppError> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "{what} must be one of: {}",
            allowed.join(", ")
        )))
    }
}

/// The combination a terminal is saved with must be one MedBrains can drive.
async fn validate(state: &AppState, t: &PaymentTerminal) -> Result<(), AppError> {
    one_of(&t.kind, TERMINAL_KINDS, "Kind")?;
    one_of(&t.mode, TERMINAL_MODES, "Mode")?;
    one_of(&t.connection, &["cloud", "bridge"], "Connection")?;
    if t.label.trim().is_empty() {
        return Err(AppError::BadRequest("Give the device a label".to_owned()));
    }
    let simulator_ok = simulator::enabled(state.secret_resolver.as_ref()).await;
    let names_simulator =
        t.provider == simulator::PROVIDER || t.adapter.as_deref() == Some(simulator::PROVIDER);
    if names_simulator && !simulator_ok {
        return Err(AppError::BadRequest(
            "The simulator is not available on this server".to_owned(),
        ));
    }
    if t.kind != "pos" {
        return crate::validate_terminal_provider(&t.provider);
    }
    if t.connection == "bridge" {
        let codes: Vec<&str> = BRIDGE_ADAPTERS.iter().map(|(c, _)| *c).collect();
        return one_of(
            t.adapter.as_deref().unwrap_or_default(),
            &codes,
            "Device adapter",
        );
    }
    let codes: Vec<&str> = CLOUD_PROVIDERS.iter().map(|(c, _)| *c).collect();
    one_of(&t.provider, &codes, "Card machine provider")
}

/// The station must be this hospital's.
async fn check_station(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    station: Option<Uuid>,
) -> Result<(), AppError> {
    let Some(id) = station else { return Ok(()) };
    let found: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM stations WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    found
        .map(|_| ())
        .ok_or_else(|| AppError::BadRequest("No such counter".to_owned()))
}

async fn save(tx: &mut Tx<'_>, t: &PaymentTerminal, insert: bool) -> Result<Uuid, AppError> {
    let sql = if insert {
        "INSERT INTO payment_terminals (provider, kind, label, terminal_code, acquiring_bank, \
            station_id, mode, connection, adapter, device_address, is_active, tenant_id, id, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id"
    } else {
        "UPDATE payment_terminals SET provider = $1, kind = $2, label = $3, terminal_code = $4, \
            acquiring_bank = $5, station_id = $6, mode = $7, connection = $8, adapter = $9, \
            device_address = $10, is_active = $11, updated_at = now() \
         WHERE tenant_id = $12 AND id = $13 RETURNING id"
    };
    let query = sqlx::query_scalar(sql)
        .bind(&t.provider)
        .bind(&t.kind)
        .bind(t.label.trim())
        .bind(&t.terminal_code)
        .bind(&t.acquiring_bank)
        .bind(t.station_id)
        .bind(&t.mode)
        .bind(&t.connection)
        .bind(&t.adapter)
        .bind(&t.device_address)
        .bind(t.is_active)
        .bind(t.tenant_id)
        .bind(t.id);
    let query = if insert {
        query.bind(t.created_by)
    } else {
        query
    };
    Ok(query.fetch_one(&mut **tx).await?)
}

/// Lay the request over the terminal as it stands (a new one starts blank).
fn merged(mut t: PaymentTerminal, body: &TerminalInput) -> PaymentTerminal {
    let set = |field: &mut String, v: Option<&String>| {
        if let Some(v) = text(v) {
            v.clone_into(field);
        }
    };
    set(&mut t.provider, body.provider.as_ref());
    set(&mut t.kind, body.kind.as_ref());
    set(&mut t.label, body.label.as_ref());
    set(&mut t.mode, body.mode.as_ref());
    set(&mut t.connection, body.connection.as_ref());
    if body.terminal_code.is_some() {
        t.terminal_code = text(body.terminal_code.as_ref()).map(ToOwned::to_owned);
    }
    if body.acquiring_bank.is_some() {
        t.acquiring_bank = text(body.acquiring_bank.as_ref()).map(ToOwned::to_owned);
    }
    if body.station_id.is_some() {
        t.station_id = body.station_id;
    }
    if t.connection == "bridge" {
        t.adapter = text(body.adapter.as_ref())
            .map(ToOwned::to_owned)
            .or(t.adapter);
        t.device_address = text(body.device_address.as_ref())
            .map(ToOwned::to_owned)
            .or(t.device_address);
    } else {
        (t.adapter, t.device_address) = (None, None);
    }
    if t.provider.is_empty() && t.connection == "bridge" {
        "bridge".clone_into(&mut t.provider);
    }
    t.is_active = body.is_active.unwrap_or(t.is_active);
    t
}

fn blank(claims: &Claims) -> PaymentTerminal {
    let now = chrono::Utc::now();
    PaymentTerminal {
        id: Uuid::new_v4(),
        tenant_id: claims.tenant_id,
        provider: String::new(),
        kind: "pos".to_owned(),
        terminal_code: None,
        acquiring_bank: None,
        station_id: None,
        station_name: None,
        location_id: None,
        label: String::new(),
        mode: "sandbox".to_owned(),
        connection: "cloud".to_owned(),
        adapter: None,
        device_address: None,
        last_seen_at: None,
        status: "unknown".to_owned(),
        last_error: None,
        is_active: true,
        retired_at: None,
        created_by: Some(claims.sub),
        created_at: now,
        updated_at: now,
    }
}

async fn upsert(
    state: &AppState,
    claims: &Claims,
    id: Option<Uuid>,
    body: &TerminalInput,
) -> Result<PaymentTerminal, AppError> {
    require_permission(claims, permissions::billing::terminals::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current = match id {
        Some(id) => load(&mut tx, claims.tenant_id, id)
            .await?
            .ok_or(AppError::NotFound)?,
        None => blank(claims),
    };
    if current.retired_at.is_some() {
        return Err(AppError::Conflict(
            "This terminal is retired; register the new one instead".to_owned(),
        ));
    }
    let t = merged(current, body);
    validate(state, &t).await?;
    check_station(&mut tx, claims.tenant_id, t.station_id).await?;
    let saved = save(&mut tx, &t, id.is_none()).await?;
    let row = load(&mut tx, claims.tenant_id, saved)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(row)
}

/// `POST /api/payments/terminals` — register a device at a counter.
pub async fn create_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<TerminalInput>,
) -> Result<Json<PaymentTerminal>, AppError> {
    if text(body.provider.as_ref()).is_none() && body.connection.as_deref() != Some("bridge") {
        return Err(AppError::BadRequest("Choose the provider".to_owned()));
    }
    upsert(&state, &claims, None, &body).await.map(Json)
}

/// `PUT /api/payments/terminals/{id}` — change a device, or move it.
pub async fn update_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<TerminalInput>,
) -> Result<Json<PaymentTerminal>, AppError> {
    upsert(&state, &claims, Some(id), &body).await.map(Json)
}

/// `POST /api/payments/terminals/{id}/retire` — a replaced machine takes no
/// more sales. Kept, because its past sales name it.
pub async fn retire_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentTerminal>, AppError> {
    require_permission(&claims, permissions::billing::terminals::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE payment_terminals SET is_active = false, retired_at = COALESCE(retired_at, now()) \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if done == 0 {
        return Err(AppError::NotFound);
    }
    let row = load(&mut tx, claims.tenant_id, id)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/payments/terminals/{id}/ping` — does the machine answer? The
/// answer is kept, so the counter shows it too.
pub async fn ping_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentTerminal>, AppError> {
    require_permission(&claims, permissions::billing::terminals::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let terminal = load(&mut tx, claims.tenant_id, id)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    if terminal.kind != "pos" {
        return Err(AppError::BadRequest(
            "Only a card machine can be pinged".to_owned(),
        ));
    }
    let provider = pos::provider_for(&terminal).ok_or_else(|| {
        AppError::ServiceUnavailable(format!("No adapter for '{}'", terminal.provider))
    })?;
    let ctx = Ctx {
        secrets: state.secret_resolver.as_ref(),
        db: &state.db,
        tenant_id: claims.tenant_id,
        terminal: &terminal,
    };
    let answered = provider.ping(&ctx).await.map_err(|e| e.words());
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // A bridge machine's health is what its bridge reports, not a guess here.
    if terminal.connection != "bridge" {
        note_health(&mut tx, id, answered).await?;
    }
    let row = load(&mut tx, claims.tenant_id, id)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

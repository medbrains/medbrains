//! Unified multi-module token / queue system — issue, board, and advance
//! ("call / serve / complete / no-show") for any module + scope, with live
//! WebSocket push to displays (TV / web / mobile).
//!
//! # Why issue_token takes no record check
//!
//! `tokens.patient_id` is NULLABLE — a token can be handed to somebody not yet
//! identified, which is what a queue at a front desk is for. The permission is
//! `front_office.queue.manage`, and **no built-in role holds it**
//! (`scripts/check_permission_reachable.py`), so the handler is bypass-only.
//!
//! **What retires this:** granting the code to a desk role. The token queue
//! then becomes a way to ask whether a named person is here today.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{get,post};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::queue_broadcast::QueueEvent;
use medbrains_server_core::state::AppState;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Token {
    pub id: Uuid,
    pub module: String,
    pub scope: String,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub number: String,
    pub seq: i32,
    pub status: String,
    pub priority: String,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    pub counter_label: Option<String>,
    /// Groups the tokens of one visit, so a patient walking OPD -> lab ->
    /// pharmacy carries a single number instead of three.
    pub visit_id: Option<Uuid>,
    /// The queue that sent this patient here, so completing sends them back.
    pub referred_from_module: Option<String>,
    pub referred_from_scope: Option<String>,
    pub referred_from_scope_id: Option<Uuid>,
    /// Display only: "Back from Laboratory" on the board they return to.
    pub returned_from_label: Option<String>,
    pub returned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub called_at: Option<chrono::DateTime<chrono::Utc>>,
    pub served_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub token_date: chrono::NaiveDate,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

const SELECT: &str = "id, module, scope, scope_id, scope_label, number, seq, status, priority, \
     patient_id, patient_name, entity_type, entity_id, counter_label, visit_id, \
     referred_from_module, referred_from_scope, referred_from_scope_id, \
     returned_from_label, returned_at, called_at, served_at, \
     completed_at, token_date, created_at";

fn token_prefix(module: &str) -> &'static str {
    match module {
        "registration" => "R",
        "opd" => "T",
        "pharmacy" => "P",
        "billing" => "B",
        "lab" => "L",
        "radiology" => "X",
        "dispatch" => "D",
        _ => "Q",
    }
}

/// Tokens default ON; an admin disables a module via tenant_settings
/// (category 'tokens', key '<module>_enabled' -> {"enabled": false}) — so
/// "for some days token may not be needed" is a single toggle.
async fn module_tokens_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    module: &str,
) -> Result<bool, AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'tokens' AND key = $2",
    )
    .bind(tenant_id)
    .bind(format!("{module}_enabled"))
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value
        .and_then(|setting| setting.get("enabled").and_then(serde_json::Value::as_bool))
        .unwrap_or(true))
}

/// Resolve a queue's label from whichever registry owns it, and refuse a scope
/// that points nowhere.
///
/// `scope_id` is an opaque uuid whose meaning depends on `scope`: a department
/// for 'department', a camp counter for 'counter', a station (nurse station,
/// OPD counter, kiosk) for 'station'. A wrong one used to create a queue that
/// appears on no board while still taking tokens — the patients holding them
/// simply become invisible. Scopes with no registry ('global', 'combined') keep
/// the caller's label.
async fn resolve_scope(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    scope: &str,
    scope_id: Option<Uuid>,
    given_label: Option<&str>,
) -> Result<Option<String>, AppError> {
    let Some(scope_id) = scope_id else {
        return Ok(given_label.map(ToOwned::to_owned));
    };
    // A queue can belong to a department, a camp counter, a service point, or
    // any level of the physical tree -- a room, a wing, a floor, a building.
    // `token_scopes` resolves all four, so the only scope left unvalidated is
    // `global`, which has no id to check.
    if !matches!(scope, "department" | "counter" | "station" | "location") {
        return Ok(given_label.map(ToOwned::to_owned));
    }

    let found: Option<(String, bool)> = sqlx::query_as(
        "SELECT label, is_active FROM token_scopes WHERE scope = $1 AND scope_id = $2",
    )
    .bind(scope)
    .bind(scope_id)
    .fetch_optional(&mut **tx)
    .await?;

    match found {
        Some((label, true)) => Ok(Some(label)),
        Some((label, false)) => Err(AppError::BadRequest(format!(
            "{label} is not open for queueing"
        ))),
        None => Err(AppError::BadRequest(format!(
            "No {scope} with id {scope_id}"
        ))),
    }
}

/// The number this visit is already using, if any.
///
/// One visit, one number: a patient sent from the consultation room to the lab
/// and then the pharmacy should be holding one slip, not three. Only `number`
/// is shared — `seq` is still computed per department, so every board calls in
/// its own order exactly as before.
async fn number_for_visit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    visit_id: Option<Uuid>,
) -> Result<Option<String>, AppError> {
    let Some(visit_id) = visit_id else {
        return Ok(None);
    };
    Ok(sqlx::query_scalar(
        "SELECT number FROM tokens WHERE visit_id = $1 ORDER BY created_at LIMIT 1",
    )
    .bind(visit_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// The visit a patient is currently in, if they are in one today.
///
/// Downstream modules — lab, pharmacy, billing — issue tokens long after the
/// visit began and have no visit id of their own. Rather than each deriving one,
/// they ask here: the visit of the patient's most recent live token today.
///
/// Scoped to today and to non-terminal tokens on purpose. A visit that has been
/// completed should not absorb an evening ER attendance into the morning's OPD
/// slip.
pub async fn current_visit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    patient_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT visit_id FROM tokens \
         WHERE patient_id = $1 AND token_date = CURRENT_DATE AND visit_id IS NOT NULL \
           AND status NOT IN ('completed', 'no_show', 'cancelled') \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Fields for auto-issuing a token from a module's trigger handler.
#[derive(Debug)]
pub struct IssueToken<'a> {
    /// Ties this token to a visit so it shares that visit's number. `None`
    /// numbers exactly as before, which is every existing caller.
    pub visit_id: Option<Uuid>,
    pub module: &'a str,
    pub scope: &'a str,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<&'a str>,
    pub priority: &'a str,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<&'a str>,
    pub entity_type: Option<&'a str>,
    pub entity_id: Option<Uuid>,
    pub issued_by: Option<Uuid>,
}

/// Issue a token inside an existing tenant-scoped transaction (auto-issuance
/// from registration / check-in / order / payment). Silently skips when the
/// module's tokens are disabled. Returns the token number (or None if skipped).
pub async fn issue_token_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    input: IssueToken<'_>,
) -> Result<Option<String>, AppError> {
    if !module_tokens_enabled(tx, tenant_id, input.module).await? {
        return Ok(None);
    }
    // Serialise concurrent check-ins for the same queue+day so two callers can't
    // read the same MAX(seq) and mint duplicate token numbers. Transaction-scoped
    // advisory lock, auto-released at commit (tokens has no unique seq constraint).
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtextextended(\
           $1::text || ':' || $2::text || ':' || $3::text || ':' \
           || COALESCE($4::text, '') || ':' || CURRENT_DATE::text, 0))",
    )
    .bind(tenant_id)
    .bind(input.module)
    .bind(input.scope)
    .bind(input.scope_id)
    .execute(&mut **tx)
    .await?;

    let seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM tokens \
         WHERE tenant_id = $1 AND module = $2 AND scope = $3 \
           AND scope_id IS NOT DISTINCT FROM $4 AND token_date = CURRENT_DATE",
    )
    .bind(tenant_id)
    .bind(input.module)
    .bind(input.scope)
    .bind(input.scope_id)
    .fetch_one(&mut **tx)
    .await?;
    // `seq` is this department's own position and is always freshly computed.
    // Only the displayed number is shared, so a visit reads as one slip while
    // every board still calls in its own order.
    let number = number_for_visit(tx, input.visit_id)
        .await?
        .unwrap_or_else(|| format!("{}-{seq:03}", token_prefix(input.module)));

    // Name the queue. Only the manual POST /api/tokens/issue handler resolved
    // its scope, and every automatic path -- OPD check-in, camp registration,
    // the lab, the pharmacy -- passed `scope_label: None`. So a token issued by
    // the system knew which department it belonged to and could not say the
    // name aloud, and the board announced a number to a room it could not
    // name. Resolve it here, where every path goes through.
    let scope_label =
        resolve_scope(tx, input.scope, input.scope_id, input.scope_label).await?;
    sqlx::query(
        "INSERT INTO tokens \
         (tenant_id, module, scope, scope_id, scope_label, number, seq, priority, \
          patient_id, patient_name, entity_type, entity_id, issued_by, visit_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
    )
    .bind(tenant_id)
    .bind(input.module)
    .bind(input.scope)
    .bind(input.scope_id)
    .bind(scope_label.as_deref())
    .bind(&number)
    .bind(seq)
    .bind(input.priority)
    .bind(input.patient_id)
    .bind(input.patient_name)
    .bind(input.entity_type)
    .bind(input.entity_id)
    .bind(input.issued_by)
    .bind(input.visit_id)
    .execute(&mut **tx)
    .await?;
    Ok(Some(number))
}

/// Issue a token only if the patient has no active (non-terminal) token for this
/// module today. For modules where one record ≠ one queue visit (lab issues a
/// row per test, billing a row per invoice) this keeps it to one token per
/// patient per day. Still gated by module enablement inside `issue_token_in_tx`.
pub async fn issue_token_once_per_patient_day(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    input: IssueToken<'_>,
) -> Result<Option<String>, AppError> {
    if let Some(patient_id) = input.patient_id {
        // A second request for the same patient and module on the same day is
        // the same trip to the same counter, so it must not mint a second
        // number. But it can be a more urgent reason to be there: a STAT lab
        // order raised for a patient who already holds a routine collection
        // token used to return here with nothing, leaving them queued at the
        // priority of whatever they walked in for.
        //
        // So the existing token is promoted instead of a new one being issued.
        // The comparison is `token_priority_weight`, the same function the
        // board and call-next sort by, so promotion cannot disagree with the
        // order it is trying to change. Demotion is impossible by
        // construction: a lower-priority second request leaves the token alone.
        let promoted: Option<String> = sqlx::query_scalar(
            "UPDATE tokens SET priority = $4, updated_at = now() \
             WHERE tenant_id = $1 AND module = $2 AND patient_id = $3 \
               AND token_date = CURRENT_DATE \
               AND status NOT IN ('completed', 'no_show', 'cancelled') \
               AND token_priority_weight($4) < token_priority_weight(priority) \
             RETURNING number",
        )
        .bind(tenant_id)
        .bind(input.module)
        .bind(patient_id)
        .bind(input.priority)
        .fetch_optional(&mut **tx)
        .await?;
        if promoted.is_some() {
            return Ok(promoted);
        }

        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM tokens \
             WHERE tenant_id = $1 AND module = $2 AND patient_id = $3 \
               AND token_date = CURRENT_DATE \
               AND status NOT IN ('completed', 'no_show', 'cancelled'))",
        )
        .bind(tenant_id)
        .bind(input.module)
        .bind(patient_id)
        .fetch_one(&mut **tx)
        .await?;
        if exists {
            return Ok(None);
        }
    }
    issue_token_in_tx(tx, tenant_id, input).await
}

async fn broadcast_status(state: &AppState, token: &Token) {
    if let Some(scope_id) = token.scope_id {
        state
            .queue_broadcaster
            .broadcast_queue_event(
                scope_id,
                QueueEvent::TokenStatusChanged {
                    token_number: token.number.clone(),
                    status: token.status.clone(),
                },
            )
            .await;
    }
}

/// Which token to move, and where to.
#[derive(Debug)]
pub struct AdvanceEntityToken<'a> {
    pub module: &'a str,
    pub entity_type: &'a str,
    pub entity_id: Uuid,
    pub status: &'a str,
    pub called_by: Option<Uuid>,
}

/// Move the token attached to a record, inside the caller's transaction.
///
/// A module that keeps its own queue row — OPD keeps `opd_queues` — has to
/// move the token in the same breath, or the two disagree: the desk sees the
/// patient called and every board still shows them waiting. Doing it in the
/// caller's transaction is the point; a second transaction afterwards can
/// fail on its own and leave exactly that split.
///
/// Returns `None` when there is no token for the record, which is normal:
/// tokens are per-day, and rows seeded or created before the module issued
/// them have none. A missing token must not fail the queue action.
///
/// The caller announces the result with [`announce_token`] after committing,
/// because a board told about a change that then rolls back is worse than a
/// board told late.
pub async fn advance_entity_token_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    input: AdvanceEntityToken<'_>,
) -> Result<Option<Token>, AppError> {
    if !VALID_TOKEN_STATUSES.contains(&input.status) {
        return Err(AppError::BadRequest(format!(
            "Invalid token status '{}'",
            input.status
        )));
    }
    let token = sqlx::query_as::<_, Token>(&format!(
        "UPDATE tokens SET status = $5, \
           called_at = CASE WHEN $5 = 'called' THEN now() ELSE called_at END, \
           called_by = CASE WHEN $5 = 'called' THEN $6 ELSE called_by END, \
           served_at = CASE WHEN $5 = 'serving' THEN now() ELSE served_at END, \
           completed_at = CASE WHEN $5 IN ('completed', 'no_show') THEN now() \
                               ELSE completed_at END \
         WHERE tenant_id = $1 AND module = $2 AND entity_type = $3 \
           AND entity_id = $4 AND token_date = CURRENT_DATE \
         RETURNING {SELECT}"
    ))
    .bind(tenant_id)
    .bind(input.module)
    .bind(input.entity_type)
    .bind(input.entity_id)
    .bind(input.status)
    .bind(input.called_by)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(token)
}

/// Tell the boards a token moved. Call after the transaction commits.
///
/// A call is announced rather than merely redrawn: `TokenCalled` is what the
/// waiting-room display turns into a spoken number, and it is the difference
/// between a patient being shown and a patient being fetched.
pub async fn announce_token(state: &AppState, token: &Token) {
    if token.status == "called" {
        if let Some(scope_id) = token.scope_id {
            state
                .queue_broadcaster
                .broadcast_queue_event(
                    scope_id,
                    QueueEvent::TokenCalled {
                        token_number: token.number.clone(),
                        patient_name: token.patient_name.clone().unwrap_or_default(),
                        room: token.scope_label.clone(),
                        counter: token.counter_label.clone(),
                    },
                )
                .await;
        }
        return;
    }
    broadcast_status(state, token).await;
}

// ── Issue ────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct IssueTokenInput {
    /// Ties this token to a visit so it shares that visit's number.
    pub visit_id: Option<Uuid>,
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub priority: Option<String>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<Uuid>,
    /// Set by the room doing the sending ("send this patient to lab"), so that
    /// completing the lab token returns them to that room instead of leaving
    /// them to rejoin the back of a queue they have already waited in.
    pub referred_from_module: Option<String>,
    pub referred_from_scope: Option<String>,
    pub referred_from_scope_id: Option<Uuid>,
    pub referred_from_label: Option<String>,
}

/// POST /api/tokens/issue — issue the next token for a module + scope.
pub async fn issue_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueTokenInput>,
) -> Result<Json<Token>, AppError> {
    require_permission(&claims, permissions::front_office::queue::MANAGE)?;
    let scope = body.scope.unwrap_or_else(|| "department".to_owned());
    let priority = body.priority.unwrap_or_else(|| "normal".to_owned());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    if !module_tokens_enabled(&mut tx, claims.tenant_id, &body.module).await? {
        return Err(AppError::Forbidden);
    }

    // Refuse a queue that points nowhere, and take the label from the registry
    // so a counter renamed mid-camp does not leave stale labels on the board.
    let scope_label =
        resolve_scope(&mut tx, &scope, body.scope_id, body.scope_label.as_deref()).await?;

    // Serialise concurrent check-ins for the same queue+day (see issue_token_in_tx)
    // so two callers can't compute the same MAX(seq) and mint duplicate tokens.
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtextextended(\
           $1::text || ':' || $2::text || ':' || $3::text || ':' \
           || COALESCE($4::text, '') || ':' || CURRENT_DATE::text, 0))",
    )
    .bind(claims.tenant_id)
    .bind(&body.module)
    .bind(&scope)
    .bind(body.scope_id)
    .execute(&mut *tx)
    .await?;

    let seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM tokens \
         WHERE tenant_id = $1 AND module = $2 AND scope = $3 \
           AND scope_id IS NOT DISTINCT FROM $4 AND token_date = CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .bind(&body.module)
    .bind(&scope)
    .bind(body.scope_id)
    .fetch_one(&mut *tx)
    .await?;

    let number = number_for_visit(&mut tx, body.visit_id)
        .await?
        .unwrap_or_else(|| format!("{}-{seq:03}", token_prefix(&body.module)));

    let token = sqlx::query_as::<_, Token>(&format!(
        "INSERT INTO tokens \
         (tenant_id, module, scope, scope_id, scope_label, number, seq, priority, \
          patient_id, patient_name, entity_type, entity_id, issued_by, \
          referred_from_module, referred_from_scope, referred_from_scope_id, visit_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) \
         RETURNING {SELECT}"
    ))
    .bind(claims.tenant_id)
    .bind(&body.module)
    .bind(&scope)
    .bind(body.scope_id)
    .bind(&scope_label)
    .bind(&number)
    .bind(seq)
    .bind(&priority)
    .bind(body.patient_id)
    .bind(&body.patient_name)
    .bind(&body.entity_type)
    .bind(body.entity_id)
    .bind(claims.sub)
    .bind(&body.referred_from_module)
    .bind(&body.referred_from_scope)
    .bind(body.referred_from_scope_id)
    .bind(body.visit_id)
    .fetch_one(&mut *tx)
    .await?;

    // Remember the sending room's name for the badge on the board they go back
    // to; it is the referrer's label, which only the caller knows.
    if let Some(label) = &body.referred_from_label {
        sqlx::query("UPDATE tokens SET returned_from_label = $2 WHERE id = $1")
            .bind(token.id)
            .bind(label)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    broadcast_status(&state, &token).await;
    Ok(Json(token))
}

// ── Board ────────────────────────────────────────────────────────
#[derive(Debug, Deserialize)]
pub struct BoardQuery {
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
    /// Include today's finished tokens — completed and no-show.
    ///
    /// A working console wants the live queue and nothing else. A wall board
    /// wants a little more: the number just called stays up while the patient
    /// walks to the room, and a missed token has to stay visible long enough
    /// for someone who stepped out for five minutes to come back and find out
    /// what happened rather than a screen that has forgotten them.
    ///
    /// Off by default, so every existing caller sees exactly what it saw.
    #[serde(default)]
    pub include_finished: bool,
}

/// GET /api/tokens/board — live tokens (waiting/called/serving) for a board.
pub async fn list_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<BoardQuery>,
) -> Result<Json<Vec<Token>>, AppError> {
    // A desk reads the board it works; a screen on a wall reads the board it
    // shows. Without the second route the TV modules cannot move off
    // `queue_tokens`, because a display holds no front-office code — which is
    // the whole of step 3.
    if medbrains_server_core::middleware::authorization::require_board_read(&claims).is_err() {
        require_permission(&claims, permissions::front_office::queue::LIST)?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let tokens = sqlx::query_as::<_, Token>(&format!(
        "SELECT {SELECT} FROM tokens \
         WHERE module = $1 AND token_date = CURRENT_DATE \
           AND ($2::text IS NULL OR scope = $2) \
           AND ($3::uuid IS NULL OR scope_id = $3) \
           AND (status IN ('waiting', 'called', 'serving') \
                OR ($4::bool AND status IN ('completed', 'no_show'))) \
         ORDER BY token_priority_weight(priority), seq ASC"
    ))
    .bind(&query.module)
    .bind(&query.scope)
    .bind(query.scope_id)
    .bind(query.include_finished)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(tokens))
}

/// One queue row as the clinician working it needs to see it.
///
/// The same `tokens` row the board shows, plus who the patient is. A wall
/// board gets `/api/tokens/board`, which carries no name and is enforced
/// token-only by a test; a doctor calling the next patient needs the name, the
/// UHID and the encounter to open. Two reads of one queue, rather than the two
/// queues this replaces.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorklistToken {
    pub id: Uuid,
    pub number: String,
    pub seq: i32,
    pub status: String,
    pub priority: String,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub counter_label: Option<String>,
    pub called_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub patient_id: Option<Uuid>,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    /// The clinical record this token is a queue position for.
    ///
    /// Null on a token issued before the encounter existed, and on modules
    /// whose tokens name something else entirely.
    pub encounter_id: Option<Uuid>,
}

/// Who may read a queue as a worklist — with the patient on it.
///
/// The board's code is not enough. `display.board.read` belongs to a screen in
/// a corridor and this read carries a name and a UHID, so a display holding it
/// must not reach here. The clinical codes are the module's own: `opd.queue.list`
/// for OPD, held by doctor, nurse, receptionist and the audit roles, falling
/// through to the desk's `front_office.queue.list` for every other queue.
fn require_queue_worklist(claims: &Claims, module: &str) -> Result<(), AppError> {
    if module == "opd" && require_permission(claims, permissions::opd::queue::LIST).is_ok() {
        return Ok(());
    }
    require_permission(claims, permissions::front_office::queue::LIST)
}

/// GET /api/tokens/worklist — the queue with the patients on it.
///
/// # Why no per-record check
///
/// A queue is a place's list, not a person's record: the point of it is the
/// patient the clinician has not met yet, and filtering by permitted patients
/// would empty the worklist for exactly the person it exists to serve — the
/// doctor about to call the next name. It is scoped by permission, by module
/// and by queue instead. This is the same reasoning the ward call board carries,
/// and the opposite of a per-patient record read.
pub async fn list_worklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<BoardQuery>,
) -> Result<Json<Vec<WorklistToken>>, AppError> {
    require_queue_worklist(&claims, &query.module)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // One statement. A worklist that fetched each patient separately would be
    // N+1 on the screen a clinic refreshes most.
    let rows = sqlx::query_as::<_, WorklistToken>(
        "SELECT t.id, t.number, t.seq, t.status, t.priority, t.scope_id, t.scope_label, \
                t.counter_label, t.called_at, t.created_at, t.patient_id, \
                CONCAT_WS(' ', p.first_name, NULLIF(p.last_name, '')) AS patient_name, \
                p.uhid, \
                CASE WHEN t.entity_type = 'encounter' THEN t.entity_id END AS encounter_id \
           FROM tokens t \
           LEFT JOIN patients p ON p.id = t.patient_id \
          WHERE t.module = $1 AND t.token_date = CURRENT_DATE \
            AND ($2::text IS NULL OR t.scope = $2) \
            AND ($3::uuid IS NULL OR t.scope_id = $3) \
            AND (t.status IN ('waiting', 'called', 'serving') \
                 OR ($4::bool AND t.status IN ('completed', 'no_show'))) \
          ORDER BY token_priority_weight(t.priority), t.seq ASC \
          LIMIT 500",
    )
    .bind(&query.module)
    .bind(&query.scope)
    .bind(query.scope_id)
    .bind(query.include_finished)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// The two numbers a board shows beside the tokens.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BoardMetrics {
    pub waiting: i64,
    /// Mean minutes from issue to call, over today's tokens that were called.
    ///
    /// `NULL` until one has been called, and rendered as a dash rather than
    /// zero: a waiting room told the average wait is nought minutes at eight in
    /// the morning learns something false about the day ahead.
    pub avg_wait_minutes: Option<f64>,
}

/// GET /api/tokens/board/metrics — the counts that sit above a board.
///
/// One statement, both numbers. A board refreshing every few seconds on a
/// screen nobody is standing at is the last place to spend two round trips on
/// two integers.
pub async fn board_metrics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<BoardQuery>,
) -> Result<Json<BoardMetrics>, AppError> {
    if medbrains_server_core::middleware::authorization::require_board_read(&claims).is_err() {
        require_permission(&claims, permissions::front_office::queue::LIST)?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let metrics = sqlx::query_as::<_, BoardMetrics>(
        "SELECT \
           COUNT(*) FILTER (WHERE status = 'waiting') AS waiting, \
           AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60.0) \
             FILTER (WHERE called_at IS NOT NULL)::float8 AS avg_wait_minutes \
         FROM tokens \
         WHERE module = $1 AND token_date = CURRENT_DATE \
           AND ($2::text IS NULL OR scope = $2) \
           AND ($3::uuid IS NULL OR scope_id = $3)",
    )
    .bind(&query.module)
    .bind(&query.scope)
    .bind(query.scope_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(metrics))
}

/// One token as the patient sees it: the queue row plus how many are ahead.
///
/// `serde(flatten)` as well as `sqlx(flatten)`: the JSON must stay the shape the
/// clients already read, gaining `ahead` beside the token's own fields rather
/// than nesting the whole token one level down and breaking every caller.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MyToken {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub token: Token,
    /// People this department will call before them — priority first, then
    /// `seq`, the same order `call_next` uses.
    ///
    /// Without this a shared visit number is unreadable on a board: "now
    /// serving V-087" tells someone holding V-087 nothing about their turn,
    /// where a per-department number at least implied a distance.
    pub ahead: i64,
}

/// GET /api/tokens/mine — every live token for a patient today, with position.
pub async fn my_tokens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<MyTokensQuery>,
) -> Result<Json<Vec<MyToken>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let tokens = sqlx::query_as::<_, MyToken>(&format!(
        "SELECT {SELECT}, ( \
           SELECT COUNT(*) FROM tokens ahead \
            WHERE ahead.module = t.module \
              AND ahead.scope = t.scope \
              AND ahead.scope_id IS NOT DISTINCT FROM t.scope_id \
              AND ahead.token_date = t.token_date \
              AND ahead.status = 'waiting' \
              AND (token_priority_weight(ahead.priority), \
                   ahead.seq) \
                < (token_priority_weight(t.priority), t.seq) \
         ) AS ahead \
         FROM tokens t \
         WHERE t.patient_id = $1 AND t.token_date = CURRENT_DATE \
           AND t.status IN ('waiting', 'called', 'serving') \
         ORDER BY t.created_at"
    ))
    .bind(query.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(tokens))
}

#[derive(Debug, Deserialize)]
pub struct MyTokensQuery {
    pub patient_id: Uuid,
}

// ── Advance (call / serve / complete / no-show) ──────────────────
#[derive(Debug, Deserialize)]
pub struct CallTokenInput {
    pub counter_label: Option<String>,
}

const VALID_TOKEN_STATUSES: [&str; 6] =
    ["waiting", "called", "serving", "completed", "no_show", "cancelled"];

/// Who may work a queue, by the module it belongs to.
///
/// `front_office.queue.manage` is the desk's code: it works any module's
/// queue, which is what a front office does. It is held by no role today, so
/// on its own it made the whole unified token system — call, serve, complete,
/// no-show, call-next — unreachable by anyone but a bypass account. The same
/// was true of the TV token endpoints. The only OPD queue anybody could
/// actually advance was `opd_queues`, which no board reads.
///
/// An OPD consultation queue is also worked by the clinician in the room, and
/// `opd.token.manage` — held by doctor and receptionist — has always been that
/// permission. It gated exactly this act on `opd_queues`; a unified token with
/// `module = 'opd'` is the same act on the table meant to replace it.
/// Accepting it here is what porting the doctor's call path means at the
/// authorization layer, and it widens nothing: no one gains a queue they could
/// not already call.
fn require_queue_manage(claims: &Claims, module: &str) -> Result<(), AppError> {
    if module == "opd" && require_permission(claims, permissions::opd::TOKEN_MANAGE).is_ok() {
        return Ok(());
    }
    // Falls through so a caller working a non-OPD queue is told about the code
    // that would actually let them, rather than about OPD.
    require_permission(claims, permissions::front_office::queue::MANAGE)
}

async fn transition(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    status: &str,
    counter_label: Option<String>,
) -> Result<Token, AppError> {
    // `status` reaches here from advance_token as an arbitrary client string
    // (tokens.status is a plain text column with no CHECK). Reject anything
    // outside the queue lifecycle so a caller can't set 'foo' or skip states.
    if !VALID_TOKEN_STATUSES.contains(&status) {
        return Err(AppError::BadRequest(format!(
            "Invalid token status '{status}'"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The permission depends on which queue this token is in, so the module has
    // to be read before the write. A token's module never changes, so there is
    // nothing to lock against between the two statements.
    let module = sqlx::query_scalar::<_, String>("SELECT module FROM tokens WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    require_queue_manage(claims, &module)?;

    let token = sqlx::query_as::<_, Token>(&format!(
        "UPDATE tokens SET status = $2, \
           called_at = CASE WHEN $2 = 'called' THEN now() ELSE called_at END, \
           called_by = CASE WHEN $2 = 'called' THEN $3 ELSE called_by END, \
           counter_label = COALESCE($4, counter_label), \
           served_at = CASE WHEN $2 = 'serving' THEN now() ELSE served_at END, \
           completed_at = CASE WHEN $2 IN ('completed', 'no_show') THEN now() ELSE completed_at END \
         WHERE id = $1 RETURNING {SELECT}"
    ))
    .bind(id)
    .bind(status)
    .bind(claims.sub)
    .bind(counter_label)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // A referral that is finished sends the patient back where they came from,
    // in front of the queue rather than at the end of it: they already waited
    // their turn once, and the room that sent them is expecting the result.
    let returned_to = if status == "completed" {
        return_to_referrer(&mut tx, claims, &token).await?
    } else {
        None
    };

    tx.commit().await?;

    // The receiving board has a new head of queue; tell it so the doctor's
    // screen does not wait for its next poll.
    if let Some(scope_id) = returned_to {
        state
            .queue_broadcaster
            .broadcast_queue_event(
                scope_id,
                QueueEvent::TokenStatusChanged {
                    token_number: token.number.clone(),
                    status: "waiting".to_owned(),
                },
            )
            .await;
    }

    if status == "called" {
        if let Some(scope_id) = token.scope_id {
            state
                .queue_broadcaster
                .broadcast_queue_event(
                    scope_id,
                    QueueEvent::TokenCalled {
                        token_number: token.number.clone(),
                        patient_name: token.patient_name.clone().unwrap_or_default(),
                        room: token.scope_label.clone(),
                        counter: token.counter_label.clone(),
                    },
                )
                .await;
        }
    } else {
        broadcast_status(state, &token).await;
    }
    Ok(token)
}

/// POST /api/tokens/{id}/call
pub async fn call_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CallTokenInput>,
) -> Result<Json<Token>, AppError> {
    Ok(Json(transition(&state, &claims, id, "called", body.counter_label).await?))
}

/// POST /api/tokens/{id}/serve
pub async fn serve_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {
    Ok(Json(transition(&state, &claims, id, "serving", None).await?))
}

/// POST /api/tokens/{id}/complete
pub async fn complete_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {
    Ok(Json(transition(&state, &claims, id, "completed", None).await?))
}

/// POST /api/tokens/{id}/no-show
pub async fn no_show_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {
    Ok(Json(transition(&state, &claims, id, "no_show", None).await?))
}

// ── Generic advance + call-next (drives the per-module workflow console) ──
#[derive(Debug, Deserialize)]
pub struct AdvanceTokenInput {
    pub status: String,
    pub counter_label: Option<String>,
}

/// POST /api/tokens/{id}/advance — set any workflow status (the per-module
/// workflow config decides which transitions a role may perform).
pub async fn advance_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdvanceTokenInput>,
) -> Result<Json<Token>, AppError> {
    Ok(Json(transition(&state, &claims, id, &body.status, body.counter_label).await?))
}

#[derive(Debug, Deserialize)]
pub struct CallNextInput {
    pub module: String,
    pub scope: Option<String>,
    pub scope_id: Option<Uuid>,
    pub counter_label: Option<String>,
}

/// POST /api/tokens/call-next — call the next waiting token in a scope (the
/// staff "Call next"); returns null when the queue is empty.
pub async fn call_next(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CallNextInput>,
) -> Result<Json<Option<Token>>, AppError> {
    require_queue_manage(&claims, &body.module)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let next_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tokens \
         WHERE module = $1 AND token_date = CURRENT_DATE AND status = 'waiting' \
           AND ($2::text IS NULL OR scope = $2) AND ($3::uuid IS NULL OR scope_id = $3) \
         ORDER BY token_priority_weight(priority), seq ASC \
         LIMIT 1",
    )
    .bind(&body.module)
    .bind(&body.scope)
    .bind(body.scope_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    match next_id {
        Some(id) => {
            let token = transition(&state, &claims, id, "called", body.counter_label).await?;
            Ok(Json(Some(token)))
        }
        None => Ok(Json(None)),
    }
}

/// Put the patient back in the queue that referred them, ahead of the people
/// still waiting. Returns the scope that received them, if any.
///
/// Position is expressed by moving `seq` below the current minimum rather than
/// by raising `priority`: priority is a clinical judgement (`stat` / `urgent`)
/// and a lab result coming back is not one. `number` is a stored column, so the
/// token printed on the patient's slip is unchanged by the move.
async fn return_to_referrer(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    token: &Token,
) -> Result<Option<Uuid>, AppError> {
    let (Some(module), Some(scope)) = (&token.referred_from_module, &token.referred_from_scope)
    else {
        return Ok(None);
    };
    let Some(patient_id) = token.patient_id else {
        return Ok(None);
    };

    // Serialise against a concurrent call-next on the receiving queue, so the
    // returning patient cannot land on a seq another writer is also computing.
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtextextended(\
           $1::text || ':' || $2::text || ':' || $3::text || ':' \
           || COALESCE($4::text, '') || ':' || CURRENT_DATE::text, 0))",
    )
    .bind(claims.tenant_id)
    .bind(module)
    .bind(scope)
    .bind(token.referred_from_scope_id)
    .execute(&mut **tx)
    .await?;

    let front: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MIN(seq), 1) - 1 FROM tokens \
         WHERE module = $1 AND scope = $2 AND scope_id IS NOT DISTINCT FROM $3 \
           AND token_date = CURRENT_DATE",
    )
    .bind(module)
    .bind(scope)
    .bind(token.referred_from_scope_id)
    .fetch_one(&mut **tx)
    .await?;

    // Reuse the token that room already gave them if it is still today's, so
    // the number on their slip keeps working. Their most recent one: a patient
    // sent out and back twice should return to the same token both times.
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tokens \
         WHERE patient_id = $1 AND module = $2 AND scope = $3 \
           AND scope_id IS NOT DISTINCT FROM $4 AND token_date = CURRENT_DATE \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .bind(module)
    .bind(scope)
    .bind(token.referred_from_scope_id)
    .fetch_optional(&mut **tx)
    .await?;

    let label = token
        .scope_label
        .clone()
        .unwrap_or_else(|| token.module.clone());

    if let Some(back_id) = existing {
        sqlx::query(
            "UPDATE tokens SET status = 'waiting', seq = $2, returned_from_label = $3, \
               returned_at = now(), called_at = NULL, served_at = NULL, completed_at = NULL \
             WHERE id = $1",
        )
        .bind(back_id)
        .bind(front)
        .bind(&label)
        .execute(&mut **tx)
        .await?;
    } else {
        // They were referred without ever holding a token there (sent straight
        // from registration, say). Mint one, still at the front.
        let number = format!("{}-{:03}", token_prefix(module), front.max(0));
        sqlx::query(
            "INSERT INTO tokens \
             (tenant_id, module, scope, scope_id, number, seq, priority, patient_id, \
              patient_name, issued_by, returned_from_label, returned_at) \
             VALUES ($1, $2, $3, $4, $5, $6, 'normal', $7, $8, $9, $10, now())",
        )
        .bind(claims.tenant_id)
        .bind(module)
        .bind(scope)
        .bind(token.referred_from_scope_id)
        .bind(&number)
        .bind(front)
        .bind(patient_id)
        .bind(&token.patient_name)
        .bind(claims.sub)
        .bind(&label)
        .execute(&mut **tx)
        .await?;
    }

    Ok(token.referred_from_scope_id)
}

/// How many patients a hospital lets a returning no-show wait behind.
///
/// Absent — the default, and what every tenant gets until they say otherwise —
/// means the back of the queue. A number means the patient is put back that far
/// down: "recall after 3" is the common desk practice of not making someone who
/// stepped out for two minutes sit through the whole afternoon again.
///
/// Read per requeue rather than cached: it changes at a settings screen, not at
/// a rate worth holding state for.
async fn missed_token_recall_after(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Option<i64>, AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'queue' \
           AND key = 'missed_token_recall_after' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(tx.as_mut())
    .await?;

    // A malformed setting means back of queue, not an error: a bad row in a
    // config table must not stop a patient being put back in the queue.
    Ok(value
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .filter(|n| *n > 0))
}

/// POST /api/tokens/{id}/requeue — a no-show who came back.
///
/// Where they land is the hospital's policy, not ours. By default they go to
/// the *end*: putting them back where they were means the room calls the same
/// absent name again a moment later. A hospital that sets
/// `queue.missed_token_recall_after` gets the kinder desk practice instead —
/// the patient waits behind that many people and no more.
///
/// The token number is untouched either way, so the slip in their hand and the
/// link on their phone both keep working.
pub async fn requeue_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Token>, AppError> {

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let recall_after = missed_token_recall_after(&mut tx, claims.tenant_id).await?;

    // Read the token first: its queue decides which lock to take, and the
    // position arithmetic below needs to run inside that lock.
    let existing = sqlx::query_as::<_, Token>(&format!(
        "SELECT {SELECT} FROM tokens WHERE id = $1 AND token_date = CURRENT_DATE"
    ))
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // Same queue, same permission as calling from it — checked once the row has
    // said which queue that is.
    require_queue_manage(&claims, &existing.module)?;

    // Serialise against a concurrent issue or call-next on this queue: both
    // read the same sequence this is about to renumber.
    sqlx::query(
        "SELECT pg_advisory_xact_lock(hashtextextended(\
           $1::text || ':' || $2::text || ':' || $3::text || ':' \
           || COALESCE($4::text, '') || ':' || CURRENT_DATE::text, 0))",
    )
    .bind(claims.tenant_id)
    .bind(&existing.module)
    .bind(&existing.scope)
    .bind(existing.scope_id)
    .execute(&mut *tx)
    .await?;

    let seq = match recall_after {
        Some(after) => place_after(&mut tx, &existing, after).await?,
        None => None,
    };

    // Placed mid-queue: everything from that point on has already been shifted
    // up by one, so this seq is free.
    let placed = format!(
        "UPDATE tokens SET status = 'waiting', called_at = NULL, served_at = NULL, \
           completed_at = NULL, seq = $2 \
         WHERE id = $1 AND token_date = CURRENT_DATE RETURNING {SELECT}"
    );
    // Back of the queue — the default, and the fallback whenever there are not
    // enough people waiting to hold a place in the middle.
    let back = format!(
        "UPDATE tokens SET status = 'waiting', called_at = NULL, served_at = NULL, \
           completed_at = NULL, \
           seq = (SELECT COALESCE(MAX(t.seq), 0) + 1 FROM tokens t \
                   WHERE t.module = tokens.module AND t.scope = tokens.scope \
                     AND t.scope_id IS NOT DISTINCT FROM tokens.scope_id \
                     AND t.token_date = tokens.token_date) \
         WHERE id = $1 AND token_date = CURRENT_DATE RETURNING {SELECT}"
    );

    let token = seq
        .map_or_else(
            || sqlx::query_as::<_, Token>(&back).bind(id),
            |seq| sqlx::query_as::<_, Token>(&placed).bind(id).bind(seq),
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    broadcast_status(&state, &token).await;
    Ok(Json(token))
}

/// Open a place in the queue with exactly `after` patients ahead, and return
/// the seq that place now occupies.
///
/// Returns `None` when fewer than `after` are waiting — there is no fourth
/// place to hold in a queue of two, and the back is the honest answer.
///
/// Everyone from the opened place onwards moves up by one. Their order relative
/// to each other is untouched, so nobody who was already waiting is reordered
/// against anybody else — they each simply lose one place to the returning
/// patient, which is the whole point of the policy.
async fn place_after(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    token: &Token,
    after: i64,
) -> Result<Option<i32>, AppError> {
    // The seq of the last token that should still be called before this one,
    // counted the way the queue is actually called.
    let boundary: Option<i32> = sqlx::query_scalar(
        "WITH ordered AS ( \
           SELECT seq, row_number() OVER ( \
                    ORDER BY token_priority_weight(priority), \
                             seq \
                  ) AS rn \
             FROM tokens \
            WHERE module = $1 AND scope = $2 AND scope_id IS NOT DISTINCT FROM $3 \
              AND token_date = CURRENT_DATE AND status = 'waiting' AND id <> $4 \
         ) SELECT seq FROM ordered WHERE rn = $5",
    )
    .bind(&token.module)
    .bind(&token.scope)
    .bind(token.scope_id)
    .bind(token.id)
    .bind(after)
    .fetch_optional(tx.as_mut())
    .await?;

    let Some(boundary) = boundary else {
        return Ok(None);
    };

    // `tokens.seq` carries no unique index, so opening the gap is a single
    // bulk update. (`queue_tokens` could not be renumbered this way — it holds
    // a unique constraint on its sequence.)
    sqlx::query(
        "UPDATE tokens SET seq = seq + 1 \
          WHERE module = $1 AND scope = $2 AND scope_id IS NOT DISTINCT FROM $3 \
            AND token_date = CURRENT_DATE AND seq > $4 AND id <> $5",
    )
    .bind(&token.module)
    .bind(&token.scope)
    .bind(token.scope_id)
    .bind(boundary)
    .bind(token.id)
    .execute(tx.as_mut())
    .await?;

    Ok(Some(boundary + 1))
}

// ── Camp board (every room in one call) ──────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampBoardRow {
    pub department_id: Uuid,
    pub department: String,
    /// From camp planning, when a counter is mapped to this department.
    pub counter_name: Option<String>,
    pub location_label: Option<String>,
    pub capacity_per_hour: Option<i32>,
    /// Who is on duty here right now — doctors rostered to the department and
    /// staff rostered to the counter. An array because a station can be run by
    /// more than one: the gynecology room at a real camp has two doctors, and a
    /// vitals counter has as many nurses as it has chairs.
    pub staff: Vec<String>,
    /// Tokens with a patient in the room. More than one is normal: a vitals
    /// counter staffed by three nurses sees three at a time.
    pub serving: Vec<String>,
    pub waiting: i64,
    pub completed: i64,
}

#[derive(Debug, Deserialize)]
pub struct CampBoardQuery {
    pub camp_id: Uuid,
}

/// GET /api/tokens/camp-board — every department in a camp with its live queue.
///
/// Reads `opd_queues`, which is what a camp actually writes: registration calls
/// `open_registration_encounter`, which inserts there. It deliberately does not
/// read `public.tokens` — no camp code path writes to it, so a board built on
/// that table reports every room empty all day.
///
/// The room detail (counter name, location, planned capacity) comes from camp
/// planning via `camp_department_counters`, so the board is whatever the camp
/// plan says it is, including a department mapped an hour ago. Cancelled and
/// closed mappings drop out; a room still being set up stays, showing zero.
///
/// Staffing comes from both rosters, because the two are keyed differently and
/// a camp needs both: `camp_doctor_roster` attaches a doctor to a **department**,
/// `camp_staff_roster` attaches a nurse or technician to a **counter**. A vitals
/// or pharmacy counter has no doctor rostered at all, so reading only the doctor
/// roster would show those rows unstaffed all day.
///
/// Both are narrowed to whoever is on duty at this moment, so the board does not
/// name someone who has gone home. Both are correlated subqueries rather than
/// joins on purpose: joining a department staffed by two doctors would duplicate
/// its queue rows and double every count on the board.
pub async fn camp_board(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<CampBoardQuery>,
) -> Result<Json<Vec<CampBoardRow>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The queue lives on the department (`opd_queues.department_id`), so the
    // board is one row per department and the counts are aggregated exactly
    // once. Everything about the room and its staff is a correlated subquery:
    // grouping by counter as well would give a department with two counters two
    // rows, each reporting the whole department's queue.
    let rows = sqlx::query_as::<_, CampBoardRow>(
        "SELECT d.id AS department_id, d.name AS department, \
                ( SELECT string_agg(c.counter_name, ', ' ORDER BY c.counter_name) \
                    FROM camp_department_counters m \
                    JOIN camp_counters c ON c.id = m.counter_id AND c.deleted_at IS NULL \
                   WHERE m.camp_id = $1 AND m.department_id = d.id \
                     AND m.deleted_at IS NULL ) AS counter_name, \
                ( SELECT string_agg(DISTINCT c.location_label, ', ') \
                    FROM camp_department_counters m \
                    JOIN camp_counters c ON c.id = m.counter_id AND c.deleted_at IS NULL \
                   WHERE m.camp_id = $1 AND m.department_id = d.id \
                     AND m.deleted_at IS NULL ) AS location_label, \
                ( SELECT SUM(c.capacity_per_hour)::int \
                    FROM camp_department_counters m \
                    JOIN camp_counters c ON c.id = m.counter_id AND c.deleted_at IS NULL \
                   WHERE m.camp_id = $1 AND m.department_id = d.id \
                     AND m.deleted_at IS NULL ) AS capacity_per_hour, \
                COALESCE(( \
                  SELECT ARRAY_AGG(name ORDER BY name) FROM ( \
                    SELECT u.full_name || \
                           COALESCE(' (' || NULLIF(u.qualification, '') || ')', '') AS name \
                      FROM camp_doctor_roster r \
                      JOIN users u ON u.id = r.doctor_id \
                     WHERE r.camp_id = $1 \
                       AND r.department_id = d.id \
                       AND r.deleted_at IS NULL \
                       AND r.status NOT IN ('cancelled', 'completed') \
                       AND (r.duty_start IS NULL OR r.duty_start <= now()) \
                       AND (r.duty_end   IS NULL OR r.duty_end   >= now()) \
                    UNION ALL \
                    SELECT btrim(e.first_name || ' ' || COALESCE(e.last_name, '')) || \
                           COALESCE(' — ' || NULLIF(sr.role_in_camp, ''), '') \
                      FROM camp_staff_roster sr \
                      JOIN employees e ON e.id = sr.employee_id \
                     WHERE sr.camp_id = $1 \
                       AND sr.deleted_at IS NULL \
                       AND sr.status NOT IN ('cancelled', 'completed') \
                       AND (sr.duty_start IS NULL OR sr.duty_start <= now()) \
                       AND (sr.duty_end   IS NULL OR sr.duty_end   >= now()) \
                       AND sr.counter_id IN ( \
                             SELECT m.counter_id FROM camp_department_counters m \
                              WHERE m.camp_id = $1 AND m.department_id = d.id \
                                AND m.deleted_at IS NULL ) \
                  ) on_duty), '{}') AS staff, \
                COALESCE(ARRAY_AGG(q.token_number::text ORDER BY q.called_at) \
                         FILTER (WHERE q.status IN ('called', 'in_consultation')), '{}') \
                  AS serving, \
                COUNT(*) FILTER (WHERE q.status = 'waiting')   AS waiting, \
                COUNT(*) FILTER (WHERE q.status = 'completed') AS completed \
           FROM camp_department_counters cdc \
           JOIN departments d ON d.id = cdc.department_id \
           LEFT JOIN opd_queues q \
                  ON q.department_id = d.id AND q.queue_date = CURRENT_DATE \
          WHERE cdc.camp_id = $1 \
            AND cdc.deleted_at IS NULL \
            AND cdc.status NOT IN ('cancelled', 'closed') \
          GROUP BY d.id, d.name \
          ORDER BY d.name",
    )
    .bind(query.camp_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Queue token routes (issue, board, call-next, advance, serve, complete).
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/tokens/issue", post(issue_token))
        .route("/api/tokens/board", get(list_board))
        .route("/api/tokens/board/metrics", get(board_metrics))
        .route("/api/tokens/worklist", get(list_worklist))
        .route("/api/tokens/camp-board", get(camp_board))
        .route("/api/tokens/mine", get(my_tokens))
        .route("/api/tokens/call-next", post(call_next))
        .route("/api/tokens/{id}/advance", post(advance_token))
        .route("/api/tokens/{id}/call", post(call_token))
        .route("/api/tokens/{id}/serve", post(serve_token))
        .route("/api/tokens/{id}/complete", post(complete_token))
        .route("/api/tokens/{id}/no-show", post(no_show_token))
        .route("/api/tokens/{id}/requeue", post(requeue_token))
}

#[cfg(test)]
mod queue_permission_tests {
    use super::{require_queue_manage, require_queue_worklist};
    use medbrains_server_core::middleware::auth::Claims;

    fn claims(permissions: &[&str]) -> Claims {
        Claims {
            sub: uuid::Uuid::nil(),
            tenant_id: uuid::Uuid::nil(),
            role: "doctor".to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            exp: 0,
        }
    }

    #[test]
    fn a_doctor_can_call_the_next_patient_in_their_own_opd_queue() {
        // opd.token.manage is held by doctor and receptionist and has always
        // gated this act on opd_queues. If this stops passing, the unified
        // queue goes back to being advanceable only by a bypass account.
        assert!(require_queue_manage(&claims(&["opd.token.manage"]), "opd").is_ok());
    }

    #[test]
    fn the_opd_code_does_not_open_the_pharmacy_or_lab_queue() {
        // The whole reason this is per-module. A clinician calling their own
        // consultation queue must not thereby run the pharmacy counter.
        assert!(require_queue_manage(&claims(&["opd.token.manage"]), "pharmacy").is_err());
        assert!(require_queue_manage(&claims(&["opd.token.manage"]), "lab").is_err());
    }

    #[test]
    fn the_desk_code_works_every_queue() {
        for module in ["opd", "pharmacy", "lab", "billing"] {
            assert!(require_queue_manage(&claims(&["front_office.queue.manage"]), module).is_ok());
        }
    }

    #[test]
    fn holding_neither_is_refused() {
        assert!(require_queue_manage(&claims(&["front_office.queue.list"]), "opd").is_err());
    }

    #[test]
    fn a_clinician_reads_the_opd_worklist() {
        assert!(require_queue_worklist(&claims(&["opd.queue.list"]), "opd").is_ok());
    }

    #[test]
    fn a_wall_display_never_reads_the_worklist() {
        // The board's code reaches /tokens/board, which carries no name. This
        // read carries a name and a UHID, and a screen in a corridor holding a
        // credential that reached it would be the whole point of the split
        // undone.
        assert!(require_queue_worklist(&claims(&["display.board.read"]), "opd").is_err());
    }

    #[test]
    fn the_opd_read_does_not_open_another_module_s_worklist() {
        assert!(require_queue_worklist(&claims(&["opd.queue.list"]), "pharmacy").is_err());
    }

    #[test]
    fn the_desk_reads_every_worklist() {
        for module in ["opd", "pharmacy", "lab"] {
            assert!(require_queue_worklist(&claims(&["front_office.queue.list"]), module).is_ok());
        }
    }
}

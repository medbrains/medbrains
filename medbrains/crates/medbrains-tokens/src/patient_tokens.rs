//! A patient's live tokens today, as the desk looks them up.
//!
//! `GET /api/tokens/by-patient?patient_id=` — a staff lookup. It used to be
//! `/api/tokens/mine`, but it never resolved "mine" from the caller: it took
//! any patient id from the query string behind a queue-board permission, and
//! filtered on row-level security alone (#6012). A patient follows their own
//! token through the public status link (#1514), not through this route.
//!
//! The queue permission says the caller works a queue; the patient check says
//! this patient is one they may see. Both are needed, since the token carries
//! the patient's name and where they are in the building right now.

use super::require_permission;
use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One live token plus how many are ahead of it.
///
/// Flat rather than `#[serde(flatten)] token: Token`: `query_as!` builds the
/// struct from columns and cannot fill a nested one. The JSON is the same
/// shape `Token` serialises to, with `ahead` beside its fields.
#[derive(Debug, Serialize)]
pub struct PatientToken {
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
    pub visit_id: Option<Uuid>,
    pub referred_from_module: Option<String>,
    pub referred_from_scope: Option<String>,
    pub referred_from_scope_id: Option<Uuid>,
    pub returned_from_label: Option<String>,
    pub returned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub called_at: Option<chrono::DateTime<chrono::Utc>>,
    pub served_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub token_date: chrono::NaiveDate,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub priority_reason: Option<String>,
    pub priority_changed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub queue_id: Option<Uuid>,
    pub priority_label: Option<String>,
    /// People this queue will call first — priority, then `seq`, the order
    /// `call_next` uses. Without it a shared visit number tells the holder
    /// nothing about their turn.
    pub ahead: i64,
}

#[derive(Debug, Deserialize)]
pub struct PatientTokensQuery {
    pub patient_id: Uuid,
}

/// `GET /api/tokens/by-patient` — a patient's live tokens today, with position.
///
/// Queue permission first, then the per-patient check, which answers 404 for
/// a patient the caller may not see so the route is not an existence oracle.
pub async fn patient_tokens(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<PatientTokensQuery>,
) -> Result<Json<Vec<PatientToken>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;
    medbrains_health_services::patient::require_patient_access(&state, &claims, query.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let tokens = live_tokens(&mut tx, claims.tenant_id, query.patient_id).await?;
    tx.commit().await?;
    Ok(Json(tokens))
}

/// The patient's waiting, held, called and serving tokens today, oldest first.
///
/// `tenant_id` is filtered explicitly on both the token and the "ahead" count,
/// beside RLS: a request pool that connects as the table owner would otherwise
/// read across hospitals.
async fn live_tokens(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<PatientToken>, AppError> {
    Ok(sqlx::query_as!(
        PatientToken,
        r#"SELECT t.id, t.module, t.scope, t.scope_id, t.scope_label, t.number, t.seq,
                  t.status, t.priority, t.patient_id, t.patient_name, t.entity_type,
                  t.entity_id, t.counter_label, t.visit_id, t.referred_from_module,
                  t.referred_from_scope, t.referred_from_scope_id, t.returned_from_label,
                  t.returned_at, t.called_at, t.served_at, t.completed_at, t.token_date,
                  t.created_at, t.priority_reason, t.priority_changed_at, t.queue_id,
                  token_priority_label(t.queue_id, t.priority) AS priority_label,
                  (SELECT COUNT(*) FROM tokens ahead
                    WHERE ahead.tenant_id = $1
                      AND ahead.module = t.module
                      AND ahead.scope = t.scope
                      AND ahead.scope_id IS NOT DISTINCT FROM t.scope_id
                      AND ahead.token_date = t.token_date
                      AND ahead.status = 'waiting'
                      AND (token_queue_weight(ahead.queue_id, ahead.priority, ahead.created_at),
                           ahead.seq)
                        < (token_queue_weight(t.queue_id, t.priority, t.created_at), t.seq)
                  ) AS "ahead!"
             FROM tokens t
            WHERE t.tenant_id = $1 AND t.patient_id = $2 AND t.token_date = CURRENT_DATE
              AND t.status IN ('waiting', 'on_hold', 'called', 'serving')
            ORDER BY t.created_at"#,
        tenant_id,
        patient_id,
    )
    .fetch_all(&mut **tx)
    .await?)
}

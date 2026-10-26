//! Early-warning escalations, a patient's scoring plan, and the hospital's
//! policy — `/api/nurse/ews/*`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_clinical_scores::ews::{EwsPolicy, Tool};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::nurse_ews::{POLICY_CATEGORY, POLICY_KEY, load_policy};

#[derive(Debug, Deserialize)]
pub struct EscalationQuery {
    /// `open` (default), `acknowledged` or `all`.
    pub status: Option<String>,
    pub ward_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EscalationRow {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub ward_name: Option<String>,
    pub bed_name: Option<String>,
    pub ews_tool: String,
    pub ews_total: i32,
    pub band: String,
    pub incomplete: bool,
    pub status: String,
    pub level: i32,
    pub created_at: DateTime<Utc>,
    pub next_escalation_at: DateTime<Utc>,
    pub acknowledged_by_name: Option<String>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub response_action: Option<String>,
    pub response_note: Option<String>,
}

/// `GET /api/nurse/ews/escalations` — the ward's escalations, the most
/// urgent and oldest first. Whole-ward like the care view grid: a list cut
/// to the caller's own patients would hide a deteriorating patient on the
/// same ward.
pub async fn list_escalations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<EscalationQuery>,
) -> Result<Json<Vec<EscalationRow>>, AppError> {
    require_permission(&claims, permissions::nurse::ews::VIEW)?;
    let status = q.status.as_deref().unwrap_or("open");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, EscalationRow>(
        "SELECT x.id, x.encounter_id, x.admission_id, x.patient_id, \
                btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid, \
                w.name AS ward_name, bl.name AS bed_name, x.ews_tool, x.ews_total, x.band, \
                x.incomplete, x.status, x.level, x.created_at, x.next_escalation_at, \
                u.full_name AS acknowledged_by_name, x.acknowledged_at, x.response_action, \
                x.response_note \
           FROM ews_escalations x \
           JOIN patients p ON p.id = x.patient_id \
           JOIN admissions a ON a.id = x.admission_id \
           LEFT JOIN wards w ON w.id = a.ward_id \
           LEFT JOIN locations bl ON bl.id = a.bed_id \
           LEFT JOIN users u ON u.id = x.acknowledged_by \
          WHERE x.tenant_id = $1 AND x.deleted_at IS NULL \
            AND ($2 = 'all' OR x.status = $2) \
            AND ($3::uuid IS NULL OR a.ward_id = $3) \
          ORDER BY (x.status = 'open') DESC, \
                   array_position(ARRAY['emergency','urgent','low_medium'], x.band), x.created_at \
          LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(status)
    .bind(q.ward_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AcknowledgeRequest {
    pub response_action: String,
    pub response_note: String,
}

const RESPONSES: [&str; 6] = [
    "bedside_review",
    "medical_review",
    "plan_changed",
    "rapid_response_called",
    "transfer_higher_care",
    "other",
];

/// `PUT /api/nurse/ews/escalations/{id}/acknowledge` — who responded and
/// what they did. It stops the escalation going further.
pub async fn acknowledge_escalation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AcknowledgeRequest>,
) -> Result<Json<EscalationRow>, AppError> {
    require_permission(&claims, permissions::nurse::ews::ACKNOWLEDGE)?;
    if !RESPONSES.contains(&body.response_action.as_str()) {
        return Err(AppError::BadRequest(
            "Choose what was done in response".into(),
        ));
    }
    let note = body.response_note.trim();
    if note.chars().count() < 3 {
        return Err(AppError::BadRequest(
            "Say what was done — at least 3 characters".into(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let encounter: Uuid = sqlx::query_scalar(
        "SELECT encounter_id FROM ews_escalations WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter).await?;
    let done = sqlx::query(
        "UPDATE ews_escalations SET status = 'acknowledged', acknowledged_by = $1, \
                acknowledged_at = now(), response_action = $2, response_note = $3 \
          WHERE id = $4 AND tenant_id = $5 AND status = 'open'",
    )
    .bind(claims.sub)
    .bind(&body.response_action)
    .bind(note)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::Conflict(
            "This escalation is no longer open — it was acknowledged or replaced by a newer score"
                .into(),
        ));
    }
    tx.commit().await?;
    let mut rows = list_escalations(
        State(state),
        Extension(claims),
        Query(EscalationQuery {
            status: Some("all".into()),
            ward_id: None,
        }),
    )
    .await?
    .0;
    rows.retain(|r| r.id == id);
    rows.pop().map(Json).ok_or(AppError::NotFound)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlanView {
    pub spo2_scale2: bool,
    pub scale2_target: Option<String>,
    pub tool_override: Option<String>,
    pub reason: Option<String>,
    pub set_by_name: Option<String>,
    pub set_at: Option<DateTime<Utc>>,
}

/// `GET /api/nurse/ews/plan/{encounter_id}`
pub async fn get_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<PlanView>, AppError> {
    require_permission(&claims, permissions::nurse::ews::VIEW)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let plan = sqlx::query_as::<_, PlanView>(
        "SELECT pl.spo2_scale2, pl.scale2_target, pl.tool_override, pl.reason, \
                u.full_name AS set_by_name, pl.set_at \
           FROM ews_encounter_plans pl LEFT JOIN users u ON u.id = pl.set_by \
          WHERE pl.tenant_id = $1 AND pl.encounter_id = $2 AND pl.deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(plan.unwrap_or(PlanView {
        spo2_scale2: false,
        scale2_target: None,
        tool_override: None,
        reason: None,
        set_by_name: None,
        set_at: None,
    })))
}

#[derive(Debug, Deserialize)]
pub struct SetPlanRequest {
    pub spo2_scale2: bool,
    pub scale2_target: Option<String>,
    pub tool_override: Option<String>,
    pub reason: String,
}

/// `PUT /api/nurse/ews/plan/{encounter_id}` — prescribe Scale 2 or choose
/// the tool. Applies from the next reading; past scores are not rewritten.
pub async fn set_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<SetPlanRequest>,
) -> Result<Json<PlanView>, AppError> {
    require_permission(&claims, permissions::nurse::ews::PLAN)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    let reason = body.reason.trim();
    if reason.chars().count() < 3 {
        return Err(AppError::BadRequest("Give the clinical reason".into()));
    }
    if body
        .tool_override
        .as_deref()
        .is_some_and(|t| Tool::parse(t).is_none())
    {
        return Err(AppError::BadRequest(
            "The tool is NEWS2, PEWS or MEOWS".into(),
        ));
    }
    let target = body
        .scale2_target
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty());
    if body.spo2_scale2 && target.is_none() {
        return Err(AppError::BadRequest(
            "Scale 2 needs the target saturation range".into(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO ews_encounter_plans (tenant_id, encounter_id, spo2_scale2, scale2_target, \
             tool_override, reason, set_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (tenant_id, encounter_id) WHERE deleted_at IS NULL DO UPDATE SET \
             spo2_scale2 = EXCLUDED.spo2_scale2, scale2_target = EXCLUDED.scale2_target, \
             tool_override = EXCLUDED.tool_override, reason = EXCLUDED.reason, \
             set_by = EXCLUDED.set_by, set_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(body.spo2_scale2)
    .bind(target.filter(|_| body.spo2_scale2))
    .bind(&body.tool_override)
    .bind(reason)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    get_plan(State(state), Extension(claims), Path(encounter_id)).await
}

/// `GET /api/nurse/ews/policy`
pub async fn get_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<EwsPolicy>, AppError> {
    require_permission(&claims, permissions::nurse::ews::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let policy = load_policy(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(policy))
}

/// `PUT /api/nurse/ews/policy` — refused if it would make a sicker patient
/// wait longer or stop the emergency band escalating.
pub async fn set_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<EwsPolicy>,
) -> Result<Json<EwsPolicy>, AppError> {
    require_permission(&claims, permissions::nurse::ews::POLICY)?;
    body.validate().map_err(|e| AppError::BadRequest(e.0))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
             deleted_at = NULL, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(POLICY_CATEGORY)
    .bind(POLICY_KEY)
    .bind(serde_json::to_value(&body).map_err(|e| AppError::Internal(e.to_string()))?)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(body))
}

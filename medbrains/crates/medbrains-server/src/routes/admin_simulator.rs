//! HTTP surface for the internal data simulator.
//!
//! All endpoints are gated by `is_bypass_role(claims)` — super_admin and
//! hospital_admin only. Schedules carry a JSON profile (see
//! `medbrains_core::simulator::Profile`); a manual `run-now` kicks the
//! engine in a detached `tokio::task` so the client gets a `run_id`
//! immediately. The cron-driven scheduler is Day-2 work.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use medbrains_core::simulator::{
    Profile, RunSummary, SimulatorRun, SimulatorRunFinding, SimulatorRunStep, SimulatorSchedule,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::is_bypass_role,
    services::simulator as engine, state::AppState,
};

fn require_admin(claims: &Claims) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

// ── Schedules ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub name: String,
    pub description: Option<String>,
    pub cron_expr: Option<String>,
    pub profile: serde_json::Value,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub cron_expr: Option<String>,
    pub profile: Option<serde_json::Value>,
    pub enabled: Option<bool>,
}

pub async fn list_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SimulatorSchedule>>, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows: Vec<SimulatorSchedule> = sqlx::query_as(
        "SELECT * FROM simulator_schedules \
         WHERE deleted_at IS NULL \
         ORDER BY created_at DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScheduleRequest>,
) -> Result<(StatusCode, Json<SimulatorSchedule>), AppError> {
    require_admin(&claims)?;

    // Validate the profile parses.
    let _: Profile = serde_json::from_value(body.profile.clone())
        .map_err(|err| AppError::BadRequest(format!("invalid profile: {err}")))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row: SimulatorSchedule = sqlx::query_as(
        "INSERT INTO simulator_schedules \
         (tenant_id, name, description, cron_expr, profile, enabled, created_by) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.cron_expr)
    .bind(&body.profile)
    .bind(body.enabled)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn get_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SimulatorSchedule>, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row: SimulatorSchedule = sqlx::query_as(
        "SELECT * FROM simulator_schedules \
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScheduleRequest>,
) -> Result<Json<SimulatorSchedule>, AppError> {
    require_admin(&claims)?;
    if let Some(profile) = &body.profile {
        let _: Profile = serde_json::from_value(profile.clone())
            .map_err(|err| AppError::BadRequest(format!("invalid profile: {err}")))?;
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row: SimulatorSchedule = sqlx::query_as(
        "UPDATE simulator_schedules SET \
            name = COALESCE($1, name), \
            description = COALESCE($2, description), \
            cron_expr = COALESCE($3, cron_expr), \
            profile = COALESCE($4, profile), \
            enabled = COALESCE($5, enabled), \
            updated_at = NOW() \
         WHERE id = $6 AND deleted_at IS NULL \
         RETURNING *",
    )
    .bind(body.name)
    .bind(body.description)
    .bind(body.cron_expr)
    .bind(body.profile)
    .bind(body.enabled)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query(
        "UPDATE simulator_schedules SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

// ── Run now ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RunNowResponse {
    pub run_id: Uuid,
}

pub async fn run_now(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(schedule_id): Path<Uuid>,
) -> Result<(StatusCode, Json<RunNowResponse>), AppError> {
    require_admin(&claims)?;

    // Fetch schedule + profile.
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let schedule: SimulatorSchedule =
        sqlx::query_as("SELECT * FROM simulator_schedules WHERE id = $1 AND deleted_at IS NULL")
            .bind(schedule_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    let profile: Profile = serde_json::from_value(schedule.profile.clone())
        .map_err(|err| AppError::BadRequest(format!("stored profile is invalid: {err}")))?;

    let run_id = engine::insert_run(
        &state.db,
        claims.tenant_id,
        Some(schedule.id),
        claims.sub,
        "manual",
    )
    .await?;

    // Detach the engine so the HTTP client gets a run_id immediately. Agent
    // mode drives the live API and needs the full AppState (AI config); the
    // scripted engine only needs the pool.
    let tenant_id = claims.tenant_id;
    let claims_clone = claims.clone();
    if profile.agent.enabled {
        let state_clone = state.clone();
        tokio::spawn(async move {
            execute_agent_run(&state_clone, &claims_clone, tenant_id, run_id, profile).await;
        });
    } else {
        let pool = state.db.clone();
        tokio::spawn(async move {
            execute_run(&pool, &claims_clone, tenant_id, run_id, profile).await;
        });
    }

    Ok((StatusCode::ACCEPTED, Json(RunNowResponse { run_id })))
}

/// Run the LLM-agent simulator: fan out agents across the factor matrix, then
/// persist steps + findings. The run always finalizes `succeeded` — individual
/// failures the agents hit are recorded as steps/findings, not run errors.
async fn execute_agent_run(
    state: &AppState,
    claims: &Claims,
    tenant_id: Uuid,
    run_id: Uuid,
    profile: Profile,
) {
    let approval = match profile.approval_mode {
        medbrains_core::simulator::ApprovalMode::Auto => "auto_committed",
        medbrains_core::simulator::ApprovalMode::Manual => "pending_approval",
    };
    let (summary, steps, findings) = engine::agent::run_agent(state, claims, &profile.agent).await;
    let _ = engine::persist_steps(&state.db, tenant_id, run_id, &steps).await;
    let _ = engine::agent::persist_findings(&state.db, tenant_id, run_id, &findings).await;
    let _ = engine::finalize_run_with_approval(
        &state.db, tenant_id, run_id, "succeeded", &summary, None, approval,
    )
    .await;
}

async fn execute_run(
    pool: &sqlx::PgPool,
    claims: &Claims,
    tenant_id: Uuid,
    run_id: Uuid,
    profile: Profile,
) {
    let approval = match profile.approval_mode {
        medbrains_core::simulator::ApprovalMode::Auto => "auto_committed",
        medbrains_core::simulator::ApprovalMode::Manual => "pending_approval",
    };
    match engine::run(pool, claims, &profile).await {
        Ok(result) => {
            let _ = engine::persist_steps(pool, tenant_id, run_id, &result.steps).await;
            let _ = engine::finalize_run_with_approval(
                pool,
                tenant_id,
                run_id,
                "succeeded",
                &result.summary,
                None,
                approval,
            )
            .await;
            // Bump last_run_at on the schedule (best-effort).
            if let Ok(mut tx) = pool.begin().await {
                let _ = medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await;
                let _ = sqlx::query(
                    "UPDATE simulator_schedules SET last_run_at = NOW() \
                     WHERE id = (SELECT schedule_id FROM simulator_runs WHERE id = $1)",
                )
                .bind(run_id)
                .execute(&mut *tx)
                .await;
                let _ = tx.commit().await;
            }
        }
        Err(err) => {
            let summary = RunSummary::default();
            let _ = engine::finalize_run(
                pool,
                tenant_id,
                run_id,
                "failed",
                &summary,
                Some(&err.to_string()),
            )
            .await;
        }
    }
}

// ── Approve / Reject pending runs ───────────────────────────────────

pub async fn approve_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(run_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let res = sqlx::query(
        "UPDATE simulator_runs SET approval_status = 'approved' \
         WHERE id = $1 AND approval_status = 'pending_approval'",
    )
    .bind(run_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    if res.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "Run is not in pending_approval state".into(),
        ));
    }
    Ok(Json(json!({ "approved": true, "run_id": run_id })))
}

pub async fn reject_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(run_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Walk run steps and DELETE each target row by step_type. We only
    // delete rows that are still flagged is_dummy = true, defensive
    // against any approval-status drift.
    let steps: Vec<(String, Option<Uuid>)> = sqlx::query_as(
        "SELECT step_type, target_id FROM simulator_run_steps \
         WHERE run_id = $1 AND target_id IS NOT NULL",
    )
    .bind(run_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut deleted = 0_i64;
    for (step_type, target_id) in steps {
        let Some(id) = target_id else { continue };
        let table = match step_type.as_str() {
            "opd_encounter" | "ipd_admission" | "er_admit" => Some("encounters"),
            "ipd_admission_row" => Some("admissions"),
            "er_visit" => Some("er_visits"),
            "lab_order" => Some("lab_orders"),
            "radiology_order" => Some("radiology_orders"),
            "pharmacy_order" => Some("pharmacy_orders"),
            // children that cascade via FK or have no is_dummy of their own:
            _ => None,
        };
        if let Some(t) = table {
            let sql = format!("DELETE FROM {t} WHERE id = $1 AND is_dummy = true");
            let r = sqlx::query(&sql).bind(id).execute(&mut *tx).await?;
            deleted += r.rows_affected() as i64;
        }
    }

    sqlx::query(
        "UPDATE simulator_runs SET approval_status = 'rejected' \
         WHERE id = $1 AND approval_status = 'pending_approval'",
    )
    .bind(run_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(
        json!({ "rejected": true, "run_id": run_id, "deleted_rows": deleted }),
    ))
}

// ── Next-run preview ────────────────────────────────────────────────
// Resolves a profile against the current tenant state (today's holidays,
// season, active news advisories, last 30d natural case mix) and returns
// a structured snapshot of what the engine would see if Run-now fired
// right now. UI shows this in the schedule editor.

#[derive(Debug, Deserialize)]
pub struct PreviewRequest {
    pub profile: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct PreviewResponse {
    pub date: String,
    pub season_label: String,
    pub season_icds: Vec<String>,
    pub holiday_name: Option<String>,
    pub holiday_kind: Option<String>,
    pub holiday_icds: Vec<String>,
    pub news_icds: Vec<String>,
    pub natural_top_icds: Vec<(String, i64)>,
    pub effective_opd_count: u32,
    pub effective_er_count: u32,
}

pub async fn preview(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PreviewRequest>,
) -> Result<Json<PreviewResponse>, AppError> {
    require_admin(&claims)?;
    use crate::services::simulator::{calendar, seasonality};
    use chrono::Utc;

    let profile: Profile = serde_json::from_value(body.profile.clone())
        .map_err(|err| AppError::BadRequest(format!("invalid profile: {err}")))?;

    let date = profile.date.unwrap_or_else(|| Utc::now().date_naive());
    let season = if profile.seasonality.enabled {
        seasonality::season_for(date, &profile.seasonality.region)
    } else {
        seasonality::SeasonProfile {
            label: "off",
            boosted_icds: &[],
            boosted_complaints: &[],
        }
    };
    let holiday = if profile.holidays.respect_holidays {
        calendar::lookup(date)
    } else {
        None
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let news_icds: Vec<String> = sqlx::query_scalar::<_, Vec<String>>(
        "SELECT icd_boost FROM news_articles \
         WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
           AND category IN ('outbreak_alert', 'weather_advisory') \
           AND (expires_at IS NULL OR expires_at > NOW())",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .flatten()
    .collect();

    let natural_top_icds: Vec<(String, i64)> =
        if profile.natural_flow.enabled && profile.natural_flow.blend > 0.0 {
            let lookback = profile.natural_flow.lookback_days.clamp(1, 365);
            sqlx::query_as::<_, (String, i64)>(
                "SELECT d.icd_code, COUNT(*)::bigint AS n \
             FROM diagnoses d JOIN encounters e ON e.id = d.encounter_id \
             WHERE e.tenant_id = $1 AND e.is_dummy = false \
               AND e.encounter_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day') \
               AND d.icd_code IS NOT NULL \
             GROUP BY d.icd_code ORDER BY n DESC LIMIT 10",
            )
            .bind(claims.tenant_id)
            .bind(lookback)
            .fetch_all(&mut *tx)
            .await
            .unwrap_or_default()
        } else {
            Vec::new()
        };

    tx.commit().await?;

    let opd_scale = if holiday.is_some() {
        profile.holidays.opd_scale_on_holiday
    } else {
        1.0
    };
    let er_scale = if holiday.is_some() {
        profile.holidays.er_scale_on_holiday
    } else {
        1.0
    };
    let base_opd = ((profile.patients as f32) * profile.opd_pct * opd_scale).round() as u32;
    let base_er = ((profile.patients as f32) * profile.er_pct * er_scale).round() as u32;
    let effective_opd_count = profile.volumes.opd_count.unwrap_or(base_opd);
    let effective_er_count = profile.volumes.er_count.unwrap_or(base_er);

    Ok(Json(PreviewResponse {
        date: date.to_string(),
        season_label: season.label.to_owned(),
        season_icds: season
            .boosted_icds
            .iter()
            .map(|s| (*s).to_owned())
            .collect(),
        holiday_name: holiday.map(|h| h.name.to_owned()),
        holiday_kind: holiday.map(|h| match h.kind {
            calendar::HolidayKind::PublicHoliday => "public_holiday".to_owned(),
            calendar::HolidayKind::Festival => "festival".to_owned(),
            calendar::HolidayKind::Observance => "observance".to_owned(),
        }),
        holiday_icds: holiday
            .map(|h| h.icd_boost.iter().map(|s| (*s).to_owned()).collect())
            .unwrap_or_default(),
        news_icds,
        natural_top_icds,
        effective_opd_count,
        effective_er_count,
    }))
}

// ── Runs ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListRunsQuery {
    pub schedule_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn list_runs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRunsQuery>,
) -> Result<Json<Vec<SimulatorRun>>, AppError> {
    require_admin(&claims)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows: Vec<SimulatorRun> = if let Some(sid) = q.schedule_id {
        sqlx::query_as(
            "SELECT * FROM simulator_runs \
             WHERE schedule_id = $1 \
             ORDER BY started_at DESC \
             LIMIT $2",
        )
        .bind(sid)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as(
            "SELECT * FROM simulator_runs \
             ORDER BY started_at DESC \
             LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct RunDetailResponse {
    pub run: SimulatorRun,
    pub steps: Vec<SimulatorRunStep>,
    /// Free-text findings from agent runs (empty for scripted runs).
    pub findings: Vec<SimulatorRunFinding>,
}

pub async fn get_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RunDetailResponse>, AppError> {
    require_admin(&claims)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let run: SimulatorRun = sqlx::query_as("SELECT * FROM simulator_runs WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let steps: Vec<SimulatorRunStep> = sqlx::query_as(
        "SELECT * FROM simulator_run_steps \
         WHERE run_id = $1 ORDER BY created_at ASC LIMIT 5000",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let findings: Vec<SimulatorRunFinding> = sqlx::query_as(
        "SELECT * FROM simulator_run_findings \
         WHERE run_id = $1 ORDER BY created_at ASC LIMIT 5000",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(RunDetailResponse { run, steps, findings }))
}

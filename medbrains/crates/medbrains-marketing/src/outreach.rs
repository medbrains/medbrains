//! Outreach runs — sending a campaign to a cohort, and the approval in front
//! of it.
//!
//! # Why approval is a state machine and not a checkbox
//!
//! NMC advertising rules and the Drugs and Magic Remedies Act bind what a
//! hospital may say about itself and about treatment. A wording error in a
//! one-to-one conversation is a conversation; the same error on a cohort of
//! four thousand is a regulatory event, and automation is what turns the first
//! into the second.
//!
//! So a run is created as a draft, submitted, and approved by somebody else.
//! `marketing.outreach.approve` is held by `quality_officer` and deliberately
//! not by `marketing_executive`: the author of a campaign does not sign it
//! off. The database backs this up with a CHECK on
//! `approved_by <> created_by`, and this module checks it first so the caller
//! gets a sentence rather than a constraint violation.
//!
//! # Why there is no dispatch here
//!
//! Nothing in this module sends anything. There is no channel adapter yet, and
//! a `start` endpoint that flipped a status while sending nothing would be a
//! placeholder that satisfies a test suite and lies to an operator — the run
//! would read as sent.
//!
//! What exists is the part that is real without an adapter: the record, the
//! approval, and the DLT template id. When a sender arrives it moves
//! `approved` to `sending` and reports counts back; until then a hospital can
//! see exactly which campaigns were approved, by whom, and against what
//! template.
//!
//! # dlt_template_id
//!
//! TRAI requires every commercial SMS template to be pre-registered. An SMS
//! sent on an unregistered template does not bounce — the carrier drops it
//! silently, so the hospital believes four thousand people were reminded and
//! nobody was. Storing the id here means the failure is auditable after the
//! fact even though this module cannot prevent it.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Statuses a run can hold. Mirrors the CHECK in `0975_marketing.sql`.
mod status {
    pub(super) const DRAFT: &str = "draft";
    pub(super) const PENDING: &str = "pending_approval";
    pub(super) const APPROVED: &str = "approved";
    pub(super) const CANCELLED: &str = "cancelled";
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OutreachRun {
    pub id: Uuid,
    pub cohort_id: Uuid,
    pub campaign_id: Option<Uuid>,
    pub channel: String,
    pub template_ref: Option<String>,
    pub dlt_template_id: Option<String>,
    pub body_preview: Option<String>,
    pub status: String,
    pub created_by: Option<Uuid>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub sent_count: i32,
    pub failed_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateRunRequest {
    pub cohort_id: Uuid,
    pub campaign_id: Option<Uuid>,
    /// `sms`, `whatsapp` or `call`.
    pub channel: String,
    pub template_ref: Option<String>,
    /// The TRAI-registered template id. Required for SMS, because an
    /// unregistered template fails silently at the carrier.
    pub dlt_template_id: Option<String>,
    /// What the recipient will actually read, so the approver approves the
    /// words rather than a template name.
    pub body_preview: Option<String>,
}

const COLUMNS: &str = "id, cohort_id, campaign_id, channel, template_ref, dlt_template_id, \
                       body_preview, status, created_by, approved_by, approved_at, \
                       sent_count, failed_count";

/// `GET /api/marketing/outreach`
///
/// # Errors
/// Returns 403 without `marketing.cohorts.view`.
pub async fn list_runs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OutreachRun>>, AppError> {
    // Reading the log of what was sent is a cohort-level read, not a send.
    require_permission(&claims, permissions::marketing::cohorts::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OutreachRun>(&format!(
        "SELECT {COLUMNS} FROM mkt_outreach_runs WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/outreach`
///
/// Creates a draft. Nothing is sent and nothing can be until somebody else
/// approves it.
///
/// # Errors
/// Returns 403 without `marketing.outreach.send`, 400 for an SMS with no DLT
/// template, 404 if the cohort is not in this tenant.
pub async fn create_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRunRequest>,
) -> Result<Json<OutreachRun>, AppError> {
    require_permission(&claims, permissions::marketing::outreach::SEND)?;

    // Refuse the silent failure at the point where somebody can still fix it.
    if body.channel.eq_ignore_ascii_case("sms")
        && body.dlt_template_id.as_deref().unwrap_or("").trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "an SMS run needs its DLT template id — TRAI drops an unregistered \
             template silently, so the hospital would believe the messages were \
             delivered"
                .to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let cohort_exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mkt_cohorts WHERE id = $1 AND tenant_id = $2")
            .bind(body.cohort_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if cohort_exists.is_none() {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as::<_, OutreachRun>(&format!(
        "INSERT INTO mkt_outreach_runs \
            (tenant_id, cohort_id, campaign_id, channel, template_ref, \
             dlt_template_id, body_preview, status, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8) \
         RETURNING {COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.cohort_id)
    .bind(body.campaign_id)
    .bind(&body.channel)
    .bind(body.template_ref.as_deref())
    .bind(body.dlt_template_id.as_deref())
    .bind(body.body_preview.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Move a run to a new status, refusing a transition that is not legal from
/// where it currently is.
///
/// Returns the row, or `NotFound` when the run is not in this tenant, or
/// `Conflict` when the transition is illegal — a run already cancelled must
/// not be approvable, and a draft must not skip review.
async fn transition(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    from: &str,
    to: &str,
    approver: Option<Uuid>,
) -> Result<OutreachRun, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let current: Option<(String, Option<Uuid>)> = sqlx::query_as(
        "SELECT status, created_by FROM mkt_outreach_runs WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (status, created_by) = current.ok_or(AppError::NotFound)?;
    if status != from {
        return Err(AppError::Conflict(format!(
            "this run is {status}, so it cannot move to {to}"
        )));
    }

    // Checked here as well as in the database so the caller gets a sentence
    // rather than a constraint violation. The CHECK stays as the backstop —
    // this module is not the only thing that can write the row.
    if let Some(approver_id) = approver {
        if created_by == Some(approver_id) {
            return Err(AppError::Conflict(
                "the person who created a campaign cannot approve it — NMC \
                 advertising rules make this a second pair of eyes, not a \
                 formality"
                    .to_owned(),
            ));
        }
    }

    let row = sqlx::query_as::<_, OutreachRun>(&format!(
        "UPDATE mkt_outreach_runs SET \
            status = $3, \
            approved_by = COALESCE($4, approved_by), \
            approved_at = CASE WHEN $4 IS NULL THEN approved_at ELSE now() END \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING {COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(to)
    .bind(approver)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(row)
}

/// `POST /api/marketing/outreach/{id}/submit`
///
/// # Errors
/// 403 without `marketing.outreach.send`, 404 if not in this tenant, 409 if
/// the run is not a draft.
pub async fn submit_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OutreachRun>, AppError> {
    require_permission(&claims, permissions::marketing::outreach::SEND)?;
    let row = transition(&state, &claims, id, status::DRAFT, status::PENDING, None).await?;
    Ok(Json(row))
}

/// `POST /api/marketing/outreach/{id}/approve`
///
/// # Errors
/// 403 without `marketing.outreach.approve`, 404 if not in this tenant, 409 if
/// the run is not awaiting approval or if the approver wrote it.
pub async fn approve_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OutreachRun>, AppError> {
    require_permission(&claims, permissions::marketing::outreach::APPROVE)?;
    let row = transition(
        &state,
        &claims,
        id,
        status::PENDING,
        status::APPROVED,
        Some(claims.sub),
    )
    .await?;
    Ok(Json(row))
}

/// `POST /api/marketing/outreach/{id}/cancel`
///
/// Cancellable from draft or pending review. An approved run is left alone
/// here: once a sender exists, cancelling something that may already be
/// part-way through a cohort is a different problem with a different answer.
///
/// # Errors
/// 403 without `marketing.outreach.send`, 404 if not in this tenant, 409 if
/// the run is already approved, sending or finished.
pub async fn cancel_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OutreachRun>, AppError> {
    require_permission(&claims, permissions::marketing::outreach::SEND)?;

    match transition(&state, &claims, id, status::DRAFT, status::CANCELLED, None).await {
        Ok(row) => Ok(Json(row)),
        Err(AppError::Conflict(_)) => {
            let row =
                transition(&state, &claims, id, status::PENDING, status::CANCELLED, None).await?;
            Ok(Json(row))
        }
        Err(other) => Err(other),
    }
}

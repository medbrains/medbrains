//! Dialyzers: issued to one patient, counted on every use, checked by total
//! cell volume after each reprocessing, discarded when worn or at the limit.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dialysis_machines::reuse_limit;
use crate::dialysis_rules::{self, DialyzerState, SEROLOGIES};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Dialyzer {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub label: String,
    pub model: Option<String>,
    pub serology: String,
    pub max_uses: i32,
    pub uses: i32,
    pub baseline_tcv_ml: Option<Decimal>,
    pub last_tcv_ml: Option<Decimal>,
    pub status: String,
    pub discard_reason: Option<String>,
    pub issued_at: DateTime<Utc>,
}

const SELECT: &str = "SELECT id, patient_id, label, model, serology, max_uses, uses, baseline_tcv_ml, \
        last_tcv_ml, status, discard_reason, issued_at FROM dialyzers \
  WHERE tenant_id = $1 AND deleted_at IS NULL";

#[derive(Debug, Deserialize)]
pub struct DialyzerQuery {
    pub patient_id: Uuid,
}

/// `GET /api/specialty/dialysis/dialyzers?patient_id=` — a patient's dialyzers, newest first.
pub async fn list_dialyzers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DialyzerQuery>,
) -> Result<Json<Vec<Dialyzer>>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::LIST)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, q.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Dialyzer>(&format!("{SELECT} AND patient_id = $2 ORDER BY issued_at DESC LIMIT 50"))
        .bind(claims.tenant_id)
        .bind(q.patient_id)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct IssueDialyzer {
    pub patient_id: Uuid,
    pub label: String,
    pub model: Option<String>,
    pub serology: String,
    /// Priming volume measured before first use, the baseline for reprocessing.
    pub baseline_tcv_ml: Option<Decimal>,
}

/// `POST /api/specialty/dialysis/dialyzers` — issue a new dialyzer to a patient.
pub async fn issue_dialyzer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueDialyzer>,
) -> Result<Json<Dialyzer>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    if !SEROLOGIES.contains(&body.serology.as_str()) {
        return Err(AppError::BadRequest(format!("Serology must be one of: {}", SEROLOGIES.join(", "))));
    }
    let label = body.label.trim().to_uppercase();
    if label.is_empty() {
        return Err(AppError::BadRequest("Write the dialyzer's label".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let max_uses = dialysis_rules::max_uses_for(&body.serology, reuse_limit(&mut tx, claims.tenant_id).await?);
    let id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO dialyzers (tenant_id, patient_id, label, model, serology, max_uses, baseline_tcv_ml, \
                                last_tcv_ml, issued_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8) ON CONFLICT DO NOTHING RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&label)
    .bind(body.model.as_deref().map(str::trim).filter(|m| !m.is_empty()))
    .bind(&body.serology)
    .bind(max_uses)
    .bind(body.baseline_tcv_ml)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let id = id.ok_or_else(|| AppError::Conflict(format!("A dialyzer labelled {label} already exists")))?;
    let row = sqlx::query_as::<_, Dialyzer>(&format!("{SELECT} AND id = $2"))
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct Reprocess {
    pub tcv_ml: Decimal,
}

/// `POST /api/specialty/dialysis/dialyzers/{id}/reprocess` — record the TCV
/// after reprocessing; below 80% of the baseline the dialyzer is discarded.
pub async fn reprocess_dialyzer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<Reprocess>,
) -> Result<Json<Dialyzer>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let d = sqlx::query_as::<_, Dialyzer>(&format!("{SELECT} AND id = $2 FOR UPDATE"))
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    if d.status != "in_use" {
        return Err(AppError::Conflict("This dialyzer has been discarded".to_owned()));
    }
    let measured = body.tcv_ml.to_f64().unwrap_or(0.0);
    // The first measurement becomes the baseline when none was taken at issue.
    let baseline = d.baseline_tcv_ml.and_then(|b| b.to_f64()).unwrap_or(measured);
    let passes = dialysis_rules::tcv_passes(baseline, measured);
    sqlx::query(
        "UPDATE dialyzers SET last_tcv_ml = $3, baseline_tcv_ml = COALESCE(baseline_tcv_ml, $3), \
           status = CASE WHEN $4 THEN status ELSE 'discarded' END, \
           discard_reason = CASE WHEN $4 THEN discard_reason ELSE $5 END, \
           discarded_at = CASE WHEN $4 THEN discarded_at ELSE now() END \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.tcv_ml)
    .bind(passes)
    .bind(format!("TCV {measured} ml is below {}% of {baseline} ml", dialysis_rules::MIN_TCV_PERCENT))
    .execute(&mut *tx)
    .await?;
    let row = sqlx::query_as::<_, Dialyzer>(&format!("{SELECT} AND id = $2"))
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct Discard {
    pub reason: String,
}

/// `POST /api/specialty/dialysis/dialyzers/{id}/discard`
pub async fn discard_dialyzer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<Discard>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::specialty::other::dialysis::MANAGE)?;
    let reason = body.reason.trim();
    if reason.chars().count() < 3 {
        return Err(AppError::BadRequest("Say why it is discarded".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE dialyzers SET status = 'discarded', discard_reason = $3, discarded_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'in_use' AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if done == 0 {
        return Err(AppError::Conflict("This dialyzer is already discarded".to_owned()));
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "discarded" })))
}

/// What a session takes from its dialyzer and booking.
pub(crate) struct SessionUse {
    pub dialyzer_use: Option<i32>,
    pub machine_id: Option<Uuid>,
    pub machine_code: Option<String>,
}

/// Inside the session's transaction: count the dialyzer's use (refusing a
/// shared, discarded or used-up one) and complete the booked shift.
pub(crate) async fn take_for_session(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    patient: Uuid,
    dialyzer: Option<Uuid>,
    slot: Option<Uuid>,
) -> Result<SessionUse, AppError> {
    let mut out = SessionUse { dialyzer_use: None, machine_id: None, machine_code: None };
    if let Some(id) = dialyzer {
        let (owner, status, uses, max_uses): (Uuid, String, i32, i32) = sqlx::query_as(
            "SELECT patient_id, status, uses, max_uses FROM dialyzers \
              WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
        )
        .bind(id)
        .bind(tenant)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
        let state = DialyzerState { patient_matches: owner == patient, status: &status, uses, max_uses };
        if let Some(refusal) = dialysis_rules::refuse_use(&state) {
            return Err(AppError::Conflict(refusal));
        }
        sqlx::query("UPDATE dialyzers SET uses = uses + 1 WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(tenant)
            .execute(&mut **tx)
            .await?;
        out.dialyzer_use = Some(uses + 1);
    }
    if let Some(id) = slot {
        let booked: Option<(Uuid, String)> = sqlx::query_as(
            "UPDATE dialysis_slots s SET status = 'completed' FROM dialysis_machines m \
              WHERE s.id = $1 AND s.tenant_id = $2 AND s.patient_id = $3 AND s.status = 'booked' \
                AND m.id = s.machine_id \
             RETURNING m.id, m.code",
        )
        .bind(id)
        .bind(tenant)
        .bind(patient)
        .fetch_optional(&mut **tx)
        .await?;
        let (machine, code) = booked
            .ok_or_else(|| AppError::Conflict("That shift is not booked for this patient".to_owned()))?;
        out.machine_id = Some(machine);
        out.machine_code = Some(code);
    }
    Ok(out)
}

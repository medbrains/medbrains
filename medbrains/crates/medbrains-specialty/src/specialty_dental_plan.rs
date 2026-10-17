//! Dental treatment plans and chart corrections (#230). A plan is procedures
//! tooth by tooth; doing one charges the visit's bill once (keyed on the
//! item), and a cancelled one never reaches it. A chart finding can be
//! corrected or removed; a removal is kept.

use axum::Json;
use axum::extract::{Extension, Path, State};
use medbrains_core::permissions;
use medbrains_core::specialty::dental::{DentalChartEntry, DentalTreatmentItem, is_fdi_tooth};
use rust_decimal::Decimal;
use serde::Deserialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

const ITEM_COLUMNS: &str = "id, exam_id, tooth_number, procedure, charge_code, price, status, \
     done_at, done_by, invoice_id, notes, created_at";

/// The caller may act on this exam, and the hospital has dental switched on.
async fn exam_access(state: &AppState, claims: &Claims, exam_id: Uuid) -> Result<(), AppError> {
    medbrains_authz_gate::require_access_via(
        state,
        claims,
        medbrains_authz_gate::links::DENTAL_EXAM,
        exam_id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "dental",
    )
    .await
}

async fn begin(
    state: &AppState,
    claims: &Claims,
) -> Result<Transaction<'static, Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

/// The exam a row belongs to, so the exam's access check covers it.
async fn exam_of(
    state: &AppState,
    claims: &Claims,
    table: &str,
    id: Uuid,
) -> Result<Uuid, AppError> {
    let sql = match table {
        "chart" => {
            "SELECT exam_id FROM dental_chart_entries WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
        }
        _ => {
            "SELECT exam_id FROM dental_treatment_items WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
        }
    };
    let mut tx = begin(state, claims).await?;
    let exam: Option<Uuid> = sqlx::query_scalar(sql)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
    tx.commit().await?;
    exam.ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct UpdateChartEntry {
    pub condition: String,
    pub surface: Option<String>,
    pub treatment_planned: Option<String>,
    pub notes: Option<String>,
}

/// `PUT /api/specialty/dental/chart/{id}` — correct a finding.
pub async fn update_chart_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateChartEntry>,
) -> Result<Json<DentalChartEntry>, AppError> {
    require_permission(&claims, permissions::specialty::dental::chart::UPDATE)?;
    let exam = exam_of(&state, &claims, "chart", id).await?;
    exam_access(&state, &claims, exam).await?;
    if body.condition.trim().is_empty() {
        return Err(AppError::BadRequest(
            "A finding needs a condition".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let row = sqlx::query_as::<_, DentalChartEntry>(
        "UPDATE dental_chart_entries SET condition = $1, surface = $2, treatment_planned = $3, \
                notes = $4, updated_at = now() \
          WHERE id = $5 AND tenant_id = $6 AND deleted_at IS NULL RETURNING *",
    )
    .bind(body.condition.trim())
    .bind(body.surface)
    .bind(body.treatment_planned)
    .bind(body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `DELETE /api/specialty/dental/chart/{id}` — remove a finding recorded in error.
pub async fn remove_chart_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::specialty::dental::chart::UPDATE)?;
    let exam = exam_of(&state, &claims, "chart", id).await?;
    exam_access(&state, &claims, exam).await?;
    let mut tx = begin(&state, &claims).await?;
    sqlx::query(
        "UPDATE dental_chart_entries SET deleted_at = now(), deleted_by = $1, \
                delete_reason = 'Recorded in error' \
          WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL",
    )
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "removed": true })))
}

/// `GET /api/specialty/dental/exams/{exam_id}/treatment`
pub async fn list_treatment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
) -> Result<Json<Vec<DentalTreatmentItem>>, AppError> {
    require_permission(&claims, permissions::specialty::dental::treatment::LIST)?;
    exam_access(&state, &claims, exam_id).await?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, DentalTreatmentItem>(&format!(
        "SELECT {ITEM_COLUMNS} FROM dental_treatment_items \
          WHERE tenant_id = $1 AND exam_id = $2 AND deleted_at IS NULL \
          ORDER BY created_at LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(exam_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct PlanItem {
    pub tooth_number: Option<String>,
    pub procedure: String,
    pub charge_code: Option<String>,
    pub price: Decimal,
    pub notes: Option<String>,
}

/// `POST /api/specialty/dental/exams/{exam_id}/treatment` — plan a procedure.
pub async fn plan_treatment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
    Json(body): Json<PlanItem>,
) -> Result<Json<DentalTreatmentItem>, AppError> {
    require_permission(&claims, permissions::specialty::dental::treatment::MANAGE)?;
    exam_access(&state, &claims, exam_id).await?;
    let tooth = body
        .tooth_number
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty());
    if tooth.is_some_and(|t| !is_fdi_tooth(t)) {
        return Err(AppError::BadRequest(
            "Use an FDI tooth number, such as 36 or 75".to_owned(),
        ));
    }
    if body.procedure.trim().is_empty() || body.price < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "A procedure needs a name and a price of 0 or more".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let row = sqlx::query_as::<_, DentalTreatmentItem>(&format!(
        "INSERT INTO dental_treatment_items \
           (tenant_id, exam_id, tooth_number, procedure, charge_code, price, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING {ITEM_COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(exam_id)
    .bind(tooth)
    .bind(body.procedure.trim())
    .bind(
        body.charge_code
            .as_deref()
            .map(str::trim)
            .filter(|c| !c.is_empty()),
    )
    .bind(body.price)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/specialty/dental/treatment/{id}/complete` — done, and billed.
pub async fn complete_treatment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DentalTreatmentItem>, AppError> {
    require_permission(&claims, permissions::specialty::dental::treatment::COMPLETE)?;
    let exam = exam_of(&state, &claims, "item", id).await?;
    exam_access(&state, &claims, exam).await?;
    let mut tx = begin(&state, &claims).await?;
    let item = sqlx::query_as::<_, DentalTreatmentItem>(&format!(
        "UPDATE dental_treatment_items SET status = 'done', done_at = now(), done_by = $1 \
          WHERE id = $2 AND tenant_id = $3 AND status = 'planned' AND deleted_at IS NULL \
          RETURNING {ITEM_COLUMNS}"
    ))
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("Only a planned procedure can be marked done".to_owned()))?;
    let (patient, encounter): (Uuid, Option<Uuid>) = sqlx::query_as(
        "SELECT patient_id, encounter_id FROM dental_exams WHERE id = $1 AND tenant_id = $2",
    )
    .bind(item.exam_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let description = match &item.tooth_number {
        Some(tooth) => format!("{} (tooth {tooth})", item.procedure),
        None => item.procedure.clone(),
    };
    let charged = medbrains_server_services::billing::auto_charge(
        &mut tx,
        &claims.tenant_id,
        medbrains_server_services::billing::AutoChargeInput {
            patient_id: patient,
            encounter_id: encounter,
            charge_code: item
                .charge_code
                .clone()
                .unwrap_or_else(|| "DENTAL".to_owned()),
            source: "dental".to_owned(),
            source_id: item.id,
            quantity: 1,
            description_override: Some(description),
            unit_price_override: Some(item.price),
            tax_percent_override: None,
        },
    )
    .await?;
    let item = sqlx::query_as::<_, DentalTreatmentItem>(&format!(
        "UPDATE dental_treatment_items SET invoice_id = $1 WHERE id = $2 AND tenant_id = $3 \
         RETURNING {ITEM_COLUMNS}"
    ))
    .bind(charged.invoice_id)
    .bind(item.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(item))
}

/// `POST /api/specialty/dental/treatment/{id}/cancel` — drop a planned procedure.
pub async fn cancel_treatment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DentalTreatmentItem>, AppError> {
    require_permission(&claims, permissions::specialty::dental::treatment::MANAGE)?;
    let exam = exam_of(&state, &claims, "item", id).await?;
    exam_access(&state, &claims, exam).await?;
    let mut tx = begin(&state, &claims).await?;
    let item = sqlx::query_as::<_, DentalTreatmentItem>(&format!(
        "UPDATE dental_treatment_items SET status = 'cancelled' \
          WHERE id = $1 AND tenant_id = $2 AND status = 'planned' AND deleted_at IS NULL \
          RETURNING {ITEM_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("A procedure already done can't be cancelled".to_owned()))?;
    tx.commit().await?;
    Ok(Json(item))
}

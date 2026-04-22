#![allow(clippy::too_many_lines)]

use axum::{Extension, Json, extract::{Path, Query, State}};
use medbrains_core::permissions;
use medbrains_core::radiology::{
    RadiationDoseRecord, RadiologyModality, RadiologyOrder, RadiologyReport,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListOrdersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub patient_id: Option<Uuid>,
    pub modality_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct OrderListResponse {
    pub orders: Vec<RadiologyOrder>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub modality_id: Uuid,
    pub body_part: Option<String>,
    pub clinical_indication: Option<String>,
    pub priority: Option<String>,
    pub scheduled_at: Option<String>,
    pub notes: Option<String>,
    pub contrast_required: Option<bool>,
    pub pregnancy_checked: Option<bool>,
    pub allergy_flagged: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct OrderDetailResponse {
    pub order: RadiologyOrder,
    pub report: Option<RadiologyReport>,
    pub dose_records: Vec<RadiationDoseRecord>,
}

#[derive(Debug, Deserialize)]
pub struct CancelOrderRequest {
    pub cancellation_reason: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportRequest {
    pub findings: String,
    pub impression: Option<String>,
    pub recommendations: Option<String>,
    pub is_critical: Option<bool>,
    pub template_name: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateModalityRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModalityRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RecordDoseRequest {
    pub modality_code: String,
    pub body_part: Option<String>,
    pub dose_value: Option<Decimal>,
    pub dose_unit: Option<String>,
    pub dlp: Option<Decimal>,
    pub ctdi_vol: Option<Decimal>,
    pub dap: Option<Decimal>,
    pub fluoroscopy_time_seconds: Option<i32>,
}

// ══════════════════════════════════════════════════════════
//  GET /api/radiology/orders
// ══════════════════════════════════════════════════════════

pub async fn list_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListOrdersQuery>,
) -> Result<Json<OrderListResponse>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        binds.push(Bind { uuid_val: None, string_val: Some(status.clone()) });
        bind_idx += 1;
    }
    if let Some(ref priority) = params.priority {
        conditions.push(format!("priority::text = ${bind_idx}"));
        binds.push(Bind { uuid_val: None, string_val: Some(priority.clone()) });
        bind_idx += 1;
    }
    if let Some(pid) = params.patient_id {
        conditions.push(format!("patient_id = ${bind_idx}"));
        binds.push(Bind { uuid_val: Some(pid), string_val: None });
        bind_idx += 1;
    }
    if let Some(mid) = params.modality_id {
        conditions.push(format!("modality_id = ${bind_idx}"));
        binds.push(Bind { uuid_val: Some(mid), string_val: None });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM radiology_orders WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val { cq = cq.bind(u); }
        if let Some(ref s) = b.string_val { cq = cq.bind(s.clone()); }
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM radiology_orders WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, RadiologyOrder>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val { dq = dq.bind(u); }
        if let Some(ref s) = b.string_val { dq = dq.bind(s.clone()); }
    }
    let orders = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(OrderListResponse { orders, total, page, per_page }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/orders
// ══════════════════════════════════════════════════════════

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;

    let priority = body.priority.as_deref().unwrap_or("routine");
    let contrast = body.contrast_required.unwrap_or(false);
    let pregnancy = body.pregnancy_checked.unwrap_or(false);
    let allergy = body.allergy_flagged.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "INSERT INTO radiology_orders \
         (tenant_id, patient_id, encounter_id, modality_id, ordered_by, \
          body_part, clinical_indication, priority, status, \
          scheduled_at, notes, contrast_required, pregnancy_checked, allergy_flagged) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::radiology_priority, \
                 'ordered'::radiology_order_status, \
                 $9::timestamptz, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.modality_id)
    .bind(claims.sub)
    .bind(&body.body_part)
    .bind(&body.clinical_indication)
    .bind(priority)
    .bind(&body.scheduled_at)
    .bind(&body.notes)
    .bind(contrast)
    .bind(pregnancy)
    .bind(allergy)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  GET /api/radiology/orders/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderDetailResponse>, AppError> {
    require_permission(&claims, permissions::radiology::orders::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "SELECT * FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let report = sqlx::query_as::<_, RadiologyReport>(
        "SELECT * FROM radiology_reports WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let dose_records = sqlx::query_as::<_, RadiationDoseRecord>(
        "SELECT * FROM radiation_dose_records WHERE order_id = $1 AND tenant_id = $2 \
         ORDER BY recorded_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(OrderDetailResponse { order, report, dose_records }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/radiology/orders/{id}/status  — status transitions
// ══════════════════════════════════════════════════════════

pub async fn update_order_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStatusRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let completed_clause = if body.status == "completed" {
        ", completed_at = now()"
    } else {
        ""
    };

    let sql = format!(
        "UPDATE radiology_orders SET \
         status = $1::radiology_order_status{completed_clause}, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *"
    );

    let order = sqlx::query_as::<_, RadiologyOrder>(&sql)
        .bind(&body.status)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    // Auto-billing: charge when radiology order is completed
    if body.status == "completed"
        && super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "radiology")
            .await?
    {
        if let Some(encounter_id) = order.encounter_id {
            let modality_code = sqlx::query_scalar::<_, String>(
                "SELECT code FROM radiology_modalities \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(order.modality_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;

            let charge_code = modality_code.map_or_else(|| "RAD-EXAM".to_owned(), |c| format!("RAD-{c}"));

            let _ = super::billing::auto_charge(
                &mut tx,
                &claims.tenant_id,
                super::billing::AutoChargeInput {
                    patient_id: order.patient_id,
                    encounter_id,
                    charge_code,
                    source: "radiology".to_owned(),
                    source_id: order.id,
                    quantity: 1,
                    description_override: None,
                    unit_price_override: None,
                    tax_percent_override: None,
                },
            )
            .await;
        }
    }

    let is_completed = body.status == "completed";

    tx.commit().await?;

    if is_completed {
        let _ = crate::events::emit_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            "radiology.completed",
            serde_json::json!({
                "order_id": order.id,
                "patient_id": order.patient_id,
                "encounter_id": order.encounter_id,
            }),
        )
        .await;
    }

    Ok(Json(order))
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

// ══════════════════════════════════════════════════════════
//  PUT /api/radiology/orders/{id}/cancel
// ══════════════════════════════════════════════════════════

pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelOrderRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CANCEL)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "UPDATE radiology_orders SET \
         status = 'cancelled'::radiology_order_status, \
         cancellation_reason = $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND status = 'ordered'::radiology_order_status \
         RETURNING *",
    )
    .bind(&body.cancellation_reason)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/orders/{id}/report
// ══════════════════════════════════════════════════════════

pub async fn create_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<CreateReportRequest>,
) -> Result<Json<RadiologyReport>, AppError> {
    require_permission(&claims, permissions::radiology::reports::CREATE)?;

    let report_status = body.status.as_deref().unwrap_or("draft");
    let is_critical = body.is_critical.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify order exists
    let order_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM radiology_orders WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if !order_exists {
        return Err(AppError::NotFound);
    }

    let report = sqlx::query_as::<_, RadiologyReport>(
        "INSERT INTO radiology_reports \
         (tenant_id, order_id, reported_by, status, findings, impression, \
          recommendations, is_critical, template_name) \
         VALUES ($1, $2, $3, $4::radiology_report_status, $5, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .bind(claims.sub)
    .bind(report_status)
    .bind(&body.findings)
    .bind(&body.impression)
    .bind(&body.recommendations)
    .bind(is_critical)
    .bind(&body.template_name)
    .fetch_one(&mut *tx)
    .await?;

    // Update order status to reported
    sqlx::query(
        "UPDATE radiology_orders SET status = 'reported'::radiology_order_status, \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(report))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/radiology/reports/{id}/verify
// ══════════════════════════════════════════════════════════

pub async fn verify_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RadiologyReport>, AppError> {
    require_permission(&claims, permissions::radiology::reports::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let report = sqlx::query_as::<_, RadiologyReport>(
        "UPDATE radiology_reports SET \
         status = 'final'::radiology_report_status, \
         verified_by = $1, verified_at = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Update the associated order to verified
    sqlx::query(
        "UPDATE radiology_orders SET status = 'verified'::radiology_order_status, \
         updated_at = now() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(report.order_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(report))
}

// ══════════════════════════════════════════════════════════
//  Modality master CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_modalities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RadiologyModality>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let modalities = sqlx::query_as::<_, RadiologyModality>(
        "SELECT * FROM radiology_modalities WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(modalities))
}

pub async fn create_modality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateModalityRequest>,
) -> Result<Json<RadiologyModality>, AppError> {
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let modality = sqlx::query_as::<_, RadiologyModality>(
        "INSERT INTO radiology_modalities (tenant_id, code, name, description) \
         VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(modality))
}

pub async fn update_modality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateModalityRequest>,
) -> Result<Json<RadiologyModality>, AppError> {
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let modality = sqlx::query_as::<_, RadiologyModality>(
        "UPDATE radiology_modalities SET \
         name = COALESCE($1, name), \
         description = COALESCE($2, description), \
         is_active = COALESCE($3, is_active), \
         updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 \
         RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(modality))
}

pub async fn delete_modality(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "DELETE FROM radiology_modalities WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/orders/{id}/dose  — radiation dose recording
// ══════════════════════════════════════════════════════════

pub async fn record_dose(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<RecordDoseRequest>,
) -> Result<Json<RadiationDoseRecord>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;

    let dose_unit = body.dose_unit.as_deref().unwrap_or("mGy");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get patient_id from the order
    let patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM radiology_orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let record = sqlx::query_as::<_, RadiationDoseRecord>(
        "INSERT INTO radiation_dose_records \
         (tenant_id, order_id, patient_id, modality_code, body_part, \
          dose_value, dose_unit, dlp, ctdi_vol, dap, \
          fluoroscopy_time_seconds, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .bind(patient_id)
    .bind(&body.modality_code)
    .bind(&body.body_part)
    .bind(body.dose_value)
    .bind(dose_unit)
    .bind(body.dlp)
    .bind(body.ctdi_vol)
    .bind(body.dap)
    .bind(body.fluoroscopy_time_seconds)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(record))
}

// ══════════════════════════════════════════════════════════
//  GET /api/radiology/appointments — list scheduled orders
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAppointmentsQuery {
    pub modality_id: Option<Uuid>,
    pub date: Option<String>,
}

pub async fn list_radiology_appointments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListAppointmentsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT COALESCE(json_agg(r ORDER BY r.created_at), '[]'::json) FROM ( \
         SELECT ro.id, \
            p.first_name || ' ' || p.last_name as patient_name, \
            rm.name as modality, \
            ro.created_at::date::text as scheduled_date, \
            ro.status::text, \
            ro.priority::text, \
            ro.created_at \
         FROM radiology_orders ro \
         JOIN patients p ON p.id = ro.patient_id \
         JOIN radiology_modalities rm ON rm.id = ro.modality_id \
         WHERE ro.tenant_id = $1 \
           AND ro.status NOT IN ('cancelled', 'completed') \
           AND ($2::uuid IS NULL OR ro.modality_id = $2) \
         LIMIT 100 \
         ) r",
    )
    .bind(claims.tenant_id)
    .bind(query.modality_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"appointments": rows})))
}

// ══════════════════════════════════════════════════════════
//  POST /api/radiology/appointments — schedule order
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRadiologyAppointmentRequest {
    pub patient_id: Uuid,
    pub modality_id: Uuid,
    pub encounter_id: Uuid,
    pub priority: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_radiology_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRadiologyAppointmentRequest>,
) -> Result<Json<RadiologyOrder>, AppError> {
    require_permission(&claims, permissions::radiology::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let order = sqlx::query_as::<_, RadiologyOrder>(
        "INSERT INTO radiology_orders \
         (tenant_id, patient_id, encounter_id, modality_id, status, \
          priority, clinical_notes, ordered_by) \
         VALUES ($1, $2, $3, $4, 'ordered'::radiology_order_status, \
                 COALESCE($5, 'routine')::radiology_priority, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.modality_id)
    .bind(body.priority.as_deref())
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(order))
}

// ══════════════════════════════════════════════════════════
//  GET /api/radiology/analytics/tat — TAT per modality
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RadiologyTatRow {
    pub modality_name: String,
    pub total_orders: i64,
    pub avg_tat_hours: Option<f64>,
    pub completed_count: i64,
}

pub async fn get_radiology_tat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RadiologyTatRow>>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RadiologyTatRow>(
        "SELECT rm.name AS modality_name, \
                COUNT(*)::bigint AS total_orders, \
                AVG(EXTRACT(EPOCH FROM (ro.updated_at - ro.created_at)) / 3600.0) \
                    FILTER (WHERE ro.status = 'completed') AS avg_tat_hours, \
                COUNT(*) FILTER (WHERE ro.status = 'completed')::bigint AS completed_count \
         FROM radiology_orders ro \
         JOIN radiology_modalities rm ON rm.id = ro.modality_id \
         WHERE ro.tenant_id = $1 \
           AND ro.created_at >= CURRENT_DATE - INTERVAL '30 days' \
         GROUP BY rm.name ORDER BY total_orders DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

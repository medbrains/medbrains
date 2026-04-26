#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::utilization_review::{
    UrPayerCommunication, UrStatusConversion, UtilizationReview,
};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Convenience alias matching the rest of the codebase.
async fn set_tenant_context(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<(), AppError> {
    Ok(medbrains_db::pool::set_tenant_context(tx, tenant_id).await?)
}

// ======================================================================
//  Request / Query types
// ======================================================================

// -- Reviews -----------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListReviewsQuery {
    pub admission_id: Option<Uuid>,
    pub review_type: Option<String>,
    pub decision: Option<String>,
    pub is_outlier: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReviewRequest {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub review_type: String,
    pub review_date: chrono::NaiveDate,
    pub patient_status: String,
    pub decision: String,
    pub criteria_source: Option<String>,
    pub criteria_met: Option<serde_json::Value>,
    pub clinical_summary: Option<String>,
    pub expected_los_days: Option<i32>,
    pub actual_los_days: Option<i32>,
    pub approved_days: Option<i32>,
    pub next_review_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReviewRequest {
    pub review_type: Option<String>,
    pub review_date: Option<chrono::NaiveDate>,
    pub patient_status: Option<String>,
    pub decision: Option<String>,
    pub criteria_source: Option<String>,
    pub criteria_met: Option<serde_json::Value>,
    pub clinical_summary: Option<String>,
    pub expected_los_days: Option<i32>,
    pub actual_los_days: Option<i32>,
    pub approved_days: Option<i32>,
    pub next_review_date: Option<chrono::NaiveDate>,
    pub notes: Option<String>,
}

// -- Communications ----------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListCommunicationsQuery {
    pub review_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommunicationRequest {
    pub review_id: Uuid,
    pub communication_type: String,
    pub payer_name: String,
    pub reference_number: Option<String>,
    pub summary: Option<String>,
    pub response: Option<String>,
    pub attachments: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommunicationRequest {
    pub communication_type: Option<String>,
    pub payer_name: Option<String>,
    pub reference_number: Option<String>,
    pub summary: Option<String>,
    pub response: Option<String>,
    pub attachments: Option<serde_json::Value>,
}

// -- Conversions -------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListConversionsQuery {
    pub admission_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversionRequest {
    pub admission_id: Uuid,
    pub from_status: String,
    pub to_status: String,
    pub conversion_date: chrono::NaiveDate,
    pub reason: Option<String>,
    pub effective_from: Option<chrono::DateTime<chrono::Utc>>,
}

// -- Analytics ---------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct UrAnalyticsSummary {
    pub total_reviews: i64,
    pub avg_expected_los: Option<f64>,
    pub avg_actual_los: Option<f64>,
    pub outlier_count: i64,
    pub denial_count: i64,
    pub approval_rate: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LosComparisonRow {
    pub department_name: Option<String>,
    pub review_count: i64,
    pub avg_expected_los: Option<f64>,
    pub avg_actual_los: Option<f64>,
}

// -- Internal helpers --------------------------------------------------

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct AvgLosRow {
    avg_expected: Option<f64>,
    avg_actual: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AiExtractResponse {
    status: String,
    message: String,
}

// ======================================================================
//  Handlers -- Reviews
// ======================================================================

/// GET /utilization-review/reviews
pub async fn list_reviews(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListReviewsQuery>,
) -> Result<Json<Vec<UtilizationReview>>, AppError> {
    require_permission(&claims, permissions::ur::reviews::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UtilizationReview>(
        "SELECT * FROM utilization_reviews \
         WHERE ($1::uuid IS NULL OR admission_id = $1) \
         AND ($2::text IS NULL OR review_type::text = $2) \
         AND ($3::text IS NULL OR decision::text = $3) \
         AND ($4::bool IS NULL OR is_outlier = $4) \
         ORDER BY review_date DESC, created_at DESC \
         LIMIT 500",
    )
    .bind(params.admission_id)
    .bind(&params.review_type)
    .bind(&params.decision)
    .bind(params.is_outlier)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /utilization-review/reviews
pub async fn create_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReviewRequest>,
) -> Result<(StatusCode, Json<UtilizationReview>), AppError> {
    require_permission(&claims, permissions::ur::reviews::CREATE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Calculate is_outlier: actual > expected * 1.5
    let is_outlier = match (body.actual_los_days, body.expected_los_days) {
        (Some(actual), Some(expected)) if expected > 0 => {
            f64::from(actual) > f64::from(expected) * 1.5
        }
        _ => false,
    };

    let criteria_met = body
        .criteria_met
        .unwrap_or_else(|| serde_json::Value::Object(serde_json::Map::new()));

    let row = sqlx::query_as::<_, UtilizationReview>(
        "INSERT INTO utilization_reviews \
             (tenant_id, admission_id, patient_id, reviewer_id, \
              review_type, review_date, patient_status, decision, \
              criteria_source, criteria_met, clinical_summary, \
              expected_los_days, actual_los_days, is_outlier, \
              approved_days, next_review_date, notes) \
         VALUES \
             ($1, $2, $3, $4, \
              $5::ur_review_type, $6, $7, $8::ur_decision, \
              $9, $10, $11, \
              $12, $13, $14, \
              $15, $16, $17) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.admission_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(&body.review_type)
    .bind(body.review_date)
    .bind(&body.patient_status)
    .bind(&body.decision)
    .bind(&body.criteria_source)
    .bind(&criteria_met)
    .bind(&body.clinical_summary)
    .bind(body.expected_los_days)
    .bind(body.actual_los_days)
    .bind(is_outlier)
    .bind(body.approved_days)
    .bind(body.next_review_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// GET /utilization-review/reviews/outliers
pub async fn list_outliers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UtilizationReview>>, AppError> {
    require_permission(&claims, permissions::ur::reviews::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UtilizationReview>(
        "SELECT * FROM utilization_reviews \
         WHERE is_outlier = true \
         ORDER BY review_date DESC, created_at DESC \
         LIMIT 500",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /utilization-review/reviews/:id
pub async fn get_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<UtilizationReview>, AppError> {
    require_permission(&claims, permissions::ur::reviews::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row =
        sqlx::query_as::<_, UtilizationReview>("SELECT * FROM utilization_reviews WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /utilization-review/reviews/:id
pub async fn update_review(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReviewRequest>,
) -> Result<Json<UtilizationReview>, AppError> {
    require_permission(&claims, permissions::ur::reviews::UPDATE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch current to compute merged values for outlier calculation
    let current =
        sqlx::query_as::<_, UtilizationReview>("SELECT * FROM utilization_reviews WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    let expected = body.expected_los_days.or(current.expected_los_days);
    let actual = body.actual_los_days.or(current.actual_los_days);

    // Recalculate is_outlier: actual > expected * 1.5
    let is_outlier = match (actual, expected) {
        (Some(a), Some(e)) if e > 0 => f64::from(a) > f64::from(e) * 1.5,
        _ => false,
    };

    let row = sqlx::query_as::<_, UtilizationReview>(
        "UPDATE utilization_reviews SET \
             review_type     = COALESCE($2::ur_review_type, review_type), \
             review_date     = COALESCE($3, review_date), \
             patient_status  = COALESCE($4, patient_status), \
             decision        = COALESCE($5::ur_decision, decision), \
             criteria_source = COALESCE($6, criteria_source), \
             criteria_met    = COALESCE($7, criteria_met), \
             clinical_summary = COALESCE($8, clinical_summary), \
             expected_los_days = COALESCE($9, expected_los_days), \
             actual_los_days  = COALESCE($10, actual_los_days), \
             is_outlier       = $11, \
             approved_days    = COALESCE($12, approved_days), \
             next_review_date = COALESCE($13, next_review_date), \
             notes            = COALESCE($14, notes), \
             updated_at       = now() \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(&body.review_type)
    .bind(body.review_date)
    .bind(&body.patient_status)
    .bind(&body.decision)
    .bind(&body.criteria_source)
    .bind(&body.criteria_met)
    .bind(&body.clinical_summary)
    .bind(body.expected_los_days)
    .bind(body.actual_los_days)
    .bind(is_outlier)
    .bind(body.approved_days)
    .bind(body.next_review_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// POST /utilization-review/reviews/:id/ai-extract
pub async fn ai_extract_stub(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(_id): Path<Uuid>,
) -> Result<Json<AiExtractResponse>, AppError> {
    require_permission(&claims, permissions::ur::reviews::UPDATE)?;

    // Validate tenant context even though this is a stub
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(AiExtractResponse {
        status: "stub".to_owned(),
        message: "ML extraction deferred to Phase 3".to_owned(),
    }))
}

/// GET /utilization-review/reviews/admission/:admission_id
pub async fn list_by_admission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<Vec<UtilizationReview>>, AppError> {
    require_permission(&claims, permissions::ur::reviews::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UtilizationReview>(
        "SELECT * FROM utilization_reviews \
         WHERE admission_id = $1 \
         ORDER BY review_date ASC, created_at ASC",
    )
    .bind(admission_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ======================================================================
//  Handlers -- Payer Communications
// ======================================================================

/// GET /utilization-review/communications
pub async fn list_communications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCommunicationsQuery>,
) -> Result<Json<Vec<UrPayerCommunication>>, AppError> {
    require_permission(&claims, permissions::ur::communications::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UrPayerCommunication>(
        "SELECT * FROM ur_payer_communications \
         WHERE ($1::uuid IS NULL OR review_id = $1) \
         ORDER BY communicated_at DESC \
         LIMIT 500",
    )
    .bind(params.review_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /utilization-review/communications
pub async fn create_communication(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCommunicationRequest>,
) -> Result<(StatusCode, Json<UrPayerCommunication>), AppError> {
    require_permission(&claims, permissions::ur::communications::CREATE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let attachments = body
        .attachments
        .unwrap_or_else(|| serde_json::Value::Array(vec![]));

    let row = sqlx::query_as::<_, UrPayerCommunication>(
        "INSERT INTO ur_payer_communications \
             (tenant_id, review_id, communication_type, payer_name, \
              reference_number, communicated_at, summary, response, \
              attachments, communicated_by) \
         VALUES \
             ($1, $2, $3, $4, \
              $5, now(), $6, $7, \
              $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.review_id)
    .bind(&body.communication_type)
    .bind(&body.payer_name)
    .bind(&body.reference_number)
    .bind(&body.summary)
    .bind(&body.response)
    .bind(&attachments)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PUT /utilization-review/communications/:id
pub async fn update_communication(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCommunicationRequest>,
) -> Result<Json<UrPayerCommunication>, AppError> {
    require_permission(&claims, permissions::ur::communications::CREATE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, UrPayerCommunication>(
        "UPDATE ur_payer_communications SET \
             communication_type = COALESCE($2, communication_type), \
             payer_name         = COALESCE($3, payer_name), \
             reference_number   = COALESCE($4, reference_number), \
             summary            = COALESCE($5, summary), \
             response           = COALESCE($6, response), \
             attachments        = COALESCE($7, attachments), \
             updated_at         = now() \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(&body.communication_type)
    .bind(&body.payer_name)
    .bind(&body.reference_number)
    .bind(&body.summary)
    .bind(&body.response)
    .bind(&body.attachments)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ======================================================================
//  Handlers -- Status Conversions
// ======================================================================

/// GET /utilization-review/conversions
pub async fn list_conversions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListConversionsQuery>,
) -> Result<Json<Vec<UrStatusConversion>>, AppError> {
    require_permission(&claims, permissions::ur::conversions::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UrStatusConversion>(
        "SELECT * FROM ur_status_conversions \
         WHERE ($1::uuid IS NULL OR admission_id = $1) \
         ORDER BY conversion_date DESC, created_at DESC \
         LIMIT 500",
    )
    .bind(params.admission_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /utilization-review/conversions
pub async fn create_conversion(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConversionRequest>,
) -> Result<(StatusCode, Json<UrStatusConversion>), AppError> {
    require_permission(&claims, permissions::ur::conversions::CREATE)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let effective = body.effective_from.unwrap_or_else(chrono::Utc::now);

    let row = sqlx::query_as::<_, UrStatusConversion>(
        "INSERT INTO ur_status_conversions \
             (tenant_id, admission_id, from_status, to_status, \
              conversion_date, reason, effective_from, converted_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.admission_id)
    .bind(&body.from_status)
    .bind(&body.to_status)
    .bind(body.conversion_date)
    .bind(&body.reason)
    .bind(effective)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

// ======================================================================
//  Handlers -- Analytics
// ======================================================================

/// GET /utilization-review/analytics/summary
pub async fn analytics_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UrAnalyticsSummary>, AppError> {
    require_permission(&claims, permissions::ur::reviews::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Total reviews
    let total_row =
        sqlx::query_as::<_, CountRow>("SELECT COUNT(*)::bigint AS count FROM utilization_reviews")
            .fetch_one(&mut *tx)
            .await?;

    // Average LOS
    let los_row = sqlx::query_as::<_, AvgLosRow>(
        "SELECT \
             AVG(expected_los_days::float8) AS avg_expected, \
             AVG(actual_los_days::float8)   AS avg_actual \
         FROM utilization_reviews \
         WHERE expected_los_days IS NOT NULL \
            OR actual_los_days IS NOT NULL",
    )
    .fetch_one(&mut *tx)
    .await?;

    // Outlier count
    let outlier_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count \
         FROM utilization_reviews WHERE is_outlier = true",
    )
    .fetch_one(&mut *tx)
    .await?;

    // Denial count
    let denial_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count \
         FROM utilization_reviews WHERE decision = 'denied'",
    )
    .fetch_one(&mut *tx)
    .await?;

    // Approval rate
    let approval_rate = if total_row.count > 0 {
        let approved_row = sqlx::query_as::<_, CountRow>(
            "SELECT COUNT(*)::bigint AS count \
             FROM utilization_reviews WHERE decision = 'approved'",
        )
        .fetch_one(&mut *tx)
        .await?;
        (approved_row.count as f64) / (total_row.count as f64) * 100.0
    } else {
        0.0
    };

    tx.commit().await?;

    Ok(Json(UrAnalyticsSummary {
        total_reviews: total_row.count,
        avg_expected_los: los_row.avg_expected,
        avg_actual_los: los_row.avg_actual,
        outlier_count: outlier_row.count,
        denial_count: denial_row.count,
        approval_rate,
    }))
}

/// GET /utilization-review/analytics/los-comparison
pub async fn los_comparison(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LosComparisonRow>>, AppError> {
    require_permission(&claims, permissions::ur::reviews::LIST)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LosComparisonRow>(
        "SELECT \
             d.name AS department_name, \
             COUNT(ur.id)::bigint AS review_count, \
             AVG(ur.expected_los_days::float8) AS avg_expected_los, \
             AVG(ur.actual_los_days::float8)   AS avg_actual_los \
         FROM utilization_reviews ur \
         JOIN admissions a ON a.id = ur.admission_id AND a.tenant_id = ur.tenant_id \
         JOIN departments d ON d.id = a.department_id AND d.tenant_id = a.tenant_id \
         GROUP BY d.name \
         ORDER BY review_count DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

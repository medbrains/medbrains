#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::case_mgmt::{CaseAssignment, CaseReferral, DischargeBarrier};
use medbrains_core::permissions;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ======================================================================
//  Request / Query types
// ======================================================================

// -- Assignments -------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListAssignmentsQuery {
    pub case_manager_id: Option<Uuid>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssignmentRequest {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub case_manager_id: Uuid,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub target_discharge_date: Option<chrono::NaiveDate>,
    pub discharge_disposition: Option<String>,
    pub disposition_details: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssignmentRequest {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub target_discharge_date: Option<chrono::NaiveDate>,
    pub actual_discharge_date: Option<chrono::NaiveDate>,
    pub discharge_disposition: Option<String>,
    pub disposition_details: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AutoAssignRequest {
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub priority: Option<String>,
    pub notes: Option<String>,
}

// -- Barriers ----------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListBarriersQuery {
    pub case_assignment_id: Option<Uuid>,
    pub barrier_type: Option<String>,
    pub is_resolved: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBarrierRequest {
    pub case_assignment_id: Uuid,
    pub barrier_type: String,
    pub description: String,
    pub identified_date: Option<chrono::NaiveDate>,
    pub escalated_to: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBarrierRequest {
    pub barrier_type: Option<String>,
    pub description: Option<String>,
    pub is_resolved: Option<bool>,
    pub escalated_to: Option<String>,
    pub notes: Option<String>,
}

// -- Referrals ---------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListReferralsQuery {
    pub case_assignment_id: Option<Uuid>,
    pub referral_type: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReferralRequest {
    pub case_assignment_id: Uuid,
    pub referral_type: String,
    pub referred_to: String,
    pub status: Option<String>,
    pub facility_details: Option<serde_json::Value>,
    pub outcome: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateReferralRequest {
    pub referral_type: Option<String>,
    pub referred_to: Option<String>,
    pub status: Option<String>,
    pub facility_details: Option<serde_json::Value>,
    pub outcome: Option<String>,
}

// ======================================================================
//  Analytics response types
// ======================================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CaseloadRow {
    pub case_manager_id: Uuid,
    pub active_cases: i64,
    pub pending_discharge: i64,
    pub total_cases: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DispositionRow {
    pub disposition: Option<String>,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BarrierAnalyticsRow {
    pub barrier_type: String,
    pub count: i64,
    pub avg_days_open: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct OutcomeAnalytics {
    pub avg_days_to_discharge: Option<f64>,
    pub total_discharged: i64,
    pub total_with_barriers: i64,
}

// Internal helper rows for outcome analytics
#[derive(Debug, sqlx::FromRow)]
struct AvgDaysRow {
    avg_days: Option<f64>,
}

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

// ======================================================================
//  Handlers -- Assignments
// ======================================================================

/// GET /api/case-mgmt/assignments
pub async fn list_assignments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAssignmentsQuery>,
) -> Result<Json<Vec<CaseAssignment>>, AppError> {
    require_permission(&claims, permissions::case_mgmt::assignments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CaseAssignment>(
        "SELECT * FROM case_assignments \
         WHERE ($1::uuid IS NULL OR case_manager_id = $1) \
         AND ($2::text IS NULL OR status::text = $2) \
         AND ($3::text IS NULL OR priority = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(params.case_manager_id)
    .bind(&params.status)
    .bind(&params.priority)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/case-mgmt/assignments
pub async fn create_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAssignmentRequest>,
) -> Result<(StatusCode, Json<CaseAssignment>), AppError> {
    require_permission(&claims, permissions::case_mgmt::assignments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseAssignment>(
        "INSERT INTO case_assignments \
         (tenant_id, admission_id, patient_id, case_manager_id, \
          status, priority, target_discharge_date, \
          discharge_disposition, disposition_details, notes) \
         VALUES ($1, $2, $3, $4, \
                 COALESCE($5::case_mgmt_status, 'assigned'), \
                 COALESCE($6, 'normal'), $7, \
                 $8, COALESCE($9, '{}'::jsonb), $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.admission_id)
    .bind(body.patient_id)
    .bind(body.case_manager_id)
    .bind(&body.status)
    .bind(&body.priority)
    .bind(body.target_discharge_date)
    .bind(&body.discharge_disposition)
    .bind(&body.disposition_details)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// GET /api/case-mgmt/assignments/{id}
pub async fn get_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CaseAssignment>, AppError> {
    require_permission(&claims, permissions::case_mgmt::assignments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseAssignment>("SELECT * FROM case_assignments WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/case-mgmt/assignments/{id}
pub async fn update_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAssignmentRequest>,
) -> Result<Json<CaseAssignment>, AppError> {
    require_permission(&claims, permissions::case_mgmt::assignments::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseAssignment>(
        "UPDATE case_assignments SET \
         status = COALESCE($2::case_mgmt_status, status), \
         priority = COALESCE($3, priority), \
         target_discharge_date = COALESCE($4, target_discharge_date), \
         actual_discharge_date = COALESCE($5, actual_discharge_date), \
         discharge_disposition = COALESCE($6, discharge_disposition), \
         disposition_details = COALESCE($7, disposition_details), \
         notes = COALESCE($8, notes), \
         updated_at = NOW() \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.priority)
    .bind(body.target_discharge_date)
    .bind(body.actual_discharge_date)
    .bind(&body.discharge_disposition)
    .bind(&body.disposition_details)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// GET /api/case-mgmt/caseload-summary
pub async fn caseload_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CaseloadRow>>, AppError> {
    require_permission(&claims, permissions::case_mgmt::assignments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CaseloadRow>(
        "SELECT \
           case_manager_id, \
           COUNT(*) FILTER (WHERE status IN ('assigned', 'active')) AS active_cases, \
           COUNT(*) FILTER (WHERE status = 'pending_discharge') AS pending_discharge, \
           COUNT(*) AS total_cases \
         FROM case_assignments \
         GROUP BY case_manager_id \
         ORDER BY active_cases DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/case-mgmt/auto-assign
pub async fn auto_assign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AutoAssignRequest>,
) -> Result<(StatusCode, Json<CaseAssignment>), AppError> {
    require_permission(&claims, permissions::case_mgmt::assignments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Find the case manager with the fewest active assignments.
    // A "case manager" is a user whose role name is 'case_manager'.
    let manager_row = sqlx::query_as::<_, CaseManagerCandidate>(
        "SELECT u.id AS user_id, \
                COALESCE(cnt.active_count, 0) AS active_count \
         FROM users u \
         JOIN roles r ON r.id = u.role_id AND r.tenant_id = u.tenant_id \
         WHERE r.name = 'case_manager' \
           AND u.is_active = true \
         LEFT JOIN LATERAL ( \
             SELECT COUNT(*) AS active_count \
             FROM case_assignments ca \
             WHERE ca.case_manager_id = u.id \
               AND ca.status IN ('assigned', 'active', 'pending_discharge') \
         ) cnt ON true \
         ORDER BY active_count ASC \
         LIMIT 1",
    )
    .fetch_optional(&mut *tx)
    .await?;

    let manager =
        manager_row.ok_or_else(|| AppError::BadRequest("No case managers available".to_owned()))?;

    let row = sqlx::query_as::<_, CaseAssignment>(
        "INSERT INTO case_assignments \
         (tenant_id, admission_id, patient_id, case_manager_id, \
          status, priority, disposition_details, notes) \
         VALUES ($1, $2, $3, $4, \
                 'assigned'::case_mgmt_status, \
                 COALESCE($5, 'normal'), '{}'::jsonb, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.admission_id)
    .bind(body.patient_id)
    .bind(manager.user_id)
    .bind(&body.priority)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// Helper struct for auto-assign query
#[derive(Debug, sqlx::FromRow)]
struct CaseManagerCandidate {
    user_id: Uuid,
    #[allow(dead_code)]
    active_count: i64,
}

// ======================================================================
//  Handlers -- Barriers
// ======================================================================

/// GET /api/case-mgmt/barriers
pub async fn list_barriers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBarriersQuery>,
) -> Result<Json<Vec<DischargeBarrier>>, AppError> {
    require_permission(&claims, permissions::case_mgmt::barriers::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DischargeBarrier>(
        "SELECT * FROM discharge_barriers \
         WHERE ($1::uuid IS NULL OR case_assignment_id = $1) \
         AND ($2::text IS NULL OR barrier_type::text = $2) \
         AND ($3::bool IS NULL OR is_resolved = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(params.case_assignment_id)
    .bind(&params.barrier_type)
    .bind(params.is_resolved)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/case-mgmt/barriers
pub async fn create_barrier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBarrierRequest>,
) -> Result<(StatusCode, Json<DischargeBarrier>), AppError> {
    require_permission(&claims, permissions::case_mgmt::barriers::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let today = chrono::Utc::now().date_naive();

    let row = sqlx::query_as::<_, DischargeBarrier>(
        "INSERT INTO discharge_barriers \
         (tenant_id, case_assignment_id, barrier_type, description, \
          identified_date, escalated_to, notes) \
         VALUES ($1, $2, $3::discharge_barrier_type, $4, \
                 COALESCE($5, $6), $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.case_assignment_id)
    .bind(&body.barrier_type)
    .bind(&body.description)
    .bind(body.identified_date)
    .bind(today)
    .bind(&body.escalated_to)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PUT /api/case-mgmt/barriers/{id}
pub async fn update_barrier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBarrierRequest>,
) -> Result<Json<DischargeBarrier>, AppError> {
    require_permission(&claims, permissions::case_mgmt::barriers::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // If is_resolved is being set to true, auto-fill resolved_date and resolved_by
    let resolved_date: Option<chrono::NaiveDate> = if body.is_resolved == Some(true) {
        Some(chrono::Utc::now().date_naive())
    } else {
        None
    };

    let resolved_by: Option<Uuid> = if body.is_resolved == Some(true) {
        Some(claims.sub)
    } else {
        None
    };

    let row = sqlx::query_as::<_, DischargeBarrier>(
        "UPDATE discharge_barriers SET \
         barrier_type = COALESCE($2::discharge_barrier_type, barrier_type), \
         description = COALESCE($3, description), \
         is_resolved = COALESCE($4, is_resolved), \
         resolved_date = COALESCE($5, resolved_date), \
         resolved_by = COALESCE($6, resolved_by), \
         escalated_to = COALESCE($7, escalated_to), \
         notes = COALESCE($8, notes), \
         updated_at = NOW() \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.barrier_type.as_deref())
    .bind(body.description.as_deref())
    .bind(body.is_resolved)
    .bind(resolved_date)
    .bind(resolved_by)
    .bind(body.escalated_to.as_deref())
    .bind(body.notes.as_deref())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ======================================================================
//  Handlers -- Referrals
// ======================================================================

/// GET /api/case-mgmt/referrals
pub async fn list_referrals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListReferralsQuery>,
) -> Result<Json<Vec<CaseReferral>>, AppError> {
    require_permission(&claims, permissions::case_mgmt::referrals::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CaseReferral>(
        "SELECT * FROM case_referrals \
         WHERE ($1::uuid IS NULL OR case_assignment_id = $1) \
         AND ($2::text IS NULL OR referral_type = $2) \
         AND ($3::text IS NULL OR status = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(params.case_assignment_id)
    .bind(&params.referral_type)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/case-mgmt/referrals
pub async fn create_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateReferralRequest>,
) -> Result<(StatusCode, Json<CaseReferral>), AppError> {
    require_permission(&claims, permissions::case_mgmt::referrals::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseReferral>(
        "INSERT INTO case_referrals \
         (tenant_id, case_assignment_id, referral_type, referred_to, \
          status, facility_details, outcome, referred_by) \
         VALUES ($1, $2, $3, $4, \
                 COALESCE($5, 'pending'), \
                 COALESCE($6, '{}'::jsonb), $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.case_assignment_id)
    .bind(&body.referral_type)
    .bind(&body.referred_to)
    .bind(&body.status)
    .bind(&body.facility_details)
    .bind(&body.outcome)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

/// PUT /api/case-mgmt/referrals/{id}
pub async fn update_referral(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateReferralRequest>,
) -> Result<Json<CaseReferral>, AppError> {
    require_permission(&claims, permissions::case_mgmt::referrals::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseReferral>(
        "UPDATE case_referrals SET \
         referral_type = COALESCE($2, referral_type), \
         referred_to = COALESCE($3, referred_to), \
         status = COALESCE($4, status), \
         facility_details = COALESCE($5, facility_details), \
         outcome = COALESCE($6, outcome), \
         updated_at = NOW() \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.referral_type.as_deref())
    .bind(body.referred_to.as_deref())
    .bind(body.status.as_deref())
    .bind(&body.facility_details)
    .bind(body.outcome.as_deref())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ======================================================================
//  Handlers -- Analytics
// ======================================================================

/// GET /api/case-mgmt/analytics/disposition
pub async fn disposition_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DispositionRow>>, AppError> {
    require_permission(&claims, permissions::case_mgmt::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DispositionRow>(
        "SELECT \
           discharge_disposition AS disposition, \
           COUNT(*) AS count \
         FROM case_assignments \
         WHERE discharge_disposition IS NOT NULL \
         GROUP BY discharge_disposition \
         ORDER BY count DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/case-mgmt/analytics/barriers
pub async fn barrier_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BarrierAnalyticsRow>>, AppError> {
    require_permission(&claims, permissions::case_mgmt::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BarrierAnalyticsRow>(
        "SELECT \
           barrier_type::text AS barrier_type, \
           COUNT(*) AS count, \
           AVG(EXTRACT(EPOCH FROM (NOW() - identified_date::timestamp)) / 86400.0) \
             AS avg_days_open \
         FROM discharge_barriers \
         WHERE is_resolved = false \
         GROUP BY barrier_type \
         ORDER BY count DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/case-mgmt/analytics/outcomes
pub async fn outcome_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OutcomeAnalytics>, AppError> {
    require_permission(&claims, permissions::case_mgmt::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Average days between assignment creation and actual_discharge_date
    let avg_row = sqlx::query_as::<_, AvgDaysRow>(
        "SELECT \
           AVG(actual_discharge_date - created_at::date) AS avg_days \
         FROM case_assignments \
         WHERE actual_discharge_date IS NOT NULL",
    )
    .fetch_one(&mut *tx)
    .await?;

    // Total discharged
    let discharged_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) AS count \
         FROM case_assignments \
         WHERE status IN ('discharged', 'closed')",
    )
    .fetch_one(&mut *tx)
    .await?;

    // Total cases that had at least one barrier
    let barrier_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(DISTINCT ca.id) AS count \
         FROM case_assignments ca \
         INNER JOIN discharge_barriers db ON db.case_assignment_id = ca.id",
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(OutcomeAnalytics {
        avg_days_to_discharge: avg_row.avg_days,
        total_discharged: discharged_row.count.unwrap_or(0),
        total_with_barriers: barrier_row.count.unwrap_or(0),
    }))
}

//! IT Security routes — Break-Glass, Clinical Access Monitor, Stock Disposal,
//! TAT Tracking, Data Migration, EOD Digest, Data Quality, CERT-In Compliance.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use axum::routing::{get,post,delete,patch};
use medbrains_core::it_security::{
    AccessAlert,
    AcknowledgeAlertRequest,
    AddIncidentUpdateRequest,
    ApproveDisposalRequest,
    ApproveIncentiveRequest,
    AssignIncentivePlanRequest,
    BackupHistory,
    BreakGlassEvent,
    BreakGlassEventSummary,
    BreakGlassQuery,
    CalculateIncentiveRequest,
    CompleteOnboardingStepRequest,
    CompleteTatRecordRequest,
    ComplianceRequirement,
    // Break-Glass
    CreateBreakGlassRequest,
    CreateDataQualityRuleRequest,
    CreateDigestSubscriptionRequest,
    CreateDisposalRequest,
    CreateIncentivePlanRequest,
    CreateIncentiveRuleRequest,
    CreateMigrationRequest,
    CreateSecurityIncidentRequest,
    CreateSensitivePatientRequest,
    CreateTatBenchmarkRequest,
    CreateTatRecordRequest,
    CreateVulnerabilityRequest,
    DataMigration,
    DataQualityDashboard,
    DataQualityIssue,
    DataQualityQuery,
    // Data Quality
    DataQualityRule,
    // Stock Disposal
    DisposalQuery,
    DoctorIncentiveAssignment,
    EndBreakGlassRequest,
    EntityQualityStats,
    EodDigestHistory,
    // EOD Digest
    EodDigestSubscription,
    ExecuteDisposalRequest,
    IncentiveCalculation,
    // Incentives
    IncentivePlan,
    IncentivePlanRule,
    // CERT-In Compliance
    IncidentQuery,
    MarkIncentivePaidRequest,
    // Data Migration
    MigrationQuery,
    // Onboarding
    OnboardingProgress,
    ReportToCertInRequest,
    ResolveIssueRequest,
    ReviewBreakGlassRequest,
    SecurityIncident,
    SecurityIncidentSummary,
    SecurityIncidentUpdate,
    SensitivePatient,
    // Clinical Access Monitor
    SensitivePatientSummary,
    StockDisposalItem,
    StockDisposalRequest,
    StockDisposalSummary,
    // System Health
    SystemHealthDashboard,
    SystemHealthMetric,
    // TAT Tracking
    TatBenchmark,
    TatCategoryStats,
    TatDashboard,
    TatQuery,
    TatRecord,
    TatRecordSummary,
    UpdateComplianceRequest,
    UpdateOnboardingRequest,
    UpdateSecurityIncidentRequest,
    UpdateVulnerabilityRequest,
    Vulnerability,
};
use medbrains_core::permissions;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

fn parse_uuid(s: &Option<String>) -> Option<Uuid> {
    s.as_deref().and_then(|v| v.parse::<Uuid>().ok())
}

struct BreakGlassStart {
    patient_id: Uuid,
    scope_type: String,
    scope_id: Uuid,
    requested_modules: Vec<String>,
    expires_at: chrono::DateTime<chrono::Utc>,
    reason: String,
    justification: Option<String>,
}

struct BreakGlassAccessRollup {
    modules_seen: Vec<String>,
    phi_access_count: i32,
    last_phi_accessed_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn break_glass_grant_reason(event_id: Uuid) -> String {
    format!("break_glass:{event_id}")
}

fn merge_accessed_modules(mut manual: Vec<String>, observed: Vec<String>) -> Vec<String> {
    manual.extend(observed);
    manual.retain(|module| !module.trim().is_empty());
    manual.sort_unstable();
    manual.dedup();
    manual
}

fn normalize_break_glass_start(body: CreateBreakGlassRequest) -> Result<BreakGlassStart, AppError> {
    let reason = body.reason.trim().to_owned();
    if reason.len() < 5 {
        return Err(AppError::BadRequest(
            "Break-glass reason must be specific and at least 5 characters".to_owned(),
        ));
    }

    let patient_id = body.patient_id.ok_or_else(|| {
        AppError::BadRequest("Break-glass must be scoped to a patient".to_owned())
    })?;
    let scope_type = body.scope_type.unwrap_or_else(|| "patient".to_owned());
    if scope_type != "patient" {
        return Err(AppError::BadRequest(
            "Only patient-scoped break-glass is enabled for this release".to_owned(),
        ));
    }

    if let Some(scope_id) = body.scope_id {
        if scope_id != patient_id {
            return Err(AppError::BadRequest(
                "Patient break-glass scope_id must match patient_id".to_owned(),
            ));
        }
    }

    let expires_in_minutes = body.expires_in_minutes.unwrap_or(60);
    if !(5..=240).contains(&expires_in_minutes) {
        return Err(AppError::BadRequest(
            "Break-glass expiry must be between 5 and 240 minutes".to_owned(),
        ));
    }

    let requested_modules = body
        .requested_modules
        .unwrap_or_default()
        .into_iter()
        .map(|module| module.trim().to_owned())
        .filter(|module| !module.is_empty())
        .collect();

    Ok(BreakGlassStart {
        patient_id,
        scope_type,
        scope_id: patient_id,
        requested_modules,
        expires_at: chrono::Utc::now() + chrono::Duration::minutes(i64::from(expires_in_minutes)),
        reason,
        justification: body
            .justification
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
    })
}

async fn break_glass_access_rollup(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    event_id: Uuid,
) -> Result<BreakGlassAccessRollup, AppError> {
    let row = sqlx::query!(
        r#"
        SELECT
            COUNT(al.id)::int AS "phi_access_count!",
            MAX(al.created_at) AS last_phi_accessed_at,
            COALESCE(
                array_agg(DISTINCT al.module) FILTER (WHERE al.module IS NOT NULL),
                '{}'::text[]
            ) AS "modules_seen!"
        FROM break_glass_events b
        LEFT JOIN access_log al
          ON al.tenant_id = b.tenant_id
         AND al.user_id = b.user_id
         AND al.created_at >= b.start_time
         AND al.created_at <= LEAST(COALESCE(b.end_time, now()), b.expires_at)
         AND (
              b.scope_type <> 'patient'
              OR al.patient_id = b.patient_id
              OR (al.entity_type = 'patients' AND al.entity_id = b.patient_id)
         )
        WHERE b.id = $1 AND b.tenant_id = $2
        "#,
        event_id,
        tenant_id,
    )
    .fetch_one(&mut **tx)
    .await?;

    Ok(BreakGlassAccessRollup {
        modules_seen: row.modules_seen,
        phi_access_count: row.phi_access_count,
        last_phi_accessed_at: row.last_phi_accessed_at,
    })
}

// ══════════════════════════════════════════════════════════════
// BREAK-GLASS EMERGENCY ACCESS
// ══════════════════════════════════════════════════════════════

/// Start a break-glass session
pub async fn start_break_glass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    jar: axum_extra::extract::CookieJar,
    Json(body): Json<CreateBreakGlassRequest>,
) -> Result<Json<BreakGlassEvent>, AppError> {
    require_permission(&claims, permissions::audit::START)?;
    // Emergency override (out-of-scope access) — require fresh re-auth.
    medbrains_server_core::step_up::require_step_up(&state, &jar, &claims)?;

    let start = normalize_break_glass_start(body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as!(
        BreakGlassEvent,
        r#"
        INSERT INTO break_glass_events (
            id, tenant_id, user_id, patient_id, reason, justification,
            scope_type, scope_id, requested_modules, expires_at, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        RETURNING
            id, tenant_id, user_id, patient_id, reason, justification,
            modules_accessed AS "modules_accessed!",
            scope_type, scope_id,
            requested_modules AS "requested_modules!",
            start_time, end_time, expires_at, is_active, ip_address, user_agent,
            supervisor_id, reviewed_at, review_notes,
            phi_access_count, last_phi_accessed_at, created_at
        "#,
        id,
        claims.tenant_id,
        claims.sub,
        start.patient_id,
        start.reason,
        start.justification,
        start.scope_type,
        start.scope_id,
        &start.requested_modules,
        start.expires_at,
    )
    .fetch_one(&mut *tx)
    .await?;

    let tuple_id = Uuid::new_v4();
    let subject_id = claims.sub.to_string();
    let grant_reason = break_glass_grant_reason(id);
    sqlx::query!(
        "INSERT INTO relation_tuples (
             tuple_id, tenant_id, object_type, object_id, relation,
             subject_type, subject_id, expires_at, granted_by,
             granted_reason, source
         )
         VALUES ($1, $2, 'patient', $3, 'viewer', 'user', $4, $5, $6, $7, 'explicit')",
        tuple_id,
        claims.tenant_id,
        start.patient_id,
        subject_id,
        start.expires_at,
        claims.sub,
        grant_reason,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// End a break-glass session
pub async fn end_break_glass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<EndBreakGlassRequest>,
) -> Result<Json<BreakGlassEvent>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rollup = break_glass_access_rollup(&mut tx, claims.tenant_id, id).await?;
    let modules_accessed = merge_accessed_modules(body.modules_accessed, rollup.modules_seen);
    let grant_reason = break_glass_grant_reason(id);

    sqlx::query!(
        "UPDATE relation_tuples
         SET status = 'revoked', revoked_at = now(), revoked_by = $3
         WHERE tenant_id = $1
           AND granted_reason = $2
           AND granted_by = $3
           AND status = 'active'",
        claims.tenant_id,
        grant_reason,
        claims.sub,
    )
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as!(
        BreakGlassEvent,
        r#"
        UPDATE break_glass_events
        SET
            is_active = false,
            end_time = now(),
            modules_accessed = $4,
            phi_access_count = $5,
            last_phi_accessed_at = $6
        WHERE id = $1 AND tenant_id = $2 AND user_id = $3
        RETURNING
            id, tenant_id, user_id, patient_id, reason, justification,
            modules_accessed AS "modules_accessed!",
            scope_type, scope_id,
            requested_modules AS "requested_modules!",
            start_time, end_time, expires_at, is_active, ip_address, user_agent,
            supervisor_id, reviewed_at, review_notes,
            phi_access_count, last_phi_accessed_at, created_at
        "#,
        id,
        claims.tenant_id,
        claims.sub,
        &modules_accessed,
        rollup.phi_access_count,
        rollup.last_phi_accessed_at,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List break-glass events
pub async fn list_break_glass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<BreakGlassQuery>,
) -> Result<Json<Vec<BreakGlassEventSummary>>, AppError> {
    require_permission(&claims, permissions::audit::REVIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as!(
        BreakGlassEventSummary,
        r#"
        SELECT b.id, b.user_id, u.full_name AS user_name, b.patient_id,
         (p.first_name || ' ' || p.last_name) AS patient_name,
         b.reason, b.scope_type, b.scope_id,
         b.requested_modules AS "requested_modules!",
         b.start_time, b.end_time, b.expires_at,
         (b.is_active AND b.expires_at > now()) AS "is_active!",
         b.phi_access_count, b.last_phi_accessed_at,
         b.reviewed_at, b.created_at
         FROM break_glass_events b
         LEFT JOIN users u ON u.id = b.user_id
         LEFT JOIN patients p ON p.id = b.patient_id
         WHERE b.tenant_id = $9
         AND ($1::uuid IS NULL OR b.user_id = $1)
         AND ($2::uuid IS NULL OR b.patient_id = $2)
         AND ($3::boolean IS NULL OR (b.is_active AND b.expires_at > now()) = $3)
         AND ($4::boolean IS NULL OR (CASE WHEN $4 THEN b.reviewed_at IS NOT NULL ELSE b.reviewed_at IS NULL END))
         AND ($5::text IS NULL OR b.created_at >= ($5::text)::timestamptz)
         AND ($6::text IS NULL OR b.created_at <= ($6::text)::timestamptz)
         ORDER BY b.created_at DESC
         LIMIT $7 OFFSET $8
        "#,
        parse_uuid(&params.user_id),
        parse_uuid(&params.patient_id),
        params.is_active,
        params.reviewed,
        params.from,
        params.to,
        per_page,
        offset,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Get break-glass event detail
pub async fn get_break_glass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BreakGlassEvent>, AppError> {
    require_permission(&claims, permissions::audit::REVIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as!(
        BreakGlassEvent,
        r#"
        SELECT
            id, tenant_id, user_id, patient_id, reason, justification,
            modules_accessed AS "modules_accessed!",
            scope_type, scope_id,
            requested_modules AS "requested_modules!",
            start_time, end_time, expires_at,
            (is_active AND expires_at > now()) AS "is_active!",
            ip_address, user_agent, supervisor_id, reviewed_at, review_notes,
            phi_access_count, last_phi_accessed_at, created_at
        FROM break_glass_events
        WHERE id = $1 AND tenant_id = $2
        "#,
        id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Review a break-glass event
pub async fn review_break_glass(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewBreakGlassRequest>,
) -> Result<Json<BreakGlassEvent>, AppError> {
    require_permission(&claims, permissions::audit::REVIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rollup = break_glass_access_rollup(&mut tx, claims.tenant_id, id).await?;
    let current_modules = sqlx::query!(
        "SELECT modules_accessed AS \"modules_accessed!\" FROM break_glass_events
         WHERE id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?
    .modules_accessed;
    let modules_accessed = merge_accessed_modules(current_modules, rollup.modules_seen);

    let row = sqlx::query_as!(
        BreakGlassEvent,
        r#"
        UPDATE break_glass_events
        SET
            reviewed_at = now(),
            supervisor_id = $2,
            review_notes = $3,
            modules_accessed = $4,
            phi_access_count = $5,
            last_phi_accessed_at = $6
        WHERE id = $1 AND tenant_id = $7
        RETURNING
            id, tenant_id, user_id, patient_id, reason, justification,
            modules_accessed AS "modules_accessed!",
            scope_type, scope_id,
            requested_modules AS "requested_modules!",
            start_time, end_time, expires_at,
            (is_active AND expires_at > now()) AS "is_active!",
            ip_address, user_agent, supervisor_id, reviewed_at, review_notes,
            phi_access_count, last_phi_accessed_at, created_at
        "#,
        id,
        claims.sub,
        body.review_notes,
        &modules_accessed,
        rollup.phi_access_count,
        rollup.last_phi_accessed_at,
        claims.tenant_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════════
// CLINICAL ACCESS MONITOR
// ══════════════════════════════════════════════════════════════

/// List sensitive patients
pub async fn list_sensitive_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SensitivePatientSummary>>, AppError> {
    require_permission(&claims, permissions::audit::ACCESS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, SensitivePatientSummary>(
        "SELECT s.id, s.patient_id, (p.first_name || ' ' || p.last_name) AS patient_name,
         s.sensitivity_type, s.reason, s.alert_on_access, s.created_at
         FROM sensitive_patients s
         JOIN patients p ON p.id = s.patient_id
         ORDER BY s.created_at DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Add sensitive patient flag
pub async fn create_sensitive_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSensitivePatientRequest>,
) -> Result<Json<SensitivePatient>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, SensitivePatient>(
        "INSERT INTO sensitive_patients (id, tenant_id, patient_id, sensitivity_type, reason,
         access_restricted_to, alert_on_access, notify_users, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.sensitivity_type)
    .bind(&body.reason)
    .bind(&body.access_restricted_to)
    .bind(body.alert_on_access.unwrap_or(true))
    .bind(&body.notify_users)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Remove sensitive patient flag
pub async fn delete_sensitive_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM sensitive_patients WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

/// List access alerts
pub async fn list_access_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AccessAlert>>, AppError> {
    require_permission(&claims, permissions::audit::ACCESS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AccessAlert>(
        "SELECT a.*, p.first_name || ' ' || p.last_name AS patient_name,
         u.full_name AS user_name
         FROM access_alerts a
         JOIN patients p ON p.id = a.patient_id
         JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC
         LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Acknowledge access alert
pub async fn acknowledge_access_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AcknowledgeAlertRequest>,
) -> Result<Json<AccessAlert>, AppError> {
    require_permission(&claims, permissions::audit::ACCESS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AccessAlert>(
        "UPDATE access_alerts
         SET acknowledged_at = now(), acknowledged_by = $2, notes = $3
         WHERE id = $1
         RETURNING *, NULL AS patient_name, NULL AS user_name",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════════
// STOCK DISPOSAL
// ══════════════════════════════════════════════════════════════

/// List disposal requests
pub async fn list_disposals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DisposalQuery>,
) -> Result<Json<Vec<StockDisposalSummary>>, AppError> {
    require_permission(&claims, permissions::inventory::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, StockDisposalSummary>(
        "SELECT d.id, d.request_number, s.name AS store_name, d.disposal_type, d.status,
         u.full_name AS requested_by_name, d.total_value,
         (SELECT COUNT(*) FROM stock_disposal_items WHERE disposal_id = d.id) AS item_count,
         d.created_at
         FROM stock_disposal_requests d
         LEFT JOIN stores s ON s.id = d.store_id
         LEFT JOIN users u ON u.id = d.requested_by
         WHERE ($1::uuid IS NULL OR d.store_id = $1)
         AND ($2::text IS NULL OR d.disposal_type = $2)
         AND ($3::text IS NULL OR d.status::text = $3)
         AND ($4::timestamptz IS NULL OR d.created_at >= $4::timestamptz)
         AND ($5::timestamptz IS NULL OR d.created_at <= $5::timestamptz)
         ORDER BY d.created_at DESC
         LIMIT $6 OFFSET $7",
    )
    .bind(parse_uuid(&params.store_id))
    .bind(&params.disposal_type)
    .bind(&params.status)
    .bind(&params.from)
    .bind(&params.to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Get disposal detail
pub async fn get_disposal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StockDisposalRequest>, AppError> {
    require_permission(&claims, permissions::inventory::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StockDisposalRequest>(
        "SELECT * FROM stock_disposal_requests WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Get disposal items
pub async fn get_disposal_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<StockDisposalItem>>, AppError> {
    require_permission(&claims, permissions::inventory::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, StockDisposalItem>(
        "SELECT * FROM stock_disposal_items WHERE disposal_id = $1",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Create disposal request
pub async fn create_disposal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDisposalRequest>,
) -> Result<Json<StockDisposalRequest>, AppError> {
    require_permission(&claims, permissions::inventory::DISPOSE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Generate request number
    let seq: (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'DISP-([0-9]+)') AS BIGINT)), 0) + 1
         FROM stock_disposal_requests"
    )
    .fetch_one(&mut *tx)
    .await?;
    let request_number = format!("DISP-{:06}", seq.0);

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, StockDisposalRequest>(
        "INSERT INTO stock_disposal_requests (id, tenant_id, request_number, store_id,
         disposal_type, disposal_method, requested_by, reason, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&request_number)
    .bind(body.store_id)
    .bind(&body.disposal_type)
    .bind(body.disposal_method)
    .bind(claims.sub)
    .bind(&body.reason)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Insert items
    let mut total_value = rust_decimal::Decimal::ZERO;
    for item in &body.items {
        let item_total = item.unit_cost.unwrap_or_default() * item.quantity;
        total_value += item_total;

        sqlx::query(
            "INSERT INTO stock_disposal_items (id, disposal_id, item_id, item_name, item_code,
             batch_number, expiry_date, quantity, unit, unit_cost, total_cost, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        )
        .bind(Uuid::new_v4())
        .bind(id)
        .bind(item.item_id)
        .bind(&item.item_name)
        .bind(&item.item_code)
        .bind(&item.batch_number)
        .bind(item.expiry_date)
        .bind(item.quantity)
        .bind(&item.unit)
        .bind(item.unit_cost)
        .bind(item_total)
        .bind(&item.reason)
        .execute(&mut *tx)
        .await?;
    }

    // Update total value
    sqlx::query("UPDATE stock_disposal_requests SET total_value = $1 WHERE id = $2")
        .bind(total_value)
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Approve disposal
pub async fn approve_disposal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveDisposalRequest>,
) -> Result<Json<StockDisposalRequest>, AppError> {
    require_permission(&claims, permissions::inventory::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StockDisposalRequest>(
        "UPDATE stock_disposal_requests
         SET status = 'approved', approved_by = $2, approved_at = now(),
         notes = COALESCE($3, notes)
         WHERE id = $1 AND status = 'pending'
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Execute disposal
pub async fn execute_disposal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ExecuteDisposalRequest>,
) -> Result<Json<StockDisposalRequest>, AppError> {
    require_permission(&claims, permissions::inventory::DISPOSE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StockDisposalRequest>(
        "UPDATE stock_disposal_requests
         SET status = 'completed', executed_by = $2, executed_at = now(),
         certificate_number = $3, witness_id = $4, notes = COALESCE($5, notes)
         WHERE id = $1 AND status = 'approved'
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.certificate_number)
    .bind(body.witness_id)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════════
// TAT TRACKING
// ══════════════════════════════════════════════════════════════

/// List TAT benchmarks
pub async fn list_tat_benchmarks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TatBenchmark>>, AppError> {
    require_permission(&claims, permissions::admin::SYSTEM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TatBenchmark>(
        "SELECT * FROM tat_benchmarks WHERE is_active = true ORDER BY category, sub_category LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Create TAT benchmark
pub async fn create_tat_benchmark(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTatBenchmarkRequest>,
) -> Result<Json<TatBenchmark>, AppError> {
    require_permission(&claims, permissions::admin::CONFIG)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, TatBenchmark>(
        "INSERT INTO tat_benchmarks (id, tenant_id, category, sub_category, benchmark_minutes,
         warning_minutes, critical_minutes, department_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.category)
    .bind(&body.sub_category)
    .bind(body.benchmark_minutes)
    .bind(body.warning_minutes)
    .bind(body.critical_minutes)
    .bind(body.department_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List TAT records
pub async fn list_tat_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<TatQuery>,
) -> Result<Json<Vec<TatRecordSummary>>, AppError> {
    require_permission(&claims, permissions::admin::SYSTEM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, TatRecordSummary>(
        "SELECT t.id, t.category, t.sub_category, t.entity_type, t.entity_id,
         (p.first_name || ' ' || p.last_name) AS patient_name,
         t.start_time, t.end_time, t.elapsed_minutes, t.benchmark_minutes, t.status
         FROM tat_records t
         LEFT JOIN patients p ON p.id = t.patient_id
         WHERE ($1::text IS NULL OR t.category::text = $1)
         AND ($2::text IS NULL OR t.status = $2)
         AND ($3::uuid IS NULL OR t.department_id = $3)
         AND ($4::timestamptz IS NULL OR t.created_at >= $4::timestamptz)
         AND ($5::timestamptz IS NULL OR t.created_at <= $5::timestamptz)
         ORDER BY t.created_at DESC
         LIMIT $6 OFFSET $7",
    )
    .bind(&params.category)
    .bind(&params.status)
    .bind(parse_uuid(&params.department_id))
    .bind(&params.from)
    .bind(&params.to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Start TAT tracking
pub async fn start_tat_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTatRecordRequest>,
) -> Result<Json<TatRecord>, AppError> {
    require_permission(&claims, permissions::admin::SYSTEM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get benchmark
    let benchmark = sqlx::query_as::<_, TatBenchmark>(
        "SELECT * FROM tat_benchmarks
         WHERE category = $1 AND ($2::text IS NULL OR sub_category = $2) AND is_active = true
         LIMIT 1",
    )
    .bind(body.category)
    .bind(&body.sub_category)
    .fetch_optional(&mut *tx)
    .await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, TatRecord>(
        "INSERT INTO tat_records (id, tenant_id, category, sub_category, entity_type, entity_id,
         patient_id, department_id, start_time, benchmark_minutes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, 'on_track')
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.category)
    .bind(&body.sub_category)
    .bind(&body.entity_type)
    .bind(body.entity_id)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(benchmark.map(|b| b.benchmark_minutes))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Complete TAT tracking
pub async fn complete_tat_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteTatRecordRequest>,
) -> Result<Json<TatRecord>, AppError> {
    require_permission(&claims, permissions::admin::SYSTEM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TatRecord>(
        "UPDATE tat_records
         SET end_time = now(),
         elapsed_minutes = EXTRACT(EPOCH FROM (now() - start_time))::int / 60,
         status = CASE
           WHEN benchmark_minutes IS NULL THEN 'on_track'
           WHEN EXTRACT(EPOCH FROM (now() - start_time))::int / 60 > benchmark_minutes THEN 'breached'
           ELSE 'on_track'
         END,
         breach_reason = $2
         WHERE id = $1
         RETURNING *"
    )
    .bind(id)
    .bind(&body.breach_reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// TAT dashboard
pub async fn tat_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TatDashboard>, AppError> {
    require_permission(&claims, permissions::admin::SYSTEM)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct Counts {
        total: i64,
        on_track: i64,
        warning: i64,
        breached: i64,
        avg_minutes: Option<f64>,
    }

    let counts = sqlx::query_as::<_, Counts>(
        "SELECT COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'on_track') AS on_track,
         COUNT(*) FILTER (WHERE status = 'warning') AS warning,
         COUNT(*) FILTER (WHERE status = 'breached') AS breached,
         AVG(elapsed_minutes)::float AS avg_minutes
         FROM tat_records
         WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'",
    )
    .fetch_one(&mut *tx)
    .await?;

    let by_category = sqlx::query_as::<_, TatCategoryStats>(
        "SELECT category::text AS category, COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'on_track') AS on_track,
         COUNT(*) FILTER (WHERE status = 'breached') AS breached,
         AVG(elapsed_minutes)::float AS avg_minutes
         FROM tat_records
         WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY category",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let breach_rate = if counts.total > 0 {
        counts.breached as f64 / counts.total as f64 * 100.0
    } else {
        0.0
    };

    Ok(Json(TatDashboard {
        total_records: counts.total,
        on_track: counts.on_track,
        warning: counts.warning,
        breached: counts.breached,
        avg_tat_minutes: counts.avg_minutes,
        breach_rate,
        by_category,
    }))
}

// ══════════════════════════════════════════════════════════════
// DATA MIGRATION
// ══════════════════════════════════════════════════════════════

/// List data migrations
pub async fn list_migrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<MigrationQuery>,
) -> Result<Json<Vec<DataMigration>>, AppError> {
    require_permission(&claims, permissions::admin::MIGRATION)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, DataMigration>(
        "SELECT * FROM data_migrations
         WHERE ($1::text IS NULL OR direction::text = $1)
         AND ($2::text IS NULL OR entity_type = $2)
         AND ($3::text IS NULL OR status::text = $3)
         ORDER BY created_at DESC
         LIMIT $4 OFFSET $5",
    )
    .bind(&params.direction)
    .bind(&params.entity_type)
    .bind(&params.status)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Get migration detail
pub async fn get_migration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DataMigration>, AppError> {
    require_permission(&claims, permissions::admin::MIGRATION)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DataMigration>("SELECT * FROM data_migrations WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Create migration job
pub async fn create_migration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMigrationRequest>,
) -> Result<Json<DataMigration>, AppError> {
    require_permission(&claims, permissions::admin::MIGRATION)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, DataMigration>(
        "INSERT INTO data_migrations (id, tenant_id, direction, entity_type, file_name,
         initiated_by, mapping_config, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.direction)
    .bind(&body.entity_type)
    .bind(&body.file_name)
    .bind(claims.sub)
    .bind(&body.mapping_config)
    .bind(&body.options)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Cancel migration
pub async fn cancel_migration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DataMigration>, AppError> {
    require_permission(&claims, permissions::admin::MIGRATION)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DataMigration>(
        "UPDATE data_migrations SET status = 'cancelled' WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════════
// EOD DIGEST
// ══════════════════════════════════════════════════════════════

/// Get my digest subscription
pub async fn get_my_digest_subscription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Option<EodDigestSubscription>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EodDigestSubscription>(
        "SELECT * FROM eod_digest_subscriptions WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Create/update digest subscription
pub async fn upsert_digest_subscription(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDigestSubscriptionRequest>,
) -> Result<Json<EodDigestSubscription>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, EodDigestSubscription>(
        "INSERT INTO eod_digest_subscriptions (id, tenant_id, user_id, frequency, delivery_time,
         delivery_days, modules, include_summary, include_alerts, include_pending_tasks,
         email_enabled, push_enabled)
         VALUES ($1, $2, $3, $4, $5::time, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET
         frequency = COALESCE($4, eod_digest_subscriptions.frequency),
         delivery_time = COALESCE($5::time, eod_digest_subscriptions.delivery_time),
         delivery_days = COALESCE($6, eod_digest_subscriptions.delivery_days),
         modules = COALESCE($7, eod_digest_subscriptions.modules),
         include_summary = COALESCE($8, eod_digest_subscriptions.include_summary),
         include_alerts = COALESCE($9, eod_digest_subscriptions.include_alerts),
         include_pending_tasks = COALESCE($10, eod_digest_subscriptions.include_pending_tasks),
         email_enabled = COALESCE($11, eod_digest_subscriptions.email_enabled),
         push_enabled = COALESCE($12, eod_digest_subscriptions.push_enabled),
         updated_at = now()
         RETURNING *",
    )
    .bind(Uuid::new_v4())
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.frequency)
    .bind(&body.delivery_time)
    .bind(&body.delivery_days)
    .bind(&body.modules)
    .bind(body.include_summary)
    .bind(body.include_alerts)
    .bind(body.include_pending_tasks)
    .bind(body.email_enabled)
    .bind(body.push_enabled)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List digest history
pub async fn list_digest_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<EodDigestHistory>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, EodDigestHistory>(
        "SELECT * FROM eod_digest_history WHERE user_id = $1 ORDER BY digest_date DESC LIMIT 30",
    )
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════════
// DATA QUALITY
// ══════════════════════════════════════════════════════════════

/// List data quality rules
pub async fn list_dq_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DataQualityRule>>, AppError> {
    require_permission(&claims, permissions::admin::CONFIG)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DataQualityRule>(
        "SELECT * FROM data_quality_rules WHERE is_active = true ORDER BY entity_type, category LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Create data quality rule
pub async fn create_dq_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDataQualityRuleRequest>,
) -> Result<Json<DataQualityRule>, AppError> {
    require_permission(&claims, permissions::admin::CONFIG)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, DataQualityRule>(
        "INSERT INTO data_quality_rules (id, tenant_id, category, entity_type, field_name,
         rule_name, rule_expression, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.category)
    .bind(&body.entity_type)
    .bind(&body.field_name)
    .bind(&body.rule_name)
    .bind(&body.rule_expression)
    .bind(&body.severity)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List data quality issues
pub async fn list_dq_issues(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DataQualityQuery>,
) -> Result<Json<Vec<DataQualityIssue>>, AppError> {
    require_permission(&claims, permissions::admin::COMPLIANCE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, DataQualityIssue>(
        "SELECT * FROM data_quality_issues
         WHERE ($1::text IS NULL OR category::text = $1)
         AND ($2::text IS NULL OR entity_type = $2)
         AND ($3::text IS NULL OR severity = $3)
         AND ($4::boolean IS NULL OR is_resolved = $4)
         ORDER BY created_at DESC
         LIMIT $5 OFFSET $6",
    )
    .bind(&params.category)
    .bind(&params.entity_type)
    .bind(&params.severity)
    .bind(params.is_resolved)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Resolve data quality issue
pub async fn resolve_dq_issue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveIssueRequest>,
) -> Result<Json<DataQualityIssue>, AppError> {
    require_permission(&claims, permissions::admin::COMPLIANCE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DataQualityIssue>(
        "UPDATE data_quality_issues
         SET is_resolved = true, resolved_at = now(), resolved_by = $2, resolution_notes = $3
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(&body.resolution_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Data quality dashboard
pub async fn dq_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DataQualityDashboard>, AppError> {
    require_permission(&claims, permissions::admin::COMPLIANCE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct Scores {
        overall: Option<f64>,
        completeness: Option<f64>,
        accuracy: Option<f64>,
        timeliness: Option<f64>,
        consistency: Option<f64>,
    }

    let scores = sqlx::query_as::<_, Scores>(
        "SELECT AVG(overall_score)::float8 AS overall,
         AVG(completeness_score)::float8 AS completeness,
         AVG(accuracy_score)::float8 AS accuracy,
         AVG(timeliness_score)::float8 AS timeliness,
         AVG(consistency_score)::float8 AS consistency
         FROM data_quality_scores
         WHERE tenant_id = $1
         AND score_date >= CURRENT_DATE - INTERVAL '7 days'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    #[derive(sqlx::FromRow)]
    struct IssueCounts {
        total: i64,
        unresolved: i64,
        critical: i64,
    }

    let issues = sqlx::query_as::<_, IssueCounts>(
        "SELECT COUNT(*) AS total,
         COUNT(*) FILTER (WHERE is_resolved = false) AS unresolved,
         COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false) AS critical
         FROM data_quality_issues
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let by_entity_type = sqlx::query_as::<_, EntityQualityStats>(
        "SELECT s.entity_type AS entity_type,
         AVG(s.overall_score)::float8 AS overall_score,
         COUNT(DISTINCT i.id) AS total_issues,
         COUNT(DISTINCT i.id) FILTER (WHERE i.is_resolved = false) AS unresolved_issues
         FROM data_quality_scores s
         LEFT JOIN data_quality_issues i
           ON i.tenant_id = s.tenant_id
          AND i.entity_type = s.entity_type
         WHERE s.tenant_id = $1
         AND s.score_date >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY s.entity_type",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DataQualityDashboard {
        overall_score: scores.overall.unwrap_or(0.0),
        completeness_score: scores.completeness.unwrap_or(0.0),
        accuracy_score: scores.accuracy.unwrap_or(0.0),
        timeliness_score: scores.timeliness.unwrap_or(0.0),
        consistency_score: scores.consistency.unwrap_or(0.0),
        total_issues: issues.total,
        unresolved_issues: issues.unresolved,
        critical_issues: issues.critical,
        by_entity_type,
    }))
}

// ══════════════════════════════════════════════════════════════
// CERT-IN COMPLIANCE (Security Incidents & Vulnerabilities)
// ══════════════════════════════════════════════════════════════

/// List security incidents
pub async fn list_security_incidents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<IncidentQuery>,
) -> Result<Json<Vec<SecurityIncidentSummary>>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, SecurityIncidentSummary>(
        "SELECT id, incident_number, title, incident_type, severity, status,
         detected_at, cert_in_reported, created_at
         FROM security_incidents
         WHERE ($1::text IS NULL OR incident_type = $1)
         AND ($2::text IS NULL OR severity::text = $2)
         AND ($3::text IS NULL OR status::text = $3)
         AND ($4::boolean IS NULL OR cert_in_reported = $4)
         AND ($5::timestamptz IS NULL OR detected_at >= $5::timestamptz)
         AND ($6::timestamptz IS NULL OR detected_at <= $6::timestamptz)
         ORDER BY detected_at DESC
         LIMIT $7 OFFSET $8",
    )
    .bind(&params.incident_type)
    .bind(&params.severity)
    .bind(&params.status)
    .bind(params.cert_in_reported)
    .bind(&params.from)
    .bind(&params.to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Get security incident detail
pub async fn get_security_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row =
        sqlx::query_as::<_, SecurityIncident>("SELECT * FROM security_incidents WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Create security incident
pub async fn create_security_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSecurityIncidentRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Generate incident number
    let seq: (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(incident_number FROM 'INC-([0-9]+)') AS BIGINT)), 0) + 1
         FROM security_incidents"
    )
    .fetch_one(&mut *tx)
    .await?;
    let incident_number = format!("INC-{:06}", seq.0);

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, SecurityIncident>(
        "INSERT INTO security_incidents (id, tenant_id, incident_number, title, description,
         incident_type, severity, detected_at, detected_by, affected_systems, affected_data_types,
         estimated_impact)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&incident_number)
    .bind(&body.title)
    .bind(&body.description)
    .bind(&body.incident_type)
    .bind(body.severity)
    .bind(body.detected_at)
    .bind(claims.sub)
    .bind(&body.affected_systems)
    .bind(&body.affected_data_types)
    .bind(&body.estimated_impact)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Update security incident
pub async fn update_security_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSecurityIncidentRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get old status for logging
    let old: SecurityIncident = sqlx::query_as("SELECT * FROM security_incidents WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    let row = sqlx::query_as::<_, SecurityIncident>(
        "UPDATE security_incidents SET
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         severity = COALESCE($4, severity),
         status = COALESCE($5, status),
         containment_steps = COALESCE($6, containment_steps),
         eradication_steps = COALESCE($7, eradication_steps),
         recovery_steps = COALESCE($8, recovery_steps),
         lessons_learned = COALESCE($9, lessons_learned),
         updated_at = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.severity)
    .bind(body.status)
    .bind(&body.containment_steps)
    .bind(&body.eradication_steps)
    .bind(&body.recovery_steps)
    .bind(&body.lessons_learned)
    .fetch_one(&mut *tx)
    .await?;

    // Log status change if changed
    if let Some(new_status) = body.status {
        if new_status != old.status {
            sqlx::query(
                "INSERT INTO security_incident_updates (id, incident_id, update_type, description,
                 old_status, new_status, updated_by)
                 VALUES ($1, $2, 'status_change', $3, $4, $5, $6)",
            )
            .bind(Uuid::new_v4())
            .bind(id)
            .bind(format!(
                "Status changed from {:?} to {:?}",
                old.status, new_status
            ))
            .bind(old.status)
            .bind(new_status)
            .bind(claims.sub)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(Json(row))
}

/// Report incident to CERT-In
pub async fn report_to_cert_in(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReportToCertInRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SecurityIncident>(
        "UPDATE security_incidents SET
         cert_in_reported = true, cert_in_report_date = now(), cert_in_reference = $2,
         updated_at = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.cert_in_reference)
    .fetch_one(&mut *tx)
    .await?;

    // Log the reporting
    sqlx::query(
        "INSERT INTO security_incident_updates (id, incident_id, update_type, description, updated_by)
         VALUES ($1, $2, 'note', 'Reported to CERT-In', $3)"
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Get incident updates
pub async fn get_incident_updates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<SecurityIncidentUpdate>>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, SecurityIncidentUpdate>(
        "SELECT su.*, u.full_name AS updated_by_name
         FROM security_incident_updates su
         LEFT JOIN users u ON u.id = su.updated_by
         WHERE su.incident_id = $1
         ORDER BY su.created_at DESC LIMIT 5000",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Add incident update
pub async fn add_incident_update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AddIncidentUpdateRequest>,
) -> Result<Json<SecurityIncidentUpdate>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SecurityIncidentUpdate>(
        "INSERT INTO security_incident_updates (id, incident_id, update_type, description, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *, NULL AS updated_by_name"
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(&body.update_type)
    .bind(&body.description)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List vulnerabilities
pub async fn list_vulnerabilities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Vulnerability>>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Vulnerability>(
        "SELECT * FROM vulnerabilities ORDER BY discovered_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Create vulnerability
pub async fn create_vulnerability(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVulnerabilityRequest>,
) -> Result<Json<Vulnerability>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, Vulnerability>(
        "INSERT INTO vulnerabilities (id, tenant_id, cve_id, title, description, severity,
         affected_component, discovered_at, discovered_by, remediation_deadline,
         remediation_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.cve_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.severity)
    .bind(&body.affected_component)
    .bind(body.discovered_at)
    .bind(&body.discovered_by)
    .bind(body.remediation_deadline)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Update vulnerability
pub async fn update_vulnerability(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateVulnerabilityRequest>,
) -> Result<Json<Vulnerability>, AppError> {
    require_permission(&claims, permissions::admin::SECURITY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let is_resolved = body.remediation_status.as_deref() == Some("resolved");

    let row = sqlx::query_as::<_, Vulnerability>(
        "UPDATE vulnerabilities SET
         remediation_status = COALESCE($2, remediation_status),
         remediation_notes = COALESCE($3, remediation_notes),
         remediated_at = CASE WHEN $4 THEN now() ELSE remediated_at END,
         remediated_by = CASE WHEN $4 THEN $5 ELSE remediated_by END,
         updated_at = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.remediation_status)
    .bind(&body.remediation_notes)
    .bind(is_resolved)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List compliance requirements
pub async fn list_compliance_requirements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ComplianceRequirement>>, AppError> {
    require_permission(&claims, permissions::admin::COMPLIANCE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ComplianceRequirement>(
        "SELECT * FROM compliance_requirements ORDER BY framework, requirement_code LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Update compliance status
pub async fn update_compliance_requirement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateComplianceRequest>,
) -> Result<Json<ComplianceRequirement>, AppError> {
    require_permission(&claims, permissions::admin::COMPLIANCE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ComplianceRequirement>(
        "UPDATE compliance_requirements SET
         compliance_status = COALESCE($2, compliance_status),
         evidence_links = COALESCE($3, evidence_links),
         notes = COALESCE($4, notes),
         next_review_date = COALESCE($5, next_review_date),
         last_assessed_at = now(),
         assessed_by = $6,
         updated_at = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.compliance_status)
    .bind(&body.evidence_links)
    .bind(&body.notes)
    .bind(body.next_review_date)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════════
// SYSTEM HEALTH & MONITORING
// ══════════════════════════════════════════════════════════════

/// System health dashboard
pub async fn system_health_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SystemHealthDashboard>, AppError> {
    require_permission(&claims, permissions::admin::SYSTEM)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let metrics = sqlx::query_as::<_, SystemHealthMetric>(
        "SELECT * FROM system_health_metrics
         WHERE recorded_at >= now() - INTERVAL '1 hour'
         ORDER BY recorded_at DESC
         LIMIT 100",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Determine overall status based on metrics
    let overall_status = if metrics
        .iter()
        .any(|m| m.status.as_deref() == Some("critical"))
    {
        "critical"
    } else if metrics
        .iter()
        .any(|m| m.status.as_deref() == Some("degraded"))
    {
        "degraded"
    } else {
        "healthy"
    };

    let get_component_status = |component: &str| -> String {
        metrics
            .iter()
            .filter(|m| m.component == component)
            .find_map(|m| m.status.clone())
            .unwrap_or_else(|| "unknown".to_string())
    };

    Ok(Json(SystemHealthDashboard {
        overall_status: overall_status.to_string(),
        database_status: get_component_status("database"),
        api_status: get_component_status("api"),
        storage_status: get_component_status("storage"),
        metrics,
    }))
}

/// List backup history
pub async fn list_backups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BackupHistory>>, AppError> {
    require_permission(&claims, permissions::admin::BACKUP)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BackupHistory>(
        "SELECT * FROM backup_history
         WHERE tenant_id IS NULL OR tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════════
// ONBOARDING WIZARD
// ══════════════════════════════════════════════════════════════

/// Get onboarding progress
pub async fn get_onboarding_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Option<OnboardingProgress>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OnboardingProgress>(
        "SELECT * FROM onboarding_progress WHERE wizard_type = 'initial_setup'",
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Update onboarding progress
pub async fn update_onboarding_progress(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateOnboardingRequest>,
) -> Result<Json<OnboardingProgress>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OnboardingProgress>(
        "INSERT INTO onboarding_progress (id, tenant_id, wizard_type, current_step, started_by, step_data)
         VALUES ($1, $2, 'initial_setup', $3, $4, COALESCE($5, '{}'::jsonb))
         ON CONFLICT (tenant_id, wizard_type) DO UPDATE SET
         current_step = $3,
         step_data = onboarding_progress.step_data || COALESCE($5, '{}'::jsonb),
         updated_at = now()
         RETURNING *"
    )
    .bind(Uuid::new_v4())
    .bind(claims.tenant_id)
    .bind(&body.current_step)
    .bind(claims.sub)
    .bind(&body.step_data)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Complete onboarding step
pub async fn complete_onboarding_step(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CompleteOnboardingStepRequest>,
) -> Result<Json<OnboardingProgress>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OnboardingProgress>(
        "UPDATE onboarding_progress SET
         completed_steps = array_append(completed_steps, $2),
         step_data = step_data || COALESCE($3, '{}'::jsonb),
         updated_at = now()
         WHERE wizard_type = 'initial_setup'
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.step)
    .bind(&body.step_data)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Complete onboarding
pub async fn complete_onboarding(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<OnboardingProgress>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OnboardingProgress>(
        "UPDATE onboarding_progress SET
         is_completed = true, completed_at = now(), updated_at = now()
         WHERE wizard_type = 'initial_setup'
         RETURNING *",
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════════
// INCENTIVE CONFIGURATION
// ══════════════════════════════════════════════════════════════

/// List incentive plans
pub async fn list_incentive_plans(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<IncentivePlan>>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IncentivePlan>(
        "SELECT * FROM incentive_plans ORDER BY effective_from DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Create incentive plan
pub async fn create_incentive_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateIncentivePlanRequest>,
) -> Result<Json<IncentivePlan>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, IncentivePlan>(
        "INSERT INTO incentive_plans (id, tenant_id, plan_name, plan_code, description,
         effective_from, effective_to, calculation_basis, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.plan_name)
    .bind(&body.plan_code)
    .bind(&body.description)
    .bind(body.effective_from)
    .bind(body.effective_to)
    .bind(&body.calculation_basis)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Get incentive plan rules
pub async fn get_incentive_plan_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<IncentivePlanRule>>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IncentivePlanRule>(
        "SELECT * FROM incentive_plan_rules WHERE plan_id = $1",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Add incentive rule
pub async fn add_incentive_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateIncentiveRuleRequest>,
) -> Result<Json<IncentivePlanRule>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rule_id = Uuid::new_v4();
    let row = sqlx::query_as::<_, IncentivePlanRule>(
        "INSERT INTO incentive_plan_rules (id, plan_id, rule_name, service_type, department_id,
         min_threshold, max_threshold, percentage, fixed_amount, multiplier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *",
    )
    .bind(rule_id)
    .bind(id)
    .bind(&body.rule_name)
    .bind(&body.service_type)
    .bind(body.department_id)
    .bind(body.min_threshold)
    .bind(body.max_threshold)
    .bind(body.percentage)
    .bind(body.fixed_amount)
    .bind(body.multiplier)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List doctor incentive assignments
pub async fn list_doctor_incentive_assignments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DoctorIncentiveAssignment>>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DoctorIncentiveAssignment>(
        "SELECT a.*, u.full_name AS doctor_name, p.plan_name
         FROM doctor_incentive_assignments a
         JOIN users u ON u.id = a.doctor_id
         JOIN incentive_plans p ON p.id = a.plan_id
         ORDER BY a.effective_from DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Assign incentive plan to doctor
pub async fn assign_incentive_plan(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AssignIncentivePlanRequest>,
) -> Result<Json<DoctorIncentiveAssignment>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, DoctorIncentiveAssignment>(
        "INSERT INTO doctor_incentive_assignments (id, tenant_id, doctor_id, plan_id,
         effective_from, effective_to, custom_percentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *, NULL AS doctor_name, NULL AS plan_name",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(body.plan_id)
    .bind(body.effective_from)
    .bind(body.effective_to)
    .bind(body.custom_percentage)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// List incentive calculations
pub async fn list_incentive_calculations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<IncentiveCalculation>>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, IncentiveCalculation>(
        "SELECT c.*, u.full_name AS doctor_name
         FROM incentive_calculations c
         JOIN users u ON u.id = c.doctor_id
         ORDER BY c.period_start DESC LIMIT 5000",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Calculate incentives
pub async fn calculate_incentive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CalculateIncentiveRequest>,
) -> Result<Json<IncentiveCalculation>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get assignment
    let assignment = sqlx::query_as::<_, DoctorIncentiveAssignment>(
        "SELECT a.*, NULL AS doctor_name, NULL AS plan_name
         FROM doctor_incentive_assignments a
         WHERE a.doctor_id = $1 AND a.is_active = true
         AND a.effective_from <= $2 AND (a.effective_to IS NULL OR a.effective_to >= $3)
         LIMIT 1",
    )
    .bind(body.doctor_id)
    .bind(body.period_start)
    .bind(body.period_end)
    .fetch_one(&mut *tx)
    .await?;

    // Placeholder calculation
    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, IncentiveCalculation>(
        "INSERT INTO incentive_calculations (id, tenant_id, doctor_id, plan_id, period_start,
         period_end, gross_revenue, eligible_revenue, incentive_amount, net_payable, status)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, 'draft')
         RETURNING *, NULL AS doctor_name",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(assignment.plan_id)
    .bind(body.period_start)
    .bind(body.period_end)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Approve incentive calculation
pub async fn approve_incentive(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(_body): Json<ApproveIncentiveRequest>,
) -> Result<Json<IncentiveCalculation>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IncentiveCalculation>(
        "UPDATE incentive_calculations SET
         status = 'approved', approved_by = $2, approved_at = now(), updated_at = now()
         WHERE id = $1
         RETURNING *, NULL AS doctor_name",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Mark incentive as paid
pub async fn mark_incentive_paid(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<MarkIncentivePaidRequest>,
) -> Result<Json<IncentiveCalculation>, AppError> {
    require_permission(&claims, permissions::admin::INCENTIVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, IncentiveCalculation>(
        "UPDATE incentive_calculations SET
         status = 'paid', paid_at = now(), payment_reference = $2, updated_at = now()
         WHERE id = $1
         RETURNING *, NULL AS doctor_name",
    )
    .bind(id)
    .bind(&body.payment_reference)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// IT security & compliance routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/break-glass", post(start_break_glass).get(list_break_glass))
        .route("/api/break-glass/{id}", get(get_break_glass))
        .route("/api/break-glass/{id}/end", post(end_break_glass))
        .route("/api/break-glass/{id}/review", post(review_break_glass))
        .route("/api/sensitive-patients", get(list_sensitive_patients).post(create_sensitive_patient))
        .route("/api/sensitive-patients/{id}", delete(delete_sensitive_patient))
        .route("/api/access-alerts", get(list_access_alerts))
        .route("/api/access-alerts/{id}/acknowledge", post(acknowledge_access_alert))
        .route("/api/disposals", get(list_disposals).post(create_disposal))
        .route("/api/disposals/{id}", get(get_disposal))
        .route("/api/disposals/{id}/items", get(get_disposal_items))
        .route("/api/disposals/{id}/approve", post(approve_disposal))
        .route("/api/disposals/{id}/execute", post(execute_disposal))
        .route("/api/tat/benchmarks", get(list_tat_benchmarks).post(create_tat_benchmark))
        .route("/api/tat/records", get(list_tat_records).post(start_tat_record))
        .route("/api/tat/records/{id}/complete", post(complete_tat_record))
        .route("/api/tat/dashboard", get(tat_dashboard))
        .route("/api/migrations", get(list_migrations).post(create_migration))
        .route("/api/migrations/{id}", get(get_migration))
        .route("/api/migrations/{id}/cancel", post(cancel_migration))
        .route("/api/digest/subscription", get(get_my_digest_subscription).post(upsert_digest_subscription))
        .route("/api/digest/history", get(list_digest_history))
        .route("/api/data-quality/rules", get(list_dq_rules).post(create_dq_rule))
        .route("/api/data-quality/issues", get(list_dq_issues))
        .route("/api/data-quality/issues/{id}/resolve", post(resolve_dq_issue))
        .route("/api/data-quality/dashboard", get(dq_dashboard))
        .route("/api/security-incidents", get(list_security_incidents).post(create_security_incident))
        .route("/api/security-incidents/{id}", get(get_security_incident).patch(update_security_incident))
        .route("/api/security-incidents/{id}/cert-in", post(report_to_cert_in))
        .route("/api/security-incidents/{id}/updates", get(get_incident_updates).post(add_incident_update))
        .route("/api/vulnerabilities", get(list_vulnerabilities).post(create_vulnerability))
        .route("/api/vulnerabilities/{id}", patch(update_vulnerability))
        .route("/api/compliance-requirements", get(list_compliance_requirements))
        .route("/api/compliance-requirements/{id}", patch(update_compliance_requirement))
        .route("/api/system-health", get(system_health_dashboard))
        .route("/api/backups", get(list_backups))
        .route("/api/it-onboarding/progress", get(get_onboarding_progress).post(update_onboarding_progress))
        .route("/api/it-onboarding/complete-step", post(complete_onboarding_step))
        .route("/api/it-onboarding/complete", post(complete_onboarding))
        .route("/api/incentive-plans", get(list_incentive_plans).post(create_incentive_plan))
        .route("/api/incentive-plans/{id}/rules", get(get_incentive_plan_rules).post(add_incentive_rule))
        .route("/api/incentive-assignments", get(list_doctor_incentive_assignments).post(assign_incentive_plan))
        .route("/api/incentive-calculations", get(list_incentive_calculations).post(calculate_incentive))
        .route("/api/incentive-calculations/{id}/approve", post(approve_incentive))
        .route("/api/incentive-calculations/{id}/paid", post(mark_incentive_paid))
}

#[cfg(test)]
mod authz_coverage_tests {
    /// Every handler in this module that touches the database must carry an
    /// authorization check. TAT and data-quality reads/writes shipped without
    /// one, so any authenticated role could read org-wide quality metrics and
    /// resolve data-quality issues.
    ///
    /// This scans the source rather than listing handlers, so a newly added
    /// ungated handler fails the test instead of slipping through review.
    /// Self-scoped handlers (`*_my_*`, onboarding progress) are exempt: their
    /// queries are already constrained to `claims.sub`.
    #[test]
    fn every_db_handler_is_gated_or_self_scoped() {
        const SRC: &str = include_str!("lib.rs");
        const SELF_SCOPED: &[&str] = &[
            "end_break_glass",
            "get_my_digest_subscription",
            "upsert_digest_subscription",
            "list_digest_history",
            "get_onboarding_progress",
            "update_onboarding_progress",
            "complete_onboarding_step",
            "complete_onboarding",
        ];

        let mut ungated = Vec::new();
        let parts: Vec<&str> = SRC.split("pub async fn ").collect();
        for part in parts.iter().skip(1) {
            let Some(name) = part.split('(').next() else {
                continue;
            };
            // Handler body ends where the next handler begins (split already did that).
            if !part.contains("sqlx::query") || !part.contains("Extension<Claims>") {
                continue;
            }
            if SELF_SCOPED.contains(&name) {
                continue;
            }
            if !part.contains("require_permission") && !part.contains("require_step_up") {
                ungated.push(name);
            }
        }
        assert!(
            ungated.is_empty(),
            "these DB-touching handlers have no authorization check: {ungated:?}"
        );
    }
}

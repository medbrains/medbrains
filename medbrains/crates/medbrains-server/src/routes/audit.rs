use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, header},
    response::IntoResponse,
};
use medbrains_core::audit::{
    AccessLogEntry, AccessLogQuery, ActionCount, AuditLogEntry, AuditLogQuery, AuditLogSummary,
    AuditStats, DistinctValue, LogAccessRequest, ModuleCount, UserActionCount,
};
use medbrains_core::permissions;
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims, middleware::authorization::require_permission, state::AppState};

fn parse_uuid(s: &Option<String>) -> Option<Uuid> {
    s.as_deref().and_then(|v| v.parse::<Uuid>().ok())
}

// ── List audit log (paginated, filtered) ─────────────────

pub async fn list_audit_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AuditLogQuery>,
) -> Result<Json<Vec<AuditLogSummary>>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, AuditLogSummary>(
        "SELECT a.id, u.full_name AS user_name, a.action, a.entity_type, \
         a.entity_id, a.module, a.description, a.created_at \
         FROM audit_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE ($1::text IS NULL OR a.module = $1) \
         AND ($2::text IS NULL OR a.entity_type = $2) \
         AND ($3::uuid IS NULL OR a.entity_id = $3) \
         AND ($4::uuid IS NULL OR a.user_id = $4) \
         AND ($5::text IS NULL OR a.action = $5) \
         AND ($6::timestamptz IS NULL OR a.created_at >= $6::timestamptz) \
         AND ($7::timestamptz IS NULL OR a.created_at <= $7::timestamptz) \
         ORDER BY a.created_at DESC \
         LIMIT $8 OFFSET $9",
    )
    .bind(&params.module)
    .bind(&params.entity_type)
    .bind(parse_uuid(&params.entity_id))
    .bind(parse_uuid(&params.user_id))
    .bind(&params.action)
    .bind(&params.from)
    .bind(&params.to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Get single audit entry (full detail) ─────────────────
pub async fn get_audit_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<AuditLogEntry>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AuditLogEntry>(
        "SELECT a.id, a.user_id, u.full_name AS user_name, a.action, a.entity_type, \
         a.entity_id, a.old_values, a.new_values, a.ip_address, a.module, \
         a.description, a.created_at \
         FROM audit_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE a.id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Entity audit trail ───────────────────────────────────
pub async fn entity_audit_trail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<AuditLogEntry>>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AuditLogEntry>(
        "SELECT a.id, a.user_id, u.full_name AS user_name, a.action, a.entity_type, \
         a.entity_id, a.old_values, a.new_values, a.ip_address, a.module, \
         a.description, a.created_at \
         FROM audit_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE a.entity_type = $1 AND a.entity_id = $2 \
         ORDER BY a.created_at DESC",
    )
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Audit stats (dashboard) ──────────────────────────────
#[derive(sqlx::FromRow)]
struct CountRow {
    count: i64,
}

pub async fn audit_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AuditStats>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total = sqlx::query_as::<_, CountRow>("SELECT COUNT(*)::bigint AS count FROM audit_log")
        .fetch_one(&mut *tx)
        .await?;

    let today = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM audit_log \
         WHERE created_at::date = CURRENT_DATE",
    )
    .fetch_one(&mut *tx)
    .await?;

    let top_modules = sqlx::query_as::<_, ModuleCount>(
        "SELECT module, COUNT(*)::bigint AS count FROM audit_log \
         GROUP BY module ORDER BY count DESC LIMIT 10",
    )
    .fetch_all(&mut *tx)
    .await?;

    let top_users = sqlx::query_as::<_, UserActionCount>(
        "SELECT u.full_name AS user_name, COUNT(*)::bigint AS count \
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id \
         GROUP BY u.full_name ORDER BY count DESC LIMIT 10",
    )
    .fetch_all(&mut *tx)
    .await?;

    let action_breakdown = sqlx::query_as::<_, ActionCount>(
        "SELECT action, COUNT(*)::bigint AS count FROM audit_log \
         GROUP BY action ORDER BY count DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(AuditStats {
        total_entries: total.count,
        today_entries: today.count,
        top_modules,
        top_users,
        action_breakdown,
    }))
}

// ── List access log (paginated, filtered) ────────────────
pub async fn list_access_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AccessLogQuery>,
) -> Result<Json<Vec<AccessLogEntry>>, AppError> {
    require_permission(&claims, permissions::audit::ACCESS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (params.page.unwrap_or(1) - 1).max(0) * per_page;

    let rows = sqlx::query_as::<_, AccessLogEntry>(
        "SELECT al.id, al.user_id, u.full_name AS user_name, al.entity_type, \
         al.entity_id, al.patient_id, (p.first_name || ' ' || p.last_name) AS patient_name, \
         al.action, al.ip_address, al.module, al.created_at \
         FROM access_log al \
         LEFT JOIN users u ON u.id = al.user_id \
         LEFT JOIN patients p ON p.id = al.patient_id \
         WHERE ($1::uuid IS NULL OR al.patient_id = $1) \
         AND ($2::uuid IS NULL OR al.user_id = $2) \
         AND ($3::text IS NULL OR al.entity_type = $3) \
         AND ($4::text IS NULL OR al.module = $4) \
         AND ($5::timestamptz IS NULL OR al.created_at >= $5::timestamptz) \
         AND ($6::timestamptz IS NULL OR al.created_at <= $6::timestamptz) \
         ORDER BY al.created_at DESC \
         LIMIT $7 OFFSET $8",
    )
    .bind(parse_uuid(&params.patient_id))
    .bind(parse_uuid(&params.user_id))
    .bind(&params.entity_type)
    .bind(&params.module)
    .bind(&params.from)
    .bind(&params.to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Log an access event ──────────────────────────────────
pub async fn log_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<LogAccessRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO access_log (tenant_id, user_id, entity_type, entity_id, patient_id, \
         action, module) \
         VALUES ($1, $2, $3, $4, $5, 'view', $6)",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(&body.entity_type)
    .bind(body.entity_id)
    .bind(body.patient_id)
    .bind(&body.module)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

// ── Patient access log ───────────────────────────────────
pub async fn patient_access_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<AccessLogEntry>>, AppError> {
    require_permission(&claims, permissions::audit::ACCESS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AccessLogEntry>(
        "SELECT al.id, al.user_id, u.full_name AS user_name, al.entity_type, \
         al.entity_id, al.patient_id, (p.first_name || ' ' || p.last_name) AS patient_name, \
         al.action, al.ip_address, al.module, al.created_at \
         FROM access_log al \
         LEFT JOIN users u ON u.id = al.user_id \
         LEFT JOIN patients p ON p.id = al.patient_id \
         WHERE al.patient_id = $1 \
         ORDER BY al.created_at DESC \
         LIMIT 200",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── List distinct modules ────────────────────────────────
pub async fn list_modules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<String>>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DistinctValue>(
        "SELECT DISTINCT module AS value FROM audit_log \
         WHERE module IS NOT NULL ORDER BY module",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let values: Vec<String> = rows.into_iter().filter_map(|r| r.value).collect();
    Ok(Json(values))
}

// ── List distinct entity types ────────────────────────────
pub async fn list_entity_types(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<String>>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DistinctValue>(
        "SELECT DISTINCT entity_type AS value FROM audit_log \
         ORDER BY entity_type",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let values: Vec<String> = rows.into_iter().filter_map(|r| r.value).collect();
    Ok(Json(values))
}

// ── Export audit log (CSV) ────────────────────────────────
pub async fn export_audit_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AuditLogQuery>,
) -> Result<impl IntoResponse, AppError> {
    require_permission(&claims, permissions::audit::EXPORT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AuditLogSummary>(
        "SELECT a.id, u.full_name AS user_name, a.action, a.entity_type, \
         a.entity_id, a.module, a.description, a.created_at \
         FROM audit_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE ($1::text IS NULL OR a.module = $1) \
         AND ($2::text IS NULL OR a.entity_type = $2) \
         AND ($3::uuid IS NULL OR a.entity_id = $3) \
         AND ($4::uuid IS NULL OR a.user_id = $4) \
         AND ($5::text IS NULL OR a.action = $5) \
         AND ($6::timestamptz IS NULL OR a.created_at >= $6::timestamptz) \
         AND ($7::timestamptz IS NULL OR a.created_at <= $7::timestamptz) \
         ORDER BY a.created_at DESC \
         LIMIT 10000",
    )
    .bind(&params.module)
    .bind(&params.entity_type)
    .bind(parse_uuid(&params.entity_id))
    .bind(parse_uuid(&params.user_id))
    .bind(&params.action)
    .bind(&params.from)
    .bind(&params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let mut csv = String::from("id,user,action,entity_type,entity_id,module,description,created_at\n");
    for r in &rows {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            r.id,
            r.user_name.as_deref().unwrap_or(""),
            r.action,
            r.entity_type,
            r.entity_id.map_or_else(String::new, |v| v.to_string()),
            r.module.as_deref().unwrap_or(""),
            r.description.as_deref().unwrap_or(""),
            r.created_at,
        ));
    }

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/csv"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=audit_log.csv"),
    );

    Ok((headers, csv))
}

// ── User activity ────────────────────────────────────────
pub async fn user_activity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<AuditLogSummary>>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AuditLogSummary>(
        "SELECT a.id, u.full_name AS user_name, a.action, a.entity_type, \
         a.entity_id, a.module, a.description, a.created_at \
         FROM audit_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE a.user_id = $1 \
         ORDER BY a.created_at DESC \
         LIMIT 200",
    )
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ── Entity timeline (chronological) ──────────────────────
pub async fn entity_timeline(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<AuditLogEntry>>, AppError> {
    require_permission(&claims, permissions::audit::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Timeline is chronological (ASC) vs audit trail (DESC)
    let rows = sqlx::query_as::<_, AuditLogEntry>(
        "SELECT a.id, a.user_id, u.full_name AS user_name, a.action, a.entity_type, \
         a.entity_id, a.old_values, a.new_values, a.ip_address, a.module, \
         a.description, a.created_at \
         FROM audit_log a \
         LEFT JOIN users u ON u.id = a.user_id \
         WHERE a.entity_type = $1 AND a.entity_id = $2 \
         ORDER BY a.created_at ASC",
    )
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

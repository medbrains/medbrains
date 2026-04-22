use axum::{Extension, Json, extract::{Path, Query, State}};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::screen::{
    ModuleSidecar, ResolvedScreen, ResolvedSidecar, ScreenMaster, ScreenSidecar,
    ScreenSummary, ScreenVersionSnapshot, ScreenVersionSummary,
};

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ══════════════════════════════════════════════════════════════
//  Query / Request / Response Types
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListScreensQuery {
    pub module_code: Option<String>,
    pub screen_type: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScreenRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub screen_type: String,
    pub module_code: Option<String>,
    pub route_path: Option<String>,
    pub icon: Option<String>,
    pub permission_code: Option<String>,
    pub layout: Option<serde_json::Value>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScreenRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub module_code: Option<String>,
    pub route_path: Option<String>,
    pub icon: Option<String>,
    pub permission_code: Option<String>,
    pub layout: Option<serde_json::Value>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct PublishRequest {
    pub change_summary: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSidecarRequest {
    pub name: String,
    pub description: Option<String>,
    pub trigger_event: String,
    pub trigger_config: Option<serde_json::Value>,
    pub pipeline_id: Option<Uuid>,
    pub inline_action: Option<serde_json::Value>,
    pub condition: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSidecarRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub trigger_event: Option<String>,
    pub trigger_config: Option<serde_json::Value>,
    pub pipeline_id: Option<Uuid>,
    pub inline_action: Option<serde_json::Value>,
    pub condition: Option<serde_json::Value>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct OverrideRequest {
    pub layout_patch: Option<serde_json::Value>,
    pub config_patch: Option<serde_json::Value>,
    pub hidden_zones: Option<serde_json::Value>,
    pub extra_actions: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct IdResponse {
    pub id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct StatusResponse {
    pub status: String,
}

// ══════════════════════════════════════════════════════════════
//  Helper
// ══════════════════════════════════════════════════════════════

async fn require_draft_screen(db: &PgPool, screen_id: Uuid) -> Result<(), AppError> {
    let status: Option<String> = sqlx::query_scalar(
        "SELECT status::text FROM screen_masters WHERE id = $1",
    )
    .bind(screen_id)
    .fetch_optional(db)
    .await?;

    let Some(status) = status else {
        return Err(AppError::NotFound);
    };

    if status != "draft" {
        return Err(AppError::Conflict(
            "Cannot modify an active or deprecated screen. Create a new version first.".to_owned(),
        ));
    }
    Ok(())
}

// ══════════════════════════════════════════════════════════════
//  Admin — Screen CRUD
// ══════════════════════════════════════════════════════════════

/// `GET /api/admin/screens`
pub async fn list_screens(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Query(q): Query<ListScreensQuery>,
) -> Result<Json<Vec<ScreenSummary>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let limit = q.limit.unwrap_or(100);
    let offset = q.offset.unwrap_or(0);

    let rows = sqlx::query_as::<_, ScreenSummary>(
        "SELECT id, code, name, description, screen_type, module_code, status, version, \
                route_path, icon, permission_code, is_system, is_active, sort_order, \
                published_at, created_at, updated_at \
         FROM screen_masters \
         WHERE ($1::text IS NULL OR module_code = $1) \
           AND ($2::text IS NULL OR screen_type::text = $2) \
           AND ($3::text IS NULL OR status::text = $3) \
           AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%' OR code ILIKE '%' || $4 || '%') \
         ORDER BY sort_order, name \
         LIMIT $5 OFFSET $6",
    )
    .bind(&q.module_code)
    .bind(&q.screen_type)
    .bind(&q.status)
    .bind(&q.search)
    .bind(limit)
    .bind(offset)
    .fetch_all(db)
    .await?;

    Ok(Json(rows))
}

/// `POST /api/admin/screens`
pub async fn create_screen(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(body): Json<CreateScreenRequest>,
) -> Result<Json<IdResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let layout = body.layout.unwrap_or_else(|| serde_json::json!({}));
    let config = body.config.unwrap_or_else(|| serde_json::json!({}));
    let sort_order = body.sort_order.unwrap_or(0);

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO screen_masters \
         (tenant_id, code, name, description, screen_type, module_code, \
          route_path, icon, permission_code, layout, config, sort_order, \
          created_by, updated_by) \
         VALUES ($1, $2, $3, $4, $5::screen_type, $6, $7, $8, $9, $10, $11, $12, $13, $13) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.screen_type)
    .bind(&body.module_code)
    .bind(&body.route_path)
    .bind(&body.icon)
    .bind(&body.permission_code)
    .bind(&layout)
    .bind(&config)
    .bind(sort_order)
    .bind(claims.sub)
    .fetch_one(db)
    .await?;

    Ok(Json(IdResponse { id }))
}

/// `GET /api/admin/screens/{id}`
pub async fn get_screen(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ScreenMaster>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let screen = sqlx::query_as::<_, ScreenMaster>(
        "SELECT * FROM screen_masters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(screen))
}

/// `PUT /api/admin/screens/{id}`
pub async fn update_screen(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScreenRequest>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    require_draft_screen(db, id).await?;

    sqlx::query(
        "UPDATE screen_masters SET \
         name = COALESCE($2, name), \
         description = COALESCE($3, description), \
         module_code = COALESCE($4, module_code), \
         route_path = COALESCE($5, route_path), \
         icon = COALESCE($6, icon), \
         permission_code = COALESCE($7, permission_code), \
         layout = COALESCE($8, layout), \
         config = COALESCE($9, config), \
         sort_order = COALESCE($10, sort_order), \
         updated_by = $11 \
         WHERE id = $1",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.module_code)
    .bind(&body.route_path)
    .bind(&body.icon)
    .bind(&body.permission_code)
    .bind(&body.layout)
    .bind(&body.config)
    .bind(body.sort_order)
    .bind(claims.sub)
    .execute(db)
    .await?;

    Ok(Json(StatusResponse { status: "updated".to_owned() }))
}

/// `DELETE /api/admin/screens/{id}`
pub async fn delete_screen(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    require_draft_screen(db, id).await?;

    sqlx::query("DELETE FROM screen_masters WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;

    Ok(Json(StatusResponse { status: "deleted".to_owned() }))
}

// ══════════════════════════════════════════════════════════════
//  Admin — Publishing & Versioning
// ══════════════════════════════════════════════════════════════

/// `POST /api/admin/screens/{id}/publish`
pub async fn publish_screen(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PublishRequest>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let mut tx = db.begin().await?;

    // Fetch current screen
    let screen = sqlx::query_as::<_, ScreenMaster>(
        "SELECT * FROM screen_masters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if screen.status != medbrains_core::form::FormStatus::Draft {
        return Err(AppError::Conflict("Only draft screens can be published".to_owned()));
    }

    // Snapshot sidecars
    let sidecars = sqlx::query_as::<_, ScreenSidecar>(
        "SELECT * FROM screen_sidecars WHERE screen_id = $1 ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let sidecars_json = serde_json::to_value(&sidecars)
        .unwrap_or(serde_json::json!([]));

    // Snapshot form refs
    let form_refs: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT jsonb_build_object('form_code', form_code, 'zone_key', zone_key) \
         FROM screen_form_refs WHERE screen_id = $1",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let form_refs_json = serde_json::Value::Array(form_refs);

    // Create version snapshot
    sqlx::query(
        "INSERT INTO screen_version_snapshots \
         (screen_id, version, name, screen_type, status, layout, config, \
          form_refs, sidecars, change_summary, created_by) \
         VALUES ($1, $2, $3, $4, 'active'::form_status, $5, $6, $7, $8, $9, $10)",
    )
    .bind(id)
    .bind(screen.version)
    .bind(&screen.name)
    .bind(screen.screen_type)
    .bind(&screen.layout)
    .bind(&screen.config)
    .bind(&form_refs_json)
    .bind(&sidecars_json)
    .bind(&body.change_summary)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    // Update screen to active
    sqlx::query(
        "UPDATE screen_masters SET status = 'active'::form_status, \
         published_at = now(), published_by = $2, updated_by = $2 \
         WHERE id = $1",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(StatusResponse { status: "published".to_owned() }))
}

/// `POST /api/admin/screens/{id}/new-version`
pub async fn create_new_version(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<IdResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let screen = sqlx::query_as::<_, ScreenMaster>(
        "SELECT * FROM screen_masters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    if screen.status == medbrains_core::form::FormStatus::Draft {
        return Err(AppError::Conflict("Screen is already a draft".to_owned()));
    }

    // Deprecate current
    sqlx::query("UPDATE screen_masters SET status = 'deprecated'::form_status WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;

    // Create new draft with bumped version
    let new_id: Uuid = sqlx::query_scalar(
        "INSERT INTO screen_masters \
         (tenant_id, code, name, description, screen_type, module_code, status, version, \
          layout, config, route_path, icon, permission_code, is_system, is_active, sort_order, \
          created_by, updated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, 'draft'::form_status, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16) \
         RETURNING id",
    )
    .bind(screen.tenant_id)
    .bind(&screen.code)
    .bind(&screen.name)
    .bind(&screen.description)
    .bind(screen.screen_type)
    .bind(&screen.module_code)
    .bind(screen.version + 1)
    .bind(&screen.layout)
    .bind(&screen.config)
    .bind(&screen.route_path)
    .bind(&screen.icon)
    .bind(&screen.permission_code)
    .bind(screen.is_system)
    .bind(screen.is_active)
    .bind(screen.sort_order)
    .bind(claims.sub)
    .fetch_one(db)
    .await?;

    Ok(Json(IdResponse { id: new_id }))
}

/// `GET /api/admin/screens/{id}/versions`
pub async fn list_versions(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ScreenVersionSummary>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let rows = sqlx::query_as::<_, ScreenVersionSummary>(
        "SELECT svs.id, svs.screen_id, svs.version, svs.name, svs.screen_type, svs.status, \
                svs.change_summary, svs.created_by, u.full_name AS created_by_name, svs.created_at \
         FROM screen_version_snapshots svs \
         LEFT JOIN users u ON u.id = svs.created_by \
         WHERE svs.screen_id = $1 \
         ORDER BY svs.version DESC",
    )
    .bind(id)
    .fetch_all(db)
    .await?;

    Ok(Json(rows))
}

/// `GET /api/admin/screens/{id}/versions/{ver}`
pub async fn get_version(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((id, ver)): Path<(Uuid, i32)>,
) -> Result<Json<ScreenVersionSnapshot>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let snapshot = sqlx::query_as::<_, ScreenVersionSnapshot>(
        "SELECT * FROM screen_version_snapshots \
         WHERE screen_id = $1 AND version = $2",
    )
    .bind(id)
    .bind(ver)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(snapshot))
}

/// `POST /api/admin/screens/{id}/restore/{ver}`
pub async fn restore_version(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((id, ver)): Path<(Uuid, i32)>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    require_draft_screen(db, id).await?;

    let snapshot = sqlx::query_as::<_, ScreenVersionSnapshot>(
        "SELECT * FROM screen_version_snapshots \
         WHERE screen_id = $1 AND version = $2",
    )
    .bind(id)
    .bind(ver)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    sqlx::query(
        "UPDATE screen_masters SET layout = $2, config = $3, updated_by = $4 WHERE id = $1",
    )
    .bind(id)
    .bind(&snapshot.layout)
    .bind(&snapshot.config)
    .bind(claims.sub)
    .execute(db)
    .await?;

    Ok(Json(StatusResponse { status: "restored".to_owned() }))
}

// ══════════════════════════════════════════════════════════════
//  Admin — Sidecars
// ══════════════════════════════════════════════════════════════

/// `GET /api/admin/screens/{id}/sidecars`
pub async fn list_sidecars(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ScreenSidecar>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let rows = sqlx::query_as::<_, ScreenSidecar>(
        "SELECT * FROM screen_sidecars WHERE screen_id = $1 ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(db)
    .await?;

    Ok(Json(rows))
}

/// `POST /api/admin/screens/{id}/sidecars`
pub async fn create_sidecar(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateSidecarRequest>,
) -> Result<Json<IdResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let trigger_config = body.trigger_config.unwrap_or_else(|| serde_json::json!({}));
    let sort_order = body.sort_order.unwrap_or(0);

    let sid: Uuid = sqlx::query_scalar(
        "INSERT INTO screen_sidecars \
         (screen_id, name, description, trigger_event, trigger_config, \
          pipeline_id, inline_action, condition, sort_order) \
         VALUES ($1, $2, $3, $4::sidecar_trigger, $5, $6, $7, $8, $9) \
         RETURNING id",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.trigger_event)
    .bind(&trigger_config)
    .bind(body.pipeline_id)
    .bind(&body.inline_action)
    .bind(&body.condition)
    .bind(sort_order)
    .fetch_one(db)
    .await?;

    Ok(Json(IdResponse { id: sid }))
}

/// `PUT /api/admin/screens/{id}/sidecars/{sid}`
pub async fn update_sidecar(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((id, sid)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateSidecarRequest>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    sqlx::query(
        "UPDATE screen_sidecars SET \
         name = COALESCE($3, name), \
         description = COALESCE($4, description), \
         trigger_event = COALESCE($5::sidecar_trigger, trigger_event), \
         trigger_config = COALESCE($6, trigger_config), \
         pipeline_id = COALESCE($7, pipeline_id), \
         inline_action = COALESCE($8, inline_action), \
         condition = COALESCE($9, condition), \
         is_active = COALESCE($10, is_active), \
         sort_order = COALESCE($11, sort_order) \
         WHERE id = $2 AND screen_id = $1",
    )
    .bind(id)
    .bind(sid)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.trigger_event)
    .bind(&body.trigger_config)
    .bind(body.pipeline_id)
    .bind(&body.inline_action)
    .bind(&body.condition)
    .bind(body.is_active)
    .bind(body.sort_order)
    .execute(db)
    .await?;

    Ok(Json(StatusResponse { status: "updated".to_owned() }))
}

/// `DELETE /api/admin/screens/{id}/sidecars/{sid}`
pub async fn delete_sidecar(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((id, sid)): Path<(Uuid, Uuid)>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    sqlx::query("DELETE FROM screen_sidecars WHERE id = $1 AND screen_id = $2")
        .bind(sid)
        .bind(id)
        .execute(db)
        .await?;

    Ok(Json(StatusResponse { status: "deleted".to_owned() }))
}

// ══════════════════════════════════════════════════════════════
//  Admin — Tenant Screen Overrides
// ══════════════════════════════════════════════════════════════

/// `GET /api/admin/screen-overrides`
pub async fn list_overrides(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let rows: Vec<serde_json::Value> = sqlx::query_scalar(
        "SELECT jsonb_build_object( \
            'id', tso.id, 'screen_id', tso.screen_id, 'screen_code', sm.code, \
            'screen_name', sm.name, 'layout_patch', tso.layout_patch, \
            'config_patch', tso.config_patch, 'hidden_zones', tso.hidden_zones, \
            'extra_actions', tso.extra_actions, 'is_active', tso.is_active, \
            'created_at', tso.created_at \
         ) \
         FROM tenant_screen_overrides tso \
         JOIN screen_masters sm ON sm.id = tso.screen_id \
         WHERE tso.tenant_id = $1 \
         ORDER BY sm.sort_order",
    )
    .bind(claims.tenant_id)
    .fetch_all(db)
    .await?;

    Ok(Json(rows))
}

/// `PUT /api/admin/screen-overrides/{screen_id}`
pub async fn upsert_override(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(screen_id): Path<Uuid>,
    Json(body): Json<OverrideRequest>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    let layout_patch = body.layout_patch.unwrap_or_else(|| serde_json::json!({}));
    let config_patch = body.config_patch.unwrap_or_else(|| serde_json::json!({}));
    let hidden_zones = body.hidden_zones.unwrap_or(serde_json::json!([]));
    let extra_actions = body.extra_actions.unwrap_or(serde_json::json!([]));

    sqlx::query(
        "INSERT INTO tenant_screen_overrides \
         (tenant_id, screen_id, layout_patch, config_patch, hidden_zones, extra_actions, \
          created_by, updated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) \
         ON CONFLICT (tenant_id, screen_id) DO UPDATE SET \
           layout_patch = EXCLUDED.layout_patch, \
           config_patch = EXCLUDED.config_patch, \
           hidden_zones = EXCLUDED.hidden_zones, \
           extra_actions = EXCLUDED.extra_actions, \
           updated_by = EXCLUDED.updated_by",
    )
    .bind(claims.tenant_id)
    .bind(screen_id)
    .bind(&layout_patch)
    .bind(&config_patch)
    .bind(&hidden_zones)
    .bind(&extra_actions)
    .bind(claims.sub)
    .execute(db)
    .await?;

    Ok(Json(StatusResponse { status: "saved".to_owned() }))
}

/// `DELETE /api/admin/screen-overrides/{screen_id}`
pub async fn delete_override(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(screen_id): Path<Uuid>,
) -> Result<Json<StatusResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;
    let db = &state.db;

    sqlx::query(
        "DELETE FROM tenant_screen_overrides WHERE tenant_id = $1 AND screen_id = $2",
    )
    .bind(claims.tenant_id)
    .bind(screen_id)
    .execute(db)
    .await?;

    Ok(Json(StatusResponse { status: "deleted".to_owned() }))
}

// ══════════════════════════════════════════════════════════════
//  User-facing — Screen Resolution
// ══════════════════════════════════════════════════════════════

/// `GET /api/screens/{code}` — resolve a screen by code, merging tenant overrides.
pub async fn resolve_screen(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<ResolvedScreen>, AppError> {
    let db = &state.db;

    // Prefer tenant-specific screen, fall back to system (tenant_id IS NULL)
    let screen = sqlx::query_as::<_, ScreenMaster>(
        "SELECT * FROM screen_masters \
         WHERE code = $1 AND status = 'active'::form_status \
           AND (tenant_id = $2 OR tenant_id IS NULL) \
         ORDER BY tenant_id NULLS LAST \
         LIMIT 1",
    )
    .bind(&code)
    .bind(claims.tenant_id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Fetch tenant override if one exists
    let override_row = sqlx::query_as::<_, OverrideRow>(
        "SELECT layout_patch, config_patch, hidden_zones, extra_actions \
         FROM tenant_screen_overrides \
         WHERE tenant_id = $1 AND screen_id = $2 AND is_active",
    )
    .bind(claims.tenant_id)
    .bind(screen.id)
    .fetch_optional(db)
    .await?;

    // Merge layout: shallow merge override patches on top of base
    let mut layout = screen.layout.clone();
    let mut config = screen.config.clone();

    if let Some(ov) = &override_row {
        if let (Some(base), Some(patch)) = (layout.as_object_mut(), ov.layout_patch.as_object()) {
            for (k, v) in patch {
                base.insert(k.clone(), v.clone());
            }
        }
        if let (Some(base), Some(patch)) = (config.as_object_mut(), ov.config_patch.as_object()) {
            for (k, v) in patch {
                base.insert(k.clone(), v.clone());
            }
        }
    }

    // Fetch active sidecars
    let sidecars = sqlx::query_as::<_, ScreenSidecar>(
        "SELECT * FROM screen_sidecars \
         WHERE screen_id = $1 AND is_active \
         ORDER BY sort_order",
    )
    .bind(screen.id)
    .fetch_all(db)
    .await?;

    let resolved_sidecars: Vec<ResolvedSidecar> = sidecars
        .into_iter()
        .map(|s| ResolvedSidecar {
            id: s.id,
            name: s.name,
            trigger_event: s.trigger_event,
            trigger_config: s.trigger_config,
            pipeline_id: s.pipeline_id,
            inline_action: s.inline_action,
            condition: s.condition,
        })
        .collect();

    Ok(Json(ResolvedScreen {
        id: screen.id,
        code: screen.code,
        name: screen.name,
        description: screen.description,
        screen_type: screen.screen_type,
        module_code: screen.module_code,
        version: screen.version,
        layout,
        config,
        route_path: screen.route_path,
        icon: screen.icon,
        permission_code: screen.permission_code,
        sidecars: resolved_sidecars,
    }))
}

/// `GET /api/screens/module/{module_code}` — list screens for a module.
pub async fn list_module_screens(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(module_code): Path<String>,
) -> Result<Json<Vec<ScreenSummary>>, AppError> {
    let db = &state.db;

    let rows = sqlx::query_as::<_, ScreenSummary>(
        "SELECT id, code, name, description, screen_type, module_code, status, version, \
                route_path, icon, permission_code, is_system, is_active, sort_order, \
                published_at, created_at, updated_at \
         FROM screen_masters \
         WHERE module_code = $1 AND status = 'active'::form_status \
           AND (tenant_id = $2 OR tenant_id IS NULL) \
         ORDER BY sort_order",
    )
    .bind(&module_code)
    .bind(claims.tenant_id)
    .fetch_all(db)
    .await?;

    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════════
//  Module Sidecars — for hardcoded clinical pages
// ══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ModuleSidecarsQuery {
    pub context: Option<String>,
}

/// `GET /api/modules/{module_code}/sidecars` — fetch active module-level sidecars.
pub async fn list_module_sidecars(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(module_code): Path<String>,
    Query(q): Query<ModuleSidecarsQuery>,
) -> Result<Json<Vec<ResolvedSidecar>>, AppError> {
    let db = &state.db;

    let rows = sqlx::query_as::<_, ModuleSidecar>(
        "SELECT * FROM module_sidecars \
         WHERE tenant_id = $1 AND module_code = $2 \
           AND ($3::text IS NULL OR context_code = $3) \
           AND is_active \
         ORDER BY sort_order",
    )
    .bind(claims.tenant_id)
    .bind(&module_code)
    .bind(&q.context)
    .fetch_all(db)
    .await?;

    let sidecars: Vec<ResolvedSidecar> = rows
        .into_iter()
        .map(|s| ResolvedSidecar {
            id: s.id,
            name: s.name,
            trigger_event: s.trigger_event,
            trigger_config: serde_json::json!({}),
            pipeline_id: s.pipeline_id,
            inline_action: s.inline_action,
            condition: s.condition,
        })
        .collect();

    Ok(Json(sidecars))
}

// ── Internal helper row ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct OverrideRow {
    layout_patch: serde_json::Value,
    config_patch: serde_json::Value,
    #[allow(dead_code)]
    hidden_zones: serde_json::Value,
    #[allow(dead_code)]
    extra_actions: serde_json::Value,
}

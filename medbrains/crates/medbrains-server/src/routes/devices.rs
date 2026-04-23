use axum::{extract::Path, extract::Query, extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::state::AppState;
use medbrains_core::device::{
    self, BridgeAgentRow, BridgeHeartbeatRequest, BridgeRegisterRequest,
    CreateDeviceInstanceRequest, CreateRoutingRuleRequest, DeviceAdapterCatalogRow,
    DeviceConfigHistoryRow, DeviceInstanceRow, DeviceMessageRow, DeviceRoutingRuleRow,
    GeneratedDeviceConfig, UpdateDeviceInstanceRequest, UpdateRoutingRuleRequest,
};
use medbrains_core::permissions;

fn require_permission(claims: &Claims, perm: &str) -> Result<(), AppError> {
    if claims.role == "super_admin" || claims.role == "hospital_admin" {
        return Ok(());
    }
    if claims.permissions.iter().any(|p| p == perm) {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

// ═══════════════════════════════════════════════════════════════
// ── Adapter Catalog (global, read-only) ──────────────────────
// ═══════════════════════════════════════════════════════════════

const ADAPTER_SELECT: &str = "SELECT id, adapter_code, manufacturer, manufacturer_code, \
    model, model_code, device_category, device_subcategory, data_direction, protocol, transport, \
    default_port, default_baud_rate, default_config, field_mappings, \
    data_transforms, qc_recommendations, known_quirks, supported_tests, \
    adapter_version, sdk_version, wasm_hash, wasm_size_bytes, \
    is_verified, contributed_by, documentation_url, is_active \
    FROM device_adapter_catalog";

#[derive(Debug, Deserialize)]
pub struct CatalogSearchParams {
    pub q: Option<String>,
    pub category: Option<String>,
    pub protocol: Option<String>,
    pub manufacturer: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

pub async fn list_adapter_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<CatalogSearchParams>,
) -> Result<Json<Vec<DeviceAdapterCatalogRow>>, AppError> {
    require_permission(&claims, permissions::devices::catalog::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;

    let q = format!(
        "{ADAPTER_SELECT} WHERE is_active = true \
         AND ($1::text IS NULL OR device_category = $1) \
         AND ($2::text IS NULL OR protocol = $2) \
         AND ($3::text IS NULL OR manufacturer_code = $3) \
         AND ($4::text IS NULL OR manufacturer ILIKE '%' || $4 || '%' OR model ILIKE '%' || $4 || '%') \
         ORDER BY manufacturer, model LIMIT $5 OFFSET $6"
    );

    let rows = sqlx::query_as::<_, DeviceAdapterCatalogRow>(&q)
        .bind(&params.category)
        .bind(&params.protocol)
        .bind(&params.manufacturer)
        .bind(&params.q)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    Ok(Json(rows))
}

pub async fn get_adapter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(adapter_code): Path<String>,
) -> Result<Json<DeviceAdapterCatalogRow>, AppError> {
    require_permission(&claims, permissions::devices::catalog::LIST)?;

    let q = format!("{ADAPTER_SELECT} WHERE adapter_code = $1 AND is_active = true");
    let row = sqlx::query_as::<_, DeviceAdapterCatalogRow>(&q)
        .bind(&adapter_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct PreviewConfigParams {
    pub department_code: Option<String>,
}

pub async fn preview_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(adapter_code): Path<String>,
    Query(params): Query<PreviewConfigParams>,
) -> Result<Json<GeneratedDeviceConfig>, AppError> {
    require_permission(&claims, permissions::devices::CREATE)?;

    let q = format!("{ADAPTER_SELECT} WHERE adapter_code = $1 AND is_active = true");
    let adapter = sqlx::query_as::<_, DeviceAdapterCatalogRow>(&q)
        .bind(&adapter_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let config = device::generate_device_config(&adapter, params.department_code.as_deref());
    Ok(Json(config))
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ManufacturerSummary {
    pub code: String,
    pub name: String,
    pub model_count: i64,
}

pub async fn list_manufacturers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ManufacturerSummary>>, AppError> {
    require_permission(&claims, permissions::devices::catalog::LIST)?;

    let rows = sqlx::query_as::<_, ManufacturerSummary>(
        "SELECT manufacturer_code AS code, manufacturer AS name, COUNT(*) AS model_count \
         FROM device_adapter_catalog WHERE is_active = true \
         GROUP BY manufacturer_code, manufacturer ORDER BY manufacturer",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ═══════════════════════════════════════════════════════════════
// ── Device Instances (per-tenant CRUD) ───────────────────────
// ═══════════════════════════════════════════════════════════════

const INSTANCE_SELECT: &str = "SELECT id, tenant_id, adapter_code, facility_id, department_id, \
    name, code, serial_number, hostname, port, \
    protocol_config, field_mappings, data_transforms, qc_config, \
    ai_config_version, ai_confidence, human_overrides, config_source, \
    status, last_heartbeat, last_message_at, last_error, \
    error_count_24h, message_count_24h, bridge_agent_id, \
    notes, tags, is_active, created_at, updated_at \
    FROM device_instances";

pub async fn list_device_instances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DeviceInstanceRow>>, AppError> {
    require_permission(&claims, permissions::devices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = format!("{INSTANCE_SELECT} WHERE is_active = true ORDER BY created_at DESC");
    let rows = sqlx::query_as::<_, DeviceInstanceRow>(&q)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_device_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DeviceInstanceRow>, AppError> {
    require_permission(&claims, permissions::devices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = format!("{INSTANCE_SELECT} WHERE id = $1");
    let row = sqlx::query_as::<_, DeviceInstanceRow>(&q)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_device_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDeviceInstanceRequest>,
) -> Result<Json<DeviceInstanceRow>, AppError> {
    require_permission(&claims, permissions::devices::CREATE)?;

    let aq = format!("{ADAPTER_SELECT} WHERE adapter_code = $1 AND is_active = true");
    let adapter = sqlx::query_as::<_, DeviceAdapterCatalogRow>(&aq)
        .bind(&body.adapter_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::BadRequest(format!("Unknown adapter: {}", body.adapter_code)))?;

    let ai_config = device::generate_device_config(&adapter, None);

    let protocol_config = body.protocol_config.clone().unwrap_or(ai_config.protocol_config);
    let field_mappings = body.field_mappings.clone().unwrap_or(ai_config.field_mappings);
    let data_transforms = body.data_transforms.clone().unwrap_or(ai_config.data_transforms);
    let qc_config = body.qc_config.clone().unwrap_or(ai_config.qc_config);
    let config_source = if body.protocol_config.is_some() { "ai_assisted" } else { "ai_auto" };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let iq = format!(
        "INSERT INTO device_instances \
         (tenant_id, adapter_code, name, code, facility_id, department_id, \
          serial_number, hostname, port, credentials, \
          protocol_config, field_mappings, data_transforms, qc_config, \
          ai_config_version, ai_confidence, config_source, \
          notes, tags, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,$15,$16,$17,$18,$19) \
         RETURNING {}", INSTANCE_SELECT.trim_start_matches("SELECT ").split(" FROM ").next().unwrap_or("*")
    );

    let rq = format!("{INSTANCE_SELECT} WHERE id = (SELECT id FROM device_instances WHERE tenant_id = $1 AND code = $2)");

    // Use a simpler approach: insert then fetch
    sqlx::query(
        "INSERT INTO device_instances \
         (tenant_id, adapter_code, name, code, facility_id, department_id, \
          serial_number, hostname, port, credentials, \
          protocol_config, field_mappings, data_transforms, qc_config, \
          ai_config_version, ai_confidence, config_source, \
          notes, tags, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,$15,$16,$17,$18,$19)",
    )
    .bind(claims.tenant_id)
    .bind(&body.adapter_code)
    .bind(&body.name)
    .bind(&body.code)
    .bind(body.facility_id)
    .bind(body.department_id)
    .bind(&body.serial_number)
    .bind(&body.hostname)
    .bind(body.port.or(ai_config.default_port))
    .bind(body.credentials.clone().unwrap_or(serde_json::json!({})))
    .bind(&protocol_config)
    .bind(&field_mappings)
    .bind(&data_transforms)
    .bind(&qc_config)
    .bind(ai_config.confidence)
    .bind(config_source)
    .bind(&body.notes)
    .bind(body.tags.clone().unwrap_or_default())
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    let q = format!("{INSTANCE_SELECT} WHERE tenant_id = $1 AND code = $2");
    let row = sqlx::query_as::<_, DeviceInstanceRow>(&q)
        .bind(claims.tenant_id)
        .bind(&body.code)
        .fetch_one(&mut *tx)
        .await?;

    // Config history
    sqlx::query(
        "INSERT INTO device_config_history \
         (tenant_id, device_instance_id, change_type, new_config, changed_by, \
          change_reason, ai_confidence) \
         VALUES ($1, $2, 'initial_setup', $3, $4, 'Device created with AI auto-config', $5)",
    )
    .bind(claims.tenant_id)
    .bind(row.id)
    .bind(serde_json::json!({
        "protocol_config": protocol_config,
        "field_mappings": field_mappings,
    }))
    .bind(claims.sub)
    .bind(ai_config.confidence)
    .execute(&mut *tx)
    .await?;

    // Bump install count
    sqlx::query("UPDATE device_adapter_catalog SET install_count = install_count + 1 WHERE adapter_code = $1")
        .bind(&body.adapter_code)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_device_instance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDeviceInstanceRequest>,
) -> Result<Json<DeviceInstanceRow>, AppError> {
    require_permission(&claims, permissions::devices::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE device_instances SET \
         name = COALESCE($2, name), facility_id = COALESCE($3, facility_id), \
         department_id = COALESCE($4, department_id), serial_number = COALESCE($5, serial_number), \
         hostname = COALESCE($6, hostname), port = COALESCE($7, port), \
         credentials = COALESCE($8, credentials), protocol_config = COALESCE($9, protocol_config), \
         field_mappings = COALESCE($10, field_mappings), data_transforms = COALESCE($11, data_transforms), \
         qc_config = COALESCE($12, qc_config), notes = COALESCE($13, notes), \
         tags = COALESCE($14, tags), updated_by = $15 \
         WHERE id = $1",
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.facility_id)
    .bind(body.department_id)
    .bind(&body.serial_number)
    .bind(&body.hostname)
    .bind(body.port)
    .bind(&body.credentials)
    .bind(&body.protocol_config)
    .bind(&body.field_mappings)
    .bind(&body.data_transforms)
    .bind(&body.qc_config)
    .bind(&body.notes)
    .bind(&body.tags)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    let q = format!("{INSTANCE_SELECT} WHERE id = $1");
    let row = sqlx::query_as::<_, DeviceInstanceRow>(&q)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn decommission_device(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::devices::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("UPDATE device_instances SET status = 'decommissioned', is_active = false, updated_by = $2 WHERE id = $1")
        .bind(id)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"status": "decommissioned"})))
}

pub async fn test_device_connection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::devices::TEST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = format!("{INSTANCE_SELECT} WHERE id = $1");
    let device = sqlx::query_as::<_, DeviceInstanceRow>(&q)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    let result = if device.hostname.is_some() {
        serde_json::json!({
            "status": "pending",
            "message": "Connectivity test requires bridge agent (Phase 2)",
            "device_id": id,
            "hostname": device.hostname,
            "port": device.port,
        })
    } else {
        serde_json::json!({
            "status": "failed",
            "message": "No hostname configured",
            "device_id": id,
        })
    };

    Ok(Json(result))
}

pub async fn regenerate_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<GeneratedDeviceConfig>, AppError> {
    require_permission(&claims, permissions::devices::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let dq = format!("{INSTANCE_SELECT} WHERE id = $1");
    let device = sqlx::query_as::<_, DeviceInstanceRow>(&dq)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    let aq = format!("{ADAPTER_SELECT} WHERE adapter_code = $1");
    let adapter = sqlx::query_as::<_, DeviceAdapterCatalogRow>(&aq)
        .bind(&device.adapter_code)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let config = device::generate_device_config(&adapter, None);
    Ok(Json(config))
}

// ═══════════════════════════════════════════════════════════════
// ── Device Messages ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct MessageListParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

pub async fn list_device_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(device_id): Path<Uuid>,
    Query(params): Query<MessageListParams>,
) -> Result<Json<Vec<DeviceMessageRow>>, AppError> {
    require_permission(&claims, permissions::devices::messages::VIEW)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DeviceMessageRow>(
        "SELECT id, tenant_id, device_instance_id, direction, protocol, \
         parsed_payload, mapped_data, processing_status, target_module, \
         target_entity_id, error_message, retry_count, processing_duration_ms, created_at \
         FROM device_messages WHERE device_instance_id = $1 \
         AND ($2::text IS NULL OR processing_status::text = $2) \
         ORDER BY created_at DESC LIMIT $3 OFFSET $4",
    )
    .bind(device_id)
    .bind(&params.status)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_config_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(device_id): Path<Uuid>,
) -> Result<Json<Vec<DeviceConfigHistoryRow>>, AppError> {
    require_permission(&claims, permissions::devices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DeviceConfigHistoryRow>(
        "SELECT id, device_instance_id, change_type, previous_config, new_config, \
         changed_fields, changed_by, change_reason, ai_confidence, created_at \
         FROM device_config_history WHERE device_instance_id = $1 \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(device_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ═══════════════════════════════════════════════════════════════
// ── Bridge Agents ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

pub async fn list_bridge_agents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<BridgeAgentRow>>, AppError> {
    require_permission(&claims, permissions::devices::agents::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, BridgeAgentRow>(
        "SELECT id, tenant_id, name, deployment_mode, version, hostname, \
         capabilities, status, last_heartbeat, devices_connected, \
         buffer_depth, is_active, created_at \
         FROM bridge_agents WHERE is_active = true ORDER BY created_at DESC",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn register_bridge_agent(
    State(state): State<AppState>,
    Json(body): Json<BridgeRegisterRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let key_hash = {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(body.agent_key.as_bytes());
        hex::encode(hasher.finalize())
    };

    let agent_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO bridge_agents (name, agent_key_hash, deployment_mode, version, hostname, capabilities, status) \
         VALUES ($1, $2, $3, $4, $5, $6, 'online') RETURNING id",
    )
    .bind(&body.name)
    .bind(&key_hash)
    .bind(&body.deployment_mode)
    .bind(&body.version)
    .bind(&body.hostname)
    .bind(&body.capabilities)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({"agent_id": agent_id, "status": "registered"})))
}

pub async fn bridge_heartbeat(
    State(state): State<AppState>,
    Json(body): Json<BridgeHeartbeatRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query(
        "UPDATE bridge_agents SET status = 'online', last_heartbeat = now(), \
         devices_connected = $2, buffer_depth = $3 WHERE id = $1",
    )
    .bind(body.agent_id)
    .bind(body.devices_connected)
    .bind(body.buffer_depth)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({"status": "ok"})))
}

// ═══════════════════════════════════════════════════════════════
// ── Routing Rules ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const RULE_SELECT: &str = "SELECT id, tenant_id, device_instance_id, adapter_code, \
    name, description, target_module, match_strategy, match_field, \
    target_entity, field_mappings, transform_rules, auto_verify, \
    notify_on_critical, reject_duplicates, trigger_pipeline, \
    priority, is_active, created_at, updated_at \
    FROM device_routing_rules";

pub async fn list_routing_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DeviceRoutingRuleRow>>, AppError> {
    require_permission(&claims, permissions::devices::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let q = format!("{RULE_SELECT} ORDER BY priority DESC, created_at DESC");
    let rows = sqlx::query_as::<_, DeviceRoutingRuleRow>(&q)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_routing_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRoutingRuleRequest>,
) -> Result<Json<DeviceRoutingRuleRow>, AppError> {
    require_permission(&claims, permissions::devices::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO device_routing_rules \
         (tenant_id, device_instance_id, adapter_code, name, description, \
          target_module, match_strategy, match_field, target_entity, \
          field_mappings, transform_rules, auto_verify, notify_on_critical, \
          reject_duplicates, priority, created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
    )
    .bind(claims.tenant_id)
    .bind(body.device_instance_id)
    .bind(&body.adapter_code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.target_module)
    .bind(&body.match_strategy)
    .bind(&body.match_field)
    .bind(&body.target_entity)
    .bind(body.field_mappings.unwrap_or(serde_json::json!([])))
    .bind(body.transform_rules.unwrap_or(serde_json::json!([])))
    .bind(body.auto_verify.unwrap_or(false))
    .bind(body.notify_on_critical.unwrap_or(true))
    .bind(body.reject_duplicates.unwrap_or(true))
    .bind(body.priority.unwrap_or(0))
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    // Fetch the created rule
    let q = format!("{RULE_SELECT} WHERE tenant_id = $1 AND name = $2 ORDER BY created_at DESC LIMIT 1");
    let row = sqlx::query_as::<_, DeviceRoutingRuleRow>(&q)
        .bind(claims.tenant_id)
        .bind(&body.name)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_routing_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRoutingRuleRequest>,
) -> Result<Json<DeviceRoutingRuleRow>, AppError> {
    require_permission(&claims, permissions::devices::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE device_routing_rules SET \
         name = COALESCE($2, name), description = COALESCE($3, description), \
         target_module = COALESCE($4, target_module), match_strategy = COALESCE($5, match_strategy), \
         match_field = COALESCE($6, match_field), target_entity = COALESCE($7, target_entity), \
         field_mappings = COALESCE($8, field_mappings), transform_rules = COALESCE($9, transform_rules), \
         auto_verify = COALESCE($10, auto_verify), notify_on_critical = COALESCE($11, notify_on_critical), \
         reject_duplicates = COALESCE($12, reject_duplicates), priority = COALESCE($13, priority), \
         is_active = COALESCE($14, is_active) \
         WHERE id = $1",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.target_module)
    .bind(&body.match_strategy)
    .bind(&body.match_field)
    .bind(&body.target_entity)
    .bind(&body.field_mappings)
    .bind(&body.transform_rules)
    .bind(body.auto_verify)
    .bind(body.notify_on_critical)
    .bind(body.reject_duplicates)
    .bind(body.priority)
    .bind(body.is_active)
    .execute(&mut *tx)
    .await?;

    let q = format!("{RULE_SELECT} WHERE id = $1");
    let row = sqlx::query_as::<_, DeviceRoutingRuleRow>(&q)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_routing_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::devices::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM device_routing_rules WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"status": "deleted"})))
}

// ═══════════════════════════════════════════════════════════════
// ── Device Data Ingest ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

pub async fn ingest_device_data(
    State(state): State<AppState>,
    Path(module): Path<String>,
    Json(body): Json<device::DeviceIngestRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let dq = format!("{INSTANCE_SELECT} WHERE id = $1");
    let device = sqlx::query_as::<_, DeviceInstanceRow>(&dq)
        .bind(body.device_instance_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &device.tenant_id).await?;

    let msg_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO device_messages \
         (tenant_id, device_instance_id, direction, protocol, \
          parsed_payload, mapped_data, processing_status, target_module, \
          processing_duration_ms) \
         VALUES ($1, $2, 'inbound', $3, $4, $5, 'delivered', $6, $7) RETURNING id",
    )
    .bind(device.tenant_id)
    .bind(body.device_instance_id)
    .bind(&body.protocol)
    .bind(&body.parsed_payload)
    .bind(&body.mapped_data)
    .bind(&module)
    .bind(body.processing_duration_ms)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE device_instances SET last_message_at = now(), message_count_24h = message_count_24h + 1 WHERE id = $1")
        .bind(body.device_instance_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "status": "delivered",
        "message_id": msg_id,
        "module": module,
    })))
}

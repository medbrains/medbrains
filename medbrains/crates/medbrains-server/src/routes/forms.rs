use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::form::{
    FieldAccessLevel, FormFieldJoinRow, FormMaster, RegulatoryClauseRef, RegulatoryLinkRow,
    RequirementLevel, ResolvedField, ResolvedFormDefinition, ResolvedSection, TenantOverrideRow,
};

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

// ── List Forms ─────────────────────────────────────────────

pub async fn list_forms(State(state): State<AppState>) -> Result<Json<Vec<FormMaster>>, AppError> {
    let forms = sqlx::query_as::<_, FormMaster>(
        "SELECT id, code, name, version, status, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters WHERE status = 'active' ORDER BY code",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(forms))
}

// ── Get Form Definition (resolved per-tenant) ──────────────

#[derive(Debug, Deserialize)]
pub struct FormDefinitionParams {
    pub quick_mode: Option<bool>,
}

#[allow(clippy::too_many_lines)]
pub async fn get_form_definition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_code): Path<String>,
    Query(params): Query<FormDefinitionParams>,
) -> Result<Json<ResolvedFormDefinition>, AppError> {
    let quick_mode = params.quick_mode.unwrap_or(false);
    let tenant_id = claims.tenant_id;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Query 1: Get the active form
    let form_row = sqlx::query_as::<_, FormMaster>(
        "SELECT id, code, name, version, status, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters WHERE code = $1 AND status = 'active'",
    )
    .bind(&form_code)
    .fetch_optional(&mut *tx)
    .await?;

    // Fallback: if form is in draft, serve from latest active snapshot
    if form_row.is_none() {
        let draft_exists: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM form_masters WHERE code = $1 AND status = 'draft'")
                .bind(&form_code)
                .fetch_optional(&mut *tx)
                .await?;

        if let Some(draft_id) = draft_exists {
            let snapshot_row = sqlx::query_as::<_, medbrains_core::form::FormVersionSnapshot>(
                "SELECT id, form_id, version, name, status, config, snapshot, \
                        change_summary, created_by, created_at \
                 FROM form_version_snapshots \
                 WHERE form_id = $1 AND status = 'active' \
                 ORDER BY version DESC LIMIT 1",
            )
            .bind(draft_id)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(snap) = snapshot_row {
                let resolved = resolve_from_snapshot(&snap);
                tx.commit().await?;
                return Ok(Json(resolved));
            }
        }

        return Err(AppError::NotFound);
    }

    let Some(form) = form_row else {
        return Err(AppError::NotFound);
    };

    // Query 2: Get all fields with section and field_master data
    let join_rows = sqlx::query_as::<_, FormFieldJoinRow>(
        "SELECT \
            ff.id AS ff_id, ff.sort_order AS ff_sort_order, \
            ff.label_override AS ff_label_override, ff.is_quick_mode AS ff_is_quick_mode, \
            fs.code AS fs_code, fs.name AS fs_name, fs.sort_order AS fs_sort_order, \
            fs.is_collapsible AS fs_is_collapsible, fs.is_default_open AS fs_is_default_open, \
            fs.icon AS fs_icon, fs.color AS fs_color, \
            fm.code AS fm_code, fm.name AS fm_name, fm.description AS fm_description, \
            fm.data_type AS fm_data_type, fm.default_value AS fm_default_value, \
            fm.placeholder AS fm_placeholder, fm.validation AS fm_validation, \
            fm.ui_component AS fm_ui_component, fm.ui_width AS fm_ui_width, \
            fm.condition AS fm_condition, \
            fm.data_source AS fm_data_source, fm.actions AS fm_actions, \
            ff.data_source_override AS ff_data_source_override, \
            ff.actions_override AS ff_actions_override, \
            ff.icon AS ff_icon, ff.icon_position AS ff_icon_position \
         FROM form_fields ff \
         JOIN form_sections fs ON fs.id = ff.section_id \
         JOIN field_masters fm ON fm.id = ff.field_id \
         WHERE ff.form_id = $1 AND fm.is_active = true \
         ORDER BY fs.sort_order, ff.sort_order",
    )
    .bind(form.id)
    .fetch_all(&mut *tx)
    .await?;

    if join_rows.is_empty() {
        tx.commit().await?;
        return Ok(Json(ResolvedFormDefinition {
            form_code: form.code,
            form_name: form.name,
            version: form.version,
            config: form.config,
            sections: vec![],
        }));
    }

    // Get field_master IDs for regulatory + override queries
    let field_master_ids: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT fm.id FROM form_fields ff \
         JOIN field_masters fm ON fm.id = ff.field_id \
         WHERE ff.form_id = $1 AND fm.is_active = true",
    )
    .bind(form.id)
    .fetch_all(&mut *tx)
    .await?;

    // Query 3: Regulatory links for this tenant's bodies
    let reg_links = sqlx::query_as::<_, RegulatoryLinkRow>(
        "SELECT frl.field_id, frl.requirement_level, frl.clause_reference, frl.clause_code, \
                rb.code AS body_code, rb.name AS body_name \
         FROM field_regulatory_links frl \
         JOIN regulatory_bodies rb ON rb.id = frl.regulatory_body_id \
         WHERE frl.regulatory_body_id IN ( \
             SELECT regulatory_body_id FROM facility_regulatory_compliance \
             WHERE tenant_id = $1 \
         ) AND frl.field_id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&field_master_ids)
    .fetch_all(&mut *tx)
    .await?;

    // Query 4: Tenant field overrides
    let overrides = sqlx::query_as::<_, TenantOverrideRow>(
        "SELECT field_id, label_override, requirement_override, is_hidden, validation_override \
         FROM tenant_field_overrides \
         WHERE tenant_id = $1 AND (form_id = $2 OR form_id IS NULL) \
         AND field_id = ANY($3)",
    )
    .bind(tenant_id)
    .bind(form.id)
    .bind(&field_master_ids)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Map field code -> field_master ID
    let field_code_to_id: HashMap<String, Uuid> = {
        let rows = sqlx::query_as::<_, (String, Uuid)>(
            "SELECT fm.code, fm.id FROM form_fields ff \
             JOIN field_masters fm ON fm.id = ff.field_id \
             WHERE ff.form_id = $1",
        )
        .bind(form.id)
        .fetch_all(&state.db)
        .await?;
        rows.into_iter().collect()
    };

    // Resolve field access levels for this user
    let field_access = resolve_field_access(&state.db, tenant_id, claims.sub, &claims.role).await?;

    // Determine the module code for this form (for field_access key prefix)
    let module_code: Option<String> =
        sqlx::query_scalar("SELECT module_code FROM module_form_links WHERE form_id = $1 LIMIT 1")
            .bind(form.id)
            .fetch_optional(&state.db)
            .await?;

    // Assemble resolved sections
    let sections = assemble_sections(
        &join_rows,
        &reg_links,
        &overrides,
        &field_code_to_id,
        quick_mode,
        &field_access,
        module_code.as_deref(),
    );

    Ok(Json(ResolvedFormDefinition {
        form_code: form.code,
        form_name: form.name,
        version: form.version,
        config: form.config,
        sections,
    }))
}

/// Assemble resolved sections from joined rows, regulatory links, and overrides.
fn assemble_sections(
    join_rows: &[FormFieldJoinRow],
    reg_links: &[RegulatoryLinkRow],
    overrides: &[TenantOverrideRow],
    field_code_to_id: &HashMap<String, Uuid>,
    quick_mode: bool,
    field_access: &HashMap<String, FieldAccessLevel>,
    module_code: Option<&str>,
) -> Vec<ResolvedSection> {
    // Build lookup maps
    let mut reg_by_field: HashMap<Uuid, Vec<&RegulatoryLinkRow>> = HashMap::new();
    for rl in reg_links {
        reg_by_field.entry(rl.field_id).or_default().push(rl);
    }

    let override_by_field: HashMap<Uuid, &TenantOverrideRow> =
        overrides.iter().map(|o| (o.field_id, o)).collect();

    let mut sections_map: HashMap<String, ResolvedSection> = HashMap::new();
    let mut section_order: Vec<String> = Vec::new();

    for row in join_rows {
        if quick_mode && !row.ff_is_quick_mode {
            continue;
        }

        let field_id = field_code_to_id.get(&row.fm_code).copied();
        let access_level = module_code
            .and_then(|m| {
                let key = format!("{m}.{}", row.fm_code);
                field_access.get(&key).copied()
            })
            .unwrap_or_default();
        let resolved = resolve_field(
            row,
            field_id,
            &reg_by_field,
            &override_by_field,
            access_level,
        );

        let sec_code = row.fs_code.clone();
        if !sections_map.contains_key(&sec_code) {
            section_order.push(sec_code.clone());
            sections_map.insert(
                sec_code.clone(),
                ResolvedSection {
                    code: sec_code.clone(),
                    name: row.fs_name.clone(),
                    sort_order: row.fs_sort_order,
                    is_collapsible: row.fs_is_collapsible,
                    is_default_open: row.fs_is_default_open,
                    icon: row.fs_icon.clone(),
                    color: row.fs_color.clone(),
                    fields: Vec::new(),
                },
            );
        }
        if let Some(sec) = sections_map.get_mut(&sec_code) {
            sec.fields.push(resolved);
        }
    }

    section_order
        .into_iter()
        .filter_map(|code| sections_map.remove(&code))
        .filter(|s| !s.fields.is_empty())
        .collect()
}

/// Resolve a single field: compute requirement level, apply overrides, build UI hint.
fn resolve_field(
    row: &FormFieldJoinRow,
    field_id: Option<Uuid>,
    reg_by_field: &HashMap<Uuid, Vec<&RegulatoryLinkRow>>,
    override_by_field: &HashMap<Uuid, &TenantOverrideRow>,
    access_level: FieldAccessLevel,
) -> ResolvedField {
    let mut max_req = RequirementLevel::Optional;
    let mut clauses: Vec<RegulatoryClauseRef> = Vec::new();

    if let Some(fid) = field_id {
        if let Some(links) = reg_by_field.get(&fid) {
            for link in links {
                if link.requirement_level > max_req {
                    max_req = link.requirement_level;
                }
                clauses.push(RegulatoryClauseRef {
                    body_code: link.body_code.clone(),
                    body_name: link.body_name.clone(),
                    clause_code: link.clause_code.clone(),
                    clause_reference: link.clause_reference.clone(),
                    requirement_level: link.requirement_level,
                });
            }
        }
    }

    let mut is_hidden = false;
    let mut label = row
        .ff_label_override
        .clone()
        .unwrap_or_else(|| row.fm_name.clone());
    let mut validation = row.fm_validation.clone();

    if let Some(fid) = field_id {
        if let Some(ovr) = override_by_field.get(&fid) {
            if let Some(ovr_req) = ovr.requirement_override {
                if ovr_req > max_req {
                    max_req = ovr_req;
                }
            }
            if let Some(ref lbl) = ovr.label_override {
                label.clone_from(lbl);
            }
            if ovr.is_hidden && max_req != RequirementLevel::Mandatory {
                is_hidden = true;
            }
            if let Some(ref vo) = ovr.validation_override {
                validation = Some(merge_validation(validation, vo.clone()));
            }
        }
    }

    let ui_hint = build_ui_hint(&clauses);

    // If field access is Hidden, override is_hidden
    if access_level == FieldAccessLevel::Hidden {
        is_hidden = true;
    }

    ResolvedField {
        field_code: row.fm_code.clone(),
        label,
        description: row.fm_description.clone(),
        data_type: row.fm_data_type,
        requirement_level: max_req,
        default_value: row.fm_default_value.clone(),
        placeholder: row.fm_placeholder.clone(),
        validation,
        ui_component: row.fm_ui_component.clone(),
        ui_width: row.fm_ui_width.clone(),
        ui_hint,
        icon: row.ff_icon.clone(),
        icon_position: row.ff_icon_position.clone(),
        condition: row.fm_condition.clone(),
        is_quick_mode: row.ff_is_quick_mode,
        is_hidden,
        access_level,
        regulatory_clauses: clauses,
        data_source: row
            .ff_data_source_override
            .clone()
            .or_else(|| row.fm_data_source.clone()),
        actions: row
            .ff_actions_override
            .clone()
            .or_else(|| row.fm_actions.clone()),
    }
}

/// Build a UI hint string from regulatory clause references.
fn build_ui_hint(clauses: &[RegulatoryClauseRef]) -> Option<String> {
    if clauses.is_empty() {
        return None;
    }
    let parts: Vec<String> = clauses
        .iter()
        .map(|c| {
            let code = c.clause_code.as_deref().unwrap_or(&c.body_code);
            format!("{} {code}", c.body_code)
        })
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(format!("Required by {}.", parts.join(", ")))
    }
}

// ── Module Forms ───────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ModuleFormRow {
    pub module_code: String,
    pub form_id: Uuid,
    pub context: String,
    pub form_code: String,
    pub form_name: String,
}

pub async fn get_module_forms(
    State(state): State<AppState>,
    Path(module_code): Path<String>,
) -> Result<Json<Vec<ModuleFormRow>>, AppError> {
    let rows = sqlx::query_as::<_, ModuleFormRow>(
        "SELECT mfl.module_code, mfl.form_id, mfl.context, \
                fm.code AS form_code, fm.name AS form_name \
         FROM module_form_links mfl \
         JOIN form_masters fm ON fm.id = mfl.form_id \
         WHERE mfl.module_code = $1 AND fm.status = 'active' \
         ORDER BY mfl.context",
    )
    .bind(&module_code)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

// ── Tenant Field Overrides ─────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TenantFieldOverrideRow {
    pub id: Uuid,
    pub field_id: Uuid,
    pub field_code: String,
    pub field_name: String,
    pub form_id: Option<Uuid>,
    pub label_override: Option<String>,
    pub requirement_override: Option<RequirementLevel>,
    pub is_hidden: bool,
    pub validation_override: Option<serde_json::Value>,
}

pub async fn list_tenant_overrides(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TenantFieldOverrideRow>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TenantFieldOverrideRow>(
        "SELECT tfo.id, tfo.field_id, fm.code AS field_code, fm.name AS field_name, \
                tfo.form_id, tfo.label_override, tfo.requirement_override, \
                tfo.is_hidden, tfo.validation_override \
         FROM tenant_field_overrides tfo \
         JOIN field_masters fm ON fm.id = tfo.field_id \
         WHERE tfo.tenant_id = $1 \
         ORDER BY fm.code",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpdateOverrideRequest {
    pub form_id: Option<Uuid>,
    pub label_override: Option<String>,
    pub requirement_override: Option<RequirementLevel>,
    pub is_hidden: Option<bool>,
    pub validation_override: Option<serde_json::Value>,
}

pub async fn upsert_tenant_override(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(field_code): Path<String>,
    Json(body): Json<UpdateOverrideRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let field_id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM field_masters WHERE code = $1")
        .bind(&field_code)
        .fetch_optional(&mut *tx)
        .await?;

    let Some(field_id) = field_id else {
        return Err(AppError::NotFound);
    };

    // Prevent downgrade below regulatory requirement
    if let Some(req_override) = body.requirement_override {
        let max_regulatory: Option<RequirementLevel> = sqlx::query_scalar(
            "SELECT MAX(frl.requirement_level) FROM field_regulatory_links frl \
             WHERE frl.field_id = $1 AND frl.regulatory_body_id IN ( \
                 SELECT regulatory_body_id FROM facility_regulatory_compliance \
                 WHERE tenant_id = $2 \
             )",
        )
        .bind(field_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

        if let Some(max_reg) = max_regulatory {
            if req_override < max_reg {
                return Err(AppError::BadRequest(format!(
                    "Cannot downgrade field '{field_code}' below regulatory requirement '{max_reg:?}'"
                )));
            }
        }
    }

    // Cannot hide mandatory fields
    if body.is_hidden.unwrap_or(false) {
        let is_mandatory: Option<bool> = sqlx::query_scalar(
            "SELECT EXISTS( \
                 SELECT 1 FROM field_regulatory_links frl \
                 WHERE frl.field_id = $1 \
                 AND frl.requirement_level = 'mandatory' \
                 AND frl.regulatory_body_id IN ( \
                     SELECT regulatory_body_id FROM facility_regulatory_compliance \
                     WHERE tenant_id = $2 \
                 ) \
             )",
        )
        .bind(field_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        if is_mandatory.unwrap_or(false) {
            return Err(AppError::BadRequest(
                "Cannot hide a mandatory field".to_owned(),
            ));
        }
    }

    sqlx::query(
        "INSERT INTO tenant_field_overrides \
            (tenant_id, field_id, form_id, label_override, requirement_override, \
             is_hidden, validation_override) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (tenant_id, field_id, form_id) DO UPDATE SET \
            label_override = COALESCE(EXCLUDED.label_override, \
                tenant_field_overrides.label_override), \
            requirement_override = COALESCE(EXCLUDED.requirement_override, \
                tenant_field_overrides.requirement_override), \
            is_hidden = COALESCE(EXCLUDED.is_hidden, \
                tenant_field_overrides.is_hidden), \
            validation_override = COALESCE(EXCLUDED.validation_override, \
                tenant_field_overrides.validation_override), \
            updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(field_id)
    .bind(body.form_id)
    .bind(&body.label_override)
    .bind(body.requirement_override)
    .bind(body.is_hidden.unwrap_or(false))
    .bind(&body.validation_override)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

pub async fn delete_tenant_override(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(field_code): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "DELETE FROM tenant_field_overrides \
         WHERE tenant_id = $1 \
         AND field_id = (SELECT id FROM field_masters WHERE code = $2)",
    )
    .bind(claims.tenant_id)
    .bind(&field_code)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Field Access Resolution ────────────────────────────────

/// Resolve field access levels for a user.
///
/// Resolution order (highest wins):
/// 1. User `access_matrix.field_access` (most specific)
/// 2. Role `field_access_defaults` (new column on `roles`)
/// 3. Default = `Edit`
///
/// Bypass roles (`super_admin`, `hospital_admin`) always get `Edit` (empty map).
pub async fn resolve_field_access(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    // Bypass roles get everything as edit (default)
    if role == "super_admin" || role == "hospital_admin" {
        return Ok(HashMap::new());
    }

    let mut access: HashMap<String, FieldAccessLevel> = HashMap::new();

    // Layer 1: Role field_access_defaults
    let role_defaults: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT field_access_defaults FROM roles \
         WHERE tenant_id = $1 AND code = $2 AND is_active = true",
    )
    .bind(tenant_id)
    .bind(role)
    .fetch_optional(db)
    .await?;

    if let Some(serde_json::Value::Object(map)) = role_defaults {
        for (key, val) in &map {
            if let Some(level) = parse_access_level(val) {
                access.insert(key.clone(), level);
            }
        }
    }

    // Layer 2: User access_matrix.field_access (overrides role defaults)
    let user_matrix: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT access_matrix -> 'field_access' FROM users \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(db)
    .await?;

    if let Some(serde_json::Value::Object(map)) = user_matrix {
        for (key, val) in &map {
            if let Some(level) = parse_access_level(val) {
                access.insert(key.clone(), level);
            }
        }
    }

    Ok(access)
}

/// Parse a JSON string value into a `FieldAccessLevel`.
fn parse_access_level(val: &serde_json::Value) -> Option<FieldAccessLevel> {
    val.as_str().and_then(|s| match s {
        "edit" => Some(FieldAccessLevel::Edit),
        "view" => Some(FieldAccessLevel::View),
        "hidden" => Some(FieldAccessLevel::Hidden),
        _ => None,
    })
}

// ── Snapshot Resolution ────────────────────────────────────

/// Build a `ResolvedFormDefinition` from a snapshot (used for fallback when form is in draft).
fn resolve_from_snapshot(
    snap: &medbrains_core::form::FormVersionSnapshot,
) -> ResolvedFormDefinition {
    use medbrains_core::form::FieldDataType;

    let empty_arr = Vec::new();
    let sections_json = snap
        .snapshot
        .get("sections")
        .and_then(|s| s.as_array())
        .unwrap_or(&empty_arr);

    let sections: Vec<ResolvedSection> = sections_json
        .iter()
        .map(|sec| {
            let fields_json = sec
                .get("fields")
                .and_then(|f| f.as_array())
                .unwrap_or(&empty_arr);

            let fields: Vec<ResolvedField> = fields_json
                .iter()
                .map(|f| {
                    let fms = f.get("field_master_snapshot");
                    let data_type_str = f
                        .get("data_type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("text");
                    let data_type: FieldDataType =
                        serde_json::from_value(serde_json::Value::String(data_type_str.to_owned()))
                            .unwrap_or(FieldDataType::Text);

                    ResolvedField {
                        field_code: f
                            .get("field_code")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_owned(),
                        label: f
                            .get("label_override")
                            .and_then(|v| v.as_str())
                            .or_else(|| f.get("field_name").and_then(|v| v.as_str()))
                            .unwrap_or("")
                            .to_owned(),
                        description: None,
                        data_type,
                        requirement_level: RequirementLevel::Optional,
                        default_value: None,
                        placeholder: fms
                            .and_then(|m| m.get("placeholder"))
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        validation: fms.and_then(|m| m.get("validation")).cloned(),
                        ui_component: None,
                        ui_width: fms
                            .and_then(|m| m.get("ui_width"))
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        ui_hint: None,
                        icon: f.get("icon").and_then(|v| v.as_str()).map(String::from),
                        icon_position: f
                            .get("icon_position")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        condition: None,
                        is_quick_mode: f
                            .get("is_quick_mode")
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false),
                        is_hidden: false,
                        access_level: FieldAccessLevel::Edit,
                        regulatory_clauses: vec![],
                        data_source: fms.and_then(|m| m.get("data_source")).cloned(),
                        actions: fms.and_then(|m| m.get("actions")).cloned(),
                    }
                })
                .collect();

            ResolvedSection {
                code: sec
                    .get("code")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_owned(),
                name: sec
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_owned(),
                sort_order: sec
                    .get("sort_order")
                    .and_then(serde_json::Value::as_i64)
                    .unwrap_or(0) as i32,
                is_collapsible: sec
                    .get("is_collapsible")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(true),
                is_default_open: sec
                    .get("is_default_open")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(true),
                icon: sec.get("icon").and_then(|v| v.as_str()).map(String::from),
                color: sec.get("color").and_then(|v| v.as_str()).map(String::from),
                fields,
            }
        })
        .collect();

    ResolvedFormDefinition {
        form_code: snap.name.clone(),
        form_name: snap.name.clone(),
        version: snap.version,
        config: snap.config.clone(),
        sections,
    }
}

// ── Helpers ────────────────────────────────────────────────

/// Merge two JSONB validation objects (override values take precedence).
fn merge_validation(
    base: Option<serde_json::Value>,
    override_val: serde_json::Value,
) -> serde_json::Value {
    match base {
        Some(serde_json::Value::Object(mut base_map)) => {
            if let serde_json::Value::Object(ovr_map) = override_val {
                for (k, v) in ovr_map {
                    base_map.insert(k, v);
                }
            }
            serde_json::Value::Object(base_map)
        }
        _ => override_val,
    }
}

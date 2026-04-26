use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_core::form::{FieldMasterAuditEntry, FormVersionSnapshot, FormVersionSummary};
use medbrains_core::permissions;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
    validation::{self, ValidationErrors},
};

// ── Draft Guard ──────────────────────────────────────────

/// Returns `Err(Conflict)` if the form is not in draft status.
async fn require_draft_form(db: &PgPool, form_id: Uuid) -> Result<(), AppError> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status::text FROM form_masters WHERE id = $1")
            .bind(form_id)
            .fetch_optional(db)
            .await?;

    let Some(status) = status else {
        return Err(AppError::NotFound);
    };

    if status != "draft" {
        return Err(AppError::Conflict(
            "Cannot modify an active or deprecated form. Create a new version first.".to_owned(),
        ));
    }
    Ok(())
}

/// Build a JSONB snapshot of the current form state (sections + fields + field master data).
async fn build_form_snapshot(db: &PgPool, form_id: Uuid) -> Result<serde_json::Value, AppError> {
    #[derive(Debug, sqlx::FromRow, Serialize)]
    struct SnapshotFieldRow {
        ff_id: Uuid,
        field_id: Uuid,
        section_id: Uuid,
        field_code: String,
        field_name: String,
        data_type: String,
        sort_order: i32,
        label_override: Option<String>,
        is_quick_mode: bool,
        icon: Option<String>,
        icon_position: Option<String>,
        fm_placeholder: Option<String>,
        fm_validation: Option<serde_json::Value>,
        fm_ui_width: Option<String>,
        fm_data_source: Option<serde_json::Value>,
        fm_actions: Option<serde_json::Value>,
    }

    let sections = sqlx::query_as::<_, SectionRow>(
        "SELECT id, code, name, sort_order, is_collapsible, is_default_open, icon, color \
         FROM form_sections WHERE form_id = $1 ORDER BY sort_order",
    )
    .bind(form_id)
    .fetch_all(db)
    .await?;

    let fields = sqlx::query_as::<_, SnapshotFieldRow>(
        "SELECT ff.id AS ff_id, ff.field_id, ff.section_id, \
                fm.code AS field_code, fm.name AS field_name, \
                fm.data_type::text AS data_type, ff.sort_order, \
                ff.label_override, ff.is_quick_mode, ff.icon, ff.icon_position, \
                fm.placeholder AS fm_placeholder, fm.validation AS fm_validation, \
                fm.ui_width AS fm_ui_width, \
                fm.data_source AS fm_data_source, fm.actions AS fm_actions \
         FROM form_fields ff \
         JOIN field_masters fm ON fm.id = ff.field_id \
         WHERE ff.form_id = $1 \
         ORDER BY ff.section_id, ff.sort_order",
    )
    .bind(form_id)
    .fetch_all(db)
    .await?;

    let section_json: Vec<serde_json::Value> = sections
        .iter()
        .map(|sec| {
            let sec_fields: Vec<serde_json::Value> = fields
                .iter()
                .filter(|f| f.section_id == sec.id)
                .map(|f| {
                    serde_json::json!({
                        "ff_id": f.ff_id,
                        "field_id": f.field_id,
                        "field_code": f.field_code,
                        "field_name": f.field_name,
                        "data_type": f.data_type,
                        "sort_order": f.sort_order,
                        "label_override": f.label_override,
                        "is_quick_mode": f.is_quick_mode,
                        "icon": f.icon,
                        "icon_position": f.icon_position,
                        "field_master_snapshot": {
                            "placeholder": f.fm_placeholder,
                            "validation": f.fm_validation,
                            "ui_width": f.fm_ui_width,
                            "data_source": f.fm_data_source,
                            "actions": f.fm_actions,
                        }
                    })
                })
                .collect();
            serde_json::json!({
                "id": sec.id,
                "code": sec.code,
                "name": sec.name,
                "sort_order": sec.sort_order,
                "is_collapsible": sec.is_collapsible,
                "is_default_open": sec.is_default_open,
                "icon": sec.icon,
                "color": sec.color,
                "fields": sec_fields,
            })
        })
        .collect();

    Ok(serde_json::json!({ "sections": section_json }))
}

// ── Shared Row Types ──────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FormMasterRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub version: i32,
    pub status: String,
    pub config: Option<serde_json::Value>,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub published_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FieldMasterFullRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub data_type: String,
    pub default_value: Option<String>,
    pub placeholder: Option<String>,
    pub validation: Option<serde_json::Value>,
    pub ui_component: Option<String>,
    pub ui_width: Option<String>,
    pub fhir_path: Option<String>,
    pub db_table: Option<String>,
    pub db_column: Option<String>,
    pub condition: Option<serde_json::Value>,
    pub is_system: bool,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FieldRegulatoryLinkRow {
    pub id: Uuid,
    pub regulatory_body_id: Uuid,
    pub body_code: String,
    pub body_name: String,
    pub requirement_level: String,
    pub clause_reference: Option<String>,
    pub clause_code: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FieldDetailResponse {
    pub field: FieldMasterFullRow,
    pub regulatory_links: Vec<FieldRegulatoryLinkRow>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FormFieldWithMasterRow {
    pub ff_id: Uuid,
    pub field_id: Uuid,
    pub field_code: String,
    pub field_name: String,
    pub data_type: String,
    pub sort_order: i32,
    pub label_override: Option<String>,
    pub is_quick_mode: bool,
    pub icon: Option<String>,
    pub icon_position: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SectionRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_collapsible: bool,
    pub is_default_open: bool,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SectionWithFields {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub sort_order: i32,
    pub is_collapsible: bool,
    pub is_default_open: bool,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub fields: Vec<FormFieldWithMasterRow>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ModuleFormLinkRow {
    pub module_code: String,
    pub form_id: Uuid,
    pub context: String,
    pub form_code: String,
    pub form_name: String,
}

#[derive(Debug, Serialize)]
pub struct FormDetailResponse {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub version: i32,
    pub status: String,
    pub config: Option<serde_json::Value>,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub published_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub sections: Vec<SectionWithFields>,
    pub module_links: Vec<ModuleFormLinkRow>,
}

// ── Forms CRUD ────────────────────────────────────────────

pub async fn list_all_forms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FormMasterRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let rows = sqlx::query_as::<_, FormMasterRow>(
        "SELECT id, code, name, version, status::text, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters ORDER BY code, version DESC",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[allow(clippy::too_many_lines)]
pub async fn get_form_detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormDetailResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let form = sqlx::query_as::<_, FormMasterRow>(
        "SELECT id, code, name, version, status::text, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(form) = form else {
        return Err(AppError::NotFound);
    };

    let sections = sqlx::query_as::<_, SectionRow>(
        "SELECT id, code, name, sort_order, is_collapsible, is_default_open, icon, color \
         FROM form_sections WHERE form_id = $1 ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let fields = sqlx::query_as::<_, FormFieldWithMasterRow>(
        "SELECT ff.id AS ff_id, ff.field_id, fm.code AS field_code, fm.name AS field_name, \
                fm.data_type::text AS data_type, ff.sort_order, ff.label_override, ff.is_quick_mode, \
                ff.icon, ff.icon_position \
         FROM form_fields ff \
         JOIN field_masters fm ON fm.id = ff.field_id \
         WHERE ff.form_id = $1 \
         ORDER BY ff.section_id, ff.sort_order",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    // Get section_id for each form_field to group them
    let field_section_ids: Vec<(Uuid, Uuid)> =
        sqlx::query_as("SELECT id, section_id FROM form_fields WHERE form_id = $1")
            .bind(id)
            .fetch_all(&state.db)
            .await?;

    let mut ff_to_section: std::collections::HashMap<Uuid, Uuid> = std::collections::HashMap::new();
    for (ff_id, section_id) in &field_section_ids {
        ff_to_section.insert(*ff_id, *section_id);
    }

    let module_links = sqlx::query_as::<_, ModuleFormLinkRow>(
        "SELECT mfl.module_code, mfl.form_id, mfl.context, \
                fm.code AS form_code, fm.name AS form_name \
         FROM module_form_links mfl \
         JOIN form_masters fm ON fm.id = mfl.form_id \
         WHERE mfl.form_id = $1 ORDER BY mfl.module_code",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    // Group fields under sections
    let sections_with_fields: Vec<SectionWithFields> = sections
        .into_iter()
        .map(|sec| {
            let sec_fields: Vec<FormFieldWithMasterRow> = fields
                .iter()
                .filter(|f| ff_to_section.get(&f.ff_id) == Some(&sec.id))
                .map(|f| FormFieldWithMasterRow {
                    ff_id: f.ff_id,
                    field_id: f.field_id,
                    field_code: f.field_code.clone(),
                    field_name: f.field_name.clone(),
                    data_type: f.data_type.clone(),
                    sort_order: f.sort_order,
                    label_override: f.label_override.clone(),
                    is_quick_mode: f.is_quick_mode,
                    icon: f.icon.clone(),
                    icon_position: f.icon_position.clone(),
                })
                .collect();
            SectionWithFields {
                id: sec.id,
                code: sec.code,
                name: sec.name,
                sort_order: sec.sort_order,
                is_collapsible: sec.is_collapsible,
                is_default_open: sec.is_default_open,
                icon: sec.icon,
                color: sec.color,
                fields: sec_fields,
            }
        })
        .collect();

    Ok(Json(FormDetailResponse {
        id: form.id,
        code: form.code,
        name: form.name,
        version: form.version,
        status: form.status,
        config: form.config,
        published_at: form.published_at,
        published_by: form.published_by,
        created_at: form.created_at,
        updated_at: form.updated_at,
        sections: sections_with_fields,
        module_links,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateFormRequest {
    pub code: String,
    pub name: String,
    pub status: Option<String>,
    pub config: Option<serde_json::Value>,
}

pub async fn create_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFormRequest>,
) -> Result<Json<FormMasterRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let mut errors = ValidationErrors::new();
    validation::validate_form_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    validation::validate_no_html(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let status = body.status.as_deref().unwrap_or("draft");

    // If setting to active, check for existing active form with same code
    if status == "active" {
        let existing: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM form_masters WHERE code = $1 AND status = 'active'")
                .bind(&body.code)
                .fetch_optional(&state.db)
                .await?;

        if existing.is_some() {
            return Err(AppError::Conflict(format!(
                "An active form with code '{}' already exists",
                body.code
            )));
        }
    }

    let row = sqlx::query_as::<_, FormMasterRow>(
        "INSERT INTO form_masters (code, name, status, config) \
         VALUES ($1, $2, $3::form_status, $4) \
         RETURNING id, code, name, version, status::text, config, \
                   published_at, published_by, created_at, updated_at",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(status)
    .bind(&body.config)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFormRequest {
    pub name: Option<String>,
    pub status: Option<String>,
    pub config: Option<serde_json::Value>,
}

pub async fn update_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFormRequest>,
) -> Result<Json<FormMasterRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    // Prevent name/config changes on active forms (status changes still allowed for deprecation)
    if body.name.is_some() || body.config.is_some() {
        require_draft_form(&state.db, id).await?;
    }

    let mut errors = ValidationErrors::new();
    if let Some(ref name) = body.name {
        validation::validate_name(&mut errors, "name", name);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    // If activating, check for existing active with same code
    if body.status.as_deref() == Some("active") {
        let form_code: Option<String> =
            sqlx::query_scalar("SELECT code FROM form_masters WHERE id = $1")
                .bind(id)
                .fetch_optional(&state.db)
                .await?;

        let Some(code) = form_code else {
            return Err(AppError::NotFound);
        };

        let existing: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM form_masters WHERE code = $1 AND status = 'active' AND id != $2",
        )
        .bind(&code)
        .bind(id)
        .fetch_optional(&state.db)
        .await?;

        if existing.is_some() {
            return Err(AppError::Conflict(format!(
                "An active form with code '{code}' already exists"
            )));
        }
    }

    let row = sqlx::query_as::<_, FormMasterRow>(
        "UPDATE form_masters SET \
            name = COALESCE($1, name), \
            status = COALESCE($2::form_status, status), \
            config = COALESCE($3, config), \
            updated_at = now() \
         WHERE id = $4 \
         RETURNING id, code, name, version, status::text, config, \
                   published_at, published_by, created_at, updated_at",
    )
    .bind(&body.name)
    .bind(&body.status)
    .bind(&body.config)
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    Ok(Json(row))
}

// ── Fields CRUD ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListFieldsParams {
    pub search: Option<String>,
}

pub async fn list_all_fields(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFieldsParams>,
) -> Result<Json<Vec<FieldMasterFullRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let rows = if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        sqlx::query_as::<_, FieldMasterFullRow>(
            "SELECT id, code, name, description, data_type::text, default_value, placeholder, \
                    validation, ui_component, ui_width, fhir_path, db_table, db_column, \
                    condition, is_system, is_active, created_at, updated_at \
             FROM field_masters \
             WHERE code ILIKE $1 OR name ILIKE $1 \
             ORDER BY code",
        )
        .bind(&pattern)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, FieldMasterFullRow>(
            "SELECT id, code, name, description, data_type::text, default_value, placeholder, \
                    validation, ui_component, ui_width, fhir_path, db_table, db_column, \
                    condition, is_system, is_active, created_at, updated_at \
             FROM field_masters ORDER BY code",
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(rows))
}

pub async fn get_field_detail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FieldDetailResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let field = sqlx::query_as::<_, FieldMasterFullRow>(
        "SELECT id, code, name, description, data_type::text, default_value, placeholder, \
                validation, ui_component, ui_width, fhir_path, db_table, db_column, \
                condition, is_system, is_active, created_at, updated_at \
         FROM field_masters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(field) = field else {
        return Err(AppError::NotFound);
    };

    let regulatory_links = sqlx::query_as::<_, FieldRegulatoryLinkRow>(
        "SELECT frl.id, frl.regulatory_body_id, rb.code AS body_code, rb.name AS body_name, \
                frl.requirement_level::text, frl.clause_reference, frl.clause_code, frl.description \
         FROM field_regulatory_links frl \
         JOIN regulatory_bodies rb ON rb.id = frl.regulatory_body_id \
         WHERE frl.field_id = $1 \
         ORDER BY rb.code",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(FieldDetailResponse {
        field,
        regulatory_links,
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateFieldRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub data_type: String,
    pub default_value: Option<String>,
    pub placeholder: Option<String>,
    pub validation: Option<serde_json::Value>,
    pub ui_component: Option<String>,
    pub ui_width: Option<String>,
    pub fhir_path: Option<String>,
    pub db_table: Option<String>,
    pub db_column: Option<String>,
}

pub async fn create_field(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFieldRequest>,
) -> Result<Json<FieldMasterFullRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let mut errors = ValidationErrors::new();
    validation::validate_form_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    validation::validate_no_html(&mut errors, "name", &body.name);
    if let Some(ref desc) = body.description {
        validation::validate_no_html(&mut errors, "description", desc);
    }
    if let Some(ref ph) = body.placeholder {
        validation::validate_no_html(&mut errors, "placeholder", ph);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, FieldMasterFullRow>(
        "INSERT INTO field_masters (code, name, description, data_type, default_value, \
            placeholder, validation, ui_component, ui_width, fhir_path, db_table, db_column) \
         VALUES ($1, $2, $3, $4::field_data_type, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING id, code, name, description, data_type::text, default_value, placeholder, \
                   validation, ui_component, ui_width, fhir_path, db_table, db_column, \
                   condition, is_system, is_active, created_at, updated_at",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.data_type)
    .bind(&body.default_value)
    .bind(&body.placeholder)
    .bind(&body.validation)
    .bind(&body.ui_component)
    .bind(&body.ui_width)
    .bind(&body.fhir_path)
    .bind(&body.db_table)
    .bind(&body.db_column)
    .fetch_one(&state.db)
    .await?;

    // Audit log
    let new_state = serde_json::json!({
        "code": row.code, "name": row.name, "data_type": row.data_type,
        "description": body.description, "placeholder": body.placeholder,
        "validation": body.validation, "ui_width": body.ui_width,
    });
    sqlx::query(
        "INSERT INTO field_master_audit_log (field_id, action, new_state, changed_by) \
         VALUES ($1, 'created', $2, $3)",
    )
    .bind(row.id)
    .bind(&new_state)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFieldRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub data_type: Option<String>,
    pub validation: Option<serde_json::Value>,
    pub default_value: Option<String>,
    pub placeholder: Option<String>,
    pub ui_component: Option<String>,
    pub ui_width: Option<String>,
    pub is_active: Option<bool>,
}

#[allow(clippy::too_many_lines)]
pub async fn update_field(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFieldRequest>,
) -> Result<Json<FieldMasterFullRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let mut errors = ValidationErrors::new();
    if let Some(ref name) = body.name {
        validation::validate_name(&mut errors, "name", name);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    // Capture previous state for audit
    let prev = sqlx::query_as::<_, FieldMasterFullRow>(
        "SELECT id, code, name, description, data_type::text, default_value, placeholder, \
                validation, ui_component, ui_width, fhir_path, db_table, db_column, \
                condition, is_system, is_active, created_at, updated_at \
         FROM field_masters WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(prev) = prev else {
        return Err(AppError::NotFound);
    };

    let row = sqlx::query_as::<_, FieldMasterFullRow>(
        "UPDATE field_masters SET \
            name = COALESCE($1, name), \
            description = COALESCE($2, description), \
            data_type = COALESCE($3::field_data_type, data_type), \
            validation = COALESCE($4, validation), \
            default_value = COALESCE($5, default_value), \
            placeholder = COALESCE($6, placeholder), \
            ui_component = COALESCE($7, ui_component), \
            ui_width = COALESCE($8, ui_width), \
            is_active = COALESCE($9, is_active), \
            updated_at = now() \
         WHERE id = $10 \
         RETURNING id, code, name, description, data_type::text, default_value, placeholder, \
                   validation, ui_component, ui_width, fhir_path, db_table, db_column, \
                   condition, is_system, is_active, created_at, updated_at",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.data_type)
    .bind(&body.validation)
    .bind(&body.default_value)
    .bind(&body.placeholder)
    .bind(&body.ui_component)
    .bind(&body.ui_width)
    .bind(body.is_active)
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    // Determine changed fields
    let mut changed: Vec<String> = Vec::new();
    if body.name.is_some() && prev.name != row.name {
        changed.push("name".to_owned());
    }
    if body.description.is_some() && prev.description != row.description {
        changed.push("description".to_owned());
    }
    if body.data_type.is_some() && prev.data_type != row.data_type {
        changed.push("data_type".to_owned());
    }
    if body.validation.is_some() && prev.validation != row.validation {
        changed.push("validation".to_owned());
    }
    if body.default_value.is_some() && prev.default_value != row.default_value {
        changed.push("default_value".to_owned());
    }
    if body.placeholder.is_some() && prev.placeholder != row.placeholder {
        changed.push("placeholder".to_owned());
    }
    if body.ui_component.is_some() && prev.ui_component != row.ui_component {
        changed.push("ui_component".to_owned());
    }
    if body.ui_width.is_some() && prev.ui_width != row.ui_width {
        changed.push("ui_width".to_owned());
    }
    if body.is_active.is_some() && prev.is_active != row.is_active {
        changed.push("is_active".to_owned());
    }

    if !changed.is_empty() {
        let previous_state = serde_json::json!({
            "name": prev.name, "description": prev.description,
            "data_type": prev.data_type, "validation": prev.validation,
            "default_value": prev.default_value, "placeholder": prev.placeholder,
            "ui_component": prev.ui_component, "ui_width": prev.ui_width,
            "is_active": prev.is_active,
        });
        let new_state = serde_json::json!({
            "name": row.name, "description": row.description,
            "data_type": row.data_type, "validation": row.validation,
            "default_value": row.default_value, "placeholder": row.placeholder,
            "ui_component": row.ui_component, "ui_width": row.ui_width,
            "is_active": row.is_active,
        });
        sqlx::query(
            "INSERT INTO field_master_audit_log \
                (field_id, action, previous_state, new_state, changed_fields, changed_by) \
             VALUES ($1, 'updated', $2, $3, $4, $5)",
        )
        .bind(id)
        .bind(&previous_state)
        .bind(&new_state)
        .bind(&changed)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;
    }

    Ok(Json(row))
}

// ── Sections CRUD ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateSectionRequest {
    pub code: String,
    pub name: String,
    pub sort_order: Option<i32>,
    pub is_collapsible: Option<bool>,
    pub is_default_open: Option<bool>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

pub async fn create_section(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
    Json(body): Json<CreateSectionRequest>,
) -> Result<Json<SectionRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, form_id).await?;

    let mut errors = ValidationErrors::new();
    validation::validate_form_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    // Auto sort_order = max+1 if not provided
    let sort_order = if let Some(so) = body.sort_order {
        so
    } else {
        let max_so: Option<i32> =
            sqlx::query_scalar("SELECT MAX(sort_order) FROM form_sections WHERE form_id = $1")
                .bind(form_id)
                .fetch_optional(&state.db)
                .await?
                .flatten();
        max_so.unwrap_or(0) + 1
    };

    let row = sqlx::query_as::<_, SectionRow>(
        "INSERT INTO form_sections (form_id, code, name, sort_order, is_collapsible, is_default_open, icon, color) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, code, name, sort_order, is_collapsible, is_default_open, icon, color",
    )
    .bind(form_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(sort_order)
    .bind(body.is_collapsible.unwrap_or(true))
    .bind(body.is_default_open.unwrap_or(true))
    .bind(&body.icon)
    .bind(&body.color)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSectionRequest {
    pub name: Option<String>,
    pub is_collapsible: Option<bool>,
    pub is_default_open: Option<bool>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FormSectionPath {
    pub form_id: Uuid,
    pub id: Uuid,
}

pub async fn update_section(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<FormSectionPath>,
    Json(body): Json<UpdateSectionRequest>,
) -> Result<Json<SectionRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, path.form_id).await?;

    let row = sqlx::query_as::<_, SectionRow>(
        "UPDATE form_sections SET \
            name = COALESCE($1, name), \
            is_collapsible = COALESCE($2, is_collapsible), \
            is_default_open = COALESCE($3, is_default_open), \
            icon = COALESCE($4, icon), \
            color = COALESCE($5, color) \
         WHERE id = $6 AND form_id = $7 \
         RETURNING id, code, name, sort_order, is_collapsible, is_default_open, icon, color",
    )
    .bind(&body.name)
    .bind(body.is_collapsible)
    .bind(body.is_default_open)
    .bind(&body.icon)
    .bind(&body.color)
    .bind(path.id)
    .bind(path.form_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    Ok(Json(row))
}

pub async fn delete_section(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<FormSectionPath>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, path.form_id).await?;

    let result = sqlx::query("DELETE FROM form_sections WHERE id = $1 AND form_id = $2")
        .bind(path.id)
        .bind(path.form_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Debug, Deserialize)]
pub struct ReorderItem {
    pub id: Uuid,
    pub sort_order: i32,
}

pub async fn reorder_sections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
    Json(items): Json<Vec<ReorderItem>>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, form_id).await?;

    let mut tx = state.db.begin().await?;

    for item in &items {
        sqlx::query("UPDATE form_sections SET sort_order = $1 WHERE id = $2 AND form_id = $3")
            .bind(item.sort_order)
            .bind(item.id)
            .bind(form_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Form Fields (field-to-section linking) ────────────────

#[derive(Debug, Deserialize)]
pub struct AddFieldToFormRequest {
    pub field_id: Uuid,
    pub section_id: Uuid,
    pub sort_order: Option<i32>,
    pub label_override: Option<String>,
    pub is_quick_mode: Option<bool>,
    pub icon: Option<String>,
    pub icon_position: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FormFieldRow {
    pub id: Uuid,
    pub form_id: Uuid,
    pub section_id: Uuid,
    pub field_id: Uuid,
    pub sort_order: i32,
    pub label_override: Option<String>,
    pub is_quick_mode: bool,
    pub icon: Option<String>,
    pub icon_position: Option<String>,
}

pub async fn add_field_to_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
    Json(body): Json<AddFieldToFormRequest>,
) -> Result<Json<FormFieldRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, form_id).await?;

    let sort_order = if let Some(so) = body.sort_order {
        so
    } else {
        let max_so: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(sort_order) FROM form_fields WHERE form_id = $1 AND section_id = $2",
        )
        .bind(form_id)
        .bind(body.section_id)
        .fetch_optional(&state.db)
        .await?
        .flatten();
        max_so.unwrap_or(0) + 1
    };

    let row = sqlx::query_as::<_, FormFieldRow>(
        "INSERT INTO form_fields (form_id, section_id, field_id, sort_order, label_override, is_quick_mode, icon, icon_position) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, form_id, section_id, field_id, sort_order, label_override, is_quick_mode, icon, icon_position",
    )
    .bind(form_id)
    .bind(body.section_id)
    .bind(body.field_id)
    .bind(sort_order)
    .bind(&body.label_override)
    .bind(body.is_quick_mode.unwrap_or(false))
    .bind(&body.icon)
    .bind(body.icon_position.as_deref().unwrap_or("left"))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateFormFieldRequest {
    pub label_override: Option<String>,
    pub is_quick_mode: Option<bool>,
    pub section_id: Option<Uuid>,
    pub icon: Option<String>,
    pub icon_position: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FormFieldPath {
    pub form_id: Uuid,
    pub ff_id: Uuid,
}

pub async fn update_form_field(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<FormFieldPath>,
    Json(body): Json<UpdateFormFieldRequest>,
) -> Result<Json<FormFieldRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, path.form_id).await?;

    let row = sqlx::query_as::<_, FormFieldRow>(
        "UPDATE form_fields SET \
            label_override = COALESCE($1, label_override), \
            is_quick_mode = COALESCE($2, is_quick_mode), \
            section_id = COALESCE($3, section_id), \
            icon = COALESCE($4, icon), \
            icon_position = COALESCE($5, icon_position) \
         WHERE id = $6 AND form_id = $7 \
         RETURNING id, form_id, section_id, field_id, sort_order, label_override, is_quick_mode, icon, icon_position",
    )
    .bind(&body.label_override)
    .bind(body.is_quick_mode)
    .bind(body.section_id)
    .bind(&body.icon)
    .bind(&body.icon_position)
    .bind(path.ff_id)
    .bind(path.form_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    Ok(Json(row))
}

pub async fn remove_field_from_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<FormFieldPath>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, path.form_id).await?;

    let result = sqlx::query("DELETE FROM form_fields WHERE id = $1 AND form_id = $2")
        .bind(path.ff_id)
        .bind(path.form_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

pub async fn reorder_fields(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
    Json(items): Json<Vec<ReorderItem>>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, form_id).await?;

    let mut tx = state.db.begin().await?;

    for item in &items {
        sqlx::query("UPDATE form_fields SET sort_order = $1 WHERE id = $2 AND form_id = $3")
            .bind(item.sort_order)
            .bind(item.id)
            .bind(form_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Regulatory Clauses (browse all) ───────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RegulatoryClauseWithContext {
    pub id: Uuid,
    pub field_id: Uuid,
    pub field_code: String,
    pub field_name: String,
    pub regulatory_body_id: Uuid,
    pub body_code: String,
    pub body_name: String,
    pub body_level: String,
    pub requirement_level: String,
    pub clause_reference: Option<String>,
    pub clause_code: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRegulatoryClausesParams {
    pub field_id: Option<Uuid>,
    pub body_code: Option<String>,
    pub search: Option<String>,
}

pub async fn list_regulatory_clauses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRegulatoryClausesParams>,
) -> Result<Json<Vec<RegulatoryClauseWithContext>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    // Build dynamic query with optional filters
    let mut sql = String::from(
        "SELECT frl.id, frl.field_id, fm.code AS field_code, fm.name AS field_name, \
                frl.regulatory_body_id, rb.code AS body_code, rb.name AS body_name, \
                rb.level::text AS body_level, frl.requirement_level::text, \
                frl.clause_reference, frl.clause_code, frl.description \
         FROM field_regulatory_links frl \
         JOIN field_masters fm ON fm.id = frl.field_id \
         JOIN regulatory_bodies rb ON rb.id = frl.regulatory_body_id \
         WHERE 1=1",
    );

    // We'll use positional params ($1, $2, etc.) built dynamically
    let mut bind_idx = 0u32;
    let mut conditions: Vec<String> = Vec::new();

    if params.field_id.is_some() {
        bind_idx += 1;
        conditions.push(format!(" AND frl.field_id = ${bind_idx}"));
    }
    if params.body_code.is_some() {
        bind_idx += 1;
        conditions.push(format!(" AND rb.code = ${bind_idx}"));
    }
    if params.search.is_some() {
        bind_idx += 1;
        conditions.push(format!(
            " AND (frl.clause_code ILIKE ${bind_idx} \
             OR frl.clause_reference ILIKE ${bind_idx} \
             OR frl.description ILIKE ${bind_idx} \
             OR rb.code ILIKE ${bind_idx} \
             OR fm.name ILIKE ${bind_idx})"
        ));
    }

    for cond in &conditions {
        sql.push_str(cond);
    }
    sql.push_str(" ORDER BY rb.code, fm.code");

    let mut query = sqlx::query_as::<_, RegulatoryClauseWithContext>(&sql);

    if let Some(ref field_id) = params.field_id {
        query = query.bind(field_id);
    }
    if let Some(ref body_code) = params.body_code {
        query = query.bind(body_code);
    }
    if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        query = query.bind(pattern);
    }

    let rows = query.fetch_all(&state.db).await?;

    Ok(Json(rows))
}

// ── Module Form Links ─────────────────────────────────────

pub async fn list_module_links(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ModuleFormLinkRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let rows = sqlx::query_as::<_, ModuleFormLinkRow>(
        "SELECT mfl.module_code, mfl.form_id, mfl.context, \
                fm.code AS form_code, fm.name AS form_name \
         FROM module_form_links mfl \
         JOIN form_masters fm ON fm.id = mfl.form_id \
         ORDER BY mfl.module_code, mfl.context",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateModuleLinkRequest {
    pub module_code: String,
    pub form_id: Uuid,
    pub context: Option<String>,
}

pub async fn create_module_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateModuleLinkRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let context = body.context.as_deref().unwrap_or("primary");

    sqlx::query(
        "INSERT INTO module_form_links (module_code, form_id, context) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (module_code, form_id, context) DO NOTHING",
    )
    .bind(&body.module_code)
    .bind(body.form_id)
    .bind(context)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Debug, Deserialize)]
pub struct ModuleLinkPath {
    pub module_code: String,
    pub form_id: Uuid,
    pub context: String,
}

pub async fn delete_module_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<ModuleLinkPath>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let result = sqlx::query(
        "DELETE FROM module_form_links \
         WHERE module_code = $1 AND form_id = $2 AND context = $3",
    )
    .bind(&path.module_code)
    .bind(path.form_id)
    .bind(&path.context)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Regulatory Bodies CRUD ────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RegulatoryBodyRow {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub level: String,
    pub country_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_regulatory_bodies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RegulatoryBodyRow>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let rows = sqlx::query_as::<_, RegulatoryBodyRow>(
        "SELECT id, code, name, level::text, country_id, state_id, \
                description, is_active, created_at, updated_at \
         FROM regulatory_bodies \
         ORDER BY level, name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRegulatoryBodyRequest {
    pub code: String,
    pub name: String,
    pub level: String,
    pub country_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub description: Option<String>,
}

pub async fn create_regulatory_body(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRegulatoryBodyRequest>,
) -> Result<Json<RegulatoryBodyRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let mut errors = ValidationErrors::new();
    validation::validate_form_code(&mut errors, "code", &body.code);
    validation::validate_name(&mut errors, "name", &body.name);
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, RegulatoryBodyRow>(
        "INSERT INTO regulatory_bodies (code, name, level, country_id, state_id, description) \
         VALUES ($1, $2, $3::regulatory_level, $4, $5, $6) \
         RETURNING id, code, name, level::text, country_id, state_id, \
                   description, is_active, created_at, updated_at",
    )
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.level)
    .bind(body.country_id)
    .bind(body.state_id)
    .bind(&body.description)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegulatoryBodyRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

pub async fn update_regulatory_body(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRegulatoryBodyRequest>,
) -> Result<Json<RegulatoryBodyRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let mut errors = ValidationErrors::new();
    if let Some(ref name) = body.name {
        validation::validate_name(&mut errors, "name", name);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let row = sqlx::query_as::<_, RegulatoryBodyRow>(
        "UPDATE regulatory_bodies SET \
            name = COALESCE($1, name), \
            description = COALESCE($2, description), \
            is_active = COALESCE($3, is_active), \
            updated_at = now() \
         WHERE id = $4 \
         RETURNING id, code, name, level::text, country_id, state_id, \
                   description, is_active, created_at, updated_at",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(body.is_active)
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    Ok(Json(row))
}

// ── Regulatory Links CRUD ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateRegulatoryLinkRequest {
    pub field_id: Uuid,
    pub regulatory_body_id: Uuid,
    pub requirement_level: String,
    pub clause_reference: Option<String>,
    pub clause_code: Option<String>,
    pub description: Option<String>,
}

pub async fn create_regulatory_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRegulatoryLinkRequest>,
) -> Result<Json<FieldRegulatoryLinkRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let row = sqlx::query_as::<_, FieldRegulatoryLinkRow>(
        "INSERT INTO field_regulatory_links \
            (field_id, regulatory_body_id, requirement_level, \
             clause_reference, clause_code, description) \
         VALUES ($1, $2, $3::requirement_level, $4, $5, $6) \
         RETURNING id, regulatory_body_id, \
            (SELECT code FROM regulatory_bodies WHERE id = $2) AS body_code, \
            (SELECT name FROM regulatory_bodies WHERE id = $2) AS body_name, \
            requirement_level::text, clause_reference, clause_code, description",
    )
    .bind(body.field_id)
    .bind(body.regulatory_body_id)
    .bind(&body.requirement_level)
    .bind(&body.clause_reference)
    .bind(&body.clause_code)
    .bind(&body.description)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegulatoryLinkRequest {
    pub requirement_level: Option<String>,
    pub clause_reference: Option<String>,
    pub clause_code: Option<String>,
    pub description: Option<String>,
}

pub async fn update_regulatory_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRegulatoryLinkRequest>,
) -> Result<Json<FieldRegulatoryLinkRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let row = sqlx::query_as::<_, FieldRegulatoryLinkRow>(
        "UPDATE field_regulatory_links SET \
            requirement_level = COALESCE($1::requirement_level, requirement_level), \
            clause_reference = COALESCE($2, clause_reference), \
            clause_code = COALESCE($3, clause_code), \
            description = COALESCE($4, description) \
         WHERE id = $5 \
         RETURNING id, regulatory_body_id, \
            (SELECT code FROM regulatory_bodies \
             WHERE id = field_regulatory_links.regulatory_body_id) AS body_code, \
            (SELECT name FROM regulatory_bodies \
             WHERE id = field_regulatory_links.regulatory_body_id) AS body_name, \
            requirement_level::text, clause_reference, clause_code, description",
    )
    .bind(&body.requirement_level)
    .bind(&body.clause_reference)
    .bind(&body.clause_code)
    .bind(&body.description)
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    Ok(Json(row))
}

pub async fn delete_regulatory_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let result = sqlx::query("DELETE FROM field_regulatory_links WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ── Form Versioning Endpoints ─────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PublishFormRequest {
    pub change_summary: Option<String>,
}

#[allow(clippy::too_many_lines)]
pub async fn publish_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
    Json(body): Json<PublishFormRequest>,
) -> Result<Json<FormMasterRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;
    require_draft_form(&state.db, form_id).await?;

    // Verify form has at least 1 section with at least 1 field
    let field_count: Option<i64> =
        sqlx::query_scalar("SELECT COUNT(*) FROM form_fields WHERE form_id = $1")
            .bind(form_id)
            .fetch_one(&state.db)
            .await?;

    if field_count.unwrap_or(0) == 0 {
        return Err(AppError::BadRequest(
            "Cannot publish a form with no fields. Add at least one field to a section.".to_owned(),
        ));
    }

    let section_count: Option<i64> =
        sqlx::query_scalar("SELECT COUNT(*) FROM form_sections WHERE form_id = $1")
            .bind(form_id)
            .fetch_one(&state.db)
            .await?;

    if section_count.unwrap_or(0) == 0 {
        return Err(AppError::BadRequest(
            "Cannot publish a form with no sections.".to_owned(),
        ));
    }

    // Get current form info
    let form = sqlx::query_as::<_, FormMasterRow>(
        "SELECT id, code, name, version, status::text, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters WHERE id = $1",
    )
    .bind(form_id)
    .fetch_one(&state.db)
    .await?;

    // Build snapshot
    let snapshot = build_form_snapshot(&state.db, form_id).await?;

    // Insert version snapshot
    sqlx::query(
        "INSERT INTO form_version_snapshots \
            (form_id, version, name, status, config, snapshot, change_summary, created_by) \
         VALUES ($1, $2, $3, 'active'::form_status, $4, $5, $6, $7)",
    )
    .bind(form_id)
    .bind(form.version)
    .bind(&form.name)
    .bind(&form.config)
    .bind(&snapshot)
    .bind(&body.change_summary)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    // Update form to active
    let row = sqlx::query_as::<_, FormMasterRow>(
        "UPDATE form_masters SET \
            status = 'active'::form_status, \
            published_at = now(), \
            published_by = $1, \
            updated_at = now() \
         WHERE id = $2 \
         RETURNING id, code, name, version, status::text, config, \
                   published_at, published_by, created_at, updated_at",
    )
    .bind(claims.sub)
    .bind(form_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

pub async fn create_new_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
) -> Result<Json<FormMasterRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    // Must be active to create a new version
    let status: Option<String> =
        sqlx::query_scalar("SELECT status::text FROM form_masters WHERE id = $1")
            .bind(form_id)
            .fetch_optional(&state.db)
            .await?;

    let Some(status) = status else {
        return Err(AppError::NotFound);
    };

    if status != "active" {
        return Err(AppError::Conflict(
            "Only active forms can have new versions. This form is not active.".to_owned(),
        ));
    }

    // Ensure current version is snapshotted
    let form = sqlx::query_as::<_, FormMasterRow>(
        "SELECT id, code, name, version, status::text, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters WHERE id = $1",
    )
    .bind(form_id)
    .fetch_one(&state.db)
    .await?;

    let existing_snapshot: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM form_version_snapshots WHERE form_id = $1 AND version = $2",
    )
    .bind(form_id)
    .bind(form.version)
    .fetch_optional(&state.db)
    .await?;

    if existing_snapshot.is_none() {
        let snapshot = build_form_snapshot(&state.db, form_id).await?;
        sqlx::query(
            "INSERT INTO form_version_snapshots \
                (form_id, version, name, status, config, snapshot, created_by) \
             VALUES ($1, $2, $3, 'active'::form_status, $4, $5, $6)",
        )
        .bind(form_id)
        .bind(form.version)
        .bind(&form.name)
        .bind(&form.config)
        .bind(&snapshot)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;
    }

    // Bump version, set to draft
    let row = sqlx::query_as::<_, FormMasterRow>(
        "UPDATE form_masters SET \
            version = version + 1, \
            status = 'draft'::form_status, \
            published_at = NULL, \
            published_by = NULL, \
            updated_at = now() \
         WHERE id = $1 \
         RETURNING id, code, name, version, status::text, config, \
                   published_at, published_by, created_at, updated_at",
    )
    .bind(form_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(row))
}

pub async fn list_form_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
) -> Result<Json<Vec<FormVersionSummary>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let rows = sqlx::query_as::<_, FormVersionSummary>(
        "SELECT fvs.id, fvs.form_id, fvs.version, fvs.name, fvs.status, fvs.config, \
                fvs.change_summary, fvs.created_by, u.full_name AS created_by_name, \
                fvs.created_at \
         FROM form_version_snapshots fvs \
         LEFT JOIN users u ON u.id = fvs.created_by \
         WHERE fvs.form_id = $1 \
         ORDER BY fvs.version DESC",
    )
    .bind(form_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct VersionPath {
    pub form_id: Uuid,
    pub version: i32,
}

pub async fn get_form_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<VersionPath>,
) -> Result<Json<FormVersionSnapshot>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let row = sqlx::query_as::<_, FormVersionSnapshot>(
        "SELECT id, form_id, version, name, status, config, snapshot, \
                change_summary, created_by, created_at \
         FROM form_version_snapshots \
         WHERE form_id = $1 AND version = $2",
    )
    .bind(path.form_id)
    .bind(path.version)
    .fetch_optional(&state.db)
    .await?;

    let Some(row) = row else {
        return Err(AppError::NotFound);
    };

    Ok(Json(row))
}

#[allow(clippy::too_many_lines)]
pub async fn restore_form_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(path): Path<VersionPath>,
) -> Result<Json<FormMasterRow>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    // If the form is active, snapshot current state first
    let form = sqlx::query_as::<_, FormMasterRow>(
        "SELECT id, code, name, version, status::text, config, \
                published_at, published_by, created_at, updated_at \
         FROM form_masters WHERE id = $1",
    )
    .bind(path.form_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(form) = form else {
        return Err(AppError::NotFound);
    };

    if form.status == "active" {
        let existing: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM form_version_snapshots WHERE form_id = $1 AND version = $2",
        )
        .bind(path.form_id)
        .bind(form.version)
        .fetch_optional(&state.db)
        .await?;

        if existing.is_none() {
            let snapshot = build_form_snapshot(&state.db, path.form_id).await?;
            sqlx::query(
                "INSERT INTO form_version_snapshots \
                    (form_id, version, name, status, config, snapshot, created_by) \
                 VALUES ($1, $2, $3, 'active'::form_status, $4, $5, $6)",
            )
            .bind(path.form_id)
            .bind(form.version)
            .bind(&form.name)
            .bind(&form.config)
            .bind(&snapshot)
            .bind(claims.sub)
            .execute(&state.db)
            .await?;
        }
    }

    // Load target snapshot
    let target = sqlx::query_as::<_, FormVersionSnapshot>(
        "SELECT id, form_id, version, name, status, config, snapshot, \
                change_summary, created_by, created_at \
         FROM form_version_snapshots WHERE form_id = $1 AND version = $2",
    )
    .bind(path.form_id)
    .bind(path.version)
    .fetch_optional(&state.db)
    .await?;

    let Some(target) = target else {
        return Err(AppError::NotFound);
    };

    // Find max version
    let max_version: Option<i32> =
        sqlx::query_scalar("SELECT MAX(version) FROM form_version_snapshots WHERE form_id = $1")
            .bind(path.form_id)
            .fetch_one(&state.db)
            .await?;

    let new_version = std::cmp::max(max_version.unwrap_or(form.version) + 1, form.version + 1);

    // Delete current sections/fields and recreate from snapshot
    let mut tx = state.db.begin().await?;

    sqlx::query("DELETE FROM form_fields WHERE form_id = $1")
        .bind(path.form_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM form_sections WHERE form_id = $1")
        .bind(path.form_id)
        .execute(&mut *tx)
        .await?;

    // Recreate from snapshot
    if let Some(sections) = target.snapshot.get("sections").and_then(|s| s.as_array()) {
        for sec in sections {
            let sec_code = sec.get("code").and_then(|v| v.as_str()).unwrap_or("");
            let sec_name = sec.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let sort_order = sec
                .get("sort_order")
                .and_then(serde_json::Value::as_i64)
                .unwrap_or(0);
            let is_collapsible = sec
                .get("is_collapsible")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(true);
            let is_default_open = sec
                .get("is_default_open")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(true);
            let icon = sec.get("icon").and_then(|v| v.as_str());
            let color = sec.get("color").and_then(|v| v.as_str());

            #[allow(clippy::cast_possible_truncation)]
            let new_sec_id: Uuid = sqlx::query_scalar(
                "INSERT INTO form_sections \
                    (form_id, code, name, sort_order, is_collapsible, is_default_open, icon, color) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
            )
            .bind(path.form_id)
            .bind(sec_code)
            .bind(sec_name)
            .bind(sort_order as i32)
            .bind(is_collapsible)
            .bind(is_default_open)
            .bind(icon)
            .bind(color)
            .fetch_one(&mut *tx)
            .await?;

            if let Some(fields_arr) = sec.get("fields").and_then(|v| v.as_array()) {
                for field in fields_arr {
                    let field_id_str = field.get("field_id").and_then(|v| v.as_str()).unwrap_or("");
                    let field_id = Uuid::parse_str(field_id_str).unwrap_or_default();
                    let f_sort = field
                        .get("sort_order")
                        .and_then(serde_json::Value::as_i64)
                        .unwrap_or(0);
                    let label_ov = field.get("label_override").and_then(|v| v.as_str());
                    let is_qm = field
                        .get("is_quick_mode")
                        .and_then(serde_json::Value::as_bool)
                        .unwrap_or(false);
                    let f_icon = field.get("icon").and_then(|v| v.as_str());
                    let f_icon_pos = field.get("icon_position").and_then(|v| v.as_str());

                    #[allow(clippy::cast_possible_truncation)]
                    sqlx::query(
                        "INSERT INTO form_fields \
                            (form_id, section_id, field_id, sort_order, label_override, \
                             is_quick_mode, icon, icon_position) \
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                    )
                    .bind(path.form_id)
                    .bind(new_sec_id)
                    .bind(field_id)
                    .bind(f_sort as i32)
                    .bind(label_ov)
                    .bind(is_qm)
                    .bind(f_icon)
                    .bind(f_icon_pos)
                    .execute(&mut *tx)
                    .await?;
                }
            }
        }
    }

    // Update form: new version, draft, restore name/config
    let row = sqlx::query_as::<_, FormMasterRow>(
        "UPDATE form_masters SET \
            version = $1, \
            name = $2, \
            config = $3, \
            status = 'draft'::form_status, \
            published_at = NULL, \
            published_by = NULL, \
            updated_at = now() \
         WHERE id = $4 \
         RETURNING id, code, name, version, status::text, config, \
                   published_at, published_by, created_at, updated_at",
    )
    .bind(new_version)
    .bind(&target.name)
    .bind(&target.config)
    .bind(path.form_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(row))
}

// ── Form Diff ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DiffParams {
    pub v1: i32,
    pub v2: i32,
}

#[derive(Debug, Serialize)]
pub struct FormDiffResponse {
    pub v1: i32,
    pub v2: i32,
    pub config_changes: Vec<PropertyChange>,
    pub section_changes: Vec<SectionChange>,
    pub summary: DiffSummary,
}

#[derive(Debug, Serialize)]
pub struct PropertyChange {
    pub property: String,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SectionChange {
    pub code: String,
    pub name: String,
    pub change_type: String, // "added", "removed", "modified"
    pub field_changes: Vec<FieldChange>,
}

#[derive(Debug, Serialize)]
pub struct FieldChange {
    pub field_code: String,
    pub field_name: String,
    pub change_type: String, // "added", "removed", "modified", "moved"
    pub property_changes: Vec<PropertyChange>,
}

#[derive(Debug, Serialize)]
pub struct DiffSummary {
    pub sections_added: u32,
    pub sections_removed: u32,
    pub sections_modified: u32,
    pub fields_added: u32,
    pub fields_removed: u32,
    pub fields_modified: u32,
}

pub async fn diff_form_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_id): Path<Uuid>,
    Query(params): Query<DiffParams>,
) -> Result<Json<FormDiffResponse>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    // Load snapshots (version 0 = current live state)
    let snap1 = if params.v1 == 0 {
        build_form_snapshot(&state.db, form_id).await?
    } else {
        let row = sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT snapshot FROM form_version_snapshots WHERE form_id = $1 AND version = $2",
        )
        .bind(form_id)
        .bind(params.v1)
        .fetch_optional(&state.db)
        .await?;
        row.ok_or(AppError::NotFound)?
    };

    let snap2 = if params.v2 == 0 {
        build_form_snapshot(&state.db, form_id).await?
    } else {
        let row = sqlx::query_scalar::<_, serde_json::Value>(
            "SELECT snapshot FROM form_version_snapshots WHERE form_id = $1 AND version = $2",
        )
        .bind(form_id)
        .bind(params.v2)
        .fetch_optional(&state.db)
        .await?;
        row.ok_or(AppError::NotFound)?
    };

    let diff = compute_snapshot_diff(&snap1, &snap2);

    Ok(Json(FormDiffResponse {
        v1: params.v1,
        v2: params.v2,
        config_changes: diff.config_changes,
        section_changes: diff.section_changes,
        summary: diff.summary,
    }))
}

struct DiffResult {
    config_changes: Vec<PropertyChange>,
    section_changes: Vec<SectionChange>,
    summary: DiffSummary,
}

#[allow(clippy::too_many_lines)]
fn compute_snapshot_diff(snap1: &serde_json::Value, snap2: &serde_json::Value) -> DiffResult {
    let empty_arr = Vec::new();
    let sections1 = snap1
        .get("sections")
        .and_then(|s| s.as_array())
        .unwrap_or(&empty_arr);
    let sections2 = snap2
        .get("sections")
        .and_then(|s| s.as_array())
        .unwrap_or(&empty_arr);

    let mut summary = DiffSummary {
        sections_added: 0,
        sections_removed: 0,
        sections_modified: 0,
        fields_added: 0,
        fields_removed: 0,
        fields_modified: 0,
    };

    // Index sections by code
    let sec1_map: std::collections::HashMap<&str, &serde_json::Value> = sections1
        .iter()
        .filter_map(|s| s.get("code").and_then(|c| c.as_str()).map(|c| (c, s)))
        .collect();
    let sec2_map: std::collections::HashMap<&str, &serde_json::Value> = sections2
        .iter()
        .filter_map(|s| s.get("code").and_then(|c| c.as_str()).map(|c| (c, s)))
        .collect();

    let mut section_changes = Vec::new();

    // Removed sections (in v1 but not v2)
    for (code, sec) in &sec1_map {
        if !sec2_map.contains_key(code) {
            summary.sections_removed += 1;
            let fields = sec
                .get("fields")
                .and_then(|f| f.as_array())
                .unwrap_or(&empty_arr);
            summary.fields_removed += fields.len() as u32;
            section_changes.push(SectionChange {
                code: (*code).to_owned(),
                name: sec
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_owned(),
                change_type: "removed".to_owned(),
                field_changes: vec![],
            });
        }
    }

    // Added and modified sections
    for (code, sec2) in &sec2_map {
        if let Some(sec1) = sec1_map.get(code) {
            // Potentially modified — compare fields
            let fields1 = sec1
                .get("fields")
                .and_then(|f| f.as_array())
                .unwrap_or(&empty_arr);
            let fields2 = sec2
                .get("fields")
                .and_then(|f| f.as_array())
                .unwrap_or(&empty_arr);

            let f1_map: std::collections::HashMap<&str, &serde_json::Value> = fields1
                .iter()
                .filter_map(|f| f.get("field_code").and_then(|c| c.as_str()).map(|c| (c, f)))
                .collect();
            let f2_map: std::collections::HashMap<&str, &serde_json::Value> = fields2
                .iter()
                .filter_map(|f| f.get("field_code").and_then(|c| c.as_str()).map(|c| (c, f)))
                .collect();

            let mut field_changes = Vec::new();

            for (fc, f1) in &f1_map {
                if !f2_map.contains_key(fc) {
                    summary.fields_removed += 1;
                    field_changes.push(FieldChange {
                        field_code: (*fc).to_owned(),
                        field_name: f1
                            .get("field_name")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                            .to_owned(),
                        change_type: "removed".to_owned(),
                        property_changes: vec![],
                    });
                }
            }

            for (fc, f2) in &f2_map {
                if let Some(f1) = f1_map.get(fc) {
                    // Compare properties
                    let props = ["sort_order", "label_override", "is_quick_mode"];
                    let mut pchanges = Vec::new();
                    for prop in &props {
                        let v1 = f1.get(*prop);
                        let v2 = f2.get(*prop);
                        if v1 != v2 {
                            pchanges.push(PropertyChange {
                                property: (*prop).to_owned(),
                                old_value: v1.cloned(),
                                new_value: v2.cloned(),
                            });
                        }
                    }
                    if !pchanges.is_empty() {
                        summary.fields_modified += 1;
                        field_changes.push(FieldChange {
                            field_code: (*fc).to_owned(),
                            field_name: f2
                                .get("field_name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("")
                                .to_owned(),
                            change_type: "modified".to_owned(),
                            property_changes: pchanges,
                        });
                    }
                } else {
                    summary.fields_added += 1;
                    field_changes.push(FieldChange {
                        field_code: (*fc).to_owned(),
                        field_name: f2
                            .get("field_name")
                            .and_then(|n| n.as_str())
                            .unwrap_or("")
                            .to_owned(),
                        change_type: "added".to_owned(),
                        property_changes: vec![],
                    });
                }
            }

            if !field_changes.is_empty() {
                summary.sections_modified += 1;
                section_changes.push(SectionChange {
                    code: (*code).to_owned(),
                    name: sec2
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("")
                        .to_owned(),
                    change_type: "modified".to_owned(),
                    field_changes,
                });
            }
        } else {
            summary.sections_added += 1;
            let fields = sec2
                .get("fields")
                .and_then(|f| f.as_array())
                .unwrap_or(&empty_arr);
            summary.fields_added += fields.len() as u32;
            section_changes.push(SectionChange {
                code: (*code).to_owned(),
                name: sec2
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_owned(),
                change_type: "added".to_owned(),
                field_changes: vec![],
            });
        }
    }

    DiffResult {
        config_changes: vec![],
        section_changes,
        summary,
    }
}

// ── Field Audit Log Endpoint ──────────────────────────────

pub async fn get_field_audit_log(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(field_id): Path<Uuid>,
) -> Result<Json<Vec<FieldMasterAuditEntry>>, AppError> {
    require_permission(&claims, permissions::admin::settings::forms::MANAGE)?;

    let rows = sqlx::query_as::<_, FieldMasterAuditEntry>(
        "SELECT fmal.id, fmal.field_id, fmal.action, fmal.previous_state, fmal.new_state, \
                fmal.changed_fields, fmal.changed_by, u.full_name AS changed_by_name, \
                fmal.changed_at \
         FROM field_master_audit_log fmal \
         LEFT JOIN users u ON u.id = fmal.changed_by \
         WHERE fmal.field_id = $1 \
         ORDER BY fmal.changed_at DESC",
    )
    .bind(field_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

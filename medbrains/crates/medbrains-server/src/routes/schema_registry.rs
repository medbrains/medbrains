use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::{
    integration::{EventSchema, ModuleEntitySchema},
    permissions,
};
use serde::Serialize;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ── Response Types ──────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ModuleSummary {
    pub module_code: String,
    pub label: String,
}

// ── GET /api/schema/modules ─────────────────────────────

pub async fn list_modules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ModuleSummary>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT DISTINCT module_code, \
         MIN(entity_label) AS label \
         FROM module_entity_schemas \
         GROUP BY module_code \
         ORDER BY module_code",
    )
    .fetch_all(&state.db)
    .await?;

    let modules = rows
        .into_iter()
        .map(|(module_code, _first_entity)| {
            let display = module_code.chars().next().map_or_else(String::new, |c| {
                c.to_uppercase().to_string() + &module_code[1..]
            });
            ModuleSummary {
                label: display,
                module_code,
            }
        })
        .collect();

    Ok(Json(modules))
}

// ── GET /api/schema/modules/{code}/entities ──────────────

pub async fn list_module_entities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<Vec<ModuleEntitySchema>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let entities = sqlx::query_as::<_, ModuleEntitySchema>(
        "SELECT * FROM module_entity_schemas \
         WHERE module_code = $1 \
         ORDER BY entity_label",
    )
    .bind(&code)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(entities))
}

// ── GET /api/schema/events ──────────────────────────────

pub async fn list_event_schemas(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<EventSchema>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let events = sqlx::query_as::<_, EventSchema>(
        "SELECT * FROM event_schemas ORDER BY module_code, event_type",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(events))
}

// ── GET /api/schema/events/{event_type} ─────────────────

pub async fn get_event_schema(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(event_type): Path<String>,
) -> Result<Json<EventSchema>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let schema =
        sqlx::query_as::<_, EventSchema>("SELECT * FROM event_schemas WHERE event_type = $1")
            .bind(&event_type)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    Ok(Json(schema))
}

// ── GET /api/schema/form-fields/{form_code} ─────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FormFieldSchemaItem {
    pub path: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub field_type: String,
    pub label: String,
    pub description: Option<String>,
}

pub async fn get_form_field_schema(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(form_code): Path<String>,
) -> Result<Json<Vec<FormFieldSchemaItem>>, AppError> {
    require_permission(&claims, permissions::integration::LIST)?;

    let fields = sqlx::query_as::<_, FormFieldSchemaItem>(
        "SELECT fm.code AS path, \
                fm.data_type::text AS type, \
                fm.name AS label, \
                fm.description \
         FROM form_fields ff \
         JOIN field_masters fm ON fm.id = ff.field_master_id \
         JOIN form_masters fom ON fom.id = ff.form_id \
         WHERE fom.code = $1 \
         ORDER BY ff.section_id, ff.sort_order",
    )
    .bind(&form_code)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(fields))
}

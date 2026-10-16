//! Form templates: a hospital builds or customises a form, edits a draft,
//! and publishes numbered versions that never change. Staff fill in the live
//! version; a form never customised falls back to the built-in one.

use axum::{
    Extension, Json,
    extract::{Path, State},
    routing::{get, post},
};
use medbrains_core::form_template::{
    FormDefinition, FormTemplate, FormTemplateVersion, LiveForm, built_in, check_answers,
    check_definition,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

const COLUMNS: &str =
    "id, code, name, module, draft, published_version, status, created_at, updated_at";

fn parse(def: &Value) -> Result<FormDefinition, AppError> {
    serde_json::from_value(def.clone())
        .map_err(|e| AppError::BadRequest(format!("The form is not in the expected shape: {e}")))
}

/// The version staff fill in now for `code`, or the built-in form. `None`
/// when the code is neither published here nor built in.
pub async fn live_form(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code: &str,
) -> Result<Option<LiveForm>, AppError> {
    let row: Option<(Uuid, i32, Value)> = sqlx::query_as(
        "SELECT v.id, v.version, v.definition FROM form_templates t \
           JOIN form_template_versions v ON v.template_id = t.id AND v.version = t.published_version \
          WHERE t.tenant_id = $1 AND t.code = $2 AND t.status = 'published' AND t.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some((id, version, definition)) = row {
        let definition = parse(&definition)?;
        return Ok(Some(LiveForm {
            code: code.to_owned(),
            version_id: Some(id),
            version: Some(version),
            definition,
        }));
    }
    Ok(built_in(code).map(|(_, _, definition)| LiveForm {
        code: code.to_owned(),
        version_id: None,
        version: None,
        definition,
    }))
}

/// Answers checked against the version they were given for (any published
/// version of `code`, or the built-in form when `version_id` is none).
/// Returns the clean answers, the version number, and the definition.
pub async fn check_submission(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    code: &str,
    version_id: Option<Uuid>,
    answers: &Map<String, Value>,
) -> Result<(Map<String, Value>, Option<i32>, FormDefinition), AppError> {
    let (definition, version) = match version_id {
        None => (
            built_in(code)
                .map(|(_, _, d)| d)
                .ok_or(AppError::NotFound)?,
            None,
        ),
        Some(id) => {
            let row: Option<(i32, Value)> = sqlx::query_as(
                "SELECT v.version, v.definition FROM form_template_versions v \
                   JOIN form_templates t ON t.id = v.template_id \
                  WHERE v.id = $1 AND v.tenant_id = $2 AND t.code = $3",
            )
            .bind(id)
            .bind(tenant_id)
            .bind(code)
            .fetch_optional(&mut **tx)
            .await?;
            let (version, def) = row.ok_or_else(|| {
                AppError::BadRequest("That form version is not one of this hospital's".to_owned())
            })?;
            (parse(&def)?, Some(version))
        }
    };
    let clean = check_answers(&definition, answers).map_err(|problems| {
        let mut list: Vec<String> = problems.into_values().collect();
        list.sort();
        AppError::BadRequest(list.join("; "))
    })?;
    Ok((clean, version, definition))
}

#[derive(Debug, Serialize)]
pub struct TemplateListItem {
    pub id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub module: String,
    pub status: String,
    pub published_version: Option<i32>,
    pub built_in: bool,
}

async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TemplateListItem>>, AppError> {
    require_permission(&claims, permissions::forms::templates::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, FormTemplate>(&format!(
        "SELECT {COLUMNS} FROM form_templates WHERE tenant_id = $1 AND deleted_at IS NULL \
         ORDER BY name LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let mut items: Vec<TemplateListItem> = rows
        .into_iter()
        .map(|t| TemplateListItem {
            built_in: built_in(&t.code).is_some(),
            id: Some(t.id),
            code: t.code,
            name: t.name,
            module: t.module,
            status: t.status,
            published_version: t.published_version,
        })
        .collect();
    // A built-in form the hospital has not customised is still listed: it is
    // what staff fill in, and the place to start customising it.
    for &code in medbrains_core::form_template::BUILT_IN_CODES {
        if let (false, Some((name, module, _))) =
            (items.iter().any(|i| i.code == code), built_in(code))
        {
            items.push(TemplateListItem {
                id: None,
                code: code.to_owned(),
                name: name.to_owned(),
                module: module.to_owned(),
                status: "built_in".to_owned(),
                published_version: None,
                built_in: true,
            });
        }
    }
    Ok(Json(items))
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplate {
    pub code: String,
    pub name: String,
    pub module: String,
}

async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplate>,
) -> Result<Json<FormTemplate>, AppError> {
    require_permission(&claims, permissions::forms::templates::MANAGE)?;
    let (name, module) = (body.name.trim(), body.module.trim());
    if name.is_empty() || module.is_empty() {
        return Err(AppError::BadRequest(
            "A form needs a name and a module".to_owned(),
        ));
    }
    // Customising a built-in form starts from it, not from a blank page.
    let draft = built_in(&body.code).map(|(_, _, d)| d).unwrap_or_default();
    let draft = serde_json::to_value(draft).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, FormTemplate>(&format!(
        "INSERT INTO form_templates (tenant_id, code, name, module, draft, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING {COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.code.trim())
    .bind(name)
    .bind(module)
    .bind(draft)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(d) if d.is_unique_violation() => {
            AppError::Conflict("A form with that code already exists".to_owned())
        }
        sqlx::Error::Database(d) if d.is_check_violation() => AppError::BadRequest(
            "The code must start with a letter and use only a-z, 0-9 and _".to_owned(),
        ),
        other => other.into(),
    })?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize)]
pub struct TemplateDetail {
    pub template: FormTemplate,
    pub versions: Vec<FormTemplateVersion>,
}

async fn fetch(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    id: Uuid,
) -> Result<FormTemplate, AppError> {
    sqlx::query_as::<_, FormTemplate>(&format!(
        "SELECT {COLUMNS} FROM form_templates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
    ))
    .bind(id)
    .bind(tenant)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateDetail>, AppError> {
    require_permission(&claims, permissions::forms::templates::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let template = fetch(&mut tx, claims.tenant_id, id).await?;
    let versions = sqlx::query_as::<_, FormTemplateVersion>(
        "SELECT id, template_id, version, definition, published_by, published_at \
           FROM form_template_versions WHERE template_id = $1 AND tenant_id = $2 \
          ORDER BY version DESC LIMIT 200",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(TemplateDetail { template, versions }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateDraft {
    pub name: String,
    pub draft: FormDefinition,
}

async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDraft>,
) -> Result<Json<FormTemplate>, AppError> {
    require_permission(&claims, permissions::forms::templates::MANAGE)?;
    check_definition(&body.draft, false).map_err(AppError::BadRequest)?;
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("A form needs a name".to_owned()));
    }
    let draft = serde_json::to_value(&body.draft).map_err(|e| AppError::Internal(e.to_string()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // A retired form may be edited and published again to bring it back.
    fetch(&mut tx, claims.tenant_id, id).await?;
    let row = sqlx::query_as::<_, FormTemplate>(&format!(
        "UPDATE form_templates SET name = $1, draft = $2 \
          WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL RETURNING {COLUMNS}"
    ))
    .bind(body.name.trim())
    .bind(draft)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

async fn publish_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormTemplateVersion>, AppError> {
    require_permission(&claims, permissions::forms::templates::PUBLISH)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Locked, so two publishes at once cannot both take the same number.
    let template = sqlx::query_as::<_, FormTemplate>(&format!(
        "SELECT {COLUMNS} FROM form_templates WHERE id = $1 AND tenant_id = $2 \
           AND deleted_at IS NULL FOR UPDATE"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    check_definition(&parse(&template.draft)?, true).map_err(AppError::BadRequest)?;
    let next = template.published_version.unwrap_or(0) + 1;
    let version = sqlx::query_as::<_, FormTemplateVersion>(
        "INSERT INTO form_template_versions (tenant_id, template_id, version, definition, published_by) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, template_id, version, definition, published_by, published_at",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(next)
    .bind(&template.draft)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE form_templates SET published_version = $1, status = 'published' \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(next)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(version))
}

/// Staff stop being given this form; a built-in form takes over again.
/// Records already taken keep their version.
async fn retire_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormTemplate>, AppError> {
    require_permission(&claims, permissions::forms::templates::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, FormTemplate>(&format!(
        "UPDATE form_templates SET status = 'retired' \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING {COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

async fn get_live_form(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<LiveForm>, AppError> {
    require_permission(&claims, permissions::forms::definitions::READ)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let live = live_form(&mut tx, claims.tenant_id, &code).await?;
    tx.commit().await?;
    live.map(Json).ok_or(AppError::NotFound)
}

/// One published version, to show a record against the questions it was
/// answered on.
async fn get_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<FormTemplateVersion>, AppError> {
    require_permission(&claims, permissions::forms::definitions::READ)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, FormTemplateVersion>(
        "SELECT id, template_id, version, definition, published_by, published_at \
           FROM form_template_versions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Form template routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/forms/templates",
            get(list_templates).post(create_template),
        )
        .route(
            "/api/forms/templates/{id}",
            get(get_template).put(update_template),
        )
        .route("/api/forms/templates/{id}/publish", post(publish_template))
        .route("/api/forms/templates/{id}/retire", post(retire_template))
        .route("/api/forms/live/{code}", get(get_live_form))
        .route("/api/forms/versions/{id}", get(get_version))
}

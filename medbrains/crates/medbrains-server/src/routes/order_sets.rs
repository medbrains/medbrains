#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use medbrains_core::order_set::{
    OrderSetActivation, OrderSetActivationItem, OrderSetTemplate, OrderSetTemplateItem,
    OrderSetUsageStats,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Templates ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub context: Option<String>,
    pub department_id: Option<Uuid>,
    pub search: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub context: String,
    pub department_id: Option<Uuid>,
    pub trigger_diagnoses: Option<Vec<String>>,
    pub surgery_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub context: Option<String>,
    pub department_id: Option<Uuid>,
    pub trigger_diagnoses: Option<Vec<String>>,
    pub surgery_type: Option<String>,
}

// ── Template Items ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AddItemRequest {
    pub item_type: String,
    pub sort_order: Option<i32>,
    pub is_mandatory: Option<bool>,
    pub default_selected: Option<bool>,
    // Lab
    pub lab_test_id: Option<Uuid>,
    pub lab_priority: Option<String>,
    pub lab_notes: Option<String>,
    // Medication
    pub drug_catalog_id: Option<Uuid>,
    pub drug_name: Option<String>,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub duration: Option<String>,
    pub route: Option<String>,
    pub med_instructions: Option<String>,
    // Nursing
    pub task_type: Option<String>,
    pub task_description: Option<String>,
    pub task_frequency: Option<String>,
    // Diet
    pub diet_template_id: Option<Uuid>,
    pub diet_type: Option<String>,
    pub diet_instructions: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemRequest {
    pub sort_order: Option<i32>,
    pub is_mandatory: Option<bool>,
    pub default_selected: Option<bool>,
    // Lab
    pub lab_test_id: Option<Uuid>,
    pub lab_priority: Option<String>,
    pub lab_notes: Option<String>,
    // Medication
    pub drug_catalog_id: Option<Uuid>,
    pub drug_name: Option<String>,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub duration: Option<String>,
    pub route: Option<String>,
    pub med_instructions: Option<String>,
    // Nursing
    pub task_type: Option<String>,
    pub task_description: Option<String>,
    pub task_frequency: Option<String>,
    // Diet
    pub diet_template_id: Option<Uuid>,
    pub diet_type: Option<String>,
    pub diet_instructions: Option<String>,
}

// ── Activation ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ActivateRequest {
    pub template_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub diagnosis_icd: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<ActivateItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct ActivateItemRequest {
    pub template_item_id: Uuid,
    pub selected: bool,
    pub skip_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ActivationResult {
    pub activation: OrderSetActivation,
    pub items_created: ActivationCounts,
}

#[derive(Debug, Serialize)]
pub struct ActivationCounts {
    pub lab_orders: i32,
    pub prescriptions: i32,
    pub nursing_tasks: i32,
    pub diet_orders: i32,
}

// ── Suggestions ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SuggestQuery {
    pub icd_code: Option<String>,
    pub context: Option<String>,
    pub department_id: Option<Uuid>,
}

// ── Activations list ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListActivationsQuery {
    pub encounter_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
}

// ── Analytics ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsSummary {
    pub total_templates: i64,
    pub total_activations: i64,
    pub unique_doctors: i64,
    pub avg_completion_rate: Decimal,
}

// ── Versions ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TemplateWithItems {
    pub template: OrderSetTemplate,
    pub items: Vec<OrderSetTemplateItem>,
}

#[derive(Debug, Serialize)]
pub struct ActivationWithItems {
    pub activation: OrderSetActivation,
    pub items: Vec<OrderSetActivationItem>,
}

// ── Helper FromRow ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
struct UniqueDoctorsRow {
    count: Option<i64>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Templates
// ══════════════════════════════════════════════════════════

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<OrderSetTemplate>>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OrderSetTemplate>(
        "SELECT * FROM order_set_templates \
         WHERE is_current = true \
         AND ($1::text IS NULL OR context::text = $1) \
         AND ($2::uuid IS NULL OR department_id = $2) \
         AND ($3::bool IS NULL OR is_active = $3) \
         AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%' OR code ILIKE '%' || $4 || '%') \
         ORDER BY name ASC LIMIT 200",
    )
    .bind(&params.context)
    .bind(params.department_id)
    .bind(params.is_active)
    .bind(&params.search)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateWithItems>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let template =
        sqlx::query_as::<_, OrderSetTemplate>("SELECT * FROM order_set_templates WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    let items = sqlx::query_as::<_, OrderSetTemplateItem>(
        "SELECT * FROM order_set_template_items WHERE template_id = $1 ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(TemplateWithItems { template, items }))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<OrderSetTemplate>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let diagnoses = body.trigger_diagnoses.unwrap_or_default();

    let row = sqlx::query_as::<_, OrderSetTemplate>(
        "INSERT INTO order_set_templates \
         (tenant_id, name, code, description, context, department_id, \
          trigger_diagnoses, surgery_type, created_by) \
         VALUES ($1, $2, $3, $4, $5::order_set_context, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(&body.description)
    .bind(&body.context)
    .bind(body.department_id)
    .bind(&diagnoses)
    .bind(&body.surgery_type)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateRequest>,
) -> Result<Json<OrderSetTemplate>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OrderSetTemplate>(
        "UPDATE order_set_templates SET \
         name = COALESCE($2, name), \
         code = COALESCE($3, code), \
         description = COALESCE($4, description), \
         context = COALESCE($5::order_set_context, context), \
         department_id = COALESCE($6, department_id), \
         trigger_diagnoses = COALESCE($7, trigger_diagnoses), \
         surgery_type = COALESCE($8, surgery_type) \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(&body.description)
    .bind(&body.context)
    .bind(body.department_id)
    .bind(&body.trigger_diagnoses)
    .bind(&body.surgery_type)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderSetTemplate>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OrderSetTemplate>(
        "UPDATE order_set_templates SET is_active = false WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Template Items
// ══════════════════════════════════════════════════════════

pub async fn add_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(template_id): Path<Uuid>,
    Json(body): Json<AddItemRequest>,
) -> Result<Json<OrderSetTemplateItem>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OrderSetTemplateItem>(
        "INSERT INTO order_set_template_items \
         (tenant_id, template_id, item_type, sort_order, is_mandatory, default_selected, \
          lab_test_id, lab_priority, lab_notes, \
          drug_catalog_id, drug_name, dosage, frequency, duration, route, med_instructions, \
          task_type, task_description, task_frequency, \
          diet_template_id, diet_type, diet_instructions) \
         VALUES ($1, $2, $3::order_set_item_type, COALESCE($4, 0), COALESCE($5, false), \
                 COALESCE($6, true), \
                 $7, $8, $9, \
                 $10, $11, $12, $13, $14, $15, $16, \
                 $17, $18, $19, \
                 $20, $21, $22) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(template_id)
    .bind(&body.item_type)
    .bind(body.sort_order)
    .bind(body.is_mandatory)
    .bind(body.default_selected)
    .bind(body.lab_test_id)
    .bind(&body.lab_priority)
    .bind(&body.lab_notes)
    .bind(body.drug_catalog_id)
    .bind(&body.drug_name)
    .bind(&body.dosage)
    .bind(&body.frequency)
    .bind(&body.duration)
    .bind(&body.route)
    .bind(&body.med_instructions)
    .bind(&body.task_type)
    .bind(&body.task_description)
    .bind(&body.task_frequency)
    .bind(body.diet_template_id)
    .bind(&body.diet_type)
    .bind(&body.diet_instructions)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((template_id, item_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateItemRequest>,
) -> Result<Json<OrderSetTemplateItem>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OrderSetTemplateItem>(
        "UPDATE order_set_template_items SET \
         sort_order = COALESCE($3, sort_order), \
         is_mandatory = COALESCE($4, is_mandatory), \
         default_selected = COALESCE($5, default_selected), \
         lab_test_id = COALESCE($6, lab_test_id), \
         lab_priority = COALESCE($7, lab_priority), \
         lab_notes = COALESCE($8, lab_notes), \
         drug_catalog_id = COALESCE($9, drug_catalog_id), \
         drug_name = COALESCE($10, drug_name), \
         dosage = COALESCE($11, dosage), \
         frequency = COALESCE($12, frequency), \
         duration = COALESCE($13, duration), \
         route = COALESCE($14, route), \
         med_instructions = COALESCE($15, med_instructions), \
         task_type = COALESCE($16, task_type), \
         task_description = COALESCE($17, task_description), \
         task_frequency = COALESCE($18, task_frequency), \
         diet_template_id = COALESCE($19, diet_template_id), \
         diet_type = COALESCE($20, diet_type), \
         diet_instructions = COALESCE($21, diet_instructions) \
         WHERE id = $1 AND template_id = $2 \
         RETURNING *",
    )
    .bind(item_id)
    .bind(template_id)
    .bind(body.sort_order)
    .bind(body.is_mandatory)
    .bind(body.default_selected)
    .bind(body.lab_test_id)
    .bind(&body.lab_priority)
    .bind(&body.lab_notes)
    .bind(body.drug_catalog_id)
    .bind(&body.drug_name)
    .bind(&body.dosage)
    .bind(&body.frequency)
    .bind(&body.duration)
    .bind(&body.route)
    .bind(&body.med_instructions)
    .bind(&body.task_type)
    .bind(&body.task_description)
    .bind(&body.task_frequency)
    .bind(body.diet_template_id)
    .bind(&body.diet_type)
    .bind(&body.diet_instructions)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((template_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM order_set_template_items WHERE id = $1 AND template_id = $2")
        .bind(item_id)
        .bind(template_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Versioning
// ══════════════════════════════════════════════════════════

pub async fn create_new_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateWithItems>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch current template
    let old = sqlx::query_as::<_, OrderSetTemplate>(
        "SELECT * FROM order_set_templates WHERE id = $1 AND is_current = true",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    // Mark old as not current
    sqlx::query("UPDATE order_set_templates SET is_current = false WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Create new version
    let new_version = old.version + 1;
    let new_template = sqlx::query_as::<_, OrderSetTemplate>(
        "INSERT INTO order_set_templates \
         (tenant_id, name, code, description, context, department_id, \
          trigger_diagnoses, surgery_type, version, is_current, parent_template_id, \
          created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11) \
         RETURNING *",
    )
    .bind(old.tenant_id)
    .bind(&old.name)
    .bind(&old.code)
    .bind(&old.description)
    .bind(old.context)
    .bind(old.department_id)
    .bind(&old.trigger_diagnoses)
    .bind(&old.surgery_type)
    .bind(new_version)
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Clone items from old template to new
    let old_items = sqlx::query_as::<_, OrderSetTemplateItem>(
        "SELECT * FROM order_set_template_items WHERE template_id = $1 ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    for item in &old_items {
        sqlx::query(
            "INSERT INTO order_set_template_items \
             (tenant_id, template_id, item_type, sort_order, is_mandatory, default_selected, \
              lab_test_id, lab_priority, lab_notes, \
              drug_catalog_id, drug_name, dosage, frequency, duration, route, med_instructions, \
              task_type, task_description, task_frequency, \
              diet_template_id, diet_type, diet_instructions) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, \
                     $17, $18, $19, $20, $21, $22)",
        )
        .bind(item.tenant_id)
        .bind(new_template.id)
        .bind(item.item_type)
        .bind(item.sort_order)
        .bind(item.is_mandatory)
        .bind(item.default_selected)
        .bind(item.lab_test_id)
        .bind(&item.lab_priority)
        .bind(&item.lab_notes)
        .bind(item.drug_catalog_id)
        .bind(&item.drug_name)
        .bind(&item.dosage)
        .bind(&item.frequency)
        .bind(&item.duration)
        .bind(&item.route)
        .bind(&item.med_instructions)
        .bind(&item.task_type)
        .bind(&item.task_description)
        .bind(&item.task_frequency)
        .bind(item.diet_template_id)
        .bind(&item.diet_type)
        .bind(&item.diet_instructions)
        .execute(&mut *tx)
        .await?;
    }

    // Re-fetch cloned items
    let new_items = sqlx::query_as::<_, OrderSetTemplateItem>(
        "SELECT * FROM order_set_template_items WHERE template_id = $1 ORDER BY sort_order",
    )
    .bind(new_template.id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(TemplateWithItems {
        template: new_template,
        items: new_items,
    }))
}

pub async fn approve_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OrderSetTemplate>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OrderSetTemplate>(
        "UPDATE order_set_templates SET approved_by = $2, approved_at = $3 \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(Utc::now())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<OrderSetTemplate>>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Walk the linked list: find all templates with the same root
    // First find the root (the one with no parent or the original)
    let rows = sqlx::query_as::<_, OrderSetTemplate>(
        "WITH RECURSIVE chain AS ( \
           SELECT * FROM order_set_templates WHERE id = $1 \
           UNION ALL \
           SELECT t.* FROM order_set_templates t \
           JOIN chain c ON t.parent_template_id = c.id \
         ) \
         SELECT * FROM chain \
         UNION \
         SELECT t2.* FROM order_set_templates t2 \
         WHERE t2.id = (SELECT parent_template_id FROM order_set_templates WHERE id = $1) \
         ORDER BY version DESC",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Suggestions
// ══════════════════════════════════════════════════════════

pub async fn suggest_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<SuggestQuery>,
) -> Result<Json<Vec<OrderSetTemplate>>, AppError> {
    require_permission(&claims, permissions::order_sets::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OrderSetTemplate>(
        "SELECT * FROM order_set_templates \
         WHERE is_current = true AND is_active = true \
         AND ( \
           ($1::text IS NOT NULL AND $1 = ANY(trigger_diagnoses)) \
           OR ($2::text IS NOT NULL AND context::text = $2) \
           OR ($3::uuid IS NOT NULL AND department_id = $3) \
         ) \
         ORDER BY name ASC LIMIT 50",
    )
    .bind(&params.icd_code)
    .bind(&params.context)
    .bind(params.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Activation Engine
// ══════════════════════════════════════════════════════════

pub async fn activate_order_set(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ActivateRequest>,
) -> Result<Json<ActivationResult>, AppError> {
    require_permission(&claims, permissions::order_sets::activation::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // 1. Fetch template + verify active/current
    let template = sqlx::query_as::<_, OrderSetTemplate>(
        "SELECT * FROM order_set_templates \
         WHERE id = $1 AND is_current = true AND is_active = true",
    )
    .bind(body.template_id)
    .fetch_one(&mut *tx)
    .await?;

    // 2. Fetch all template items
    let template_items = sqlx::query_as::<_, OrderSetTemplateItem>(
        "SELECT * FROM order_set_template_items WHERE template_id = $1 ORDER BY sort_order",
    )
    .bind(body.template_id)
    .fetch_all(&mut *tx)
    .await?;

    // 3. Validate mandatory items are selected
    for ti in &template_items {
        if ti.is_mandatory {
            let found = body.items.iter().find(|i| i.template_item_id == ti.id);
            if let Some(found) = found {
                if !found.selected {
                    return Err(AppError::BadRequest(format!(
                        "Mandatory item {} cannot be deselected",
                        ti.id
                    )));
                }
            }
        }
    }

    let total_items = i32::try_from(template_items.len()).unwrap_or(0);
    let selected_count =
        i32::try_from(body.items.iter().filter(|i| i.selected).count()).unwrap_or(0);

    // 4. Create activation record
    let activation = sqlx::query_as::<_, OrderSetActivation>(
        "INSERT INTO order_set_activations \
         (tenant_id, template_id, template_version, encounter_id, patient_id, \
          admission_id, activated_by, diagnosis_icd, total_items, selected_items, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.template_id)
    .bind(template.version)
    .bind(body.encounter_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(claims.sub)
    .bind(&body.diagnosis_icd)
    .bind(total_items)
    .bind(selected_count)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // 5. Create real orders for selected items
    let mut counts = ActivationCounts {
        lab_orders: 0,
        prescriptions: 0,
        nursing_tasks: 0,
        diet_orders: 0,
    };

    // Track if we already created a prescription for medication grouping
    let mut prescription_id: Option<Uuid> = None;

    for req_item in &body.items {
        let ti = template_items
            .iter()
            .find(|t| t.id == req_item.template_item_id);
        let Some(ti) = ti else { continue };

        let mut lab_order_id: Option<Uuid> = None;
        let mut rx_id: Option<Uuid> = None;
        let mut nursing_id: Option<Uuid> = None;
        let mut diet_id: Option<Uuid> = None;

        if req_item.selected {
            match ti.item_type {
                medbrains_core::order_set::OrderSetItemType::Lab => {
                    if let Some(test_id) = ti.lab_test_id {
                        let order: OrderIdRow = sqlx::query_as(
                            "INSERT INTO lab_orders \
                             (tenant_id, encounter_id, patient_id, test_id, status, \
                              priority, clinical_notes, ordered_by) \
                             VALUES ($1, $2, $3, $4, 'ordered', \
                                     COALESCE($5, 'routine'), $6, $7) \
                             RETURNING id",
                        )
                        .bind(claims.tenant_id)
                        .bind(body.encounter_id)
                        .bind(body.patient_id)
                        .bind(test_id)
                        .bind(&ti.lab_priority)
                        .bind(&ti.lab_notes)
                        .bind(claims.sub)
                        .fetch_one(&mut *tx)
                        .await?;
                        lab_order_id = Some(order.id);
                        counts.lab_orders += 1;
                    }
                }
                medbrains_core::order_set::OrderSetItemType::Medication => {
                    // Create one prescription per activation, add items to it
                    if prescription_id.is_none() {
                        let rx: OrderIdRow = sqlx::query_as(
                            "INSERT INTO prescriptions \
                             (tenant_id, encounter_id, patient_id, prescribed_by, status) \
                             VALUES ($1, $2, $3, $4, 'active') \
                             RETURNING id",
                        )
                        .bind(claims.tenant_id)
                        .bind(body.encounter_id)
                        .bind(body.patient_id)
                        .bind(claims.sub)
                        .fetch_one(&mut *tx)
                        .await?;
                        prescription_id = Some(rx.id);
                    }

                    if let Some(pid) = prescription_id {
                        sqlx::query(
                            "INSERT INTO prescription_items \
                             (tenant_id, prescription_id, drug_catalog_id, drug_name, \
                              dosage, frequency, duration, route, instructions) \
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                        )
                        .bind(claims.tenant_id)
                        .bind(pid)
                        .bind(ti.drug_catalog_id)
                        .bind(&ti.drug_name)
                        .bind(&ti.dosage)
                        .bind(&ti.frequency)
                        .bind(&ti.duration)
                        .bind(&ti.route)
                        .bind(&ti.med_instructions)
                        .execute(&mut *tx)
                        .await?;
                        rx_id = Some(pid);
                        counts.prescriptions += 1;
                    }
                }
                medbrains_core::order_set::OrderSetItemType::Nursing => {
                    if let Some(admission_id) = body.admission_id {
                        let task: OrderIdRow = sqlx::query_as(
                            "INSERT INTO nursing_tasks \
                             (tenant_id, admission_id, task_type, description, \
                              assigned_by, is_completed) \
                             VALUES ($1, $2, COALESCE($3, 'general'), $4, $5, false) \
                             RETURNING id",
                        )
                        .bind(claims.tenant_id)
                        .bind(admission_id)
                        .bind(&ti.task_type)
                        .bind(&ti.task_description)
                        .bind(claims.sub)
                        .fetch_one(&mut *tx)
                        .await?;
                        nursing_id = Some(task.id);
                        counts.nursing_tasks += 1;
                    }
                    // Skip nursing tasks if no admission (outpatient context)
                }
                medbrains_core::order_set::OrderSetItemType::Diet => {
                    let order: OrderIdRow = sqlx::query_as(
                        "INSERT INTO diet_orders \
                         (tenant_id, patient_id, diet_type, template_id, \
                          special_instructions, ordered_by) \
                         VALUES ($1, $2, COALESCE($3, 'regular'), $4, $5, $6) \
                         RETURNING id",
                    )
                    .bind(claims.tenant_id)
                    .bind(body.patient_id)
                    .bind(&ti.diet_type)
                    .bind(ti.diet_template_id)
                    .bind(&ti.diet_instructions)
                    .bind(claims.sub)
                    .fetch_one(&mut *tx)
                    .await?;
                    diet_id = Some(order.id);
                    counts.diet_orders += 1;
                }
            }
        }

        // 6. Create activation item record
        sqlx::query(
            "INSERT INTO order_set_activation_items \
             (tenant_id, activation_id, template_item_id, item_type, \
              was_selected, skip_reason, \
              lab_order_id, prescription_id, nursing_task_id, diet_order_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(claims.tenant_id)
        .bind(activation.id)
        .bind(ti.id)
        .bind(ti.item_type)
        .bind(req_item.selected)
        .bind(&req_item.skip_reason)
        .bind(lab_order_id)
        .bind(rx_id)
        .bind(nursing_id)
        .bind(diet_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(ActivationResult {
        activation,
        items_created: counts,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct OrderIdRow {
    id: Uuid,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Activations
// ══════════════════════════════════════════════════════════

pub async fn list_activations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListActivationsQuery>,
) -> Result<Json<Vec<OrderSetActivation>>, AppError> {
    require_permission(&claims, permissions::order_sets::activation::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OrderSetActivation>(
        "SELECT * FROM order_set_activations \
         WHERE ($1::uuid IS NULL OR encounter_id = $1) \
         AND ($2::uuid IS NULL OR patient_id = $2) \
         AND ($3::uuid IS NULL OR template_id = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(params.encounter_id)
    .bind(params.patient_id)
    .bind(params.template_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_activation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ActivationWithItems>, AppError> {
    require_permission(&claims, permissions::order_sets::activation::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let activation = sqlx::query_as::<_, OrderSetActivation>(
        "SELECT * FROM order_set_activations WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, OrderSetActivationItem>(
        "SELECT * FROM order_set_activation_items WHERE activation_id = $1",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(ActivationWithItems { activation, items }))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Analytics
// ══════════════════════════════════════════════════════════

pub async fn get_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(_params): Query<AnalyticsQuery>,
) -> Result<Json<AnalyticsSummary>, AppError> {
    require_permission(&claims, permissions::order_sets::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let templates = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*) as count FROM order_set_templates \
         WHERE is_current = true AND is_active = true",
    )
    .fetch_one(&mut *tx)
    .await?;

    let activations =
        sqlx::query_as::<_, CountRow>("SELECT COUNT(*) as count FROM order_set_activations")
            .fetch_one(&mut *tx)
            .await?;

    let doctors = sqlx::query_as::<_, UniqueDoctorsRow>(
        "SELECT COUNT(DISTINCT activated_by) as count FROM order_set_activations",
    )
    .fetch_one(&mut *tx)
    .await?;

    let total_act = activations.count.unwrap_or(0);
    let avg_completion = if total_act > 0 {
        let sum: SumRow = sqlx::query_as(
            "SELECT SUM(selected_items::numeric / NULLIF(total_items, 0) * 100) as total \
             FROM order_set_activations WHERE total_items > 0",
        )
        .fetch_one(&mut *tx)
        .await?;
        sum.total.unwrap_or_default() / Decimal::from(total_act)
    } else {
        Decimal::ZERO
    };

    tx.commit().await?;
    Ok(Json(AnalyticsSummary {
        total_templates: templates.count.unwrap_or(0),
        total_activations: total_act,
        unique_doctors: doctors.count.unwrap_or(0),
        avg_completion_rate: avg_completion,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct SumRow {
    total: Option<Decimal>,
}

pub async fn get_template_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(template_id): Path<Uuid>,
) -> Result<Json<Vec<OrderSetUsageStats>>, AppError> {
    require_permission(&claims, permissions::order_sets::analytics::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OrderSetUsageStats>(
        "SELECT * FROM order_set_usage_stats \
         WHERE template_id = $1 ORDER BY period_start DESC LIMIT 52",
    )
    .bind(template_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

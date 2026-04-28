#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::diet::{
    DietOrder, DietTemplate, KitchenAudit, KitchenInventory, KitchenMenu, KitchenMenuItem,
    MealCount, MealPreparation,
};
use medbrains_core::permissions;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub diet_type: Option<String>,
    pub description: Option<String>,
    pub calories_target: Option<i32>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub fiber_g: Option<f64>,
    pub sodium_mg: Option<f64>,
    pub restrictions: Option<serde_json::Value>,
    pub suitable_for: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub diet_type: Option<String>,
    pub description: Option<String>,
    pub calories_target: Option<i32>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub fiber_g: Option<f64>,
    pub sodium_mg: Option<f64>,
    pub restrictions: Option<serde_json::Value>,
    pub suitable_for: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDietOrderRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub diet_type: Option<String>,
    pub special_instructions: Option<String>,
    pub allergies_flagged: Option<serde_json::Value>,
    pub is_npo: Option<bool>,
    pub npo_reason: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub calories_target: Option<i32>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub preferences: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDietOrderRequest {
    pub diet_type: Option<String>,
    pub status: Option<String>,
    pub special_instructions: Option<String>,
    pub is_npo: Option<bool>,
    pub npo_reason: Option<String>,
    pub end_date: Option<String>,
    pub calories_target: Option<i32>,
    pub preferences: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMenuRequest {
    pub name: String,
    pub week_number: Option<i32>,
    pub season: Option<String>,
    pub valid_from: Option<String>,
    pub valid_until: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMenuItemRequest {
    pub day_of_week: i32,
    pub meal_type: String,
    pub diet_type: Option<String>,
    pub item_name: String,
    pub description: Option<String>,
    pub calories: Option<i32>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
    pub is_vegetarian: Option<bool>,
    pub allergens: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMealPrepRequest {
    pub diet_order_id: Uuid,
    pub meal_type: String,
    pub meal_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMealPrepStatusRequest {
    pub status: String,
    pub delivered_to_ward: Option<String>,
    pub delivered_to_bed: Option<String>,
    pub patient_feedback: Option<String>,
    pub feedback_rating: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMealCountRequest {
    pub count_date: Option<String>,
    pub meal_type: String,
    pub ward: String,
    pub total_beds: i32,
    pub occupied: i32,
    pub npo_count: Option<i32>,
    pub regular_count: Option<i32>,
    pub special_count: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInventoryRequest {
    pub item_name: String,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub current_stock: Option<f64>,
    pub reorder_level: Option<f64>,
    pub supplier: Option<String>,
    pub expiry_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInventoryRequest {
    pub item_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub current_stock: Option<f64>,
    pub reorder_level: Option<f64>,
    pub supplier: Option<String>,
    pub expiry_date: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAuditRequest {
    pub audit_date: Option<String>,
    pub auditor_name: String,
    pub audit_type: Option<String>,
    pub temperature_log: Option<serde_json::Value>,
    pub hygiene_score: Option<i32>,
    pub findings: Option<String>,
    pub corrective_actions: Option<String>,
    pub is_compliant: Option<bool>,
    pub next_audit_date: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Diet Templates
// ══════════════════════════════════════════════════════════

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DietTemplate>>, AppError> {
    require_permission(&claims, permissions::diet::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DietTemplate>("SELECT * FROM diet_templates ORDER BY name")
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<DietTemplate>, AppError> {
    require_permission(&claims, permissions::diet::templates::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DietTemplate>(
        "INSERT INTO diet_templates (tenant_id, name, diet_type, description, calories_target, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, restrictions, suitable_for)
         VALUES ($1, $2, COALESCE($3::diet_type, 'custom'), $4, $5, $6, $7, $8, $9, $10, COALESCE($11, '[]'::jsonb), COALESCE($12, '[]'::jsonb))
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.diet_type)
    .bind(&body.description)
    .bind(body.calories_target)
    .bind(body.protein_g)
    .bind(body.carbs_g)
    .bind(body.fat_g)
    .bind(body.fiber_g)
    .bind(body.sodium_mg)
    .bind(&body.restrictions)
    .bind(&body.suitable_for)
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
) -> Result<Json<DietTemplate>, AppError> {
    require_permission(&claims, permissions::diet::templates::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DietTemplate>(
        "UPDATE diet_templates SET
            name = COALESCE($2, name),
            diet_type = COALESCE($3::diet_type, diet_type),
            description = COALESCE($4, description),
            calories_target = COALESCE($5, calories_target),
            protein_g = COALESCE($6, protein_g),
            carbs_g = COALESCE($7, carbs_g),
            fat_g = COALESCE($8, fat_g),
            fiber_g = COALESCE($9, fiber_g),
            sodium_mg = COALESCE($10, sodium_mg),
            restrictions = COALESCE($11, restrictions),
            suitable_for = COALESCE($12, suitable_for),
            is_active = COALESCE($13, is_active)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.diet_type)
    .bind(&body.description)
    .bind(body.calories_target)
    .bind(body.protein_g)
    .bind(body.carbs_g)
    .bind(body.fat_g)
    .bind(body.fiber_g)
    .bind(body.sodium_mg)
    .bind(&body.restrictions)
    .bind(&body.suitable_for)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Diet Orders
// ══════════════════════════════════════════════════════════

pub async fn list_diet_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DietOrder>>, AppError> {
    require_permission(&claims, permissions::diet::orders::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DietOrder>(
        "SELECT * FROM diet_orders ORDER BY created_at DESC LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_diet_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDietOrderRequest>,
) -> Result<Json<DietOrder>, AppError> {
    require_permission(&claims, permissions::diet::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = create_diet_order_in_tx(&mut tx, &claims, &body).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Transaction-scoped sibling of `create_diet_order`. Used by order
/// basket so multiple orders across modules commit atomically. Caller
/// owns the tx + tenant context. Does NOT check permissions — caller must.
pub async fn create_diet_order_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    body: &CreateDietOrderRequest,
) -> Result<DietOrder, AppError> {
    let row = sqlx::query_as::<_, DietOrder>(
        "INSERT INTO diet_orders (tenant_id, patient_id, admission_id, template_id, diet_type, ordered_by, special_instructions, allergies_flagged, is_npo, npo_reason, start_date, end_date, calories_target, protein_g, carbs_g, fat_g, preferences)
         VALUES ($1, $2, $3, $4, COALESCE($5::diet_type, 'regular'), $6, $7, COALESCE($8, '[]'::jsonb), COALESCE($9, FALSE), $10, COALESCE($11::date, CURRENT_DATE), $12::date, $13, $14, $15, $16, COALESCE($17, '{}'::jsonb))
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.template_id)
    .bind(&body.diet_type)
    .bind(claims.sub)
    .bind(&body.special_instructions)
    .bind(&body.allergies_flagged)
    .bind(body.is_npo)
    .bind(&body.npo_reason)
    .bind(&body.start_date)
    .bind(&body.end_date)
    .bind(body.calories_target)
    .bind(body.protein_g)
    .bind(body.carbs_g)
    .bind(body.fat_g)
    .bind(&body.preferences)
    .fetch_one(&mut **tx)
    .await?;

    // Auto-bill diet order (best-effort, swallowed on failure)
    if super::billing::is_auto_billing_enabled(tx, &claims.tenant_id, "diet")
        .await
        .unwrap_or(false)
    {
        let encounter_id = row.admission_id.unwrap_or(row.id);
        let _ = super::billing::create_service_charge(
            tx,
            super::billing::ServiceChargeInput {
                tenant_id: claims.tenant_id,
                patient_id: row.patient_id,
                encounter_id,
                charge_code: "DIET_ORDER",
                quantity: 1,
                source_module: "diet",
                source_entity_id: row.id,
                requested_by: claims.sub,
            },
        )
        .await;
    }

    Ok(row)
}

pub async fn update_diet_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDietOrderRequest>,
) -> Result<Json<DietOrder>, AppError> {
    require_permission(&claims, permissions::diet::orders::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DietOrder>(
        "UPDATE diet_orders SET
            diet_type = COALESCE($2::diet_type, diet_type),
            status = COALESCE($3::diet_order_status, status),
            special_instructions = COALESCE($4, special_instructions),
            is_npo = COALESCE($5, is_npo),
            npo_reason = COALESCE($6, npo_reason),
            end_date = COALESCE($7::date, end_date),
            calories_target = COALESCE($8, calories_target),
            preferences = COALESCE($9, preferences)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.diet_type)
    .bind(&body.status)
    .bind(&body.special_instructions)
    .bind(body.is_npo)
    .bind(&body.npo_reason)
    .bind(&body.end_date)
    .bind(body.calories_target)
    .bind(&body.preferences)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Kitchen Menus
// ══════════════════════════════════════════════════════════

pub async fn list_menus(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<KitchenMenu>>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows =
        sqlx::query_as::<_, KitchenMenu>("SELECT * FROM kitchen_menus ORDER BY week_number, name")
            .fetch_all(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_menu(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMenuRequest>,
) -> Result<Json<KitchenMenu>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, KitchenMenu>(
        "INSERT INTO kitchen_menus (tenant_id, name, week_number, season, valid_from, valid_until)
         VALUES ($1, $2, $3, $4, $5::date, $6::date)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(body.week_number)
    .bind(&body.season)
    .bind(&body.valid_from)
    .bind(&body.valid_until)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_menu_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(menu_id): Path<Uuid>,
) -> Result<Json<Vec<KitchenMenuItem>>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, KitchenMenuItem>(
        "SELECT * FROM kitchen_menu_items WHERE menu_id = $1 ORDER BY day_of_week, meal_type",
    )
    .bind(menu_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_menu_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(menu_id): Path<Uuid>,
    Json(body): Json<CreateMenuItemRequest>,
) -> Result<Json<KitchenMenuItem>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, KitchenMenuItem>(
        "INSERT INTO kitchen_menu_items (tenant_id, menu_id, day_of_week, meal_type, diet_type, item_name, description, calories, protein_g, carbs_g, fat_g, is_vegetarian, allergens)
         VALUES ($1, $2, $3, $4::meal_type, COALESCE($5::diet_type, 'regular'), $6, $7, $8, $9, $10, $11, COALESCE($12, FALSE), COALESCE($13, '[]'::jsonb))
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(menu_id)
    .bind(body.day_of_week)
    .bind(&body.meal_type)
    .bind(&body.diet_type)
    .bind(&body.item_name)
    .bind(&body.description)
    .bind(body.calories)
    .bind(body.protein_g)
    .bind(body.carbs_g)
    .bind(body.fat_g)
    .bind(body.is_vegetarian)
    .bind(&body.allergens)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Meal Preparations
// ══════════════════════════════════════════════════════════

pub async fn list_meal_preps(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MealPreparation>>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MealPreparation>(
        "SELECT * FROM meal_preparations ORDER BY meal_date DESC, meal_type LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_meal_prep(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMealPrepRequest>,
) -> Result<Json<MealPreparation>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MealPreparation>(
        "INSERT INTO meal_preparations (tenant_id, diet_order_id, meal_type, meal_date)
         VALUES ($1, $2, $3::meal_type, COALESCE($4::date, CURRENT_DATE))
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.diet_order_id)
    .bind(&body.meal_type)
    .bind(&body.meal_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_meal_prep_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMealPrepStatusRequest>,
) -> Result<Json<MealPreparation>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = chrono::Utc::now();
    let prepared = if body.status == "preparing" {
        Some(now)
    } else {
        None
    };
    let dispatched = if body.status == "dispatched" {
        Some(now)
    } else {
        None
    };
    let delivered = if body.status == "delivered" {
        Some(now)
    } else {
        None
    };

    let row = sqlx::query_as::<_, MealPreparation>(
        "UPDATE meal_preparations SET
            status = $2::meal_prep_status,
            prepared_by = CASE WHEN $2 = 'preparing' THEN $3 ELSE prepared_by END,
            prepared_at = COALESCE($4, prepared_at),
            dispatched_at = COALESCE($5, dispatched_at),
            delivered_at = COALESCE($6, delivered_at),
            delivered_to_ward = COALESCE($7, delivered_to_ward),
            delivered_to_bed = COALESCE($8, delivered_to_bed),
            patient_feedback = COALESCE($9, patient_feedback),
            feedback_rating = COALESCE($10, feedback_rating),
            notes = COALESCE($11, notes)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(claims.sub)
    .bind(prepared)
    .bind(dispatched)
    .bind(delivered)
    .bind(&body.delivered_to_ward)
    .bind(&body.delivered_to_bed)
    .bind(&body.patient_feedback)
    .bind(body.feedback_rating)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Meal Counts
// ══════════════════════════════════════════════════════════

pub async fn list_meal_counts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MealCount>>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MealCount>(
        "SELECT * FROM meal_counts ORDER BY count_date DESC, ward LIMIT 200",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_meal_count(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMealCountRequest>,
) -> Result<Json<MealCount>, AppError> {
    require_permission(&claims, permissions::diet::kitchen::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MealCount>(
        "INSERT INTO meal_counts (tenant_id, count_date, meal_type, ward, total_beds, occupied, npo_count, regular_count, special_count, notes)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3::meal_type, $4, $5, $6, COALESCE($7, 0), COALESCE($8, 0), COALESCE($9, 0), $10)
         ON CONFLICT (tenant_id, count_date, meal_type, ward) DO UPDATE SET
            total_beds = EXCLUDED.total_beds,
            occupied = EXCLUDED.occupied,
            npo_count = EXCLUDED.npo_count,
            regular_count = EXCLUDED.regular_count,
            special_count = EXCLUDED.special_count,
            notes = EXCLUDED.notes
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.count_date)
    .bind(&body.meal_type)
    .bind(&body.ward)
    .bind(body.total_beds)
    .bind(body.occupied)
    .bind(body.npo_count)
    .bind(body.regular_count)
    .bind(body.special_count)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Kitchen Inventory
// ══════════════════════════════════════════════════════════

pub async fn list_inventory(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<KitchenInventory>>, AppError> {
    require_permission(&claims, permissions::diet::inventory::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows =
        sqlx::query_as::<_, KitchenInventory>("SELECT * FROM kitchen_inventory ORDER BY item_name")
            .fetch_all(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_inventory_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInventoryRequest>,
) -> Result<Json<KitchenInventory>, AppError> {
    require_permission(&claims, permissions::diet::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, KitchenInventory>(
        "INSERT INTO kitchen_inventory (tenant_id, item_name, category, unit, current_stock, reorder_level, supplier, expiry_date)
         VALUES ($1, $2, $3, COALESCE($4, 'kg'), COALESCE($5, 0), $6, $7, $8::date)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.item_name)
    .bind(&body.category)
    .bind(&body.unit)
    .bind(body.current_stock)
    .bind(body.reorder_level)
    .bind(&body.supplier)
    .bind(&body.expiry_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_inventory_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInventoryRequest>,
) -> Result<Json<KitchenInventory>, AppError> {
    require_permission(&claims, permissions::diet::inventory::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, KitchenInventory>(
        "UPDATE kitchen_inventory SET
            item_name = COALESCE($2, item_name),
            category = COALESCE($3, category),
            unit = COALESCE($4, unit),
            current_stock = COALESCE($5, current_stock),
            reorder_level = COALESCE($6, reorder_level),
            supplier = COALESCE($7, supplier),
            expiry_date = COALESCE($8::date, expiry_date),
            is_active = COALESCE($9, is_active)
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(&body.item_name)
    .bind(&body.category)
    .bind(&body.unit)
    .bind(body.current_stock)
    .bind(body.reorder_level)
    .bind(&body.supplier)
    .bind(&body.expiry_date)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  FSSAI Audits
// ══════════════════════════════════════════════════════════

pub async fn list_audits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<KitchenAudit>>, AppError> {
    require_permission(&claims, permissions::diet::audits::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, KitchenAudit>(
        "SELECT * FROM kitchen_audits ORDER BY audit_date DESC LIMIT 100",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAuditRequest>,
) -> Result<Json<KitchenAudit>, AppError> {
    require_permission(&claims, permissions::diet::audits::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, KitchenAudit>(
        "INSERT INTO kitchen_audits (tenant_id, audit_date, auditor_name, audit_type, temperature_log, hygiene_score, findings, corrective_actions, is_compliant, next_audit_date)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, COALESCE($4, 'routine'), COALESCE($5, '{}'::jsonb), $6, $7, $8, COALESCE($9, TRUE), $10::date)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.audit_date)
    .bind(&body.auditor_name)
    .bind(&body.audit_type)
    .bind(&body.temperature_log)
    .bind(body.hygiene_score)
    .bind(&body.findings)
    .bind(&body.corrective_actions)
    .bind(body.is_compliant)
    .bind(&body.next_audit_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

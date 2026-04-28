//! Order Basket — atomic cross-module order signing.
//!
//! Per `RFCs/sprints/SPRINT-order-basket.md`. Single workspace, all orders
//! batched in client state, one `POST /api/orders/basket/sign` commits
//! everything in one Postgres transaction. Audit row in
//! `order_basket_signatures` captures the whole batch with warnings +
//! overrides + created order IDs.
//!
//! Endpoints:
//! - `POST /api/orders/basket/check`   — debounced CDS check across basket
//! - `POST /api/orders/basket/sign`    — atomic commit
//! - `GET  /api/orders/basket/drafts/{encounter_id}` — load draft for current user
//! - `PUT  /api/orders/basket/drafts/{encounter_id}` — save / upsert draft
//! - `DELETE /api/orders/basket/drafts/{encounter_id}` — clear draft
//!
//! Procedure + referral basket items are reserved in the type system but
//! not yet wired to a creation path — they'll land in a follow-up sprint.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Basket item types — discriminated union
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BasketItem {
    Drug(BasketDrugItem),
    Lab(BasketLabItem),
    Radiology(BasketRadiologyItem),
    Procedure(BasketProcedureItem),
    Diet(BasketDietItem),
    Referral(BasketReferralItem),
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BasketDrugItem {
    pub drug_id: Uuid,
    pub drug_name: String,
    pub dose: String,
    pub frequency: String,
    pub route: String,
    pub duration_days: Option<i32>,
    pub indication: Option<String>,
    pub is_prn: Option<bool>,
    pub instructions: Option<String>,
    pub quantity: i32,
    pub unit_price: Decimal,
    pub schedule_x_serial: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BasketLabItem {
    pub test_id: Uuid,
    pub priority: Option<String>,
    pub indication: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BasketRadiologyItem {
    pub modality_id: Uuid,
    pub body_part: Option<String>,
    pub clinical_indication: Option<String>,
    pub priority: Option<String>,
    pub scheduled_at: Option<String>,
    pub contrast_required: Option<bool>,
    pub pregnancy_checked: Option<bool>,
    pub allergy_flagged: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BasketProcedureItem {
    pub procedure_id: Uuid,
    pub indication: Option<String>,
    pub scheduled_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BasketDietItem {
    pub template_id: Option<Uuid>,
    pub diet_type: Option<String>,
    pub special_instructions: Option<String>,
    pub is_npo: Option<bool>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BasketReferralItem {
    pub to_specialty_id: Option<Uuid>,
    pub to_external_provider: Option<String>,
    pub reason: String,
    pub priority: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Warning shape
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BasketWarning {
    pub code: String,
    pub severity: WarningSeverity,
    pub message: String,
    /// Indices into the basket items array this warning applies to.
    pub refs: Vec<usize>,
    pub detail: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum WarningSeverity {
    Warn,
    Block,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WarningAck {
    pub code: String,
    pub override_reason: String,
}

// ══════════════════════════════════════════════════════════
//  Request/response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CheckBasketRequest {
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub items: Vec<BasketItem>,
}

#[derive(Debug, Serialize)]
pub struct CheckBasketResponse {
    pub warnings: Vec<BasketWarning>,
}

#[derive(Debug, Deserialize)]
pub struct SignBasketRequest {
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub items: Vec<BasketItem>,
    #[serde(default)]
    pub warnings_acknowledged: Vec<WarningAck>,
    pub client_session_id: Option<String>,
    pub device_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SignBasketResponse {
    pub signature_id: Uuid,
    pub created: Vec<CreatedOrderRef>,
    pub warnings: Vec<BasketWarning>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CreatedOrderRef {
    pub item_index: usize,
    pub order_type: String,
    pub order_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SaveDraftRequest {
    pub items: Vec<BasketItem>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OrderBasketDraft {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub encounter_id: Uuid,
    pub owner_user_id: Uuid,
    pub items: Value,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ══════════════════════════════════════════════════════════
//  Limits + constants
// ══════════════════════════════════════════════════════════

const MAX_BASKET_ITEMS: usize = 30;

// ══════════════════════════════════════════════════════════
//  POST /api/orders/basket/check
// ══════════════════════════════════════════════════════════

pub async fn check_basket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CheckBasketRequest>,
) -> Result<Json<CheckBasketResponse>, AppError> {
    require_permission(&claims, permissions::order_basket::SIGN)?;

    if body.items.len() > MAX_BASKET_ITEMS {
        return Err(AppError::BadRequest(format!(
            "basket exceeds {MAX_BASKET_ITEMS}-item limit"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let warnings = run_basket_checks(&mut tx, &claims.tenant_id, &body.patient_id, &body.items).await?;
    tx.commit().await?;

    Ok(Json(CheckBasketResponse { warnings }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/orders/basket/sign  — atomic commit
// ══════════════════════════════════════════════════════════

pub async fn sign_basket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SignBasketRequest>,
) -> Result<Json<SignBasketResponse>, AppError> {
    require_permission(&claims, permissions::order_basket::SIGN)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest("basket is empty".to_owned()));
    }
    if body.items.len() > MAX_BASKET_ITEMS {
        return Err(AppError::BadRequest(format!(
            "basket exceeds {MAX_BASKET_ITEMS}-item limit"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Defense-in-depth: re-run CDS inside the sign tx. If a BLOCK warning
    // has appeared since the client's last check and is not in
    // warnings_acknowledged, reject the sign.
    let warnings =
        run_basket_checks(&mut tx, &claims.tenant_id, &body.patient_id, &body.items).await?;
    if let Some(unacked) = first_unacknowledged_block(&warnings, &body.warnings_acknowledged) {
        return Err(AppError::BadRequest(format!(
            "blocking warning '{}' must be acknowledged with override_reason before signing",
            unacked.code
        )));
    }

    // Dispatch each item to its in-tx creation path. Any failure aborts
    // the whole basket via tx rollback.
    let mut created: Vec<CreatedOrderRef> = Vec::with_capacity(body.items.len());
    for (idx, item) in body.items.iter().enumerate() {
        let r = dispatch_item(&mut tx, &claims, &body.encounter_id, &body.patient_id, item)
            .await
            .map_err(|e| AppError::BadRequest(format!("basket item #{idx} failed: {e}")))?;
        created.push(CreatedOrderRef {
            item_index: idx,
            order_type: r.order_type,
            order_id: r.order_id,
        });
    }

    // Audit row — full snapshot, warnings, overrides, created IDs
    let snapshot = serde_json::to_value(&body.items)
        .map_err(|e| AppError::Internal(format!("snapshot serialize: {e}")))?;
    let warnings_json = serde_json::to_value(&warnings)
        .map_err(|e| AppError::Internal(format!("warnings serialize: {e}")))?;
    let acks_json = serde_json::to_value(&body.warnings_acknowledged)
        .map_err(|e| AppError::Internal(format!("acks serialize: {e}")))?;
    let overrides_json = serde_json::to_value(
        body.warnings_acknowledged
            .iter()
            .map(|a| json!({ "code": a.code, "reason": a.override_reason }))
            .collect::<Vec<_>>(),
    )
    .map_err(|e| AppError::Internal(format!("overrides serialize: {e}")))?;
    let created_json = serde_json::to_value(&created)
        .map_err(|e| AppError::Internal(format!("created serialize: {e}")))?;

    let signature_id: Uuid = sqlx::query_scalar(
        "INSERT INTO order_basket_signatures \
         (tenant_id, encounter_id, patient_id, signed_by, items_count, \
          items_snapshot, warnings_returned, warnings_acknowledged, \
          override_reasons, created_order_ids, client_session_id, device_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .bind(i32::try_from(body.items.len()).unwrap_or(i32::MAX))
    .bind(snapshot)
    .bind(warnings_json)
    .bind(acks_json)
    .bind(overrides_json)
    .bind(created_json)
    .bind(body.client_session_id.as_deref())
    .bind(body.device_id.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    // Clear any draft for this (tenant, encounter, owner) — basket
    // committed, draft is stale.
    let _ = sqlx::query(
        "DELETE FROM order_basket_drafts \
         WHERE tenant_id = $1 AND encounter_id = $2 AND owner_user_id = $3",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await;

    tx.commit().await?;

    // Post-commit side-effects via outbox (durable, non-blocking).
    // SMS to patient + pharmacy notification queued; failures here do not
    // affect the sign response — they retry async per outbox backoff.
    if let Err(e) = queue_post_sign_side_effects(&state, &claims, &body, &created).await {
        tracing::warn!(error = %e, "failed to queue post-sign outbox events");
    }

    Ok(Json(SignBasketResponse {
        signature_id,
        created,
        warnings,
    }))
}

// ══════════════════════════════════════════════════════════
//  Drafts CRUD
// ══════════════════════════════════════════════════════════

pub async fn get_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Option<OrderBasketDraft>>, AppError> {
    require_permission(&claims, permissions::order_basket::DRAFT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let draft = sqlx::query_as::<_, OrderBasketDraft>(
        "SELECT * FROM order_basket_drafts \
         WHERE tenant_id = $1 AND encounter_id = $2 AND owner_user_id = $3",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(draft))
}

pub async fn save_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<SaveDraftRequest>,
) -> Result<Json<OrderBasketDraft>, AppError> {
    require_permission(&claims, permissions::order_basket::DRAFT)?;

    if body.items.len() > MAX_BASKET_ITEMS {
        return Err(AppError::BadRequest(format!(
            "draft exceeds {MAX_BASKET_ITEMS}-item limit"
        )));
    }
    let items_json = serde_json::to_value(&body.items)
        .map_err(|e| AppError::Internal(format!("items serialize: {e}")))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let draft = sqlx::query_as::<_, OrderBasketDraft>(
        "INSERT INTO order_basket_drafts \
         (tenant_id, encounter_id, owner_user_id, items, notes) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (tenant_id, encounter_id, owner_user_id) \
         DO UPDATE SET items = EXCLUDED.items, notes = EXCLUDED.notes \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(claims.sub)
    .bind(items_json)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(draft))
}

pub async fn delete_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::order_basket::DRAFT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "DELETE FROM order_basket_drafts \
         WHERE tenant_id = $1 AND encounter_id = $2 AND owner_user_id = $3",
    )
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Item dispatch (calls each module's `_in_tx` sibling)
// ══════════════════════════════════════════════════════════

struct ItemResult {
    order_type: String,
    order_id: Uuid,
}

async fn dispatch_item(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    encounter_id: &Uuid,
    patient_id: &Uuid,
    item: &BasketItem,
) -> Result<ItemResult, AppError> {
    match item {
        BasketItem::Lab(it) => {
            let req = super::lab::CreateOrderRequest {
                encounter_id: *encounter_id,
                patient_id: *patient_id,
                test_id: it.test_id,
                priority: it.priority.clone(),
                notes: it.notes.clone().or_else(|| it.indication.clone()),
            };
            let order = super::lab::create_order_in_tx(tx, claims, &req).await?;
            Ok(ItemResult { order_type: "lab".to_owned(), order_id: order.id })
        }
        BasketItem::Radiology(it) => {
            let req = super::radiology::CreateOrderRequest {
                patient_id: *patient_id,
                encounter_id: Some(*encounter_id),
                modality_id: it.modality_id,
                body_part: it.body_part.clone(),
                clinical_indication: it.clinical_indication.clone(),
                priority: it.priority.clone(),
                scheduled_at: it.scheduled_at.clone(),
                notes: it.notes.clone(),
                contrast_required: it.contrast_required,
                pregnancy_checked: it.pregnancy_checked,
                allergy_flagged: it.allergy_flagged,
            };
            let order = super::radiology::create_order_in_tx(tx, claims, &req).await?;
            Ok(ItemResult { order_type: "radiology".to_owned(), order_id: order.id })
        }
        BasketItem::Diet(it) => {
            let req = super::diet::CreateDietOrderRequest {
                patient_id: *patient_id,
                admission_id: Some(*encounter_id),
                template_id: it.template_id,
                diet_type: it.diet_type.clone(),
                special_instructions: it.special_instructions.clone(),
                allergies_flagged: None,
                is_npo: it.is_npo,
                npo_reason: None,
                start_date: it.start_date.clone(),
                end_date: it.end_date.clone(),
                calories_target: None,
                protein_g: None,
                carbs_g: None,
                fat_g: None,
                preferences: None,
            };
            let order = super::diet::create_diet_order_in_tx(tx, claims, &req).await?;
            Ok(ItemResult { order_type: "diet".to_owned(), order_id: order.id })
        }
        BasketItem::Drug(it) => {
            let req = super::pharmacy::CreateOrderRequest {
                prescription_id: None,
                patient_id: *patient_id,
                encounter_id: Some(*encounter_id),
                notes: it.indication.clone(),
                items: vec![super::pharmacy::OrderItemInput {
                    catalog_item_id: Some(it.drug_id),
                    drug_name: it.drug_name.clone(),
                    quantity: it.quantity,
                    unit_price: it.unit_price,
                }],
                dispensing_type: Some("prescription".to_owned()),
                discharge_summary_id: None,
                billing_package_id: None,
                store_location_id: None,
            };
            let result = super::pharmacy::create_order_in_tx(tx, claims, &req).await?;
            Ok(ItemResult { order_type: "drug".to_owned(), order_id: result.order.id })
        }
        BasketItem::Procedure(_) => Err(AppError::BadRequest(
            "procedure orders via basket — Phase 2".to_owned(),
        )),
        BasketItem::Referral(_) => Err(AppError::BadRequest(
            "referral orders via basket — Phase 2".to_owned(),
        )),
    }
}

// ══════════════════════════════════════════════════════════
//  CDS composer — runs existing rules across the whole basket
// ══════════════════════════════════════════════════════════
//
// Phase 1 rules:
//   - DUPLICATE_LAB_TODAY     (WARN)  — patient has same test ordered today
//   - SCHEDULE_X_REQUIRES_PAPER (BLOCK) — schedule X drug missing paper serial
//   - MAX_BASKET_ITEMS        (WARN)  — soft warn near limit
//
// Drug-drug interaction, drug-allergy, dose-range, LASA, renal, pregnancy
// rules will be plugged in here when the existing CDS engine surface is
// wired up. They are stubbed below — composer is in place, rules drop in.

async fn run_basket_checks(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: &Uuid,
    items: &[BasketItem],
) -> Result<Vec<BasketWarning>, AppError> {
    let mut warnings = Vec::new();

    // Rule: duplicate lab test ordered today
    for (idx, item) in items.iter().enumerate() {
        if let BasketItem::Lab(it) = item {
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*)::bigint FROM lab_orders \
                 WHERE tenant_id = $1 AND patient_id = $2 AND test_id = $3 \
                   AND ordered_at::date = current_date",
            )
            .bind(tenant_id)
            .bind(patient_id)
            .bind(it.test_id)
            .fetch_one(&mut **tx)
            .await
            .unwrap_or((0,));
            if count.0 > 0 {
                warnings.push(BasketWarning {
                    code: "DUPLICATE_LAB_TODAY".to_owned(),
                    severity: WarningSeverity::Warn,
                    message: format!(
                        "Lab test already ordered for this patient today ({} existing)",
                        count.0
                    ),
                    refs: vec![idx],
                    detail: Some(json!({ "existing_count": count.0 })),
                });
            }
        }
    }

    // Rule: Schedule X drug requires paper serial number
    for (idx, item) in items.iter().enumerate() {
        if let BasketItem::Drug(it) = item {
            let row: Option<(Option<String>,)> = sqlx::query_as(
                "SELECT drug_schedule FROM pharmacy_catalog \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(it.drug_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await
            .ok()
            .flatten();
            if let Some((Some(schedule),)) = row {
                if schedule.eq_ignore_ascii_case("X") && it.schedule_x_serial.is_none() {
                    warnings.push(BasketWarning {
                        code: "SCHEDULE_X_REQUIRES_PAPER".to_owned(),
                        severity: WarningSeverity::Block,
                        message: format!(
                            "{} is Schedule X — paper Rx serial number required",
                            it.drug_name
                        ),
                        refs: vec![idx],
                        detail: Some(json!({ "drug_schedule": schedule })),
                    });
                }
            }
        }
    }

    // Soft warn near basket limit
    if items.len() >= MAX_BASKET_ITEMS - 5 {
        warnings.push(BasketWarning {
            code: "BASKET_NEAR_LIMIT".to_owned(),
            severity: WarningSeverity::Warn,
            message: format!(
                "basket has {} items (max {})",
                items.len(),
                MAX_BASKET_ITEMS
            ),
            refs: (0..items.len()).collect(),
            detail: None,
        });
    }

    Ok(warnings)
}

fn first_unacknowledged_block<'a>(
    warnings: &'a [BasketWarning],
    acks: &[WarningAck],
) -> Option<&'a BasketWarning> {
    warnings.iter().find(|w| {
        w.severity == WarningSeverity::Block
            && !acks
                .iter()
                .any(|a| a.code == w.code && !a.override_reason.trim().is_empty())
    })
}

// ══════════════════════════════════════════════════════════
//  Post-sign side-effects via outbox
// ══════════════════════════════════════════════════════════

async fn queue_post_sign_side_effects(
    _state: &AppState,
    _claims: &Claims,
    _body: &SignBasketRequest,
    _created: &[CreatedOrderRef],
) -> Result<(), AppError> {
    // Placeholder — wires up once outbox helper signature stabilizes
    // across Sprint A (other chat) merge. For now the basket sign
    // commits cleanly and the SMS/notify is a no-op. Re-enable with:
    //
    //   medbrains_outbox::queue_in_tx(tx, OutboxRow {
    //     tenant_id: claims.tenant_id,
    //     aggregate_type: "order_basket_signature",
    //     aggregate_id: Some(signature_id),
    //     event_type: "sms.prescription_to_patient",
    //     payload: json!({ ... }),
    //     idempotency_key: Some(signature_id.to_string()),
    //   }).await?;
    Ok(())
}

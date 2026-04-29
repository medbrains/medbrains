#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::indent::{
    IndentItem, IndentRequisition, IndentType, StoreCatalog, StoreStockMovement,
};
use medbrains_core::inventory::{
    AbcAnalysisRow, ComplianceCheckRow, ConsumptionAnalysisRow, DeadStockRow,
    EquipmentCondemnation, FsnAnalysisRow, ImplantRegistryEntry, InventoryValuationRow,
    PatientConsumableIssue, PurchaseConsumptionTrendRow, ReorderAlert, VedAnalysisRow,
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
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListRequisitionsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub indent_type: Option<String>,
    pub department_id: Option<Uuid>,
    pub requested_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct RequisitionListResponse {
    pub requisitions: Vec<IndentRequisition>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateRequisitionRequest {
    pub department_id: Uuid,
    pub indent_type: String,
    pub priority: Option<String>,
    pub context: Option<serde_json::Value>,
    pub notes: Option<String>,
    pub items: Vec<CreateItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct CreateItemInput {
    pub catalog_item_id: Option<Uuid>,
    pub item_name: String,
    pub quantity_requested: i32,
    pub unit_price: Option<Decimal>,
    pub item_context: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RequisitionDetailResponse {
    pub requisition: IndentRequisition,
    pub items: Vec<IndentItem>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveRequisitionRequest {
    pub items: Vec<ApproveItemInput>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveItemInput {
    pub item_id: Uuid,
    pub quantity_approved: i32,
}

#[derive(Debug, Deserialize)]
pub struct IssueRequisitionRequest {
    pub items: Vec<IssueItemInput>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IssueItemInput {
    pub item_id: Uuid,
    pub quantity_issued: i32,
}

// ── Catalog ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCatalogQuery {
    pub search: Option<String>,
    pub category: Option<String>,
    pub active_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCatalogRequest {
    pub code: String,
    pub name: String,
    pub category: Option<String>,
    pub sub_category: Option<String>,
    pub unit: Option<String>,
    pub base_price: Option<Decimal>,
    pub reorder_level: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCatalogRequest {
    pub name: Option<String>,
    pub category: Option<String>,
    pub sub_category: Option<String>,
    pub unit: Option<String>,
    pub base_price: Option<Decimal>,
    pub reorder_level: Option<i32>,
    pub is_active: Option<bool>,
    pub ved_class: Option<String>,
    pub is_implant: Option<bool>,
    pub is_high_value: Option<bool>,
    pub hsn_code: Option<String>,
    pub bin_location: Option<String>,
    pub min_stock: Option<i32>,
    pub max_stock: Option<i32>,
}

// ── Stock ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListStockMovementsQuery {
    pub catalog_item_id: Option<Uuid>,
    pub movement_type: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct StockMovementListResponse {
    pub movements: Vec<StoreStockMovement>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateStockMovementRequest {
    pub catalog_item_id: Uuid,
    pub movement_type: String,
    pub quantity: i32,
    pub reference_type: Option<String>,
    pub reference_id: Option<Uuid>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Indent number generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SeqResult {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

pub async fn generate_indent_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'INDENT' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let seq = seq.ok_or_else(|| AppError::Internal("INDENT sequence not configured".to_owned()))?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(6);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

// ══════════════════════════════════════════════════════════
//  Recalculate requisition total
// ══════════════════════════════════════════════════════════

async fn recalculate_total(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    requisition_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE indent_requisitions SET \
         total_amount = COALESCE((SELECT SUM(total_price) FROM indent_items \
           WHERE requisition_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(requisition_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/requisitions
// ══════════════════════════════════════════════════════════

pub async fn list_requisitions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRequisitionsQuery>,
) -> Result<Json<RequisitionListResponse>, AppError> {
    require_permission(&claims, permissions::indent::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    #[allow(clippy::items_after_statements)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("status = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
        });
        bind_idx += 1;
    }
    if let Some(ref indent_type) = params.indent_type {
        conditions.push(format!("indent_type = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(indent_type.clone()),
        });
        bind_idx += 1;
    }
    if let Some(dept_id) = params.department_id {
        conditions.push(format!("department_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(dept_id),
            string_val: None,
        });
        bind_idx += 1;
    }
    if let Some(req_by) = params.requested_by {
        conditions.push(format!("requested_by = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(req_by),
            string_val: None,
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM indent_requisitions WHERE {where_clause}");
    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            cq = cq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            cq = cq.bind(s.clone());
        }
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM indent_requisitions WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut dq = sqlx::query_as::<_, IndentRequisition>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            dq = dq.bind(u);
        }
        if let Some(ref s) = b.string_val {
            dq = dq.bind(s.clone());
        }
    }
    let requisitions = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(RequisitionListResponse {
        requisitions,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/indent/requisitions
// ══════════════════════════════════════════════════════════

pub async fn create_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRequisitionRequest>,
) -> Result<Json<RequisitionDetailResponse>, AppError> {
    require_permission(&claims, permissions::indent::CREATE)?;

    if body.items.is_empty() {
        return Err(AppError::BadRequest("At least one item is required".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let indent_number = generate_indent_number(&mut tx, &claims.tenant_id).await?;

    let empty_json = serde_json::json!({});
    let context = body.context.as_ref().unwrap_or(&empty_json);

    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "INSERT INTO indent_requisitions \
         (tenant_id, indent_number, department_id, requested_by, \
          indent_type, priority, status, context, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&indent_number)
    .bind(body.department_id)
    .bind(claims.sub)
    .bind(&body.indent_type)
    .bind(body.priority.as_deref().unwrap_or("normal"))
    .bind(context)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    for item in &body.items {
        let unit_price = item.unit_price.unwrap_or(Decimal::ZERO);
        let total_price = unit_price * Decimal::from(item.quantity_requested);
        let item_ctx = item.item_context.as_ref().unwrap_or(&empty_json);

        sqlx::query(
            "INSERT INTO indent_items \
             (tenant_id, requisition_id, catalog_item_id, item_name, \
              quantity_requested, unit_price, total_price, item_context, notes) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(claims.tenant_id)
        .bind(requisition.id)
        .bind(item.catalog_item_id)
        .bind(&item.item_name)
        .bind(item.quantity_requested)
        .bind(unit_price)
        .bind(total_price)
        .bind(item_ctx)
        .bind(&item.notes)
        .execute(&mut *tx)
        .await?;
    }

    recalculate_total(&mut tx, requisition.id, claims.tenant_id).await?;

    let items = sqlx::query_as::<_, IndentItem>(
        "SELECT * FROM indent_items WHERE requisition_id = $1 AND tenant_id = $2",
    )
    .bind(requisition.id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Re-fetch requisition after total recalculation
    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "SELECT * FROM indent_requisitions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(requisition.id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(RequisitionDetailResponse { requisition, items }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/requisitions/:id
// ══════════════════════════════════════════════════════════

pub async fn get_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<RequisitionDetailResponse>, AppError> {
    require_permission(&claims, permissions::indent::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "SELECT * FROM indent_requisitions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let items = sqlx::query_as::<_, IndentItem>(
        "SELECT * FROM indent_items \
         WHERE requisition_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(RequisitionDetailResponse { requisition, items }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/indent/requisitions/:id/submit
// ══════════════════════════════════════════════════════════

pub async fn submit_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IndentRequisition>, AppError> {
    require_permission(&claims, permissions::indent::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let req = sqlx::query_as::<_, IndentRequisition>(
        "UPDATE indent_requisitions SET status = 'submitted', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Requisition not found or not in draft status".into()))?;

    tx.commit().await?;

    // Enrich payload with names for orchestration
    let department_name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM departments WHERE id = $1",
    )
    .bind(req.department_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let requested_by_name = sqlx::query_scalar::<_, String>(
        "SELECT full_name FROM users WHERE id = $1",
    )
    .bind(req.requested_by)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let items_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM indent_items WHERE requisition_id = $1",
    )
    .bind(req.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "indent.requisition.submitted",
        serde_json::json!({
            "requisition_id": req.id,
            "indent_number": req.indent_number,
            "department_id": req.department_id,
            "department_name": department_name,
            "indent_type": format!("{:?}", req.indent_type),
            "items_count": items_count,
            "total_amount": req.total_amount,
            "requested_by": req.requested_by,
            "requested_by_name": requested_by_name,
            "priority": format!("{:?}", req.priority),
        }),
    )
    .await;

    Ok(Json(req))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/indent/requisitions/:id/approve
// ══════════════════════════════════════════════════════════

pub async fn approve_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveRequisitionRequest>,
) -> Result<Json<RequisitionDetailResponse>, AppError> {
    require_permission(&claims, permissions::indent::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify requisition is submitted
    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "SELECT * FROM indent_requisitions \
         WHERE id = $1 AND tenant_id = $2 AND status = 'submitted'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Requisition not found or not in submitted status".into())
    })?;

    let mut any_approved = false;
    let mut all_approved_fully = true;

    for item_input in &body.items {
        let existing = sqlx::query_as::<_, IndentItem>(
            "SELECT * FROM indent_items \
             WHERE id = $1 AND requisition_id = $2 AND tenant_id = $3",
        )
        .bind(item_input.item_id)
        .bind(requisition.id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound)?;

        let qty = item_input
            .quantity_approved
            .min(existing.quantity_requested);
        if qty > 0 {
            any_approved = true;
        }
        if qty < existing.quantity_requested {
            all_approved_fully = false;
        }

        sqlx::query("UPDATE indent_items SET quantity_approved = $1 WHERE id = $2")
            .bind(qty)
            .bind(item_input.item_id)
            .execute(&mut *tx)
            .await?;
    }

    let new_status = if !any_approved {
        "rejected"
    } else if all_approved_fully {
        "approved"
    } else {
        "partially_approved"
    };

    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "UPDATE indent_requisitions SET \
         status = $3, approved_by = $4, approved_at = now(), \
         notes = COALESCE($5, notes), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, IndentItem>(
        "SELECT * FROM indent_items \
         WHERE requisition_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Auto-draft PO for pharmacy indents on approval
    if requisition.indent_type == IndentType::Pharmacy && new_status != "rejected" {
        let approved_items: Vec<&IndentItem> = items
            .iter()
            .filter(|i| i.quantity_approved > 0)
            .collect();

        if !approved_items.is_empty() {
            let vendor_id: Option<Uuid> = sqlx::query_scalar(
                "SELECT pc.preferred_supplier_id FROM pharmacy_catalog pc \
                 JOIN indent_items ii ON ii.item_name ILIKE '%' || pc.name || '%' \
                 WHERE ii.requisition_id = $1 AND pc.preferred_supplier_id IS NOT NULL \
                 LIMIT 1",
            )
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();

            if let Some(vid) = vendor_id {
                let po_id = Uuid::new_v4();
                let po_number = format!("PO-AUTO-{}", &po_id.to_string()[..8]);

                sqlx::query(
                    "INSERT INTO purchase_orders \
                     (id, tenant_id, po_number, vendor_id, status, \
                      indent_requisition_id, notes, created_by) \
                     VALUES ($1, $2, $3, $4, 'draft', $5, \
                             'Auto-drafted from pharmacy indent', $6)",
                )
                .bind(po_id)
                .bind(claims.tenant_id)
                .bind(&po_number)
                .bind(vid)
                .bind(id)
                .bind(claims.sub)
                .execute(&mut *tx)
                .await?;

                for item in &approved_items {
                    sqlx::query(
                        "INSERT INTO purchase_order_items \
                         (id, tenant_id, po_id, item_name, quantity_ordered, \
                          unit_price, indent_item_id) \
                         VALUES (gen_random_uuid(), $1, $2, $3, $4, \
                                 COALESCE($5, 0), $6)",
                    )
                    .bind(claims.tenant_id)
                    .bind(po_id)
                    .bind(&item.item_name)
                    .bind(item.quantity_approved)
                    .bind(item.unit_price)
                    .bind(item.id)
                    .execute(&mut *tx)
                    .await?;
                }

                tracing::info!(
                    po_number,
                    indent_id = %id,
                    "auto-drafted PO from pharmacy indent"
                );
            }
        }
    }

    tx.commit().await?;

    // Enrich payload with department name for orchestration
    let department_name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM departments WHERE id = $1",
    )
    .bind(requisition.department_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "Unknown".to_owned());

    let _ = crate::orchestration::lifecycle::emit_after_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "indent.requisition.approved",
        serde_json::json!({
            "requisition_id": requisition.id,
            "indent_number": requisition.indent_number,
            "department_id": requisition.department_id,
            "department_name": department_name,
            "status": format!("{:?}", requisition.status),
            "approved_by": requisition.approved_by,
            "items_count": items.len(),
        }),
    )
    .await;

    Ok(Json(RequisitionDetailResponse { requisition, items }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/indent/requisitions/:id/reject
// ══════════════════════════════════════════════════════════

pub async fn reject_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IndentRequisition>, AppError> {
    require_permission(&claims, permissions::indent::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let req = sqlx::query_as::<_, IndentRequisition>(
        "UPDATE indent_requisitions SET \
         status = 'rejected', approved_by = $3, approved_at = now(), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'submitted' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Requisition not found or not in submitted status".into())
    })?;

    tx.commit().await?;
    Ok(Json(req))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/indent/requisitions/:id/issue
// ══════════════════════════════════════════════════════════

pub async fn issue_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IssueRequisitionRequest>,
) -> Result<Json<RequisitionDetailResponse>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Verify requisition is approved/partially_approved
    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "SELECT * FROM indent_requisitions \
         WHERE id = $1 AND tenant_id = $2 \
         AND status IN ('approved', 'partially_approved', 'partially_issued')",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Requisition not found or not in approvable status".into())
    })?;

    let mut all_fully_issued = true;

    for item_input in &body.items {
        let existing = sqlx::query_as::<_, IndentItem>(
            "SELECT * FROM indent_items \
             WHERE id = $1 AND requisition_id = $2 AND tenant_id = $3",
        )
        .bind(item_input.item_id)
        .bind(requisition.id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound)?;

        let max_issuable = existing.quantity_approved - existing.quantity_issued;
        let qty = item_input.quantity_issued.min(max_issuable).max(0);

        if qty > 0 {
            // Update item issued quantity
            sqlx::query(
                "UPDATE indent_items \
                 SET quantity_issued = quantity_issued + $1 WHERE id = $2",
            )
            .bind(qty)
            .bind(item_input.item_id)
            .execute(&mut *tx)
            .await?;

            // Create stock movement (issue)
            if let Some(catalog_id) = existing.catalog_item_id {
                sqlx::query(
                    "INSERT INTO store_stock_movements \
                     (tenant_id, catalog_item_id, movement_type, quantity, \
                      reference_type, reference_id, notes, created_by) \
                     VALUES ($1, $2, 'issue', $3, 'indent', $4, $5, $6)",
                )
                .bind(claims.tenant_id)
                .bind(catalog_id)
                .bind(-qty) // negative for issue
                .bind(requisition.id)
                .bind(&body.notes)
                .bind(claims.sub)
                .execute(&mut *tx)
                .await?;

                // Decrement stock
                sqlx::query(
                    "UPDATE store_catalog \
                     SET current_stock = current_stock - $1, updated_at = now() \
                     WHERE id = $2 AND tenant_id = $3",
                )
                .bind(qty)
                .bind(catalog_id)
                .bind(claims.tenant_id)
                .execute(&mut *tx)
                .await?;
            }
        }

        let updated = existing.quantity_issued + qty;
        if updated < existing.quantity_approved {
            all_fully_issued = false;
        }
    }

    let new_status = if all_fully_issued {
        "issued"
    } else {
        "partially_issued"
    };

    let requisition = sqlx::query_as::<_, IndentRequisition>(
        "UPDATE indent_requisitions SET \
         status = $3, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .fetch_one(&mut *tx)
    .await?;

    let items = sqlx::query_as::<_, IndentItem>(
        "SELECT * FROM indent_items \
         WHERE requisition_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(RequisitionDetailResponse { requisition, items }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/indent/requisitions/:id/cancel
// ══════════════════════════════════════════════════════════

pub async fn cancel_requisition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IndentRequisition>, AppError> {
    require_permission(&claims, permissions::indent::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let req = sqlx::query_as::<_, IndentRequisition>(
        "UPDATE indent_requisitions SET \
         status = 'cancelled', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         AND status IN ('draft', 'submitted') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Requisition not found or cannot be cancelled".into()))?;

    tx.commit().await?;
    Ok(Json(req))
}

// ══════════════════════════════════════════════════════════
//  Store Catalog CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCatalogQuery>,
) -> Result<Json<Vec<StoreCatalog>>, AppError> {
    require_permission(&claims, permissions::indent::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let active_filter = if params.active_only.unwrap_or(false) {
        " AND is_active = true"
    } else {
        ""
    };

    let (sql, has_search, has_category) = match (&params.search, &params.category) {
        (Some(_), Some(_)) => (
            format!(
                "SELECT * FROM store_catalog WHERE tenant_id = $1 \
                 AND (name ILIKE $2 OR code ILIKE $2) AND category = $3{active_filter} \
                 ORDER BY name"
            ),
            true,
            true,
        ),
        (Some(_), None) => (
            format!(
                "SELECT * FROM store_catalog WHERE tenant_id = $1 \
                 AND (name ILIKE $2 OR code ILIKE $2){active_filter} ORDER BY name"
            ),
            true,
            false,
        ),
        (None, Some(_)) => (
            format!(
                "SELECT * FROM store_catalog WHERE tenant_id = $1 \
                 AND category = $2{active_filter} ORDER BY name"
            ),
            false,
            true,
        ),
        (None, None) => (
            format!(
                "SELECT * FROM store_catalog WHERE tenant_id = $1{active_filter} \
                 ORDER BY name"
            ),
            false,
            false,
        ),
    };

    let mut query = sqlx::query_as::<_, StoreCatalog>(&sql).bind(claims.tenant_id);
    if has_search {
        let pattern = format!("%{}%", params.search.as_deref().unwrap_or(""));
        query = query.bind(pattern);
    }
    if has_category {
        query = query.bind(params.category.as_deref().unwrap_or(""));
    }

    let items = query.fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(items))
}

pub async fn create_catalog_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCatalogRequest>,
) -> Result<Json<StoreCatalog>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let item = sqlx::query_as::<_, StoreCatalog>(
        "INSERT INTO store_catalog \
         (tenant_id, code, name, category, sub_category, unit, base_price, reorder_level) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.sub_category)
    .bind(body.unit.as_deref().unwrap_or("unit"))
    .bind(body.base_price.unwrap_or(Decimal::ZERO))
    .bind(body.reorder_level.unwrap_or(0))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(item))
}

pub async fn update_catalog_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCatalogRequest>,
) -> Result<Json<StoreCatalog>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let item = sqlx::query_as::<_, StoreCatalog>(
        "UPDATE store_catalog SET \
         name = COALESCE($3, name), \
         category = COALESCE($4, category), \
         sub_category = COALESCE($5, sub_category), \
         unit = COALESCE($6, unit), \
         base_price = COALESCE($7, base_price), \
         reorder_level = COALESCE($8, reorder_level), \
         is_active = COALESCE($9, is_active), \
         ved_class = COALESCE($10::ved_class, ved_class), \
         is_implant = COALESCE($11, is_implant), \
         is_high_value = COALESCE($12, is_high_value), \
         hsn_code = COALESCE($13, hsn_code), \
         bin_location = COALESCE($14, bin_location), \
         min_stock = COALESCE($15, min_stock), \
         max_stock = COALESCE($16, max_stock), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.sub_category)
    .bind(&body.unit)
    .bind(body.base_price)
    .bind(body.reorder_level)
    .bind(body.is_active)
    .bind(&body.ved_class)
    .bind(body.is_implant)
    .bind(body.is_high_value)
    .bind(&body.hsn_code)
    .bind(&body.bin_location)
    .bind(body.min_stock)
    .bind(body.max_stock)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(item))
}

// ══════════════════════════════════════════════════════════
//  Stock Movements
// ══════════════════════════════════════════════════════════

pub async fn list_stock_movements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListStockMovementsQuery>,
) -> Result<Json<StockMovementListResponse>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (count_sql, data_sql, has_item, has_type) =
        match (&params.catalog_item_id, &params.movement_type) {
            (Some(_), Some(_)) => (
                "SELECT COUNT(*) FROM store_stock_movements \
                 WHERE tenant_id = $1 AND catalog_item_id = $2 \
                 AND movement_type = $3"
                    .to_owned(),
                "SELECT * FROM store_stock_movements \
                 WHERE tenant_id = $1 AND catalog_item_id = $2 \
                 AND movement_type = $3 \
                 ORDER BY created_at DESC LIMIT $4 OFFSET $5"
                    .to_owned(),
                true,
                true,
            ),
            (Some(_), None) => (
                "SELECT COUNT(*) FROM store_stock_movements \
                 WHERE tenant_id = $1 AND catalog_item_id = $2"
                    .to_owned(),
                "SELECT * FROM store_stock_movements \
                 WHERE tenant_id = $1 AND catalog_item_id = $2 \
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
                    .to_owned(),
                true,
                false,
            ),
            (None, Some(_)) => (
                "SELECT COUNT(*) FROM store_stock_movements \
                 WHERE tenant_id = $1 AND movement_type = $2"
                    .to_owned(),
                "SELECT * FROM store_stock_movements \
                 WHERE tenant_id = $1 AND movement_type = $2 \
                 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
                    .to_owned(),
                false,
                true,
            ),
            (None, None) => (
                "SELECT COUNT(*) FROM store_stock_movements \
                 WHERE tenant_id = $1"
                    .to_owned(),
                "SELECT * FROM store_stock_movements \
                 WHERE tenant_id = $1 \
                 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
                    .to_owned(),
                false,
                false,
            ),
        };

    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    if has_item {
        cq = cq.bind(params.catalog_item_id);
    }
    if has_type {
        cq = cq.bind(params.movement_type.as_deref().unwrap_or(""));
    }
    let total = cq.fetch_one(&mut *tx).await?;

    let mut dq = sqlx::query_as::<_, StoreStockMovement>(&data_sql).bind(claims.tenant_id);
    if has_item {
        dq = dq.bind(params.catalog_item_id);
    }
    if has_type {
        dq = dq.bind(params.movement_type.as_deref().unwrap_or(""));
    }
    let movements = dq.bind(per_page).bind(offset).fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(StockMovementListResponse {
        movements,
        total,
        page,
        per_page,
    }))
}

pub async fn create_stock_movement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStockMovementRequest>,
) -> Result<Json<StoreStockMovement>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let movement = sqlx::query_as::<_, StoreStockMovement>(
        "INSERT INTO store_stock_movements \
         (tenant_id, catalog_item_id, movement_type, quantity, \
          reference_type, reference_id, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&body.movement_type)
    .bind(body.quantity)
    .bind(&body.reference_type)
    .bind(body.reference_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Update current_stock on catalog
    let stock_delta = match body.movement_type.as_str() {
        "issue" | "transfer" => -body.quantity,
        // receipt, return, adjustment: use signed quantity directly
        _ => body.quantity,
    };

    sqlx::query(
        "UPDATE store_catalog \
         SET current_stock = current_stock + $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(stock_delta)
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(movement))
}

// ══════════════════════════════════════════════════════════
//  Analytics request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct AnalyticsDateQuery {
    pub from: Option<String>,
    pub to: Option<String>,
    pub department_id: Option<Uuid>,
    pub days_threshold: Option<i64>,
}

// ══════════════════════════════════════════════════════════
//  Patient Consumable request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListConsumablesQuery {
    pub patient_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IssueToPatientRequest {
    pub patient_id: Uuid,
    pub catalog_item_id: Uuid,
    pub batch_stock_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub quantity: i32,
    pub unit_price: Option<Decimal>,
    pub is_chargeable: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DepartmentIssueRequest {
    pub catalog_item_id: Uuid,
    pub department_id: Uuid,
    pub quantity: i32,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReturnToStoreRequest {
    pub catalog_item_id: Uuid,
    pub quantity: i32,
    pub department_id: Option<Uuid>,
    pub patient_consumable_id: Option<Uuid>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Implant request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListImplantQuery {
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateImplantRequest {
    pub catalog_item_id: Uuid,
    pub batch_stock_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub serial_number: Option<String>,
    pub implant_date: String,
    pub implant_site: Option<String>,
    pub surgeon_id: Option<Uuid>,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub warranty_expiry: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateImplantRequest {
    pub implant_site: Option<String>,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub warranty_expiry: Option<String>,
    pub removal_date: Option<String>,
    pub removal_reason: Option<String>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Condemnation request types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListCondemnationQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCondemnationRequest {
    pub catalog_item_id: Uuid,
    pub reason: String,
    pub current_value: Option<Decimal>,
    pub purchase_value: Option<Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCondemnationStatusRequest {
    pub status: String,
    pub committee_remarks: Option<String>,
    pub disposal_method: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/consumption
// ══════════════════════════════════════════════════════════

pub async fn consumption_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateQuery>,
) -> Result<Json<Vec<ConsumptionAnalysisRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let from = params.from.as_deref().unwrap_or("2000-01-01");
    let to = params.to.as_deref().unwrap_or("2099-12-31");

    let rows = if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, ConsumptionAnalysisRow>(
            "SELECT sc.name AS item_name, d.name AS department_name, \
             COALESCE(SUM(ABS(m.quantity)), 0)::BIGINT AS total_issued, \
             COALESCE(SUM(ABS(m.quantity) * sc.base_price), 0) AS total_value \
             FROM store_stock_movements m \
             JOIN store_catalog sc ON sc.id = m.catalog_item_id \
             LEFT JOIN departments d ON d.id = m.department_id \
             WHERE m.tenant_id = $1 AND m.movement_type = 'issue' \
             AND m.created_at >= $2::TIMESTAMPTZ AND m.created_at <= $3::TIMESTAMPTZ \
             AND m.department_id = $4 \
             GROUP BY sc.name, d.name ORDER BY total_value DESC",
        )
        .bind(claims.tenant_id)
        .bind(from)
        .bind(to)
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, ConsumptionAnalysisRow>(
            "SELECT sc.name AS item_name, d.name AS department_name, \
             COALESCE(SUM(ABS(m.quantity)), 0)::BIGINT AS total_issued, \
             COALESCE(SUM(ABS(m.quantity) * sc.base_price), 0) AS total_value \
             FROM store_stock_movements m \
             JOIN store_catalog sc ON sc.id = m.catalog_item_id \
             LEFT JOIN departments d ON d.id = m.department_id \
             WHERE m.tenant_id = $1 AND m.movement_type = 'issue' \
             AND m.created_at >= $2::TIMESTAMPTZ AND m.created_at <= $3::TIMESTAMPTZ \
             GROUP BY sc.name, d.name ORDER BY total_value DESC",
        )
        .bind(claims.tenant_id)
        .bind(from)
        .bind(to)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/dead-stock
// ══════════════════════════════════════════════════════════

pub async fn dead_stock_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateQuery>,
) -> Result<Json<Vec<DeadStockRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let days = params.days_threshold.unwrap_or(90);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DeadStockRow>(
        "SELECT sc.name AS item_name, sc.current_stock, \
         (sc.current_stock * sc.base_price) AS stock_value, \
         sc.last_issue_date AS last_movement_date, \
         EXTRACT(DAY FROM now() - COALESCE(sc.last_issue_date, sc.created_at))::BIGINT AS days_idle \
         FROM store_catalog sc \
         WHERE sc.tenant_id = $1 AND sc.current_stock > 0 \
         AND (sc.last_issue_date IS NULL OR sc.last_issue_date < now() - ($2 || ' days')::INTERVAL) \
         ORDER BY stock_value DESC",
    )
    .bind(claims.tenant_id)
    .bind(days.to_string())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/purchase-vs-consumption
// ══════════════════════════════════════════════════════════

pub async fn purchase_consumption_trend(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateQuery>,
) -> Result<Json<Vec<PurchaseConsumptionTrendRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let from = params.from.as_deref().unwrap_or("2000-01-01");
    let to = params.to.as_deref().unwrap_or("2099-12-31");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PurchaseConsumptionTrendRow>(
        "SELECT TO_CHAR(created_at, 'YYYY-MM') AS period, \
         COALESCE(SUM(CASE WHEN movement_type = 'receipt' THEN ABS(quantity) ELSE 0 END), 0)::BIGINT AS total_purchased, \
         COALESCE(SUM(CASE WHEN movement_type = 'issue' THEN ABS(quantity) ELSE 0 END), 0)::BIGINT AS total_consumed, \
         COALESCE(SUM(CASE WHEN movement_type = 'receipt' THEN ABS(quantity) ELSE -ABS(quantity) END), 0)::BIGINT AS net_change \
         FROM store_stock_movements \
         WHERE tenant_id = $1 AND movement_type IN ('receipt', 'issue') \
         AND created_at >= $2::TIMESTAMPTZ AND created_at <= $3::TIMESTAMPTZ \
         GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY period",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/valuation
// ══════════════════════════════════════════════════════════

pub async fn inventory_valuation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<InventoryValuationRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InventoryValuationRow>(
        "SELECT sc.name AS item_name, sc.category, sc.current_stock, \
         COALESCE(AVG(bs.unit_cost), sc.base_price) AS avg_unit_cost, \
         (sc.current_stock * COALESCE(AVG(bs.unit_cost), sc.base_price)) AS total_value \
         FROM store_catalog sc \
         LEFT JOIN batch_stock bs ON bs.catalog_item_id = sc.id AND bs.tenant_id = sc.tenant_id AND bs.quantity > 0 \
         WHERE sc.tenant_id = $1 AND sc.current_stock > 0 \
         GROUP BY sc.id, sc.name, sc.category, sc.current_stock, sc.base_price \
         ORDER BY total_value DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/compliance
// ══════════════════════════════════════════════════════════

pub async fn compliance_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ComplianceCheckRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut checks: Vec<ComplianceCheckRow> = Vec::new();

    // Check: items without reorder levels
    let no_reorder = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND reorder_level = 0 AND is_active = true",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    checks.push(ComplianceCheckRow {
        check_name: "Reorder levels configured".to_owned(),
        status: if no_reorder == 0 { "pass" } else { "fail" }.to_owned(),
        detail: format!("{no_reorder} active items without reorder levels"),
    });

    // Check: expired batches still in stock
    let expired = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM batch_stock WHERE tenant_id = $1 AND quantity > 0 AND expiry_date < CURRENT_DATE",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    checks.push(ComplianceCheckRow {
        check_name: "No expired stock".to_owned(),
        status: if expired == 0 { "pass" } else { "fail" }.to_owned(),
        detail: format!("{expired} expired batches with positive stock"),
    });

    // Check: items without VED classification
    let no_ved = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND ved_class IS NULL AND is_active = true",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    checks.push(ComplianceCheckRow {
        check_name: "VED classification complete".to_owned(),
        status: if no_ved == 0 { "pass" } else { "fail" }.to_owned(),
        detail: format!("{no_ved} active items without VED class"),
    });

    // Check: negative stock
    let negative = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM store_catalog WHERE tenant_id = $1 AND current_stock < 0",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    checks.push(ComplianceCheckRow {
        check_name: "No negative stock".to_owned(),
        status: if negative == 0 { "pass" } else { "fail" }.to_owned(),
        detail: format!("{negative} items with negative stock"),
    });

    tx.commit().await?;
    Ok(Json(checks))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/fsn
// ══════════════════════════════════════════════════════════

pub async fn fsn_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<AnalyticsDateQuery>,
) -> Result<Json<Vec<FsnAnalysisRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let fast_days = params.days_threshold.unwrap_or(30);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FsnAnalysisRow>(
        "SELECT sc.name AS item_name, sc.last_issue_date, \
         EXTRACT(DAY FROM now() - COALESCE(sc.last_issue_date, sc.created_at))::BIGINT AS days_since_last_issue, \
         CASE \
           WHEN sc.last_issue_date IS NOT NULL AND sc.last_issue_date >= now() - ($2 || ' days')::INTERVAL THEN 'fast' \
           WHEN sc.last_issue_date IS NOT NULL AND sc.last_issue_date >= now() - (($2 * 3) || ' days')::INTERVAL THEN 'slow' \
           ELSE 'non_moving' \
         END AS fsn_class \
         FROM store_catalog sc \
         WHERE sc.tenant_id = $1 AND sc.is_active = true \
         ORDER BY days_since_last_issue ASC NULLS LAST",
    )
    .bind(claims.tenant_id)
    .bind(fast_days.to_string())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/abc
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct AbcRawRow {
    item_name: String,
    annual_value: Decimal,
}

pub async fn abc_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AbcAnalysisRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let raw = sqlx::query_as::<_, AbcRawRow>(
        "SELECT sc.name AS item_name, \
         COALESCE(SUM(ABS(m.quantity) * sc.base_price), 0) AS annual_value \
         FROM store_catalog sc \
         LEFT JOIN store_stock_movements m ON m.catalog_item_id = sc.id \
           AND m.tenant_id = sc.tenant_id AND m.movement_type = 'issue' \
           AND m.created_at >= now() - INTERVAL '1 year' \
         WHERE sc.tenant_id = $1 AND sc.is_active = true \
         GROUP BY sc.id, sc.name ORDER BY annual_value DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let grand_total: Decimal = raw.iter().map(|r| r.annual_value).sum();
    let mut cumulative = Decimal::ZERO;
    let mut result = Vec::with_capacity(raw.len());

    for r in raw {
        cumulative += r.annual_value;
        let pct = if grand_total > Decimal::ZERO {
            (cumulative * Decimal::from(100) / grand_total)
                .to_string()
                .parse::<f64>()
                .unwrap_or(0.0)
        } else {
            0.0
        };
        let class = if pct <= 70.0 {
            "A"
        } else if pct <= 90.0 {
            "B"
        } else {
            "C"
        };
        result.push(AbcAnalysisRow {
            item_name: r.item_name,
            annual_value: r.annual_value,
            cumulative_pct: pct,
            abc_class: class.to_owned(),
        });
    }

    Ok(Json(result))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/analytics/ved
// ══════════════════════════════════════════════════════════

pub async fn ved_analysis(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<VedAnalysisRow>>, AppError> {
    require_permission(&claims, permissions::indent::ANALYTICS_VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, VedAnalysisRow>(
        "SELECT name AS item_name, ved_class::TEXT AS ved_class, \
         current_stock, reorder_level \
         FROM store_catalog \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY ved_class NULLS LAST, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/indent/department-issues
// ══════════════════════════════════════════════════════════

pub async fn department_issue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DepartmentIssueRequest>,
) -> Result<Json<StoreStockMovement>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    if body.quantity <= 0 {
        return Err(AppError::BadRequest("Quantity must be positive".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let movement = sqlx::query_as::<_, StoreStockMovement>(
        "INSERT INTO store_stock_movements \
         (tenant_id, catalog_item_id, movement_type, quantity, \
          department_id, reference_type, notes, created_by) \
         VALUES ($1, $2, 'issue', $3, $4, 'department_issue', $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(-body.quantity)
    .bind(body.department_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock - $1, \
         last_issue_date = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.quantity)
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(movement))
}

// ══════════════════════════════════════════════════════════
//  POST /api/indent/patient-consumables
// ══════════════════════════════════════════════════════════

pub async fn issue_to_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueToPatientRequest>,
) -> Result<Json<PatientConsumableIssue>, AppError> {
    require_permission(&claims, permissions::indent::CONSUMABLES_MANAGE)?;

    if body.quantity <= 0 {
        return Err(AppError::BadRequest("Quantity must be positive".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let unit_price = body.unit_price.unwrap_or(Decimal::ZERO);
    let chargeable = body.is_chargeable.unwrap_or(true);

    let issue = sqlx::query_as::<_, PatientConsumableIssue>(
        "INSERT INTO patient_consumable_issues \
         (tenant_id, patient_id, catalog_item_id, batch_stock_id, department_id, \
          encounter_id, admission_id, quantity, unit_price, is_chargeable, \
          issued_by, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.catalog_item_id)
    .bind(body.batch_stock_id)
    .bind(body.department_id)
    .bind(body.encounter_id)
    .bind(body.admission_id)
    .bind(body.quantity)
    .bind(unit_price)
    .bind(chargeable)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Decrement stock + update last_issue_date
    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock - $1, \
         last_issue_date = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.quantity)
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Create stock movement
    sqlx::query(
        "INSERT INTO store_stock_movements \
         (tenant_id, catalog_item_id, movement_type, quantity, \
          patient_id, department_id, batch_stock_id, reference_type, reference_id, created_by) \
         VALUES ($1,$2,'issue',$3,$4,$5,$6,'patient_consumable',$7,$8)",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(-body.quantity)
    .bind(body.patient_id)
    .bind(body.department_id)
    .bind(body.batch_stock_id)
    .bind(issue.id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(issue))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/patient-consumables
// ══════════════════════════════════════════════════════════

pub async fn list_patient_consumables(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListConsumablesQuery>,
) -> Result<Json<Vec<PatientConsumableIssue>>, AppError> {
    require_permission(&claims, permissions::indent::CONSUMABLES_LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(patient_id) = params.patient_id {
        sqlx::query_as::<_, PatientConsumableIssue>(
            "SELECT * FROM patient_consumable_issues \
             WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(patient_id)
        .fetch_all(&mut *tx)
        .await?
    } else if let Some(dept_id) = params.department_id {
        sqlx::query_as::<_, PatientConsumableIssue>(
            "SELECT * FROM patient_consumable_issues \
             WHERE tenant_id = $1 AND department_id = $2 ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(dept_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PatientConsumableIssue>(
            "SELECT * FROM patient_consumable_issues \
             WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  POST /api/indent/returns
// ══════════════════════════════════════════════════════════

pub async fn return_to_store(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReturnToStoreRequest>,
) -> Result<Json<StoreStockMovement>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    if body.quantity <= 0 {
        return Err(AppError::BadRequest("Quantity must be positive".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let movement = sqlx::query_as::<_, StoreStockMovement>(
        "INSERT INTO store_stock_movements \
         (tenant_id, catalog_item_id, movement_type, quantity, \
          department_id, reference_type, notes, created_by) \
         VALUES ($1, $2, 'return', $3, $4, 'return', $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(body.quantity)
    .bind(body.department_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock + $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.quantity)
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Update patient consumable returned_qty if applicable
    if let Some(pc_id) = body.patient_consumable_id {
        sqlx::query(
            "UPDATE patient_consumable_issues SET returned_qty = returned_qty + $1, \
             status = CASE WHEN returned_qty + $1 >= quantity THEN 'returned'::consumable_issue_status ELSE status END, \
             updated_at = now() \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(body.quantity)
        .bind(pc_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(movement))
}

// ══════════════════════════════════════════════════════════
//  GET /api/indent/consignment-stock
// ══════════════════════════════════════════════════════════

pub async fn list_consignment_stock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<medbrains_core::procurement::BatchStock>>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let batches = sqlx::query_as::<_, medbrains_core::procurement::BatchStock>(
        "SELECT * FROM batch_stock WHERE tenant_id = $1 AND is_consignment = true AND quantity > 0 \
         ORDER BY expiry_date ASC NULLS LAST",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(batches))
}

// ══════════════════════════════════════════════════════════
//  POST /api/indent/consignment-usage
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ConsignmentUsageRequest {
    pub batch_stock_id: Uuid,
    pub quantity: i32,
    pub patient_id: Option<Uuid>,
    pub notes: Option<String>,
}

pub async fn record_consignment_usage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ConsignmentUsageRequest>,
) -> Result<Json<StoreStockMovement>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    if body.quantity <= 0 {
        return Err(AppError::BadRequest("Quantity must be positive".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get batch to find catalog_item_id
    let batch = sqlx::query_as::<_, medbrains_core::procurement::BatchStock>(
        "SELECT * FROM batch_stock WHERE id = $1 AND tenant_id = $2 AND is_consignment = true",
    )
    .bind(body.batch_stock_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Consignment batch not found".into()))?;

    // Decrement batch stock
    sqlx::query(
        "UPDATE batch_stock SET quantity = quantity - $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.quantity)
    .bind(body.batch_stock_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Decrement catalog stock
    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock - $1, \
         last_issue_date = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(body.quantity)
    .bind(batch.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let movement = sqlx::query_as::<_, StoreStockMovement>(
        "INSERT INTO store_stock_movements \
         (tenant_id, catalog_item_id, movement_type, quantity, \
          batch_stock_id, patient_id, reference_type, notes, created_by) \
         VALUES ($1,$2,'issue',$3,$4,$5,'consignment_usage',$6,$7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(batch.catalog_item_id)
    .bind(-body.quantity)
    .bind(body.batch_stock_id)
    .bind(body.patient_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(movement))
}

// ══════════════════════════════════════════════════════════
//  Implant Registry
// ══════════════════════════════════════════════════════════

pub async fn list_implant_registry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListImplantQuery>,
) -> Result<Json<Vec<ImplantRegistryEntry>>, AppError> {
    require_permission(&claims, permissions::indent::IMPLANTS_LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(patient_id) = params.patient_id {
        sqlx::query_as::<_, ImplantRegistryEntry>(
            "SELECT * FROM implant_registry WHERE tenant_id = $1 AND patient_id = $2 \
             ORDER BY implant_date DESC",
        )
        .bind(claims.tenant_id)
        .bind(patient_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, ImplantRegistryEntry>(
            "SELECT * FROM implant_registry WHERE tenant_id = $1 \
             ORDER BY implant_date DESC LIMIT 200",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_implant_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateImplantRequest>,
) -> Result<Json<ImplantRegistryEntry>, AppError> {
    require_permission(&claims, permissions::indent::IMPLANTS_MANAGE)?;

    let implant_date = NaiveDate::parse_from_str(&body.implant_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid implant_date format".into()))?;
    let warranty = body
        .warranty_expiry
        .as_deref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, ImplantRegistryEntry>(
        "INSERT INTO implant_registry \
         (tenant_id, catalog_item_id, batch_stock_id, patient_id, serial_number, \
          implant_date, implant_site, surgeon_id, manufacturer, model_number, \
          warranty_expiry, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(body.batch_stock_id)
    .bind(body.patient_id)
    .bind(&body.serial_number)
    .bind(implant_date)
    .bind(&body.implant_site)
    .bind(body.surgeon_id)
    .bind(&body.manufacturer)
    .bind(&body.model_number)
    .bind(warranty)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Decrement stock for implant
    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock - 1, \
         last_issue_date = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(entry))
}

pub async fn update_implant_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateImplantRequest>,
) -> Result<Json<ImplantRegistryEntry>, AppError> {
    require_permission(&claims, permissions::indent::IMPLANTS_MANAGE)?;

    let warranty = body
        .warranty_expiry
        .as_deref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    let removal = body
        .removal_date
        .as_deref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, ImplantRegistryEntry>(
        "UPDATE implant_registry SET \
         implant_site = COALESCE($3, implant_site), \
         manufacturer = COALESCE($4, manufacturer), \
         model_number = COALESCE($5, model_number), \
         warranty_expiry = COALESCE($6, warranty_expiry), \
         removal_date = COALESCE($7, removal_date), \
         removal_reason = COALESCE($8, removal_reason), \
         notes = COALESCE($9, notes), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.implant_site)
    .bind(&body.manufacturer)
    .bind(&body.model_number)
    .bind(warranty)
    .bind(removal)
    .bind(&body.removal_reason)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(entry))
}

// ══════════════════════════════════════════════════════════
//  Condemnations
// ══════════════════════════════════════════════════════════

pub async fn list_condemnations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCondemnationQuery>,
) -> Result<Json<Vec<EquipmentCondemnation>>, AppError> {
    require_permission(&claims, permissions::indent::CONDEMNATION_LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(ref status) = params.status {
        sqlx::query_as::<_, EquipmentCondemnation>(
            "SELECT * FROM equipment_condemnations \
             WHERE tenant_id = $1 AND status = $2::condemnation_status \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .bind(status)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, EquipmentCondemnation>(
            "SELECT * FROM equipment_condemnations WHERE tenant_id = $1 \
             ORDER BY created_at DESC",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_condemnation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCondemnationRequest>,
) -> Result<Json<EquipmentCondemnation>, AppError> {
    require_permission(&claims, permissions::indent::CONDEMNATION_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
    let cond_number = format!("COND-{ts}");

    let entry = sqlx::query_as::<_, EquipmentCondemnation>(
        "INSERT INTO equipment_condemnations \
         (tenant_id, catalog_item_id, condemnation_number, reason, \
          current_value, purchase_value, initiated_by, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(&cond_number)
    .bind(&body.reason)
    .bind(body.current_value.unwrap_or(Decimal::ZERO))
    .bind(body.purchase_value.unwrap_or(Decimal::ZERO))
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(entry))
}

pub async fn update_condemnation_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCondemnationStatusRequest>,
) -> Result<Json<EquipmentCondemnation>, AppError> {
    require_permission(&claims, permissions::indent::CONDEMNATION_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let entry = sqlx::query_as::<_, EquipmentCondemnation>(
        "UPDATE equipment_condemnations SET \
         status = $3::condemnation_status, \
         committee_remarks = COALESCE($4, committee_remarks), \
         disposal_method = COALESCE($5, disposal_method), \
         approved_by = CASE WHEN $3 IN ('approved', 'condemned') THEN $6 ELSE approved_by END, \
         approved_at = CASE WHEN $3 IN ('approved', 'condemned') THEN now() ELSE approved_at END, \
         disposed_at = CASE WHEN $3 = 'condemned' THEN now() ELSE disposed_at END, \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(&body.committee_remarks)
    .bind(&body.disposal_method)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // On condemned: deactivate catalog item stock
    if body.status == "condemned" {
        sqlx::query(
            "UPDATE store_catalog SET current_stock = GREATEST(current_stock - 1, 0), updated_at = now() \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(entry.catalog_item_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(entry))
}

// ══════════════════════════════════════════════════════════
//  Reorder Alerts
// ══════════════════════════════════════════════════════════

pub async fn check_reorder_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ReorderAlert>>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Create alerts for items below reorder level
    sqlx::query(
        "INSERT INTO reorder_alerts (tenant_id, catalog_item_id, alert_type, current_stock, threshold_level) \
         SELECT $1, id, 'below_reorder', current_stock, reorder_level \
         FROM store_catalog \
         WHERE tenant_id = $1 AND is_active = true AND reorder_level > 0 \
         AND current_stock <= reorder_level \
         AND id NOT IN (SELECT catalog_item_id FROM reorder_alerts WHERE tenant_id = $1 AND is_acknowledged = false) \
         ON CONFLICT DO NOTHING",
    )
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    let alerts = sqlx::query_as::<_, ReorderAlert>(
        "SELECT * FROM reorder_alerts WHERE tenant_id = $1 AND is_acknowledged = false \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(alerts))
}

pub async fn list_reorder_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ReorderAlert>>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let alerts = sqlx::query_as::<_, ReorderAlert>(
        "SELECT * FROM reorder_alerts WHERE tenant_id = $1 ORDER BY is_acknowledged, created_at DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(alerts))
}

pub async fn acknowledge_alert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReorderAlert>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let alert = sqlx::query_as::<_, ReorderAlert>(
        "UPDATE reorder_alerts SET is_acknowledged = true, \
         acknowledged_by = $3, acknowledged_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(alert))
}

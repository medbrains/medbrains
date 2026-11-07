//! Billing → Charges needing attention: automatic charges a clinical action
//! could not post, put on the queue by `charge_or_queue` (migration 1411).
//!
//! The desk posts one — the same charge the module meant, rebuilt from the
//! row — or dismisses it with a reason. Either way the row records who and
//! when, and the table's audit trigger keeps the change.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_services::billing::{AutoChargeInput, ChargeRequest, post_charge};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    pagination::{Paginated, Pagination},
    state::AppState,
};

/// One queued charge, with the patient and people joined.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChargeAttentionItem {
    pub id: Uuid,
    pub source_module: String,
    pub setting_module: String,
    pub source_entity_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub charge_code: String,
    pub quantity: i32,
    pub description_override: Option<String>,
    pub unit_price_override: Option<Decimal>,
    pub tax_percent_override: Option<Decimal>,
    pub apply_concessions: bool,
    pub reason: String,
    pub status: String,
    pub invoice_id: Option<Uuid>,
    pub dismiss_reason: Option<String>,
    pub resolved_by_name: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub patient_name: String,
    pub uhid: String,
}

/// The queue's one query: item, patient and both people joined once.
const ITEM_SELECT: &str = "SELECT a.id, a.source_module, a.setting_module, a.source_entity_id, \
        a.patient_id, a.encounter_id, a.charge_code, a.quantity, a.description_override, \
        a.unit_price_override, a.tax_percent_override, a.apply_concessions, a.reason, a.status, \
        a.invoice_id, a.dismiss_reason, ru.full_name AS resolved_by_name, a.resolved_at, \
        cu.full_name AS created_by_name, a.created_at, \
        btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid \
   FROM charge_attention_items a \
   JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
   LEFT JOIN users ru ON ru.id = a.resolved_by \
   LEFT JOIN users cu ON cu.id = a.created_by";

#[derive(Debug, Deserialize)]
pub struct ListChargeAttentionQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// `GET /api/billing/charge-attention` — the queue, newest first. The menu
/// badge reads `meta.total` of `status=open&limit=1`.
pub async fn list_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListChargeAttentionQuery>,
) -> Result<Json<Paginated<ChargeAttentionItem>>, AppError> {
    require_permission(&claims, permissions::billing::charge_attention::VIEW)?;
    let visible =
        medbrains_authz_gate::require_patient_billing_filter(&state, &claims, None).await?;
    let hide_amounts = crate::amounts_hidden(&state, &claims).await?;
    let page = Pagination {
        page: q.page,
        limit: q.limit,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let filter = "a.tenant_id = $1 AND a.deleted_at IS NULL \
        AND ($2::text IS NULL OR a.status = $2) \
        AND ($3::uuid[] IS NULL OR a.patient_id = ANY($3))";
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM charge_attention_items a WHERE {filter}"
    ))
    .bind(claims.tenant_id)
    .bind(&q.status)
    .bind(&visible)
    .fetch_one(&mut *tx)
    .await?;
    let mut rows = sqlx::query_as::<_, ChargeAttentionItem>(&format!(
        "{ITEM_SELECT} WHERE {filter} ORDER BY a.created_at DESC LIMIT $4 OFFSET $5"
    ))
    .bind(claims.tenant_id)
    .bind(&q.status)
    .bind(&visible)
    .bind(page.limit())
    .bind(page.offset())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    if hide_amounts {
        for row in &mut rows {
            row.unit_price_override = None;
        }
    }
    Ok(Json(Paginated::new(rows, total, &page)))
}

/// `PUT /api/billing/charge-attention/{id}/post` — post the queued charge
/// onto the patient's bill. A charge that still fails answers the error and
/// the item stays open.
pub async fn post_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    require_permission(&claims, permissions::billing::charge_attention::RESOLVE)?;
    crate::require_amount_write(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let item = lock_open(&mut tx, &claims, id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, item.patient_id).await?;
    let req = ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: &item.setting_module,
        charge: AutoChargeInput {
            patient_id: item.patient_id,
            encounter_id: item.encounter_id,
            charge_code: item.charge_code.clone(),
            source: item.source_module.clone(),
            source_id: item.source_entity_id,
            quantity: item.quantity,
            description_override: item.description_override.clone(),
            unit_price_override: item.unit_price_override,
            tax_percent_override: item.tax_percent_override,
        },
        apply_concessions: item.apply_concessions,
    };
    let posted = post_charge(&mut tx, &req).await?;
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'posted', invoice_id = $3, \
                resolved_by = $4, resolved_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(posted.invoice_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct DismissRequest {
    pub reason: String,
}

/// `PUT /api/billing/charge-attention/{id}/dismiss` — the charge should not
/// be billed; the reason is required and kept.
pub async fn dismiss_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DismissRequest>,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    require_permission(&claims, permissions::billing::charge_attention::RESOLVE)?;
    let reason = body.reason.trim();
    if reason.chars().count() < 3 {
        return Err(AppError::BadRequest(
            "billing.chargeAttention.reasonRequired".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let item = lock_open(&mut tx, &claims, id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, item.patient_id).await?;
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'dismissed', dismiss_reason = $3, \
                resolved_by = $4, resolved_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// The open item, locked for this decision. Already resolved is a conflict;
/// missing (or another tenant's) is 404.
async fn lock_open(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<ChargeAttentionItem, AppError> {
    let status: String = sqlx::query_scalar(
        "SELECT status FROM charge_attention_items \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if status != "open" {
        return Err(AppError::Conflict(
            "billing.chargeAttention.alreadyResolved".to_owned(),
        ));
    }
    fetch(tx, claims.tenant_id, id).await
}

/// One item by id, joined as the list shows it.
async fn fetch(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<ChargeAttentionItem, AppError> {
    Ok(sqlx::query_as::<_, ChargeAttentionItem>(&format!(
        "{ITEM_SELECT} WHERE a.id = $1 AND a.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?)
}

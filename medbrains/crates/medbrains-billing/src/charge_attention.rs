//! Billing → Charges needing attention: automatic charges a clinical action
//! could not post, put on the queue by `charge_or_queue` (migration 1411).
//!
//! The desk posts one — the same charge the module meant, rebuilt from the
//! row — or dismisses it with a reason. Either way the row records who and
//! when, and the table's audit trigger keeps the change.
//!
//! The same queue carries the orders done but never billed that the leakage
//! check finds (`leakage`, reason `unbilled_order`). Those rows are seen and
//! worked under `billing.leakage.*`; the rest under `billing.charge_attention.*`.
//! A row of a kind the caller may not work answers 404, as if absent.

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

use medbrains_kernel::{Actor, KernelError, require_any_permission, require_permission};
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    pagination::{Paginated, Pagination},
    state::AppState,
};
use sqlx::PgConnection;

mod duplicate;
mod name_patient;
mod select;
use name_patient::require_row_access;
pub use name_patient::{NamePatientRequest, name_patient_charge_attention};
use select::ITEM_SELECT;

/// One queued charge, with the patient and people joined.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChargeAttentionItem {
    pub id: Uuid,
    pub source_module: String,
    pub setting_module: String,
    pub source_entity_id: Uuid,
    /// `None` only on an implant used with no patient named, until the desk
    /// names one.
    pub patient_id: Option<Uuid>,
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
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub department_id: Option<Uuid>,
    pub department_name: Option<String>,
    /// When the service was done (leakage rows); the age counts from here.
    pub service_at: Option<DateTime<Utc>>,
    /// Whole days since the service (or, without one, since it was queued).
    pub age_days: i32,
    /// Unit price × quantity, when the row carries a price.
    pub amount: Option<Decimal>,
    /// On an implant used without a patient: who the implant registry has
    /// an implant of the same batch for, near the usage date. A hint that
    /// it may be the same implant. Only in the list, for an unscoped desk.
    pub registry_patients: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListChargeAttentionQuery {
    pub status: Option<String>,
    /// `unbilled` (leakage rows) or `failed` (charges a module could not post).
    pub kind: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Which kinds of row the caller may see (or work): failed charges,
/// unbilled orders.
#[derive(Debug, Clone, Copy)]
struct Kinds {
    failed: bool,
    unbilled: bool,
}

/// The rows' kind filter in SQL, bound as `$n` (failed) and `$n+1`
/// (leakage: unbilled orders and stock, implants with no patient).
/// Charge rows only: the insurance kinds on the same table are
/// `revenue_alerts`', under their own permissions.
fn kind_filter(n: u8) -> String {
    let leak = crate::leakage::LEAKAGE_REASONS_SQL;
    format!(
        "a.kind = 'charge_not_posted' \
         AND (${n} OR a.reason NOT IN {leak}) AND (${} OR a.reason IN {leak})",
        n + 1
    )
}

/// Whether the caller holds `perm`. A refusal is `false`; any other fault is
/// returned, never read as a refusal.
fn holds(claims: &Claims, perm: &str) -> Result<bool, AppError> {
    match require_permission(claims, perm) {
        Ok(()) => Ok(true),
        Err(KernelError::Forbidden) => Ok(false),
        Err(other) => Err(other.into()),
    }
}

/// The kinds the caller may see (`resolve` false) or work (`resolve` true);
/// holding neither permission is a 403.
fn kinds(claims: &Claims, resolve: bool) -> Result<Kinds, AppError> {
    let (failed, unbilled) = if resolve {
        (
            permissions::billing::charge_attention::RESOLVE,
            permissions::billing::leakage::RESOLVE,
        )
    } else {
        (
            permissions::billing::charge_attention::VIEW,
            permissions::billing::leakage::VIEW,
        )
    };
    require_any_permission(claims, &[failed, unbilled])?;
    Ok(Kinds {
        failed: holds(claims, failed)?,
        unbilled: holds(claims, unbilled)?,
    })
}

/// The list's filter: tenant, status (`$2`), the patients the caller may
/// bill (`$3`), the kinds they may see (`$4`, `$5`) and the kind asked (`$6`).
fn list_filter() -> String {
    format!(
        "a.tenant_id = $1 AND a.deleted_at IS NULL \
         AND ($2::text IS NULL OR a.status = $2) \
         AND ($3::uuid[] IS NULL OR a.patient_id = ANY($3)) AND {} \
         AND ($6::text IS NULL OR ($6 = 'unbilled') = (a.reason IN {}))",
        kind_filter(4),
        crate::leakage::LEAKAGE_REASONS_SQL
    )
}

/// What a reader of the queue may see: which kinds, whose bills (`None` is
/// every patient), and whether amounts are hidden from them.
struct ReadScope {
    kinds: Kinds,
    visible: Option<Vec<Uuid>>,
    hide_amounts: bool,
}

/// The caller's [`ReadScope`]; 403 when they may see neither kind.
async fn read_scope(state: &AppState, claims: &Claims) -> Result<ReadScope, AppError> {
    let kinds = kinds(claims, false)?;
    let visible = medbrains_authz_gate::require_patient_billing_filter(state, claims, None).await?;
    let hide_amounts = crate::amounts_hidden(state, claims).await?;
    Ok(ReadScope {
        kinds,
        visible,
        hide_amounts,
    })
}

/// `GET /api/billing/charge-attention` — the queue, largest amount first
/// (unpriced rows last, newest first among them). The menu badge reads
/// `meta.total` of `status=open&limit=1`.
pub async fn list_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListChargeAttentionQuery>,
) -> Result<Json<Paginated<ChargeAttentionItem>>, AppError> {
    let ReadScope {
        kinds,
        visible,
        hide_amounts,
    } = read_scope(&state, &claims).await?;
    let page = Pagination {
        page: q.page,
        limit: q.limit,
    };
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let filter = list_filter();
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM charge_attention_items a WHERE {filter}"
    ))
    .bind(claims.tenant_id)
    .bind(&q.status)
    .bind(&visible)
    .bind(kinds.failed)
    .bind(kinds.unbilled)
    .bind(&q.kind)
    .fetch_one(&mut *tx)
    .await?;
    let mut rows = sqlx::query_as::<_, ChargeAttentionItem>(&format!(
        "{ITEM_SELECT} WHERE {filter} \
         ORDER BY a.unit_price_override * a.quantity DESC NULLS LAST, a.created_at DESC \
         LIMIT $7 OFFSET $8"
    ))
    .bind(claims.tenant_id)
    .bind(&q.status)
    .bind(&visible)
    .bind(kinds.failed)
    .bind(kinds.unbilled)
    .bind(&q.kind)
    .bind(page.limit())
    .bind(page.offset())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    for row in &mut rows {
        if hide_amounts {
            row.unit_price_override = None;
            row.amount = None;
        }
        // The hint names other patients: only for a desk that bills everyone.
        if visible.is_some() {
            row.registry_patients = None;
        }
    }
    Ok(Json(Paginated::new(rows, total, &page)))
}

#[derive(Debug, Deserialize)]
pub struct ChargeAttentionSummaryQuery {
    pub kind: Option<String>,
}

/// The open rows the caller may see, as one figure for the top of the screen.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChargeAttentionSummary {
    pub open_count: i64,
    /// Sum of the priced rows; `None` when amounts are hidden from the caller.
    pub open_amount: Option<Decimal>,
    /// Open rows with no price, so the total is never read as complete.
    pub unpriced_count: i64,
}

/// `GET /api/billing/charge-attention/summary` — count and ₹ total of the
/// open rows the list would show the caller.
pub async fn charge_attention_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ChargeAttentionSummaryQuery>,
) -> Result<Json<ChargeAttentionSummary>, AppError> {
    let ReadScope {
        kinds,
        visible,
        hide_amounts,
    } = read_scope(&state, &claims).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let mut summary = sqlx::query_as::<_, ChargeAttentionSummary>(&format!(
        "SELECT COUNT(*) AS open_count, \
                COALESCE(SUM(a.unit_price_override * a.quantity), 0) AS open_amount, \
                COUNT(*) FILTER (WHERE a.unit_price_override IS NULL) AS unpriced_count \
           FROM charge_attention_items a WHERE {}",
        list_filter()
    ))
    .bind(claims.tenant_id)
    .bind("open")
    .bind(&visible)
    .bind(kinds.failed)
    .bind(kinds.unbilled)
    .bind(&q.kind)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    if hide_amounts {
        summary.open_amount = None;
    }
    Ok(Json(summary))
}

/// `PUT /api/billing/charge-attention/{id}/post` — post the queued charge
/// onto the patient's bill.
///
/// A charge that still fails answers the error and the item stays open. An
/// order or a use of stock is checked again first, in this transaction, and
/// bills only what is left of it: see `leakage::check_before_post`.
pub async fn post_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    let kinds = kinds(&claims, true)?;
    crate::require_amount_write(&state, &claims).await?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let item = lock_open(&mut tx, &claims, kinds, id).await?;
    require_row_access(&state, &claims, item.patient_id).await?;
    let Some(patient_id) = item.patient_id else {
        return Err(AppError::Conflict(
            "Name the patient this implant was used on first.".to_owned(),
        ));
    };
    let (mut tx, quantity) = crate::leakage::check_before_post(tx, &claims, &item).await?;
    let req = ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: &item.setting_module,
        charge: AutoChargeInput {
            patient_id,
            encounter_id: item.encounter_id,
            charge_code: item.charge_code.clone(),
            source: item.source_module.clone(),
            source_id: item.source_entity_id,
            quantity,
            description_override: item.description_override.clone(),
            unit_price_override: item.unit_price_override,
            tax_percent_override: item.tax_percent_override,
        },
        apply_concessions: item.apply_concessions,
    };
    // A savepoint on the unit of work: the billing helpers take a transaction.
    let mut savepoint = sqlx::Acquire::begin(&mut *tx).await?;
    let posted = post_charge(&mut savepoint, &req).await?;
    savepoint.commit().await?;
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
    /// On an implant used without a patient: the store's record is a
    /// duplicate of one already made (the registry recorded the implant), so
    /// the unit it took goes back to stock and the vendor's usage. Refused on
    /// any other row.
    #[serde(default)]
    pub duplicate_usage: bool,
}

/// `PUT /api/billing/charge-attention/{id}/dismiss` — the charge should not
/// be billed; the reason is required and kept. A duplicate implant usage is
/// reversed in the same transaction: see `duplicate::reverse_usage`.
pub async fn dismiss_charge_attention(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DismissRequest>,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    let kinds = kinds(&claims, true)?;
    if body.duplicate_usage {
        // Returning stock is the store's job: a billing-only desk can dismiss,
        // not restock. Checked before any row is read.
        require_permission(&claims, permissions::indent::STOCK_MANAGE)?;
    }
    let reason = body.reason.trim();
    if reason.chars().count() < 3 {
        return Err(AppError::BadRequest(
            "billing.chargeAttention.reasonRequired".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let item = lock_open(&mut tx, &claims, kinds, id).await?;
    require_row_access(&state, &claims, item.patient_id).await?;
    if body.duplicate_usage {
        duplicate::reverse_usage(&mut tx, &claims, &item).await?;
    }
    mark_dismissed(&mut tx, &claims, id, reason).await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Close an open item as dismissed, with the reason and who.
pub(crate) async fn mark_dismissed(
    conn: &mut PgConnection,
    claims: &Claims,
    id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'dismissed', dismiss_reason = $3, \
                resolved_by = $4, resolved_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(reason)
    .bind(claims.sub)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// The open item, locked for this decision. Already resolved is a conflict;
/// missing, another tenant's, or of a kind the caller may not work is 404.
async fn lock_open(
    tx: &mut PgConnection,
    claims: &Claims,
    kinds: Kinds,
    id: Uuid,
) -> Result<ChargeAttentionItem, AppError> {
    let status: String = sqlx::query_scalar(&format!(
        "SELECT status FROM charge_attention_items a \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND {} FOR UPDATE",
        kind_filter(3)
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(kinds.failed)
    .bind(kinds.unbilled)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if status != "open" {
        return Err(AppError::Conflict(
            "billing.chargeAttention.alreadyResolved".to_owned(),
        ));
    }
    fetch(tx, claims.tenant_id, id).await
}

/// One item by id, joined as the list shows it, without the registry hint
/// (it names other patients; the list carries it, scoped).
async fn fetch(
    tx: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<ChargeAttentionItem, AppError> {
    let mut item = sqlx::query_as::<_, ChargeAttentionItem>(&format!(
        "{ITEM_SELECT} WHERE a.id = $1 AND a.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    item.registry_patients = None;
    Ok(item)
}

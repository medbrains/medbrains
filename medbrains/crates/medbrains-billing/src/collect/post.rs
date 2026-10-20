//! `POST /api/billing/collect` — one patient payment act.
//!
//! In one transaction: refuse the whole request if any bill in scope is out
//! of the caller's lanes; issue the drafts in scope; post every tender
//! through `posting::post_payment` (the balance check, the row lock); take
//! over gateway and card-machine money already on a bill instead of posting
//! it again; and issue one receipt per legal entity. A retry with the same
//! idempotency key returns the first collection and posts nothing.

use axum::{Extension, Json, extract::State, http::HeaderMap};
use medbrains_core::billing::{Invoice, Payment};
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_any_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::allocate::allocate;
use super::bills::{OpenBill, open_bills};
use super::lanes::{ANY_COLLECT, is_lane, may_collect_bill};
use super::receipts::{self, CollectionReceipt};
use super::tender::{self, Tender, TenderInput};
use crate::posting::{self, PostPayment, Posted};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectScope {
    /// The bills of one lane (`lane`): this desk's department.
    Department,
    /// Every open bill of the patient.
    All,
}

impl CollectScope {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Department => "department",
            Self::All => "all",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CollectRequest {
    pub patient_id: Uuid,
    pub scope: CollectScope,
    #[serde(default)]
    pub lane: Option<String>,
    /// Narrow the scope to these bills.
    #[serde(default)]
    pub invoice_ids: Option<Vec<Uuid>>,
    pub tenders: Vec<TenderInput>,
    #[serde(default)]
    pub station_id: Option<Uuid>,
    #[serde(default)]
    pub shift_id: Option<Uuid>,
    /// The counter's free-text label, which day close still tallies by.
    #[serde(default)]
    pub counter_id: Option<String>,
    /// Or the `Idempotency-Key` header. Not part of the request's fingerprint.
    #[serde(default, skip_serializing)]
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Collected {
    pub collection_id: Uuid,
    /// This request repeated an earlier one; nothing new was posted.
    pub replayed: bool,
    pub total_amount: Decimal,
    pub station_id: Option<Uuid>,
    pub shift_id: Option<Uuid>,
    pub issued_invoice_ids: Vec<Uuid>,
    pub payments: Vec<Payment>,
    pub receipts: Vec<CollectionReceipt>,
}

fn idempotency_key(body: &CollectRequest, headers: &HeaderMap) -> Result<String, AppError> {
    let key = body
        .idempotency_key
        .clone()
        .or_else(|| {
            headers
                .get("idempotency-key")
                .and_then(|v| v.to_str().ok())
                .map(str::to_owned)
        })
        .map(|k| k.trim().to_owned())
        .unwrap_or_default();
    if (8..=128).contains(&key.len()) {
        Ok(key)
    } else {
        Err(AppError::BadRequest(
            "An idempotency key of 8 to 128 characters is required".to_owned(),
        ))
    }
}

/// A spent key's collection: id, same request, total, station, shift.
type SpentKey = (Uuid, bool, Decimal, Option<Uuid>, Option<Uuid>);

/// A key already spent: its collection when the request is the same one.
async fn replay(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    key: &str,
    fingerprint: &str,
) -> Result<Option<Collected>, AppError> {
    let row: Option<SpentKey> = sqlx::query_as(
        "SELECT id, request_hash = md5($3), total_amount, station_id, shift_id \
           FROM collections WHERE tenant_id = $1 AND idempotency_key = $2",
    )
    .bind(tenant_id)
    .bind(key)
    .bind(fingerprint)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((id, same, total, station_id, shift_id)) = row else {
        return Ok(None);
    };
    if !same {
        return Err(AppError::Conflict(
            "That idempotency key was used for a different collection".to_owned(),
        ));
    }
    Ok(Some(Collected {
        collection_id: id,
        replayed: true,
        total_amount: total,
        station_id,
        shift_id,
        issued_invoice_ids: Vec::new(),
        payments: payments_of(tx, tenant_id, id).await?,
        receipts: receipts::of_collection(tx, tenant_id, id).await?,
    }))
}

async fn payments_of(tx: &mut Tx<'_>, tenant_id: Uuid, id: Uuid) -> Result<Vec<Payment>, AppError> {
    Ok(sqlx::query_as::<_, Payment>(
        "SELECT * FROM payments WHERE tenant_id = $1 AND collection_id = $2 \
           AND deleted_at IS NULL ORDER BY created_at, id",
    )
    .bind(tenant_id)
    .bind(id)
    .fetch_all(&mut **tx)
    .await?)
}

/// The bills this request collects, all of which the caller must be allowed.
fn scope_bills(
    claims: &Claims,
    body: &CollectRequest,
    open: Vec<OpenBill>,
) -> Result<Vec<OpenBill>, AppError> {
    let scoped: Vec<OpenBill> = match (&body.invoice_ids, body.scope) {
        (Some(ids), _) => {
            if let Some(missing) = ids
                .iter()
                .find(|id| !open.iter().any(|b| b.invoice_id == **id))
            {
                return Err(AppError::BadRequest(format!(
                    "Bill {missing} is not open for this patient"
                )));
            }
            open.into_iter()
                .filter(|b| ids.contains(&b.invoice_id))
                .collect()
        }
        (None, CollectScope::All) => open,
        (None, CollectScope::Department) => {
            let lane = body.lane.as_deref().unwrap_or_default();
            open.into_iter()
                .filter(|b| b.lanes.iter().any(|l| l == lane))
                .collect()
        }
    };
    // A denial covers the whole request: never a silent partial collection.
    if scoped.iter().any(|b| !may_collect_bill(claims, &b.lanes)) {
        return Err(AppError::Forbidden);
    }
    Ok(scoped)
}

/// The patient's open bills, locked for the length of the collection.
async fn lock_open_bills(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<OpenBill>, AppError> {
    sqlx::query(
        "SELECT id FROM invoices WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
           AND status IN ('draft', 'issued', 'partially_paid') ORDER BY id FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .execute(&mut **tx)
    .await?;
    open_bills(tx, tenant_id, patient_id).await
}

/// Issue the drafts in scope: collecting a bill is issuing it.
async fn issue_drafts(
    tx: &mut Tx<'_>,
    claims: &Claims,
    bills: &[OpenBill],
) -> Result<Vec<Uuid>, AppError> {
    let drafts: Vec<Uuid> = bills
        .iter()
        .filter(|b| b.status == "draft")
        .map(|b| b.invoice_id)
        .collect();
    for id in &drafts {
        crate::enforce_preauth_limit(tx, claims, *id, &crate::IssueInvoiceRequest::default())
            .await?;
        crate::final_bill::ensure_final_bill_ready(tx, claims.tenant_id, *id).await?;
    }
    let issued = sqlx::query_as::<_, Invoice>(
        "UPDATE invoices SET status = 'issued'::invoice_status, issued_at = now(), updated_at = now() \
          WHERE tenant_id = $1 AND id = ANY($2) AND status = 'draft'::invoice_status RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&drafts)
    .fetch_all(&mut **tx)
    .await?;
    for inv in &issued {
        crate::queue_invoice_finalized(tx, claims, inv).await?;
    }
    Ok(drafts)
}

/// Where and in which shift: the station must be the hospital's; the shift is
/// the one named, else the shift whose hours hold the hospital's clock now.
async fn place(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    body: &CollectRequest,
) -> Result<(Option<Uuid>, Option<Uuid>), AppError> {
    if let Some(station) = body.station_id {
        let known: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM stations WHERE id = $1 AND tenant_id = $2 AND is_active \
               AND deleted_at IS NULL",
        )
        .bind(station)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?;
        known.ok_or_else(|| AppError::BadRequest("Unknown counter".to_owned()))?;
    }
    let shift: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM shift_definitions \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active \
            AND (($2::uuid IS NOT NULL AND id = $2) OR ($2::uuid IS NULL AND CASE \
                  WHEN start_time <= end_time THEN localtime >= start_time AND localtime < end_time \
                  ELSE localtime >= start_time OR localtime < end_time END)) \
          ORDER BY start_time DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(body.shift_id)
    .fetch_optional(&mut **tx)
    .await?;
    if body.shift_id.is_some() && shift.is_none() {
        return Err(AppError::BadRequest("Unknown shift".to_owned()));
    }
    Ok((body.station_id, shift))
}

pub async fn collect(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    Json(body): Json<CollectRequest>,
) -> Result<Json<Collected>, AppError> {
    require_any_permission(&claims, &ANY_COLLECT)?;
    let restricted = crate::resolve_billing_restricted_fields(&state, &claims).await?;
    crate::validate_billing_amount_write_access(&restricted)?;
    if body.scope == CollectScope::Department && !body.lane.as_deref().is_some_and(is_lane) {
        return Err(AppError::BadRequest(
            "Name the department lane to collect for".to_owned(),
        ));
    }
    let key = idempotency_key(&body, &headers)?;
    let fingerprint = serde_json::to_string(&body)
        .map_err(|e| AppError::BadRequest(format!("Unreadable request: {e}")))?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, body.patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // One holder of a key at a time, so a double-click waits and replays.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))")
        .bind(claims.tenant_id.to_string())
        .bind(&key)
        .execute(&mut *tx)
        .await?;
    if let Some(done) = replay(&mut tx, claims.tenant_id, &key, &fingerprint).await? {
        tx.commit().await?;
        return Ok(Json(done));
    }
    let (collected, bills) = run(&mut tx, &claims, &body, &key, &fingerprint).await?;
    tx.commit().await?;
    super::support::announce(&state, &claims, &bills).await;
    Ok(Json(collected))
}

async fn run(
    tx: &mut Tx<'_>,
    claims: &Claims,
    body: &CollectRequest,
    key: &str,
    fingerprint: &str,
) -> Result<(Collected, Vec<(crate::PaymentBill, Payment)>), AppError> {
    let tenant_id = claims.tenant_id;
    let tenders = tender::resolve(tx, tenant_id, body.patient_id, &body.tenders).await?;
    let linked: Vec<(Uuid, Uuid)> = tenders
        .iter()
        .filter_map(|t| match t {
            Tender::Linked {
                payment_id,
                invoice_id,
                ..
            } => Some((*payment_id, *invoice_id)),
            Tender::Post { .. } => None,
        })
        .collect();
    super::support::require_linked_lanes(tx, claims, &linked).await?;
    let open = lock_open_bills(tx, tenant_id, body.patient_id).await?;
    let bills = scope_bills(claims, body, open)?;
    let (station_id, shift_id) = place(tx, tenant_id, body).await?;
    let total: Decimal = tenders.iter().map(Tender::amount).sum();
    let posts: Vec<&Tender> = tenders
        .iter()
        .filter(|t| matches!(t, Tender::Post { .. }))
        .collect();
    let balances: Vec<Decimal> = bills.iter().map(|b| b.balance).collect();
    let slices = allocate(
        &balances,
        &posts.iter().map(|t| t.amount()).collect::<Vec<_>>(),
    )
    .map_err(|over| AppError::BadRequest(format!("That is more than is due, by {over}")))?;
    let issued = issue_drafts(tx, claims, &bills).await?;

    let collection_id: Uuid = sqlx::query_scalar(
        "INSERT INTO collections (tenant_id, patient_id, station_id, shift_id, collected_by, \
                                  scope, lane, total_amount, tenders, idempotency_key, request_hash) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, md5($11)) RETURNING id",
    )
    .bind(tenant_id)
    .bind(body.patient_id)
    .bind(station_id)
    .bind(shift_id)
    .bind(claims.sub)
    .bind(body.scope.as_str())
    .bind(body.lane.as_deref())
    .bind(total)
    .bind(serde_json::to_value(&body.tenders).unwrap_or_default())
    .bind(key)
    .bind(fingerprint)
    .fetch_one(&mut **tx)
    .await?;

    for slice in &slices {
        let Some(Tender::Post {
            mode,
            reference,
            gateway_txn,
            ..
        }) = posts.get(slice.tender).copied()
        else {
            continue;
        };
        let Some(bill) = bills.get(slice.bill) else {
            continue;
        };
        let posted = posting::post_payment(
            tx,
            &PostPayment {
                tenant_id,
                invoice_id: bill.invoice_id,
                amount: slice.amount,
                mode,
                reference_number: reference.as_deref(),
                notes: None,
                received_by: Some(claims.sub),
                counter_id: body
                    .counter_id
                    .as_deref()
                    .map(str::trim)
                    .filter(|c| !c.is_empty()),
                shift: None,
                collection_id: Some(collection_id),
                station_id,
                shift_id,
            },
        )
        .await?;
        if let Posted::Refused(why) = posted {
            return Err(AppError::BadRequest(why));
        }
        if let Some(txn) = gateway_txn {
            tender::bind_gateway(tx, *txn, bill.invoice_id, collection_id).await?;
        }
    }
    sqlx::query(
        "UPDATE payments SET collection_id = $2, station_id = $3, shift_id = $4, updated_at = now() \
          WHERE tenant_id = $1 AND id = ANY($5)",
    )
    .bind(tenant_id)
    .bind(collection_id)
    .bind(station_id)
    .bind(shift_id)
    .bind(linked.iter().map(|(p, _)| *p).collect::<Vec<_>>())
    .execute(&mut **tx)
    .await?;

    let payments = payments_of(tx, tenant_id, collection_id).await?;
    // Money a gateway or machine posted was announced when it was taken.
    let fresh: Vec<Payment> = payments
        .iter()
        .filter(|p| !linked.iter().any(|(id, _)| *id == p.id))
        .cloned()
        .collect();
    let paid_bills = super::support::queue(tx, claims, fresh).await?;
    let collected = Collected {
        collection_id,
        replayed: false,
        total_amount: total,
        station_id,
        shift_id,
        issued_invoice_ids: issued,
        receipts: receipts::issue(tx, tenant_id, collection_id).await?,
        payments,
    };
    Ok((collected, paid_bills))
}

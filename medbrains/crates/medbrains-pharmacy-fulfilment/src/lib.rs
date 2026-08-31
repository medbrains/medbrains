//! Pharmacy fulfilment — pick, pack, verify, dispatch, collect.
//!
//! For pharmacies where the patient pays at a counter, takes a token, and waits
//! while somebody in the back room picks the order. Between payment and
//! collection the order has a life of its own, and until now the database said
//! nothing about it: `ordered → dispensed`, with no queue for the picker, no
//! record of who checked the pack, and no gate stopping an unchecked pack going
//! out.
//!
//! A pharmacy that hands medicine across the same counter that took the money
//! needs none of this and does not get it — a store is `direct` unless it says
//! otherwise, and a controlled line is `direct` whatever the store says.
//!
//! The transition table lives in [`state`], free of `sqlx` and `axum`, because
//! which moves are legal is the part that has to be provably right.

pub mod state;

use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use state::{effective_mode, may_transition, Mode, Refusal, Stage};
use uuid::Uuid;

impl From<Refusal> for AppError {
    fn from(refusal: Refusal) -> Self {
        // Every refusal here is something the person at the counter can act on
        // — the wrong order, the wrong store, an unchecked line — so each comes
        // back saying which, rather than a bare 409.
        Self::BadRequest(refusal.to_string())
    }
}

// ══════════════════════════════════════════════════════════
//  Reading an order's fulfilment context
// ══════════════════════════════════════════════════════════

/// Everything a transition needs to know, read once under a row lock.
struct Context {
    stage: Stage,
    mode: Mode,
    store_location_id: Option<Uuid>,
    patient_id: Uuid,
    unverified_lines: usize,
}

/// Load an order for a move, locking the row.
///
/// The mode is resolved here rather than passed in, because the caller is a
/// browser and the mode decides what the caller is allowed to do. A client that
/// could name its own fulfilment mode could put a narcotic on the pack shelf.
async fn load_for_transition(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<Context, AppError> {
    let (status, store_location_id, patient_id): (String, Option<Uuid>, Uuid) = sqlx::query_as(
        "SELECT status, store_location_id, patient_id FROM pharmacy_orders \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let stage = Stage::parse(&status)
        .ok_or_else(|| AppError::Internal(format!("unknown order status '{status}'")))?;

    let store_mode: Option<String> = match store_location_id {
        Some(store) => {
            sqlx::query_scalar(
                "SELECT fulfilment_mode FROM pharmacy_store_assignments \
                 WHERE store_location_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
            )
            .bind(store)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?
        }
        None => None,
    };

    // A controlled line forces counter handover regardless of the store setting.
    // Dual custody is the whole control on a narcotic; a packed bag on a shelf
    // with a token on it has neither custody nor a witness.
    let has_controlled: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
           SELECT 1 FROM pharmacy_order_items i \
           JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
           WHERE i.order_id = $1 AND i.tenant_id = $2 AND i.removed_at IS NULL \
             AND c.is_controlled = true)",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    let unverified: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL \
           AND deleted_at IS NULL AND verified_at IS NULL",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;

    Ok(Context {
        stage,
        mode: effective_mode(
            store_mode.as_deref().map_or(Mode::Direct, Mode::parse),
            has_controlled,
        ),
        store_location_id,
        patient_id,
        unverified_lines: usize::try_from(unverified).unwrap_or(usize::MAX),
    })
}

/// Apply a checked move, stamping the actor onto the column for that stage.
///
/// The stamps are per stage rather than one `handled_by`, because the question a
/// pharmacy is actually asked is "who checked this pack", and the name of
/// whoever last touched the row is not an answer to it.
async fn advance(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    from: Stage,
    to: Stage,
    actor: Uuid,
) -> Result<(), AppError> {
    let stamp = match to {
        Stage::Picking => ", picked_by = $4, picked_at = now()",
        Stage::Packed => ", packed_by = $4, packed_at = now()",
        Stage::Verified => ", verified_by = $4, verified_at = now()",
        Stage::Ready => ", ready_at = now()",
        Stage::Collected => ", collected_at = now()",
        Stage::Released => ", released_by = $4, released_at = now()",
        Stage::Cancelled => ", cancelled_by = $4, cancelled_at = now()",
        _ => "",
    };

    // `AND status = $5` is not redundant with the FOR UPDATE above: it is the
    // last word on the race, and costs nothing.
    let sql = format!(
        "UPDATE pharmacy_orders SET status = $3, updated_at = now(){stamp} \
         WHERE id = $1 AND tenant_id = $2 AND status = $5"
    );

    let updated = sqlx::query(&sql)
        .bind(order_id)
        .bind(tenant_id)
        .bind(to.as_str())
        .bind(actor)
        .bind(from.as_str())
        .execute(&mut **tx)
        .await?;

    if updated.rows_affected() == 0 {
        return Err(AppError::Conflict(
            "The order moved on while this was in flight — reload and try again".to_owned(),
        ));
    }
    Ok(())
}

// ══════════════════════════════════════════════════════════
//  The picking queue
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct QueueQuery {
    /// Which store's queue. Omitted means every store the caller can see, which
    /// is what a single-pharmacy hospital wants and a multi-store one does not.
    pub store_location_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QueueRow {
    pub id: Uuid,
    pub status: String,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub store_location_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub line_count: i64,
    pub unverified_lines: i64,
    /// Lines whose committed batch expires within 90 days — the house-wide
    /// near-expiry horizon (`pharmacy` dashboard and report use the same).
    pub near_expiry_lines: i64,
    /// Earliest moment a batch committed to this order entered inventory.
    /// The second sorting priority: among orders equally exposed to expiry,
    /// the one carrying the longest-resident stock is served first.
    pub oldest_batch_received_at: Option<chrono::DateTime<chrono::Utc>>,
    pub token_number: Option<String>,
}

/// `GET /api/pharmacy/fulfilment/queue` — what is in flight, oldest first.
///
/// Oldest first is not a display preference: it is the order the patients in the
/// waiting area are in, and a queue sorted any other way is a queue somebody has
/// to argue with.
/// `GET /api/pharmacy/fulfilment/queue` — what is in flight, oldest first.
///
/// Oldest first is not a display preference: it is the order the patients in the
/// waiting area are in, and a queue sorted any other way is a queue somebody has
/// to argue with.
///
/// The patient's name and UHID travel with every row because both ends of the
/// flow need them: a picker walking to the shelf is picking for a *person*, and
/// the counter cannot hand a bag over without asking who it is for. A name on
/// the screen is not the identification itself — it is what gets checked
/// against what the patient says.
/// `GET /api/pharmacy/fulfilment/queue` — what is in flight.
///
/// Orders are served in three tiers. First, orders holding short-dated stock —
/// the FEFO rule extended past the shelf into the queue, because a batch that
/// dies in three weeks is only "stock" if somebody dispenses it, and an order
/// sitting behind four fresher ones is an expiry write-off with a patient
/// attached. Second, among orders equally exposed to expiry, the one whose
/// batch entered inventory earliest — plain FIFO on receipt, which settles the
/// ties that FEFO alone cannot see. Third, oldest order first: it is the order
/// the patients in the waiting area are in, and a queue sorted any other way is
/// a queue somebody has to argue with.
///
/// The patient's name and UHID travel with every row because both ends of the
/// flow need them: a picker walking to the shelf is picking for a *person*, and
/// the counter cannot hand a bag over without asking who it is for. A name on
/// the screen is not the identification itself — it is what gets checked
/// against what the patient says.
pub async fn fulfilment_queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<QueueQuery>,
) -> Result<Json<Vec<QueueRow>>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::PICK)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, QueueRow>(
        "SELECT o.id, o.status, o.patient_id, o.store_location_id, o.created_at, \
                p.first_name || ' ' || p.last_name AS patient_name, \
                p.uhid, \
                COUNT(i.id) FILTER (WHERE i.removed_at IS NULL) AS line_count, \
                COUNT(i.id) FILTER (WHERE i.removed_at IS NULL AND i.verified_at IS NULL) \
                  AS unverified_lines, \
                COUNT(i.id) FILTER (WHERE i.removed_at IS NULL \
                                      AND b.expiry_date IS NOT NULL \
                                      AND b.expiry_date < CURRENT_DATE + 90) \
                  AS near_expiry_lines, \
                MIN(b.created_at) AS oldest_batch_received_at, \
                t.number AS token_number \
         FROM pharmacy_orders o \
         LEFT JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
         LEFT JOIN pharmacy_order_items i \
                ON i.order_id = o.id AND i.tenant_id = o.tenant_id AND i.deleted_at IS NULL \
         LEFT JOIN pharmacy_batches b \
                ON b.id = i.batch_stock_id AND b.tenant_id = i.tenant_id \
         LEFT JOIN tokens t ON t.id = o.collection_token_id AND t.tenant_id = o.tenant_id \
         WHERE o.tenant_id = $1 AND o.deleted_at IS NULL \
           AND o.status IN ('ordered', 'picking', 'packed', 'verified', 'ready') \
           AND ($2::uuid IS NULL OR o.store_location_id = $2) \
         GROUP BY o.id, p.first_name, p.last_name, p.uhid, t.number \
         ORDER BY COUNT(i.id) FILTER (WHERE i.removed_at IS NULL \
                                        AND b.expiry_date IS NOT NULL \
                                        AND b.expiry_date < CURRENT_DATE + 90) DESC, \
                  MIN(b.created_at) ASC NULLS LAST, \
                  o.created_at ASC \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(query.store_location_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  The pick list
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PickLine {
    pub order_item_id: Uuid,
    pub drug_name: String,
    pub quantity: i32,
    pub batch_number: Option<String>,
    pub expiry_date: Option<chrono::NaiveDate>,
    pub rack: Option<String>,
    pub shelf: Option<String>,
    pub bin: Option<String>,
    pub verified_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// `GET /api/pharmacy/fulfilment/{id}/pick-list` — where to walk, and what to take.
///
/// Names the batch, not just the drug. Stock is deducted at billing and billing
/// picks the batch by FEFO, so by the time a picker sees this the batch is
/// already decided — telling them only the drug name would invite them to take
/// whichever box is nearest and put the books quietly out of step with the shelf.
pub async fn pick_list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<PickLine>>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::PICK)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let lines = sqlx::query_as::<_, PickLine>(
        "SELECT i.id AS order_item_id, i.drug_name, i.quantity, \
                i.batch_number, i.expiry_date, \
                b.rack_number AS rack, b.shelf_number AS shelf, b.bin_number AS bin, \
                i.verified_at \
         FROM pharmacy_order_items i \
         LEFT JOIN pharmacy_batches b \
                ON b.id = i.batch_stock_id AND b.tenant_id = i.tenant_id \
         WHERE i.order_id = $1 AND i.tenant_id = $2 \
           AND i.removed_at IS NULL AND i.deleted_at IS NULL \
         ORDER BY b.rack_number NULLS LAST, b.shelf_number NULLS LAST, \
                  b.bin_number NULLS LAST, i.drug_name",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(lines))
}

// ══════════════════════════════════════════════════════════
//  The transitions
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct StageResponse {
    pub id: Uuid,
    pub status: String,
}

/// One shape for claim / pack / ready, which differ only in which stage they
/// reach and which permission they need.
async fn simple_transition(
    state: &AppState,
    claims: &Claims,
    order_id: Uuid,
    to: Stage,
) -> Result<Json<StageResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ctx = load_for_transition(&mut tx, claims.tenant_id, order_id).await?;
    may_transition(ctx.mode, ctx.stage, to, ctx.unverified_lines)?;

    // Stock leaves the books when the order enters the flow, not when it reaches
    // the counter — otherwise two patients can pay for the last strip and the
    // second one finds out at the shelf.
    //
    // The plan for this flow says "deducted at billing", and this is not quite
    // that: billing today runs AFTER dispensing (the encounter sync bills orders
    // `WHERE status = 'dispensed'`), so there is no billing event yet to hang it
    // on for an order that will never be `dispensed`. Claiming is the earliest
    // point this module controls. Moving it is one call once billing creates
    // pack-and-collect orders itself.
    if to == Stage::Picking {
        commit_stock(&mut tx, claims.tenant_id, order_id, ctx.store_location_id).await?;
    }

    advance(
        &mut tx,
        claims.tenant_id,
        order_id,
        ctx.stage,
        to,
        claims.sub,
    )
    .await?;

    tx.commit().await?;
    tracing::info!(
        tenant_id = %claims.tenant_id,
        order_id = %order_id,
        patient_id = %ctx.patient_id,
        store_location_id = ?ctx.store_location_id,
        from = %ctx.stage,
        to = %to,
        by = %claims.sub,
        "pharmacy fulfilment transition"
    );

    Ok(Json(StageResponse {
        id: order_id,
        status: to.as_str().to_owned(),
    }))
}

/// `POST /api/pharmacy/fulfilment/{id}/claim` — a picker takes the order.
pub async fn claim_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::PICK)?;
    simple_transition(&state, &claims, id, Stage::Picking).await
}

/// `POST /api/pharmacy/fulfilment/{id}/pack` — everything on the order is in the bag.
pub async fn pack_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::PACK)?;
    simple_transition(&state, &claims, id, Stage::Packed).await
}

/// `POST /api/pharmacy/fulfilment/{id}/verified` — the pack has been checked.
///
/// Refused while any line is unchecked, which is the gate the whole flow exists
/// for. Verifying the lines is [`verify_line`]; this only records that they all
/// are.
pub async fn mark_verified(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::VERIFY)?;
    simple_transition(&state, &claims, id, Stage::Verified).await
}

/// `POST /api/pharmacy/fulfilment/{id}/ready` — call the patient.
pub async fn mark_ready(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::DISPATCH)?;
    simple_transition(&state, &claims, id, Stage::Ready).await
}

// ══════════════════════════════════════════════════════════
//  Verifying a line
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct VerifyLineRequest {
    pub order_item_id: Uuid,
    /// What the scanner read. Resolved here, against the catalogue, because a
    /// client that could stamp `verified` itself would be a client that could
    /// skip the check.
    pub scanned_code: Option<String>,
    /// Why this line was ticked by eye instead of scanned. Required when there
    /// is no scan: a pharmacy that discovers it is ticking everything manually
    /// has learned something about its barcodes.
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VerifyLineResponse {
    pub order_item_id: Uuid,
    pub method: String,
    pub outstanding_lines: i64,
}

/// Decide how this line was checked, and refuse if it was not really checked.
///
/// A scan is resolved here, against the catalogue, rather than trusted from the
/// client — the whole value of the check is that the server, not the browser,
/// decides whether the pack in somebody's hand is the drug the order asks for.
///
/// Note the limit of what a green tick means: a pack's barcode identifies the
/// *product*, not the batch. A match confirms the right drug and says nothing
/// about which batch is in the picker's hand; the batch is confirmed against
/// what the pick list named.
async fn resolve_check_method(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    scanned_code: Option<&str>,
    note: Option<&str>,
    drug_name: &str,
    catalog_item_id: Option<Uuid>,
) -> Result<&'static str, AppError> {
    let code = scanned_code.map(str::trim).filter(|c| !c.is_empty());

    let Some(code) = code else {
        // No scan: a reason is required. A pharmacy that finds it is ticking
        // everything by eye has learned something about its barcodes, and it
        // can only learn it if the reasons are kept.
        if note.map(str::trim).is_none_or(str::is_empty) {
            return Err(AppError::BadRequest(
                "Scan the pack, or give a reason for checking this line by eye".to_owned(),
            ));
        }
        return Ok("manual");
    };

    let scanned: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND barcode = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(code)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(scanned) = scanned else {
        return Err(AppError::BadRequest(
            "That barcode is not in the catalogue — check the pack, or tick the line \
             manually with a reason"
                .to_owned(),
        ));
    };

    // The check that makes the whole flow worth having: the wrong drug in the
    // right bag.
    if Some(scanned) != catalog_item_id {
        return Err(AppError::BadRequest(format!(
            "That pack is not {drug_name} — the order asks for something else"
        )));
    }

    Ok("scan")
}

/// `POST /api/pharmacy/fulfilment/{id}/verify` — check one line against the order.
///
/// A scan is resolved server-side to a catalogue item and compared with what the
/// order says. Note what a scan does and does not prove: a pack's GTIN
/// identifies the *product*, not the batch, so a matching scan confirms the
/// right drug and says nothing about which batch is in the picker's hand. The
/// batch is confirmed against what the pick list named, and a difference is a
/// substitution to be recorded, not a silent swap.
pub async fn verify_line(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<VerifyLineRequest>,
) -> Result<Json<VerifyLineResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ctx = load_for_transition(&mut tx, claims.tenant_id, id).await?;
    if ctx.mode != Mode::PackAndCollect {
        return Err(Refusal::NotPackAndCollect {
            to: Stage::Verified,
        }
        .into());
    }
    if !matches!(ctx.stage, Stage::Picking | Stage::Packed) {
        return Err(AppError::BadRequest(format!(
            "an order that is {} has no pack to check",
            ctx.stage
        )));
    }

    let (drug_name, catalog_item_id): (String, Option<Uuid>) = sqlx::query_as(
        "SELECT drug_name, catalog_item_id FROM pharmacy_order_items \
         WHERE id = $1 AND order_id = $2 AND tenant_id = $3 \
           AND removed_at IS NULL AND deleted_at IS NULL",
    )
    .bind(body.order_item_id)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let method = resolve_check_method(
        &mut tx,
        claims.tenant_id,
        body.scanned_code.as_deref(),
        body.note.as_deref(),
        &drug_name,
        catalog_item_id,
    )
    .await?;

    sqlx::query(
        "UPDATE pharmacy_order_items SET \
         verified_at = now(), verified_by = $3, verify_method = $4, verify_note = $5 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.order_item_id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(method)
    .bind(
        body.note
            .as_deref()
            .map(str::trim)
            .filter(|n| !n.is_empty()),
    )
    .execute(&mut *tx)
    .await?;

    let outstanding: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 AND removed_at IS NULL \
           AND deleted_at IS NULL AND verified_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    if method == "manual" {
        tracing::info!(
            tenant_id = %claims.tenant_id,
            order_id = %id,
            order_item_id = %body.order_item_id,
            by = %claims.sub,
            "pharmacy pack line checked by eye rather than scanned"
        );
    }

    Ok(Json(VerifyLineResponse {
        order_item_id: body.order_item_id,
        method: method.to_owned(),
        outstanding_lines: outstanding,
    }))
}

// ══════════════════════════════════════════════════════════
//  Collection and release
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CollectRequest {
    pub order_id: Uuid,
}

/// `POST /api/pharmacy/fulfilment/collect` — hand the bag over.
pub async fn collect_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CollectRequest>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::DISPATCH)?;
    simple_transition(&state, &claims, body.order_id, Stage::Collected).await
}

#[derive(Debug, Deserialize)]
pub struct ReleaseRequest {
    /// Why the order was never collected. Required — a released order puts stock
    /// back on the shelf and leaves a paid invoice with nothing against it, and
    /// both of those are questions somebody will ask later.
    pub reason: String,
}

/// `POST /api/pharmacy/fulfilment/{id}/release` — nobody came for it.
///
/// The easy state to forget, and the one that quietly corrupts a stock report:
/// an uncollected order is off the books and on the shelf at the same time.
/// Releasing returns the stock; the refund is raised separately, because whether
/// one is owed depends on the hospital's policy and not on this transition.
pub async fn release_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReleaseRequest>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::RELEASE)?;

    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Give a reason — a released order puts stock back and leaves a paid bill behind"
                .to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ctx = load_for_transition(&mut tx, claims.tenant_id, id).await?;
    may_transition(ctx.mode, ctx.stage, Stage::Released, ctx.unverified_lines)?;

    restock_order(&mut tx, claims.tenant_id, id).await?;
    advance(
        &mut tx,
        claims.tenant_id,
        id,
        ctx.stage,
        Stage::Released,
        claims.sub,
    )
    .await?;

    sqlx::query("UPDATE pharmacy_orders SET release_reason = $3 WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .bind(reason)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    tracing::warn!(
        tenant_id = %claims.tenant_id,
        order_id = %id,
        patient_id = %ctx.patient_id,
        by = %claims.sub,
        reason,
        "pharmacy order released uncollected — stock returned"
    );

    Ok(Json(StageResponse {
        id,
        status: Stage::Released.as_str().to_owned(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    /// Why the order is being pulled out of the flow. Required, for the same
    /// reason a release needs one: the stock goes back and the money question
    /// stays open.
    pub reason: String,
}

/// `POST /api/pharmacy/fulfilment/{id}/cancel` — pull an order out mid-flight.
///
/// The edge case the queue creates and the old counter flow never had: a picker
/// claims the wrong order, or the patient walks out while their bag is halfway
/// through the back room. Before this flow existed those orders were
/// `ordered → dispensed` and cancellation was somebody else's problem; now the
/// order holds committed stock from `claim`, so every in-flight stage needs a
/// way back that puts the stock where it came from.
///
/// Deliberately separate arms of the same idea as [`release_order`]: released
/// means *we finished and nobody came*; cancelled means *we stopped*. The
/// distinction is what a stock report and an apology to a patient both turn on.
pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelRequest>,
) -> Result<Json<StageResponse>, AppError> {
    require_permission(&claims, permissions::pharmacy::fulfilment::RELEASE)?;

    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Give a reason — cancelling returns the order's stock to its batches".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let ctx = load_for_transition(&mut tx, claims.tenant_id, id).await?;
    may_transition(ctx.mode, ctx.stage, Stage::Cancelled, ctx.unverified_lines)?;

    restock_order(&mut tx, claims.tenant_id, id).await?;
    advance(
        &mut tx,
        claims.tenant_id,
        id,
        ctx.stage,
        Stage::Cancelled,
        claims.sub,
    )
    .await?;

    sqlx::query("UPDATE pharmacy_orders SET cancel_reason = $3 WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .bind(reason)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    tracing::warn!(
        tenant_id = %claims.tenant_id,
        order_id = %id,
        patient_id = %ctx.patient_id,
        by = %claims.sub,
        reason,
        "pharmacy order cancelled mid-fulfilment — stock returned"
    );

    Ok(Json(StageResponse {
        id,
        status: Stage::Cancelled.as_str().to_owned(),
    }))
}

/// One order line as `commit_stock` reads it: id, catalogue item, name,
/// quantity, and the batch it has already been given (if any).
type StockLineRow = (Uuid, Option<Uuid>, String, i32, Option<Uuid>);/// Take the order's lines off the shelf, oldest expiry first.
///
/// Mirrors `dispense_order`'s decrement exactly — same table, same columns, same
/// FEFO order, same refusal to touch an expired or quarantined batch — because
/// two ways of taking the same stock is two sets of books.
///
/// A single batch has to cover a whole line, which is the rule dispensing
/// already follows: it keeps one batch number against one order line, and a
/// recall that has to follow a drug to a patient cannot do it through a line
/// that came out of three batches and recorded one.
async fn commit_stock(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    store_location_id: Option<Uuid>,
) -> Result<(), AppError> {
    let lines: Vec<StockLineRow> = sqlx::query_as(
        "SELECT id, catalog_item_id, drug_name, quantity, batch_stock_id \
         FROM pharmacy_order_items \
         WHERE order_id = $1 AND tenant_id = $2 \
           AND removed_at IS NULL AND deleted_at IS NULL",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    for (item_id, catalog_item_id, drug_name, quantity, already_taken) in lines {
        // A line that already names a batch has been through here (or through
        // dispensing) and must not be taken twice.
        if already_taken.is_some() || quantity <= 0 {
            continue;
        }
        let Some(catalog_item_id) = catalog_item_id else {
            // Free-text lines hold no stock, so there is nothing to take. They
            // are still picked and still verified.
            continue;
        };

        let taken: Option<(Uuid, String, Option<chrono::NaiveDate>)> = sqlx::query_as(
            "UPDATE pharmacy_batches SET \
             quantity_dispensed = quantity_dispensed + $1, \
             quantity_on_hand = quantity_on_hand - $1, \
             updated_at = now() \
             WHERE id = ( \
               SELECT id FROM pharmacy_batches \
               WHERE tenant_id = $2 AND catalog_item_id = $3 \
                 AND quantity_on_hand >= $1 \
                 AND expiry_date > CURRENT_DATE \
                 AND quarantine_status = 'cleared' \
                 AND ($4::uuid IS NULL OR store_location_id = $4) \
               ORDER BY expiry_date ASC, created_at ASC, id ASC \
               LIMIT 1 \
               FOR UPDATE SKIP LOCKED \
             ) \
             RETURNING id, batch_number, expiry_date",
        )
        .bind(quantity)
        .bind(tenant_id)
        .bind(catalog_item_id)
        .bind(store_location_id)
        .fetch_optional(&mut **tx)
        .await?;

        let Some((batch_id, batch_number, expiry_date)) = taken else {
            return Err(AppError::Conflict(format!(
                "No single cleared, in-date batch can cover {quantity} of {drug_name}. \
                 Receive stock, or split the line."
            )));
        };

        // Stamped onto the line so the pick list can name the batch, the rack
        // and the shelf — and so releasing the order knows what to give back.
        sqlx::query(
            "UPDATE pharmacy_order_items SET \
             batch_stock_id = $3, batch_number = $4, expiry_date = $5 \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(item_id)
        .bind(tenant_id)
        .bind(batch_id)
        .bind(&batch_number)
        .bind(expiry_date)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

/// Put the order's lines back on the shelf.
///
/// The exact inverse of [`commit_stock`], crediting the *same* batch each line
/// was taken from. Anything else and a recall stops at this order, which is the
/// whole reason stock here is batch-level rather than one count per drug.
async fn restock_order(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<(), AppError> {
    let restored = sqlx::query(
        "UPDATE pharmacy_batches b SET \
         quantity_on_hand = b.quantity_on_hand + i.quantity, \
         quantity_dispensed = GREATEST(b.quantity_dispensed - i.quantity, 0), \
         updated_at = now() \
         FROM pharmacy_order_items i \
         WHERE i.order_id = $1 AND i.tenant_id = $2 \
           AND i.removed_at IS NULL AND i.deleted_at IS NULL \
           AND i.batch_stock_id IS NOT NULL \
           AND b.id = i.batch_stock_id AND b.tenant_id = i.tenant_id",
    )
    .bind(order_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;

    tracing::info!(
        tenant_id = %tenant_id,
        order_id = %order_id,
        lines = restored.rows_affected(),
        "pharmacy order stock returned to its original batches"
    );
    Ok(())
}

// ══════════════════════════════════════════════════════════
//  Routes
// ══════════════════════════════════════════════════════════

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/pharmacy/fulfilment/queue", get(fulfilment_queue))
        .route("/api/pharmacy/fulfilment/{id}/pick-list", get(pick_list))
        .route("/api/pharmacy/fulfilment/{id}/claim", post(claim_order))
        .route("/api/pharmacy/fulfilment/{id}/pack", post(pack_order))
        .route("/api/pharmacy/fulfilment/{id}/verify", post(verify_line))
        .route(
            "/api/pharmacy/fulfilment/{id}/verified",
            post(mark_verified),
        )
        .route("/api/pharmacy/fulfilment/{id}/ready", post(mark_ready))
        .route("/api/pharmacy/fulfilment/{id}/release", post(release_order))
        .route("/api/pharmacy/fulfilment/{id}/cancel", post(cancel_order))
        .route("/api/pharmacy/fulfilment/collect", post(collect_order))
}

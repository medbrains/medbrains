//! A substitute for an online order line the pharmacy can't fill (owner
//! decision 4a). The pharmacist proposes one that matches — same salt,
//! strength, form and release type, never an NTI drug or a biological — and
//! the prescribing doctor decides in their sign-off queue, or agrees by phone
//! and confirms there within 24 hours, else the line goes back. The patient
//! consents in the portal or on the phone. The line goes out as the
//! substitute only with both; release logs it in the substitution log.
//!
//! Only a hospital prescription can be substituted: its prescriber is in
//! the system to sign. An outside prescription goes to the outside-pharmacy
//! print instead.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::Duration;
use medbrains_core::permissions;
use medbrains_core::pharmacy_substitution::{PHONE_CONFIRM_HOURS, substitution_problem};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::catalog::rows_by_ids;

/// Matching candidates offered, at most.
const CANDIDATE_LIMIT: i64 = 20;
/// Lapsed phone agreements reverted per sweep, at most.
const SWEEP_LIMIT: i64 = 100;

#[derive(Debug, Serialize)]
pub struct Candidate {
    pub id: Uuid,
    pub name: String,
    pub price: Option<rust_decimal::Decimal>,
    /// `available`, `low` or `out`.
    pub stock: &'static str,
}

#[derive(Debug, Serialize)]
pub struct Candidates {
    /// Why this line can never be substituted, when it can't.
    pub blocked: Option<String>,
    pub candidates: Vec<Candidate>,
}

/// `GET /api/pharmacy/storefront/orders/{id}/lines/{item}/substitutes` — what
/// may stand in for this line: matching items with stock online.
pub async fn candidates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((order_id, item)): Path<(Uuid, Uuid)>,
) -> Result<Json<Candidates>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::SUBSTITUTE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let found = matches(&mut tx, claims.tenant_id, order_id, item).await?;
    tx.commit().await?;
    Ok(Json(found))
}

/// Matching items for `item` on `order_id`, each priced and with stock.
pub(crate) async fn matches(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    item: Uuid,
) -> Result<Candidates, AppError> {
    let settings = super::settings::load(tx, tenant_id).await?;
    let same_inn: Vec<Uuid> = sqlx::query_scalar(
        "SELECT c.id FROM pharmacy_catalog c, pharmacy_catalog o \
          WHERE o.id = $2 AND o.tenant_id = $1 AND c.tenant_id = $1 AND c.id <> o.id \
            AND c.is_active AND c.deleted_at IS NULL \
            AND lower(COALESCE(c.inn_name, c.generic_name, '')) \
                = lower(COALESCE(o.inn_name, o.generic_name, '')) \
            AND COALESCE(o.inn_name, o.generic_name, '') <> '' \
          ORDER BY c.name LIMIT $3",
    )
    .bind(tenant_id)
    .bind(item)
    .bind(CANDIDATE_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let mut ids = same_inn.clone();
    ids.push(item);
    let rows = rows_by_ids(tx, tenant_id, &ids, &settings, Some(order_id)).await?;
    let original = rows.get(&item).ok_or(AppError::NotFound)?;
    let facts = original.substitute_facts();
    let blocked = medbrains_core::pharmacy_substitution::never_substituted(&facts)
        .map(|w| format!("Not allowed: {w}"));
    let candidates = if blocked.is_some() {
        Vec::new()
    } else {
        same_inn
            .iter()
            .filter_map(|id| rows.get(id))
            .filter(|r| substitution_problem(&facts, &r.substitute_facts()).is_none())
            .map(|r| Candidate {
                id: r.id,
                name: r.name.clone(),
                price: r.price(&settings),
                stock: medbrains_core::pharmacy_storefront::stock_level(r.available),
            })
            .collect()
    };
    Ok(Candidates {
        blocked,
        candidates,
    })
}

#[derive(Debug, Deserialize)]
pub struct ProposeRequest {
    /// The line, by the item the patient ordered.
    pub catalog_item_id: Uuid,
    pub substitute_item_id: Uuid,
    pub reason: String,
    /// `sign_off` (the doctor's queue) or `phone` (agreed now, confirmed later).
    pub method: String,
    /// With `phone`: what the doctor said, and when.
    pub phone_note: Option<String>,
    /// The patient agreed on the phone; else they answer in the portal.
    pub patient_agreed_by_phone: Option<String>,
}

#[derive(sqlx::FromRow)]
struct LineFacts {
    line_id: Uuid,
    doctor_id: Option<Uuid>,
    prescription_id: Option<Uuid>,
}

/// `POST /api/pharmacy/storefront/orders/{id}/substitutions`
pub async fn propose(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
    Json(body): Json<ProposeRequest>,
) -> Result<Json<super::orders::StoreOrderView>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::SUBSTITUTE)?;
    let text = |v: Option<&str>| {
        v.map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
    };
    let reason = text(Some(body.reason.as_str()))
        .ok_or_else(|| AppError::BadRequest("Say why a substitute is needed".to_owned()))?;
    let phone_note = text(body.phone_note.as_deref());
    let (status, due) = match (body.method.as_str(), &phone_note) {
        ("sign_off", _) => ("with_doctor", None),
        ("phone", Some(_)) => (
            "phone_pending",
            Some(chrono::Utc::now() + Duration::hours(PHONE_CONFIRM_HOURS)),
        ),
        ("phone", None) => {
            return Err(AppError::BadRequest(
                "Write down what the doctor agreed on the phone".to_owned(),
            ));
        }
        _ => return Err(AppError::BadRequest("Choose sign-off or phone".to_owned())),
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let line = sqlx::query_as::<_, LineFacts>(
        "SELECT l.id AS line_id, p.doctor_id, o.prescription_id \
           FROM pharmacy_store_orders o \
           JOIN pharmacy_store_order_lines l ON l.store_order_id = o.id AND l.tenant_id = o.tenant_id \
           LEFT JOIN prescriptions p ON p.id = o.prescription_id AND p.tenant_id = o.tenant_id \
          WHERE o.id = $1 AND o.tenant_id = $2 AND o.status = 'awaiting_verification' \
            AND o.deleted_at IS NULL AND l.catalog_item_id = $3 AND l.status = 'pending' \
            AND l.deleted_at IS NULL \
          FOR UPDATE OF l",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let Some(doctor_id) = line.doctor_id else {
        return Err(AppError::Conflict(
            "Only a prescription written here can be substituted: its doctor signs. \
             Offer the outside-pharmacy print instead."
                .to_owned(),
        ));
    };
    let found = matches(&mut tx, claims.tenant_id, order_id, body.catalog_item_id).await?;
    if let Some(why) = found.blocked {
        return Err(AppError::Conflict(why));
    }
    if !found
        .candidates
        .iter()
        .any(|c| c.id == body.substitute_item_id)
    {
        return Err(AppError::Conflict(
            "That isn't the same salt, strength, form and release type".to_owned(),
        ));
    }
    let patient_phone = text(body.patient_agreed_by_phone.as_deref());
    let request: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_substitution_requests \
           (tenant_id, store_order_id, store_order_line_id, original_item_id, substitute_item_id, \
            prescription_id, doctor_id, requested_by, reason, method, phone_note, confirm_due_at, \
            status, patient_consent, patient_consent_method, patient_consent_at, \
            patient_consent_note) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, \
                 CASE WHEN $14::text IS NULL THEN NULL ELSE 'accepted' END, \
                 CASE WHEN $14::text IS NULL THEN NULL ELSE 'phone' END, \
                 CASE WHEN $14::text IS NULL THEN NULL ELSE now() END, $14) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(order_id)
    .bind(line.line_id)
    .bind(body.catalog_item_id)
    .bind(body.substitute_item_id)
    .bind(line.prescription_id)
    .bind(doctor_id)
    .bind(claims.sub)
    .bind(&reason)
    .bind(&body.method)
    .bind(&phone_note)
    .bind(due)
    .bind(status)
    .bind(&patient_phone)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE pharmacy_store_order_lines SET substitution_request_id = $2 WHERE id = $1")
        .bind(line.line_id)
        .bind(request)
        .execute(&mut *tx)
        .await?;
    apply(&mut tx, claims.tenant_id, &[request]).await?;
    let view = super::orders::any_order(&mut tx, claims.tenant_id, order_id).await?;
    tx.commit().await?;
    Ok(Json(view))
}

/// Put a request into effect, or take it out: the line goes out as the
/// substitute while the doctor has agreed (signed off, or by phone and not
/// yet lapsed) and the patient has accepted; otherwise as prescribed. The
/// line is priced for what goes out.
pub(crate) async fn apply(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    requests: &[Uuid],
) -> Result<(), AppError> {
    let lines: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE pharmacy_store_order_lines l \
            SET substitute_item_id = CASE WHEN r.eff THEN r.substitute_item_id END, \
                substitute_name = CASE WHEN r.eff THEN c.name END \
           FROM (SELECT id, store_order_line_id, substitute_item_id, \
                        status IN ('approved', 'phone_pending') \
                          AND patient_consent = 'accepted' AS eff \
                   FROM pharmacy_substitution_requests \
                  WHERE tenant_id = $1 AND id = ANY($2)) r \
           JOIN pharmacy_catalog c ON c.id = r.substitute_item_id \
          WHERE l.id = r.store_order_line_id AND l.tenant_id = $1 \
            AND l.substitution_request_id = r.id \
         RETURNING l.id",
    )
    .bind(tenant_id)
    .bind(requests)
    .fetch_all(&mut **tx)
    .await?;
    super::cart::reprice_lines(tx, tenant_id, &lines).await
}

/// Phone agreements the doctor didn't confirm within 24 hours: the line
/// goes back to what was prescribed while the order still waits; once it has
/// gone to fulfilment the request is marked lapsed for the record. Bounded.
pub(crate) async fn sweep_lapsed(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    let reverted: Vec<(Uuid, String)> = sqlx::query_as(
        "UPDATE pharmacy_substitution_requests r \
            SET status = CASE WHEN o.status = 'awaiting_verification' THEN 'reverted' \
                              ELSE 'lapsed' END \
           FROM pharmacy_store_orders o \
          WHERE r.id IN (SELECT id FROM pharmacy_substitution_requests \
                          WHERE tenant_id = $1 AND status = 'phone_pending' \
                            AND confirm_due_at <= now() AND deleted_at IS NULL \
                          ORDER BY confirm_due_at LIMIT $2 FOR UPDATE SKIP LOCKED) \
            AND o.id = r.store_order_id \
         RETURNING r.id, r.status",
    )
    .bind(tenant_id)
    .bind(SWEEP_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let back: Vec<Uuid> = reverted
        .into_iter()
        .filter(|(_, status)| status == "reverted")
        .map(|(id, _)| id)
        .collect();
    if back.is_empty() {
        return Ok(());
    }
    apply(tx, tenant_id, &back).await
}

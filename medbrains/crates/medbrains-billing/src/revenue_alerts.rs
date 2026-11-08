//! The insurance desk's rows on the leakage inbox (revenue integrity RFC 1.3, 1.4).
//!
//! Pre-auths nearly used up and rooms above the policy limit. Same table as the charge queue (`charge_attention_items`), its own
//! kinds, each seen and worked under its own permission; a row of a kind the
//! caller may not see answers 404, as if absent.
//!
//! The rows are raised elsewhere: `preauth_used_up` by the invoice trigger
//! (migration 1423), `room_over_limit` by the IPD allocation
//! (`medbrains_server_services::room_eligibility`). Here the desk lists them
//! and acts: request an enhancement, or record the family's room consent.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{error::AppError, middleware::auth::Claims, state::AppState};
use medbrains_server_services::room_eligibility::{
    RoomConsentInput, consent_on_row, mark_actioned,
};

/// Pre-auth nearly used up (or its approval unreadable).
pub const KIND_PREAUTH: &str = "preauth_used_up";
/// Room above the policy's room rent limit.
pub const KIND_ROOM: &str = "room_over_limit";

/// One inbox row of an insurance kind, with the patient and payer joined.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RevenueAlert {
    pub id: Uuid,
    pub kind: String,
    /// `preauth_used_up`, `preauth_approval_unknown`, `room_over_limit` or
    /// `room_eligibility_unknown`: the unknowns are faults, never "fine".
    pub reason: String,
    pub status: String,
    /// The pre-auth (`prior_auth_requests`) or the admission.
    pub source_entity_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub patient_name: String,
    pub uhid: String,
    pub payer: Option<String>,
    pub pa_number: Option<String>,
    /// Rupees at stake: the running bill, or the expected cut.
    pub amount: Option<Decimal>,
    /// The numbers behind the row (approved amount, room rate, ratio, ...).
    pub evidence: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by_name: Option<String>,
}

const ALERT_SELECT: &str = "SELECT a.id, a.kind, a.reason, a.status, a.source_entity_id, \
        a.patient_id, a.encounter_id, \
        btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid, \
        pi.insurance_provider AS payer, pa.pa_number, a.amount, a.evidence, a.created_at, \
        a.resolved_at, ru.full_name AS resolved_by_name \
   FROM charge_attention_items a \
   JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
   LEFT JOIN prior_auth_requests pa \
     ON a.source_module = 'prior_auth' AND pa.id = a.source_entity_id AND pa.tenant_id = a.tenant_id \
   LEFT JOIN patient_insurance pi ON pi.tenant_id = a.tenant_id \
     AND pi.id = COALESCE(pa.patient_insurance_id, (a.evidence->>'patient_insurance_id')::uuid) \
   LEFT JOIN users ru ON ru.id = a.resolved_by";

/// The permission that lets the caller see (`act` false) or work a kind;
/// an unknown kind is a 400.
fn kind_permission(kind: &str, act: bool) -> Result<&'static str, AppError> {
    use permissions::insurance::{enhancement, room_eligibility};
    Ok(match (kind, act) {
        (KIND_PREAUTH, false) => enhancement::VIEW,
        (KIND_PREAUTH, true) => enhancement::REQUEST,
        (KIND_ROOM, false) => room_eligibility::VIEW,
        (KIND_ROOM, true) => room_eligibility::RESOLVE,
        _ => {
            return Err(AppError::BadRequest(
                "billing.revenueAlerts.unknownKind".to_owned(),
            ));
        }
    })
}

#[derive(Debug, Deserialize)]
pub struct ListRevenueAlertsQuery {
    pub kind: String,
    /// `open` (default), `actioned`, or `all`.
    pub status: Option<String>,
}

/// `GET /api/billing/revenue-alerts?kind=` — the kind's rows, largest
/// amount first, then oldest. Amounts are hidden from a caller who may not
/// see them, as on the charge queue.
///
/// # Errors
/// 403 without the kind's view permission; 400 for an unknown kind.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_revenue_alerts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListRevenueAlertsQuery>,
) -> Result<Json<Vec<RevenueAlert>>, AppError> {
    require_permission(&claims, kind_permission(&q.kind, false)?)?;
    let visible =
        medbrains_authz_gate::require_patient_billing_filter(&state, &claims, None).await?;
    let hide_amounts = crate::amounts_hidden(&state, &claims).await?;
    let status = match q.status.as_deref() {
        None | Some("open") => Some("open"),
        Some("all") => None,
        Some(other) => Some(other),
    };
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let mut rows = sqlx::query_as::<_, RevenueAlert>(&format!(
        "{ALERT_SELECT} WHERE a.tenant_id = $1 AND a.kind = $2 AND a.deleted_at IS NULL \
           AND ($3::text IS NULL OR a.status = $3) \
           AND ($4::uuid[] IS NULL OR a.patient_id = ANY($4)) \
         ORDER BY a.amount DESC NULLS LAST, a.created_at LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(&q.kind)
    .bind(status)
    .bind(&visible)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    if hide_amounts {
        for row in &mut rows {
            row.amount = None;
            row.evidence = None;
        }
    }
    Ok(Json(rows))
}

/// The open row of `kind`, locked for this decision, once the caller has
/// billing access to its patient: 404 if missing or of another kind, 409 once
/// acted on. Returns the row's reason and subject.
async fn lock_open(
    conn: &mut PgConnection,
    (state, claims): (&AppState, &Claims),
    kind: &str,
    id: Uuid,
) -> Result<(String, Uuid), AppError> {
    let (status, reason, patient, subject): (String, String, Uuid, Uuid) = sqlx::query_as(
        "SELECT status, reason, patient_id, source_entity_id FROM charge_attention_items \
          WHERE id = $1 AND tenant_id = $2 AND kind = $3 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(kind)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    if status != "open" {
        return Err(AppError::Conflict(
            "billing.revenueAlerts.alreadyResolved".to_owned(),
        ));
    }
    medbrains_authz_gate::require_patient_billing_access(state, claims, patient).await?;
    Ok((reason, subject))
}

/// One row by id, as the list shows it.
async fn fetch(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<RevenueAlert, AppError> {
    Ok(sqlx::query_as::<_, RevenueAlert>(&format!(
        "{ALERT_SELECT} WHERE a.id = $1 AND a.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_one(conn)
    .await?)
}

#[derive(Debug, Deserialize)]
pub struct RequestEnhancementBody {
    /// How much more to ask the payer for, in rupees.
    pub additional_amount: Decimal,
    pub note: Option<String>,
}

/// `PUT /api/billing/revenue-alerts/{id}/request-enhancement` — ask for more.
///
/// For a pre-auth nearly used up. The pre-auth becomes an `enhancement`
/// request for the new total (sent from the pre-auth screen, through NHCX or
/// the payer's portal), and the alert closes with what was asked.
///
/// # Errors
/// 403 without `insurance.enhancement.request` or billing access to the
/// patient; 400 for an amount not above zero; 404 / 409 as `lock_open`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn request_enhancement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RequestEnhancementBody>,
) -> Result<Json<RevenueAlert>, AppError> {
    require_permission(&claims, kind_permission(KIND_PREAUTH, true)?)?;
    if body.additional_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "billing.revenueAlerts.amountRequired".to_owned(),
        ));
    }
    let note = body
        .note
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    if note.is_some_and(|n| n.chars().count() > 500) {
        return Err(AppError::BadRequest(
            "billing.revenueAlerts.noteTooLong".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let (_, prior_auth) = lock_open(&mut tx, (&state, &claims), KIND_PREAUTH, id).await?;
    let total: Decimal = sqlx::query_scalar(
        "UPDATE prior_auth_requests SET request_stage = 'enhancement', \
                estimated_cost = COALESCE(approved_amount, 0) + $3, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING estimated_cost",
    )
    .bind(prior_auth)
    .bind(claims.tenant_id)
    .bind(body.additional_amount.round_dp(2))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let what = serde_json::json!({ "enhancement": {
        "additional_amount": body.additional_amount.round_dp(2),
        "requested_total": total,
        "note": note,
    }});
    mark_actioned(&mut tx, claims.tenant_id, claims.sub, id, what).await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `PUT /api/billing/revenue-alerts/{id}/room-consent` — record room consent.
///
/// The family agreed, after the allocation, to pay the proportionate deduction for the higher
/// room. The consent keeps the row's numbers; the row closes.
///
/// # Errors
/// 403 without `insurance.room_eligibility.resolve` or billing access to the
/// patient; 409 on a "could not check" row, which has no numbers to consent
/// to; 400 without who agreed.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn record_room_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RoomConsentInput>,
) -> Result<Json<RevenueAlert>, AppError> {
    require_permission(&claims, kind_permission(KIND_ROOM, true)?)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let (reason, _) = lock_open(&mut tx, (&state, &claims), KIND_ROOM, id).await?;
    if reason != KIND_ROOM {
        return Err(AppError::Conflict(
            "billing.revenueAlerts.roomNotChecked".to_owned(),
        ));
    }
    consent_on_row(&mut tx, claims.tenant_id, claims.sub, id, &body).await?;
    let row = fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}
